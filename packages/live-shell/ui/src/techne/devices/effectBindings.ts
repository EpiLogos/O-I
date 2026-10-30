// The Lens (§17.11, techne:lens): an effect on a reading's chain. It stands where the manual puts it and draws its design on what its
// owner answers here, every other key absent, every control disabled naming the operation it waits for. Nothing is a design's sample.
//   - The Lens's owner is Quaternal Logic. What it answers through the kernel's ql_read is drawn (lensRegistry.ts): the lens registry
//     (`ql mef lenses`), the frames (`ql context-frame list`) and the provider's operations (`ql service capabilities`). The rest names
//     what it waits for. The reading (`ql techne reading`) is routed, but it reads a target its caller supplies, and nothing in the shell
//     supplies one for the reading on a chain. The frame reading (`ql context-frame read`) is routed, but it reads a sixfold mapping its
//     caller names, and nothing names the material's six positions. The lens and sublens are the view's own holds: the aperture of a
//     refraction request (`ql wiki refract`, QL-MEF pull 350), drawn on QL's registry entry for the lens; the request itself waits for
//     that target and a kernel route. The mode and operation stand refused with what QL lacks. The proposals have no producer even then: QL's WikiFrame refraction engine leaves every reading's relation and traversal candidates
//     empty (QL-MEF crates/ql-wiki/src/refraction.rs:787-788), and `ql techne reading` carries none.
//   - A lens's own controls are the Lens's (§17.11; O-I ticket 762): the Earth pane stands a non-Field lens's title and controls down (its panel's
//     handle, close, walk rail, tabs and fields; Aion's epochs, rail, close and ring convention; the Red Book's and the dynamical lens's
//     rails and closes) and the Lens draws them, each the atlas's own control pressed (projections/atlas/paneChrome.ts): `pane.title`,
//     `pane.controls`, and the hand `pane.press`. While no atlas lens draws any, both are absent.
import type {DesignBinding, Value, ValueChange} from '../../frame/devices/designed'
import {pressPane, type PaneChromeReading} from '../../projections/atlas/paneChrome'
import {notePlaceTool} from '../../projections/atlas/places/placeTool'
import {LENS_DESIGN, disabled, handsFor, missing, refusal} from './designDevices'
import {registryKeys, type LensRegistry} from './lensRegistry'

export const LENS_ID = LENS_DESIGN

/** The reading on the chain: QL reads a target its caller supplies. The Wiki owner projects a declared constellation as one (`aikit wiki-shape
 * target`) and the Canvas's Form page sends it (formBinding.ts); the Lens on a reading's chain is not given that target. */
const NO_TARGET = 'No reading through the lens: QL reads the target its caller supplies (`ql techne reading <target.json>`, routed as ql_read techne-reading). '
  + 'The Wiki owner stands as QL\'s WikiSubjectSource for a declared constellation (`aikit wiki-shape target`, aikit_read wiki-shape-target) and the Canvas\'s Form page reads it, '
  + 'but the reading on this chain is not given one: its lens and sublens are not sent with a target here.'
/** The frame reading: QL reads a sixfold mapping its caller names, and no owner here names one. */
const NO_MAPPING = 'No frame reading: QL reads the frame of a sixfold mapping its caller names (`ql context-frame read -`, QL-MEF pull 344, routed as ql_read context-frame-read: '
  + 'six external position refs, their source, and the probe), and nothing in the shell names the material\'s six positions.'
/** The mode: what a missing provider does to a refraction that runs; none runs here. */
const NO_MODE = 'QL refracts a request in the provider mode it names (`ql wiki refract -`, QL-MEF pull 350; `ql techne reading` pins required), but no refraction runs here: '
  + 'the request needs a target nothing in the shell supplies, and the kernel routes no `ql wiki refract`.'
/** The operation: QL performs one. */
const NO_OPERATION = 'QL performs one operation, a refraction (`ql techne reading`, `ql wiki refract`). No QL command performs a locate, relate or synthesise: `ql service negotiate` only reports whether the provider supports one.'
/** The Lens's refused controls (techne__lens.tsx: lens.mode, lens.operation, frame.position, frame.face, frame.grain). */
export const LENS_REFUSE: Readonly<Record<string, string>> = {'lens.mode': NO_MODE, 'lens.operation': NO_OPERATION,
  'frame.position': NO_MAPPING, 'frame.face': NO_MAPPING, 'frame.grain': NO_MAPPING}
/** The view's own holds: the lens and sublens of the refraction request (a lens code of QL's registry; '' or '0'..'5'). */
export const LENS_LOCAL = ['lens.lens', 'lens.sublens'] as const

/** The Lens's readings (QL's registry, the reading, the frame's answer). */
const LENS_READING = ['reading.subject', 'reading.members', 'reading.lens', 'reading.frame', 'reading.class', 'reading.evidence', 'reading.provider', 'reading.summary',
  'reading.instruments', 'reading.degraded'] as const
const LENS_FRAME = ['frame.mapping', 'frame.status', 'frame.frames', 'frame.missing'] as const
const NO_PROPOSALS = missing('The proposals', 'candidates from QL\'s WikiFrame refraction — its engine leaves relation_candidates and traversal_candidates empty (crates/ql-wiki/src/refraction.rs:787-788), and `ql techne reading` carries none', 'Quaternal Logic')
/** Why each of the Lens's readings is absent where it is. */
export const LENS_ABSENT: Readonly<Record<string, string>> = {...Object.fromEntries(LENS_READING.map(key => [key, NO_TARGET])),
  ...Object.fromEntries(LENS_FRAME.map(key => [key, NO_MAPPING])), proposals: NO_PROPOSALS,
  lenses: 'Not read yet: QL\'s lens registry (`ql mef lenses`) is drawn once QL answers it.', frames: 'Not read yet: QL\'s frames (`ql context-frame list`) are drawn once QL answers them.',
  service: 'Not read yet: QL\'s provider operations (`ql service capabilities`) are drawn once QL answers them.'}
export const lensAbsent = (key: string): string => LENS_ABSENT[key] ?? LENS_REFUSE[key] ?? NO_TARGET

/** An effect no route reaches: no reading, every control refused with the operation it waits for, every reading saying why it has none. */
function unreached(id: string, refuse: Readonly<Record<string, string>>, readings: readonly string[], why: string): DesignBinding {
  return {
    id,
    values: {},
    standing: {...disabled(refuse), ...disabled(Object.fromEntries(readings.map(key => [key, why])))},
    writes: key => key in refuse,
    write: async (changes: readonly ValueChange[]) => { for (const {key} of changes) throw refusal(refuse, key) },
  }
}

/** The Lens on Quaternal Logic: the registry's lists where QL has answered them, the lens and sublens the view holds, every other key
 * absent with what it waits for, the mode, operation and probe refused naming what QL or the shell lacks. */
export const lensBinding = (registry?: LensRegistry, held: Readonly<Record<string, Value>> = {}, pane?: PaneChromeReading): DesignBinding => {
  const binding = unreached(LENS_ID, LENS_REFUSE, [], NO_TARGET)
  const lists = registry ? registryKeys(registry) : {values: {}, standing: {}}
  const hands = Object.fromEntries(LENS_LOCAL.flatMap(key => (held[key] === undefined ? [] : [[key, held[key]!]])))
  // the atlas lens's own title and controls, as the Earth pane drew them before it stood them down
  const own: Record<string, Value> = pane && pane.controls.length ? {'pane.controls': JSON.stringify(pane.controls), ...(pane.title ? {'pane.title': pane.title} : {})} : {}
  return {...binding, values: {...lists.values, ...hands, ...own}, standing: {...binding.standing, ...disabled(LENS_ABSENT), ...lists.standing},
    local: {...handsFor(LENS_ID, LENS_LOCAL), 'pane.press': value => { if (value !== undefined) pressPane(value, notePlaceTool) }}}
}
