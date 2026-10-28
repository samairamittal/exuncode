import { describe, expect, it } from "vitest";
import { energyDossier } from "@/lib/case";
import { analyseFile, checkLedger, decodeBase32, gauges, lensFiles, readGauge } from "@/lib/lens";

describe("base32", () => {
  it("decodes the machine ID", () => expect(decodeBase32("MJWHKZLTNBUXE5A")).toBe("blueshirt"));
  it("rejects characters outside the alphabet", () => expect(decodeBase32("MJ1")).toBeNull());
});

describe("ledger", () => {
  const rows = checkLedger(energyDossier.readings);
  it("flags only Oct 24, which moved 30.7 kWh", () => {
    const bad = rows.filter((r) => r.mismatch);
    expect(bad.map((r) => r.date)).toEqual(["2026-10-24"]);
    expect(bad[0].meteredKwh).toBe(30.7);
  });
  it("flags only the Oct 23 spike", () => expect(rows.filter((r) => r.spike).map((r) => r.date)).toEqual(["2026-10-23"]));
});

describe("findings", () => {
  it("every supplied file yields findings with unique ids", () => {
    const all = lensFiles.flatMap((f) => analyseFile(f.id));
    expect(new Set(all.map((f) => f.id)).size).toBe(all.length);
    for (const f of lensFiles.filter((f) => f.caseFileIds.length)) expect(analyseFile(f.id).length).toBeGreaterThan(0);
  });
  it("pending files yield nothing", () => expect(analyseFile("suspension-notice")).toEqual([]));
  it("gauge signals refer to real finding ids", () => {
    const ids = new Set(lensFiles.flatMap((f) => analyseFile(f.id)).map((f) => f.id));
    for (const g of gauges) for (const id of Object.keys(g.signals)) expect(ids).toContain(id);
    expect(readGauge(gauges[0], ids).value).toBe(100);
    expect(readGauge(gauges[1], ids).value).toBe(0);
  });
});
