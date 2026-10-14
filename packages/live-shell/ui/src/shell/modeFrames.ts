// Each mode's frame as it first opens (FOUNDATION F1): the centre, the detail side and the parts shown, before the mode
// has a saved arrangement of its own. A registration table, read by the frame — never a branch in it. Once a mode has
// been stood in, its own book layout holds its frame and this table is not read again for it.
import type {SurfMode} from './modeGrammar'

export interface ModeFrame {
  centerPanel: string
  tab: 'session' | 'arrangement'
  detailMode: 'clip' | 'device'
  browser: boolean
  detail: boolean
  dock: boolean
}

const FRAME = {tab: 'session', detailMode: 'clip', browser: true, detail: true} as const

export const MODE_FRAMES: Readonly<Record<SurfMode, ModeFrame>> = {
  live: {...FRAME, centerPanel: 'world.expressions', detailMode: 'device', dock: false},
  base: {...FRAME, centerPanel: 'world.ground', dock: true},
  factory: {...FRAME, centerPanel: 'native.workbench', dock: true},
  expressions: {...FRAME, centerPanel: 'world.expressions', dock: false},
  techne: {...FRAME, centerPanel: 'world.ground', dock: true},
}
