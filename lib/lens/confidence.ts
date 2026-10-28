// The assessment gauges. Each one adds up the weight of the findings that support it, so
// the value moves only when a real finding is surfaced. Weights are ours, not case facts.

export interface Gauge {
  id: "escape" | "human" | "risk";
  label: string;
  /** Finding id → weight in percentage points. */
  signals: Record<string, number>;
  /** Starts at 100 and falls as evidence arrives. */
  invert?: boolean;
}

export const gauges: Gauge[] = [
  {
    id: "escape",
    label: "Escape event",
    signals: { "character-removed": 35, "spike-2026-10-23": 25, "meter-2026-10-24": 15, "opened-inside": 15, "not-cosplayer": 10 },
  },
  {
    id: "human",
    label: "POI-1 human",
    invert: true,
    signals: { "not-cosplayer": 40, "character-removed": 30, "bare-wrist": 15, "opened-inside": 15 },
  },
  {
    id: "risk",
    label: "Cabinet risk",
    signals: { warbling: 40, "spike-2026-10-23": 30, "character-removed": 30 },
  },
];

export interface GaugeReading {
  value: number;
  /** Supporting findings surfaced so far, of all that count toward this gauge. */
  found: number;
  total: number;
}

export function readGauge(gauge: Gauge, findingIds: ReadonlySet<string>): GaugeReading {
  const entries = Object.entries(gauge.signals);
  const hit = entries.filter(([id]) => findingIds.has(id));
  const sum = hit.reduce((s, [, w]) => s + w, 0);
  return { value: gauge.invert ? 100 - sum : sum, found: hit.length, total: entries.length };
}
