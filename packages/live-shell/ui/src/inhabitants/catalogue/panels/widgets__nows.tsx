// NOWs (manual §23.6): the day in force, the present moment, and the moments of the day still open, machine by machine. A device born on
// the rail; Live's nearest is the transport's position display beside the Session view's playing slots. The display is the ground's
// reading as it stands: the day and the time large at the left, then each open moment as a row — its state as a light (lit while
// active, dark while quiescent), what it is for, the machine it runs on and who works on it. In a pane the moments stand on the day's
// hours, one lane for each machine.
//
// Owners, keyed on their paths:
//   day, time, timezone   the ground's civil time (`central.time.policy`, `central.civil-time-reading/v1`: civil_date, local_time,
//                         policy.timezone); dayState the day's own lifecycle (`central.day.read` temporal.lifecycle).
//   nows                  the clearings of every register (`central.now.list` for your ground, `projectcentral.now.inspect` for each
//                         project; records: now_ref, purpose, lifecycle, workcell_ref (the machine), participant_refs,
//                         created_at_unix_seconds), each with where it stands: register ('root' for your ground, else the project's
//                         name) and seat (the workcell it was opened in, env-1 and so on, where it belongs to one). This machine's are
//                         read directly; another machine's by asking it, through its Remote carrier. An archived clearing is closed and
//                         does not show.
//   asked                 [{machine, at (unix s), answered}]: when each other machine last answered; one that did not answer keeps its
//                         last answer, and its moments stand dimmed.
//   close                 a now_ref to close: the ground's `central.now.lifecycle` action (kernel op invoke_action), asked from Full.
//   open                  the moment opened (the monitor's own).
// Machines and Where (all · ground · project:<name> · workcell:<name>) are the monitor's own. The ground opens and closes the day by
// itself; NOWs shows nothing the ground does not report.
//
// A monitor (manual §16.3): it stands on the rail and in a pane, and has two views. The tile is the day, the time and the open moments,
// with Machines as handle 1 across its top; a moment pressed there opens in Full. Full's head carries the day, the time, its zone, the
// day's state and the count of open moments, with Machines, Where and Close; its body is the day's hours, one lane for each machine, its
// moments grouped by your ground, each project and each workcell, and the moment opened.
import {Action, Chooser, Display, Handle, Radio, Tile} from '../../sdk/panel'
import {NONE, clampTo, json, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane, MonitorPicture} from './monitor'

type V = ViewProps['v']

interface Now {readonly ref: string; readonly purpose: string; readonly lifecycle: string; readonly machine?: string; readonly who: readonly string[]; readonly created?: number
  readonly register?: string; readonly seat?: string}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function nowsOf(v: V): Now[] | undefined {
  const raw = json<unknown>(v, 'nows', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Now[] => rec(e) && typeof e.now_ref === 'string' ? [{ref: e.now_ref, purpose: String(e.purpose ?? ''), lifecycle: String(e.lifecycle ?? ''),
    machine: typeof e.workcell_ref === 'string' ? e.workcell_ref : undefined, who: Array.isArray(e.participant_refs) ? e.participant_refs.filter((x): x is string => typeof x === 'string') : [],
    created: typeof e.created_at_unix_seconds === 'number' ? e.created_at_unix_seconds : undefined,
    register: typeof e.register === 'string' ? e.register : undefined, seat: typeof e.seat === 'string' ? e.seat : undefined}] : [])
}
const machineName = (m: string | undefined) => (m ? m.replace(/^workcell:/, '') : 'root')
const machinesOf = (v: V) => [...new Set((nowsOf(v) ?? []).map(n => machineName(n.machine)))]
/** Where a moment stands, as Where names it: a workcell it was opened in, else your ground or its project; undefined where nobody said. */
const placeOf = (n: Now): string | undefined => (n.seat ? `workcell:${n.seat}` : n.register === 'root' ? 'ground' : n.register ? `project:${n.register}` : undefined)
const placeName = (place: string | undefined) => (place === undefined ? NONE : place === 'ground' ? 'your ground' : place.replace(/^(project|workcell):/, ''))
const placesOf = (v: V) => [...new Set((nowsOf(v) ?? []).filter(n => n.lifecycle !== 'archived').flatMap(n => { const x = placeOf(n); return x ? [x] : [] }))]
const openOf = (v: V) => {
  const m = strOf(v, 'machine') ?? 'all', w = strOf(v, 'where') ?? 'all'
  return (nowsOf(v) ?? []).filter(n => n.lifecycle !== 'archived' && (m === 'all' || machineName(n.machine) === m) && (w === 'all' || placeOf(n) === w))
}
interface Asked {readonly machine: string; readonly at?: number; readonly answered?: boolean}
const askedOf = (v: V): Asked[] | undefined => {
  const raw = json<unknown>(v, 'asked', undefined)
  return Array.isArray(raw) ? raw.flatMap((e): Asked[] => rec(e) && typeof e.machine === 'string' ? [{machine: machineName(e.machine), at: typeof e.at === 'number' ? e.at : undefined,
    answered: typeof e.answered === 'boolean' ? e.answered : undefined}] : []) : undefined
}
/** A machine that did not answer when it was last asked: its moments are its last answer, dimmed. */
const silent = (v: V, machine: string | undefined) => askedOf(v)?.find(a => a.machine === machineName(machine))?.answered === false
const who = (n: Now) => (n.who.length ? n.who.map(w => w.replace(/^agent:/, '')).join(', ') : 'no agent')
const clockOf = (v: V) => { const t = strOf(v, 'time'), m = /T(\d\d):(\d\d)/.exec(t ?? ''); return m ? `${m[1]}:${m[2]}` : undefined }
const dayOf = (v: V) => { const d = strOf(v, 'day'); if (!d) return undefined; const t = new Date(`${d}T12:00:00Z`); return Number.isNaN(t.getTime()) ? d : t.toUTCString().slice(0, 11) }

/** The day and its open moments. `handle`: Machines as a scale at the top (all, then each machine). `press`: a row opens its moment. */
function Moments({p, w, h, handle, press, size = 9}: {p: ViewProps; w: number; h: number; handle: boolean; press?: (n: Now) => void; size?: number}) {
  const v = p.v, nows = nowsOf(v), open = openOf(v), machines = ['all', ...machinesOf(v)], m = strOf(v, 'machine') ?? 'all', k = Math.max(0, machines.indexOf(m))
  const left = Math.min(78, w * .3), x0 = left + 10, x1 = w - 8, stop = (j: number) => x0 + (machines.length > 1 ? j * (x1 - x0) / (machines.length - 1) : 0)
  const top = handle ? 26 : 8, lh = size * 2.4, fit = Math.floor((h - top) / lh), ms = st(p, 'machine')
  return <g>
    <text x={6} y={22} className="dp-ink" style={{fontSize: 20, fontWeight: 300}}>{clockOf(v) ?? NONE}</text>
    <text x={6} y={36} className="dp-axis" style={{fontSize: 8.5}}>{dayOf(v) ?? 'No day'}</text>
    <text x={6} y={48} className="dp-axis">{strOf(v, 'timezone') ?? ''}</text>
    {strOf(v, 'dayState') && <text x={6} y={60} className="dp-axis" style={{fill: 'var(--dp-value)'}}>{strOf(v, 'dayState')}</text>}
    <path d={`M${left} 4V${h - 4}`} className="dp-faint" />
    {handle && machines.length > 1 && <g>
      <path d={`M${x0} 9H${x1}`} className="dp-faint" />
      {machines.map((x, j) => <text key={x} x={stop(j)} y={20} textAnchor={j === machines.length - 1 ? 'end' : j ? 'middle' : 'start'} className="dp-axis" style={{fontSize: 7}}>{x}</text>)}
      <Handle n={1} shape="square" x={stop(k)} y={9} label="Machines" does={`Drag across: the moments of every machine, or of one.${ms.disabled ? ` ${ms.disabled}` : ''}`}
        onDrag={ms.disabled ? undefined : x => { const j = clampTo(0, machines.length - 1, Math.round((x - x0) / ((x1 - x0) / (machines.length - 1)))); if (machines[j] !== m) p.set('machine', machines[j]!) }}
        onReset={ms.disabled ? undefined : () => p.set('machine', 'all')} />
    </g>}
    {!nows && <text x={x0} y={top + 14} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the moments'}</text>}
    {nows && !open.length && <text x={x0} y={top + 14} className="dp-ink-dim">No open moment</text>}
    {open.slice(0, fit).map((n, i) => { const y = top + i * lh + size, lit = n.lifecycle === 'active'
      return <g key={n.ref} opacity={silent(v, n.machine) ? .45 : 1}>
        <circle cx={x0 - 2} cy={y - size * .35} r={3} fill={lit ? 'var(--dp-on)' : 'var(--dp-well)'} stroke={lit ? 'var(--dp-on)' : 'var(--text-faint, #71767c)'} />
        <text x={x0 + 6} y={y} className="dp-ink" style={{fontSize: size}}>{n.purpose.slice(0, Math.floor((x1 - x0 - 6) / (size * .52)))}</text>
        <text x={x0 + 6} y={y + size * 1.1} className="dp-axis" style={{fontSize: size * .85}}>{machineName(n.machine)} · {placeName(placeOf(n))} · {who(n)}</text>
        {press && <rect x={x0 - 6} y={y - size} width={x1 - x0 + 6} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={`Open ${n.purpose}`}
          data-i={`${n.purpose}|Open the moment.`} onClick={() => press(n)} onKeyDown={e => { if (e.key === 'Enter') press(n) }} />}
      </g> })}
    {open.length > fit && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{open.length - fit}</text>}
  </g>
}

const LIGHT_WHY = 'NOWs has no on or off: the day opens and closes by itself. The light stays hollow.'
const openMoment = (p: ViewProps) => (n: Now) => { p.set('open', n.ref); p.nav.full?.() }
const DISPLAY_DOES = 'The day and the time, and each open moment: lit while active, dark while quiet, with its machine and who works on it.'
const since = (s: number | undefined, v: V) => { if (s === undefined) return undefined; const m = /([+-])(\d\d):(\d\d)$/.exec(strOf(v, 'time') ?? ''), off = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
  const d = new Date((s + off * 60) * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }

/** Full's head: the day, the time, its zone, the day's state and the open moments; Machines and Close. */
function Head({p}: {p: ViewProps}) {
  const v = p.v, machines = machinesOf(v), chosen = openOf(v).find(n => n.ref === strOf(v, 'open'))
  return <MonitorHead title="NOWs" readings={[
    {label: 'day', value: dayOf(v), does: 'The day in force, as the ground reports it.'},
    {label: 'now', value: clockOf(v), does: 'The present moment, as the ground reports it.', tone: 'value'},
    {label: 'zone', value: strOf(v, 'timezone'), does: 'The ground\'s time zone.'},
    {label: 'day is', value: strOf(v, 'dayState'), does: 'The day\'s own state: the ground opens and closes it.', tone: 'value'},
    {label: 'open', value: nowsOf(v) ? openOf(v).length : undefined, does: 'The moments of the day still open, on the machines and places shown.', tone: 'accent'},
    ...(askedOf(v) ?? []).map(a => ({label: `${a.machine} asked`, value: a.at === undefined ? undefined : since(a.at, v), does: a.answered === false
      ? `${a.machine} did not answer when last asked: its moments are its last answer, dimmed.` : `When ${a.machine} last answered.`, tone: a.answered === false ? 'stall' as const : undefined})),
  ]} controls={<>
    <Radio {...st(p, 'machine')} label="Machines" does="The open moments of every machine, or of one." value={strOf(v, 'machine') ?? 'all'}
      options={[{value: 'all', label: 'All'}, ...machines.map(m => ({value: m, label: m}))]} onChange={x => p.set('machine', x)} />
    <Chooser {...st(p, 'where')} label="Where" does="The open moments of every register and workcell, or of your ground, one project or one workcell." value={strOf(v, 'where') ?? 'all'}
      options={[{value: 'all', label: 'All'}, ...placesOf(v).map(x => ({value: x, label: x === 'ground' ? 'Your ground' : `${x.startsWith('project:') ? 'Project' : 'Workcell'} ${placeName(x)}`}))]}
      onChange={x => p.set('where', x)} />
    <Action {...st(p, 'close')} hold label="Close" does={chosen ? `Close “${chosen.purpose}”: the moment is done.` : 'Open a moment, then close it when it is done.'}
      onPress={chosen ? () => p.set('close', chosen.ref) : undefined} />
  </>} />
}

/** The day's hours across the room, one lane for each machine; each open moment where it began, the one opened ringed and read out at
 * the foot. */
function Day({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const v = p.v, open = openOf(v), opened = open.find(n => n.ref === strOf(v, 'open'))
  // A lane for each machine and, inside it, a row for each place its moments stand in: your ground, each project, each workcell.
  const machines = [...new Set(open.map(n => `${machineName(n.machine)}\u0000${placeOf(n) ?? ''}`))].sort()
  // The hours are the ground's local hours: the offset of its local time applies to every moment.
  const off = (() => { const m = /([+-])(\d\d):(\d\d)$/.exec(strOf(v, 'time') ?? ''); return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0 })()
  const l = 110, r = w - 30, foot = 46, X = (s: number) => { const d = new Date((s + off * 60) * 1000); return l + (d.getUTCHours() + d.getUTCMinutes() / 60) / 24 * (r - l) }
  const pitch = Math.min(80, (h - foot - 50) / Math.max(1, machines.length)), lane = (n: Now) => 40 + machines.indexOf(`${machineName(n.machine)}\u0000${placeOf(n) ?? ''}`) * pitch
  const nowX = (() => { const t = Date.parse(strOf(v, 'time') ?? ''); return Number.isFinite(t) ? X(t / 1000) : undefined })(), base = h - foot
  return <g>
    {[0, 6, 12, 18, 24].map(hh => <g key={hh}><path d={`M${l + hh / 24 * (r - l)} 18V${base - 8}`} className="dp-grid" /><text x={l + hh / 24 * (r - l)} y={base + 4} textAnchor="middle" className="dp-axis">{String(hh).padStart(2, '0')}:00</text></g>)}
    {nowX !== undefined && <path d={`M${nowX} 14V${base - 8}`} className="dp-curve-on" />}
    {machines.map((key, i) => { const [m, place] = key.split('\u0000') as [string, string], y = 40 + i * pitch, first = i === 0 || machines[i - 1]!.split('\u0000')[0] !== m
      const asked = askedOf(v)?.find(a => a.machine === m)
      return <g key={key} opacity={asked?.answered === false ? .45 : 1}>
        {first && i > 0 && <path d={`M0 ${y - pitch / 2}H${w}`} className="dp-grid" />}
        <path d={`M${l} ${y}H${r}`} className="dp-faint" />
        {first && <text x={8} y={y + 4} className="dp-ink" style={{fill: 'var(--dp-value)'}}>{m}</text>}
        {first && asked && <text x={8} y={y + 16} className="dp-axis">{asked.answered === false ? 'last answer' : 'answered'}{asked.at === undefined ? '' : ` ${since(asked.at, v)}`}</text>}
        <text x={l - 10} y={y + 4} textAnchor="end" className="dp-axis">{placeName(place || undefined)}</text>
      </g> })}
    {open.map((n, i) => { const x = n.created === undefined ? l : X(n.created), y = lane(n) + (i % 2) * 22 + 6, on = n.ref === opened?.ref
      return <g key={n.ref} role="button" tabIndex={0} aria-label={`Open ${n.purpose}`} onClick={() => p.set('open', n.ref)} onKeyDown={e => { if (e.key === 'Enter') p.set('open', n.ref) }} data-i={`${n.purpose}|Open the moment.`}
        opacity={silent(v, n.machine) ? .45 : 1}>
        {on && <circle cx={x} cy={lane(n)} r={10} fill="var(--sel, #7ec3e6)" opacity={.22} />}
        <circle cx={x} cy={lane(n)} r={5} fill={n.lifecycle === 'active' ? 'var(--dp-on)' : 'var(--dp-well)'} stroke="var(--dp-on)" />
        <text x={x + 9} y={y + 8} className="dp-ink" style={{fontSize: 10.5}}>{n.purpose}</text>
        <text x={x + 9} y={y + 20} className="dp-axis">{who(n)} · {n.lifecycle}</text>
      </g> })}
    {!nowsOf(v) && <text x={l} y={60} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the moments'}</text>}
    {nowsOf(v) && !open.length && <text x={l} y={60} className="dp-ink-dim">No open moment</text>}
    <path d={`M0 ${base + 14}H${w}`} className="dp-faint" />
    {opened ? <g>
      <circle cx={18} cy={base + 30} r={4} fill={opened.lifecycle === 'active' ? 'var(--dp-on)' : 'var(--dp-well)'} stroke="var(--dp-on)" />
      <text x={30} y={base + 34} className="dp-ink" style={{fontSize: 11}}>{opened.purpose}</text>
      <text x={w - 16} y={base + 34} textAnchor="end" className="dp-axis" style={{fontSize: 9.5}}>{machineName(opened.machine)} · {placeName(placeOf(opened))} · {who(opened)} · {opened.lifecycle}{since(opened.created, v) ? ` · since ${since(opened.created, v)}` : ''} · {opened.ref}</text>
    </g> : <text x={18} y={base + 34} className="dp-ink-dim">{nowsOf(v) ? 'Click a moment to open it' : ''}</text>}
  </g>
}

/** The open moments of your ground, of O-I and of a workcell, on this Mac and on omarchy. */
const NOWS = [
  {now_ref: 'central:now:control:root:01', purpose: 'Device run: Live, Quaternal Logic and the rail', lifecycle: 'active', workcell_ref: 'workcell:mac', register: 'root', participant_refs: ['agent:fizz', 'agent:builder'], created_at_unix_seconds: 1792136400},
  {now_ref: 'central:now:control:root:02', purpose: 'Reconcile the capability matrix', lifecycle: 'quiescent', workcell_ref: 'workcell:mac', register: 'root', participant_refs: [], created_at_unix_seconds: 1792123200},
  {now_ref: 'projectcentral:now:O-I:07', purpose: 'Land the DLW catalogue reconcile', lifecycle: 'active', workcell_ref: 'workcell:mac', register: 'O-I', participant_refs: ['agent:dlw-lead'], created_at_unix_seconds: 1792140000},
  {now_ref: 'projectcentral:now:O-I:08', purpose: 'Second half of the catalogue', lifecycle: 'active', workcell_ref: 'workcell:mac', register: 'O-I', seat: 'env-2', participant_refs: ['agent:designer'], created_at_unix_seconds: 1792148000},
  {now_ref: 'central:now:control:root:03', purpose: 'Back up the bimba graph to the Mac', lifecycle: 'active', workcell_ref: 'workcell:omarchy', register: 'root', participant_refs: ['agent:hermes'], created_at_unix_seconds: 1792144800},
  {now_ref: 'central:now:control:root:04', purpose: 'Close yesterday', lifecycle: 'archived', workcell_ref: 'workcell:mac', register: 'root', participant_refs: [], created_at_unix_seconds: 1792054800}]

export const design = railAndPane({
  id: 'widgets:nows',
  title: 'NOWs',
  kind: 'monitor',
  defaults: {
    day: '2026-10-16', time: '2026-10-16T14:22:08+01:00', timezone: 'Europe/London', dayState: 'open', machine: 'all', where: 'all', open: 'central:now:control:root:01',
    nows: JSON.stringify(NOWS),
    asked: JSON.stringify([{machine: 'workcell:omarchy', at: 1792156800, answered: true}]),
  },
  fixtures: {
    'Two machines at work': {},
    'One machine': {machine: 'omarchy'},
    'One project': {where: 'project:O-I'},
    'The other machine is silent': {asked: JSON.stringify([{machine: 'workcell:omarchy', at: 1792149900, answered: false}])},
    'The ground reports nothing': {day: undefined, time: undefined, timezone: undefined, dayState: undefined, nows: undefined, asked: undefined, open: undefined, reason: 'The ground did not answer'},
  },

  full: p => <MonitorPane dark label="NOWs" head={<Head p={p} />}>{room => <MonitorPicture room={room} label="The moments of the day"><Day p={p} w={room.w} h={room.h} /></MonitorPicture>}</MonitorPane>,

  widget: p => <Tile title="NOWs" light="unknown" lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Now" does={`${DISPLAY_DOES} Drag handle 1 for one machine. Click a moment to open it in Full.`}><Moments p={p} w={266} h={104} handle press={openMoment(p)} size={8.5} /></Display>
  </Tile>,
})
