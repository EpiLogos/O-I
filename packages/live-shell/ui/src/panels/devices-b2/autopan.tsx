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
  wavePath,
} from './kit'

/** Auto Pan port — LFO wave display, Amount/Rate/Phase/Shape row,
 * Normal/Quantize + Offset row (capture: evidence/ui/device-panels/AutoPan.png).
 * Control inventory: live-dynamics params.rs AUTOPAN (all live params in
 * the nested Lfo hub; device level carries only On). */

const SPECS: ParamSpec[] = [
  { id: 'Lfo/LfoAmount', label: 'amount', min: 0, max: 1, kind: 'continuous', def: 0.496 },
  { id: 'Lfo/Frequency', label: 'rate', min: 0.05, max: 90, unit: 'Hz', kind: 'continuous', def: 3.7 },
  { id: 'Lfo/BeatRate', label: 'beat rate', min: 0, max: 14, kind: 'continuous', def: 6 },
  { id: 'Lfo/RateType', label: 'rate mode', min: 0, max: 1, kind: 'discrete', labels: ['Normal', 'Quantized'], def: 1 },
  { id: 'Lfo/Quantize', label: 'quantize', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Lfo/Phase', label: 'phase', min: 0, max: 360, unit: 'deg', kind: 'continuous', def: 256 },
  { id: 'Lfo/LfoShape', label: 'shape', min: 0, max: 1, kind: 'continuous', def: 0.6 },
  { id: 'Lfo/Offset', label: 'offset', min: 0, max: 360, unit: 'deg', kind: 'continuous', def: 0 },
  { id: 'Lfo/Spin', label: 'spin', min: 0, max: 0.5, kind: 'continuous', def: 0 },
  { id: 'Lfo/LfoInvert', label: 'invert', min: 0, max: 1, kind: 'toggle', def: 0 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Lfo/Type', label: 'waveform', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Lfo/StereoMode', label: 'stereo mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Lfo/IsOn', label: 'lfo on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Lfo/BeatQuantize', label: 'beat quantize', min: 0, max: 2, kind: 'discrete', labels: ['?', '?', '?'] },
  { id: 'Lfo/NoiseWidth', label: 'noise width', min: 0, max: 1, kind: 'continuous', def: 0 },
]

/** the quantized divisions the real panel offers across the BeatRate range */
const BEAT_LABELS = ['1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '12', '16', '24', '32']

export function AutoPanPort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values
  const quantized = (v['Lfo/RateType'] ?? 0) === 1
  const cycles = quantized ? 2 : 3

  return (
    <DevicePortFrame name="Auto Pan (port)" element="AutoPan">
      <div className="b2-flow">
        <div className="b2-col">
          <svg className="b2-graph" width={196} height={56} viewBox="0 0 196 56" aria-hidden="true">
            <text x={4} y={12} className="b2-graph-tag">L</text>
            <text x={4} y={52} className="b2-graph-tag">R</text>
            <path d={wavePath(196, 56, cycles)} className="b2-graph-curve" />
            <path d={wavePath(196, 56, cycles, Math.PI)} className="b2-graph-curve-2" opacity={0.55} />
          </svg>
          <div className="b2-row">
            <Segmented label="rate mode" value={v['Lfo/RateType'] ?? 0} labels={SPECS[3].labels ?? []} onChange={(x) => set('Lfo/RateType', x)} />
            <Switch label="quantize" value={(v['Lfo/Quantize'] ?? 0) === 1} onChange={(on) => set('Lfo/Quantize', on ? 1 : 0)} />
            <Switch label="invert" value={(v['Lfo/LfoInvert'] ?? 0) === 1} onChange={(on) => set('Lfo/LfoInvert', on ? 1 : 0)} />
          </div>
        </div>
        <Section label="lfo">
          <div className="b2-row">
            <Knob label="amount" value={v['Lfo/LfoAmount'] ?? 0.496} min={0} max={1} onChange={(x) => set('Lfo/LfoAmount', x)} />
            {quantized ? (
              <Knob
                label="rate"
                value={v['Lfo/BeatRate'] ?? 6}
                min={0}
                max={14}
                step={1}
                onChange={(x) => set('Lfo/BeatRate', x)}
                title={`beat rate — stored 0..14 (division index ${BEAT_LABELS[Math.round(v['Lfo/BeatRate'] ?? 6)] ?? '?'})`}
              />
            ) : (
              <Knob label="rate" value={v['Lfo/Frequency'] ?? 3.7} min={0.05} max={90} unit="Hz" curve={2.4} onChange={(x) => set('Lfo/Frequency', x)} />
            )}
            <Knob label="phase" value={v['Lfo/Phase'] ?? 256} min={0} max={360} unit="deg" onChange={(x) => set('Lfo/Phase', x)} />
            <Knob label="shape" value={v['Lfo/LfoShape'] ?? 0.6} min={0} max={1} onChange={(x) => set('Lfo/LfoShape', x)} />
          </div>
          <div className="b2-row">
            <Knob label="offset" value={v['Lfo/Offset'] ?? 0} min={0} max={360} unit="deg" onChange={(x) => set('Lfo/Offset', x)} />
            <Knob label="spin" value={v['Lfo/Spin'] ?? 0} min={0} max={0.5} size={28} onChange={(x) => set('Lfo/Spin', x)} />
            {quantized ? (
              <Menu
                label="division"
                value={Math.round(v['Lfo/BeatRate'] ?? 6)}
                labels={BEAT_LABELS}
                onChange={(x) => set('Lfo/BeatRate', x)}
                title="beat rate as division (stored index)"
              />
            ) : null}
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
