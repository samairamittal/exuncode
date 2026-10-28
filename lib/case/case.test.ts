import { describe, expect, it } from "vitest";
import { caseFiles, debrief, energyDossier, getCaseFile } from "./index";

describe("case data", () => {
  it("has 14 consecutive daily meter readings from Oct 13 to Oct 26", () => {
    const { readings } = energyDossier;
    expect(readings).toHaveLength(14);
    expect(readings[0].date).toBe("2026-10-13");
    expect(readings.at(-1)?.date).toBe("2026-10-26");
    readings.forEach((r, i) => expect(r.day).toBe(i + 1));
  });

  it("has meter readings that only go up", () => {
    const { readings } = energyDossier;
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i].readingKwh).toBeGreaterThan(readings[i - 1].readingKwh);
    }
  });

  it("keeps the machine ID as written in the debrief", () => {
    expect(debrief.machineId).toBe("MJWHKZLTNBUXE5A");
  });

  it("has unique file ids that resolve", () => {
    const ids = caseFiles.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getCaseFile("altered-code").fileName).toBe("AlteredCode.txt");
  });
});
