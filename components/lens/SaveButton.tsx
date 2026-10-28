"use client";

import { useState, type Ref } from "react";
import { useInvestigator } from "@/lib/store";
import { useLensSession } from "./LensSession";

// lens1's Save. Findings already persist as they're found; Save records the session in the
// investigator's activity log. TODO(design): confirm what Save should do (report export?).

export function SaveButton({ ref, className = "" }: { ref?: Ref<HTMLButtonElement>; className?: string }) {
  const { findings, analysedCount, scanning } = useLensSession();
  const logActivity = useInvestigator((s) => s.logActivity);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = async () => {
    await logActivity({ type: "file:analyzed", message: `Lens session saved: ${analysedCount} files, ${findings.length} findings` });
    setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  };

  return (
    <button
      ref={ref}
      type="button"
      data-anim="lens-save"
      onClick={save}
      disabled={!!scanning}
      className={`flex items-center justify-center gap-3 rounded-full bg-exun-blue text-[32px] leading-none font-bold outline-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-exun-blue active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
      Save
      {savedAt && <span className="text-xs font-normal tracking-wider uppercase">saved {savedAt}</span>}
    </button>
  );
}
