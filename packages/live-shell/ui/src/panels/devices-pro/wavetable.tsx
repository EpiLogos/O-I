import { useState } from 'react'

import type { PanelContext } from '../../shell/panels'

import {
  ProFace,
  ProField,
  ProMenu,
  ProSection,
  ProSlider,
  ProToggle,
  editGuard,
  useBind,
  useDeviceEdit,
} from './kit'

/**
 * Wavetable — the tabbed device-face port of the captured panel
 * (evidence/ui/device-panels/Wavetable.png, live-wavetable-device-panel.png):
 * Osc 1 | Osc 2 | Sub | Filter | Envelope | Mod tabs over the voice
 * sections, with the output strip always visible. The document element is
 * `InstrumentVector`; Live 12 stores the voice parameters as flattened
 * elements (`Voice_Oscillator1_Gain`, …) exactly as the parameter table
 * names them, so every control persists through the M3 API.
 *
 * Layout per the capture's Osc tab: the wavetable position rail over the
 * wave window, the osc pitch/level column, the FX row, and the output
 * column — rebuilt original with the shell's tokens. Faces show compact
 * labels; each control's tooltip carries the full stored name (id), range
 * and dossier note.
 */

type Tab = 'osc1' | 'osc2' | 'sub' | 'filter' | 'env' | 'mod'

const TABS: { id: Tab; label: string }[] = [
  { id: 'osc1', label: 'Osc 1' },
  { id: 'osc2', label: 'Osc 2' },
  { id: 'sub', label: 'Sub' },
  { id: 'filter', label: 'Filter' },
  { id: 'env', label: 'Envelope' },
  { id: 'mod', label: 'Mod' },
]

/** The wave window: an original drawing — one morphing pair of curves and
 * the amber position rail (the port's wavetable display). */
function WaveWindow({ frac }: { frac: number }) {
  const x = 6 + frac * 244
  return (
    <span
      className="prp-display-wrap"
      title="Wavetable position — stored 0..1 across the table's frames (the display is an original drawing; the table's contents land with the wavetable model)."
    >
      <svg className="prp-display" width={256} height={64} viewBox="0 0 256 64" aria-label="Wavetable display">
        <line x1="0" y1="32" x2="256" y2="32" className="prp-display-grid" />
        <path
          d="M 6 32 C 26 6, 46 6, 66 32 S 106 58, 126 32 S 166 6, 186 32 S 226 58, 250 36"
          className="prp-display-curve-dim"
        />
        <path
          d="M 6 32 C 26 58, 46 58, 66 32 S 106 6, 126 32 S 166 58, 186 32 S 226 6, 250 28"
          className="prp-display-curve"
        />
        <line x1={x} y1="4" x2={x} y2="60" className="prp-display-pos" />
        <text x="6" y="12" className="prp-display-tag">
          wavetable
        </text>
      </svg>
    </span>
  )
}

function OscTab({
  bind,
  n,
}: {
  bind: ReturnType<typeof useBind>
  n: 1 | 2
}) {
  const p = `Voice_Oscillator${n}`
  const pos = bind(`${p}_Wavetables_WavePosition`)
  const frac = pos && pos.stored !== undefined ? Math.min(1, Math.max(0, parseFloat(pos.stored) || 0)) : 0
  return (
    <ProSection title={`oscillator ${n}`}>
      <div className="prp-col" style={{ gap: 8, flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {bind(`${p}_On`) ? <ProToggle bind={bind(`${p}_On`)!} label="on" /> : null}
          {bind(`${p}_Pitch_Transpose`) ? <ProSlider bind={bind(`${p}_Pitch_Transpose`)!} name="transpose" /> : null}
          {bind(`${p}_Pitch_Detune`) ? <ProSlider bind={bind(`${p}_Pitch_Detune`)!} name="detune" /> : null}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {pos ? <ProSlider bind={pos} name="position" tickCount={3} /> : null}
          <WaveWindow frac={frac} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {bind(`${p}_Effects_EffectMode`) ? <ProMenu bind={bind(`${p}_Effects_EffectMode`)!} name="fx mode" /> : null}
          {bind(`${p}_Effects_Effect1`) ? <ProSlider bind={bind(`${p}_Effects_Effect1`)!} name="fx 1" /> : null}
          {bind(`${p}_Effects_Effect2`) ? <ProSlider bind={bind(`${p}_Effects_Effect2`)!} name="fx 2" /> : null}
          {bind(`${p}_Pan`) ? <ProSlider bind={bind(`${p}_Pan`)!} name="pan" /> : null}
          {bind(`${p}_Gain`) ? <ProSlider bind={bind(`${p}_Gain`)!} name="gain" /> : null}
        </div>
      </div>
    </ProSection>
  )
}

export function WavetablePro({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'Wavetable', 'InstrumentVector')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'InstrumentVector', 'Wavetable', edit)
  const [tab, setTab] = useState<Tab>('osc1')

  return (
    <ProFace name="Wavetable" element="InstrumentVector" edit={edit}>
      {guard ?? (
        <>
          <div className="prp-tabs" role="tablist" aria-label="Wavetable sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={'prp-tab' + (tab === t.id ? ' is-on' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'osc1' ? <OscTab bind={bind} n={1} /> : null}
          {tab === 'osc2' ? <OscTab bind={bind} n={2} /> : null}

          {tab === 'sub' ? (
            <ProSection title="sub oscillator">
              {bind('Voice_SubOscillator_On') ? <ProToggle bind={bind('Voice_SubOscillator_On')!} label="on" /> : null}
              {bind('Voice_SubOscillator_Tone') ? <ProSlider bind={bind('Voice_SubOscillator_Tone')!} name="tone" /> : null}
              {bind('Voice_SubOscillator_Gain') ? <ProSlider bind={bind('Voice_SubOscillator_Gain')!} name="gain" /> : null}
              {bind('Voice_SubOscillator_Transpose') ? (
                <ProMenu bind={bind('Voice_SubOscillator_Transpose')!} name="transpose" />
              ) : null}
            </ProSection>
          ) : null}

          {tab === 'filter' ? (
            <>
              {([1, 2] as const).map((n) => (
                <ProSection key={n} title={`filter ${n}`}>
                  <div className="prp-col" style={{ gap: 8, flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {bind(`Voice_Filter${n}_On`) ? <ProToggle bind={bind(`Voice_Filter${n}_On`)!} label="on" /> : null}
                      {bind(`Voice_Filter${n}_Type`) ? <ProMenu bind={bind(`Voice_Filter${n}_Type`)!} name="type" /> : null}
                      {bind(`Voice_Filter${n}_CircuitLpHp`) ? <ProMenu bind={bind(`Voice_Filter${n}_CircuitLpHp`)!} name="lp/hp" /> : null}
                      {bind(`Voice_Filter${n}_CircuitBpNoMo`) ? <ProMenu bind={bind(`Voice_Filter${n}_CircuitBpNoMo`)!} name="circuit" /> : null}
                      {bind(`Voice_Filter${n}_Slope`) ? <ProMenu bind={bind(`Voice_Filter${n}_Slope`)!} name="slope" /> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {bind(`Voice_Filter${n}_Frequency`) ? <ProSlider bind={bind(`Voice_Filter${n}_Frequency`)!} name="frequency" curve={2.8} /> : null}
                      {bind(`Voice_Filter${n}_Resonance`) ? <ProSlider bind={bind(`Voice_Filter${n}_Resonance`)!} name="resonance" /> : null}
                      {bind(`Voice_Filter${n}_Drive`) ? <ProSlider bind={bind(`Voice_Filter${n}_Drive`)!} name="drive" /> : null}
                      {bind(`Voice_Filter${n}_Morph`) ? <ProSlider bind={bind(`Voice_Filter${n}_Morph`)!} name="morph" /> : null}
                    </div>
                  </div>
                </ProSection>
              ))}
            </>
          ) : null}

          {tab === 'env' ? (
            <ProSection title="amp envelope">
              <div className="prp-col" style={{ gap: 8, flex: 1, minWidth: 200 }}>
                <div className="prp-envelope-strip">
                  {bind('Voice_Modulators_AmpEnvelope_Times_Attack') ? (
                    <ProField bind={bind('Voice_Modulators_AmpEnvelope_Times_Attack')!} name="attack" format={(v) => `${(v * 1000).toFixed(0)} ms`} parse={(t) => parseFloat(t) / 1000} />
                  ) : null}
                  {bind('Voice_Modulators_AmpEnvelope_Times_Decay') ? (
                    <ProField bind={bind('Voice_Modulators_AmpEnvelope_Times_Decay')!} name="decay" format={(v) => `${(v * 1000).toFixed(0)} ms`} parse={(t) => parseFloat(t) / 1000} />
                  ) : null}
                  {bind('Voice_Modulators_AmpEnvelope_Times_Release') ? (
                    <ProField bind={bind('Voice_Modulators_AmpEnvelope_Times_Release')!} name="release" format={(v) => `${(v * 1000).toFixed(0)} ms`} parse={(t) => parseFloat(t) / 1000} />
                  ) : null}
                  {bind('Voice_Modulators_AmpEnvelope_Sustain') ? (
                    <ProField bind={bind('Voice_Modulators_AmpEnvelope_Sustain')!} name="sustain" />
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {bind('Voice_Modulators_AmpEnvelope_Slopes_Attack') ? (
                    <ProSlider bind={bind('Voice_Modulators_AmpEnvelope_Slopes_Attack')!} name="a slope" />
                  ) : null}
                  {bind('Voice_Modulators_AmpEnvelope_Slopes_Decay') ? (
                    <ProSlider bind={bind('Voice_Modulators_AmpEnvelope_Slopes_Decay')!} name="d slope" />
                  ) : null}
                  {bind('Voice_Modulators_AmpEnvelope_Slopes_Release') ? (
                    <ProSlider bind={bind('Voice_Modulators_AmpEnvelope_Slopes_Release')!} name="r slope" />
                  ) : null}
                  {bind('Voice_Modulators_AmpEnvelope_LoopMode') ? (
                    <ProMenu bind={bind('Voice_Modulators_AmpEnvelope_LoopMode')!} name="loop" />
                  ) : null}
                </div>
                <div className="prp-sub" style={{ maxWidth: 230 }}>
                  stored time unit unresolved in the evidence (seconds suspected) — fields show ms;
                  slopes are stored −1..1.
                </div>
              </div>
            </ProSection>
          ) : null}

          {tab === 'mod' ? (
            <>
              {([1, 2] as const).map((n) => (
                <ProSection key={n} title={`lfo ${n}`}>
                  <div className="prp-col" style={{ gap: 8, flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {bind(`Voice_Modulators_Lfo${n}_Retrigger`) ? (
                        <ProToggle bind={bind(`Voice_Modulators_Lfo${n}_Retrigger`)!} label="retrig" />
                      ) : null}
                      {bind(`Voice_Modulators_Lfo${n}_Shape_Type`) ? <ProMenu bind={bind(`Voice_Modulators_Lfo${n}_Shape_Type`)!} name="shape" /> : null}
                      {bind(`Voice_Modulators_Lfo${n}_Shape_Amount`) ? <ProSlider bind={bind(`Voice_Modulators_Lfo${n}_Shape_Amount`)!} name="amount" /> : null}
                      {bind(`Voice_Modulators_Lfo${n}_Shape_Shaping`) ? <ProSlider bind={bind(`Voice_Modulators_Lfo${n}_Shape_Shaping`)!} name="shaping" /> : null}
                      {bind(`Voice_Modulators_Lfo${n}_Shape_PhaseOffset`) ? <ProSlider bind={bind(`Voice_Modulators_Lfo${n}_Shape_PhaseOffset`)!} name="phase" /> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {bind(`Voice_Modulators_Lfo${n}_Time_Rate`) ? <ProSlider bind={bind(`Voice_Modulators_Lfo${n}_Time_Rate`)!} name="rate" curve={2} /> : null}
                      {bind(`Voice_Modulators_Lfo${n}_Time_SyncedRate`) ? <ProSlider bind={bind(`Voice_Modulators_Lfo${n}_Time_SyncedRate`)!} name="synced rate" /> : null}
                    </div>
                  </div>
                </ProSection>
              ))}
              <ProSection title="modulators">
                {bind('Voice_Modulators_TimeScale') ? <ProSlider bind={bind('Voice_Modulators_TimeScale')!} name="time scale" /> : null}
                {bind('Voice_Modulators_Amount') ? <ProSlider bind={bind('Voice_Modulators_Amount')!} name="amount" /> : null}
              </ProSection>
            </>
          ) : null}

          <ProSection title="voice / out">
            {bind('On') ? <ProToggle bind={bind('On')!} label="device on" /> : null}
            {bind('Voice_Unison_Mode') ? <ProMenu bind={bind('Voice_Unison_Mode')!} name="unison" /> : null}
            {bind('Voice_Unison_VoiceCount') ? <ProMenu bind={bind('Voice_Unison_VoiceCount')!} name="voices" /> : null}
            {bind('Voice_Unison_Amount') ? <ProSlider bind={bind('Voice_Unison_Amount')!} name="unison amt" /> : null}
            {bind('Voice_Global_Transpose') ? <ProSlider bind={bind('Voice_Global_Transpose')!} name="transpose" /> : null}
            {bind('Voice_Global_FilterRouting') ? <ProMenu bind={bind('Voice_Global_FilterRouting')!} name="f. routing" /> : null}
            {bind('Voice_Global_Glide') ? <ProSlider bind={bind('Voice_Global_Glide')!} name="glide" /> : null}
            {bind('MonoPoly') ? <ProMenu bind={bind('MonoPoly')!} segmented name="mono/poly" /> : null}
            {bind('PolyVoices') ? <ProMenu bind={bind('PolyVoices')!} name="poly" /> : null}
            {bind('HiQ') ? <ProToggle bind={bind('HiQ')!} label="Hi Q" /> : null}
            {bind('Volume') ? <ProSlider bind={bind('Volume')!} name="volume" /> : null}
          </ProSection>
        </>
      )}
    </ProFace>
  )
}

/** Compact rack face for the bottom device-chain slot (osc 1 core + out). */
export function WavetableRack({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'Wavetable', 'InstrumentVector')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'InstrumentVector', 'Wavetable', edit)

  return (
    <ProFace name="Wavetable" element="InstrumentVector" edit={edit}>
      {guard ?? (
        <div className="prp-rack">
          {bind('Voice_Oscillator1_On') ? <ProToggle bind={bind('Voice_Oscillator1_On')!} label="osc1" /> : null}
          {bind('Voice_Oscillator1_Wavetables_WavePosition') ? (
            <ProSlider bind={bind('Voice_Oscillator1_Wavetables_WavePosition')!} name="position" />
          ) : null}
          {bind('Voice_Oscillator1_Gain') ? <ProSlider bind={bind('Voice_Oscillator1_Gain')!} name="gain" /> : null}
          {bind('Voice_Oscillator1_Pan') ? <ProSlider bind={bind('Voice_Oscillator1_Pan')!} name="pan" /> : null}
          {bind('Voice_Modulators_AmpEnvelope_Times_Attack') ? (
            <ProField
              bind={bind('Voice_Modulators_AmpEnvelope_Times_Attack')!}
              name="attack"
              format={(v) => `${(v * 1000).toFixed(0)} ms`}
              parse={(t) => parseFloat(t) / 1000}
            />
          ) : null}
          {bind('Voice_Modulators_AmpEnvelope_Sustain') ? (
            <ProSlider bind={bind('Voice_Modulators_AmpEnvelope_Sustain')!} name="sustain" />
          ) : null}
          {bind('Volume') ? <ProSlider bind={bind('Volume')!} name="volume" /> : null}
        </div>
      )}
    </ProFace>
  )
}
