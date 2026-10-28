import { describe, expect, it } from "vitest";
import { ClapDetector, DoubleClap, frameAnalyser } from "./clap";

const quiet = (d: ClapDetector, from: number, to: number) => {
  for (let t = from; t < to; t += 16) expect(d.push({ t, rms: 0.005, bandRatio: 0.2 })).toBeNull();
};

describe("ClapDetector", () => {
  it("detects a short, bright transient", () => {
    const d = new ClapDetector();
    quiet(d, 0, 1000);
    expect(d.push({ t: 1000, rms: 0.3, bandRatio: 0.7 })).toBeNull();
    expect(d.push({ t: 1016, rms: 0.2, bandRatio: 0.6 })).toBeNull();
    expect(d.push({ t: 1032, rms: 0.004, bandRatio: 0.2 })).toBe(1000);
  });
  it("ignores long sounds (speech, music)", () => {
    const d = new ClapDetector();
    quiet(d, 0, 1000);
    for (let t = 1000; t < 1300; t += 16) expect(d.push({ t, rms: 0.3, bandRatio: 0.7 })).toBeNull();
    expect(d.push({ t: 1316, rms: 0.004, bandRatio: 0.2 })).toBeNull();
  });
  it("ignores low thuds (knocks)", () => {
    const d = new ClapDetector();
    quiet(d, 0, 1000);
    d.push({ t: 1000, rms: 0.3, bandRatio: 0.05 });
    expect(d.push({ t: 1032, rms: 0.004, bandRatio: 0.2 })).toBeNull();
  });
  it("adapts to a louder room", () => {
    const d = new ClapDetector();
    for (let t = 0; t < 4000; t += 16) d.push({ t, rms: 0.05, bandRatio: 0.3 });
    // 0.15 would clear a quiet room's threshold but not this one's
    d.push({ t: 4000, rms: 0.15, bandRatio: 0.7 });
    expect(d.push({ t: 4032, rms: 0.05, bandRatio: 0.3 })).toBeNull();
  });
});

describe("DoubleClap", () => {
  it("fires on two claps 150–700 ms apart", () => {
    const d = new DoubleClap();
    expect(d.push(0)).toBe(false);
    expect(d.push(400)).toBe(true);
  });
  it("ignores an echo under 150 ms, still pairing with the first clap", () => {
    const d = new DoubleClap();
    d.push(0);
    expect(d.push(100)).toBe(false);
    expect(d.push(400)).toBe(true);
  });
  it("treats claps over 700 ms apart as separate", () => {
    const d = new DoubleClap();
    d.push(0);
    expect(d.push(900)).toBe(false);
    expect(d.push(1200)).toBe(true);
  });
  it("cools down for 1 s after a double clap", () => {
    const d = new DoubleClap();
    d.push(0);
    d.push(400);
    expect(d.push(900)).toBe(false);
    expect(d.push(1200)).toBe(false);
    expect(d.push(1500)).toBe(false);
    expect(d.push(1800)).toBe(true);
  });
});

// End to end on synthetic audio: raw samples → frameAnalyser → ClapDetector → DoubleClap,
// exactly the path the live mic takes.
describe("claps in synthetic audio", () => {
  const RATE = 44100;
  // Seeded noise so the test is deterministic.
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

  function render(seconds: number, events: { at: number; kind: "clap" | "speech" | "knock" }[]): Float32Array {
    const out = new Float32Array(Math.round(seconds * RATE));
    for (let i = 0; i < out.length; i++) out[i] = noise() * 0.004; // quiet room
    for (const { at, kind } of events) {
      const start = Math.round(at * RATE);
      const len = Math.round((kind === "speech" ? 0.45 : 0.15) * RATE);
      for (let i = 0; i < len && start + i < out.length; i++) {
        const t = i / RATE;
        let v = 0;
        if (kind === "clap") v = noise() * 0.6 * Math.min(1, t / 0.001) * Math.exp(-t / 0.012);
        if (kind === "knock") v = Math.sin(2 * Math.PI * 110 * t) * 0.6 * Math.min(1, t / 0.002) * Math.exp(-t / 0.03);
        if (kind === "speech")
          v = [140, 280, 420, 700, 1100].reduce((sum, f, k) => sum + Math.sin(2 * Math.PI * f * t) / (k + 1), 0) * 0.15 * Math.min(1, t / 0.06);
        out[start + i] += v;
      }
    }
    return out;
  }

  function detect(audio: Float32Array) {
    const detector = new ClapDetector();
    const double = new DoubleClap();
    const claps: number[] = [];
    const doubles: number[] = [];
    let frame = 0;
    const analyse = frameAnalyser(RATE, (rms, bandRatio) => {
      const t = frame++ * 10;
      const clap = detector.push({ t, rms, bandRatio });
      if (clap === null) return;
      claps.push(clap);
      if (double.push(clap)) doubles.push(clap);
    });
    // Feed in 128-sample chunks, as the mic delivers them.
    for (let i = 0; i < audio.length; i += 128) analyse(audio.subarray(i, i + 128));
    return { claps, doubles };
  }

  it("hears a double clap", () => {
    const { claps, doubles } = detect(render(3, [{ at: 1.5, kind: "clap" }, { at: 1.85, kind: "clap" }]));
    expect(claps).toHaveLength(2);
    expect(doubles).toHaveLength(1);
  });
  it("ignores speech", () => expect(detect(render(3, [{ at: 1, kind: "speech" }, { at: 1.6, kind: "speech" }])).claps).toEqual([]));
  it("ignores knocks", () => expect(detect(render(3, [{ at: 1, kind: "knock" }, { at: 1.3, kind: "knock" }])).claps).toEqual([]));
  it("single clap is not a double", () => expect(detect(render(3, [{ at: 1.5, kind: "clap" }])).doubles).toEqual([]));
});
