"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHandsFree } from "@/lib/store/handsfree";
import type { HandFrame } from "@/lib/vision/gestures";
import * as clap from "@/lib/voice/clap";

// Hidden debug panel, Ctrl+Shift+D. The hand drawing is landmarks only (lines and dots);
// no camera image exists anywhere to draw.

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

function drawSkeleton(canvas: HTMLCanvasElement, frame: HandFrame | null) {
  const g = canvas.getContext("2d");
  if (!g) return;
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = "rgb(255 255 255 / 0.15)";
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
  frame?.hands.forEach((hand, i) => {
    g.strokeStyle = g.fillStyle = i ? "#ffb547" : "#5fd4ff";
    g.beginPath();
    for (const [a, b] of BONES) {
      g.moveTo(hand.landmarks[a].x * w, hand.landmarks[a].y * h);
      g.lineTo(hand.landmarks[b].x * w, hand.landmarks[b].y * h);
    }
    g.stroke();
    for (const p of hand.landmarks) g.fillRect(p.x * w - 1.5, p.y * h - 1.5, 3, 3);
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-snow/50">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Panel() {
  const s = useHandsFree();
  const [level, setLevel] = useState(clap.level());
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setLevel(clap.level());
      if (canvas.current) drawSkeleton(canvas.current, useHandsFree.getState().frame);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const pct = (v: number) => `${Math.min(100, v * 400)}%`;
  return (
    <aside
      aria-label="Hands-free debug"
      className="fixed right-4 bottom-4 z-transition w-80 rounded-2xl border border-snow/20 bg-void/95 p-4 font-mono text-[11px] leading-relaxed text-snow"
    >
      <h2 className="mb-2 text-xs font-bold tracking-wider uppercase">Hands-free debug</h2>
      <div className="relative mb-2 h-2 bg-snow/10" title="mic level and clap threshold">
        <div className="h-full bg-[#5fd4ff]" style={{ width: pct(level.rms) }} />
        <div className="absolute inset-y-0 w-px bg-[#ff5a4f]" style={{ left: pct(level.threshold) }} />
      </div>
      <dl>
        <Row label="Mic / camera" value={`${s.mic} / ${s.camera}`} />
        <Row label="Audio context" value={s.audio} />
        <Row label="Clap level / threshold" value={`${level.rms.toFixed(3)} / ${level.threshold.toFixed(3)} (${s.sensitivity})`} />
        <Row label="Claps" value={s.claps.slice(0, 4).map((t) => (t / 1000).toFixed(2)).join(", ") || "none"} />
        <Row
          label="Last loud sound"
          value={
            level.last
              ? `${level.last.verdict} (peak ${level.last.peak.toFixed(2)}, band ${level.last.band.toFixed(2)}, ${level.last.ms.toFixed(0)} ms)`
              : "—"
          }
        />
        <Row label="Speech recognition" value={`${s.speech}${s.listening ? "" : " (paused)"}${s.awake ? ", awake" : ""}`} />
        <Row label="Last transcript" value={s.lastTranscript || "—"} />
        <Row label="Matched command" value={s.lastCommand || "—"} />
        <Row label="Speaking" value={s.speaking ? `yes (${s.voiceLevel.toFixed(2)})` : "no"} />
        <Row label="Music" value={`${s.music}${s.muted ? " (muted)" : ""}`} />
        <Row label="Hands / fps" value={`${s.hands} / ${s.handsFps}`} />
        <Row label="Gesture" value={s.gesture ? `${s.gesture.name} ${(s.gesture.confidence * 100).toFixed(0)}%` : "—"} />
      </dl>
      <canvas ref={canvas} width={288} height={162} className="mt-2 block w-full" aria-hidden />
      {s.notes.length > 0 && (
        <ul className="mt-2 max-h-24 overflow-y-auto text-snow/60">
          {s.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return open ? <Panel /> : null;
}
