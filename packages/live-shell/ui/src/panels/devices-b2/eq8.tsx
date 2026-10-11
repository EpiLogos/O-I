import { useState } from 'react'

import {
  DevicePortFrame,
  Knob,
  Menu,
  ParamSpec,
  Section,
  Segmented,
  StoredExtras,
  Switch,
  useDeviceState,
} from './kit'

/** EQ Eight port — spectrum/graph area with the 8 band nodes (drag a node
 * to move that band's Freq/Gain), Freq/Gain/Q knobs for the selected band
 * slot, right global column (Mode, Edit A/B, Adapt:Q, Scale, Gain, Audition),
 * 8 band columns with filter-type menus (capture:
 * evidence/ui/device-panels/Eq8.png). Control inventory: live-dynamics
 * params.rs EQ8 (global section + the 8-band A/B structure). */

// per-band stored Mode extent from params.rs (A, B pairs; observed lower bound)
const BAND_MAXES = [2, 3, 3, 3, 3, 3, 5, 3, 6, 3, 3, 3, 5, 5, 6, 6]
const FREQ_MIN = 30
const FREQ_MAX = 22000
const GAIN_MIN = -15
const GAIN_MAX = 15
const Q_MIN = 0.1
const Q_MAX = 18

function bandSpecs(): ParamSpec[] {
  const specs: ParamSpec[] = []
  for (let b = 0; b < 8; b++) {
    for (const slot of ['ParameterA', 'ParameterB']) {
      const modeMax = BAND_MAXES[b * 2 + (slot === 'ParameterB' ? 1 : 0)] ?? 3
      specs.push(
        { id: `Bands.${b}/${slot}/IsOn`, label: `band ${b + 1} ${slot} on`, min: 0, max: 1, kind: 'toggle', def: 1 },
        { id: `Bands.${b}/${slot}/Mode`, label: `band ${b + 1} ${slot} type`, min: 0, max: modeMax, kind: 'discrete', labels: Array.from({ length: modeMax + 1 }, () => '?') },
        { id: `Bands.${b}/${slot}/Freq`, label: `band ${b + 1} ${slot} freq`, min: FREQ_MIN, max: FREQ_MAX, unit: 'Hz', kind: 'continuous' },
        { id: `Bands.${b}/${slot}/Gain`, label: `band ${b + 1} ${slot} gain`, min: GAIN_MIN, max: GAIN_MAX, unit: 'dB', kind: 'continuous' },
        { id: `Bands.${b}/${slot}/Q`, label: `band ${b + 1} ${slot} q`, min: Q_MIN, max: Q_MAX, kind: 'continuous' },
      )
    }
  }
  return specs
}

const GLOBAL: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'EditMode', label: 'edit', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'GlobalGain', label: 'gain', min: -12, max: 12, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'Scale', label: 'scale', min: -2, max: 2, kind: 'continuous', def: 1 },
  { id: 'AdaptiveQ', label: 'adapt:q', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'AuditionOnOff', label: 'audition', min: 0, max: 1, kind: 'toggle', def: 0 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'Precision', label: 'precision', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Mode', label: 'processing mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'AdaptiveQFactor', label: 'adaptive q factor', min: 0, max: 1, kind: 'discrete', labels: ['?', '?'] },
  { id: 'Live8ShelfScaleLegacyMode', label: 'live8 shelf scale', min: 0, max: 1, kind: 'toggle', def: 0 },
]

// factory default band layout (freq, gain, mode family) — visual reference
const DEFAULT_BANDS: Array<[number, number]> = [
  [60, 0], [180, 0], [500, 0], [1400, 0], [3800, 0], [8200, 0], [13500, 0], [18000, 0],
]
const DEFAULT_MODES = [0, 1, 1, 3, 3, 3, 5, 6]

const TYPE_GLYPHS = ['LP', 'HP', 'BP', 'PK', 'NO', 'LS', 'HS']

const W = 500
const H = 190
const fToX = (f: number) => (Math.log10(f / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN)) * (W - 12) + 6
const gToY = (g: number) => H / 2 - (g / GAIN_MAX) * (H / 2 - 14)

function eqCurve(bands: Array<[number, number]>): string {
  const pts: string[] = []
  for (let px = 6; px <= W - 6; px += 4) {
    const f = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, (px - 6) / (W - 12))
    let db = 0
    bands.forEach(([bf, bg], i) => {
      const oct = Math.log2(f / bf)
      const width = 1.1 + i * 0.06
      db += bg * Math.exp(-(oct * oct) / (2 * width * width))
    })
    pts.push(`${px === 6 ? 'M' : 'L'} ${px} ${gToY(Math.max(GAIN_MIN, Math.min(GAIN_MAX, db))).toFixed(1)}`)
  }
  return pts.join(' ')
}

export function Eq8Port() {
  const all = [...GLOBAL, ...bandSpecs(), ...EXTRAS]
  const { values, set } = useDeviceState(all, {
    'Bands.0/ParameterA/Freq': DEFAULT_BANDS[0][0], 'Bands.1/ParameterA/Freq': DEFAULT_BANDS[1][0],
    'Bands.2/ParameterA/Freq': DEFAULT_BANDS[2][0], 'Bands.3/ParameterA/Freq': DEFAULT_BANDS[3][0],
    'Bands.4/ParameterA/Freq': DEFAULT_BANDS[4][0], 'Bands.5/ParameterA/Freq': DEFAULT_BANDS[5][0],
    'Bands.6/ParameterA/Freq': DEFAULT_BANDS[6][0], 'Bands.7/ParameterA/Freq': DEFAULT_BANDS[7][0],
    'Bands.0/ParameterA/Mode': DEFAULT_MODES[0], 'Bands.1/ParameterA/Mode': DEFAULT_MODES[1],
    'Bands.2/ParameterA/Mode': DEFAULT_MODES[2], 'Bands.3/ParameterA/Mode': DEFAULT_MODES[3],
    'Bands.4/ParameterA/Mode': DEFAULT_MODES[4], 'Bands.5/ParameterA/Mode': DEFAULT_MODES[5],
    'Bands.6/ParameterA/Mode': DEFAULT_MODES[6], 'Bands.7/ParameterA/Mode': DEFAULT_MODES[7],
    'Bands.0/ParameterB/Mode': 1, 'Bands.1/ParameterB/Mode': 1, 'Bands.2/ParameterB/Mode': 1,
    'Bands.3/ParameterB/Mode': 1, 'Bands.4/ParameterB/Mode': 1, 'Bands.5/ParameterB/Mode': 1,
    'Bands.6/ParameterB/Mode': 1, 'Bands.7/ParameterB/Mode': 1,
  })
  const v = values
  const [selected, setSelected] = useState(2)
  const [dragBand, setDragBand] = useState<number | null>(null)
  const editB = (v['EditMode'] ?? 0) === 1
  const slot = editB ? 'ParameterB' : 'ParameterA'

  const freq = (b: number) => v[`Bands.${b}/${slot}/Freq`] ?? DEFAULT_BANDS[b][0]
  const gain = (b: number) => v[`Bands.${b}/${slot}/Gain`] ?? 0
  const on = (b: number) => (v[`Bands.${b}/${slot}/IsOn`] ?? 1) === 1

  const dragNode = (e: React.PointerEvent, b: number) => {
    const svg = e.currentTarget as SVGGraphicsElement
    const rect = svg.getBoundingClientRect()
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const x = Math.min(W - 10, Math.max(8, ((ev as PointerEvent).clientX - rect.left) / rect.width * W))
      const y = Math.min(H - 8, Math.max(8, ((ev as PointerEvent).clientY - rect.top) / rect.height * H))
      const f = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, (x - 6) / (W - 12))
      const g = ((H / 2 - y) / (H / 2 - 14)) * GAIN_MAX
      set(`Bands.${b}/${slot}/Freq`, Math.round(f))
      set(`Bands.${b}/${slot}/Gain`, Math.round(g * 10) / 10)
    }
    move(e)
    const onMove = (ev: PointerEvent) => move(ev)
    const onUp = () => {
      setDragBand(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    setDragBand(b)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <DevicePortFrame name="EQ Eight (port)" element="Eq8">
      <div className="b2-flow">
        <div className="b2-col">
          <Knob label="freq" value={freq(selected)} min={FREQ_MIN} max={FREQ_MAX} unit="Hz" curve={2.6} onChange={(x) => set(`Bands.${selected}/${slot}/Freq`, x)} title={`band ${selected + 1} ${slot} freq`} />
          <Knob label="gain" value={gain(selected)} min={GAIN_MIN} max={GAIN_MAX} unit="dB" onChange={(x) => set(`Bands.${selected}/${slot}/Gain`, x)} title={`band ${selected + 1} ${slot} gain`} />
          <Knob label="q" value={v[`Bands.${selected}/${slot}/Q`] ?? 1} min={Q_MIN} max={Q_MAX} curve={2} onChange={(x) => set(`Bands.${selected}/${slot}/Q`, x)} title={`band ${selected + 1} ${slot} q`} />
        </div>
        <div className="b2-col">
          <svg
            className="b2-graph"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="application"
            aria-label="EQ Eight band graph — drag nodes to set band frequency and gain"
          >
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={f * (W - 12) + 6} y1={4} x2={f * (W - 12) + 6} y2={H - 4} className="b2-graph-grid" />
            ))}
            <line x1={6} y1={H / 2} x2={W - 6} y2={H / 2} className="b2-graph-grid" />
            <path d={eqCurve(DEFAULT_BANDS.map((_, i) => [freq(i), on(i) ? gain(i) : 0]))} className="b2-graph-curve" />
            <path
              d={`M 6 ${H / 2} ${DEFAULT_BANDS.map((_, i) => `L ${fToX(freq(i)).toFixed(1)} ${gToY(on(i) ? gain(i) : 0).toFixed(1)}`).join(' ')} L ${W - 6} ${H / 2} Z`}
              className="b2-graph-fillarea"
            />
            {DEFAULT_BANDS.map((_, b) => (
              <circle
                key={b}
                cx={fToX(freq(b))}
                cy={gToY(on(b) ? gain(b) : 0)}
                r={dragBand === b ? 7 : 5.5}
                className={'b2-graph-node' + (selected === b ? ' is-selected' : '') + (on(b) ? '' : ' b2-node-off')}
                onPointerDown={(e) => {
                  setSelected(b)
                  dragNode(e, b)
                }}
                aria-label={`band ${b + 1} node`}
              />
            ))}
            {[100, 1000, 10000].map((f) => (
              <text key={f} x={fToX(f)} y={H - 4} className="b2-graph-tag" textAnchor="middle">
                {f >= 1000 ? `${f / 1000}k` : f}
              </text>
            ))}
          </svg>
          <div className="b2-row">
            {DEFAULT_BANDS.map((_, b) => (
              <div className="b2-band-col" key={b}>
                <Menu
                  value={v[`Bands.${b}/${slot}/Mode`] ?? DEFAULT_MODES[b]}
                  labels={TYPE_GLYPHS.slice(0, (BAND_MAXES[b * 2 + (editB ? 1 : 0)] ?? 3) + 1)}
                  onChange={(x) => set(`Bands.${b}/${slot}/Mode`, x)}
                  title={`band ${b + 1} ${slot} mode — stored index; menu labels not in the parameter-table evidence`}
                />
                <button
                  type="button"
                  className={'b2-band-btn' + (selected === b ? ' is-selected' : '') + (on(b) ? '' : ' is-off')}
                  onClick={() => setSelected(b)}
                  onDoubleClick={() => set(`Bands.${b}/${slot}/IsOn`, on(b) ? 0 : 1)}
                  title={`band ${b + 1} — click selects, double-click toggles ${slot} IsOn`}
                >
                  {b + 1}
                </button>
              </div>
            ))}
          </div>
        </div>
        <Section label="output / global">
          <div className="b2-col">
            <Switch label="on" value={(v['On'] ?? 1) === 1} onChange={(x) => set('On', x ? 1 : 0)} />
            <Menu label="mode" value={v['Mode'] ?? 0} labels={['?']} onChange={(x) => set('Mode', x)} title="processing-mode selector (stored 0 observed)" />
            <Segmented
              label="edit"
              value={v['EditMode'] ?? 0}
              labels={['A', 'B']}
              onChange={(x) => set('EditMode', x)}
              title="edit mode — stored 0/1 selects the ParameterA/ParameterB slot the knobs address"
            />
            <Switch label="adapt:q" value={(v['AdaptiveQ'] ?? 0) === 1} onChange={(x) => set('AdaptiveQ', x ? 1 : 0)} />
            <Knob label="scale" value={v['Scale'] ?? 1} min={-2} max={2} size={28} onChange={(x) => set('Scale', x)} />
            <Knob label="gain" value={v['GlobalGain'] ?? 0} min={-12} max={12} unit="dB" size={28} onChange={(x) => set('GlobalGain', x)} />
            <Switch label="audition" value={(v['AuditionOnOff'] ?? 0) === 1} onChange={(x) => set('AuditionOnOff', x ? 1 : 0)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
