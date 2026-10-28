import { createBrowserStore, readJson, removeKey, writeJson, type KeyValueStore } from "./storage";
import type {
  Activity,
  Connection,
  FileFindings,
  InvestigatorSnapshot,
  NewActivity,
  NewConnection,
  NewPin,
  Pin,
  PinPatch,
  Profile,
  Progress,
} from "./types";

export type * from "./types";

/*
 * The only module that reads or writes investigator data. Every function is async
 * so a backend can replace the localStorage implementation without changing callers.
 */

const KEYS = {
  profile: "profile",
  pins: "pins",
  findings: "findings",
  connections: "connections",
  progress: "progress",
  activity: "activity",
} as const;

const ACTIVITY_LIMIT = 200;

export const defaultProfile: Profile = {
  codename: "",
  agentNumber: "",
  clearance: 1,
  photo: null,
};

const defaultProgress: Progress = { openedFileIds: [], boardSolved: false };

let store: KeyValueStore | null = null;

function kv(): KeyValueStore {
  store ??= createBrowserStore();
  return store;
}

/** Swap the underlying store (tests, or a future offline cache). */
export function setDataStore(next: KeyValueStore): void {
  store = next;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

// Snapshot

export async function loadSnapshot(): Promise<InvestigatorSnapshot> {
  const [profile, pins, findings, connections, progress, activity] = await Promise.all([
    getProfile(),
    listPins(),
    listFindings(),
    listConnections(),
    getProgress(),
    listActivity(),
  ]);
  return { profile, pins, findings, connections, progress, activity };
}

export async function resetInvestigator(): Promise<void> {
  for (const key of Object.values(KEYS)) removeKey(kv(), key);
}

// Profile

export async function getProfile(): Promise<Profile> {
  return { ...defaultProfile, ...readJson<Partial<Profile>>(kv(), KEYS.profile, {}) };
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const next = { ...(await getProfile()), ...patch };
  writeJson(kv(), KEYS.profile, next);
  return next;
}

// Pins

export async function listPins(): Promise<Pin[]> {
  return readJson<Pin[]>(kv(), KEYS.pins, []);
}

export async function addPin(input: NewPin): Promise<Pin> {
  const pin: Pin = { ...input, id: newId(), createdAt: now() };
  writeJson(kv(), KEYS.pins, [...(await listPins()), pin]);
  return pin;
}

export async function updatePin(id: string, patch: PinPatch): Promise<Pin | null> {
  const pins = await listPins();
  const index = pins.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const updated: Pin = { ...pins[index], ...patch };
  pins[index] = updated;
  writeJson(kv(), KEYS.pins, pins);
  return updated;
}

/** Removes the pin and any connections attached to it. */
export async function removePin(id: string): Promise<void> {
  writeJson(kv(), KEYS.pins, (await listPins()).filter((p) => p.id !== id));
  const connections = await listConnections();
  writeJson(
    kv(),
    KEYS.connections,
    connections.filter((c) => c.fromPinId !== id && c.toPinId !== id),
  );
}

// Findings

export async function listFindings(): Promise<FileFindings[]> {
  return readJson<FileFindings[]>(kv(), KEYS.findings, []);
}

/** Replaces the stored findings for one file. */
export async function saveFindings(entry: FileFindings): Promise<FileFindings> {
  const others = (await listFindings()).filter((f) => f.fileId !== entry.fileId);
  writeJson(kv(), KEYS.findings, [...others, entry]);
  return entry;
}

// Connections

export async function listConnections(): Promise<Connection[]> {
  return readJson<Connection[]>(kv(), KEYS.connections, []);
}

export async function saveConnection(input: NewConnection): Promise<Connection> {
  const connection: Connection = { ...input, id: newId(), createdAt: now() };
  writeJson(kv(), KEYS.connections, [...(await listConnections()), connection]);
  return connection;
}

export async function removeConnection(id: string): Promise<void> {
  writeJson(kv(), KEYS.connections, (await listConnections()).filter((c) => c.id !== id));
}

// Progress

export async function getProgress(): Promise<Progress> {
  return { ...defaultProgress, ...readJson<Partial<Progress>>(kv(), KEYS.progress, {}) };
}

export async function markFileOpened(fileId: string): Promise<Progress> {
  const progress = await getProgress();
  if (progress.openedFileIds.includes(fileId)) return progress;
  const next = { ...progress, openedFileIds: [...progress.openedFileIds, fileId] };
  writeJson(kv(), KEYS.progress, next);
  return next;
}

export async function setBoardSolved(solved: boolean): Promise<Progress> {
  const next = { ...(await getProgress()), boardSolved: solved };
  writeJson(kv(), KEYS.progress, next);
  return next;
}

// Activity (newest first)

export async function listActivity(): Promise<Activity[]> {
  return readJson<Activity[]>(kv(), KEYS.activity, []);
}

export async function logActivity(input: NewActivity): Promise<Activity> {
  const entry: Activity = { ...input, id: newId(), at: now() };
  writeJson(kv(), KEYS.activity, [entry, ...(await listActivity())].slice(0, ACTIVITY_LIMIT));
  return entry;
}

// Preferences: small per-device settings (not investigator data), read synchronously so
// UI can start in the right state.

export function readPreference<T>(key: string, fallback: T): T {
  return readJson(kv(), `pref:${key}`, fallback);
}

export function writePreference<T>(key: string, value: T): void {
  writeJson(kv(), `pref:${key}`, value);
}
