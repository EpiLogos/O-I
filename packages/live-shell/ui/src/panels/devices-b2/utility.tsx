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

/** Utility port — Input column (phase, mode, width, mono, bass mono) and
 * Output column (gain, balance, mute, DC) (capture:
 * evidence/ui/device-panels/Utility.png).
 * Control inventory: live-dynamics params.rs STEREO_GAIN (the Utility
 * device's element name). */

const SPECS: ParamSpec[] = [
  { id: 'PhaseInvertL', label: 'ø L', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'PhaseInvertR', label: 'ø R', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'ChannelMode', label: 'mode', min: 0, max: 2, kind: 'discrete', labels: ['Stereo', 'Mid/Side', 'Left/Right'], def: 0 },
  { id: 'StereoWidth', label: 'width', min: 0, max: 4, kind: 'continuous', def: 2 },
  { id: 'Mono', label: 'mono', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'BassMono', label: 'bass mono', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'BassMonoFrequency', label: 'bass mono freq', min: 50, max: 500, unit: 'Hz', kind: 'continuous', def: 120 },
  { id: 'BassMonoAudition', label: 'bass audition', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Gain', label: 'gain', min: 0, max: 56.2341309, kind: 'continuous', def: 1 },
  { id: 'Balance', label: 'balance', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'Mute', label: 'mute', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'DcFilter', label: 'DC', min: 0, max: 1, kind: 'toggle', def: 1 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'MidSideBalance', label: 'm/s balance', min: 0, max: 2, kind: 'continuous', def: 1 },
  { id: 'MidSideBalanceOn', label: 'm/s balance on', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'LegacyGain', label: 'legacy gain', min: -35, max: 35, unit: 'dB', kind: 'continuous', def: 0 },
  { id: 'LegacyMode', label: 'legacy mode', min: 0, max: 1, kind: 'toggle', def: 0 },
]

function gainDb(v: number): string {
  const db = 20 * Math.log10(Math.max(v, 1e-6))
  return `${db >= 0 ? '+' : ''}${db.toFixed(2)} dB`
}

export function UtilityPort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values

  return (
    <DevicePortFrame name="Utility (port)" element="StereoGain">
      <div className="b2-flow">
        <Section label="input">
          <div className="b2-row">
            <Switch label="ø L" value={(v['PhaseInvertL'] ?? 0) === 1} onChange={(on) => set('PhaseInvertL', on ? 1 : 0)} />
            <Switch label="ø R" value={(v['PhaseInvertR'] ?? 0) === 1} onChange={(on) => set('PhaseInvertR', on ? 1 : 0)} />
            <Menu label="mode" value={v['ChannelMode'] ?? 0} labels={SPECS[2].labels ?? []} onChange={(x) => set('ChannelMode', x)} />
          </div>
          <div className="b2-row">
            <Knob label="width" value={v['StereoWidth'] ?? 2} min={0} max={4} onChange={(x) => set('StereoWidth', x)} />
            <Switch label="mono" value={(v['Mono'] ?? 0) === 1} onChange={(on) => set('Mono', on ? 1 : 0)} />
          </div>
          <div className="b2-row">
            <Switch label="bass mono" value={(v['BassMono'] ?? 0) === 1} onChange={(on) => set('BassMono', on ? 1 : 0)} />
            <Knob label="freq" value={v['BassMonoFrequency'] ?? 120} min={50} max={500} unit="Hz" size={28} onChange={(x) => set('BassMonoFrequency', x)} />
            <Switch label="audition" value={(v['BassMonoAudition'] ?? 0) === 1} onChange={(on) => set('BassMonoAudition', on ? 1 : 0)} />
          </div>
        </Section>
        <Section label="output">
          <div className="b2-col">
            <Knob label="gain" value={v['Gain'] ?? 1} min={0} max={56.2341309} onChange={(x) => set('Gain', x)} title={`gain — stored linear 0..56.234 (reads ${gainDb(v['Gain'] ?? 1)})`} />
            <Readout wide value={gainDb(v['Gain'] ?? 1)} label="gain" />
            <Knob label="balance" value={v['Balance'] ?? 0} min={-1} max={1} onChange={(x) => set('Balance', x)} title="balance — stored -1..1 (C = 0)" />
            <div className="b2-row">
              <Switch label="mute" value={(v['Mute'] ?? 0) === 1} onChange={(on) => set('Mute', on ? 1 : 0)} />
              <Switch label="DC" value={(v['DcFilter'] ?? 1) === 1} onChange={(on) => set('DcFilter', on ? 1 : 0)} />
            </div>
          </div>
        </Section>
        <Section label="mid/side">
          <div className="b2-row">
            <Switch label="m/s balance" value={(v['MidSideBalanceOn'] ?? 0) === 1} onChange={(on) => set('MidSideBalanceOn', on ? 1 : 0)} />
            <Knob label="balance" value={v['MidSideBalance'] ?? 1} min={0} max={2} size={28} onChange={(x) => set('MidSideBalance', x)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
