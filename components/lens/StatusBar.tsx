"use client";

import { useEffect, useState, type Ref } from "react";
import { getLensFile } from "@/lib/lens";
import { lens, useReducedMotion } from "@/lib/motion";
import { useHandsFree } from "@/lib/store/handsfree";
import { useLensSession } from "./LensSession";

const BARS = 24;
// Fixed bar heights (a symmetric envelope), so the idle waveform is drawn, not random.
const heights = Array.from({ length: BARS }, (_, i) => 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / BARS));

/** Types the line out at lens.typeStep per character. Remounted per line by its key. */
function TypedLine({ line }: { line: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? line.length : 0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setShown((n) => (n >= line.length ? n : n + 1)), lens.typeStep * 1000);
    return () => clearInterval(id);
  }, [line, reduced]);
  return (
    <span aria-hidden className="truncate">
      &quot;{line.slice(0, reduced ? line.length : shown)}&quot;
    </span>
  );
}

export function StatusBar({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { scanning, selectedId, voice, muted, toggleMute } = useLensSession();
  const awake = useHandsFree((s) => s.awake);
  const thinking = useHandsFree((s) => s.thinking);
  const heard = useHandsFree((s) => s.lastTranscript);
  // While LENS is listening (after "Lens"), show the agent's words live instead of LENS's line.
  const listening = awake && !voice.speaking && !scanning;
  const state = scanning ? "Analysing" : voice.speaking ? "Speaking" : thinking ? "Thinking" : listening ? "Listening" : "Idle";
  const file = getLensFile(scanning?.id ?? selectedId);

  return (
    <section
      ref={ref}
      data-anim="lens-status"
      aria-label="Lens status"
      className={`flex items-center gap-4 rounded-full border border-snow/20 bg-(--surface-0) px-6 text-xs leading-none ${className}`}
    >
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ${scanning || voice.speaking || listening ? "lens-blink bg-(--hud-cyan)" : "bg-snow/40"}`}
        style={{ animationDuration: `${lens.blink}s` }}
      />
      <span className="shrink-0 font-bold tracking-wider uppercase">{state}</span>
      <span className="w-40 shrink-0 truncate text-snow/60">
        {file?.title}
        {scanning ? ` ${Math.round(scanning.progress * 100)}%` : ""}
      </span>

      <svg data-anim="lens-wave" viewBox={`0 0 ${BARS * 4} 24`} className="h-6 w-24 shrink-0" aria-hidden>
        {heights.map((h, i) => (
          <rect
            key={i}
            x={i * 4 + 1}
            y={12 - h * 11}
            width={2}
            height={h * 22}
            fill={voice.speaking ? "var(--hud-cyan)" : "rgb(255 255 255 / 0.25)"}
            className={voice.speaking ? "lens-wave" : undefined}
            style={voice.speaking ? { animationDelay: `${-(i % 6) * 0.15}s`, transformBox: "fill-box" } : undefined}
          />
        ))}
      </svg>

      <p aria-live="polite" className="flex min-w-0 flex-1 text-[13px] text-snow/90">
        {listening ? (
          <span data-anim="lens-heard" className="truncate text-(--hud-cyan)">
            {heard ? `"${heard}"` : "Listening, agent…"}
          </span>
        ) : (
          <>
            <span className="sr-only">{voice.line}</span>
            <TypedLine key={voice.line} line={voice.line} />
          </>
        )}
      </p>

      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Unmute LENS voice" : "Mute LENS voice"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-snow/20 outline-none hover:border-snow/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exun-blue"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M2 6h3l4-3v10l-4-3H2z" />
          {muted ? <path d="M11 6l4 4M15 6l-4 4" /> : <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13.5 3.5a6.5 6.5 0 0 1 0 9" />}
        </svg>
      </button>
    </section>
  );
}
