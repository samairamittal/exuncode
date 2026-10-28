import { bus } from "@/lib/events";
import { audioContext, resumeAudio } from "./audio";
import { speak } from "./speak";

// LENS's voice for its fixed lines: a JARVIS-style assistant, a calm British male voice
// (pre-rendered by scripts/build-voice-assets.mjs) with a light synthetic sheen added here
// in Web Audio: a touch lower, a faint ring-modulated shimmer, a short comb for the
// "speaking from the system" resonance, and a little warmth. Kept subtle so it stays human.
// Emits voice:speaking with the real output level, then voice:done.

export const GREETING = "Good morning, agent.";
const GREETING_SRC = "/audio/greeting.wav";

const ROBOT = {
  rate: 0.97, // just under natural pitch
  ringHz: 110,
  ringMix: 0.06,
  dryMix: 1,
  combDelay: 0.007,
  combFeedback: 0.25,
  combMix: 0.14,
  bassDb: 2,
  volume: 1,
} as const;

const buffers = new Map<string, Promise<AudioBuffer>>();
function load(ctx: AudioContext, src: string): Promise<AudioBuffer> {
  if (!buffers.has(src))
    buffers.set(
      src,
      fetch(src)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${src}: ${r.status}`))))
        .then((data) => ctx.decodeAudioData(data)),
    );
  return buffers.get(src)!;
}

/** Plays a pre-rendered line through the robot chain. Resolves when it finishes. */
export async function playRobot(src: string, text: string): Promise<"played" | "blocked" | "failed"> {
  const ctx = audioContext();
  if (!(await resumeAudio())) return "blocked";
  let buffer: AudioBuffer;
  try {
    buffer = await load(ctx, src);
  } catch {
    return "failed";
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = ROBOT.rate;

  const out = ctx.createGain();
  out.gain.value = ROBOT.volume;

  const dry = ctx.createGain();
  dry.gain.value = ROBOT.dryMix;
  source.connect(dry).connect(out);

  // Ring modulator: signal × sine.
  const ring = ctx.createGain();
  ring.gain.value = 0;
  const carrier = ctx.createOscillator();
  carrier.frequency.value = ROBOT.ringHz;
  carrier.connect(ring.gain);
  const ringMix = ctx.createGain();
  ringMix.gain.value = ROBOT.ringMix;
  source.connect(ring).connect(ringMix).connect(out);

  // Feedback comb.
  const delay = ctx.createDelay(0.1);
  delay.delayTime.value = ROBOT.combDelay;
  const feedback = ctx.createGain();
  feedback.gain.value = ROBOT.combFeedback;
  const combMix = ctx.createGain();
  combMix.gain.value = ROBOT.combMix;
  source.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(combMix).connect(out);

  const bass = ctx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 180;
  bass.gain.value = ROBOT.bassDb;
  const comp = ctx.createDynamicsCompressor();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  out.connect(bass).connect(comp).connect(analyser).connect(ctx.destination);

  const level = new Float32Array(analyser.fftSize);
  let playing = true;
  const meter = () => {
    if (!playing) return;
    analyser.getFloatTimeDomainData(level);
    let sum = 0;
    for (const v of level) sum += v * v;
    bus.emit("voice:speaking", { level: Math.min(1, Math.sqrt(sum / level.length) * 4), text });
    requestAnimationFrame(meter);
  };

  return new Promise((resolve) => {
    source.onended = () => {
      playing = false;
      carrier.stop();
      out.disconnect();
      bus.emit("voice:done", { text });
      resolve("played");
    };
    carrier.start();
    source.start();
    meter();
  });
}

/** The greeting: robotic file, or the system voice if the file can't play. */
export async function greet(): Promise<"played" | "blocked"> {
  const result = await playRobot(GREETING_SRC, GREETING);
  if (result === "failed") {
    await speak(GREETING);
    return "played";
  }
  return result;
}
