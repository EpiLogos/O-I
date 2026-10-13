export interface InstrumentAnnouncement {
  reading: Record<string, unknown>;
  determinants: {lens: {lens12: number; label: string}; contextFrame: number;
    harmonic: {selection: 'canonical-basis'; index: number} | {selection: 'selected-source-row'}; rna: boolean} | null;
  parameters: {muted: boolean; level: number | null;
    scale: {unitsPerMetre: number | null; mode: string};
    cadence: {rate: number; playing: boolean; source: string} | null;
    refusal: string | null};
}
export function announceInstrument(reading: unknown): InstrumentAnnouncement | undefined;
