// Light and the Lens (§17.11, techne:lens). The Lens is an effect on a reading's chain: it stands where the manual puts it and draws its design
// on what its owner answers here, every other key absent, every control disabled naming the operation it waits for. Light was retired as a
// device of its own in the 22 Oct manual rewrite: it is the Canvas's Light page (§17.4 "The Light page", which took in §17.10's device), so
// its binding is carried by the Canvas's (canvasCarryingLight). Nothing is a design's sample.
//   - Light's engine is Technē's light trace (lightTrace.ts traceRays, O-I ticket 684): the design's bench law, its display law, over the Canvas
//     positions the research frame reports (canvasValues: the cards and the lines between them). The bench's settings are the person's own,
//     held by the view (no owner keeps a bench), at the design's starting values until held; the sensors' power is the engine's reading.
//     LightBox's own raytracer (EpiLogos/LightBox src/optics/raytracer.ts: geometric optics over placed optical surfaces) is not the
//     candidate's, and the board carries cards and lines, not surfaces. The frame announces no line's standing (frameBindings.ts
//     NO_STANDING), and a line with none passes no light, so on today's board the light stays on its source card and says why.
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
import {LENS_DESIGN, LIGHT_DESIGN, disabled, handsFor, missing, refusal} from './designDevices'
import {boardOf, traceRays, type StandingWord} from './lightTrace'
import {registryKeys, type LensRegistry} from './lensRegistry'

export const LIGHT_ID = LIGHT_DESIGN
export const LENS_ID = LENS_DESIGN

/** Light's controls (the Canvas's Light page, techne__canvas.tsx: light.on, light.source, light.card, light.elements, light.bounces, light.segments,
 * light.spectrum, light.rays, and the four transmissions): the bench's settings, the person's own, held by the view. */
export const LIGHT_LOCAL: readonly string[] = ['light.on', 'light.source', 'light.card', 'light.elements', 'light.bounces', 'light.segments',
  'light.spectrum', 'light.rays', 'tx.fact', 'tx.claim', 'tx.inference', 'tx.guess']
/** The bench's starting values (techne__canvas.tsx header: Bounces 35, Segments 4500, Spectrum 9, the transmissions 100, 85, 60 and 35 %),
 * the light off and no element placed until you set them. */
export const LIGHT_STARTS: Readonly<Record<string, Value>> = {'light.on': false, 'light.elements': '[]', 'light.bounces': 35, 'light.segments': 4500,
  'light.spectrum': 9, 'light.rays': true, 'tx.fact': 100, 'tx.claim': 85, 'tx.inference': 60, 'tx.guess': 35}
export const LIGHT_NO_BOARD = 'No board: the research frame has not reported the Canvas board, so the light has nothing to cross. Open the Canvas in the Expressions pane.'
const LIGHT_OFF = 'Turn the light on, and choose the card it leaves: the sensors read only while it shines.'
const LIGHT_NO_SOURCE = 'Choose the card the light leaves: the source is none of the board\'s cards.'
const LIGHT_NO_STANDING = 'The light stays on its source: the board\'s lines carry no standing (the research frame announces none), and Transmission passes light by a line\'s standing.'
const LIGHT_READ = 'A reading: Technē\'s light trace (lightTrace.ts traceRays) over the board\'s positions, by the bench\'s law.'

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

/** Light's binding: the bench's settings in the view's hands (held, else the starting values), and the sensors' power from Technē's light
 * trace over the board the Canvas reads (its `items` and `lines` values). The Canvas's items and lines stay the Canvas's own readings. */
export function lightBinding(board: Readonly<Record<string, Value>> = {}, held: Readonly<Record<string, Value>> = {}): DesignBinding {
  const settings: Record<string, Value> = {...LIGHT_STARTS}
  for (const key of LIGHT_LOCAL) if (held[key] !== undefined) settings[key] = held[key]!
  const bench = boardOf(board)
  const values: Record<string, Value> = {...settings}
  const standing: Record<string, {disabled: string}> = {}
  const on = settings['light.on'] === true, source = typeof settings['light.source'] === 'string' ? settings['light.source'] as string : undefined
  if (!bench.cards.length) standing['sensor.power'] = {disabled: LIGHT_NO_BOARD}
  else if (!on || source === undefined) standing['sensor.power'] = {disabled: LIGHT_OFF}
  else if (!bench.cards.some(card => card.id === source)) standing['sensor.power'] = {disabled: LIGHT_NO_SOURCE}
  else {
    let elements: {at: string; kind: string}[] = []
    try { const raw = JSON.parse(String(settings['light.elements'])); if (Array.isArray(raw)) elements = raw.filter(e => e && typeof e.at === 'string' && typeof e.kind === 'string') } catch { elements = [] }
    const num = (key: string) => (typeof settings[key] === 'number' ? settings[key] as number : undefined)
    const tx = Object.fromEntries((['fact', 'claim', 'inference', 'guess'] as StandingWord[]).map(word => [word, num(`tx.${word}`)])) as Record<StandingWord, number | undefined>
    const trace = traceRays(bench, {on, source, elements, bounces: num('light.bounces') ?? 35, tx})
    values['sensor.power'] = JSON.stringify(trace.sensors)
    standing['sensor.power'] = {disabled: bench.lines.some(line => line.standing !== undefined) ? LIGHT_READ : LIGHT_NO_STANDING}
  }
  return {id: LIGHT_ID, values, standing, local: handsFor(LIGHT_ID, LIGHT_LOCAL), writes: () => false}
}

/** The Light page's keys on the Canvas (techne__canvas.tsx: `light.*`, `tx.*` and the sensors' `sensor.power`): Light's controls and its one
 * reading of its own. The Canvas's items and lines are the Canvas's own readings, never Light's. */
export const LIGHT_PAGE_KEYS: readonly string[] = [...LIGHT_LOCAL, 'sensor.power']

/** The Canvas carrying its Light page (§17.4): the Canvas's own binding, with Light's keys (LIGHT_PAGE_KEYS) read, refused and written on
 * Light's binding — a value is its owner's, a change goes to the owner of its key, a refusal is that owner's. Pure. */
export function canvasCarryingLight(canvas: DesignBinding, light: DesignBinding): DesignBinding {
  const carried = (key: string) => LIGHT_PAGE_KEYS.includes(key)
  const values = {...canvas.values}
  const standing = {...(canvas.standing ?? {})}
  for (const key of LIGHT_PAGE_KEYS) {
    if (key in light.values) values[key] = light.values[key]!
    else delete values[key]
    const said = light.standing?.[key]
    if (said) standing[key] = said
    else delete standing[key]
  }
  // The bench's hands are Light's: a change of its settings is held by the view, never sent to the Canvas's owner.
  const local = {...(canvas.local ?? {}), ...Object.fromEntries(Object.entries(light.local ?? {}).filter(([key]) => carried(key)))}
  return {...canvas, values, standing, ...(Object.keys(local).length ? {local} : {}),
    writes: key => (carried(key) ? (light.writes ? light.writes(key) : !!light.write) : (canvas.writes ? canvas.writes(key) : !!canvas.write)),
    write: async (changes: readonly ValueChange[]) => {
      const lights = changes.filter(change => carried(change.key)), own = changes.filter(change => !carried(change.key))
      if (lights.length) {
        if (!light.write) throw new Error(`${lights[0]!.key}: the bench's setting is the view's own; nothing is sent to an owner.`)
        await light.write(lights)
      }
      if (own.length) {
        if (!canvas.write) throw new Error(`${own[0]!.key}: a reading — the frame reports it, and nothing here changes it.`)
        await canvas.write(own)
      }
    }}
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
