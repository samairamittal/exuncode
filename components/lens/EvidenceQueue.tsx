"use client";

import type { Ref } from "react";
import { lensFiles } from "@/lib/lens";
import { useLensSession, type FileStatus } from "./LensSession";
import { Panel, PanelTitle } from "./Panel";

const chip: Record<FileStatus, { label: string; className: string }> = {
  new: { label: "New", className: "border-exun-blue bg-exun-blue text-snow" },
  scanning: { label: "Scanning", className: "border-(--hud-cyan) text-(--hud-cyan) shadow-[0_0_12px_var(--hud-cyan)]" },
  done: { label: "Done", className: "border-snow/30 text-snow/60" },
  pending: { label: "Awaiting file", className: "border-dashed border-snow/30 text-snow/40" },
};

function FileIcon() {
  // lens1's stacked-sheets glyph, on the 16px grid.
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2" y="6" width="7" height="8" />
      <path d="M5 6V3h7v8H9" />
    </svg>
  );
}

export function EvidenceQueue({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { selectedId, statusOf, select, scanning } = useLensSession();
  const supplied = lensFiles.filter((f) => f.caseFileIds.length).length;

  return (
    <Panel ref={ref} anim="lens-queue" aria-labelledby="lens-queue-title" className={`p-6 ${className}`}>
      <PanelTitle id="lens-queue-title" aside={`${supplied} of ${lensFiles.length} files`}>
        <span className="flex items-center gap-4">
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-snow text-exun-blue">
            <FileIcon />
          </span>
          Evidence Queue
        </span>
      </PanelTitle>
      <ul className="mt-4 flex flex-col gap-1">
        {lensFiles.map((file) => {
          const status = statusOf(file.id);
          const active = file.id === selectedId;
          return (
            <li key={file.id} data-anim="lens-queue-item">
              <button
                type="button"
                onClick={() => select(file.id)}
                disabled={!!scanning}
                aria-current={active ? "true" : undefined}
                className={`flex h-9 w-full items-center gap-3 rounded-full border px-4 text-left text-[15px] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exun-blue disabled:cursor-wait ${
                  active ? "border-(--hud-cyan) bg-(--hud-cyan)/10" : "border-snow/12 hover:border-snow/40"
                } ${status === "pending" ? "text-snow/50" : ""}`}
              >
                <FileIcon />
                <span className="min-w-0 flex-1 truncate">{file.title}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] leading-none tracking-wider uppercase ${chip[status].className}`}
                >
                  {chip[status].label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
