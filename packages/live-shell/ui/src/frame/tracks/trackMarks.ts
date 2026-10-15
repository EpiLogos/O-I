// A clip's standing mark on the shared Session grid and Arrangement ruler (manual §8: "Everything keeps the weight it has —
// fact, claim, inference, guess, dispute, or a gap nobody has filled"). Ported from the World cut presentation the tracks pane
// replaced: git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx:77-116 — `clipStandingMark`
// (:96-103), the accessible name (:106), the standing tag (:109-110) and the standing attributes (:113-116).
//
// The class still comes only from the one standing authority (standingOf, desktop/cradle/src/techne/m0m5/timeline/standing.ts),
// which the adapters read onto `clip.standing`; the word is the owner's verbatim one, else the authority's legend label (through
// standingStyle.ts `standingLabel`, the import the old cut used). Two things changed in the port:
// - the drawing is the cut's edge standings (icon-cut.html:1659-1664: "Fact is solid. Claim is violet and dashed. Inferred is
//   dotted. Disputed is red, broken, and crossed. A ghost is an empty dashed node"), stroked through tracks.css's --standing-*
//   tokens, which name shell tokens only — the old cut stroked the research canvas's own hex table (standingStyle.ts
//   STANDING_DRAWING). The authority's `mythic` has no edge in the cut; it keeps the canvas grammar's dotted line (STANDING_DRAWING
//   mythic: dash "1 4") in the shell's dim amber;
// - a clip with no standing reading draws no mark at all (the old cut drew it as undisclosed): no mark without a reading.
//
// Pure TypeScript. No React.
import {standingLabel} from '../../../../../../desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/timeline/standingStyle'
import type {ClipStandingReading, WorldTrackClip} from '../../timeline/worldTrackAdapter'

export type StandingVisual = ClipStandingReading['visual']
/** The cut's names for the edge each class is drawn with. */
export type StandingCut = 'fact' | 'claim' | 'inferred' | 'disputed' | 'mythic' | 'ghost'

/** The authority's class → the cut's edge: which mark and its line (icon-cut.html:1659 dash patterns: fact '', claim '6 3',
 * inferred '0 4.2' round, disputed '5 2.5', ghost '3 3'). The stroke is `var(--standing-<cut>)`, set in tracks.css. */
export const STANDING_CUT: Readonly<Record<StandingVisual, {cut: StandingCut; line: 'solid' | 'dashed' | 'dotted'}>> = {
  sourced: {cut: 'fact', line: 'solid'},
  authored: {cut: 'claim', line: 'dashed'},
  derived: {cut: 'inferred', line: 'dotted'},
  disputed: {cut: 'disputed', line: 'dashed'},
  mythic: {cut: 'mythic', line: 'dotted'},
  unavailable: {cut: 'ghost', line: 'dashed'},
}

export interface ClipStandingMark {
  reading: ClipStandingReading
  /** The class the clip is drawn in: the authority's visual class. */
  visual: StandingVisual
  /** The cut's edge for that class. */
  cut: StandingCut
  /** The verbatim stated word when the source states one, else the grammar's legend label for the class. */
  word: string
  /** The stroke, a shell token through tracks.css. */
  stroke: string
  /** The CSS border style the edge draws as. */
  line: 'solid' | 'dashed' | 'dotted'
}

/** The mark a clip carries, or null when its adapter disclosed no standing (worldTimelinePresentation.tsx:96-103). */
export function clipStandingMark(clip: Pick<WorldTrackClip, 'standing'>): ClipStandingMark | null {
  const reading = clip.standing
  if (!reading) return null
  const {cut, line} = STANDING_CUT[reading.visual] ?? STANDING_CUT.unavailable
  return {reading, visual: reading.visual, cut, word: reading.verbatim ?? standingLabel(reading.visual), stroke: `var(--standing-${cut})`, line}
}

/** The accessible name of a clip: its label and the standing it is drawn in (:106). No mark, the label alone. */
export const clipAccessibleName = (label: string, mark: ClipStandingMark | null): string => mark ? `${label} — standing ${mark.word}` : label

/** A visible standing tag on the label (:109-110). A sourced clip with no stated word carries no tag, nor does a clip with no mark. */
export const clipStandingTag = (mark: ClipStandingMark | null): string =>
  !mark || (mark.reading.verbatim == null && mark.visual === 'sourced') ? '' : ` · ${mark.word}`

/** Standing attributes shared by every clip form (:113-116). */
export const clipStandingAttributes = (mark: ClipStandingMark | null): Record<string, string | undefined> =>
  mark ? {'data-standing': mark.visual, 'data-standing-stated': mark.reading.verbatim ?? undefined} : {}

/** The edge a clip is drawn with: the old cut's 2px left rule (:321, :342, :356), in the cut's line and token. */
export const clipStandingEdge = (mark: ClipStandingMark | null): string | undefined => mark ? `2px ${mark.line} ${mark.stroke}` : undefined

/** The words the hover title carries (:322, :334, :344, :357): the standing and the rule that chose it. */
export const clipStandingTitle = (mark: ClipStandingMark | null): string => mark ? ` · standing ${mark.word} · ${mark.reading.rule}` : ''
