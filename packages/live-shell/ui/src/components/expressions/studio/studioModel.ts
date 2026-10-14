// The Expressions Studio's plan (manual §7: "The studio sits in the device area: the field's tools; what you can do with the symbol
// you have selected …; then formation, material, motion, the body of the field, a personal layer that stays yours however the scene
// is shared, and capture"; lock §2.4 Device = Studio; the mockup's Studio at world-shell-mockup.html:1432-1441). The sections and
// what each holds are the holder table's (inhabitants/sdk/semantics.ts STUDIO_SECTIONS, lock §4.8): this module only sorts the
// catalogue's devices (components/nativeDeviceCatalogue.ts) into those sections, in the table's order. Pure: no React, no owner call.
import type {NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import {STUDIO_SECTIONS} from '../../../inhabitants/sdk/semantics'
import {deviceCatalogue, type RackDevice} from '../../nativeDeviceCatalogue'
import {standingWord} from '../clip/sceneClip'

const EXPRESSIONS = 'expressions/'
const QUATERNAL_LOGIC = 'quaternal-logic/'

/** The headings the mockup gives the sections where they say more than the holder's name (world-shell-mockup.html:1436). */
const HEADINGS: Readonly<Record<string, string>> = {'studio:selected': 'Selected · the glyph'}

export interface StudioSection {
  readonly id: string
  readonly title: string
  /** The holder's provenance, at the right of the heading (Body · 3:3 → M1+M2+M3). */
  readonly note: string | null
  /** The field devices it holds: devices of the runtime, live whether or not they stand on the rack. */
  readonly field: readonly RackDevice[]
  /** The devices that act on the selected object (Force, Sound, Meaning, Formation). */
  readonly entity: readonly RackDevice[]
  /** The devices that act on the Scene (Arrangement, Blueprint, Page text, Scene body). */
  readonly scene: readonly RackDevice[]
  /** The Quaternal Logic faces it holds (the M1 field/PCM owner and the torus in Body · 3:3), by face id. */
  readonly ql: readonly string[]
}

/** The Studio's sections in the holder table's order, each with the catalogue devices it holds, in the order it names them. */
export function studioSections(): StudioSection[] {
  const catalogue = deviceCatalogue()
  return STUDIO_SECTIONS.map(holder => {
    const holds = holder.holds ?? []
    const held = holds.filter(ref => ref.startsWith(EXPRESSIONS)).map(ref => catalogue.find(device => device.family === ref.slice(EXPRESSIONS.length)))
      .filter((device): device is RackDevice => !!device)
    return {
      id: holder.id, title: HEADINGS[holder.id] ?? holder.title, note: holder.provenance ?? null,
      field: held.filter(device => device.scope === 'field'),
      entity: held.filter(device => device.scope === 'entity'),
      scene: held.filter(device => device.scope === 'scene'),
      ql: holds.filter(ref => ref.startsWith(QUATERNAL_LOGIC)).map(ref => ref.slice(QUATERNAL_LOGIC.length)),
    }
  })
}

/** Every field family the Studio holds, once, in section order: the fixed list the Studio builds its devices from. */
export function studioFieldFamilies(sections: readonly StudioSection[] = studioSections()): string[] {
  return [...new Set(sections.flatMap(section => section.field.map(device => device.family)))]
}

/** The device a section shows first: the first of its devices the person placed on the rack, else the first the owner reads as on,
 * else its first. A choice, never a reading: it changes nothing of the owner's. */
export function firstShown(families: readonly string[], reading: NativeEditorReading | null, lit: (family: string) => boolean): string | null {
  if (!families.length) return null
  const placed = new Set(reading?.devices.map(device => device.family) ?? [])
  return families.find(family => placed.has(family)) ?? families.find(lit) ?? families[0]!
}

/** The Studio's owner line: the engine, the open Scene, and the owner's standing in its own words — never a claim of the shell's. */
export function studioOwner(reading: NativeEditorReading | null): string {
  if (!reading) return 'Expressions engine · no work is open'
  return `Expressions engine · ${reading.scene.name} · ${standingWord(reading.standing)}`
}

/** Whether a device the person can place stands on the rack now (the owner's `devices` reading). */
export function onRack(reading: NativeEditorReading | null, family: string): boolean {
  return !!reading?.devices.some(device => device.family === family)
}
