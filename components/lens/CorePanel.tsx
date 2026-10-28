"use client";

import { useSyncExternalStore, type ReactNode, type Ref } from "react";
import { caseMeta, energyDossier, suspensionNotice } from "@/lib/case";
import { checkLedger, lensFiles } from "@/lib/lens";
import { coreState, useHandsFree } from "@/lib/store/handsfree";
import { CoreRings, RING } from "./CoreRings";
import { documentFor, pageCount } from "./documents";
import { DocumentSheet, rowAnchor } from "./DocumentSheet";
import { findingTotal, useLensSession } from "./LensSession";
import { Panel } from "./Panel";
import { isDefaultDoc } from "./views";

const W = 781;
const H = 601;
const scannable = lensFiles.filter((f) => f.caseFileIds.length);

// ---- clock (client only, ticks each second) ----
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const now = () => Math.floor(Date.now() / 1000);
function useClock(): Date | null {
  const s = useSyncExternalStore(subscribe, now, () => null);
  return s === null ? null : new Date(s * 1000);
}
const pad = (n: number) => String(n).padStart(2, "0");

function Readout({ anim, className, children }: { anim: string; className: string; children: ReactNode }) {
  return (
    <dl data-anim={anim} className={`absolute flex flex-col gap-2 text-xs leading-none tracking-wider uppercase ${className}`}>
      {children}
    </dl>
  );
}

function Row({ label, value, tone = "text-(--hud-cyan)" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-snow/50">{label}</dt>
      <dd className={`font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

/** lens2's callout: a framed note joined to its row by a leader line. */
function Callout({
  tone,
  box,
  anchor,
  heading,
  value,
  note,
}: {
  tone: string;
  box: { x: number; y: number; w: number; h: number };
  anchor: [number, number];
  heading: string;
  value: string;
  note: string;
}) {
  // Leave from the box edge facing the row: below/above it if they overlap horizontally,
  // otherwise from the side with a short horizontal elbow.
  const overlaps = anchor[0] > box.x && anchor[0] < box.x + box.w;
  const below = anchor[1] > box.y + box.h;
  const fromRight = anchor[0] >= box.x + box.w;
  const start: [number, number] = overlaps
    ? [anchor[0], below ? box.y + box.h : box.y]
    : [fromRight ? box.x + box.w : box.x, box.y + box.h / 2];
  const elbow: [number, number] = overlaps ? start : [start[0] + (fromRight ? 24 : -24), start[1]];
  return (
    <>
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${W} ${H}`}>
        <polyline points={[start, elbow, anchor].map((p) => p.join(",")).join(" ")} fill="none" stroke={tone} strokeWidth={1} />
        <circle cx={anchor[0]} cy={anchor[1]} r={3} fill={tone} />
      </svg>
      <div
        data-anim="lens-callout"
        className="absolute flex flex-col justify-center gap-1 border bg-void px-3 text-xs leading-tight"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: tone, color: tone }}
      >
        <span className="tracking-wider uppercase">{heading}</span>
        <span className="text-base leading-none font-bold text-snow">{value}</span>
        <span>{note}</span>
      </div>
    </>
  );
}

export function CorePanel({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { selectedId, scanning, findings, analysedCount, muted, statusOf } = useLensSession();
  const state = useHandsFree(coreState);
  const voiceLevel = useHandsFree((s) => s.voiceLevel);
  const beat = useHandsFree((s) => s.beat);
  const handTracked = useHandsFree((s) => s.hands > 0);
  const view = useHandsFree((s) => s.doc);
  const focused = useHandsFree((s) => s.focus === "document");
  const focusedFinding = useHandsFree((s) => s.focusedFinding);
  const clock = useClock();
  const doc = documentFor(selectedId);
  const dossierDone = statusOf("energy-dossier") === "done";
  const showsDossier = doc.kind === "table";
  const fileIndex = scannable.findIndex((f) => f.id === selectedId);
  const progress = scanning ? scanning.progress : analysedCount / scannable.length;
  const confirmed = findings.filter((f) => f.severity !== "info").length;

  // Callout data from the meter check, positioned against the rows on the sheet.
  const rows = showsDossier ? doc.rows : [];
  const spikeAt = rows.findIndex((r) => r.spike);
  const mismatchAt = rows.findIndex((r) => r.mismatch);
  const ledger = checkLedger(energyDossier.readings);
  const spike = ledger.find((r) => r.spike);
  const mismatch = ledger.find((r) => r.mismatch);

  return (
    <Panel ref={ref} anim="lens-core" outlined aria-label="Analysis core" className={className}>
      {/* Fixed 781 x 601 drawing; on the narrow stage (433px) it is zoomed to fit */}
      <div className="relative h-[601px] w-[781px] max-lg:[zoom:0.5544]">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id="lens-scan-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--hud-cyan)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--hud-cyan)" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <CoreRings
            progress={progress}
            active={!!scanning}
            findings={findings}
            total={findingTotal}
            state={state}
            level={voiceLevel}
            beat={beat}
            handTracked={handTracked}
          />
        </svg>
        {/* The document floats on its own layer, so gestures can zoom, pan and turn it in 3D. */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden
          data-anim="lens-document-layer"
          className="absolute inset-0 size-full overflow-visible"
          style={{
            transformOrigin: `${(RING.cx / W) * 100}% ${(RING.cy / H) * 100}%`,
            transform: `perspective(900px) translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotateX(${view.rotateX}deg) rotateY(${view.rotateY}deg)`,
          }}
        >
          <DocumentSheet
            doc={doc}
            page={Math.min(view.page, pageCount(doc) - 1)}
            scanY={scanning?.id === selectedId ? scanning.progress : null}
            flagged={dossierDone}
            highlightDate={findings.find((f) => f.id === focusedFinding)?.data.date as string | undefined}
            focused={focused}
          />
        </svg>
        <p className="sr-only">
          Showing {doc.title}. {doc.kind === "table" ? `${doc.rows.length} meter readings.` : doc.lines.join(" ")}
        </p>

        {showsDossier && dossierDone && isDefaultDoc(view) && spike && spikeAt >= 0 && (
          <Callout
            tone="var(--hud-amber)"
            box={{ x: 24, y: 272, w: 136, h: 88 }}
            anchor={rowAnchor(spikeAt, "left")}
            heading="Spike"
            value={`${spike.listedUsageKwh.toLocaleString("en-GB")} kWh`}
            note={`about ${Math.round(spike.ratio)}x a typical day`}
          />
        )}
        {showsDossier && dossierDone && isDefaultDoc(view) && mismatch && mismatchAt >= 0 && (
          <Callout
            tone="var(--hud-red)"
            box={{ x: W - 32 - 196, y: 446, w: 196, h: 76 }}
            anchor={rowAnchor(mismatchAt, "right")}
            heading="Discrepancy"
            value={`${mismatch.listedUsageKwh} listed`}
            note={`meter moved ${mismatch.meteredKwh} kWh`}
          />
        )}

        {confirmed > 0 && (
          <div
            role="alert"
            data-anim="lens-contradiction"
            className="absolute top-5 left-1/2 flex h-10 -translate-x-1/2 items-center gap-3 border border-(--hud-red) bg-void pr-4 pl-1 text-[13px] whitespace-nowrap shadow-[0_0_16px_rgb(255_90_79/0.35)]"
          >
            <span className="bg-(--hud-red) px-2 py-1 text-xs font-bold tracking-widest text-void uppercase">Contradiction</span>
            <span>
              {suspensionNotice.title} says <span className="text-(--hud-amber)">&quot;{suspensionNotice.verdict}&quot;</span>. Lens has{" "}
              {confirmed} confirmed {confirmed === 1 ? "finding" : "findings"}.
            </span>
          </div>
        )}

        <Readout anim="lens-readout-case" className="top-20 left-8">
          <Row label="Case" value={caseMeta.caseId} />
          <Row label="Subject" value={caseMeta.arcade} />
        </Readout>
        <Readout anim="lens-readout-time" className="top-20 right-8 items-end">
          <Row
            label={clock ? `${pad(clock.getDate())}.${pad(clock.getMonth() + 1)}.${clock.getFullYear()}` : "--.--.----"}
            value={clock ? `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}` : "--:--:--"}
          />
          <Row label="File" value={fileIndex >= 0 ? `${fileIndex + 1} / ${scannable.length}` : "not received"} />
        </Readout>
        <Readout anim="lens-readout-status" className="bottom-8 left-8">
          <Row label="EXUN" value={suspensionNotice.status.replace("EXUN ", "")} tone="text-(--hud-red)" />
          <Row label="Mode" value={suspensionNotice.mode} tone="text-(--hud-red)" />
        </Readout>
        <Readout anim="lens-readout-systems" className="right-8 bottom-8 items-end">
          <Row label="Voice" value={muted ? "Muted" : "Online"} tone={muted ? "text-snow/60" : undefined} />
          <Row label="Hand tracking" value="Off" tone="text-snow/60" />
        </Readout>
      </div>
    </Panel>
  );
}
