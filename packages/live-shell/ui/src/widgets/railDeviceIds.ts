// The rail-born devices' names and their claims on the rail (moved from widgets/railDevices.tsx, which re-exports them; O-I #740): the
// rail's widgets of these ids draw their devices (frame/widgets/deviceWidgets.tsx claimRailWidget), claimed when this light module
// loads, with the shell's first frame. The publisher that reads their owners (widgets/railDevices.tsx RailDevices) loads when the rail
// first draws.
import {claimRailWidget} from '../frame/widgets/deviceWidgets'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import type {IconName} from '../inhabitants/sdk/Icon'

/** The family the rail-born devices stand in: their designs are `widgets:<id>` in the catalogue. */
export const RAIL_FAMILY = 'widgets'

/** The rail-born devices: the rail widget each one draws, its title, its mark, and what it reads. */
export const RAIL_DEVICES = [
  {id: 'trail', title: 'Trail', icon: 'trav', note: 'The workspace book\'s trail (desktop/cradle/src/workspace/store.ts TrailStop); a press returns to a stop.'},
  {id: 'files', title: 'Files', icon: 'lib', note: 'The files the followed agent read and changed, from its encounter tape (aikit encounter read, desktop/cradle/src/agent/tape), with the seat\'s diff counts; its Diff page the selected seat\'s working diff (kernel git_diff_read → Central central.git.diff, central.git-diff/v1), with no seat selected the selected world\'s repository, else the workspace\'s project, else the shell\'s (git_repository_read).'},
  {id: 'web', title: 'Web', icon: 'browser', note: 'The pages the followed agent fetched, from its encounter tape: each address and the text it got.'},
  {id: 'wiki', title: 'Wiki', icon: 'orbit', note: 'The root wiki\'s pages (Control/agents/wiki/wiki.json through the files seam), each read as its source through the knowledge owner (kernel knowledge read), its links the relations Central\'s wiki reading gives it (central.wiki.read).'},
  {id: 'nows', title: 'NOWs', icon: 'die', note: 'The ground\'s civil time, its Day and its open NOW clearings (kernel central inspect → central.civil-time-reading/v1, central.day-reading/v1, central.now-listing/v1).'},
] as const satisfies readonly {id: string; title: string; icon: IconName; note: string}[]
export type RailDeviceId = typeof RAIL_DEVICES[number]['id']

/** The device id on the door, which is also its design's key (frame/devices/designs.ts designKey). */
export const railDeviceId = (id: RailDeviceId): string => `${RAIL_FAMILY}:${id}`

// The rail's widget of each id draws its device (claimed when this module loads, before the rail first draws).
for (const spec of RAIL_DEVICES) claimRailWidget(spec.id, railDeviceId(spec.id))

/** A rail-born device as the runtime holds it: no rows of its own (its design draws on the binding's keys). */
export function railDevice(id: RailDeviceId): DeviceInstance {
  const spec = RAIL_DEVICES.find(item => item.id === id)!
  return {id: railDeviceId(id), family: RAIL_FAMILY, rows: [], values: {},
    face: {id, title: spec.title, icon: spec.icon, liveSemantic: 'device-instrument', note: spec.note,
      invariant: {generatesAbsent: 'Born on the rail: it reads its owner and draws what the owner reports; nothing it shows is filled in.'}}}
}
