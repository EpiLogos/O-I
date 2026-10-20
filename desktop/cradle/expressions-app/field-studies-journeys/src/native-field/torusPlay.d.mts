export interface TorusPlayReading {
  torus: {tonesHz: number[]; silentBecause: string | null};
  sky: {tonesHz: number[]; absentBecause: string | null};
  /** The owner's 1:1 (its voice at the map's Sun), which the symbols' voices stand on. */
  root: {hz: number | null; absentBecause: string | null};
}
export const ROOT_PLANET_REF: string;
export function voiceModeRef(planetRef: string): string;
export function torusPlayReading(reading: unknown): TorusPlayReading;
