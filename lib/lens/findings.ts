import {
  assetReport,
  caseFiles,
  caseMeta,
  debrief,
  energyDossier,
  pendingFiles,
  progressLog,
  transcript,
  type CaseFileId,
} from "@/lib/case";
import type { FindingRecord } from "@/lib/data";
import { decodeBase32, looksLikeBase32 } from "./base32";
import { checkLedger } from "./ledger";

// What EXUN Lens finds in each case file. Findings are computed from the case data in
// lib/case (the meter check, Base32, cross-file comparisons); nothing here is a stored
// conclusion. TODO(lens-engine): once the original PDFs and code files are in
// public/case-files, OCR and the code diff read the files themselves.

/** One row of the evidence queue. The two code files are analysed together. */
export interface LensFile {
  id: string;
  title: string;
  /** Case files this entry opens. Empty while its file hasn't been supplied. */
  caseFileIds: CaseFileId[];
}

const title = (id: CaseFileId) => caseFiles.find((f) => f.id === id)!.title;

export const lensFiles: LensFile[] = [
  { id: "debrief", title: title("debrief"), caseFileIds: ["debrief"] },
  { id: "energy-dossier", title: title("energy-dossier"), caseFileIds: ["energy-dossier"] },
  { id: "transcript-a", title: title("transcript-a"), caseFileIds: ["transcript-a"] },
  { id: "code", title: "Original vs altered code", caseFileIds: ["original-code", "altered-code"] },
  { id: "asset-report", title: title("asset-report"), caseFileIds: ["asset-report"] },
  { id: "progress-log", title: title("progress-log"), caseFileIds: ["progress-log"] },
  ...pendingFiles.map((f) => ({ id: f.id, title: f.title, caseFileIds: [] })),
];

export const getLensFile = (id: string) => lensFiles.find((f) => f.id === id);

const fmt = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const spokenDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

function finding(f: Omit<FindingRecord, "data"> & { data?: Record<string, unknown>; say: string }): FindingRecord {
  const { say, data = {}, ...rest } = f;
  return { ...rest, data: { ...data, say } };
}

function analyseDebrief(): FindingRecord[] {
  const out: FindingRecord[] = [];
  if (looksLikeBase32(debrief.machineId)) {
    const decoded = decodeBase32(debrief.machineId);
    if (decoded)
      out.push(
        finding({
          id: "machine-id",
          type: "encoded",
          title: "Machine ID decodes to text",
          detail: `${debrief.machineId} → ${decoded}`,
          severity: "notice",
          data: { encoded: debrief.machineId, decoded },
          say: `Agent, the machine ID is Base32. It reads "${decoded}".`,
        }),
      );
  }
  if (debrief.transcriptReference !== transcript.title)
    out.push(
      finding({
        id: "transcript-reference",
        type: "inconsistency",
        title: "Debrief cites another transcript",
        detail: `"${debrief.transcriptReference}" cited, file is "${transcript.title}"`,
        severity: "info",
        data: { cited: debrief.transcriptReference, actual: transcript.title },
        say: `The debrief cites ${debrief.transcriptReference}. The file is ${transcript.title}.`,
      }),
    );
  return out;
}

function analyseDossier(): FindingRecord[] {
  const rows = checkLedger(energyDossier.readings);
  const out: FindingRecord[] = [];
  for (const r of rows.filter((r) => r.mismatch))
    out.push(
      finding({
        id: `meter-${r.date}`,
        type: "discrepancy",
        title: `${shortDate(r.date)} doesn't match the meter`,
        detail: `${fmt(r.listedUsageKwh)} listed / ${fmt(r.meteredKwh!)} metered`,
        severity: "critical",
        data: { date: r.date, listed: r.listedUsageKwh, metered: r.meteredKwh },
        say: `Agent, ${spokenDate(r.date)} doesn't match the meter.`,
      }),
    );
  for (const r of rows.filter((r) => r.spike))
    out.push(
      finding({
        id: `spike-${r.date}`,
        type: "discrepancy",
        title: `${shortDate(r.date)} spike: ${fmt(r.listedUsageKwh)} kWh`,
        detail: `about ${Math.round(r.ratio)}× a typical day`,
        severity: "notice",
        data: { date: r.date, kwh: r.listedUsageKwh, ratio: r.ratio },
        say: `${spokenDate(r.date)} drew about ${Math.round(r.ratio)} times a normal day.`,
      }),
    );
  const electronics = energyDossier.notes.filter((n) => /harmonic|inaccessible/i.test(n));
  if (electronics.length)
    out.push(
      finding({
        id: "notes-electronics",
        type: "inconsistency",
        title: "Notes point inside the cabinet",
        detail: "switching electronics, heat in inaccessible parts",
        severity: "info",
        data: { notes: electronics },
        say: "The Department's notes point to electronics, not the air conditioning.",
      }),
    );
  return out;
}

function analyseTranscript(): FindingRecord[] {
  const out: FindingRecord[] = [];
  const wrist = transcript.events.find((e) => /wrist/i.test(e));
  const leaving = transcript.quotes.find((q) => /look at the time/i.test(q));
  if (wrist && leaving)
    out.push(
      finding({
        id: "bare-wrist",
        type: "text",
        title: "Checks a bare wrist",
        detail: `then: "${leaving}"`,
        severity: "notice",
        data: { event: wrist, quote: leaving },
        say: "POI-1 checked a watch it wasn't wearing.",
      }),
    );
  const warble = transcript.fieldObservations.find((o) => /warbling/i.test(o));
  if (warble)
    out.push(
      finding({
        id: "warbling",
        type: "text",
        title: "Machine warbled after POI-1 left",
        detail: `at ${transcript.time}, "${transcript.quotes[0]}"`,
        severity: "notice",
        data: { observation: warble },
        say: "The machine started warbling after POI-1 left.",
      }),
    );
  return out;
}

function analyseCode(): FindingRecord[] {
  // TODO(lens-engine): diff OriginalCode.txt against AlteredCode.txt once both are in
  // public/case-files. Until then these restate the code facts in CLAUDE.md.
  return [
    finding({
      id: "character-removed",
      type: "code-change",
      title: "Character class removed",
      detail: "std::clamp went with it: no wall",
      severity: "critical",
      data: { removed: ["class Character", "std::clamp"], source: "case-data" },
      say: "The Character class is gone. Nothing keeps it inside the game.",
    }),
    finding({
      id: "algorithm-footprint",
      type: "code-change",
      title: "#include <algorithm> unused",
      detail: "only std::clamp ever used it",
      severity: "notice",
      data: { line: "#include <algorithm>", source: "case-data" },
      say: "An unused include was left behind. A footprint.",
    }),
  ];
}

function analyseAssetReport(): FindingRecord[] {
  const has = (re: RegExp) => assetReport.observations.find((o) => re.test(o));
  const out: FindingRecord[] = [];
  const panel = has(/access panel/i);
  const fasteners = has(/fasteners/i);
  if (panel && fasteners)
    out.push(
      finding({
        id: "opened-inside",
        type: "physical",
        title: "Opened from the inside",
        detail: "panel offset, worn fasteners",
        severity: "critical",
        data: { observations: [panel, fasteners] },
        say: "The cabinet was opened from the inside.",
      }),
    );
  const fibres = has(/fibrous/i);
  if (fibres)
    out.push(
      finding({
        id: "vent-fibres",
        type: "physical",
        title: "Fibres in the vent grille",
        detail: "fibrous debris on the ventilation grille",
        severity: "notice",
        data: { observation: fibres },
        say: "There are fibres caught in the vent.",
      }),
    );
  const heat = has(/darkening/i);
  if (heat)
    out.push(
      finding({
        id: "vent-heat",
        type: "physical",
        title: "Heat mark near a vent",
        detail: "localised darkening",
        severity: "notice",
        data: { observation: heat },
        say: "Something hot came out near that vent.",
      }),
    );
  if (assetReport.redactedPhotos)
    out.push(
      finding({
        id: "photos-redacted",
        type: "redaction",
        title: `${assetReport.redactedPhotos} photos redacted`,
        detail: assetReport.conclusion.toLowerCase(),
        severity: "info",
        data: { count: assetReport.redactedPhotos },
        say: `Both photos are redacted, and no conclusion was drawn.`,
      }),
    );
  return out;
}

function analyseProgressLog(): FindingRecord[] {
  return [
    finding({
      id: "not-cosplayer",
      type: "text",
      title: "POI-1 wasn't a cosplayer",
      detail: `${progressLog.author}, ${shortDate(progressLog.date)} ${progressLog.time}`,
      severity: "critical",
      data: { entries: progressLog.entries },
      say: `${progressLog.author} agrees. POI-1 wasn't a cosplayer.`,
    }),
  ];
}

const analysers: Record<string, () => FindingRecord[]> = {
  debrief: analyseDebrief,
  "energy-dossier": analyseDossier,
  "transcript-a": analyseTranscript,
  code: analyseCode,
  "asset-report": analyseAssetReport,
  "progress-log": analyseProgressLog,
};

/** Findings for one queue entry. Empty for files that haven't been supplied. */
export function analyseFile(id: string): FindingRecord[] {
  return analysers[id]?.() ?? [];
}

export const subject = caseMeta.arcade;
