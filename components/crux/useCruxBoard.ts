"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useCallback, useRef, type RefObject } from "react";
import { bus } from "@/lib/events";
import { crux, duration, ease, home, useReducedMotion } from "@/lib/motion";
import { isTransitioning } from "@/lib/motion/transition";
import { cruxLayers } from "./crux.generated";

gsap.registerPlugin(useGSAP);

type Point = readonly [number, number];
export type CardId = (typeof cruxLayers.cards)[number]["id"];
type StringId = (typeof cruxLayers.strings)[number]["id"];

/**
 * SVG path of a string (cubic segments: start, then 3 points each) that sags `sag` board px
 * away from its chord, toward the floor. The two ends stay on their pins.
 */
export function stringPath(d: readonly Point[], sag: number): string {
  const a = d[0];
  const b = d[d.length - 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const flip = b[0] - a[0] < 0 ? -1 : 1; // normal points down the screen
  const nx = (-(b[1] - a[1]) / len) * flip;
  const ny = ((b[0] - a[0]) / len) * flip;
  const at = (p: Point, i: number) => {
    const k = i === d.length - 1 ? 0 : sag;
    return `${+(p[0] + nx * k).toFixed(1)} ${+(p[1] + ny * k).toFixed(1)}`;
  };
  return `M${a[0]} ${a[1]}C${d
    .slice(1)
    .map((p, i) => at(p, i + 1))
    .join(" ")}`;
}

interface StringState {
  draw: number;
  sag: number;
}

/** Writes a string's shape and how much of it is drawn (pathLength is 1). */
function drawString(el: SVGPathElement, d: readonly Point[], s: StringState) {
  el.setAttribute("d", stringPath(d, s.sag));
  el.style.strokeDasharray = "1 1";
  el.style.strokeDashoffset = String(1 - s.draw);
}

/**
 * eXunCrux evidence board.
 * - intro: cards fall onto the board in date order; each gets pinned (pin drops, presses in,
 *   rings out, the card swings on it). Then the strings run out from the pins with slack and
 *   pull taut, the four to NUXELAND last, and NUXELAND flickers on.
 * - hover/focus a card: it lifts off the board and its strings twang. Click: it swings too.
 * Reduced motion: the board appears as drawn; no intro or twangs.
 */
export function useCruxBoard(board: RefObject<HTMLDivElement | null>) {
  const reduced = useReducedMotion();
  const tugRef = useRef<(id: CardId, hover?: boolean) => void>(() => {});

  useGSAP(
    (_, contextSafe) => {
      const root = board.current;
      if (!root || !contextSafe) return;
      const one = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
      const cardEl = (id: CardId) => one<HTMLElement>(`[data-card="${id}"]`);
      const pinEl = (id: CardId) => one<HTMLElement>(`[data-anim="crux-pin"][data-pin="${id}"]`);
      const glowEl = (id: CardId) => one<HTMLElement>(`[data-anim="crux-glow"][data-pin="${id}"]`);
      const shadowOf = (card: HTMLElement) => card.querySelector<HTMLElement>('[data-anim="crux-shadow"]')!;

      const strings = new Map(
        cruxLayers.strings.map((s) => [
          s.id as StringId,
          { ...s, el: one<SVGPathElement>(`[data-string="${s.id}"]`), state: { draw: 1, sag: 0 } as StringState },
        ]),
      );
      const render = (id: StringId) => {
        const s = strings.get(id)!;
        drawString(s.el, s.d, s.state);
      };

      gsap.set(root, { opacity: 1 });
      if (reduced) {
        // Strings are drawn by hand, not by GSAP, so a reverted intro doesn't restore them.
        strings.forEach((_, id) => render(id));
        return;
      }

      let ready = false;
      const bump = (id: string) => {
        if (id === "nuxeland") return;
        gsap.fromTo(pinEl(id as CardId), { scale: crux.bump }, { scale: 1, duration: crux.pinSettle, ease: "back.out(3)" });
      };
      const twang = (id: StringId, amount: number) => {
        const s = strings.get(id)!;
        gsap.fromTo(
          s.state,
          { sag: amount },
          { sag: 0, duration: crux.twangDuration, ease: "elastic.out(1, 0.3)", overwrite: "auto", onUpdate: () => render(id) },
        );
      };

      tugRef.current = contextSafe((id: CardId, hover?: boolean) => {
        if (!ready) return;
        const card = cardEl(id);
        if (hover === false) {
          gsap.to(card, { scale: 1, duration: duration.base, ease: ease.out });
          gsap.to(shadowOf(card), { opacity: 0, x: 0, y: 0, duration: duration.base, ease: ease.out });
          return;
        }
        if (hover) {
          gsap.to(card, { scale: crux.hoverScale, duration: duration.base, ease: ease.out });
          gsap.to(shadowOf(card), { opacity: crux.shadow * 0.6, x: 8, y: 12, duration: duration.base, ease: ease.out });
        } else {
          gsap.to(card, { keyframes: crux.swing.map((rotation) => ({ rotation, duration: crux.swingStep, ease: ease.sine })) });
          bump(id);
        }
        strings.forEach((s, sid) => {
          if (s.from === id || s.to === id) twang(sid, hover ? crux.twang : crux.twang * 1.6);
        });
      }) as (id: CardId, hover?: boolean) => void;

      // ---- intro ----
      const cards = crux.cardOrder.map((id) => ({ id, card: cardEl(id), pin: pinEl(id), glow: glowEl(id) }));
      gsap.set(
        cards.map((c) => c.card),
        { opacity: 0 },
      );
      gsap.set(
        cards.flatMap((c) => [c.pin, c.glow]),
        { opacity: 0 },
      );
      strings.forEach((s, id) => {
        s.state.draw = 0;
        render(id);
      });

      const tl = gsap.timeline({ paused: true, onComplete: () => void (ready = true) });
      tl.from(one('[data-anim="crux-board"]'), { opacity: 0, duration: duration.fade, ease: ease.out }, 0);
      cards.forEach(({ id, card, pin, glow }, i) => {
        const t = 0.3 + i * crux.cardGap;
        const ring = pin.querySelector('[data-anim="crux-ring"]');
        tl.fromTo(
          card,
          { ...crux.cardFrom, opacity: 0 },
          { yPercent: 0, scale: 1, rotation: 0, opacity: 1, duration: crux.cardDrop, ease: "power3.in" },
          t,
        )
          .fromTo(
            shadowOf(card),
            { opacity: crux.shadow, x: 18, y: 26 },
            { opacity: 0, x: 0, y: 0, duration: crux.cardDrop, ease: "power3.in" },
            t,
          )
          .fromTo(
            pin,
            { ...crux.pinFrom, opacity: 0 },
            { yPercent: 0, scale: crux.pinPress, opacity: 1, duration: crux.pinDrop, ease: "power2.in" },
            t + crux.cardDrop,
          )
          .to(pin, { scale: 1, duration: crux.pinSettle, ease: "back.out(3)" })
          .fromTo(ring, { scale: 1, opacity: 0.9 }, { scale: crux.ringScale, opacity: 0, duration: crux.ring, ease: ease.out }, "<")
          .fromTo(glow, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: crux.ring, ease: ease.out }, "<")
          .to(card, { keyframes: crux.swing.map((rotation) => ({ rotation, duration: crux.swingStep, ease: ease.sine })) }, "<");
        tl.addLabel(`pinned-${id}`);
      });

      const tie = 0.3 + crux.cardOrder.length * crux.cardGap + crux.cardDrop;
      crux.stringOrder.forEach((id, i) => {
        const s = strings.get(id)!;
        const t = tie + i * crux.stringGap;
        tl.fromTo(
          s.state,
          { draw: 0 },
          { draw: 1, duration: crux.stringDraw, ease: ease.inOut, onUpdate: () => render(id) },
          t,
        )
          .fromTo(
            s.state,
            { sag: crux.slack },
            { sag: 0, duration: crux.taut, ease: "elastic.out(1, 0.4)", immediateRender: false, onUpdate: () => render(id) },
            t,
          )
          .add(() => bump(s.to), t + crux.stringDraw);
      });
      tl.to(
        one('[data-anim="crux-text"]'),
        { keyframes: home.flicker.map((opacity) => ({ opacity, duration: home.flickerStep })) },
        tie + (crux.stringOrder.length - 1) * crux.stringGap + crux.stringDraw,
      );

      // Wait for the page transition to clear, so the intro isn't played under it.
      let off: (() => void) | undefined;
      if (isTransitioning()) {
        off = bus.on(
          "transition:revealed",
          contextSafe(() => {
            off?.();
            tl.play();
          }) as () => void,
        );
      } else {
        tl.play();
      }
      return () => off?.();
    },
    { scope: board, dependencies: [reduced], revertOnUpdate: true },
  );

  const tug = useCallback((id: CardId, hover?: boolean) => tugRef.current(id, hover), []);
  return { tug };
}
