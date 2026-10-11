import { useCallback, useState } from 'react'

import type { PanelContext } from '../../shell/panels'

import {
  ProFace,
  ProField,
  ProMenu,
  ProSection,
  ProSlider,
  ProToggle,
  type Bind,
} from './kit'
import type { ParamDescJson } from '../devices/api'

/**
 * Operator — the device-face port from the Operator preset XML parameter
 * structure (evidence/devices/Operator/default.xml) laid out per the
 * captured device face (live-wavetable-device-panel.png bottom): the
 * oscillator A column, the amp-envelope display with its A/D/S/R strip, and
 * the global output column.
 *
 * MODEL ARRIVING: the shell hosts this device's model next. Operator's M6
 * phase-1 voice model is landed and gated in live-dynamics
 * (devices/operator-voice.md), but no parameter table exists in
 * live-dynamics::params yet — so this face runs on local state (the
 * document's stored defaults) and its badge says so. When the Operator
 * table lands, these same controls bind to the M3 API unchanged.
 *
 * Stored semantics carried in the tooltips (dossier + XML): envelope times
 * in ms (AttackTime 0.1..20000, Decay/Release 1..60000); levels are linear
 * amplitudes (0.000316..1 = −70..0 dB); the decay falls exponentially in
 * amplitude toward SustainLevel (not dB-linear, not a flat output knob) and
 * the release is dB-linear from the note-off level; Globals Volume is linear
 * amplitude with a −70..+6 dB stored span.
 */

// Stored structure of the Operator XML (defaults = the default patch).
interface OpParam {
  desc: ParamDescJson
  def: number
}

const P = (id: string, ui_name: string, min: number, max: number, unit: string, notes: string): ParamDescJson => ({
  id,
  ui_name,
  stored_min: min,
  stored_max: max,
  unit,
  kind: 'continuous',
  notes,
})

const OSC_A: OpParam[] = [
  { desc: P('OscA.Coarse', 'Coarse', 0, 48, '', 'oscillator A coarse pitch (stored 0..48 semitone steps; default 1)'), def: 1 },
  { desc: P('OscA.Fine', 'Fine', 0, 1000, '', 'oscillator A fine pitch (stored 0..1000; default 0)'), def: 0 },
  { desc: P('OscA.FixedFrequency', 'Fixed Freq', 10, 2000, 'Hz', 'fixed-frequency mode oscillator A (10..2000 Hz; active behind Fixed On)'), def: 100 },
  { desc: P('OscA.Volume', 'Level', 0.0003162277571, 1, '', 'oscillator A output level — linear amplitude, −70..0 dB (OP3: ×0.5 lands exactly on −6.02 dB)'), def: 1 },
  { desc: P('OscA.Phase', 'Phase', 0, 100, '°', 'oscillator A start phase (stored 0..100)'), def: 0 },
  { desc: P('OscA.Feedback', 'Feedback', 0, 100, '%', 'oscillator A self-feedback (stored 0..100)'), def: 0 },
]

const ENV: OpParam[] = [
  { desc: P('Env.AttackTime', 'Attack', 0.1, 20000, 'ms', 'attack time in ms — dB-linear rise from the −70 dB floor to DecayLevel (OP finding: topology A→D→S→R)'), def: 0.1 },
  { desc: P('Env.DecayTime', 'Decay', 1, 60000, 'ms', 'decay time in ms — falls exponentially in amplitude toward SustainLevel (OP2 refuted dB-linear decay); τ = 0.120 s fitted at the 1000 ms pin'), def: 1000 },
  { desc: P('Env.ReleaseTime', 'Release', 1, 60000, 'ms', 'release time in ms — dB-linear from the note-off level to the −70 dB floor, rate (level+70)/time (OP2 refuted a fixed rate)'), def: 400 },
  { desc: P('Env.AttackLevel', 'A Level', 0.0003162277571, 1, '', 'attack start level — linear amplitude, −70..0 dB'), def: 0.0003162277571 },
  { desc: P('Env.DecayLevel', 'D Level', 0.0003162277571, 1, '', 'decay start level (the attack target) — linear amplitude'), def: 1 },
  { desc: P('Env.SustainLevel', 'S Level', 0.0003162277571, 1, '', 'sustain level — the decay TARGET, not an output knob (OP2 verdict); linear amplitude'), def: 1 },
  { desc: P('Env.ReleaseLevel', 'R Level', 0.0003162277571, 1, '', 'release end level — the −70 dB floor; linear amplitude'), def: 0.0003162277571 },
  { desc: P('Env.AttackSlope', 'A Slope', -1, 1, '', 'attack curve slope (stored −1..1)'), def: 0 },
  { desc: P('Env.DecaySlope', 'D Slope', -1, 1, '', 'decay curve slope (stored −1..1)'), def: 1 },
  { desc: P('Env.ReleaseSlope', 'R Slope', -1, 1, '', 'release curve slope (stored −1..1)'), def: 1 },
]

const GLOBALS: OpParam[] = [
  { desc: P('Globals.Transpose', 'Transpose', -48, 48, 'st', 'global pitch transpose (stored −48..48)'), def: 0 },
  { desc: P('Globals.Tone', 'Tone', 0, 1, '', 'global tone shaping (stored 0..1; default 0.7)'), def: 0.6999999881 },
  { desc: P('Globals.Volume', 'Volume', 0.0003162277571, 1.99526238, '', 'device output level — linear amplitude, −70..+6 dB (OP4: ×0.25 trim lands exactly on −12.04 dB)'), def: 0.1258925349 },
]

const WAVE_FORM: ParamDescJson = {
  id: 'OscA.WaveForm',
  ui_name: 'Wave',
  stored_min: 0,
  stored_max: 0,
  unit: '',
  kind: 'discrete',
  labels: ['?'],
  notes: 'oscillator A waveform menu — only stored 0 (sine) in evidence (M1: h2 63 dB below h1)',
}

const FIXED_ON: ParamDescJson = {
  id: 'OscA.FixedFrequencyOn',
  ui_name: 'Fixed',
  stored_min: 0,
  stored_max: 1,
  unit: '',
  kind: 'toggle',
  notes: 'fixed-frequency mode on/off (bool element; default false)',
}

const RETRIGGER: ParamDescJson = {
  id: 'OscA.Retrigger',
  ui_name: 'Retrigger',
  stored_min: 0,
  stored_max: 1,
  unit: '',
  kind: 'toggle',
  notes: 'oscillator A phase retrigger on/off (bool element; default true)',
}

/** Local values keyed by param id (stored-value strings, as the document
 * keeps them). */
type LocalValues = Record<string, string>

function initialValues(params: OpParam[]): LocalValues {
  const v: LocalValues = {}
  for (const p of params) v[p.desc.id] = String(p.def)
  v[WAVE_FORM.id] = '0'
  v[FIXED_ON.id] = 'false'
  v[RETRIGGER.id] = 'true'
  return v
}

/** The env display: an original ADSR drawing from the local values. */
function EnvDisplay({ values }: { values: LocalValues }) {
  const num = (id: string, d: number) => {
    const raw = parseFloat(values[id] ?? '')
    return Number.isNaN(raw) ? d : raw
  }
  const a = Math.min(1, Math.log10(1 + num('Env.AttackTime', 0.1)) / Math.log10(1 + 20000))
  const d = Math.min(1, Math.log10(1 + num('Env.DecayTime', 1000)) / Math.log10(1 + 60000))
  const r = Math.min(1, Math.log10(1 + num('Env.ReleaseTime', 400)) / Math.log10(1 + 60000))
  const peak = 8
  const floor = 66
  const aX = 14 + a * 70
  const dX = aX + d * 70
  const sY = floor - (floor - peak) * Math.sqrt(Math.min(1, num('Env.SustainLevel', 1)))
  const rX = dX + 24
  return (
    <span className="prp-display-wrap" title="Amp envelope — original drawing from the local values. Topology per the OP dossier: attack dB-linear to DecayLevel, decay exponential-in-amplitude to SustainLevel (a decay target, not an output knob), release dB-linear from the note-off level to the −70 dB floor.">
      <svg className="prp-display" width={212} height={76} viewBox="0 0 212 76" aria-label="Amp envelope display">
        <line x1="0" y1={floor} x2="212" y2={floor} className="prp-display-grid" />
        <path
          d={`M 6 ${floor} L ${aX} ${peak} L ${dX} ${sY} L ${rX} ${sY} L ${Math.min(206, rX + 12 + r * 40)} ${floor}`}
          className="prp-display-curve"
        />
        <text x="8" y="12" className="prp-display-tag">
          amp env
        </text>
        <text x={aX - 4} y="72" className="prp-display-tag">
          A
        </text>
        <text x={dX - 4} y="72" className="prp-display-tag">
          D
        </text>
        <text x={rX - 4} y="72" className="prp-display-tag">
          R
        </text>
      </svg>
    </span>
  )
}

export function OperatorPro({ set, loading, error }: PanelContext) {
  const [values, setValues] = useState<LocalValues>(() => initialValues([...OSC_A, ...ENV, ...GLOBALS]))
  const localSend = useCallback((paramId: string, payload: number | boolean) => {
    setValues((v) => ({ ...v, [paramId]: typeof payload === 'boolean' ? String(payload) : String(payload) }))
  }, [])

  // Local bind adapter: the same controls, writing local state (no M3
  // marks — the face's badge carries the honesty).
  const bindFor = useCallback(
    (desc: ParamDescJson): Bind => ({
      desc,
      stored: values[desc.id],
      send: (id, payload) => localSend(id, payload),
      fail: () => {},
    }),
    [values, localSend],
  )

  if (loading) return <div className="prp-hint">reading set…</div>
  if (error) return <div className="prp-hint prp-hint-error">open failed: {error}</div>
  if (!set) return <div className="prp-hint">no set open — open one from the browser</div>

  return (
    <ProFace
      name="Operator"
      element="Operator"
      badge="model arriving — M3 edits land with its table"
    >
      <ProSection title="oscillator A">
        <div className="prp-col" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <ProToggle bind={bindFor(FIXED_ON)} label="Fixed" />
            <ProMenu bind={bindFor(WAVE_FORM)} />
            <ProToggle bind={bindFor(RETRIGGER)} label="Retrig" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {OSC_A.slice(0, 2).map((p) => (
              <ProField key={p.desc.id} bind={bindFor(p.desc)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {OSC_A.slice(2).map((p) => (
              <ProField key={p.desc.id} bind={bindFor(p.desc)} />
            ))}
          </div>
        </div>
        <div className="prp-sub" style={{ maxWidth: 210 }}>
          stored structure from the Operator preset XML (Operator.0 / Tune, Volume, Phase,
          Feedback); Level is linear amplitude (−70..0 dB).
        </div>
      </ProSection>
      <ProSection title="amp envelope">
        <EnvDisplay values={values} />
        <div className="prp-col" style={{ gap: 8 }}>
          <div className="prp-envelope-strip">
            {ENV.slice(0, 3).map((p) => (
              <ProField key={p.desc.id} bind={bindFor(p.desc)} />
            ))}
          </div>
          <div className="prp-envelope-strip">
            {ENV.slice(3, 7).map((p) => (
              <ProField key={p.desc.id} bind={bindFor(p.desc)} />
            ))}
          </div>
        </div>
        <div className="prp-col" style={{ gap: 8 }}>
          {ENV.slice(7).map((p) => (
            <ProSlider key={p.desc.id} bind={bindFor(p.desc)} />
          ))}
        </div>
      </ProSection>
      <ProSection title="global">
        {GLOBALS.map((p) => (
          <ProSlider key={p.desc.id} bind={bindFor(p.desc)} />
        ))}
        <div className="prp-sub" style={{ maxWidth: 200 }}>
          Volume is the device output trim in linear amplitude (−70..+6 dB stored); level laws
          verified to 0.01 dB across OP3/OP4.
        </div>
      </ProSection>
    </ProFace>
  )
}

/** Compact rack face for the bottom device-chain slot. */
export function OperatorRack({ set, loading, error }: PanelContext) {
  const [values, setValues] = useState<LocalValues>(() => initialValues([...OSC_A, ...ENV, ...GLOBALS]))
  const localSend = useCallback((paramId: string, payload: number | boolean) => {
    setValues((v) => ({ ...v, [paramId]: String(payload) }))
  }, [])
  const bindFor = useCallback(
    (desc: ParamDescJson): Bind => ({
      desc,
      stored: values[desc.id],
      send: (id, payload) => localSend(id, payload),
      fail: () => {},
    }),
    [values, localSend],
  )

  if (loading) return <div className="prp-hint">reading set…</div>
  if (error) return <div className="prp-hint prp-hint-error">open failed: {error}</div>
  if (!set) return <div className="prp-hint">no set open — open one from the browser</div>

  return (
    <ProFace name="Operator" element="Operator" badge="model arriving">
      <div className="prp-rack">
        <ProField bind={bindFor(OSC_A[0].desc)} />
        <ProField bind={bindFor(OSC_A[3].desc)} />
        <ProField bind={bindFor(ENV[0].desc)} />
        <ProField bind={bindFor(ENV[1].desc)} />
        <ProField bind={bindFor(ENV[2].desc)} />
        <ProSlider bind={bindFor(GLOBALS[2].desc)} />
      </div>
    </ProFace>
  )
}
