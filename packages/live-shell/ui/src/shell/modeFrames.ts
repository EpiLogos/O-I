// Each mode's frame as it first opens (FOUNDATION F1): the centre, the detail side and the parts shown, before the mode
// has a saved arrangement of its own. A registration table, read by the frame — never a branch in it. Once a mode has
// been stood in, its own book layout holds its frame and this table is not read again for it.
import type {SurfMode} from './modeGrammar'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {seedInstruments} from '../frame/openInstrument'
import {seedFactoryCentre} from '../agent/factoryCentre'

export interface ModeFrame {
  centerPanel: string
  tab: 'session' | 'arrangement'
  detailMode: 'clip' | 'device'
  browser: boolean
  detail: boolean
  dock: boolean
}

const FRAME = {tab: 'session', detailMode: 'clip', browser: true, detail: true} as const

// The centre is the pane tree in every mode (FOUNDATION F2); what each mode holds in it is its seed below.
// The detail side each mode opens on is the mockup's (world-shell-mockup.html `dv`: base device, factory clip, expressions
// device, techne device); Live's chain is the instrument.
export const MODE_FRAMES: Readonly<Record<SurfMode, ModeFrame>> = {
  live: {...FRAME, centerPanel: 'native.workbench', detailMode: 'device', dock: false},
  base: {...FRAME, centerPanel: 'native.workbench', detailMode: 'device', dock: true},
  factory: {...FRAME, centerPanel: 'native.workbench', detailMode: 'clip', dock: true},
  expressions: {...FRAME, centerPanel: 'native.workbench', detailMode: 'device', dock: true},
  techne: {...FRAME, centerPanel: 'native.workbench', detailMode: 'device', dock: true},
}

/** The material a mode's Session · Arrangement pane shows until F3's track adapters: Live's open set, the World cut's
 * civil field (Central, Technē, Factory), or the open Expression's native sources (Expressions). */
export type TrackSource = 'set' | 'world' | 'native'
export const MODE_TRACK_SOURCES: Readonly<Record<SurfMode, TrackSource>> = {
  live: 'set',
  base: 'world',
  factory: 'world',
  expressions: 'native',
  techne: 'world',
}

/** Each mode's first pane tree (FOUNDATION F2: panes are the centre in every mode), by the book mode it stands on. A seed
 * runs only on a tree with no tab, so a mode's own arrangement — and every named set — stands as it was left. */
export const MODE_TREE_SEEDS: Readonly<Record<string, (layout: LayoutState) => LayoutState>> = {
  // Live: the instrument (the torus on the stage) beside the set's tracks.
  live: seedInstruments(['projection.expressions', 'projection.timeline']),
  // Central: the day's tracks; documents open beside them from the browser.
  base: seedInstruments(['projection.timeline']),
  // Factory: the agent tab, pinned (agent/factoryCentre.ts), instruments open beside it.
  factory: seedFactoryCentre,
  // Expressions: the Expression, one pane (the mockup's modes.expressions); its scenes are its tracks, a Tab away in a pane.
  expressions: seedInstruments(['projection.expressions']),
  // Technē: the world — the Earth and its system (the mockup's modes.techne: the M4 lens at system scale).
  techne: seedInstruments(['projection.earth']),
}
