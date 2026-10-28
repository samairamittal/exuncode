// Hand gestures from MediaPipe hand landmarks. Pure: feed it frames, get gesture events.
//
// Coordinates are normalised camera space (0–1), with x already mirrored so moving a hand
// right moves right. Landmark indices follow MediaPipe: 0 wrist, 4 thumb tip, 8 index tip,
// 12 middle tip, 16 ring tip, 20 pinky tip; the joint below each tip is tip − 2 (PIP).
//
// Every gesture lives in `gestureTable` with its own debounce and confidence threshold.
// To add one: give it a name, a debounce, a threshold and a detect function.

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Hand {
  /** Detection confidence, 0–1. */
  score: number;
  landmarks: Landmark[];
}

export interface HandFrame {
  /** Milliseconds. */
  t: number;
  hands: Hand[];
}

export type GestureName =
  | "point"
  | "tap"
  | "double-tap"
  | "grab"
  | "drag"
  | "release"
  | "zoom"
  | "rotate"
  | "swipe-left"
  | "swipe-right"
  | "swipe-up"
  | "swipe-down"
  | "thumbs-up"
  | "palm-hold"
  | "fist"
  | "point-hold";

export interface GestureEvent {
  name: GestureName;
  /** Where it happened, normalised camera space (mirrored). */
  x: number;
  y: number;
  /** How strongly it was made, 0–1 (e.g. swipe speed). */
  strength: number;
  confidence: number;
  /** Gesture-specific amount: drag dx/dy, zoom ratio this frame, rotation in degrees. */
  value?: { dx?: number; dy?: number; scale?: number; degrees?: number };
}

export type Pose = "open" | "fist" | "point" | "thumbs-up" | "other";

// ---- landmark geometry -------------------------------------------------------------------

const WRIST = 0;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const FINGER_TIPS = [8, 12, 16, 20];

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
/** Wrist to middle-finger knuckle: the hand's own scale, so thresholds work at any distance. */
export const handSize = (h: Hand) => dist(h.landmarks[WRIST], h.landmarks[MIDDLE_MCP]) || 1e-6;

function fingerExtended(h: Hand, tip: number): boolean {
  const l = h.landmarks;
  return dist(l[WRIST], l[tip]) > dist(l[WRIST], l[tip - 2]) * 1.15;
}

function thumbExtended(h: Hand): boolean {
  const l = h.landmarks;
  return dist(l[THUMB_TIP], l[INDEX_MCP]) > handSize(h) * 0.6 && dist(l[WRIST], l[THUMB_TIP]) > dist(l[WRIST], l[THUMB_IP]);
}

export function classifyPose(h: Hand): Pose {
  const [index, middle, ring, pinky] = FINGER_TIPS.map((tip) => fingerExtended(h, tip));
  const thumb = thumbExtended(h);
  const l = h.landmarks;
  if (index && middle && ring && pinky && thumb) return "open";
  if (!index && !middle && !ring && !pinky) {
    // Thumb up: extended and clearly above the knuckles (image y grows downward).
    if (thumb && l[THUMB_TIP].y < l[INDEX_MCP].y - handSize(h) * 0.35) return "thumbs-up";
    return "fist";
  }
  if (index && !middle && !ring && !pinky) return "point";
  return "other";
}

/** Thumb-to-index distance over hand size: ~0.1 touching, ~1 apart. */
export const pinchRatio = (h: Hand) => dist(h.landmarks[THUMB_TIP], h.landmarks[INDEX_TIP]) / handSize(h);

const pinchPoint = (h: Hand): Landmark => {
  const a = h.landmarks[THUMB_TIP];
  const b = h.landmarks[INDEX_TIP];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
};

/** Hand roll in degrees (wrist → middle knuckle), for pinch-and-twist. */
const handAngle = (h: Hand) => {
  const a = h.landmarks[WRIST];
  const b = h.landmarks[MIDDLE_MCP];
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
};

// ---- tracked state, updated once per frame before the table runs --------------------------

const PINCH_ON = 0.3;
const PINCH_OFF = 0.45;
const TAP_MS = 250;
const DOUBLE_TAP_MS = 450;
const HISTORY_MS = 1100;

interface Sample {
  t: number;
  pose: Pose;
  wrist: Landmark;
  tip: Landmark;
}

export interface GestureContext {
  t: number;
  frame: HandFrame;
  primary: Hand | null;
  pose: Pose;
  /** Primary-hand samples over the last ~second, oldest first. */
  history: Sample[];
  /** How long the current pose has been held (ms). */
  poseHeld: number;
  pinch: {
    /** Changed this frame. */
    started: boolean;
    ended: boolean;
    active: boolean;
    since: number;
    grabbing: boolean;
    /** Grab began this frame. */
    grabStarted: boolean;
    /** Released a grab (not a tap) this frame. */
    released: boolean;
    tapped: boolean;
    doubleTapped: boolean;
    at: Landmark | null;
    dx: number;
    dy: number;
    degrees: number;
  };
  twoHand: { active: boolean; scale: number; x: number; y: number };
}

/** Largest wrist (or fingertip) move across the recent history. */
function spread(samples: Sample[], key: "wrist" | "tip"): number {
  if (samples.length < 2) return 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s[key].x);
    maxX = Math.max(maxX, s[key].x);
    minY = Math.min(minY, s[key].y);
    maxY = Math.max(maxY, s[key].y);
  }
  return Math.max(maxX - minX, maxY - minY);
}

const within = (samples: Sample[], t: number, ms: number) => samples.filter((s) => s.t >= t - ms);

// ---- the table ---------------------------------------------------------------------------

export interface GestureSpec {
  name: GestureName;
  /** Minimum gap between two events of this gesture. */
  debounceMs: number;
  minConfidence: number;
  detect: (ctx: GestureContext) => Omit<GestureEvent, "name"> | null;
}

const at = (p: Landmark | undefined | null) => ({ x: p?.x ?? 0.5, y: p?.y ?? 0.5 });
const conf = (ctx: GestureContext) => ctx.primary?.score ?? 0;

function swipe(dir: "left" | "right" | "up" | "down") {
  return (ctx: GestureContext) => {
    const recent = within(ctx.history, ctx.t, 250);
    if (recent.length < 3 || recent.some((s) => s.pose !== "open")) return null;
    const a = recent[0].wrist;
    const b = recent.at(-1)!.wrist;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horizontal = Math.abs(dx) > 2 * Math.abs(dy);
    const vertical = Math.abs(dy) > 2 * Math.abs(dx);
    const amount = { left: -dx, right: dx, up: -dy, down: dy }[dir];
    const ok = (dir === "left" || dir === "right" ? horizontal : vertical) && amount > 0.18;
    return ok ? { ...at(b), strength: Math.min(1, amount / 0.4), confidence: conf(ctx) } : null;
  };
}

function held(pose: Pose, ms: number, still?: { key: "wrist" | "tip"; max: number }) {
  return (ctx: GestureContext) => {
    if (ctx.pose !== pose || ctx.poseHeld < ms) return null;
    if (still && spread(within(ctx.history, ctx.t, ms), still.key) > still.max) return null;
    const last = ctx.history.at(-1);
    return { ...at(still?.key === "tip" ? last?.tip : last?.wrist), strength: 1, confidence: conf(ctx) };
  };
}

export const gestureTable: GestureSpec[] = [
  {
    name: "point",
    debounceMs: 100,
    minConfidence: 0.6,
    detect: (ctx) => (ctx.pose === "point" ? { ...at(ctx.history.at(-1)?.tip), strength: 1, confidence: conf(ctx) } : null),
  },
  {
    name: "tap",
    debounceMs: 150,
    minConfidence: 0.6,
    detect: (ctx) => (ctx.pinch.tapped ? { ...at(ctx.pinch.at), strength: 1, confidence: conf(ctx) } : null),
  },
  {
    name: "double-tap",
    debounceMs: 600,
    minConfidence: 0.6,
    detect: (ctx) => (ctx.pinch.doubleTapped ? { ...at(ctx.pinch.at), strength: 1, confidence: conf(ctx) } : null),
  },
  {
    name: "grab",
    debounceMs: 0,
    minConfidence: 0.6,
    detect: (ctx) => (ctx.pinch.grabStarted ? { ...at(ctx.pinch.at), strength: 1, confidence: conf(ctx) } : null),
  },
  {
    name: "drag",
    debounceMs: 0,
    minConfidence: 0.5,
    detect: (ctx) =>
      ctx.pinch.grabbing && !ctx.twoHand.active && (ctx.pinch.dx || ctx.pinch.dy)
        ? { ...at(ctx.pinch.at), strength: 1, confidence: conf(ctx), value: { dx: ctx.pinch.dx, dy: ctx.pinch.dy } }
        : null,
  },
  {
    name: "rotate",
    debounceMs: 0,
    minConfidence: 0.5,
    detect: (ctx) =>
      ctx.pinch.grabbing && !ctx.twoHand.active && Math.abs(ctx.pinch.degrees) > 0.6
        ? { ...at(ctx.pinch.at), strength: Math.min(1, Math.abs(ctx.pinch.degrees) / 10), confidence: conf(ctx), value: { degrees: ctx.pinch.degrees } }
        : null,
  },
  {
    name: "release",
    debounceMs: 0,
    minConfidence: 0,
    detect: (ctx) => (ctx.pinch.released ? { ...at(ctx.pinch.at), strength: 1, confidence: 1 } : null),
  },
  {
    name: "zoom",
    debounceMs: 0,
    minConfidence: 0.5,
    detect: (ctx) =>
      ctx.twoHand.active && Math.abs(ctx.twoHand.scale - 1) > 0.004
        ? {
            x: ctx.twoHand.x,
            y: ctx.twoHand.y,
            strength: Math.min(1, Math.abs(ctx.twoHand.scale - 1) * 10),
            confidence: Math.min(...ctx.frame.hands.map((h) => h.score)),
            value: { scale: ctx.twoHand.scale },
          }
        : null,
  },
  { name: "swipe-left", debounceMs: 800, minConfidence: 0.6, detect: swipe("left") },
  { name: "swipe-right", debounceMs: 800, minConfidence: 0.6, detect: swipe("right") },
  { name: "swipe-up", debounceMs: 800, minConfidence: 0.6, detect: swipe("up") },
  { name: "swipe-down", debounceMs: 800, minConfidence: 0.6, detect: swipe("down") },
  { name: "thumbs-up", debounceMs: 2000, minConfidence: 0.7, detect: held("thumbs-up", 400) },
  { name: "palm-hold", debounceMs: 2000, minConfidence: 0.7, detect: held("open", 1000, { key: "wrist", max: 0.04 }) },
  { name: "fist", debounceMs: 1500, minConfidence: 0.7, detect: held("fist", 300) },
  { name: "point-hold", debounceMs: 1500, minConfidence: 0.7, detect: held("point", 1000, { key: "tip", max: 0.025 }) },
];

// ---- engine ------------------------------------------------------------------------------

export class GestureEngine {
  private history: Sample[] = [];
  private poseSince = 0;
  private lastPose: Pose = "other";
  private pinchOn = false;
  private pinchSince = 0;
  private grabbing = false;
  private lastPinch: Landmark | null = null;
  private lastAngle = 0;
  private lastTap = -Infinity;
  private twoHandDist: number | null = null;
  private lastFired = new Map<GestureName, number>();

  constructor(private readonly table: GestureSpec[] = gestureTable) {}

  /** Feed one frame; returns the gestures it completes. */
  push(frame: HandFrame): GestureEvent[] {
    const ctx = this.update(frame);
    const out: GestureEvent[] = [];
    for (const spec of this.table) {
      const hit = spec.detect(ctx);
      if (!hit || hit.confidence < spec.minConfidence) continue;
      const last = this.lastFired.get(spec.name) ?? -Infinity;
      if (frame.t - last < spec.debounceMs) continue;
      this.lastFired.set(spec.name, frame.t);
      out.push({ name: spec.name, ...hit });
    }
    return out;
  }

  reset(): void {
    this.history = [];
    this.pinchOn = this.grabbing = false;
    this.twoHandDist = null;
    this.lastPinch = null;
  }

  private update(frame: HandFrame): GestureContext {
    const { t } = frame;
    const primary = frame.hands[0] ?? null;
    const pose = primary ? classifyPose(primary) : "other";
    if (pose !== this.lastPose) {
      this.lastPose = pose;
      this.poseSince = t;
    }
    if (primary) {
      this.history.push({ t, pose, wrist: primary.landmarks[WRIST], tip: primary.landmarks[INDEX_TIP] });
    } else {
      this.history = [];
    }
    this.history = within(this.history, t, HISTORY_MS);

    const pinch: GestureContext["pinch"] = {
      started: false,
      ended: false,
      active: this.pinchOn,
      since: this.pinchSince,
      grabbing: this.grabbing,
      grabStarted: false,
      released: false,
      tapped: false,
      doubleTapped: false,
      at: null,
      dx: 0,
      dy: 0,
      degrees: 0,
    };

    if (primary) {
      const ratio = pinchRatio(primary);
      const p = pinchPoint(primary);
      pinch.at = p;
      if (!this.pinchOn && ratio < PINCH_ON) {
        this.pinchOn = pinch.started = true;
        this.pinchSince = t;
        this.lastPinch = p;
        this.lastAngle = handAngle(primary);
      } else if (this.pinchOn && ratio > PINCH_OFF) {
        this.pinchOn = false;
        pinch.ended = true;
      }
      if (this.pinchOn && !this.grabbing && t - this.pinchSince >= TAP_MS) {
        this.grabbing = pinch.grabStarted = true;
      }
      if (this.pinchOn && this.grabbing && this.lastPinch) {
        pinch.dx = p.x - this.lastPinch.x;
        pinch.dy = p.y - this.lastPinch.y;
        const angle = handAngle(primary);
        pinch.degrees = ((angle - this.lastAngle + 540) % 360) - 180;
        this.lastAngle = angle;
      }
      this.lastPinch = this.pinchOn ? p : null;
    } else if (this.pinchOn) {
      // Hand lost mid-pinch: treat as a release.
      this.pinchOn = false;
      pinch.ended = true;
    }

    if (pinch.ended) {
      if (this.grabbing) pinch.released = true;
      else if (t - this.pinchSince < TAP_MS) {
        pinch.tapped = true;
        pinch.doubleTapped = t - this.lastTap < DOUBLE_TAP_MS;
        this.lastTap = pinch.doubleTapped ? -Infinity : t;
      }
      this.grabbing = false;
    }
    pinch.active = this.pinchOn;
    pinch.grabbing = this.grabbing;
    pinch.since = this.pinchSince;

    // Two hands, both pinched: zoom by how far apart they are, frame to frame.
    const twoHand = { active: false, scale: 1, x: 0.5, y: 0.5 };
    if (frame.hands.length >= 2 && frame.hands.every((h) => pinchRatio(h) < PINCH_OFF)) {
      const [a, b] = frame.hands.map(pinchPoint);
      const d = dist(a, b);
      twoHand.active = true;
      twoHand.x = (a.x + b.x) / 2;
      twoHand.y = (a.y + b.y) / 2;
      if (this.twoHandDist) twoHand.scale = d / this.twoHandDist;
      this.twoHandDist = d;
    } else {
      this.twoHandDist = null;
    }

    return { t, frame, primary, pose, history: this.history, poseHeld: t - this.poseSince, pinch, twoHand };
  }
}

/**
 * Camera space to the viewport. The middle of the camera's view (MARGIN in from each edge)
 * covers the whole screen, so every corner is reachable without leaving the frame.
 */
export const VIEW_MARGIN = 0.15;
export function toViewport(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const span = 1 - 2 * VIEW_MARGIN;
  const clamp = (v: number) => Math.min(1, Math.max(0, (v - VIEW_MARGIN) / span));
  return { x: clamp(x) * width, y: clamp(y) * height };
}
