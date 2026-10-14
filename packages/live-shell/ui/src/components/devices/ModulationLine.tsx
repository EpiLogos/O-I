import {modulationView, type Modulation} from '../nativeModulation'

/** The modulation disclosure of one compact control: its source names, base and effective, as the model's view gives them. Nothing renders when nothing modulates it.
 * Moved unchanged from NativeDeviceRack.tsx (it served the rack's compact controls) so the field devices' rows can carry the same line. */
export function ModulationLine({modulation}: {modulation?: Modulation | null}) {
  const view = modulationView(modulation)
  if (!view) return null
  return <p className="native-rack-modulation" role="group" aria-label={view.accessible} title={view.accessible}>
    <span className="native-rack-mark" aria-hidden="true">A </span>{view.named ? 'Driven by ' : ''}{view.driven} · Base {view.base} · Effective {view.effective}
  </p>
}
