// Copies the lazily loaded EXUN Lens engine files from node_modules into
// public/vendor (and the MediaPipe WASM runtime into public/models/wasm) so they are
// served locally (works offline) and never bundled. Runs on postinstall; both targets
// are git-ignored. The hand model itself (public/models/hand_landmarker.task) is
// committed, since it isn't on npm.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(root, "node_modules", ...p);
const out = (...p) => join(root, "public", "vendor", ...p);

const files = [
  [nm("@techstark/opencv-js/dist/opencv.js"), out("opencv/opencv.js")],
  [nm("web-tree-sitter/web-tree-sitter.wasm"), out("tree-sitter/web-tree-sitter.wasm")],
  [nm("tree-sitter-cpp/tree-sitter-cpp.wasm"), out("tree-sitter/tree-sitter-cpp.wasm")],
  [nm("pdfjs-dist/build/pdf.worker.min.mjs"), out("pdfjs/pdf.worker.min.mjs")],
  [nm("tesseract.js/dist/worker.min.js"), out("tesseract/worker.min.js")],
  ...readdirSync(nm("tesseract.js-core"))
    .filter((f) => /^tesseract-core.*\.(js|wasm)$/.test(f))
    .map((f) => [nm("tesseract.js-core", f), out("tesseract/core", f)]),
  ...readdirSync(nm("@mediapipe/tasks-vision/wasm")).map((f) => [
    nm("@mediapipe/tasks-vision/wasm", f),
    join(root, "public", "models", "wasm", f),
  ]),
];

for (const [from, to] of files) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}
console.log(`[copy-vendor] ${files.length} files -> public/vendor, public/models/wasm`);
