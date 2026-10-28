import { energyDossier } from "@/lib/case";
import { checkLedger } from "@/lib/lens";
import { CHART_DAYS, type ChartView, type DocView } from "@/lib/store/handsfree";

// View maths for the gesture- and voice-driven chart and document.

const MIN_SPAN = 3;
const MAX_SPAN = CHART_DAYS - 1;

function clampChart({ start, end }: ChartView): ChartView {
  const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, end - start));
  const s = Math.min(Math.max(0, start), MAX_SPAN - span);
  return { start: s, end: s + span };
}

/** Zoom the time axis by `ratio` (>1 zooms in), keeping `centre` (a day index) in place. */
export function zoomChart(view: ChartView, ratio: number, centre = (view.start + view.end) / 2): ChartView {
  const span = (view.end - view.start) / ratio;
  const t = (centre - view.start) / (view.end - view.start || 1);
  return clampChart({ start: centre - t * span, end: centre - t * span + span });
}

export function panChart(view: ChartView, days: number): ChartView {
  return clampChart({ start: view.start + days, end: view.end + days });
}

/** A window of `span` days centred on one day. */
export function focusDay(day: number, span = 5): ChartView {
  return clampChart({ start: day - span / 2, end: day + span / 2 });
}

export const clampDoc = (d: DocView): DocView => ({
  ...d,
  scale: Math.min(3, Math.max(0.5, d.scale)),
  x: Math.min(400, Math.max(-400, d.x)),
  y: Math.min(300, Math.max(-300, d.y)),
  rotateX: Math.min(60, Math.max(-60, d.rotateX)),
  rotateY: Math.min(60, Math.max(-60, d.rotateY)),
});

export const isDefaultDoc = (d: DocView) => d.scale === 1 && !d.x && !d.y && !d.rotateX && !d.rotateY;

export const ledger = checkLedger(energyDossier.readings);

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** "October 23rd, 2,684 kilowatt-hours." plus the meter's figure when it disagrees. */
export function sayDay(index: number): string {
  const r = ledger[index];
  const date = new Date(`${r.date}T00:00:00`);
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const kwh = r.listedUsageKwh.toLocaleString("en-GB");
  const base = `${month} ${ordinal(date.getDate())}, ${kwh} kilowatt-hours`;
  return r.mismatch ? `${base} listed. The meter moved ${r.meteredKwh}.` : `${base}.`;
}
