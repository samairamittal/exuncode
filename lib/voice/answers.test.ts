import { describe, expect, it } from "vitest";
import { answer, isQuestion, type AnswerContext } from "./answers";

const ctx = (found: string[] = [], analysed: string[] = []): AnswerContext => ({
  found: new Set(found),
  analysed,
  codename: "Nova",
  agentNumber: "007",
  now: new Date("2026-10-28T09:30:00"),
  sightings: { latest: ["Wenoti Arcade"], outages: ["Starcade"], targets: ["Boss Level Tower", "Respawn Arcade"] },
});

describe("answers", () => {
  it.each([
    ["what's the case about", "case"],
    ["what happened", "case"],
    ["how much energy was used on the 20th", "energy-day"],
    ["what was the reading on october 24", "energy-day"],
    ["tell me about the spike", "spike"],
    ["what's 503", "mismatch"],
    ["why is the HVAC blamed", "notes"],
    ["what is the machine ID", "machine-id"],
    ["what's wrong with the code", "code"],
    ["what damage did they find on the cabinet panel", "physical"],
    ["is POI-1 human", "human"],
    ["where is POI-1 going", "where-now"],
    ["why did it escape", "why"],
    ["how did it escape", "how-escape"],
    ["what is the reckoning", "reckoning"],
    ["what did POI-1 say", "poi-said"],
    ["who is POI-1", "poi"],
    ["why did it check its wrist", "wrist"],
    ["what's the warbling", "warbling"],
    ["who are Nano and Mega", "agents"],
    ["who sent the debrief", "debrief"],
    ["where is the arcade", "location"],
    ["what should I scan next", "next"],
    ["what have you found", "findings"],
    ["why is EXUN suspended", "suspension"],
    ["who are you", "who-are-you"],
    ["what can you do", "help"],
    ["what time is it", "time"],
    ["who am I", "who-am-i"],
    ["thank you", "thanks"],
    ["what's the meaning of life", "fallback"],
  ])("%s → %s", (question, intent) => expect(answer(question, ctx()).intent).toBe(intent));

  it("reads the day's numbers and flags the mismatch", () => {
    const a = answer("how much energy on the 24th", ctx());
    expect(a.text).toContain("503.2");
    expect(a.text).toContain("30.7");
    expect(a.show?.chartDay).toBe(11);
  });

  it("keeps the story locked until the evidence is found", () => {
    expect(answer("why did it escape", ctx()).text).not.toContain("curious");
    expect(answer("why did it escape", ctx(["character-removed", "bare-wrist"])).text).toContain("curious");
    expect(answer("what's the machine ID", ctx()).text).not.toContain("blueshirt");
    expect(answer("what's the machine ID", ctx(["machine-id"])).text).toContain("blueshirt");
  });

  it("suggests the next file", () => {
    const a = answer("what should I do next", ctx([], ["debrief"]));
    expect(a.show?.file).toBe("energy-dossier");
  });

  it("tells questions from commands", () => {
    expect(isQuestion("what was the energy on the 23rd")).toBe(true);
    expect(isQuestion("show the energy graph")).toBe(false);
  });
});
