import type { MeterReading } from "@/lib/case";

// Recomputes daily usage from meter readings and flags rows that don't add up.

export interface LedgerRow extends MeterReading {
  /** Usage the meter actually recorded (this reading minus the previous one); null for day 1. */
  meteredKwh: number | null;
  /** Listed usage differs from metered usage. */
  mismatch: boolean;
  /** Metered usage (listed on day 1) as a multiple of a typical day (the median). */
  ratio: number;
  /** At least SPIKE_RATIO times a typical day. */
  spike: boolean;
}

export const SPIKE_RATIO = 10;
const TOLERANCE_KWH = 0.05;

const round1 = (v: number) => Math.round(v * 10) / 10;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function checkLedger(readings: readonly MeterReading[]): LedgerRow[] {
  const metered = readings.map((r, i) => (i === 0 ? null : round1(r.readingKwh - readings[i - 1].readingKwh)));
  // Judge spikes on what the meter recorded, so a mistyped listing isn't a spike.
  const drawn = metered.map((m, i) => m ?? readings[i].listedUsageKwh);
  const typical = median(drawn);
  return readings.map((r, i) => {
    const meteredKwh = metered[i];
    const ratio = drawn[i] / typical;
    return {
      ...r,
      meteredKwh,
      mismatch: meteredKwh !== null && Math.abs(meteredKwh - r.listedUsageKwh) > TOLERANCE_KWH,
      ratio,
      spike: ratio >= SPIKE_RATIO,
    };
  });
}
