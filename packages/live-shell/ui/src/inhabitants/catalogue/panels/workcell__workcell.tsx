// A workcell (manual §19.23, workcell:workcell): where agents work, set once. A workcell is one of the machine's standing tracks of
// checkouts (env-1, env-2, env-3 on a Mac), holding one seat for each project; the DLW draws it as a rack whose chain carries the road
// in and out — the Gateway (§19.2), the Remote carrier (§19.18), Git / landing with the Seat inside it (§19.16, §19.17). Every track an
// agent works on names its workcell in its In/Out section (Works in, §16.6), in every mode, so a setting made here holds for every
// agent that works here. Live's nearest: a return track, whose chain several tracks share; drawn as a rack and its chain list.
// Its pages carry the material a run stands in, which Workcell prepares for it: Chain (the road and who works here, with what each
// harness process costs), World (the run's prepared world: its bindings, its lifetime and checkpoints), Services (whether each service
// the run needs is up), Exposure (what the run exposes, each with Open) and Release (keep or let go of each binding).
//
// Value keys. The owners report (never written from here):
//   light      'lit' | 'dark'     the register and the workcell's gateway answered; hollow when nobody reports
//   name       string             the workcell's name (`seat status --json`: workcell; Control/machines/workcells.register.json)
//   machine    string             where it runs (the Remote carrier's reading: `workcell status --json`, workcell_ref)
//   chain      [{id, name, light, reading}]  its three devices with their lights and one reading each (the devices' own owners)
//   seats      [{product, state, lane, claimedBy, workers, dirty, ahead, behind}]  one per project (`seat status --json`, SeatRow)
//   working    [{agent, track, mode, instance?}]  the agents working here now, from the claims and the gateway's sessions (`aikit gateway
//                                  who`); `instance` is the harness instance the agent runs in, where the gateway names its process
//   instances  [{ref, harness, liveness, pids, cpu?, rss?}]  the harness processes on this machine (`workcell instances list --json`:
//                                  instance_ref, harness_ref, liveness live|stale, pids) with their cost (`workcell instances usage <ref>
//                                  --pid <n> --json`: metrics.cpu_utilisation percent, metrics.memory_rss bytes); a metric the provider
//                                  marks unsupported is left out. No kernel route reaches `instances` yet.
//   workcells  [{name, light, lane}]  every workcell the machines hold, for the tile's chips
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
// A key the owner has not reported is absent: the views draw "—" and name the missing reading in the well.
import {useState} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Meter, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './workcell__workcell.css'

type V = ViewProps['v']

interface ChainDevice {readonly id: string; readonly name: string; readonly light?: string; readonly reading?: string}
interface Seat {readonly product: string; readonly state: string; readonly lane?: string | null; readonly claimedBy?: string | null; readonly workers?: readonly string[]
  readonly dirty?: number; readonly ahead?: number; readonly behind?: number}
interface Worker {readonly agent: string; readonly track: string; readonly mode: string; readonly instance?: string}
interface Cell {readonly name: string; readonly light?: string; readonly lane?: string | null}
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
const PAGES = [{id: 'chain', label: 'Chain'}, {id: 'world', label: 'World'}, {id: 'services', label: 'Services'}, {id: 'exposure', label: 'Exposure'}, {id: 'release', label: 'Release'}] as const
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

/** A seat's lane, as the folded head and Works in read it: the seat of the chosen product, or the first seat that holds a lane. */
const laneOf = (v: V): string | undefined => { const seats = seatsOf(v); return seats?.find(s => s.lane)?.lane ?? undefined }

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
    ? chain.map(d => ({id: d.id, name: d.name, light: lightIn(d.light), note: d.reading ?? NONE, does: `${d.name}: select it to read it beside the list; ▸ on its head expands it.`}))
    : [{id: 'none', name: 'No reading of the chain', light: 'unknown'}]
  return <Rows label="Chain" does="The road in and out, in its order: the gateway, the machine, the seat and its landing." items={items} selected={selected} onSelect={chain ? onSelect : undefined} size={3} />
}

/** The agents working here, each with what its harness process costs: a meter of its processor and its memory. */
function Working({v, size = 4}: {v: V; size?: number}) {
  const working = workingOf(v), instances = instancesOf(v)
  const cost = (w: Worker) => (w.instance ? instances?.find(i => i.ref === w.instance) : undefined)
  const items: RowItem[] = working
    ? (working.length ? working.map(w => {
      const i = cost(w)
      return {id: `${w.agent}:${w.track}`, name: w.agent, light: 'lit' as LightState, note: `${w.mode} · ${w.track} · ${i?.rss === undefined ? NONE : mb(i.rss)}`,
        meter: <Meter value={i?.cpu === undefined ? undefined : clampTo(0, 1, i.cpu / 100)} label={`${w.agent}: processor`} />,
        does: i ? `${i.harness}, ${i.pids?.length ?? NONE} processes: processor ${i.cpu === undefined ? NONE : pctText(i.cpu)}, memory ${i.rss === undefined ? NONE : mb(i.rss)}.`
          : !instances ? 'No reading of the harness processes.' : 'The gateway does not name this agent\'s process.'}
    }) : [{id: 'none', name: 'Nobody works here now', light: 'dark'}])
    : [{id: 'none', name: 'No reading of who works here', light: 'unknown'}]
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

const bindingRows = (world: World | null | undefined): RowItem[] => (world === undefined ? [{id: 'none', name: 'No reading of the world', light: 'unknown'}]
  : world === null ? [{id: 'none', name: 'No world is prepared', light: 'dark'}]
  : world.bindings.map(b => { const s = bindingState(b); return {id: b.ref, name: shortRef(b.ref), light: (s.tone ? 'lit' : 'dark') as LightState, tone: s.tone, note: `${portName(b.port)} · ${s.word}`,
    why: s.fault ? `${b.ref} is ${s.word}. Recover brings it back from the receipt.` : undefined, does: `${b.ref} · ${b.provider ?? NONE} · ${b.necessity ?? NONE}`} }))
const faulty = (world: World | null | undefined) => (world ? world.bindings.filter(b => bindingState(b).fault).length : undefined)

function WorldBand({p}: {p: ViewProps}) {
  const v = p.v, world = worldOf(v), lease = leaseOf(v), cps = checkpointsOf(v), at = numOf(v, 'readAt'), bad = faulty(world)
  return <Band>
    <Section width={206}><WorldWell v={v} w={194} h={146} /></Section>
    <Section label="Run" width={104}>
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
  const items: RowItem[] = !list ? [{id: 'none', name: 'No reading of the services', light: 'unknown'}]
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
  const items: RowItem[] = !list ? [{id: 'none', name: 'No reading of the exposure', light: 'unknown'}]
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
      : [{id: 'none', name: world ? 'Nothing to change' : 'No reading of the world', light: world ? 'dark' : 'unknown'}])
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
  'checkpoints', 'readAt', 'services', 'surfaces', 'omitted', 'reconciled', 'openIn', 'needed', 'workcells']

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
    working: JSON.stringify([
      {agent: 'dlw-lead', track: 'dlw/build', mode: 'Factory', instance: 'instance:claude-code:bbc22b5e'},
      {agent: 'uiux-lane-kit', track: 'UI/UX refinement', mode: 'Factory', instance: 'instance:claude-code:a7a018c8'},
      {agent: 'Nara', track: 'Practice', mode: 'Central'}]),
    instances: JSON.stringify(INSTANCES),
    workcells: JSON.stringify([{name: 'env-1', light: 'lit', lane: 'dlw/build'}, {name: 'env-2', light: 'lit', lane: 'dlw/uiux-kit-motion'},
      {name: 'env-3', light: 'dark', lane: null}, {name: 'omarchy · env-1', light: 'lit', lane: 'ql/m-ledger'}]),
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
    return <Panel title={strOf(p.v, 'name') ?? 'Workcell'} view="compact" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={196}><ChainList p={p} selected={selected} onSelect={setSelected} /></Section>
      <Section label="Macros" width={92}>{m.transport}</Section>
      <Section width={92}>{m.approvals}{m.stall}{m.land}</Section>
    </Panel>
}

function WholeView({p}: {p: ViewProps}) {
    const [selected, setSelected] = useState('gateway'), m = macros(p, true), chosen = chainOf(p.v)?.find(d => d.id === selected)
    const page = pageOf(p), world = worldOf(p.v)
    const pages = PAGES.map(x => ({id: x.id, label: x.label,
      light: x.id === 'world' ? (world ? (faulty(world) ? 'dark' : 'lit') : undefined) as LightState | undefined : undefined}))
    return <Panel title={strOf(p.v, 'name') ?? 'Workcell'} view="whole" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} pages={pages} page={page} onPage={p.setPage}>
      {page === 'world' ? <WorldBand p={p} />
        : page === 'services' ? <ServicesBand p={p} />
        : page === 'exposure' ? <ExposureBand p={p} />
        : page === 'release' ? <ReleaseBand p={p} />
        : <Band>
          <Section width={196}>
            <ChainList p={p} selected={selected} onSelect={setSelected} />
            <Readout label={chosen?.name ?? 'device'} does="The selected device's own reading. Its settings open on its head, ▸." value={chosen?.reading} />
          </Section>
          <Section label="Gateway" width={92}>{m.transport}</Section>
          <Section width={92}>{m.approvals}{m.stall}</Section>
          <Section label="Landing" width={92}>{m.land}<Readout label="machine" does="Where the workcell runs: the Remote carrier's reading." value={strOf(p.v, 'machine')} /></Section>
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
      {page === 'world' ? <WorldDoc v={p.v} /> : page === 'services' ? <ServicesDoc v={p.v} /> : page === 'exposure' ? <ExposureDoc p={p} /> : page === 'release' ? <ReleaseDoc v={p.v} /> : <SeatsDoc v={p.v} />}
    </div>
  </div>
}

function SeatsDoc({v}: {v: V}) {
  const seats = seatsOf(v), frames = framesOf(v), instances = instancesOf(v)
  return <>
    <h3>{strOf(v, 'name') ?? NONE} <small>{strOf(v, 'machine') ?? NONE} · {seats ? `${seats.filter(s => s.lane).length} of ${seats.length} seats hold a lane` : 'no reading of the seats'}</small></h3>
    <table className="wc-seats">
      <thead><tr><th>Project</th><th>Lane</th><th>Held by</th><th>Co-workers</th><th>Uncommitted</th><th>Against main</th></tr></thead>
      <tbody>{(seats ?? []).map(s => <tr key={s.product} data-free={s.lane ? undefined : 'true'}>
        <td><b>{s.product}</b></td><td>{s.lane ?? 'free'}</td><td>{s.claimedBy ?? NONE}</td><td>{s.workers?.length ? s.workers.join(', ') : NONE}</td>
        <td>{s.dirty ?? NONE}</td><td>{s.ahead === undefined ? NONE : `${s.ahead} ahead · ${s.behind ?? 0} behind`}</td>
      </tr>)}</tbody>
    </table>
    <div className="wc-pane-side wc-pane-side--3">
      <section><h4>Working here</h4>
        {workingOf(v)?.length ? <ul className="wc-list">{workingOf(v)!.map(w => <li key={`${w.agent}:${w.track}`}><b>{w.agent}</b> <span>{w.mode} · {w.track}</span></li>)}</ul>
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
        <li><b>lease</b><span>{lease === undefined ? 'no reading' : lease.expiresAt === null ? 'none: it lives until released' : `ends ${when(lease.expiresAt)} UTC${at === undefined ? '' : ` · ${span(lease.expiresAt - at)} left`}${lease.renewable ? ' · renewable' : ''}`}</span></li>
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
    <h3>Services <small>{list ? `${list.filter(s => s.health === 'healthy').length} of ${list.length} up` : 'no reading'}</small></h3>
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
    <h3>Exposure <small>{list ? `${list.length} endpoint${list.length === 1 ? '' : 's'}` : 'no reading'} · opens in {into === 'pane' ? 'a pane' : into === 'web' ? 'Web' : NONE}</small></h3>
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
    return <Tile title="Workcells" light={light(p.v, p.owner)} span={2} onFull={p.nav.full}><div className="wc-tile">
      <div className="wc-chips" role="radiogroup" aria-label="Workcell">
        {cells.map(c => <button key={c.name} type="button" role="radio" aria-checked={c.name === chosen} className="wc-chip" data-light={lightIn(c.light)}
          data-i={`${c.name}|${c.lane ? `Lane ${c.lane}.` : 'No lane.'} Click to show it.`} onClick={() => setChosen(c.name)}>{c.name}</button>)}
      </div>
      <div className="wc-tile-body">
        <p className="wc-tile-lane" data-i="Lane|The lane the chosen workcell's seat holds."><b>{cell ? (cell.lane ?? 'free') : NONE}</b>{chosen === here && strOf(p.v, 'machine') ? ` · ${strOf(p.v, 'machine')}` : ''}</p>
        {chosen === here && (workingOf(p.v)?.slice(0, 2) ?? []).map(w => <p key={`${w.agent}:${w.track}`} className="wc-tile-who"
          data-i={`${w.agent}|Working here: ${w.mode} · ${w.track}. Click to select its track.`}><i />{w.agent} <span>{w.mode} · {w.track}</span></p>)}
        {chosen === here && (workingOf(p.v)?.length ?? 0) > 2 && <p className="wc-tile-who"><span>+{workingOf(p.v)!.length - 2} more</span></p>}
      </div>
    </div></Tile>
}
