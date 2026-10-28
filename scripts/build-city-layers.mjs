// Splits the isometric nuxEland panel (public/trace/city.webp, from build-trace-assets.mjs)
// into layers for the 3D city: a base (floor, block and roads), NUXELAND, and one sprite
// per building. Stacked flat, the layers recompose the original pixel for pixel.
// Writes public/trace/city/* and components/trace/city.generated.ts.
// Run: node scripts/build-city-layers.mjs   (after build-trace-assets.mjs)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "trace", "city");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const src = await loadImage(join(root, "public", "trace", "city.webp"));
const W = src.width;
const H = src.height;
const ctx = createCanvas(W, H).getContext("2d");
ctx.drawImage(src, 0, 0);
const px = ctx.getImageData(0, 0, W, H).data;

// Tuned on the mockup.
const INK = 110; // brighter than this (any channel) is artwork, not floor or grid
const EDGE = 45; // antialiased artwork edges are brighter than this
const LINE_CUT = 4; // opening radius that removes the road edge lines
const GROW = 8; // regrow steps through artwork, restores outlines and antialiasing
const TEXT_CUT = 3; // NUXELAND strokes survive this opening; white speckles don't
const CLOSE = 2; // fills specks inside a building that match the road colour
const MIN_AREA = 300; // smaller blobs stay in the base
const FLOOR = [23, 23, 23]; // fill for the base where artwork was lifted out

const N = W * H;
// Roads are one flat colour (#6478ff); buildings use nearby blues but never exactly it.
const isRoad = (i) => Math.abs(px[i * 4] - 100) <= 6 && Math.abs(px[i * 4 + 1] - 120) <= 6 && px[i * 4 + 2] >= 248;
const isWhite = (i) => px[i * 4] > 200 && px[i * 4 + 1] > 200 && px[i * 4 + 2] > 200;

const ink = new Uint8Array(N);
for (let i = 0; i < N; i++) ink[i] = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) > INK && !isRoad(i) ? 1 : 0;

function morph(mask, r, dilate) {
  // Separable square kernel.
  const tmp = new Uint8Array(N);
  const out = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(W - 1, Math.max(0, x + k));
        v = dilate ? v | mask[y * W + xx] : v & mask[y * W + xx];
      }
      tmp[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(H - 1, Math.max(0, y + k));
        v = dilate ? v | tmp[yy * W + x] : v & tmp[yy * W + x];
      }
      out[y * W + x] = v;
    }
  return out;
}

function components(mask) {
  // 8-neighbour connected blobs, as pixel index lists.
  const seen = new Uint8Array(N);
  const blobs = [];
  for (let s = 0; s < N; s++) {
    if (!mask[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    const pixels = [];
    while (stack.length) {
      const i = stack.pop();
      pixels.push(i);
      const x = i % W;
      const y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
    }
    blobs.push(pixels);
  }
  return blobs;
}

function opening(mask, r) {
  return morph(morph(mask, r, false), r, true);
}

function cores(mask) {
  const out = new Uint8Array(N);
  for (const blob of components(mask)) if (blob.length >= MIN_AREA) for (const i of blob) out[i] = 1;
  return out;
}

// Regrow through allowed pixels (artwork and its antialiased edge).
function regrow(seed, allowed) {
  let grown = seed;
  for (let step = 0; step < GROW; step++) {
    const next = morph(grown, 1, true);
    for (let i = 0; i < N; i++) next[i] &= allowed[i];
    grown = next;
  }
  return grown;
}

const edge = (i) => Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) > EDGE;
const grey = (i) => Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) - Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 40;

// NUXELAND first: thick white strokes.
const white = new Uint8Array(N);
const greyEdge = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  white[i] = isWhite(i) ? 1 : 0;
  greyEdge[i] = edge(i) && grey(i) ? 1 : 0;
}
const textMask = regrow(cores(opening(white, TEXT_CUT)), greyEdge);

// Buildings: artwork minus roads and text, opened to drop the road edge lines.
const art = new Uint8Array(N);
const allowed = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  art[i] = ink[i] && !textMask[i] ? 1 : 0;
  allowed[i] = edge(i) && !isRoad(i) && !textMask[i] ? 1 : 0;
}
const grown = regrow(cores(opening(art, LINE_CUT)), allowed);
// Close the masks so road-coloured specks inside buildings come along too.
const closed = morph(morph(grown, CLOSE, true), CLOSE, false);
for (let i = 0; i < N; i++) closed[i] &= edge(i) && !textMask[i] ? 1 : 0;

// Each building claims the closed pixels nearest its own core (multi-source flood), so
// buildings joined by a shared road edge still come apart.
const coreBlobs = components(cores(opening(art, LINE_CUT)));
const claim = new Int32Array(N).fill(-1);
let frontier = [];
coreBlobs.forEach((blob, id) =>
  blob.forEach((i) => {
    if (closed[i]) {
      claim[i] = id;
      frontier.push(i);
    }
  }),
);
while (frontier.length) {
  const next = [];
  for (const i of frontier) {
    const x = i % W;
    const y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (closed[j] && claim[j] === -1) {
          claim[j] = claim[i];
          next.push(j);
        }
      }
  }
  frontier = next;
}
let claimed = coreBlobs.map(() => []);
for (let i = 0; i < N; i++) if (claim[i] !== -1) claimed[claim[i]].push(i);
claimed = claimed.filter((pixels) => pixels.length >= MIN_AREA);

// A fragment whose centre sits inside a bigger building's box is part of that building.
const box = (pixels) => {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const i of pixels) {
    const x = i % W, y = (i / W) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};
claimed.sort((a, b) => b.length - a.length);
const merged = [];
for (const pixels of claimed) {
  const b = box(pixels);
  const host = merged.find((m) => b.cx > m.b.x0 && b.cx < m.b.x1 && b.cy > m.b.y0 && b.cy < m.b.y1);
  if (host) host.pixels.push(...pixels);
  else merged.push({ pixels, b });
}
const layers = merged.map(({ pixels }) => ({ kind: "building", pixels }));
layers.push({ kind: "text", pixels: [...textMask.keys()].filter((i) => textMask[i]) });
const owner = new Int32Array(N).fill(-1);
layers.forEach((layer, index) => layer.pixels.forEach((i) => (owner[i] = index)));

function bounds(pixels) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const i of pixels) {
    const x = i % W;
    const y = (i / W) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function sprite(name, pixels) {
  const b = bounds(pixels);
  const c = createCanvas(b.w, b.h);
  const g = c.getContext("2d");
  const img = g.createImageData(b.w, b.h);
  for (const i of pixels) {
    const x = (i % W) - b.x;
    const y = ((i / W) | 0) - b.y;
    img.data.set(px.subarray(i * 4, i * 4 + 3), (y * b.w + x) * 4);
    img.data[(y * b.w + x) * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  writeFileSync(join(outDir, name), await c.encode("webp", 100));
  return b;
}

const base = ctx.getImageData(0, 0, W, H);
for (let i = 0; i < N; i++) if (owner[i] !== -1) base.data.set(FLOOR, i * 4);
const baseCanvas = createCanvas(W, H);
baseCanvas.getContext("2d").putImageData(base, 0, 0);
writeFileSync(join(outDir, "base.webp"), await baseCanvas.encode("webp", 100));

const text = await sprite("nuxeland.webp", layers.at(-1).pixels);
const buildings = [];
// Back to front, so later sprites stack in front.
const ordered = layers.slice(0, -1).map((l) => ({ ...l, b: bounds(l.pixels) })).sort((a, b) => a.b.y + a.b.h - (b.b.y + b.b.h));
for (const [n, layer] of ordered.entries()) {
  const b = await sprite(`b${n}.webp`, layer.pixels);
  buildings.push({ src: `/trace/city/b${n}.webp`, ...b });
}

const ts = `// Generated by scripts/build-city-layers.mjs. Do not edit.
// Design px within the ${W}×${H} city panel; buildings run back to front.
export const cityLayers = ${JSON.stringify({ width: W, height: H, base: "/trace/city/base.webp", text: { src: "/trace/city/nuxeland.webp", ...text }, buildings }, null, 2)} as const;
`;
writeFileSync(join(root, "components", "trace", "city.generated.ts"), ts);
console.log(`${buildings.length} buildings, text ${JSON.stringify(text)}`);
