"use client";

import type { CSSProperties } from "react";
import { getPlace } from "@/lib/case";
import { bus } from "@/lib/events";
import { markerColor, markerLabel, type markers } from "./data";

/** A tracker dot: names its place on hover/focus and flies the 3D city there on click. */
export function TrackerMarker({ marker, index, style }: { marker: (typeof markers)[number]; index: number; style: CSSProperties }) {
  const place = getPlace(marker.place);
  return (
    <button
      type="button"
      data-anim="marker"
      aria-label={`${place.name}: ${markerLabel[marker.kind]}. Show on the 3D map.`}
      onClick={() => bus.emit("place:focus", { id: marker.place })}
      style={style}
      className={`group/marker absolute size-(--marker) -translate-1/2 rounded-full outline-none transition-transform duration-200 ease-out hover:scale-125 focus-visible:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow active:scale-90 ${markerColor[marker.kind]}`}
    >
      <span aria-hidden className={`marker-ping absolute inset-0 rounded-full ${markerColor[marker.kind]}`} style={{ animationDelay: `${index * 0.3}s` }} />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-content -translate-x-1/2 translate-y-1 rounded-lg bg-void/90 px-2.5 py-1.5 text-left text-[13px] leading-tight tracking-(--trace-tracking) whitespace-nowrap text-snow opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/marker:translate-y-0 group-hover/marker:opacity-100 group-focus-visible/marker:translate-y-0 group-focus-visible/marker:opacity-100"
      >
        <span className="block">{place.name}</span>
        <span className="block text-[11px] text-snow/60">{markerLabel[marker.kind]}</span>
      </span>
    </button>
  );
}
