// Shapes persisted by the data layer. A backend must accept and return exactly these.

export type ISODateString = string;

export type FindingType =
  | "discrepancy"
  | "encoded"
  | "code-change"
  | "physical"
  | "inconsistency"
  | "redaction"
  | "text";

export type Severity = "info" | "notice" | "critical";

/** Box in fractions (0–1) of the page, so it can be drawn at any size. */
export interface FindingBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FindingRecord {
  id: string;
  type: FindingType;
  title: string;
  detail: string;
  /** Type-specific, JSON-serialisable payload. */
  data: Record<string, unknown>;
  box?: FindingBox;
  severity: Severity;
}

export interface FileFindings {
  /** Case file id, or a generated id for uploaded files. */
  fileId: string;
  fileName: string;
  findings: FindingRecord[];
  analyzedAt: ISODateString;
}

export type PinSource = "lens" | "map";
export type PinKind = "finding" | "clipping" | "code" | "cabinet" | "sighting";

export interface Pin {
  id: string;
  source: PinSource;
  kind: PinKind;
  /** Id of the thing pinned (finding id, cabinet id, sighting id). */
  refId: string;
  title: string;
  detail?: string;
  /** Board position; absent until placed. */
  position?: { x: number; y: number };
  createdAt: ISODateString;
}

export type NewPin = Omit<Pin, "id" | "createdAt">;
export type PinPatch = Partial<Omit<Pin, "id" | "createdAt">>;

export interface Connection {
  id: string;
  fromPinId: string;
  toPinId: string;
  label?: string;
  /** True when the pair matches one of the case's correct connections. */
  correct: boolean;
  createdAt: ISODateString;
}

export type NewConnection = Omit<Connection, "id" | "createdAt">;

export interface Progress {
  /** Case file ids opened in EXUN Lens. */
  openedFileIds: string[];
  boardSolved: boolean;
}

export interface Profile {
  codename: string;
  agentNumber: string;
  clearance: number;
  /** Data URL captured by the webcam, if any. */
  photo: string | null;
}

export type ActivityType =
  | "file:analyzed"
  | "finding:pinned"
  | "connection:made"
  | "board:solved"
  | "profile:updated";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  at: ISODateString;
}

export type NewActivity = Omit<Activity, "id" | "at">;

/** Everything for one investigator, used to hydrate the store in one call. */
export interface InvestigatorSnapshot {
  profile: Profile;
  pins: Pin[];
  findings: FileFindings[];
  connections: Connection[];
  progress: Progress;
  activity: Activity[];
}

export const DATA_SCHEMA_VERSION = 1;
