import { useState } from 'react'

import {
  DevicePortFrame,
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

/** Hybrid Reverb port — Send + convolution display + algorithm row on the
 * Reverb tab, three-band EQ on the EQ tab, right output column
 * (capture: evidence/ui/device-panels/HybridReverb.png).
 * Control inventory: live-dynamics params.rs HYBRID_REVERB. Algorithm-
 * variant blocks (Tides / Quartz / Prism) live in the stored footer. */

const IR_DECAYS = Array.from({ length: 21 }, () => '?')

const REVERB: ParamSpec[] = [
  { id: 'Send', label: 'send', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'PreDelay_Sync', label: 'pre-delay sync', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'PreDelay_Time', label: 'pre-delay', min: 0, max: 4, unit: 's', kind: 'continuous', def: 0.01 },
  { id: 'PreDelay_Sixteenth', label: 'pre-delay sixteenth', min: 0, max: 16, kind: 'continuous', def: 4 },
  { id: 'Algorithm_Type', label: 'algorithm', min: 0, max: 0, kind: 'discrete', labels: ['Dark Hall'] },
  { id: 'Algorithm_Decay', label: 'decay', min: 0.1, max: 60, unit: 's', kind: 'continuous', def: 2.2 },
  { id: 'Algorithm_Size', label: 'size', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Algorithm_Delay', label: 'parallel', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Algorithm_Freeze', label: 'freeze', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Algorithm_FreezeIn', label: 'freeze in', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Algorithm_Damping', label: 'damping', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Algorithm_Diffusion', label: 'diffusion', min: 0, max: 1, kind: 'continuous', def: 0.7 },
  { id: 'Algorithm_Modulation', label: 'mod', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Algorithm_Shape', label: 'shape', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Algorithm_BassMultiplier', label: 'bass mult', min: 0.25, max: 4, kind: 'continuous', def: 1 },
  { id: 'Algorithm_BassCrossover', label: 'bass x', min: 80, max: 1000, unit: 'Hz', kind: 'continuous', def: 440 },
  { id: 'Algorithm_Shimmer', label: 'shimmer', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Algorithm_PitchShift', label: 'pitch shift', min: -12, max: 12, unit: 'st', kind: 'continuous', def: 0 },
  { id: 'Convolution_IrPostProcessingOn', label: 'ir post', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Convolution_IrAttackTime', label: 'ir attack', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Convolution_IrDecayTime', label: 'ir decay', min: 0, max: 20, kind: 'discrete', labels: IR_DECAYS },
  { id: 'Convolution_IrSize', label: 'ir size', min: 0, max: 1, kind: 'discrete', labels: ['?', '?'] },
  { id: 'ConvoAlgoBlend', label: 'convol/algo', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Routing', label: 'routing', min: 0, max: 1, kind: 'discrete', labels: ['?', '?'], def: 0 },
  { id: 'StereoWidth', label: 'stereo', min: 0, max: 2, kind: 'continuous', def: 1 },
  { id: 'Vintage', label: 'vintage', min: 0, max: 4, kind: 'continuous', def: 0 },
  { id: 'BassMono', label: 'bass mono', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'DryWet', label: 'dry/wet', min: 0, max: 1, kind: 'continuous', def: 0.5 },
]

const EQ: ParamSpec[] = [
  { id: 'Eq_On', label: 'eq on', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Eq_PreAlgo', label: 'pre-algo', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Eq_LowBandType', label: 'low type', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'Eq_LowBandFrequency', label: 'low freq', min: 20, max: 20000, unit: 'Hz', kind: 'continuous', def: 120 },
  { id: 'Eq_LowBandGain', label: 'low gain', min: 0.25, max: 4, kind: 'continuous', def: 1 },
  { id: 'Eq_LowBandSlope', label: 'low slope', min: 0, max: 9, kind: 'continuous', def: 6 },
  { id: 'Eq_Peak1Frequency', label: 'peak1 freq', min: 20, max: 20000, unit: 'Hz', kind: 'continuous', def: 800 },
  { id: 'Eq_Peak1Gain', label: 'peak1 gain', min: 0.25, max: 4, kind: 'continuous', def: 1 },
  { id: 'Eq_Peak1Q', label: 'peak1 q', min: 0.1, max: 4, kind: 'continuous', def: 1 },
  { id: 'Eq_Peak2Frequency', label: 'peak2 freq', min: 20, max: 20000, unit: 'Hz', kind: 'continuous', def: 2500 },
  { id: 'Eq_Peak2Gain', label: 'peak2 gain', min: 0.25, max: 4, kind: 'continuous', def: 1 },
  { id: 'Eq_Peak2Q', label: 'peak2 q', min: 0.1, max: 4, kind: 'continuous', def: 1 },
  { id: 'Eq_HighBandType', label: 'high type', min: 0, max: 1, kind: 'discrete', labels: ['?', '?'] },
  { id: 'Eq_HighBandFrequency', label: 'high freq', min: 20, max: 20000, unit: 'Hz', kind: 'continuous', def: 7500 },
  { id: 'Eq_HighBandGain', label: 'high gain', min: 0.25, max: 4, kind: 'continuous', def: 1 },
  { id: 'Eq_HighBandSlope', label: 'high slope', min: 0, max: 9, kind: 'continuous', def: 6 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'PreDelay_FeedbackTime', label: 'pre-delay feedback', min: 0, max: 0.95, kind: 'continuous', def: 0 },
  { id: 'PreDelay_FeedbackSixteenth', label: 'pre-delay fb sixteenth', min: 0, max: 0.95, kind: 'continuous', def: 0 },
  { id: 'Algorithm_TidesAmount', label: 'tides amount', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Algorithm_TidesRate', label: 'tides rate', min: 0, max: 29, kind: 'continuous', def: 8 },
  { id: 'Algorithm_TidesWaveform', label: 'tides wave', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Algorithm_TidesPhaseOffset', label: 'tides phase', min: 0, max: 180, unit: 'deg', kind: 'continuous', def: 0 },
  { id: 'Algorithm_Quartz_LowDamping', label: 'quartz low damping', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Algorithm_Quartz_Distance', label: 'quartz distance', min: 0, max: 1, kind: 'continuous', def: 0.5 },
  { id: 'Algorithm_Prism_HighMultiplier', label: 'prism high mult', min: 0.1, max: 5, kind: 'continuous', def: 1 },
  { id: 'Algorithm_Prism_LowMultiplier', label: 'prism low mult', min: 0.1, max: 5, kind: 'continuous', def: 1 },
  { id: 'Algorithm_Prism_CrossoverFrequency', label: 'prism crossover', min: 400, max: 5500, unit: 'Hz', kind: 'continuous', def: 1500 },
  { id: 'Algorithm_Prism_Sixth', label: 'prism sixth', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Algorithm_Prism_Seventh', label: 'prism seventh', min: 0, max: 1, kind: 'continuous', def: 0 },
]

function irDisplay(decayT: number): string {
  const pts: string[] = ['M 2 96']
  const n = 140
  for (let i = 0; i <= n; i++) {
    const x = 2 + (i / n) * 296
    const t = i / n
    const burst = t < 0.06 ? Math.random() * 0.5 + 0.4 : Math.exp(-t * (2.6 + (60 - decayT) * 0.02)) * (0.55 + Math.sin(i * 12.9898) * 0.06)
    const y = 98 - Math.min(1, Math.max(0.02, burst)) * 92
    pts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

export function HybridReverbPort() {
  const { values, set } = useDeviceState([...REVERB, ...EQ, ...EXTRAS])
  const v = values
  const [tab, setTab] = useState<'reverb' | 'eq'>('reverb')
  const preSync = (v['PreDelay_Sync'] ?? 0) === 1

  return (
    <DevicePortFrame name="Hybrid Reverb (port)" element="Hybrid">
      <div className="b2-flow">
        <div className="b2-col">
          <Knob label="send" value={v['Send'] ?? 0} min={0} max={1} onChange={(x) => set('Send', x)} />
          <div className="b2-col">
            <Knob
              label="pre-delay"
              value={preSync ? (v['PreDelay_Sixteenth'] ?? 4) : (v['PreDelay_Time'] ?? 0.01)}
              min={preSync ? 0 : 0}
              max={preSync ? 16 : 4}
              unit={preSync ? undefined : 's'}
              size={30}
              step={preSync ? 1 : undefined}
              onChange={(x) => (preSync ? set('PreDelay_Sixteenth', x) : set('PreDelay_Time', x))}
              title={preSync ? 'pre-delay sixteenth — stored 0..16' : 'pre-delay time — stored 0..4 s'}
            />
            <Switch label="sync" value={preSync} onChange={(on) => set('PreDelay_Sync', on ? 1 : 0)} />
          </div>
        </div>
        <div className="b2-col">
          <div className="b2-row">
            <Segmented
              value={tab === 'reverb' ? 0 : 1}
              labels={['Reverb', 'EQ']}
              onChange={(x) => setTab(x === 0 ? 'reverb' : 'eq')}
              title="panel tabs"
            />
          </div>
          {tab === 'reverb' ? (
            <>
              <svg className="b2-graph" width={302} height={104} viewBox="0 0 302 104" aria-hidden="true">
                <path d={irDisplay(v['Algorithm_Decay'] ?? 2.2)} className="b2-graph-curve-2" />
              </svg>
              <div className="b2-row">
                <Readout value="—" label="attack" />
                <Knob label="decay" value={v['Algorithm_Decay'] ?? 2.2} min={0.1} max={60} unit="s" curve={2.2} onChange={(x) => set('Algorithm_Decay', x)} />
                <Knob label="size" value={v['Algorithm_Size'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('Algorithm_Size', x)} />
                <Menu label="algorithm" value={v['Algorithm_Type'] ?? 0} labels={['Dark Hall']} onChange={() => undefined} title="algorithm — one entry in stored evidence" />
              </div>
              <div className="b2-row">
                <Switch label="freeze" value={(v['Algorithm_Freeze'] ?? 0) === 1} onChange={(on) => set('Algorithm_Freeze', on ? 1 : 0)} />
                <Switch label="freeze in" value={(v['Algorithm_FreezeIn'] ?? 0) === 1} onChange={(on) => set('Algorithm_FreezeIn', on ? 1 : 0)} />
                <Knob label="delay" value={v['Algorithm_Delay'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Algorithm_Delay', x)} />
                <Knob label="mod" value={v['Algorithm_Modulation'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Algorithm_Modulation', x)} />
                <Knob label="bass x" value={v['Algorithm_BassCrossover'] ?? 440} min={80} max={1000} unit="Hz" curve={1.8} size={28} onChange={(x) => set('Algorithm_BassCrossover', x)} />
                <Knob label="damping" value={v['Algorithm_Damping'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('Algorithm_Damping', x)} />
                <Knob label="shape" value={v['Algorithm_Shape'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('Algorithm_Shape', x)} />
                <Knob label="diffuse" value={v['Algorithm_Diffusion'] ?? 0.7} min={0} max={1} size={28} onChange={(x) => set('Algorithm_Diffusion', x)} />
                <Knob label="bass mult" value={v['Algorithm_BassMultiplier'] ?? 1} min={0.25} max={4} size={28} onChange={(x) => set('Algorithm_BassMultiplier', x)} />
              </div>
              <div className="b2-row">
                <Switch label="ir post" value={(v['Convolution_IrPostProcessingOn'] ?? 1) === 1} onChange={(on) => set('Convolution_IrPostProcessingOn', on ? 1 : 0)} />
                <Menu label="ir decay" value={Math.round(v['Convolution_IrDecayTime'] ?? 0)} labels={IR_DECAYS} onChange={(x) => set('Convolution_IrDecayTime', x)} title="ir decay — 21 stored entries, labels not in evidence" />
                <Menu label="ir size" value={v['Convolution_IrSize'] ?? 0} labels={['?', '?']} onChange={(x) => set('Convolution_IrSize', x)} />
                <Knob label="convol/algo" value={v['ConvoAlgoBlend'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('ConvoAlgoBlend', x)} />
                <Menu label="routing" value={v['Routing'] ?? 0} labels={['?', '?']} onChange={(x) => set('Routing', x)} />
              </div>
            </>
          ) : (
            <Section label="eq">
              <div className="b2-row">
                <Switch label="eq on" value={(v['Eq_On'] ?? 0) === 1} onChange={(on) => set('Eq_On', on ? 1 : 0)} />
                <Switch label="pre-algo" value={(v['Eq_PreAlgo'] ?? 0) === 1} onChange={(on) => set('Eq_PreAlgo', on ? 1 : 0)} />
              </div>
              <div className="b2-row">
                <Menu label="low type" value={v['Eq_LowBandType'] ?? 0} labels={['?']} onChange={(x) => set('Eq_LowBandType', x)} />
                <Knob label="low freq" value={v['Eq_LowBandFrequency'] ?? 120} min={20} max={20000} unit="Hz" curve={2.6} size={28} onChange={(x) => set('Eq_LowBandFrequency', x)} />
                <Knob label="low gain" value={v['Eq_LowBandGain'] ?? 1} min={0.25} max={4} size={28} onChange={(x) => set('Eq_LowBandGain', x)} />
                <Knob label="low slope" value={v['Eq_LowBandSlope'] ?? 6} min={0} max={9} size={28} onChange={(x) => set('Eq_LowBandSlope', x)} />
              </div>
              <div className="b2-row">
                <Knob label="p1 freq" value={v['Eq_Peak1Frequency'] ?? 800} min={20} max={20000} unit="Hz" curve={2.6} size={28} onChange={(x) => set('Eq_Peak1Frequency', x)} />
                <Knob label="p1 gain" value={v['Eq_Peak1Gain'] ?? 1} min={0.25} max={4} size={28} onChange={(x) => set('Eq_Peak1Gain', x)} />
                <Knob label="p1 q" value={v['Eq_Peak1Q'] ?? 1} min={0.1} max={4} size={28} onChange={(x) => set('Eq_Peak1Q', x)} />
                <Knob label="p2 freq" value={v['Eq_Peak2Frequency'] ?? 2500} min={20} max={20000} unit="Hz" curve={2.6} size={28} onChange={(x) => set('Eq_Peak2Frequency', x)} />
                <Knob label="p2 gain" value={v['Eq_Peak2Gain'] ?? 1} min={0.25} max={4} size={28} onChange={(x) => set('Eq_Peak2Gain', x)} />
                <Knob label="p2 q" value={v['Eq_Peak2Q'] ?? 1} min={0.1} max={4} size={28} onChange={(x) => set('Eq_Peak2Q', x)} />
              </div>
              <div className="b2-row">
                <Menu label="high type" value={v['Eq_HighBandType'] ?? 0} labels={['?', '?']} onChange={(x) => set('Eq_HighBandType', x)} />
                <Knob label="high freq" value={v['Eq_HighBandFrequency'] ?? 7500} min={20} max={20000} unit="Hz" curve={2.6} size={28} onChange={(x) => set('Eq_HighBandFrequency', x)} />
                <Knob label="high gain" value={v['Eq_HighBandGain'] ?? 1} min={0.25} max={4} size={28} onChange={(x) => set('Eq_HighBandGain', x)} />
                <Knob label="high slope" value={v['Eq_HighBandSlope'] ?? 6} min={0} max={9} size={28} onChange={(x) => set('Eq_HighBandSlope', x)} />
              </div>
            </Section>
          )}
        </div>
        <Section label="output">
          <div className="b2-col">
            <Knob label="stereo" value={v['StereoWidth'] ?? 1} min={0} max={2} size={28} onChange={(x) => set('StereoWidth', x)} />
            <Knob label="vintage" value={v['Vintage'] ?? 0} min={0} max={4} size={28} onChange={(x) => set('Vintage', x)} />
            <Switch label="bass mono" value={(v['BassMono'] ?? 0) === 1} onChange={(on) => set('BassMono', on ? 1 : 0)} />
            <Knob label="dry/wet" value={v['DryWet'] ?? 0.5} min={0} max={1} size={28} onChange={(x) => set('DryWet', x)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
