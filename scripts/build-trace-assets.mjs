// Crops the raster artwork out of the eXunTrace mockup (design/exuntrace.png, 1728×1315 @1x):
// the tracker map (marker dots painted out; the page draws them) and the isometric
// nuxEland panel. Everything else on the page is HTML.
// Writes public/trace/*.
// Run: node scripts/build-trace-assets.mjs   (re-run if the mockup changes)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "trace");
mkdirSync(outDir, { recursive: true });

const src = await loadImage(join(root, "design", "exuntrace.png"));

// Measured from the mockup.
const MAP = { x: 90, y: 396, w: 476, h: 430 };
const CITY = { x: 607, y: 267, w: 1055, h: 824 };
// Marker centres in map px (also in components/trace/data.ts), 22px across.
const DOTS = [
  [181.5, 100.5],
  [394.5, 100.5],
  [347.5, 392.5],
  [294.5, 216.5],
  [115.5, 238.5],
  [85.5, 330.5],
];
const DOT_COVER = 14; // radius painted out, past the dot's anti-aliased edge
const PATCH_DX = 30; // texture is borrowed from this far to the left

function crop({ x, y, w, h }) {
  const c = createCanvas(w, h);
  c.getContext("2d").drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

async function save(name, canvas) {
  writeFileSync(join(outDir, name), await canvas.encode("webp", 100));
}

const map = crop(MAP);
const ctx = map.getContext("2d");
const img = ctx.getImageData(0, 0, MAP.w, MAP.h);
const d = img.data;
for (const [cx, cy] of DOTS) {
  for (let y = Math.floor(cy - DOT_COVER); y <= cy + DOT_COVER; y++) {
    for (let x = Math.floor(cx - DOT_COVER); x <= cx + DOT_COVER; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > DOT_COVER ** 2) continue;
      const to = (y * MAP.w + x) * 4;
      const from = (y * MAP.w + x - PATCH_DX) * 4;
      d.set(d.subarray(from, from + 4), to);
    }
  }
}
ctx.putImageData(img, 0, 0);
await save("map.webp", map);
await save("city.webp", crop(CITY));
