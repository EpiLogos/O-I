// The tiles each mode's rail opens with before the person opens or closes any (manual: Central §18 "the agent of the world, the Packet and
// the Trail on the rail"; Factory §19 "the Results, Agents and Terminal tiles on the rail"; Expressions §20 "the agent composing in it, the
// sky and the Trail stand on the rail"; Technē §17 "the Journey and Trail tiles stand on the rail"; Live §21 "the Torus and Trail tiles on
// the rail"; O-I #744). Once the person changes the rail, the workspace book holds their own open set (desktop/cradle/src/workspace/store.ts
// toggleWidget, which starts from the tiles shown) and that rail is theirs: it is never reset to these. A registration table, read by the
// frame. The Journey and the Torus are their devices' own widgets on the rail (frame/devices/deviceDoor.ts deviceWidgetId: the Journey's
// design techne:journey, techne/devices/designDevices.ts JOURNEY_DESIGN; the torus live:m1-torus, live/torusDevice.ts TORUS_DEVICE_ID), named
// here as ids so the rail's first frame loads neither device.
import type {SurfMode} from './modeGrammar'

export const MODE_WIDGETS: Readonly<Record<SurfMode, readonly string[]>> = {
  base: ['device:central:agent', 'packet', 'trail'],
  factory: ['results', 'agents', 'terminal'],
  expressions: ['agent', 'sky', 'trail'],
  techne: ['device:techne:journey', 'trail'],
  live: ['device:live:m1-torus', 'trail'],
}

/** The tiles a mode's rail opens with, until the person changes it. */
export const defaultWidgets = (mode: SurfMode): readonly string[] => MODE_WIDGETS[mode]
