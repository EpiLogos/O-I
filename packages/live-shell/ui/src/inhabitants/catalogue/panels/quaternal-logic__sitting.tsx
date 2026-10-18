// Sitting (manual §24.3): a still time with a bell to begin and end it, and a record that you sat. Live's nearest: a Clip's loop
// brace over a ring — one display of the time itself. The display is the sitting by its own law: a ring that empties as the time
// passes, the bell's marks round it at the start, each interval and the end, and the seven centres standing up the spine at its
// centre, the one you rest on lit. With Focus on the breath nothing is lit; on an inquiry its question stands under the spine.
//
// Owners, to be built (T-WORLDS §6, W4):
//   the record     a sitting is a page on the practice world, made and closed through the page owner op (W2): `started`, `length`
//                  (the minutes set) and `sat` (the minutes actually sat — Stop keeps that), `focus`, `centre`, `inquiry`, `note`
//   the bell       the field's own sound: the torus rings `bell` (a note of the set's scale) through the native field's presentation
//   the time       the transport: `playing`, `elapsed` (seconds) are readings of the transport while the sitting plays
//   the centres    the personal field's seven centres as their sources give them (`ql.scene/v1` `centres[7]`, as Chakra reads them):
//                  [{ordinal, name}]; absent, the spine draws plain and says so
//   today          the day's sittings, JSON [{at 'HH:MM', minutes}], for the widget
// Nothing here scores a sitting or derives how you are: the centres are drawn as their sources give them, never from the sitting.
import {Band, Chooser, Display, Folded, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const FOCI = [{value: 'breath', label: 'Breath', does: 'Rest your attention on the breath.'}, {value: 'centre', label: 'A centre', does: 'Rest on one centre of the body; the field lights it.'},
  {value: 'inquiry', label: 'An inquiry', does: 'Hold a question: what is here now, then what you notice about it.'}, {value: 'open', label: 'Open', does: 'Rest on nothing in particular.'}] as const
const INTERVALS = [{value: '0', label: 'Off'}, {value: '5', label: '5 min'}, {value: '10', label: '10 min'}, {value: '15', label: '15 min'}, {value: '30', label: '30 min'}] as const
const AFTER = [{value: 'write', label: 'Write a line', does: 'When the bell ends the sitting, a line opens in your journal.'}, {value: 'nothing', label: 'Nothing', does: 'The sitting ends with the bell.'}] as const
const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const BELLS = [{value: 'off', label: 'Off'}, ...NOTES.map(n => ({value: n, label: n}))]

interface Centre {readonly ordinal: number; readonly name: string}
const centresOf = (v: V): readonly Centre[] | undefined => {
  const raw = json<unknown>(v, 'centres', undefined)
  return Array.isArray(raw) && raw.length === 7 ? raw.map((c, i) => ({ordinal: Number((c as Centre).ordinal ?? i + 1), name: String((c as Centre).name ?? '')})) : undefined
}
const lengthOf = (v: V) => numOf(v, 'length')
const minutes = (x: number) => `${Math.round(x)} min`
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const light = (p: ViewProps): LightState => (boolOf(p.owner ?? p.v, 'playing') === undefined ? 'unknown' : boolOf(p.owner ?? p.v, 'playing') ? 'lit' : 'dark')

/** The ring of time, the bell marks, and the centres up the spine. */
function Picture({v, w, h, small}: {v: V; w: number; h: number; small: boolean}) {
  const len = lengthOf(v), elapsed = numOf(v, 'elapsed') ?? 0, every = Number(strOf(v, 'intervals') ?? 0), focus = strOf(v, 'focus'), chosen = strOf(v, 'centre')
  const cx = w / 2, cy = h / 2 - (small ? 0 : 6), R = Math.min(w, h) * (small ? .4 : .36)
  if (len === undefined) return <text x={cx} y={cy} textAnchor="middle" className="dp-ink-dim">No reading of the sitting</text>
  const left = clampTo(0, 1, 1 - elapsed / (len * 60)), a0 = -Math.PI / 2, a1 = a0 + left * Math.PI * 2
  const arc = left >= 1 ? '' : `M${cx} ${cy - R}A${R} ${R} 0 ${left > .5 ? 1 : 0} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`
  const marks = [0, ...(every > 0 ? Array.from({length: Math.floor((len - .01) / every)}, (_, i) => (i + 1) * every) : [])]
  const centres = centresOf(v), spineTop = cy - R * .62, spineBottom = cy + R * .62
  return <g>
    <circle cx={cx} cy={cy} r={R} className="dp-faint" />
    {left >= 1 ? <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--dp-value)" strokeWidth={small ? 2 : 3} />
      : left > 0 && <path d={arc} fill="none" stroke="var(--dp-value)" strokeWidth={small ? 2 : 3} />}
    {strOf(v, 'bell') !== 'off' && marks.map(m => { const a = -Math.PI / 2 + (m / len) * Math.PI * 2
      return <circle key={m} cx={cx + R * Math.cos(a)} cy={cy + R * Math.sin(a)} r={small ? 1.6 : 2.4} fill="var(--accent)" /> })}
    <line x1={cx} y1={spineTop} x2={cx} y2={spineBottom} className="dp-faint" />
    {Array.from({length: 7}, (_, i) => {
      const c = centres?.[i], y = spineBottom - i * (spineBottom - spineTop) / 6, lit = focus === 'centre' && c !== undefined && c.name === chosen
      return <g key={i}>
        <circle cx={cx} cy={y} r={small ? 2.2 : 3.4} fill={lit ? 'var(--accent)' : 'none'} stroke={lit ? 'var(--accent)' : 'var(--text-dim)'} strokeWidth={1} />
        {lit && !small && <text x={cx + 9} y={y + 3} className="dp-ink">{c!.name}</text>}
      </g>
    })}
    {!small && <text x={cx} y={cy + R + 14} textAnchor="middle" className="dp-ink-dim">
      {boolOf(v, 'playing') ? `${clock(Math.max(0, len * 60 - elapsed))} left` : focus === 'inquiry' ? (strOf(v, 'inquiry') ?? 'No question yet') : centres ? minutes(len) : 'No reading of your centres'}
    </text>}
  </g>
}

const DOES = 'The sitting: the ring empties as the time passes; the bell rings at each mark; the centre you rest on is lit.'

function controls(p: ViewProps) {
  const centres = centresOf(p.v)
  return {
    length: <Readout label="length" value={lengthOf(p.v) === undefined ? undefined : minutes(lengthOf(p.v)!)} does="How long the sitting lasts. Turn it in Whole." />,
    lengthBox: <Chooser {...st(p, 'length')} label="Length" does="How long the sitting lasts, from 1 to 120 minutes." value={String(lengthOf(p.v) ?? '')}
      options={[5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120].map(m => ({value: String(m), label: minutes(m)}))} onChange={x => p.set('length', Number(x))} />,
    bell: <Chooser {...st(p, 'bell')} label="Bell" does="The note the torus rings at the start, the intervals and the end." value={strOf(p.v, 'bell') ?? ''} options={BELLS} onChange={x => p.set('bell', x)} />,
    intervals: <Chooser {...st(p, 'intervals')} label="Intervals" does="Rings the bell during the sitting." value={strOf(p.v, 'intervals') ?? ''} options={INTERVALS} onChange={x => p.set('intervals', x)} />,
    focus: <Radio {...st(p, 'focus')} label="Focus" does="What you rest your attention on." value={strOf(p.v, 'focus') ?? ''} options={FOCI} stack onChange={x => p.set('focus', x)} />,
    centre: <Chooser {...st(p, 'centre')} label="Centre" does="The centre you rest on; the field lights it." value={strOf(p.v, 'centre') ?? ''}
      options={(centres ?? []).map(c => ({value: c.name, label: c.name}))} disabled={strOf(p.v, 'focus') !== 'centre' ? 'Choose A centre as the focus first.' : centres ? st(p, 'centre').disabled : 'No reading of your centres.'}
      onChange={x => p.set('centre', x)} />,
    inquiry: <TextField {...st(p, 'inquiry')} label="Inquiry" does="The question you hold." value={strOf(p.v, 'inquiry') ?? ''}
      disabled={strOf(p.v, 'focus') !== 'inquiry' ? 'Choose An inquiry as the focus first.' : st(p, 'inquiry').disabled} onChange={x => p.set('inquiry', x)} />,
    after: <Chooser {...st(p, 'after')} label="After" does="What opens when the bell ends the sitting." value={strOf(p.v, 'after') ?? ''} options={AFTER} onChange={x => p.set('after', x)} />,
    playing: <Toggle {...st(p, 'playing')} label="Sit" does="Rings the bell and begins; press again to end now. The sitting keeps the time you actually sat."
      on={boolOf(p.v, 'playing') === true} unknown={boolOf(p.v, 'playing') === undefined} onChange={x => p.set('playing', x)} />,
  }
}

const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const today = (v: V) => json<{at: string; minutes: number}[] | undefined>(v, 'today', undefined)

export const design: DesignedDevice = {
  id: 'quaternal-logic:sitting',
  title: 'Sitting',
  kind: 'instrument',
  defaults: {
    length: 20, bell: 'D', intervals: '0', focus: 'centre', centre: 'Anāhata', inquiry: '', after: 'write', playing: false, elapsed: 0,
    centres: JSON.stringify([{ordinal: 1, name: 'Mūlādhāra'}, {ordinal: 2, name: 'Svādhiṣṭhāna'}, {ordinal: 3, name: 'Maṇipūra'}, {ordinal: 4, name: 'Anāhata'},
      {ordinal: 5, name: 'Viśuddha'}, {ordinal: 6, name: 'Ājñā'}, {ordinal: 7, name: 'Sahasrāra'}]),
    today: JSON.stringify([{at: '06:40', minutes: 20}, {at: '21:15', minutes: 12}]),
  },
  fixtures: {
    'Before sitting': {},
    'Twelve minutes in, with intervals': {playing: true, elapsed: 720, intervals: '5'},
    'An inquiry': {focus: 'inquiry', inquiry: 'What is here when I stop deciding?', length: 30},
    'As the shell has it': {centres: undefined, today: undefined, playing: undefined, elapsed: undefined},
  },

  folded: p => <Folded title="Sitting" light={light(p)} readings={[lengthOf(p.v) === undefined ? NONE : minutes(lengthOf(p.v)!), FOCI.find(f => f.value === strOf(p.v, 'focus'))?.label ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Sitting" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><Display w={140} h={146} label="The sitting" does={DOES}><Picture v={p.v} w={140} h={146} small /></Display></Section>
      <Section label="Macros" cols={2} width={140}>{c.lengthBox}{c.bell}{c.intervals}{c.playing}</Section>
    </Panel> },

  whole: p => { const c = controls(p)
    return <Panel title="Sitting" view="whole" {...head(p)}>
      <Band>
        <Section width={198}><Display w={186} h={146} label="The sitting" does={DOES}><Picture v={p.v} w={186} h={146} small={false} /></Display></Section>
        <Section label="Time" width={96}>{c.lengthBox}{c.bell}{c.intervals}{c.playing}</Section>
        <Section label="Focus" width={92}>{c.focus}</Section>
        <Section label="Rest on" grow>{c.centre}{c.inquiry}{c.after}</Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The sitting">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><Picture v={p.v} w={760} h={420} small={false} /></g>
    </svg>
  </div>,

  widget: p => { const list = today(p.v)
    return <Tile title="Sitting" light={light(p)} span={1} onFull={p.nav.full}>
      <Display w={112} h={90} label="Today's sittings" does="Today's sittings and how long each lasted. Press ▦ to open a sitting in the pane that has focus.">
        {list ? list.slice(0, 4).map((s, i) => <text key={i} x={8} y={18 + i * 18} className="dp-ink">{`${s.at}  ${minutes(s.minutes)}`}</text>)
          : <text x={56} y={48} textAnchor="middle" className="dp-ink-dim">No reading of today</text>}
      </Display>
    </Tile> },
}
