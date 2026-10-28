import { lensFiles } from "@/lib/lens";

// Voice commands for LENS. Only utterances that start with the wake word count. Matching is
// by keywords, not exact phrases: each rule lists patterns, and the first rule that matches
// wins, so more specific rules come first. Every command maps to an existing Lens action.

export const WAKE_WORD = "lens";

export type CommandId =
  | "navigate"
  | "read-file"
  | "scan-file"
  | "decode"
  | "show-energy"
  | "show-spike"
  | "zoom-in"
  | "zoom-out"
  | "reset-zoom"
  | "next-file"
  | "previous-file"
  | "next-page"
  | "previous-page"
  | "summarise"
  | "pin"
  | "stop"
  | "sleep";

export interface Command {
  id: CommandId;
  /** File id for scan/read, route for navigate. */
  arg?: string;
}

interface Rule {
  id: CommandId;
  patterns: RegExp[];
  /** Pulls an argument out of the text; the rule only matches if it returns one. */
  arg?: (text: string) => string | undefined;
}

const route = (text: string) =>
  /\b(map|trace)\b/.test(text) ? "/map" : /\b(board|crux)\b/.test(text) ? "/board" : /\b(home|homepage)\b/.test(text) ? "/" : /\bprofile\b/.test(text) ? "/profile" : undefined;

const STOP_WORDS = new Set(["the", "a", "an", "file", "please", "of", "to", "me", "and", "vs", "versus", "from"]);
const tokens = (text: string) => text.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w));

/** Closest queue entry to a spoken name, by shared words (and word prefixes). */
export function closestFile(name: string): string | undefined {
  const spoken = tokens(name);
  let best: { id: string; score: number } | undefined;
  for (const file of lensFiles) {
    const words = tokens(`${file.title.toLowerCase()} ${file.id.replace(/-/g, " ")}`);
    const score = spoken.filter((w) => words.some((t) => t === w || (w.length > 3 && (t.startsWith(w) || w.startsWith(t))))).length;
    if (score > 0 && (!best || score > best.score)) best = { id: file.id, score };
  }
  return best?.id;
}

export const commandTable: Rule[] = [
  { id: "navigate", patterns: [/\b(open|go to|show|take me to)\b.*\b(map|trace|board|crux|profile)\b/, /\bgo home\b/], arg: route },
  { id: "read-file", patterns: [/\bread\b/], arg: (t) => closestFile(t.replace(/.*\bread\b/, "")) },
  // A file name after a scan verb wins over the topic words below ("scan the energy dossier").
  { id: "scan-file", patterns: [/\b(scan|analy[sz]e|open|check|look at)\b/], arg: (t) => closestFile(t.replace(/.*\b(scan|analy[sz]e|open|check|look at)\b/, "")) },
  { id: "decode", patterns: [/\bdecode\b/, /\bmachine id\b/, /\bbase ?32\b/] },
  { id: "show-spike", patterns: [/\bspike\b/] },
  { id: "show-energy", patterns: [/\b(energy|graph|chart)\b/] },
  { id: "reset-zoom", patterns: [/\breset\b.*\bzoom\b/, /\bzoom\b.*\breset\b/] },
  { id: "zoom-in", patterns: [/\bzoom in\b/, /\b(enlarge|closer)\b/] },
  { id: "zoom-out", patterns: [/\bzoom out\b/] },
  { id: "next-page", patterns: [/\bnext page\b/] },
  { id: "previous-page", patterns: [/\b(previous|last) page\b/] },
  { id: "next-file", patterns: [/\bnext\b/] },
  { id: "previous-file", patterns: [/\b(previous|go back|back)\b/] },
  { id: "summarise", patterns: [/\bwhat did you find\b/, /\bsummar/, /\bfindings\b/, /\bwhat have you got\b/] },
  { id: "pin", patterns: [/\bpin\b/] },
  { id: "sleep", patterns: [/\bclose lens\b/, /\b(go to )?sleep\b/, /\bshut ?down\b/] },
  { id: "stop", patterns: [/\b(stop|quiet|silence|shut up|enough)\b/] },
];

export const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Splits an utterance into wake word and command text. `woke` is false without the wake word. */
export function parseUtterance(transcript: string): { woke: boolean; text: string } {
  const text = normalise(transcript);
  // Recognisers often hear "lens" as "lenz", "lands" or "len's".
  const match = text.match(/^(?:hey |ok |okay )?(lens|lenz|lense|lands|lenses)\b\s*(.*)$/);
  return match ? { woke: true, text: match[2] } : { woke: false, text };
}

/** Matches command text (after the wake word) against the table. */
export function matchCommand(text: string): Command | null {
  const clean = normalise(text);
  if (!clean) return null;
  for (const rule of commandTable) {
    if (!rule.patterns.some((p) => p.test(clean))) continue;
    if (!rule.arg) return { id: rule.id };
    const arg = rule.arg(clean);
    if (arg) return { id: rule.id, arg };
  }
  return null;
}
