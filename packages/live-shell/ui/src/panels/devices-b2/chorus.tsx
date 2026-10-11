import {
  DevicePortFrame,
  Knob,
  ParamSpec,
  Section,
  Segmented,
  StoredExtras,
  useDeviceState,
  wavePath,
} from './kit'

/** Chorus-Ensemble port — wave display top, mode tabs Classic/Ensemble/
 * Vibrato, Rate/Amount/Feedback row, Output/Warmth/DryWet column right
 * (capture: evidence/ui/device-panels/Chorus-Ensemble.png).
 * Control inventory: live-dynamics params.rs CHORUS_ENSEMBLE. */

const SPECS: ParamSpec[] = [
  { id: 'Mode', label: 'mode', min: 0, max: 2, kind: 'discrete', labels: ['Classic', 'Ensemble', 'Vibrato'], def: 0 },
  { id: 'Rate', label: 'rate', min: 0.1, max: 15, unit: 'Hz', kind: 'continuous', def: 0.82 },
  { id: 'Amount', label: 'amount', min: 0, max: 1, kind: 'continuous', def: 0.59 },
  { id: 'Feedback', label: 'feedback', min: 0, max: 0.99, kind: 'continuous', def: 0 },
  { id: 'Shaping', label: 'shape', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Width', label: 'width', min: 0, max: 2, kind: 'continuous', def: 1 },
  { id: 'OutputGain', label: 'output', min: 0, max: 2, kind: 'continuous', def: 1 },
  { id: 'Warmth', label: 'warmth', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'DryWet', label: 'dry/wet', min: 0, max: 1, kind: 'continuous', def: 1 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'InvertFeedback', label: 'invert fb', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'VibratoOffset', label: 'vibrato offset', min: 0, max: 180, unit: 'deg', kind: 'continuous', def: 0 },
  { id: 'HighpassEnabled', label: 'highpass', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'HighpassFrequency', label: 'hp freq', min: 20, max: 2000, unit: 'Hz', kind: 'continuous', def: 20 },
]

const MODE_CYCLES = [1, 2, 5]

export function ChorusEnsemblePort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values
  const mode = v['Mode'] ?? 0

  return (
    <DevicePortFrame name="Chorus-Ensemble (port)" element="Chorus2">
      <div className="b2-flow">
        <div className="b2-col">
          <svg className="b2-graph" width={168} height={54} viewBox="0 0 168 54" aria-hidden="true">
            <path d={wavePath(168, 54, MODE_CYCLES[mode] ?? 1)} className="b2-graph-curve" />
            <path d={wavePath(168, 54, (MODE_CYCLES[mode] ?? 1) + 1, 1.1)} className="b2-graph-curve-2" opacity={0.6} />
          </svg>
          <Segmented label="mode" value={mode} labels={SPECS[0].labels ?? []} onChange={(x) => set('Mode', x)} />
        </div>
        <Section label="modulation">
          <div className="b2-row">
            <Knob label="rate" value={v['Rate'] ?? 0.82} min={0.1} max={15} unit="Hz" curve={2} onChange={(x) => set('Rate', x)} />
            <Knob label="amount" value={v['Amount'] ?? 0.59} min={0} max={1} onChange={(x) => set('Amount', x)} />
            <Knob label="feedback" value={v['Feedback'] ?? 0} min={0} max={0.99} onChange={(x) => set('Feedback', x)} />
          </div>
          <div className="b2-row">
            <Knob label="shape" value={v['Shaping'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Shaping', x)} title="shaping — stored 0..1" />
            <Knob label="width" value={v['Width'] ?? 1} min={0} max={2} size={28} onChange={(x) => set('Width', x)} />
          </div>
        </Section>
        <Section label="output">
          <div className="b2-col">
            <Knob label="output" value={v['OutputGain'] ?? 1} min={0} max={2} onChange={(x) => set('OutputGain', x)} />
            <Knob label="warmth" value={v['Warmth'] ?? 0} min={0} max={1} onChange={(x) => set('Warmth', x)} />
            <Knob label="dry/wet" value={v['DryWet'] ?? 1} min={0} max={1} onChange={(x) => set('DryWet', x)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
