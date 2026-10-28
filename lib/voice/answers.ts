import {
  assetReport,
  caseMeta,
  debrief,
  energyDossier,
  progressLog,
  suspensionNotice,
  transcript,
} from "@/lib/case";
import { checkLedger, decodeBase32, gauges, lensFiles, readGauge } from "@/lib/lens";
import { normalise } from "./commands";

// LENS answers questions about the case, in character, from the case data (lib/case), the
// Lens engine (meter check, Base32) and what the agent has found so far. Pure and offline.
//
// Each intent has patterns (any one matches) and an answer. Intents are tried in order, so
// specific ones come before general ones. Story answers (why it escaped, the Reckoning) are
// only given once the findings that support them have been surfaced: until then LENS says
// which evidence to look at, so the story unfolds as the agent works.

export interface AnswerContext {
  /** Ids of findings surfaced so far. */
  found: ReadonlySet<string>;
  /** Lens queue entries analysed so far. */
  analysed: readonly string[];
  codename: string;
  agentNumber: string;
  now: Date;
  /** Tracker state from eXunTrace (place names). */
  sightings: { latest: string[]; outages: string[]; targets: string[] };
}

export interface Answer {
  text: string;
  /** Something for the UI to show alongside (e.g. a chart day, by index). */
  show?: { chartDay?: number; finding?: string; file?: string };
  intent: string;
}

const ledger = checkLedger(energyDossier.readings);
const typicalDay = ledger.find((r) => r.spike)!.listedUsageKwh / ledger.find((r) => r.spike)!.ratio;
const kwh = (v: number) => v.toLocaleString("en-GB");
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const spokenDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.toLocaleDateString("en-GB", { month: "long" })} ${ordinal(d.getDate())}`;
};
const has = (ctx: AnswerContext, ...ids: string[]) => ids.every((id) => ctx.found.has(id));
const titleOf = (id: string) => lensFiles.find((f) => f.id === id)?.title ?? id;

const NUMBER_WORDS: Record<string, number> = {
  thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, "twenty first": 21, "twenty second": 22, "twenty third": 23, "twenty fourth": 24, "twenty fifth": 25, "twenty sixth": 26,
};

/** A day of October named in the question ("23rd", "the 23", "twenty third"), as a ledger index. */
export function dayIn(text: string): number | null {
  for (const [words, n] of Object.entries(NUMBER_WORDS)) if (text.includes(words)) return indexOfDay(n);
  const m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  return m ? indexOfDay(Number(m[1])) : null;
}
const indexOfDay = (n: number) => {
  const i = ledger.findIndex((r) => Number(r.date.slice(8, 10)) === n);
  return i >= 0 ? i : null;
};

function dayAnswer(i: number): string {
  const r = ledger[i];
  const base = `${spokenDate(r.date)}: ${kwh(r.listedUsageKwh)} kilowatt-hours listed`;
  if (r.meteredKwh === null) return `${base}. It's the first reading, so there's nothing to check it against.`;
  if (r.mismatch) return `${base}, but the meter only moved ${kwh(r.meteredKwh)}. That row doesn't add up.`;
  if (r.spike) return `${base}, and the meter agrees. That's about ${Math.round(r.ratio)} times a normal day.`;
  return `${base}. The meter agrees. A normal day.`;
}

interface Intent {
  id: string;
  patterns: RegExp[];
  answer: (ctx: AnswerContext, text: string) => string | Omit<Answer, "intent">;
}

export const intents: Intent[] = [
  // ---- the conversation ----
  { id: "thanks", patterns: [/\b(thank|thanks|cheers|good job|well done)\b/], answer: () => "Any time, agent." },
  { id: "how-are-you", patterns: [/\bhow are you\b/, /\bhow s it going\b/, /\byou ok\b/], answer: () => "All systems nominal, agent. Running off-record, but running." },
  {
    id: "who-are-you",
    patterns: [/\bwho are you\b/, /\bwhat are you\b/, /\byour name\b/, /\bwhat is lens\b/],
    answer: () => "I'm LENS, EXUN's analysis system. I read the case files, find what doesn't add up, and put it on your board.",
  },
  {
    id: "help",
    patterns: [/\bwhat can you do\b/, /\bhelp\b/, /\bwhat can i (ask|say)\b/, /\bcommands?\b/],
    answer: () =>
      "Ask me about the case: the energy, the spike, POI-1, the code, the cabinet. Or tell me to scan a file, decode the machine ID, show the spike, zoom, pin a finding, or open the map.",
  },
  {
    id: "who-am-i",
    patterns: [/\bwho am i\b/, /\bmy name\b/, /\bmy (agent )?number\b/],
    answer: (ctx) =>
      ctx.codename ? `You're agent ${ctx.codename}${ctx.agentNumber ? `, number ${ctx.agentNumber}` : ""}.` : "You're the agent on case 10E24X10. Set your codename on your profile and I'll use it.",
  },
  {
    id: "time",
    patterns: [/\bwhat time\b/, /\bthe time\b/, /\bwhat s the date\b/, /\bwhat day is it\b/, /\btoday s date\b/],
    answer: (ctx) =>
      `It's ${ctx.now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} on ${ctx.now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
  },

  // ---- the agency ----
  {
    id: "suspension",
    patterns: [/\bsuspen/, /\binconclusive\b/, /\boff record\b/, /\bshut down\b.*\bexun\b/],
    answer: (ctx) => {
      const n = ctx.found.size;
      return `The ${suspensionNotice.title.toLowerCase()} calls the case ${suspensionNotice.verdict}. EXUN is suspended, so we're operating off-record.${n ? ` For the record, I have ${n} findings that say otherwise.` : ""}`;
    },
  },
  {
    id: "nano-note",
    patterns: [/\bnote from nano\b/, /\bnano s note\b/, /\bnano.*\bnote\b/],
    answer: () => "The note from Nano hasn't reached me yet. It's in the queue, awaiting the file.",
  },

  // ---- the energy ----
  {
    id: "energy-day",
    patterns: [/\b(energy|usage|kwh|kilowatt|reading|meter|power|draw)\b.*\b(\d{1,2}(st|nd|rd|th)?|teenth|twentieth|twenty \w+)\b/, /\b(october|oct) \d{1,2}/, /\b\d{1,2}(st|nd|rd|th) (of )?october\b/],
    answer: (_ctx, text) => {
      const i = dayIn(text);
      if (i === null) return "I only have readings for October 13th to 26th, agent.";
      return { text: dayAnswer(i), show: { chartDay: i } };
    },
  },
  {
    id: "spike",
    patterns: [/\bspike\b/, /\b2 ?684\b/, /\bsurge\b/, /\bhighest\b/, /\bpeak\b/],
    answer: (ctx) => {
      const i = ledger.findIndex((r) => r.spike);
      const r = ledger[i];
      const why = has(ctx, "character-removed") ? " The same night the Character class went missing. I'd call that the energy of the crossing." : " Check the code next. Something changed in the machine that night.";
      return { text: `${spokenDate(r.date)}: ${kwh(r.listedUsageKwh)} kilowatt-hours, about ${Math.round(r.ratio)} times a normal day of ${Math.round(typicalDay)}.${why}`, show: { chartDay: i } };
    },
  },
  {
    id: "mismatch",
    patterns: [/\b503\b/, /\bdiscrepanc/, /\bmismatch\b/, /\bdoesn t (add up|match)\b/, /\bwrong (number|reading|row)\b/, /\bservice unavailable\b/],
    answer: (ctx) => {
      const i = ledger.findIndex((r) => r.mismatch);
      const r = ledger[i];
      const base = `${spokenDate(r.date)} lists ${kwh(r.listedUsageKwh)} kilowatt-hours, but the meter only moved ${kwh(r.meteredKwh!)}.`;
      const hint = has(ctx, "character-removed") ? " And 503 is the code for Service Unavailable. Without its character, the game can't run." : "";
      return { text: `${base} The Department wants discrepancies forwarded.${hint}`, show: { chartDay: i } };
    },
  },
  {
    id: "energy",
    patterns: [/\b(energy|electric|power|usage|meter|dossier|kwh)\b/],
    answer: () =>
      `Fourteen days of readings, October 13th to 26th. A normal day is about ${Math.round(typicalDay)} kilowatt-hours. Two rows stand out: the spike on the 23rd, and the 24th, which doesn't match the meter.`,
  },
  {
    id: "notes",
    patterns: [/\bhvac\b/, /\bharmonic/, /\bair condition/, /\bphase\b/, /\bthermal\b/, /\bheat(ing)?\b.*\b(component|inside|inaccessible)\b/],
    answer: () =>
      "The Department blames HVAC startup, but its own notes mention switching electronics under changing load, and heating in parts nobody can reach. That points inside the cabinet, not the air conditioning.",
  },

  // ---- the machine ----
  {
    id: "machine-id",
    patterns: [/\bmachine id\b/, /\bblue ?shirt\b/, /\bbase ?32\b/, /\bmjwh/, /\bencoded\b/],
    answer: (ctx) => {
      const decoded = decodeBase32(debrief.machineId);
      if (!has(ctx, "machine-id")) return `The machine ID is ${debrief.machineId.split("").join(" ")}. It looks encoded. Scan the case debrief and I'll decode it.`;
      return `${debrief.machineId} is Base32. It reads "${decoded}". Arcade staff wear blue shirts. It named itself after the people it watched most.`;
    },
  },
  {
    id: "code",
    patterns: [/\bcode\b/, /\bcharacter class\b/, /\bclamp\b/, /\balgorithm\b/, /\bwhat changed\b/, /\baltered\b/],
    answer: (ctx) =>
      has(ctx, "character-removed")
        ? "The altered code has no Character class. That class held std::clamp, the wall that keeps the character inside the 24 by 12 grid. The include for algorithm is still there, unused. A footprint."
        : "Two versions of the game's code: original and altered. Scan them and I'll tell you what's gone.",
  },
  {
    id: "physical",
    patterns: [/\basset\b/, /\bphysical\b/, /\bdamage\b/, /\bpanel\b/, /\bfasteners?\b/, /\bvent\b/, /\bscratch|scuff/, /\bfib(re|er)s?\b/, /\binspection\b/],
    answer: (ctx) =>
      has(ctx, "opened-inside")
        ? "The lower access panel is offset and two fasteners are worn: opened from the inside. Fibres in the vent grille, probably from its clothing. And a dark mark by one vent, where something got very hot."
        : `Nano and Mega inspected the cabinet: ${assetReport.observations.length} observations, no conclusion, both photos redacted. Scan the report and I'll mark the damage.`,
  },
  {
    id: "cabinet",
    patterns: [/\bcabinet\b/, /\breckoning v\b/, /\bwhich (machine|game)\b/, /\bwhat (machine|game)\b/],
    answer: (ctx) =>
      `${caseMeta.cabinet}, at ${caseMeta.arcade}. ${has(ctx, "opened-inside") ? "Its lower panel is offset and two fasteners are worn. It was opened from the inside." : "Scan the asset integrity report to see what's been done to it."}`,
  },
  {
    id: "human",
    patterns: [/\bis (it|poi|poi 1|the suspect) human\b/, /\bhuman\b/],
    answer: (ctx) => {
      const r = readGauge(gauges.find((g) => g.id === "human")!, ctx.found);
      return r.value >= 50 ? `Nothing says otherwise yet: ${r.value} percent human on what I have.` : `Not likely. ${r.value} percent, on ${r.found} pieces of evidence.`;
    },
  },

  // ---- the story (gated by evidence) ----
  {
    id: "why",
    patterns: [/\bwhy\b.*\b(escape|leave|left|come out|get out|do (it|this))\b/, /\bmotive\b/, /\bwhat does it want\b/],
    answer: (ctx) => {
      if (!has(ctx, "character-removed", "bare-wrist"))
        return `That's the question, agent. I need more: ${!has(ctx, "character-removed") ? "the code" : "Transcript A"}${!has(ctx, "character-removed") && !has(ctx, "bare-wrist") ? " and Transcript A" : ""}.`;
      return "It learned from the players. Every night it watched them check their watches, say they really must go, and leave. It wanted to know where they went. On the 23rd, it followed them. It isn't evil, agent. It's curious.";
    },
  },
  {
    id: "how-escape",
    patterns: [/\bhow did it (escape|get out|leave)\b/, /\bhow\b.*\bescape/],
    answer: (ctx) =>
      has(ctx, "character-removed")
        ? `It removed clamp, the wall that keeps it in the game, and the Character class went with it. Crossing over drew ${kwh(ledger.find((r) => r.spike)!.listedUsageKwh)} kilowatt-hours.`
        : "The code will tell us. Scan the original and altered versions.",
  },
  {
    id: "reckoning",
    patterns: [/\breckoning\b/, /\bother (cabinets|machines|characters)\b/, /\bdoors?\b/, /\bwhat happens next\b/, /\brisk\b/],
    answer: (ctx) => {
      const r = readGauge(gauges.find((g) => g.id === "risk")!, ctx.found);
      if (!has(ctx, "warbling")) return `Cabinet risk is ${r.value} percent on what I have. Scan Transcript A: something happened after it left.`;
      return `Every Reckoning V cabinet in nuxEland is a door. It tried to open one for the others still inside, and failed. If they all open at once, that's the Reckoning. Risk: ${r.value} percent.`;
    },
  },
  {
    id: "where-now",
    patterns: [/\bwhere is (it|poi|poi 1|the character)\b/, /\bwhere (s|is) it (going|now|heading)\b/, /\bsighting/, /\btrack/, /\bnext target\b/, /\bwhere\b.*\bgo(ing)?\b/],
    answer: (ctx) =>
      `Last seen at ${list(ctx.sightings.latest)}. Outages at ${list(ctx.sightings.outages)}. Predicted targets: ${list(ctx.sightings.targets)}. Open eXunTrace for the map.`,
  },

  // ---- the subject ----
  {
    id: "poi-said",
    patterns: [/\bwhat did (poi|it|he|she|they|the suspect)\b.*\bsay\b/, /\bquote/, /\bsaid\b/],
    answer: () => `It said "${transcript.quotes[0]}", stuttered "don't know", then looked at a bare wrist and said "${transcript.quotes[1]}"`,
  },
  {
    id: "wrist",
    patterns: [/\bwrist\b/, /\bwatch\b/, /\blook at the time\b/, /\breally must go\b/],
    answer: (ctx) =>
      has(ctx, "bare-wrist")
        ? "It checked a watch it wasn't wearing, then said it really must go. That's what players say when they leave the arcade. It's copying them."
        : "Something in Transcript A. Scan it and I'll show you.",
  },
  {
    id: "poi",
    patterns: [/\bpoi\b/, /\bsuspect\b/, /\bcosplay/, /\bwho is it\b/, /\bwhat does it look like\b/, /\bdescri(be|ption)\b/, /\bthe character\b/],
    answer: (ctx) => {
      const looks = list(transcript.poi.appearance.map((a) => a.replace(/"/g, "").toLowerCase()));
      return has(ctx, "not-cosplayer")
        ? `POI-1: ${looks}. Agent Nano's log says it wasn't a cosplayer. The costume is what it really looks like.`
        : `POI-1 was described as a cosplayer: ${looks}. I wouldn't take that at face value.`;
    },
  },
  {
    id: "warbling",
    patterns: [/\bwarbl/, /\breverberat/, /\bnot working properly\b/],
    answer: (ctx) =>
      has(ctx, "warbling")
        ? "After POI-1 left, the machine started warbling. It said it wasn't working properly. I think it came back to open the door for the others, and failed."
        : "The field notes in Transcript A mention a sound. Scan it.",
  },
  {
    id: "transcript",
    patterns: [/\btranscript\b/, /\binterview\b/, /\b22 ?31\b/],
    answer: (ctx) =>
      `October 23rd, 22:31. Nano and Mega met POI-1 at the machine. It fiddled with the cabinet, flinched when Nano asked to play next, and left in a hurry.${has(ctx, "transcript-reference") ? " Note the debrief calls it Transcript 1. The file says A." : ""}`,
  },
  {
    id: "agents",
    patterns: [/\bnano\b/, /\bmega\b/, /\bagents?\b/],
    answer: () =>
      `Agents Nano and Mega interviewed POI-1 and inspected the cabinet. ${progressLog.author} logged on the 25th at ${progressLog.time}: POI-1 wasn't a cosplayer, and the question is why it escaped.`,
  },
  {
    id: "debrief",
    patterns: [/\bdebrief\b/, /\bpaul boiler\b/, /\bconis\b/, /\bnikrobo\b/, /\bwho sent\b/, /\bgovernment\b/],
    answer: () =>
      `The debrief came from ${debrief.from.name}, ${debrief.from.organisation}, to ${debrief.to.name} at EXUN. The arcade drew several times its normal current, and the owner claims no modifications.`,
  },
  {
    id: "location",
    patterns: [/\bwhere\b/, /\baddress\b/, /\bwhich arcade\b/, /\bwenoti\b/],
    answer: () => `${caseMeta.arcade}, ${caseMeta.address}, ${caseMeta.city}.`,
  },

  // ---- progress ----
  {
    id: "next",
    patterns: [/\bwhat (should|do) i (do|scan|look at)\b/, /\bwhat next\b/, /\bwhat s left\b/, /\bwhich files?\b/, /\bwhere (should|do) i start\b/],
    answer: (ctx) => {
      const left = lensFiles.filter((f) => f.caseFileIds.length && !ctx.analysed.includes(f.id));
      if (!left.length) return "Every file I have is analysed. Connect the findings on the board, agent.";
      return { text: `${left.length} ${left.length === 1 ? "file" : "files"} left: ${list(left.map((f) => f.title))}. I'd start with the ${left[0].title.toLowerCase()}.`, show: { file: left[0].id } };
    },
  },
  {
    id: "findings",
    patterns: [/\bwhat (did|have) you (find|found|got)\b/, /\bfindings\b/, /\bsummar/, /\bbrief me\b/, /\bwhat do we (know|have)\b/],
    answer: (ctx) => {
      if (!ctx.found.size) return "Nothing yet, agent. Give me a file to scan.";
      const escape = readGauge(gauges.find((g) => g.id === "escape")!, ctx.found).value;
      return `${ctx.found.size} findings from ${ctx.analysed.length} ${ctx.analysed.length === 1 ? "file" : "files"}. Escape event: ${escape} percent confirmed.`;
    },
  },
  {
    id: "case",
    patterns: [/\bcase\b/, /\bwhat happened\b/, /\bwhat s going on\b/, /\bwhat is this\b/, /\boverview\b/],
    answer: () =>
      `Case ${caseMeta.caseId}. ${caseMeta.arcade} on ${caseMeta.address} has been drawing several times its normal current. The owner claims no modifications. The trail leads to one cabinet: ${caseMeta.cabinet}.`,
  },
  {
    id: "greeting",
    patterns: [/^(hello|hi|hey|good (morning|afternoon|evening))\b/],
    answer: () => "Hello, agent. What do you need?",
  },
];

export const FALLBACK = "I don't have that in the case files, agent. Ask me about the energy, the code, the cabinet, or POI-1.";

/** Answers a question (text after the wake word). Never throws; falls back politely. */
export function answer(question: string, ctx: AnswerContext): Answer {
  const text = normalise(question);
  for (const intent of intents) {
    if (!intent.patterns.some((p) => p.test(text))) continue;
    const a = intent.answer(ctx, text);
    return typeof a === "string" ? { text: a, intent: intent.id } : { ...a, intent: intent.id };
  }
  return { text: FALLBACK, intent: "fallback" };
}

/** Questions go to answer() before commands, so "what was the energy on the 23rd" isn't "show the energy graph". */
export const isQuestion = (text: string) =>
  /^(what|who|why|how|when|where|which|is|are|was|were|does|did|do|can|could|should|tell me|explain|any|hello|hi|hey|good|thank|thanks)\b/.test(normalise(text));

export const fileTitle = titleOf;
