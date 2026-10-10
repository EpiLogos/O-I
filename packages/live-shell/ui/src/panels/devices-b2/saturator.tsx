import {
  DevicePortFrame,
  Knob,
  Menu,
  ParamSpec,
  Readout,
  Section,
  StoredExtras,
  Switch,
  useDeviceState,
} from './kit'

/** Saturator port — drive curve left, color section below, output column
 * right (capture: evidence/ui/device-panels/Saturator.png). Control
 * inventory: live-dynamics params.rs SATURATOR. */

const SPECS: ParamSpec[] = [
  { id: 'BaseDrive', label: 'drive', min: -36, max: 36, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'PreDrive', label: 'base', min: -36, max: 36, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'PostDrive', label: 'output', min: -36, max: 0, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'PreDcFilter', label: 'DC', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Type', label: 'curve', min: 0, max: 5, kind: 'discrete', labels: ['Analog Clip', 'Digital Clip', 'Sine Fold', 'Sine Shaper', 'Tube Soft Clip', 'Toaster'], def: 0 },
  { id: 'ColorOn', label: 'color', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'ColorFrequency', label: 'freq', min: 30, max: 18500, unit: 'Hz', kind: 'continuous', def: 18500 },
  { id: 'ColorWidth', label: 'width', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'ColorDepth', label: 'depth', min: -24, max: 24, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'PostClip', label: 'soft clip', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'DryWet', label: 'dry/wet', min: 0, max: 1, kind: 'continuous', def: 1 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Oversampling', label: 'oversample', min: 0, max: 1, kind: 'discrete', labels: ['Off', 'On'] },
  { id: 'WaveShaper/Drive', label: 'ws drive', min: 0, max: 1, kind: 'continuous' },
  { id: 'WaveShaper/Lin', label: 'ws lin', min: 0, max: 1, kind: 'continuous' },
  { id: 'WaveShaper/Damp', label: 'ws damp', min: 0, max: 1, kind: 'continuous' },
  { id: 'WaveShaper/Period', label: 'ws period', min: 0, max: 1, kind: 'continuous' },
  { id: 'WaveShaper/Depth', label: 'ws depth', min: 0, max: 1, kind: 'continuous' },
]

const CURVES = [
  'M 2 38 C 22 38, 42 2, 62 2', // soft analog clip
  'M 2 38 L 20 38 L 20 2 L 62 2', // digital clip
  'M 2 20 Q 12 -8 22 20 T 42 20 T 62 20', // sine fold
  'M 2 36 Q 32 -24 62 36', // sine shaper
  'M 2 38 C 26 38, 30 2, 62 2', // tube soft clip
  'M 2 40 L 26 40 L 34 2 L 40 2 L 44 24 L 62 24', // toaster
]

export function SaturatorPort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values
  const type = v['Type'] ?? 0
  const colorOn = (v['ColorOn'] ?? 1) === 1

  return (
    <DevicePortFrame name="Saturator (port)" element="Saturator">
      <div className="b2-flow">
        <div className="b2-col">
          <Knob label="drive" value={v['BaseDrive'] ?? 0} min={-36} max={36} unit="dB" onChange={(x) => set('BaseDrive', x)} />
        </div>
        <Section label="curve">
          <div className="b2-row">
            <svg className="b2-graph" width={116} height={48} viewBox="0 0 64 40" aria-hidden="true">
              <line x1={0} y1={20} x2={64} y2={20} className="b2-graph-grid" />
              <line x1={32} y1={0} x2={32} y2={40} className="b2-graph-grid" />
              <path d={CURVES[Math.min(5, Math.max(0, type))]} className="b2-graph-curve" transform="translate(1,0)" />
            </svg>
          </div>
          <div className="b2-row">
            <Switch label="DC" value={(v['PreDcFilter'] ?? 1) === 1} onChange={(on) => set('PreDcFilter', on ? 1 : 0)} />
            <Menu label="curve" value={type} labels={SPECS[4].labels ?? []} onChange={(x) => set('Type', x)} />
          </div>
        </Section>
        <Section label="color" className={colorOn ? '' : 'b2-dimmed'}>
          <div className="b2-row">
            <Switch label="on" value={colorOn} onChange={(on) => set('ColorOn', on ? 1 : 0)} />
          </div>
          <div className="b2-row">
            <Knob label="base" value={v['PreDrive'] ?? 0} min={-36} max={36} unit="dB" size={28} onChange={(x) => set('PreDrive', x)} />
            <Knob label="freq" value={v['ColorFrequency'] ?? 18500} min={30} max={18500} unit="Hz" curve={2.6} size={28} onChange={(x) => set('ColorFrequency', x)} />
            <Knob label="width" value={v['ColorWidth'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('ColorWidth', x)} />
            <Knob label="depth" value={v['ColorDepth'] ?? 0} min={-24} max={24} unit="dB" size={28} onChange={(x) => set('ColorDepth', x)} />
          </div>
        </Section>
        <Section label="output">
          <div className="b2-row">
            <Knob label="output" value={v['PostDrive'] ?? 0} min={-36} max={0} unit="dB" onChange={(x) => set('PostDrive', x)} />
            <Switch label="soft clip" value={(v['PostClip'] ?? 0) === 1} onChange={(on) => set('PostClip', on ? 1 : 0)} />
            <Knob label="dry/wet" value={v['DryWet'] ?? 1} min={0} max={1} onChange={(x) => set('DryWet', x)} />
          </div>
          <div className="b2-row">
            <Readout wide value={`${(((v['DryWet'] ?? 1) * 100) | 0)} %`} label="mix" />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}

