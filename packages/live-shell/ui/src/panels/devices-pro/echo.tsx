import type { PanelContext } from '../../shell/panels'

import {
  ProFace,
  ProField,
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
 * Echo — the device face port. Layout per the real face's delay grid: the
 * L/R channel columns (sync toggle above the time display each), the
 * feedback knob between them, then the filter block (HP/LP pairs behind an
 * On gate), the internal-reverb send, and the output crossfade. A dimmed
 * modulation bay marks where the mod section sits on the real face — its
 * parameters are not in the stored table yet (honesty rule: milestone note,
 * not fake controls).
 *
 * Semantics (devices/echo.md, carried by the table's notes): Delay_Time
 * stored unit = SECONDS (free-mode taps land exactly on the stored values);
 * inert while synced. Feedback = linear gain, applied once per hop from tap
 * 3. ChannelMode 1 = pingpong, hop = min(L, R), same-channel repeats at 2×hop.
 * DryWet = 1 removes the direct entirely (crossfade). Reverb_Level carries
 * the between-tap tail.
 */

/** The tap-grid window: an honest stub — the measured tap structure lives
 * in the dossier; the live tap display lands with the realtime engine. */
function TapGrid() {
  return (
    <span className="prp-display-wrap" title="Echo tap grid — stub. The measured structure: pingpong taps alternate L-first spaced by min(Delay_TimeL, Delay_TimeR), same-channel repeats at 2×hop; Feedback enters the tail from tap 3. The live tap display lands with the realtime engine.">
      <svg className="prp-display" width={132} height={56} viewBox="0 0 132 56" aria-label="Echo tap grid (stub)">
        <line x1="0" y1="28" x2="132" y2="28" className="prp-display-grid" />
        {[8, 28, 48, 68, 88, 108].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={i % 2 === 0 ? 12 : 22} x2={x} y2={i % 2 === 0 ? 44 : 34} className="prp-display-pos" />
            <circle cx={x} cy={i % 2 === 0 ? 14 : 30} r="1.6" className="prp-display-curve-dim" />
          </g>
        ))}
        <text x="4" y="10" className="prp-display-tag">
          L
        </text>
        <text x="4" y="52" className="prp-display-tag">
          R
        </text>
        <text x="94" y="10" className="prp-display-tag">
          tap grid
        </text>
      </svg>
    </span>
  )
}

export function EchoPro({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'Echo', 'Echo')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'Echo', 'Echo', edit)

  return (
    <ProFace name="Echo" element="Echo" edit={edit}>
      {guard ?? (
        <>
          <ProSection title="delay">
            {bind('ChannelMode') ? <ProMenu bind={bind('ChannelMode')!} segmented /> : null}
            <div className="prp-grid2">
              <div className="prp-grid-cell">
                <div className="prp-grid-head">
                  <span className="prp-grid-letter">L</span>
                  {bind('Delay_SyncL') ? <ProToggle bind={bind('Delay_SyncL')!} label="Sync" /> : null}
                </div>
                {bind('Delay_TimeL') ? (
                  <ProField
                    bind={bind('Delay_TimeL')!}
                    format={(v) => `${(v * 1000).toFixed(0)} ms`}
                    parse={(text) => parseFloat(text) / 1000}
                  />
                ) : null}
              </div>
              <div className="prp-grid-cell">
                <div className="prp-grid-head">
                  <span className="prp-grid-letter">R</span>
                  {bind('Delay_SyncR') ? <ProToggle bind={bind('Delay_SyncR')!} label="Sync" /> : null}
                </div>
                {bind('Delay_TimeR') ? (
                  <ProField
                    bind={bind('Delay_TimeR')!}
                    format={(v) => `${(v * 1000).toFixed(0)} ms`}
                    parse={(text) => parseFloat(text) / 1000}
                  />
                ) : null}
              </div>
            </div>
            {bind('Feedback') ? <ProKnob bind={bind('Feedback')!} /> : null}
            <TapGrid />
            <div className="prp-sub" style={{ maxWidth: 210 }}>
              stored Delay_Time unit = seconds (free mode); fields show ms. Feedback is linear gain,
              one application per hop from tap 3; pingpong hop = min(L, R).
            </div>
          </ProSection>
          <ProSection title="filter">
            {bind('Filter_On') ? <ProToggle bind={bind('Filter_On')!} label="On" /> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, flex: 1, minWidth: 150 }}>
              {bind('Filter_HighPassFrequency') ? <ProSlider bind={bind('Filter_HighPassFrequency')!} curve={2.6} /> : null}
              {bind('Filter_HighPassResonance') ? <ProSlider bind={bind('Filter_HighPassResonance')!} /> : null}
              {bind('Filter_LowPassFrequency') ? <ProSlider bind={bind('Filter_LowPassFrequency')!} curve={2.6} /> : null}
              {bind('Filter_LowPassResonance') ? <ProSlider bind={bind('Filter_LowPassResonance')!} /> : null}
            </div>
            <div className="prp-sub" style={{ maxWidth: 170 }}>
              HP/LP pairs behind the gate — the dominant level factor of the measured impulse
              response (E8).
            </div>
          </ProSection>
          <ProSection title="reverb send">
            {bind('Reverb_Level') ? <ProKnob bind={bind('Reverb_Level')!} /> : null}
            {bind('Reverb_Decay') ? <ProKnob bind={bind('Reverb_Decay')!} /> : null}
            <div className="prp-sub" style={{ maxWidth: 190 }}>
              Echo's internal reverb: carries the between-tap tail (floor −54 vs −90 dBFS with it
              off). Decay semantic unmeasured.
            </div>
          </ProSection>
          <ProSection title="output">
            {bind('DryWet') ? <ProKnob bind={bind('DryWet')!} /> : null}
            <div
              className="prp-section prp-dim-stub"
              style={{ opacity: 0.55, maxWidth: 190 }}
              title="Modulation section (AmountDelay, rate, phase) sits here on the real face — those parameters are not in the stored table yet; the section lands with the echo model's modulation lane."
            >
              <div className="prp-section-title">modulation</div>
              <div className="prp-sub">lands with the echo model's mod lane — not in the stored table yet</div>
            </div>
          </ProSection>
        </>
      )}
    </ProFace>
  )
}

/** Compact rack face for the bottom device-chain slot. */
export function EchoRack({ set, loading, error }: PanelContext) {
  const edit = useDeviceEdit(set, 'Echo', 'Echo')
  const bind = useBind(edit)
  const guard = editGuard(set, loading, error, 'Echo', 'Echo', edit)

  return (
    <ProFace name="Echo" element="Echo" edit={edit}>
      {guard ?? (
        <div className="prp-rack">
          {bind('ChannelMode') ? <ProMenu bind={bind('ChannelMode')!} segmented /> : null}
          {bind('Delay_SyncL') ? <ProToggle bind={bind('Delay_SyncL')!} label="sync L" /> : null}
          {bind('Delay_TimeL') ? (
            <ProField
              bind={bind('Delay_TimeL')!}
              format={(v) => `${(v * 1000).toFixed(0)} ms`}
              parse={(text) => parseFloat(text) / 1000}
            />
          ) : null}
          {bind('Delay_SyncR') ? <ProToggle bind={bind('Delay_SyncR')!} label="sync R" /> : null}
          {bind('Delay_TimeR') ? (
            <ProField
              bind={bind('Delay_TimeR')!}
              format={(v) => `${(v * 1000).toFixed(0)} ms`}
              parse={(text) => parseFloat(text) / 1000}
            />
          ) : null}
          {bind('Feedback') ? <ProKnob bind={bind('Feedback')!} size={32} /> : null}
          {bind('Filter_On') ? <ProToggle bind={bind('Filter_On')!} label="flt" /> : null}
          {bind('DryWet') ? <ProKnob bind={bind('DryWet')!} size={32} /> : null}
        </div>
      )}
    </ProFace>
  )
}
