"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useHandsFree } from "@/lib/store/handsfree";

// The hand cursor: a small glowing reticle where the index finger points. It's the only
// visual sign of the camera. Shapes: point (ring + dot), pinch (shrinks), grab (brackets
// close in), tap (one ripple).

const noop = () => () => undefined;

export function Reticle() {
  const { x, y, visible, mode } = useHandsFree((s) => s.reticle);
  // Client only (it portals into <body>).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return null;

  const ring = mode === "pinch" || mode === "grab" ? 10 : 16;
  const bracket = mode === "grab" ? 12 : 22;
  return createPortal(
    <div
      aria-hidden
      data-anim="hand-reticle"
      data-mode={mode}
      className="pointer-events-none fixed top-0 left-0 z-transition transition-opacity duration-300"
      style={{ transform: `translate(${x}px, ${y}px)`, opacity: visible ? 1 : 0 }}
    >
      <svg width="64" height="64" viewBox="-32 -32 64 64" className="-translate-1/2 overflow-visible drop-shadow-[0_0_6px_var(--hud-cyan)]">
        <g fill="none" stroke="var(--hud-cyan)" strokeWidth={1.5} className="motion-safe:transition-all motion-safe:duration-150">
          <circle r={ring} />
          <circle r={2} fill="var(--hud-cyan)" stroke="none" />
          {[0, 90, 180, 270].map((a) => (
            <path key={a} d={`M${-bracket} ${-bracket + 6}V${-bracket}H${-bracket + 6}`} transform={`rotate(${a})`} />
          ))}
        </g>
        {mode === "tap" && <circle r={16} fill="none" stroke="var(--hud-cyan)" className="hand-ripple" />}
      </svg>
    </div>,
    document.body,
  );
}
