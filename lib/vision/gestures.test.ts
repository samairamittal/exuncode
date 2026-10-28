import { describe, expect, it } from "vitest";
import { classifyPose, GestureEngine, type GestureName, type Hand, type HandFrame, type Landmark } from "./gestures";

// Synthetic hands: canonical landmark shapes in hand units (wrist at 0,0, wrist → middle
// knuckle = 1, up is negative y), placed at (cx, cy) with size 0.1 in camera space.
type P = [number, number];
const OPEN: P[] = [
  [0, 0],
  [-0.35, -0.25], [-0.6, -0.45], [-0.78, -0.6], [-0.95, -0.75],
  [-0.25, -0.9], [-0.27, -1.25], [-0.28, -1.45], [-0.29, -1.65],
  [0, -1], [0, -1.4], [0, -1.62], [0, -1.85],
  [0.22, -0.92], [0.24, -1.28], [0.25, -1.48], [0.26, -1.66],
  [0.42, -0.8], [0.46, -1.08], [0.48, -1.25], [0.5, -1.4],
];
const fold = (p: P[], tips: number[]) => p.map((q, i) => (tips.includes(i) ? ([p[i - 3][0] * 0.75, p[i - 3][1] * 0.75] as P) : q));
const thumbIn = (p: P[]) => p.map((q, i) => (i === 4 ? ([-0.2, -0.75] as P) : i === 3 ? ([-0.35, -0.6] as P) : q));
const shapes = {
  open: OPEN,
  fist: thumbIn(fold(OPEN, [8, 12, 16, 20])),
  point: thumbIn(fold(OPEN, [12, 16, 20])),
  thumbsUp: fold(OPEN, [8, 12, 16, 20]).map((q, i) => (i === 3 ? ([-0.5, -1] as P) : i === 4 ? ([-0.55, -1.5] as P) : q)),
  pinch: OPEN.map((q, i) => (i === 4 ? ([OPEN[8][0] + 0.02, OPEN[8][1]] as P) : q)),
};

function hand(shape: P[], cx = 0.5, cy = 0.6, size = 0.1, roll = 0): Hand {
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const landmarks: Landmark[] = shape.map(([x, y]) => ({ x: cx + (x * c - y * s) * size, y: cy + (x * s + y * c) * size, z: 0 }));
  return { score: 0.95, landmarks };
}

/** Runs frames every 33 ms; returns the gesture names in order. */
function run(frames: ((t: number) => Hand[])[], engine = new GestureEngine()): GestureName[] {
  const out: GestureName[] = [];
  frames.forEach((f, i) => {
    const t = i * 33;
    const frame: HandFrame = { t, hands: f(t) };
    out.push(...engine.push(frame).map((g) => g.name));
  });
  return out;
}
const repeat = (n: number, f: (t: number) => Hand[]) => Array.from({ length: n }, () => f);

describe("poses", () => {
  it.each([
    ["open", shapes.open],
    ["fist", shapes.fist],
    ["point", shapes.point],
    ["thumbs-up", shapes.thumbsUp],
  ] as const)("%s", (pose, shape) => expect(classifyPose(hand(shape))).toBe(pose));
});

describe("gestures", () => {
  it("quick pinch and release is a tap", () => {
    const names = run([...repeat(3, () => [hand(shapes.open)]), ...repeat(4, () => [hand(shapes.pinch)]), ...repeat(3, () => [hand(shapes.open)])]);
    expect(names).toContain("tap");
    expect(names).not.toContain("grab");
  });

  it("two quick taps make a double tap", () => {
    const tap = [...repeat(3, () => [hand(shapes.pinch)]), ...repeat(3, () => [hand(shapes.open)])];
    expect(run([...repeat(2, () => [hand(shapes.open)]), ...tap, ...tap])).toContain("double-tap");
  });

  it("pinch and hold grabs, drags while moving, releases", () => {
    const frames = [
      ...repeat(2, () => [hand(shapes.open)]),
      ...Array.from({ length: 20 }, (_, i) => () => [hand(shapes.pinch, 0.4 + i * 0.01)]),
      ...repeat(2, () => [hand(shapes.open, 0.6)]),
    ];
    const names = run(frames);
    expect(names.indexOf("grab")).toBeGreaterThan(-1);
    expect(names).toContain("drag");
    expect(names.at(-1)).toBe("release");
    expect(names).not.toContain("tap");
  });

  it("pinch and twist rotates", () => {
    const frames = [
      ...repeat(2, () => [hand(shapes.open)]),
      ...Array.from({ length: 20 }, (_, i) => () => [hand(shapes.pinch, 0.5, 0.6, 0.1, i * 0.05)]),
    ];
    expect(run(frames)).toContain("rotate");
  });

  it("two pinching hands moving apart zoom in", () => {
    const engine = new GestureEngine();
    const scales: number[] = [];
    for (let i = 0; i < 10; i++) {
      const gap = 0.1 + i * 0.02;
      const events = engine.push({ t: i * 33, hands: [hand(shapes.pinch, 0.5 - gap), hand(shapes.pinch, 0.5 + gap)] });
      events.filter((e) => e.name === "zoom").forEach((e) => scales.push(e.value!.scale!));
    }
    expect(scales.length).toBeGreaterThan(0);
    expect(scales.every((s) => s > 1)).toBe(true);
  });

  it("open hand moving fast to the right swipes right, once", () => {
    const frames = Array.from({ length: 12 }, (_, i) => () => [hand(shapes.open, 0.2 + i * 0.06)]);
    const names = run(frames);
    expect(names.filter((n) => n === "swipe-right")).toHaveLength(1);
    expect(names).not.toContain("swipe-left");
  });

  it("swipe up", () => {
    const frames = Array.from({ length: 12 }, (_, i) => () => [hand(shapes.open, 0.5, 0.8 - i * 0.06)]);
    expect(run(frames)).toContain("swipe-up");
  });

  it("open palm held still for a second", () => {
    const names = run(repeat(40, () => [hand(shapes.open)]));
    expect(names.filter((n) => n === "palm-hold")).toHaveLength(1);
  });

  it("slowly drifting palm is not a hold", () => {
    expect(run(Array.from({ length: 40 }, (_, i) => () => [hand(shapes.open, 0.3 + i * 0.004)]))).not.toContain("palm-hold");
  });

  it("thumbs up", () => expect(run(repeat(20, () => [hand(shapes.thumbsUp)]))).toContain("thumbs-up"));
  it("fist", () => expect(run(repeat(15, () => [hand(shapes.fist)]))).toContain("fist"));
  it("point and hold", () => {
    const names = run(repeat(40, () => [hand(shapes.point)]));
    expect(names).toContain("point");
    expect(names).toContain("point-hold");
  });

  it("ignores low-confidence hands", () => {
    const weak = (h: Hand) => ({ ...h, score: 0.3 });
    expect(run(repeat(40, () => [weak(hand(shapes.open))]))).toEqual([]);
  });
});
