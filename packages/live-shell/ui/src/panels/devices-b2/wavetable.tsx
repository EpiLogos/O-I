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

/** Wavetable port — tabbed like the real panel: Osc1 | Osc2 | Sub &
 * Filters | Envelopes | LFOs | Voice & Global (capture:
 * evidence/ui/device-panels/Wavetable.png).
 * Control inventory: live-dynamics params.rs WAVETABLE. */

function oscSpecs(n: 1 | 2): ParamSpec[] {
  const p = `Voice_Oscillator${n}`
  return [
    { id: `${p}_On`, label: `osc${n} on`, min: 0, max: 1, kind: 'toggle', def: 1 },
    { id: `${p}_Pitch_Transpose`, label: `osc${n} transpose`, min: -24, max: 24, unit: 'st', kind: 'continuous', def: 0 },
    { id: `${p}_Pitch_Detune`, label: `osc${n} detune`, min: -0.5, max: 0.5, kind: 'continuous', def: 0 },
    { id: `${p}_Wavetables_WavePosition`, label: `osc${n} wave pos`, min: 0, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Effects_EffectMode`, label: `osc${n} fx mode`, min: 0, max: n === 1 ? 3 : 0, kind: 'discrete', labels: Array.from({ length: (n === 1 ? 3 : 0) + 1 }, () => '?') },
    { id: `${p}_Effects_Effect1`, label: `osc${n} fx 1`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Effects_Effect2`, label: `osc${n} fx 2`, min: 0, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Pan`, label: `osc${n} pan`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Gain`, label: `osc${n} gain`, min: 0, max: 1, kind: 'continuous', def: n === 1 ? 0.79 : 0 },
  ]
}

const OSC1 = oscSpecs(1)
const OSC2 = oscSpecs(2)

const SUB: ParamSpec[] = [
  { id: 'Voice_SubOscillator_On', label: 'sub on', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Voice_SubOscillator_Tone', label: 'sub tone', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Voice_SubOscillator_Gain', label: 'sub gain', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Voice_SubOscillator_Transpose', label: 'sub transpose', min: 0, max: 1, kind: 'discrete', labels: ['?', '?'] },
]

function filterSpecs(n: 1 | 2): ParamSpec[] {
  const p = `Voice_Filter${n}`
  return [
    { id: `${p}_On`, label: `filter${n} on`, min: 0, max: 1, kind: 'toggle', def: n === 1 },
    { id: `${p}_Type`, label: `filter${n} type`, min: 0, max: n === 1 ? 0 : 1, kind: 'discrete', labels: Array.from({ length: (n === 1 ? 0 : 1) + 1 }, () => '?') },
    { id: `${p}_CircuitLpHp`, label: `filter${n} circuit lp/hp`, min: 0, max: 0, kind: 'discrete', labels: ['?'] },
    { id: `${p}_CircuitBpNoMo`, label: `filter${n} circuit`, min: 0, max: 0, kind: 'discrete', labels: ['?'] },
    { id: `${p}_Slope`, label: `filter${n} slope`, min: 0, max: 0, kind: 'discrete', labels: ['?'] },
    { id: `${p}_Frequency`, label: `filter${n} freq`, min: 20, max: 20480, unit: 'Hz', kind: 'continuous', def: 20480 },
    { id: `${p}_Resonance`, label: `filter${n} res`, min: 0, max: 1.25, kind: 'continuous', def: 0.2 },
    { id: `${p}_Drive`, label: `filter${n} drive`, min: 0, max: 24, unit: 'dB', kind: 'continuous', def: 0 },
    { id: `${p}_Morph`, label: `filter${n} morph`, min: 0, max: 1, kind: 'continuous', def: 0 },
  ]
}

const FILTERS = [...filterSpecs(1), ...filterSpecs(2)]

function envelopeSpecs(n: 'AmpEnvelope' | 'Envelope2' | 'Envelope3', label: string): ParamSpec[] {
  const p = `Voice_Modulators_${n}`
  const hasValues = n !== 'AmpEnvelope'
  const specs: ParamSpec[] = [
    { id: `${p}_Times_Attack`, label: `${label} attack`, min: 0, max: 20, unit: 's', kind: 'continuous', def: 0 },
    { id: `${p}_Times_Decay`, label: `${label} decay`, min: 0.0015, max: 20, unit: 's', kind: 'continuous', def: 0.6 },
    { id: `${p}_Times_Release`, label: `${label} release`, min: 0.0015, max: 20, unit: 's', kind: 'continuous', def: 0.3 },
    { id: `${p}_Slopes_Attack`, label: `${label} a slope`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Slopes_Decay`, label: `${label} d slope`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Slopes_Release`, label: `${label} r slope`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Sustain`, label: `${label} sustain`, min: 0, max: 1, kind: 'continuous', def: n === 'AmpEnvelope' ? 0.7 : 0 },
    { id: `${p}_LoopMode`, label: `${label} loop`, min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  ]
  if (hasValues) {
    specs.push(
      { id: `${p}_Values_Initial`, label: `${label} initial`, min: 0, max: 1, kind: 'continuous', def: 0 },
      { id: `${p}_Values_Peak`, label: `${label} peak`, min: 0, max: 1, kind: 'continuous', def: 0.8 },
      { id: `${p}_Values_Sustain`, label: `${label} sustain value`, min: 0, max: 1, kind: 'continuous', def: 0.5 },
      { id: `${p}_Values_Final`, label: `${label} final`, min: 0, max: 1, kind: 'continuous', def: 0 },
    )
  }
  return specs
}

const ENVELOPES = [
  ...envelopeSpecs('AmpEnvelope', 'amp'),
  ...envelopeSpecs('Envelope2', 'env2'),
  ...envelopeSpecs('Envelope3', 'env3'),
]

const MODGLOBAL: ParamSpec[] = [
  { id: 'Voice_Modulators_TimeScale', label: 'time scale', min: -1, max: 1, kind: 'continuous', def: 0 },
  { id: 'Voice_Modulators_Amount', label: 'mod amount', min: 0, max: 2, kind: 'continuous', def: 1 },
]

function lfoSpecs(n: 1 | 2): ParamSpec[] {
  const p = `Voice_Modulators_Lfo${n}`
  return [
    { id: `${p}_Retrigger`, label: `lfo${n} retrigger`, min: 0, max: 1, kind: 'toggle', def: 0 },
    { id: `${p}_Shape_Type`, label: `lfo${n} shape`, min: 0, max: 0, kind: 'discrete', labels: ['?'] },
    { id: `${p}_Shape_Amount`, label: `lfo${n} amount`, min: 0, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Shape_Shaping`, label: `lfo${n} shaping`, min: -1, max: 1, kind: 'continuous', def: 0 },
    { id: `${p}_Shape_PhaseOffset`, label: `lfo${n} phase`, min: 0, max: 360, unit: 'deg', kind: 'continuous', def: 0 },
    { id: `${p}_Time_Sync`, label: `lfo${n} sync`, min: 0, max: 0, kind: 'discrete', labels: ['?'] },
    { id: `${p}_Time_Rate`, label: `lfo${n} rate`, min: 0.01, max: 30, unit: 'Hz', kind: 'continuous', def: 1 },
    { id: `${p}_Time_SyncedRate`, label: `lfo${n} synced rate`, min: 0, max: 21, kind: 'continuous', def: 8 },
    { id: `${p}_Time_AttackTime`, label: `lfo${n} attack`, min: 0, max: 20, unit: 's', kind: 'continuous', def: 0 },
  ]
}

const LFOS = [...lfoSpecs(1), ...lfoSpecs(2)]

const VOICE: ParamSpec[] = [
  { id: 'Voice_Unison_Mode', label: 'unison mode', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Voice_Unison_VoiceCount', label: 'unison voices', min: 0, max: 3, kind: 'discrete', labels: ['1', '2', '3', '4'] },
  { id: 'Voice_Unison_Amount', label: 'unison amount', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Voice_Global_Transpose', label: 'transpose', min: -48, max: 48, unit: 'st', kind: 'continuous', def: 0 },
  { id: 'Voice_Global_FilterRouting', label: 'filter routing', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Voice_Global_Glide', label: 'glide', min: 0, max: 20, unit: 'ms', kind: 'continuous', def: 0 },
  { id: 'MonoPoly', label: 'mono/poly', min: 0, max: 1, kind: 'discrete', labels: ['Poly', 'Mono'] },
  { id: 'PolyVoices', label: 'poly voices', min: 0, max: 6, kind: 'discrete', labels: ['1', '2', '3', '4', '5', '6', '8'] },
  { id: 'HiQ', label: 'hi-q', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Volume', label: 'volume', min: 0, max: 1, kind: 'continuous', def: 0.79 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
]

type Tab = 'osc1' | 'osc2' | 'sub' | 'env' | 'lfo' | 'voice'

export function WavetablePort() {
  const all = [...OSC1, ...OSC2, ...SUB, ...FILTERS, ...ENVELOPES, ...MODGLOBAL, ...LFOS, ...VOICE, ...EXTRAS]
  const { values, set } = useDeviceState(all)
  const v = values
  const [tab, setTab] = useState<Tab>('osc1')

  const oscBlock = (specs: ParamSpec[], n: 1 | 2) => (
    <Section label={`oscillator ${n}`}>
      <div className="b2-row">
        <Switch label={`osc${n} on`} value={(v[`Voice_Oscillator${n}_On`] ?? 0) === 1} onChange={(on) => set(`Voice_Oscillator${n}_On`, on ? 1 : 0)} />
        <Knob label="transpose" value={v[specs[1].id] ?? 0} min={-24} max={24} unit="st" onChange={(x) => set(specs[1].id, x)} />
        <Knob label="detune" value={v[specs[2].id] ?? 0} min={-0.5} max={0.5} onChange={(x) => set(specs[2].id, x)} />
        <Knob label="wave pos" value={v[specs[3].id] ?? 0} min={0} max={1} onChange={(x) => set(specs[3].id, x)} />
      </div>
      <div className="b2-row">
        <Menu label="fx mode" value={v[specs[4].id] ?? 0} labels={specs[4].labels ?? []} onChange={(x) => set(specs[4].id, x)} />
        <Knob label="fx 1" value={v[specs[5].id] ?? 0} min={-1} max={1} size={28} onChange={(x) => set(specs[5].id, x)} />
        <Knob label="fx 2" value={v[specs[6].id] ?? 0} min={0} max={1} size={28} onChange={(x) => set(specs[6].id, x)} />
        <Knob label="pan" value={v[specs[7].id] ?? 0} min={-1} max={1} size={28} onChange={(x) => set(specs[7].id, x)} />
        <Knob label="gain" value={v[specs[8].id] ?? 0} min={0} max={1} size={28} onChange={(x) => set(specs[8].id, x)} />
      </div>
    </Section>
  )

  const filterBlock = (n: 1 | 2) => {
    const specs = n === 1 ? FILTERS.slice(0, 9) : FILTERS.slice(9)
    return (
      <Section label={`filter ${n}`}>
        <div className="b2-row">
          <Switch label={`filter${n} on`} value={(v[specs[0].id] ?? 0) === 1} onChange={(on) => set(specs[0].id, on ? 1 : 0)} />
          <Menu label="type" value={v[specs[1].id] ?? 0} labels={specs[1].labels ?? []} onChange={(x) => set(specs[1].id, x)} />
          <Knob label="freq" value={v[specs[5].id] ?? 20480} min={20} max={20480} unit="Hz" curve={2.8} size={30} onChange={(x) => set(specs[5].id, x)} />
          <Knob label="res" value={v[specs[6].id] ?? 0.2} min={0} max={1.25} size={28} onChange={(x) => set(specs[6].id, x)} />
          <Knob label="drive" value={v[specs[7].id] ?? 0} min={0} max={24} unit="dB" size={28} onChange={(x) => set(specs[7].id, x)} />
          <Knob label="morph" value={v[specs[8].id] ?? 0} min={0} max={1} size={28} onChange={(x) => set(specs[8].id, x)} />
        </div>
        <div className="b2-row">
          <Menu label="lp/hp" value={v[specs[2].id] ?? 0} labels={specs[2].labels ?? []} onChange={(x) => set(specs[2].id, x)} />
          <Menu label="circuit" value={v[specs[3].id] ?? 0} labels={specs[3].labels ?? []} onChange={(x) => set(specs[3].id, x)} />
          <Menu label="slope" value={v[specs[4].id] ?? 0} labels={specs[4].labels ?? []} onChange={(x) => set(specs[4].id, x)} />
        </div>
      </Section>
    )
  }

  const envBlock = (specs: ParamSpec[], label: string) => {
    const hasValues = specs.length > 8
    return (
      <Section label={label}>
        <div className="b2-row">
          <Knob label="attack" value={v[specs[0].id] ?? 0} min={0} max={20} unit="s" curve={2} size={26} onChange={(x) => set(specs[0].id, x)} />
          <Knob label="decay" value={v[specs[1].id] ?? 0.6} min={0.0015} max={20} unit="s" curve={2} size={26} onChange={(x) => set(specs[1].id, x)} />
          <Knob label="release" value={v[specs[2].id] ?? 0.3} min={0.0015} max={20} unit="s" curve={2} size={26} onChange={(x) => set(specs[2].id, x)} />
          <Knob label="a slope" value={v[specs[3].id] ?? 0} min={-1} max={1} size={26} onChange={(x) => set(specs[3].id, x)} />
          <Knob label="d slope" value={v[specs[4].id] ?? 0} min={-1} max={1} size={26} onChange={(x) => set(specs[4].id, x)} />
          <Knob label="r slope" value={v[specs[5].id] ?? 0} min={-1} max={1} size={26} onChange={(x) => set(specs[5].id, x)} />
          <Knob label="sustain" value={v[specs[6].id] ?? 0} min={0} max={1} size={26} onChange={(x) => set(specs[6].id, x)} />
          <Menu label="loop" value={v[specs[7].id] ?? 0} labels={specs[7].labels ?? []} onChange={(x) => set(specs[7].id, x)} />
        </div>
        {hasValues ? (
          <div className="b2-row">
            <Knob label="initial" value={v[specs[8].id] ?? 0} min={0} max={1} size={26} onChange={(x) => set(specs[8].id, x)} />
            <Knob label="peak" value={v[specs[9].id] ?? 0.8} min={0} max={1} size={26} onChange={(x) => set(specs[9].id, x)} />
            <Knob label="sustain" value={v[specs[10].id] ?? 0.5} min={0} max={1} size={26} onChange={(x) => set(specs[10].id, x)} />
            <Knob label="final" value={v[specs[11].id] ?? 0} min={0} max={1} size={26} onChange={(x) => set(specs[11].id, x)} />
          </div>
        ) : null}
      </Section>
    )
  }

  const lfoBlock = (n: 1 | 2) => {
    const specs = n === 1 ? LFOS.slice(0, 9) : LFOS.slice(9)
    return (
      <Section label={`lfo ${n}`}>
        <div className="b2-row">
          <Switch label={`retrigger`} value={(v[specs[0].id] ?? 0) === 1} onChange={(on) => set(specs[0].id, on ? 1 : 0)} />
          <Menu label="shape" value={v[specs[1].id] ?? 0} labels={specs[1].labels ?? []} onChange={(x) => set(specs[1].id, x)} />
          <Knob label="amount" value={v[specs[2].id] ?? 0} min={0} max={1} size={26} onChange={(x) => set(specs[2].id, x)} />
          <Knob label="shaping" value={v[specs[3].id] ?? 0} min={-1} max={1} size={26} onChange={(x) => set(specs[3].id, x)} />
          <Knob label="phase" value={v[specs[4].id] ?? 0} min={0} max={360} unit="deg" size={26} onChange={(x) => set(specs[4].id, x)} />
        </div>
        <div className="b2-row">
          <Menu label="sync" value={v[specs[5].id] ?? 0} labels={specs[5].labels ?? []} onChange={(x) => set(specs[5].id, x)} />
          <Knob label="rate" value={v[specs[6].id] ?? 1} min={0.01} max={30} unit="Hz" curve={2} size={26} onChange={(x) => set(specs[6].id, x)} />
          <Knob label="synced" value={v[specs[7].id] ?? 8} min={0} max={21} size={26} onChange={(x) => set(specs[7].id, x)} />
          <Knob label="attack" value={v[specs[8].id] ?? 0} min={0} max={20} unit="s" curve={2} size={26} onChange={(x) => set(specs[8].id, x)} />
        </div>
      </Section>
    )
  }

  const env2 = ENVELOPES.slice(8, 20)
  const env3 = ENVELOPES.slice(20, 32)

  return (
    <DevicePortFrame name="Wavetable (port)" element="InstrumentVector">
      <div className="b2-row">
        <Segmented
          value={(['osc1', 'osc2', 'sub', 'env', 'lfo', 'voice'] as Tab[]).indexOf(tab)}
          labels={['Osc 1', 'Osc 2', 'Sub & Filters', 'Envelopes', 'LFOs', 'Voice & Global']}
          onChange={(x) => setTab((['osc1', 'osc2', 'sub', 'env', 'lfo', 'voice'] as Tab[])[x] ?? 'osc1')}
          title="panel tabs"
        />
      </div>
      {tab === 'osc1' ? oscBlock(OSC1, 1) : null}
      {tab === 'osc2' ? oscBlock(OSC2, 2) : null}
      {tab === 'sub' ? (
        <div className="b2-flow">
          <Section label="sub oscillator">
            <div className="b2-row">
              <Switch label="sub on" value={(v['Voice_SubOscillator_On'] ?? 0) === 1} onChange={(on) => set('Voice_SubOscillator_On', on ? 1 : 0)} />
              <Knob label="tone" value={v['Voice_SubOscillator_Tone'] ?? 0.5} min={0} max={1} onChange={(x) => set('Voice_SubOscillator_Tone', x)} />
              <Knob label="gain" value={v['Voice_SubOscillator_Gain'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('Voice_SubOscillator_Gain', x)} />
              <Menu label="transpose" value={v['Voice_SubOscillator_Transpose'] ?? 0} labels={SUB[3].labels ?? []} onChange={(x) => set('Voice_SubOscillator_Transpose', x)} />
            </div>
          </Section>
          {filterBlock(1)}
          {filterBlock(2)}
        </div>
      ) : null}
      {tab === 'env' ? (
        <div className="b2-flow">
          {envBlock(ENVELOPES.slice(0, 8), 'amp envelope')}
          {envBlock(env2, 'envelope 2')}
          {envBlock(env3, 'envelope 3')}
          <Section label="modulators">
            <div className="b2-row">
              <Knob label="time scale" value={v['Voice_Modulators_TimeScale'] ?? 0} min={-1} max={1} onChange={(x) => set('Voice_Modulators_TimeScale', x)} />
              <Knob label="amount" value={v['Voice_Modulators_Amount'] ?? 1} min={0} max={2} size={28} onChange={(x) => set('Voice_Modulators_Amount', x)} />
            </div>
          </Section>
        </div>
      ) : null}
      {tab === 'lfo' ? (
        <div className="b2-flow">
          {lfoBlock(1)}
          {lfoBlock(2)}
        </div>
      ) : null}
      {tab === 'voice' ? (
        <Section label="voice / global">
          <div className="b2-row">
            <Menu label="unison mode" value={v['Voice_Unison_Mode'] ?? 0} labels={VOICE[0].labels ?? []} onChange={(x) => set('Voice_Unison_Mode', x)} />
            <Menu label="voices" value={v['Voice_Unison_VoiceCount'] ?? 0} labels={VOICE[1].labels ?? []} onChange={(x) => set('Voice_Unison_VoiceCount', x)} />
            <Knob label="unison amt" value={v['Voice_Unison_Amount'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('Voice_Unison_Amount', x)} />
            <Knob label="transpose" value={v['Voice_Global_Transpose'] ?? 0} min={-48} max={48} unit="st" size={28} onChange={(x) => set('Voice_Global_Transpose', x)} />
            <Menu label="filter routing" value={v['Voice_Global_FilterRouting'] ?? 0} labels={VOICE[4].labels ?? []} onChange={(x) => set('Voice_Global_FilterRouting', x)} />
            <Knob label="glide" value={v['Voice_Global_Glide'] ?? 0} min={0} max={20} unit="ms" size={28} onChange={(x) => set('Voice_Global_Glide', x)} />
          </div>
          <div className="b2-row">
            <Segmented label="mono/poly" value={v['MonoPoly'] ?? 0} labels={VOICE[6].labels ?? []} onChange={(x) => set('MonoPoly', x)} />
            <Menu label="poly voices" value={v['PolyVoices'] ?? 0} labels={VOICE[7].labels ?? []} onChange={(x) => set('PolyVoices', x)} />
            <Switch label="hi-q" value={(v['HiQ'] ?? 0) === 1} onChange={(on) => set('HiQ', on ? 1 : 0)} />
            <Knob label="volume" value={v['Volume'] ?? 0.79} min={0} max={1} onChange={(x) => set('Volume', x)} />
          </div>
        </Section>
      ) : null}
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
