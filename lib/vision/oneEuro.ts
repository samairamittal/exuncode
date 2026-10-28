// One Euro filter (Casiez et al., 2012): smooths jitter when the hand is still, follows
// quickly when it moves. One filter per coordinate.

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  /** minCutoff: smoothing at rest (Hz). beta: how fast it opens up with speed. */
  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.02,
    private readonly dCutoff = 1,
  ) {}

  /** Filters `value` measured at time `t` (ms). */
  filter(value: number, t: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(1e-3, (t - this.t) / 1000);
    this.t = t;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }
}
