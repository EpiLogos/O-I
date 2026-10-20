export interface TorusPlayReading {
  torus: {tonesHz: number[]; silentBecause: string | null};
  sky: {tonesHz: number[]; absentBecause: string | null};
}
export function voiceModeRef(planetRef: string): string;
export function torusPlayReading(reading: unknown): TorusPlayReading;
