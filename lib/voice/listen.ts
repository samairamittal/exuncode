import { bus } from "@/lib/events";
import { isQuestion } from "./answers";
import { matchCommand, normalise, parseUtterance, type Command } from "./commands";

// Continuous speech recognition (Web Speech API, Chrome and Edge) with the wake word.
// "Lens, scan the transcript" acts at once; "Lens" alone opens a 6 s window in which the
// next utterance is taken as a command or question, and openWindow() reopens it after LENS
// answers, for follow-ups. Questions ("what…", "why…", "is…") go to onQuestion; commands
// to onCommand; anything unmatched is treated as a question too.
// To feel responsive it acts once the words stop changing for STABLE_MS, instead of
// waiting for Chrome's final result, and ignores that final result when it arrives.
// Results are ignored while LENS itself is speaking, so it never answers its own voice.

const WAKE_WINDOW_MS = 6000;
const STABLE_MS = 700;

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

export function recognitionSupported(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export type ListenState = "unsupported" | "starting" | "on" | "blocked" | "error" | "off";

export interface ListenOptions {
  onCommand: (command: Command, transcript: string) => void;
  onQuestion: (question: string, transcript: string) => void;
  /** The wake word was just heard (for an instant acknowledgement). */
  onWake?: () => void;
  onState?: (state: ListenState, detail?: string) => void;
  onTranscript?: (transcript: string, final: boolean) => void;
  /** Wake window opened or closed. */
  onWakeChange?: (awake: boolean) => void;
  isSpeaking?: () => boolean;
}

export interface Listener {
  stop: () => void;
  /** Listen for a follow-up without the wake word, for a few seconds. */
  openWindow: () => void;
  /** Try again after the first user interaction if the browser blocked the mic. */
  retry: () => void;
}

export function startListening(options: ListenOptions): Listener {
  if (!recognitionSupported()) {
    options.onState?.("unsupported");
    return { stop: () => undefined, retry: () => undefined, openWindow: () => undefined };
  }
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition)!;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-GB";

  let stopped = false;
  let awakeUntil = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;

  const setAwake = (on: boolean) => {
    clearTimeout(wakeTimer);
    awakeUntil = on ? Date.now() + WAKE_WINDOW_MS : 0;
    options.onWakeChange?.(on);
    if (on) wakeTimer = setTimeout(() => setAwake(false), WAKE_WINDOW_MS);
  };

  let handled = "";
  let stableTimer: ReturnType<typeof setTimeout> | undefined;
  let lastWake = 0;

  const wake = () => {
    if (Date.now() - lastWake < 1500) return;
    lastWake = Date.now();
    options.onWake?.();
  };

  const handle = (transcript: string) => {
    const key = normalise(transcript);
    if (!key || key === handled || (handled && key.startsWith(handled))) return;
    const { woke, text } = parseUtterance(transcript);
    const inWindow = Date.now() < awakeUntil;
    if (!woke && !inWindow) return;
    if (woke && !text) {
      bus.emit("voice:wake", { transcript });
      setAwake(true);
      return;
    }
    handled = key;
    if (woke) bus.emit("voice:wake", { transcript });
    setAwake(false);
    const command = isQuestion(text) ? null : matchCommand(text);
    if (command) {
      bus.emit("voice:command", { id: command.id, arg: command.arg, transcript });
      options.onCommand(command, transcript);
    } else {
      bus.emit("voice:question", { question: text, transcript });
      options.onQuestion(text, transcript);
    }
  };

  rec.onresult = (e) => {
    if (options.isSpeaking?.()) return;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const transcript = result[0].transcript.trim();
      options.onTranscript?.(transcript, result.isFinal);
      clearTimeout(stableTimer);
      if (result.isFinal) {
        handle(transcript);
        handled = "";
        continue;
      }
      // Interim: acknowledge the wake word at once, act when the words settle.
      const { woke, text } = parseUtterance(transcript);
      if (woke) {
        wake();
        if (Date.now() >= awakeUntil) setAwake(true);
      }
      if ((woke && text) || (!woke && Date.now() < awakeUntil)) stableTimer = setTimeout(() => handle(transcript), STABLE_MS);
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") options.onState?.("blocked", e.error);
    else if (e.error !== "no-speech" && e.error !== "aborted") options.onState?.("error", e.error);
  };
  // Chrome ends recognition after a while; keep it running.
  rec.onend = () => {
    if (!stopped) setTimeout(() => !stopped && safeStart(), 250);
  };

  const safeStart = () => {
    try {
      rec.start();
      options.onState?.("on");
    } catch {
      // Already started.
    }
  };
  options.onState?.("starting");
  safeStart();

  return {
    openWindow: () => {
      if (!stopped) setAwake(true);
    },
    stop: () => {
      stopped = true;
      clearTimeout(wakeTimer);
      clearTimeout(stableTimer);
      rec.onend = null;
      rec.abort();
      options.onState?.("off");
    },
    retry: () => {
      if (!stopped) safeStart();
    },
  };
}
