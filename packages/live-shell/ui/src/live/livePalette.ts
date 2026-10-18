// Live 12's clip colour palette, by the index a set keeps (a clip's `Color`, edit.rs `colourIndex`, 0–69): the 14 × 5 chooser of
// Live's clip menu (CLIP-VIEW-EVIDENCE.md cap 22), read row by row.
//
// How it was derived (18 Oct 2026), never guessed:
//   - the values: Live's own 70 clip colours, the RGB constants of STANDARD_COLOR_PALETTE in Live 12.0.25's remote-script module
//     `MIDI Remote Scripts/ableton/v3/control_surface/colors.pyc` (read with a Python 3.7 marshal reader);
//   - the order: the chooser's 70 swatches sampled from cap 22 (Work/reverse-engineering/ableton-live-12.0.25/evidence/ui/
//     clip-view/22-session-clip-context-menu.png), each paired one-to-one with the nearest of those 70 constants (an optimal
//     assignment; the same table in the capture's raw values and converted to sRGB);
//   - the check: six track colours of the template set "Piano and voices mastering" (its Color indices 7, 8, 9, 22, 23, 25 in the
//     .als) are exactly the swatches at those row-major places in a capture of Live showing that set (evidence/ui/
//     live-arrangement-real.png), so a set's index counts the chooser left to right, row by row.
// Pure.

export const LIVE_CLIP_PALETTE: readonly string[] = [
  '#FF94A6', '#FFA529', '#CC9927', '#F7F47C', '#BFFB00', '#1AFF2F', '#25FFA8', '#5CFFE8', '#8BC5FF', '#5480E4', '#92A7FF', '#D86CE4', '#E553A0', '#FFFFFF',
  '#FF3636', '#F66C03', '#99724B', '#FFF034', '#87FF67', '#3DC300', '#00BFAF', '#19E9FF', '#10A4EE', '#007DC0', '#886CE4', '#B677C6', '#FF39D4', '#D0D0D0',
  '#E2675A', '#FFA374', '#D3AD71', '#EDFFAE', '#D2E498', '#BAD074', '#9BC48D', '#D4FDE1', '#CDF1F8', '#B9C1E3', '#CDBBE4', '#AE98E5', '#E5DCE1', '#A9A9A9',
  '#C6928B', '#B78256', '#99836A', '#BFBA69', '#A6BE00', '#7DB04D', '#88C2BA', '#9BB3C4', '#85A5C2', '#8393CC', '#A595B5', '#BF9FBE', '#BC7196', '#7B7B7B',
  '#AF3333', '#A95131', '#724F41', '#DBC300', '#85961F', '#539F31', '#0A9C8E', '#236384', '#1A2F96', '#2F52A2', '#624BAD', '#A34BAD', '#CC2E6E', '#3C3C3C',
]

/** The colour of a palette index, or null for one outside Live's 70. */
export function liveColour(index: number | null | undefined): string | null {
  return typeof index === 'number' && Number.isInteger(index) ? LIVE_CLIP_PALETTE[index] ?? null : null
}

/** The palette index of a colour the chooser offers: one of Live's 70 hex colours (any case), or an index 0–69; null for any other. */
export function liveColourIndex(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value < LIVE_CLIP_PALETTE.length ? value : null
  if (typeof value !== 'string') return null
  const at = LIVE_CLIP_PALETTE.indexOf(value.trim().toUpperCase())
  return at >= 0 ? at : null
}
