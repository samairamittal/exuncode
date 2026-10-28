// Story documents the team added (see "Our storyline" in CLAUDE.md). Their files aren't in
// public/case-files yet, so only what the team has stated about them is recorded here.

export const suspensionNotice = {
  title: "Suspension notice",
  /** The notice's verdict on the case, as stated by the team. */
  verdict: "inconclusive",
  /** EXUN's status after the notice. */
  status: "EXUN suspended",
  mode: "Operating off-record",
} as const;

/** Queue entries whose files haven't been supplied yet. TODO(case-files): add the files and their contents. */
export const pendingFiles = [
  { id: "suspension-notice", title: "Suspension notice" },
  { id: "nano-note", title: "Note from Nano" },
] as const;
