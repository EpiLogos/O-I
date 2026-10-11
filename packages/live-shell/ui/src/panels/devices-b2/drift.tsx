import {
  DevicePortFrame,
  Knob,
  Menu,
  ParamSpec,
  Section,
  StoredExtras,
  Switch,
  useDeviceState,
} from './kit'

/** Drift port — oscillator columns left (Osc1/Osc2/Pitch Mod/Osc Mix),
 * filter + envelopes + LFO center, modulation matrix and voice/global
 * right (capture: evidence/ui/device-panels/Drift.png).
 * Control inventory: live-dynamics params.rs DRIFT. */

const OSC1: ParamSpec[] = [
  { id: 'Oscillator1_Type', label: 'osc1 type', min: 0, max: 4, kind: 'discrete', labels: ['Analog', 'Basic Waves', 'Slow Wave', 'Comb', 'Harmonic'] },
  { id: 'Oscillator1_Shape', label: 'shape', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Oscillator1_Transpose', label: 'oct', min: -2, max: 3, unit: 'st', kind: 'continuous', def: 0 },
  { id: 'Oscillator1_ShapeModSource', label: 'shape mod src', min: 0, max: 7, kind: 'discrete', labels: ['?', '?', '?', '?', '?', '?', '?', '?'] },
  { id: 'Oscillator1_ShapeMod', label: 'shape mod', min: -1, max: 1, kind: 'continuous', def: 0 },
]

const OSC2: ParamSpec[] = [
  { id: 'Oscillator2_Type', label: 'osc2 type', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Oscillator2_Detune', label: 'detune', min: -7, max: 7, unit: 'st', kind: 'continuous', def: 0 },
  { id: 'Oscillator2_Transpose', label: 'oct', min: -3, max: 2, unit: 'st', kind: 'continuous', def: 0 },
]

const PITCHMOD: ParamSpec[] = [
  { id: 'PitchModulation_Source1', label: 'src 1', min: 0, max: 1, kind: 'discrete', labels: ['Env 2', 'LFO'] },
  { id: 'PitchModulation_Amount1', label: 'amount 1', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'PitchModulation_Source2', label: 'src 2', min: 0, max: 2, kind: 'discrete', labels: ['?', '?', '?'] },
  { id: 'PitchModulation_Amount2', label: 'amount 2', min: -1, max: 1, kind: 'continuous', def: 0 },
]

const MIXER: ParamSpec[] = [
  { id: 'Mixer_OscillatorOn1', label: 'osc1 on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Mixer_OscillatorGain1', label: 'osc1', min: 0, max: 1.99526799, kind: 'continuous', def: 1 },
  { id: 'Mixer_OscillatorOn2', label: 'osc2 on', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Mixer_OscillatorGain2', label: 'osc2', min: 0, max: 1.99526799, kind: 'continuous', def: 1 },
  { id: 'Mixer_NoiseOn', label: 'noise on', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Mixer_NoiseLevel', label: 'noise', min: 0, max: 1.99526799, kind: 'continuous', def: 0 },
]

const FILTER: ParamSpec[] = [
  { id: 'Filter_Type', label: 'type', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Filter_Frequency', label: 'freq', min: 20, max: 20000, unit: 'Hz', kind: 'continuous', def: 20000 },
  { id: 'Filter_Resonance', label: 'res', min: 0, max: 1.01, kind: 'continuous', def: 0 },
  { id: 'Filter_HiPassFrequency', label: 'hp freq', min: 10, max: 20480, unit: 'Hz', kind: 'continuous', def: 10 },
  { id: 'Filter_Tracking', label: 'track', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Filter_ModSource1', label: 'mod src 1', min: 0, max: 1, kind: 'discrete', labels: ['Env 2', 'LFO'] },
  { id: 'Filter_ModAmount1', label: 'mod 1', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'Filter_ModSource2', label: 'mod src 2', min: 0, max: 6, kind: 'discrete', labels: ['?', '?', '?', '?', '?', '?', '?'] },
  { id: 'Filter_ModAmount2', label: 'mod 2', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'Filter_OscillatorThrough1', label: 'osc1 through', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Filter_OscillatorThrough2', label: 'osc2 through', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Filter_NoiseThrough', label: 'noise through', min: 0, max: 1, kind: 'toggle', def: 1 },
]

function adsr(prefix: string, n: number): ParamSpec[] {
  return [
    { id: `${prefix}_Attack`, label: `${n} attack`, min: 0, max: 60, unit: 's', kind: 'continuous', def: n === 1 ? 0.01 : 0.05 },
    { id: `${prefix}_Decay`, label: `${n} decay`, min: 0.005, max: 60, unit: 's', kind: 'continuous', def: 0.6 },
    { id: `${prefix}_Sustain`, label: `${n} sustain`, min: 0, max: 1, kind: 'continuous', def: n === 1 ? 0.7 : 0 },
    { id: `${prefix}_Release`, label: `${n} release`, min: 0.01, max: 60, unit: 's', kind: 'continuous', def: 0.6 },
  ]
}

const ENVELOPES: ParamSpec[] = [...adsr('Envelope1', 1), ...adsr('Envelope2', 2)]

const LFO: ParamSpec[] = [
  { id: 'Lfo_Mode', label: 'mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Lfo_Rate', label: 'rate', min: 0.17, max: 1700, unit: 'Hz', kind: 'continuous', def: 4 },
  { id: 'Lfo_Ratio', label: 'ratio', min: 0.25, max: 16, kind: 'continuous', def: 1 },
  { id: 'Lfo_Time', label: 'time', min: 0.1, max: 60, unit: 's', kind: 'continuous', def: 1 },
  { id: 'Lfo_SyncedRate', label: 'synced rate', min: 0, max: 21, kind: 'continuous', def: 8 },
  { id: 'Lfo_Shape', label: 'shape', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Lfo_Amount', label: 'amount', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Lfo_ModSource', label: 'mod src', min: 0, max: 5, kind: 'discrete', labels: ['?', '?', '?', '?', '?', '?'] },
  { id: 'Lfo_ModAmount', label: 'mod amount', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'Lfo_Retrigger', label: 'retrigger', min: 0, max: 1, kind: 'toggle', def: 0 },
]

const CYCLING: ParamSpec[] = [
  { id: 'CyclingEnvelope_Mode', label: 'mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'CyclingEnvelope_Rate', label: 'rate', min: 0.17, max: 1700, unit: 'Hz', kind: 'continuous', def: 4 },
  { id: 'CyclingEnvelope_Ratio', label: 'ratio', min: 0.25, max: 16, kind: 'continuous', def: 1 },
  { id: 'CyclingEnvelope_Time', label: 'time', min: 0.1, max: 60, unit: 's', kind: 'continuous', def: 1 },
  { id: 'CyclingEnvelope_SyncedRate', label: 'synced rate', min: 0, max: 21, kind: 'continuous', def: 8 },
  { id: 'CyclingEnvelope_MidPoint', label: 'mid point', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'CyclingEnvelope_Hold', label: 'hold', min: 0, max: 1, kind: 'continuous', def: 0 },
]

const MATRIX: ParamSpec[] = [
  { id: 'ModulationMatrix_Source1', label: 'src 1', min: 0, max: 5, kind: 'discrete', labels: ['?', '?', '?', '?', '?', '?'] },
  { id: 'ModulationMatrix_Amount1', label: 'amt 1', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'ModulationMatrix_Target1', label: 'tgt 1', min: 0, max: 8, kind: 'discrete', labels: ['?', '?', '?', '?', '?', '?', '?', '?', '?'] },
  { id: 'ModulationMatrix_Source2', label: 'src 2', min: 0, max: 4, kind: 'discrete', labels: ['?', '?', '?', '?', '?'] },
  { id: 'ModulationMatrix_Amount2', label: 'amt 2', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'ModulationMatrix_Target2', label: 'tgt 2', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'ModulationMatrix_Source3', label: 'src 3', min: 0, max: 6, kind: 'discrete', labels: ['?', '?', '?', '?', '?', '?', '?'] },
  { id: 'ModulationMatrix_Amount3', label: 'amt 3', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'ModulationMatrix_Target3', label: 'tgt 3', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
]

const GLOBALP: ParamSpec[] = [
  { id: 'Global_VoiceMode', label: 'voice mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Global_VoiceCount', label: 'voices', min: 0, max: 4, kind: 'discrete', labels: ['1', '2', '3', '4', '6'], def: 2 },
  { id: 'Global_PolyVoiceDepth', label: 'poly depth', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Global_StereoVoiceDepth', label: 'stereo depth', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Global_UnisonVoiceDepth', label: 'unison depth', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Global_MonoVoiceDepth', label: 'mono depth', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Global_PitchBendRange', label: 'pb range', min: 0, max: 2, kind: 'discrete', labels: ['?', '?', '?'] },
  { id: 'Global_DriftDepth', label: 'drift', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Global_Legato', label: 'legato', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Global_NotePitchBend', label: 'note pb', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Global_Glide', label: 'glide', min: 0, max: 2, kind: 'continuous', def: 0 },
  { id: 'Global_Volume', label: 'volume', min: 0, max: 1, kind: 'continuous', def: 0.79 },
  { id: 'Global_Transpose', label: 'transpose', min: -48, max: 48, unit: 'st', kind: 'continuous', def: 0 },
  { id: 'Global_VolVelMod', label: 'vel mod', min: 0, max: 1, kind: 'continuous', def: 0.2 },
  { id: 'Global_ResetOscillatorPhase', label: 'reset phase', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Global_Envelope2Mode', label: 'env2 mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
]

function AdsrBlock({ prefix, v, set }: { prefix: string; v: Record<string, number>; set: (id: string, x: number) => void }) {
  return (
    <div className="b2-row">
      <Knob label="attack" value={v[`${prefix}_Attack`] ?? 0} min={0} max={60} unit="s" curve={2.6} size={28} onChange={(x) => set(`${prefix}_Attack`, x)} />
      <Knob label="decay" value={v[`${prefix}_Decay`] ?? 0.6} min={0.005} max={60} unit="s" curve={2.6} size={28} onChange={(x) => set(`${prefix}_Decay`, x)} />
      <Knob label="sustain" value={v[`${prefix}_Sustain`] ?? 0} min={0} max={1} size={28} onChange={(x) => set(`${prefix}_Sustain`, x)} />
      <Knob label="release" value={v[`${prefix}_Release`] ?? 0.6} min={0.01} max={60} unit="s" curve={2.6} size={28} onChange={(x) => set(`${prefix}_Release`, x)} />
    </div>
  )
}

export function DriftPort() {
  const all = [...OSC1, ...OSC2, ...PITCHMOD, ...MIXER, ...FILTER, ...ENVELOPES, ...LFO, ...CYCLING, ...MATRIX, ...GLOBALP, ...EXTRAS]
  const { values, set } = useDeviceState(all)
  const v = values

  return (
    <DevicePortFrame name="Drift (port)" element="Drift">
      <div className="b2-flow">
        <Section label="oscillators">
          <div className="b2-row">
            <div className="b2-col">
              <Menu label="osc1" value={v['Oscillator1_Type'] ?? 0} labels={OSC1[0].labels ?? []} onChange={(x) => set('Oscillator1_Type', x)} />
              <Knob label="shape" value={v['Oscillator1_Shape'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Oscillator1_Shape', x)} />
              <Knob label="oct" value={v['Oscillator1_Transpose'] ?? 0} min={-2} max={3} unit="st" size={28} onChange={(x) => set('Oscillator1_Transpose', x)} />
              <Menu label="sh mod src" value={v['Oscillator1_ShapeModSource'] ?? 0} labels={OSC1[3].labels ?? []} onChange={(x) => set('Oscillator1_ShapeModSource', x)} />
              <Knob label="sh mod" value={v['Oscillator1_ShapeMod'] ?? 0} min={-1} max={1} size={28} onChange={(x) => set('Oscillator1_ShapeMod', x)} />
            </div>
            <div className="b2-col">
              <Menu label="osc2" value={v['Oscillator2_Type'] ?? 0} labels={OSC2[0].labels ?? []} onChange={(x) => set('Oscillator2_Type', x)} />
              <Knob label="detune" value={v['Oscillator2_Detune'] ?? 0} min={-7} max={7} unit="st" size={28} onChange={(x) => set('Oscillator2_Detune', x)} />
              <Knob label="oct" value={v['Oscillator2_Transpose'] ?? 0} min={-3} max={2} unit="st" size={28} onChange={(x) => set('Oscillator2_Transpose', x)} />
            </div>
          </div>
        </Section>
        <Section label="pitch mod">
          <div className="b2-col">
            <Menu label="src 1" value={v['PitchModulation_Source1'] ?? 0} labels={PITCHMOD[0].labels ?? []} onChange={(x) => set('PitchModulation_Source1', x)} />
            <Knob label="amt 1" value={v['PitchModulation_Amount1'] ?? 0} min={-1} max={1} size={28} onChange={(x) => set('PitchModulation_Amount1', x)} />
            <Menu label="src 2" value={v['PitchModulation_Source2'] ?? 0} labels={PITCHMOD[2].labels ?? []} onChange={(x) => set('PitchModulation_Source2', x)} />
            <Knob label="amt 2" value={v['PitchModulation_Amount2'] ?? 0} min={-1} max={1} size={28} onChange={(x) => set('PitchModulation_Amount2', x)} />
          </div>
        </Section>
        <Section label="osc mix">
          <div className="b2-col">
            <Switch label="osc1" value={(v['Mixer_OscillatorOn1'] ?? 1) === 1} onChange={(on) => set('Mixer_OscillatorOn1', on ? 1 : 0)} />
            <Knob label="osc1" value={v['Mixer_OscillatorGain1'] ?? 1} min={0} max={1.99526799} size={28} onChange={(x) => set('Mixer_OscillatorGain1', x)} />
            <Switch label="osc2" value={(v['Mixer_OscillatorOn2'] ?? 0) === 1} onChange={(on) => set('Mixer_OscillatorOn2', on ? 1 : 0)} />
            <Knob label="osc2" value={v['Mixer_OscillatorGain2'] ?? 1} min={0} max={1.99526799} size={28} onChange={(x) => set('Mixer_OscillatorGain2', x)} />
            <Switch label="noise" value={(v['Mixer_NoiseOn'] ?? 0) === 1} onChange={(on) => set('Mixer_NoiseOn', on ? 1 : 0)} />
            <Knob label="noise" value={v['Mixer_NoiseLevel'] ?? 0} min={0} max={1.99526799} size={28} onChange={(x) => set('Mixer_NoiseLevel', x)} />
          </div>
        </Section>
        <Section label="filter">
          <div className="b2-row">
            <Menu label="type" value={v['Filter_Type'] ?? 0} labels={FILTER[0].labels ?? []} onChange={(x) => set('Filter_Type', x)} />
            <Knob label="freq" value={v['Filter_Frequency'] ?? 20000} min={20} max={20000} unit="Hz" curve={2.8} onChange={(x) => set('Filter_Frequency', x)} />
            <Knob label="res" value={v['Filter_Resonance'] ?? 0} min={0} max={1.01} size={28} onChange={(x) => set('Filter_Resonance', x)} />
          </div>
          <div className="b2-row">
            <Knob label="hp" value={v['Filter_HiPassFrequency'] ?? 10} min={10} max={20480} unit="Hz" curve={2.8} size={28} onChange={(x) => set('Filter_HiPassFrequency', x)} />
            <Knob label="track" value={v['Filter_Tracking'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Filter_Tracking', x)} />
            <Menu label="src 1" value={v['Filter_ModSource1'] ?? 0} labels={FILTER[5].labels ?? []} onChange={(x) => set('Filter_ModSource1', x)} />
            <Knob label="mod 1" value={v['Filter_ModAmount1'] ?? 0} min={-1} max={1} size={28} onChange={(x) => set('Filter_ModAmount1', x)} />
            <Menu label="src 2" value={v['Filter_ModSource2'] ?? 0} labels={FILTER[7].labels ?? []} onChange={(x) => set('Filter_ModSource2', x)} />
            <Knob label="mod 2" value={v['Filter_ModAmount2'] ?? 0} min={-1} max={1} size={28} onChange={(x) => set('Filter_ModAmount2', x)} />
          </div>
          <div className="b2-row">
            <Switch label="osc1 thru" value={(v['Filter_OscillatorThrough1'] ?? 1) === 1} onChange={(on) => set('Filter_OscillatorThrough1', on ? 1 : 0)} />
            <Switch label="osc2 thru" value={(v['Filter_OscillatorThrough2'] ?? 1) === 1} onChange={(on) => set('Filter_OscillatorThrough2', on ? 1 : 0)} />
            <Switch label="noise thru" value={(v['Filter_NoiseThrough'] ?? 1) === 1} onChange={(on) => set('Filter_NoiseThrough', on ? 1 : 0)} />
          </div>
        </Section>
        <Section label="envelopes">
          <div className="b2-col">
            <span className="b2-col-label">env 1</span>
            <AdsrBlock prefix="Envelope1" v={v} set={set} />
            <span className="b2-col-label">env 2</span>
            <AdsrBlock prefix="Envelope2" v={v} set={set} />
          </div>
        </Section>
        <Section label="lfo">
          <div className="b2-row">
            <Menu label="mode" value={v['Lfo_Mode'] ?? 0} labels={LFO[0].labels ?? []} onChange={(x) => set('Lfo_Mode', x)} />
            <Knob label="rate" value={v['Lfo_Rate'] ?? 4} min={0.17} max={1700} unit="Hz" curve={3} onChange={(x) => set('Lfo_Rate', x)} />
            <Menu label="shape" value={v['Lfo_Shape'] ?? 0} labels={LFO[5].labels ?? []} onChange={(x) => set('Lfo_Shape', x)} />
            <Knob label="amount" value={v['Lfo_Amount'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('Lfo_Amount', x)} />
            <Switch label="retrig" value={(v['Lfo_Retrigger'] ?? 0) === 1} onChange={(on) => set('Lfo_Retrigger', on ? 1 : 0)} />
          </div>
          <div className="b2-row">
            <Menu label="mod src" value={v['Lfo_ModSource'] ?? 0} labels={LFO[7].labels ?? []} onChange={(x) => set('Lfo_ModSource', x)} />
            <Knob label="mod amt" value={v['Lfo_ModAmount'] ?? 0} min={-1} max={1} size={28} onChange={(x) => set('Lfo_ModAmount', x)} />
            <Knob label="ratio" value={v['Lfo_Ratio'] ?? 1} min={0.25} max={16} size={26} onChange={(x) => set('Lfo_Ratio', x)} />
            <Knob label="time" value={v['Lfo_Time'] ?? 1} min={0.1} max={60} unit="s" curve={2.4} size={26} onChange={(x) => set('Lfo_Time', x)} />
            <Knob label="synced" value={v['Lfo_SyncedRate'] ?? 8} min={0} max={21} size={26} onChange={(x) => set('Lfo_SyncedRate', x)} />
          </div>
          <div className="b2-row">
            <Menu label="cyc mode" value={v['CyclingEnvelope_Mode'] ?? 0} labels={CYCLING[0].labels ?? []} onChange={(x) => set('CyclingEnvelope_Mode', x)} />
            <Knob label="cyc rate" value={v['CyclingEnvelope_Rate'] ?? 4} min={0.17} max={1700} unit="Hz" curve={3} size={28} onChange={(x) => set('CyclingEnvelope_Rate', x)} />
            <Knob label="cyc ratio" value={v['CyclingEnvelope_Ratio'] ?? 1} min={0.25} max={16} size={26} onChange={(x) => set('CyclingEnvelope_Ratio', x)} />
            <Knob label="cyc time" value={v['CyclingEnvelope_Time'] ?? 1} min={0.1} max={60} unit="s" curve={2.4} size={26} onChange={(x) => set('CyclingEnvelope_Time', x)} />
            <Knob label="cyc synced" value={v['CyclingEnvelope_SyncedRate'] ?? 8} min={0} max={21} size={26} onChange={(x) => set('CyclingEnvelope_SyncedRate', x)} />
            <Knob label="cyc mid" value={v['CyclingEnvelope_MidPoint'] ?? 0.5} min={0} max={1} size={26} onChange={(x) => set('CyclingEnvelope_MidPoint', x)} />
            <Knob label="cyc hold" value={v['CyclingEnvelope_Hold'] ?? 0} min={0} max={1} size={26} onChange={(x) => set('CyclingEnvelope_Hold', x)} />
          </div>
        </Section>
        <Section label="modulation matrix">
          <div className="b2-col">
            {[0, 1, 2].map((n) => (
              <div className="b2-row" key={n}>
                <Menu label={`src ${n + 1}`} value={v[`ModulationMatrix_Source${n + 1}`] ?? 0} labels={MATRIX[n * 3].labels ?? []} onChange={(x) => set(`ModulationMatrix_Source${n + 1}`, x)} />
                <Knob label={`amt ${n + 1}`} value={v[`ModulationMatrix_Amount${n + 1}`] ?? 0} min={-1} max={1} size={26} onChange={(x) => set(`ModulationMatrix_Amount${n + 1}`, x)} />
                <Menu label={`tgt ${n + 1}`} value={v[`ModulationMatrix_Target${n + 1}`] ?? 0} labels={MATRIX[n * 3 + 2].labels ?? []} onChange={(x) => set(`ModulationMatrix_Target${n + 1}`, x)} />
              </div>
            ))}
          </div>
        </Section>
        <Section label="voice / global">
          <div className="b2-row">
            <Menu label="voice mode" value={v['Global_VoiceMode'] ?? 0} labels={GLOBALP[0].labels ?? []} onChange={(x) => set('Global_VoiceMode', x)} />
            <Menu label="voices" value={v['Global_VoiceCount'] ?? 2} labels={GLOBALP[1].labels ?? []} onChange={(x) => set('Global_VoiceCount', x)} />
            <Menu label="pb range" value={v['Global_PitchBendRange'] ?? 2} labels={GLOBALP[6].labels ?? []} onChange={(x) => set('Global_PitchBendRange', x)} />
            <Knob label="drift" value={v['Global_DriftDepth'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Global_DriftDepth', x)} />
            <Switch label="legato" value={(v['Global_Legato'] ?? 0) === 1} onChange={(on) => set('Global_Legato', on ? 1 : 0)} />
            <Switch label="note pb" value={(v['Global_NotePitchBend'] ?? 0) === 1} onChange={(on) => set('Global_NotePitchBend', on ? 1 : 0)} />
          </div>
          <div className="b2-row">
            <Knob label="glide" value={v['Global_Glide'] ?? 0} min={0} max={2} size={28} onChange={(x) => set('Global_Glide', x)} />
            <Knob label="volume" value={v['Global_Volume'] ?? 0.79} min={0} max={1} size={28} onChange={(x) => set('Global_Volume', x)} />
            <Knob label="transpose" value={v['Global_Transpose'] ?? 0} min={-48} max={48} unit="st" size={28} onChange={(x) => set('Global_Transpose', x)} />
            <Knob label="vel mod" value={v['Global_VolVelMod'] ?? 0.2} min={0} max={1} size={28} onChange={(x) => set('Global_VolVelMod', x)} />
            <Switch label="reset phase" value={(v['Global_ResetOscillatorPhase'] ?? 1) === 1} onChange={(on) => set('Global_ResetOscillatorPhase', on ? 1 : 0)} />
            <Menu label="env2 mode" value={v['Global_Envelope2Mode'] ?? 0} labels={GLOBALP[15].labels ?? []} onChange={(x) => set('Global_Envelope2Mode', x)} />
          </div>
          <div className="b2-row">
            <Knob label="poly depth" value={v['Global_PolyVoiceDepth'] ?? 0.5} min={0} max={1} size={26} onChange={(x) => set('Global_PolyVoiceDepth', x)} />
            <Knob label="st depth" value={v['Global_StereoVoiceDepth'] ?? 0.5} min={0} max={1} size={26} onChange={(x) => set('Global_StereoVoiceDepth', x)} />
            <Knob label="uni depth" value={v['Global_UnisonVoiceDepth'] ?? 0.5} min={0} max={1} size={26} onChange={(x) => set('Global_UnisonVoiceDepth', x)} />
            <Knob label="mono depth" value={v['Global_MonoVoiceDepth'] ?? 0.5} min={0} max={1} size={26} onChange={(x) => set('Global_MonoVoiceDepth', x)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
