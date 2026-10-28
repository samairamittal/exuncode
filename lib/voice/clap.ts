import { audioContext } from "./audio";

// Double-clap detection from the microphone.
//
// A clap is a sharp transient: loudness (RMS) jumps well above the rolling background
// level almost instantly (a near-vertical attack), falls back within ~120 ms, and carries
// real energy between 2 and 8 kHz. That rules out speech and music (slow attack, too long)
// and knocks (energy too low in frequency). Two claps 150–700 ms apart
// make a double clap, followed by a 1 s cooldown.
//
// ClapDetector and DoubleClap are pure (tested in clap.test.ts). start() feeds them from the
// mic in ~10 ms frames: read straight from the track with MediaStreamTrackProcessor where
// available (works before any click, since it needs no AudioContext), otherwise from an
// AnalyserNode polled on requestAnimationFrame.

export type Sensitivity = "low" | "medium" | "high";

/** How many times above the background a transient must be. */
export const SENSITIVITY: Record<Sensitivity, number> = { low: 7, medium: 4.5, high: 3 };

export const CLAP = {
  maxDurationMs: 120,
  /** Share of energy in the 2–8 kHz band. Claps are broadband (white noise is ~0.27); thuds sit far lower. */
  minBandRatio: 0.15,
  /** Onset loudness over the frame before it: claps jump at once, voices ramp up. */
  minRise: 3,
  /** The clap is over once it falls below this share of its own peak (room echo is fine). */
  releaseOfPeak: 0.3,
  /** Below this RMS nothing counts, however quiet the room. */
  minRms: 0.02,
  refractoryMs: 80,
  minGapMs: 150,
  maxGapMs: 700,
  cooldownMs: 1000,
  bandHz: [2000, 8000] as const,
} as const;

export interface ClapFrame {
  /** Milliseconds. */
  t: number;
  rms: number;
  /** Share of spectral energy between 2 and 8 kHz, 0–1. */
  bandRatio: number;
}

export type ClapVerdict = "clap" | "too long" | "low band" | "slow attack";

export class ClapDetector {
  private floor = 0.005;
  private onset: number | null = null;
  private onsetBand = 0;
  private peak = 0;
  private prev = 0;
  private lastClap = -Infinity;
  /** The last loud transient and what was decided about it (for the debug panel). */
  last: { t: number; peak: number; band: number; ms: number; verdict: ClapVerdict } | null = null;

  constructor(private multiple = SENSITIVITY.medium) {}

  setSensitivity(s: Sensitivity): void {
    this.multiple = SENSITIVITY[s];
  }

  /** Current trigger level. */
  get threshold(): number {
    return Math.max(CLAP.minRms, this.floor * this.multiple);
  }

  get background(): number {
    return this.floor;
  }

  /** Feed one analysis frame; returns the clap time when a clap ends in this frame. */
  push({ t, rms, bandRatio }: ClapFrame): number | null {
    const prev = this.prev;
    this.prev = rms;
    const loud = rms > this.threshold;
    if (this.onset === null) {
      if (loud && t - this.lastClap > CLAP.refractoryMs) {
        if (rms < Math.max(prev, this.floor) * CLAP.minRise) {
          this.last = { t, peak: rms, band: bandRatio, ms: 0, verdict: "slow attack" };
          this.onset = -1; // wait for it to pass
          return null;
        }
        this.onset = t;
        this.onsetBand = bandRatio;
        this.peak = rms;
        return null;
      }
      // Only quiet frames teach the background level, so claps don't raise it.
      if (!loud) this.floor += (rms - this.floor) * (rms < this.floor ? 0.1 : 0.01);
      return null;
    }
    this.peak = Math.max(this.peak, rms);
    if (rms > Math.max(this.threshold * 0.5, this.peak * CLAP.releaseOfPeak)) {
      this.onsetBand = Math.max(this.onsetBand, bandRatio);
      // Still sounding: too long to be a clap? Then it's speech or music; wait it out.
      if (this.onset >= 0 && t - this.onset > CLAP.maxDurationMs) {
        this.last = { t: this.onset, peak: this.peak, band: this.onsetBand, ms: t - this.onset, verdict: "too long" };
        this.onset = -1;
      }
      return null;
    }
    const start = this.onset;
    this.onset = null;
    if (start < 0) return null;
    const verdict: ClapVerdict = this.onsetBand < CLAP.minBandRatio ? "low band" : "clap";
    this.last = { t: start, peak: this.peak, band: this.onsetBand, ms: t - start, verdict };
    if (verdict !== "clap") return null;
    this.lastClap = start;
    return start;
  }
}

export class DoubleClap {
  private first: number | null = null;
  private coolUntil = -Infinity;

  /** Feed a clap time; true when it completes a double clap. */
  push(t: number): boolean {
    if (t < this.coolUntil) return false;
    if (this.first !== null) {
      const gap = t - this.first;
      if (gap < CLAP.minGapMs) return false; // the same clap's echo
      if (gap <= CLAP.maxGapMs) {
        this.first = null;
        this.coolUntil = t + CLAP.cooldownMs;
        return true;
      }
    }
    this.first = t;
    return false;
  }
}

// ---- runtime -----------------------------------------------------------------------------

export interface ClapOptions {
  sensitivity?: Sensitivity;
  onClap?: (t: number) => void;
  onDouble: (t: number) => void;
  /** Skip detection (Lens speaking, music playing). */
  paused?: () => boolean;
  /**
   * Optional visual check at clap time: "reject" when two tracked hands weren't coming
   * together. "unknown" (no hands in view) accepts the audio-only clap.
   */
  confirm?: (t: number) => "confirm" | "reject" | "unknown";
}

let running: { stop: () => void; detector: ClapDetector; level: () => number } | null = null;

/** 2–8 kHz band-pass (RBJ biquad, constant 0 dB peak), sample by sample. */
function bandPass(sampleRate: number) {
  const [lo, hi] = CLAP.bandHz;
  const f0 = Math.sqrt(lo * hi);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(w0) / (2 * (f0 / (hi - lo)));
  const a0 = 1 + alpha;
  const [b0, b2, a1, a2] = [alpha / a0, -alpha / a0, (-2 * Math.cos(w0)) / a0, (1 - alpha) / a0];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/**
 * Turns raw mic samples into ~10 ms analysis frames (RMS and 2–8 kHz energy share).
 * Shared by the live mic path and the tests.
 */
export function frameAnalyser(sampleRate: number, onFrame: (rms: number, bandRatio: number) => void) {
  const filter = bandPass(sampleRate);
  const size = Math.round(sampleRate / 100);
  let n = 0, total = 0, band = 0;
  return (samples: Float32Array) => {
    for (const x of samples) {
      const y = filter(x);
      total += x * x;
      band += y * y;
      if (++n === size) {
        onFrame(Math.sqrt(total / n), total ? band / total : 0);
        n = total = band = 0;
      }
    }
  };
}

type TrackProcessor = new (init: { track: MediaStreamTrack }) => {
  readable: ReadableStream<{ numberOfFrames: number; sampleRate: number; timestamp: number; copyTo: (dest: Float32Array, opts: { planeIndex: number; format: "f32-planar" }) => void; close: () => void }>;
};

export function start(stream: MediaStream, options: ClapOptions): void {
  stop();
  const detector = new ClapDetector(SENSITIVITY[options.sensitivity ?? "medium"]);
  const double = new DoubleClap();
  let level = 0;

  const onFrame = (t: number, rms: number, bandRatio: number) => {
    level = rms;
    if (options.paused?.()) return;
    const clap = detector.push({ t, rms, bandRatio });
    if (clap === null) return;
    if (options.confirm?.(clap) === "reject") return;
    options.onClap?.(clap);
    if (double.push(clap)) options.onDouble(clap);
  };

  const Processor = (globalThis as { MediaStreamTrackProcessor?: TrackProcessor }).MediaStreamTrackProcessor;
  const track = stream.getAudioTracks()[0];
  if (Processor && track) {
    // Raw samples straight from the mic track, in ~10 ms frames.
    const reader = new Processor({ track: track.clone() }).readable.getReader();
    let stopped = false;
    let analyse: ((samples: Float32Array) => void) | null = null;
    let samples = new Float32Array(0);
    void (async () => {
      while (!stopped) {
        const { value: data, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
        if (done || !data) break;
        analyse ??= frameAnalyser(data.sampleRate, (rms, band) => onFrame(performance.now(), rms, band));
        if (samples.length < data.numberOfFrames) samples = new Float32Array(data.numberOfFrames);
        const view = samples.subarray(0, data.numberOfFrames);
        data.copyTo(view, { planeIndex: 0, format: "f32-planar" });
        data.close();
        analyse(view);
      }
    })();
    running = {
      detector,
      level: () => level,
      stop: () => {
        stopped = true;
        void reader.cancel().catch(() => undefined);
      },
    };
    return;
  }

  // Fallback: AnalyserNode on requestAnimationFrame (needs a running AudioContext).
  const ctx = audioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  const time = new Float32Array(analyser.fftSize);
  const freq = new Float32Array(analyser.frequencyBinCount);
  const binHz = ctx.sampleRate / analyser.fftSize;
  const [lo, hi] = CLAP.bandHz.map((hz) => Math.round(hz / binHz));
  let frame = 0;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    analyser.getFloatTimeDomainData(time);
    let sum = 0;
    for (const v of time) sum += v * v;
    analyser.getFloatFrequencyData(freq);
    let inBand = 0;
    let all = 0;
    for (let i = 1; i < freq.length; i++) {
      const p = 10 ** (freq[i] / 10);
      all += p;
      if (i >= lo && i <= hi) inBand += p;
    }
    onFrame(now, Math.sqrt(sum / time.length), all ? inBand / all : 0);
  };
  frame = requestAnimationFrame(tick);
  running = {
    detector,
    level: () => level,
    stop: () => {
      cancelAnimationFrame(frame);
      source.disconnect();
    },
  };
}

export function stop(): void {
  running?.stop();
  running = null;
}

export function setSensitivity(s: Sensitivity): void {
  running?.detector.setSensitivity(s);
}

/** Live mic level (RMS) and the current trigger threshold, for the debug panel. */
export function level(): { rms: number; threshold: number; background: number; last: ClapDetector["last"] } {
  return {
    rms: running?.level() ?? 0,
    threshold: running?.detector.threshold ?? 0,
    background: running?.detector.background ?? 0,
    last: running?.detector.last ?? null,
  };
}
