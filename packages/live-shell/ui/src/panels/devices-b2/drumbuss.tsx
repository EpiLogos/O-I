import {
  DevicePortFrame,
  Fader,
  Knob,
  ParamSpec,
  Readout,
  Section,
  Segmented,
  StoredExtras,
  Switch,
  useDeviceState,
} from './kit'

/** Drum Buss port — drive/crunch left, boom section center, Bass/Out
 * faders middle-right (capture: evidence/ui/device-panels/DrumBuss.png).
 * Control inventory: live-dynamics params.rs DRUMBUSS. */

const SPECS: ParamSpec[] = [
  { id: 'DriveAmount', label: 'drive', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'DriveType', label: 'character', min: 0, max: 2, kind: 'discrete', labels: ['Soft', 'Medium', 'Hard'], def: 0 },
  { id: 'CrunchAmount', label: 'crunch', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'BoomAmount', label: 'boom', min: 0, max: 1, kind: 'continuous', def: 0.45 },
  { id: 'BoomFrequency', label: 'freq', min: 30, max: 90, unit: 'Hz', kind: 'continuous', def: 55 },
  { id: 'BoomDecay', label: 'decay', min: 0, max: 1, kind: 'continuous', def: 1 },
  { id: 'BoomAudition', label: 'audition', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'DampingFrequency', label: 'damp', min: 500, max: 20000, unit: 'Hz', kind: 'continuous', def: 20000 },
  { id: 'TransientShaping', label: 'transients', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'InputTrim', label: 'trim', min: 0.0003162277571, max: 1, kind: 'continuous', def: 0.7 },
  { id: 'EnableCompression', label: 'comp', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'OutputGain', label: 'out', min: 0.01, max: 1.41253757, kind: 'continuous', def: 1 },
  { id: 'DryWet', label: 'dry/wet', min: 0, max: 1, kind: 'continuous', def: 1 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
]

function trimDb(v: number): string {
  const db = 20 * Math.log10(Math.max(v, 1e-6))
  return `${db >= 0 ? '+' : ''}${db.toFixed(2)} dB`
}

export function DrumBussPort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values

  return (
    <DevicePortFrame name="Drum Buss (port)" element="DrumBuss">
      <div className="b2-flow">
        <Section label="drive">
          <div className="b2-col">
            <Knob label="drive" value={v['DriveAmount'] ?? 0} min={0} max={1} onChange={(x) => set('DriveAmount', x)} />
            <Segmented label="character" value={v['DriveType'] ?? 0} labels={SPECS[1].labels ?? []} onChange={(x) => set('DriveType', x)} />
            <Knob label="crunch" value={v['CrunchAmount'] ?? 0} min={0} max={1} onChange={(x) => set('CrunchAmount', x)} />
            <div className="b2-row">
              <Readout wide value={trimDb(v['InputTrim'] ?? 0.7)} label="trim" />
            </div>
            <Switch label="comp" value={(v['EnableCompression'] ?? 0) === 1} onChange={(on) => set('EnableCompression', on ? 1 : 0)} />
          </div>
        </Section>
        <Section label="boom">
          <div className="b2-row">
            <Knob label="boom" value={v['BoomAmount'] ?? 0.45} min={0} max={1} onChange={(x) => set('BoomAmount', x)} />
            <Knob label="freq" value={v['BoomFrequency'] ?? 55} min={30} max={90} unit="Hz" onChange={(x) => set('BoomFrequency', x)} />
            <Knob label="decay" value={v['BoomDecay'] ?? 1} min={0} max={1} onChange={(x) => set('BoomDecay', x)} />
          </div>
          <div className="b2-row">
            <Switch label="audition" value={(v['BoomAudition'] ?? 0) === 1} onChange={(on) => set('BoomAudition', on ? 1 : 0)} />
          </div>
        </Section>
        <Section label="tone">
          <div className="b2-row">
            <Knob label="damp" value={v['DampingFrequency'] ?? 20000} min={500} max={20000} unit="Hz" curve={2.2} onChange={(x) => set('DampingFrequency', x)} />
            <Knob label="transients" value={v['TransientShaping'] ?? 0} min={-1} max={1} onChange={(x) => set('TransientShaping', x)} />
          </div>
        </Section>
        <Section label="level">
          <div className="b2-row">
            <Fader label="bass" value={v['BoomAmount'] ?? 0.45} min={0} max={1} onChange={(x) => set('BoomAmount', x)} title="bass level — mirrors the boom amount (both real displays read the same stored value)" />
            <Fader label="out" value={v['OutputGain'] ?? 1} min={0.01} max={1.41253757} onChange={(x) => set('OutputGain', x)} title="output gain — stored linear" />
          </div>
          <div className="b2-row">
            <Knob label="dry/wet" value={v['DryWet'] ?? 1} min={0} max={1} size={28} onChange={(x) => set('DryWet', x)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
