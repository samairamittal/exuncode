"use client";

import type { Ref } from "react";
import { round } from "./hud";

// "The Reckoning V: Origins" on a true isometric grid: x runs down-right, y down-left, both
// at 30° to the horizontal. Visible faces: front (x = max), side (y = max), top (z = max).

type P3 = [number, number, number];
const C = Math.cos(Math.PI / 6);
const SCALE = 1.25;
const iso = ([x, y, z]: P3): [number, number] => [round((x - y) * C * SCALE), round(((x + y) * 0.5 - z) * SCALE)];
const pts = (ps: P3[]) => ps.map((p) => iso(p).join(",")).join(" ");

interface Box {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

/** The three visible faces of a box. */
function faces({ x: [x0, x1], y: [y0, y1], z: [z0, z1] }: Box) {
  return {
    front: pts([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]),
    side: pts([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
    top: pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),
  };
}

// Cabinet in cabinet units (1 unit = 1px before scaling).
const body: Box = { x: [0, 44], y: [0, 64], z: [0, 84] };
const head: Box = { x: [0, 30], y: [0, 64], z: [84, 146] };
const marquee: Box = { x: [0, 36], y: [0, 64], z: [146, 164] };
const screen = pts([[30, 8, 92], [30, 56, 92], [30, 56, 138], [30, 8, 138]]);
// Lower access panel, drawn 2 units off true, as the report says.
const panel = pts([[44, 18, 10], [44, 48, 12], [44, 48, 42], [44, 18, 40]]);
const vents = [58, 64, 70].map((z) => pts([[8, 64, z], [36, 64, z]]));
const scuffs = [
  [[14, 64, 22], [22, 64, 30]],
  [[20, 64, 18], [26, 64, 24]],
] as P3[][];

/** Damage points from the asset integrity report, in cabinet units. */
export const damage = [
  { id: "panel", label: "Panel offset", at: [44, 33, 26] as P3, side: "right" },
  { id: "fasteners", label: "Worn fasteners", at: [44, 48, 50] as P3, side: "right" },
  { id: "vent", label: "Vent fibres", at: [22, 64, 64] as P3, side: "left" },
  { id: "heat", label: "Vent heat", at: [36, 64, 76] as P3, side: "left" },
  { id: "scuffs", label: "Scuffs", at: [20, 64, 24] as P3, side: "left" },
] as const;

const stroke = "var(--hud-cyan)";

export function IsometricCabinet({
  ref,
  marked,
  className = "",
}: {
  ref?: Ref<SVGSVGElement>;
  /** Show the damage points (once the asset report is analysed). */
  marked: boolean;
  className?: string;
}) {
  // View box: cabinet centred, room for labels either side.
  const [ox, oy] = [176, 236];
  const at = (p: P3) => {
    const [x, y] = iso(p);
    return [round(x + ox), round(y + oy)] as const;
  };
  const labelX = { left: 24, right: 316 };

  return (
    <svg ref={ref} data-anim="lens-cabinet" viewBox="0 0 340 320" className={className} role="img" aria-label="The Reckoning V cabinet, isometric">
      <g transform={`translate(${ox} ${oy})`} fill="var(--surface-0)" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round">
        {[body, head, marquee].map((b, i) => {
          const f = faces(b);
          return (
            <g key={i}>
              <polygon points={f.side} />
              <polygon points={f.front} />
              <polygon points={f.top} />
            </g>
          );
        })}
        <polygon points={screen} fill="var(--hud-magenta)" fillOpacity={0.18} stroke="var(--hud-magenta)" />
        <polygon points={panel} fill="none" strokeOpacity={marked ? 1 : 0.6} />
        {vents.map((v, i) => (
          <polyline key={i} points={v} fill="none" />
        ))}
        {marked && scuffs.map((s, i) => <polyline key={i} points={pts(s)} fill="none" stroke="var(--hud-amber)" strokeWidth={1} />)}
      </g>

      {marked &&
        damage.map((d, i) => {
          const [px, py] = at(d.at);
          const ly = 52 + i * 44;
          const lx = labelX[d.side];
          const elbow = d.side === "left" ? lx + 72 : lx - 72;
          return (
            <g key={d.id} data-anim="lens-damage" stroke="var(--hud-amber)" fill="none" strokeWidth={1}>
              <polyline points={`${px},${py} ${elbow},${ly} ${lx},${ly}`} />
              <circle cx={px} cy={py} r={4} fill="var(--surface-0)" strokeWidth={1.5} />
              <circle cx={px} cy={py} r={1.5} fill="var(--hud-amber)" stroke="none" />
              <text
                x={lx}
                y={ly - 6}
                textAnchor={d.side === "left" ? "start" : "end"}
                fill="var(--hud-amber)"
                stroke="none"
                fontSize={11}
                letterSpacing={0.5}
                className="uppercase"
              >
                {d.label}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
