// A page's reading on the Earth (manual §18.1 Launch panel: "Opens as … Page · Reading · Walk · Sky for a being or thing"; T-WORLDS §4
// W2 "Reading draws body and cites"). The Earth, while it stands, registers how it opens the reading of an occurrence by its subject
// (projections/atlas/AtlasProjectionPanel.tsx); a page launched as Reading asks it for the page's own ref (central/launchOpening.ts).
// With no Earth standing there is no reading to open, and the launch says so. Pure apart from the one registration.

export type EarthReadingOpener = (subjectRef: string) => {readonly ok: true} | {readonly ok: false; readonly why: string}

let opener: EarthReadingOpener | null = null

/** The Earth registers its reading while it stands; the returned function withdraws it (only the opener it registered). */
export function registerEarthReading(next: EarthReadingOpener | null): () => void {
  opener = next
  return () => { if (opener === next) opener = null }
}

/** The Earth's reading opener, when an Earth stands. */
export const earthReading = (): EarthReadingOpener | null => opener
