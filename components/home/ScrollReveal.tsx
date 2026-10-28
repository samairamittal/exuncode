"use client";

/* eslint-disable @next/next/no-img-element -- fallback for no WebGL / reduced motion */
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { useRef, useState } from "react";
import { reveal, useReducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Scroll-triggered shader reveal under the home hero. The section pins for
// reveal.scrollLength viewports while scroll progress drives a WebGL transition:
// the image resolves out of large pixel blocks through a noisy dissolve that sweeps up
// the screen, its edge burning EXUN blue, with an RGB split that settles to zero.
// Reduced motion (or no WebGL): the image fades in, no shader.

const SRC = "/home/reveal.webp";
const IMG = { w: 1728, h: 1120 };

const vertex = /* glsl */ `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform vec2 uResolution;   // canvas, device px
  uniform vec2 uImage;        // image size
  uniform float uProgress;    // 0 hidden → 1 revealed
  uniform float uPixelFrom;   // device px
  uniform float uEdge;
  uniform float uZoom;
  uniform vec3 uEdgeColor;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  // Cover-fit the image into the canvas, zoomed about the centre.
  vec2 cover(vec2 uv) {
    float canvasAspect = uResolution.x / uResolution.y;
    float imageAspect = uImage.x / uImage.y;
    vec2 scale = canvasAspect > imageAspect ? vec2(1.0, imageAspect / canvasAspect) : vec2(canvasAspect / imageAspect, 1.0);
    return (uv - 0.5) * scale / uZoom + 0.5;
  }

  void main() {
    float p = uProgress;

    // Pixel blocks shrink to nothing as the reveal completes.
    float block = mix(uPixelFrom, 1.0, smoothstep(0.15, 0.95, p));
    vec2 cell = block / uResolution;
    vec2 uv = block > 1.0 ? (floor(vUv / cell) + 0.5) * cell : vUv;

    // Dissolve front: sweeps bottom → top, broken up by block-aligned noise.
    float n = noise(floor(vUv * uResolution / max(block, 6.0)) * 0.35) * 0.55 + (1.0 - vUv.y) * 0.45;
    float front = p * (1.0 + uEdge * 2.0) - uEdge;
    float shown = smoothstep(n - uEdge, n, front);
    float edge = smoothstep(n - uEdge, n - uEdge * 0.5, front) - smoothstep(n - uEdge * 0.5, n, front);

    // RGB split that closes as it resolves.
    float split = (1.0 - smoothstep(0.4, 1.0, p)) * 0.012;
    vec2 base = cover(uv);
    float r = texture2D(tMap, base + vec2(split, 0.0)).r;
    float g = texture2D(tMap, base).g;
    float b = texture2D(tMap, base - vec2(split, 0.0)).b;
    vec3 color = vec3(r, g, b) * shown + uEdgeColor * edge * 1.4;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** CSS token → linear RGB triple for the shader. */
function tokenRgb(name: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const [r, g, b] = getComputedStyle(probe).color.match(/\d+/g)!.map(Number);
  probe.remove();
  return [r / 255, g / 255, b / 255];
}

export function ScrollReveal() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLImageElement>(null);
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(true);

  useGSAP(
    () => {
      const host = hostRef.current;
      const pin = pinRef.current;
      if (!host || !pin) return;

      // Reduced motion or no WebGL: a plain fade as the section arrives.
      const fade = () =>
        gsap.fromTo(
          fallbackRef.current,
          { opacity: 0 },
          { opacity: 1, ease: "none", scrollTrigger: { trigger: pin, start: "top bottom", end: "top top", scrub: true } },
        );
      if (reduced) return void fade();

      let renderer: Renderer;
      try {
        renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: false });
      } catch {
        setWebgl(false);
        return void fade();
      }
      const { gl } = renderer;
      gl.clearColor(0, 0, 0, 1);
      gl.canvas.style.width = gl.canvas.style.height = "100%";
      gl.canvas.style.display = "block";
      host.appendChild(gl.canvas);

      const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          tMap: { value: texture },
          uResolution: { value: [1, 1] },
          uImage: { value: [IMG.w, IMG.h] },
          uProgress: { value: 0 },
          uPixelFrom: { value: reveal.pixelFrom },
          uEdge: { value: reveal.edge },
          uZoom: { value: reveal.zoomFrom },
          uEdgeColor: { value: tokenRgb("--exun-blue") },
        },
      });
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      let loaded = false;
      let current = 0;
      let target = 0;
      let frame = 0;
      const draw = () => {
        program.uniforms.uProgress.value = current;
        program.uniforms.uZoom.value = reveal.zoomFrom + (1 - reveal.zoomFrom) * current;
        renderer.render({ scene: mesh });
      };
      // Ease toward the scroll position; stop once settled so an idle page costs nothing.
      const tick = () => {
        current += (target - current) * reveal.follow;
        if (Math.abs(target - current) < 0.0005) current = target;
        draw();
        frame = current === target ? 0 : requestAnimationFrame(tick);
      };
      const kick = () => {
        if (loaded && !frame) frame = requestAnimationFrame(tick);
      };

      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        renderer.setSize(width, height);
        program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
        program.uniforms.uPixelFrom.value = reveal.pixelFrom * renderer.dpr;
        if (loaded) draw();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        texture.image = img;
        loaded = true;
        draw();
      };
      img.onerror = () => {
        setWebgl(false);
        fade();
      };
      img.src = SRC;

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          target = self.progress;
          kick();
        },
      });

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        gl.canvas.remove();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    },
    { scope: sectionRef, dependencies: [reduced], revertOnUpdate: true },
  );

  const shader = webgl && !reduced;
  return (
    <section
      ref={sectionRef}
      data-anim="home-reveal"
      aria-label="EXUN"
      className="relative bg-void"
      style={{ height: `${(reveal.scrollLength + 1) * 100}svh` }}
    >
      <div ref={pinRef} className="sticky top-0 h-svh overflow-hidden">
        <div ref={hostRef} data-anim="home-reveal-canvas" aria-hidden className={`absolute inset-0 ${shader ? "" : "hidden"}`} />
        <img
          ref={fallbackRef}
          src={SRC}
          alt="The arcade screen reading exun"
          className={`absolute inset-0 size-full object-cover ${shader ? "sr-only" : ""}`}
        />
      </div>
    </section>
  );
}
