// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import * as data from "./index";
import { createBrowserStore, createMemoryStore } from "./storage";

beforeEach(() => {
  window.localStorage.clear();
  data.setDataStore(createBrowserStore());
});

describe("data layer", () => {
  it("returns defaults when nothing is stored", async () => {
    const snapshot = await data.loadSnapshot();
    expect(snapshot.pins).toEqual([]);
    expect(snapshot.progress).toEqual({ openedFileIds: [], boardSolved: false });
    expect(snapshot.profile).toEqual(data.defaultProfile);
  });

  it("persists pins to localStorage and reads them back", async () => {
    const pin = await data.addPin({ source: "lens", kind: "finding", refId: "f1", title: "503.2 kWh" });
    expect(pin.id).toBeTruthy();
    data.setDataStore(createBrowserStore()); // fresh instance, same localStorage
    expect(await data.listPins()).toEqual([pin]);
  });

  it("updates a pin and returns null for unknown ids", async () => {
    const pin = await data.addPin({ source: "map", kind: "sighting", refId: "s1", title: "Sighting" });
    const moved = await data.updatePin(pin.id, { position: { x: 10, y: 20 } });
    expect(moved?.position).toEqual({ x: 10, y: 20 });
    expect(await data.updatePin("missing", { title: "x" })).toBeNull();
  });

  it("removes a pin's connections with it", async () => {
    const a = await data.addPin({ source: "lens", kind: "finding", refId: "a", title: "A" });
    const b = await data.addPin({ source: "lens", kind: "finding", refId: "b", title: "B" });
    await data.saveConnection({ fromPinId: a.id, toPinId: b.id, correct: true });
    await data.removePin(a.id);
    expect(await data.listConnections()).toEqual([]);
  });

  it("replaces findings per file", async () => {
    const base = { fileName: "x.pdf", analyzedAt: new Date().toISOString() };
    await data.saveFindings({ ...base, fileId: "x", findings: [] });
    await data.saveFindings({
      ...base,
      fileId: "x",
      findings: [{ id: "1", type: "text", title: "t", detail: "d", data: {}, severity: "info" }],
    });
    const all = await data.listFindings();
    expect(all).toHaveLength(1);
    expect(all[0].findings).toHaveLength(1);
  });

  it("records each opened file once", async () => {
    await data.markFileOpened("debrief");
    const progress = await data.markFileOpened("debrief");
    expect(progress.openedFileIds).toEqual(["debrief"]);
  });

  it("logs activity newest first", async () => {
    await data.logActivity({ type: "file:analyzed", message: "first" });
    await data.logActivity({ type: "file:analyzed", message: "second" });
    expect((await data.listActivity()).map((a) => a.message)).toEqual(["second", "first"]);
  });

  it("clears everything on reset", async () => {
    await data.updateProfile({ codename: "Ferret" });
    await data.resetInvestigator();
    expect((await data.getProfile()).codename).toBe("");
  });

  it("falls back to memory when localStorage is blocked", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    try {
      data.setDataStore(createBrowserStore());
      await data.updateProfile({ codename: "Ferret" });
      expect((await data.getProfile()).codename).toBe("Ferret");
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });

  it("ignores corrupt stored JSON", async () => {
    const store = createMemoryStore();
    store.set("exun:v1:pins", "{not json");
    data.setDataStore(store);
    expect(await data.listPins()).toEqual([]);
  });
});
