// A workcell on its owners (lane W1-Factory; DLW §19.23, workcell:workcell — "Kind: rack · Track: a workcell: a return track in Factory,
// and the Works in of every track an agent works on"). A workcell is one of the machine's standing tracks of checkouts (env-1, env-2,
// env-3), drawn as a rack whose chain carries the road in and out: the Gateway (§19.2), the Remote carrier (§19.18), Git / landing with
// the Seat inside it (§19.16, §19.17). Its Compact is its chain list, each device with its light, and its four macros (§19.23 Compact);
// its widget is the Workcells tile (§19.23 Widget).
//
// What the owners report (real shapes in tests/fixtures/workcell-readings-2026-10-21.json, read-only):
//   `seat status --json` (central.workcell-status/v1; the kernel's seat_status_read, workcellReads.ts useSeatStatusAnswer): each workcell
//     of the register by name, and its seats — product, state, live branch, claimed_by, zones [{actor}], tracked_changes, untracked,
//     ahead_main, behind_main. The Name, the Seats, the tile's chips and lanes, and the seat Git / landing reads;
//   `workcell status --json` (the kernel's workcell_status_read, owners/readers.ts useWorkcellAnswer): workcell_ref — the Machine, as the
//     Remote carrier reads it (workcellBindings.ts carrierValues `here`);
//   the chain devices' own bindings (designBindings.ts gatewayBinding, workcellBindings.ts carrierBinding, gitBinding): each one's light
//     and one reading for the chain list, and the Gateway's Transport, Approvals and Stall after for the macros.
// What nothing reads yet, each absent with the operation it waits for: who works here with their track and mode (the claims name actors,
// not tracks or modes), the harness processes and their cost (`workcell instances list|usage`), the gateway's frames (a frame-ring read),
// the run's world, its lease and checkpoints, its exposure and the last reconcile (the kernel's material_read takes a run's receipt, and a
// workcell's return track carries no run), the services (`workcell doctor`).
// The writes: the macros Transport, Approvals and Stall after go the Gateway's own way (its rows to kernel:harness_agent_control, the same
// rows gatewayBinding writes through); Land as is Git / landing's and stands refused in its words (GIT_REFUSE.landAs); Read now, Recover,
// Checkpoint, Read services, Open, Apply and Release world stand disabled with the Workcell command no kernel route reaches yet
// (T-COVERAGE §1.2). Needed only and Open in are the shell's own holds. Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {GIT_REFUSE, SEAT_UNREAD, seatReading} from './workcellBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export const WORKCELL_RACK_DESIGN = 'workcell:workcell'
/** The workcell rack on the door: one device, drawn on the chain of the workcell selected (its return track) and as the Workcells tile. */
export const WORKCELL_RACK_ID = 'factory:workcell'

/** The workcell rack as a device of the runtime: the Workcell family's admitted `workcell` face (workcellFamilyManifest.ts — a rack whose
 * chains are the gateway, the remote carrier and the git seat), so designKey('workcell', 'workcell') is the design's id by the family's own
 * declaration. Null when the family does not admit it. It declares no rows of the address table: its design draws its binding's keys. */
export function workcellRackDevice(): DeviceInstance | null {
  return familyFaceDevice(WORKCELL_RACK_ID, 'workcell', 'workcell', 'Workcell', 'ret')
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** The run a workcell's pages would show, and why there is none on its own chain. */
const NO_RUN = 'material_read takes the run\'s receipt (`workcell --receipt R material`), and a workcell\'s return track carries no run: select a session\'s running task'

/** The keys no owner reports here, each with the reading it waits for. */
export const WORKCELL_ABSENT = {
  working: unread('Working here', 'a reading of the track and the mode each agent here works on (the seat claims name their actors only — see Seats; `aikit gateway who` places Positions by machine, not by workcell or track)', 'AIKit'),
  instances: unread('The harness processes and their cost', '`workcell instances list|usage` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
  frames: unread('The gateway\'s latest frames', 'a frame-ring read through the kernel (T-COVERAGE §1.2: Hermes)', 'Actuation'),
  run: unread('The run', `the selected track's running task — ${NO_RUN}`, 'Workcell'),
  world: unread('The run\'s world', NO_RUN, 'Workcell'),
  lease: unread('The world\'s lease', 'a lease reading (Workcell observes leases, MaterialLeaseProvider::observe_lease, but no command reports them)', 'Workcell'),
  checkpoints: unread('The world\'s checkpoints', 'a checkpoint list (no Workcell command takes or lists them)', 'Workcell'),
  readAt: unread('When the world was read', NO_RUN, 'Workcell'),
  services: unread('The services', '`workcell doctor` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
  surfaces: unread('What the run exposes', NO_RUN, 'Workcell'),
  omitted: unread('What the run could not expose', NO_RUN, 'Workcell'),
  reconciled: unread('The last reconcile', '`workcell reconcile --desired` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
} as const

/** The acts no owner carries here, each refused with its command. Land as is Git / landing's own refusal. */
export const WORKCELL_REFUSE = {
  landAs: GIT_REFUSE.landAs,
  reread: missing('Read now', `the kernel's material_read for a run — ${NO_RUN}`, 'Workcell'),
  recover: missing('Recover', '`workcell recover` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
  checkpoint: missing('Checkpoint', 'a checkpoint command (Workcell has none)', 'Workcell'),
  readServices: missing('Read services', '`workcell doctor` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
  open: missing('Open', `an endpoint the run exposes — ${NO_RUN}`, 'Workcell'),
  apply: missing('Apply', '`workcell --receipt R reconcile --desired` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
  releaseWorld: missing('Release world', '`workcell --receipt R release` through the kernel (T-COVERAGE §1.2)', 'Workcell'),
} as const
/** A binding's fate (`want:<binding ref>`) is set on a world's bindings, and no world is read here. */
export const FATE_REFUSE = missing('A binding\'s fate', `the run's world, whose bindings the fates are set on — ${NO_RUN}`, 'Workcell')

/** The macros that reach into the chain, each written by the Gateway (its rows, as gatewayBinding writes them). */
export const GATEWAY_MACROS: readonly string[] = ['transport', 'approvals', 'stallAfter']
const NO_GATEWAY = 'The Gateway is not drawn on its owner here (its design waits), so nothing carries this macro to its row.'
const NO_NAME = 'No workcell is selected: select a workcell\'s return track (⌥⌘R) to read its chain.'

/** The shell's own settings of the pages, and the shell's starting value of each (§19.23 Parameters: Needed only Off, Open in Web). */
export const WORKCELL_VIEW: Readonly<Record<string, Value>> = {needed: false, openIn: 'web'}

/** One seat of a workcell as the rack's Seats read it (workcell__workcell.tsx:15): the lane a held seat stands on (none on a free seat),
 * the claimant, its co-workers (the actors of its zones, the claimant left out — a free seat's zones are a leftover and no claim:
 * workcellBindings.ts seatReading), the files with no commit (tracked changes and untracked files) and the branch against main. */
function seatRow(row: Obj): Record<string, unknown> {
  const held = row.state !== 'free'
  const claimedBy = str(row.claimedBy)
  const workers = [...new Set((Array.isArray(row.zones) ? row.zones : []).flatMap(zone => (isObj(zone) && str(zone.actor) && zone.actor !== claimedBy ? [String(zone.actor)] : [])))]
  const dirty = num(row.dirty), untracked = num(row.untracked)
  return {product: row.product, state: row.state, lane: held ? str(row.branch) ?? null : null, claimedBy: claimedBy ?? null, workers,
    ...(dirty !== undefined && untracked !== undefined ? {dirty: dirty + untracked} : {}),
    ...(num(row.ahead) !== undefined ? {ahead: num(row.ahead)} : {}), ...(num(row.behind) !== undefined ? {behind: num(row.behind)} : {})}
}

/** The seat a workcell holds for a project, from the instrument's reading, or undefined. */
export function workcellSeat(status: unknown, workcell: string, project: string): Obj | undefined {
  const read = status == null ? null : seatReading(status)
  return read?.seats.find(seat => seat.workcell === workcell && String(seat.product).toLowerCase() === project.toLowerCase()) as Obj | undefined
}

/** Git / landing's reading on a workcell's chain (agentChainDevices.ts AgentChainReading's git fields, for workcellBindings.ts gitBinding):
 * the workcell's seat of the project — answered when the instrument lists it, its live branch, and its files with no commit (tracked
 * changes and untracked files) — refused when the instrument refused, unread while it reads. */
export function workcellGitReading(seats: {readonly status: 'reading' | 'answered' | 'refused'; readonly value: unknown}, workcell: string, project: string): {gitAdmitted: boolean | null; gitRepo: {branch?: string; uncommitted?: number}} {
  if (seats.status === 'refused') return {gitAdmitted: false, gitRepo: {}}
  if (seats.status !== 'answered') return {gitAdmitted: null, gitRepo: {}}
  const seat = workcellSeat(seats.value, workcell, project)
  if (!seat) return {gitAdmitted: false, gitRepo: {}}
  const dirty = num(seat.dirty), untracked = num(seat.untracked)
  return {gitAdmitted: true, gitRepo: {...(str(seat.branch) && seat.state !== 'free' ? {branch: String(seat.branch)} : {}),
    ...(dirty !== undefined && untracked !== undefined ? {uncommitted: dirty + untracked} : {})}}
}

export interface WorkcellRackInput {
  /** The workcell the chain stands for: the register's name its return track carries (frame/tracks/returnTracks.ts workcellOfTrack), null
   * when none is selected (the tile still reads every workcell). */
  readonly name: string | null
  /** The project whose seat the chain's Git / landing and Seat hold (the shell's project). */
  readonly project: string
  /** The seat instrument's reading (`seat status --json`), null while it has not answered. */
  readonly seats: unknown
  /** Why there is no seat reading, in the owner's words, when it refused. */
  readonly seatsUnread?: string
  /** The chain devices' own values, from their bindings: the Gateway's (null while its design waits), the Remote carrier's and Git /
   * landing's (null while its design waits). */
  readonly chain: {readonly gateway: Values | null; readonly carrier: Values; readonly git: Values | null}
  readonly holds: ChainHolds
}

/** The chain list (workcell__workcell.tsx:14): the three devices in the road's order, each with the light its own binding reads and one
 * reading — the Gateway's harness and transport, the Remote carrier's machine, Git / landing's branch and how far it is ahead of main. */
function chainList(input: WorkcellRackInput, seat: Obj | undefined): Record<string, Value>[] {
  const gateway = input.chain.gateway ?? {}, carrier = input.chain.carrier, git = input.chain.git ?? {}
  const entry = (id: string, name: string, light: Value | undefined, reading: string | undefined): Record<string, Value> =>
    ({id, name, ...(light === 'lit' || light === 'dark' ? {light} : {}), ...(reading ? {reading} : {})})
  const via = [str(gateway.harness), str(gateway.transport)].filter((part): part is string => !!part).join(' · ')
  const ahead = seat ? num(seat.ahead) : undefined
  const landing = str(git.branch) ? `${String(git.branch)}${ahead !== undefined ? ` · ${ahead} ahead` : ''}` : undefined
  return [entry('gateway', 'Gateway', gateway.light, via || undefined), entry('carrier', 'Remote carrier', carrier.light, str(carrier.here)),
    entry('landing', 'Git / landing', git.light, landing)]
}

/** The workcell's values. Each key from the owner that reports it, or absent. */
export function workcellRackValues(input: WorkcellRackInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, WORKCELL_RACK_ID)
  for (const [key, value] of Object.entries(WORKCELL_VIEW)) values[key] = view[key] ?? value
  const read = input.seats == null ? null : seatReading(input.seats)
  // The tile's chips: every workcell of the register, each with the lane its seat of the project holds (none on a free seat).
  if (read) {
    const names = [...new Set(read.seats.map(seat => String(seat.workcell)))]
    values.workcells = JSON.stringify(names.map(name => {
      const seat = read.seats.find(row => row.workcell === name && String(row.product).toLowerCase() === input.project.toLowerCase())
      return {name, lane: seat && seat.state !== 'free' ? str(seat.branch) ?? null : null}
    }))
  }
  const gateway = input.chain.gateway ?? {}
  for (const key of GATEWAY_MACROS) put(values, key, gateway[key])
  if (input.name == null) return values
  values.name = input.name
  put(values, 'machine', str(input.chain.carrier.here))
  const seat = read ? workcellSeat(input.seats, input.name, input.project) : undefined
  values.chain = JSON.stringify(chainList(input, seat))
  const mine = read ? read.seats.filter(row => row.workcell === input.name) : null
  // The project's seat first, then the others in the instrument's order: the folded workcell and a track's Works in read "the lane its seat
  // holds" (§19.23 Folded) from the seat of the project the chain stands for (workcell__workcell.tsx laneOf: the first seat with a lane).
  const ours = (row: Record<string, unknown>) => String(row.product).toLowerCase() === input.project.toLowerCase()
  if (mine) values.seats = JSON.stringify([...mine.filter(ours), ...mine.filter(row => !ours(row))].map(row => seatRow(row as Obj)))
  // The light: the register holds this workcell and its gateway answered; dark when the gateway did not, or the register does not hold it.
  if (gateway.light === 'dark' || (mine && mine.length === 0)) values.light = 'dark'
  else if (gateway.light === 'lit' && mine && mine.length > 0) values.light = 'lit'
  return values
}

/** The workcell's ports: the Gateway's binding, whose rows the macros write through. */
export interface WorkcellRackPorts {
  readonly gateway: Pick<DesignBinding, 'write'> | null
}

export function workcellRackBinding(input: WorkcellRackInput, ports: WorkcellRackPorts): DesignBinding {
  const values = workcellRackValues(input)
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(WORKCELL_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(WORKCELL_REFUSE)) standing[key] = {disabled: why}
  if (!ports.gateway) for (const key of GATEWAY_MACROS) standing[key] = {disabled: NO_GATEWAY}
  if (input.name == null) for (const key of ['name', 'machine', 'chain', 'seats', 'light']) standing[key] = {disabled: NO_NAME}
  else {
    const seatsWhy = input.seatsUnread ?? SEAT_UNREAD
    if (!('seats' in values)) standing.seats = {disabled: seatsWhy}
    if (!('machine' in values)) standing.machine = {disabled: unread('The machine', 'the Remote carrier\'s reading of `workcell status` (it has not answered)', 'Workcell')}
    if (!('light' in values)) standing.light = {disabled: 'The light is a reading: the register and the workcell\'s gateway have not both answered.'}
  }
  return {
    id: WORKCELL_RACK_ID,
    values,
    standing,
    local: Object.fromEntries(Object.keys(WORKCELL_VIEW).map(key => [key, (value: Value | undefined) => holdView(WORKCELL_RACK_ID, key, value)])),
    writes: key => GATEWAY_MACROS.includes(key) || key in WORKCELL_REFUSE || key.startsWith('want:'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (GATEWAY_MACROS.includes(key)) {
          if (!ports.gateway?.write) throw Error(NO_GATEWAY)
          await ports.gateway.write([{key, value}])
          continue
        }
        if (key.startsWith('want:')) throw Error(FATE_REFUSE)
        throw Error(WORKCELL_REFUSE[key as keyof typeof WORKCELL_REFUSE] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
