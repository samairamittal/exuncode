// Exports the home page's scroll-reveal image (design/webhomepage 1.png) for the web.
// Run: node scripts/build-reveal-asset.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const img = await loadImage(join(root, "design", "webhomepage 1.png"));
const canvas = createCanvas(img.width, img.height);
canvas.getContext("2d").drawImage(img, 0, 0);
writeFileSync(join(root, "public", "home", "reveal.webp"), await canvas.encode("webp", 90));
console.log(`[reveal] public/home/reveal.webp ${img.width}x${img.height}`);
