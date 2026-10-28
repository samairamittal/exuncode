"use client";

import type { ReactNode } from "react";
import { useHandsFree } from "@/lib/store/handsfree";

/** The zoomed Lens stage; carries the power state (boot, on, sleep) for CSS. */
export function LensStage({ children }: { children: ReactNode }) {
  const power = useHandsFree((s) => s.power);
  return (
    <div data-anim="lens" data-power={power} className="lens-stage relative font-(family-name:--font-lens-mono)">
      {children}
    </div>
  );
}
