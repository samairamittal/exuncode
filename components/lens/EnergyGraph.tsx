"use client";

import type { Ref } from "react";
import { caseMeta } from "@/lib/case";
import { useHandsFree } from "@/lib/store/handsfree";
import { round } from "./hud";
import { useLensSession } from "./LensSession";
import { Panel } from "./Panel";
import { ledger as rows } from "./views";

// Daily usage for every day in the dossier, on a log scale so a normal day and the spike
// both read. Once the dossier is analysed: the spike is marked amber, and the mismatch red
// with a dashed drop to what the meter actually moved. The time axis zooms and pans (hand
// gestures, voice); hovering a point (mouse or hand reticle) shows its values.

const W = 781;
const H = 218;
const plot = { x0: 80, x1: 749, y0: 64, y1: 178 };
const ticks = [10, 100, 1000];
const logMin = 1; // log10(10)
const logMax = Math.log10(3000);
// Rounded so server and browser render identical coordinates.
const y = (kwh: number) => round(plot.y1 - ((Math.log10(kwh) - logMin) / (logMax - logMin)) * (plot.y1 - plot.y0));
const day = (iso: string) => Number(iso.slice(8, 10));
const kwh = (v: number) => v.toLocaleString("en-GB");

export function EnergyGraph({ ref, className = "" }: { ref?: Ref<HTMLElement>; className?: string }) {
  const { statusOf } = useLensSession();
  const { start, end } = useHandsFree((s) => s.chart);
  const point = useHandsFree((s) => s.chartPoint);
  const focused = useHandsFree((s) => s.focus === "chart");
  const set = useHandsFree((s) => s.set);
  const flagged = statusOf("energy-dossier") === "done";
  const spikeAt = rows.findIndex((r) => r.spike);
  const mismatchAt = rows.findIndex((r) => r.mismatch);
  const zoomed = start > 0 || end < rows.length - 1;

  const x = (i: number) => round(plot.x0 + ((i - start) / (end - start)) * (plot.x1 - plot.x0));
  const visible = (i: number) => i >= start - 0.01 && i <= end + 0.01;
  const line = rows.map((r, i) => `${x(i)},${y(r.listedUsageKwh)}`).join(" ");
  const first = rows[Math.ceil(start)].date;
  const last = rows[Math.floor(end)].date;
  const tip = point !== null && visible(point) ? rows[point] : null;
  const tipX = point !== null ? x(point) : 0;
  const boxX = Math.min(plot.x1 - 176, Math.max(plot.x0, tipX - 88));

  return (
    <Panel
      ref={ref}
      anim="lens-energy"
      aria-labelledby="lens-energy-title"
      className={`${focused ? "outline-1 outline-(--hud-cyan)" : ""} ${className}`}
    >
      <div className="relative h-[218px] w-[781px] max-lg:[zoom:0.5544]">
        <header className="absolute inset-x-8 top-6 flex items-baseline justify-between">
          <h2 id="lens-energy-title" className="text-sm leading-none font-bold">
            Daily Energy {caseMeta.arcade}
          </h2>
          <p className="text-xs leading-none tracking-wider text-snow/50 uppercase">
            kWh, log scale / Oct {day(first)} to {day(last)}
            {zoomed && <span className="text-(--hud-cyan)"> / zoomed</span>}
          </p>
        </header>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" role="img" aria-label={`Daily energy use, October ${day(first)} to ${day(last)}`}>
          <defs>
            <clipPath id="lens-energy-clip">
              <rect x={plot.x0 - 8} y={0} width={plot.x1 - plot.x0 + 16} height={H} />
            </clipPath>
          </defs>
          {/* Marks the plot area for gesture maths (screen x → day). */}
          <rect data-chart-plot x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} fill="none" />
          <g fontSize={12} fill="rgb(255 255 255 / 0.6)">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={plot.x0} x2={plot.x1} y1={y(t)} y2={y(t)} stroke="var(--hud-line)" />
                <text x={plot.x0 - 12} y={y(t) + 4} textAnchor="end">
                  {t.toLocaleString("en-GB")}
                </text>
              </g>
            ))}
            {rows.map((r, i) =>
              visible(i) ? (
                <text key={r.date} x={x(i)} y={H - 16} textAnchor="middle" fill={i === point ? "var(--snow)" : undefined}>
                  {day(r.date)}
                </text>
              ) : null,
            )}
          </g>

          <g clipPath="url(#lens-energy-clip)">
            <polyline data-anim="lens-energy-line" points={line} fill="none" stroke="var(--hud-cyan)" strokeWidth={2} strokeLinejoin="round" />
            {rows.map((r, i) => (
              <circle key={r.date} cx={x(i)} cy={y(r.listedUsageKwh)} r={i === point ? 4 : 2.5} fill="var(--hud-cyan)" />
            ))}

            {flagged && spikeAt >= 0 && (
              <g data-anim="lens-energy-spike" fill="var(--hud-amber)" fontSize={12}>
                <circle cx={x(spikeAt)} cy={y(rows[spikeAt].listedUsageKwh)} r={5} />
                <text x={x(spikeAt) - 10} y={y(rows[spikeAt].listedUsageKwh) + 4} textAnchor="end">
                  {kwh(rows[spikeAt].listedUsageKwh)}
                </text>
              </g>
            )}
            {flagged && mismatchAt >= 0 && (
              <g data-anim="lens-energy-mismatch" fill="var(--hud-red)" stroke="var(--hud-red)" fontSize={12}>
                <line
                  x1={x(mismatchAt)}
                  x2={x(mismatchAt)}
                  y1={y(rows[mismatchAt].listedUsageKwh)}
                  y2={y(rows[mismatchAt].meteredKwh!)}
                  strokeDasharray="3 3"
                />
                <circle cx={x(mismatchAt)} cy={y(rows[mismatchAt].listedUsageKwh)} r={5} stroke="none" />
                <circle cx={x(mismatchAt)} cy={y(rows[mismatchAt].meteredKwh!)} r={4} fill="var(--surface-0)" strokeWidth={1.5} />
                <text x={x(mismatchAt) + 10} y={y(rows[mismatchAt].listedUsageKwh) + 4} stroke="none">
                  {rows[mismatchAt].listedUsageKwh}
                </text>
                <text x={x(mismatchAt) + 10} y={y(rows[mismatchAt].meteredKwh!) + 4} stroke="none">
                  should be {rows[mismatchAt].meteredKwh}
                </text>
              </g>
            )}

            {/* Hover targets: a column per day, so the mouse or the hand reticle picks a point. */}
            {rows.map((r, i) =>
              visible(i) ? (
                <rect
                  key={r.date}
                  data-chart-point={i}
                  x={x(i) - 12}
                  y={plot.y0 - 16}
                  width={24}
                  height={plot.y1 - plot.y0 + 32}
                  fill="transparent"
                  onPointerEnter={() => set({ chartPoint: i })}
                  onPointerLeave={() => useHandsFree.getState().chartPoint === i && set({ chartPoint: null })}
                />
              ) : null,
            )}
          </g>

          {tip && (
            <g data-anim="lens-energy-tooltip" pointerEvents="none" fontSize={12}>
              <line x1={tipX} x2={tipX} y1={plot.y0} y2={plot.y1} stroke="rgb(255 255 255 / 0.3)" strokeDasharray="2 3" />
              <rect x={boxX} y={16} width={176} height={42} fill="var(--void)" stroke="rgb(255 255 255 / 0.4)" />
              <text x={boxX + 10} y={33} fill="var(--snow)" fontWeight={700}>
                Oct {day(tip.date)}: {kwh(tip.listedUsageKwh)} kWh
              </text>
              <text x={boxX + 10} y={50} fill={tip.mismatch ? "var(--hud-red)" : "rgb(255 255 255 / 0.6)"}>
                {tip.meteredKwh === null ? "first reading" : `meter moved ${kwh(tip.meteredKwh)}`}
              </text>
            </g>
          )}
        </svg>
      </div>
    </Panel>
  );
}
