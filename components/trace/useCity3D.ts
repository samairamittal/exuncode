"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useRef, useState, type RefObject } from "react";
import { bus } from "@/lib/events";
import { city, duration, ease, home, useReducedMotion } from "@/lib/motion";
import { cityLayers } from "./city.generated";
import { cityPlaces } from "./data";

gsap.registerPlugin(useGSAP);

export interface CityRefs {
  panel: RefObject<HTMLDivElement | null>;
  stage: RefObject<HTMLDivElement | null>;
  base: RefObject<HTMLImageElement | null>;
  text: RefObject<HTMLDivElement | null>;
}

export interface CityControls {
  explore: () => void;
  turn: (direction: -1 | 1) => void;
  zoom: (direction: -1 | 1) => void;
  select: (index: number) => void;
  hover: (index: number, on: boolean) => void;
  reset: () => void;
}

interface Camera {
  rotationX: number;
  rotationY: number;
  /** Idle yaw sway, added to rotationY. */
  drift: number;
  scale: number;
  x: number;
  y: number;
  lift: number;
}

const flat: Camera = { rotationX: 0, rotationY: 0, drift: 0, scale: 1, x: 0, y: 0, lift: 0 };
/** Writes the camera onto the stage; layers read --lift, billboards read --rx / --ry. */
function applyCamera(stage: HTMLElement, cam: Camera) {
  const yaw = cam.rotationY + cam.drift;
  stage.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.scale}) rotateX(${cam.rotationX}deg) rotateY(${yaw}deg)`;
  stage.style.setProperty("--lift", String(cam.lift));
  stage.style.setProperty("--rx", String(cam.rotationX));
  stage.style.setProperty("--ry", String(yaw));
}

const clamp = (v: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, v));
const wenoti = cityPlaces.indexOf("wenoti");

/** Distance of each building from Wenoti Arcade (design px), for the power surge ripple. */
const surgeDistance = cityLayers.buildings.map((b) => {
  const w = cityLayers.buildings[wenoti];
  return Math.hypot(b.x + b.w / 2 - (w.x + w.w / 2), b.y + b.h - (w.y + w.h));
});
const surgeMax = Math.max(...surgeDistance);

/**
 * 3D city: the panel's layers (base, buildings, NUXELAND) sit in one preserve-3d stage.
 * At rest everything is flat and recomposes the design exactly; lifting pushes each layer
 * up by its depth (var(--lift) × --depth) so the city separates into a stack you can orbit.
 * - intro: swoop in tilted, buildings drop in back to front, NUXELAND flickers, settle flat
 * - flat: the city peeks into 3D under the pointer, landing flat again when it leaves
 * - drag to orbit, wheel / buttons to zoom, click a building (or a tracker marker) to fly
 *   to it, Esc or reset to land
 * - while lifted: name labels roll call, buildings bob, the camera sways, power surges ripple
 *   out from Wenoti Arcade, buildings glitch, a scan band sweeps the floor
 * Reduced motion: no intro, peek or ambient loops; moves are quick.
 */
export function useCity3D(r: CityRefs) {
  const reduced = useReducedMotion();
  const controls = useRef<CityControls | null>(null);
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useGSAP(
    (_, contextSafe) => {
      const safe = contextSafe!;
      const panel = r.panel.current!;
      const stage = r.stage.current!;
      const inners = gsap.utils.toArray<HTMLElement>('[data-anim="city-building"]', stage);
      const sprites = gsap.utils.toArray<HTMLElement>('[data-anim="city-sprite"]', stage);
      const surges = gsap.utils.toArray<HTMLElement>('[data-anim="city-surge"]', stage);
      const labels = gsap.utils.toArray<HTMLElement>('[data-anim="city-label"]', stage);
      const cam: Camera = { ...flat };
      let lifted = false;
      let picked: number | null = null;
      let hovered: number | null = null;
      let intro: gsap.core.Timeline | null = null;
      let ambient: gsap.core.Timeline | null = null;
      let glitch: gsap.core.Tween | null = null;
      let rollCall: gsap.core.Tween | null = null;

      const render = () => applyCamera(stage, cam);
      const move = (to: Partial<Camera>, seconds: number = city.liftDuration, curve: string = ease.out) =>
        gsap.to(cam, { ...to, duration: reduced ? duration.fast : seconds, ease: curve, overwrite: "auto", onUpdate: render });

      // Labels: Wenoti's stays up while lifted; others show on hover, focus or selection.
      gsap.set(labels, { opacity: 0, scale: 0.6, y: 10 });
      const showLabel = (index: number, on: boolean) =>
        gsap.to(labels[index], {
          opacity: on ? 1 : 0,
          scale: on ? 1 : 0.6,
          y: on ? 0 : 10,
          duration: reduced ? 0 : duration.fast,
          ease: on ? ease.spring : ease.out,
          overwrite: "auto",
        });
      const keepLabel = (index: number) => lifted && (index === wenoti || index === picked || index === hovered);
      const syncLabels = () => labels.forEach((_, i) => showLabel(i, keepLabel(i)));

      const glitchOne = () => {
        const sprite = sprites[gsap.utils.random(0, sprites.length - 1, 1)];
        const shift = city.glitchShift;
        gsap.to(sprite, {
          keyframes: [
            { x: -shift, opacity: 0.5 },
            { x: shift * 0.6, opacity: 1 },
            { x: -shift * 0.3, opacity: 0.7 },
            { x: 0, opacity: 1 },
          ],
          duration: 0.24,
          ease: "steps(1)",
        });
        glitch = gsap.delayedCall(gsap.utils.random(...city.glitchEvery), safe(glitchOne));
      };

      const startAmbient = () => {
        if (reduced || ambient) return;
        ambient = gsap.timeline();
        ambient.fromTo(
          stage.querySelector('[data-anim="city-sweep"]'),
          { yPercent: -100 },
          { yPercent: 900, duration: city.sweep, ease: ease.linear, repeat: -1 },
          0,
        );
        sprites.forEach((sprite) =>
          ambient!.to(
            sprite,
            { z: city.bob, duration: gsap.utils.random(...city.bobDuration), ease: ease.sine, yoyo: true, repeat: -1, delay: gsap.utils.random(0, 1) },
            0,
          ),
        );
        ambient.fromTo(
          cam,
          { drift: 0 },
          {
            keyframes: { drift: [0, city.drift, 0, -city.drift, 0], easeEach: ease.sine },
            duration: city.driftDuration * 2,
            repeat: -1,
            onUpdate: render,
          },
          0,
        );
        // Power surge: a hop that ripples outward from Wenoti Arcade.
        ambient.to(
          surges,
          {
            keyframes: { z: [0, city.surgeHeight, 0], easeEach: ease.out },
            duration: 0.5,
            stagger: (i) => (surgeDistance[i] / surgeMax) * city.surgeSpread,
            repeat: -1,
            repeatDelay: city.surgeEvery,
          },
          1,
        );
        glitch = gsap.delayedCall(gsap.utils.random(...city.glitchEvery), safe(glitchOne));
      };
      const stopAmbient = () => {
        ambient?.revert();
        ambient = null;
        glitch?.kill();
        glitch = null;
        gsap.set(sprites, { x: 0, opacity: 1 });
        cam.drift = 0;
        render();
      };

      const finishIntro = () => {
        if (!intro) return;
        intro.kill();
        intro = null;
        gsap.set(inners, { z: 0, opacity: 1 });
        gsap.set([r.base.current, r.text.current], { opacity: 1 });
      };

      const lift = () => {
        finishIntro();
        if (lifted) return;
        lifted = true;
        setActive(true);
        startAmbient();
        move({ ...city.pose, x: 0, y: 0, lift: 1 });
        // Roll call: every name pops up once, then only the kept ones stay.
        if (!reduced) {
          labels.forEach((label, i) => gsap.delayedCall(0.4 + i * city.labelStagger, () => showLabel(i, true)));
          rollCall = gsap.delayedCall(city.rollCall, syncLabels);
        } else syncLabels();
      };

      const raise = (index: number, z: number) =>
        gsap.to(inners[index], { z, duration: reduced ? 0 : duration.base, ease: ease.spring, overwrite: "auto" });

      const pick = (index: number | null) => {
        const previous = picked;
        picked = index;
        setSelected(index);
        if (previous !== null && previous !== index) raise(previous, 0);
        syncLabels();
        if (index === null) {
          move({ ...city.pose, x: 0, y: 0 }, city.flyDuration, ease.inOut);
          return;
        }
        raise(index, city.flyRise);
        // Centre the building: offset from the stage centre, scaled to the stage's size.
        const b = cityLayers.buildings[index];
        const sx = stage.offsetWidth / cityLayers.width;
        const sy = stage.offsetHeight / cityLayers.height;
        const dx = (b.x + b.w / 2 - cityLayers.width / 2) * sx;
        const dy = (b.y + b.h / 2 - cityLayers.height / 2) * sy;
        const pitch = city.pose.rotationX * 0.6;
        move(
          {
            rotationX: pitch,
            rotationY: 0,
            scale: city.flyScale,
            x: -dx * city.flyScale,
            y: -dy * city.flyScale * Math.cos((pitch * Math.PI) / 180),
            lift: 1,
          },
          city.flyDuration,
          ease.inOut,
        );
      };

      const land = () => {
        finishIntro();
        if (picked !== null) raise(picked, 0);
        picked = null;
        hovered = null;
        setSelected(null);
        lifted = false;
        setActive(false);
        rollCall?.kill();
        syncLabels();
        move(flat, city.flyDuration, ease.inOut).eventCallback("onComplete", stopAmbient);
      };

      const select = (index: number) => {
        lift();
        pick(picked === index ? null : index);
      };

      controls.current = {
        explore: safe(lift),
        turn: safe((direction: -1 | 1) => {
          lift();
          move({ rotationY: clamp(cam.rotationY + direction * city.turnStep, city.yaw) }, duration.slow);
        }),
        zoom: safe((direction: -1 | 1) => {
          lift();
          move({ scale: clamp(cam.scale + direction * city.zoomStep, city.zoom) }, duration.base);
        }),
        select: safe(select),
        hover: safe((index: number, on: boolean) => {
          hovered = on ? index : hovered === index ? null : hovered;
          if (!lifted) return;
          if (index !== picked) raise(index, on ? city.hoverRise : 0);
          showLabel(index, on || keepLabel(index));
        }),
        reset: safe(land),
      };

      // Tracker markers fly the city to their place.
      const offFocus = bus.on(
        "place:focus",
        safe(({ id }) => {
          const index = cityPlaces.indexOf(id);
          if (index === -1) return;
          const rect = panel.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > window.innerHeight) panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
          lift();
          if (picked !== index) pick(index);
        }),
      );

      // Drag to orbit (follows the pointer through quickTo); flat, the city peeks toward the pointer.
      const followX = gsap.quickTo(cam, "rotationX", { duration: city.follow, ease: ease.out, onUpdate: render });
      const followY = gsap.quickTo(cam, "rotationY", { duration: city.follow, ease: ease.out, onUpdate: render });
      const followLift = gsap.quickTo(cam, "lift", { duration: city.follow, ease: ease.out, onUpdate: render });
      let drag: { x: number; y: number; rx: number; ry: number; moved: boolean } | null = null;

      const peek = (e: PointerEvent) => {
        if (reduced || lifted || intro) return;
        const rect = panel.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        followX(-ny * city.peekTilt);
        followY(nx * city.peekTilt);
        followLift(city.peekLift);
      };
      const onLeave = safe(() => {
        if (lifted || intro || drag) return;
        move(flat, duration.slow, ease.inOut);
      });

      const onDown = safe((e: PointerEvent) => {
        if (e.button !== 0 || (e.target as Element).closest('[data-anim="city-controls"]')) return;
        drag = { x: e.clientX, y: e.clientY, rx: cam.rotationX, ry: cam.rotationY, moved: false };
      });
      const onMove = safe((e: PointerEvent) => {
        if (!drag) return peek(e);
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < city.clickSlop) return;
        if (!drag.moved) {
          drag.moved = true;
          panel.setPointerCapture(e.pointerId);
          if (!lifted) {
            lift();
            drag.rx = city.pose.rotationX;
            drag.ry = city.pose.rotationY;
          }
        }
        followX(clamp(drag.rx - dy * city.dragPitch, city.pitch));
        followY(clamp(drag.ry + dx * city.dragYaw, city.yaw));
      });
      const onUp = safe((e: PointerEvent) => {
        if (!drag) return;
        const { moved } = drag;
        drag = null;
        if (panel.hasPointerCapture(e.pointerId)) panel.releasePointerCapture(e.pointerId);
        if (moved) return;
        // A click: buildings handle their own; empty space lifts the city or backs out of a fly-in.
        if ((e.target as Element).closest('[data-anim="city-building"], [data-anim="city-controls"]')) return;
        if (!lifted) lift();
        else if (picked !== null) pick(null);
      });
      const onWheel = safe((e: WheelEvent) => {
        if (!lifted) return; // flat city scrolls the page as usual
        e.preventDefault();
        move({ scale: clamp(cam.scale - e.deltaY * city.wheelZoom, city.zoom) }, duration.fast);
      });
      const onKey = safe((e: KeyboardEvent) => {
        if (e.key === "Escape" && lifted) land();
      });

      panel.addEventListener("pointerdown", onDown);
      panel.addEventListener("pointermove", onMove);
      panel.addEventListener("pointerup", onUp);
      panel.addEventListener("pointercancel", onUp);
      panel.addEventListener("pointerleave", onLeave);
      panel.addEventListener("wheel", onWheel, { passive: false });
      panel.addEventListener("keydown", onKey);

      render();
      gsap.set(stage, { opacity: 1 });
      if (!reduced) {
        // Intro: arrive tilted and lifted, drop the buildings in, flicker NUXELAND, then land flat.
        Object.assign(cam, city.intro.from);
        render();
        gsap.set(inners, { z: city.intro.dropHeight, opacity: 0 });
        gsap.set([r.base.current, r.text.current], { opacity: 0 });
        startAmbient();
        intro = gsap.timeline({
          onComplete: () => {
            intro = null;
            if (!lifted) stopAmbient();
          },
        });
        intro
          .to(r.base.current, { opacity: 1, duration: duration.base, ease: ease.out }, 0)
          .to(cam, { ...city.pose, lift: 1, duration: city.intro.swoop, ease: "expo.out", onUpdate: render }, 0)
          .to(inners, { z: 0, opacity: 1, duration: city.intro.drop, ease: "bounce.out", stagger: city.intro.dropStagger }, 0.25)
          .add(() => showLabel(wenoti, true), "-=0.3")
          .to(r.text.current, {
            keyframes: home.flicker.map((opacity) => ({ opacity, duration: home.flickerStep })),
          })
          .add(() => showLabel(wenoti, false), `+=${city.intro.hold}`)
          .to(cam, { ...flat, duration: city.intro.settle, ease: "expo.inOut", onUpdate: render }, "<");
      }

      return () => {
        offFocus();
        panel.removeEventListener("pointerdown", onDown);
        panel.removeEventListener("pointermove", onMove);
        panel.removeEventListener("pointerup", onUp);
        panel.removeEventListener("pointercancel", onUp);
        panel.removeEventListener("pointerleave", onLeave);
        panel.removeEventListener("wheel", onWheel);
        panel.removeEventListener("keydown", onKey);
        controls.current = null;
      };
    },
    { scope: r.panel, dependencies: [reduced], revertOnUpdate: true },
  );

  return { controls, active, selected };
}
