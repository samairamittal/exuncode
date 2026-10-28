import { create } from "zustand";
import { readPreference, writePreference } from "@/lib/data";
import type { GestureName, HandFrame } from "@/lib/vision/gestures";
import type { Sensitivity } from "@/lib/voice/clap";

// Live state of hands-free control (mic, camera, voice, music, gestures) and of the Lens
// views they drive. UI reads it to animate; lib/voice and lib/vision never import it.

export type DeviceState = "off" | "starting" | "on" | "unavailable" | "blocked";
export type CoreState = "idle" | "listening" | "thinking" | "speaking" | "music";
export type ReticleMode = "point" | "pinch" | "grab" | "tap";
export type LensFocus = "document" | "chart" | "findings";
export type Power = "on" | "booting" | "sleep";

export interface DocView {
  scale: number;
  x: number;
  y: number;
  rotateX: number;
  rotateY: number;
  page: number;
}

/** Chart's visible time range, in day indexes (0–13). */
export interface ChartView {
  start: number;
  end: number;
}

export const DOC_VIEW: DocView = { scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0, page: 0 };
export const CHART_DAYS = 14;
export const CHART_VIEW: ChartView = { start: 0, end: CHART_DAYS - 1 };

interface HandsFreeState {
  // devices and engines
  mic: DeviceState;
  camera: DeviceState;
  audio: AudioContextState | "none";
  speech: "unsupported" | "starting" | "on" | "blocked" | "error" | "off";
  notes: string[];

  // clap
  sensitivity: Sensitivity;
  claps: number[];
  lastDoubleClap: number | null;

  // voice
  /** Voice commands enabled (a double clap on Lens toggles it). */
  listening: boolean;
  /** Wake word heard: LENS is listening for a command. */
  awake: boolean;
  speaking: boolean;
  voiceLevel: number;
  caption: string;
  lastTranscript: string;
  lastCommand: string;

  // music
  muted: boolean;
  music: "idle" | "playing" | "synth" | "ended" | "blocked";
  beat: number;

  // hands
  hands: number;
  handsFps: number;
  frame: HandFrame | null;
  reticle: { x: number; y: number; visible: boolean; mode: ReticleMode };
  gesture: { name: GestureName; confidence: number; at: number } | null;

  // Lens views
  power: Power;
  thinking: boolean;
  focus: LensFocus | null;
  focusedFinding: string | null;
  doc: DocView;
  chart: ChartView;
  /** Chart point under the reticle or stepped to by voice/swipe. */
  chartPoint: number | null;

  set: (patch: Partial<HandsFreeState>) => void;
  note: (message: string) => void;
  setMuted: (muted: boolean) => void;
  loadPreferences: () => void;
  addClap: (t: number) => void;
  setDoc: (fn: (d: DocView) => DocView) => void;
  setChart: (fn: (c: ChartView) => ChartView) => void;
  resetViews: () => void;
}

export const useHandsFree = create<HandsFreeState>()((set) => ({
  mic: "off",
  camera: "off",
  audio: "none",
  speech: "off",
  notes: [],
  sensitivity: "medium",
  claps: [],
  lastDoubleClap: null,
  listening: true,
  awake: false,
  speaking: false,
  voiceLevel: 0,
  caption: "",
  lastTranscript: "",
  lastCommand: "",
  muted: false, // read from preferences on the client (HandsFree), so SSR matches
  music: "idle",
  beat: 0,
  hands: 0,
  handsFps: 0,
  frame: null,
  reticle: { x: 0, y: 0, visible: false, mode: "point" },
  gesture: null,
  power: "on",
  thinking: false,
  focus: null,
  focusedFinding: null,
  doc: DOC_VIEW,
  chart: CHART_VIEW,
  chartPoint: null,

  set: (patch) => set(patch),
  note: (message) =>
    set((s) => ({ notes: [`${new Date().toLocaleTimeString("en-GB")} ${message}`, ...s.notes].slice(0, 12) })),
  setMuted: (muted) => {
    writePreference("music-muted", muted);
    set({ muted });
  },
  loadPreferences: () => set({ muted: readPreference("music-muted", false) }),
  addClap: (t) => set((s) => ({ claps: [t, ...s.claps].slice(0, 8) })),
  setDoc: (fn) => set((s) => ({ doc: fn(s.doc) })),
  setChart: (fn) => set((s) => ({ chart: fn(s.chart) })),
  resetViews: () => set({ doc: DOC_VIEW, chart: CHART_VIEW, chartPoint: null, focus: null }),
}));

/** The Lens core's state, highest priority first. */
export function coreState(s: Pick<HandsFreeState, "speaking" | "music" | "thinking" | "awake">): CoreState {
  if (s.music === "playing" || s.music === "synth") return "music";
  if (s.speaking) return "speaking";
  if (s.thinking) return "thinking";
  if (s.awake) return "listening";
  return "idle";
}
