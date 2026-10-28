// Splits the flat Home mockup (design/home.png, 1728×1117 @1x) into the layers the
// homepage animates, upscaled to 2x and sharpened so the pixel art reads crisply:
// cabinet plate (NUXELAND removed), NUXELAND (original strokes, de-speckled and deepened
// for legibility), RGB-split tints, screen glow, screen mask and logo.
// Writes public/home/* and components/home/layers.generated.ts.
// Run: node scripts/build-home-assets.mjs   (re-run if the mockup changes)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "home");
mkdirSync(outDir, { recursive: true });

const src = await loadImage(join(root, "design", "home.png"));
const W = src.width;
const H = src.height;
const full = createCanvas(W, H).getContext("2d");
full.drawImage(src, 0, 0);
const pixels = full.getImageData(0, 0, W, H).data;

// Measured from the mockup.
const STAGE_TOP = 150; // first artwork row is 187; rows above (outside the nav) are black
const SCREEN_GRID = 10.56; // CRT cell size on the screen (the cabinet's mosaic is ~12px)
const GRID_X = 568.3; // x of a vertical screen grid line
const GRID_Y = 387.9; // y of a horizontal screen grid line
const LINE_H = { half: 1, shade: 0.8 }; // horizontal grid lines: 2px, 80% brightness
const LINE_V = { half: 0.75, shade: 0.94 }; // vertical grid lines: 1.5px, 94% brightness
const TEXT_SEARCH = { x0: 566, y0: 525, x1: 1268, y1: 685 }; // NUXELAND lives in here
const LOGO = { x: 112, y: 66, w: 60, h: 46 };
const OUT = 2; // output scale: crisp on 2x screens
const WEBP_QUALITY = 90;
const SHARPEN = [
  { radius: 2, amount: 1.1 }, // edges (in 2x px)
  { radius: 10, amount: 0.35 }, // local contrast ("clarity")
];
// Text is sharpened gently: strong sharpening turns the mockup's speckle into bubbles.
const TEXT_SHARPEN = [{ radius: 2, amount: 0.5 }];
const INK = [14, 46, 214]; // deep blue the letter cores are pushed toward
const INK_STRENGTH = 0.55;

const at = (x, y) => (y * W + x) * 4;
const stageH = H - STAGE_TOP;

async function save(name, canvas) {
  const webp = name.endsWith(".webp");
  writeFileSync(join(outDir, name), await canvas.encode(webp ? "webp" : "png", webp ? WEBP_QUALITY : undefined));
}

function canvasFrom(w, h, fill) {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  return c;
}

// 1. NUXELAND mask: blue-dominant pixels (cyan speckles in the screen have g ≈ b).
const mask = new Uint8Array(W * H);
for (let y = TEXT_SEARCH.y0; y < TEXT_SEARCH.y1; y++)
  for (let x = TEXT_SEARCH.x0; x < TEXT_SEARCH.x1; x++) {
    const i = at(x, y);
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (b - r > 30 && b - g > 20) mask[y * W + x] = 1;
  }
// Dilate so anti-aliased glyph edges come with the text.
function dilate(m, radius) {
  const out = new Uint8Array(m.length);
  for (let y = TEXT_SEARCH.y0 - radius; y < TEXT_SEARCH.y1 + radius; y++)
    for (let x = TEXT_SEARCH.x0 - radius; x < TEXT_SEARCH.x1 + radius; x++) {
      let hit = 0;
      for (let dy = -radius; dy <= radius && !hit; dy++)
        for (let dx = -radius; dx <= radius && !hit; dx++) hit = m[(y + dy) * W + (x + dx)];
      out[y * W + x] = hit;
    }
  return out;
}
const textMask = dilate(mask, 5);

let tx0 = W, ty0 = H, tx1 = 0, ty1 = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (textMask[y * W + x]) {
      tx0 = Math.min(tx0, x); ty0 = Math.min(ty0, y);
      tx1 = Math.max(tx1, x); ty1 = Math.max(ty1, y);
    }

// 2. Plate (1x): fill text pixels with grid-aligned copies from just above and below the
// text band, blended by distance, so the CRT grid continues behind the text.
const plateData = new Uint8ClampedArray(pixels);
for (let y = ty0; y <= ty1; y++)
  for (let x = tx0; x <= tx1; x++) {
    if (!textMask[y * W + x]) continue;
    const ya = Math.round(y - Math.ceil((y - ty0 + 1) / SCREEN_GRID) * SCREEN_GRID);
    const yb = Math.round(y + Math.ceil((ty1 + 1 - y) / SCREEN_GRID) * SCREEN_GRID);
    const t = (y - ya) / (yb - ya);
    const a = at(x, ya), b = at(x, yb), o = at(x, y);
    for (let c = 0; c < 3; c++) plateData[o + c] = pixels[a + c] * (1 - t) + pixels[b + c] * t;
  }

// Readable text (1x), keeping the original stroke thickness: fill the cyan specks inside
// the strokes (a closing only fills holes, it never widens a stroke), then deepen the
// blue in proportion to how blue each pixel already is.
function erode(m, radius) {
  const out = new Uint8Array(m.length);
  for (let y = TEXT_SEARCH.y0; y < TEXT_SEARCH.y1; y++)
    for (let x = TEXT_SEARCH.x0; x < TEXT_SEARCH.x1; x++) {
      let all = 1;
      for (let dy = -radius; dy <= radius && all; dy++)
        for (let dx = -radius; dx <= radius && all; dx++) all = m[(y + dy) * W + (x + dx)];
      out[y * W + x] = all;
    }
  return out;
}
const strokes = erode(dilate(mask, 3), 3);
// 5×5 median over the text area: removes the specks but keeps stroke edges in place.
const MEDIAN = 2;
const denoised = new Uint8ClampedArray(pixels);
for (let y = ty0; y <= ty1; y++)
  for (let x = tx0; x <= tx1; x++) {
    if (!textMask[y * W + x]) continue;
    for (let c = 0; c < 3; c++) {
      const v = [];
      for (let dy = -MEDIAN; dy <= MEDIAN; dy++)
        for (let dx = -MEDIAN; dx <= MEDIAN; dx++) v.push(pixels[at(x + dx, y + dy) + c]);
      v.sort((p, q) => p - q);
      denoised[at(x, y) + c] = v[v.length >> 1];
    }
  }
const inkedData = new Uint8ClampedArray(denoised);
for (let y = ty0; y <= ty1; y++)
  for (let x = tx0; x <= tx1; x++) {
    if (!strokes[y * W + x]) continue;
    const i = at(x, y);
    let color = [denoised[i], denoised[i + 1], denoised[i + 2]];
    if (!mask[y * W + x]) {
      // A speck inside a stroke: take the stroke colour around it.
      const sum = [0, 0, 0];
      let n = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          if (!mask[(y + dy) * W + x + dx]) continue;
          const j = at(x + dx, y + dy);
          sum[0] += denoised[j]; sum[1] += denoised[j + 1]; sum[2] += denoised[j + 2]; n++;
        }
      if (n) color = sum.map((v) => v / n);
    }
    const t = Math.min(1, Math.max(0, (color[2] - Math.max(color[0], color[1]) - 20) / 90)) * INK_STRENGTH;
    for (let c = 0; c < 3; c++) inkedData[i + c] = color[c] * (1 - t) + INK[c] * t;
  }

// 3. 2x upscale (high-quality filter) of the stage, then unsharp-mask passes.
function upscaleStage(data) {
  const one = createCanvas(W, stageH);
  const img = one.getContext("2d").createImageData(W, stageH);
  img.data.set(data.subarray(at(0, STAGE_TOP), at(0, H)));
  one.getContext("2d").putImageData(img, 0, 0);
  const two = createCanvas(W * OUT, stageH * OUT);
  const ctx = two.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(one, 0, 0, W * OUT, stageH * OUT);
  return ctx.getImageData(0, 0, W * OUT, stageH * OUT).data;
}

function boxBlur(src, w, h, radius) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let x = -radius; x <= radius; x++) s += src[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = s / (2 * radius + 1);
        s += src[(y * w + Math.min(w - 1, x + radius + 1)) * 4 + c] - src[(y * w + Math.max(0, x - radius)) * 4 + c];
      }
    }
  for (let x = 0; x < w; x++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let y = -radius; y <= radius; y++) s += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = s / (2 * radius + 1);
        s += tmp[(Math.min(h - 1, y + radius + 1) * w + x) * 4 + c] - tmp[(Math.max(0, y - radius) * w + x) * 4 + c];
      }
    }
  return out;
}

function sharpen(data, w, h, passes = SHARPEN) {
  let cur = Float32Array.from(data);
  for (const { radius, amount } of passes) {
    // Three box passes ≈ gaussian.
    const blurred = boxBlur(boxBlur(boxBlur(cur, w, h, radius), w, h, radius), w, h, radius);
    for (let i = 0; i < cur.length; i += 4)
      for (let c = 0; c < 3; c++) cur[i + c] += amount * (cur[i + c] - blurred[i + c]);
  }
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = cur[i]; out[i + 1] = cur[i + 1]; out[i + 2] = cur[i + 2]; out[i + 3] = 255;
  }
  return out;
}

const W2 = W * OUT, H2 = stageH * OUT;
const plate2 = sharpen(upscaleStage(plateData), W2, H2);
const inked2 = sharpen(upscaleStage(inkedData), W2, H2, TEXT_SHARPEN);
await save("arcade-plate.webp", canvasFrom(W2, H2, (d) => d.set(plate2)));

// 4. Text layer and its RGB-split tints, cut from the sharpened, inked render.
const text = { x: tx0, y: ty0, w: tx1 - tx0 + 1, h: ty1 - ty0 + 1 };
const inText = (X, Y) => textMask[(STAGE_TOP + Math.floor(Y / OUT)) * W + Math.floor(X / OUT)];
const isStroke = (X, Y) => strokes[(STAGE_TOP + Math.floor(Y / OUT)) * W + Math.floor(X / OUT)];
function textLayer(tint) {
  const ox = text.x * OUT, oy = (text.y - STAGE_TOP) * OUT, w = text.w * OUT, h = text.h * OUT;
  return canvasFrom(w, h, (d) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const X = ox + x, Y = oy + y;
        if (!inText(X, Y)) continue;
        const i = (Y * W2 + X) * 4, o = (y * w + x) * 4;
        if (tint) {
          d.set([...tint, isStroke(X, Y) ? 255 : 90], o);
          continue;
        }
        // The median removed the CRT grid inside the text; draw it back.
        const fx = ((((X + 0.5) / OUT - GRID_X) % SCREEN_GRID) + SCREEN_GRID) % SCREEN_GRID;
        const fy = ((((Y + 0.5) / OUT + STAGE_TOP - GRID_Y) % SCREEN_GRID) + SCREEN_GRID) % SCREEN_GRID;
        let k = 1;
        if (fy < LINE_H.half || fy >= SCREEN_GRID - LINE_H.half) k *= LINE_H.shade;
        if (fx < LINE_V.half || fx >= SCREEN_GRID - LINE_V.half) k *= LINE_V.shade;
        d.set([inked2[i] * k, inked2[i + 1] * k, inked2[i + 2] * k, 255], o);
      }
  });
}
await save("nuxeland.webp", textLayer(null));
await save("nuxeland-red.webp", textLayer([255, 0, 60]));
await save("nuxeland-cyan.webp", textLayer([0, 220, 255]));

// 5. Screen: bright region of the plate (largest blob), as a soft mask and a glow.
const SCALE = 4; // glow/mask are smooth, so quarter resolution is plenty
const sw = Math.ceil(W / SCALE), sh = Math.ceil(stageH / SCALE);
const bright = new Float32Array(sw * sh);
for (let y = 0; y < sh; y++)
  for (let x = 0; x < sw; x++) {
    let sum = 0, n = 0;
    for (let dy = 0; dy < SCALE; dy++)
      for (let dx = 0; dx < SCALE; dx++) {
        const px = x * SCALE + dx, py = y * SCALE + dy + STAGE_TOP;
        if (px >= W || py >= H) continue;
        const i = at(px, py);
        sum += (plateData[i] + plateData[i + 1] + plateData[i + 2]) / 3; n++;
      }
    bright[y * sw + x] = n ? sum / n : 0;
  }
const isScreen = new Uint8Array(sw * sh);
for (let i = 0; i < bright.length; i++) isScreen[i] = bright[i] > 150 ? 1 : 0;
// Keep only the largest connected component (the screen), dropping button highlights.
const label = new Int32Array(sw * sh).fill(-1);
let best = { id: -1, size: 0 };
for (let i = 0, id = 0; i < isScreen.length; i++) {
  if (!isScreen[i] || label[i] !== -1) continue;
  const stack = [i]; label[i] = id; let size = 0;
  while (stack.length) {
    const j = stack.pop(); size++;
    const x = j % sw, y = (j - x) / sw;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
      const k = ny * sw + nx;
      if (isScreen[k] && label[k] === -1) { label[k] = id; stack.push(k); }
    }
  }
  if (size > best.size) best = { id, size };
  id++;
}
let sx0 = sw, sy0 = sh, sx1 = 0, sy1 = 0;
for (let i = 0; i < label.length; i++) {
  if (label[i] !== best.id) { isScreen[i] = 0; continue; }
  const x = i % sw, y = (i - x) / sw;
  sx0 = Math.min(sx0, x); sy0 = Math.min(sy0, y); sx1 = Math.max(sx1, x); sy1 = Math.max(sy1, y);
}
const screen = { x: sx0 * SCALE, y: sy0 * SCALE, w: (sx1 - sx0 + 1) * SCALE, h: (sy1 - sy0 + 1) * SCALE };

function blur(values, radius, passes = 3) {
  let a = Float32Array.from(values), b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        let s = 0, n = 0;
        for (let k = -radius; k <= radius; k++) { const xx = x + k; if (xx >= 0 && xx < sw) { s += a[y * sw + xx]; n++; } }
        b[y * sw + x] = s / n;
      }
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        let s = 0, n = 0;
        for (let k = -radius; k <= radius; k++) { const yy = y + k; if (yy >= 0 && yy < sh) { s += b[yy * sw + x]; n++; } }
        a[y * sw + x] = s / n;
      }
  }
  return a;
}
const softMask = blur(isScreen, 1, 2);
await save("screen-mask.png", canvasFrom(sw, sh, (d) => {
  for (let i = 0; i < softMask.length; i++) d.set([255, 255, 255, Math.round(softMask[i] * 255)], i * 4);
}));
// Glow keeps the screen's own colours, spread outward.
const glowAlpha = blur(isScreen, 14, 3);
await save("screen-glow.png", canvasFrom(sw, sh, (d) => {
  for (let i = 0; i < glowAlpha.length; i++) {
    const x = i % sw, y = (i - x) / sw;
    const cx = Math.min(sx1, Math.max(sx0, x)), cy = Math.min(sy1, Math.max(sy0, y));
    const s = at(Math.min(W - 1, cx * SCALE), Math.min(H - 1, cy * SCALE + STAGE_TOP));
    d.set([plateData[s], plateData[s + 1], plateData[s + 2], Math.round(Math.min(1, glowAlpha[i] * 1.6) * 255)], i * 4);
  }
}));

// 6. Logo: white pixel glyphs, thresholded so the 2x edges stay hard.
await save("logo.png", canvasFrom(LOGO.w * OUT, LOGO.h * OUT, (d) => {
  for (let Y = 0; Y < LOGO.h * OUT; Y++)
    for (let X = 0; X < LOGO.w * OUT; X++) {
      const s = at(LOGO.x + Math.floor(X / OUT), LOGO.y + Math.floor(Y / OUT));
      const lum = (pixels[s] + pixels[s + 1] + pixels[s + 2]) / 3;
      d.set([255, 255, 255, lum > 127 ? 255 : 0], (Y * LOGO.w * OUT + X) * 4);
    }
}));

// Geometry in design px, relative to the stage (top-left of arcade-plate.png).
const layout = {
  design: { width: W, height: H },
  stage: { top: STAGE_TOP, width: W, height: stageH },
  text: { x: text.x, y: text.y - STAGE_TOP, w: text.w, h: text.h },
  screen,
  logo: { w: LOGO.w, h: LOGO.h },
};
writeFileSync(
  join(root, "components", "home", "layers.generated.ts"),
  `// Generated by scripts/build-home-assets.mjs from design/home.png. Do not edit.\n` +
    `export const homeLayers = ${JSON.stringify(layout, null, 2)} as const;\n`,
);
console.log(JSON.stringify(layout));
