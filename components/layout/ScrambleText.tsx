"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { prefersReducedMotion, scramble } from "@/lib/motion";

export interface ScrambleHandle {
  play: () => void;
}

/**
 * Text that scrambles and resolves left to right on play(). An invisible copy keeps
 * the width fixed, so surrounding layout never shifts; screen readers get the real text.
 */
export const ScrambleText = forwardRef<ScrambleHandle, { text: string }>(function ScrambleText({ text }, ref) {
  const visibleRef = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    if (visibleRef.current) visibleRef.current.textContent = text;
  }, [text]);

  const play = useCallback(() => {
    const el = visibleRef.current;
    if (!el || prefersReducedMotion()) return;
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = (now - start) / (scramble.duration * 1000);
      if (progress >= 1) return stop();
      const resolved = Math.floor(progress * text.length);
      el.textContent = [...text]
        .map((char, i) =>
          i < resolved || char === " " ? char : scramble.glyphs[Math.floor(Math.random() * scramble.glyphs.length)],
        )
        .join("");
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [stop, text]);

  useImperativeHandle(ref, () => ({ play }), [play]);
  useEffect(() => stop, [stop]);

  return (
    <span className="inline-grid whitespace-nowrap">
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {text}
      </span>
      <span ref={visibleRef} data-anim="scramble" className="col-start-1 row-start-1" aria-hidden>
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
});
