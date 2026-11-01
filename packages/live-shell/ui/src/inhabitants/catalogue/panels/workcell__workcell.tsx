// Workcell's instrument (manual §19.23, workcell:workcell): where a run works and what it stands on. A workcell is one of the machine's
// standing sets of checkouts (env-1, env-2, env-3 on a Mac), holding one seat for each project; its connections are the three that reach
// it — the Gateway (§19.2), the Remote carrier (§19.18) and Git / landing (§19.16) — and they stand on the run's track's chain. The
// instrument stands only in a pane and on the rail, on the run you select, so it has two views, Full and Widget, and its window holds its
// Full (§16.3). It shows those connections and the world Workcell prepared for them at full size, and changes none of their settings
// (each is set on its device).
// The Full has eight pages, as tabs; each page's settings stand in one line across the head of the pane, and under it its pictures, then
// its lists: Chain (the run's road, each connection with its reading and its fault; who works here, the harness processes with what each
// costs, and the gateway's latest frames), World (the run's prepared world: its bindings, its lifetime and checkpoints), Services (whether
// each service the run needs is up), Exposure (what the run exposes, and Open), Release (keep or let go of each binding), Left behind (the
// worlds, bindings and sandboxes that runs left, each with its finding, with Recover and Release orphans), Seats (each seat of each
// project with its lane, its claim, its co-workers and its branch against main; then the worktrees and branches, each with its finding,
// and Release seat, Prune worktree and Sweep branch) and Machine (the offers with the run's plan over them; the four kinds, declared
// beside observed, and the last reports; then Reconcile and Recover as stages). The World tab is dark while a binding is missing or
// stale; the Machine tab while the run's plan cannot be met.
// The Workcells tile: a chip for each workcell with its state; the chosen one's lane, claim and the agents working in it; under them every
// gateway the machines reach, one line each with its state dot, and Show (All, Ready, In use). A line pressed opens that gateway's Frames.
//
// Value keys. The owners report (never written from here):
//   light      'lit' | 'dark'     the register and the workcell's gateway answered; hollow when nobody reports
//   name       string             the workcell's name (`seat status --json`: workcell; Control/machines/workcells.register.json)
//   machine    string             where it runs (the Remote carrier's reading: `workcell status --json`, workcell_ref)
//   chain      [{id, name, light, reading, fault?}]  its three connections with their lights and one reading each (the devices' own owners);
//                                  `fault` is the owner's words where it reports one: the row stands orange
//   seats      [{product, state, lane, claimedBy, workers, dirty, ahead, behind}]  one per project (`seat status --json`, SeatRow)
//   worlds    [{receipt, world}]  the worlds `workcell worlds` lists for this cell where it lists several; the World page chooses among
//                                  them (`worldReceipt`, the hand's choice) and none is assumed
//   working    [{agent, track?, mode?, instance?}]  the agents working here now, from the claims and the gateway's sessions (`aikit gateway
//                                  who`); a claim names its actor only, so mode and track stand none where nothing names them; `instance` is
//                                  the harness instance the agent runs in, where the gateway names its process
//   instances  [{ref, harness, liveness, pids, cpu?, rss?}]  the harness processes on this machine (`workcell instances list --json`:
//                                  instance_ref, harness_ref, liveness live|stale, pids) with their cost (`workcell instances usage <ref>
//                                  --pid <n> --json`: metrics.cpu_utilisation percent, metrics.memory_rss bytes); a metric the provider
//                                  marks unsupported is left out. No kernel route reaches `instances` yet.
//   workcells  [{name, light, lane, claimedBy?}]  every workcell the machines hold, for the tile's chips
//   frames     [{at, dir, kind, note}]  the gateway's latest frames (the Frames monitor's reading, §19.6)
//   run        string             the run whose world the pages show: the selected track's running task (the shell's selection)
//   world      {ref, demand, persistence, retention, state, bindings: [{ref, port, provider, necessity, health, presence, observed?}]}
//                                  the run's prepared world: the kernel's material_read (kernel/src/material.rs; `workcell --receipt R
//                                  material --json`, workcell.material-reading/v1): receipt_world (world_ref, demand_ref, persistence,
//                                  retention, state, binding_graph.bindings: logical_ref, port, provider_ref, necessity, health,
//                                  presence) and observation.observations[].state by logical_ref. JSON null: no world is prepared.
//   lease      {from, expiresAt, renewable}  the world's lease (ms; expiresAt null: it lives until released). Workcell observes leases
//                                  (MaterialLeaseProvider::observe_lease) but no command reports them: no owner operation yet.
//   checkpoints [{ref, state, reusable, at}]  the world's checkpoints (MaterialCheckpoint: creating | ready | failed | unknown); no
//                                  command takes or lists them yet.
//   readAt     ms                 when the world was last read
//   services   [{ref, endpoint, health, availability, lifetime}]  the services this workcell declares (`workcell doctor --json`:
//                                  declared_services: logical_ref, endpoint, health, availability, lifetime); no kernel route yet
//   surfaces   [{ref, interaction, endpoint}]  what the run's world exposes (material_read: exposure.reading.surfaces: logical_ref,
//                                  interaction, material.endpoint)
//   omitted    [{requirement, necessity, reason}]  what it could not expose (the same reading: omissions and degradations)
//   reconciled [{ref, observed, desired, action}]  the deltas of the last reconcile (`workcell reconcile --json`: deltas)
// Settings the shell holds: openIn ('web' | 'pane': where Open puts an endpoint), needed (Services: only what the run needs),
//   want:<binding ref> ('present' | 'suspended' | 'snapshotted' | 'released': the fate you set for a binding before Apply).
// Held by the hand: chosen (the tile's workcell), surface and binding (the rows chosen).
// Acts, each on its own key: reread (material_read), recover (`workcell recover`), checkpoint (no owner operation), readServices
// (`workcell doctor`), open (the surface's ref: the shell opens its endpoint in Web or a pane), apply (`workcell --receipt R reconcile
// --desired <ref>=<state>...` for each binding whose fate you changed), releaseWorld (`workcell --receipt R release`, by the world's
// retention). The kernel has no route to recover, reconcile or release yet: the host stands them disabled with its reason.
// The Left behind page's values stand under `left.` (a binding hosts the page by prefixing the leftovers' own binding; the shapes are
// centralHygieneModel's): left.worlds ([{ref, state, bindings: [{ref, presence, health}]}]: each persisted world receipt, material_read),
// left.sandboxes ({server, sandboxes: [{id, state, lease live | expired-orphan | unknown, expiresAt}]}: `workcell sandboxes reconcile
// --server <url> --json`), left.findings ([{kind, subject, standing, boundaryOps, tenderId}]: binding-drift, binding-lost, sandbox-orphan,
// sandbox-unproven), left.sources ([{boundaryOp, refusal?}]), left.readAge, left.receipt / left.receipts. Held by the hand: left.sel
// (the finding chosen), left.page:findings. Acts, the finding's subject as the value: left.recover (`workcell --receipt R reconcile
// --desired <binding>=present`), left.orphans (`workcell sandboxes reconcile --server <url> --release-orphans`).
// The Seats page's values stand under `seat.` and `co.`, each a binding the page hosts by prefixing it:
//   seat.  the seat instrument's (`seat status`; the shapes and the readers are Git / landing's, workcell__git-seat.tsx): seat.seats
//          (SeatRow[]), seat.actor. Held by the hand: seat.product (the project whose seats the blocks show), seat.seat (the seat handle 1
//          chooses).
//   co.    the checkouts' (centralHygieneModel's shapes, JSON strings): co.seats (SeatReading[]), co.worktrees (WorktreeRow[]: path, branch,
//          head, detached, main), co.branches ({name, head, checkedOutAt, merged?}[]), co.disk ({workcell, freeGb}[]), co.findings
//          (HygieneFinding[]: kind, subject, standing, boundaryOps, tenderId), co.sources (BoundaryOpSource[]: each read with its operation,
//          and its refusal in the owner's words), co.machines ({id, label, ref, does?}[]), co.machineRef (the machine the readings stand
//          on), co.readAge (seconds since the sources were read), co.receipt / co.receipts. Settings the shell holds: co.machine, co.faults
//          (show faults only). Held by the hand: co.sel (the finding chosen), co.page:findings. Acts, the tenders at the head, whose value
//          is the finding's subject: co.release (`seat release`), co.prune (`git worktree remove`), co.sweep (`git branch -d`). Each is held
//          to run: the page tends only what you approve.
// Its environs (manual §25.6 "Process types, read in time"): the seats a succession, one lane after another on the same ground; the
// checkouts an erosion, the wear of many runs on them (faces/EnvironFaces.tsx). Each reads the page's own values and, while a reading is
// missing, says which it waits on.
// The Machine page's values stand under `carrier.` and `mc.`:
//   carrier.  the Remote carrier's binding (workcell__remote-carrier.tsx, whose readers draw the plan): carrier.offers (Offer[]: `workcell
//             discover --json` where the session runs), carrier.plan (the run's needs on them: `workcell plan --json`), carrier.runs (the
//             runs `workcell worlds` names for the chosen world, where it names several: Run chooses whose needs the plan lays on the
//             offers, `carrier.planRun`, and none is assumed). Act: carrier.replan (Plan again).
//   mc.       the machine's own binding (§19.18's Machine reading; the owner is Central, ctrl/src/machine.rs and ctrl/src/recovery.rs, through
//             the kernel's invoke_action: machine.account, machine.declaration {role}, machine.plan {role}, machine.verify {role} read;
//             machine.apply {role}, machine.adopt-current change the machine or its declaration; central.recovery.plan {role} reads;
//             central.recover {role} recovers): mc.light, mc.roles [{role, path, requirements}], mc.host {platform, architecture,
//             observedAt, ...}, mc.declared {bindings, capabilities, packages, configurations, services}, mc.observed {capabilities,
//             packages, configurations, services}, mc.plan {entries: [{kind, id, status satisfied | missing | changeable | unsupported,
//             port?, connector?, reason?}], summary}, mc.applied {outcome, operations}, mc.verified {satisfied}, mc.recovery
//             {synchronization, reason?, connector?, changes}, mc.recovered {outcome, stage?, message?, synchronized?, applied?,
//             operations?, satisfied?}. Settings the shell holds: mc.role, mc.mode (Change: off · propose · write), mc.refresh (manual ·
//             open). Held by the hand: mc.ask (the act waiting for Confirm). Acts: mc.replan, mc.apply, mc.verify, mc.adopt, mc.recover.
//             Apply, Adopt and Recover change the machine or its declaration: under Propose each waits for Confirm, and each is held.
// The tile's gateways stand under `gw.` (the gateways' own binding): gw.chains ([{id, name, transport?, state ready | composed | refused,
// why?, workcells?}]), gw.show ('all' | 'ready' | 'inuse'); gw.chain is the gateway whose Frames page a pressed line opens.
// A key the owner has not reported is absent: the views draw "—" and name the missing reading in the well.
import {useState, type ReactNode} from 'react'
import {Action, Chooser, Display, Handle, Lamp, Meter, Radio, Readout, Rows, Tile, Toggle, type LightState, type Option, type RowItem, type Tone, unreadRows, NoReading} from '../../sdk/panel'
import {assembleCensus, hygieneFindings, registeredSeatPaths, type BoundaryOpSource, type SeatReading, type WorktreeRow} from '../../centralHygieneModel'
import {NONE, boolOf, clampTo, has, json, numOf, prefixed, railAndPane, scoped, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane, type MonitorReading} from './monitor'
import {ErosionEnviron, SuccessionEnviron} from '../faces/EnvironFaces'
import {checkoutErosionOf, successionOf} from '../faces/environReadings'
import {NO_SEATS, NO_SEAT_READING, SEAT_DEFAULTS, STATE_WORD, filesOf, seats, short, tail} from './workcell__git-seat'
import {OFFERS, OFFERS_OMARCHY, PLAN, PLAN_UNMET, PLAN_WORD, planOf} from './workcell__remote-carrier'
import {plainReason} from '../../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import './workcell__workcell.css'

type V = ViewProps['v']

interface ChainDevice {readonly id: string; readonly name: string; readonly light?: string; readonly reading?: string; readonly fault?: string}
interface Seat {readonly product: string; readonly state: string; readonly lane?: string | null; readonly claimedBy?: string | null; readonly workers?: readonly string[]
  readonly dirty?: number; readonly ahead?: number; readonly behind?: number}
interface Worker {readonly agent: string; readonly track?: string; readonly mode?: string; readonly instance?: string}
/** Where a worker works: its mode and its track, each none where nothing names it. */
const whereOf = (w: Worker) => `${w.mode ?? NONE} · ${w.track ?? NONE}`
interface Cell {readonly name: string; readonly light?: string; readonly lane?: string | null; readonly claimedBy?: string | null}
interface Frame {readonly at: string; readonly dir: 'in' | 'out'; readonly kind: string; readonly note?: string}
interface Instance {readonly ref: string; readonly harness: string; readonly liveness?: string; readonly pids?: readonly number[]; readonly cpu?: number; readonly rss?: number}
interface Binding {readonly ref: string; readonly port: string; readonly provider?: string; readonly necessity?: string; readonly health?: string; readonly presence?: string; readonly observed?: string}
interface World {readonly ref: string; readonly demand?: string; readonly persistence?: string; readonly retention?: string; readonly state?: string; readonly bindings: readonly Binding[]}
interface Lease {readonly from?: number; readonly expiresAt: number | null; readonly renewable?: boolean}
interface Checkpoint {readonly ref: string; readonly state?: string; readonly reusable?: boolean; readonly at?: number}
interface Service {readonly ref: string; readonly endpoint?: string; readonly health?: string; readonly availability?: string; readonly lifetime?: string}
interface Surface {readonly ref: string; readonly interaction?: string; readonly endpoint?: string}
interface Omitted {readonly requirement: string; readonly necessity?: string; readonly reason?: string}
interface Delta {readonly ref: string; readonly observed?: string | null; readonly desired: string; readonly action?: string | null}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const text = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const chainOf = (v: V) => (has(v, 'chain') ? json<unknown[]>(v, 'chain', []).filter((d): d is ChainDevice => rec(d) && typeof d.id === 'string' && typeof d.name === 'string') : undefined)
const seatsOf = (v: V) => (has(v, 'seats') ? json<unknown[]>(v, 'seats', []).filter((s): s is Seat => rec(s) && typeof s.product === 'string') : undefined)
/** The worlds listed for this cell where there are several to choose among (`worlds`); undefined otherwise. */
const worldsOf = (v: V) => { const listed = has(v, 'worlds') ? json<unknown[]>(v, 'worlds', []).filter((x): x is {receipt: string; world: string} => rec(x) && typeof x.receipt === 'string' && typeof x.world === 'string') : []
  return listed.length > 1 ? listed : undefined }
const workingOf = (v: V) => (has(v, 'working') ? json<unknown[]>(v, 'working', []).filter((w): w is Worker => rec(w) && typeof w.agent === 'string') : undefined)
const cellsOf = (v: V) => json<unknown[]>(v, 'workcells', []).filter((c): c is Cell => rec(c) && typeof c.name === 'string')
const framesOf = (v: V) => json<unknown[]>(v, 'frames', []).filter((f): f is Frame => rec(f) && typeof f.kind === 'string')
const lightIn = (x: unknown): LightState => (x === 'lit' || x === 'dark' ? x : 'unknown')

/** A JSON list the owner reported, its rows kept where they have their identity; undefined when the key is absent or holds no list. */
function listOf<T>(v: V, key: string, keep: (row: Record<string, unknown>) => T | undefined): T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap(row => { const t = rec(row) ? keep(row) : undefined; return t === undefined ? [] : [t] })
}
const instancesOf = (v: V) => listOf<Instance>(v, 'instances', r => (text(r.ref) && text(r.harness) ? {ref: r.ref as string, harness: r.harness as string, liveness: text(r.liveness),
  pids: Array.isArray(r.pids) ? r.pids.filter((n): n is number => typeof n === 'number') : undefined, cpu: count(r.cpu), rss: count(r.rss)} : undefined))
/** The run's world: undefined when the owner reports nothing, null when it reports that no world is prepared. */
function worldOf(v: V): World | null | undefined {
  if (!has(v, 'world')) return undefined
  const raw = json<unknown>(v, 'world', undefined)
  if (raw === null) return null
  if (!rec(raw) || !text(raw.ref)) return undefined
  const bindings = (Array.isArray(raw.bindings) ? raw.bindings : []).flatMap((b): Binding[] => rec(b) && text(b.ref) && text(b.port)
    ? [{ref: b.ref as string, port: b.port as string, provider: text(b.provider), necessity: text(b.necessity), health: text(b.health), presence: text(b.presence), observed: text(b.observed)}] : [])
  return {ref: raw.ref as string, demand: text(raw.demand), persistence: text(raw.persistence), retention: text(raw.retention), state: text(raw.state), bindings}
}
function leaseOf(v: V): Lease | undefined {
  const raw = json<unknown>(v, 'lease', undefined)
  if (!rec(raw) || !(raw.expiresAt === null || count(raw.expiresAt) !== undefined)) return undefined
  return {from: count(raw.from), expiresAt: raw.expiresAt === null ? null : raw.expiresAt as number, renewable: typeof raw.renewable === 'boolean' ? raw.renewable : undefined}
}
const checkpointsOf = (v: V) => listOf<Checkpoint>(v, 'checkpoints', r => (text(r.ref) ? {ref: r.ref as string, state: text(r.state), reusable: typeof r.reusable === 'boolean' ? r.reusable : undefined, at: count(r.at)} : undefined))
const servicesOf = (v: V) => listOf<Service>(v, 'services', r => (text(r.ref) ? {ref: r.ref as string, endpoint: text(r.endpoint), health: text(r.health), availability: text(r.availability), lifetime: text(r.lifetime)} : undefined))
const surfacesOf = (v: V) => listOf<Surface>(v, 'surfaces', r => (text(r.ref) ? {ref: r.ref as string, interaction: text(r.interaction), endpoint: text(r.endpoint)} : undefined))
const omittedOf = (v: V) => listOf<Omitted>(v, 'omitted', r => (text(r.requirement) ? {requirement: r.requirement as string, necessity: text(r.necessity), reason: text(r.reason)} : undefined))
const deltasOf = (v: V) => listOf<Delta>(v, 'reconciled', r => (text(r.ref) && text(r.desired) ? {ref: r.ref as string, observed: text(r.observed) ?? null, desired: r.desired as string, action: text(r.action) ?? null} : undefined))

const OPEN_IN: readonly Option<string>[] = [{value: 'web', label: 'Web', does: 'Open the endpoint in the Web monitor.'}, {value: 'pane', label: 'Pane', does: 'Open the endpoint in the pane that has focus.'}]
/** A binding's fates, as `workcell reconcile --desired` names them, from kept to let go. */
const FATES: readonly Option<string>[] = [{value: 'present', label: 'Keep', does: 'Keep the binding, or bring it back.'}, {value: 'suspended', label: 'Suspend', does: 'Suspend it where its provider can.'},
  {value: 'snapshotted', label: 'Snapshot', does: 'Keep a snapshot and let the material go, where its provider can.'}, {value: 'released', label: 'Release', does: 'Let the material go.'}]
const PAGES = [{id: 'chain', label: 'Chain'}, {id: 'world', label: 'World'}, {id: 'services', label: 'Services'}, {id: 'exposure', label: 'Exposure'}, {id: 'release', label: 'Release'},
  {id: 'left', label: 'Left behind'}, {id: 'seats', label: 'Seats'}, {id: 'machine', label: 'Machine'}] as const
type PageId = typeof PAGES[number]['id']
const pageOf = (p: ViewProps): PageId => (PAGES.some(x => x.id === p.page) ? p.page as PageId : 'chain')

/** The ports in the order the world is drawn, with their short names (Workcell's ProviderPortKind). */
const PORTS: readonly (readonly [string, string, string])[] = [['workspace', 'workspace', 'work'], ['execution', 'execution', 'exec'], ['project-runtime', 'runtime', 'app'],
  ['service', 'service', 'svc'], ['storage', 'storage', 'store'], ['artifact-storage', 'artifacts', 'out']]
const portName = (port: string) => PORTS.find(([id]) => id === port)?.[1] ?? port
/** A logical ref without its kind and its scope: `connectivity:service:redis-now/personal-workcell` reads redis-now. */
const shortRef = (ref: string) => ref.replace(/^(connectivity:|affordance:|exposure:|service:|output:|workspace:)+/, '').replace(/\/.*$/, '')
const mb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`)
const pctText = (x: number) => `${x < 10 ? x.toFixed(1) : Math.round(x)} %`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')
const when = (ms: number) => { const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}` }
const span = (ms: number) => (ms < 0 ? 'ended' : ms < 3600e3 ? `${Math.round(ms / 60e3)} min` : ms < 48 * 3600e3 ? `${(ms / 3600e3).toFixed(1)} h` : `${Math.round(ms / 86400e3)} d`)

/** A binding's standing as one word and a tone: what is wrong with it first. */
function bindingState(b: Binding): {word: string; tone: Tone | undefined; fault: boolean} {
  const presence = b.presence
  if (presence === 'missing' || presence === 'stale') return {word: presence, tone: 'stall', fault: true}
  if (presence === 'released' || presence === 'suspended' || presence === 'snapshotted') return {word: presence, tone: undefined, fault: false}
  const health = b.observed ?? b.health
  if (presence === 'present') return health === 'healthy' ? {word: 'present', tone: 'green', fault: false} : {word: health ?? 'present', tone: health === 'unavailable' ? 'stall' : 'accent', fault: health === 'unavailable'}
  return {word: presence ?? NONE, tone: undefined, fault: false}
}
const healthTone = (h: string | undefined): Tone | undefined => (h === 'healthy' ? 'green' : h === 'degraded' ? 'accent' : h ? 'stall' : undefined)

const light = (v: V, owner?: V) => lightIn(strOf(owner ?? v, 'light'))

/** What every page of the Full shares: the workcell's name, and the tabs over the head. */
interface Pane {readonly title: string; readonly tabs: ReactNode}
/** A page of the Full (manual §16.3, §19.23 Full): the tabs, the page's settings in one line across the head, then its pictures and its
 * lists, reading down where they run past the pane. */
function FullPage({pane, label, readings, controls, children}: {pane: Pane; label: string; readings?: readonly (MonitorReading | false | undefined)[]; controls?: ReactNode; children: ReactNode}) {
  return <MonitorPane label={label} head={<>{pane.tabs}<MonitorHead title={pane.title} readings={readings} controls={controls} /></>}>
    <div className="ref-doc wc-doc">{children}</div>
  </MonitorPane>
}

// ------------------------------------------------------------------------------------------------ the world a run stands in

/** The world: its bindings by port, one square each (teal present, amber degraded, orange missing or stale, dashed let go), and its
 * lifetime under them — the lease to its expiry, a diamond for each checkpoint. No handle: nothing here is a setting. */
function WorldWell({v, w, h}: {v: V; w: number; h: number}) {
  const world = worldOf(v), lease = leaseOf(v), cps = checkpointsOf(v), at = numOf(v, 'readAt')
  const present = world ? world.bindings.filter(b => b.presence === 'present').length : undefined
  const corner = world ? `${present}/${world.bindings.length} present` : NONE
  if (!world) return <Display w={w} h={h} label="The world" does="The run's prepared world." corner={corner}>
    <text x={8} y={22} className="dp-ink">{world === null ? 'No world is prepared' : 'No reading of the world'}</text>
    <text x={8} y={36} className="dp-ink-dim">{world === null ? 'Play prepares the run\'s world.' : has(v, 'run') ? 'Workcell has not answered.' : 'No run is selected.'}</text>
  </Display>
  const ports: (readonly [string, string, string])[] = [...PORTS.filter(([id]) => world.bindings.some(b => b.port === id)),
    ...[...new Set(world.bindings.map(b => b.port).filter(port => !PORTS.some(([id]) => id === port)))].map(port => [port, port, port.slice(0, 5)] as const)]
  const n = Math.max(1, ports.length), colW = (w - 12) / n, cell = 16, gap = 3, base = 100
  const lineY = h - 22, x0 = 10, x1 = w - 10
  const times = [lease?.from, ...(cps ?? []).map(c => c.at), at, lease?.expiresAt ?? undefined].filter((t): t is number => typeof t === 'number')
  const t0 = times.length ? Math.min(...times) : undefined, t1 = times.length ? Math.max(...times) : undefined
  const open = lease !== undefined && lease.expiresAt === null
  const xr = open ? x1 - 34 : x1
  const tx = (t: number) => (t0 === undefined || t1 === undefined || t1 === t0 ? (x0 + xr) / 2 : x0 + (t - t0) / (t1 - t0) * (xr - x0))
  return <Display w={w} h={h} label="The world" does="The run's bindings by port: teal present, amber degraded, orange missing or stale, dashed let go. Under them its lifetime: a diamond for each checkpoint, the needle now." corner={corner}>
    <text x={7} y={14} className="dp-ink">{(strOf(v, 'run') ?? world.ref).slice(0, Math.floor((w - 70) / 5))}</text>
    {ports.map(([id, , label], c) => {
      const bs = world.bindings.filter(b => b.port === id), cx = 6 + c * colW + colW / 2
      return <g key={id}>
        {bs.slice(0, 4).map((b, k) => {
          const s = bindingState(b), y = base - (k + 1) * (cell + gap), x = cx - cell / 2
          const letGo = b.presence === 'released' || b.presence === 'suspended' || b.presence === 'snapshotted'
          return <rect key={b.ref} x={x} y={y} width={cell} height={cell} rx={1.5}
            fill={s.fault ? 'var(--stall)' : letGo ? 'none' : s.tone === 'accent' ? 'none' : 'var(--dp-value)'}
            stroke={s.fault ? 'var(--stall)' : s.tone === 'accent' ? 'var(--dp-on)' : letGo ? 'var(--text-faint)' : 'var(--dp-value)'} strokeDasharray={letGo ? '2 2' : undefined}><title>{`${b.ref} · ${s.word}`}</title></rect>
        })}
        {bs.length > 4 && <text x={cx} y={base - 4 * (cell + gap) - 4} className="dp-axis" textAnchor="middle">+{bs.length - 4}</text>}
        <text x={cx} y={base + 10} className="dp-axis" textAnchor="middle">{label}</text>
      </g>
    })}
    <path d={`M${x0} ${lineY}H${xr}`} className="dp-faint" />
    {open && <path d={`M${xr} ${lineY}H${x1}`} className="dp-faint" strokeDasharray="1 3" />}
    {lease === undefined && <text x={x0} y={lineY - 6} className="dp-axis">no reading of the lease</text>}
    {open && <text x={x1} y={lineY + 12} className="dp-axis" textAnchor="end">until released</text>}
    {lease && at !== undefined && <path d={`M${tx(lease.from ?? t0 ?? at)} ${lineY}H${tx(lease.expiresAt === null ? at : Math.min(at, lease.expiresAt))}`} className="dp-curve" style={{strokeWidth: 2}} />}
    {lease && !open && lease.expiresAt !== null && <>
      <path d={`M${tx(lease.expiresAt)} ${lineY - 5}v10`} stroke="var(--stall)" strokeWidth={1.5} />
      <text x={x1} y={lineY + 12} className="dp-axis" textAnchor="end">{at === undefined ? 'expires' : `${span(lease.expiresAt - at)} left`}</text>
    </>}
    {(cps ?? []).filter(c => c.at !== undefined).map(c => {
      const x = tx(c.at!), d = 4
      return c.state === 'failed'
        ? <path key={c.ref} d={`M${x - 3} ${lineY - 3}l6 6M${x + 3} ${lineY - 3}l-6 6`} stroke="var(--stall)" strokeWidth={1.4}><title>{`${c.ref} · failed`}</title></path>
        : <path key={c.ref} d={`M${x} ${lineY - d}l${d} ${d}l${-d} ${d}l${-d} ${-d}z`} fill={c.state === 'ready' ? 'var(--dp-value)' : 'none'} stroke={c.state === 'creating' ? 'var(--dp-on)' : 'var(--dp-value)'}><title>{`${c.ref} · ${c.state ?? NONE}`}</title></path>
    })}
    {at !== undefined && t0 !== undefined && <path d={`M${tx(at)} ${lineY - 7}v14`} stroke="var(--text)" strokeWidth={1} />}
    {cps === undefined ? <text x={x0} y={lineY + 12} className="dp-axis">no reading of the checkpoints</text>
      : cps.length === 0 ? <text x={x0} y={lineY + 12} className="dp-axis">no checkpoint</text>
      : <text x={x0} y={lineY + 12} className="dp-axis">{cps.length} checkpoint{cps.length === 1 ? '' : 's'}</text>}
  </Display>
}

const faulty = (world: World | null | undefined) => (world ? world.bindings.filter(b => bindingState(b).fault).length : undefined)

/** The World page: the world, then each binding with its port, provider, need, presence and observed health, and the world's lease and
 * checkpoints. At the head how long it lasts, what it keeps, its state and when it expires; Checkpoint, Read now and Recover. */
function WorldPage({p, pane}: {p: ViewProps; pane: Pane}) {
  const v = p.v, world = worldOf(v), lease = leaseOf(v), cps = checkpointsOf(v), at = numOf(v, 'readAt'), bad = faulty(world)
  return <FullPage pane={pane} label="World" readings={[
    {label: 'lasts', value: world?.persistence, does: 'How long the world\'s material is meant to last: ephemeral, the task or run, the candidate, the project or the workcell.'},
    {label: 'keeps', value: world?.retention?.replace('-if-supported', ''), does: 'What releasing the world does to its material: release, preserve, suspend or snapshot.'},
    {label: 'state', value: world?.state, does: 'The world\'s health as Workcell observes it.', tone: healthTone(world?.state)},
    {label: 'expires', value: lease === undefined ? undefined : lease.expiresAt === null ? 'never' : at === undefined ? when(lease.expiresAt) : span(lease.expiresAt - at),
      does: 'When the world\'s lease ends. A local world has no lease: it lives until it is released.', tone: lease && lease.expiresAt !== null && at !== undefined && lease.expiresAt - at < 3600e3 ? 'stall' : undefined},
  ]} controls={<>
    {worldsOf(v) && <Chooser {...st(p, 'worldReceipt')} label="World" does="The worlds Workcell lists for this cell: choose the one the pages read. None is assumed." wide
      value={strOf(v, 'worldReceipt') ?? ''} options={[{value: '', label: 'Choose a world'}, ...worldsOf(v)!.map(x => ({value: x.receipt, label: x.world}))]}
      onChange={x => p.set('worldReceipt', x || undefined)} />}
    <Action {...st(p, 'checkpoint')} label="Checkpoint" does="Keep a checkpoint of the world to restore from." onPress={world ? () => p.set('checkpoint', world.ref) : undefined} />
    <Action {...st(p, 'reread')} label="Read now" does="Read the world again from its receipt." onPress={() => p.set('reread', true)} />
    <Action {...st(p, 'recover')} label="Recover" does="Bring the missing and stale bindings back from the receipt." onPress={bad ? () => p.set('recover', world!.ref) : undefined}
      disabled={st(p, 'recover').disabled ?? (bad === 0 ? 'Every binding is present.' : undefined)} />
  </>}>
    <div className="wc-pics"><WorldWell v={v} w={360} h={146} /></div>
    {!world ? <p className="ref-doc-lead">{world === null ? 'No world is prepared for this run.' : 'No reading of the world.'}</p> : <>
      <table className="wc-seats">
        <thead><tr><th>Binding</th><th>Port</th><th>Provider</th><th>Need</th><th>Presence</th><th>Observed</th></tr></thead>
        <tbody>{world.bindings.map(b => { const s = bindingState(b); return <tr key={b.ref} data-free={s.tone ? undefined : 'true'}>
          <td><b>{b.ref}</b></td><td>{portName(b.port)}</td><td>{b.provider?.replace('provider:', '') ?? NONE}</td><td>{b.necessity ?? NONE}</td>
          <td data-fault={b.presence === 'missing' || b.presence === 'stale' ? 'true' : undefined}>{b.presence ?? NONE}</td>
          <td data-fault={(b.observed ?? b.health) === 'unavailable' ? 'true' : undefined}>{b.observed ?? b.health ?? NONE}</td></tr> })}</tbody>
      </table>
      <div className="wc-pane-side">
        <section><h4>Lifetime</h4><ul className="wc-list">
          <li><b>lease</b><span>{lease === undefined ? <NoReading name="Lease" why="No reading of the lease." /> : lease.expiresAt === null ? 'none: it lives until released' : `ends ${when(lease.expiresAt)} UTC${at === undefined ? '' : ` · ${span(lease.expiresAt - at)} left`}${lease.renewable ? ' · renewable' : ''}`}</span></li>
        </ul></section>
        <section><h4>Checkpoints</h4>
          {cps === undefined ? <p className="ref-doc-lead">No reading of the checkpoints.</p> : cps.length === 0 ? <p className="ref-doc-lead">No checkpoint.</p>
            : <ul className="wc-list">{cps.map(c => <li key={c.ref}><b>{c.ref}</b><span>{c.state ?? NONE}{c.at === undefined ? '' : ` · ${when(c.at)} UTC`}{c.reusable ? ' · reusable' : ''}</span></li>)}</ul>}
        </section>
      </div>
    </>}
  </FullPage>
}

// ------------------------------------------------------------------------------------------------ the services it needs

/** What the run needs of a service: required, preferred or optional, from its world's bindings; undefined when it does not use it. */
const needOf = (world: World | null | undefined, s: Service) => world?.bindings.find(b => b.port === 'service' && b.ref.endsWith(s.ref))?.necessity
const shownServices = (v: V) => { const all = servicesOf(v), world = worldOf(v); return all && boolOf(v, 'needed') === true ? all.filter(s => needOf(world, s)) : all }

/** The services: the run as a line at the left, each service a branch to the right, solid while healthy, dashed degraded, crossed
 * when it is down; a filled dot where the run needs it, a ring where it would like it. */
function ServicesWell({v, w, h}: {v: V; w: number; h: number}) {
  const list = shownServices(v), world = worldOf(v)
  const up = list?.filter(s => s.health === 'healthy').length
  if (!list) return <Display w={w} h={h} label="The services" corner={NONE}><text x={8} y={22} className="dp-ink">No reading of the services</text></Display>
  const n = Math.min(list.length, 6), bx = 18, top = 30, step = n > 1 ? Math.min(22, (h - 44) / (n - 1)) : 0
  return <Display w={w} h={h} label="The services" does="The run on the left; each service a branch, solid healthy, dashed degraded, crossed down. A filled dot: the run needs it; a ring: the run would use it." corner={`${up}/${list.length} up`}>
    <path d={`M${bx} ${top - 6}V${top + (n - 1) * step + 6}`} stroke="var(--text-dim)" strokeWidth={2} />
    <text x={bx - 8} y={14} className="dp-axis">the run</text>
    {list.slice(0, n).map((s, k) => {
      const y = top + k * step, need = needOf(world, s), healthy = s.health === 'healthy', down = !healthy && s.health !== 'degraded'
      const ex = w - 70
      return <g key={s.ref}>
        <path d={`M${bx} ${y}H${ex}`} className={healthy ? 'dp-curve' : down ? 'dp-faint' : 'dp-curve-on'} strokeDasharray={healthy ? undefined : down ? '2 3' : '4 3'} />
        {down && <path d={`M${(bx + ex) / 2 - 3} ${y - 3}l6 6M${(bx + ex) / 2 + 3} ${y - 3}l-6 6`} stroke="var(--stall)" strokeWidth={1.4} />}
        {need && <circle cx={bx} cy={y} r={need === 'required' ? 3.2 : 2.6} fill={need === 'required' ? (down ? 'var(--stall)' : 'var(--dp-value)') : 'var(--dp-well)'} stroke={down && need === 'required' ? 'var(--stall)' : 'var(--dp-value)'} />}
        <circle cx={ex} cy={y} r={2.5} fill={healthy ? 'var(--green)' : down ? 'none' : 'var(--dp-on)'} stroke={down ? 'var(--text-faint)' : 'none'} />
        <text x={ex + 6} y={y + 3} className={down ? 'dp-ink-dim' : 'dp-ink'}>{shortRef(s.ref).slice(0, 12)}</text>
      </g>
    })}
    {list.length > n && <text x={w - 6} y={h - 4} className="dp-axis" textAnchor="end">{list.length - n} more</text>}
  </Display>
}

/** The Services page: the run and its services, then each service with its endpoint and health. At the head Needed only, the services up,
 * those the run uses that are down, and Read now. */
function ServicesPage({p, pane}: {p: ViewProps; pane: Pane}) {
  const v = p.v, list = shownServices(v), world = worldOf(v), needed = boolOf(v, 'needed')
  const downNeeded = list ? list.filter(s => s.health !== 'healthy' && s.health !== 'degraded' && needOf(world, s)).length : undefined
  return <FullPage pane={pane} label="Services" readings={[
    {label: 'up', value: list ? `${list.filter(s => s.health === 'healthy').length}/${list.length}` : undefined, does: 'Services that answer healthy, of those shown.', tone: 'green'},
    {label: 'down', value: downNeeded, does: 'Services the run uses that do not answer.', tone: downNeeded ? 'stall' : undefined},
  ]} controls={<>
    <Toggle {...st(p, 'needed')} label="Needed only" does="Show only the services the run uses." on={needed === true} unknown={needed === undefined} onChange={x => p.set('needed', x)} />
    <Action {...st(p, 'readServices')} label="Read now" does="Ask each service again." onPress={() => p.set('readServices', true)} />
  </>}>
    <div className="wc-pics"><ServicesWell v={v} w={360} h={146} /></div>
    {list && (list.length === 0 ? <p className="ref-doc-lead">{needed ? 'The run needs no service.' : 'No service is declared.'}</p> : <table className="wc-seats">
      <thead><tr><th>Service</th><th>Endpoint</th><th>Health</th></tr></thead>
      <tbody>{list.map(s => <tr key={s.ref} data-free={s.health === 'healthy' ? undefined : 'true'}>
        <td><b>{s.ref}</b></td><td>{s.endpoint ?? NONE}</td><td data-fault={s.health !== 'healthy' && s.health !== 'degraded' ? 'true' : undefined}>{s.health ?? NONE}</td></tr>)}</tbody>
    </table>)}
  </FullPage>
}

// ------------------------------------------------------------------------------------------------ what the run exposes

/** The exposure: the world at the left, an arrow to each endpoint it exposes; what it could not expose stands crossed at the foot. */
function ExposureWell({v, w, h, chosen}: {v: V; w: number; h: number; chosen?: string}) {
  const list = surfacesOf(v), out = omittedOf(v) ?? []
  if (!list) return <Display w={w} h={h} label="The exposure" corner={NONE}><text x={8} y={22} className="dp-ink">No reading of the exposure</text></Display>
  const n = Math.min(list.length, 4), cy = 44, step = 22, x0 = 34
  return <Display w={w} h={h} label="The exposure" does="The world on the left; an arrow to each endpoint it exposes. Crossed: what it could not expose, with the reason in the list." corner={`${list.length} open`}>
    <rect x={6} y={cy - 16} width={24} height={32} rx={2} className="dp-faint" />
    <text x={18} y={cy + 3} className="dp-axis" textAnchor="middle">world</text>
    {list.length === 0 && <text x={x0 + 10} y={cy + 3} className="dp-ink-dim">nothing exposed</text>}
    {list.slice(0, n).map((s, k) => {
      const y = cy + (k - (n - 1) / 2) * step, on = s.ref === chosen
      return <g key={s.ref}>
        <path d={`M30 ${cy}C${x0 + 16} ${cy} ${x0 + 10} ${y} ${x0 + 30} ${y}H${x0 + 44}`} className={on ? 'dp-curve-on' : 'dp-curve'} />
        <path d={`M${x0 + 44} ${y - 3}l4 3l-4 3`} className={on ? 'dp-curve-on' : 'dp-curve'} />
        <text x={x0 + 52} y={y - 1} className="dp-ink">{s.interaction ?? shortRef(s.ref)}</text>
        <text x={x0 + 52} y={y + 9} className="dp-axis">{s.endpoint?.replace(/^[a-z]+:\/\//, '') ?? NONE}</text>
      </g>
    })}
    {out.slice(0, 2).map((o, k) => {
      const y = 110 + k * 16
      return <g key={o.requirement}>
        <path d={`M8 ${y}H${x0 + 40}`} className="dp-faint" strokeDasharray="2 3" />
        <path d={`M${x0 + 16} ${y - 3}l6 6M${x0 + 22} ${y - 3}l-6 6`} stroke="var(--stall)" strokeWidth={1.3} />
        <text x={x0 + 52} y={y + 3} className="dp-ink-dim">{shortRef(o.requirement)} · {o.necessity ?? NONE}</text>
      </g>
    })}
  </Display>
}

/** The Exposure page: the world and an arrow to each endpoint it exposes, and what it could not expose with the reason; press one to
 * choose it. At the head Open in, the endpoint and Open. */
function ExposurePage({p, pane}: {p: ViewProps; pane: Pane}) {
  const v = p.v, list = surfacesOf(v), out = omittedOf(v)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const sel = list?.find(s => s.ref === chosen) ?? list?.[0]
  const items: RowItem[] = !list ? unreadRows('No reading of the exposure.')
    : [...list.map((s): RowItem => ({id: s.ref, name: s.interaction ?? shortRef(s.ref), light: 'lit', tone: 'value', note: s.endpoint ?? NONE, does: `${s.ref}: press to choose it, then Open.`})),
      ...(out ?? []).map((o): RowItem => ({id: `x:${o.requirement}`, name: shortRef(o.requirement), light: 'dark', note: o.necessity ?? NONE, why: o.reason ?? 'Workcell gave no reason.'}))]
  if (list?.length === 0 && !out?.length) items.push({id: 'none', name: 'The run exposes nothing', light: 'dark'})
  return <FullPage pane={pane} label="Exposure" readings={[
    {label: 'endpoint', value: sel?.endpoint?.replace(/^[a-z]+:\/\//, ''), does: 'The chosen endpoint.', copy: sel?.endpoint},
  ]} controls={<>
    <Radio {...st(p, 'openIn')} label="Open in" does="Where Open puts the endpoint: the Web monitor, or the pane that has focus." value={strOf(v, 'openIn') ?? ''} options={OPEN_IN} onChange={x => p.set('openIn', x)} />
    <Action {...st(p, 'open')} label="Open" does="Open the chosen endpoint where Open in says." onPress={sel ? () => p.set('open', sel.ref) : undefined} />
  </>}>
    <div className="wc-pics"><ExposureWell v={v} w={360} h={146} chosen={sel?.ref} /></div>
    <Rows does="What the run exposes, each with its endpoint. A dark row could not be exposed: point at its ! for the reason." items={items} size={7}
      selected={sel?.ref} onSelect={list?.length ? id => { if (!id.startsWith('x:')) setChosen(id) } : undefined} />
  </FullPage>
}

// ------------------------------------------------------------------------------------------------ keep or let go

const FATE_ROW: Readonly<Record<string, number>> = {present: 0, suspended: 1, snapshotted: 2, released: 3}
const wantOf = (v: V, b: Binding): string | undefined => { const w = strOf(v, `want:${b.ref}`); return w !== undefined && w in FATE_ROW ? w : undefined }
/** Where a binding stands now, as a fate: missing and stale stand at Keep, from which Recover lifts them. */
const nowFate = (b: Binding) => (b.presence === 'released' || b.presence === 'suspended' || b.presence === 'snapshotted' ? b.presence : 'present')
const changesOf = (v: V, world: World | null | undefined) => (world ? world.bindings.filter(b => { const w = wantOf(v, b); return w !== undefined && w !== nowFate(b) }) : [])

/** The fates: a column for each binding, a row for each fate. A teal dot where the binding stands now; its handle where you want it. A
 * line joins them when they differ. Drag a handle up or down to choose its fate. */
function FatesWell({p, w, h, live}: {p: ViewProps; w: number; h: number; live?: boolean}) {
  const v = p.v, world = worldOf(v)
  if (!world) return <Display w={w} h={h} label="The fates" corner={NONE}><text x={8} y={22} className="dp-ink">{world === null ? 'No world is prepared' : 'No reading of the world'}</text></Display>
  const bs = world.bindings.slice(0, 8), n = Math.max(1, bs.length), lx = 50, colW = (w - lx - 6) / n, top = 24, rowH = 32
  const y = (fate: string) => top + FATE_ROW[fate]! * rowH
  return <Display w={w} h={h} label="The fates" does="A column for each binding, a row for each fate. Teal: where it stands now. The handle: what Apply asks for. Drag a handle up or down.">
    {FATES.map(f => <g key={f.value}>
      <text x={6} y={y(f.value) + 3} className="dp-axis">{f.label.toLowerCase()}</text>
      <path d={`M${lx - 4} ${y(f.value)}H${w - 6}`} className="dp-grid" />
    </g>)}
    {bs.map((b, k) => {
      const cx = lx + k * colW + colW / 2, now = nowFate(b), want = wantOf(v, b) ?? now, fault = bindingState(b).fault
      const drag = live && !st(p, `want:${b.ref}`).disabled ? (_x: number, yy: number) => {
        const row = Math.round(clampTo(0, 3, (yy - top) / rowH)), next = FATES[row]!.value
        p.set(`want:${b.ref}`, next === now ? undefined : next)
      } : undefined
      return <g key={b.ref}>
        {want !== now && <path d={`M${cx} ${y(now)}V${y(want)}`} stroke="var(--dp-on)" strokeWidth={1.2} strokeDasharray="2 2" />}
        <circle cx={cx} cy={y(now)} r={3.4} fill={fault ? 'var(--stall)' : 'var(--dp-value)'} />
        {live ? <Handle n={k + 1} x={cx} y={y(want)} shape="ring" label={shortRef(b.ref)} does={`${b.ref}: drag up or down to choose its fate. Double-click to keep it as it stands.`}
          onDrag={drag} onReset={drag && (() => p.set(`want:${b.ref}`, undefined))} />
          : want !== now && <circle cx={cx} cy={y(want)} r={4} fill="none" stroke="var(--dp-on)" strokeWidth={1.4} />}
      </g>
    })}
  </Display>
}

/** The Release page: the fates, with a binding and its Fate to choose beside them, then each binding, where it stands, what you ask for it,
 * and what the last Apply did. At the head Apply and Release world. */
function ReleasePage({p, pane}: {p: ViewProps; pane: Pane}) {
  const v = p.v, world = worldOf(v), changes = changesOf(v, world), deltas = deltasOf(v)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const b = world?.bindings.find(x => x.ref === chosen) ?? world?.bindings[0]
  return <FullPage pane={pane} label="Release" controls={<>
    <Action {...st(p, 'apply')} hold label="Apply" does="Ask Workcell for each binding's fate. A released binding cannot come back." onPress={changes.length ? () => {
      p.set('apply', JSON.stringify(changes.map(c => ({ref: c.ref, desired: wantOf(v, c)}))))
    } : undefined} disabled={st(p, 'apply').disabled ?? (world && !changes.length ? 'No fate is changed.' : undefined)} />
    <Action {...st(p, 'releaseWorld')} hold label="Release world" does="Release the whole world as its retention says. The run's receipt keeps the account." onPress={world ? () => p.set('releaseWorld', world.ref) : undefined} />
  </>}>
    <div className="wc-pics">
      <FatesWell p={p} w={360} h={146} live />
      <div className="wc-fate">
        <Chooser label="Binding" wide does="The binding whose fate the radio sets." value={b?.ref ?? ''} options={(world?.bindings ?? []).map((x, i) => ({value: x.ref, label: `${i + 1} ${shortRef(x.ref)}`}))} onChange={setChosen} />
        <Radio {...(b ? st(p, `want:${b.ref}`) : {})} label="Fate" does="What Apply asks for this binding: keep it, suspend it, keep a snapshot, or let it go." value={b ? wantOf(v, b) ?? nowFate(b) : ''} options={FATES} stack
          onChange={b ? x => p.set(`want:${b.ref}`, x === nowFate(b) ? undefined : x) : undefined} />
      </div>
    </div>
    {!world ? <p className="ref-doc-lead">{world === null ? 'No world is prepared for this run.' : 'No reading of the world.'}</p> : <table className="wc-seats">
      <thead><tr><th>Binding</th><th>Stands</th><th>You ask</th><th>Last apply</th></tr></thead>
      <tbody>{world.bindings.map(x => { const want = wantOf(v, x), d = deltas?.find(y => y.ref === x.ref); return <tr key={x.ref} data-free={want ? undefined : 'true'}>
        <td><b>{x.ref}</b></td><td>{nowFate(x)}</td><td>{want ?? 'as it stands'}</td><td>{d ? `${d.observed ?? NONE} → ${d.desired}${d.action ? ` · ${d.action}` : ''}` : NONE}</td></tr> })}</tbody>
    </table>}
  </FullPage>
}

// ------------------------------------------------------------------------------------------------ what runs left behind (`left.` keys)

type LeftRing = 'sandboxes' | 'bindings' | 'worlds'
type LeftTick = 'held' | 'foreign' | 'idle'
const LEFT_RINGS: readonly LeftRing[] = ['sandboxes', 'bindings', 'worlds']
const LEFT_TITLE: Record<LeftRing, string> = {worlds: 'Worlds', bindings: 'Bindings', sandboxes: 'Sandboxes'}
const LEFT_OF: Record<string, LeftRing> = {'binding-drift': 'bindings', 'binding-lost': 'bindings', 'sandbox-orphan': 'sandboxes', 'sandbox-unproven': 'sandboxes'}
const LEFT_KIND: Record<string, string> = {'binding-drift': 'Binding not present', 'binding-lost': 'Binding lost', 'sandbox-orphan': 'Orphan sandbox', 'sandbox-unproven': 'Sandbox without a lease'}
const LEFT_SAYS: Record<string, string> = {
  'binding-drift': 'A world\'s binding is missing or stale, and its receipt can bring it back: Recover brings it back.',
  'binding-lost': 'A binding of a world that lasted only for its task is gone, and nothing brings it back.',
  'sandbox-orphan': 'A sandbox whose lease has ended, which nothing holds. Release orphans releases it, with a receipt.',
  'sandbox-unproven': 'The server reports no lease for the sandbox, so it may still be in use. This is not a fault, and it is never released.',
}
const LEFT_SHORT: Record<string, string> = {'binding-drift': 'not present', 'binding-lost': 'lost', 'sandbox-orphan': 'orphan', 'sandbox-unproven': 'no lease'}
const LEFT_TENDER: Record<string, 'recover' | 'orphans'> = {'reconcile-binding': 'recover', 'release-orphans': 'orphans'}
const LEFT_OP: Record<LeftRing, RegExp> = {worlds: /material/, bindings: /material|reconcile/, sandboxes: /sandboxes/}
interface LeftFinding {readonly id: string; readonly ring: LeftRing; readonly at: number | undefined; readonly kind: string; readonly fault: boolean; readonly subject: string; readonly tender?: 'recover' | 'orphans'}

/** What runs left, as read: each ring (worlds, their bindings, the sandboxes), the owner's findings on them, and the refusals. */
function readLeft(v: V) {
  const worlds = listOf<{ref: string; state?: string; bindings: {subject: string; presence?: string}[]}>(v, 'worlds', r => (text(r.ref) ? {ref: r.ref as string, state: text(r.state),
    bindings: (Array.isArray(r.bindings) ? r.bindings : []).flatMap(b => (rec(b) && text(b.ref) ? [{subject: `${r.ref}#${b.ref}`, presence: text(b.presence)}] : []))} : undefined))
  const boxes = json<unknown>(v, 'sandboxes', undefined)
  const sandboxes = rec(boxes) && Array.isArray(boxes.sandboxes) ? boxes.sandboxes.flatMap(b => (rec(b) && text(b.id) ? [{id: b.id as string, lease: text(b.lease)}] : [])) : undefined
  const server = rec(boxes) ? text(boxes.server) : undefined
  const bindings = worlds?.flatMap(w => w.bindings)
  const rings: Record<LeftRing, {ticks: LeftTick[]; subjects: string[]} | undefined> = {
    worlds: worlds && {ticks: worlds.map(w => (w.state === 'healthy' ? 'held' : 'foreign')), subjects: worlds.map(w => w.ref)},
    bindings: bindings && {ticks: bindings.map(b => (b.presence === 'present' ? 'held' : b.presence === 'missing' || b.presence === 'stale' ? 'foreign' : 'idle')), subjects: bindings.map(b => b.subject)},
    sandboxes: sandboxes && {ticks: sandboxes.map(b => (b.lease === 'live' ? 'held' : b.lease === 'expired-orphan' ? 'foreign' : 'idle')), subjects: sandboxes.map(b => b.id)},
  }
  const sources = listOf<{boundaryOp: string; refusal?: string}>(v, 'sources', r => (text(r.boundaryOp) ? {boundaryOp: r.boundaryOp as string, refusal: text(r.refusal)} : undefined))
  const refusal = Object.fromEntries(LEFT_RINGS.map(ring => [ring, sources?.find(s => LEFT_OP[ring].test(s.boundaryOp) && s.refusal)?.refusal])) as Record<LeftRing, string | undefined>
  const readable = (ring: LeftRing) => !!rings[ring] && !refusal[ring]
  const reported = listOf<{kind: string; subject: string; tenderId?: string}>(v, 'findings', r => (text(r.kind) && text(r.subject) ? {kind: r.kind as string, subject: r.subject as string, tenderId: text(r.tenderId)} : undefined))
  const shown: LeftFinding[] = (reported ?? []).flatMap((f): LeftFinding[] => {
    const ring = LEFT_OF[f.kind]
    if (!ring || !readable(ring)) return []
    const i = rings[ring]?.subjects.indexOf(f.subject) ?? -1
    return [{id: `${f.kind}:${f.subject}`, ring, at: i < 0 ? undefined : i, kind: f.kind, fault: f.kind !== 'sandbox-unproven', subject: f.subject, tender: f.tenderId ? LEFT_TENDER[f.tenderId] : undefined}]
  })
  return {rings, refusal, readable, server, found: reported !== undefined, shown, anyRead: LEFT_RINGS.some(readable)}
}
const leftOf = (p: ViewProps) => scoped(p, 'left.')

const RING_R = [1, .7, .4]
const polarAt = (cx: number, cy: number, r: number, i: number, n: number) => {
  const a = -Math.PI / 2 + 2 * Math.PI * (i + .5) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
/** Three rings — sandboxes, bindings and worlds from the outside in. A tick for each thing read (teal held, orange lost or ended, faint
 * unproven); a dot beside a tick that has a finding, orange a fault, teal a reading; the chosen one ringed. Beside them each ring's count. */
function LeftRings({p}: {p: ViewProps}) {
  const g = readLeft(p.v), sel = strOf(p.v, 'sel'), cx = 66, cy = 70, R = 52, t = 2.4
  return <g>
    {LEFT_RINGS.map((ring, k) => {
      const read = g.rings[ring], r = R * RING_R[k]!, ok = g.readable(ring) && !!read, n = read?.ticks.length ?? 0
      const lines: Record<LeftTick, string> = {held: '', foreign: '', idle: ''}
      if (ok) for (let i = 0; i < n; i++) {
        const [x1, y1] = polarAt(cx, cy, r - t, i, n), [x2, y2] = polarAt(cx, cy, r + t, i, n)
        lines[read!.ticks[i]!] += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
      }
      return <g key={ring}>
        <circle cx={cx} cy={cy} r={r} className="dp-faint" strokeDasharray={ok ? undefined : '2 3'} opacity={ok ? 1 : .6} />
        {ok && <>
          <path d={lines.idle} stroke="var(--text-faint)" strokeWidth={1} fill="none" />
          <path d={lines.held} stroke="var(--dp-value)" strokeWidth={1.4} fill="none" />
          <path d={lines.foreign} stroke="var(--stall)" strokeWidth={1.5} fill="none" />
          {g.shown.filter(f => f.ring === ring && f.at !== undefined).map(f => {
            const [x, y] = polarAt(cx, cy, r + 6.5, f.at!, n)
            return <g key={f.id}>
              <circle cx={x} cy={y} r={t} fill={f.fault ? 'var(--stall)' : 'var(--dp-value)'} />
              {f.id === sel && <circle cx={x} cy={y} r={t + 4} fill="none" stroke="var(--text)" strokeWidth={1} />}
            </g>
          })}
        </>}
      </g>
    })}
    {!g.anyRead && <text x={cx} y={cy + 3} className="dp-axis" textAnchor="middle">no reading</text>}
    {LEFT_RINGS.map((ring, i) => <g key={ring}>
      <text x={134} y={24 + i * 40} className="dp-axis">{LEFT_TITLE[ring].toLowerCase()}</text>
      <text x={134} y={36 + i * 40} className="dp-ink">{g.readable(ring) ? `${g.rings[ring]?.ticks.length ?? 0} read` : g.refusal[ring] ? 'refused' : 'no reading'}</text>
    </g>)}
  </g>
}

const leftRows = (g: ReturnType<typeof readLeft>): RowItem[] => {
  // A ring whose owner refused stands dark in the stall colour under its own name; the refusal goes to the Info line (`why`).
  const refused = LEFT_RINGS.flatMap((ring): RowItem[] => (g.refusal[ring] ? [{id: `refused:${ring}`, name: LEFT_TITLE[ring], light: 'dark', tone: 'stall', why: `Not read: ${g.refusal[ring]}`}] : []))
  if (!g.anyRead) return refused.length ? refused : unreadRows('No reading of what was left behind.')
  if (!g.found) return unreadRows('No reading of the findings.', undefined, refused)
  if (!g.shown.length) return [...refused, {id: 'clear', name: 'Nothing left behind', light: 'lit', tone: 'green'}]
  return [...refused, ...g.shown.map((f): RowItem => ({id: f.id, name: f.ring === 'bindings' ? shortRef(f.subject.split('#').pop()!) : f.subject, light: 'lit', tone: f.fault ? 'stall' : 'value',
    note: LEFT_SHORT[f.kind] ?? f.kind, does: `${LEFT_KIND[f.kind] ?? f.kind}: ${LEFT_SAYS[f.kind] ?? ''} ${f.subject}`}))]
}
/** Why a finding's act cannot run now, or undefined. */
function leftWhy(p: ViewProps, f: LeftFinding | undefined, act: 'recover' | 'orphans'): string | undefined {
  if (!f) return 'Choose a finding first.'
  if (f.tender !== act) return f.kind === 'binding-lost' ? LEFT_SAYS['binding-lost'] : f.kind === 'sandbox-unproven' ? LEFT_SAYS['sandbox-unproven'] : `It does not fit ${LEFT_KIND[f.kind] ?? 'this finding'}.`
  return st(p, act).disabled
}

/** The Left behind page: the worlds, bindings and sandboxes that runs left, each with its finding; press one to choose it. At the head
 * Recover and Release orphans. */
function LeftPage({p, pane}: {p: ViewProps; pane: Pane}) {
  const g = readLeft(p.v), sel = g.shown.find(f => f.id === strOf(p.v, 'sel'))
  return <FullPage pane={pane} label="Left behind" controls={<>
    <Action {...st(p, 'recover')} hold label="Recover" does="Bring the chosen binding back from its world's receipt." onPress={() => { if (sel) p.set('recover', sel.subject) }} disabled={leftWhy(p, sel, 'recover')} />
    <Action {...st(p, 'orphans')} hold label="Release orphans" does={`Release the sandboxes whose lease has ended${g.server ? ` on ${g.server}` : ''}. A sandbox without a lease is never released. It returns a receipt.`}
      onPress={() => { if (sel) p.set('orphans', sel.subject) }} disabled={leftWhy(p, sel, 'orphans')} />
  </>}>
    <div className="wc-pics">
      <Display w={194} h={146} label="What runs left" does="Rings of the sandboxes, the worlds' bindings and the worlds, with the count of each. A dot marks a thing with a finding: orange a fault, teal a reading."
        corner={g.anyRead && g.found ? `${g.shown.length} found` : NONE}>
        <LeftRings p={p} />
      </Display>
    </div>
    <Rows does="What the runs left, each with its finding. Orange is a fault; teal a reading that is not one. Press one to choose it."
      items={leftRows(g)} size={8} selected={sel?.id} onSelect={id => { if (!id.startsWith('refused:') && id !== 'none' && id !== 'clear') p.set('sel', id) }}
      page={numOf(p.v, 'page:findings') ?? 0} onPage={x => p.set('page:findings', x)} />
    {strOf(p.v, 'receipt') && <p className="ref-doc-lead">Last receipt: {strOf(p.v, 'receipt')}</p>}
  </FullPage>
}

// ------------------------------------------------------------------------------------------------ the seats (`seat.` keys) and the checkouts (`co.` keys)

/** A product's seats side by side: a block for each, filled by who holds it (teal a lane, orange another lane's unmerged work, hollow
 * free); under it the uncommitted files, how the lane stands against main, and the tail of its branch. Handle 1 chooses the seat. */
function SeatBlocks({p, w}: {p: ViewProps; w: number}) {
  const g = seats(p.v)
  // The workcell's own seats, as Workcell reads them; with none, the page says so in words (no names are drawn that it did not report).
  const names = g.envs
  if (!names.length) return <g><text x={w / 2} y={52} className="dp-axis" textAnchor="middle">{g.rows ? NO_SEATS : NO_SEAT_READING}</text></g>
  const n = names.length, pad = 4, colW = (w - pad * 2) / n, colX = (i: number) => pad + i * colW + colW / 2
  const top = 27, bh = 40
  const seatHand = g.envs.length > 0 && !st(p, 'seat').disabled
  const pick = (x: number) => p.set('seat', names[clampTo(0, n - 1, Math.floor((x - pad) / colW))]!)
  return <g>
    {names.map((name, i) => {
      const row = g.rows?.find(r => r.workcell === name && r.product === g.product)
      const chosen = name === g.seat, cx = colX(i), x0 = cx - colW / 2 + 3, bw = colW - 6
      const held = row?.state === 'claimed', foreign = row?.state === 'occupied-foreign-lane'
      const colour = foreign ? 'var(--stall)' : 'var(--dp-value)'
      const files = filesOf(row), ahead = row?.ahead, behind = row?.behind
      const clean = held && files === 0 && ahead === 0
      return <g key={name}>
        <text x={cx} y={22} className={chosen ? 'dp-ink' : 'dp-axis'} textAnchor="middle">{name}</text>
        <rect x={x0} y={top} width={bw} height={bh} rx={2}
          style={{fill: held || foreign ? `color-mix(in srgb, ${colour} 24%, transparent)` : 'none', stroke: held || foreign ? colour : 'var(--text-faint)', strokeWidth: chosen ? 1.7 : 1,
            strokeDasharray: held || foreign ? undefined : '2 2', opacity: g.rows ? 1 : .55}} />
        {g.rows && <text x={cx} y={top + 16} className={held || foreign ? 'dp-ink' : 'dp-axis'} textAnchor="middle">{row ? STATE_WORD[row.state] ?? NONE : 'none'}</text>}
        {g.rows && row && (held || foreign) && <text x={cx} y={top + 29} className="dp-ink-dim" textAnchor="middle" style={{fontSize: 8}}>{short(row.claimedBy)}</text>}
        {row && <g>
          <text x={cx} y={84} className="dp-ink" textAnchor="middle" style={{fill: files === undefined ? undefined : files > 0 ? 'var(--stall)' : 'var(--text-faint)'}}>
            {files === undefined ? NONE : files > 0 ? `${files} file${files === 1 ? '' : 's'}` : 'clean'}</text>
          <text x={cx} y={95} className="dp-ink-dim" textAnchor="middle" style={{fill: clean ? 'var(--green)' : undefined}}>
            {held || foreign ? (clean ? 'landed' : ahead == null ? NONE : `+${ahead}`) : behind ? `${behind} behind` : 'at main'}</text>
          {(held || foreign) && row.branch && <text x={cx} y={106} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{tail(row.branch, Math.max(6, Math.floor(colW / 5)))}</text>}
        </g>}
      </g>
    })}
    {!g.rows && <text x={w / 2} y={top + bh + 18} className="dp-axis" textAnchor="middle">no reading of the seats</text>}
    {g.rows && g.seat && g.envs.includes(g.seat)
      && <Handle n={1} x={colX(g.envs.indexOf(g.seat))} y={top + bh + 30} label="Seat" does="Drag along the row to choose the seat."
        onDrag={seatHand ? x => pick(x) : undefined} />}
    {g.rows && <text x={pad + 2} y={140} className="dp-axis">{g.product ?? NONE}</text>}
  </g>
}

type TenderId = 'release' | 'prune' | 'sweep'
type Tick = 'seat' | 'held' | 'foreign' | 'idle'
const RINGS = ['branches', 'seats', 'worktrees'] as const
type Ring = (typeof RINGS)[number]
const RING_TITLE: Record<Ring, string> = {seats: 'Seats', worktrees: 'Worktrees', branches: 'Branches'}
const TENDERS: Record<TenderId, {label: string; op: string}> = {
  release: {label: 'Release seat', op: 'seat release: refresh the seat to the main branch and clear its claim.'},
  prune: {label: 'Prune worktree', op: 'git worktree remove: remove the checkout that no seat names.'},
  sweep: {label: 'Sweep branch', op: 'git branch -d: remove the stray branch, which Git allows only when it is merged.'},
}
/** The tender ids of the owner's model (HYGIENE_TENDERS) and the key each acts on. */
const TENDER_OF: Record<string, TenderId> = {'release-seat': 'release', 'prune-worktree': 'prune', 'sweep-branch': 'sweep'}
/** The kinds of the owner's model (HygieneFindingKind), by the ring each stands on. */
const RING_OF: Record<string, Ring> = {
  'seat-claimed': 'seats', 'seat-drift': 'seats', 'seat-floor-breach': 'seats', 'checkout-missing': 'seats', 'foreign-lane': 'seats', 'occupied-by-landed': 'seats',
  'stray-branch': 'branches', 'worktree-outside-register': 'worktrees', 'root-mixed': 'worktrees',
}
const KIND_NAME: Record<string, string> = {
  'seat-claimed': 'Seat claimed', 'seat-drift': 'Seat drift', 'seat-floor-breach': 'Disk below floor', 'checkout-missing': 'Checkout missing', 'foreign-lane': 'Foreign lane',
  'occupied-by-landed': 'Seat on a landed branch', 'stray-branch': 'Stray branch', 'worktree-outside-register': 'Worktree outside the register', 'root-mixed': 'Root is a product checkout',
}
const KIND_SAYS: Record<string, string> = {
  'seat-claimed': 'A lane holds the seat. This is not a fault.', 'seat-drift': 'The register and the checkout disagree.', 'seat-floor-breach': 'A seat has less free disk than the floor.',
  'checkout-missing': 'The register names a checkout that is not on disk.', 'foreign-lane': 'Unmerged work of another lane stands in a seat. The decision is yours.',
  'occupied-by-landed': 'The seat stands on a branch that is already merged.', 'stray-branch': 'A lane branch that no seat holds and no claim accounts for.',
  'worktree-outside-register': 'A checkout that no seat names.', 'root-mixed': 'Your root is also the checkout of a product. The decision is yours.',
}
const KIND_SHORT: Record<string, string> = {
  'seat-claimed': 'claimed', 'seat-drift': 'drift', 'seat-floor-breach': 'disk', 'checkout-missing': 'missing', 'foreign-lane': 'foreign', 'occupied-by-landed': 'landed',
  'stray-branch': 'stray', 'worktree-outside-register': 'outside', 'root-mixed': 'mixed',
}
/** The kinds that are readings and not faults. */
const NOT_FAULTS: ReadonlySet<string> = new Set(['seat-claimed'])
/** Which of a finding's operations its ring was read from. */
const RING_OP: Record<Ring, RegExp> = {seats: /seat status/, worktrees: /worktree/, branches: /for-each-ref|branch/}

interface Machine {readonly id: string; readonly label?: string; readonly ref?: string; readonly does?: string}
interface BranchRow {readonly name: string; readonly head?: string | null; readonly checkedOutAt?: string | null; readonly merged?: boolean}
interface Reported {readonly kind: string; readonly subject: string; readonly standing?: string; readonly boundaryOps?: unknown; readonly tenderId?: unknown}
interface Finding {
  readonly id: string; readonly ring: Ring; readonly at: number | undefined; readonly kind: string; readonly fault: boolean; readonly subject: string
  readonly standing: string; readonly ops: readonly string[]; readonly tender: TenderId | undefined; readonly merged: boolean | undefined; readonly dirty: number | undefined
}
interface RingRead {readonly ticks: readonly Tick[]; readonly subjects: readonly string[]}
const isText = (x: unknown): x is string => typeof x === 'string' && x.length > 0
/** A JSON list the owner reported, the rows that keep their identity; undefined when the key is absent or holds no list. */
function rowsOf<T>(v: V, key: string, keep: (row: Record<string, unknown>) => boolean): T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.filter((row): row is Record<string, unknown> => rec(row) && keep(row)) as unknown as T[]
}

/** The machine's checkouts as read: each ring, the owner's findings on them, and what the page shows. A ring with no reading, or read
 * from another machine than the one chosen, has no reading; a finding of a kind this page does not know, whose subject no ring holds, is
 * not drawn. A source that refused leaves its ring empty and keeps the owner's words. */
function readCheckouts(v: V) {
  const seatRows = rowsOf<SeatReading>(v, 'seats', r => isText(r.workcell) && isText(r.product))
  const trees = rowsOf<WorktreeRow>(v, 'worktrees', r => isText(r.path))
  const branches = rowsOf<BranchRow>(v, 'branches', r => isText(r.name))
  const read = (ticks: Tick[], subjects: string[]): RingRead => ({ticks, subjects})
  const rings: Record<Ring, RingRead | undefined> = {
    seats: seatRows && read(seatRows.map(s => (s.state === 'claimed' ? 'seat' : s.state === 'free' ? 'idle' : 'foreign')), seatRows.map(s => `${s.workcell}/${s.product}`)),
    worktrees: trees && read(trees.map(() => 'held'), trees.map(t => t.path)),
    branches: branches && read(branches.map(b => (b.checkedOutAt ? 'held' : 'idle')), branches.map(b => b.name)),
  }
  const machines = rowsOf<Machine>(v, 'machines', r => isText(r.id))
  const chosen = machines?.find(m => m.id === strOf(v, 'machine'))
  const standsOn = strOf(v, 'machineRef')
  const elsewhere = !!chosen?.ref && standsOn !== undefined && chosen.ref !== standsOn
  const sources = rowsOf<BoundaryOpSource>(v, 'sources', r => isText(r.boundaryOp))
  const refusal = Object.fromEntries(RINGS.map(ring => [ring, sources?.find(s => RING_OP[ring].test(s.boundaryOp) && s.refusal)?.refusal])) as Record<Ring, string | undefined>
  const readable = (ring: Ring) => !elsewhere && !!rings[ring] && !refusal[ring]
  const reported = rowsOf<Reported>(v, 'findings', r => isText(r.kind) && isText(r.subject))
  const all: Finding[] = []
  for (const f of reported ?? []) {
    const ring = RING_OF[f.kind] ?? RINGS.find(r => rings[r]?.subjects.includes(f.subject))
    if (!ring) continue
    const i = rings[ring]?.subjects.indexOf(f.subject) ?? -1, at = i < 0 ? undefined : i
    const branch = ring === 'branches' && at !== undefined ? branches?.[at] : undefined
    const seat = ring === 'seats' && at !== undefined ? seatRows?.[at] : undefined
    all.push({id: `${f.kind}:${f.subject}`, ring, at, kind: f.kind, fault: !NOT_FAULTS.has(f.kind), subject: f.subject, standing: isText(f.standing) ? f.standing : NONE,
      ops: Array.isArray(f.boundaryOps) ? f.boundaryOps.filter(isText) : [], tender: isText(f.tenderId) ? TENDER_OF[f.tenderId] : undefined,
      merged: typeof branch?.merged === 'boolean' ? branch.merged : undefined,
      dirty: seat && (seat.dirty !== null || seat.untracked !== null) ? (seat.dirty ?? 0) + (seat.untracked ?? 0) : undefined})
  }
  const faultsOnly = boolOf(v, 'faults') === true
  const shown = all.filter(f => readable(f.ring) && (!faultsOnly || f.fault))
  const disk = rowsOf<{workcell: string; freeGb?: unknown}>(v, 'disk', r => isText(r.workcell))
  const free = disk?.flatMap(d => (typeof d.freeGb === 'number' && Number.isFinite(d.freeGb) ? [{workcell: d.workcell, gb: d.freeGb}] : []))
  return {rings, machines, chosen, standsOn, elsewhere, refusal, readable, found: reported !== undefined, shown, faultsOnly, noun: faultsOnly ? 'faults' : 'findings',
    anyRead: RINGS.some(readable), free: elsewhere ? undefined : free}
}
type Checkouts = ReturnType<typeof readCheckouts>
const CHECKOUTS = new WeakMap<V, Checkouts>()
function checkouts(v: V): Checkouts {
  let g = CHECKOUTS.get(v)
  if (!g) { g = readCheckouts(v); CHECKOUTS.set(v, g) }
  return g
}
const lastName = (f: Finding) => (f.ring === 'worktrees' ? f.subject.replace(/^\/Users\/[^/]+\/Central\//, '') : f.subject.split('/').slice(-2).join('/'))

/** Whether a finding's tender can run now, and if not, why. The host's standing for the tender's key comes last. */
function tenderState(p: ViewProps, f: Finding | undefined): {ok: boolean; why?: string} {
  if (!f) return {ok: false, why: 'Choose a finding first.'}
  if (!f.tender) return {ok: false, why: f.kind === 'foreign-lane' || f.kind === 'root-mixed' ? KIND_SAYS[f.kind] : 'No tender fits this finding.'}
  if (f.tender === 'release' && f.dirty !== undefined && f.dirty > 0) return {ok: false, why: `The seat holds ${f.dirty} uncommitted files. It is never released here.`}
  if (f.tender === 'sweep' && f.merged === false) return {ok: false, why: 'This branch holds unmerged work. Leave it to its lane.'}
  const held = st(p, f.tender).disabled
  return held ? {ok: false, why: held} : {ok: true}
}

/** Three rings — branches, seats and worktrees from the outside in. A tick for each thing read; a dot beside a tick that has a finding
 * (orange a fault, teal a reading); an amber ring on the dot where a tender fits; the chosen finding's dot is ringed in white. Beside
 * them, each ring's count. A ring with no reading is dashed. */
function CheckoutRings({p}: {p: ViewProps}) {
  const g = checkouts(p.v), sel = strOf(p.v, 'sel')
  const cx = 66, cy = 70, R = 52, t = 2.4, off = 6.5
  const marks = (ring: Ring, k: number) => {
    const read = g.rings[ring]
    if (!g.readable(ring) || !read) return null
    const n = read.ticks.length, r = R * RING_R[k]!
    const lines: Record<Tick, string> = {seat: '', held: '', foreign: '', idle: ''}
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polarAt(cx, cy, r - t, i, n), [x2, y2] = polarAt(cx, cy, r + t, i, n), kind = read.ticks[i]!
      lines[kind] = `${lines[kind]}M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
    }
    const flagged = new Map<number, Finding[]>()
    g.shown.filter(f => f.ring === ring && f.at !== undefined).forEach(f => flagged.set(f.at!, [...(flagged.get(f.at!) ?? []), f]))
    return <g key={ring}>
      <path d={lines.idle} stroke="var(--text-faint)" strokeWidth={1} opacity={.7} fill="none" />
      <path d={lines.held} stroke="var(--dp-value)" strokeWidth={1.3} fill="none" />
      <path d={lines.seat} stroke="var(--dp-value)" strokeWidth={1.5} fill="none" />
      <path d={lines.foreign} stroke="var(--stall)" strokeWidth={1.5} fill="none" />
      {[...flagged].map(([i, fs]) => {
        const [x, y] = polarAt(cx, cy, r + off, i, n), fault = fs.some(f => f.fault), fits = fs.some(f => tenderState(p, f).ok), chosen = fs.some(f => f.id === sel)
        return <g key={i}>
          <circle cx={x} cy={y} r={k === 0 ? t * .8 : t} fill={fault ? 'var(--stall)' : 'var(--dp-value)'} />
          {fits && <circle cx={x} cy={y} r={t + 2.2} fill="none" stroke="var(--accent)" strokeWidth={1} />}
          {chosen && <circle cx={x} cy={y} r={t + 4} fill="none" stroke="var(--text)" strokeWidth={1} />}
        </g>
      })}
    </g>
  }
  return <g>
    {RINGS.map((ring, k) => <g key={ring}>
      <circle cx={cx} cy={cy} r={R * RING_R[k]!} className="dp-faint" strokeDasharray={g.readable(ring) ? undefined : '2 3'} opacity={g.readable(ring) ? 1 : .6} />
      {marks(ring, k)}
    </g>)}
    {!g.anyRead && <text x={cx} y={cy + 3} className="dp-axis" textAnchor="middle">no reading</text>}
    {RINGS.map((ring, i) => {
      const y = 24 + i * 40, read = g.rings[ring], flagged = g.shown.filter(f => f.ring === ring).length
      return <g key={ring}>
        <text x={134} y={y} className="dp-axis">{RING_TITLE[ring].toLowerCase()}</text>
        <text x={134} y={y + 12} className="dp-ink">{g.readable(ring) ? `${read?.ticks.length ?? 0} read` : g.refusal[ring] ? 'refused' : 'no reading'}</text>
        {g.readable(ring) && <text x={134} y={y + 23} className="dp-ink-dim">{g.found ? `${flagged} flagged` : NONE}</text>}
      </g>
    })}
  </g>
}

const findingRows = (g: Checkouts): RowItem[] => {
  // A ring whose owner refused stands dark in the stall colour under its own name; the refusal goes to the Info line (`why`).
  const refused = RINGS.flatMap((ring): RowItem[] => (g.refusal[ring] ? [{id: `refused:${ring}`, name: RING_TITLE[ring], light: 'dark', tone: 'stall', why: `Not read: ${g.refusal[ring]}`}] : []))
  if (!g.anyRead) return refused.length ? refused : unreadRows(g.elsewhere ? 'No reading from that machine.' : 'No reading of the checkouts.')
  if (!g.found) return unreadRows('No reading of the findings.', undefined, refused)
  if (g.shown.length === 0) return [...refused, {id: 'clear', name: g.faultsOnly ? 'No faults' : 'No findings', light: 'lit', tone: 'green'}]
  return [...refused, ...g.shown.map((f): RowItem => ({id: f.id, name: lastName(f), light: 'lit', tone: f.fault ? 'stall' : 'value', note: KIND_SHORT[f.kind] ?? f.kind,
    does: `${KIND_NAME[f.kind] ?? f.kind}: ${KIND_SAYS[f.kind] ?? f.standing}`}))]
}

/** Why a tender cannot run on the chosen finding now, or undefined: the finding's own tender, as tenderState says; any other does not fit. */
function tenderWhy(p: ViewProps, f: Finding | undefined, id: TenderId): string | undefined {
  if (f?.tender && f.tender !== id) return `It does not fit ${KIND_NAME[f.kind] ?? 'this finding'}.`
  const can = tenderState(p, f)
  return can.ok ? undefined : can.why
}

/** The Seats page: its process first (faces/EnvironFaces.tsx; manual §25) — the seats' succession, one lane after another on the same
 * ground, beside the checkouts' erosion, the wear of many runs on them; one row for each seat of each project; then the seats and the
 * checkouts as rings, and the worktrees and branches, each with its finding; press one to choose it. At the head the three tenders you
 * approve. */
function SeatsPage({p, pane}: {p: ViewProps; pane: Pane}) {
  const s = seatOf(p), c = coOf(p), g = checkouts(c.v), sel = g.shown.find(f => f.id === strOf(c.v, 'sel')), rows = seatsOf(p.v)
  const tender = (id: TenderId) => <Action {...st(c, id)} hold label={TENDERS[id].label} does={`${TENDERS[id].op} You approve it by holding.`}
    onPress={() => { if (sel?.tender === id) c.set(id, sel.subject) }} disabled={tenderWhy(c, sel, id)} />
  return <FullPage pane={pane} label="Seats" controls={<>{tender('release')}{tender('prune')}{tender('sweep')}</>}>
    <div className="wc-pics">
      <SuccessionEnviron reading={successionOf(s.v)} w={340} h={146} />
      <ErosionEnviron reading={checkoutErosionOf(c.v)} w={340} h={146} />
    </div>
    {rows === undefined ? <p className="ref-doc-lead">No reading of the seats.</p> : <table className="wc-seats">
      <thead><tr><th>Project</th><th>Lane</th><th>Claim</th><th>Co-workers</th><th>Uncommitted</th><th>Against main</th></tr></thead>
      <tbody>{rows.map(x => <tr key={x.product} data-free={x.lane ? undefined : 'true'}>
        <td><b>{x.product}</b></td><td>{x.lane ?? 'free'}</td><td>{x.claimedBy ?? NONE}</td><td>{x.workers?.length ? x.workers.join(', ') : NONE}</td>
        <td>{x.dirty ?? NONE}</td><td>{x.ahead === undefined ? NONE : `${x.ahead} ahead · ${x.behind ?? 0} behind`}</td>
      </tr>)}</tbody>
    </table>}
    <div className="wc-pics">
      <Display w={340} h={146} label="The seats" does="The project's seats on this machine: who holds each, its uncommitted files and how its lane stands against main. Drag handle 1 to choose the seat.">
        <SeatBlocks p={s} w={340} />
      </Display>
      <Display w={194} h={146} label="The checkouts" does="Rings of branches, seats and worktrees, with the count of each. A dot marks a thing with a finding; an amber ring, a tender that fits."
        corner={g.anyRead && g.found ? `${g.shown.length} ${g.noun}` : NONE}>
        <CheckoutRings p={c} />
      </Display>
    </div>
    <Rows does="What the page found, with its kind. Orange is a fault; teal a reading that is not one. A finding is a reading, not a verdict. Press one to choose it."
      items={findingRows(g)} size={8} selected={sel?.id} onSelect={id => { if (!id.startsWith('refused:') && id !== 'none' && id !== 'clear') c.set('sel', id) }}
      page={numOf(c.v, 'page:findings') ?? 0} onPage={x => c.set('page:findings', x)} />
  </FullPage>
}
const seatOf = (p: ViewProps) => scoped(p, 'seat.')
const coOf = (p: ViewProps) => scoped(p, 'co.')

// ------------------------------------------------------------------------------------------------ the machine (`carrier.` and `mc.` keys)

interface Offer {readonly ref: string; readonly port: string; readonly name?: string; readonly health?: string; readonly availability?: string}
const offersOf = (v: V): Offer[] | undefined => {
  const raw = json<unknown>(v, 'offers', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((o): Offer[] => { const r = o && typeof o === 'object' ? o as Record<string, unknown> : {}; const ref = text(r.ref), port = text(r.port)
    return ref && port ? [{ref, port, name: text(r.name), health: text(r.health), availability: text(r.availability)}] : [] })
}
/** The runs to choose among, where the owner names several for the chosen world; undefined otherwise. */
const runsOf = (v: V): string[] | undefined => {
  const raw = json<unknown>(v, 'runs', undefined)
  const runs = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string' && r.length > 0) : []
  return runs.length > 1 ? runs : undefined
}
const runChooser = (p: ViewProps, runs: readonly string[]) => <Chooser {...st(p, 'planRun')} label="Run" wide
  does="The runs Workcell names for the chosen world. Choose the one whose needs the plan lays on the offers. None is assumed."
  value={strOf(p.v, 'planRun') ?? ''} options={[{value: '', label: 'Choose a run'}, ...runs.map(run => ({value: run, label: run}))]} onChange={x => p.set('planRun', x || undefined)} />
/** The rows of the offers picture: Workcell's ports, and the exposures a plan asks for. */
const LANES: readonly (readonly [string, string])[] = [['workspace', 'workspace'], ['execution', 'execution'], ['project-runtime', 'runtime'], ['service', 'service'],
  ['storage', 'storage'], ['artifact-storage', 'artifacts'], ['exposure', 'exposure']]
/** The lane a requirement the plan could not place belongs to, by its kind. */
const laneOfNeed = (q: string) => (q.startsWith('exposure:') ? 'exposure' : q.startsWith('connectivity:') || q.startsWith('service:') ? 'service' : q.startsWith('workspace') ? 'workspace'
  : q.startsWith('output') ? 'artifact-storage' : q.startsWith('storage') ? 'storage' : q.startsWith('runtime') ? 'project-runtime' : 'execution')

/** The offers, a row for each port: a square for each offer, green healthy, amber degraded, crossed down. The plan over them: a ring round
 * each offer it chose (solid what the run requires, dashed what it prefers), orange where the choice is degraded, and an orange cross at
 * the end of a row for what no offer can meet. */
function OffersDisplay({v, w, h}: {v: V; w: number; h: number}) {
  const offers = offersOf(v), plan = planOf(v)
  const corner = plan?.status ? PLAN_WORD[plan.status] ?? plan.status : NONE
  if (!offers) return <Display w={w} h={h} label="Offers and plan" corner={corner}><text x={8} y={22} className="dp-ink">No reading of the offers</text></Display>
  const lx = 52, top = 18, step = 17, cell = 9, pitch = 13
  const degraded = new Set((plan?.degradations ?? []).map(d => d.requirement))
  return <Display w={w} h={h} label="Offers and plan" does="A row for each port: a square for each offer, green healthy, amber degraded, crossed down. A ring round each offer the run's plan chose; an orange cross for what no offer meets." corner={corner}>
    {LANES.map(([lane, name], k) => {
      const y = top + k * step, row = offers.filter(o => o.port === lane)
      const missed = (plan?.omissions ?? []).filter(o => laneOfNeed(o.requirement) === lane)
      return <g key={lane}>
        <text x={6} y={y + 3} className="dp-axis">{name}</text>
        <path d={`M${lx - 4} ${y}H${w - 6}`} className="dp-grid" />
        {row.map((o, i) => {
          const x = lx + i * pitch, down = o.health === 'unavailable', chose = plan?.bindings.filter(b => b.offer === o.ref) ?? []
          const bad = chose.some(b => degraded.has(b.ref))
          return <g key={o.ref}>
            <rect x={x} y={y - cell / 2} width={cell} height={cell} rx={1} fill={o.health === 'healthy' ? 'var(--green)' : 'none'} stroke={o.health === 'healthy' ? 'none' : down ? 'var(--text-faint)' : 'var(--dp-on)'}><title>{`${o.name ?? o.ref} · ${o.health ?? NONE}`}</title></rect>
            {down && <path d={`M${x + 1.5} ${y - 3}l6 6M${x + 7.5} ${y - 3}l-6 6`} stroke="var(--text-faint)" strokeWidth={1} />}
            {chose.length > 0 && <rect x={x - 2.5} y={y - cell / 2 - 2.5} width={cell + 5} height={cell + 5} rx={2} fill="none" stroke={bad ? 'var(--stall)' : 'var(--dp-on)'} strokeWidth={1.3}
              strokeDasharray={chose.every(b => b.necessity !== 'required') ? '2 2' : undefined} />}
          </g>
        })}
        {missed.map((m, i) => { const x = w - 12 - i * 12; return <path key={m.requirement} d={`M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7`} stroke="var(--stall)" strokeWidth={1.5}><title>{`${m.requirement} · ${m.reason ?? NONE}`}</title></path> })}
      </g>
    })}
    {!plan && <text x={w - 6} y={h - 5} className="dp-axis" textAnchor="end">no reading of the plan</text>}
  </Display>
}

type Mode = 'off' | 'propose' | 'write'
type Kind = 'capability' | 'package' | 'configuration' | 'service'
type Status = 'satisfied' | 'missing' | 'changeable' | 'unsupported'
const KINDS: readonly {kind: Kind; key: string; name: string}[] = [
  {kind: 'capability', key: 'capabilities', name: 'capabilities'}, {kind: 'package', key: 'packages', name: 'packages'},
  {kind: 'configuration', key: 'configurations', name: 'configuration'}, {kind: 'service', key: 'services', name: 'services'}]
const MODE_OPTIONS = [{value: 'off', label: 'Off', does: 'The device only reads. Apply, Adopt and Recover are not offered.'},
  {value: 'propose', label: 'Propose', does: 'Apply, Adopt and Recover wait for your Confirm.'}, {value: 'write', label: 'Write', does: 'They run when you hold them, with a report.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Plan.'}, {value: 'open', label: 'On open', does: 'Read again when the device opens.'}] as const
const STATUS_TONE: Readonly<Record<Status, Tone | undefined>> = {satisfied: 'value', changeable: 'accent', missing: 'stall', unsupported: undefined}
const ACTS = {
  apply: {label: 'Apply', op: 'Make the changeable requirements so, through the connectors the plan names, then verify.'},
  adopt: {label: 'Adopt', op: 'Write what this machine holds into the role\'s declaration, under Control/machines. It never changes the machine.'},
  recover: {label: 'Recover', op: 'Synchronise your source, apply the plan, and verify, stage by stage. It stops at the first stage that fails.'},
} as const
type Act = keyof typeof ACTS

interface Entry {readonly kind: string; readonly id: string; readonly status: Status; readonly port?: string; readonly connector?: string; readonly reason?: string}
interface MPlan {readonly entries: readonly Entry[]; readonly summary?: Readonly<Record<Status, number>>}
interface Declared {readonly bindings: readonly {kind: string; reference: string}[]; readonly items: Readonly<Record<Kind, readonly string[]>>}
const recOf = (x: unknown): Record<string, unknown> | undefined => (rec(x) && !Array.isArray(x) ? x : undefined)
const ids = (x: unknown): string[] => (Array.isArray(x) ? x.flatMap(i => (typeof i === 'string' ? [i] : text(recOf(i)?.id) ? [recOf(i)!.id as string] : [])) : [])
const STATUSES: readonly string[] = ['satisfied', 'missing', 'changeable', 'unsupported']

function declaredOf(v: V): Declared | undefined {
  const d = recOf(json<unknown>(v, 'declared', undefined))
  if (!d) return undefined
  const items = Object.fromEntries(KINDS.map(k => [k.kind, ids(d[k.key])])) as Record<Kind, string[]>
  const bindings = Array.isArray(d.bindings) ? d.bindings.flatMap(b => { const r = recOf(b); return r && text(r.kind) && text(r.reference) ? [{kind: r.kind as string, reference: r.reference as string}] : [] }) : []
  return {bindings, items}
}
function observedOf(v: V): Record<Kind, string[]> | undefined {
  const o = recOf(json<unknown>(v, 'observed', undefined))
  return o ? Object.fromEntries(KINDS.map(k => [k.kind, ids(o[k.key])])) as Record<Kind, string[]> : undefined
}
function mplanOf(v: V): MPlan | undefined {
  const p = recOf(json<unknown>(v, 'plan', undefined))
  if (!p) return undefined
  const entries = (Array.isArray(p.entries) ? p.entries : []).flatMap((e): Entry[] => {
    const r = recOf(e)
    return r && text(r.kind) && text(r.id) && typeof r.status === 'string' && STATUSES.includes(r.status)
      ? [{kind: r.kind as string, id: r.id as string, status: r.status as Status, port: text(r.port), connector: text(r.connector), reason: text(r.reason)}] : []
  })
  const s = recOf(p.summary)
  const summary = s && STATUSES.every(k => typeof s[k] === 'number') ? s as Record<Status, number> : undefined
  return {entries, summary}
}
const objOf = (v: V, key: string) => recOf(json<unknown>(v, key, undefined))
const modeOf = (v: V): Mode | undefined => { const m = strOf(v, 'mode'); return m === 'off' || m === 'propose' || m === 'write' ? m : undefined }
const kindOfEntry = (k: string): Kind | undefined => KINDS.find(x => x.kind === k || x.key === k)?.kind
const statusOf = (plan: MPlan | undefined, kind: Kind, id: string): Status | undefined => plan?.entries.find(e => kindOfEntry(e.kind) === kind && e.id === id)?.status
/** How far the machine is from its declaration: the requirements not satisfied. */
const toChange = (plan: MPlan | undefined) => (plan ? (plan.summary ? plan.summary.changeable + plan.summary.missing + plan.summary.unsupported : plan.entries.filter(e => e.status !== 'satisfied').length) : undefined)
const verdict = (v: V) => { const n = toChange(mplanOf(v)); return n === undefined ? NONE : n === 0 ? 'satisfied' : `${n} differ` }
const verifiedWord = (v: V) => { const x = objOf(v, 'verified'); return x ? (x.satisfied === true ? 'Satisfied' : 'Differs') : undefined }

/** Whether an act can run now, and if not, why. The host's standing for its key comes last. */
function actState(p: ViewProps, act: Act): {ok: boolean; why?: string} {
  const mode = modeOf(p.v)
  if (mode === undefined) return {ok: false, why: 'Change has no reading.'}
  if (mode === 'off') return {ok: false, why: 'Change is Off. Set it to Propose or Write.'}
  if (!has(p.v, 'role')) return {ok: false, why: 'No role is chosen.'}
  if (act === 'apply') { const plan = mplanOf(p.v); if (plan && !plan.entries.some(e => e.status === 'changeable')) return {ok: false, why: 'Nothing in the plan is changeable.'} }
  const held = st(p, act).disabled
  return held ? {ok: false, why: held} : {ok: true}
}
/** Under Propose an act waits for your Confirm; under Write it runs. */
const pressAct = (p: ViewProps, act: Act) => (modeOf(p.v) === 'propose' ? p.set('ask', act) : p.set(act, strOf(p.v, 'role') ?? true))

/** The ledger: a lane for each kind, named and counted; the declaration left of the spine in the plan's verdict (teal satisfied, amber
 * changeable, orange missing, crossed unsupported), what the machine holds right of it. */
function Ledger({p, w, h, small}: {p: ViewProps; w: number; h: number; small?: boolean}) {
  const v = p.v, declared = declaredOf(v), observed = observedOf(v), plan = mplanOf(v)
  const cx = w / 2, top = small ? 12 : 30, laneH = small ? (h - 18) / 4 : 26, pitch = small ? 3 : 4, half = cx - (small ? 8 : 52)
  const role = strOf(v, 'role'), bind = declared?.bindings.find(b => b.kind === 'workcell')?.reference
  return <g>
    {!small && <>
      <text x={7} y={12} className="dp-axis">declared · {role ?? NONE}</text>
      <text x={w - 7} y={12} className="dp-axis" textAnchor="end">observed</text>
      {bind && <text x={7} y={22} className="dp-ink-dim">{bind}</text>}
    </>}
    <path d={`M${cx} ${top - 6}V${top + laneH * 4 - 6}`} stroke="var(--text-dim)" strokeWidth={1} />
    {KINDS.map((k, i) => {
      const y = top + i * laneH + laneH / 2 - 6
      const mine = declared?.items[k.kind] ?? [], seen = observed?.[k.kind] ?? []
      const room = Math.floor(half / pitch)
      return <g key={k.kind}>
        {!small && <text x={7} y={y + 3} className="dp-axis">{k.name}</text>}
        {!small && <text x={7} y={y + 12} className="dp-ink-dim">{declared ? mine.length : NONE}</text>}
        {!small && <text x={w - 7} y={y + 3} className="dp-axis" textAnchor="end">{observed ? seen.length : NONE}</text>}
        {mine.slice(0, room).map((id, j) => {
          const s = statusOf(plan, k.kind, id), x = cx - 4 - j * pitch, t = s ? STATUS_TONE[s] : undefined
          return s === 'unsupported'
            ? <path key={id} d={`M${x - 1.5} ${y - 3}l3 6M${x + 1.5} ${y - 3}l-3 6`} stroke="var(--text-faint)" strokeWidth={1}><title>{`${id} · unsupported`}</title></path>
            : <path key={id} d={`M${x} ${y - 4}V${y + 4}`} strokeWidth={small ? 1.4 : 2} stroke={t === 'value' ? 'var(--dp-value)' : t === 'accent' ? 'var(--dp-on)' : t === 'stall' ? 'var(--stall)' : 'var(--text-dim)'}><title>{`${id} · ${s ?? 'not planned'}`}</title></path>
        })}
        {seen.slice(0, Math.floor((w - (small ? 6 : 26) - cx) / pitch)).map((id, j) => {
          const x = cx + 4 + j * pitch, wanted = mine.includes(id)
          return <path key={id} d={`M${x} ${y - 4}V${y + 4}`} strokeWidth={small ? 1.2 : 1.5} stroke={wanted ? 'var(--dp-value)' : 'var(--text-faint)'}><title>{id}</title></path>
        })}
        {declared && mine.length === 0 && !small && <text x={cx - 6} y={y + 3} className="dp-axis" textAnchor="end">none</text>}
      </g>
    })}
    {!declared && <text x={cx - 6} y={top + laneH * 4 + (small ? -2 : 4)} className="dp-axis" textAnchor="end">no declaration</text>}
    {!observed && <text x={cx + 6} y={top + laneH * 4 + (small ? -2 : 4)} className="dp-axis">not observed</text>}
  </g>
}

/** The stages of a road, left to right: a node for each, filled where it ran well, amber where it ran in part, crossed where it failed,
 * hollow where it has not run, dashed where nothing is configured. Under each, its result. */
type Stage = {name: string; state: 'ok' | 'part' | 'failed' | 'idle' | 'none'; result: string; unread?: boolean}
function Stages({w, stages}: {w: number; stages: readonly Stage[]}) {
  const n = stages.length, x0 = 30, x1 = w - 30, y = 52
  const at = (i: number) => (n === 1 ? w / 2 : x0 + i * (x1 - x0) / (n - 1))
  return <g>
    {stages.slice(1).map((_, i) => <path key={i} d={`M${at(i) + 8} ${y}H${at(i + 1) - 8}`} className={stages[i]!.state === 'ok' ? 'dp-curve' : 'dp-faint'} />)}
    {stages.map((s, i) => {
      const x = at(i)
      return <g key={s.name}>
        {s.state === 'failed'
          ? <><circle cx={x} cy={y} r={6} fill="none" stroke="var(--stall)" strokeWidth={1.5} /><path d={`M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6`} stroke="var(--stall)" strokeWidth={1.5} /></>
          : <circle cx={x} cy={y} r={6} fill={s.state === 'ok' ? 'var(--dp-value)' : s.state === 'part' ? 'var(--dp-on)' : 'none'}
            stroke={s.state === 'idle' || s.state === 'none' ? 'var(--text-faint)' : 'none'} strokeDasharray={s.state === 'none' ? '2 2' : undefined} />}
        <text x={x} y={y - 12} className="dp-ink" textAnchor="middle">{s.name}</text>
        {s.result.split('\n').map((line, k) => <text key={k} x={x} y={y + 20 + k * 10} className="dp-axis" textAnchor="middle">{line}</text>)}
      </g>
    })}
  </g>
}
const numIn = (o: Record<string, unknown> | undefined, k: string) => (typeof o?.[k] === 'number' ? o[k] as number : undefined)
function reconcileStages(v: V): Stage[] {
  const plan = mplanOf(v), applied = objOf(v, 'applied'), verified = objOf(v, 'verified'), n = toChange(plan)
  const outcome = text(applied?.outcome), ops = Array.isArray(applied?.operations) ? applied!.operations.length : undefined
  return [
    {name: 'plan', state: plan ? (n ? 'part' : 'ok') : 'idle', result: plan ? (n ? `${n} differ` : 'satisfied') : 'not read', ...(plan ? {} : {unread: true})},
    {name: 'apply', state: outcome === 'complete' ? 'ok' : outcome === 'partial' ? 'part' : outcome ? 'failed' : 'idle', result: outcome ? `${outcome}\n${ops ?? NONE} change${ops === 1 ? '' : 's'}` : 'not run'},
    {name: 'verify', state: verified?.satisfied === true ? 'ok' : verified?.satisfied === false ? 'failed' : 'idle', result: verified ? (verified.satisfied === true ? 'satisfied' : 'differs') : 'not run'},
  ]
}
const ORDER_OF_STAGES = ['synchronization', 'machine_apply', 'verification']
function recoverStages(v: V): Stage[] {
  const plan = objOf(v, 'recovery'), done = objOf(v, 'recovered'), sync = text(plan?.synchronization), failedAt = text(done?.stage)
  const stopped = (stage: string) => failedAt === stage
  const ranPast = (stage: string) => done !== undefined && !stopped(stage) && (failedAt === undefined || ORDER_OF_STAGES.indexOf(failedAt) > ORDER_OF_STAGES.indexOf(stage))
  const applied = text(done?.applied), ops = numIn(done, 'operations'), changes = numIn(plan, 'changes')
  return [
    {name: 'plan', state: plan ? 'ok' : 'idle', result: plan ? `${changes ?? NONE} to change` : 'not read', ...(plan ? {} : {unread: true})},
    {name: 'sync', state: sync === 'not_configured' ? 'none' : stopped('synchronization') ? 'failed' : ranPast('synchronization') ? 'ok' : sync === 'unavailable' ? 'failed' : 'idle',
      result: stopped('synchronization') ? 'failed' : ranPast('synchronization') && sync !== 'not_configured' ? (done?.synchronized === true ? 'changed' : 'unchanged') : sync ? sync.replace('_', ' ') : NONE},
    {name: 'apply', state: stopped('machine_apply') ? 'failed' : applied === 'complete' ? 'ok' : applied === 'partial' ? 'part' : 'idle', result: stopped('machine_apply') ? `${applied ?? 'failed'}` : applied ? `${applied}\n${ops ?? NONE} change${ops === 1 ? '' : 's'}` : 'not run'},
    {name: 'verify', state: stopped('verification') ? 'failed' : done?.satisfied === true ? 'ok' : 'idle', result: stopped('verification') ? 'differs' : done?.satisfied === true ? 'satisfied' : 'not run'},
  ]
}

const roleChooser = (p: ViewProps) => {
  const roles = (json<unknown[]>(p.v, 'roles', []) ?? []).flatMap(r => { const o = recOf(r); return o && text(o.role) ? [{value: o.role as string, label: o.role as string, does: text(o.path)}] : [] })
  return <Chooser {...st(p, 'role')} label="Role" wide does="The declaration the machine is read against: a role under Control/machines." value={strOf(p.v, 'role') ?? ''} options={roles} onChange={x => p.set('role', x)} />
}
const modeRadio = (p: ViewProps) => <Radio {...st(p, 'mode')} label="Change" does="Off: only read. Propose: Apply, Adopt and Recover wait for your Confirm. Write: they run when you hold them, with a report." value={modeOf(p.v) ?? ''} options={MODE_OPTIONS} onChange={x => p.set('mode', x)} />

/** An act with its ask: the act itself, or, while it waits under Propose, Confirm and Cancel. */
function ActButton({p, act}: {p: ViewProps; act: Act}) {
  const can = actState(p, act), stand = st(p, act), t = ACTS[act]
  if (strOf(p.v, 'ask') === act) return <div className="wc-ask">
    <Action {...stand} hold label="Confirm" does={`${t.label}: ${t.op}`} onPress={() => { p.set(act, strOf(p.v, 'role') ?? true); p.set('ask', undefined) }} disabled={can.ok ? undefined : can.why} />
    <Action label="Cancel" does="Leave the machine as it is." onPress={() => p.set('ask', undefined)} />
  </div>
  return <Action {...stand} hold={modeOf(p.v) === 'write'} label={t.label} does={t.op} onPress={() => pressAct(p, act)} disabled={can.ok ? undefined : can.why} />
}

function entryRows(v: V, all: boolean): RowItem[] {
  const plan = mplanOf(v)
  if (!plan) return unreadRows('No reading of the plan.')
  const shownRows = plan.entries.filter(e => all || e.status !== 'satisfied')
  if (!shownRows.length) return [{id: 'none', name: plan.entries.length ? 'Every requirement is satisfied' : 'The declaration asks for nothing', light: 'lit', tone: 'green'}]
  return shownRows.map((e): RowItem => ({id: `${e.kind}:${e.id}`, name: e.id, light: e.status === 'unsupported' ? 'dark' : 'lit', tone: STATUS_TONE[e.status] ?? 'value',
    note: `${kindOfEntry(e.kind) ?? e.kind} · ${e.status}`, why: e.status === 'missing' || e.status === 'unsupported' ? e.reason ?? 'Central gave no reason.' : undefined,
    does: e.status === 'changeable' ? `Apply makes it so through ${e.connector ?? 'its connector'}${e.port ? ` (${e.port})` : ''}.` : `${e.kind} ${e.id}: ${e.status}.`}))
}

/** The Machine page: the offers of the place the session runs with the run's plan over them (the Remote carrier's values, `carrier.`) beside
 * the declaration and what the machine holds (Central's values, `mc.`); the four kinds side by side, each what you declared with its verdict
 * and the connector that would change it, and what else the machine holds; under them the last apply, the last verification and the last
 * recovery; then Reconcile and Recover as stages. At the head Role, Refresh and Plan again; Change, Plan, Apply, Verify and Adopt; Recover. */
function MachinePage({p, pane}: {p: ViewProps; pane: Pane}) {
  const c = carrierOf(p), m = machineOf(p), v = m.v, runs = runsOf(c.v)
  const declared = declaredOf(v), observed = observedOf(v), plan = mplanOf(v), applied = objOf(v, 'applied'), done = objOf(v, 'recovered'), rp = objOf(v, 'recovery')
  return <FullPage pane={pane} label="Machine" controls={<>
    {roleChooser(m)}
    <Chooser {...st(m, 'refresh')} label="Refresh" wide does="When the page reads again." value={strOf(v, 'refresh') ?? ''} options={REFRESH} onChange={x => m.set('refresh', x)} />
    {runs && runChooser(c, runs)}
    <Action {...st(c, 'replan')} label="Plan again" does="Lay the run's needs on the machine's offers again." onPress={() => c.set('replan', true)} />
    {modeRadio(m)}
    <Action {...st(m, 'replan')} label="Plan" does="Compare the declaration with the machine again. It changes nothing." onPress={() => m.set('replan', strOf(v, 'role') ?? true)} />
    <ActButton p={m} act="apply" />
    <Action {...st(m, 'verify')} label="Verify" does="Observe the machine and check it against the declaration." onPress={() => m.set('verify', strOf(v, 'role') ?? true)} />
    <ActButton p={m} act="adopt" />
    <ActButton p={m} act="recover" />
  </>}>
    <div className="wc-pics">
      <OffersDisplay v={c.v} w={352} h={146} />
      <Display w={352} h={146} label="Declared" does="A lane for each kind, named and counted. Declared on the left of the spine, observed on the right. Teal satisfied, amber changeable, orange missing, crossed unsupported."
        corner={verdict(v)}>
        <Ledger p={m} w={352} h={146} />
      </Display>
    </div>
    <div className="mc-pane">
      <div className="mc-cols">
        {KINDS.map(k => {
          const mine = declared?.items[k.kind], seen = observed?.[k.kind], extra = seen?.filter(id => !mine?.includes(id)) ?? []
          return <section key={k.kind} className="mc-col">
            <h4>{k.name}<b>{mine ? mine.length : NONE} declared · {seen ? seen.length : NONE} observed</b></h4>
            {!declared ? <p className="mc-none">No reading of the declaration.</p> : mine!.length === 0 ? <p className="mc-none">None declared.</p>
              : <ul className="mc-list">{mine!.map(id => { const s = statusOf(plan, k.kind, id); const e = plan?.entries.find(x => kindOfEntry(x.kind) === k.kind && x.id === id)
                return <li key={id} data-status={s}><i /><b>{id}</b><span>{s ?? 'not planned'}{e?.connector ? ` · ${e.connector}` : ''}</span>{e?.reason && <em>{e.reason}</em>}</li> })}</ul>}
            {extra.length > 0 && <p className="mc-extra">Also on the machine: {extra.slice(0, 12).join(' · ')}{extra.length > 12 ? ` · +${extra.length - 12}` : ''}</p>}
          </section>
        })}
      </div>
      <div className="mc-foot">
        <span>Last apply <b>{text(applied?.outcome) ?? NONE}</b>{Array.isArray(applied?.operations) ? ` · ${applied!.operations.length} change${applied!.operations.length === 1 ? '' : 's'}` : ''}</span>
        <span>Verified <b>{verifiedWord(v) ?? NONE}</b></span>
        <span>Last recovery <b>{text(done?.outcome) ?? NONE}</b>{text(done?.message) ? ` · ${text(done?.message)}` : ''}</span>
      </div>
    </div>
    <div className="wc-pane-side wc-stages">
      <section><h4>Reconcile</h4>
        <Display w={340} h={96} label="Reconcile" does="Plan, apply, verify: each stage with its result."><Stages w={340} stages={reconcileStages(v)} /></Display>
        <Rows does="What the plan would change, and why the rest cannot be changed here." items={entryRows(v, false)} size={6} />
      </section>
      <section><h4>Recover</h4>
        <Display w={340} h={96} label="Recover" does="Plan, synchronise, apply, verify: each stage of the way back with its result."><Stages w={340} stages={recoverStages(v)} /></Display>
        <Readout label="synchronise" does="How your source synchronises before the machine is applied: not configured, satisfied, changeable or unavailable." value={text(rp?.synchronization)?.replace('_', ' ')} />
      </section>
    </div>
  </FullPage>
}
const carrierOf = (p: ViewProps) => scoped(p, 'carrier.')
const machineOf = (p: ViewProps) => scoped(p, 'mc.')

// ------------------------------------------------------------------------------------------------ the tile's gateways (`gw.` keys)

type GwState = 'ready' | 'composed' | 'refused'
interface Gateway {readonly id: string; readonly name: string; readonly transport?: string; readonly state?: GwState; readonly why?: string; readonly workcells?: readonly string[]}
const gatewaysOf = (v: V) => listOf<Gateway>(v, 'chains', r => (text(r.id) && text(r.name) ? {id: r.id as string, name: r.name as string, transport: text(r.transport), why: text(r.why),
  state: r.state === 'ready' || r.state === 'composed' || r.state === 'refused' ? r.state : undefined,
  workcells: Array.isArray(r.workcells) ? r.workcells.filter((w): w is string => typeof w === 'string') : undefined} : undefined))
const SHOWS: readonly Option<string>[] = [{value: 'all', label: 'All', does: 'List every gateway.'}, {value: 'ready', label: 'Ready', does: 'List only the gateways that answered a read.'},
  {value: 'inuse', label: 'In use', does: 'List only the gateways a workcell uses.'}]
const gwLamp = (s: GwState | undefined): {light: LightState; tone: Tone} =>
  s === 'ready' ? {light: 'lit', tone: 'green'} : s === 'composed' ? {light: 'lit', tone: 'accent'} : s === 'refused' ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}
const GW_WORD: Record<GwState, string> = {ready: 'Ready', composed: 'Composed', refused: 'Refused'}

/** Every gateway the machines reach, one line each with its state dot; Show filters them; a line pressed opens that gateway's Frames page. */
function TileGateways({p}: {p: ViewProps}) {
  const g = scoped(p, 'gw.'), all = gatewaysOf(g.v), show = strOf(g.v, 'show')
  const listed = (all ?? []).filter(x => (show === 'ready' ? x.state === 'ready' : show === 'inuse' ? (x.workcells?.length ?? 0) > 0 : true))
  return <div className="wc-gws">
    <div className="wc-gws-head"><span className="dp-label">Gateways{listed.length > 2 ? <span className="wc-gws-more"> +{listed.length - 2}</span> : null}</span>
      <span className="wc-gws-show" role="radiogroup" aria-label="Show">{SHOWS.map(o => <button key={o.value} type="button" role="radio" aria-checked={o.value === show}
        data-i={`${o.label}|${o.does}`} disabled={!!st(g, 'show').disabled} onClick={() => g.set('show', o.value)}>{o.label}</button>)}</span></div>
    {all === undefined ? <p className="wc-gws-none">No reading of the gateways.</p> : listed.length === 0 ? <p className="wc-gws-none">No gateway to show.</p>
      : <ul className="wc-gws-list">{listed.slice(0, 2).map(x => { const lamp = gwLamp(x.state)
        return <li key={x.id}><button type="button" data-state={x.state} onClick={() => { g.set('chain', x.id); p.nav.full?.() }}
          data-i={`${x.name}|${x.state ? GW_WORD[x.state] : 'No reading of this gateway yet.'}${x.state === 'refused' ? ` ${x.why ?? 'The owner gave no reason.'}` : ''} Press to open its Frames page.`}>
          <Lamp state={lamp.light} tone={lamp.tone} /><b>{x.name}</b><span>{x.state === 'refused' ? x.why ?? GW_WORD.refused : x.transport ?? (x.state ? GW_WORD[x.state] : NONE)}</span>
        </button></li> })}</ul>}
  </div>
}

// ------------------------------------------------------------------------------------------------ the device

const SAMPLE_WORLD = {
  ref: 'world:demand:factory-attempt-dlw-build-0142', demand: 'demand:factory-attempt-dlw-build-0142', persistence: 'task-or-run', retention: 'preserve', state: 'degraded',
  bindings: [
    {ref: 'workspace:checkout', port: 'workspace', provider: 'provider:collapsed-local-git-worktree', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'affordance:shell', port: 'execution', provider: 'provider:collapsed-local-host-process', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'runtime:preview', port: 'project-runtime', provider: 'provider:reference-project-runtime', necessity: 'preferred', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'connectivity:service:redis-now/personal-workcell', port: 'service', provider: 'provider:collapsed-local-target-services', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'connectivity:service:kev-decision/personal-workcell', port: 'service', provider: 'provider:collapsed-local-target-services', necessity: 'optional', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'connectivity:service:gliner25-decision/personal-workcell', port: 'service', provider: 'provider:collapsed-local-target-services', necessity: 'preferred', health: 'unavailable', presence: 'present', observed: 'unavailable'},
    {ref: 'output:artifacts', port: 'artifact-storage', provider: 'provider:collapsed-local-artifacts', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
  ],
}
const SANDBOX_WORLD = {...SAMPLE_WORLD, ref: 'world:demand:factory-attempt-ql-m-ledger-0031', demand: 'demand:factory-attempt-ql-m-ledger-0031', persistence: 'candidate', retention: 'snapshot-if-supported', state: 'degraded',
  bindings: [
    {ref: 'workspace:checkout', port: 'workspace', provider: 'provider:opensandbox', necessity: 'required', health: 'unknown', presence: 'stale'},
    {ref: 'affordance:shell', port: 'execution', provider: 'provider:opensandbox', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'connectivity:service:redis-now/personal-workcell', port: 'service', provider: 'provider:collapsed-local-target-services', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'output:artifacts', port: 'artifact-storage', provider: 'provider:opensandbox', necessity: 'required', health: 'healthy', presence: 'present', observed: 'healthy'},
    {ref: 'output:logs', port: 'storage', provider: 'provider:opensandbox', necessity: 'optional', health: 'unknown', presence: 'released'},
  ]}
/** The services this Mac declares (`workcell doctor --json`, 21 Oct). */
const SERVICES = [
  {ref: 'service:redis-now/personal-workcell', endpoint: 'redis://127.0.0.1:6381', health: 'healthy', availability: 'available', lifetime: 'target-owned'},
  {ref: 'service:kev-decision/personal-workcell', endpoint: 'http://127.0.0.1:8019', health: 'healthy', availability: 'available', lifetime: 'target-owned'},
  {ref: 'service:gliner25-decision/personal-workcell', endpoint: 'http://127.0.0.1:8020', health: 'unavailable', availability: 'degraded', lifetime: 'target-owned'},
  {ref: 'service:gliner25-ql-candidate/personal-workcell', endpoint: 'http://127.0.0.1:50929', health: 'unavailable', availability: 'degraded', lifetime: 'target-owned'},
]
/** The harness processes of this Mac (`workcell instances list --json`, 21 Oct), with their cost where `instances usage` measured it. */
const INSTANCES = [
  {ref: 'instance:claude-code:bbc22b5e', harness: 'claude-code', liveness: 'live', pids: [21205, 89376, 89380, 89579, 90721], cpu: 14.2, rss: 612e6},
  {ref: 'instance:claude-code:a7a018c8', harness: 'claude-code', liveness: 'live', pids: [58053, 87066], cpu: 3.1, rss: 388e6},
  {ref: 'instance:pi:30fe43c7', harness: 'pi', liveness: 'live', pids: [39529, 42122], cpu: 0.4, rss: 141e6},
  {ref: 'instance:prime:8ce5396c', harness: 'prime', liveness: 'live', pids: [29765, 89778, 89811], cpu: 1.2, rss: 203e6},
  {ref: 'instance:ollama:62fa3396', harness: 'ollama', liveness: 'live', pids: [30741], cpu: 0, rss: 15.6e6},
  {ref: 'instance:opencode:67801699', harness: 'opencode', liveness: 'live', pids: [6858]},
  {ref: 'instance:codex:bbcd0bfa', harness: 'codex', liveness: 'stale', pids: [14317, 71992, 75978, 82877, 85019]},
]
const READ_AT = 1792547400000

/** What runs left on this Mac on 21 Oct, in the shapes of centralHygieneModel: two prepared worlds and a sandbox server's five sandboxes. */
const SANDBOX_SERVER = 'http://127.0.0.1:8090'
const LEFT_SOURCES = [{boundaryOp: 'op material_read (2 world receipts)'}, {boundaryOp: `workcell sandboxes reconcile --server ${SANDBOX_SERVER}`}]
const LEFT_DEFAULTS = {
  readAge: 12,
  worlds: JSON.stringify([
    {ref: 'world:demand:factory-attempt-dlw-build-0142', state: 'degraded', bindings: [{ref: 'workspace:checkout', presence: 'present'}, {ref: 'affordance:shell', presence: 'present'},
      {ref: 'connectivity:service:gliner25-decision/personal-workcell', presence: 'present'}, {ref: 'output:artifacts', presence: 'present'}]},
    {ref: 'world:demand:factory-attempt-ql-m-ledger-0031', state: 'degraded', bindings: [{ref: 'workspace:checkout', presence: 'stale'}, {ref: 'affordance:shell', presence: 'present'},
      {ref: 'output:artifacts', presence: 'present'}, {ref: 'output:logs', presence: 'released'}]}]),
  sandboxes: JSON.stringify({server: SANDBOX_SERVER, sandboxes: [{id: 'sbx-7f2a', state: 'Running', lease: 'live'}, {id: 'sbx-81c0', state: 'Running', lease: 'live'},
    {id: 'sbx-90d4', state: 'Paused', lease: 'live'}, {id: 'sbx-3b17', state: 'Running', lease: 'expired-orphan'}, {id: 'sbx-c55e', state: 'Running', lease: 'unknown'}]}),
  findings: JSON.stringify([
    {kind: 'binding-drift', subject: 'world:demand:factory-attempt-ql-m-ledger-0031#workspace:checkout', standing: 'The checkout is stale; the receipt can bring it back.', boundaryOps: ['op material_read (2 world receipts)'], tenderId: 'reconcile-binding'},
    {kind: 'binding-lost', subject: 'world:demand:factory-attempt-ql-m-ledger-0031#output:logs', standing: 'The logs lasted only for their task.', boundaryOps: ['op material_read (2 world receipts)'], tenderId: null},
    {kind: 'sandbox-orphan', subject: 'sbx-3b17', standing: 'Its lease ended at 18:00 on 20 Oct.', boundaryOps: [`workcell sandboxes reconcile --server ${SANDBOX_SERVER}`], tenderId: 'release-orphans'},
    {kind: 'sandbox-unproven', subject: 'sbx-c55e', standing: 'The server reports no lease for it.', boundaryOps: [`workcell sandboxes reconcile --server ${SANDBOX_SERVER}`], tenderId: null}]),
  sources: JSON.stringify(LEFT_SOURCES),
}
/** The gateways the actuation family registers, with their standing as AIKit words it and the workcells whose chain each heads. */
const GATEWAYS = [
  {id: 'hermes', name: 'Hermes gateway', transport: 'network', state: 'ready', workcells: ['env-1', 'env-2']},
  {id: 'aikit-agency-gateway', name: 'AIKit agency gateway', transport: 'this machine', state: 'ready', workcells: ['env-3']},
  {id: 'actuation-frank', name: 'Actuation gateway', transport: 'private network', state: 'composed', workcells: []},
  {id: 'remote-carrier', name: 'Remote carrier', state: 'refused', why: 'Refused by default: terminate TLS in front first.', workcells: []},
]

const dump = (x: unknown) => JSON.stringify(x)
/** The Seats page's checkouts, in the shapes of centralHygieneModel: the seats, worktrees and branches of O-I as they stood on 15 Oct.
 * The findings are the model's own classification of the census, as the shell would hand it over. */
function checkoutSample(opts: {merged?: boolean; foreign?: boolean} = {}) {
  const root = '/Users/admin/Central', cell = (env: string) => `${root}/worktrees/${env}`, at = '2026-10-15T09:12:00.000Z'
  const LEAD = 'claude-code:dlw-lead', CONDUCTOR = 'claude-code:dlw-conductor'
  const pose = (a: string, b: string, c: string, d: string) => `register pose ('${a}', '${b}') != live ('${c}', '${d}')`
  const floor = (gb: string) => ({admissionNote: `floor breach recorded: ${gb} GB free < soft 20 GB`})
  const seat = (env: string, product: string, head: string, more: Partial<SeatReading> = {}): SeatReading => ({
    workcell: env, workcellPath: cell(env), product, state: 'free', branch: null, head, claimedBy: null, dirty: null, untracked: null, ahead: null, behind: null,
    drift: null, admissionNote: null, ...more,
  })
  const lane = (branch: string, by: string, ahead: number, more: Partial<SeatReading> = {}): Partial<SeatReading> => ({state: 'claimed', branch, claimedBy: by, dirty: 0, untracked: 0, ahead, ...more})
  const foreign = (s: SeatReading): SeatReading => (opts.foreign && s.workcell === 'env-3' && s.product === 'o-i' ? {...s, state: 'occupied-foreign-lane', branch: 'feat/central-field-base', head: '963383814'} : s)
  const seatRows: SeatReading[] = [
    seat('env-1', 'actuation', '933731e', lane('fold/day-close-20261012', CONDUCTOR, 3, {drift: pose('fold/day-close-20261012', '7b4af99', 'fold/day-close-20261012', '933731e')})),
    seat('env-1', 'central', '8aa1065', lane('fix/day-close-no-t-payloads', CONDUCTOR, opts.merged ? 0 : 1, {drift: pose('fold/day-close-20261012', 'cf58c54', 'fix/day-close-no-t-payloads', '8aa1065')})),
    seat('env-1', 'o-i', '9b6caea90', lane('dlw/build', LEAD, 197, {dirty: 30, untracked: 15, drift: pose('dlw/phase1-semantics-20261013', 'cc69e19fa', 'dlw/build', '9b6caea90')})),
    seat('env-2', 'actuation', 'cd1f4ce'), seat('env-2', 'central', '352bc31', floor('18.0')),
    seat('env-2', 'o-i', '2de90416e', lane('dlw/native-build', LEAD, 171, {untracked: 1, drift: pose('dlw/native-build', '2491a11b6', 'dlw/native-build', '2de90416e')})),
    seat('env-3', 'actuation', 'cd1f4ce', floor('15.3')), seat('env-3', 'central', 'cf58c54', floor('9.3')), seat('env-3', 'o-i', '65202d830'),
  ].map(foreign)
  const tree = (path: string, branch: string | null, head: string, more: Partial<WorktreeRow> = {}): WorktreeRow => ({path, head, branch, bare: false, detached: branch === null, ...more})
  const trees: WorktreeRow[] = [
    tree(`${root}/Work/O-I`, 'main', '1cc77db12', {main: true}),
    tree(`${cell('env-1')}/o-i`, 'dlw/build', '9b6caea90'),
    tree(`${cell('env-2')}/o-i`, 'dlw/native-build', '2de90416e'),
    opts.foreign ? tree(`${cell('env-3')}/o-i`, 'feat/central-field-base', '963383814') : tree(`${cell('env-3')}/o-i`, null, '65202d830'),
    ...(opts.foreign ? [tree('/private/tmp/o-i-lane', 'agent/o-i-20261007-1639', '7fbde446e')] : []),
  ]
  const names: readonly (readonly [string, string, boolean?])[] = [
    ['agent/o-i-20261007-0824', '9a7de2d82', true], ['agent/o-i-20261007-1639', '7fbde446e', false], ['agent/o-i-20261008-1823', '1fb4986c6', false],
    ['dlw/build', '9b6caea90'], ['dlw/native-build', '2de90416e'], ['feat/281-played-instrument-in-app', '78cb79abc', true], ['feat/central-field-base', '963383814', false],
    ['feat/personal-history-user-20261006', '54373ab54', true], ['fold/day-close-20261012', '938cb12a4'], ['main', '1cc77db12'], ['recover/tarot-score-312-20261007', '5fbbe477e'],
  ]
  const held = new Map<string, string>(trees.filter(t => t.branch).map((t): [string, string] => [t.branch!, t.path]))
  const branches = names.map(([name, head, merged]) => ({name, head, checkedOutAt: held.get(name) ?? null, ...(merged === undefined ? {} : {merged})}))
  const sources: BoundaryOpSource[] = [{boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at}, {boundaryOp: 'op git_repository_read (project O-I)', channel: 'kernel-op', at},
    {boundaryOp: 'seat status (Control/user/workcell/seat)', channel: 'machine-instrument', at},
    {boundaryOp: 'git worktree list --porcelain', channel: 'machine-instrument', at},
    {boundaryOp: 'git for-each-ref refs/heads', channel: 'machine-instrument', at}]
  const census = assembleCensus({sources, seats: seatRows, worktrees: trees, branches, machineRef: 'workcell:mac'})
  const findings = hygieneFindings(census, registeredSeatPaths(census))
  return {seats: dump(seatRows), worktrees: dump(trees), branches: dump(branches), sources: dump(sources), findings: dump(findings)}
}
const CHECKOUT_DEFAULTS = {
  machine: 'this', machineRef: 'workcell:mac', faults: true, readAge: 12,
  machines: dump([{id: 'this', label: 'This machine', ref: 'workcell:mac'}, {id: 'omarchy', label: 'omarchy', ref: 'workcell:omarchy', does: 'The linked machine workcell:omarchy.'}]),
  disk: dump([{workcell: 'env-1', freeGb: 44.6}, {workcell: 'env-2', freeGb: 44.6}, {workcell: 'env-3', freeGb: 18.2}]),
  ...checkoutSample(),
}

/** What this Mac reported (machine.account, machine.plan, 21 Oct), with a workstation role declared beside it. */
const OBSERVED_CAPS = ['MachineInspector', 'claude-code@source:actuation-harness-capability', 'claude-code@source:workcell-harness-instance', 'codex@source:actuation-harness-capability',
  'cursor-cli@source:actuation-harness-detection', 'gemini@source:actuation-harness-capability', 'hermes-acp@source:actuation-harness-detection', 'hermes@source:actuation-harness-detection',
  'ollama@source:workcell-harness-instance', 'openclaw@source:actuation-harness-capability', 'opencode@source:workcell-harness-instance', 'pi@source:actuation-harness-capability',
  'pi@source:workcell-harness-instance', 'prime@source:workcell-harness-instance', 'zcode@source:actuation-harness-capability']
const WORKSTATION = {
  bindings: [{kind: 'workcell', reference: 'workcell:mac'}],
  capabilities: ['claude-code@source:actuation-harness-capability', 'codex@source:actuation-harness-capability', 'pi@source:actuation-harness-capability', 'hermes@source:actuation-harness-capability'],
  packages: [{id: 'git', state: 'present'}, {id: 'node', state: 'present'}, {id: 'rustup', state: 'present'}, {id: 'redis', state: 'present'}, {id: 'tailscale', state: 'present'}],
  configurations: [{id: 'git-config', state: 'present'}, {id: 'zshrc', state: 'present'}],
  services: [{id: 'redis-now', running: true, enabled: true}, {id: 'tailscaled', running: true}],
}
const WORKSTATION_PLAN = {
  entries: [
    {kind: 'capability', id: 'claude-code@source:actuation-harness-capability', status: 'satisfied'}, {kind: 'capability', id: 'codex@source:actuation-harness-capability', status: 'satisfied'},
    {kind: 'capability', id: 'pi@source:actuation-harness-capability', status: 'satisfied'},
    {kind: 'capability', id: 'hermes@source:actuation-harness-capability', status: 'unsupported', reason: 'No eligible Connector declares a compatible capability installer.'},
    {kind: 'package', id: 'git', status: 'satisfied'}, {kind: 'package', id: 'node', status: 'satisfied'},
    {kind: 'package', id: 'rustup', status: 'changeable', port: 'PackageManager', connector: 'homebrew'},
    {kind: 'package', id: 'redis', status: 'satisfied'}, {kind: 'package', id: 'tailscale', status: 'satisfied'},
    {kind: 'configuration', id: 'git-config', status: 'satisfied'},
    {kind: 'configuration', id: 'zshrc', status: 'changeable', port: 'ConfigurationSource', connector: 'personal.git-sync'},
    {kind: 'service', id: 'redis-now', status: 'satisfied'},
    {kind: 'service', id: 'tailscaled', status: 'missing', reason: 'The service is not observed, and no eligible Connector starts it.'},
  ],
  summary: {satisfied: 9, changeable: 2, missing: 1, unsupported: 1},
}
const MACHINE_DEFAULTS = {
  light: 'lit', role: 'workstation', mode: 'propose', refresh: 'open',
  roles: JSON.stringify([{role: 'current', path: 'Control/machines/current.json', requirements: 0}, {role: 'workstation', path: 'Control/machines/workstation.json', requirements: 13}]),
  host: JSON.stringify({hostname: 'unknown-host', platform: 'macos', architecture: 'aarch64', observedAt: 1792547554, stale: false, connector: 'read-models.harness-capability'}),
  declared: JSON.stringify(WORKSTATION),
  observed: JSON.stringify({capabilities: OBSERVED_CAPS, packages: ['git', 'node', 'redis', 'tailscale', 'ripgrep'], configurations: ['git-config'], services: ['redis-now']}),
  plan: JSON.stringify(WORKSTATION_PLAN),
  applied: JSON.stringify({outcome: 'partial', operations: [{kind: 'package', id: 'rustup', port: 'PackageManager', connector: 'homebrew', changed: true}]}),
  verified: JSON.stringify({satisfied: false}),
  recovery: JSON.stringify({synchronization: 'changeable', connector: 'personal.git-sync', changes: 4}),
}
const CARRIER_DEFAULTS = {offers: dump(OFFERS), plan: dump(PLAN)}
/** Every key the owners report or the shell holds: the "No reading" fixture drops all of them. */
const ALL = ['light', 'name', 'machine', 'chain', 'seats', 'working', 'frames', 'instances', 'run', 'world', 'lease',
  'checkpoints', 'readAt', 'services', 'surfaces', 'omitted', 'reconciled', 'openIn', 'needed', 'workcells', 'left.worlds', 'left.sandboxes', 'left.findings', 'left.sources',
  'left.readAge', 'gw.chains', 'gw.show', ...[['seat.', SEAT_DEFAULTS], ['co.', CHECKOUT_DEFAULTS], ['carrier.', CARRIER_DEFAULTS], ['mc.', MACHINE_DEFAULTS]]
    .flatMap(([prefix, values]) => Object.keys(values as object).map(k => `${prefix as string}${k}`))]

export const design = railAndPane({
  id: 'workcell:workcell',
  title: 'Workcell',
  kind: 'instrument',
  firstPage: 'chain',
  defaults: {
    light: 'lit', name: 'env-1', machine: 'workcell:mac',
    chain: JSON.stringify([
      {id: 'gateway', name: 'Gateway', light: 'lit', reading: 'Claude Code · local'},
      {id: 'carrier', name: 'Remote carrier', light: 'lit', reading: 'This machine'},
      {id: 'landing', name: 'Git / landing', light: 'lit', reading: 'dlw/build · 3 ahead'}]),
    seats: JSON.stringify([
      {product: 'o-i', state: 'claimed', lane: 'dlw/build', claimedBy: 'claude-code:dlw-lead', workers: ['claude-code:uiux-lane-kit'], dirty: 4, ahead: 3, behind: 0},
      {product: 'ai-kit', state: 'claimed', lane: 'reads-round-2', claimedBy: 'claude-code:dlw-lead', workers: [], dirty: 0, ahead: 1, behind: 2},
      {product: 'central', state: 'free', lane: null, claimedBy: null, workers: [], dirty: 0, ahead: 0, behind: 0},
      {product: 'workcell', state: 'free', lane: null, claimedBy: null, workers: [], dirty: 0, ahead: 0, behind: 0}]),
    working: JSON.stringify([
      {agent: 'dlw-lead', track: 'dlw/build', mode: 'Factory', instance: 'instance:claude-code:bbc22b5e'},
      {agent: 'uiux-lane-kit', track: 'UI/UX refinement', mode: 'Factory', instance: 'instance:claude-code:a7a018c8'},
      {agent: 'Nara', track: 'Practice', mode: 'Central'}]),
    instances: JSON.stringify(INSTANCES),
    workcells: JSON.stringify([{name: 'env-1', light: 'lit', lane: 'dlw/build', claimedBy: 'claude-code:dlw-lead'}, {name: 'env-2', light: 'lit', lane: 'dlw/uiux-kit-motion', claimedBy: 'claude-code:uiux-lane-kit'},
      {name: 'env-3', light: 'dark', lane: null}, {name: 'omarchy · env-1', light: 'lit', lane: 'ql/m-ledger', claimedBy: 'codex:m-ledger'}]),
    frames: JSON.stringify([
      {at: '14:02:01', dir: 'out', kind: 'prompt.submit', note: 'Type-check the three TypeScript roots'},
      {at: '14:02:02', dir: 'in', kind: 'message.delta', note: 'I will read the agent context first.'},
      {at: '14:02:09', dir: 'in', kind: 'tool.call', note: 'Bash · tsc --noEmit'},
      {at: '14:02:31', dir: 'in', kind: 'heartbeat', note: ''}]),
    run: 'dlw/build · Type-check the three roots',
    world: JSON.stringify(SAMPLE_WORLD),
    lease: JSON.stringify({from: READ_AT - 42 * 60e3, expiresAt: null, renewable: false}),
    checkpoints: '[]', readAt: READ_AT,
    services: JSON.stringify(SERVICES), needed: false, openIn: 'web',
    surfaces: JSON.stringify([{ref: 'exposure:preview', interaction: 'preview', endpoint: 'http://127.0.0.1:5208'}]),
    omitted: JSON.stringify([{requirement: 'exposure:inspector', necessity: 'optional', reason: 'no offer supports this material requirement'}]),
    'want:connectivity:service:gliner25-decision/personal-workcell': 'released',
    ...prefixed('left.', LEFT_DEFAULTS) as Record<string, string | number>,
    ...prefixed('seat.', SEAT_DEFAULTS) as Record<string, string>,
    ...prefixed('co.', CHECKOUT_DEFAULTS) as Record<string, string | number | boolean>,
    ...prefixed('carrier.', CARRIER_DEFAULTS) as Record<string, string>,
    ...prefixed('mc.', MACHINE_DEFAULTS) as Record<string, string>,
    ...prefixed('gw.', {chains: JSON.stringify(GATEWAYS), show: 'all'}) as Record<string, string>,
  },
  fixtures: {
    'Two lanes at work': {},
    'A sandboxed run': {run: 'ql/m-ledger · Publish the M3 ledger', world: JSON.stringify(SANDBOX_WORLD), machine: 'workcell:omarchy',
      lease: JSON.stringify({from: READ_AT - 5 * 3600e3, expiresAt: READ_AT + 50 * 60e3, renewable: true}),
      checkpoints: JSON.stringify([{ref: 'checkpoint:after-prepare', state: 'ready', reusable: true, at: READ_AT - 4.6 * 3600e3},
        {ref: 'checkpoint:after-ledger', state: 'ready', reusable: true, at: READ_AT - 1.5 * 3600e3}, {ref: 'checkpoint:now', state: 'creating', at: READ_AT - 2 * 60e3}]),
      surfaces: '[]', omitted: JSON.stringify([{requirement: 'exposure:preview', necessity: 'optional', reason: 'no offer supports this material requirement'}]),
      'want:connectivity:service:gliner25-decision/personal-workcell': undefined,
      reconciled: JSON.stringify([{ref: 'workspace:checkout', observed: 'stale', desired: 'present', action: 'recover'}, {ref: 'output:logs', observed: 'released', desired: 'released', action: null}])},
    'Remote, nobody here': {name: 'omarchy · env-1', machine: 'workcell:omarchy',
      chain: JSON.stringify([{id: 'gateway', name: 'Gateway', light: 'lit', reading: 'Claude Code · remote'}, {id: 'carrier', name: 'Remote carrier', light: 'lit', reading: 'Omarchy · 41 ms'},
        {id: 'landing', name: 'Git / landing', light: 'dark', reading: 'No lane'}]),
      seats: JSON.stringify([{product: 'o-i', state: 'free', lane: null}, {product: 'quaternal-logic', state: 'free', lane: null}]), working: '[]',
      run: undefined, world: 'null', lease: undefined, checkpoints: undefined, surfaces: undefined, omitted: undefined, 'want:connectivity:service:gliner25-decision/personal-workcell': undefined},
    // `workcell worlds` lists two worlds for this cell: the World page asks which one the pages read; none is assumed.
    'Two worlds for this cell': {worlds: JSON.stringify([{receipt: 'receipt:world-a', world: 'world:local:o-i:candidate'}, {receipt: 'receipt:world-b', world: 'world:local:o-i:dlw-build'}]),
      worldReceipt: 'receipt:world-a'},
    'Nothing left behind': prefixed('left.', {findings: '[]'}),
    'Sandbox server down': prefixed('left.', {sandboxes: undefined, sources: JSON.stringify([LEFT_SOURCES[0], {...LEFT_SOURCES[1], refusal: 'the sandbox server did not answer'}])}),
    // The seats of O-I: two lanes grown more than two hundred commits past main, the first beside a mound of uncommitted files; env-3 free.
    'A long lane': {'seat.product': 'o-i'},
    'After a merge': prefixed('co.', checkoutSample({merged: true})),
    'A foreign lane': prefixed('co.', checkoutSample({foreign: true})),
    'No machine read': prefixed('co.', {seats: undefined, worktrees: undefined, branches: undefined, findings: undefined, disk: undefined,
      sources: dump([{boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at: '2026-10-15T09:12:00.000Z'},
        {boundaryOp: 'git worktree list --porcelain', channel: 'machine-instrument', at: '2026-10-15T09:12:00.000Z', refusal: 'the git repository reading did not answer'}])}),
    // The run's needs on a connected machine that holds no NOW store: the run requires one, so the plan cannot be met.
    'A plan that cannot be met': {machine: 'workcell:omarchy', ...prefixed('carrier.', {offers: dump(OFFERS_OMARCHY), plan: dump(PLAN_UNMET)})},
    // `workcell worlds` names two runs for the chosen world (read 28 Oct: this cell's run ledger): the Machine page asks whose plan to read.
    'Two runs for this world': prefixed('carrier.', {runs: dump(['development-entry-build-20261008', 'development-entry-build-20261008-r2']), planRun: 'development-entry-build-20261008-r2'}),
    'This Mac, nothing declared': prefixed('mc.', {role: 'current',
      declared: JSON.stringify({bindings: [{kind: 'workcell', reference: 'workcell:mac'}], capabilities: [], packages: [], configurations: [], services: []}),
      observed: JSON.stringify({capabilities: OBSERVED_CAPS, packages: [], configurations: [], services: []}), plan: JSON.stringify({entries: [], summary: {satisfied: 0, missing: 0, changeable: 0, unsupported: 0}}),
      applied: undefined, verified: JSON.stringify({satisfied: true}), recovery: JSON.stringify({synchronization: 'not_configured', changes: 0})}),
    'Recovered in part': prefixed('mc.', {recovered: JSON.stringify({outcome: 'partial', stage: 'machine_apply', message: 'Recovery machine application did not complete: one operation failed.',
      synchronized: true, applied: 'partial', operations: 1})}),
    'No reading': {...Object.fromEntries(ALL.map(k => [k, undefined])), 'want:connectivity:service:gliner25-decision/personal-workcell': undefined},
  },

  full: p => <FullView p={p} />,

  widget: p => <WidgetView p={p} />,
})

/** The Full's tabs, one for each page: World is dark while a binding is missing or stale, Machine while the run's plan cannot be met. */
function PaneTabs({p}: {p: ViewProps}) {
  const page = pageOf(p), world = worldOf(p.v), plan = planOf(carrierOf(p).v)
  const lightOf = (id: PageId): LightState | undefined => (id === 'world' ? (world ? (faulty(world) ? 'dark' : 'lit') : undefined)
    : id === 'machine' ? (plan?.status ? (plan.status === 'unsatisfiable' ? 'dark' : 'lit') : undefined) : undefined)
  return <div className="ref-pane-tabs wc-tabs" role="tablist" aria-label="Pages">
    {PAGES.map(x => { const lit = lightOf(x.id)
      return <button key={x.id} type="button" role="tab" aria-selected={x.id === page} onClick={() => p.setPage(x.id)}>{lit && <Lamp state={lit} />}{x.label}</button> })}
  </div>
}

function FullView({p}: {p: ViewProps}) {
  const page = pageOf(p), pane: Pane = {title: strOf(p.v, 'name') ?? 'Workcell', tabs: <PaneTabs p={p} />}
  return page === 'world' ? <WorldPage p={p} pane={pane} /> : page === 'services' ? <ServicesPage p={p} pane={pane} /> : page === 'exposure' ? <ExposurePage p={p} pane={pane} />
    : page === 'release' ? <ReleasePage p={p} pane={pane} /> : page === 'left' ? <LeftPage p={leftOf(p)} pane={pane} /> : page === 'seats' ? <SeatsPage p={p} pane={pane} />
    : page === 'machine' ? <MachinePage p={p} pane={pane} /> : <ChainPage p={p} pane={pane} />
}

/** Under the road: the agents working here, the harness processes on the machine with their cost, and the gateway's latest frames. */
function HereSide({v, frames}: {v: V; frames?: boolean}) {
  const instances = instancesOf(v), latest = framesOf(v)
  return <div className={`wc-pane-side${frames ? ' wc-pane-side--3' : ''}`}>
    <section><h4>Working here</h4>
      {workingOf(v)?.length ? <ul className="wc-list">{workingOf(v)!.map(w => <li key={`${w.agent}:${w.track ?? ''}`}><b>{w.agent}</b> <span>{whereOf(w)}</span></li>)}</ul>
        : <p className="ref-doc-lead">{workingOf(v) ? 'Nobody works here now.' : 'No reading of who works here.'}</p>}
    </section>
    <section><h4>Harness processes</h4>
      {instances === undefined ? <p className="ref-doc-lead">No reading of the harness processes.</p>
        : <ul className="wc-list wc-procs">{[...instances].sort((a, b) => (a.liveness === 'live' ? 0 : 1) - (b.liveness === 'live' ? 0 : 1)).map(i => <li key={i.ref} data-stale={i.liveness !== 'live' ? 'true' : undefined}>
          <b>{i.harness}</b><span>{i.pids?.length ?? NONE} proc · {i.liveness ?? NONE}</span>
          <Meter value={i.cpu === undefined ? undefined : clampTo(0, 1, i.cpu / 100)} label={`${i.harness}: processor`} />
          <em>{i.cpu === undefined ? NONE : pctText(i.cpu)}</em><em>{i.rss === undefined ? NONE : mb(i.rss)}</em>
        </li>)}</ul>}
    </section>
    {frames && <section><h4>The gateway's latest frames</h4>
      {latest.length ? <ul className="wc-list wc-frames">{latest.map((f, i) => <li key={i}><span>{f.at}</span> <b data-dir={f.dir}>{f.dir === 'in' ? '←' : '→'} {f.kind}</b> <span>{f.note}</span></li>)}</ul>
        : <p className="ref-doc-lead">No reading of the frames.</p>}
    </section>}
  </div>
}

/** A fault a connection's owner reports, said plainly (manual §16.14; desktop/cradle/src/shared/Refusal.tsx): the owner's plain words,
 * or that it reports one; its words as they came stand behind Why when they are not plain. */
function Fault({fault}: {fault: string}) {
  const plain = plainReason(fault)
  return <>{plain ?? 'Its owner reports a fault.'}{plain === fault ? null : <details className="oi-refusal-detail"><summary>Why</summary>{fault}</details>}</>
}

/** The Chain page: the run's road, each connection with its reading and, in orange, the fault its owner reports; under it who works here,
 * the harness processes and the gateway's latest frames. Its head holds no setting: each connection is set on its device. */
function ChainPage({p, pane}: {p: ViewProps; pane: Pane}) {
  const chain = chainOf(p.v)
  return <FullPage pane={pane} label="Chain">
    {chain === undefined ? <p className="ref-doc-lead">No reading of the chain.</p> : <table className="wc-seats">
      <thead><tr><th>Connection</th><th>Reading</th><th>Fault</th></tr></thead>
      <tbody>{chain.map(d => <tr key={d.id} data-free={d.fault || lightIn(d.light) === 'lit' ? undefined : 'true'}>
        <td><b>{d.name}</b></td><td>{d.reading ?? NONE}</td><td data-fault={d.fault ? 'true' : undefined}>{d.fault ? <Fault fault={d.fault} /> : NONE}</td></tr>)}</tbody>
    </table>}
    <HereSide v={p.v} frames />
  </FullPage>
}

function WidgetView({p}: {p: ViewProps}) {
    const cells = cellsOf(p.v), here = strOf(p.v, 'name')
    const [chosen, setChosen] = useState(here ?? cells[0]?.name ?? '')
    const cell = cells.find(c => c.name === chosen)
    const working = chosen === here ? workingOf(p.v) ?? [] : []
    const claim = cell ? (cell.lane ? (cell.claimedBy ? cell.claimedBy.split(':').pop() : undefined) : 'free') : undefined
    return <Tile title="Workcells" light={light(p.v, p.owner)} span={2} onFull={p.nav.full}><div className="wc-tile">
      <div className="wc-chips" role="radiogroup" aria-label="Workcell">
        {cells.map(c => <button key={c.name} type="button" role="radio" aria-checked={c.name === chosen} className="wc-chip" data-light={lightIn(c.light)}
          data-i={`${c.name}|${c.lane ? `Lane ${c.lane}.` : 'No lane.'} Click to show it.`} onClick={() => setChosen(c.name)}>{c.name}</button>)}
      </div>
      <div className="wc-tile-body">
        <p className="wc-tile-lane" data-i="Lane|The lane the chosen workcell's seat holds, and who claims it."><b>{cell ? (cell.lane ?? 'free') : NONE}</b>{cell?.lane ? ` · ${claim ?? NONE}` : ''}</p>
        {working.length > 0 && <p className="wc-tile-who">{working.slice(0, 3).map(w => <button key={`${w.agent}:${w.track ?? ''}`} type="button" className="wc-face"
          data-i={`${w.agent}|Working here: ${whereOf(w)}.${w.track ? ' Click to select its track.' : ' Nothing names its track.'}`} disabled={!w.track}
          onClick={() => { if (w.track) p.set('track', w.track) }}><i />{w.agent}</button>)}
          {working.length > 3 && <span>+{working.length - 3}</span>}</p>}
      </div>
      <TileGateways p={p} />
    </div></Tile>
}
