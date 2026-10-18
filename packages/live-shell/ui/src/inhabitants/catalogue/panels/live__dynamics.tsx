// Dynamics (manual §21.5): the effect after the torus that lowers its loud parts and lifts the whole by makeup. Live's nearest:
// Compressor, whose display shows its transfer curve with the threshold and ratio on it, and Glue Compressor's column of controls.
// The display law is the compressor's own static curve: an input at or under the threshold passes; above it, it rises by 1/Ratio
// of its rise; Makeup lifts the whole. The second display is the gain reduction in time for a burst at full level: it deepens
// toward its full depth with the attack (63 % after one Attack), and returns with the release (to 37 % after one Release).
//
// Owner. The torus's presentation stage (desktop/cradle/expressions-app/field-studies-journeys/src/native-field/presentationEffects.ts,
// after the level, before the device; law in effectsLaw.ts), bound by live/designBindings/torusEffects.ts: the hosted reading carries
// its state (`parameters.effects`) and the stage channel's `effect` instrument edit changes it, refused in the owner's words outside
// its law. It opens off. The value keys are the entry's: light, threshold, ratio, attack, release, makeup; Release goes to 1 s, as the
// browser's compressor does. `reduction` would be the owner's gain reduction now, which the hosted reading does not announce;
// `reason` names an absence in the well. The Live set document's stored tables for Live's Compressor and Glue (packages/live-dynamics
// params.rs COMPRESSOR, GLUE_COMPRESSOR) edit a set's device in Live's own units, not the torus's sound.
import {Band, Dial, Display, Folded, Handle, Panel, Readout, Section, Tile, type LightState} from '../../sdk/panel'
import {NONE, clampTo, has, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const RATIO = {min: 1, max: 20, log: true} as const, ATTACK = {min: .01, max: 200, log: true} as const, RELEASE = {min: 5, max: 1000, log: true} as const
const AXIS = {lo: -60, hi: 6}
const f1 = (x: number) => x.toFixed(1)
const dbWord = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)} dB`
const ratioWord = (x: number) => `${x < 10 ? x.toFixed(1).replace(/\.0$/, '') : Math.round(x)}:1`
const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : x < 1 ? `${x.toFixed(2)} ms` : x < 10 ? `${x.toFixed(1)} ms` : `${Math.round(x)} ms`)

/** The static curve, or undefined while a reading it needs is absent. */
function curveOf(v: V) {
  const t = numOf(v, 'threshold'), r = numOf(v, 'ratio'), m = numOf(v, 'makeup')
  if (t === undefined || r === undefined || m === undefined) return undefined
  return {t, r, m, out: (x: number) => (x <= t ? x : t + (x - t) / r) + m, depth: -t * (1 - 1 / r)}
}

/** The transfer: input across, output up, both −60 to +6 dB. Handle 1 the threshold (on the knee), 2 the ratio (at full input), 3 the
 * makeup (at the quiet end). The compact well carries handle 1 only. */
function Transfer({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 3}) {
  const v = p.v, c = curveOf(v), l = 18, r = w - 4, top = 14, bot = h - 12
  const X = (db: number) => l + (clampTo(AXIS.lo, AXIS.hi, db) - AXIS.lo) / (AXIS.hi - AXIS.lo) * (r - l)
  const Y = (db: number) => bot - (clampTo(AXIS.lo, AXIS.hi, db) - AXIS.lo) / (AXIS.hi - AXIS.lo) * (bot - top)
  const dbX = (x: number) => AXIS.lo + (x - l) / (r - l) * (AXIS.hi - AXIS.lo), dbY = (y: number) => AXIS.lo + (bot - y) / (bot - top) * (AXIS.hi - AXIS.lo)
  const ts = st(p, 'threshold'), rs = st(p, 'ratio'), ms_ = st(p, 'makeup'), reduction = numOf(v, 'reduction')
  return <g>
    {[-48, -36, -24, -12, 0].map(db => <g key={db}><path d={`M${f1(X(db))} ${top}V${bot}M${l} ${f1(Y(db))}H${r}`} className={db ? 'dp-grid' : 'dp-faint'} />
      {w > 100 && <text x={l - 2} y={Y(db) + 3} textAnchor="end" className="dp-axis">{db}</text>}</g>)}
    <path d={`M${f1(X(AXIS.lo))} ${f1(Y(AXIS.lo))}L${f1(X(AXIS.hi))} ${f1(Y(AXIS.hi))}`} className="dp-faint" strokeDasharray="2 3" />
    {c ? <>
      <path d={`M${f1(X(AXIS.lo))} ${f1(Y(c.out(AXIS.lo)))}L${f1(X(c.t))} ${f1(Y(c.out(c.t)))}L${f1(X(AXIS.hi))} ${f1(Y(c.out(AXIS.hi)))}`} className="dp-curve" strokeWidth={1.8} />
      <path d={`M${f1(X(c.t))} ${top}V${bot}`} className="dp-curve-on" strokeDasharray="2 2" opacity={.6} />
      {/* the owner's gain reduction now, where it reports one: the output at full input pulled down by it */}
      {reduction !== undefined && <path d={`M${f1(X(0) - 4)} ${f1(Y(c.out(0) - reduction))}h8`} className="dp-curve-on" strokeWidth={2} />}
      {handles >= 1 && <Handle n={1} x={X(c.t)} y={Y(c.out(c.t))} label="Threshold" does={`Drag across: the level above which the effect acts.${ts.disabled ? ` ${ts.disabled}` : ''}`}
        onDrag={ts.disabled ? undefined : x => p.set('threshold', Math.round(clampTo(-60, 0, dbX(x)) * 10) / 10)} onReset={ts.disabled ? undefined : () => p.set('threshold', -12)} />}
      {handles >= 3 && <Handle n={2} shape="square" x={X(0)} y={Y(c.out(0))} label="Ratio" does={`Drag up or down: how much the effect lowers sound above the threshold.${rs.disabled ? ` ${rs.disabled}` : ''}`}
        onDrag={rs.disabled ? undefined : (_, y) => { const rise = dbY(y) - c.m - c.t; p.set('ratio', Math.round(clampTo(1, 20, rise <= 0 ? 20 : -c.t / rise) * 10) / 10) }}
        onReset={rs.disabled ? undefined : () => p.set('ratio', 4)} />}
      {handles >= 3 && <Handle n={3} shape="square" x={X(-54)} y={Y(c.out(-54))} label="Makeup" does={`Drag up or down: the gain added after the level is lowered.${ms_.disabled ? ` ${ms_.disabled}` : ''}`}
        onDrag={ms_.disabled ? undefined : (_, y) => p.set('makeup', Math.round(clampTo(0, 24, dbY(y) + 54) * 10) / 10)} onReset={ms_.disabled ? undefined : () => p.set('makeup', 2)} />}
    </> : <text x={w / 2 + 6} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the curve'}</text>}
    {w > 100 && <><text x={r} y={bot + 10} textAnchor="end" className="dp-axis">in</text><text x={l + 2} y={top - 4} className="dp-axis">out</text></>}
  </g>
}

/** The gain reduction in time for a burst at full level, on a log scale of time: down is reduction. Handle 1 the attack, 2 the release. */
function Envelope({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: boolean}) {
  const v = p.v, c = curveOf(v), a = numOf(v, 'attack'), rel = numOf(v, 'release'), l = 6, r = w - 6, top = 14, bot = h - 14, burst = 500
  const T = (t: number) => l + Math.log10(Math.max(.01, t) / .01) / Math.log10(5000 / .01) * (r - l), tOf = (x: number) => .01 * (5000 / .01) ** clampTo(0, 1, (x - l) / (r - l))
  if (!c || a === undefined || rel === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the times'}</text>
  const deep = Math.max(.5, c.depth), D = (gr: number) => top + gr / Math.max(12, deep) * (bot - top)
  const gr = (t: number) => (t <= burst ? deep * (1 - Math.exp(-t / a)) : deep * (1 - Math.exp(-burst / a)) * Math.exp(-(t - burst) / rel))
  let d = ''
  for (let i = 0; i <= 200; i++) { const t = .01 * (5000 / .01) ** (i / 200); d += `${i ? 'L' : 'M'}${f1(T(t))} ${f1(D(gr(t)))}` }
  const as = st(p, 'attack'), rs = st(p, 'release')
  return <g>
    {[.1, 1, 10, 100, 1000].map(t => <g key={t}><path d={`M${f1(T(t))} ${top}V${bot}`} className="dp-grid" />
      {(t === 1 || t === 100 || (w > 240 && t !== 1000)) && <text x={T(t) + 2} y={h - 4} className="dp-axis">{t >= 1000 ? `${t / 1000} s` : `${t} ms`}</text>}</g>)}
    <path d={`M${l} ${top}H${r}`} className="dp-faint" />
    <path d={`M${f1(T(burst))} ${top}V${bot}`} className="dp-faint" strokeDasharray="2 3" />
    <path d={`${d}L${r} ${top}L${l} ${top}Z`} className="dp-fill" />
    <path d={d} className="dp-curve" />
    <text x={w - 6} y={top - 4} textAnchor="end" className="dp-axis">{`−${deep.toFixed(1)} dB`}</text>
    {handles && <>
      <Handle n={1} shape="square" x={T(a)} y={D(gr(a))} label="Attack" does={`Drag across: how fast the effect starts.${as.disabled ? ` ${as.disabled}` : ''}`}
        onDrag={as.disabled ? undefined : x => p.set('attack', Math.round(clampTo(.01, 200, tOf(x)) * 100) / 100)} onReset={as.disabled ? undefined : () => p.set('attack', 1)} />
      <Handle n={2} shape="square" x={T(burst + rel)} y={D(gr(burst + rel))} label="Release" does={`Drag across: how fast the effect stops.${rs.disabled ? ` ${rs.disabled}` : ''}`}
        onDrag={rs.disabled ? undefined : x => p.set('release', Math.round(clampTo(5, 2000, tOf(x) - burst)))} onReset={rs.disabled ? undefined : () => p.set('release', 100)} />
    </>}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const l = strOf(p.owner ?? p.v, 'light'); return l === 'lit' || l === 'dark' ? l : 'unknown' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'light').disabled ?? (has(p.v, 'light') ? undefined : 'No reading of on or off: the torus\'s effects report nothing here.'),
  onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const TRANSFER_DOES = 'Input across, output up. Under the threshold the sound passes; above it, it rises by one part in Ratio.'

function controls(p: ViewProps) {
  const v = p.v
  return {
    threshold: <Dial {...st(p, 'threshold')} label="Thresh" does="The level above which the effect acts." value={numOf(v, 'threshold') ?? NaN} def={-12} scale={{min: -60, max: 0}} format={dbWord} onChange={x => p.set('threshold', Math.round(x * 10) / 10)} />,
    ratio: <Dial {...st(p, 'ratio')} label="Ratio" does="How much the effect lowers sound above the threshold." value={numOf(v, 'ratio') ?? NaN} def={4} scale={RATIO} format={ratioWord} onChange={x => p.set('ratio', Math.round(x * 10) / 10)} />,
    attack: <Dial {...st(p, 'attack')} label="Attack" does="How fast the effect starts." value={numOf(v, 'attack') ?? NaN} def={1} scale={ATTACK} format={ms} onChange={x => p.set('attack', Math.round(x * 100) / 100)} />,
    release: <Dial {...st(p, 'release')} label="Release" does="How fast the effect stops." value={numOf(v, 'release') ?? NaN} def={100} scale={RELEASE} format={ms} onChange={x => p.set('release', Math.round(x))} />,
    makeup: <Dial {...st(p, 'makeup')} label="Makeup" does="The gain the effect adds after it lowers the level." value={numOf(v, 'makeup') ?? NaN} def={2} scale={{min: 0, max: 24}} format={dbWord} onChange={x => p.set('makeup', Math.round(x * 10) / 10)} />,
    reduction: <Readout label="GR" does="The gain reduction now, as the owner reports it." value={has(v, 'reduction') ? dbWord(-numOf(v, 'reduction')!) : undefined} tone="accent" />,
  }
}

export const design: DesignedDevice = {
  id: 'live:dynamics',
  title: 'Dynamics',
  kind: 'effect',
  defaults: {light: 'lit', threshold: -12, ratio: 4, attack: 1, release: 100, makeup: 2},
  fixtures: {
    'Even out the torus': {},
    'Hard and slow': {threshold: -30, ratio: 12, attack: 30, release: 800, makeup: 9},
    'No owner reading': {light: undefined, threshold: undefined, ratio: undefined, attack: undefined, release: undefined, makeup: undefined, reason: 'No owner reading in this host'},
  },

  folded: p => <Folded title="Dynamics" light={lightOf(p)} readings={[has(p.v, 'threshold') ? dbWord(numOf(p.v, 'threshold')!) : NONE, has(p.v, 'ratio') ? ratioWord(numOf(p.v, 'ratio')!) : NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Dynamics" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="Transfer" does={`${TRANSFER_DOES} Drag handle 1 for the threshold.`} corner={has(p.v, 'ratio') ? ratioWord(numOf(p.v, 'ratio')!) : NONE}>
          <Transfer p={p} w={140} h={146} handles={1} />
        </Display>
      </Section>
      <Section label="Macros" cols={2}>{c.threshold}{c.ratio}{c.attack}{c.makeup}</Section>
    </Panel> },

  whole: p => { const c = controls(p), cv = curveOf(p.v), w = wide(p) ? Math.round(clampTo(186, (p.room!.w - 300) / 2, 320)) : 186
    return <Panel title="Dynamics" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Transfer" does={`${TRANSFER_DOES} Drag handle 1 for the threshold, 2 for the ratio, 3 for the makeup.`} corner={has(p.v, 'ratio') ? ratioWord(numOf(p.v, 'ratio')!) : NONE}>
            <Transfer p={p} w={w} h={146} handles={3} />
          </Display>
        </Section>
        <Section label="Level" width={60}>{c.threshold}{c.ratio}</Section>
        <Section label="Output" grow>{c.makeup}{c.reduction}</Section>
      </Band>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Gain reduction" does="The gain reduction in time for a burst at full level. Drag handle 1 for the attack and handle 2 for the release.">
            <Envelope p={p} w={w} h={146} handles />
          </Display>
        </Section>
        <Section label="Time" width={60}>{c.attack}{c.release}</Section>
        <Section label="Depth" grow>
          <Readout label="at 0 dB" does="How far the effect lowers a sound at full level, by its curve." value={cv ? dbWord(-cv.depth) : undefined} tone="value" />
        </Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The dynamics curve and its times">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <g transform="translate(20 20)"><Transfer p={{...p, set: () => {}}} w={360} h={360} handles={0} /></g>
        <g transform="translate(400 120)"><Envelope p={{...p, set: () => {}}} w={340} h={180} handles={false} /></g>
        <text x={400} y={330} className="dp-axis">no reading of the torus's level reaches the effect</text>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Dynamics" light={lightOf(p)} onLight={() => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')} lightWhy={head(p).lightWhy} onFull={p.nav.full}>
    <Display w={70} h={100} label="Transfer" does={TRANSFER_DOES}><Transfer p={p} w={70} h={100} handles={0} /></Display>
    <div className="ref-tile-side">
      <Readout label="thresh" value={has(p.v, 'threshold') ? `${numOf(p.v, 'threshold')}` : undefined} tone="value" />
      <Readout label="ratio" value={has(p.v, 'ratio') ? ratioWord(numOf(p.v, 'ratio')!) : undefined} />
      <Readout label="GR" value={has(p.v, 'reduction') ? dbWord(-numOf(p.v, 'reduction')!) : undefined} tone="accent" />
    </div>
  </Tile>,
}
