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

/** Auto Filter port — envelope column left, filter curve center with
 * Cutoff/Res on its right, circuit row and quantize grid below, LFO/S&H
 * column right (capture: evidence/ui/device-panels/AutoFilter.png).
 * Control inventory: live-dynamics params.rs AUTOFILTER (device params +
 * nested Lfo hub). */

const SPECS: ParamSpec[] = [
  { id: 'FilterType', label: 'filter type', min: 0, max: 4, kind: 'discrete', labels: ['Low Pass', 'High Pass', 'Band Pass', 'Notch', 'Morph'], def: 0 },
  { id: 'Slope', label: 'slope 24dB', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Cutoff', label: 'freq', min: 20, max: 135, kind: 'continuous', def: 75, note: 'stored 20..135 is not a Hz span — semitone-scale mapping unmeasured' },
  { id: 'Resonance', label: 'res', min: 0, max: 1.25, kind: 'continuous', def: 0.14 },
  { id: 'Drive', label: 'drive', min: 0, max: 24, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'Attack', label: 'attack', min: 0.1, max: 30, kind: 'continuous', def: 6 },
  { id: 'Release', label: 'release', min: 0.1, max: 400, kind: 'continuous', def: 200 },
  { id: 'LfoAmount', label: 'lfo amount', min: 0, max: 30, kind: 'continuous', def: 0 },
  { id: 'Lfo/Type', label: 'lfo shape', min: 0, max: 2, kind: 'discrete', labels: ['Sine', 'Triangle', 'Sample & Hold'], def: 0 },
  { id: 'Lfo/Frequency', label: 'lfo rate', min: 0.01, max: 10, unit: 'Hz', kind: 'continuous', def: 0.01 },
  { id: 'Lfo/RateType', label: 'lfo rate mode', min: 0, max: 1, kind: 'discrete', labels: ['Hz', 'Beat'], def: 0 },
  { id: 'Lfo/BeatRate', label: 'lfo beat rate', min: 0, max: 21, kind: 'continuous', def: 8 },
  { id: 'Lfo/StereoMode', label: 'stereo mode', min: 0, max: 1, kind: 'discrete', labels: ['Phase', 'Spin'], def: 0 },
  { id: 'Lfo/Spin', label: 'spin', min: 0, max: 0.5, kind: 'continuous', def: 0 },
  { id: 'Lfo/Phase', label: 'phase', min: 0, max: 360, unit: 'deg', kind: 'continuous', def: 0 },
  { id: 'Lfo/Offset', label: 'offset', min: 0, max: 360, unit: 'deg', kind: 'continuous', def: 0 },
  { id: 'Lfo/IsOn', label: 'lfo on', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Lfo/Quantize', label: 'lfo quantize', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Lfo/BeatQuantize', label: 'quantize grid', min: 0, max: 2, kind: 'discrete', labels: ['Off', 'Bar', 'Beat'], def: 2 },
  { id: 'Lfo/NoiseWidth', label: 's&h noise', min: 0, max: 1, kind: 'continuous', def: 1 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'LegacyMode', label: 'legacy mode', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'LegacyFilterType', label: 'legacy filter type', min: 0, max: 3, kind: 'discrete', labels: ['?', '?', '?', '?'] },
  { id: 'LegacyQ', label: 'legacy q', min: 0.2, max: 3, kind: 'continuous', def: 0.2 },
  { id: 'CircuitLpHp', label: 'circuit lp/hp', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'CircuitBpNoMo', label: 'circuit', min: 0, max: 1, kind: 'discrete', labels: ['Clean', 'OVDR'] },
  { id: 'Morph', label: 'morph', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'ModHub', label: 'mod hub', min: -127, max: 127, kind: 'continuous', def: 0 },
]

/** filter response curve for the type at normalized cutoff x, res r */
function filterCurve(type: number, cutoff: number, res: number): string {
  const pts: string[] = []
  const c = cutoff / 135
  for (let i = 0; i <= 96; i++) {
    const x = i / 96
    let y: number
    if (type === 0) y = 1 / (1 + Math.pow(Math.max(0, (x - c) / 0.12), 2)) // LP
    else if (type === 1) y = 1 / (1 + Math.pow(Math.max(0, (c - x) / 0.12), 2)) // HP
    else if (type === 2) y = 1 / (1 + Math.pow(Math.abs(x - c) / 0.1, 2)) // BP
    else if (type === 3) y = 1 - 0.9 / (1 + Math.pow(Math.abs(x - c) / 0.03, 2)) // Notch
    else y = 0.4 + 0.5 / (1 + Math.pow(Math.abs(x - c) / 0.18, 2)) // Morph
    const peak = 1 + res * 1.6 * Math.exp(-Math.pow((x - c) / 0.02, 2))
    const yy = 118 - Math.min(1, y * peak) * 112
    pts.push(`${i === 0 ? 'M' : 'L'} ${(x * 236 + 2).toFixed(1)} ${yy.toFixed(1)}`)
  }
  return pts.join(' ')
}

export function AutoFilterPort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values
  const type = v['FilterType'] ?? 0
  const beatMode = (v['Lfo/RateType'] ?? 0) === 1

  return (
    <DevicePortFrame name="Auto Filter (port)" element="AutoFilter">
      <div className="b2-flow">
        <Section label="envelope">
          <div className="b2-col">
            <Knob label="attack" value={v['Attack'] ?? 6} min={0.1} max={30} curve={2} onChange={(x) => set('Attack', x)} />
            <Knob label="release" value={v['Release'] ?? 200} min={0.1} max={400} curve={2.4} onChange={(x) => set('Release', x)} />
          </div>
        </Section>
        <Section label="filter">
          <svg className="b2-graph" width={240} height={124} viewBox="0 0 240 124" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={f * 236 + 2} y1={4} x2={f * 236 + 2} y2={120} className="b2-graph-grid" />
            ))}
            <line x1={2} y1={62} x2={238} y2={62} className="b2-graph-grid" />
            <path d={filterCurve(type, v['Cutoff'] ?? 75, v['Resonance'] ?? 0.14)} className="b2-graph-curve" />
          </svg>
          <div className="b2-row">
            <Knob label="freq" value={v['Cutoff'] ?? 75} min={20} max={135} onChange={(x) => set('Cutoff', x)} title="cutoff — stored 20..135 (semitone-scale; not Hz)" />
            <Knob label="res" value={v['Resonance'] ?? 0.14} min={0} max={1.25} onChange={(x) => set('Resonance', x)} />
            <Knob label="drive" value={v['Drive'] ?? 0} min={0} max={24} unit="dB" onChange={(x) => set('Drive', x)} />
          </div>
          <div className="b2-row">
            <Menu label="type" value={type} labels={SPECS[0].labels ?? []} onChange={(x) => set('FilterType', x)} />
            <Segmented label="slope" value={(v['Slope'] ?? 0) * 1} labels={['12', '24']} min={0} onChange={(x) => set('Slope', x)} title="slope — stored 0/1 (12/24 dB)" />
            <Switch label="lfo on" value={(v['Lfo/IsOn'] ?? 0) === 1} onChange={(on) => set('Lfo/IsOn', on ? 1 : 0)} />
          </div>
        </Section>
        <Section label="lfo / s&h">
          <div className="b2-row">
            <Knob label="amount" value={v['LfoAmount'] ?? 0} min={0} max={30} onChange={(x) => set('LfoAmount', x)} />
            {beatMode ? (
              <Knob label="rate" value={v['Lfo/BeatRate'] ?? 8} min={0} max={21} step={1} onChange={(x) => set('Lfo/BeatRate', x)} title="lfo beat rate — stored 0..21 (division index)" />
            ) : (
              <Knob label="rate" value={v['Lfo/Frequency'] ?? 0.01} min={0.01} max={10} unit="Hz" curve={2} onChange={(x) => set('Lfo/Frequency', x)} />
            )}
            <Knob label="phase" value={v['Lfo/Phase'] ?? 0} min={0} max={360} unit="deg" size={28} onChange={(x) => set('Lfo/Phase', x)} />
            <Knob label="offset" value={v['Lfo/Offset'] ?? 0} min={0} max={360} unit="deg" size={28} onChange={(x) => set('Lfo/Offset', x)} />
          </div>
          <div className="b2-row">
            <Menu label="shape" value={v['Lfo/Type'] ?? 0} labels={SPECS[8].labels ?? []} onChange={(x) => set('Lfo/Type', x)} />
            <Menu label="stereo" value={v['Lfo/StereoMode'] ?? 0} labels={SPECS[12].labels ?? []} onChange={(x) => set('Lfo/StereoMode', x)} />
            <Knob label="spin" value={v['Lfo/Spin'] ?? 0} min={0} max={0.5} size={28} onChange={(x) => set('Lfo/Spin', x)} />
            <Knob label="s&h" value={v['Lfo/NoiseWidth'] ?? 1} min={0} max={1} size={28} onChange={(x) => set('Lfo/NoiseWidth', x)} />
          </div>
          <div className="b2-row">
            <Segmented label="rate mode" value={v['Lfo/RateType'] ?? 0} labels={SPECS[10].labels ?? []} onChange={(x) => set('Lfo/RateType', x)} />
            <Segmented label="grid" value={v['Lfo/BeatQuantize'] ?? 2} labels={SPECS[18].labels ?? []} columns={3} onChange={(x) => set('Lfo/BeatQuantize', x)} />
            <Switch label="quantize" value={(v['Lfo/Quantize'] ?? 0) === 1} onChange={(on) => set('Lfo/Quantize', on ? 1 : 0)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
