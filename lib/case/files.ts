import type { CaseFile, CaseFileId } from "./types";

// TODO(case-files): the PDF file names are provisional until the originals are
// added to public/case-files. The two .txt names come from CLAUDE.md.
export const caseFiles: readonly CaseFile[] = [
  { id: "debrief", title: "Case debrief", fileName: "CaseDebrief.pdf", kind: "pdf", url: "/case-files/CaseDebrief.pdf" },
  { id: "energy-dossier", title: "Energy usage dossier", fileName: "EnergyUsageDossier.pdf", kind: "pdf", url: "/case-files/EnergyUsageDossier.pdf" },
  { id: "transcript-a", title: "Transcript A", fileName: "TranscriptA.pdf", kind: "pdf", url: "/case-files/TranscriptA.pdf" },
  { id: "original-code", title: "Original code", fileName: "OriginalCode.txt", kind: "txt", url: "/case-files/OriginalCode.txt" },
  { id: "altered-code", title: "Altered code", fileName: "AlteredCode.txt", kind: "txt", url: "/case-files/AlteredCode.txt" },
  { id: "asset-report", title: "Asset integrity report", fileName: "AssetIntegrityReport.pdf", kind: "pdf", url: "/case-files/AssetIntegrityReport.pdf" },
  { id: "progress-log", title: "Progress assessment log", fileName: "ProgressAssessmentLog.pdf", kind: "pdf", url: "/case-files/ProgressAssessmentLog.pdf" },
];

export function getCaseFile(id: CaseFileId): CaseFile {
  const file = caseFiles.find((f) => f.id === id);
  if (!file) throw new Error(`Unknown case file: ${id}`);
  return file;
}
