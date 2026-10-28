import type { FindingType, Severity } from "@/lib/data";

// Colour meaning on the Lens page: cyan normal, amber warning (physical damage), red
// discrepancy/error, magenta only for the game; white for cross-file inconsistencies.

export const typeLabel: Record<FindingType, string> = {
  discrepancy: "Discrepancy",
  inconsistency: "Inconsistency",
  encoded: "Encoded",
  "code-change": "Code change",
  physical: "Physical",
  redaction: "Redaction",
  text: "Statement",
};

/** Tailwind text colour per finding type. */
export const typeText: Record<FindingType, string> = {
  discrepancy: "text-(--hud-red)",
  inconsistency: "text-snow",
  encoded: "text-(--hud-cyan)",
  "code-change": "text-(--hud-magenta)",
  physical: "text-(--hud-amber)",
  redaction: "text-snow/60",
  text: "text-(--hud-cyan)",
};

/** CSS colour per finding type, for SVG strokes and bars. */
export const typeColor: Record<FindingType, string> = {
  discrepancy: "var(--hud-red)",
  inconsistency: "var(--snow)",
  encoded: "var(--hud-cyan)",
  "code-change": "var(--hud-magenta)",
  physical: "var(--hud-amber)",
  redaction: "rgb(255 255 255 / 0.6)",
  text: "var(--hud-cyan)",
};

/** How much of the severity bar is filled. */
export const severityFill: Record<Severity, number> = { info: 1 / 3, notice: 2 / 3, critical: 1 };
export const severityLabel: Record<Severity, string> = { info: "Info", notice: "Notice", critical: "Critical" };

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
}

/** Two decimals: SVG coordinates must render the same on the server and in the browser. */
export const round = (v: number) => Math.round(v * 100) / 100;

/** SVG arc path from one angle to another (degrees, clockwise from 12 o'clock). */
export function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
