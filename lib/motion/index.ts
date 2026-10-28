import { useSyncExternalStore } from "react";

// Shared motion values. Components never hard-code timings or easings.

export const duration = {
  fast: 0.2,
  base: 0.4,
  slow: 0.8,
  fade: 0.6,
} as const;

export const ease = {
  out: "power3.out",
  inOut: "power2.inOut",
  sine: "sine.inOut",
  linear: "none",
  spring: "back.out(1.6)",
} as const;

export const stagger = {
  dissolve: 0.45,
} as const;

export const home = {
  pixelFrom: 60,
  pixelDuration: 1.5,
  flicker: [1, 0, 1, 0.2, 0, 1, 0.4, 1],
  flickerStep: 0.06,
  glowPeak: 0.45,
  glowDuration: 1.8,
  scanDriftDuration: 0.5,
  rollDuration: 7,
  glitchEvery: [4, 6] as const,
  glitchShift: 9,
  parallaxPx: 14,
  parallaxDepth: { cabinet: 0.3, screen: 0.65, text: 1 },
  parallaxDuration: 0.9,
  zoomDuration: 0.7,
} as const;

/** Home: the scroll-driven shader reveal below the hero. */
export const reveal = {
  /** How far the section scrolls while the image reveals, in viewport heights. */
  scrollLength: 2,
  /** Pixel block size (CSS px) at the start of the reveal. */
  pixelFrom: 64,
  /** Scroll progress eases toward its target by this much per frame (0–1). */
  follow: 0.12,
  /** Width of the glowing reveal edge, in progress units. */
  edge: 0.08,
  /** Image scale at the start; settles to 1. */
  zoomFrom: 1.12,
} as const;

export const city = {
  perspective: 1600,
  /** Layer heights in px when fully lifted: buildings rise more toward the front. */
  depthBack: 30,
  depthFront: 120,
  depthText: 70,
  hoverRise: 28,
  flyRise: 48,
  /** Orbit pose when the city lifts into 3D, and the drag limits. */
  pose: { rotationX: 38, rotationY: -16, scale: 0.92 },
  pitch: [0, 62] as const,
  yaw: [-50, 50] as const,
  zoom: [0.7, 2.6] as const,
  flyScale: 2,
  dragYaw: 0.25,
  dragPitch: 0.2,
  wheelZoom: 0.0015,
  turnStep: 15,
  zoomStep: 0.25,
  clickSlop: 5,
  follow: 0.5,
  liftDuration: 0.9,
  flyDuration: 1,
  intro: {
    from: { rotationX: 58, rotationY: -34, scale: 0.75, lift: 1.7 },
    swoop: 1.3,
    dropHeight: 520,
    drop: 0.9,
    dropStagger: 0.07,
    hold: 0.5,
    settle: 1.5,
  },
  /** Flat city peeks into 3D under the pointer. */
  peekTilt: 5,
  peekLift: 0.15,
  /** While lifted: buildings bob, the camera drifts, glitches and power surges roll through. */
  bob: 7,
  bobDuration: [1.6, 2.8] as const,
  drift: 7,
  driftDuration: 6,
  glitchEvery: [2, 4] as const,
  glitchShift: 5,
  surgeEvery: 5,
  surgeHeight: 22,
  surgeSpread: 0.9,
  rollCall: 2.6,
  labelStagger: 0.05,
  sweep: 3.2,
} as const;

export const crux = {
  /** Cards fall onto the board in date order, then get pinned at the corner. */
  cardOrder: ["e1", "e3", "e2", "e4"] as const,
  cardFrom: { yPercent: -22, scale: 1.16, rotation: 7 },
  cardDrop: 0.5,
  cardGap: 0.62,
  shadow: 0.5,
  pinFrom: { yPercent: -260, scale: 2.2 },
  pinDrop: 0.26,
  pinPress: 0.8,
  pinSettle: 0.35,
  ring: 0.7,
  ringScale: 3.4,
  /** The card swings on its new pin (degrees). */
  swing: [-2.6, 1.7, -0.9, 0.35, 0] as const,
  swingStep: 0.13,
  /** Strings run out from a pin with slack, then pull taut. */
  stringOrder: ["e2-e4", "e2-e3", "e4-e1", "e4-nuxeland", "e1-nuxeland", "e2-nuxeland", "e3-nuxeland"] as const,
  stringDraw: 0.85,
  stringGap: 0.28,
  slack: 70,
  taut: 1.4,
  bump: 1.18,
  /** Hover: the card lifts off the board and its strings twang. */
  hoverScale: 1.035,
  twang: 16,
  twangDuration: 1.1,
} as const;

export const lens = {
  /** Idle: the tick ring turns once in this many seconds; the live dot blinks. */
  ringSpin: 120,
  /** While thinking (scanning) the ticks spin this fast. */
  ringSpinThinking: 8,
  blink: 1.6,
  /** How long one file takes to scan. */
  scanDuration: 2.4,
  /** Seconds per character as LENS types its voice line. */
  typeStep: 0.028,
} as const;

export const transition = {
  cell: 56,
  dissolveIn: 0.45,
  dissolveOut: 0.5,
  routeTimeoutMs: 6000,
} as const;

export const scramble = {
  duration: 0.45,
  glyphs: "!<>-_/[]{}=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
} as const;

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True when the user asks for reduced motion. False during SSR. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}
