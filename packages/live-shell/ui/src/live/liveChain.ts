// The Live device chain's model (T-LIVE-TORUS-INSTRUMENT, lock §2.1): the instrument's chain is the torus first, then the effect faces over
// live-dynamics as devices on it, in the order their panels register. The ported generator faces (Operator, Wavetable, Drift) are not in
// the chain: they sit in the browser's Legacy generators section until their capacities have a home (owner ruling). Nothing is unregistered:
// every face stays in the registry, and getPanels('bottom') still names all of them.
import {getPanels, type PanelRegistration} from '../shell/panels'

/** The ported generator faces, moved out of the chain and into the browser's Legacy generators section. Their capacities are not yet carried
 * by the torus or its chain, so each remains reachable and working. (Drum Rack has no registered face in the shell and so is not listed.) */
export const LEGACY_GENERATOR_IDS: readonly string[] = Object.freeze([
  'devicespro.operator', 'devicespro.rack.operator',
  'devicespro.wavetable', 'devicespro.rack.wavetable', 'devicesb2.wavetable',
  'devicesb2.drift',
])

export function isLegacyGenerator(id: string): boolean {
  return LEGACY_GENERATOR_IDS.includes(id)
}

/** The effect faces on the instrument's chain, in registry order. */
export function liveChainEffects(): PanelRegistration[] {
  return getPanels('bottom').filter(panel => !isLegacyGenerator(panel.id))
}

/** The legacy generator faces, in registry order (the browser's Legacy generators section). */
export function legacyGeneratorPanels(): PanelRegistration[] {
  return getPanels('bottom').filter(panel => isLegacyGenerator(panel.id))
}
