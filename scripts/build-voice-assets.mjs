// Renders LENS's fixed lines to public/audio with a calm British male macOS voice (Daniel),
// for a JARVIS-style assistant. The light AI sheen is added at playback in
// lib/voice/robot.ts, so it can be tuned without re-rendering.
// macOS only (uses `say` and `afconvert`). Run: node scripts/build-voice-assets.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "audio");
mkdirSync(out, { recursive: true });

const VOICE = "Daniel";
const RATE = 175; // words per minute: composed, unhurried
const lines = { greeting: "Good morning, agent." };

for (const [name, text] of Object.entries(lines)) {
  const aiff = join(tmpdir(), `lens-${name}.aiff`);
  execFileSync("say", ["-v", VOICE, "-r", String(RATE), "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16", aiff, join(out, `${name}.wav`)]);
  rmSync(aiff);
  console.log(`[voice] ${name}.wav: "${text}" (${VOICE})`);
}
