// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as data from "@/lib/data";
import { createMemoryStore } from "@/lib/data/storage";
import { bus } from "@/lib/events";
import { useInvestigator } from "./index";

beforeEach(async () => {
  data.setDataStore(createMemoryStore());
  bus.clear();
  await useInvestigator.getState().reset();
});

describe("investigator store", () => {
  it("hydrates from the data layer", async () => {
    await data.addPin({ source: "lens", kind: "finding", refId: "f", title: "Saved earlier" });
    await useInvestigator.getState().hydrate();
    const state = useInvestigator.getState();
    expect(state.hydrated).toBe(true);
    expect(state.pins.map((p) => p.title)).toEqual(["Saved earlier"]);
  });

  it("writes pins through the data layer and emits pin:added", async () => {
    const onPin = vi.fn();
    bus.on("pin:added", onPin);
    const pin = await useInvestigator.getState().addPin({ source: "map", kind: "cabinet", refId: "c1", title: "Cabinet" });
    expect(await data.listPins()).toEqual([pin]);
    expect(onPin).toHaveBeenCalledWith({ pin });
  });

  it("emits connection:correct only for correct connections", async () => {
    const onCorrect = vi.fn();
    bus.on("connection:correct", onCorrect);
    const { addConnection } = useInvestigator.getState();
    await addConnection({ fromPinId: "a", toPinId: "b", correct: false });
    await addConnection({ fromPinId: "a", toPinId: "c", correct: true });
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it("emits case:progress once per newly opened case file", async () => {
    const onProgress = vi.fn();
    bus.on("case:progress", onProgress);
    const { markFileOpened } = useInvestigator.getState();
    await markFileOpened("debrief");
    await markFileOpened("debrief");
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ openedFiles: 1, totalFiles: 7 });
  });

  it("emits board:solved only on the transition to solved", async () => {
    const onSolved = vi.fn();
    bus.on("board:solved", onSolved);
    const { setBoardSolved } = useInvestigator.getState();
    await setBoardSolved(true);
    await useInvestigator.getState().setBoardSolved(true);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it("drops a removed pin's connections from state", async () => {
    const { addPin, addConnection } = useInvestigator.getState();
    const a = await addPin({ source: "lens", kind: "finding", refId: "a", title: "A" });
    const b = await addPin({ source: "lens", kind: "finding", refId: "b", title: "B" });
    await addConnection({ fromPinId: a.id, toPinId: b.id, correct: false });
    await useInvestigator.getState().removePin(a.id);
    expect(useInvestigator.getState().connections).toEqual([]);
  });
});
