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
//   chosen   the stop chosen in the list, for Return (the monitor's own).
// Limit is the monitor's own; its top is the book's 24.
//
// A monitor (manual §16.3): it stands on the rail and in a pane, and has two views. The tile is the list of stops, newest first, with
// Limit as handle 1 at its foot; a stop pressed there returns you to it. Full's head carries the stop you stand on, the stops kept,
// the stop chosen, Limit and Return; its body is the stops in time, one lane for each kind of work.
import {Action, Display, Handle, Tile, ValueBox} from '../../sdk/panel'
import {NONE, clampTo, json, numOf, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane, MonitorPicture} from './monitor'

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
 * `press`: what a row does (on the rail, return to it); `does`, what the status bar says it does. */
function StopList({p, w, h, handle, press, does, size = 9}: {p: ViewProps; w: number; h: number; handle: boolean; press: (s: Stop) => void; does: string; size?: number}) {
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
        <text x={6 + size * 10.4} y={y} className={on ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: size}}>{s.label.slice(0, Math.max(4, Math.floor((w - size * 10.4 - 12) / (size * .52))))}</text>
        {on && <circle cx={w - 7} cy={y - size * .35} r={3} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
        <rect x={0} y={y - size} width={w} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={`${s.label}, ${MODE[s.mode] ?? s.mode}`}
          data-i={`${s.label}|${MODE[s.mode] ?? s.mode}, ${s.kind || 'a place'}${s.position ? `, at ${s.position}` : ''}. ${does}`}
          onClick={() => press(s)} onKeyDown={e => { if (e.key === 'Enter') press(s) }} />
      </g> })}
    {handle && <Handle n={1} shape="square" x={w / 2} y={Math.min(h - 4, foot + 2)} label="Limit" does={`Drag down for more stops, up for fewer: 8 to 24.${ls.disabled ? ` ${ls.disabled}` : ''}`}
      onDrag={ls.disabled ? undefined : (_, y) => { const n = clampTo(LIMIT.min, LIMIT.max, Math.round((y - 4) / lh)); if (n !== limit) p.set('limit', n) }} onReset={ls.disabled ? undefined : () => p.set('limit', LIMIT.min)} />}
    {stops.length > shown.length && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{stops.length - shown.length}</text>}
  </g>
}

const LIGHT_WHY = 'Trail has no on or off: it keeps every move. The light stays hollow.'
const goBack = (p: ViewProps) => (s: Stop) => { p.set('chosen', s.ref); p.set('return', s.ref) }
const DISPLAY_DOES = 'Every place you went, newest at the top: its time, its kind of work and its place. The ringed stop is where you stand.'

/** Full's head: where you stand, the stops kept, the stop chosen; Limit and Return. */
function Head({p}: {p: ViewProps}) {
  const v = p.v, stops = stopsOf(v), chosen = stops?.find(s => s.ref === strOf(v, 'chosen')), here = stops?.find(s => s.ref === strOf(v, 'here'))
  return <MonitorHead title="Trail" readings={[
    {label: 'here', value: here?.label, does: 'The stop you stand on now.', tone: 'accent'},
    {label: 'kept', value: stops ? `${stops.length}/${LIMIT.max}` : undefined, does: 'Stops the book keeps: up to 24.', tone: 'value'},
    {label: 'chosen', value: chosen?.label, does: 'The stop chosen in the list.'},
  ]} controls={<>
    <ValueBox {...st(p, 'limit')} label="Limit" does="How many stops the tile shows: 8 to 24, the most the book keeps." value={numOf(v, 'limit') ?? NaN} def={LIMIT.min}
      scale={{min: LIMIT.min, max: LIMIT.max, step: 1}} format={x => String(x)} onChange={x => p.set('limit', x)} />
    <Action {...st(p, 'return')} label="Return" does={chosen ? `Return to ${chosen.label}: the same place, page and point.` : 'Choose a stop, then return to it.'}
      onPress={chosen ? () => p.set('return', chosen.ref) : undefined} />
  </>} />
}

/** The stops in time across the room, one lane for each kind of work; the stop you stand on ringed in amber, the chosen one marked. */
function Lanes({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const stops = stopsOf(p.v) ?? [], modes = [...new Set(stops.map(s => s.mode))], timed = stops.filter(s => s.at !== undefined), here = strOf(p.v, 'here'), chosen = strOf(p.v, 'chosen')
  const t0 = Math.min(...timed.map(s => s.at!)), t1 = Math.max(...timed.map(s => s.at!)), l = 130, r = w - 40
  const X = (t: number) => l + (t1 > t0 ? (t - t0) / (t1 - t0) : .5) * (r - l), pitch = Math.min(64, (h - 50) / Math.max(1, modes.length)), lane = (m: string) => 44 + modes.indexOf(m) * pitch
  return <g>
    {!stopsOf(p.v) && <text x={20} y={40} className="dp-ink-dim">{strOf(p.v, 'reason') ?? 'No reading of the trail'}</text>}
    {stopsOf(p.v) && !stops.length && <text x={20} y={40} className="dp-ink-dim">No stop yet</text>}
    {modes.map(m => <g key={m}><path d={`M${l - 10} ${lane(m)}H${r + 10}`} className="dp-grid" /><text x={l - 20} y={lane(m) + 4} textAnchor="end" className="dp-ink" style={{fill: 'var(--dp-value)'}}>{MODE[m] ?? m}</text></g>)}
    {timed.length > 1 && <path d={timed.slice().reverse().map((s, i) => `${i ? 'L' : 'M'}${X(s.at!).toFixed(1)} ${lane(s.mode)}`).join('')} className="dp-faint" strokeDasharray="3 3" />}
    {timed.map((s, i) => { const on = s.ref === here, pick = s.ref === chosen
      return <g key={`${s.ref}-${i}`} role="button" tabIndex={0} aria-label={`Return to ${s.label}`} onClick={() => goBack(p)(s)} onKeyDown={e => { if (e.key === 'Enter') goBack(p)(s) }}
        data-i={`${s.label}|${MODE[s.mode] ?? s.mode}, ${s.kind || 'a place'}${s.position ? `, at ${s.position}` : ''}. Press to return to it.`}>
        {pick && <circle cx={X(s.at!)} cy={lane(s.mode)} r={10} fill="var(--sel, #7ec3e6)" opacity={.22} />}
        <circle cx={X(s.at!)} cy={lane(s.mode)} r={on ? 6 : 4.5} fill={on ? 'var(--dp-well)' : 'var(--dp-value)'} stroke={on ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.5} />
        <text x={X(s.at!)} y={lane(s.mode) - 11} textAnchor="middle" className="dp-ink" style={{fontSize: 10.5}}>{s.label}</text>
        <text x={X(s.at!)} y={lane(s.mode) + 19} textAnchor="middle" className="dp-axis">{time(s.at)}{s.position ? ` · ${s.position}` : ''}</text>
      </g> })}
  </g>
}

const at = (h: number, m: number) => Date.UTC(2026, 9, 16, h, m)

export const design = railAndPane({
  id: 'widgets:trail',
  title: 'Trail',
  kind: 'monitor',
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

  full: p => <MonitorPane dark label="Trail" head={<Head p={p} />}>{room => <MonitorPicture room={room} label="The trail in time"><Lanes p={p} w={room.w} h={room.h} /></MonitorPicture>}</MonitorPane>,

  widget: p => <Tile title="Trail" light="unknown" lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Stops" does={`${DISPLAY_DOES} Press a stop to return to the same place, page and point. Drag handle 1 for the limit.`}>
      <StopList p={p} w={266} h={104} handle size={8} press={goBack(p)} does="Press to return to it." />
    </Display>
  </Tile>,
})
