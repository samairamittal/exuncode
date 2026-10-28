"use client";

/* eslint-disable @next/next/no-img-element -- 1x layers cut from the design, drawn pixel for pixel */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { getPlace } from "@/lib/case";
import { city } from "@/lib/motion";
import { cityLayers } from "./city.generated";
import { cityPlaces, markerLabel, placeStatus, type MarkerKind } from "./data";
import { useCity3D } from "./useCity3D";

const { width: W, height: H, buildings, text } = cityLayers;
const pct = (value: number, of: number) => `${(value / of) * 100}%`;
const box = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({
  left: pct(b.x, W),
  top: pct(b.y, H),
  width: pct(b.w, W),
  height: pct(b.h, H),
});

// The stage keeps the artwork's aspect and covers the panel (like object-fit: cover).
const stageW = `max(100cqw, calc(100cqh * ${W} / ${H}))`;
const stageH = `max(100cqh, calc(100cqw * ${H} / ${W}))`;
const stageStyle: CSSProperties = {
  opacity: 0, // shown by useCity3D once the intro is set up, so the flat frame never flashes
  width: stageW,
  height: stageH,
  left: `calc(50% - ${stageW} / 2)`,
  top: `calc(50% - ${stageH} / 2)`,
};

/** Depth when fully lifted: buildings nearer the front rise higher, so they stay in front. */
const depthOf = (b: { y: number; h: number }) =>
  city.depthBack + ((b.y + b.h) / H) * (city.depthFront - city.depthBack);

const statusTint: Record<MarkerKind, string> = {
  sighting: "text-snow",
  outage: "text-(--marker-outage)",
  target: "text-[#7f9cff]",
};

const kindLabel = { arcade: "Arcade", "fun-zone": "Fun zone" } as const;

const lifted = "opacity-[min(var(--lift,0),1)]";
// Faces the camera whatever the orbit (counter-rotates the stage's rotation).
const billboard = "[transform:rotateY(calc(var(--ry,0)*-1deg))_rotateX(calc(var(--rx,0)*-1deg))]";
const preserve = "[transform-style:preserve-3d]";
const raise = "[transform:translateZ(calc(var(--lift,0)*var(--depth)*1px))]";

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-snow/15 bg-void/70 text-snow outline-none transition-transform duration-200 ease-out hover:scale-110 hover:bg-exun-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exun-blue active:scale-90"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

export function City3D({ className = "" }: { className?: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLImageElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { controls, active, selected } = useCity3D({
    panel: panelRef,
    stage: stageRef,
    base: baseRef,
    text: textRef,
  });

  return (
    <div
      ref={panelRef}
      data-anim="city"
      role="region"
      aria-label="3D map of nuxEland. Press Enter to explore, Escape to land."
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) controls.current?.explore();
      }}
      className={`${className} group relative overflow-hidden outline-none select-none [container-type:size] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-exun-blue ${
        active ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer touch-pan-y"
      }`}
      style={{ perspective: city.perspective }}
    >
      <div ref={stageRef} data-anim="city-stage" className={`absolute ${preserve}`} style={stageStyle}>
        <img ref={baseRef} src={cityLayers.base} alt="" draggable={false} className="absolute inset-0 size-full [image-rendering:pixelated]" />

        <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${lifted} [transform:translateZ(1px)]`}>
          <div
            data-anim="city-sweep"
            className="h-[10%] w-full bg-[linear-gradient(to_bottom,transparent,rgb(0_63_255/0.35)_60%,rgb(255_255_255/0.5)_62%,transparent_64%)] mix-blend-screen"
          />
        </div>

        {buildings.map((b, i) => {
          const place = getPlace(cityPlaces[i]);
          const status = placeStatus(cityPlaces[i]);
          return (
            <div
              key={b.src}
              className={`absolute ${preserve} ${raise}`}
              style={{ ...box(b), "--depth": depthOf(b) } as CSSProperties}
            >
              {/* Shadow stays on the floor and darkens as the building lifts. */}
              <img
                src={b.src}
                alt=""
                aria-hidden
                draggable={false}
                className={`pointer-events-none absolute inset-0 size-full opacity-[calc(min(var(--lift,0),1)*0.35)] blur-[3px] brightness-0 [transform:translate3d(6px,10px,calc(var(--lift,0)*var(--depth)*-1px+0.5px))]`}
              />
              <button
                type="button"
                data-anim="city-building"
                aria-label={`${place.name}${status ? `, ${markerLabel[status]}` : ""}`}
                aria-pressed={selected === i}
                tabIndex={active ? 0 : -1}
                onClick={() => controls.current?.select(i)}
                onPointerEnter={() => controls.current?.hover(i, true)}
                onPointerLeave={() => controls.current?.hover(i, false)}
                onFocus={() => controls.current?.hover(i, true)}
                onBlur={() => controls.current?.hover(i, false)}
                className={`absolute inset-0 rounded-sm outline-none ${preserve} focus-visible:outline-2 focus-visible:outline-exun-blue`}
              >
                <span data-anim="city-sprite" className={`absolute inset-0 block ${preserve}`}>
                  <img data-anim="city-surge" src={b.src} alt="" draggable={false} className="block size-full [image-rendering:pixelated]" />
                </span>
                <span aria-hidden className={`pointer-events-none absolute top-0 left-1/2 ${preserve}`}>
                  <span className={`absolute bottom-2 left-0 block origin-bottom ${preserve} ${billboard}`}>
                    <span
                      data-anim="city-label"
                      className={`absolute bottom-0 left-0 block origin-bottom -translate-x-1/2 rounded-xl border px-3 py-2 text-left whitespace-nowrap opacity-0 ${
                        selected === i ? "border-snow bg-exun-blue" : "border-exun-blue bg-void/90"
                      }`}
                    >
                      <span className="block text-[15px] leading-none tracking-(--trace-tracking) text-snow">{place.name}</span>
                      <span className={`mt-1 block text-[11px] leading-none tracking-(--trace-tracking) ${status ? statusTint[status] : "text-snow/60"}`}>
                        {status ? markerLabel[status] : kindLabel[place.kind]}
                        {"address" in place && place.address ? ` · ${place.address}` : ""}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </div>
          );
        })}

        <div
          ref={textRef}
          data-anim="city-text"
          className={`pointer-events-none absolute ${raise}`}
          style={{ ...box(text), "--depth": city.depthText } as CSSProperties}
        >
          <img src={text.src} alt="" draggable={false} className="block size-full [image-rendering:pixelated]" />
        </div>

      </div>

      {/* Controls appear once the city is lifted, or on hover as an invitation. */}
      <div
        data-anim="city-controls"
        className={`absolute top-8 right-8 z-content flex flex-col gap-2 transition-opacity duration-300 ${
          active ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ControlButton label="Rotate left" onClick={() => controls.current?.turn(-1)}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </ControlButton>
        <ControlButton label="Rotate right" onClick={() => controls.current?.turn(1)}>
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </ControlButton>
        <ControlButton label="Zoom in" onClick={() => controls.current?.zoom(1)}>
          <path d="M12 5v14M5 12h14" />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => controls.current?.zoom(-1)}>
          <path d="M5 12h14" />
        </ControlButton>
        <ControlButton label="Land the map" onClick={() => controls.current?.reset()}>
          <path d="M4 14h16M7 18h10M12 4v7M9 8l3 3 3-3" />
        </ControlButton>
      </div>

      <p
        aria-hidden
        className={`pointer-events-none absolute bottom-7 left-8 z-content text-[13px] leading-none tracking-(--trace-tracking) text-snow/60 transition-opacity duration-300 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {active ? "Drag to orbit · Scroll to zoom · Click a place to fly in · Esc to land" : "Click or drag to explore in 3D"}
      </p>
    </div>
  );
}
