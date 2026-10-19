// The mode dock's tile identities and each mode's companion, apart from the dock's bodies: the rail names its tiles and the
// companion before any body's code has loaded (shell/widgets.tsx; shell/loadWhenDrawn.ts).
import type {SurfMode} from './modeGrammar'
import type {IconName} from '../inhabitants/sdk/Icon'

/** The dock's tile identities (Rev 4's tile set). `body: 'owner'` tiles
 * name the owner read that fills them — designed frames, honest empties. */
export interface TileSpec {
  readonly id: string
  readonly name: string
  readonly mark: IconName
  readonly launcherOnly?: boolean
}

export const TILES: Record<string, TileSpec> = {
  agent: {id: 'agent', name: 'Agent', mark: 'dock'},
  packet: {id: 'packet', name: 'Packet', mark: 'cap'},
  trail: {id: 'trail', name: 'Trail', mark: 'trav'},
  field: {id: 'field', name: 'Field', mark: 'browser'},
  agents: {id: 'agents', name: 'Agents', mark: 'bind'},
  nows: {id: 'nows', name: 'NOWs', mark: 'die'},
  terminal: {id: 'terminal', name: 'Terminal', mark: 'keys', launcherOnly: true},
  files: {id: 'files', name: 'Files', mark: 'lib', launcherOnly: true},
  results: {id: 'results', name: 'Results', mark: 'detail', launcherOnly: true},
  sky: {id: 'sky', name: 'Sky', mark: 'form', launcherOnly: true},
}

/** The companion per mode (Rev 3's right-column row). */
export const COMPANIONS: Record<SurfMode, {name: string; tabs: string; note: string}> = {
  live: {name: 'Fizz', tabs: 'Conversation · Activity · Context · Inspect', note: 'The situated agent rides the shell in every mode; its chain docks in the detail row.'},
  base: {name: 'Fizz', tabs: 'Conversation · Activity · Context · Inspect', note: 'The situated agent for the ground. The conversation device docks on the detail chain; the packet tile shows exactly what it receives.'},
  factory: {name: 'Fizz', tabs: 'Activity · Context · Inspect · Results', note: 'The result desk — the agency surface carries the live dock.'},
  expressions: {name: 'Anima', tabs: 'Nara · oracle', note: 'The Expressions companion — the Nara/oracle side of the retained body.'},
  techne: {name: 'Epii', tabs: 'Epii · Source · Proposals · Field', note: 'The Technē companion — source, proposals and the field\'s arrivals.'},
}
