import type { HandFrame } from "./gestures";

// Visual check for a clap: with two hands in view, they must be coming together at the
// moment of the sound. With fewer hands, the audio clap stands on its own.

const WINDOW_MS = 350;
const CLOSE = 0.22; // wrists closer than this (camera widths) count as together
const recent: { t: number; distance: number | null }[] = [];

export function recordHands(frame: HandFrame): void {
  const [a, b] = frame.hands;
  const distance = a && b ? Math.hypot(a.landmarks[0].x - b.landmarks[0].x, a.landmarks[0].y - b.landmarks[0].y) : null;
  recent.push({ t: frame.t, distance });
  while (recent.length && recent[0].t < frame.t - 2000) recent.shift();
}

export function clearHands(): void {
  recent.length = 0;
}

/** "confirm": hands met; "reject": two hands seen but they didn't; "unknown": not enough hands. */
export function confirmClap(t: number): "confirm" | "reject" | "unknown" {
  const around = recent.filter((r) => Math.abs(r.t - t) <= WINDOW_MS);
  const both = around.filter((r) => r.distance !== null) as { t: number; distance: number }[];
  if (both.length < 3) return "unknown";
  const closest = Math.min(...both.map((r) => r.distance));
  const before = both.filter((r) => r.t <= t);
  const closing = before.length >= 2 && before[0].distance > before.at(-1)!.distance;
  return closest < CLOSE || closing ? "confirm" : "reject";
}
