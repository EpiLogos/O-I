// The two-way laws of the handles that move two parameters (manual §16.9: "A handle for two parameters moves in two directions").
// Each law is what its picture draws, run backwards: a handle that stands where its values put it, and is let go there, changes
// nothing (value → place → value is the identity, within the step each parameter is kept to; tests/handle-laws.test.mjs holds it).
// Pure: no kit, no DOM, so the designs and the tests read the same arithmetic.

export const clamp = (low: number, high: number, x: number) => Math.min(high, Math.max(low, x))
const to1 = (x: number) => Math.round(x * 10) / 10

// ------------------------------------------------------------------------------------------------ Dynamics

/** The transfer curve passes through its knee: input Threshold, output Threshold + Makeup (both in dB). Across moves the threshold; up
 * lifts the whole curve, which is the makeup. */
export const KNEE = {threshold: {lo: -60, hi: 0}, makeup: {lo: 0, hi: 24}} as const
export const kneePlace = (threshold: number, makeup: number) => ({inDb: threshold, outDb: threshold + makeup})
export function kneeDrag(inDb: number, outDb: number): {threshold: number; makeup: number} {
  const threshold = to1(clamp(KNEE.threshold.lo, KNEE.threshold.hi, inDb))
  return {threshold, makeup: to1(clamp(KNEE.makeup.lo, KNEE.makeup.hi, outDb - threshold))}
}

/** How far the effect pulls a sound at full level (dB): the room under the threshold, in the share the ratio takes. Ratio 1 pulls
 * nothing; ratio 20 pulls 95 % of the room. */
export const RATIO = {lo: 1, hi: 20} as const
export const depthOf = (threshold: number, ratio: number) => -threshold * (1 - 1 / ratio)
/** The ratio that pulls `depth` dB under this threshold. A threshold at 0 dB leaves no room, so any depth is ratio 1. */
export function ratioForDepth(threshold: number, depth: number): number {
  const room = -threshold
  if (room <= 0) return RATIO.lo
  const d = clamp(0, room * (1 - 1 / RATIO.hi), depth)
  return to1(clamp(RATIO.lo, RATIO.hi, room / (room - d)))
}

/** The time display: a burst at full level, then silence. The gain reduction deepens toward its full depth with the attack and
 * returns with the release. Both laws are 1 − e^(−t/τ); `BURST` is where the burst ends (ms). */
export const BURST = 500
/** Gain reduction (dB) `ms` after the burst began, for a full depth, an attack and a release (ms). */
export const reductionAt = (ms: number, deep: number, attack: number, release: number) =>
  ms <= BURST ? deep * (1 - Math.exp(-ms / attack)) : deep * (1 - Math.exp(-BURST / attack)) * Math.exp(-(ms - BURST) / release)
/** The full depth a reduction of `gr` dB at the attack handle (one attack into the burst) stands for, and at the release handle (one
 * release after the burst ends). */
export const depthAtAttack = (gr: number) => gr / (1 - Math.exp(-1))
export const depthAtRelease = (gr: number, attack: number) => gr / ((1 - Math.exp(-BURST / attack)) * Math.exp(-1))

// ------------------------------------------------------------------------------------------------ Delay

/** The nth repeat stands at n × Time; its height is Mix × Feedback^(n−1). Across moves the time (for the first, n = 1; for the second,
 * its place is twice the time); up moves the mix for the first repeat and the feedback for the second. */
export const repeatHeight = (mix: number, feedback: number, n: number) => (mix / 100) * (feedback / 100) ** (n - 1)
export const feedbackForSecond = (height: number, mix: number): number => (mix <= 0 ? 0 : Math.round(clamp(0, 95, height / (mix / 100) * 100)))
