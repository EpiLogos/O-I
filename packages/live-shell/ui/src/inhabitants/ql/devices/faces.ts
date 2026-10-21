// The Technē family faces as devices of the runtime (T-DEVICES-TECHNE; FOUNDATION F5; manual §10.4, §3 "Wherever you are, the
// instrument in the focused pane brings its own controls into the chain"). A face is declared by its family (QL, the atlas, the
// knowledge graph); this module only names it for the plate: its title, its mark from the cut, and the declaration the runtime
// draws. The Live semantic, the invariant, the holders and the note are the family's own, copied unchanged.
import type {DeviceDeclaration} from '../../sdk/define'
import type {IconName} from '../../sdk/icons'
import type {InhabitantFaceDeclaration} from '../../manifest'

/** The human names of the declared faces — a type name is not a name. Ported from inhabitants/inhabitantRack.tsx:328-371
 * (FACE_TITLES, the entries for these three families), where the rack drew them. */
export const TECHNE_FACE_TITLES: Readonly<Record<string, string>> = Object.freeze({
  'globe-engine': 'Globe',
  'graph-tools': 'Graph tools',
  'mode-switch': 'Earth ⇄ Graph',
  'time-control': 'Deep time',
  'knowledge-scope': 'Scope',
  'knowledge-filters': 'Filters',
  'knowledge-display': 'Display',
  'sky': 'Sky',
  'torus': 'Torus / field',
  'm3-clock': 'M3 clock',
  'resonator-bank': 'Resonator bank',
  'deck': 'Deck',
  'chakra': 'Chakra',
  'sitting': 'Sitting',
  'm-prime-matrices': 'M′ matrices',
  'binding': 'Binding',
  'ql-instrument': 'QL field / PCM owner',
})

/** Each face's mark from the cut (icon-cut.html, sdk/icons.ts). The QL faces carry the marks the rack gave them
 * (inhabitants/inhabitantRack.tsx:136-142 FACE_MARKS); the atlas and knowledge faces carry the marks their plates declare
 * (inhabitants/agentNativeP0.ts:164, 203, 215, 227 and :290). */
export const TECHNE_FACE_ICONS: Readonly<Record<string, IconName>> = Object.freeze({
  'globe-engine': 'map',
  'graph-tools': 'map',
  'mode-switch': 'direct',
  'time-control': 'metroDots',
  'knowledge-scope': 'search',
  'knowledge-filters': 'search',
  'knowledge-display': 'search',
  'sky': 'expr',
  'torus': 'expr',
  'm3-clock': 'metro',
  'resonator-bank': 'metro',
  'deck': 'lib',
  'chakra': 'form',
  'sitting': 'loop',
  'm-prime-matrices': 'techne',
  'binding': 'bind',
  'ql-instrument': 'expr',
})

/** A device's id on the door, unique across families: `<family>:<face>`. */
export function techneDeviceId(family: string, faceId: string): string {
  return `${family}:${faceId}`
}

/** The declaration the runtime draws for one declared face. */
export function techneFaceDeclaration(face: InhabitantFaceDeclaration): DeviceDeclaration {
  return {
    id: face.id,
    title: TECHNE_FACE_TITLES[face.id] ?? face.id,
    icon: TECHNE_FACE_ICONS[face.id] ?? 'form',
    liveSemantic: face.liveSemantic,
    ...(face.invariant ? {invariant: face.invariant} : {}),
    ...(face.heldBy ? {heldBy: face.heldBy} : {}),
    ...(face.note ? {note: face.note} : {}),
    ...(face.admission ? {admission: face.admission} : {}),
    presentations: face.presentations,
  }
}

/** Whether a face starts expanded on a chain: the faces the focused instrument holds (the lock: "the focused lens expanded,
 * the others folded"); with no focus, every admitted face stands and the waiting ones fold to their titles. */
export function startsExpanded(face: InhabitantFaceDeclaration, focusInstrument: string | null | undefined): boolean {
  if (focusInstrument != null) return (face.heldBy ?? []).includes(focusInstrument)
  return face.admission !== 'waiting'
}
