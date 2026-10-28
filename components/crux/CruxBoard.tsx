"use client";

/* eslint-disable @next/next/no-img-element -- 1x layers cut from the design, drawn pixel for pixel */
import { useRef, type CSSProperties } from "react";
import { cruxLayers } from "./crux.generated";
import { stringPath, useCruxBoard } from "./useCruxBoard";

const { width: W, height: H, cards, strings, text, pinRadius, glowRadius, glow } = cruxLayers;
const pct = (value: number, of: number) => `${(value / of) * 100}%`;
const box = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({
  left: pct(b.x, W),
  top: pct(b.y, H),
  width: pct(b.w, W),
  height: pct(b.h, H),
});
/** A square of radius r (board px) centred on a point. */
const around = ([x, y]: readonly [number, number], r: number): CSSProperties => box({ x: x - r, y: y - r, w: r * 2, h: r * 2 });

// The halo each pin casts, measured from the design.
const halo = `radial-gradient(circle closest-side, ${glow
  .map(([r, a]) => `rgb(255 255 255 / ${a}) ${pct(r, glowRadius)}`)
  .join(", ")})`;

export function CruxBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const { tug } = useCruxBoard(boardRef);

  return (
    <div
      ref={boardRef}
      data-anim="crux"
      className="relative w-full"
      style={{ aspectRatio: `${W} / ${H}`, opacity: 0 /* shown by useCruxBoard once the intro is set up */ }}
    >
      <img data-anim="crux-board" src={cruxLayers.board} alt="" draggable={false} className="absolute inset-0 size-full select-none" />

      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          data-anim="crux-card"
          data-card={card.id}
          aria-label={`${card.label}, ${card.date}. Tug its strings.`}
          onClick={() => tug(card.id)}
          onPointerEnter={() => tug(card.id, true)}
          onPointerLeave={() => tug(card.id, false)}
          onFocus={() => tug(card.id, true)}
          onBlur={() => tug(card.id, false)}
          className="absolute cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-exun-blue"
          style={{
            ...box(card),
            // swings and lifts around its pin
            transformOrigin: `${pct(card.pin[0] - card.x, card.w)} ${pct(card.pin[1] - card.y, card.h)}`,
          }}
        >
          <img
            data-anim="crux-shadow"
            src={card.src}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full opacity-0 blur-[6px] brightness-0"
          />
          <img src={card.src} alt="" draggable={false} className="pointer-events-none relative block size-full select-none" />
        </button>
      ))}

      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {strings.map((s) => (
          <path
            key={s.id}
            data-anim="crux-string"
            data-string={s.id}
            d={stringPath(s.d, 0)}
            pathLength={1}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            className="stroke-snow"
          />
        ))}
      </svg>

      <img
        data-anim="crux-text"
        src={text.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={box(text)}
      />

      {cards.map((card) => (
        <div key={card.id} aria-hidden className="pointer-events-none">
          <div data-anim="crux-glow" data-pin={card.id} className="absolute" style={{ ...around(card.pin, glowRadius), background: halo }} />
          <div data-anim="crux-pin" data-pin={card.id} className="absolute" style={around(card.pin, pinRadius)}>
            <span data-anim="crux-ring" className="absolute inset-0 rounded-full border-2 border-snow opacity-0" />
            <span className="absolute inset-0 rounded-full bg-snow" />
          </div>
        </div>
      ))}
    </div>
  );
}
