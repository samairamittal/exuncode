import type {
  AssetReport,
  CaseMeta,
  CodeFiles,
  Debrief,
  EnergyDossier,
  ProgressLog,
  Transcript,
} from "./types";

// Transcribed from the "Case data" section of CLAUDE.md. Nothing here is derived:
// discrepancies (e.g. the Oct 24 usage) are for EXUN Lens to compute, not to store.

export const caseMeta: CaseMeta = {
  caseId: "10E24X10",
  arcade: "Wenoti Arcade",
  address: "92nd Avenue",
  city: "nuxEland",
  cabinet: "The Reckoning V: Origins",
};

export const debrief: Debrief = {
  from: { name: "Paul Boiler", organisation: "Government of nuxEland" },
  to: {
    name: "Conis Nikrobo",
    organisation: "Extradigital Exceptions and Unknowns Network",
    parent: "etiNuxe Intelligence Agency",
  },
  summary: [
    "Wenoti Arcade, 92nd Avenue, nuxEland, has been drawing multiple times its typical current from the district supply.",
    "The owner reported the surges and claims no modifications.",
    "The transcript suggests a connection to the arcade machine \"The Reckoning V: Origins\".",
    "Run forensics and comparative analysis of physical and digital evidence.",
  ],
  transcriptReference: "Transcript 1",
  machineId: "MJWHKZLTNBUXE5A",
};

export const energyDossier: EnergyDossier = {
  from: "Department of Electricity",
  requestedBy: ["Agent Nano", "Agent Mega"],
  notes: [
    "HVAC compressor startup",
    "Elevated harmonic content compatible with switching electronics under changing load",
    "Minor phase imbalance",
    "No thermal excursion at accessible points, but localised heating in inaccessible components isn't excluded",
    "Discrepancies must be forwarded to the Department",
  ],
  readings: [
    { day: 1, date: "2026-10-13", readingKwh: 18477.2, listedUsageKwh: 24.6 },
    { day: 2, date: "2026-10-14", readingKwh: 18505.3, listedUsageKwh: 28.1 },
    { day: 3, date: "2026-10-15", readingKwh: 18528.2, listedUsageKwh: 22.9 },
    { day: 4, date: "2026-10-16", readingKwh: 18559.6, listedUsageKwh: 31.4 },
    { day: 5, date: "2026-10-17", readingKwh: 18586.3, listedUsageKwh: 26.7 },
    { day: 6, date: "2026-10-18", readingKwh: 18621.5, listedUsageKwh: 35.2 },
    { day: 7, date: "2026-10-19", readingKwh: 18651.3, listedUsageKwh: 29.8 },
    { day: 8, date: "2026-10-20", readingKwh: 18674.8, listedUsageKwh: 23.5 },
    { day: 9, date: "2026-10-21", readingKwh: 18702.4, listedUsageKwh: 27.6 },
    { day: 10, date: "2026-10-22", readingKwh: 18727.5, listedUsageKwh: 25.1 },
    { day: 11, date: "2026-10-23", readingKwh: 21411.5, listedUsageKwh: 2684.0 },
    { day: 12, date: "2026-10-24", readingKwh: 21442.2, listedUsageKwh: 503.2 },
    { day: 13, date: "2026-10-25", readingKwh: 21464.0, listedUsageKwh: 21.8 },
    { day: 14, date: "2026-10-26", readingKwh: 21492.9, listedUsageKwh: 28.9 },
  ],
};

export const transcript: Transcript = {
  title: "Transcript A",
  date: "2026-10-23",
  time: "22:31",
  formId: "10E24X10",
  participants: ["[REDACTED] (Agent Nano)", "[REDACTED] (Agent Mega)", "POI-1"],
  poi: {
    id: "POI-1",
    description: "Described as a cosplayer",
    appearance: ["Sharp ears", "Leather gloves and boots", "\"Bedazzled armour\"", "Scabbard at the waist"],
  },
  events: [
    "POI-1 fiddles with the machine",
    "POI-1 flinches when Nano asks to play next",
    "POI-1 stutters \"don't know\"",
    "POI-1 looks at a bare wrist",
    "POI-1 leaves",
  ],
  quotes: ["It is not working properly", "Oh! Look at the time! Really must go"],
  fieldObservations: ["The machine began \"warbling\" and \"reverberating\" afterwards"],
};

export const codeFiles: CodeFiles = {
  language: "cpp",
  grid: { width: 24, height: 12 },
  playerGlyph: "@",
  controls: { move: "WASD", quit: "q" },
  originalFileId: "original-code",
  alteredFileId: "altered-code",
};

export const assetReport: AssetReport = {
  inspectedBy: ["Agent Nano", "Agent Mega"],
  observations: [
    "Scratches and abrasions on the casing",
    "Lower access panel slightly offset",
    "Dust and fibrous debris on the ventilation grille",
    "Localised darkening near one vent",
    "Cosmetic wear on two externally accessible fasteners",
  ],
  conclusion: "No conclusion was drawn.",
  redactedPhotos: 2,
};

export const progressLog: ProgressLog = {
  author: "Agent Nano",
  date: "2026-10-25",
  time: "23:54",
  entries: [
    "POI-1 wasn't a cosplayer.",
    "A character class is missing from the code, so the character escaped.",
    "The question is why.",
  ],
};
