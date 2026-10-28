"use client";

import type { Ref } from "react";
import type { FindingType } from "@/lib/data";
import { gauges, readGauge, type Gauge } from "@/lib/lens";
import { arc, typeColor } from "./hud";
import { useLensSession } from "./LensSession";
import { Panel, PanelTitle } from "./Panel";

// Three arc gauges (the confidence model in lib/lens/confidence.ts) and the findings count
// by type as concentric rings, with lens1's disc list as the legend.

const SWEEP = 270; // gauge arc, open at the bottom
const gaugeTone: Record<Gauge["id"], string> = {
  escape: "var(--hud-amber)",
  human: "var(--hud-cyan)",
  risk: "var(--hud-red)",
};

function ArcGauge({ gauge, ids }: { gauge: Gauge; ids: ReadonlySet<string> }) {
  const { value, found, total } = readGauge(gauge, ids);
  const r = 34;
  const c = 44;
  const from = -SWEEP / 2;
  return (
    <figure data-anim="lens-gauge" className="flex flex-col items-center">
      <svg viewBox="0 0 88 88" className="size-22" role="img" aria-label={`${gauge.label}: ${value}%`}>
        <path d={arc(c, c, r, from, from + SWEEP)} fill="none" stroke="var(--hud-line)" strokeWidth={6} strokeLinecap="round" />
        {value > 0 && (
          <path
            d={arc(c, c, r, from, from + (SWEEP * value) / 100)}
            fill="none"
            stroke={gaugeTone[gauge.id]}
            strokeWidth={6}
            strokeLinecap="round"
          />
        )}
        <text x={c} y={c + 6} textAnchor="middle" fill="var(--snow)" fontSize={18} fontWeight={700}>
          {value}%
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-[11px] leading-tight tracking-wider uppercase">
        <span className="block">{gauge.label}</span>
        <span className="block text-snow/50">
          {found}/{total} signals
        </span>
      </figcaption>
    </figure>
  );
}

const types: { type: FindingType; label: string }[] = [
  { type: "discrepancy", label: "Discrepancies" },
  { type: "inconsistency", label: "Inconsistencies" },
  { type: "code-change", label: "Code" },
  { type: "physical", label: "Physical" },
  { type: "encoded", label: "Encoded" },
];

function TypeRings({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const c = 60;
  return (
    <svg data-anim="lens-type-rings" viewBox="0 0 120 120" className="size-26 shrink-0" aria-hidden>
      {types.map(({ type }, i) => {
        const r = 52 - i * 10;
        return (
          <g key={type}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="var(--hud-line)" strokeWidth={4} />
            {counts[i] > 0 && (
              <path
                d={counts[i] === max ? `${arc(c, c, r, 0, 180)} ${arc(c, c, r, 180, 359.9)}` : arc(c, c, r, 0, (360 * counts[i]) / max)}
                fill="none"
                stroke={typeColor[type]}
                strokeWidth={4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function AssessmentPanel({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { findings } = useLensSession();
  const ids = new Set(findings.map((f) => f.id));
  const counts = types.map(({ type }) => findings.filter((f) => f.type === type).length);

  return (
    <Panel ref={ref} anim="lens-assessment" aria-labelledby="lens-assessment-title" className={`flex flex-col p-6 ${className}`}>
      <PanelTitle id="lens-assessment-title" aside="Confidence">
        Assessment
      </PanelTitle>
      <div className="mt-2 grid grid-cols-3">
        {gauges.map((g) => (
          <ArcGauge key={g.id} gauge={g} ids={ids} />
        ))}
      </div>
      <div className="mt-auto flex items-center gap-4">
        <TypeRings counts={counts} />
        <ul className="flex flex-col gap-2 text-sm leading-none">
          {types.map(({ type, label }, i) => (
            <li key={type} className={`flex items-center gap-2 ${counts[i] ? "" : "text-snow/40"}`}>
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: counts[i] ? typeColor[type] : "var(--hud-line)" }} />
              <span className="font-bold">{counts[i]}</span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
