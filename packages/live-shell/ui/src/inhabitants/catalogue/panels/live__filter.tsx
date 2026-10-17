// Filter (manual §21.5): the effect after the torus that cuts or lifts a range of its frequencies. Live's nearest: Auto Filter — a well
// that draws the filter's response with one handle at the cutoff, the filter types under it, Frequency and Resonance beside it. The
// display law is the filter's own response: a two-pole filter (the RBJ biquad, at 48 kHz) of the chosen type at the cutoff, its Q
// rising with Resonance so that a low- or high-pass rings to −3 dB at 0 % and +21 dB at 100 %; Drive lifts the signal before the
// filter; Mix blends the filtered sound with the dry: |Mix·H + (1 − Mix)|. Every mark is drawn from the values by that law.
//
// Owner. None yet: the torus sounds through one gain stage to the output (desktop/cradle/expressions-app/field-studies-journeys/src/
// native-field/ql/native-audio.mjs: a buffer source into a gain node into the destination), so no filter stands on its sound. The
// value keys are the entry's: light, type, cutoff, resonance, drive, mix; `reason` names the absence in the well. The Live set
// document carries stored tables for Live's own Auto Filter (packages/live-dynamics params.rs AUTOFILTER, kernel live_device_param_write);
// those edit a set's device in Live's own units, not the torus's sound, and are not this device's owner.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, type LightState} from '../../sdk/panel'
import {NONE, clampTo, has, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const TYPES = [{value: 'lowpass', label: 'LP', does: 'Low-pass: keep what is below the cutoff.'}, {value: 'highpass', label: 'HP', does: 'High-pass: keep what is above the cutoff.'},
  {value: 'bandpass', label: 'BP', does: 'Band-pass: keep a band round the cutoff.'}, {value: 'notch', label: 'Notch', does: 'Notch: cut a band round the cutoff.'}] as const
const CUTOFF = {min: 20, max: 20000, log: true} as const
const FS = 48000, DB = {lo: -30, hi: 30}

// ---------------------------------------------------------------- the law

/** Q from Resonance: the low-pass peak at the cutoff runs from −3 dB at 0 % to +21 dB at 100 %. */
const qOf = (res: number) => Math.SQRT1_2 * 10 ** (1.2 * res / 100)
/** The filter's transfer at f, a complex number, as the biquad's own transfer function. */
function transfer(type: string, fc: number, q: number, f: number): {re: number; im: number} {
  const w0 = 2 * Math.PI * fc / FS, cw = Math.cos(w0), a = Math.sin(w0) / (2 * q)
  const b = type === 'highpass' ? [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2] : type === 'bandpass' ? [a, 0, -a] : type === 'notch' ? [1, -2 * cw, 1] : [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
  const d = [1 + a, -2 * cw, 1 - a], w = 2 * Math.PI * f / FS
  const re = (c: number[]) => c[0]! + c[1]! * Math.cos(w) + c[2]! * Math.cos(2 * w), im = (c: number[]) => -c[1]! * Math.sin(w) - c[2]! * Math.sin(2 * w)
  const nr = re(b), ni = im(b), dr = re(d), di = im(d), den = dr * dr + di * di
  return {re: (nr * dr + ni * di) / den, im: (ni * dr - nr * di) / den}
}
/** The response in dB at f: drive, then the filter blended with the dry by Mix. Undefined while a reading it needs is absent. */
function responseOf(v: V) {
  const type = strOf(v, 'type'), fc = numOf(v, 'cutoff'), res = numOf(v, 'resonance'), drive = numOf(v, 'drive'), mix = numOf(v, 'mix')
  if (type === undefined || fc === undefined || res === undefined || drive === undefined || mix === undefined) return undefined
  const q = qOf(res), m = mix / 100
  return (f: number) => {
    const h = transfer(type, fc, q, f)
    const re = m * h.re + (1 - m), im = m * h.im
    return drive + 10 * Math.log10(Math.max(1e-9, re * re + im * im))
  }
}
const hz = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 1 : 2)} kHz` : `${Math.round(x)} Hz`)

// ---------------------------------------------------------------- the picture

const f1 = (x: number) => x.toFixed(1)

/** The response: frequency across on a log scale, level up in dB. Handle 1 is the cutoff (across) and the resonance (up); handle 2,
 * in the pool, the drive on the left edge. */
function Response({p, w, h, handles, axes}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; axes: boolean}) {
  const v = p.v, curve = responseOf(v), left = axes ? 4 : 2, right = w - 3, top = axes ? 16 : 6, bottom = h - (axes ? 14 : 4)
  const X = (f: number) => left + Math.log(f / CUTOFF.min) / Math.log(CUTOFF.max / CUTOFF.min) * (right - left)
  const F = (x: number) => CUTOFF.min * (CUTOFF.max / CUTOFF.min) ** clampTo(0, 1, (x - left) / (right - left))
  const Y = (db: number) => top + (DB.hi - clampTo(DB.lo, DB.hi, db)) / (DB.hi - DB.lo) * (bottom - top)
  const fc = numOf(v, 'cutoff'), res = numOf(v, 'resonance'), drive = numOf(v, 'drive')
  let d = ''
  if (curve) for (let i = 0; i <= 160; i++) { const f = CUTOFF.min * (CUTOFF.max / CUTOFF.min) ** (i / 160); d += `${i ? 'L' : 'M'}${f1(X(f))} ${f1(Y(curve(f)))}` }
  const cut = st(p, 'cutoff'), rs = st(p, 'resonance'), dr = st(p, 'drive')
  return <g>
    {axes && [100, 1000, 10000].map(f => <g key={f}><path d={`M${f1(X(f))} ${top}V${bottom}`} className="dp-grid" />
      <text x={X(f) + 2} y={h - 4} className="dp-axis">{f >= 1000 ? `${f / 1000}k` : f}</text></g>)}
    {[-24, -12, 0, 12, 24].map(db => <path key={db} d={`M${left} ${f1(Y(db))}H${right}`} className={db ? 'dp-grid' : 'dp-faint'} />)}
    {curve && <><path d={`${d}L${right} ${bottom}L${left} ${bottom}Z`} className="dp-fill" /><path d={d} className="dp-curve" /></>}
    {!curve && <text x={w / 2} y={h / 2 + 3} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the filter'}</text>}
    {/* the resonance stands over the cutoff: where the handle is off the curve (a band or a notch), a stalk joins them */}
    {handles >= 1 && curve && fc !== undefined && res !== undefined && drive !== undefined && Math.abs(Y(curve(fc)) - Y(drive + 24 * res / 100 - 3)) > 4 &&
      <path d={`M${f1(X(fc))} ${f1(Y(curve(fc)))}V${f1(Y(drive + 24 * res / 100 - 3))}`} className="dp-faint" strokeDasharray="2 2" />}
    {handles >= 1 && curve && fc !== undefined && res !== undefined && drive !== undefined && <Handle n={1} x={X(fc)} y={Y(drive + 24 * res / 100 - 3)} label="Cutoff and resonance"
      does={`Drag across for the cutoff, up for the resonance.${cut.disabled ? ` ${cut.disabled}` : ''}`}
      onDrag={cut.disabled ? undefined : (x, y) => { p.set('cutoff', Math.round(F(x))); if (!rs.disabled) p.set('resonance', Math.round(clampTo(0, 100, ((DB.hi - (y - top) / (bottom - top) * (DB.hi - DB.lo)) - drive + 3) / 24 * 100))) }}
      onReset={cut.disabled ? undefined : () => { p.set('cutoff', 8000); p.set('resonance', 20) }} />}
    {handles >= 2 && curve && drive !== undefined && <Handle n={2} shape="square" x={left + 5} y={Y(drive)} label="Drive"
      does={`Drag up: how hard the filter is pushed.${dr.disabled ? ` ${dr.disabled}` : ''}`}
      onDrag={dr.disabled ? undefined : (_, y) => p.set('drive', Math.round(clampTo(0, 24, DB.hi - (y - top) / (bottom - top) * (DB.hi - DB.lo)) * 10) / 10)} onReset={dr.disabled ? undefined : () => p.set('drive', 0)} />}
  </g>
}

// ---------------------------------------------------------------- the parts the views share

const lightOf = (p: ViewProps): LightState => { const l = strOf(p.owner ?? p.v, 'light'); return l === 'lit' || l === 'dark' ? l : 'unknown' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'light').disabled ?? (has(p.v, 'light') ? undefined : 'No reading of on or off: no filter stands on the torus\'s sound.'),
  onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const typeWord = (v: V) => TYPES.find(t => t.value === strOf(v, 'type'))?.label
const DISPLAY_DOES = 'The filter\'s response: frequency across, level up. The fill is what passes.'

function controls(p: ViewProps) {
  const v = p.v, pct = (x: number) => `${Math.round(x)} %`
  return {
    type: <Radio {...st(p, 'type')} label="Type" does="The kind of cut." value={strOf(v, 'type') ?? ''} options={TYPES} stack onChange={x => p.set('type', x)} />,
    cutoff: <Dial {...st(p, 'cutoff')} label="Cutoff" does="The frequency of the cut." value={numOf(v, 'cutoff') ?? NaN} def={8000} scale={CUTOFF} format={hz} onChange={x => p.set('cutoff', Math.round(x))} />,
    res: <Dial {...st(p, 'resonance')} label="Res" does="How much the cut rings." value={numOf(v, 'resonance') ?? NaN} def={20} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('resonance', Math.round(x))} />,
    drive: <Dial {...st(p, 'drive')} label="Drive" does="How hard the filter is pushed." value={numOf(v, 'drive') ?? NaN} def={0} scale={{min: 0, max: 24}} format={x => `${x.toFixed(1)} dB`} onChange={x => p.set('drive', Math.round(x * 10) / 10)} />,
    mix: <Dial {...st(p, 'mix')} label="Mix" does="The share of filtered sound that you hear." value={numOf(v, 'mix') ?? NaN} def={100} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('mix', Math.round(x))} />,
  }
}

export const design: DesignedDevice = {
  id: 'live:filter',
  title: 'Filter',
  kind: 'effect',
  defaults: {light: 'lit', type: 'lowpass', cutoff: 8000, resonance: 20, drive: 0, mix: 100},
  fixtures: {
    'Low-pass at 8 kHz': {},
    'A ringing band': {type: 'bandpass', cutoff: 900, resonance: 70, drive: 6, mix: 80},
    'Off': {light: 'dark', type: 'highpass', cutoff: 180},
    'As the torus has it': {light: undefined, type: undefined, cutoff: undefined, resonance: undefined, drive: undefined, mix: undefined, reason: 'No filter on the torus\'s sound'},
  },

  folded: p => <Folded title="Filter" light={lightOf(p)} readings={[typeWord(p.v) ?? NONE, has(p.v, 'cutoff') ? hz(numOf(p.v, 'cutoff')!) : NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Filter" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="Response" does={`${DISPLAY_DOES} Drag handle 1 for the cutoff and the resonance.`} corner={typeWord(p.v) ?? NONE}>
          <Response p={p} w={140} h={146} handles={1} axes />
        </Display>
      </Section>
      <Section label="Macros" cols={2}>{c.cutoff}{c.res}{c.drive}{c.mix}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 260, 520)) : 186
    return <Panel title="Filter" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Response" does={`${DISPLAY_DOES} Drag handle 1 for the cutoff and the resonance, handle 2 for the drive.`}
            corner={has(p.v, 'cutoff') ? hz(numOf(p.v, 'cutoff')!) : NONE}>
            <Response p={p} w={w} h={146} handles={2} axes />
          </Display>
        </Section>
        <Section label="Type" width={60}>{c.type}</Section>
        <Section label="Filter" width={60}>{c.cutoff}{c.res}</Section>
        <Section label="Output" grow>{c.drive}{c.mix}</Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The filter's response">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Response p={{...p, set: () => {}}} w={760} h={392} handles={0} axes />
        <text x={18} y={410} className="dp-axis">{[typeWord(p.v), has(p.v, 'cutoff') ? hz(numOf(p.v, 'cutoff')!) : undefined, has(p.v, 'resonance') ? `res ${numOf(p.v, 'resonance')} %` : undefined]
          .filter(Boolean).join(' · ') || NONE} · no reading of the torus's sound reaches the filter</text>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Filter" light={lightOf(p)} onLight={() => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')} lightWhy={head(p).lightWhy} onFull={p.nav.full}>
    <Display w={70} h={100} label="Response" does={DISPLAY_DOES}><Response p={p} w={70} h={100} handles={0} axes={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="type" value={typeWord(p.v)} tone="value" />
      <Readout label="cutoff" value={has(p.v, 'cutoff') ? hz(numOf(p.v, 'cutoff')!) : undefined} />
      <Readout label="res" value={has(p.v, 'resonance') ? `${numOf(p.v, 'resonance')} %` : undefined} />
    </div>
  </Tile>,
}
