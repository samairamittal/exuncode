export type CaseFileId =
  | "debrief"
  | "energy-dossier"
  | "transcript-a"
  | "original-code"
  | "altered-code"
  | "asset-report"
  | "progress-log";

export type CaseFileKind = "pdf" | "txt" | "image";

export interface CaseFile {
  id: CaseFileId;
  title: string;
  fileName: string;
  kind: CaseFileKind;
  /** Public URL under /case-files. */
  url: string;
}

export interface CaseMeta {
  caseId: string;
  arcade: string;
  address: string;
  city: string;
  cabinet: string;
}

export interface Debrief {
  from: { name: string; organisation: string };
  to: { name: string; organisation: string; parent: string };
  summary: string[];
  /** How the debrief refers to the transcript (note: the file itself is "Transcript A"). */
  transcriptReference: string;
  machineId: string;
}

export interface MeterReading {
  day: number;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  readingKwh: number;
  /** Daily usage as listed in the dossier, not recomputed. */
  listedUsageKwh: number;
}

export interface EnergyDossier {
  from: string;
  requestedBy: string[];
  notes: string[];
  readings: MeterReading[];
}

export interface Transcript {
  title: string;
  date: string;
  time: string;
  formId: string;
  participants: string[];
  poi: { id: string; description: string; appearance: string[] };
  events: string[];
  quotes: string[];
  fieldObservations: string[];
}

export interface CodeFiles {
  language: "cpp";
  grid: { width: number; height: number };
  playerGlyph: string;
  controls: { move: string; quit: string };
  originalFileId: CaseFileId;
  alteredFileId: CaseFileId;
}

export interface AssetReport {
  inspectedBy: string[];
  observations: string[];
  conclusion: string;
  redactedPhotos: number;
}

export interface ProgressLog {
  author: string;
  date: string;
  time: string;
  entries: string[];
}
