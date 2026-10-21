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
//   `workcell connections show <label> --json` (workcell.connection/v1, the kernel's workcell_read {connections-show} since lane W3: real
//     shape in desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-connections-2026-10-21.json): each connection's granted
//     operations, credential reference, remote software and when it connected — the Remote carrier's grant, credRef, software and since.
// The writes: the Seat's Join and Release go to the seat instrument through the kernel's seat_write (lane W3, desktop/cradle/kernel/src/
// owner_routes.rs SeatWrite; ownerRoutes.ts): `seat join WORKCELL PRODUCT --actor A [--branch B] [--new-lane] [--region P…]
// [--recover-dirt-branch NAME] --json` and `seat release WORKCELL PRODUCT --actor A --json`, attributed to the desk's actor; the instrument
// writes the machine's register and answers central.workcell-seat-result/v1 (an `owner_changed` receipt when it says it wrote it), and the
// seat reading is asked again. The Floor stands disabled: seat_write carries no `--min-free-gb`. `workcell-cli git commit|push` and `seat
// land` do not exist; moving a session to another machine, joining the link and its Share have no owner operation; Workcell's connect and
// machine declarations (workcell_write) have no control on these designs. Each stands disabled with that reason.
// Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {SeatWriteRequest} from '../../../../../../desktop/cradle/src/kernel/types'
import {parseSeatStatusJson} from '../../inhabitants/centralHygieneModel'
import {chainDeviceId, type AgentChainReading} from './agentChainDevices'
import {chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {offersOf, planOf, probeFields, probesByLabel} from './workcellMaterial'

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
  /** Join or Release where no carrier stands. */
  join: 'Join: the kernel carrier is unavailable here, so the seat instrument cannot be asked (`seat join` through the kernel\'s seat_write).',
  release: 'Release: the kernel carrier is unavailable here, so the seat instrument cannot be asked (`seat release` through the kernel\'s seat_write).',
  /** Floor: the register's floor is read; the join through the kernel does not carry another. */
  floor: missing('Floor', 'a join floor through the kernel (seat_write carries no `--min-free-gb`, so Join keeps the register\'s floor)', 'Workcell'),
} as const
/** Join or Release before a product and a seat are chosen. */
export const SEAT_CHOOSE = 'Choose a product and a seat first: Join and Release name both (`seat join|release WORKCELL PRODUCT`).'
/** The Seat's readings no owner reports here. */
export const SEAT_ABSENT = {
  actor: 'The session\'s own actor ref: no reading reaches it yet — missing op: the actor a session\'s agent claims seats as (the instrument\'s claims name actors; no reading names a session\'s) (Workcell).',
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
  /** This machine's Workcell ref (`workcell status --json` workcell_ref), when Workcell answered. */
  readonly machineRef?: string
  /** The desk's actor (ownerRoutes.ts deskActorOf): whom Join and Release attribute the claim to. */
  readonly actor?: string
  readonly holds: ChainHolds
}

/** The Seat's writes: the seat instrument through the kernel's seat_write (ownerRoutes.ts). Absent: no carrier stands. */
export interface SeatPorts {
  readonly seat?: (request: SeatWriteRequest) => Promise<unknown>
}

/** The paths of a Zone as the hand wrote them, apart by commas (workcell__seat.tsx Zone: "The paths you will edit, apart by commas"). */
export const zonePaths = (zone: Value | undefined): string[] => (typeof zone === 'string' ? zone.split(',').map(path => path.trim()).filter(Boolean) : [])

/** The seat instrument's join request from the Seat's values as they stand and the seat row they name: on a free seat, the lane you name
 * (else the instrument cuts one); on a held seat, Attach joins the standing lane and New lane starts yours (`--new-lane`, with your lane);
 * Zone is every region on one `--region` flag; Keep dirt the recovery branch. Null when no product, seat or row is named. Pure. */
export function seatJoinRequest(values: Values, seats: readonly Record<string, unknown>[], actor: string): SeatWriteRequest | null {
  const workcell = typeof values.seat === 'string' ? values.seat : undefined, product = typeof values.product === 'string' ? values.product : undefined
  const row = workcell && product ? seats.find(seat => seat.workcell === workcell && seat.product === product) : undefined
  if (!workcell || !product || !row) return null
  const newLane = row.state !== 'free' && values.joinAs === 'new-lane'
  const lane = typeof values.lane === 'string' && values.lane.trim() ? values.lane.trim() : undefined
  const regions = zonePaths(values.zone)
  const keep = typeof values.keepDirt === 'string' && values.keepDirt.trim() ? values.keepDirt.trim() : undefined
  return {kind: 'join', workcell, product, actor, ...((row.state === 'free' || newLane) && lane ? {branch: lane} : {}), ...(newLane ? {new_lane: true} : {}),
    ...(regions.length ? {regions} : {}), ...(keep ? {recover_dirt_branch: keep} : {})}
}

/** The Seat's values: the seats and the disk as the instrument reads them; the product, the seat and the join's settings the hand
 * holds, each starting where the reading puts it (the session's project; the seat of the workcell whose chain it stands on, else the
 * seat on its branch or the first free one; Attach; the register's floor). Without the reading only the hand's own settings stand. */
export function seatValues(input: SeatInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, SEAT_ID)
  for (const key of SEAT_LOCAL) put(values, key, view[key])
  values.joinAs = view.joinAs ?? 'attach'
  put(values, 'machineRef', input.machineRef)
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

export function seatBinding(input: SeatInput, ports: SeatPorts = {}): DesignBinding {
  const values = seatValues(input)
  const read = input.status == null ? null : seatReading(input.status)
  const unread = input.unread ?? SEAT_UNREAD
  const standing: Record<string, Standing> = {...disabled(SEAT_ABSENT), floor: {disabled: SEAT_REFUSE.floor}}
  if (!('machineRef' in values)) standing.machineRef = {disabled: 'This machine\'s Workcell ref: Workcell\'s status (`workcell status --json`) has not answered.'}
  if (!read) for (const key of ['product', 'seat', 'seats', 'disk']) standing[key] = {disabled: unread}
  // Join and Release: the seat instrument through the kernel, on the seat the values name, attributed to the desk's actor.
  const why = (key: 'join' | 'release'): string | null => (!ports.seat || !input.actor ? SEAT_REFUSE[key] : !read ? unread
    : typeof values.product !== 'string' || typeof values.seat !== 'string' ? SEAT_CHOOSE : null)
  for (const key of ['join', 'release'] as const) { const reason = why(key); if (reason) standing[key] = {disabled: reason} }
  const act = async (key: 'join' | 'release') => {
    // What the hand holds when it presses (the holds as they stand then).
    const now = seatValues({...input, holds: chainHolds()})
    const reason = why(key)
    if (reason) throw Error(reason)
    const rows = (input.status == null ? null : seatReading(input.status))?.seats ?? []
    const request: SeatWriteRequest | null = key === 'join' ? seatJoinRequest(now, rows, input.actor!)
      : typeof now.seat === 'string' && typeof now.product === 'string' ? {kind: 'release', workcell: now.seat, product: now.product, actor: input.actor!} : null
    if (!request) throw Error(key === 'join' && typeof now.seat === 'string' ? `${now.seat} has no ${String(now.product)} seat.` : SEAT_CHOOSE)
    await ports.seat!(request)
  }
  return {
    id: SEAT_ID,
    values,
    standing,
    local: held(SEAT_ID, SEAT_LOCAL.filter(key => key !== 'floor')),
    writes: key => key === 'join' || key === 'release' || key === 'floor',
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) {
        if (key === 'join' || key === 'release') { await act(key); continue }
        throw Error(key === 'floor' ? SEAT_REFUSE.floor : reading(key))
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Remote carrier

// The Standing page (lane W10, D1): the offers are `workcell discover`'s (workcell_read {discover}, workcellMaterial.ts offersOf). The
// plan lays the run's needs on them (`workcell plan` with the run's demand), and no reading names a run's demand — the plan of no demand
// plans nothing — so the plan and Plan again stand disabled saying so. Each connected machine's standing and round trip come from
// `workcell connections probe` (workcell_read {connections-probe}, a read that never writes the record; workcellMaterial.ts probeFields):
// reached and authorised is Ready, a refusal keeps Workcell's words, an unreachable machine keeps its recorded standing and says why.
/** Why the run's plan is not read: `workcell plan` takes the run's demand, and no reading names one. */
// The Plan (lanes W13, W14): the run is the chosen world's (workcellRackBinding.ts chosenWorld, W12) as `workcell worlds` names it — the
// run-ledger slugs whose record's world_ref is that world's (EpiLogos/Workcell PR 122; planRunOf): one is that run; several wait for the
// hand's choice (`planRun`), none assumed; none says the world was prepared outside a run or its run is recorded elsewhere; null says
// Workcell's run-ledger error verbatim. Never the receipt's opaque subjects. The run is read with `workcell run show
// --run R` (the kernel's workcell_read {run-show}; EpiLogos/Workcell PR 121), which answers its demand {path, digest, standing: kept |
// not-kept | mismatch | unreadable, body?, detail?}. Where the demand is kept, the plan is Workcell's own for it (`workcell plan
// --demand-json <path>`, workcell_read {plan, demand: {demand_json}}), drawn as Workcell answered it; otherwise the plan says Workcell's
// standing in its words and no demand is reconstructed. With no run, no plan is asked.
const NO_DEMAND = 'the run\'s demand for `workcell plan`: the chosen world\'s run (`workcell worlds` runs), read with `workcell run show` — no world is chosen here'
export const CARRIER_REFUSE = {
  where: missing('Where', 'a session carried to another machine over workcell.control/v1 through the kernel', 'Workcell'),
  replan: missing('Plan again', NO_DEMAND, 'Workcell'),
} as const
/** The Standing page's readings while they do not stand. */
export const CARRIER_ABSENT = {
  offers: 'What the place can provide: Workcell\'s `workcell discover` is not read here.',
  plan: `The run's plan on those offers: no reading reaches it yet — missing op: ${NO_DEMAND} (Workcell).`,
} as const

/** One connection's record as Workcell shows it (`workcell connections show <label> --json`, workcell.connection/v1 under `connection`),
 * by label: the answer the kernel's workcell_read {connections-show} gave, or its refusal in Workcell's words. */
export type ConnectionShows = ReadonlyMap<string, {readonly value?: unknown; readonly error?: string}>

/** What a connection's record adds to its machine (workcell__remote-carrier.tsx:13-15): the operations its grant allows (`grant`), its
 * credential reference (`credRef`), the remote's software (`software`) and when it connected (`since`, ms). Its `detail` is a report on
 * the software revisions, not why the connection stands as it does, so it is not drawn as `why`. Pure. */
export function connectionFields(shown: unknown): Record<string, Value | readonly string[]> {
  const record = isObj(shown) && isObj(shown.connection) ? shown.connection : null
  if (!record || record.version !== 'workcell.connection/v1') return {}
  const grant = Array.isArray(record.granted_operations) ? record.granted_operations.filter((op): op is string => typeof op === 'string') : null
  return {...(grant ? {grant} : {}), ...(str(record.credential_ref) ? {credRef: String(record.credential_ref)} : {}),
    ...(str(record.remote_software) ? {software: String(record.remote_software)} : {}),
    ...(num(record.connected_at_unix_ms) !== undefined ? {since: num(record.connected_at_unix_ms)!} : {})}
}

/** A Workcell connection's state in the carrier's words: connected is Composed (the machines are connected; no kernel op has carried
 * a session through it), and Ready only where `workcell connections probe` reached it and it admits this machine (probeFields);
 * Workcell's other states keep their own words. */
const CARRIED: Readonly<Record<string, string>> = {connected: 'composed', disconnected: 'disconnected', refused: 'refused', incompatible: 'incompatible'}

/** The connections of `workcell status --json` as the carrier's machines (workcell__remote-carrier.tsx:10-16): {id (the label), name
 * (the remote Workcell ref), endpoint, protocol, state, expiresAt}. The grant's operations, the credential's standing, the round trip
 * and the sessions are other reads (`workcell connections show`, a gateway probe) no kernel op runs. */
export function carrierMachines(status: unknown, shows?: ConnectionShows, probes: Readonly<Record<string, unknown>> = {}): Record<string, Value | null | readonly string[]>[] | null {
  if (!isObj(status) || !Array.isArray(status.connections)) return null
  return status.connections.flatMap(row => {
    if (!isObj(row) || !str(row.label)) return []
    const state = CARRIED[String(row.state)]
    return [{id: String(row.label), name: str(row.remote_workcell_ref) ?? String(row.label),
      ...(str(row.endpoint) ? {endpoint: String(row.endpoint)} : {}), ...(str(row.protocol) ? {protocol: String(row.protocol)} : {}),
      ...(state ? {state} : {}), ...(row.expires_at_unix_ms === null ? {expiresAt: null} : num(row.expires_at_unix_ms) !== undefined ? {expiresAt: num(row.expires_at_unix_ms)!} : {}),
      ...connectionFields(shows?.get(String(row.label))?.value), ...(probeFields(probes[String(row.label)]) as Record<string, Value>)}]
  })
}

/** The connection labels `workcell status` lists: the records the carrier asks Workcell to show. */
export function connectionLabels(answer: WorkcellAnswer): string[] {
  return answer.status === 'answered' && isObj(answer.value) && Array.isArray(answer.value.connections)
    ? answer.value.connections.flatMap(row => (isObj(row) && str(row.label) ? [String(row.label)] : [])) : []
}

/** Workcell's material readings for the Standing page: `workcell discover` and `workcell connections probe`; absent: not read here. */
export interface CarrierMaterial {
  readonly discover?: WorkcellAnswer
  readonly probe?: WorkcellAnswer
  /** The chosen world's run (planRunOf), its `workcell run show`, and the plan of its kept demand; absent: not read here. `why` says why
   * there is no run, in words. */
  readonly run?: {readonly ref: string | null; readonly why?: string; readonly show?: WorkcellAnswer; readonly plan?: WorkcellAnswer}
}

/** The chosen world's run for the Plan, from `workcell worlds`'s `runs` (EpiLogos/Workcell PR 122): one slug is that run; several wait
 * for the hand's choice and none is assumed; none, a world prepared outside a run or a run recorded elsewhere; null, Workcell's run-ledger
 * error verbatim. Never the receipt's subjects. Pure. */
export function planRunOf(world: {readonly worldRef: string; readonly runs?: readonly string[] | null} | null, runLedger: {read: boolean; error?: string} | undefined, choice: unknown): {ref: string | null; why?: string} {
  if (!world) return {ref: null}
  if (world.runs === undefined) return {ref: null, why: `The run's plan: Workcell's world listing names no runs for ${world.worldRef} (an older Workcell answers \`workcell worlds\` without them).`}
  if (world.runs === null) return {ref: null, why: runLedger?.error ?? `The run's plan: Workcell could not read its run ledger for ${world.worldRef}.`}
  if (!world.runs.length) return {ref: null, why: `The run's plan: no run in this cell's ledger names ${world.worldRef} — the world was prepared outside a run, or its run is recorded elsewhere.`}
  if (world.runs.length === 1) return {ref: world.runs[0]!}
  if (typeof choice === 'string' && world.runs.includes(choice)) return {ref: choice}
  return {ref: null, why: `The run's plan: ${world.runs.length} runs name ${world.worldRef} (${world.runs.join(', ')}): choose one; none is assumed.`}
}

/** A run's demand as `workcell run show` answers it ({path, standing, detail?}); null when the answer carries no demand. Pure. */
export function runDemandOf(show: unknown): {path?: string; standing: string; detail?: string} | null {
  const demand = isObj(show) && isObj(show.demand) ? show.demand : null
  if (!demand || !str(demand.standing)) return null
  return {...(str(demand.path) ? {path: String(demand.path)} : {}), standing: String(demand.standing), ...(str(demand.detail) ? {detail: String(demand.detail)} : {})}
}

export function carrierValues(answer: WorkcellAnswer, holds: ChainHolds, shows?: ConnectionShows, material: CarrierMaterial = {}): Values {
  const values: Record<string, Value> = {}
  put(values, 'machine', viewHolds(holds, CARRIER_ID).machine)
  const offers = material.discover?.status === 'answered' ? offersOf(material.discover.value) : null
  if (offers) values.offers = JSON.stringify(offers)
  const plan = material.run?.plan?.status === 'answered' ? planOf(material.run.plan.value) : null
  if (plan) values.plan = JSON.stringify(plan)
  if (answer.status !== 'answered') return values
  put(values, 'here', isObj(answer.value) ? str(answer.value.workcell_ref) : undefined)
  const machines = carrierMachines(answer.value, shows, material.probe?.status === 'answered' ? probesByLabel(material.probe.value) : {})
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

/** Why the run's plan does not stand, in words: no run, Workcell's refusal, or its standing of the run's demand. Null when it stands. */
function planWhy(run: CarrierMaterial['run'], values: Values): string | null {
  if ('plan' in values) return null
  if (!run) return CARRIER_ABSENT.plan
  if (!run.ref) return run.why ?? `The run's plan on those offers: no reading reaches it yet — missing op: ${NO_DEMAND} (Workcell).`
  const show = run.show
  if (!show || show.status === 'reading') return `The run's plan: Workcell has not answered \`workcell run show --run ${run.ref}\` yet.`
  if (show.status === 'refused') return show.error ?? 'Workcell refused the run\'s record.'
  const demand = runDemandOf(show.value)
  if (!demand) return '`workcell run show` answered no demand.'
  if (demand.standing !== 'kept') return `The run's plan: Workcell keeps the run's demand as ${demand.standing}${demand.detail ? ` (${demand.detail})` : ''}; no plan is asked, and no demand is reconstructed.`
  if (!demand.path) return 'The run\'s plan: Workcell keeps the run\'s demand but names no path to plan it from.'
  const plan = run.plan
  if (!plan || plan.status === 'reading') return 'The run\'s plan: Workcell has not answered `workcell plan --demand-json` yet.'
  if (plan.status === 'refused') return plan.error ?? 'Workcell refused the plan.'
  return '`workcell plan` answered something other than a plan.'
}

export function carrierBinding(answer: WorkcellAnswer, holds: ChainHolds, shows?: ConnectionShows, material: CarrierMaterial = {}, ports: {readonly replan?: () => void} = {}): DesignBinding {
  const values = carrierValues(answer, holds, shows, material)
  const standing: Record<string, Standing> = {...disabled(CARRIER_ABSENT), ...disabled(CARRIER_REFUSE)}
  const whyPlan = planWhy(material.run, values)
  if (whyPlan) standing.plan = {disabled: whyPlan}
  else delete standing.plan
  // Plan again: the kept demand's plan asked again, only where one was asked.
  const kept = material.run?.show?.status === 'answered' && runDemandOf(material.run.show.value)?.standing === 'kept'
  if (kept && ports.replan && material.run?.plan) delete standing.replan
  else if (material.run) standing.replan = {disabled: whyPlan ? `Plan again: ${whyPlan}` : 'Plan again: the kernel carrier is unavailable here, so Workcell cannot be asked.'}
  if ('offers' in values) delete standing.offers
  else if (material.discover?.status === 'refused') standing.offers = {disabled: material.discover.error ?? CARRIER_ABSENT.offers}
  else if (material.discover?.status === 'reading') standing.offers = {disabled: 'What the place can provide: Workcell has not answered `workcell discover` yet.'}
  const why = answer.status === 'refused' && answer.error ? answer.error : 'Workcell\'s status (`workcell status --json`) has not answered.'
  for (const key of ['light', 'here', 'machines']) if (!(key in values)) standing[key] = {disabled: why}
  // A connection Workcell refused to show keeps only what its status gave (the record's grant, credential reference, software and since
  // stay off that machine): the machines themselves are still Workcell's reading.
  return {
    id: CARRIER_ID,
    values,
    standing,
    local: held(CARRIER_ID, ['machine', 'planRun']),
    writes: key => key in CARRIER_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) {
        if (key === 'replan' && !standing.replan?.disabled && ports.replan) { ports.replan(); continue }
        throw Error(standing[key]?.disabled ?? CARRIER_REFUSE[key as keyof typeof CARRIER_REFUSE] ?? reading(key))
      }
    },
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
