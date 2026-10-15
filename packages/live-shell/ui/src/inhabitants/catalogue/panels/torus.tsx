// The Torus (manual §21.1): Live's one instrument, a ring with a tube driven by two pulses (3·3 and 4·2) and wound by two helices
// (the two whole-tone families). Live's nearest: Wavetable — a large display of the oscillator with handles, an envelope display,
// a global column of volume and voices. Every line drawn below is computed from the device's values.
import type {CSSProperties} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {clampTo, db, fixed, num, on, pct, secs, signed, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const DAMP = {min: .1, max: 40, log: true}, ATTACK = {min: .001, max: 10, log: true}, RELEASE = {min: .01, max: 30, log: true}

/** The surface: a standing wave round the ring. Pulse mix blends the 3·3 division (three lobes, twice) with the 4·2 division. */
const wave = (m: number, th: number, agitation: number) =>
  (1 - m) * Math.cos(3 * th) + m * .62 * (Math.cos(4 * th) + .8 * Math.cos(2 * th)) + agitation * .06 * Math.sin(17 * th)

/** The torus at a three-quarter view: the ring, its tube, the surface wave on the outer equator, the two helices. */
function TorusPicture({v, w, h, cx, cy, R, notes = []}: {v: V; w: number; h: number; cx: number; cy: number; R: number; notes?: readonly number[]}) {
  const m = num(v, 'pulseMix') / 100, b = num(v, 'helixBalance') / 100, d = num(v, 'drive'), q = num(v, 'damping'), ag = num(v, 'agitation')
  const r = R * .4, k = .42, amp = r * .55 * Math.sqrt(d / 6)
  const P = (th: number, ph: number, lift = 0) => {
    const rr = R + (r + lift) * Math.cos(ph)
    return [cx + rr * Math.cos(th), cy + rr * Math.sin(th) * k - (r + lift) * Math.sin(ph) * .9] as const
  }
  // Toward the viewer: the camera looks down at the ring, so depth is the turned Y with the lifted Z.
  const depth = (th: number, ph: number, lift = 0) => (R + (r + lift) * Math.cos(ph)) * Math.sin(th) * .9 + (r + lift) * Math.sin(ph) * .42
  const near = (th: number) => Math.sin(th) >= 0
  /** A sampled curve split into its far (faint) and near (full) runs. */
  const runs = (f: (t: number) => readonly [number, number], t0: number, t1: number, n: number, front: (t: number) => boolean) => {
    const out: {d: string; near: boolean}[] = []
    let cur = '', side: boolean | null = null
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, [x, y] = f(t), s = front(t)
      if (s !== side) { if (cur) out.push({d: cur, near: side!}); cur = `M${x.toFixed(1)} ${y.toFixed(1)}`; side = s } else cur += `L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    if (cur) out.push({d: cur, near: side!})
    return out
  }
  // How long the body rings: more echoes of the surface wave, each fainter, the sharper the resonance (damping Q).
  const echoes = Math.round(clampTo(1, 4, Math.log2(q + 1)))
  const lit = (n: number) => P(n / 12 * Math.PI * 2 * 2, n % 2 ? Math.PI : 0)
  return <g>
    {/* the tube's outline: outer and inner silhouettes */}
    <ellipse cx={cx} cy={cy} rx={R + r} ry={(R + r) * k + r * .25} className="dp-faint" />
    <ellipse cx={cx} cy={cy - r * .2} rx={R - r} ry={(R - r) * k} className="dp-faint" />
    {[0.5, 1, 1.5].map(ph => runs(t => P(t, ph * Math.PI / 2), 0, Math.PI * 2, 72, near).map((seg, i) =>
      <path key={`${ph}-${i}`} d={seg.d} className="dp-faint" opacity={seg.near ? .7 : .25} />))}
    {/* the helices: two turns for one return; the balance sets their weight */}
    {[0, 1].map(hx => runs(t => P(t, 2.5 * t + hx * Math.PI), 0, Math.PI * 4, 360, t => depth(t, 2.5 * t + hx * Math.PI) > -R * .15).map((seg, i) =>
      <path key={`h${hx}-${i}`} d={seg.d} fill="none" stroke={hx ? 'var(--dp-on)' : 'var(--dp-value)'}
        strokeWidth={.5 + 1.8 * (hx ? b : 1 - b)} opacity={seg.near ? .85 : .2} />))}
    {/* the surface wave and its echoes */}
    {Array.from({length: echoes}, (_, e) => runs(t => P(t, 0, amp * wave(m, t, ag) * Math.pow(.6, e) + e * 2), 0, Math.PI * 2, 180, () => true).map((seg, i) =>
      <path key={`w${e}-${i}`} d={seg.d} className="dp-curve" opacity={1 - e * .24} strokeWidth={e ? 1 : 1.6} />))}
    {notes.map(n => { const [x, y] = lit(n); return <circle key={n} cx={x} cy={y} r={3} fill="var(--dp-on)" /> })}
    <rect x={0} y={0} width={w} height={h} fill="none" />
  </g>
}

/** Where the drive handle sits: the surface wave's crest on the near right of the ring. */
const crest = (v: V, cx: number, cy: number, R: number) => {
  const r = R * .4, amp = r * .55 * Math.sqrt(num(v, 'drive') / 6)
  return {x: cx + R + r + amp, y: cy, base: cx + R + r, reach: r * .55}
}

function TorusDisplay({v, set, w, h, notes}: {v: V; set?: ViewProps['set']; w: number; h: number; notes?: readonly number[]}) {
  const cx = w / 2, cy = h * .44, R = w * .27, line = {x0: 14, x1: w - 14, y: h - 13}
  const c = crest(v, cx, cy, R), m = num(v, 'pulseMix') / 100
  return <Display w={w} h={h} label="The torus" does="The ring, its surface wave and its two helices, drawn from the device's values."
    corner={`${num(v, 'notes')} notes`}>
    <TorusPicture v={v} w={w} h={h} cx={cx} cy={cy} R={R} notes={notes} />
    <path d={`M${line.x0} ${line.y}H${line.x1}`} className="dp-faint" />
    <text x={line.x0} y={line.y - 4} className="dp-axis">3·3</text>
    <text x={line.x1} y={line.y - 4} className="dp-axis" textAnchor="end">4·2</text>
    <Handle n={1} x={line.x0 + m * (line.x1 - line.x0)} y={line.y} label="Pulse mix" does="Drag along the line: the balance of the two pulses."
      onDrag={set && (x => set('pulseMix', Math.round(clampTo(0, 100, (x - line.x0) / (line.x1 - line.x0) * 100))))} onReset={set && (() => set('pulseMix', 50))} />
    <Handle n={2} x={c.x} y={c.y} label="Drive" does="Drag out from the ring: how hard the pulses shake the body."
      onDrag={set && (x => set('drive', Math.round(clampTo(0, 6, Math.pow(clampTo(0, 1, (x - c.base) / c.reach), 2) * 6) * 10) / 10))} onReset={set && (() => set('drive', 1))} />
  </Display>
}

/** The note envelope: rise to the strike's height over Attack, ring and fade over Release. Time runs on a log scale. */
function EnvelopeDisplay({v, set, w, h}: {v: V; set?: ViewProps['set']; w: number; h: number}) {
  const x0 = 8, x1 = w - 8, top = 14, base = h - 14
  const tx = (s: number) => x0 + (Math.log10(s / .001) / Math.log10(60 / .001)) * (x1 - x0)
  const a = num(v, 'attack'), rel = num(v, 'release'), peak = base - (base - top) * num(v, 'strike') / 100, q = num(v, 'damping')
  const ax = tx(a), rx = tx(a + rel)
  let d = `M${x0} ${base}L${ax.toFixed(1)} ${peak.toFixed(1)}`
  for (let i = 1; i <= 40; i++) {
    const t = i / 40, x = ax + (rx - ax) * t, ring = Math.cos(t * Math.min(q, 20) * 2) * Math.exp(-t * 3) * .12
    d += `L${x.toFixed(1)} ${(base - (base - peak) * Math.exp(-t * 4) * (1 + ring)).toFixed(1)}`
  }
  return <Display w={w} h={h} label="Envelope" does="How a note rises and fades. Drag the squares." corner="time">
    {[.01, .1, 1, 10].map(s => <g key={s}><path d={`M${tx(s)} ${top - 4}V${base}`} className="dp-grid" />{(s === .01 || s === 1) && <text x={tx(s) + 2} y={h - 4} className="dp-axis">{s < 1 ? '10 ms' : '1 s'}</text>}</g>)}
    <path d={`${d}L${rx.toFixed(1)} ${base}Z`} className="dp-fill" />
    <path d={d} className="dp-curve" />
    <Handle shape="square" x={ax} y={peak} label="Attack" does="Drag left or right: how long a note takes to rise."
      onDrag={set && (x => set('attack', Math.round(clampTo(.001, 10, .001 * Math.pow(60 / .001, (x - x0) / (x1 - x0))) * 1000) / 1000))} onReset={set && (() => set('attack', .01))} />
    <Handle shape="square" x={rx} y={base} label="Release" does="Drag left or right: how long a note takes to fade."
      onDrag={set && (x => set('release', Math.round(clampTo(.01, 30, .001 * Math.pow(60 / .001, (x - x0) / (x1 - x0)) - a) * 100) / 100))} onReset={set && (() => set('release', 1.2))} />
  </Display>
}

/** The Jankó keyboard under the full torus: rows alternate the two whole-tone families, each row offset by half a key. */
function Janko({w, y, sounding}: {w: number; y: number; sounding: readonly number[]}) {
  const keys = 14, kw = (w - 40) / keys, kh = 22, names = ['C', 'D', 'E', 'F♯', 'G♯', 'A♯', 'C♯', 'D♯', 'F', 'G', 'A', 'B']
  return <g aria-label="Jankó keyboard">
    {[0, 1, 2, 3].map(row => Array.from({length: keys - (row % 2)}, (_, i) => {
      const family = row % 2, x = 20 + i * kw + (family ? kw / 2 : 0), note = family * 6 + (i % 6), hot = sounding.includes(i * 2 + family)
      return <g key={`${row}-${i}`}>
        <rect x={x + 1} y={y + row * (kh + 2)} width={kw - 2} height={kh} rx={3}
          fill={hot ? 'var(--dp-on)' : family ? '#2a3036' : '#59606a'} stroke="rgba(0,0,0,.4)" />
        {row === 3 - family && i % 6 === 0 && <text x={x + kw / 2} y={y + row * (kh + 2) + 15} textAnchor="middle" className="dp-axis">{names[note]}</text>}
      </g>
    }))}
  </g>
}

const light = (v: V) => str(v, 'light') as LightState
const VIEWS = [{value: 'surface', label: 'Surface'}, {value: 'wire', label: 'Wire'}, {value: 'both', label: 'Both'}] as const

const macros = (p: ViewProps) => <>
  <Dial label="Pulse mix" does="The balance of the two pulses." value={num(p.v, 'pulseMix')} def={50} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('pulseMix', x)} />
  <Dial label="Damping" does="How sharply the body rings. A high value rings longer." value={num(p.v, 'damping')} def={4.5} scale={DAMP} format={fixed(1)} onChange={x => p.set('damping', x)} />
  <Dial label="Drive" does="How hard the pulses shake the body." value={num(p.v, 'drive')} def={1} scale={{min: 0, max: 6}} format={fixed(1)} onChange={x => p.set('drive', x)} mod={[.6, 2.2]} />
  <Dial label="Release" does="How long a note takes to fade." value={num(p.v, 'release')} def={1.2} scale={RELEASE} format={secs} onChange={x => p.set('release', x)} />
</>

export const torus: DesignedDevice = {
  id: 'quaternal-logic:torus',
  title: 'Torus',
  kind: 'instrument',
  defaults: {
    light: 'lit', pulseMix: 50, helixBalance: 50, strike: 70, damping: 4.5, drive: 1, modes: 64, agitation: .3,
    attack: .01, release: 1.2, voices: 16, level: -6, pan: 0, view: 'surface', receiver: false,
    notes: 3, meter: -14,
  },

  folded: p => <Folded title="Torus" light={light(p.v)} readings={[db(num(p.v, 'level')), `${num(p.v, 'notes')} notes`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Torus" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><TorusDisplay v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{macros(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Torus" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={198}><TorusDisplay v={p.v} set={p.set} w={186} h={146} /></Section>
      <Section label="Pulses" cols={2}>
        <Dial label="Pulse mix" does="The balance of the two pulses. 0 % is the first only, 100 % the second only." value={num(p.v, 'pulseMix')} def={50} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('pulseMix', x)} />
        <Dial label="Helices" does="The balance of the two helices." value={num(p.v, 'helixBalance')} def={50} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('helixBalance', x)} />
        <Dial label="Drive" does="How hard the pulses shake the body. The outer ring shows what the sky moves it through." value={num(p.v, 'drive')} def={1} scale={{min: 0, max: 6}} format={fixed(1)} onChange={x => p.set('drive', x)} mod={[.6, 2.2]} />
        <Readout label="notes" does="Notes that sound now." value={num(p.v, 'notes')} tone="accent" />
      </Section>
      <Section label="Output" grow>
        <ValueBox label="Level" does="The loudness of the sound." value={num(p.v, 'level')} def={-6} scale={{min: -60, max: 6}} format={db} onChange={x => p.set('level', x)} automated />
        <Dial label="Pan" does="The place of the sound, left to right." value={num(p.v, 'pan')} def={0} scale={{min: -1, max: 1}} format={x => (Math.abs(x) < .005 ? 'C' : `${Math.round(Math.abs(x) * 50)}${x < 0 ? 'L' : 'R'}`)} bipolar onChange={x => p.set('pan', x)} />
      </Section>
    </Band>
    <Band>
      <Section label="Body" cols={2}>
        <Dial label="Strike" does="How strongly velocity excites the body." value={num(p.v, 'strike')} def={70} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('strike', x)} />
        <Dial label="Damping" does="How sharply the body rings. A high value rings longer." value={num(p.v, 'damping')} def={4.5} scale={DAMP} format={fixed(1)} onChange={x => p.set('damping', x)} />
        <Dial label="Modes" does="How many modes of the body take part." value={num(p.v, 'modes')} def={64} scale={{min: 1, max: 64, step: 1}} format={x => `${x}`} onChange={x => p.set('modes', x)} />
        <Dial label="Agitation" does="How much the surface is kicked about." value={num(p.v, 'agitation')} def={.3} scale={{min: 0, max: 5}} format={fixed(2)} onChange={x => p.set('agitation', x)} />
      </Section>
      <Section label="Envelope" width={150}>
        <EnvelopeDisplay v={p.v} set={p.set} w={136} h={96} />
        <div className="ref-pair">
          <ValueBox does="How long a note takes to rise." value={num(p.v, 'attack')} def={.01} scale={ATTACK} format={secs} onChange={x => p.set('attack', x)} />
          <ValueBox does="How long a note takes to fade." value={num(p.v, 'release')} def={1.2} scale={RELEASE} format={secs} onChange={x => p.set('release', x)} />
        </div>
      </Section>
      <Section label="Voices · view" grow>
        <ValueBox label="Voices" does="How many notes sound at once. The oldest makes way." value={num(p.v, 'voices')} def={16} scale={{min: 1, max: 32, step: 1}} format={x => `${x}`} onChange={x => p.set('voices', x)} />
        <Radio does="What the pane draws." value={str(p.v, 'view')} options={VIEWS} stack onChange={x => p.set('view', x)} />
        <Toggle label="Receiver" does="Your camera becomes the place where the torus is heard." on={on(p.v, 'receiver')} onChange={x => p.set('receiver', x)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The playable torus and the Jankó keyboard">
      <g className="dp-display" style={{background: 'none'}}>
        <TorusPicture v={p.v} w={760} h={300} cx={380} cy={140} R={190} notes={[0, 4, 8]} />
        <Janko w={760} y={300} sounding={[0, 8, 16]} />
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Torus" light={light(p.v)} onFull={p.nav.full}>
    <Display w={98} h={100} label="The torus" does="Click ⤢ to open it full in the pane that has focus." corner={`${num(p.v, 'notes')}`}>
      <TorusPicture v={p.v} w={98} h={100} cx={49} cy={48} R={27} />
    </Display>
    <div className="ref-meter" data-i={`Level|${signed(0)(num(p.v, 'meter'))} dB now.`} style={{'--level': clampTo(0, 1, (num(p.v, 'meter') + 60) / 66)} as CSSProperties}><span /></div>
  </Tile>,
}
