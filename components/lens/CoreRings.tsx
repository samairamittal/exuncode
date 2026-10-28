"use client";

import type { CSSProperties, Ref } from "react";
import { lens } from "@/lib/motion";
import { arc, polar, typeColor } from "./hud";
import type { CoreState } from "@/lib/store/handsfree";
import type { LensFinding } from "./LensSession";

// Three concentric rings around the document:
//   outer  60 ticks (every 5th long), turning slowly while idle
//   middle progress: the current scan, or files analysed when idle
//   inner  one segment per finding Lens can surface; lit in its type colour once found
// Core states: listening pulses, thinking spins the ticks faster, speaking swells with the
// voice level, music pulses on the beat, a tracked hand brightens the outer ring.

export const RING = { cx: 390, cy: 318, tick: 244, progress: 228, findings: 214, dash: 198 } as const;

export function CoreRings({
  ref,
  progress,
  active,
  findings,
  total,
  state = "idle",
  level = 0,
  beat = 0,
  handTracked = false,
}: {
  ref?: Ref<SVGGElement>;
  progress: number;
  /** A scan is running: the progress arc glows. */
  active: boolean;
  findings: LensFinding[];
  total: number;
  state?: CoreState;
  /** Voice level 0–1 while speaking. */
  level?: number;
  /** Increments on each music beat (remounts the beat pulse). */
  beat?: number;
  handTracked?: boolean;
}) {
  const swell = state === "speaking" ? 1 + level * 0.03 : 1;
  const { cx, cy } = RING;
  const gap = 2.5;
  const step = 360 / total;

  return (
    <g
      ref={ref}
      data-anim="lens-rings"
      data-state={state}
      fill="none"
      style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scale(${swell})` }}
    >
      <g
        className="lens-spin"
        style={{ "--lens-spin": `${state === "thinking" ? lens.ringSpinThinking : lens.ringSpin}s`, opacity: handTracked ? 1 : 0.75 } as CSSProperties}
      >
        {Array.from({ length: 60 }, (_, i) => {
          const long = i % 5 === 0;
          const [x1, y1] = polar(cx, cy, RING.tick - (long ? 10 : 5), i * 6);
          const [x2, y2] = polar(cx, cy, RING.tick, i * 6);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--hud-cyan)" strokeOpacity={long ? 0.8 : 0.35} strokeWidth={1} />;
        })}
      </g>

      <circle cx={cx} cy={cy} r={RING.progress} stroke="var(--hud-line)" strokeWidth={2} />
      {(state === "listening" || state === "music") && (
        <circle
          key={state === "music" ? beat : "listening"}
          data-anim="lens-core-pulse"
          cx={cx}
          cy={cy}
          r={RING.progress}
          stroke="var(--hud-cyan)"
          strokeWidth={2}
          className={state === "music" ? "lens-beat" : "lens-pulse"}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}
      {progress > 0 && (
        <path
          data-anim="lens-progress"
          // a full turn is two half arcs: one SVG arc can't start and end at the same point
          d={progress >= 1 ? `${arc(cx, cy, RING.progress, 0, 180)} ${arc(cx, cy, RING.progress, 180, 360)}` : arc(cx, cy, RING.progress, 0, progress * 360)}
          stroke="var(--hud-cyan)"
          strokeWidth={2}
          strokeLinecap="round"
          style={active ? { filter: "drop-shadow(0 0 6px var(--hud-cyan))" } : undefined}
        />
      )}

      {Array.from({ length: total }, (_, i) => {
        const f = findings[i];
        return (
          <path
            key={i}
            data-anim="lens-finding-segment"
            d={arc(cx, cy, RING.findings, i * step + gap / 2, (i + 1) * step - gap / 2)}
            stroke={f ? typeColor[f.type] : "var(--hud-line)"}
            strokeWidth={6}
          />
        );
      })}

      <circle cx={cx} cy={cy} r={RING.dash} stroke="rgb(255 255 255 / 0.3)" strokeWidth={1} strokeDasharray="12 10" />
    </g>
  );
}
