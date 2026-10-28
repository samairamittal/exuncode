import { bus } from "@/lib/events";

// LENS's voice for live lines: speechSynthesis with a calm British male voice, JARVIS
// style, a shade below natural pitch. (Fixed lines like the greeting use robot.ts.)
// speechSynthesis gives no audio level, so the level for animation is driven by word
// boundaries: each word kicks it up and it decays between words.
// If the browser blocks speech before the first interaction, the line is kept and spoken
// on `flushBlockedSpeech()`.

const RATE = 1;
const PITCH = 0.9;
/** Preferred voices, best first: British male (macOS, Chrome, Edge names). */
const PREFERRED = ["Daniel", "Google UK English Male", "Microsoft Ryan", "Arthur", "Oliver", "Microsoft George"];

let voice: SpeechSynthesisVoice | null = null;
let speaking = false;
let blocked: string | null = null;
let level = 0;
let frame = 0;

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice || !supported()) return voice;
  const voices = window.speechSynthesis.getVoices();
  voice =
    PREFERRED.map((name) => voices.find((v) => v.name.includes(name))).find(Boolean) ??
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return voice;
}

export const isSpeaking = () => speaking;

function pump(text: string) {
  level *= 0.9;
  bus.emit("voice:speaking", { level, text });
  if (speaking) frame = requestAnimationFrame(() => pump(text));
}

/** Speaks a line, replacing anything already being said. Resolves when it's done. */
export function speak(text: string): Promise<void> {
  if (!supported()) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice();
    u.lang = u.voice?.lang ?? "en-GB";
    u.rate = RATE;
    u.pitch = PITCH;
    const finish = () => {
      if (!speaking) return resolve();
      speaking = false;
      cancelAnimationFrame(frame);
      level = 0;
      bus.emit("voice:done", { text });
      resolve();
    };
    u.onstart = () => {
      speaking = true;
      level = 1;
      pump(text);
    };
    u.onboundary = () => {
      level = Math.max(level, 0.8);
    };
    u.onend = finish;
    u.onerror = (e) => {
      if (e.error === "not-allowed") blocked = text;
      finish();
    };
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (!supported()) return;
  window.speechSynthesis.cancel();
}

/** Speaks the line the browser blocked before the first interaction, if any. */
export function flushBlockedSpeech(): void {
  if (!blocked) return;
  const text = blocked;
  blocked = null;
  void speak(text);
}

export const speechBlocked = () => blocked !== null;

if (supported()) window.speechSynthesis.addEventListener?.("voiceschanged", () => (voice = null));
