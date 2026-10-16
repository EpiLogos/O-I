// Trail (manual §23.5): every place you went, newest first; select a stop to return to it. A device born on the rail; Live's nearest is
// the Arrangement's locators and the browser's history — places in time that you jump back to. The display is the trail as the book
// keeps it: one row a stop, newest at the top, its time, its kind of work and its place; the stop you stand on is ringed. In a pane
// the stops stand in time across, one lane for each kind of work.
//
// Owners, keyed on their paths:
//   stops    the workspace book's trail, oldest first (desktop/cradle/src/workspace/store.ts TrailStop: {mode, surfaceKind, surfaceRef,
//            label, position?, at?}); the book keeps the last 24 (TRAIL_LIMIT) and stamps each stop's time (`at`, ms).
//   here     the place you stand on now (the book's selection `ref`).
//   return   a stop's ref to go back to: the shell's own move (shell/TrailWidget.tsx: continuity.switchMode, then the selection).
// Limit is the tile's own; its top is the book's 24.
import {Action, Band, Dial, Display, Folded, Handle, Panel, Readout, Section, Tile, type LightState} from '../../sdk/panel'
import {NONE, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const MODE: Record<string, string> = {base: 'Central', live: 'Live', factory: 'Factory', expressions: 'Expressions', techne: 'Technē', 'epi-logos': 'Epi-Logos', settings: 'Settings'}
const LIMIT = {min: 8, max: 24} as const
interface Stop {readonly mode: string; readonly kind: string; readonly ref: string; readonly label: string; readonly position?: string; readonly at?: number}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
/** The stops newest first, as the tile shows them. */
function stopsOf(v: V): Stop[] | undefined {
  const raw = json<unknown>(v, 'stops', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Stop[] => rec(e) && typeof e.mode === 'string' && typeof e.label === 'string' ? [{mode: e.mode, kind: String(e.surfaceKind ?? ''), ref: String(e.surfaceRef ?? e.label),
    label: e.label, position: typeof e.position === 'string' ? e.position : undefined, at: typeof e.at === 'number' ? e.at : undefined}] : []).reverse()
}
const time = (ms: number | undefined) => { if (ms === undefined) return NONE; const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const limitOf = (v: V) => clampTo(LIMIT.min, LIMIT.max, numOf(v, 'limit') ?? LIMIT.min)

/** The stops, newest first, as many as the limit and the room allow. `handle`: the limit at the foot of the list (drag down for more).
 * `press`: what a row does — choose it on a plate, return to it on the rail. */
function StopList({p, w, h, handle, press, size = 9}: {p: ViewProps; w: number; h: number; handle: boolean; press: (s: Stop) => void; size?: number}) {
  const v = p.v, stops = stopsOf(v), limit = limitOf(v), lh = size + 4, room = Math.floor((h - 8) / lh), here = strOf(v, 'here'), chosen = strOf(v, 'chosen'), ls = st(p, 'limit')
  if (!stops) return <text x={6} y={16} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the trail'}</text>
  if (!stops.length) return <text x={6} y={16} className="dp-ink-dim">No stop yet</text>
  const shown = stops.slice(0, Math.min(limit, room)), foot = 4 + shown.length * lh
  return <g>
    {shown.map((s, i) => { const y = 4 + (i + 1) * lh - 3, on = s.ref === here, pick = s.ref === chosen
      return <g key={`${s.ref}-${i}`}>
        {pick && <rect x={1} y={y - size} width={w - 2} height={lh} fill="var(--sel, #7ec3e6)" opacity={.16} />}
        <text x={6} y={y} className="dp-axis" style={{fontSize: size * .9}}>{time(s.at)}</text>
        <text x={6 + size * 3.2} y={y} className="dp-axis" style={{fontSize: size * .9, fill: 'var(--dp-value)'}}>{MODE[s.mode] ?? s.mode}</text>
        <text x={6 + size * 9.2} y={y} className={on ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: size}}>{s.label.slice(0, Math.max(4, Math.floor((w - size * 9.2 - 12) / (size * .52))))}</text>
        {on && <circle cx={w - 7} cy={y - size * .35} r={3} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
        <rect x={0} y={y - size} width={w} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={`${s.label}, ${MODE[s.mode] ?? s.mode}`}
          data-i={`${s.label}|${MODE[s.mode] ?? s.mode}, ${s.kind || 'a place'}${s.position ? `, at ${s.position}` : ''}. ${handle ? 'Press to choose it.' : 'Press to return to it.'}`}
          onClick={() => press(s)} onKeyDown={e => { if (e.key === 'Enter') press(s) }} />
      </g> })}
    {handle && <Handle n={1} shape="square" x={w / 2} y={Math.min(h - 4, foot + 2)} label="Limit" does={`Drag down for more stops, up for fewer: 8 to 24.${ls.disabled ? ` ${ls.disabled}` : ''}`}
      onDrag={ls.disabled ? undefined : (_, y) => { const n = clampTo(LIMIT.min, LIMIT.max, Math.round((y - 4) / lh)); if (n !== limit) p.set('limit', n) }} onReset={ls.disabled ? undefined : () => p.set('limit', LIMIT.min)} />}
    {stops.length > shown.length && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{stops.length - shown.length}</text>}
  </g>
}

const LIGHT_WHY = 'Trail has no on or off: it keeps every move. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const choose = (p: ViewProps) => (s: Stop) => p.set('chosen', s.ref)
const goBack = (p: ViewProps) => (s: Stop) => p.set('return', s.ref)
const DISPLAY_DOES = 'Every place you went, newest at the top: its time, its kind of work and its place. The ringed stop is where you stand.'

function controls(p: ViewProps) {
  const v = p.v, chosen = stopsOf(v)?.find(s => s.ref === strOf(v, 'chosen'))
  return {
    limit: <Dial {...st(p, 'limit')} label="Limit" does="How many stops show: 8 to 24, the most the book keeps." value={numOf(v, 'limit') ?? NaN} def={8} scale={{min: LIMIT.min, max: LIMIT.max, step: 1}}
      format={x => String(x)} onChange={x => p.set('limit', x)} />,
    ret: <Action {...st(p, 'return')} label="Return" does={chosen ? `Return to ${chosen.label}: the same place, page and point.` : 'Choose a stop in the list, then return to it.'}
      onPress={chosen ? () => p.set('return', chosen.ref) : undefined} />,
  }
}

const at = (h: number, m: number) => Date.UTC(2026, 9, 16, h, m)

export const design: DesignedDevice = {
  id: 'widgets:trail',
  title: 'Trail',
  kind: 'effect',
  defaults: {
    limit: 8, here: 'device:live:scale-mapping', chosen: 'wiki:node:mercurius',
    stops: JSON.stringify([
      {mode: 'base', surfaceKind: 'day', surfaceRef: 'day:2026-10-16', label: 'Thursday 16 Oct', at: at(8, 2)},
      {mode: 'factory', surfaceKind: 'session', surfaceRef: 'session:fizz-lead', label: 'Fizz · lead', at: at(9, 14)},
      {mode: 'techne', surfaceKind: 'subject', surfaceRef: 'wiki:node:mercurius', label: 'Mercurius', position: 'p. 3', at: at(10, 40)},
      {mode: 'expressions', surfaceKind: 'scene', surfaceRef: 'scene:tidal', label: 'Tidal · scene 2', at: at(11, 5)},
      {mode: 'base', surfaceKind: 'document', surfaceRef: 'doc:dlw-device-ui', label: 'Device UI', position: '§8.1', at: at(12, 31)},
      {mode: 'factory', surfaceKind: 'session', surfaceRef: 'session:device-run', label: 'Device run', at: at(13, 50)},
      {mode: 'live', surfaceKind: 'device', surfaceRef: 'device:live:scale-mapping', label: 'Scale mapping', at: at(14, 22)}]),
  },
  fixtures: {
    'A working day': {},
    'The longest trail': {limit: 24},
    'No reading': {stops: undefined, here: undefined, chosen: undefined, reason: 'The workspace book is not open'},
  },

  folded: p => { const s = stopsOf(p.v)?.[0]; return <Folded title="Trail" light="unknown" readings={[s ? time(s.at) : NONE, s ? s.label : NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p)
    return <Panel title="Trail" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={212}>
        <Display w={200} h={146} label="Stops" does={`${DISPLAY_DOES} Press a stop to choose it. Drag handle 1 for the limit.`}><StopList p={p} w={200} h={146} handle press={choose(p)} /></Display>
      </Section>
      <Section label="Macros" width={64}>{c.limit}{c.ret}</Section>
    </Panel> },

  whole: p => { const c = controls(p), stops = stopsOf(p.v), w = wide(p) ? Math.round(clampTo(240, p.room!.w - 220, 600)) : 240
    return <Panel title="Trail" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Stops" does={`${DISPLAY_DOES} Press a stop to choose it. Drag handle 1 for the limit.`}><StopList p={p} w={w} h={146} handle press={choose(p)} /></Display>
        </Section>
        <Section label="Stops" width={64}>{c.limit}<Readout label="kept" does="Stops the book keeps: up to 24." value={stops?.length} tone="value" /></Section>
        <Section label="Return" grow>{c.ret}<Readout label="chosen" does="The stop chosen in the list." value={stops?.find(s => s.ref === strOf(p.v, 'chosen'))?.label} /></Section>
      </Band>
    </Panel> },

  full: p => { const stops = stopsOf(p.v) ?? [], modes = [...new Set(stops.map(s => s.mode))], timed = stops.filter(s => s.at !== undefined)
    const t0 = Math.min(...timed.map(s => s.at!)), t1 = Math.max(...timed.map(s => s.at!)), X = (t: number) => 130 + (t1 > t0 ? (t - t0) / (t1 - t0) : .5) * 590, lane = (m: string) => 60 + modes.indexOf(m) * 52
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The trail in time">
        <g className="dp-display" style={{background: 'none', border: 'none'}}>
          {!stops.length && <text x={20} y={40} className="dp-ink-dim">{strOf(p.v, 'reason') ?? 'No stop yet'}</text>}
          {modes.map(m => <g key={m}><path d={`M120 ${lane(m)}H730`} className="dp-grid" /><text x={110} y={lane(m) + 4} textAnchor="end" className="dp-ink" style={{fill: 'var(--dp-value)'}}>{MODE[m] ?? m}</text></g>)}
          {timed.length > 1 && <path d={timed.slice().reverse().map((s, i) => `${i ? 'L' : 'M'}${X(s.at!).toFixed(1)} ${lane(s.mode)}`).join('')} className="dp-faint" strokeDasharray="3 3" />}
          {timed.map((s, i) => <g key={`${s.ref}-${i}`} style={{cursor: 'pointer'}} onClick={() => p.set('return', s.ref)} data-i={`${s.label}|Return to it.`}>
            <circle cx={X(s.at!)} cy={lane(s.mode)} r={s.ref === strOf(p.v, 'here') ? 6 : 4.5} fill={s.ref === strOf(p.v, 'here') ? 'var(--dp-well)' : 'var(--dp-value)'} stroke={s.ref === strOf(p.v, 'here') ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.5} />
            <text x={X(s.at!)} y={lane(s.mode) - 10} textAnchor="middle" className="dp-ink" style={{fontSize: 10}}>{s.label}</text>
            <text x={X(s.at!)} y={lane(s.mode) + 18} textAnchor="middle" className="dp-axis">{time(s.at)}{s.position ? ` · ${s.position}` : ''}</text>
          </g>)}
        </g>
      </svg>
    </div> },

  widget: p => <Tile title="Trail" light="unknown" span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Stops" does={`${DISPLAY_DOES} Press a stop to return to the same place, page and point.`}><StopList p={p} w={266} h={104} handle={false} press={goBack(p)} /></Display>
  </Tile>,
}
