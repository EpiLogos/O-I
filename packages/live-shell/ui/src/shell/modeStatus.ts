// What each mode's status bar says (FOUNDATION F0: a mode differs by its registration, never by a branch in the frame).
// A registration table read by components/StatusBar.tsx — the words each mode wears there are data, and the bar names no
// mode. The words themselves stay where they were authored: MODE_GRAMMAR[mode].centre (modeGrammar.ts) for a centre
// line, the open set for Live, the open work for Expressions.
//
// Pure data: no React, no view, no store, no I/O.
import type {SurfMode} from './modeGrammar'

/** The subject line the status bar reads in a mode. `set`: the open Live set under the presented presentation's name;
 * `centre`: the presented centre composition's own text; `work`: the open Expression (its document name). */
export type StatusLine = 'set' | 'centre' | 'work'

export interface ModeStatus {
  readonly line: StatusLine
  /** The mode shows its work's Scene snapshot standing beside the line (Expressions: edited · none · saved + revision). */
  readonly snapshot: boolean
}

export const MODE_STATUS: Readonly<Record<SurfMode, ModeStatus>> = {
  live: {line: 'set', snapshot: false},
  base: {line: 'centre', snapshot: false},
  factory: {line: 'centre', snapshot: false},
  expressions: {line: 'work', snapshot: true},
  techne: {line: 'centre', snapshot: false},
}
