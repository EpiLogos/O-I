export interface InstrumentAnnouncement {
  reading: Record<string, unknown>;
  determinants: {lens: {lens12: number; label: string}; contextFrame: number;
    harmonic: {selection: 'canonical-basis'; index: number} | {selection: 'selected-source-row'}; rna: boolean} | null;
  parameters: {muted: boolean; level: number | null;
    scale: {unitsPerMetre: number | null; mode: string};
    cadence: {rate: number; playing: boolean; source: string} | null;
    refusal: string | null;
    effects?: Record<'filter' | 'dynamics' | 'delay' | 'reverb', Record<string, number | boolean | string>> & {chain: ('filter' | 'dynamics' | 'delay' | 'reverb')[]};
    /** The Torus's M1′ session (QL `torus-state`, O-I #850), the owner's values; absent until the owner has been read. */
    torus?: {settings: Record<string, unknown>; steps_per_second: number; band: string; fundamental_hz: number; map_hz: number; figure: string | null;
      comma_cents: number; notes: number; resident_tunings: string[]; carrier_drive: string};
    /** Where the Torus is heard from (O-I 856): Receiver On or Off, the owner's context and its refusal; a shared place's reference (O-I
     * #856); never the place. */
    receiver?: {on: boolean; context: 'world' | 'personal' | 'shared'; shared?: string; refusal: string | null}};
}
export function announceInstrument(reading: unknown): InstrumentAnnouncement | undefined;
