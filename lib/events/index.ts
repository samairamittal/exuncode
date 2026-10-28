import type { PlaceId } from "@/lib/case/places";
import type { Connection, FindingRecord, Pin } from "@/lib/data/types";
import type { GestureEvent, GestureName } from "@/lib/vision/gestures";

// Story events. Lens, the board and the store emit; animations and HUD listen.

export type ScanStage = "loading" | "rendering" | "ocr" | "detecting" | "done";

interface StoryEvents {
  "scan:start": { fileName: string };
  "scan:progress": { fileName: string; stage: ScanStage; percent: number };
  "finding:added": { fileName: string; finding: FindingRecord };
  "scan:complete": { fileName: string; findingCount: number };
  "pin:added": { pin: Pin };
  "connection:correct": { connection: Connection };
  "board:solved": Record<string, never>;
  "case:progress": { openedFiles: number; totalFiles: number };
  /** Someone picked a place (e.g. a tracker marker); the 3D city flies to it. */
  "place:focus": { id: PlaceId };
  /** The transition overlay has cleared after a route change. */
  "transition:revealed": { pathname: string };

  // Hands-free control (lib/voice, lib/vision)
  /** Two claps (or Shift twice). `confirmed`: tracked hands met as well. */
  "clap:double": { at: number; confirmed: boolean };
  /** Lens powers up (after a clap) or down ("close lens"). */
  "lens:boot": { reason: "clap" | "voice" };
  "lens:shutdown": Record<string, never>;
  /** LENS greets the agent (caption text; the voice is lib/voice/robot.ts). */
  "lens:greet": { text: string };
  "voice:wake": { transcript: string };
  "voice:command": { id: string; arg?: string; transcript: string };
  "voice:unknown": { transcript: string };
  /** A question for LENS (answered from the case in lib/voice/answers.ts). */
  "voice:question": { question: string; transcript: string };
  "voice:answer": { intent: string; text: string };
  "voice:sleep": Record<string, never>;
  /** Many times a second while LENS talks; `level` 0–1 for animation. */
  "voice:speaking": { level: number; text: string };
  "voice:done": { text: string };
  "music:start": { source: string };
  "music:beat": { level: number };
  "music:end": Record<string, never>;
}

/** "gesture:tap", "gesture:zoom", ... one per entry in lib/vision/gestures.ts. */
type GestureEvents = { [K in GestureName as `gesture:${K}`]: GestureEvent };

export type EventMap = StoryEvents & GestureEvents;

export type EventName = keyof EventMap;
export type Handler<K extends EventName> = (payload: EventMap[K]) => void;

export interface EventBus<M> {
  on<K extends keyof M>(type: K, handler: (payload: M[K]) => void): () => void;
  off<K extends keyof M>(type: K, handler: (payload: M[K]) => void): void;
  emit<K extends keyof M>(type: K, payload: M[K]): void;
  clear(): void;
}

export function createEventBus<M>(): EventBus<M> {
  const handlers = new Map<keyof M, Set<(payload: never) => void>>();

  const off: EventBus<M>["off"] = (type, handler) => {
    handlers.get(type)?.delete(handler as (payload: never) => void);
  };

  return {
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) handlers.set(type, (set = new Set()));
      set.add(handler as (payload: never) => void);
      return () => off(type, handler);
    },
    off,
    emit(type, payload) {
      // Copy so handlers can unsubscribe while being called.
      for (const handler of [...(handlers.get(type) ?? [])]) {
        try {
          (handler as (p: typeof payload) => void)(payload);
        } catch (error) {
          console.error(`[events] handler for "${String(type)}" threw`, error);
        }
      }
    },
    clear: () => handlers.clear(),
  };
}

export const bus = createEventBus<EventMap>();
