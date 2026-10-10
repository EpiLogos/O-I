import type { PanelContext } from '../../shell/panels'

import {
  ProFace,
  ProKnob,
  ProMenu,
  ProSection,
  ProSlider,
  ProToggle,
  editGuard,
  useBind,
  useDeviceEdit,
} from './kit'

/**
 * Glue Compressor — the device face port. Layout per the real face: the big
 * VU-style meter block on the left, then the compressor row (Threshold /
 * Range vertical faders, Attack / Release ms menus, Ratio curve-family
 * selector, Makeup), output row (Dry/Wet, Soft clip). Editing is live
 * through the M3 API: every control shows the document's stored value and
 * POSTs its change (slider drag debounced ~150 ms) with a saved/error mark.
 *
 * Semantics (devices/glue-compressor.md, carried by the parameter table's
 * notes): Range is a soft gain-reduction ceiling in dB (asymptotic, never a
 * hard clamp); Ratio selects a curve family — no display-ratio law exists,
 * so the segments carry the stored indices; Attack/Release are the dossier's
 * ms/µs menu tables; PeakClipIn is the output clipper (−0.50 dBFS ceiling).
 */

const METER_CELLS = 24

/** The GR meter window: a milestone stub — lit top-down because the
 * realtime envelope follower lands with the dynamics model, not before. */
function GrMeter() {
  return (
    <div
      style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}
      title="Gain-reduction meter — stub. The live meter lights with the realtime dynamics model (live-dynamics milestone); Range above is the soft GR ceiling in dB (asymptotic approach, never a hard clamp)."
    >
      <div className="prp-meter" style={{ width: 30, flexDirection: 'column' }}>
        {Array.from({ length: METER_CELLS }, (_, i) => (
          <span key={i} className="prp-meter-cell" />
        ))}
      </div>
      <div className="prp-meter-scale" style={{ justifyContent: 'space-between' }}>
        <span>0</span>
        <span>-4</span>
        <span>-8</span>
        <span>-12</span>
        <span>-20</span>
      </div>
    </div>
  )
}

export function GlueCompressorPro({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'GlueCompressor', 'GlueCompressor')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'GlueCompressor', 'Glue Compressor', edit)

  return (
    <ProFace name="Glue Compressor" element="GlueCompressor" edit={edit}>
      {guard ?? (
        <>
          <ProSection title="dynamics">
            <div className="prp-row" style={{ alignItems: 'stretch', gap: 8 }}>
              <GrMeter />
              {bind('Threshold') ? <ProSlider bind={bind('Threshold')!} vertical height={120} tickCount={3} /> : null}
              {bind('Range') ? <ProSlider bind={bind('Range')!} vertical height={120} tickCount={3} /> : null}
            </div>
            <div className="prp-row" style={{ marginTop: 8 }}>
              {bind('Attack') ? <ProMenu bind={bind('Attack')!} /> : null}
              {bind('Release') ? <ProMenu bind={bind('Release')!} /> : null}
              {bind('Ratio') ? <ProMenu bind={bind('Ratio')!} segmented /> : null}
            </div>
            <div className="prp-row" style={{ marginTop: 8, alignItems: 'stretch', gap: 8 }}>
              {bind('Makeup') ? <ProSlider bind={bind('Makeup')!} vertical height={64} tickCount={2} /> : null}
              <div className="prp-sub" style={{ maxWidth: 170, alignSelf: 'center' }}>
                Range is the soft GR ceiling in dB (asymptotic — never a hard clamp); Ratio selects a
                curve family; Attack/Release are the dossier's ms menus. Meter stub: the live GR
                meter lands with the realtime model.
              </div>
            </div>
          </ProSection>
          <ProSection title="output">
            {bind('DryWet') ? <ProKnob bind={bind('DryWet')!} size={34} /> : null}
            {bind('PeakClipIn') ? <ProToggle bind={bind('PeakClipIn')!} label="Soft (clip)" /> : null}
          </ProSection>
        </>
      )}
    </ProFace>
  )
}

/** Compact rack face for the bottom device-chain slot: the identity
 * controls in one wrapped strip (same live editing, smaller clothes). */
export function GlueCompressorRack({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'GlueCompressor', 'GlueCompressor')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'GlueCompressor', 'Glue Compressor', edit)

  return (
    <ProFace name="Glue" element="GlueCompressor" edit={edit}>
      {guard ?? (
        <div className="prp-rack">
          <GrMeter />
          {bind('Threshold') ? <ProSlider bind={bind('Threshold')!} /> : null}
          {bind('Ratio') ? <ProMenu bind={bind('Ratio')!} segmented /> : null}
          {bind('Attack') ? <ProMenu bind={bind('Attack')!} /> : null}
          {bind('Release') ? <ProMenu bind={bind('Release')!} /> : null}
          {bind('Makeup') ? <ProSlider bind={bind('Makeup')!} /> : null}
          {bind('PeakClipIn') ? <ProToggle bind={bind('PeakClipIn')!} label="clip" /> : null}
          {bind('DryWet') ? <ProKnob bind={bind('DryWet')!} size={32} /> : null}
        </div>
      )}
    </ProFace>
  )
}
