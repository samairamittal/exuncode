"use client";

import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface PixelateHandle {
  /** Block size in CSS px; 1 or less draws the image unchanged. */
  setPixelSize: (px: number) => void;
  /** Resolves true once the texture is on the GPU, false if WebGL or the image failed. */
  whenReady: () => Promise<boolean>;
}

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
  uniform vec2 uResolution;
  uniform float uPixel;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    if (uPixel > 1.0) {
      vec2 block = uPixel / uResolution;
      uv = (floor(uv / block) + 0.5) * block;
    }
    gl_FragColor = texture2D(tMap, uv);
  }
`;

export const PixelateCanvas = forwardRef<PixelateHandle, { src: string; className?: string; initialPixelSize: number }>(
  function PixelateCanvas({ src, className, initialPixelSize }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const pixelSize = useRef(initialPixelSize);
    const draw = useRef<(() => void) | null>(null);
    const ready = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(null);
    if (!ready.current) {
      let resolve!: (ok: boolean) => void;
      const promise = new Promise<boolean>((r) => (resolve = r));
      ready.current = { promise, resolve };
    }

    useImperativeHandle(
      ref,
      () => ({
        setPixelSize(px) {
          pixelSize.current = px;
          draw.current?.();
        },
        whenReady: () => ready.current!.promise,
      }),
      [],
    );

    useEffect(() => {
      const parent = hostRef.current;
      if (!parent) return;
      // A fresh canvas per mount: a context lost in cleanup can't be reused (Strict Mode remounts).
      const canvas = document.createElement("canvas");
      canvas.className = className ?? "";
      canvas.dataset.anim = "pixelate-canvas";
      parent.appendChild(canvas);
      let disposed = false;
      const done = (ok: boolean) => {
        if (!disposed) ready.current!.resolve(ok);
      };

      let renderer: Renderer;
      try {
        renderer = new Renderer({ canvas, dpr: Math.min(window.devicePixelRatio, 2), alpha: true });
      } catch {
        done(false);
        return () => canvas.remove();
      }
      const { gl } = renderer;
      const texture = new Texture(gl, {
        generateMipmaps: false,
        minFilter: gl.LINEAR,
        magFilter: gl.NEAREST, // keep cell edges hard when scaled up
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
      });
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          tMap: { value: texture },
          uResolution: { value: [1, 1] },
          uPixel: { value: 1 },
        },
      });
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
      let loaded = false;

      draw.current = () => {
        if (!loaded) return;
        program.uniforms.uPixel.value = pixelSize.current * renderer.dpr;
        renderer.render({ scene: mesh });
      };
      const resize = () => {
        const { width, height } = parent.getBoundingClientRect();
        renderer.setSize(width, height);
        program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
        draw.current?.();
      };

      const image = new Image();
      image.src = src;
      image
        .decode()
        .then(() => {
          if (disposed) return;
          texture.image = image;
          loaded = true;
          resize();
          done(true);
        })
        .catch(() => done(false));

      const observer = new ResizeObserver(resize);
      observer.observe(parent);
      return () => {
        disposed = true;
        draw.current = null;
        observer.disconnect();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      };
    }, [src, className]);

    return <div ref={hostRef} aria-hidden className="absolute inset-0" />;
  },
);
