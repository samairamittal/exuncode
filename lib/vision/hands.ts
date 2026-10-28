import type { HandLandmarker } from "@mediapipe/tasks-vision";
import type { Hand, HandFrame } from "./gestures";
import { OneEuroFilter } from "./oneEuro";

// Hand tracking with MediaPipe HandLandmarker, in the browser, on a camera stream.
//
// Privacy: the camera feeds a <video> element that is never attached to the page, and
// frames go straight to the model in memory. Nothing draws, stores or sends an image.
// The model and WASM runtime are served from /public/models, so it works offline.

const MODEL = "/models/hand_landmarker.task";
const WASM = "/models/wasm";
const FRAME_MS = 1000 / 30; // ~30 fps; slower frames are skipped, never queued
const MIN_SCORE = 0.6;

export interface HandsStats {
  fps: number;
  hands: number;
}

export interface HandsHandle {
  stop: () => void;
}

export interface StartHandsOptions {
  /** Called for every processed frame, with mirrored, smoothed landmarks. */
  onFrame: (frame: HandFrame) => void;
  onStats?: (stats: HandsStats) => void;
}

/** Loads the model and starts tracking. Throws if the camera or model is unavailable. */
export async function startHands({ onFrame, onStats }: StartHandsOptions): Promise<HandsHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user", frameRate: { ideal: 30 } },
    audio: false,
  });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  let landmarker: HandLandmarker | null = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    landmarker?.close();
    landmarker = null;
  };

  const loadModel = async () => {
    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const create = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: MIN_SCORE,
        minHandPresenceConfidence: MIN_SCORE,
        minTrackingConfidence: 0.5,
      });
    return create("GPU").catch(() => create("CPU"));
  };

  try {
    // Model and camera start together. (Chrome holds video.play() in a background tab
    // until the tab is shown.)
    [landmarker] = await Promise.all([loadModel(), video.play()]);
  } catch (error) {
    stop();
    throw error;
  }
  if (stopped) return { stop };

  // One filter per hand slot × landmark × axis.
  const filters = Array.from({ length: 2 }, () => Array.from({ length: 21 }, () => [new OneEuroFilter(), new OneEuroFilter(), new OneEuroFilter()]));
  let last = 0;
  let frames = 0;
  let windowStart = performance.now();
  let seen = 0;

  const process = (now: number) => {
    if (stopped || !landmarker) return;
    if (now - last >= FRAME_MS && video.readyState >= 2) {
      last = now;
      const result = landmarker.detectForVideo(video, now);
      const hands: Hand[] = [];
      result.landmarks.forEach((points, i) => {
        const score = result.handedness[i]?.[0]?.score ?? 0;
        if (score < MIN_SCORE || i > 1) return;
        hands.push({
          score,
          landmarks: points.map((p, j) => ({
            // Mirror x so the hand moves the way the user sees it.
            x: filters[i][j][0].filter(1 - p.x, now),
            y: filters[i][j][1].filter(p.y, now),
            z: filters[i][j][2].filter(p.z, now),
          })),
        });
      });
      if (hands.length < 2) filters[1].forEach((axes) => axes.forEach((f) => f.reset()));
      if (!hands.length) filters[0].forEach((axes) => axes.forEach((f) => f.reset()));
      seen = hands.length;
      frames++;
      onFrame({ t: now, hands });
    }
    if (now - windowStart >= 1000) {
      onStats?.({ fps: Math.round((frames * 1000) / (now - windowStart)), hands: seen });
      frames = 0;
      windowStart = now;
    }
    schedule();
  };

  // requestVideoFrameCallback runs once per new camera frame; fall back to rAF.
  const schedule = () => {
    if (stopped) return;
    if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback((now) => process(now));
    else requestAnimationFrame(process);
  };
  schedule();
  return { stop };
}
