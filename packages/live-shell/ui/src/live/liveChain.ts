// The Live device chain's model (lock §2.1, FOUNDATION F0): the chain is the torus first, then the devices on the selected track, one face
// each — the generic stored-parameter editor where one is registered for the device's element name (panels/devices), else the read-only
// tile. The registry is never the chain. The ported generator faces (Operator, Wavetable) are not in the chain: they sit in the browser's
// Legacy generators section until their capacities have a home (owner ruling).
import {getPanels, type PanelRegistration} from '../shell/panels'
import {DEVICE_FACE_TITLES} from '../panels/devices/index'

/** The ported generator faces in the browser's Legacy generators section (devices-pro, frozen as the corpus reference). Their capacities
 * are not yet carried by the torus or its chain. (Drum Rack has no registered face in the shell and so is not listed.) */
export const LEGACY_GENERATOR_IDS: readonly string[] = Object.freeze([
  'devicespro.operator', 'devicespro.rack.operator',
  'devicespro.wavetable', 'devicespro.rack.wavetable',
])

export function isLegacyGenerator(id: string): boolean {
  return LEGACY_GENERATOR_IDS.includes(id)
}

/** The legacy generator faces, in registry order (the browser's Legacy generators section). */
export function legacyGeneratorPanels(): PanelRegistration[] {
  return getPanels('bottom').filter(panel => isLegacyGenerator(panel.id))
}

/** The display title of the stored-parameter face that edits a set device, by the element name the document stores; undefined when the
 * device has no face (the chain then shows its read-only tile). */
export function trackDeviceFaceTitle(elementName: string): string | undefined {
  return DEVICE_FACE_TITLES.get(elementName)
}
