// Opens the portal in a dedicated Chrome profile for hands-free demos (macOS).
// Chrome normally keeps sound off until the first click; this profile allows autoplay, so
// a double clap can start the music and LENS's greeting with no click at all. It also
// auto-accepts the camera and mic prompts. Both flags apply only to this demo profile
// (.chrome-demo, git-ignored), never to your normal Chrome.
// Run `npm run dev` first, then: npm run demo
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] ?? "http://localhost:3000/";

spawn(
  "open",
  [
    "-na",
    "Google Chrome",
    "--args",
    `--user-data-dir=${join(root, ".chrome-demo")}`,
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-ui-for-media-stream",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-fullscreen",
    url,
  ],
  { stdio: "inherit" },
);
console.log(`[demo] Chrome (demo profile) -> ${url}`);
