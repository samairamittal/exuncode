"use client";

import type { Ref } from "react";
import { lens } from "@/lib/motion";
import { useInvestigator } from "@/lib/store";
import { useHandsFree } from "@/lib/store/handsfree";
import { severityFill, severityLabel, typeColor, typeLabel, typeText } from "./hud";
import { useLensSession, type LensFinding } from "./LensSession";
import { Panel, PanelTitle } from "./Panel";

function FindingCard({ finding, latest }: { finding: LensFinding; latest: boolean }) {
  const pinned = useInvestigator((s) => s.pins.some((p) => p.refId === finding.id));
  const addPin = useInvestigator((s) => s.addPin);
  const focused = useHandsFree((s) => s.focusedFinding === finding.id);
  const pin = () =>
    addPin({
      source: "lens",
      kind: finding.type === "code-change" ? "code" : "finding",
      refId: finding.id,
      title: finding.title,
      detail: finding.detail,
    });

  return (
    <li
      data-anim="lens-finding"
      // Hover (mouse or hand reticle) focuses it: its row lights up on the document, and
      // "pin that" / thumbs up pins it.
      onPointerEnter={() => useHandsFree.setState({ focusedFinding: finding.id })}
      className={`rounded-[20px] border px-4 pt-3 pb-3 ${
        focused ? "border-(--hud-cyan) shadow-[0_0_12px_rgb(95_212_255/0.35)]" : latest ? "border-snow/60" : "border-snow/20"
      }`}
    >
      <div className="flex items-center justify-between text-xs leading-none tracking-wider uppercase">
        <span className={`font-bold ${typeText[finding.type]}`}>{typeLabel[finding.type]}</span>
        <span className="text-snow/50">{severityLabel[finding.severity]}</span>
      </div>
      <p className="mt-2 truncate text-sm leading-tight">{finding.title}</p>
      <p className="mt-1 truncate text-xs leading-tight text-snow/60">{finding.detail}</p>
      <div className="mt-3 flex items-center gap-3">
        <div aria-hidden className="h-[3px] flex-1 bg-snow/10">
          <div className="h-full" style={{ width: `${severityFill[finding.severity] * 100}%`, background: typeColor[finding.type] }} />
        </div>
        <button
          type="button"
          onClick={pin}
          disabled={pinned}
          aria-label={pinned ? `${finding.title}: pinned to board` : `Pin ${finding.title} to board`}
          className="rounded-full border border-exun-blue px-2 py-1 text-[11px] leading-none tracking-wider text-snow uppercase outline-none hover:bg-exun-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exun-blue disabled:border-snow/20 disabled:text-snow/50 disabled:hover:bg-transparent"
        >
          {pinned ? "Pinned" : "Pin to board"}
        </button>
      </div>
    </li>
  );
}

export function FindingsFeed({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { findings, scanning } = useLensSession();

  return (
    <Panel ref={ref} anim="lens-findings" aria-labelledby="lens-findings-title" className={`flex flex-col p-6 ${className}`}>
      <PanelTitle
        id="lens-findings-title"
        aside={
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={`size-2 rounded-full ${scanning ? "lens-blink bg-(--hud-cyan)" : "bg-snow/40"}`}
              style={{ animationDuration: `${lens.blink}s` }}
            />
            {scanning ? "Live" : `${findings.length} found`}
          </span>
        }
      >
        Findings
      </PanelTitle>
      {findings.length ? (
        <ul aria-live="polite" className="-mr-3 mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-3 [scrollbar-width:thin]">
          {findings.map((f, i) => (
            <FindingCard key={f.id} finding={f} latest={i === 0} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-snow/50">No findings yet. Pick a file in the Evidence Queue to analyse it.</p>
      )}
    </Panel>
  );
}
