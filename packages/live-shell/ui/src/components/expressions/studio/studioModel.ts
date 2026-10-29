// The Expressions Studio's chains (DLW §20.3 "The chains": Material, Motion, Body, Nara; lock §0.3.7 "the field devices stand in its
// chains"; R4 — the eight sections of the old Studio, world-shell-mockup.html:1432-1441, are gone: Tools, Selected and Formation's scene
// devices are the scene's Clip view's, Capture is the transport's). The chains and what each holds are the holder table's
// (inhabitants/sdk/semantics.ts STUDIO_SECTIONS, lock §4.8): this module only sorts the catalogue's devices (components/
// nativeDeviceCatalogue.ts) into those chains, in the table's order. Pure: no React, no owner call.
import type {NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import type {HostedAppState} from '@epilogos/expressions-boundary'
import {STUDIO_SECTIONS} from '../../../inhabitants/sdk/semantics'
import {deviceCatalogue, type RackDevice} from '../../nativeDeviceCatalogue'
import {standingWord} from '../clip/sceneClip'
import {CHAIN_OF_HOLDER, type StudioChainHolding} from './studioBinding'

const EXPRESSIONS = 'expressions/'
const QUATERNAL_LOGIC = 'quaternal-logic/'

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
      id: holder.id, title: holder.title, note: holder.provenance ?? null,
      field: held.filter(device => device.scope === 'field'),
      entity: held.filter(device => device.scope === 'entity'),
      scene: held.filter(device => device.scope === 'scene'),
      ql: holds.filter(ref => ref.startsWith(QUATERNAL_LOGIC)).map(ref => ref.slice(QUATERNAL_LOGIC.length)),
    }
  })
}

/** The Studio's four chains as its binding reads them (studioBinding.ts): each chain's field devices, and the Quaternal Logic faces Body
 * holds, titled and marked waiting as the family admits them. `faces` is the QL family's faces (id, admission); `title` names one. */
export function studioChains(faces: readonly {readonly id: string; readonly admission?: string}[], title: (faceId: string) => string,
  sections: readonly StudioSection[] = studioSections()): StudioChainHolding[] {
  return sections.flatMap(section => {
    const chain = CHAIN_OF_HOLDER[section.id]
    if (!chain) return []
    const ql = section.ql.flatMap(id => {
      const face = faces.find(item => item.id === id)
      return face ? [{id, title: title(id), waiting: face.admission === 'waiting'}] : []
    })
    return [{chain, field: section.field, ql}]
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

/** The Studio's owner line: the engine, the open Scene — where the frame says it stands, when it says — and the owner's standing
 * in its own words; never a claim of the shell's. */
export function studioOwner(reading: NativeEditorReading | null, place: string | null = null): string {
  if (!reading) return place ? `Expressions engine · ${place}` : 'Expressions engine · no work is open'
  return `Expressions engine · ${place ?? reading.scene.name} · ${standingWord(reading.standing)}`
}

/** A time on the Expression's clock, in words: minutes and seconds, tenths when the address carries them (12.346 → 0:12.3). */
export function addressClock(seconds: number): string {
  const tenths = Math.round(seconds * 10), whole = Math.floor(tenths / 10), rest = tenths % 10
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}${rest ? `.${rest}` : ''}`
}

/** lane-3 E22 (ticket P, G3): where the work stands, in words — the Scene's name, the time, the marker's name — read only from
 * the frame's own announcement (its address and Scene name). Null while the frame names no address. */
export function studioPlace(state: HostedAppState | null | undefined): string | null {
  const address = state?.address
  if (!address) return null
  const scene = state.sceneName?.trim() ? `“${state.sceneName.trim()}”` : 'the Scene'
  const at = address.t !== undefined ? ` at ${addressClock(address.t)}` : ''
  const marker = address.marker !== undefined ? ` · marker “${address.markerName?.trim() || address.marker}”` : ''
  return `${scene}${at}${marker}`
}

/** Whether a device the person can place stands on the rack now (the owner's `devices` reading). */
export function onRack(reading: NativeEditorReading | null, family: string): boolean {
  return !!reading?.devices.some(device => device.family === family)
}

/** The frame's chrome controls (T-FRAME-CHROME-ONTO-PLATES; their ids as the frame's chrome door reads them, presentedChrome.ts
 * `region/key`) that another device of Expressions already carries, so the Stage does not stand them twice. Each names its carrier:
 *   • rail/a:pointer-options — the transport's Draw slot pointer group (shell/transports/useExpressionsTransport.tsx `draw`, BarPointerGroup);
 *   • rail/a:objects — Selected's Object chooser (ExpressionsStudio.tsx SelectedGlyph);
 *   • workspace/a:studio — this Studio; workspace/a:blueprint — the Studio's Blueprint device (Scene devices, studioSections);
 *   • save/a:capture-image, save/a:record-video, save/a:capture-options — File › Export › Picture… with its choices and Film (O-I #747:
 *     menus.rs; StudioStage.tsx PictureChoices, menuStageCommands);
 *   • scene/a:toggle-play — the transport's Play and Stop (useExpressionsTransport.tsx `play`); scene/a:present — View › Present (O-I #747:
 *     menus.rs, StudioStage.tsx menuStageCommands);
 *   • rail/a:tool-select — Clip view's pointer tools, Select (O-I #747: components/expressions/clip/clipBinding.ts `tool`);
 * (R2 retired the Clip side's SceneControls, which carried workspace/a:quick-guide and scene/a:previous, next, timeline and play-journey:
 * the frame's own controls for them stand on the Stage's Frame tools until the scene's Clip view carries them.)
 *   • side/a:toolbelt — Your controls, the toolbelt's own entries with + Parameter (NativeChosenControls.tsx :225);
 *   • view/a:grid, view/a:snap, view/a:guides — View › Grid, Snap, Guides (O-I #747: menus.rs); view/a:face-plane — the Stage's Camera
 *     (StudioStage.tsx StageViewTools);
 *   • present/a:exit-present — View › Present, again (or Esc); recording/a:stop-record — File › Export › Film, again. */
export const STUDIO_CARRIED: ReadonlySet<string> = new Set([
  'rail/a:pointer-options', 'rail/a:objects', 'rail/a:tool-select', 'workspace/a:studio', 'workspace/a:blueprint',
  'save/a:capture-image', 'save/a:record-video', 'save/a:capture-options',
  'scene/a:toggle-play', 'scene/a:present',
  'side/a:toolbelt', 'view/a:grid', 'view/a:snap', 'view/a:face-plane', 'view/a:guides', 'present/a:exit-present', 'recording/a:stop-record',
])
