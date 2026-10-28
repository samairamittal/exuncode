"use client";

/* eslint-disable @next/next/no-img-element -- layers are 2x renders of the design, positioned in design px */
import { useRef, type CSSProperties } from "react";
import { home } from "@/lib/motion";
import { homeLayers } from "./layers.generated";
import { PixelateCanvas, type PixelateHandle } from "./PixelateCanvas";
import { useHomeAnimations } from "./useHomeAnimations";

const { stage, text } = homeLayers;
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

// Stage keeps the design's aspect and always shows the whole artwork: it fits the space
// below the nav and centres horizontally (the artwork's side edges are black).
const stageWidth = `min(100%, calc((100svh - var(--stage-top)) * ${stage.width} / ${stage.height}))`;
const frameStyle: CSSProperties = {
  top: "var(--stage-top)",
  width: stageWidth,
  left: `calc((100% - ${stageWidth}) / 2)`,
  aspectRatio: `${stage.width} / ${stage.height}`,
};

const textStyle: CSSProperties = {
  left: pct(text.x, stage.width),
  top: pct(text.y, stage.height),
  width: pct(text.w, stage.width),
  height: pct(text.h, stage.height),
};

const screenMaskStyle: CSSProperties = {
  maskImage: "url(/home/screen-mask.png)",
  maskSize: "100% 100%",
  WebkitMaskImage: "url(/home/screen-mask.png)",
  WebkitMaskSize: "100% 100%",
};

const fill = "absolute inset-0 size-full";

export function HomeScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cabinetRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLImageElement>(null);
  const pixelateRef = useRef<PixelateHandle>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textMainRef = useRef<HTMLImageElement>(null);
  const textRedRef = useRef<HTMLImageElement>(null);
  const textCyanRef = useRef<HTMLImageElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLImageElement>(null);
  const scanLinesRef = useRef<HTMLDivElement>(null);
  const scanRollRef = useRef<HTMLDivElement>(null);
  useHomeAnimations({
    root: rootRef,
    frame: frameRef,
    stage: stageRef,
    cabinet: cabinetRef,
    plate: plateRef,
    pixelate: pixelateRef,
    canvas: canvasRef,
    text: textRef,
    textMain: textMainRef,
    textRed: textRedRef,
    textCyan: textCyanRef,
    screen: screenRef,
    glow: glowRef,
    scanLines: scanLinesRef,
    scanRoll: scanRollRef,
  });

  return (
    <div ref={rootRef} data-anim="home" className="relative h-svh overflow-hidden bg-void">
      <h1 className="sr-only">NUXELAND</h1>

      <div ref={frameRef} data-anim="stage-frame" className="absolute z-background" style={frameStyle}>
        <div ref={stageRef} data-anim="stage" className="absolute inset-0">
          <div ref={cabinetRef} data-anim="cabinet" className="absolute inset-0">
            <img ref={plateRef} src="/home/arcade-plate.webp" alt="" className={fill} />
            <div ref={canvasRef} data-anim="pixelate" className="absolute inset-0">
              <PixelateCanvas ref={pixelateRef} src="/home/arcade-plate.webp" initialPixelSize={home.pixelFrom} className="block" />
            </div>
          </div>

          <div ref={textRef} data-anim="nuxeland" className="absolute z-content" style={textStyle}>
            <img ref={textMainRef} src="/home/nuxeland.webp" alt="" className={fill} />
            <img ref={textRedRef} src="/home/nuxeland-red.webp" alt="" className={`${fill} opacity-0 mix-blend-screen`} />
            <img ref={textCyanRef} src="/home/nuxeland-cyan.webp" alt="" className={`${fill} opacity-0 mix-blend-screen`} />
          </div>

          <div ref={screenRef} data-anim="screen" className="absolute inset-0 z-overlay">
            <img ref={glowRef} src="/home/screen-glow.png" alt="" className={`${fill} opacity-0 mix-blend-screen`} />
            <div data-anim="scanlines" className="absolute inset-0 overflow-hidden" style={screenMaskStyle}>
              <div ref={scanLinesRef} className="crt-lines absolute inset-x-0 -top-(--crt-line) bottom-0" />
              <div ref={scanRollRef} className="crt-roll absolute inset-x-0 top-0 h-1/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
