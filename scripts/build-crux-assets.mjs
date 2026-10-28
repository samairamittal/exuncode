// Cuts design/exuncrux.png into layers for the eXunCrux evidence board, so the pins can
// drop in and the strings can be tied live:
//   public/crux/board.webp       the board with cards, strings, pins and pin glows removed
//   public/crux/evidence-N.png   each evidence card with its date tag (swap these for new art)
//   public/crux/nuxeland.png     the NUXELAND label, drawn above the strings that meet it
// and components/crux/crux.generated.ts with every position in board px.
// Stacked flat with the SVG strings and CSS pins, the layers recompose the design.
// Run: node scripts/build-crux-assets.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "crux");
mkdirSync(outDir, { recursive: true });

const src = await loadImage(join(root, "design", "exuncrux.png"));
const W = src.width;
const H = src.height;
const srcCtx = createCanvas(W, H).getContext("2d");
srcCtx.drawImage(src, 0, 0);
const px = srcCtx.getImageData(0, 0, W, H).data;
const N = W * H;

// Measured on the mockup (design px). Cards: centre, size and angle of the frame, and of the tag.
const BOARD = { x: 67, y: 184, w: 1595, h: 962 }; // panel plus the EVIDENCEEE title hanging below it
const PIN_R = 19.8;
const GLOW_R = 110;
const pins = {
  e1: [625.5, 1013.5],
  e2: [981.6, 266.5],
  e3: [1126.5, 987.5],
  e4: [306.5, 644.7],
};
const cards = {
  e1: { label: "Evidence 1", date: "23 October", frame: [[231.3, 788.1], [556, 718.9], [625.3, 1043.6], [300.5, 1112.9]], tag: [[188.1, 840.1], [196.8, 771.6], [364.2, 792.9], [355.4, 861.4]] },
  e2: { label: "Evidence 2", date: "24 October", frame: [[988.6, 223.2], [1588.8, 324.9], [1529.7, 673.3], [929.5, 571.6]], tag: [[1430.3, 247.1], [1588.4, 332.2], [1553.5, 396.9], [1395.4, 311.8]] },
  e3: { label: "Evidence 3", date: "23 October", frame: [[1249.3, 723.2], [1489, 881.7], [1330.6, 1121.4], [1090.8, 962.8]], tag: [[1238.6, 691.9], [1326.9, 808], [1279.5, 844.1], [1191.2, 727.9]] },
  e4: { label: "Evidence 4", date: "25 October", frame: [[198.6, 394.9], [669.8, 298.1], [726, 572], [254.8, 668.7]], tag: [[523.9, 316.7], [719.5, 242.9], [740, 297.3], [544.4, 371.2]] },
};
// Strings as cubic Bézier paths (one or two segments) fitted to the drawn curves (mean error
// under 1px), each starting at a pin. "nuxeland" ends hide under the label.
const strings = [
  { id: "e4-e1", from: "e4", to: "e1", d: [[298.6, 651.8], [370.5, 793.1], [511.8, 905.2], [619.5, 1015.4]] },
  { id: "e2-e4", from: "e2", to: "e4", d: [[975, 272], [827.3, 471.5], [562.2, 599.8], [310.8, 636.6]] },
  { id: "e2-e3", from: "e2", to: "e3", d: [[975, 280], [947.4, 363.5], [973.4, 474.8], [991.5, 560], [1023.8, 704.6], [1079.6, 842.6], [1127.8, 981.8]] },
  { id: "e4-nuxeland", from: "e4", to: "nuxeland", d: [[304.5, 648.8], [437.4, 703.2], [595.4, 713.3], [733.8, 672.4]] },
  { id: "e1-nuxeland", from: "e1", to: "nuxeland", d: [[634.1, 1017.1], [672.3, 910.2], [759.8, 803.4], [768.7, 690.1]] },
  { id: "e2-nuxeland", from: "e2", to: "nuxeland", d: [[968, 284], [867.4, 388.3], [819.2, 528.5], [841.9, 672]] },
  { id: "e3-nuxeland", from: "e3", to: "nuxeland", d: [[1139.4, 996], [966, 976.5], [850.8, 867.6], [949.1, 688.2]] },
];
const TEXT_BOX = [700, 640, 970, 720]; // search box for the NUXELAND label
const STRING_W = 9; // mask width around each string on the board (covers antialiasing and fit error)
const CARD_STRING_W = 5; // narrower on the cards, so captions under a string keep their shape
const GRID_HIT = 25;
const MAP = [472, 469, 1210, 888]; // the dark street map behind NUXELAND: left, top, right, bottom
const MAP_STEP = 120; // texture copy distance when rebuilding the map under a card
const MAP_EDGE = 6; // the map's edge is ragged by a few px
const BOARD_SMOOTH = 250; // the plain board is a soft gradient, so its fill is smoothed hard
const SOURCE_LUM = 90; // brighter pixels never seed the board fill // a grid line pixel is this much brighter than the pixels 2px either side

const lum = (i) => (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;

// ---- masks -------------------------------------------------------------------------------
function polyMask(polys, grow) {
  const c = createCanvas(W, H).getContext("2d");
  c.fillStyle = "#fff";
  for (const poly of polys) {
    // grow the rectangle outward along its own axes
    const cx = poly.reduce((s, p) => s + p[0], 0) / 4;
    const cy = poly.reduce((s, p) => s + p[1], 0) / 4;
    c.beginPath();
    poly.forEach(([x, y], i) => {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy);
      const k = (len + grow * Math.SQRT2) / len;
      if (i === 0) c.moveTo(cx + dx * k, cy + dy * k);
      else c.lineTo(cx + dx * k, cy + dy * k);
    });
    c.closePath();
    c.fill();
  }
  const d = c.getImageData(0, 0, W, H).data;
  const m = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = d[i * 4] / 255;
  return m;
}

const cardCover = Object.fromEntries(Object.entries(cards).map(([k, c]) => [k, polyMask([c.frame, c.tag], 1)]));

const strokeMask = (width) => {
  const c = createCanvas(W, H).getContext("2d");
  c.strokeStyle = "#fff";
  c.lineWidth = width;
  c.lineCap = "round";
  for (const { d } of strings) {
    c.beginPath();
    c.moveTo(...d[0]);
    for (let i = 1; i < d.length; i += 3) c.bezierCurveTo(...d[i], ...d[i + 1], ...d[i + 2]);
    c.stroke();
  }
  const d = c.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = d[i * 4] > 0 ? 1 : 0;
  return m;
};
const stringMask = strokeMask(STRING_W);
const cardStringMask = strokeMask(CARD_STRING_W);

const pinMask = new Uint8Array(N);
for (const [x0, y0] of Object.values(pins))
  for (let y = Math.floor(y0 - PIN_R - 3); y <= y0 + PIN_R + 3; y++)
    for (let x = Math.floor(x0 - PIN_R - 3); x <= x0 + PIN_R + 3; x++)
      if (Math.hypot(x - x0, y - y0) <= PIN_R + 2.5) pinMask[y * W + x] = 1;

// The board fill skips a wider margin so antialiased card edges don't bleed into it.
const anyCard = polyMask(Object.values(cards).flatMap((c) => [c.frame, c.tag]), 4);

// ---- pin glow ----------------------------------------------------------------------------
// Each pin sits in a soft white halo: colour = under * (1 - a) + white * a. Measure a(r) on
// clear board around the pins, then divide it back out so the halo can fade in with its pin.
const inText = (x, y) => x > TEXT_BOX[0] && x < TEXT_BOX[2] && y > TEXT_BOX[1] && y < TEXT_BOX[3];
const glow = new Float32Array(GLOW_R + 1);
{
  const bins = Array.from({ length: GLOW_R + 16 }, () => []);
  const perPin = [];
  for (const [x0, y0] of Object.values(pins)) {
    const b = Array.from({ length: GLOW_R + 16 }, () => []);
    for (let y = Math.floor(y0 - GLOW_R - 15); y <= y0 + GLOW_R + 15; y++)
      for (let x = Math.floor(x0 - GLOW_R - 15); x <= x0 + GLOW_R + 15; x++) {
        if (x < BOARD.x + 4 || y < BOARD.y + 4 || x >= W || y >= BOARD.y + 936) continue;
        const i = y * W + x;
        if (anyCard[i] > 0 || stringMask[i] || pinMask[i] || inText(x, y)) continue;
        const r = Math.round(Math.hypot(x - x0, y - y0));
        if (r < b.length) b[r].push(lum(i));
      }
    perPin.push(b);
  }
  const median = (a) => (a.length ? [...a].sort((p, q) => p - q)[a.length >> 1] : NaN);
  for (const b of perPin) {
    const base = median(b.slice(GLOW_R, GLOW_R + 16).flat());
    b.forEach((vals, r) => vals.length && bins[r].push((median(vals) - base) / (255 - base)));
  }
  let prev = Infinity;
  for (let r = 0; r <= GLOW_R; r++) {
    const vals = bins[Math.max(r, Math.ceil(PIN_R) + 2)].filter((v) => !Number.isNaN(v));
    const a = Math.max(0, Math.min(prev, vals.reduce((s, v) => s + v, 0) / (vals.length || 1)));
    glow[r] = r >= GLOW_R - 4 ? 0 : a;
    prev = glow[r];
  }
}
const glowAt = (r) => (r >= GLOW_R ? 0 : glow[Math.floor(r)] + (glow[Math.ceil(r)] - glow[Math.floor(r)]) * (r % 1));

const img = new Float32Array(N * 3);
for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) img[i * 3 + c] = px[i * 4 + c];
for (const [x0, y0] of Object.values(pins))
  for (let y = Math.floor(y0 - GLOW_R); y <= y0 + GLOW_R; y++)
    for (let x = Math.floor(x0 - GLOW_R); x <= x0 + GLOW_R; x++) {
      const a = glowAt(Math.hypot(x - x0, y - y0));
      if (a <= 0 || x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      for (let c = 0; c < 3; c++) img[i * 3 + c] = Math.max(0, (img[i * 3 + c] - 255 * a) / (1 - a));
    }

// ---- inpainting --------------------------------------------------------------------------
// Fills `hole` from the outside in (each ring takes the mean of its filled neighbours), then
// smooths the fill so it reads as soft board texture rather than streaks.
function inpaint(data, hole, usable, smooth = 40) {
  const done = new Uint8Array(N);
  for (let i = 0; i < N; i++) done[i] = usable[i] && !hole[i] ? 1 : 0;
  let front = [];
  for (let i = 0; i < N; i++) if (hole[i] && usable[i]) front.push(i);
  const filled = [];
  while (front.length) {
    const next = [];
    const ready = [];
    for (const i of front) {
      const x = i % W;
      const y = (i / W) | 0;
      let n = 0;
      const sum = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx;
          const Y = y + dy;
          if ((dx || dy) && X >= 0 && Y >= 0 && X < W && Y < H && done[Y * W + X]) {
            const j = Y * W + X;
            for (let c = 0; c < 3; c++) sum[c] += data[j * 3 + c];
            n++;
          }
        }
      if (n) ready.push([i, sum.map((s) => s / n)]);
      else next.push(i);
    }
    if (!ready.length) break;
    for (const [i, v] of ready) {
      for (let c = 0; c < 3; c++) data[i * 3 + c] = v[c];
      done[i] = 1;
      filled.push(i);
    }
    front = next;
  }
  for (let pass = 0; pass < smooth; pass++)
    for (const i of filled) {
      const x = i % W;
      const y = (i / W) | 0;
      let n = 0;
      const sum = [0, 0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx;
        const Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && done[Y * W + X]) {
          const j = Y * W + X;
          for (let c = 0; c < 3; c++) sum[c] += data[j * 3 + c];
          n++;
        }
      }
      if (n) for (let c = 0; c < 3; c++) data[i * 3 + c] = sum[c] / n;
    }
}

const writeLayer = async (file, data, alpha, box) => {
  const c = createCanvas(box.w, box.h);
  const g = c.getContext("2d");
  const out = g.createImageData(box.w, box.h);
  for (let y = 0; y < box.h; y++)
    for (let x = 0; x < box.w; x++) {
      const i = (box.y + y) * W + box.x + x;
      const o = (y * box.w + x) * 4;
      for (let k = 0; k < 3; k++) out.data[o + k] = Math.round(Math.min(255, Math.max(0, data[i * 3 + k])));
      out.data[o + 3] = Math.round(255 * alpha(i));
    }
  g.putImageData(out, 0, 0);
  const type = file.endsWith(".webp") ? "webp" : "png";
  writeFileSync(join(outDir, file), await c.encode(type, type === "webp" ? 100 : undefined));
};

const bbox = (m) => {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let i = 0; i < N; i++)
    if (m[i] > 0) {
      const x = i % W;
      const y = (i / W) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

// ---- cards -------------------------------------------------------------------------------
const cardOut = {};
for (const [k, cover] of Object.entries(cardCover)) {
  const data = img.slice();
  // Strings first, without the pin as a source (its white would run down the string paths),
  // then the pin from the repaired card around it.
  const hole = new Uint8Array(N);
  const usable = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    usable[i] = cover[i] > 0 && !pinMask[i] ? 1 : 0;
    hole[i] = usable[i] && cardStringMask[i] ? 1 : 0;
  }
  inpaint(data, hole, usable);
  for (let i = 0; i < N; i++) {
    usable[i] = cover[i] > 0 ? 1 : 0;
    hole[i] = usable[i] && pinMask[i] ? 1 : 0;
  }
  inpaint(data, hole, usable);
  const box = bbox(cover);
  await writeLayer(`evidence-${k.slice(1)}.png`, data, (i) => cover[i], box);
  const f = cards[k].frame;
  const angle = (Math.atan2(f[1][1] - f[0][1], f[1][0] - f[0][0]) * 180) / Math.PI;
  cardOut[k] = { box, angle: +angle.toFixed(2) };
}

// ---- NUXELAND label ----------------------------------------------------------------------
// Blue ink over the dark map: alpha from how much bluer than grey a pixel is.
const textAlpha = new Float32Array(N);
for (let y = TEXT_BOX[1]; y < TEXT_BOX[3]; y++)
  for (let x = TEXT_BOX[0]; x < TEXT_BOX[2]; x++) {
    const i = y * W + x;
    const blue = px[i * 4 + 2] - Math.max(px[i * 4], px[i * 4 + 1]);
    textAlpha[i] = Math.min(1, Math.max(0, (blue - 90) / 90));
  }
const textBox = bbox(textAlpha);
{
  const data = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) data[i * 3 + c] = px[i * 4 + c];
  await writeLayer("nuxeland.png", data, (i) => textAlpha[i], textBox);
}

// ---- board -------------------------------------------------------------------------------
{
  const hole = new Uint8Array(N);
  const usable = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    hole[i] = anyCard[i] > 0 || stringMask[i] || pinMask[i] ? 1 : 0;
    // Fill only from dark board and map: grid lines, string edges and the title never seed it.
    usable[i] = hole[i] || lum(i) < SOURCE_LUM ? 1 : 0;
  }
  // Grid lines under the cards: find them on the clear board, then redraw them over the fill.
  const inBoard = (x, y) => x > BOARD.x + 2 && x < BOARD.x + BOARD.w - 3 && y > BOARD.y + 2 && y < BOARD.y + 938;
  const cols = [];
  for (let x = BOARD.x + 3; x < BOARD.x + BOARD.w - 3; x++) {
    const deltas = [];
    for (let y = BOARD.y + 3; y < BOARD.y + 937; y++) {
      const i = y * W + x;
      if (hole[i] || hole[i - 2] || hole[i + 2]) continue;
      const d = lum(i) - Math.max(lum(i - 2), lum(i + 2));
      if (d > GRID_HIT) deltas.push(d);
    }
    if (deltas.length > 150) cols.push([x, deltas.sort((a, b) => a - b)[deltas.length >> 1]]);
  }
  const rows = [];
  for (let y = BOARD.y + 3; y < BOARD.y + 937; y++) {
    const deltas = [];
    for (let x = BOARD.x + 3; x < BOARD.x + BOARD.w - 3; x++) {
      const i = y * W + x;
      if (hole[i] || hole[i - 2 * W] || hole[i + 2 * W]) continue;
      const d = lum(i) - Math.max(lum(i - 2 * W), lum(i + 2 * W));
      if (d > GRID_HIT) deltas.push(d);
    }
    if (deltas.length > 150) rows.push([y, deltas.sort((a, b) => a - b)[deltas.length >> 1]]);
  }

  const data = img.slice();
  // The street map is a rectangle on the board; fill inside and outside it separately so the
  // map keeps its edges where cards covered them.
  const inMap = (i) => {
    const x = i % W;
    const y = (i / W) | 0;
    return x >= MAP[0] && x <= MAP[2] && y >= MAP[1] && y <= MAP[3];
  };
  const mapHole = new Uint8Array(N);
  const mapUsable = new Uint8Array(N);
  const boardHole = new Uint8Array(N);
  const boardUsable = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const card = anyCard[i] > 0;
    if (inMap(i)) {
      mapUsable[i] = card ? 0 : 1;
      mapHole[i] = !card && hole[i] ? 1 : 0;
    } else {
      // Outside the map, leave grid pixels and the map's ragged edge out of the sources.
      const x = i % W;
      const y = (i / W) | 0;
      const nearMap = x >= MAP[0] - MAP_EDGE && x <= MAP[2] + MAP_EDGE && y >= MAP[1] - MAP_EDGE && y <= MAP[3] + MAP_EDGE;
      boardHole[i] = hole[i];
      boardUsable[i] = hole[i] || (usable[i] && !nearMap) ? 1 : 0;
    }
  }
  inpaint(data, boardHole, boardUsable, BOARD_SMOOTH);
  inpaint(data, mapHole, mapUsable); // strings and pins over the map
  // Map under the cards: copy street texture from further along the same row, toward the
  // centre (sideways, so the blue glow around NUXELAND doesn't spread into the corners).
  const mapCx = (MAP[0] + MAP[2]) / 2;
  for (let i = 0; i < N; i++) {
    if (!(anyCard[i] > 0) || !inMap(i)) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const dir = Math.sign(mapCx - x) || 1;
    for (let k = 1; k < 20; k++) {
      const j = y * W + x + dir * MAP_STEP * k;
      if (mapUsable[j]) {
        for (let c = 0; c < 3; c++) data[i * 3 + c] = data[j * 3 + c];
        break;
      }
    }
  }
  const lift = (i, d) => {
    if (inMap(i)) return; // the map is drawn over the grid
    for (let c = 0; c < 3; c++) data[i * 3 + c] = Math.min(255, data[i * 3 + c] + d);
  };
  for (const [x, d] of cols)
    for (let y = BOARD.y + 3; y < BOARD.y + 937; y++) if (anyCard[y * W + x] > 0 && inBoard(x, y)) lift(y * W + x, d);
  for (const [y, d] of rows)
    for (let x = BOARD.x + 3; x < BOARD.x + BOARD.w - 3; x++) if (anyCard[y * W + x] > 0 && inBoard(x, y)) lift(y * W + x, d);
  await writeLayer("board.webp", data, () => 1, BOARD);
  console.log("grid cols", cols.map((c) => c[0]).join(" "), "rows", rows.map((r) => r[0]).join(" "));
}

// ---- geometry module ---------------------------------------------------------------------
const rel = ([x, y]) => [+(x - BOARD.x).toFixed(1), +(y - BOARD.y).toFixed(1)];
const relBox = (b) => ({ x: b.x - BOARD.x, y: b.y - BOARD.y, w: b.w, h: b.h });
const order = ["e1", "e2", "e3", "e4"];
const geometry = {
  width: BOARD.w,
  height: BOARD.h,
  board: "/crux/board.webp",
  pinRadius: PIN_R,
  glowRadius: GLOW_R,
  // halo opacity by distance from the pin centre, as [px, alpha] stops
  glow: [...Array(GLOW_R / 5 + 1).keys()].map((s) => [s * 5, +glowAt(s * 5).toFixed(4)]),
  text: { src: "/crux/nuxeland.png", ...relBox(textBox) },
  cards: order.map((k) => ({
    id: k,
    label: cards[k].label,
    date: cards[k].date,
    src: `/crux/evidence-${k.slice(1)}.png`,
    ...relBox(cardOut[k].box),
    angle: cardOut[k].angle,
    pin: rel(pins[k]),
  })),
  strings: strings.map((s) => ({ ...s, d: s.d.map(rel) })),
};
writeFileSync(
  join(root, "components", "crux", "crux.generated.ts"),
  `// Generated by scripts/build-crux-assets.mjs from design/exuncrux.png. Do not edit.\n` +
    `export const cruxLayers = ${JSON.stringify(geometry, null, 2)} as const;\n`,
);
console.log(`glow a(20)=${glowAt(20).toFixed(3)} a(60)=${glowAt(60).toFixed(3)}; text`, textBox);
