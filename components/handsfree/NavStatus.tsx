"use client";

import { useHandsFree } from "@/lib/store/handsfree";
import { stopMusic } from "@/lib/voice/music";

// Small nav indicators: mic (glows while listening), hand (glows while a hand is tracked),
// and the music mute toggle (remembered on this device).

const glow = "text-(--hud-cyan) drop-shadow-[0_0_6px_var(--hud-cyan)]";

export function NavStatus() {
  const mic = useHandsFree((s) => s.mic);
  const listening = useHandsFree((s) => s.listening && s.speech === "on");
  const awake = useHandsFree((s) => s.awake);
  const hands = useHandsFree((s) => s.hands);
  const camera = useHandsFree((s) => s.camera);
  const muted = useHandsFree((s) => s.muted);
  const setMuted = useHandsFree((s) => s.setMuted);

  const micOn = mic === "on" && (listening || awake);
  return (
    <span data-anim="nav-status" className="flex items-center gap-2 text-snow/40">
      <svg
        viewBox="0 0 16 16"
        className={`size-4 ${micOn ? glow : mic === "on" ? "text-snow/70" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        role="img"
        aria-label={mic === "on" ? (micOn ? "Mic listening" : "Mic on") : "Mic off"}
      >
        <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
        <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
      </svg>
      <svg
        viewBox="0 0 16 16"
        className={`size-4 ${hands > 0 ? glow : camera === "on" ? "text-snow/70" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        role="img"
        aria-label={hands > 0 ? `${hands} ${hands === 1 ? "hand" : "hands"} tracked` : "No hand tracked"}
      >
        <path d="M5 8V3.5a1 1 0 0 1 2 0V7M7 7V2.5a1 1 0 0 1 2 0V7M9 7V3.5a1 1 0 0 1 2 0V8.5M11 6.5a1 1 0 0 1 2 0V10a5 5 0 0 1-5 5 4.5 4.5 0 0 1-4-2.5L2.5 9.5a1 1 0 0 1 1.7-1L5 9.5" />
      </svg>
      <button
        type="button"
        onClick={() => {
          if (!muted) stopMusic();
          setMuted(!muted);
        }}
        aria-pressed={muted}
        aria-label={muted ? "Unmute music" : "Mute music"}
        title={muted ? "Music muted" : "Music on"}
        className={`rounded-full outline-none hover:text-snow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exun-blue ${muted ? "" : "text-snow/70"}`}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M6 12V3l7-1.5V10" />
          <circle cx="4.5" cy="12" r="1.5" />
          <circle cx="11.5" cy="10" r="1.5" />
          {muted && <path d="M2 2l12 12" />}
        </svg>
      </button>
    </span>
  );
}
