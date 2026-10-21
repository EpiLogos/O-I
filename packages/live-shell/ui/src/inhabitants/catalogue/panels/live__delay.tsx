// Delay (manual §21.5): the effect after the torus that repeats its sound after a time. Live's nearest: Delay — the time as sync
// divisions or milliseconds at the left, a display in the middle, Feedback and Dry/Wet. The display law is the delay line itself:
// the dry sound at zero, then a repeat every Time, the first at Mix and each next one Feedback times the one before; Tone darkens
// each pass, so the bright part of a repeat (the inner bar) falls faster than its whole. Time runs across on a square-root scale,
// so a 10 ms slap and a 4 s echo both read. Synced, Time is the note length at the set's tempo.
//
// Owner. The torus's presentation stage (desktop/cradle/expressions-app/field-studies-journeys/src/native-field/presentationEffects.ts,
// after the level, before the device; law in effectsLaw.ts), bound by live/designBindings/torusEffects.ts: the hosted reading carries
// its state (`parameters.effects`) and the stage channel's `effect` instrument edit changes it, refused in the owner's words outside
// its law. It opens off. The value keys are the entry's: light, sync, division, time, feedback, tone, mix, and `tempo`, the tempo the
// owner's delay syncs to; Time starts at 6 ms (a browser's feedback loop takes two render quanta). `reason` names an absence in the
// well. The Live set document's stored table for Live's Delay (packages/live-dynamics params.rs DELAY) edits a set's device, not
// the torus's sound.
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {feedbackForSecond} from './handleLaws'

type V = ViewProps['v']

const DIVISIONS = [{value: '1/32', label: '1/32', beats: .125}, {value: '1/16', label: '1/16', beats: .25}, {value: '1/8', label: '1/8', beats: .5},
  {value: '1/4', label: '1/4', beats: 1}, {value: '1/2', label: '1/2', beats: 2}, {value: '1', label: '1 bar', beats: 4}] as const
const TIME = {min: 6, max: 4000, log: true} as const, TONE = {min: 200, max: 12000, log: true} as const, SPAN = 4000
const f1 = (x: number) => x.toFixed(1)
const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${Math.round(x)} ms`)
const hz = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} kHz` : `${Math.round(x)} Hz`)
const pct = (x: number) => `${Math.round(x)} %`

/** The time between repeats in ms: the note length at the tempo when synced, the time itself when not. Undefined while absent. */
function timeOf(v: V): number | undefined {
  const sync = boolOf(v, 'sync')
  if (sync === undefined) return undefined
  if (!sync) return numOf(v, 'time')
  const div = DIVISIONS.find(d => d.value === strOf(v, 'division')), tempo = numOf(v, 'tempo')
  return div && tempo !== undefined && tempo > 0 ? 60000 / tempo * div.beats : undefined
}
const timeWord = (v: V) => { const t = timeOf(v); return boolOf(v, 'sync') ? DIVISIONS.find(d => d.value === strOf(v, 'division'))?.label : t === undefined ? undefined : ms(t) }

/** The repeats: the dry sound and each repeat as a bar, its bright part inside it. Handle 1 stands on top of the first repeat: across it
 * moves the time, up or down the mix. Handle 2 stands on top of the second, at twice the time: across it moves the time, up or down the
 * feedback. Where Sync is on, the note length holds the time and only the heights move. */
function Repeats({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2}) {
  const v = p.v, t = timeOf(v), fb = numOf(v, 'feedback'), tone = numOf(v, 'tone'), mix = numOf(v, 'mix'), l = 8, r = w - 6, top = 16, bot = h - 14
  const X = (ms: number) => l + Math.sqrt(clampTo(0, SPAN, ms) / SPAN) * (r - l), msOf = (x: number) => SPAN * clampTo(0, 1, (x - l) / (r - l)) ** 2
  const Y = (a: number) => bot - clampTo(0, 1, a) * (bot - top), aOf = (y: number) => clampTo(0, 1, (bot - y) / (bot - top))
  const ts = st(p, 'time'), fs = st(p, 'feedback'), xs = st(p, 'mix'), synced = boolOf(v, 'sync') === true
  if (t === undefined || fb === undefined || tone === undefined || mix === undefined) return <g>
    <path d={`M${l} ${bot}H${r}`} className="dp-faint" />
    <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? (synced && !has(v, 'tempo') ? 'No reading of the tempo' : 'No reading of the delay')}</text>
  </g>
  const m = mix / 100, f = fb / 100, bright = Math.log(tone / TONE.min) / Math.log(TONE.max / TONE.min)
  const reps = Array.from({length: 40}, (_, i) => i + 1).filter(n => n * t <= SPAN && m * f ** (n - 1) > .004)
  const bw = Math.max(2, Math.min(6, (X(t) - X(0)) * .4))
  return <g>
    {[100, 500, 1000, 2000].map(g => <g key={g}><path d={`M${f1(X(g))} ${top}V${bot}`} className="dp-grid" />{w > 100 && <text x={X(g) + 2} y={h - 4} className="dp-axis">{g >= 1000 ? `${g / 1000} s` : `${g} ms`}</text>}</g>)}
    <path d={`M${l} ${bot}H${r}`} className="dp-faint" />
    <rect x={X(0) - 1} y={Y(1 - m)} width={3} height={bot - Y(1 - m)} fill="var(--text)" opacity={.55} />
    {reps.map(n => { const a = m * f ** (n - 1), b = a * bright ** n, x = X(n * t)
      return <g key={n}><rect x={x - bw / 2} y={Y(a)} width={bw} height={bot - Y(a)} className="dp-fill" stroke="var(--dp-value)" strokeWidth={.8} />
        <rect x={x - bw / 4} y={Y(b)} width={bw / 2} height={bot - Y(b)} fill="var(--dp-value)" /></g> })}
    {handles >= 1 && <Handle n={1} x={X(t)} y={Y(m)} shape="ring" label="Time and mix"
      does={`Drag across for the time between repeats, up or down for how loud the repeats are.${synced ? ' The note length sets the time while Sync is on.' : ts.disabled ? ` ${ts.disabled}` : ''}${xs.disabled ? ` ${xs.disabled}` : ''}`}
      onDrag={(synced || ts.disabled) && xs.disabled ? undefined : (x, y) => { if (!synced && !ts.disabled) p.set('time', Math.round(clampTo(TIME.min, TIME.max, msOf(x)))); if (!xs.disabled) p.set('mix', Math.round(aOf(y) * 100)) }}
      onReset={(synced || ts.disabled) && xs.disabled ? undefined : () => { if (!synced && !ts.disabled) p.set('time', 250); if (!xs.disabled) p.set('mix', 25) }} />}
    {handles >= 2 && reps.includes(2) && <Handle n={2} shape="square" x={X(2 * t)} y={Y(m * f)} label="Time and feedback"
      does={`Drag across for the time between repeats, up or down for how much of each repeat returns.${synced ? ' The note length sets the time while Sync is on.' : ts.disabled ? ` ${ts.disabled}` : ''}${fs.disabled ? ` ${fs.disabled}` : ''}`}
      onDrag={(synced || ts.disabled) && (fs.disabled || m <= 0) ? undefined : (x, y) => { if (!synced && !ts.disabled) p.set('time', Math.round(clampTo(TIME.min, TIME.max, msOf(x) / 2))); if (!fs.disabled && m > 0) p.set('feedback', feedbackForSecond(aOf(y), mix)) }}
      onReset={(synced || ts.disabled) && fs.disabled ? undefined : () => { if (!synced && !ts.disabled) p.set('time', 250); if (!fs.disabled) p.set('feedback', 35) }} />}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const l = strOf(p.owner ?? p.v, 'light'); return l === 'lit' || l === 'dark' ? l : 'unknown' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'light').disabled ?? (has(p.v, 'light') ? undefined : 'No reading of on or off: the torus\'s effects report nothing here.'),
  onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const DISPLAY_DOES = 'The dry sound at zero, then each repeat: its height its level, the bar inside it its bright part.'

function controls(p: ViewProps) {
  const v = p.v, synced = boolOf(v, 'sync') === true
  return {
    sync: <Toggle {...st(p, 'sync')} label="Sync" does="On: the time is a note length at the set's tempo. Off: a time in milliseconds." on={synced} unknown={boolOf(v, 'sync') === undefined} onChange={x => p.set('sync', x)} />,
    time: synced
      ? <Dial {...st(p, 'division')} label="Time" does="The note length between repeats." value={DIVISIONS.findIndex(d => d.value === strOf(v, 'division'))} def={2}
          scale={{min: 0, max: DIVISIONS.length - 1, step: 1}} format={i => DIVISIONS[i]?.label ?? NONE} onChange={i => p.set('division', DIVISIONS[i]!.value)} />
      : <Dial {...st(p, 'time')} label="Time" does="The time between repeats." value={numOf(v, 'time') ?? NaN} def={250} scale={TIME} format={ms} onChange={x => p.set('time', Math.round(x))} />,
    division: <Chooser {...st(p, 'division')} label="Note" does="The note length between repeats, while Sync is on." value={strOf(v, 'division') ?? ''} options={DIVISIONS.map(d => ({value: d.value, label: d.label}))}
      onChange={x => p.set('division', x)} disabled={st(p, 'division').disabled ?? (synced ? undefined : 'Sync is off: the time is in milliseconds.')} />,
    feedback: <Dial {...st(p, 'feedback')} label="Feedback" does="How much of each repeat returns." value={numOf(v, 'feedback') ?? NaN} def={35} scale={{min: 0, max: 95}} format={pct} onChange={x => p.set('feedback', Math.round(x))} />,
    tone: <Dial {...st(p, 'tone')} label="Tone" does="How dark the repeats are: lower is darker." value={numOf(v, 'tone') ?? NaN} def={6000} scale={TONE} format={hz} onChange={x => p.set('tone', Math.round(x))} />,
    mix: <Dial {...st(p, 'mix')} label="Mix" does="How loud the repeats are." value={numOf(v, 'mix') ?? NaN} def={25} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('mix', Math.round(x))} />,
  }
}

export const design: DesignedDevice = {
  id: 'live:delay',
  title: 'Delay',
  kind: 'effect',
  defaults: {light: 'lit', sync: true, division: '1/8', time: 250, feedback: 35, tone: 6000, mix: 25, tempo: 120},
  fixtures: {
    'An eighth at 120': {},
    'A long dark echo': {sync: false, time: 900, feedback: 70, tone: 900, mix: 40},
    'No tempo': {tempo: undefined},
    'No owner reading': {light: undefined, sync: undefined, division: undefined, time: undefined, feedback: undefined, tone: undefined, mix: undefined, reason: 'No owner reading in this host'},
  },

  folded: p => <Folded title="Delay" light={lightOf(p)} readings={[timeWord(p.v) ?? NONE, has(p.v, 'feedback') ? pct(numOf(p.v, 'feedback')!) : NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Delay" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="Repeats" does={`${DISPLAY_DOES} Drag handle 1 across for the time and up or down for the mix.`} corner={timeOf(p.v) === undefined ? NONE : ms(timeOf(p.v)!)}>
          <Repeats p={p} w={140} h={146} handles={1} />
        </Display>
      </Section>
      <Section label="Macros" cols={2}>{c.time}{c.feedback}{c.tone}{c.mix}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 260, 520)) : 186, t = timeOf(p.v)
    return <Panel title="Delay" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Repeats" does={`${DISPLAY_DOES} Drag handle 1 across for the time and up or down for the mix, handle 2 across for the time and up or down for the feedback.`} corner={t === undefined ? NONE : ms(t)}>
            <Repeats p={p} w={w} h={146} handles={2} />
          </Display>
        </Section>
        <Section label="Time" width={66}>{c.sync}{c.division}{boolOf(p.v, 'sync') === true
          ? <Readout label="ms" does="The note length at the set's tempo." value={t === undefined ? undefined : ms(t)} tone="value" /> : c.time}</Section>
        <Section label="Repeats" width={60}>{c.feedback}{c.tone}</Section>
        <Section label="Output" grow>{c.mix}<Readout label="tempo" does="The set's tempo, from the transport." value={numOf(p.v, 'tempo')} /></Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The delay's repeats">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Repeats p={{...p, set: () => {}}} w={760} h={392} handles={0} />
        <text x={18} y={410} className="dp-axis">{[timeWord(p.v), has(p.v, 'feedback') ? `feedback ${pct(numOf(p.v, 'feedback')!)}` : undefined].filter(Boolean).join(' · ') || NONE} · no reading of the torus's sound reaches the delay</text>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Delay" light={lightOf(p)} onLight={() => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')} lightWhy={head(p).lightWhy} onFull={p.nav.full}>
    <Display w={70} h={100} label="Repeats" does={DISPLAY_DOES}><Repeats p={p} w={70} h={100} handles={0} /></Display>
    <div className="ref-tile-side">
      <Readout label="time" value={timeWord(p.v)} tone="value" />
      <Readout label="feedback" value={has(p.v, 'feedback') ? pct(numOf(p.v, 'feedback')!) : undefined} />
      <Readout label="mix" value={has(p.v, 'mix') ? pct(numOf(p.v, 'mix')!) : undefined} />
    </div>
  </Tile>,
}
