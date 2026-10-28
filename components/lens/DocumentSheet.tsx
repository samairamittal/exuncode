"use client";

import type { Ref } from "react";
import { PAGE_LINES, pageCount, type LensDocument } from "./documents";
import { RING } from "./CoreRings";
import { round } from "./hud";

// The document under analysis, drawn as SVG on a tilted sheet (lens1's perspective tilt,
// as a rotate + skew so leader lines can be computed exactly).

export const SHEET = { w: 420, h: 300, pad: 20, rotate: 15, skew: -7 } as const;

const rad = (d: number) => (d * Math.PI) / 180;
const cos = Math.cos(rad(SHEET.rotate));
const sin = Math.sin(rad(SHEET.rotate));
const tan = Math.tan(rad(SHEET.skew));
// rotate(θ) · skewX(φ), centred on the rings
const m = { a: cos, b: sin, c: cos * tan - sin, d: sin * tan + cos };
const e = RING.cx - (m.a * SHEET.w + m.c * SHEET.h) / 2;
const f = RING.cy - (m.b * SHEET.w + m.d * SHEET.h) / 2;
export const sheetMatrix = `matrix(${[m.a, m.b, m.c, m.d, e, f].map((v) => v.toFixed(4)).join(" ")})`;

/** A point on the sheet, in core coordinates. */
export function onSheet(x: number, y: number): [number, number] {
  return [round(m.a * x + m.c * y + e), round(m.b * x + m.d * y + f)];
}

// Table layout on the sheet.
const COL = { date: SHEET.pad, meter: 270, daily: SHEET.w - SHEET.pad };
const HEAD_Y = 92;
const ROW_Y = 122;
const ROW_H = 24;
export const rowY = (i: number) => ROW_Y + i * ROW_H;
// Text pages: PAGE_LINES lines of 12px fit under the heading.
const TEXT_H = 21;

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const kwh = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export function DocumentSheet({
  ref,
  doc,
  scanY,
  flagged,
  page = 0,
  highlightDate,
  focused = false,
}: {
  ref?: Ref<SVGGElement>;
  doc: LensDocument;
  page?: number;
  /** Row of the finding being hovered or named. */
  highlightDate?: string;
  /** Gestures or voice are acting on the document: frame it in cyan. */
  focused?: boolean;
  /** Scan line position, 0–1 down the sheet; null when not scanning. */
  scanY: number | null;
  /** Show findings on the table (after the dossier is analysed). */
  flagged: boolean;
}) {
  return (
    <g ref={ref} data-anim="lens-document" transform={sheetMatrix}>
      <rect width={SHEET.w} height={SHEET.h} fill="var(--void)" stroke={focused ? "var(--hud-cyan)" : "rgb(255 255 255 / 0.6)"} strokeWidth={focused ? 1.5 : 1} />
      <text x={SHEET.pad} y={36} fill="var(--snow)" fontSize={15} fontWeight={700} className="uppercase" letterSpacing={1}>
        {doc.title}
      </text>
      <text x={SHEET.pad} y={56} fill="rgb(255 255 255 / 0.5)" fontSize={11}>
        {doc.subtitle}
      </text>

      {doc.kind === "table" ? (
        <g fontSize={13} fill="var(--snow)">
          <g fill="rgb(255 255 255 / 0.5)" fontSize={11} className="uppercase" letterSpacing={0.5}>
            <text x={COL.date} y={HEAD_Y}>
              Date
            </text>
            <text x={COL.meter} y={HEAD_Y} textAnchor="end">
              Meter kWh
            </text>
            <text x={COL.daily} y={HEAD_Y} textAnchor="end">
              Daily kWh
            </text>
          </g>
          <line x1={SHEET.pad} x2={SHEET.w - SHEET.pad} y1={HEAD_Y + 10} y2={HEAD_Y + 10} stroke="rgb(255 255 255 / 0.3)" />
          {doc.rows.map((r, i) => {
            const tone = flagged && r.mismatch ? "var(--hud-red)" : flagged && r.spike ? "var(--hud-amber)" : null;
            const lit = r.date === highlightDate;
            return (
              <g key={r.date} data-anim="lens-row">
                {tone && (
                  <rect
                    x={SHEET.pad - 8}
                    y={rowY(i) - 16}
                    width={SHEET.w - 2 * SHEET.pad + 16}
                    height={ROW_H - 2}
                    fill={lit ? tone : "none"}
                    fillOpacity={0.15}
                    stroke={tone}
                    strokeWidth={lit ? 2 : 1}
                    style={lit ? { filter: `drop-shadow(0 0 6px ${tone})` } : undefined}
                  />
                )}
                <text x={COL.date} y={rowY(i)} fill={tone ?? undefined}>
                  {shortDate(r.date)}
                </text>
                <text x={COL.meter} y={rowY(i)} textAnchor="end" fill={tone ?? undefined}>
                  {kwh(r.readingKwh)}
                </text>
                <text x={COL.daily} y={rowY(i)} textAnchor="end" fill={tone ?? undefined}>
                  {kwh(r.listedUsageKwh)}
                </text>
              </g>
            );
          })}
        </g>
      ) : (
        <g fontSize={12} fill="var(--snow)">
          {doc.lines.slice(page * PAGE_LINES, (page + 1) * PAGE_LINES).map((line, i) => (
            <text key={i} x={SHEET.pad} y={HEAD_Y + i * TEXT_H}>
              {line}
            </text>
          ))}
        </g>
      )}

      {pageCount(doc) > 1 && (
        <text x={SHEET.w - SHEET.pad} y={36} textAnchor="end" fill="rgb(255 255 255 / 0.5)" fontSize={11}>
          {page + 1} / {pageCount(doc)}
        </text>
      )}

      {scanY !== null && (
        <g data-anim="lens-scanline" transform={`translate(0 ${(scanY * SHEET.h).toFixed(1)})`}>
          <rect y={-24} width={SHEET.w} height={24} fill="url(#lens-scan-fade)" />
          <line x2={SHEET.w} stroke="var(--hud-cyan)" strokeWidth={2} style={{ filter: "drop-shadow(0 0 6px var(--hud-cyan))" }} />
        </g>
      )}
    </g>
  );
}

/** Anchor points for the callouts: left end of the spike row, right end of the mismatch row. */
export function rowAnchor(i: number, side: "left" | "right"): [number, number] {
  return onSheet(side === "left" ? SHEET.pad - 8 : SHEET.w - SHEET.pad + 8, rowY(i) - 5);
}
