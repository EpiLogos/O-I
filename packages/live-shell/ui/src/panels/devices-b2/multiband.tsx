import {
  DevicePortFrame,
  Fader,
  Knob,
  Menu,
  ParamSpec,
  Readout,
  Section,
  Segmented,
  StoredExtras,
  Switch,
  useDeviceState,
} from './kit'

/** Multiband Dynamics port — split row, three band columns (below/above
 * threshold+ratio, attack/release, gain cells) and the global column
 * (capture: evidence/ui/device-panels/MultibandDynamics.png).
 * Control inventory: live-dynamics params.rs MULTIBAND_DYNAMICS. */

type BandId = 'Low' | 'Mid' | 'High'

const BANDS: BandId[] = ['Low', 'Mid', 'High']

const GLOBAL: ParamSpec[] = [
  { id: 'SplitLowMid', label: 'low/mid split', min: 30, max: 3000, unit: 'Hz', kind: 'continuous', def: 220 },
  { id: 'SplitMidHigh', label: 'mid/high split', min: 300, max: 15000, unit: 'Hz', kind: 'continuous', def: 2000 },
  { id: 'SplitLowMidOn', label: '2-band (low/mid off)', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'SplitMidHighOn', label: '2-band (mid/high off)', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'SoftKnee', label: 'soft knee', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'EnvelopeIsPeak', label: 'peak', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'OutputGain', label: 'output', min: -24, max: 24, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'GlobalAmount', label: 'amount', min: 0, max: 1, kind: 'continuous', def: 1 },
  { id: 'GlobalTime', label: 'time', min: 0.1, max: 10, kind: 'continuous', def: 1 },
  { id: 'SideListen', label: 'side listen', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'ActiveEditMode', label: 'active edit mode', min: 0, max: 2, kind: 'discrete', labels: ['?', '?', '?'], def: 0 },
]

function bandParams(b: BandId): ParamSpec[] {
  return [
    { id: `Active${b}`, label: `${b} active`, min: 0, max: 1, kind: 'toggle', def: 1 },
    { id: `Solo${b}`, label: `${b} solo`, min: 0, max: 1, kind: 'toggle', def: 0 },
    { id: `Gain${b}`, label: `${b} gain`, min: -24, max: 24, unit: 'dB', kind: 'continuous', def: 0 },
    { id: `InputGain${b}`, label: `${b} input`, min: -24, max: 24, unit: 'dB', kind: 'continuous', def: 0 },
    { id: `AboveThreshold${b}`, label: `${b} above threshold`, min: -80, max: 0, unit: 'dB', kind: 'continuous', def: -20 },
    { id: `AboveRatio${b}`, label: `${b} above ratio`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `BelowThreshold${b}`, label: `${b} below threshold`, min: -80, max: 0, unit: 'dB', kind: 'continuous', def: -80 },
    { id: `BelowRatio${b}`, label: `${b} below ratio`, min: -3, max: 1, kind: 'continuous', def: -1 },
    { id: `Attack${b}`, label: `${b} attack`, min: 0.1, max: 5000, unit: 'ms', kind: 'continuous', def: 80 },
    { id: `Release${b}`, label: `${b} release`, min: 0.1, max: 5000, unit: 'ms', kind: 'continuous', def: 250 },
  ]
}

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
]

function ratioText(stored: number): string {
  // stored -1..1; the real panel reads it as an n:1 ratio — the document
  // mapping is not pinned by the evidence, so the raw value stays visible
  return `${stored.toFixed(2)} : 1`
}

function BandRow({ b, v, set }: { b: BandId; v: Record<string, number>; set: (id: string, x: number) => void }) {
  const active = (v[`Active${b}`] ?? 1) === 1
  return (
    <div className={'b2-band-row' + (active ? '' : ' b2-dimmed')}>
      <div className="b2-col">
        <Switch label="on" value={active} onChange={(on) => set(`Active${b}`, on ? 1 : 0)} />
        <Switch label="solo" value={(v[`Solo${b}`] ?? 0) === 1} onChange={(on) => set(`Solo${b}`, on ? 1 : 0)} />
      </div>
      <Knob label="input" value={v[`InputGain${b}`] ?? 0} min={-24} max={24} unit="dB" onChange={(x) => set(`InputGain${b}`, x)} title={`${b} input gain`} />
      <div className="b2-col">
        <span className="b2-col-label">below</span>
        <Knob label="thresh" value={v[`BelowThreshold${b}`] ?? -80} min={-80} max={0} unit="dB" size={28} onChange={(x) => set(`BelowThreshold${b}`, x)} title={`${b} below threshold`} />
        <Knob label="ratio" value={v[`BelowRatio${b}`] ?? -1} min={-3} max={1} size={28} onChange={(x) => set(`BelowRatio${b}`, x)} title={`${b} below ratio — stored ${ratioText(v[`BelowRatio${b}`] ?? -1)}`} />
      </div>
      <div className="b2-col">
        <span className="b2-col-label">above</span>
        <Knob label="thresh" value={v[`AboveThreshold${b}`] ?? -20} min={-80} max={0} unit="dB" size={28} onChange={(x) => set(`AboveThreshold${b}`, x)} title={`${b} above threshold`} />
        <Knob label="ratio" value={v[`AboveRatio${b}`] ?? 0} min={-1} max={1} size={28} onChange={(x) => set(`AboveRatio${b}`, x)} title={`${b} above ratio — stored ${ratioText(v[`AboveRatio${b}`] ?? 0)}`} />
      </div>
      <div className="b2-col">
        <span className="b2-col-label">att/rel</span>
        <Knob label="att" value={v[`Attack${b}`] ?? 80} min={0.1} max={5000} unit="ms" curve={2.4} size={28} onChange={(x) => set(`Attack${b}`, x)} title={`${b} attack`} />
        <Knob label="rel" value={v[`Release${b}`] ?? 250} min={0.1} max={5000} unit="ms" curve={2.4} size={28} onChange={(x) => set(`Release${b}`, x)} title={`${b} release`} />
      </div>
      <Fader label="gain" value={v[`Gain${b}`] ?? 0} min={-24} max={24} unit="dB" height={56} onChange={(x) => set(`Gain${b}`, x)} title={`${b} output gain`} />
    </div>
  )
}

export function MultibandDynamicsPort() {
  const { values, set } = useDeviceState([...GLOBAL, ...BANDS.flatMap(bandParams), ...EXTRAS])
  const v = values
  const peak = (v['EnvelopeIsPeak'] ?? 1) === 1

  return (
    <DevicePortFrame name="Multiband Dynamics (port)" element="MultibandDynamics">
      <div className="b2-flow">
        <Section label="splits">
          <div className="b2-col">
            <Knob label="low/mid" value={v['SplitLowMid'] ?? 220} min={30} max={3000} unit="Hz" curve={2} onChange={(x) => set('SplitLowMid', x)} />
            <Switch label="on" value={(v['SplitLowMidOn'] ?? 1) === 1} onChange={(on) => set('SplitLowMidOn', on ? 1 : 0)} />
          </div>
          <div className="b2-col">
            <Knob label="mid/high" value={v['SplitMidHigh'] ?? 2000} min={300} max={15000} unit="Hz" curve={2} onChange={(x) => set('SplitMidHigh', x)} />
            <Switch label="on" value={(v['SplitMidHighOn'] ?? 1) === 1} onChange={(on) => set('SplitMidHighOn', on ? 1 : 0)} />
          </div>
        </Section>
        {BANDS.map((b) => (
          <Section key={b} label={b}>
            <BandRow b={b} v={v} set={set} />
          </Section>
        ))}
        <Section label="output">
          <div className="b2-col">
            <Segmented
              label="detector"
              value={peak ? 1 : 0}
              labels={['RMS', 'Peak']}
              onChange={(x) => set('EnvelopeIsPeak', x)}
              title="envelope — stored 0/1 (RMS/Peak)"
            />
            <Switch label="knee" value={(v['SoftKnee'] ?? 1) === 1} onChange={(on) => set('SoftKnee', on ? 1 : 0)} />
            <Switch label="side listen" value={(v['SideListen'] ?? 0) === 1} onChange={(on) => set('SideListen', on ? 1 : 0)} />
            <Menu label="edit mode" value={v['ActiveEditMode'] ?? 0} labels={GLOBAL[10].labels ?? []} onChange={(x) => set('ActiveEditMode', x)} />
          </div>
          <div className="b2-col">
            <Fader label="output" value={v['OutputGain'] ?? 0} min={-24} max={24} unit="dB" height={72} onChange={(x) => set('OutputGain', x)} />
            <Knob label="time" value={v['GlobalTime'] ?? 1} min={0.1} max={10} size={28} onChange={(x) => set('GlobalTime', x)} />
            <Knob label="amount" value={v['GlobalAmount'] ?? 1} min={0} max={1} size={28} onChange={(x) => set('GlobalAmount', x)} />
            <Readout wide value={`${((v['GlobalAmount'] ?? 1) * 100).toFixed(0)} %`} label="amount" />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
