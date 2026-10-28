"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { bus } from "@/lib/events";
import { useHandsFree } from "@/lib/store/handsfree";
import { confirmClap } from "@/lib/vision/clapConfirm";
import { audioState, closeAudio, openMic, resumeAudio, unlockOnFirstInteraction } from "@/lib/voice/audio";
import * as clap from "@/lib/voice/clap";
import { playIntro, stopMusic } from "@/lib/voice/music";
import { greet, GREETING } from "@/lib/voice/robot";
import { flushBlockedSpeech, isSpeaking, speechBlocked, stopSpeaking } from "@/lib/voice/speak";
import { usePageTransition } from "../layout/PageTransition";
import { DebugPanel } from "./DebugPanel";

// Site-wide hands-free control: the mic runs on every page for the double clap.
// - Double clap (or Shift twice) opens Lens: the music starts at once, Lens boots, and as
//   the music fades (~6.5 s in) LENS greets in its robotic voice. On Lens it re-opens.
// - Audio may be blocked until the first interaction: resume it then, silently.
// - LENS's speech and the music are mirrored into the store for the UI.
// Camera, hand tracking and speech recognition live on the Lens page (LensHandsFree).

const SHIFT_GAP_MS = 400;
const BOOT_MS = 5000;
const MUTED_GREET_MS = 1500;

export function HandsFree() {
  const pathname = usePathname();
  const navigate = usePageTransition();
  const route = useRef({ pathname, navigate });
  useEffect(() => {
    route.current = { pathname, navigate };
  });

  useEffect(() => {
    const store = useHandsFree.getState();
    store.loadPreferences();
    let disposed = false;

    const onDouble = (at: number, confirmed: boolean) => {
      useHandsFree.setState({ lastDoubleClap: at });
      bus.emit("clap:double", { at, confirmed });
    };

    // Mic and clap detection.
    store.set({ mic: "starting" });
    openMic()
      .then((stream) => {
        if (disposed) return;
        store.set({ mic: "on" });
        clap.start(stream, {
          sensitivity: useHandsFree.getState().sensitivity,
          paused: () => {
            const s = useHandsFree.getState();
            return isSpeaking() || s.speaking || s.music === "playing" || s.music === "synth";
          },
          confirm: confirmClap,
          onClap: (t) => useHandsFree.getState().addClap(t),
          onDouble: (t) => onDouble(t, confirmClap(t) === "confirm"),
        });
        void resumeAudio().then(() => useHandsFree.setState({ audio: audioState() }));
      })
      .catch((error: Error) => {
        store.set({ mic: error.name === "NotAllowedError" ? "blocked" : "unavailable" });
        store.note(`Mic unavailable (${error.name}). Shift twice still works.`);
      });

    // Keyboard fallback: Shift twice quickly.
    let lastShift = -Infinity;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Shift" || e.repeat) return;
      const now = performance.now();
      if (now - lastShift < SHIFT_GAP_MS) {
        lastShift = -Infinity;
        onDouble(now, false);
      } else lastShift = now;
    };
    window.addEventListener("keydown", onKey);

    // Silent unlock on the first click, key or touch.
    const cancelUnlock = unlockOnFirstInteraction(() => {
      void resumeAudio().then(() => {
        const s = useHandsFree.getState();
        s.set({ audio: audioState() });
        s.note(`Audio unlocked by first interaction (${audioState()})`);
      });
      if (speechBlocked()) flushBlockedSpeech();
    });
    void resumeAudio().then((running) => {
      store.set({ audio: audioState() });
      if (!running) store.note("Audio suspended until the first click, key or touch");
    });

    // Double clap: open Lens. Music first, so it starts the instant the clap lands.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later: (() => void)[] = [];
    const open = () => {
      const s = useHandsFree.getState();
      s.set({ power: "booting", listening: true });
      bus.emit("lens:boot", { reason: "clap" });

      let greeted = false;
      const sayHello = () => {
        if (greeted) return;
        greeted = true;
        bus.emit("lens:greet", { text: GREETING });
        void greet().then((result) => {
          if (result !== "blocked") return;
          useHandsFree.getState().note("Greeting blocked until the first click, key or touch");
          later.push(unlockOnFirstInteraction(() => void greet()));
        });
      };
      if (s.muted) timers.push(setTimeout(sayHello, MUTED_GREET_MS));
      else
        void playIntro(sayHello).then((music) => {
          useHandsFree.setState({ music });
          if (music !== "blocked") return;
          useHandsFree.getState().note("Music blocked until the first click, key or touch");
          later.push(unlockOnFirstInteraction(() => void playIntro(sayHello)));
        });
      timers.push(setTimeout(() => useHandsFree.setState({ power: "on" }), BOOT_MS));

      const { pathname, navigate } = route.current;
      if (pathname !== "/lens") navigate?.("/lens");
    };
    const offClap = bus.on("clap:double", open);

    // Mirror LENS's voice and the music into the store.
    const offs = [
      offClap,
      bus.on("voice:speaking", ({ level, text }) => useHandsFree.setState({ speaking: true, voiceLevel: level, caption: text })),
      bus.on("voice:done", () => useHandsFree.setState({ speaking: false, voiceLevel: 0 })),
      bus.on("music:start", ({ source }) => useHandsFree.setState({ music: source === "synth" ? "synth" : "playing" })),
      bus.on("music:beat", () => useHandsFree.setState((s) => ({ beat: s.beat + 1 }))),
      bus.on("music:end", () => useHandsFree.setState({ music: "ended" })),
    ];

    const shutdown = () => {
      clap.stop();
      stopMusic();
      stopSpeaking();
      closeAudio();
    };
    window.addEventListener("pagehide", shutdown);

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      later.forEach((cancel) => cancel());
      offs.forEach((off) => off());
      cancelUnlock();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", shutdown);
      shutdown();
    };
  }, []);

  return <DebugPanel />;
}
