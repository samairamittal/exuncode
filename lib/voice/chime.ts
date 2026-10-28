import { audioContext, audioState } from "./audio";

// A soft two-note blip when LENS hears its name: instant feedback before it answers.
export function chime(): void {
  if (audioState() !== "running") return;
  const ctx = audioContext();
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  gain.connect(ctx.destination);
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start(t + i * 0.07);
    o.stop(t + 0.26);
  });
}
