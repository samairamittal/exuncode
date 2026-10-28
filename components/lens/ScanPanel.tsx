"use client";

import type { Ref } from "react";
import { caseMeta } from "@/lib/case";
import { damage, IsometricCabinet } from "./IsometricCabinet";
import { useLensSession } from "./LensSession";
import { Panel } from "./Panel";

const CELL = 34; // lens1's grid cell

export function ScanPanel({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { statusOf } = useLensSession();
  const marked = statusOf("asset-report") === "done";

  return (
    <Panel ref={ref} anim="lens-scan" aria-labelledby="lens-scan-title" className={`flex flex-col px-6 pt-5 pb-6 ${className}`}>
      <div className="relative min-h-0 flex-1">
        {/* lens1's square grid behind the cabinet */}
        <div
          aria-hidden
          data-anim="lens-scan-grid"
          className="absolute inset-x-4 top-6 bottom-0 border border-snow/20"
          style={{
            backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.2) 1px, transparent 1px)`,
            backgroundSize: `${CELL}px ${CELL}px`,
          }}
        />
        <h2
          id="lens-scan-title"
          className="relative ml-8 bg-[linear-gradient(90deg,var(--snow),var(--exun-blue))] bg-clip-text font-(family-name:--font-lens-pixel) text-[64px] leading-none font-bold text-transparent"
        >
          Scan
        </h2>
        <IsometricCabinet marked={marked} className="absolute inset-x-0 bottom-0 h-[86%] w-full" />
      </div>
      <p className="mt-3 flex justify-between text-xs leading-none tracking-wider text-snow/50 uppercase">
        <span>{caseMeta.cabinet}</span>
        <span className={marked ? "text-(--hud-amber)" : ""}>{marked ? `${damage.length} marks` : "Report not analysed"}</span>
      </p>
    </Panel>
  );
}
