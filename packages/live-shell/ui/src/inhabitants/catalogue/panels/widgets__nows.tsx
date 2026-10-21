// NOWs (manual §23.6): the day in force, the present moment, and the moments of the day still open, machine by machine. A device born on
// the rail; Live's nearest is the transport's position display beside the Session view's playing slots. The display is the ground's
// reading as it stands: the day and the time large at the left, then each open moment as a row — its state as a light (lit while
// active, dark while quiescent), what it is for, the machine it runs on and who works on it. In a pane the moments stand on the day's
// hours, one lane for each machine.
//
// Owners, keyed on their paths:
//   day, time, timezone   the ground's civil time (`central.time.policy`, `central.civil-time-reading/v1`: civil_date, local_time,
//                         policy.timezone); dayState the day's own lifecycle (`central.day.read` temporal.lifecycle).
//   nows                  the clearings (`central.now.list`, records: now_ref, purpose, lifecycle, workcell_ref, participant_refs,
//                         created_at_unix_seconds); an archived clearing is closed and does not show.
//   close                 a now_ref to close: the ground's `central.now.lifecycle` action (kernel op invoke_action), asked from the tile.
// Machines is the tile's own. The ground opens and closes the day by itself; the tile shows nothing the ground does not report.
import {Action, Band, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, type LightState} from '../../sdk/panel'
import {NONE, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

interface Now {readonly ref: string; readonly purpose: string; readonly lifecycle: string; readonly machine?: string; readonly who: readonly string[]; readonly created?: number}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function nowsOf(v: V): Now[] | undefined {
  const raw = json<unknown>(v, 'nows', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Now[] => rec(e) && typeof e.now_ref === 'string' ? [{ref: e.now_ref, purpose: String(e.purpose ?? ''), lifecycle: String(e.lifecycle ?? ''),
    machine: typeof e.workcell_ref === 'string' ? e.workcell_ref : undefined, who: Array.isArray(e.participant_refs) ? e.participant_refs.filter((x): x is string => typeof x === 'string') : [],
    created: typeof e.created_at_unix_seconds === 'number' ? e.created_at_unix_seconds : undefined}] : [])
}
const machineName = (m: string | undefined) => (m ? m.replace(/^workcell:/, '') : 'root')
const machinesOf = (v: V) => [...new Set((nowsOf(v) ?? []).map(n => machineName(n.machine)))]
const openOf = (v: V) => { const m = strOf(v, 'machine') ?? 'all'; return (nowsOf(v) ?? []).filter(n => n.lifecycle !== 'archived' && (m === 'all' || machineName(n.machine) === m)) }
const who = (n: Now) => (n.who.length ? n.who.map(w => w.replace(/^agent:/, '')).join(', ') : 'no agent')
const clockOf = (v: V) => { const t = strOf(v, 'time'), m = /T(\d\d):(\d\d)/.exec(t ?? ''); return m ? `${m[1]}:${m[2]}` : undefined }
const dayOf = (v: V) => { const d = strOf(v, 'day'); if (!d) return undefined; const t = new Date(`${d}T12:00:00Z`); return Number.isNaN(t.getTime()) ? d : t.toUTCString().slice(0, 11) }

/** The day and its open moments. `handle`: Machines as a scale at the top (all, then each machine). `press`: a row opens its moment. */
function Moments({p, w, h, handle, press, size = 9}: {p: ViewProps; w: number; h: number; handle: boolean; press?: (n: Now) => void; size?: number}) {
  const v = p.v, nows = nowsOf(v), open = openOf(v), machines = ['all', ...machinesOf(v)], m = strOf(v, 'machine') ?? 'all', k = Math.max(0, machines.indexOf(m))
  const left = Math.min(70, w * .3), x0 = left + 10, x1 = w - 8, stop = (j: number) => x0 + (machines.length > 1 ? j * (x1 - x0) / (machines.length - 1) : 0)
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
      return <g key={n.ref}>
        <circle cx={x0 - 2} cy={y - size * .35} r={3} fill={lit ? 'var(--dp-on)' : 'var(--dp-well)'} stroke={lit ? 'var(--dp-on)' : 'var(--text-faint, #71767c)'} />
        <text x={x0 + 6} y={y} className="dp-ink" style={{fontSize: size}}>{n.purpose.slice(0, Math.floor((x1 - x0 - 6) / (size * .52)))}</text>
        <text x={x0 + 6} y={y + size * 1.1} className="dp-axis" style={{fontSize: size * .85}}>{machineName(n.machine)} · {who(n)} · {n.lifecycle}</text>
        {press && <rect x={x0 - 6} y={y - size} width={x1 - x0 + 6} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={`Open ${n.purpose}`}
          data-i={`${n.purpose}|Open the moment.`} onClick={() => press(n)} onKeyDown={e => { if (e.key === 'Enter') press(n) }} />}
      </g> })}
    {open.length > fit && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{open.length - fit}</text>}
  </g>
}

const LIGHT_WHY = 'NOWs has no on or off: the day opens and closes by itself. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const openMoment = (p: ViewProps) => (n: Now) => { p.set('open', n.ref); p.nav.full?.() }
const DISPLAY_DOES = 'The day and the time, and each open moment: lit while active, dark while quiet, with its machine and who works on it.'

function controls(p: ViewProps) {
  const v = p.v, machines = machinesOf(v), chosen = openOf(v).find(n => n.ref === strOf(v, 'open'))
  return {
    machines: <Radio {...st(p, 'machine')} label="Machines" does="The open moments of every machine, or of one." value={strOf(v, 'machine') ?? 'all'} stack
      options={[{value: 'all', label: 'All'}, ...machines.map(m => ({value: m, label: m}))]} onChange={x => p.set('machine', x)} />,
    close: <Action {...st(p, 'close')} hold label="Close" does={chosen ? `Close “${chosen.purpose}”: the moment is done.` : 'Open a moment, then close it when it is done.'}
      onPress={chosen ? () => p.set('close', chosen.ref) : undefined} />,
  }
}

export const design: DesignedDevice = {
  id: 'widgets:nows',
  title: 'NOWs',
  kind: 'instrument',
  defaults: {
    day: '2026-10-16', time: '2026-10-16T14:22:08+01:00', timezone: 'Europe/London', dayState: 'open', machine: 'all', open: 'central:now:control:root:01',
    nows: JSON.stringify([
      {now_ref: 'central:now:control:root:01', purpose: 'Device run: Live, Quaternal Logic and the rail', lifecycle: 'active', workcell_ref: 'workcell:mac', participant_refs: ['agent:fizz', 'agent:builder'], created_at_unix_seconds: 1792136400},
      {now_ref: 'central:now:control:root:02', purpose: 'Reconcile the capability matrix', lifecycle: 'quiescent', workcell_ref: 'workcell:mac', participant_refs: [], created_at_unix_seconds: 1792123200},
      {now_ref: 'central:now:control:root:03', purpose: 'Back up the bimba graph to the Mac', lifecycle: 'active', workcell_ref: 'workcell:omarchy', participant_refs: ['agent:hermes'], created_at_unix_seconds: 1792144800},
      {now_ref: 'central:now:control:root:04', purpose: 'Close yesterday', lifecycle: 'archived', workcell_ref: 'workcell:mac', participant_refs: [], created_at_unix_seconds: 1792054800}]),
  },
  fixtures: {
    'Two machines at work': {},
    'One machine': {machine: 'omarchy'},
    'The ground reports nothing': {day: undefined, time: undefined, timezone: undefined, dayState: undefined, nows: undefined, open: undefined, reason: 'The ground did not answer'},
  },

  folded: p => <Folded title="NOWs" light="unknown" readings={[clockOf(p.v) ?? NONE, `${nowsOf(p.v) ? openOf(p.v).length : NONE} open`]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="NOWs" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={262}>
        <Display w={250} h={146} label="Now" does={`${DISPLAY_DOES} Drag handle 1 for one machine.`}><Moments p={p} w={250} h={146} handle /></Display>
      </Section>
      <Section label="Macros" width={76}>{c.machines}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(220, p.room!.w - 260, 640)) : 220
    return <Panel title="NOWs" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Now" does={`${DISPLAY_DOES} Drag handle 1 for one machine. Click a moment to open it.`}><Moments p={p} w={w} h={146} handle press={openMoment(p)} /></Display>
        </Section>
        <Section label="Machines" width={76}>{c.machines}</Section>
        <Section label="Day" grow>
          <Readout label="day" does="The day in force, as the ground reports it." value={dayOf(p.v)} />
          {c.close}
        </Section>
      </Band>
    </Panel> },

  full: p => { const v = p.v, open = openOf(v), machines = machinesOf(v)
    // The hours are the ground's local hours: the offset of its local time applies to every moment.
    const off = (() => { const m = /([+-])(\d\d):(\d\d)$/.exec(strOf(v, 'time') ?? ''); return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0 })()
    const X = (s: number) => { const d = new Date((s + off * 60) * 1000); return 120 + (d.getUTCHours() + d.getUTCMinutes() / 60) / 24 * 610 }
    const lane = (m: string) => 70 + machines.indexOf(m) * 70, nowX = (() => { const t = Date.parse(strOf(v, 'time') ?? ''); return Number.isFinite(t) ? X(t / 1000) : undefined })()
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The moments of the day">
        <g className="dp-display" style={{background: 'none', border: 'none'}}>
          <text x={20} y={30} className="dp-ink" style={{fontSize: 16}}>{dayOf(v) ?? 'No day'}</text>
          <text x={740} y={30} textAnchor="end" className="dp-ink" style={{fontSize: 16}}>{clockOf(v) ?? NONE}</text>
          {[0, 6, 12, 18, 24].map(hh => <g key={hh}><path d={`M${120 + hh / 24 * 610} 48V400`} className="dp-grid" /><text x={120 + hh / 24 * 610} y={412} textAnchor="middle" className="dp-axis">{String(hh).padStart(2, '0')}:00</text></g>)}
          {nowX !== undefined && <path d={`M${nowX} 44V400`} className="dp-curve-on" />}
          {machines.map(m => <g key={m}><path d={`M120 ${lane(m)}H730`} className="dp-faint" /><text x={110} y={lane(m) + 4} textAnchor="end" className="dp-ink" style={{fill: 'var(--dp-value)'}}>{m}</text></g>)}
          {open.map((n, i) => { const x = n.created === undefined ? 120 : X(n.created), y = lane(machineName(n.machine)) + (i % 2) * 22 + 6
            return <g key={n.ref} style={{cursor: 'pointer'}} onClick={() => p.set('open', n.ref)} data-i={`${n.purpose}|Open the moment.`}>
              <circle cx={x} cy={lane(machineName(n.machine))} r={5} fill={n.lifecycle === 'active' ? 'var(--dp-on)' : 'var(--dp-well)'} stroke="var(--dp-on)" />
              <text x={x + 9} y={y + 8} className="dp-ink" style={{fontSize: 10.5}}>{n.purpose}</text>
              <text x={x + 9} y={y + 20} className="dp-axis">{who(n)} · {n.lifecycle}</text>
            </g> })}
          {!nowsOf(v) && <text x={120} y={80} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the moments'}</text>}
        </g>
      </svg>
    </div> },

  widget: p => <Tile title="NOWs" light="unknown" span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Now" does={`${DISPLAY_DOES} Click a moment to open it.`}><Moments p={p} w={266} h={104} handle={false} press={openMoment(p)} size={8.5} /></Display>
  </Tile>,
}
