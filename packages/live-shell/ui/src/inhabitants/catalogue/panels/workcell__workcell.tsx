// A workcell (manual §19.23, workcell:workcell): where agents work, set once. A workcell is one of the machine's standing tracks of
// checkouts (env-1, env-2, env-3 on a Mac), holding one seat for each project; the DLW draws it as a rack whose chain carries the road
// in and out — the Gateway (§19.2), the Remote carrier (§19.18), Git / landing with the Seat inside it (§19.16, §19.17). Every track an
// agent works on names its workcell in its In/Out section (Works in, §16.6), in every mode, so a setting made here holds for every
// agent that works here. Live's nearest: a return track, whose chain several tracks share; drawn as a rack and its chain list.
// Its pages carry the material a run stands in, which Workcell prepares for it: Chain (the road and who works here, with what each
// harness process costs), World (the run's prepared world: its bindings, its lifetime and checkpoints), Services (whether each service
// the run needs is up), Exposure (what the run exposes, each with Open), Release (keep or let go of each binding) and Left behind (the
// worlds, bindings and sandboxes that runs left, each with its finding, with Recover and Release orphans).
// The Workcells tile: a chip for each workcell with its state; the chosen one's lane, claim and the agents working in it; under them every
// gateway the machines reach, one line each with its state dot, and Show (All, Ready, In use). A line pressed opens that gateway's Frames.
//
// Value keys. The owners report (never written from here):
//   light      'lit' | 'dark'     the register and the workcell's gateway answered; hollow when nobody reports
//   name       string             the workcell's name (`seat status --json`: workcell; Control/machines/workcells.register.json)
//   machine    string             where it runs (the Remote carrier's reading: `workcell status --json`, workcell_ref)
//   chain      [{id, name, light, reading, fault?}]  its three devices with their lights and one reading each (the devices' own owners);
//                                  `fault` is the owner's words where it reports one: the row stands orange
//   seats      [{product, state, lane, claimedBy, workers, dirty, ahead, behind}]  one per project (`seat status --json`, SeatRow)
//   project    string             the project the chain stands for: its seat's lane is the lane the folded workcell and a track's Works in
//                                  read (none while that seat is free), never another project's
//   worlds     [{receipt, world}]  the worlds `workcell worlds` lists for this cell where it lists several; the World page chooses among
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
// The macros reach into the chain, each written by its own device's owner:
//   transport, approvals, stallAfter  the Gateway's (kernel harness_agent_control `configure`, as actuation:gateway writes them)
//   landAs                            Git / landing's ('draft' | 'mr' | 'merge', as workcell:git-seat writes it)
// Settings the shell holds: openIn ('web' | 'pane': where Open puts an endpoint), needed (Services: only what the run needs),
//   want:<binding ref> ('present' | 'suspended' | 'snapshotted' | 'released': the fate you set for a binding before Apply).
// Held by the hand: selected (the chain device beside the list), chosen (the tile's workcell), surface and binding (the rows chosen).
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
// --desired <binding>=present`), left.orphans (`workcell sandboxes reconcile --server <url> --release-orphans`); left.reread (Read now).
// The tile's gateways stand under `gw.` (the gateways' own binding): gw.chains ([{id, name, transport?, state ready | composed | refused,
// why?, workcells?}]), gw.show ('all' | 'ready' | 'inuse'); gw.chain is the gateway whose Frames page a pressed line opens.
// A key the owner has not reported is absent: the views draw "—" and name the missing reading in the well.
import {useState} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Meter, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Tone, unreadRows, NoReading} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, prefixed, scoped, st, strOf, type DesignedDevice, type ViewProps} from './design'
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

const TRANSPORTS: readonly Option<string>[] = [{value: 'stdio', label: 'Local', does: 'A trusted child process on this machine.'},
  {value: 'ws', label: 'Network', does: 'A network link, with a token.'}, {value: 'remote', label: 'Remote', does: 'Through a connected machine, with a short-lived ticket.'}]
const APPROVALS: readonly Option<string>[] = [{value: 'ask', label: 'Ask', does: 'Ask you each time.'}, {value: 'session', label: 'Session', does: 'Allow for the session.'},
  {value: 'always', label: 'Always', does: 'Allow always. Deny stays yours.'}]
const STALLS: readonly Option<string>[] = [{value: '30', label: '30 s'}, {value: '90', label: '90 s'}, {value: '300', label: '5 min'}, {value: '1800', label: '30 min'}]
const LANDS: readonly Option<string>[] = [{value: 'draft', label: 'Draft MR', does: 'Land as a draft merge request.'}, {value: 'mr', label: 'MR', does: 'Land as a merge request.'},
  {value: 'merge', label: 'Merge', does: 'Merge into main.'}]
const OPEN_IN: readonly Option<string>[] = [{value: 'web', label: 'Web', does: 'Open the endpoint in the Web monitor.'}, {value: 'pane', label: 'Pane', does: 'Open the endpoint in the pane that has focus.'}]
/** A binding's fates, as `workcell reconcile --desired` names them, from kept to let go. */
const FATES: readonly Option<string>[] = [{value: 'present', label: 'Keep', does: 'Keep the binding, or bring it back.'}, {value: 'suspended', label: 'Suspend', does: 'Suspend it where its provider can.'},
  {value: 'snapshotted', label: 'Snapshot', does: 'Keep a snapshot and let the material go, where its provider can.'}, {value: 'released', label: 'Release', does: 'Let the material go.'}]
const PAGES = [{id: 'chain', label: 'Chain'}, {id: 'world', label: 'World'}, {id: 'services', label: 'Services'}, {id: 'exposure', label: 'Exposure'}, {id: 'release', label: 'Release'},
  {id: 'left', label: 'Left behind'}] as const
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
const healthLight = (h: string | undefined): LightState => (h === 'healthy' || h === 'degraded' ? 'lit' : h ? 'dark' : 'unknown')

/** A seat's lane, as the folded head and Works in read it: the seat of the project the chain stands for (`project`), none while it is free;
 * with no project named, the first seat that holds a lane. */
const laneOf = (v: V): string | undefined => {
  const seats = seatsOf(v), project = strOf(v, 'project')?.toLowerCase()
  if (project !== undefined) return seats?.find(s => s.product.toLowerCase() === project)?.lane ?? undefined
  return seats?.find(s => s.lane)?.lane ?? undefined
}

/** The macros: four settings of the chain, each written by the device that holds it. */
function macros(p: ViewProps, stack: boolean) {
  const v = p.v
  return {
    transport: <Radio {...st(p, 'transport')} label="Transport" does="The Gateway's Transport: how the agents here reach their harness." value={strOf(v, 'transport') ?? ''} options={TRANSPORTS} stack={stack} onChange={x => p.set('transport', x)} />,
    approvals: <Radio {...st(p, 'approvals')} label="Approvals" does="The Gateway's Approvals: the default answer when an agent here asks permission." value={strOf(v, 'approvals') ?? ''} options={APPROVALS} stack={stack} onChange={x => p.set('approvals', x)} />,
    stall: <Chooser {...st(p, 'stallAfter')} label="Stall after" does="The Gateway's Stall after: the silence, with work pending, after which a session here counts as stalled."
      value={has(v, 'stallAfter') ? String(v.stallAfter) : ''} options={STALLS} onChange={x => p.set('stallAfter', Number(x))} />,
    land: <Chooser {...st(p, 'landAs')} label="Land as" does="Git / landing's Land as: how the work of every agent here lands." value={strOf(v, 'landAs') ?? ''} options={LANDS} onChange={x => p.set('landAs', x)} />,
  }
}

function ChainList({p, selected, onSelect}: {p: ViewProps; selected: string; onSelect: (id: string) => void}) {
  const chain = chainOf(p.v)
  const items: RowItem[] = chain
    ? chain.map((d): RowItem => ({id: d.id, name: d.name, light: d.fault ? 'lit' : lightIn(d.light), tone: d.fault ? 'stall' : undefined, why: d.fault, note: d.reading ?? NONE,
      does: `${d.name}: select it to read it beside the list; ▸ on its head expands it.`}))
    : unreadRows('No reading of the chain.')
  return <Rows label="Chain" does="The road in and out, in its order: the gateway, the machine, the seat and its landing." items={items} selected={selected} onSelect={chain ? onSelect : undefined} size={3} />
}

/** The agents working here, each with what its harness process costs: a meter of its processor and its memory. */
function Working({v, size = 4}: {v: V; size?: number}) {
  const working = workingOf(v), instances = instancesOf(v)
  const cost = (w: Worker) => (w.instance ? instances?.find(i => i.ref === w.instance) : undefined)
  const items: RowItem[] = working
    ? (working.length ? working.map(w => {
      const i = cost(w)
      return {id: `${w.agent}:${w.track ?? ''}`, name: w.agent, light: 'lit' as LightState, note: `${whereOf(w)} · ${i?.rss === undefined ? NONE : mb(i.rss)}`,
        meter: <Meter value={i?.cpu === undefined ? undefined : clampTo(0, 1, i.cpu / 100)} label={`${w.agent}: processor`} />,
        does: i ? `${i.harness}, ${i.pids?.length ?? NONE} processes: processor ${i.cpu === undefined ? NONE : pctText(i.cpu)}, memory ${i.rss === undefined ? NONE : mb(i.rss)}.`
          : !instances ? 'No reading of the harness processes.' : 'The gateway does not name this agent\'s process.'}
    }) : [{id: 'none', name: 'Nobody works here now', light: 'dark'}])
    : unreadRows('No reading of who works here.')
  return <Rows label="Working here" does="The agents working in this workcell now, each with its mode, its track and its memory. The meter is its harness process's share of a processor."
    items={items} size={size} />
}

const light = (v: V, owner?: V) => lightIn(strOf(owner ?? v, 'light'))

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

const bindingRows = (world: World | null | undefined): RowItem[] => (world === undefined ? unreadRows('No reading of the world.')
  : world === null ? [{id: 'none', name: 'No world is prepared', light: 'dark'}]
  : world.bindings.map(b => { const s = bindingState(b); return {id: b.ref, name: shortRef(b.ref), light: (s.tone ? 'lit' : 'dark') as LightState, tone: s.tone, note: `${portName(b.port)} · ${s.word}`,
    why: s.fault ? `${b.ref} is ${s.word}. Recover brings it back from the receipt.` : undefined, does: `${b.ref} · ${b.provider ?? NONE} · ${b.necessity ?? NONE}`} }))
const faulty = (world: World | null | undefined) => (world ? world.bindings.filter(b => bindingState(b).fault).length : undefined)

function WorldBand({p}: {p: ViewProps}) {
  const v = p.v, world = worldOf(v), lease = leaseOf(v), cps = checkpointsOf(v), at = numOf(v, 'readAt'), bad = faulty(world)
  return <Band>
    <Section width={206}><WorldWell v={v} w={194} h={146} /></Section>
    <Section label="Run" width={104}>
      {worldsOf(v) && <Chooser {...st(p, 'worldReceipt')} label="World" does="The worlds Workcell lists for this cell: choose the one the pages read. None is assumed." wide
        value={strOf(v, 'worldReceipt') ?? ''} options={[{value: '', label: 'Choose a world'}, ...worldsOf(v)!.map(x => ({value: x.receipt, label: x.world}))]}
        onChange={x => p.set('worldReceipt', x || undefined)} />}
      <Readout label="persists" does="How long the world's material is meant to last: ephemeral, the task or run, the candidate, the project or the workcell." value={world?.persistence} />
      <Readout label="keeps" does="What releasing the world does to its material: release, preserve, suspend or snapshot." value={world?.retention?.replace('-if-supported', '')} />
      <Readout label="state" does="The world's health as Workcell observes it." value={world?.state} tone={healthTone(world?.state)} />
    </Section>
    <Section label="Lifetime" width={104}>
      <Readout label="expires" does="When the world's lease ends. A local world has no lease: it lives until it is released." value={lease === undefined ? undefined : lease.expiresAt === null ? 'never' : at === undefined ? when(lease.expiresAt) : span(lease.expiresAt - at)}
        tone={lease && lease.expiresAt !== null && at !== undefined && lease.expiresAt - at < 3600e3 ? 'stall' : undefined} />
      <Readout label="checkpoints" does="The world's checkpoints that are ready to restore from." value={cps === undefined ? undefined : cps.filter(c => c.state === 'ready').length} tone="value" />
      <Action {...st(p, 'checkpoint')} label="Checkpoint" does="Keep a checkpoint of the world to restore from." onPress={world ? () => p.set('checkpoint', world.ref) : undefined} />
    </Section>
    <Section label="Bindings" grow>
      <Rows does="The world's bindings: what each provides and how it stands. Orange: missing or stale." items={bindingRows(world)} size={6} />
      <div className="ref-pair">
        <Action {...st(p, 'reread')} label="Read now" does="Read the world again from its receipt." onPress={() => p.set('reread', true)} />
        <Action {...st(p, 'recover')} label="Recover" does="Bring the missing and stale bindings back from the receipt." onPress={bad ? () => p.set('recover', world!.ref) : undefined}
          disabled={st(p, 'recover').disabled ?? (bad === 0 ? 'Every binding is present.' : undefined)} />
      </div>
    </Section>
  </Band>
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

function ServicesBand({p}: {p: ViewProps}) {
  const v = p.v, list = shownServices(v), world = worldOf(v), needed = boolOf(v, 'needed')
  const downNeeded = list ? list.filter(s => s.health !== 'healthy' && s.health !== 'degraded' && needOf(world, s)).length : undefined
  const items: RowItem[] = !list ? unreadRows('No reading of the services.')
    : list.length === 0 ? [{id: 'none', name: needed ? 'The run needs no service' : 'No service is declared', light: 'dark'}]
    : list.map(s => {
      const need = needOf(world, s), down = s.health !== 'healthy' && s.health !== 'degraded'
      return {id: s.ref, name: shortRef(s.ref), light: healthLight(s.health), tone: s.health === 'healthy' ? 'green' : 'accent', note: `${s.endpoint?.replace(/^[a-z]+:\/\//, '') ?? NONE}${need ? ` · ${need}` : ''}`,
        why: down && need ? `The run ${need === 'required' ? 'needs' : 'would use'} ${shortRef(s.ref)}, and it is ${s.health ?? 'not read'}.` : undefined,
        does: `${s.ref} · ${s.availability ?? NONE} · ${s.lifetime ?? NONE}`}
    })
  return <Band>
    <Section width={206}><ServicesWell v={v} w={194} h={146} /></Section>
    <Section label="Show" width={104}>
      <Toggle {...st(p, 'needed')} label="Needed only" does="Show only the services the run uses." on={needed === true} unknown={needed === undefined} onChange={x => p.set('needed', x)} />
      <Readout big label="up" does="Services that answer healthy, of those shown." value={list ? `${list.filter(s => s.health === 'healthy').length}/${list.length}` : undefined} tone="green" />
      <Readout label="in use, down" does="Services the run uses that do not answer." value={downNeeded} tone={downNeeded ? 'stall' : undefined} />
      <Action {...st(p, 'readServices')} label="Read now" does="Ask each service again." onPress={() => p.set('readServices', true)} />
    </Section>
    <Section label="Services" grow>
      <Rows does="Each service this workcell declares: its light, its endpoint and what the run needs of it." items={items} size={8} />
    </Section>
  </Band>
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

function ExposureBand({p}: {p: ViewProps}) {
  const v = p.v, list = surfacesOf(v), out = omittedOf(v)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const sel = list?.find(s => s.ref === chosen) ?? list?.[0]
  const items: RowItem[] = !list ? unreadRows('No reading of the exposure.')
    : [...list.map((s): RowItem => ({id: s.ref, name: s.interaction ?? shortRef(s.ref), light: 'lit', tone: 'value', note: s.endpoint ?? NONE, does: `${s.ref}: press to choose it, then Open.`})),
      ...(out ?? []).map((o): RowItem => ({id: `x:${o.requirement}`, name: shortRef(o.requirement), light: 'dark', note: o.necessity ?? NONE, why: o.reason ?? 'Workcell gave no reason.'}))]
  if (list?.length === 0 && !out?.length) items.push({id: 'none', name: 'The run exposes nothing', light: 'dark'})
  return <Band>
    <Section width={206}><ExposureWell v={v} w={194} h={146} chosen={sel?.ref} /></Section>
    <Section label="Open" width={104}>
      <Radio {...st(p, 'openIn')} label="Open in" does="Where Open puts the endpoint: the Web monitor, or the pane that has focus." value={strOf(v, 'openIn') ?? ''} options={OPEN_IN} stack onChange={x => p.set('openIn', x)} />
      <Action {...st(p, 'open')} label="Open" does="Open the chosen endpoint where Open in says." onPress={sel ? () => p.set('open', sel.ref) : undefined} />
      <Readout label="endpoint" does="The chosen endpoint. Press to copy it." value={sel?.endpoint?.replace(/^[a-z]+:\/\//, '')} copy={sel?.endpoint} />
    </Section>
    <Section label="Exposed" grow>
      <Rows does="What the run exposes, each with its endpoint. A dark row could not be exposed: point at its ! for the reason." items={items} size={7}
        selected={sel?.ref} onSelect={list?.length ? id => { if (!id.startsWith('x:')) setChosen(id) } : undefined} />
    </Section>
  </Band>
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

function ReleaseBand({p}: {p: ViewProps}) {
  const v = p.v, world = worldOf(v), changes = changesOf(v, world), deltas = deltasOf(v)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const b = world?.bindings.find(x => x.ref === chosen) ?? world?.bindings[0]
  const items: RowItem[] = deltas === undefined
    ? (changes.length ? changes.map(c => ({id: c.ref, name: `${world!.bindings.indexOf(c) + 1} ${shortRef(c.ref)}`, light: 'lit' as LightState, tone: 'accent' as Tone, note: `${nowFate(c)} → ${wantOf(v, c)}`, does: `${c.ref}: Apply asks for ${wantOf(v, c)}.`}))
      : world ? [{id: 'none', name: 'Nothing to change', light: 'dark'}] : unreadRows('No reading of the world.'))
    : deltas.map(d => ({id: d.ref, name: shortRef(d.ref), light: d.action ? 'lit' : 'dark', tone: d.action === 'lost' || d.action === 'unbound' ? 'stall' : 'value', note: `${d.observed ?? NONE} → ${d.desired}${d.action ? ` · ${d.action}` : ''}`,
      why: d.action === 'lost' ? 'The binding was ephemeral: its material is gone and cannot come back.' : d.action === 'unbound' ? 'The world holds no binding of this name.' : undefined,
      does: `${d.ref}: what the last Apply did.`}))
  return <Band>
    <Section width={206}><FatesWell p={p} w={194} h={146} live /></Section>
    <Section label="Binding" width={112}>
      <Chooser label="Binding" wide does="The binding whose fate the radio sets." value={b?.ref ?? ''} options={(world?.bindings ?? []).map((x, i) => ({value: x.ref, label: `${i + 1} ${shortRef(x.ref)}`}))} onChange={setChosen} />
      <Radio {...(b ? st(p, `want:${b.ref}`) : {})} label="Fate" does="What Apply asks for this binding: keep it, suspend it, keep a snapshot, or let it go." value={b ? wantOf(v, b) ?? nowFate(b) : ''} options={FATES} stack
        onChange={b ? x => p.set(`want:${b.ref}`, x === nowFate(b) ? undefined : x) : undefined} />
    </Section>
    <Section label="Apply" width={104}>
      <Readout big label="to change" does="Bindings whose fate you changed." value={world ? changes.length : undefined} tone={changes.length ? 'accent' : undefined} />
      <Action {...st(p, 'apply')} hold label="Apply" does="Ask Workcell for each binding's fate. A released binding cannot come back." onPress={changes.length ? () => {
        p.set('apply', JSON.stringify(changes.map(c => ({ref: c.ref, desired: wantOf(v, c)}))))
      } : undefined} disabled={st(p, 'apply').disabled ?? (world && !changes.length ? 'No fate is changed.' : undefined)} />
      <Readout label="world keeps" does="What releasing the whole world does to its material: release, preserve, suspend or snapshot, as the run asked when it was prepared." value={world?.retention?.replace('-if-supported', '')} />
      <Action {...st(p, 'releaseWorld')} hold label="Release world" does="Release the whole world as its retention says. The run's receipt keeps the account." onPress={world ? () => p.set('releaseWorld', world.ref) : undefined} />
    </Section>
    <Section label={deltas ? 'Last apply' : 'Changes'} grow>
      <Rows does="The fates you changed, from where each stands to what you ask; after Apply, what Workcell did." items={items} size={7} />
    </Section>
  </Band>
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

const LEFT_R = [1, .7, .4]
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
      const read = g.rings[ring], r = R * LEFT_R[k]!, ok = g.readable(ring) && !!read, n = read?.ticks.length ?? 0
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

function LeftBand({p}: {p: ViewProps}) {
  const g = readLeft(p.v), sel = g.shown.find(f => f.id === strOf(p.v, 'sel')), read = numOf(p.v, 'readAge')
  const faults = g.shown.filter(f => f.fault).length
  return <Band>
    <Section width={206}>
      <Display w={194} h={146} label="What runs left" does="Rings of the sandboxes, the worlds' bindings and the worlds, with the count of each. A dot marks a thing with a finding: orange a fault, teal a reading."
        corner={g.anyRead && g.found ? `${g.shown.length} found` : NONE}>
        <LeftRings p={p} />
      </Display>
    </Section>
    <Section label="Read" width={92}>
      <Readout big label="faults" does="The findings that are faults: bindings not present or lost, and orphan sandboxes." value={g.anyRead && g.found ? faults : undefined} tone={faults ? 'stall' : 'green'} />
      <Readout label="read" does="When the page last read what the runs left." value={read === undefined ? undefined : read === 0 ? 'now' : `${read} s ago`} />
      <Action {...st(p, 'reread')} label="Read now" does="Read the world receipts and the sandbox server again." onPress={() => p.set('reread', true)} />
    </Section>
    <Section label="Found" grow>
      <Rows does="What the runs left, each with its finding. Orange is a fault; teal a reading that is not one. Press one to choose it."
        items={leftRows(g)} size={6} selected={sel?.id} onSelect={id => { if (!id.startsWith('refused:') && id !== 'none' && id !== 'clear') p.set('sel', id) }}
        page={numOf(p.v, 'page:findings') ?? 0} onPage={x => p.set('page:findings', x)} />
      <div className="ref-pair">
        <Action {...st(p, 'recover')} hold label="Recover" does="Bring the chosen binding back from its world's receipt." onPress={() => { if (sel) p.set('recover', sel.subject) }} disabled={leftWhy(p, sel, 'recover')} />
        <Action {...st(p, 'orphans')} hold label="Release orphans" does={`Release the sandboxes whose lease has ended${g.server ? ` on ${g.server}` : ''}. A sandbox without a lease is never released. It returns a receipt.`}
          onPress={() => { if (sel) p.set('orphans', sel.subject) }} disabled={leftWhy(p, sel, 'orphans')} />
      </div>
    </Section>
  </Band>
}

function LeftDoc({v}: {v: V}) {
  const g = readLeft(v)
  return <>
    <h3>Left behind <small>{g.anyRead && g.found ? `${g.shown.length} found` : <NoReading name="Left behind" why="No reading of the findings." />}{g.server ? ` · sandbox server ${g.server}` : ''}</small></h3>
    <table className="wc-seats">
      <thead><tr><th>What</th><th>Finding</th><th>What it means</th></tr></thead>
      <tbody>{LEFT_RINGS.flatMap(ring => g.refusal[ring] ? [<tr key={`r:${ring}`} data-free="true"><td><b>{LEFT_TITLE[ring]}</b></td><td data-fault="true">not read</td><td>{g.refusal[ring]}</td></tr>] : [])}
        {g.shown.map(f => <tr key={f.id}><td><b>{f.subject}</b></td><td data-fault={f.fault ? 'true' : undefined}>{LEFT_KIND[f.kind] ?? f.kind}</td><td>{LEFT_SAYS[f.kind] ?? NONE}</td></tr>)}</tbody>
    </table>
    {strOf(v, 'receipt') && <p className="ref-doc-lead">Last receipt: {strOf(v, 'receipt')}</p>}
  </>
}

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
/** Every key the owners report or the shell holds: the "No reading" fixture drops all of them. */
const ALL = ['light', 'name', 'machine', 'chain', 'seats', 'working', 'frames', 'transport', 'approvals', 'stallAfter', 'landAs', 'instances', 'run', 'world', 'lease',
  'checkpoints', 'readAt', 'services', 'surfaces', 'omitted', 'reconciled', 'openIn', 'needed', 'workcells', 'left.worlds', 'left.sandboxes', 'left.findings', 'left.sources',
  'left.readAge', 'gw.chains', 'gw.show']

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

export const design: DesignedDevice = {
  id: 'workcell:workcell',
  title: 'Workcell',
  kind: 'rack',
  firstPage: 'chain',
  defaults: {
    light: 'lit', name: 'env-1', machine: 'workcell:mac', transport: 'stdio', approvals: 'session', stallAfter: 300, landAs: 'draft',
    chain: JSON.stringify([
      {id: 'gateway', name: 'Gateway', light: 'lit', reading: 'Claude Code · local'},
      {id: 'carrier', name: 'Remote carrier', light: 'lit', reading: 'This machine'},
      {id: 'landing', name: 'Git / landing', light: 'lit', reading: 'dlw/build · 3 ahead'}]),
    seats: JSON.stringify([
      {product: 'o-i', state: 'claimed', lane: 'dlw/build', claimedBy: 'claude-code:dlw-lead', workers: ['claude-code:uiux-lane-kit'], dirty: 4, ahead: 3, behind: 0},
      {product: 'ai-kit', state: 'claimed', lane: 'reads-round-2', claimedBy: 'claude-code:dlw-lead', workers: [], dirty: 0, ahead: 1, behind: 2},
      {product: 'central', state: 'free', lane: null, claimedBy: null, workers: [], dirty: 0, ahead: 0, behind: 0},
      {product: 'workcell', state: 'free', lane: null, claimedBy: null, workers: [], dirty: 0, ahead: 0, behind: 0}]),
    project: 'O-I',
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
    'Remote, nobody here': {name: 'omarchy · env-1', machine: 'workcell:omarchy', transport: 'remote', approvals: 'ask',
      chain: JSON.stringify([{id: 'gateway', name: 'Gateway', light: 'lit', reading: 'Claude Code · remote'}, {id: 'carrier', name: 'Remote carrier', light: 'lit', reading: 'Omarchy · 41 ms'},
        {id: 'landing', name: 'Git / landing', light: 'dark', reading: 'No lane'}]),
      seats: JSON.stringify([{product: 'o-i', state: 'free', lane: null}, {product: 'quaternal-logic', state: 'free', lane: null}]), working: '[]',
      run: undefined, world: 'null', lease: undefined, checkpoints: undefined, surfaces: undefined, omitted: undefined, 'want:connectivity:service:gliner25-decision/personal-workcell': undefined},
    // `workcell worlds` lists two worlds for this cell: the World page asks which one the pages read; none is assumed.
    'Two worlds for this cell': {worlds: JSON.stringify([{receipt: 'receipt:world-a', world: 'world:local:o-i:candidate'}, {receipt: 'receipt:world-b', world: 'world:local:o-i:dlw-build'}]),
      worldReceipt: 'receipt:world-a'},
    'Nothing left behind': prefixed('left.', {findings: '[]'}),
    'Sandbox server down': prefixed('left.', {sandboxes: undefined, sources: JSON.stringify([LEFT_SOURCES[0], {...LEFT_SOURCES[1], refusal: 'the sandbox server did not answer'}])}),
    'No reading': {...Object.fromEntries(ALL.map(k => [k, undefined])), 'want:connectivity:service:gliner25-decision/personal-workcell': undefined},
  },

  folded: p => <Folded title={strOf(p.v, 'name') ?? 'Workcell'} light={light(p.v, p.owner)} readings={[laneOf(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <CompactView p={p} />,

  whole: p => <WholeView p={p} />,

  full: p => <FullView p={p} />,

  widget: p => <WidgetView p={p} />,
}

function CompactView({p}: {p: ViewProps}) {
    const [selected, setSelected] = useState('gateway'), m = macros(p, true)
    return <Panel title={strOf(p.v, 'name') ?? 'Workcell'} view="compact" rack light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={196} part="chains"><ChainList p={p} selected={selected} onSelect={setSelected} /></Section>
      <Section label="Macros" width={92} part="macros">{m.transport}</Section>
      <Section width={92} part="macros">{m.approvals}{m.stall}{m.land}</Section>
    </Panel>
}

function WholeView({p}: {p: ViewProps}) {
    const [selected, setSelected] = useState('gateway'), m = macros(p, true), chosen = chainOf(p.v)?.find(d => d.id === selected)
    const page = pageOf(p), world = worldOf(p.v)
    const left = readLeft(leftOf(p).v), leftFaults = left.anyRead && left.found ? left.shown.filter(f => f.fault).length : undefined
    const pages = PAGES.map(x => ({id: x.id, label: x.label,
      light: x.id === 'world' ? (world ? (faulty(world) ? 'dark' : 'lit') : undefined) as LightState | undefined
        : x.id === 'left' ? (leftFaults === undefined ? undefined : leftFaults ? 'dark' : 'lit') as LightState | undefined : undefined}))
    return <Panel title={strOf(p.v, 'name') ?? 'Workcell'} view="whole" rack light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} pages={pages} page={page} onPage={p.setPage}>
      {page === 'world' ? <WorldBand p={p} />
        : page === 'services' ? <ServicesBand p={p} />
        : page === 'exposure' ? <ExposureBand p={p} />
        : page === 'release' ? <ReleaseBand p={p} />
        : page === 'left' ? <LeftBand p={leftOf(p)} />
        : <Band>
          <Section width={196} part="chains">
            <ChainList p={p} selected={selected} onSelect={setSelected} />
            <Readout label={chosen?.name ?? 'device'} does="The selected device's own reading. Its settings open on its head, ▸." value={chosen?.reading} />
          </Section>
          <Section label="Gateway" width={92} part="macros">{m.transport}</Section>
          <Section width={92} part="macros">{m.approvals}{m.stall}</Section>
          <Section label="Landing" width={92} part="macros">{m.land}<Readout label="machine" does="Where the workcell runs: the Remote carrier's reading." value={strOf(p.v, 'machine')} /></Section>
          <Section grow><Working v={p.v} /></Section>
        </Band>}
    </Panel>
}

/** The pane's own tabs: the same pages as Whole's, on the same page. */
function PaneTabs({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
    {PAGES.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === page} onClick={() => p.setPage(x.id)}>{x.id === 'chain' ? 'Seats' : x.label}</button>)}
  </div>
}

function FullView({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <div className="ref-pane-body">
    <PaneTabs p={p} />
    <div className="ref-doc wc-doc">
      {page === 'world' ? <WorldDoc v={p.v} /> : page === 'services' ? <ServicesDoc v={p.v} /> : page === 'exposure' ? <ExposureDoc p={p} /> : page === 'release' ? <ReleaseDoc v={p.v} />
        : page === 'left' ? <LeftDoc v={leftOf(p).v} /> : <SeatsDoc v={p.v} />}
    </div>
  </div>
}

function SeatsDoc({v}: {v: V}) {
  const seats = seatsOf(v), frames = framesOf(v), instances = instancesOf(v)
  return <>
    <h3>{strOf(v, 'name') ?? NONE} <small>{strOf(v, 'machine') ?? NONE} · {seats ? `${seats.filter(s => s.lane).length} of ${seats.length} seats hold a lane` : <NoReading name="Seats" why="No reading of the seats." />}</small></h3>
    <table className="wc-seats">
      <thead><tr><th>Project</th><th>Lane</th><th>Held by</th><th>Co-workers</th><th>Uncommitted</th><th>Against main</th></tr></thead>
      <tbody>{(seats ?? []).map(s => <tr key={s.product} data-free={s.lane ? undefined : 'true'}>
        <td><b>{s.product}</b></td><td>{s.lane ?? 'free'}</td><td>{s.claimedBy ?? NONE}</td><td>{s.workers?.length ? s.workers.join(', ') : NONE}</td>
        <td>{s.dirty ?? NONE}</td><td>{s.ahead === undefined ? NONE : `${s.ahead} ahead · ${s.behind ?? 0} behind`}</td>
      </tr>)}</tbody>
    </table>
    <div className="wc-pane-side wc-pane-side--3">
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
      <section><h4>The gateway's latest frames</h4>
        {frames.length ? <ul className="wc-list wc-frames">{frames.map((f, i) => <li key={i}><span>{f.at}</span> <b data-dir={f.dir}>{f.dir === 'in' ? '←' : '→'} {f.kind}</b> <span>{f.note}</span></li>)}</ul>
          : <p className="ref-doc-lead">No reading of the frames.</p>}
      </section>
    </div>
  </>
}

function WorldDoc({v}: {v: V}) {
  const world = worldOf(v), lease = leaseOf(v), cps = checkpointsOf(v), at = numOf(v, 'readAt')
  if (!world) return <><h3>World</h3><p className="ref-doc-lead">{world === null ? 'No world is prepared for this run.' : 'No reading of the world.'}</p></>
  return <>
    <h3>{strOf(v, 'run') ?? NONE} <small>{world.ref} · {world.state ?? NONE}</small></h3>
    <table className="wc-seats">
      <thead><tr><th>Binding</th><th>Port</th><th>Provider</th><th>Needed</th><th>Presence</th><th>Observed</th></tr></thead>
      <tbody>{world.bindings.map(b => { const s = bindingState(b); return <tr key={b.ref} data-free={s.tone ? undefined : 'true'}>
        <td><b>{b.ref}</b></td><td>{portName(b.port)}</td><td>{b.provider?.replace('provider:', '') ?? NONE}</td><td>{b.necessity ?? NONE}</td>
        <td data-fault={b.presence === 'missing' || b.presence === 'stale' ? 'true' : undefined}>{b.presence ?? NONE}</td>
        <td data-fault={(b.observed ?? b.health) === 'unavailable' ? 'true' : undefined}>{b.observed ?? b.health ?? NONE}</td></tr> })}</tbody>
    </table>
    <div className="wc-pane-side">
      <section><h4>Lifetime</h4><ul className="wc-list">
        <li><b>persists</b><span>{world.persistence ?? NONE}</span></li><li><b>keeps on release</b><span>{world.retention ?? NONE}</span></li>
        <li><b>lease</b><span>{lease === undefined ? <NoReading name="Lease" why="No reading of the lease." /> : lease.expiresAt === null ? 'none: it lives until released' : `ends ${when(lease.expiresAt)} UTC${at === undefined ? '' : ` · ${span(lease.expiresAt - at)} left`}${lease.renewable ? ' · renewable' : ''}`}</span></li>
      </ul></section>
      <section><h4>Checkpoints</h4>
        {cps === undefined ? <p className="ref-doc-lead">No reading of the checkpoints.</p> : cps.length === 0 ? <p className="ref-doc-lead">No checkpoint.</p>
          : <ul className="wc-list">{cps.map(c => <li key={c.ref}><b>{c.ref}</b><span>{c.state ?? NONE}{c.at === undefined ? '' : ` · ${when(c.at)} UTC`}{c.reusable ? ' · reusable' : ''}</span></li>)}</ul>}
      </section>
    </div>
  </>
}

function ServicesDoc({v}: {v: V}) {
  const list = servicesOf(v), world = worldOf(v)
  return <>
    <h3>Services <small>{list ? `${list.filter(s => s.health === 'healthy').length} of ${list.length} up` : <NoReading name="Services" why="No reading of the services." />}</small></h3>
    {list && <table className="wc-seats">
      <thead><tr><th>Service</th><th>Endpoint</th><th>Health</th><th>Availability</th><th>Lifetime</th><th>The run</th></tr></thead>
      <tbody>{list.map(s => <tr key={s.ref} data-free={s.health === 'healthy' ? undefined : 'true'}>
        <td><b>{s.ref}</b></td><td>{s.endpoint ?? NONE}</td><td data-fault={s.health !== 'healthy' && s.health !== 'degraded' ? 'true' : undefined}>{s.health ?? NONE}</td>
        <td>{s.availability ?? NONE}</td><td>{s.lifetime ?? NONE}</td><td>{needOf(world, s) ?? NONE}</td></tr>)}</tbody>
    </table>}
  </>
}

function ExposureDoc({p}: {p: ViewProps}) {
  const list = surfacesOf(p.v), out = omittedOf(p.v), into = strOf(p.v, 'openIn')
  return <>
    <h3>Exposure <small>{list ? `${list.length} endpoint${list.length === 1 ? '' : 's'}` : <NoReading name="Exposure" why="No reading of the exposure." />} · opens in {into === 'pane' ? 'a pane' : into === 'web' ? 'Web' : NONE}</small></h3>
    {list && <ul className="wc-surfaces">{list.map(s => <li key={s.ref}>
      <b>{s.interaction ?? s.ref}</b><code>{s.endpoint ?? NONE}</code><span>{s.ref}</span>
      <Action {...st(p, 'open')} label="Open" does="Open this endpoint where Open in says." onPress={() => p.set('open', s.ref)} />
    </li>)}</ul>}
    {out && out.length > 0 && <><h4 className="wc-h4">Not exposed</h4><ul className="wc-list">{out.map(o => <li key={o.requirement}><b>{o.requirement}</b><span>{o.necessity ?? NONE} · {o.reason ?? NONE}</span></li>)}</ul></>}
  </>
}

function ReleaseDoc({v}: {v: V}) {
  const world = worldOf(v), deltas = deltasOf(v)
  if (!world) return <><h3>Release</h3><p className="ref-doc-lead">{world === null ? 'No world is prepared for this run.' : 'No reading of the world.'}</p></>
  return <>
    <h3>Release <small>{world.ref} · keeps {world.retention ?? NONE} on release</small></h3>
    <table className="wc-seats">
      <thead><tr><th>Binding</th><th>Stands</th><th>You ask</th><th>Last apply</th></tr></thead>
      <tbody>{world.bindings.map(b => { const want = wantOf(v, b), d = deltas?.find(x => x.ref === b.ref); return <tr key={b.ref} data-free={want ? undefined : 'true'}>
        <td><b>{b.ref}</b></td><td>{nowFate(b)}</td><td>{want ?? 'as it stands'}</td><td>{d ? `${d.observed ?? NONE} → ${d.desired}${d.action ? ` · ${d.action}` : ''}` : NONE}</td></tr> })}</tbody>
    </table>
  </>
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
