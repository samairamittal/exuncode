import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "./index";

type Map = { ping: { n: number }; other: string };

describe("event bus", () => {
  it("delivers typed payloads to subscribers", () => {
    const bus = createEventBus<Map>();
    const handler = vi.fn();
    bus.on("ping", handler);
    bus.emit("ping", { n: 1 });
    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it("stops delivering after unsubscribe", () => {
    const bus = createEventBus<Map>();
    const handler = vi.fn();
    const unsubscribe = bus.on("ping", handler);
    unsubscribe();
    bus.emit("ping", { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps calling other handlers when one throws", () => {
    const bus = createEventBus<Map>();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn();
    bus.on("ping", () => {
      throw new Error("boom");
    });
    bus.on("ping", after);
    bus.emit("ping", { n: 2 });
    expect(after).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("allows a handler to unsubscribe itself during emit", () => {
    const bus = createEventBus<Map>();
    const second = vi.fn();
    const off = bus.on("ping", () => off());
    bus.on("ping", second);
    bus.emit("ping", { n: 3 });
    bus.emit("ping", { n: 4 });
    expect(second).toHaveBeenCalledTimes(2);
  });
});
