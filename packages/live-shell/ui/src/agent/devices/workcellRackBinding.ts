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
//   `workcell doctor` (lane W10, workcell_read {doctor}): the Services page, each declared service with its endpoint, health,
//     availability and lifetime (workcellMaterial.ts servicesOf); Read now asks doctor again. Workcell has no `services` command: what doctor
//     declares is what Services draws;
//   `workcell instances list` and each live instance's `instances usage` (workcell_read {instances-list, instances-usage}): the harness
//     processes and their cost (workcellMaterial.ts instancesOf).
//   `workcell worlds` (lane W12, workcell_read {worlds}, workcell.world-receipts/v1; EpiLogos/Workcell PR 120): the world receipts the cell
//     keeps, each with its workcell_ref. The rack's world is the receipt listed for its machine's cell: none listed is no world (JSON null);
//     one is that world; several wait for the hand's choice (`worldReceipt`), and none is assumed. A receipt written elsewhere with
//     `--receipt` is not listed (Workcell's note). The chosen receipt is read with the kernel's material_read (`workcell --receipt R
//     material`, workcellMaterial.ts materialWorldOf): the World and Exposure pages, and the bindings Apply sets fates on.
//   the chosen world's leases and checkpoints (lane K0; EpiLogos/Workcell PR 123): `workcell --receipt R lease` (workcell_read {lease},
//     workcell.material-leases/v1: each binding's lease as its provider reports it) and `workcell --receipt R checkpoints` (workcell_read
//     {checkpoints}, workcell.material-checkpoints/v1). The world's lease is its earliest-ending leased binding's (expiresAt, renewable);
//     a world whose bindings hold no lease, or never expire, lives until released (expiresAt null); a binding whose provider did not answer
//     leaves the lease absent with its error.
// What nothing reads, each absent with the operation it waits for: who works here with their track and mode (the claims name actors, not
// tracks or modes), the gateway's frames (a frame-ring read).
// The writes: the macros Transport, Approvals and Stall after go the Gateway's own way (its rows to kernel:harness_agent_control, the same
// rows gatewayBinding writes through); Land as is Git / landing's and stands refused in its words (GIT_REFUSE.landAs). Recover, Apply
// (reconcile) and Release world are Workcell's writes on the machine's worlds (workcell_write {recover, release, reconcile}): each goes only
// on the person's press, on the receipt the world's reading handed in, and is refused in Workcell's words; with no world read they stand
// disabled naming the receipt they lack. Checkpoint takes a checkpoint of the world through its binding's provider (workcell_write
// {checkpoint}, `workcell --receipt R checkpoint`); a binding whose provider takes none is Workcell's refusal (kind unsupported), shown at the
// act. Needed only and Open in are the shell's own holds. Pure, apart
// from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {FRAME_RING, familyFaceDevice} from './mainTrackBindings'
import {GIT_REFUSE, SEAT_UNREAD, seatReading, type WorkcellAnswer} from './workcellBindings'
import {NO_RUN, instancesOf, materialWorldOf, reconciledOf, servicesOf, worldsOf, type ListedWorld} from './workcellMaterial'
import type {WorkcellWriteRequest} from '../../../../../../desktop/cradle/src/kernel/types'

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

/** Why the run's world is not read (workcellMaterial.ts NO_RUN). */
export {NO_RUN}

/** The keys no owner reports here, each with the reading it waits for. */
export const WORKCELL_ABSENT = {
  working: unread('Working here', 'a reading of the track and the mode each agent here works on (the seat claims name their actors only — see Seats; `aikit gateway who` places Positions by machine, not by workcell or track)', 'AIKit'),
  instances: 'The harness processes and their cost: Workcell\'s `workcell instances list` is not read here (the rail reads it while the rack stands).',
  frames: `The gateway's latest frames: ${FRAME_RING}`,
  run: unread('The run', `the selected track's running task — ${NO_RUN}`, 'Workcell'),
  world: unread('The run\'s world', NO_RUN, 'Workcell'),
  lease: unread('The world\'s lease', `\`workcell --receipt R lease\` on the world's receipt — ${NO_RUN}`, 'Workcell'),
  checkpoints: unread('The world\'s checkpoints', `\`workcell --receipt R checkpoints\` on the world's receipt — ${NO_RUN}`, 'Workcell'),
  readAt: unread('When the world was read', NO_RUN, 'Workcell'),
  services: 'The services: Workcell\'s `workcell doctor` is not read here (the rail reads it while the rack stands; Workcell has no `services` command, doctor declares them).',
  surfaces: unread('What the run exposes', NO_RUN, 'Workcell'),
  omitted: unread('What the run could not expose', NO_RUN, 'Workcell'),
  reconciled: unread('The last reconcile', NO_RUN, 'Workcell'),
} as const

/** The acts no owner carries here, each refused with its command. Land as is Git / landing's own refusal. */
export const WORKCELL_REFUSE = {
  landAs: GIT_REFUSE.landAs,
  reread: missing('Read now', `the kernel's material_read of a world — ${NO_RUN}`, 'Workcell'),
  recover: missing('Recover', `\`workcell --receipt R recover\` on the world's receipt — ${NO_RUN}`, 'Workcell'),
  checkpoint: missing('Checkpoint', `\`workcell --receipt R checkpoint\` on the world's receipt — ${NO_RUN}`, 'Workcell'),
  readServices: 'Read services: the kernel carrier is unavailable here, so Workcell\'s `workcell doctor` cannot be asked.',
  open: 'Open: opening a surface\'s endpoint in the Web monitor or a pane is the frame\'s act, and this rack is not handed an opener (the endpoint stands on the Exposure page to read).',
  apply: missing('Apply', `\`workcell --receipt R reconcile --desired <ref>=<state>\` on the world's receipt — ${NO_RUN}`, 'Workcell'),
  releaseWorld: missing('Release world', `\`workcell --receipt R release\` on the world's receipt — ${NO_RUN}`, 'Workcell'),
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
  /** `workcell doctor` (the Services page); absent: not read here. */
  readonly doctor?: WorkcellAnswer
  /** `workcell instances list`, and each live instance's `instances usage` by instance ref; absent: not read here. */
  readonly instances?: {readonly list: WorkcellAnswer; readonly usages: Readonly<Record<string, {readonly value?: unknown; readonly error?: string}>>}
  /** The run's world as a material reading handed it: its receipt, its ref and its bindings' logical refs. Absent: derived from `worlds` and
   * `material` below, or none is read (NO_RUN). */
  readonly world?: {readonly receipt: string; readonly ref: string; readonly bindings: readonly string[]} | null
  /** `workcell worlds` (the cell's world receipts); absent: not read here. */
  readonly worlds?: WorkcellAnswer
  /** The kernel's material_read of the chosen receipt (its native_owner_reading data, or its failure in Workcell's words). */
  readonly material?: WorkcellAnswer
  /** The last reconcile's answer in this window (`workcell --receipt R reconcile`), absent while none ran here. */
  readonly reconciled?: unknown
  /** `workcell --receipt R lease` of the chosen world (workcell_read {lease}); absent: not read here. */
  readonly lease?: WorkcellAnswer
  /** `workcell --receipt R checkpoints` of the chosen world (workcell_read {checkpoints}); absent: not read here. */
  readonly checkpoints?: WorkcellAnswer
}

/** The world's lease as the design reads it (workcell__workcell.tsx `lease` {expiresAt, renewable}), from Workcell's leases
 * (workcell.material-leases/v1): the earliest-ending leased binding's expiry (ms) and whether it renews; null expiry when every binding holds
 * no lease or never expires (it lives until released); or why it is not known — a binding whose provider did not answer, in its error. Pure. */
export function worldLeaseOf(reading: unknown): {lease: {expiresAt: number | null; renewable?: boolean}} | {why: string} | null {
  if (!isObj(reading) || reading.schema !== 'workcell.material-leases/v1' || !Array.isArray(reading.leases)) return null
  const rows = reading.leases.filter(isObj)
  const unobserved = rows.find(row => row.standing === 'unobserved')
  if (unobserved) return {why: `The lease of ${str(unobserved.logical_ref) ?? 'a binding'} is not observed: ${str(unobserved.error) ?? 'its provider did not say why'}.`}
  const leased = rows.filter(row => row.standing === 'leased').flatMap(row => {
    const at = typeof row.expires_at === 'string' ? Date.parse(row.expires_at) : NaN
    return Number.isFinite(at) ? [{at, renewable: typeof row.renewable === 'boolean' ? row.renewable : undefined}] : []
  }).sort((a, b) => a.at - b.at)
  if (leased[0]) return {lease: {expiresAt: leased[0].at, ...(leased[0].renewable !== undefined ? {renewable: leased[0].renewable} : {})}}
  if (rows.some(row => row.standing === 'leased')) return {why: 'Workcell names a leased binding whose expiry it does not give.'}
  return {lease: {expiresAt: null}}
}

/** The world's checkpoints as the design reads them (`checkpoints` [{ref, state, reusable, at}]), from Workcell's checkpoint ledger
 * (workcell.material-checkpoints/v1). Null when the answer is not that ledger. Pure. */
export function worldCheckpointsOf(reading: unknown): {ref: string; state?: string; reusable?: boolean; at?: number}[] | null {
  if (!isObj(reading) || reading.schema !== 'workcell.material-checkpoints/v1' || !Array.isArray(reading.checkpoints)) return null
  return reading.checkpoints.filter(isObj).flatMap(row => (str(row.checkpoint_ref) ? [{ref: String(row.checkpoint_ref),
    ...(str(row.state) ? {state: String(row.state)} : {}), ...(typeof row.reusable === 'boolean' ? {reusable: row.reusable} : {}),
    ...(num(row.taken_at_unix_ms) !== undefined ? {at: num(row.taken_at_unix_ms)} : {})}] : []))
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
  // The machine's services and harness processes are this machine's Workcell's, whichever workcell is chosen.
  const services = input.doctor?.status === 'answered' ? servicesOf(input.doctor.value) : null
  if (services) values.services = JSON.stringify(services)
  const instances = input.instances?.list.status === 'answered' ? instancesOf(input.instances.list.value, input.instances.usages) : null
  if (instances) values.instances = JSON.stringify(instances)
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

/** The workcell's ports: the Gateway's binding, whose rows the macros write through; doctor read again; Workcell's world writes. */
export interface WorkcellRackPorts {
  readonly gateway: Pick<DesignBinding, 'write'> | null
  /** Ask `workcell doctor` again (Read services). Absent: no carrier stands. */
  readonly rereadServices?: () => void
  /** Workcell's writes on a prepared world (workcell_write {recover, release, reconcile}). Absent: no carrier stands. */
  readonly workcell?: (request: WorkcellWriteRequest) => Promise<unknown>
  /** Read the chosen world's material again (Read now). Absent: no carrier stands. */
  readonly rereadWorld?: () => void
}

/** The world the rack shows: of `workcell worlds`, the receipts listed for its machine's cell (workcell_ref); with several, the hand's
 * choice (`worldReceipt`), none assumed. `why` says why there is no world to read, in words; `none` is true when none is listed. Pure. */
export function chosenWorld(worlds: WorkcellAnswer | undefined, machine: string | null | undefined, choice: unknown): {listed: ListedWorld[]; chosen: ListedWorld | null; none: boolean; why: string | null} {
  const answer = worlds?.status === 'answered' ? worldsOf(worlds.value) : null
  if (!worlds) return {listed: [], chosen: null, none: false, why: unread('The world', NO_RUN, 'Workcell')}
  if (worlds.status === 'refused') return {listed: [], chosen: null, none: false, why: worlds.error ?? 'Workcell refused its world receipts.'}
  if (worlds.status === 'reading') return {listed: [], chosen: null, none: false, why: 'Workcell has not answered its world receipts yet (`workcell worlds`).'}
  if (!answer) return {listed: [], chosen: null, none: false, why: '`workcell worlds` answered something other than its world receipts.'}
  if (!machine) return {listed: [], chosen: null, none: false, why: 'This machine\'s Workcell ref is not read (`workcell status`), so no receipt can be told as this cell\'s.'}
  const listed = answer.worlds.filter(world => world.workcellRef === machine)
  if (!listed.length) return {listed, chosen: null, none: true, why: null}
  if (listed.length === 1) return {listed, chosen: listed[0]!, none: false, why: null}
  const chosen = listed.find(world => world.receipt === choice) ?? null
  return {listed, chosen, none: false, why: chosen ? null : `${listed.length} worlds are listed for ${machine}: choose one; none is assumed (${listed.map(world => world.worldRef).join(', ')}).`}
}

/** The fates a binding may be set to before Apply (workcell__workcell.tsx `want:<binding ref>`), in Workcell's reconcile words. */
export const BINDING_FATES: readonly string[] = ['present', 'suspended', 'snapshotted', 'released']

export function workcellRackBinding(input: WorkcellRackInput, ports: WorkcellRackPorts): DesignBinding {
  const values: Record<string, Value> = {...workcellRackValues(input)}
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(WORKCELL_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(WORKCELL_REFUSE)) standing[key] = {disabled: why}
  if (!ports.gateway) for (const key of GATEWAY_MACROS) standing[key] = {disabled: NO_GATEWAY}
  // Services and the harness processes: Workcell's answers, or its refusal in its words while they do not stand.
  const answerWhy = (answer: WorkcellAnswer | undefined, fallback: string, command: string) => (answer?.status === 'refused' ? answer.error ?? fallback
    : answer?.status === 'reading' ? `Workcell has not answered \`${command}\` yet.` : answer ? `\`${command}\` answered something other than its reading.` : fallback)
  if (!('services' in values)) standing.services = {disabled: answerWhy(input.doctor, WORKCELL_ABSENT.services, 'workcell doctor')}
  else delete standing.services
  if (!('instances' in values)) standing.instances = {disabled: answerWhy(input.instances?.list, WORKCELL_ABSENT.instances, 'workcell instances list')}
  else delete standing.instances
  if (ports.rereadServices) delete standing.readServices
  // The world (W12): the receipt listed for this machine's cell, read with material_read. The pages draw what the reading names.
  const view = viewHolds(input.holds, WORKCELL_RACK_ID)
  const picked = input.worlds ? chosenWorld(input.worlds, typeof values.machine === 'string' ? values.machine : null, view.worldReceipt) : null
  const read = picked?.chosen && input.material?.status === 'answered' ? materialWorldOf(input.material.value) : null
  if (picked) {
    for (const key of ['world', 'surfaces', 'omitted', 'readAt', 'run']) delete standing[key]
    if (picked.none) values.world = 'null'
    // The run the pages show: the world's one ledger run (Workcell PR 122), else the run its receipt names among its subjects.
    const subjects = picked.chosen?.subjects ?? {}
    const run = picked.chosen?.runs?.length === 1 ? picked.chosen.runs[0] : subjects.factory_run ?? subjects.run
    if (run) values.run = run
    else standing.run = {disabled: picked.chosen ? 'The run: the world\'s receipt names no run among its subjects.' : picked.why ?? 'No world is prepared for this cell.'}
    if (read) {
      values.world = JSON.stringify(read.world)
      if (read.surfaces) values.surfaces = JSON.stringify(read.surfaces)
      if (read.omitted) values.omitted = JSON.stringify(read.omitted)
      if (read.readAt !== undefined) values.readAt = read.readAt
    }
    const materialWhy = !picked.chosen ? picked.why ?? 'No world is prepared for this cell (`workcell worlds` lists none for it; a receipt written elsewhere with `--receipt` is not listed).'
      : input.material?.status === 'refused' ? input.material.error ?? 'Workcell refused the material reading.'
        : input.material?.status === 'answered' && !read ? '`workcell material` answered something other than its material reading.'
          : 'Workcell has not answered the world\'s material reading yet (`workcell --receipt R material`).'
    for (const key of ['surfaces', 'omitted', 'readAt']) if (!(key in values)) standing[key] = {disabled: read?.exposureError && key !== 'readAt' ? `What the run exposes: ${read.exposureError}` : materialWhy}
    if (!('world' in values)) standing.world = {disabled: materialWhy}
  }
  // The world's lease and checkpoints (lane K0): Workcell's own readings of the chosen world's receipt, or why each stands absent.
  if (picked) {
    const noWorld = picked.why ?? 'No world is prepared for this cell (`workcell worlds` lists none for it).'
    const leaseRead = picked.chosen && input.lease?.status === 'answered' ? worldLeaseOf(input.lease.value) : null
    if (leaseRead && 'lease' in leaseRead) { values.lease = JSON.stringify(leaseRead.lease); delete standing.lease }
    else standing.lease = {disabled: !picked.chosen ? noWorld : leaseRead ? leaseRead.why : answerWhy(input.lease, WORKCELL_ABSENT.lease, 'workcell --receipt R lease')}
    const kept = picked.chosen && input.checkpoints?.status === 'answered' ? worldCheckpointsOf(input.checkpoints.value) : null
    if (kept) { values.checkpoints = JSON.stringify(kept); delete standing.checkpoints }
    else standing.checkpoints = {disabled: !picked.chosen ? noWorld : answerWhy(input.checkpoints, WORKCELL_ABSENT.checkpoints, 'workcell --receipt R checkpoints')}
  }
  const reconciled = input.reconciled !== undefined ? reconciledOf(input.reconciled) : null
  if (reconciled) { values.reconciled = JSON.stringify(reconciled); delete standing.reconciled }
  else if (picked?.chosen) standing.reconciled = {disabled: 'The last reconcile: none ran in this window (it is the answer to Apply; Workcell keeps no reading of the last one).'}
  // The world's writes: only with a world read (its receipt) and a carrier; each the person's press.
  const world = input.world ?? (picked?.chosen ? {receipt: picked.chosen.receipt, ref: picked.chosen.worldRef, bindings: read?.bindings ?? []} : null)
  if (picked?.chosen && ports.rereadWorld) delete standing.reread
  else if (picked) standing.reread = {disabled: picked.chosen ? 'Read now: the kernel carrier is unavailable here, so Workcell cannot be asked.' : `Read now: ${picked.why ?? 'no world is prepared for this cell.'}`}
  if (world && ports.workcell) for (const key of ['recover', 'apply', 'releaseWorld', 'checkpoint']) delete standing[key]
  else if (world) for (const key of ['recover', 'apply', 'releaseWorld', 'checkpoint']) standing[key] = {disabled: 'The kernel carrier is unavailable here, so Workcell cannot be asked.'}
  else if (picked) standing.checkpoint = {disabled: `Checkpoint: ${picked.why ?? 'no world is prepared for this cell.'}`}
  /** Apply: each binding of the world whose fate you set, as `<logical ref>=<state>`; none set, nothing to ask. */
  const desired = (): string[] => {
    const view = viewHolds(chainHolds(), WORKCELL_RACK_ID)
    return (world?.bindings ?? []).flatMap(ref => (typeof view[`want:${ref}`] === 'string' && BINDING_FATES.includes(String(view[`want:${ref}`])) ? [`${ref}=${String(view[`want:${ref}`])}`] : []))
  }
  const worldWrite = async (key: 'recover' | 'apply' | 'releaseWorld' | 'checkpoint', value: Value | undefined) => {
    if (standing[key]?.disabled || !world || !ports.workcell) throw Error(standing[key]?.disabled ?? WORKCELL_REFUSE[key])
    if (key !== 'apply' && value !== world.ref) throw Error(`${key === 'recover' ? 'Recover' : key === 'checkpoint' ? 'Checkpoint' : 'Release world'}: that is not the world read here (${world.ref}).`)
    // Checkpoint: Workcell takes it through the binding's provider, or refuses in its words (a provider that takes none: unsupported).
    if (key === 'checkpoint') { await ports.workcell({kind: 'checkpoint', receipt: world.receipt}); return }
    if (key === 'apply') {
      const asked = desired()
      if (!asked.length) throw Error('Apply: no binding\'s fate is set.')
      await ports.workcell({kind: 'reconcile', receipt: world.receipt, desired: asked})
      return
    }
    await ports.workcell({kind: key === 'recover' ? 'recover' : 'release', receipt: world.receipt})
  }
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
    local: Object.fromEntries([...Object.keys(WORKCELL_VIEW), 'worldReceipt'].map(key => [key, (value: Value | undefined) => holdView(WORKCELL_RACK_ID, key, value)])),
    writes: key => GATEWAY_MACROS.includes(key) || key in WORKCELL_REFUSE || key.startsWith('want:'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (GATEWAY_MACROS.includes(key)) {
          if (!ports.gateway?.write) throw Error(NO_GATEWAY)
          await ports.gateway.write([{key, value}])
          continue
        }
        if (key === 'readServices') {
          if (!ports.rereadServices) throw Error(WORKCELL_REFUSE.readServices)
          ports.rereadServices()
          continue
        }
        if (key === 'recover' || key === 'apply' || key === 'releaseWorld' || key === 'checkpoint') { await worldWrite(key, value); continue }
        if (key === 'reread') {
          if (standing.reread?.disabled || !ports.rereadWorld) throw Error(standing.reread?.disabled ?? WORKCELL_REFUSE.reread)
          ports.rereadWorld()
          continue
        }
        if (key.startsWith('want:')) {
          if (!world) throw Error(FATE_REFUSE)
          const ref = key.slice('want:'.length)
          if (!world.bindings.includes(ref)) throw Error(`${ref} is not a binding of the world read here.`)
          if (value !== undefined && !BINDING_FATES.includes(String(value))) throw Error(`A binding's fate is one of ${BINDING_FATES.join(', ')}.`)
          holdView(WORKCELL_RACK_ID, key, value)
          continue
        }
        throw Error(WORKCELL_REFUSE[key as keyof typeof WORKCELL_REFUSE] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
