import { create } from "zustand";
import { caseFiles } from "@/lib/case";
import * as data from "@/lib/data";
import type {
  Activity,
  Connection,
  FileFindings,
  NewActivity,
  NewConnection,
  NewPin,
  Pin,
  PinPatch,
  Profile,
  Progress,
} from "@/lib/data";
import { bus } from "@/lib/events";

// Shared client state. Every action writes through lib/data first, then updates
// state with what the data layer returned, so a backend stays the source of truth.

export interface InvestigatorState {
  hydrated: boolean;
  profile: Profile;
  pins: Pin[];
  findings: FileFindings[];
  connections: Connection[];
  progress: Progress;
  activity: Activity[];

  hydrate: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addPin: (input: NewPin) => Promise<Pin>;
  updatePin: (id: string, patch: PinPatch) => Promise<void>;
  removePin: (id: string) => Promise<void>;
  saveFindings: (entry: FileFindings) => Promise<void>;
  addConnection: (input: NewConnection) => Promise<Connection>;
  removeConnection: (id: string) => Promise<void>;
  markFileOpened: (fileId: string) => Promise<void>;
  setBoardSolved: (solved: boolean) => Promise<void>;
  logActivity: (input: NewActivity) => Promise<void>;
  reset: () => Promise<void>;
}

const emptyState = {
  hydrated: false,
  profile: data.defaultProfile,
  pins: [] as Pin[],
  findings: [] as FileFindings[],
  connections: [] as Connection[],
  progress: { openedFileIds: [], boardSolved: false } as Progress,
  activity: [] as Activity[],
};

export const useInvestigator = create<InvestigatorState>()((set, get) => ({
  ...emptyState,

  async hydrate() {
    const snapshot = await data.loadSnapshot();
    set({ ...snapshot, hydrated: true });
  },

  async updateProfile(patch) {
    set({ profile: await data.updateProfile(patch) });
  },

  async addPin(input) {
    const pin = await data.addPin(input);
    set({ pins: [...get().pins, pin] });
    bus.emit("pin:added", { pin });
    return pin;
  },

  async updatePin(id, patch) {
    const pin = await data.updatePin(id, patch);
    if (pin) set({ pins: get().pins.map((p) => (p.id === id ? pin : p)) });
  },

  async removePin(id) {
    await data.removePin(id);
    set({
      pins: get().pins.filter((p) => p.id !== id),
      connections: get().connections.filter((c) => c.fromPinId !== id && c.toPinId !== id),
    });
  },

  async saveFindings(entry) {
    const saved = await data.saveFindings(entry);
    set({ findings: [...get().findings.filter((f) => f.fileId !== saved.fileId), saved] });
  },

  async addConnection(input) {
    const connection = await data.saveConnection(input);
    set({ connections: [...get().connections, connection] });
    if (connection.correct) bus.emit("connection:correct", { connection });
    return connection;
  },

  async removeConnection(id) {
    await data.removeConnection(id);
    set({ connections: get().connections.filter((c) => c.id !== id) });
  },

  async markFileOpened(fileId) {
    const before = get().progress.openedFileIds.length;
    const progress = await data.markFileOpened(fileId);
    set({ progress });
    if (progress.openedFileIds.length !== before) {
      const opened = progress.openedFileIds.filter((id) => caseFiles.some((f) => f.id === id)).length;
      bus.emit("case:progress", { openedFiles: opened, totalFiles: caseFiles.length });
    }
  },

  async setBoardSolved(solved) {
    const wasSolved = get().progress.boardSolved;
    set({ progress: await data.setBoardSolved(solved) });
    if (solved && !wasSolved) bus.emit("board:solved", {});
  },

  async logActivity(input) {
    const entry = await data.logActivity(input);
    set({ activity: [entry, ...get().activity] });
  },

  async reset() {
    await data.resetInvestigator();
    set({ ...emptyState });
    await get().hydrate();
  },
}));
