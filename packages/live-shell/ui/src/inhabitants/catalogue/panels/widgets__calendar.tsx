// Calendar (manual §23.8): what is due around your work, from a third party's provider. A device born on the rail, marked as from
// outside; Live's nearest is the Arrangement's time ruler with its clips laid along it. The display is the span the provider covers:
// the day's hours across (or the week's days), each event a bar from its start to its end, an event tied to this work in amber, the
// present a line. It shows only what its provider supplies.
//
// Owner: the provider the widget comes from. None is installed: no calendar provider, feed or panel exists in the shell (a widget from
// outside would arrive through registerPanel, slot right-dock, with no badge field yet), so every reading here is the entry's and
// `reason` names the absence. The value keys follow the entry: provider, calendars [{id, name}], calendar ('all' or an id), range
// ('day' | 'week'), thisWork, events [{title, start, end, calendar, work}], now, and fullForm (whether the provider supplies a full view).
import {Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const RANGES = [{value: 'day', label: 'Day', does: 'The hours of today.'}, {value: 'week', label: 'Week', does: 'The seven days of this week.'}] as const
interface Event {readonly title: string; readonly start: number; readonly end: number; readonly calendar: string; readonly work: boolean}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function eventsOf(v: V): Event[] | undefined {
  const raw = json<unknown>(v, 'events', undefined)
  if (!Array.isArray(raw)) return undefined
  const cal = strOf(v, 'calendar') ?? 'all', mine = boolOf(v, 'thisWork') === true
  return raw.flatMap((e): Event[] => { if (!rec(e)) return []; const s = Date.parse(String(e.start)), t = Date.parse(String(e.end))
    return Number.isFinite(s) && Number.isFinite(t) ? [{title: String(e.title ?? ''), start: s, end: t, calendar: String(e.calendar ?? ''), work: e.work === true}] : [] })
    .filter(e => (cal === 'all' || e.calendar === cal) && (!mine || e.work)).sort((a, b) => a.start - b.start)
}
const calendarsOf = (v: V) => json<{id: string; name: string}[]>(v, 'calendars', []).filter(c => rec(c) && typeof c.id === 'string')
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The span: hours across for a day, days across for a week, the events as bars. `handle`: the range at the axis's right end — drag
 * right for the week, left for the day. */
function Span({p, w, h, handle, size = 9}: {p: ViewProps; w: number; h: number; handle: boolean; size?: number}) {
  const v = p.v, events = eventsOf(v), now = Date.parse(strOf(v, 'now') ?? ''), week = strOf(v, 'range') === 'week', rs = st(p, 'range')
  if (!events || !Number.isFinite(now)) return <text x={6} y={18} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading from the provider'}</text>
  const d0 = new Date(now); d0.setUTCHours(0, 0, 0, 0); if (week) d0.setUTCDate(d0.getUTCDate() - ((d0.getUTCDay() + 6) % 7))
  const t0 = d0.getTime(), span = (week ? 7 : 1) * 864e5, l = 6, r = w - 6, X = (t: number) => l + clampTo(0, 1, (t - t0) / span) * (r - l)
  const inSpan = events.filter(e => e.end > t0 && e.start < t0 + span), lh = Math.min(size + 7, (h - 30) / Math.max(1, inSpan.length))
  return <g>
    {Array.from({length: week ? 8 : 5}, (_, i) => { const t = t0 + i * (week ? 864e5 : 6 * 36e5); return <g key={i}><path d={`M${X(t).toFixed(1)} 14V${h - 12}`} className="dp-grid" />
      {i < (week ? 7 : 4) && <text x={X(t) + 2} y={h - 3} className="dp-axis">{week ? DAYS[new Date(t).getUTCDay()] : `${String(i * 6).padStart(2, '0')}:00`}</text>}</g> })}
    <path d={`M${X(now).toFixed(1)} 10V${h - 12}`} className="dp-curve-on" />
    {inSpan.map((e, i) => { const y = 18 + i * lh, x = X(e.start), x2 = Math.max(X(e.end), x + 3)
      return <g key={i}>
        <rect x={x} y={y} width={x2 - x} height={lh - 3} fill={e.work ? 'var(--dp-on)' : 'var(--dp-value)'} opacity={e.end < now ? .3 : .7} />
        {(() => { const label = `${hm(e.start)} ${e.title}`, lw = label.length * size * .55, right = x2 + 3 + lw <= r || x - 3 - lw < l
          const room = Math.max(4, Math.floor(((right ? r - x2 - 3 : x - 3 - l)) / (size * .55)))
          return <text x={right ? x2 + 3 : x - 3} y={y + lh - 6} textAnchor={right ? 'start' : 'end'} className="dp-ink" style={{fontSize: size}}>{label.length > room ? `${label.slice(0, room - 1)}…` : label}</text> })()}
      </g> })}
    {!inSpan.length && <text x={l} y={30} className="dp-ink-dim">Nothing due in this span</text>}
    {handle && <Handle n={1} shape="square" x={week ? r - 4 : (l + r) / 2} y={10} label="Range" does={`Drag right for the week, left for the day.${rs.disabled ? ` ${rs.disabled}` : ''}`}
      onDrag={rs.disabled ? undefined : x => { const next = x > (l + r) * .7 ? 'week' : 'day'; if (next !== strOf(v, 'range')) p.set('range', next) }} onReset={rs.disabled ? undefined : () => p.set('range', 'day')} />}
  </g>
}

/** The mark of a widget from outside, before its name: the provider supplies it. */
const Outside = ({v}: {v: V}) => <span data-i={`From outside|Supplied by ${strOf(v, 'provider') ?? 'a provider that is not installed'}. It shows only what its provider supplies.`}
  style={{fontSize: 8, lineHeight: '11px', padding: '0 3px', border: '1px solid var(--text-faint)', color: 'var(--text-dim)'}}>outside</span>
const lightOf = (v: V): LightState => (strOf(v, 'provider') ? 'lit' : 'unknown')
const head = (p: ViewProps) => ({light: lightOf(p.owner ?? p.v), lightWhy: strOf(p.v, 'provider') ? 'The light reads whether the provider answers. It has no switch here.' : 'No provider is installed.',
  onFold: p.nav.fold, onFull: strOf(p.v, 'fullForm') === 'yes' || boolOf(p.v, 'fullForm') === true ? p.nav.full : undefined, mark: <Outside v={p.v} />})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const next = (v: V) => { const now = Date.parse(strOf(v, 'now') ?? ''), e = eventsOf(v)?.find(x => x.start >= now); return e ? `${hm(e.start)} ${e.title}` : undefined }
const DISPLAY_DOES = 'What is due: each event a bar from its start to its end, amber where it is tied to this work. The amber line is now.'

function controls(p: ViewProps) {
  const v = p.v, cals = calendarsOf(v), none = cals.length ? undefined : 'No provider is installed.'
  return {
    calendar: <Chooser {...st(p, 'calendar')} wide label="Calendar" does="Which calendars show." value={strOf(v, 'calendar') ?? 'all'} options={[{value: 'all', label: 'All'}, ...cals.map(c => ({value: c.id, label: c.name}))]}
      onChange={x => p.set('calendar', x)} disabled={st(p, 'calendar').disabled ?? none} />,
    range: <Radio {...st(p, 'range')} label="Range" does="The span the tile shows." value={strOf(v, 'range') ?? ''} options={RANGES} stack onChange={x => p.set('range', x)} disabled={st(p, 'range').disabled ?? none} />,
    mine: <Toggle {...st(p, 'thisWork')} label="This work" does="Show only events tied to the work in front of you." on={boolOf(v, 'thisWork') === true} onChange={x => p.set('thisWork', x)} disabled={st(p, 'thisWork').disabled ?? none} />,
  }
}

export const design: DesignedDevice = {
  id: 'widgets:calendar',
  title: 'Calendar',
  kind: 'instrument',
  defaults: {
    provider: 'a calendar provider', calendar: 'all', range: 'day', thisWork: false, now: '2026-10-16T14:22:00Z', fullForm: true,
    calendars: JSON.stringify([{id: 'work', name: 'Work'}, {id: 'home', name: 'Home'}]),
    events: JSON.stringify([
      {title: 'Stand-up', start: '2026-10-16T09:00:00Z', end: '2026-10-16T09:15:00Z', calendar: 'work', work: false},
      {title: 'Device run review', start: '2026-10-16T15:00:00Z', end: '2026-10-16T16:00:00Z', calendar: 'work', work: true},
      {title: 'Choir', start: '2026-10-16T19:30:00Z', end: '2026-10-16T21:00:00Z', calendar: 'home', work: false},
      {title: 'Land the DLW lane', start: '2026-10-17T10:00:00Z', end: '2026-10-17T12:00:00Z', calendar: 'work', work: true}]),
  },
  fixtures: {
    'A provider\'s day': {},
    'The week': {range: 'week'},
    'No provider installed': {provider: undefined, calendars: undefined, events: undefined, now: undefined, fullForm: false, reason: 'No calendar provider is installed'},
  },

  folded: p => <Folded title="Calendar" light={lightOf(p.v)} readings={[next(p.v) ?? NONE, strOf(p.v, 'range') ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Calendar" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={232}>
        <Display w={220} h={146} label="Due" does={`${DISPLAY_DOES} Drag handle 1 for the day or the week.`}><Span p={p} w={220} h={146} handle /></Display>
      </Section>
      <Section label="Macros" width={96}>{c.calendar}{c.range}{c.mine}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(240, p.room!.w - 260, 640)) : 240
    return <Panel title="Calendar" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Due" does={`${DISPLAY_DOES} Drag handle 1 for the day or the week.`}><Span p={p} w={w} h={146} handle /></Display>
        </Section>
        <Section label="Source" width={64}>{c.calendar}<Readout label="next" does="The next event." value={next(p.v)?.slice(0, 5)} tone="value" /></Section>
        <Section label="View" grow>{c.range}{c.mine}</Section>
      </Band>
    </Panel> },

  full: p => (strOf(p.v, 'fullForm') === 'yes' || boolOf(p.v, 'fullForm') === true)
    ? <div className="ref-pane-body ref-pane-body--dark">
        <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The calendar">
          <g className="dp-display" style={{background: 'none', border: 'none'}}><Span p={{...p, set: () => {}}} w={760} h={410} handle={false} size={12} /></g>
        </svg>
      </div>
    : <div className="ref-pane-body ref-pane-body--dark">
        <svg viewBox="0 0 760 420" width="100%" height="100%" className="ref-pane-svg" aria-label="No full view"><g className="dp-display" style={{background: 'none', border: 'none'}}>
          <text x={380} y={210} textAnchor="middle" className="dp-ink-dim">{strOf(p.v, 'provider') ? 'The provider supplies no full view' : 'No calendar provider is installed'}</text>
        </g></svg>
      </div>,

  widget: p => <Tile title="Calendar" light={lightOf(p.v)} span={2} badge={<Outside v={p.v} />} onFull={strOf(p.v, 'fullForm') === 'yes' || boolOf(p.v, 'fullForm') === true ? p.nav.full : undefined}>
    <Display w={266} h={104} label="Due" does={`${DISPLAY_DOES} Supplied from outside.`}><Span p={p} w={266} h={104} handle={false} size={8.5} /></Display>
  </Tile>,
}
