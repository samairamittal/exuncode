import { assetReport, caseMeta, debrief, energyDossier, progressLog, transcript } from "@/lib/case";
import { checkLedger, getLensFile, type LedgerRow } from "@/lib/lens";

// What the core shows for each queue entry: the dossier as its table, every other file as
// a page of lines taken from lib/case. TODO(case-files): render the original PDFs instead.

export type LensDocument =
  | { kind: "table"; title: string; subtitle: string; rows: LedgerRow[] }
  | { kind: "text"; title: string; subtitle: string; lines: string[] };

const LINE = 50; // characters per line at 12px on the sheet

/** Wraps text to LINE characters (the sheet is monospace, so this is exact). */
function wrap(text: string): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > LINE) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

const page = (paragraphs: string[]) => paragraphs.flatMap(wrap);

/** The dossier rows shown on the sheet (the last week, as in lens1). */
const TABLE_ROWS = 7;

export function documentFor(id: string): LensDocument {
  switch (id) {
    case "energy-dossier":
      return {
        kind: "table",
        title: "Energy usage dossier",
        subtitle: `${energyDossier.from} / ${caseMeta.arcade}`,
        rows: checkLedger(energyDossier.readings).slice(-TABLE_ROWS),
      };
    case "debrief":
      return {
        kind: "text",
        title: "Case debrief",
        subtitle: `${debrief.from.name}, ${debrief.from.organisation}`,
        lines: page([...debrief.summary, `Machine ID: ${debrief.machineId}`]),
      };
    case "transcript-a":
      return {
        kind: "text",
        title: transcript.title,
        subtitle: `${transcript.date} ${transcript.time} / form ${transcript.formId}`,
        lines: page([...transcript.events, ...transcript.quotes.map((q) => `"${q}"`)]),
      };
    case "code":
      return {
        kind: "text",
        title: "Original vs altered code",
        subtitle: "C++ console game, 24 x 12 grid",
        lines: page([
          "Original: class Character keeps @ inside the grid with std::clamp.",
          "Altered: no class Character.",
          "Altered: #include <algorithm> is still there.",
        ]),
      };
    case "asset-report":
      return {
        kind: "text",
        title: "Asset integrity report",
        subtitle: `Inspected by ${assetReport.inspectedBy.join(" and ")}`,
        lines: page([...assetReport.observations, assetReport.conclusion]),
      };
    case "progress-log":
      return {
        kind: "text",
        title: "Progress assessment log",
        subtitle: `${progressLog.author}, ${progressLog.date} ${progressLog.time}`,
        lines: page(progressLog.entries),
      };
    default:
      return {
        kind: "text",
        title: getLensFile(id)?.title ?? "Unknown file",
        subtitle: "File not received",
        lines: ["This file hasn't been supplied to EXUN yet."],
      };
  }
}

/** Lines per page on the sheet. */
export const PAGE_LINES = 10;

export const pageCount = (doc: LensDocument) => (doc.kind === "text" ? Math.max(1, Math.ceil(doc.lines.length / PAGE_LINES)) : 1);
