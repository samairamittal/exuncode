import { bus } from "@/lib/events";
import { audioContext, resumeAudio } from "./audio";

// Lens opening music: starts the moment the double clap lands, plays ~6.5 s at full
// volume, then fades out over 2 s while LENS greets (onFadeOut fires as the fade starts). It's a QuickTime (.mov) file, so it plays through a media element routed into
// Web Audio (audio element first, a hidden video element if audio can't decode it). The file
// is git-ignored; when it's missing or won't play, a short synth power-up plays instead.

const SOURCES = ["/audio/intro.mp3.mov", "/audio/into.mp3.mov"];
const HOLD_S = 6.5;
const FADE_IN_S = 0.3;
const FADE_OUT_S = 2;
const PLAY_S = HOLD_S + FADE_OUT_S;
const VOLUME = 0.8;
const BEAT_RISE = 0.12;

export type MusicStatus = "idle" | "playing" | "synth" | "ended" | "blocked";

let current: { stop: () => void } | null = null;

async function findSource(): Promise<string | null> {
  for (const src of SOURCES) {
    const res = await fetch(src, { method: "HEAD" }).catch(() => null);
    if (res?.ok) return src;
  }
  return null;
}

function mediaElement(kind: "audio" | "video", src: string): Promise<HTMLMediaElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind);
    el.preload = "auto";
    el.src = src;
    if (el instanceof HTMLVideoElement) el.playsInline = true; // never attached: no picture
    el.oncanplay = () => resolve(el);
    el.onerror = () => reject(new Error(`${kind} can't play ${src}`));
    el.load();
  });
}

/** Watches the level and emits music:beat on sharp rises. */
function watchBeats(analyser: AnalyserNode, isOn: () => boolean) {
  const data = new Float32Array(analyser.fftSize);
  let avg = 0;
  let last = 0;
  const tick = (now: number) => {
    if (!isOn()) return;
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    const level = Math.sqrt(sum / data.length);
    if (level - avg > BEAT_RISE * Math.max(avg, 0.05) * 4 && now - last > 180) {
      last = now;
      bus.emit("music:beat", { level });
    }
    avg += (level - avg) * 0.1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function synthPowerUp(ctx: AudioContext): () => void {
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
  gain.connect(ctx.destination);
  const oscs = [220, 330].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i ? "triangle" : "sawtooth";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 4, t + 1.6);
    o.connect(gain);
    o.start(t);
    o.stop(t + 2.3);
    return o;
  });
  return () => oscs.forEach((o) => o.stop());
}

/**
 * Plays the opening music. Resolves with what played once it's started. `onFadeOut` is
 * called when the fade-out begins (time to greet).
 */
export async function playIntro(onFadeOut?: () => void): Promise<MusicStatus> {
  stopMusic();
  const ctx = audioContext();
  const running = await resumeAudio();

  const src = await findSource();
  let el: HTMLMediaElement | null = null;
  if (src) el = await mediaElement("audio", src).catch(() => mediaElement("video", src).catch(() => null));

  if (!el) {
    if (!running) return "blocked";
    const stopSynth = synthPowerUp(ctx);
    bus.emit("music:start", { source: "synth" });
    const id = setTimeout(() => {
      onFadeOut?.();
      bus.emit("music:end", {});
    }, 2000);
    current = { stop: () => (clearTimeout(id), stopSynth()) };
    return "synth";
  }

  const media = el;
  let on = true;
  let fadeOut: () => void;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const end = () => {
    if (!on) return;
    on = false;
    timers.forEach(clearTimeout);
    media.pause();
    bus.emit("music:end", {});
  };

  if (running) {
    // Through Web Audio: smooth fades and a level for the beat pulse.
    const node = ctx.createMediaElementSource(media);
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    node.connect(gain).connect(analyser).connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(VOLUME, t + FADE_IN_S);
    gain.gain.setValueAtTime(VOLUME, t + HOLD_S);
    gain.gain.linearRampToValueAtTime(0, t + PLAY_S);
    watchBeats(analyser, () => on);
    fadeOut = () => {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      timers.push(setTimeout(end, 550));
    };
  } else {
    // Web Audio isn't allowed to run yet: play the element directly, fading by volume.
    media.volume = VOLUME;
    const started = performance.now();
    const step = () => {
      if (!on) return;
      const s = (performance.now() - started) / 1000;
      media.volume = Math.max(0, VOLUME * (s < HOLD_S ? Math.min(1, s / FADE_IN_S) : 1 - (s - HOLD_S) / FADE_OUT_S));
      timers.push(setTimeout(step, 50));
    };
    step();
    fadeOut = end;
  }

  timers.push(setTimeout(() => onFadeOut?.(), HOLD_S * 1000), setTimeout(end, PLAY_S * 1000));
  media.onended = end;
  try {
    await media.play();
  } catch {
    end();
    return "blocked";
  }
  bus.emit("music:start", { source: src ?? "" });
  current = { stop: () => fadeOut() };
  return "playing";
}

/** Fades the music out (or stops the synth). */
export function stopMusic(): void {
  current?.stop();
  current = null;
}
