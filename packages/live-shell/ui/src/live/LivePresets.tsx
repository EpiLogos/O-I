// The instrument's Presets (T-LIVE-TORUS-INSTRUMENT, the browser's Presets category). A preset is an owner record of the instrument's state.
// The owner can persist that state as the kernel's performance basis (desktop/cradle/kernel/src/expression_performance.rs,
// PerformanceBasis: the M1 configuration, tuning, form and force state, sealed by content digest), admitted inside an oi.expression-performance/v3
// record by PerformanceOperation::AdmitBasis. No frame or host operation carries that record yet, so saving and recalling stop at this seam.
// Nothing is stored in the shell or the browser: a preset would be the owner's record or nothing.

import {registerPanel} from '../shell/panels'
import './liveInstrumentSection.css'

export const LIVE_PRESETS_SEAM = 'No preset record is reachable from the host. The owner can persist instrument state as a performance basis (oi.expression-performance-basis/v1) admitted into an oi.expression-performance/v3 recording by PerformanceOperation::AdmitBasis, and no frame or host operation carries it yet. Save and recall wait at that seam.'

export function LivePresetsSection() {
  return (
    <section className="live-presets" aria-label="Presets" data-live-presets="seam">
      <h4>Presets</h4>
      <p className="live-presets-note" role="status">{LIVE_PRESETS_SEAM}</p>
    </section>
  )
}

registerPanel({
  id: 'Presets',
  title: 'Presets',
  slot: 'browser-section',
  component: LivePresetsSection,
  order: 4,
  navigation: false,
  note: "The instrument's saved states: waiting at the owner's persistence seam (performance basis).",
})
