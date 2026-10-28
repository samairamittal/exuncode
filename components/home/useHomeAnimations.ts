"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import type { RefObject } from "react";
import { bus } from "@/lib/events";
import { duration, ease, home, useReducedMotion } from "@/lib/motion";
import { isReturningHome, registerLeave } from "@/lib/motion/transition";
import { homeLayers } from "./layers.generated";
import type { PixelateHandle } from "./PixelateCanvas";

gsap.registerPlugin(useGSAP);

export interface HomeRefs {
  root: RefObject<HTMLDivElement | null>;
  frame: RefObject<HTMLDivElement | null>;
  stage: RefObject<HTMLDivElement | null>;
  cabinet: RefObject<HTMLDivElement | null>;
  plate: RefObject<HTMLImageElement | null>;
  pixelate: RefObject<PixelateHandle | null>;
  canvas: RefObject<HTMLDivElement | null>;
  text: RefObject<HTMLDivElement | null>;
  textMain: RefObject<HTMLImageElement | null>;
  textRed: RefObject<HTMLImageElement | null>;
  textCyan: RefObject<HTMLImageElement | null>;
  screen: RefObject<HTMLDivElement | null>;
  glow: RefObject<HTMLImageElement | null>;
  scanLines: RefObject<HTMLDivElement | null>;
  scanRoll: RefObject<HTMLDivElement | null>;
}

/** Transform that scales the stage so the CRT screen covers the viewport. */
function screenZoom(frame: HTMLElement) {
  const rect = frame.getBoundingClientRect();
  const s = rect.width / homeLayers.stage.width;
  const { x, y, w, h } = homeLayers.screen;
  const scale = Math.max(window.innerWidth / (w * s), window.innerHeight / (h * s)) * 1.08;
  return {
    transformOrigin: "0 0",
    scale,
    x: window.innerWidth / 2 - rect.left - scale * (x + w / 2) * s,
    y: window.innerHeight / 2 - rect.top - scale * (y + h / 2) * s,
  };
}

/**
 * Home animations:
 * 1. intro: cabinet pixelates 60px → 1px (WebGL), then NUXELAND flickers in
 * 2. loops: screen glow pulse, rolling scanlines, RGB-split glitch every 4–6s
 * 3. mouse parallax on cabinet / text / screen layers (gsap.quickTo)
 * 5. leave: zoom into the screen; returning home: start zoomed, zoom back out
 * Reduced motion: simple fades, no loops or parallax.
 */
export function useHomeAnimations(r: HomeRefs) {
  const reduced = useReducedMotion();

  useGSAP(
    (_, contextSafe) => {
      const safe = contextSafe!;
      const el = {
        stage: r.stage.current!,
        frame: r.frame.current!,
        cabinet: r.cabinet.current!,
        plate: r.plate.current!,
        canvas: r.canvas.current!,
        text: r.text.current!,
        textMain: r.textMain.current!,
        textRed: r.textRed.current!,
        textCyan: r.textCyan.current!,
        screen: r.screen.current!,
        glow: r.glow.current!,
        scanLines: r.scanLines.current!,
        scanRoll: r.scanRoll.current!,
      };

      // Dev-only: /?still renders the resting frame, for comparing against the design.
      if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("still")) {
        gsap.set(el.canvas, { opacity: 0 });
        gsap.set(el.scanLines.parentElement, { opacity: 0 });
        return;
      }

      if (reduced) {
        gsap.set(el.canvas, { opacity: 0 });
        gsap.fromTo([el.plate, el.text], { opacity: 0 }, { opacity: 1, duration: duration.fade, ease: ease.inOut });
        return;
      }

      const startLoops = safe(() => {
        gsap.fromTo(
          el.glow,
          { opacity: 0 },
          { opacity: home.glowPeak, duration: home.glowDuration, ease: ease.sine, yoyo: true, repeat: -1 },
        );
        const line = parseFloat(getComputedStyle(el.scanLines).getPropertyValue("--crt-line")) || 0;
        gsap.fromTo(el.scanLines, { y: 0 }, { y: line, duration: home.scanDriftDuration, ease: ease.linear, repeat: -1 });
        gsap.fromTo(
          el.scanRoll,
          { yPercent: -100 },
          { yPercent: 400, duration: home.rollDuration, ease: ease.linear, repeat: -1 },
        );
        scheduleGlitch();
      });

      const glitch = safe(() => {
        const shift = home.glitchShift;
        const step = { duration: 0.05, ease: "steps(1)" };
        gsap
          .timeline({ onComplete: scheduleGlitch })
          .set([el.textRed, el.textCyan], { opacity: 0.9 })
          .to(el.textRed, { x: -shift, ...step })
          .to(el.textCyan, { x: shift, ...step }, "<")
          .to(el.textMain, { x: 3, ...step }, "<")
          .to(el.textRed, { x: shift * 0.4, y: 2, ...step })
          .to(el.textCyan, { x: -shift * 0.5, y: -2, ...step }, "<")
          .to(el.textMain, { x: -2, ...step }, "<")
          .to(el.textRed, { x: -shift * 0.7, y: 0, ...step })
          .to(el.textCyan, { x: shift * 0.3, y: 0, ...step }, "<")
          .to(el.textMain, { x: 0, ...step }, "<")
          .set([el.textRed, el.textCyan], { opacity: 0, x: 0, y: 0 }, "+=0.06");
      });

      const scheduleGlitch = safe(() => {
        gsap.delayedCall(gsap.utils.random(home.glitchEvery[0], home.glitchEvery[1]), glitch);
      });

      // Parallax
      const layers = [
        { node: el.cabinet, depth: home.parallaxDepth.cabinet },
        { node: el.screen, depth: home.parallaxDepth.screen },
        { node: el.text, depth: home.parallaxDepth.text },
      ].map(({ node, depth }) => ({
        depth,
        x: gsap.quickTo(node, "x", { duration: home.parallaxDuration, ease: ease.out }),
        y: gsap.quickTo(node, "y", { duration: home.parallaxDuration, ease: ease.out }),
      }));
      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        for (const layer of layers) {
          layer.x(-nx * home.parallaxPx * layer.depth);
          layer.y(-ny * home.parallaxPx * layer.depth);
        }
      };
      window.addEventListener("pointermove", onPointerMove);

      // Leave: zoom into the screen.
      const unregisterLeave = registerLeave(
        safe(
          () =>
            new Promise<void>((resolve) => {
              gsap.killTweensOf([el.textRed, el.textCyan, el.textMain]);
              gsap.to(el.stage, { ...screenZoom(el.frame), duration: home.zoomDuration, ease: "power2.in", onComplete: resolve });
            }),
        ) as (to: string) => Promise<void>,
      );

      let offRevealed: (() => void) | undefined;
      if (isReturningHome()) {
        // Arrive zoomed in under the overlay, then zoom out once it clears.
        gsap.set(el.canvas, { opacity: 0 });
        gsap.set(el.stage, screenZoom(el.frame));
        offRevealed = bus.on(
          "transition:revealed",
          safe(() => {
            gsap.to(el.stage, {
              x: 0,
              y: 0,
              scale: 1,
              duration: home.zoomDuration,
              ease: "power2.out",
              onComplete: startLoops,
            });
          }),
        );
      } else {
        // Intro: pixelate in, then flicker NUXELAND.
        gsap.set([el.plate, el.text], { opacity: 0 });
        const pixel = { size: home.pixelFrom };
        r.pixelate.current?.setPixelSize(pixel.size);
        void (r.pixelate.current?.whenReady() ?? Promise.resolve(false)).then(
          safe((ok: boolean) => {
            const tl = gsap.timeline({ onComplete: startLoops });
            if (ok) {
              tl.to(pixel, {
                size: 1,
                duration: home.pixelDuration,
                ease: ease.inOut,
                onUpdate: () => r.pixelate.current?.setPixelSize(Math.max(1, Math.round(pixel.size))),
              })
                .set(el.plate, { opacity: 1 })
                .set(el.canvas, { opacity: 0 });
            } else {
              tl.set(el.canvas, { opacity: 0 }).to(el.plate, { opacity: 1, duration: duration.fade });
            }
            tl.to(el.text, {
              keyframes: home.flicker.map((opacity) => ({ opacity, duration: home.flickerStep, ease: "steps(1)" })),
            });
          }) as (ok: boolean) => void,
        );
      }

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        unregisterLeave();
        offRevealed?.();
      };
    },
    { scope: r.root, dependencies: [reduced], revertOnUpdate: true },
  );
}
