import type { PanelContext } from '../../shell/panels'

import {
  ProFace,
  ProKnob,
  ProSection,
  ProSlider,
  ProToggle,
  editGuard,
  useBind,
  useDeviceEdit,
} from './kit'

/**
 * Reverb — the device face port. Layout per the real face: the time block
 * on the left (Pre-Delay above the big Decay control beside the decay
 * window), the character/mix block (Direct / Reflect / Diffuse), and the
 * shelving block (Low and High shelf: On toggle, Frequency, Gain).
 *
 * Semantics (devices/reverb.md, carried by the table's notes): DecayTime is
 * stored in ms and is RT60-referenced — RT60 tracks the stored value
 * (per-band k ≈ 0.80–0.94 in src/reverb.rs); PreDelay is ms (first reverb
 * energy ≈2.5 ms after the direct at the 2.5 default); the shelf gains'
 * linear-vs-dB semantic is unstated in the dossier.
 */

/** The decay window: RT60 curve stub — the live envelope lands with the
 * realtime engine; the scale note carries the dossier's law. */
function DecayWindow() {
  return (
    <span className="prp-display-wrap" title="Decay window — stub. DecayTime is RT60-referenced: RT60 tracks the stored ms value (D5 verdict, high confidence). The live envelope display lands with the realtime engine.">
      <svg className="prp-display" width={148} height={72} viewBox="0 0 148 72" aria-label="Decay window (RT60 stub)">
        <line x1="0" y1="10" x2="148" y2="10" className="prp-display-grid" />
        <line x1="0" y1="62" x2="148" y2="62" className="prp-display-grid" />
        <path d="M 8 10 C 30 12, 60 26, 92 44 S 132 58, 142 60" className="prp-display-curve" />
        <path
          d="M 8 10 C 30 12, 60 26, 92 44 S 132 58, 142 60 L 142 62 L 8 62 Z"
          className="prp-display-fill"
        />
        <text x="8" y="70" className="prp-display-tag">
          RT60 tracks DecayTime
        </text>
      </svg>
    </span>
  )
}

export function ReverbPro({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'Reverb', 'Reverb')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'Reverb', 'Reverb', edit)

  return (
    <ProFace name="Reverb" element="Reverb" edit={edit}>
      {guard ?? (
        <>
          <ProSection title="time">
            {bind('PreDelay') ? <ProSlider bind={bind('PreDelay')!} curve={2} /> : null}
            {bind('DecayTime') ? <ProSlider bind={bind('DecayTime')!} curve={2.4} /> : null}
            <DecayWindow />
            <div className="prp-sub" style={{ maxWidth: 220 }}>
              DecayTime stored in ms = RT60 (the window annotates the law); Pre-Delay in ms — first
              reverb energy ≈2.5 ms after the direct at the default.
            </div>
          </ProSection>
          <ProSection title="character">
            {bind('MixDirect') ? <ProKnob bind={bind('MixDirect')!} /> : null}
            {bind('MixReflect') ? <ProKnob bind={bind('MixReflect')!} /> : null}
            {bind('MixDiffuse') ? <ProKnob bind={bind('MixDiffuse')!} /> : null}
            <div className="prp-sub" style={{ maxWidth: 200 }}>
              the stored mix family of the single room lineage: Direct measured −9.89 dBFS mono
              peak at its 0.55 default; Reflect/Diffuse semantics unswept in the dossier.
            </div>
          </ProSection>
          <ProSection title="shelving">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div className="prp-col">
                <div style={{ display: 'flex', gap: 10 }}>
                  {bind('ShelfLowOn') ? <ProToggle bind={bind('ShelfLowOn')!} label="Low on" /> : null}
                  {bind('ShelfLoFreq') ? <ProSlider bind={bind('ShelfLoFreq')!} curve={2.6} /> : null}
                  {bind('ShelfLoGain') ? <ProSlider bind={bind('ShelfLoGain')!} /> : null}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {bind('ShelfHighOn') ? <ProToggle bind={bind('ShelfHighOn')!} label="High on" /> : null}
                  {bind('ShelfHiFreq') ? <ProSlider bind={bind('ShelfHiFreq')!} curve={2.6} /> : null}
                  {bind('ShelfHiGain') ? <ProSlider bind={bind('ShelfHiGain')!} /> : null}
                </div>
              </div>
              <div className="prp-sub" style={{ maxWidth: 170 }}>
                stored defaults: high shelf on at 4500 Hz / 0.7 (the tail's HF rolloff), low shelf
                off at 90 Hz. Gain linear-vs-dB unstated in the dossier.
              </div>
            </div>
          </ProSection>
        </>
      )}
    </ProFace>
  )
}

/** Compact rack face for the bottom device-chain slot. */
export function ReverbRack({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'Reverb', 'Reverb')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'Reverb', 'Reverb', edit)

  return (
    <ProFace name="Reverb" element="Reverb" edit={edit}>
      {guard ?? (
        <div className="prp-rack">
          {bind('PreDelay') ? <ProSlider bind={bind('PreDelay')!} curve={2} /> : null}
          {bind('DecayTime') ? <ProSlider bind={bind('DecayTime')!} curve={2.4} /> : null}
          {bind('MixDirect') ? <ProKnob bind={bind('MixDirect')!} size={32} /> : null}
          {bind('MixReflect') ? <ProKnob bind={bind('MixReflect')!} size={32} /> : null}
          {bind('MixDiffuse') ? <ProKnob bind={bind('MixDiffuse')!} size={32} /> : null}
          {bind('ShelfHighOn') ? <ProToggle bind={bind('ShelfHighOn')!} label="hi shelf" /> : null}
          {bind('ShelfLowOn') ? <ProToggle bind={bind('ShelfLowOn')!} label="lo shelf" /> : null}
        </div>
      )}
    </ProFace>
  )
}
