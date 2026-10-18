/** The Live semantics gate — every device face occupies one Live semantic and
 * keeps its invariant (DEVICE-SEMANTICS-LOCK.md §1 the ontology, §2 per-mode
 * legality, §5 the gate rules; ticket T-SEMANTICS-GATE, lead's design 13 Oct
 * 2026). The meaning moves per mode; the grammar is fixed (lock §0.2).
 *
 * This is new law, not a port. `isWritePath` is moved here, unchanged, from
 * validate.ts (the write-path grammar that stood at validate.ts:45-55);
 * validate.ts re-exports it.
 *
 * Pure: imports nothing but types from ./modes.ts. The doors (familyManifest.ts,
 * manifest.ts, sdk/define.ts, sdk/validate.ts) import this module; it never
 * imports them back, so there is no cycle. */

import type {DeviceFormat, SdkModeName} from './modes.ts'

// ---------------------------------------------------------------------------
// the closed vocabulary (lock §1; `stop` is Live's Scene row — lock §9.1: in
// the DLW "scene" is an Expression's clip, so the Live row is a stop)

export const LIVE_SEMANTICS = [
  'set', 'session-view', 'arrangement-view', 'track', 'clip', 'stop', 'launch-follow',
  'device-instrument', 'device-audio-fx', 'device-midi-fx', 'rack', 'macro', 'device-chain',
  'browser', 'groove-slot', 'detail-clip', 'detail-device', 'transport-slot', 'return',
  'automation', 'modulation', 'capture', 'link', 'key-map', 'info', 'view-selector', 'pack', 'status',
] as const
export type LiveSemantic = (typeof LIVE_SEMANTICS)[number]

export function isLiveSemantic(candidate: unknown): candidate is LiveSemantic {
  return typeof candidate === 'string' && (LIVE_SEMANTICS as readonly string[]).includes(candidate)
}

// ---------------------------------------------------------------------------
// write paths (moved from validate.ts:45-55, grammar unchanged)

/** The write-path grammar: `kernel:<op>` (the kernel op union), `shell.<setter>`
 * (the shell's own armed setters), or `<tool>:<command>` (a native owner's
 * CLI — `workcell-cli:git commit`). Anything else is not a path an owner
 * stands behind. */
export function isWritePath(candidate: string): boolean {
  if (/^kernel:[a-z][a-z0-9_]*$/.test(candidate)) return true
  if (/^shell\.[a-z][a-zA-Z0-9]*$/.test(candidate)) return true
  return /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?:[ ][\w./-]+)*$/.test(candidate)
}

// ---------------------------------------------------------------------------
// the invariant grammar (lock §5.3)

export interface SemanticMap {
  readonly key: string
  /** A numeric domain [min, max], or the enumerated choices of the owner row. */
  readonly range: readonly [number, number] | readonly string[]
}

export interface SemanticInvariant {
  /** device-instrument: the owner write path that generates. */
  readonly generates?: string
  /** device-instrument: the honest absence — the owner it waits for. */
  readonly generatesAbsent?: string
  /** device-audio-fx / device-midi-fx: the material transformed; the stream is kept. */
  readonly transforms?: string
  /** fx: the write path of a replacing write, when one exists. */
  readonly replaceReceipt?: string
  /** rack: the parallel chains. */
  readonly chains?: readonly string[]
  /** rack: how a chain is selected. */
  readonly chainSelector?: string
  /** macro: the declared rows it maps, each with its range. */
  readonly maps?: readonly SemanticMap[]
  /** clip: the native material it binds. */
  readonly material?: string
  /** clip: the revision it binds at. */
  readonly revision?: string
  /** clip: the states it can be in. */
  readonly states?: readonly string[]
  /** track: the native stream it names (no copied store). */
  readonly stream?: string
  /** stop: the clips it launches together. */
  readonly launches?: readonly string[]
  /** return: the owner write path a proposal routes to. */
  readonly routesTo?: string
}

export const INVARIANT_FIELDS = [
  'generates', 'generatesAbsent', 'transforms', 'replaceReceipt', 'chains', 'chainSelector',
  'maps', 'material', 'revision', 'states', 'stream', 'launches', 'routesTo',
] as const
export type InvariantField = (typeof INVARIANT_FIELDS)[number]

/** Which invariant fields belong to each semantic. A field outside this set
 * does not belong to the semantic and is refused. */
const ALLOWED_INVARIANT_FIELDS: Readonly<Record<LiveSemantic, readonly InvariantField[]>> = {
  'set': [], 'session-view': [], 'arrangement-view': [], 'track': ['stream'], 'clip': ['material', 'revision', 'states'],
  'stop': ['launches'], 'launch-follow': [],
  'device-instrument': ['generates', 'generatesAbsent'],
  'device-audio-fx': ['transforms', 'replaceReceipt'],
  'device-midi-fx': ['transforms', 'replaceReceipt'],
  'rack': ['chains', 'chainSelector'], 'macro': ['maps'], 'device-chain': [],
  'browser': [], 'groove-slot': [], 'detail-clip': [], 'detail-device': [], 'transport-slot': [],
  'return': ['routesTo'], 'automation': [], 'modulation': [], 'capture': [], 'link': [], 'key-map': [],
  'info': [], 'view-selector': [], 'pack': [], 'status': [],
}

// ---------------------------------------------------------------------------
// per-mode legality (lock §2, §5.2; the ticket's lead design, 13 Oct 2026):
// live admits everything; base, factory and expressions admit everything but
// a midi effect; techne admits everything but a midi effect and an audio
// effect — a Technē chain device is an instrument (§5.2); return is legal in
// every mode (§4.3).

const withoutSemantics = (excluded: readonly LiveSemantic[]): readonly LiveSemantic[] =>
  LIVE_SEMANTICS.filter(semantic => !excluded.includes(semantic))

export const LEGAL_SEMANTICS_BY_MODE: Readonly<Record<SdkModeName, readonly LiveSemantic[]>> = {
  live: withoutSemantics([]),
  base: withoutSemantics(['device-midi-fx']),
  factory: withoutSemantics(['device-midi-fx']),
  expressions: withoutSemantics(['device-midi-fx']),
  techne: withoutSemantics(['device-midi-fx', 'device-audio-fx']),
}

/** The mode names the gate recognises (the keys of the legality table). */
export const SEMANTIC_MODE_NAMES = Object.keys(LEGAL_SEMANTICS_BY_MODE) as readonly SdkModeName[]

/** A family's home modes: the modes its faces are checked in when the face
 * declares none (lock §4 / the ticket's FAMILY_HOME_MODES). A family not in
 * this table has no home; its faces are checked for vocabulary and invariants
 * only. */
export const FAMILY_HOME_MODES: Readonly<Record<string, readonly SdkModeName[]>> = {
  actuation: ['factory'],
  'ai-kit': ['factory'],
  'software-factory': ['factory'],
  workcell: ['factory'],
  central: ['base'],
  'quaternal-logic': ['techne'],
  'atlas-earth': ['techne'],
  expressions: ['expressions'],
}

/** The modes a face is checked in: its declared modes, else its family's home
 * modes, else none. */
export function semanticModesFor(face: {readonly modes?: readonly string[]}, family: string): readonly string[] {
  if (face.modes?.length) return face.modes
  return FAMILY_HOME_MODES[family] ?? []
}

// ---------------------------------------------------------------------------
// formats (lock §5.4): a format is compatible with some semantics and modes.
// Checked only where a format is declared — the mode default is not imposed.

interface FormatRule {
  readonly semantics?: readonly LiveSemantic[]
  readonly modes?: readonly SdkModeName[]
}

const FORMAT_RULES: Readonly<Record<DeviceFormat, FormatRule>> = {
  'chain-plate': {},
  'die': {semantics: ['device-instrument']},
  'scene-strip': {},
  'run-viewer': {semantics: ['track', 'arrangement-view'], modes: ['factory']},
  'instrument-face': {semantics: ['device-instrument']},
  'tool-tile': {},
}

// ---------------------------------------------------------------------------
// the Live exemplar pointers (lock §5.5): a semantic with a Live-mode
// exemplar carries the pointer to it, so the DLW reading can be checked
// against the measured original.

export const LIVE_EXEMPLAR_ROOT = 'Work/reverse-engineering/ableton-live-12.0.25/'

const exemplar = (path: string): string => LIVE_EXEMPLAR_ROOT + path

export const LIVE_EXEMPLARS: Readonly<Record<LiveSemantic, string>> = {
  'set': exemplar('session-model.md#2'),
  'session-view': exemplar('ui/UI-EVIDENCE.md'),
  'arrangement-view': exemplar('ui/UI-EVIDENCE.md'),
  'track': exemplar('session-model.md#3'),
  'clip': exemplar('session-model.md#5'),
  'stop': exemplar('session-model.md#2'),
  'launch-follow': exemplar('devices/follow-action.md'),
  'device-instrument': exemplar('devices/operator-voice.md'),
  'device-audio-fx': exemplar('devices/reverb.md'),
  'device-midi-fx': exemplar('devices/arpeggiator-derivation.md'),
  'rack': exemplar('devices/racks-session-model.md'),
  'macro': exemplar('devices/racks-session-model.md'),
  'device-chain': exemplar('devices/racks-session-model.md'),
  'browser': exemplar('ui/UI-EVIDENCE.md'),
  'groove-slot': exemplar('ui/UI-EVIDENCE.md'),
  'detail-clip': exemplar('ui/UI-EVIDENCE.md'),
  'detail-device': exemplar('ui/UI-EVIDENCE.md'),
  'transport-slot': exemplar('lom/LOM-INVENTORY.md'),
  'return': exemplar('session-model.md#3'),
  'automation': exemplar('session-model.md#5'),
  'modulation': exemplar('devices/mod-matrix.md'),
  'capture': exemplar('lom/LOM-INVENTORY.md'),
  'link': exemplar('lom/LOM-INVENTORY.md'),
  'key-map': exemplar('lom/LOM-INVENTORY.md'),
  'info': exemplar('ui/UI-EVIDENCE.md'),
  'view-selector': exemplar('ui/UI-EVIDENCE.md'),
  'pack': exemplar('ui/UI-EVIDENCE.md'),
  'status': exemplar('ui/UI-EVIDENCE.md'),
}

export function liveExemplarFor(semantic: LiveSemantic): string {
  return LIVE_EXEMPLARS[semantic]
}

// ---------------------------------------------------------------------------
// the holders (lock §4.8, §4.9; ticket T-HOLDERS, lead's design 13 Oct 2026).
// Every face names the device that holds it (`heldBy`); the gate checks the
// naming. A holder is a device the instrument frame presents: a Studio section
// (the Expressions device chain, in the mockup's order), the Clip detail, or
// one of the six Technē instruments. Holders are declaration only: no face
// changes behaviour because it is held.

export interface HolderDeclaration {
  readonly id: string
  /** The plain name the holder presents as (lock §9.4: the name, never the M′ address). */
  readonly title: string
  readonly liveSemantic: LiveSemantic
  /** A Technē instrument's M′ address, kept as provenance and never as its name. */
  readonly provenance?: string
  /** The faces this holder holds, as `family/face`. Declared for the Studio
   * sections and the Clip detail; the Expressions faces' `heldBy` derives from
   * it (holdersOfFace). Technē and atlas/QL faces declare their own `heldBy`. */
  readonly holds?: readonly string[]
}

/** The Expressions rack: the Studio's four chains (DLW §20.3 "The chains"; lock §0.3.7 "The Studio is the Expression's rack … the field
 * devices stand in its chains"; R4, the design `expressions:studio`): Material, Motion, Body and Nara. Effects are audio-fx; Body is the
 * physics instrument with its resonator and the torus; Nara is the personal layer over the field. The old eight sections' Tools,
 * Selected, Formation's scene devices and Capture left the Studio: the pointer's tools, the selected symbol's controls and the scene's
 * tools are the scene's Clip view's (DETAIL_CLIP_HOLDER below holds their faces), Capture is the transport's. */
export const STUDIO_SECTIONS: readonly HolderDeclaration[] = [
  {id: 'studio:material', title: 'Material', liveSemantic: 'device-audio-fx', holds: ['expressions/colour', 'expressions/ink', 'expressions/depth', 'expressions/medium']},
  {id: 'studio:motion', title: 'Motion', liveSemantic: 'device-audio-fx', holds: ['expressions/pointer', 'expressions/relational', 'expressions/contacts', 'expressions/morph', 'expressions/focus']},
  {id: 'studio:body', title: 'Body', provenance: 'M1+M2+M3', liveSemantic: 'device-instrument', holds: ['expressions/physics', 'expressions/resonance', 'quaternal-logic/torus', 'quaternal-logic/ql-instrument']},
  {id: 'studio:nara', title: 'Nara', liveSemantic: 'modulation'},
]

/** The Clip detail: the selected scene is the clip, so its Clip detail holds the Expressions scene and its automation (lock §9.1, §9.4),
 * and — since the Studio became the Expression's rack (R4; lock §0.3.7) — what belongs to one scene or one symbol: the selected symbol's
 * Formation, glyph, Force, Sound and Meaning, the scene's Text, Blueprint and Arrange, and its Body & triggers. */
export const DETAIL_CLIP_HOLDER: HolderDeclaration = {
  id: 'detail:clip', title: 'Clip detail', liveSemantic: 'detail-clip', holds: ['expressions/scene', 'expressions/automation',
    'expressions/formation', 'expressions/glyph', 'expressions/force', 'expressions/sound', 'expressions/meaning',
    'expressions/text', 'expressions/blueprint', 'expressions/arrange', 'expressions/body'],
}

/** The six Technē instruments: each an instrument, its plain name kept beside
 * its M′ provenance (lock §2.5, §4.9). */
export const TECHNE_INSTRUMENTS: readonly HolderDeclaration[] = [
  {id: 'techne:m0', title: 'Project', provenance: 'M0′', liveSemantic: 'device-instrument'},
  {id: 'techne:m1', title: 'Canvas', provenance: 'M1′', liveSemantic: 'device-instrument'},
  {id: 'techne:m2', title: 'Timeline', provenance: 'M2′', liveSemantic: 'device-instrument'},
  {id: 'techne:m3', title: 'Journey', provenance: 'M3′', liveSemantic: 'device-instrument'},
  {id: 'techne:m4', title: 'World', provenance: 'M4′', liveSemantic: 'device-instrument'},
  {id: 'techne:m5', title: 'Palace', provenance: 'M5′', liveSemantic: 'device-instrument'},
]

/** The standalone instruments any pane can hold in any mode (owner ruling, 13 Oct 2026; lock §8.1): the knowledge graph —
 * the wiki constellation — is its own instrument, not one of Technē's six. */
export const STANDALONE_INSTRUMENTS: readonly HolderDeclaration[] = [
  {id: 'knowledge-graph', title: 'Knowledge graph', liveSemantic: 'device-instrument'},
]

/** Every known holder: the Studio sections, the Clip detail, the Technē instruments, the standalone instruments. */
export const HOLDERS: readonly HolderDeclaration[] = [...STUDIO_SECTIONS, DETAIL_CLIP_HOLDER, ...TECHNE_INSTRUMENTS, ...STANDALONE_INSTRUMENTS]

export function isHolder(candidate: unknown): boolean {
  return typeof candidate === 'string' && HOLDERS.some(holder => holder.id === candidate)
}

/** The holders a face declares through the Studio table and the Clip detail
 * (`family/face`). An Expressions face's `heldBy` is this list. */
export function holdersOfFace(family: string, face: string): readonly string[] {
  const reference = `${family}/${face}`
  return HOLDERS.filter(holder => holder.holds?.includes(reference)).map(holder => holder.id)
}

/** Families whose every face is held by exactly one holder (lock §4.8: every
 * Expressions face appears in exactly one holder). */
export const EXACTLY_ONE_HOLDER_FAMILIES: readonly string[] = ['expressions']

/** The family-level holder law (lock §4.8, the lead's rule 3): every face of a
 * one-holder family names exactly one holder. Coverage is a property of the
 * whole family's face set, so it is judged where the family's faces are
 * composed (expressionsFamilyManifest), not in the per-face validator: a
 * hand-composed compatibility manifest carries no holders and is not refused
 * for it. Empty = the family is covered. */
export function validateHolderCoverage(family: string, faces: readonly SemanticFace[]): string[] {
  if (!EXACTLY_ONE_HOLDER_FAMILIES.includes(family)) return []
  return faces.flatMap(face => {
    const count = face.heldBy?.length ?? 0
    return count === 1 ? [] : [`${family}/${face.id}: an Expressions face is held by exactly one holder — heldBy names ${count} (lock §4.8); name the Studio section or the Clip detail that holds it`]
  })
}

// ---------------------------------------------------------------------------
// the gate over one face

/** The structural face the gate reads. Both the door's FamilyFaceDeclaration
 * and the kit's DeviceDeclaration satisfy it; the gate never names either. */
export interface SemanticFace {
  readonly id: string
  readonly liveSemantic?: string
  readonly invariant?: SemanticInvariant
  readonly modes?: readonly string[]
  readonly admission?: 'admitted' | 'waiting'
  readonly note?: string
  /** The holder(s) that hold this face (lock §4.8, §4.9; see HOLDERS below). */
  readonly heldBy?: readonly string[]
}

export interface SemanticContext {
  /** The family the face belongs to (faults are prefixed `<family>/<face>`). */
  readonly family: string
  /** The presentation's modes, when a kit-declared face carries them. */
  readonly modes?: readonly string[]
  /** The presentation's per-mode formats, when a kit-declared face carries them. */
  readonly formats?: Readonly<Partial<Record<string, string>>>
}

const list = (items: readonly string[]): string => items.join(' | ')

/** Validate one face's Live semantic: vocabulary, mode legality, invariant,
 * invariant-field membership, and format compatibility. Returns the fault
 * list; each fault names the law and the fix. Empty = the face keeps its
 * semantic. */
export function validateFaceSemantic(face: SemanticFace, context: SemanticContext): string[] {
  const where = `${context.family}/${face.id}`
  const faults: string[] = []
  const claim = (message: string): void => { faults.push(`${where}: ${message}`) }

  const semantic = face.liveSemantic
  if (semantic === undefined || semantic === null || semantic === '') {
    claim(`no liveSemantic — every face occupies the Live semantic it is, from the closed vocabulary (${list(LIVE_SEMANTICS)}); DEVICE-SEMANTICS-LOCK §5.1`)
    return faults
  }
  if (!isLiveSemantic(semantic)) {
    claim(`liveSemantic "${semantic}" is not in the closed vocabulary (${list(LIVE_SEMANTICS)}) — name the Live semantic it occupies (lock §1); a new semantic is a reviewed change to LIVE_SEMANTICS, never an inline string`)
    return faults
  }

  // Modes: the declared ones are checked for name and legality; the checked
  // set falls back to the family's home modes (lock §5.2).
  for (const mode of face.modes ?? []) {
    if (!(SEMANTIC_MODE_NAMES as readonly string[]).includes(mode)) {
      claim(`mode "${mode}" is not one of the shell's modes (${list(SEMANTIC_MODE_NAMES)})`)
    }
  }
  const checkedModes = context.modes?.length ? context.modes : semanticModesFor(face, context.family)
  for (const mode of checkedModes) {
    if (!(SEMANTIC_MODE_NAMES as readonly string[]).includes(mode)) continue
    if (!LEGAL_SEMANTICS_BY_MODE[mode as SdkModeName].includes(semantic)) {
      claim(`liveSemantic "${semantic}" is illegal in mode "${mode}" — that mode admits ${list(LEGAL_SEMANTICS_BY_MODE[mode as SdkModeName])} (lock §2, §5.2); present the face as the semantic its mode gives it, or declare it in a mode that admits it`)
    }
  }

  // Formats, where declared (lock §5.4).
  for (const [mode, format] of Object.entries(context.formats ?? {})) {
    if (format === undefined) continue
    if (!(SEMANTIC_MODE_NAMES as readonly string[]).includes(mode)) {
      claim(`format key "${mode}" is not one of the shell's modes (${list(SEMANTIC_MODE_NAMES)})`)
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(FORMAT_RULES, format)) {
      claim(`format "${format}" is not in the device ontology (${list(Object.keys(FORMAT_RULES))})`)
      continue
    }
    const rule = FORMAT_RULES[format as DeviceFormat]
    if (rule.semantics && !rule.semantics.includes(semantic)) {
      claim(`format "${format}" (mode "${mode}") is incompatible with liveSemantic "${semantic}" — "${format}" presents ${list(rule.semantics)} only (lock §5.4)`)
    }
    if (rule.modes && !rule.modes.includes(mode as SdkModeName)) {
      claim(`format "${format}" belongs to ${list(rule.modes)} only, not mode "${mode}" (lock §5.4)`)
    }
  }

  // Invariant fields must belong to the semantic (lock §5.3).
  const invariant: SemanticInvariant = face.invariant ?? {}
  const allowed = ALLOWED_INVARIANT_FIELDS[semantic]
  for (const field of Object.keys(invariant)) {
    if (invariant[field as keyof SemanticInvariant] === undefined) continue
    if (!(INVARIANT_FIELDS as readonly string[]).includes(field)) {
      claim(`invariant field "${field}" is not in the invariant grammar (${list(INVARIANT_FIELDS)})`)
    } else if (!allowed.includes(field as InvariantField)) {
      claim(`invariant field "${field}" does not belong to liveSemantic "${semantic}" — it carries ${allowed.length ? list(allowed) : 'no invariant'} (lock §5.3)`)
    }
  }

  const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  const nonEmptyList = (value: unknown): value is readonly string[] =>
    Array.isArray(value) && value.length > 0 && value.every(nonEmptyString)

  switch (semantic) {
    case 'device-instrument': {
      const {generates, generatesAbsent} = invariant
      if (generates !== undefined && !isWritePath(generates)) {
        claim(`generates "${generates}" is not an owner write path (kernel:<op> | shell.<setter> | <tool>:<command>) — an instrument generates through an owner, named by its path (lock §5.3)`)
      }
      if (generatesAbsent !== undefined && !nonEmptyString(generatesAbsent)) {
        claim('generatesAbsent is empty — an honest absence names the owner it waits for (lock §5.3)')
      }
      if (generates !== undefined && generatesAbsent !== undefined) {
        claim('generates and generatesAbsent are exclusive — a generating instrument names its owner, an absent one names what it waits for')
      }
      // Waiting faces are exempt from the generates requirement: a waiting
      // face names the owner it waits for in its note and carries no body.
      if (face.admission !== 'waiting' && generates === undefined && !nonEmptyString(generatesAbsent)) {
        claim('an instrument generates: name its owner write path (generates) or the honest absence it waits for (generatesAbsent) — lock §5.3')
      }
      break
    }
    case 'device-audio-fx':
    case 'device-midi-fx': {
      if (!nonEmptyString(invariant.transforms)) {
        claim(`an effect names the material it transforms and keeps the stream (transforms, non-empty) — lock §5.3`)
      }
      if (invariant.replaceReceipt !== undefined && !isWritePath(invariant.replaceReceipt)) {
        claim(`replaceReceipt "${invariant.replaceReceipt}" is not an owner write path — a replacing write names the receipt it leaves (lock §5.3)`)
      }
      break
    }
    case 'rack': {
      if (!nonEmptyList(invariant.chains)) claim('a rack declares its parallel chains (chains, at least one non-empty name) — lock §5.3')
      if (!nonEmptyString(invariant.chainSelector)) claim('a rack declares its chain selector (chainSelector) — lock §5.3')
      break
    }
    case 'macro': {
      const maps = invariant.maps
      if (!Array.isArray(maps) || maps.length === 0) {
        claim('a macro maps at least one declared row of its own device (maps, at least one) — lock §5.3')
        break
      }
      for (const map of maps) {
        if (!nonEmptyString(map.key)) claim('a macro map names the row it moves (maps[].key)')
        const range = map.range as unknown
        const numeric = Array.isArray(range) && range.length === 2 && range.every(value => typeof value === 'number')
        const enumerated = Array.isArray(range) && range.length > 0 && range.every(value => typeof value === 'string')
        if (numeric) {
          const [min, max] = range as unknown as readonly [number, number]
          if (!(min < max)) claim(`macro map "${map.key}" range [${min}, ${max}] is not an ordered domain — min < max`)
        } else if (!enumerated) {
          claim(`macro map "${map.key}" carries no range — a range is [min, max] or the enumerated choices (lock §5.3)`)
        }
      }
      break
    }
    case 'clip': {
      if (!nonEmptyString(invariant.material)) claim('a clip binds native material by ref (material) — lock §5.3')
      if (!nonEmptyString(invariant.revision)) claim('a clip binds its material at a revision (revision) — lock §5.3')
      if (!nonEmptyList(invariant.states)) claim('a clip names its states (states, at least one) — lock §5.3')
      break
    }
    case 'track': {
      if (!nonEmptyString(invariant.stream)) claim('a track names its native stream (stream) — no copied store, lock §5.3')
      break
    }
    case 'stop': {
      if (!nonEmptyList(invariant.launches)) claim('a stop names the clips it launches together (launches, at least one) — lock §5.3')
      break
    }
    case 'return': {
      if (!invariant.routesTo || !isWritePath(invariant.routesTo)) {
        claim(`a return routes to an owner write path (routesTo: kernel:<op> | shell.<setter> | <tool>:<command>) — a proposal reaches its owner, never a mixer (lock §4.3, §5.3)`)
      }
      break
    }
    default:
      break
  }

  // Holders (lock §4.8, §4.9; the lead's four gate rules, ticket T-HOLDERS).
  const held = face.heldBy ?? []
  for (const holder of held) {
    if (!isHolder(holder)) {
      claim(`heldBy "${holder}" is not a known holder — name a Studio section, the Clip detail or a Technē instrument (${list(HOLDERS.map(known => known.id))}) (lock §4.8, §4.9)`)
    }
  }
  if (face.admission !== 'waiting' && checkedModes.includes('techne') && !held.some(holder => holder.startsWith('techne:'))) {
    claim('an admitted Technē face is held by a techne:* instrument — name the instrument in heldBy (lock §4.9); a waiting face is exempt until its owner lands')
  }
  if ((semantic === 'device-audio-fx' || semantic === 'device-midi-fx') && held.some(holder => holder.startsWith('techne:'))) {
    claim('an effect cannot be held by a techne:* instrument — a Technē chain device is an instrument, never an effect (lock §5.2)')
  }

  return faults
}
