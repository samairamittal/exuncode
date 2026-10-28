// One AudioContext and one microphone stream for the whole site (clap detection, music).
// Browsers may keep audio suspended until the first click, key or touch: `unlockOnFirstInteraction`
// resumes everything then, silently.

let context: AudioContext | null = null;
let mic: MediaStream | null = null;

export function audioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

export const audioState = (): AudioContextState | "none" => context?.state ?? "none";

/** Tries to start audio. Resolves true if it's running (it may stay suspended until a gesture). */
export async function resumeAudio(): Promise<boolean> {
  const ctx = audioContext();
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  return ctx.state === "running";
}

/** Raw mic for transient detection: no echo cancellation, noise suppression or gain control. */
export async function openMic(): Promise<MediaStream> {
  if (mic?.active) return mic;
  mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  });
  return mic;
}

export function closeAudio(): void {
  mic?.getTracks().forEach((t) => t.stop());
  mic = null;
  void context?.close();
  context = null;
}

const EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

/** Runs `callback` once, on the first click, key press or touch. Returns a cancel function. */
export function unlockOnFirstInteraction(callback: () => void): () => void {
  const run = () => {
    cancel();
    callback();
  };
  const cancel = () => EVENTS.forEach((e) => window.removeEventListener(e, run, true));
  EVENTS.forEach((e) => window.addEventListener(e, run, { capture: true, passive: true }));
  return cancel;
}
