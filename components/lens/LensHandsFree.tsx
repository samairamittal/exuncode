"use client";

import { useEffect, useRef } from "react";
import { debrief } from "@/lib/case";
import { bus } from "@/lib/events";
import { decodeBase32 } from "@/lib/lens";
import { prefersReducedMotion } from "@/lib/motion";
import { useInvestigator } from "@/lib/store";
import { useHandsFree, type LensFocus } from "@/lib/store/handsfree";
import { clearHands, recordHands } from "@/lib/vision/clapConfirm";
import { GestureEngine, pinchRatio, toViewport, VIEW_MARGIN, type GestureEvent } from "@/lib/vision/gestures";
import { startHands, type HandsHandle } from "@/lib/vision/hands";
import { unlockOnFirstInteraction } from "@/lib/voice/audio";
import { answer } from "@/lib/voice/answers";
import { chime } from "@/lib/voice/chime";
import type { Command } from "@/lib/voice/commands";
import { startListening, type Listener } from "@/lib/voice/listen";
import { stopMusic } from "@/lib/voice/music";
import { isSpeaking, stopSpeaking } from "@/lib/voice/speak";
import { getPlace } from "@/lib/case";
import { markers } from "../trace/data";
import { Reticle } from "../handsfree/Reticle";
import { usePageTransition } from "../layout/PageTransition";
import { documentFor, pageCount } from "./documents";
import { lensFiles } from "@/lib/lens";
import { useLensSession } from "./LensSession";
import { clampDoc, focusDay, ledger, panChart, sayDay, zoomChart } from "./views";

// Hands-free control on the Lens page: voice commands, questions answered from the case,
// and hand tracking with gestures.
// (The double clap's opening, music and greeting run site-wide in HandsFree.) Everything maps onto existing Lens actions
// (LensSession) and view state (useHandsFree). The camera image is never shown: only the
// reticle (<Reticle />) marks where the finger points.

const HIDE_RETICLE_MS = 1000;
const ZOOM_STEP = 1.4;
const THINK_MS = 500;

/** Tracker state from eXunTrace, by place name, for "where is it going?". */
const placeNames = (kind: (typeof markers)[number]["kind"]) => markers.filter((m) => m.kind === kind).map((m) => getPlace(m.place).name);
const sightings = { latest: placeNames("sighting"), outages: placeNames("outage"), targets: placeNames("target") };

const regionAt = (el: Element | null): LensFocus | null =>
  el?.closest('[data-anim="lens-energy"]') ? "chart" : el?.closest('[data-anim="lens-findings"]') ? "findings" : el?.closest('[data-anim="lens-core"]') ? "document" : null;

/** Stage zoom (the Lens stage is laid out at design size and zoomed). */
const stageZoom = () => {
  const stage = document.querySelector<HTMLElement>('[data-anim="lens"]');
  return stage ? stage.getBoundingClientRect().width / stage.offsetWidth || 1 : 1;
};

/** Screen x → chart day index, from the plot rect EnergyGraph marks. */
function dayAt(clientX: number): number | null {
  const plot = document.querySelector('[data-chart-plot]');
  if (!plot) return null;
  const r = plot.getBoundingClientRect();
  const { start, end } = useHandsFree.getState().chart;
  return start + ((clientX - r.left) / r.width) * (end - start);
}

export function LensHandsFree() {
  const session = useLensSession();
  const navigate = usePageTransition();
  const codename = useInvestigator((s) => s.profile.codename);
  const latest = useRef({ session, navigate, codename });
  useEffect(() => {
    latest.current = { session, navigate, codename };
  });

  useEffect(() => {
    const store = useHandsFree.getState;
    const set = useHandsFree.setState;
    const say = (line: string) => latest.current.session.say(line);
    const cleanups: (() => void)[] = [];

    // ---- shared actions (voice and gestures) ----

    const findingsList = () => document.querySelector<HTMLElement>('[data-anim="lens-findings"] ul');

    const pin = () => {
      const { findings } = latest.current.session;
      const id = store().focusedFinding;
      const finding = findings.find((f) => f.id === id) ?? findings[0];
      if (!finding) return say("Nothing to pin yet, agent.");
      const { pins, addPin } = useInvestigator.getState();
      if (pins.some((p) => p.refId === finding.id)) return say("That's already on the board.");
      void addPin({ source: "lens", kind: finding.type === "code-change" ? "code" : "finding", refId: finding.id, title: finding.title, detail: finding.detail });
      say("Pinned to the board.");
    };

    const zoom = (ratio: number, target = store().focus ?? "document", clientX?: number) => {
      if (target === "chart") {
        const centre = clientX !== undefined ? dayAt(clientX) : null;
        store().setChart((v) => zoomChart(v, ratio, centre ?? undefined));
      } else store().setDoc((d) => clampDoc({ ...d, scale: d.scale * ratio }));
    };

    /** Page flip if the document has more pages that way, otherwise the next/previous file. */
    const flip = (direction: 1 | -1, filesToo: boolean) => {
      const doc = documentFor(latest.current.session.selectedId);
      const page = store().doc.page + direction;
      if (page >= 0 && page < pageCount(doc)) {
        store().setDoc((d) => ({ ...d, page }));
        return true;
      }
      if (filesToo) {
        store().setDoc((d) => ({ ...d, page: 0 }));
        latest.current.session.step(direction);
        return true;
      }
      return false;
    };

    const quiet = () => {
      stopSpeaking();
      stopMusic();
    };

    const summary = () => {
      const { findings, analysedCount } = latest.current.session;
      if (!findings.length) return "Nothing yet, agent. Give me a file to scan.";
      const critical = findings.filter((f) => f.severity === "critical").map((f) => f.title);
      return `${findings.length} findings from ${analysedCount} ${analysedCount === 1 ? "file" : "files"}.${critical.length ? ` Critical: ${critical.slice(0, 3).join(". ")}.` : ""}`;
    };

    const sleep = () => {
      set({ listening: false, power: "sleep", awake: false });
      quiet();
      say("Going to sleep, agent.");
      bus.emit("voice:sleep", {});
      bus.emit("lens:shutdown", {});
    };

    // ---- voice commands ----

    const run = (command: Command) => {
      const { session: s, navigate } = latest.current;
      set({ lastCommand: command.arg ? `${command.id} (${command.arg})` : command.id });
      switch (command.id) {
        case "navigate":
          if (navigate && command.arg) navigate(command.arg);
          return;
        case "scan-file":
        case "read-file":
          if (command.arg) s.select(command.arg);
          return;
        case "decode": {
          set({ focusedFinding: "machine-id" });
          if (s.statusOf("debrief") !== "done") return s.select("debrief");
          return say(`Machine ID decoded. It reads ${decodeBase32(debrief.machineId)}.`);
        }
        case "show-energy":
          set({ focus: "chart" });
          document.querySelector('[data-anim="lens-energy"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
          return say("The energy graph, agent.");
        case "show-spike": {
          const day = ledger.findIndex((r) => r.spike);
          set({ focus: "chart", chartPoint: day, chart: focusDay(day) });
          return say(sayDay(day));
        }
        case "zoom-in":
          return zoom(ZOOM_STEP);
        case "zoom-out":
          return zoom(1 / ZOOM_STEP);
        case "reset-zoom":
          return store().resetViews();
        case "next-file":
          return s.step(1);
        case "previous-file":
          return s.step(-1);
        case "next-page":
          return void (flip(1, false) || say("That's the last page."));
        case "previous-page":
          return void (flip(-1, false) || say("That's the first page."));
        case "summarise":
          return say(summary());
        case "pin":
          return pin();
        case "stop":
          return quiet();
        case "sleep":
          return sleep();
      }
    };

    // ---- questions ----

    let followUp = "";
    const ask = (question: string) => {
      const { session: s } = latest.current;
      const { profile: p } = useInvestigator.getState();
      const reply = answer(question, {
        found: new Set(s.findings.map((f) => f.id)),
        analysed: lensFiles.filter((f) => s.statusOf(f.id) === "done").map((f) => f.id),
        codename: p.codename,
        agentNumber: p.agentNumber,
        now: new Date(),
        sightings,
      });
      set({ lastCommand: `answer: ${reply.intent}`, thinking: true });
      const done = setTimeout(() => set({ thinking: false }), THINK_MS);
      cleanups.push(() => clearTimeout(done));
      if (reply.show?.chartDay !== undefined) set({ focus: "chart", chartPoint: reply.show.chartDay, chart: focusDay(reply.show.chartDay) });
      if (reply.show?.finding) set({ focusedFinding: reply.show.finding });
      bus.emit("voice:answer", { intent: reply.intent, text: reply.text });
      followUp = reply.text;
      say(reply.text);
    };
    // After an answer, listen for a follow-up without the wake word.
    cleanups.push(
      bus.on("voice:done", ({ text }) => {
        if (text !== followUp) return;
        followUp = "";
        listener?.openWindow();
      }),
    );

    let listener: Listener | null = null;
    const listen = (on: boolean) => {
      if (on && !listener) {
        listener = startListening({
          onCommand: run,
          onQuestion: ask,
          onWake: chime,
          onState: (speech, detail) => {
            set({ speech });
            if (speech === "unsupported") store().note("Speech recognition not supported here (use Chrome or Edge)");
            if (speech === "blocked") {
              store().note(`Speech recognition blocked (${detail}); retrying on first interaction`);
              cleanups.push(unlockOnFirstInteraction(() => listener?.retry()));
            }
            if (speech === "error") store().note(`Speech recognition error: ${detail}`);
          },
          onTranscript: (lastTranscript) => set({ lastTranscript }),
          onWakeChange: (awake) => set({ awake }),
          isSpeaking,
        });
      } else if (!on && listener) {
        listener.stop();
        listener = null;
        set({ awake: false });
      }
    };
    listen(store().listening);
    cleanups.push(useHandsFree.subscribe((s, prev) => s.listening !== prev.listening && listen(s.listening)));
    cleanups.push(() => listen(false));

    // A double clap (handled site-wide in HandsFree) re-opens Lens: music, boot, greeting.

    // ---- hands ----

    const engine = new GestureEngine();
    let hands: HandsHandle | null = null;
    let disposed = false;
    let lastHand = 0;
    let hovered: Element | null = null;
    let dragTarget: LensFocus | null = null;
    let tapUntil = 0;
    let grabbing = false;

    /** Synthetic pointer events, so hover states (chart tooltips, finding highlights) follow the reticle. */
    const hover = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const init = { bubbles: true, clientX: x, clientY: y, pointerType: "pen" as const, isPrimary: false };
      if (el !== hovered) {
        hovered?.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: el }));
        el?.dispatchEvent(new PointerEvent("pointerover", { ...init, relatedTarget: hovered }));
        hovered = el;
      }
      el?.dispatchEvent(new PointerEvent("pointermove", init));
    };

    const onGesture = (g: GestureEvent) => {
      bus.emit(`gesture:${g.name}`, g);
      if (g.name !== "drag" && g.name !== "point" && g.name !== "rotate" && g.name !== "zoom")
        set({ gesture: { name: g.name, confidence: g.confidence, at: performance.now() } });
      const p = toViewport(g.x, g.y, window.innerWidth, window.innerHeight);
      const el = document.elementFromPoint(p.x, p.y);
      const pxPerUnit = window.innerWidth / (1 - 2 * VIEW_MARGIN);
      switch (g.name) {
        case "tap": {
          tapUntil = performance.now() + 300;
          const target = el?.closest<HTMLElement>("button, a, [role=button], [tabindex]:not([tabindex='-1'])");
          target?.click();
          return;
        }
        case "double-tap":
          if (!el?.closest("button, a, [role=button]")) store().resetViews();
          return;
        case "grab":
          grabbing = true;
          dragTarget = regionAt(el);
          if (dragTarget) set({ focus: dragTarget });
          return;
        case "release":
          grabbing = false;
          dragTarget = null;
          return;
        case "drag": {
          const dx = (g.value?.dx ?? 0) * pxPerUnit;
          const dy = (g.value?.dy ?? 0) * pxPerUnit;
          if (dragTarget === "document") {
            const z = stageZoom();
            store().setDoc((d) => clampDoc({ ...d, x: d.x + dx / z, y: d.y + dy / z }));
          } else if (dragTarget === "chart") {
            const plot = document.querySelector("[data-chart-plot]")?.getBoundingClientRect();
            const { start, end } = store().chart;
            if (plot) store().setChart((v) => panChart(v, (-dx / plot.width) * (end - start)));
          }
          return;
        }
        case "rotate":
          if (dragTarget === "document") store().setDoc((d) => clampDoc({ ...d, rotateY: d.rotateY + (g.value?.degrees ?? 0) * 1.5 }));
          return;
        case "zoom": {
          const target = regionAt(el) ?? store().focus ?? "document";
          set({ focus: target });
          return zoom(g.value?.scale ?? 1, target, p.x);
        }
        case "swipe-left":
        case "swipe-right":
          flip(g.name === "swipe-left" ? 1 : -1, true);
          return;
        case "swipe-up":
        case "swipe-down": {
          const dir = g.name === "swipe-up" ? 1 : -1;
          if (regionAt(el) === "chart" || store().focus === "chart") {
            const point = Math.min(ledger.length - 1, Math.max(0, (store().chartPoint ?? 0) + dir));
            set({ chartPoint: point });
          } else findingsList()?.scrollBy({ top: dir * 160, behavior: prefersReducedMotion() ? "auto" : "smooth" });
          return;
        }
        case "thumbs-up":
          return pin();
        case "palm-hold":
          quiet();
          set({ focus: null, awake: false });
          return;
        case "fist":
          store().resetViews();
          return;
        case "point-hold": {
          const point = store().chartPoint;
          if (point !== null && regionAt(el) === "chart") say(sayDay(point));
          return;
        }
      }
    };

    set({ camera: "starting" });
    if (document.visibilityState === "hidden") store().note("Tab hidden: the camera starts when it's shown");
    startHands({
      onFrame: (frame) => {
        recordHands(frame);
        const now = performance.now();
        const primary = frame.hands[0];
        set({ frame, hands: frame.hands.length });
        if (primary) {
          lastHand = now;
          const tip = primary.landmarks[8];
          const p = toViewport(tip.x, tip.y, window.innerWidth, window.innerHeight);
          const mode = now < tapUntil ? "tap" : grabbing ? "grab" : pinchRatio(primary) < 0.3 ? "pinch" : "point";
          set({ reticle: { x: p.x, y: p.y, visible: true, mode } });
          hover(p.x, p.y);
        }
        engine.push(frame).forEach(onGesture);
      },
      onStats: ({ fps }) => set({ handsFps: fps }),
    })
      .then((handle) => {
        if (disposed) return handle.stop();
        hands = handle;
        set({ camera: "on" });
      })
      .catch((error: Error) => {
        set({ camera: error.name === "NotAllowedError" ? "blocked" : "unavailable" });
        store().note(`Hand tracking unavailable: ${error.message}`);
      });

    // Hide the reticle a second after the hand leaves.
    const hideTimer = setInterval(() => {
      if (performance.now() - lastHand > HIDE_RETICLE_MS && store().reticle.visible) {
        set({ reticle: { ...store().reticle, visible: false }, hands: 0 });
        hovered?.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "pen" }));
        hovered = null;
      }
    }, 250);

    return () => {
      disposed = true;
      clearInterval(hideTimer);
      hands?.stop();
      clearHands();
      engine.reset();
      cleanups.forEach((c) => c());
      // The opening music is site-wide (HandsFree): leaving or remounting Lens never stops it.
      stopSpeaking();
      set({ camera: "off", hands: 0, frame: null, reticle: { ...store().reticle, visible: false }, thinking: false });
    };
  }, []);

  return <Reticle />;
}
