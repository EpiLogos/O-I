// Each mode's frame as it first opens (FOUNDATION F1): the centre, the detail side and the parts shown, before the mode
// has a saved arrangement of its own. A registration table, read by the frame — never a branch in it. Once a mode has
// been stood in, its own book layout holds its frame and this table is not read again for it.
import type {SurfMode} from './modeGrammar'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {seedInstruments} from '../frame/openInstrument'
import {healLiveTree} from '../live/liveTreeHeal'
import {seedFactoryCentre} from '../agent/factoryCentre'
import {seedCentralDocuments} from '../central/documents/centralDocuments'
import {seedWithoutTracksPane} from './tracksOutOfPanes'

export interface ModeFrame {
  centerPanel: string
  /** The view the main area opens on (manual §10.2): the set's Session or Arrangement view, or Pane view. */
  view: 'session' | 'arrangement' | 'pane'
  tab: 'session' | 'arrangement'
  detailMode: 'clip' | 'device'
  browser: boolean
  detail: boolean
  dock: boolean
}

const FRAME = {tab: 'session', view: 'pane', detailMode: 'clip', browser: true, detail: true} as const

// The centre is the pane tree in every mode (FOUNDATION F2); what each mode holds in it is its seed below.
// The detail side each mode opens on is the mockup's (world-shell-mockup.html `dv`: base device, factory clip, expressions
// device, techne device); Live's chain is the instrument. The widget rail stands in every mode (manual §10.6: "it stays with
// you when you move"; the mockup's S.tiles.live = ['agents', 'trail'], world-shell-mockup.html:1700).
export const MODE_FRAMES: Readonly<Record<SurfMode, ModeFrame>> = {
  // Live and Factory open in Session view (manual §21 "Live opens in Session view, with the part's chain in Device view"; §19 "Factory
  // opens in Session view, its sessions as tracks, with the selected task's log in Clip view"); Central, Expressions and Technē in Pane view.
  live: {...FRAME, view: 'session', centerPanel: 'native.workbench', detailMode: 'device', dock: true},
  base: {...FRAME, centerPanel: 'native.workbench', detailMode: 'device', dock: true},
  factory: {...FRAME, view: 'session', centerPanel: 'native.workbench', detailMode: 'clip', dock: true},
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

/** Each mode's first pane tree (Pane view, manual §10.2), by the book mode it stands on. A seed runs only on a tree with no
 * tab, so a mode's own arrangement — and every named set — stands as it was left. The set's tracks are never a pane: they are
 * Session view and Arrangement view, a Tab away (shell/tracksOutOfPanes.ts keeps them out of every tree). */
export const MODE_TREE_SEEDS: Readonly<Record<string, (layout: LayoutState) => LayoutState>> = {
  // Live: the instrument, the torus on the stage — laid over a tree that is Central's seed standing in Live
  // (live/liveTreeHeal.ts), never over one the owner arranged.
  live: seedWithoutTracksPane(healLiveTree(seedInstruments(['projection.expressions']))),
  // Central: the Day and a Flow, side by side (the mockup's modes.base).
  base: seedWithoutTracksPane(layout => seedCentralDocuments(layout)),
  // Factory: the agent tab, pinned (agent/factoryCentre.ts), instruments open beside it.
  factory: seedWithoutTracksPane(seedFactoryCentre),
  // Expressions: the field fills one pane, and the Studio stands in Device view (manual §20.1 "the field fills one pane, the Studio stands in
  // Device view"; O-I #744). Its Full opens in a pane from its head (▦); a tree that already holds it keeps it as it was left.
  expressions: seedWithoutTracksPane(seedInstruments(['projection.expressions'])),
  // Technē: the world — the Earth and its system (the mockup's modes.techne: the M4 lens at system scale).
  techne: seedWithoutTracksPane(seedInstruments(['projection.earth'])),
}
