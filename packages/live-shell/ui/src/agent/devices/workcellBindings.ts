// Workcell's devices on their owners (lane BF3): Git / landing (DLW §19.16, workcell:git-seat — "last device on a workcell's chain, with
// the Seat inside it"), the Seat (§19.17, workcell:seat — "inside Git / landing, on a workcell's chain"), the Remote carrier (§19.18,
// workcell:remote-carrier — "second device on a workcell's chain, after the Gateway") and the Link (§19.19, workcell:link — "in the
// transport, in every mode"). Since lane W1-Factory they stand where the manual puts them: the first three on a workcell's chain
// (FactoryDeviceChain.tsx with a workcell, workcellRackBinding.ts), never on a session's or the Main track's; the Link in the transport,
// which publishes it (the frame's own) on linkBinding below.
//
// What the owners report, read 16 Oct 2026 (scratch lane-bf3/shapes/):
//   `workcell status --json` — the kernel's workcell_status_read (owner_read.rs:1133, owners/readers.ts useWorkcellAnswer):
//     {workcell_ref "workcell:mac", connections [{label, state connected, endpoint, protocol workcell.control/v1, remote_workcell_ref,
//     expires_at_unix_ms}], connection_grants {active, expired, revoked}, …} — the Remote carrier's machines and the Link's here;
//   `seat status --json` (schema central.workcell-status/v1: workcells [{name, path, disk_free_gb, min_free_gb, hard_free_gb, seats
//     [{product, state, registered_branch/head, claimed_by, zones [{actor, regions, since_unix_seconds}], live_branch/head,
//     tracked_changes, untracked, ahead_main, behind_main, admission}]}]) — the seat instrument's own reading, which the kernel runs
//     since lane K1 as `seat_status_read` (workcellReads.ts useSeatStatusAnswer: slow, read once and on demand). A free seat still lists
//     the zones of lanes that left (release clears workers, not zones): a zone on a free seat is no claim, so it is not read as one;
//   git_repository_read — the chain's git reading (agentChainDevices.ts gitRepoReading: head_branch, the repo root's dirty_files);
//     `central.git.census` answered `unavailable_capability: No eligible Connector implements GitState` through the CLI here;
//   `aikit gateway who --project-world project:O-I --json` (aikit.population-reading/v1), which the kernel runs as inhabitation_read
//     {kind: population} (usePopulationAnswer.ts): local_workcell_ref, remotes [{workcell_ref, gateway_ref, status reachable |
//     unreachable, detail}] — the declared remote Workcells, each asked once — and positions [{position_ref, label, handle, occupancy
//     {state, workcell_ref, …}}]: the Link's machines, their standing and who runs on each. Here omarchy answered `unreachable`
//     ("connection timed out") and five Positions stood occupied on workcell:mac. `gateway remote list` (aikit.gateway-remotes/v1, the
//     kernel's `gateway_remotes_read` since lane K1: workcellReads.ts) gives each declared machine its endpoint (websocket_bind) and says
//     whether the link is joined; the lag, the clock and the threads have no reading.
// The writes: `seat join` and `seat release` have no kernel op; `workcell-cli git commit|push` and `seat land` do not exist; moving a
// session to another machine, joining the link and its Share have no owner operation. Each stands disabled with that reason.
// Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {parseSeatStatusJson} from '../../inhabitants/centralHygieneModel'
import {chainDeviceId, type AgentChainReading} from './agentChainDevices'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export const GIT_DESIGN = 'workcell:git-seat'
export const SEAT_DESIGN = 'workcell:seat'
export const CARRIER_DESIGN = 'workcell:remote-carrier'
export const LINK_DESIGN = 'workcell:link'
export const GIT_ID = chainDeviceId('git')
export const SEAT_ID = 'factory:git:seat'
export const CARRIER_ID = 'factory:main:remote-carrier'
export const LINK_ID = 'factory:main:link'
export const WORKCELL_DEVICE_IDS: readonly string[] = [SEAT_ID, CARRIER_ID, LINK_ID]

export const workcellDevices = (): {seat: DeviceInstance | null; carrier: DeviceInstance | null; link: DeviceInstance | null} => ({
  seat: familyFaceDevice(SEAT_ID, 'workcell', 'seat', 'Seat', 'lib'),
  carrier: familyFaceDevice(CARRIER_ID, 'workcell', 'remote-carrier', 'Remote carrier', 'link'),
  link: familyFaceDevice(LINK_ID, 'workcell', 'link', 'Link', 'linkChain'),
})

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}
const reading = (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`
const held = (id: string, keys: readonly string[]) => Object.fromEntries(keys.map(key => [key, (value: Value | undefined) => holdView(id, key, value)]))

/** An owner answer as the window holds it: the kernel's workcell reading (owners/readers.ts useWorkcellAnswer), AIKit's population
 * (usePopulationAnswer.ts). */
export interface WorkcellAnswer {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value: unknown
  readonly error: string | null
}

// ---------------------------------------------------------------------------------------------------------------- Git / landing

export const GIT_REFUSE = {
  'commit-policy': missing('Commit', 'workcell-cli git commit (the address table\'s write path names a command that does not exist)', 'Workcell'),
  'push-policy': missing('Push', 'workcell-cli git push (no such command)', 'Workcell'),
  landAs: missing('Land as', 'a landing form held by the seat (no owner holds it)', 'Workcell'),
  land: missing('Land', 'workcell-cli seat land (no such command; the seat instrument has no kernel op)', 'Workcell'),
} as const

/** Git / landing's values: the chain's git reading — its light, the checkout's branch and the files with no commit. The seat, the
 * branch against main, the commits, the diff's sums, the checks and the policies have no reading a kernel op reaches here. */
export function gitValues(reading: Pick<AgentChainReading, 'gitAdmitted' | 'gitRepo'>, holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  if (reading.gitAdmitted === true) values.light = 'lit'
  if (reading.gitAdmitted === false) values.light = 'dark'
  put(values, 'branch', reading.gitRepo.branch)
  put(values, 'uncommitted', reading.gitRepo.uncommitted)
  put(values, 'sel', viewHolds(holds, GIT_ID).sel)
  return values
}

export function gitBinding(git: Pick<AgentChainReading, 'gitAdmitted' | 'gitRepo'>, holds: ChainHolds): DesignBinding {
  return {
    id: GIT_ID,
    values: gitValues(git, holds),
    standing: disabled(GIT_REFUSE),
    local: held(GIT_ID, ['sel']),
    writes: key => key in GIT_REFUSE,
    write: async (changes: readonly ValueChange[]) => { for (const {key} of changes) throw Error(GIT_REFUSE[key as keyof typeof GIT_REFUSE] ?? reading(key)) },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Seat

export const SEAT_REFUSE = {
  join: missing('Join', 'seat join through the kernel (the seat instrument runs only from a shell on this machine)', 'Workcell'),
  release: missing('Release', 'seat release through the kernel', 'Workcell'),
} as const
export const SEAT_UNREAD = 'The seat instrument has not answered yet (kernel seat_status_read, `seat status --json`: it takes 20–30 s).'
const SEAT_LOCAL = ['product', 'seat', 'lane', 'joinAs', 'zone', 'keepDirt', 'floor', 'sel', 'page:zones'] as const

/** The seat instrument's reading as the Seat's rows and disk (workcell__seat.tsx:7-12): the hygiene model's seat rows
 * (centralHygieneModel.ts parseSeatStatusJson — the live pose, the counts, the drift, the admission), each with its zones from the same
 * reading — none on a free seat, where a zone is a lane's leftover and no claim — and each workcell's disk with the register's floor.
 * Null when the reading is not the instrument's JSON. */
export function seatReading(status: unknown): {seats: Record<string, unknown>[]; disk: Record<string, unknown>[]} | null {
  const parsed = parseSeatStatusJson(typeof status === 'string' ? status : JSON.stringify(status ?? null))
  if (!parsed || !isObj(status) && typeof status !== 'string') return null
  const doc = (typeof status === 'string' ? JSON.parse(status) : status) as Obj
  const zones = new Map<string, unknown[]>()
  const disk: Record<string, unknown>[] = []
  for (const cell of Array.isArray(doc.workcells) ? doc.workcells : []) {
    if (!isObj(cell) || !str(cell.name)) continue
    disk.push({workcell: cell.name, freeGb: num(cell.disk_free_gb) ?? null, softGb: num(cell.min_free_gb) ?? null, hardGb: num(cell.hard_free_gb) ?? null})
    for (const seat of Array.isArray(cell.seats) ? cell.seats : []) {
      if (!isObj(seat) || !str(seat.product)) continue
      zones.set(`${cell.name}/${seat.product}`, (Array.isArray(seat.zones) ? seat.zones : []).flatMap(zone => isObj(zone) && str(zone.actor)
        ? [{actor: zone.actor, regions: Array.isArray(zone.regions) ? zone.regions.filter(region => typeof region === 'string') : [], since: num(zone.since_unix_seconds) ?? null}] : []))
    }
  }
  const seats = parsed.map(row => ({workcell: row.workcell, product: row.product, state: row.state, branch: row.branch, head: row.head, claimedBy: row.claimedBy,
    dirty: row.dirty, untracked: row.untracked, ahead: row.ahead ?? null, behind: row.behind ?? null, drift: row.drift, admissionNote: row.admissionNote,
    zones: row.state === 'free' ? [] : zones.get(`${row.workcell}/${row.product}`) ?? []}))
  return {seats, disk}
}

export interface SeatInput {
  /** The seat instrument's reading (`seat status --json`, kernel seat_status_read), null while it has not answered. */
  readonly status: unknown
  /** Why there is no reading, in the owner's words (its refusal), when there is none; absent while it reads. */
  readonly unread?: string
  /** The project the chain's session works in (agency_read's project), whose product the Seat starts on. */
  readonly project: string
  /** The chain's checkout branch (its git reading), to find the seat the session stands in. */
  readonly branch: string | null
  /** The workcell whose chain the Seat stands on (the register's name its return track carries, frame/tracks/returnTracks.ts): its seat
   * of the product is where the Seat starts (§19.23 "a workcell holds one seat for each project"). Absent: the seat on the branch. */
  readonly workcell?: string | null
  readonly holds: ChainHolds
}

/** The Seat's values: the seats and the disk as the instrument reads them; the product, the seat and the join's settings the hand
 * holds, each starting where the reading puts it (the session's project; the seat of the workcell whose chain it stands on, else the
 * seat on its branch or the first free one; Attach; the register's floor). Without the reading only the hand's own settings stand. */
export function seatValues(input: SeatInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, SEAT_ID)
  for (const key of SEAT_LOCAL) put(values, key, view[key])
  values.joinAs = view.joinAs ?? 'attach'
  const read = input.status == null ? null : seatReading(input.status)
  if (!read) return values
  values.seats = JSON.stringify(read.seats)
  values.disk = JSON.stringify(read.disk)
  const products = [...new Set(read.seats.map(seat => String(seat.product)))]
  const product = typeof view.product === 'string' ? view.product : products.find(name => name.toLowerCase() === input.project.toLowerCase())
  put(values, 'product', product)
  const mine = read.seats.filter(seat => seat.product === product)
  const seat = typeof view.seat === 'string' ? view.seat
    : input.workcell ? mine.find(row => row.workcell === input.workcell)?.workcell
      : (mine.find(row => input.branch && row.branch === input.branch) ?? mine.find(row => row.state === 'free'))?.workcell
  put(values, 'seat', seat as string | undefined)
  if (view.floor === undefined) put(values, 'floor', read.disk.find(row => row.workcell === seat)?.softGb as number | undefined)
  return values
}

export function seatBinding(input: SeatInput): DesignBinding {
  const standing: Record<string, Standing> = disabled(SEAT_REFUSE)
  if (input.status == null || !seatReading(input.status)) for (const key of ['product', 'seat']) standing[key] = {disabled: input.unread ?? SEAT_UNREAD}
  return {
    id: SEAT_ID,
    values: seatValues(input),
    standing,
    local: held(SEAT_ID, SEAT_LOCAL),
    writes: key => key in SEAT_REFUSE,
    write: async (changes: readonly ValueChange[]) => { for (const {key} of changes) throw Error(SEAT_REFUSE[key as keyof typeof SEAT_REFUSE] ?? reading(key)) },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Remote carrier

export const CARRIER_REFUSE = {
  where: missing('Where', 'a session carried to another machine over workcell.control/v1 through the kernel', 'Workcell'),
} as const

/** A Workcell connection's state in the carrier's words: connected is Composed (the machines are connected; no kernel op has carried
 * a session through it, and nothing probes its gateway, so it is not Ready); Workcell's other states keep their own words. */
const CARRIED: Readonly<Record<string, string>> = {connected: 'composed', disconnected: 'disconnected', refused: 'refused', incompatible: 'incompatible'}

/** The connections of `workcell status --json` as the carrier's machines (workcell__remote-carrier.tsx:10-16): {id (the label), name
 * (the remote Workcell ref), endpoint, protocol, state, expiresAt}. The grant's operations, the credential's standing, the round trip
 * and the sessions are other reads (`workcell connections show`, a gateway probe) no kernel op runs. */
export function carrierMachines(status: unknown): Record<string, Value | null>[] | null {
  if (!isObj(status) || !Array.isArray(status.connections)) return null
  return status.connections.flatMap(row => {
    if (!isObj(row) || !str(row.label)) return []
    const state = CARRIED[String(row.state)]
    return [{id: String(row.label), name: str(row.remote_workcell_ref) ?? String(row.label),
      ...(str(row.endpoint) ? {endpoint: String(row.endpoint)} : {}), ...(str(row.protocol) ? {protocol: String(row.protocol)} : {}),
      ...(state ? {state} : {}), ...(row.expires_at_unix_ms === null ? {expiresAt: null} : num(row.expires_at_unix_ms) !== undefined ? {expiresAt: num(row.expires_at_unix_ms)!} : {})}]
  })
}

export function carrierValues(answer: WorkcellAnswer, holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  put(values, 'machine', viewHolds(holds, CARRIER_ID).machine)
  if (answer.status !== 'answered') return values
  put(values, 'here', isObj(answer.value) ? str(answer.value.workcell_ref) : undefined)
  const machines = carrierMachines(answer.value)
  if (machines) {
    values.machines = JSON.stringify(machines)
    values.light = machines.some(machine => machine.state === 'ready') ? 'lit' : 'dark'
  }
  return values
}

/** The carrier as one chain of the Gateways rack (actuation__gateways-rack.tsx:7-9 `state` and `why`): composed when a machine is
 * connected, refused in the owner's words when Workcell refused the read, nothing while unread. */
export function carrierChainState(answer: WorkcellAnswer): {state?: 'ready' | 'composed' | 'refused'; why?: string} {
  if (answer.status === 'refused') return {state: 'refused', why: answer.error ?? 'Workcell refused its status read.'}
  if (answer.status !== 'answered') return {}
  const machines = carrierMachines(answer.value) ?? []
  if (machines.some(machine => machine.state === 'ready')) return {state: 'ready'}
  if (machines.some(machine => machine.state === 'composed')) return {state: 'composed'}
  return machines.length ? {state: 'refused', why: 'No connected machine: every connection is down, refused or incompatible.'} : {}
}

export function carrierBinding(answer: WorkcellAnswer, holds: ChainHolds): DesignBinding {
  return {
    id: CARRIER_ID,
    values: carrierValues(answer, holds),
    standing: disabled(CARRIER_REFUSE),
    local: held(CARRIER_ID, ['machine']),
    writes: key => key in CARRIER_REFUSE,
    write: async (changes: readonly ValueChange[]) => { for (const {key} of changes) throw Error(CARRIER_REFUSE[key as keyof typeof CARRIER_REFUSE] ?? reading(key)) },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Link

export const LINK_REFUSE = {
  link: missing('Link', 'aikit gateway remote add · remove through the kernel (the link has no off switch of its own)', 'AIKit'),
  share: missing('Share', 'a share held on each declared remote (AIKit holds none: SPECIFIED)', 'AIKit'),
} as const
const IN_REFUSE = missing('A machine in the link', 'aikit gateway remote add through the kernel', 'AIKit')

/** A remote's standing in the Link's words, from AIKit's survey (ai-kit gateway_contact.rs:663-697 RemoteSurvey::statuses): the owner
 * writes `unreachable`, or `reachable` with a gateway ref when its gateway answered — `answered` when its Actuation answered from its
 * own Workcell, `limited` when the gateway answered but its Actuation could not, or it serves another Workcell — and without one when
 * the gateway refused the question (`refused`). Another word is not read. */
export function linkState(remote: Obj): 'answered' | 'limited' | 'refused' | 'unreachable' | undefined {
  if (remote.status === 'unreachable') return 'unreachable'
  if (remote.status !== 'reachable') return undefined
  if (!str(remote.gateway_ref)) return 'refused'
  return String(remote.detail ?? '').startsWith('answered from its Workcell\'s Actuation') ? 'answered' : 'limited'
}

/** The Positions occupied on one Workcell (`gateway who` positions[] whose occupancy names it): the Link's sessions there. */
function occupiedOn(positions: readonly unknown[], workcell: string): Record<string, string>[] {
  return positions.flatMap(row => {
    if (!isObj(row) || !str(row.position_ref) || !isObj(row.occupancy)) return []
    if (row.occupancy.state !== 'occupied' || row.occupancy.workcell_ref !== workcell) return []
    return [{id: String(row.position_ref), name: str(row.label) ?? str(row.handle) ?? String(row.position_ref)}]
  })
}

/** The population as the Link's machines (workcell__link.tsx:16-22): this machine first, {id (its Workcell ref), self, sessions}, then
 * each declared remote, {id, state, why (the owner's detail), in (declared, so in the link), sessions — only where its gateway answered:
 * an unreachable or refused machine reports none}. Null when the reading carries no remotes. */
export function linkMachines(population: unknown, here: string | undefined, endpoints: ReadonlyMap<string, string> = new Map()): Record<string, Value | null | readonly unknown[]>[] | null {
  if (!isObj(population) || !Array.isArray(population.remotes)) return null
  const positions = Array.isArray(population.positions) ? population.positions : []
  const self = here ?? str(population.local_workcell_ref)
  const machines: Record<string, Value | null | readonly unknown[]>[] = self ? [{id: self, self: true, sessions: occupiedOn(positions, self)}] : []
  for (const remote of population.remotes) {
    if (!isObj(remote) || !str(remote.workcell_ref) || remote.workcell_ref === self) continue
    const state = linkState(remote)
    const endpoint = endpoints.get(String(remote.workcell_ref))
    machines.push({id: String(remote.workcell_ref), in: true, ...(endpoint ? {endpoint} : {}), ...(state ? {state} : {}), ...(str(remote.detail) ? {why: String(remote.detail)} : {}),
      ...(state === 'answered' || state === 'limited' ? {sessions: occupiedOn(positions, String(remote.workcell_ref))} : {})})
  }
  return machines
}

/** The declared gateway endpoints (aikit.gateway-remotes/v1 `remotes[]`), by Workcell ref: each machine's websocket bind. */
export function remoteEndpoints(remotes: unknown): Map<string, string> | null {
  if (!isObj(remotes) || !Array.isArray(remotes.remotes)) return null
  const out = new Map<string, string>()
  for (const remote of remotes.remotes) if (isObj(remote) && str(remote.workcell_ref) && str(remote.websocket_bind)) out.set(String(remote.workcell_ref), String(remote.websocket_bind))
  return out
}

/** The Link's values: this machine's Workcell ref (`workcell status`, else AIKit's own word for it), and from `gateway who` the machines,
 * the light (a machine answered; dark when none did; hollow with none declared); from `gateway remote list` each machine's endpoint
 * and whether the link is joined (an endpoint is declared — else, unread, a remote in `gateway who`). A declared machine `gateway who`
 * does not name stands with its endpoint alone. The lag, the clock, Share and the threads have no reading. */
export function linkValues(answer: WorkcellAnswer, holds: ChainHolds, population?: WorkcellAnswer, remotes?: WorkcellAnswer): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(holds, LINK_ID)
  put(values, 'sel', view.sel)
  put(values, 'session', view.session)
  const known = population?.status === 'answered' && isObj(population.value) ? population.value : null
  const here = answer.status === 'answered' && isObj(answer.value) ? str(answer.value.workcell_ref) : undefined
  put(values, 'here', here ?? (known ? str(known.local_workcell_ref) : undefined))
  const endpoints = remotes?.status === 'answered' ? remoteEndpoints(remotes.value) : null
  const machines = known ? linkMachines(known, here, endpoints ?? undefined) : null
  if (machines) {
    for (const [ref, endpoint] of endpoints ?? []) if (!machines.some(machine => machine.id === ref)) machines.push({id: ref, in: true, endpoint})
    values.machines = JSON.stringify(machines)
    const others = machines.filter(machine => !machine.self)
    values.link = endpoints ? endpoints.size > 0 : others.length > 0
    if (others.length) values.light = others.some(machine => machine.state === 'answered') ? 'lit' : 'dark'
  } else if (endpoints) {
    values.link = endpoints.size > 0
    values.machines = JSON.stringify([...(values.here ? [{id: values.here, self: true}] : []), ...[...endpoints].map(([id, endpoint]) => ({id, in: true, endpoint}))])
  }
  return values
}

export function linkBinding(answer: WorkcellAnswer, holds: ChainHolds, population?: WorkcellAnswer, remotes?: WorkcellAnswer): DesignBinding {
  return {
    id: LINK_ID,
    values: linkValues(answer, holds, population, remotes),
    standing: disabled(LINK_REFUSE),
    local: held(LINK_ID, ['sel', 'session']),
    writes: key => key in LINK_REFUSE || key.startsWith('in:'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) throw Error(key.startsWith('in:') ? IN_REFUSE : LINK_REFUSE[key as keyof typeof LINK_REFUSE] ?? reading(key))
    },
  }
}
