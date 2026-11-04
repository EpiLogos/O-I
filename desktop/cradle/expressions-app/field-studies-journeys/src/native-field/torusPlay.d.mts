export interface TorusPlayReading {
  torus: {tonesHz: number[]; silentBecause: string | null};
  sky: {tonesHz: number[]; absentBecause: string | null};
  /** The owner's 1:1 (its voice at the map's Sun), which the symbols' voices stand on. */
  root: {hz: number | null; absentBecause: string | null};
  /** The body the plate reads its eight and four from: the owner's influence and the native amplitudes now (null without a frame's). */
  body: {influence: unknown; amplitudes: {mode_ref: string; re: number; im: number}[] | null} | null;
  /** The Torus's pulse as the owner last read it. */
  pulse: {steps: number; steps_per_second: number; band: string | null} | null;
}
export const SOUNDING_SHARE: number;
export const ROOT_PLANET_REF: string;
export function voiceModeRef(planetRef: string): string;
export function torusPlayReading(reading: unknown): TorusPlayReading;
