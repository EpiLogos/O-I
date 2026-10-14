/** The one declared inhabitant manifest (WORLD-SHELL-DESIGN §5.5, §12–§16).
 *
 * [L2 seam 4] This module GENERALISES the existing grammar; it is not a
 * second registry. `familyManifest.ts` stays the only admission store (the
 * neutral door); what lands here is the door's typed generalisation:
 *
 * - `FamilyManifest` — what the five agent-shell families already admit — is
 *   structurally a member of `InhabitantManifest`: every field added here is
 *   optional, so existing manifests load through this schema unchanged (the
 *   compatibility proof lives in tests/inhabitant-manifest.test.mjs).
 * - §5.5's declared bundle becomes expressible: document kinds and
 *   conversation bindings as FACE KINDS WITH BODIES (§5.2, §5.3), the
 *   panel-slot and detached-kind doors beside browser categories, and the
 *   admitted/waiting honesty standing (§16 — four places and nowhere else).
 * - `declareFamilyExtension` composes declared, additive extensions onto an
 *   admitted family WITHOUT touching its owner's declaration: the door's map
 *   is never rewritten, the composed view is derived on read, and the same
 *   immutability discipline applies (a re-declared extension with different
 *   contents refuses).
 *
 * Pure: no view, no store of its own, no I/O, no React. The bodies a face
 * declares live in their own modules (documentDeviceModel.ts and the face
 * components); this module only says what is admitted, and what waits. */

import type {FamilyFaceDeclaration, FamilyManifest, FamilyManifestId} from './familyManifest.ts'
import {allFamilyManifests, familyManifest, onFamilyManifestReset} from './familyManifest.ts'
import {validateFaceSemantic} from './sdk/semantics.ts'

// ---------------------------------------------------------------------------
// face kinds — the rack's residents (WORLD-SHELL-DESIGN §5.1–§5.4)

export type InhabitantFaceKind = 'parameter' | 'document' | 'conversation' | 'instrument'

export const INHABITANT_FACE_KINDS = ['parameter', 'document', 'conversation', 'instrument'] as const

/** The default kind of every face the earlier manifests declared. */
export const DEFAULT_FACE_KIND: InhabitantFaceKind = 'parameter'

/** Face kind of one declaration, with the default filled in. */
export function faceKind(face: InhabitantFaceDeclaration): InhabitantFaceKind {
  return face.kind ?? DEFAULT_FACE_KIND
}

// ---------------------------------------------------------------------------
// standalone bodies (seam 8) — which faces a window of their own can draw

/** The faces whose body draws in a window of their own, from the identity alone (the device door's standalone set), each
 * with the kind its body belongs to. Central's document and conversation faces read their owners through the transport
 * from the identity's aperture; ql-instrument draws the owner's reading or its refusal. Every other face stays in the main
 * window: a parameter face has no body in the rack, and the atlas and knowledge-graph bodies drive the main window's mounted
 * globe or graph handle, which a separate webview cannot reach, so a window for them would be inert. */
const STANDALONE_DEVICE_FACES: ReadonlyMap<string, InhabitantFaceKind> = new Map([
  ['day-die', 'document'],
  ['flow-document', 'document'],
  ['nara-conversation', 'conversation'],
  ['ql-instrument', 'instrument'],
])

/** Whether a face of this id and kind draws its body in a window of its own. */
export function standsAlone(id: string, kind: InhabitantFaceKind): boolean {
  return STANDALONE_DEVICE_FACES.get(id) === kind
}

/** Whether a declared face draws its body in a window of its own (pop-out is offered only where this holds). */
export function faceStandsAlone(face: InhabitantFaceDeclaration): boolean {
  return standsAlone(face.id, faceKind(face))
}

// ---------------------------------------------------------------------------
// document devices (§5.2) — the save router's named outcomes

/** The five named outcomes a document device's save router discloses. Order
 * is part of the contract: a body declaration carries them in this order. */
export const SAVE_ROUTER_OUTCOMES = ['saved', 'unchanged', 'stale', 'conflict', 'refused'] as const
export type SaveRouterOutcome = (typeof SAVE_ROUTER_OUTCOMES)[number]

/** The body of a document face: a retained HTML form hosted over the
 * EXISTING path — sandboxed opaque-origin iframe, payload island
 * (`#ql-doc`), bounded postMessage, and the save router's named outcomes on
 * the rack strip. The hosting schema names that path; nothing here builds a
 * second one. */
export interface DocumentBodyDeclaration {
  /** The document kind id (the family's own name for the form). */
  readonly kind: string
  /** The retained page file under `desktop/cradle/documents/`. */
  readonly file: string
  /** The existing hosting contract: iframe + payload island + bounded
   * postMessage + save router. The only hosting value admitted. */
  readonly hosting: 'oi.document-frame/v1'
  /** The named outcomes the strip discloses, exactly `SAVE_ROUTER_OUTCOMES`. */
  readonly saveRouter: readonly SaveRouterOutcome[]
  /** The host↔frame message channels the body speaks. */
  readonly messages: readonly string[]
}

// ---------------------------------------------------------------------------
// conversation devices (§5.3) — the Nara binding

/** The body of a conversation face: a Nara/agency encounter bound over the
 * kernel's dialogue binding. Canonical CAS stays in AIKit; the face reads
 * the binding and opens the existing encounter surface — it never builds a
 * second conversation store. */
export interface ConversationBodyDeclaration {
  readonly binding: 'oi.nara-dialogue-binding/v1'
}

// ---------------------------------------------------------------------------
// faces — the generalised declaration

/** Dock/expand/pop-out lifecycle of a rack device (the design's document
 * lifecycle; pop-out rides the pane engine's existing detach). */
export type FaceDockLifecycle = 'dock' | 'expand' | 'pop-out'

export interface InhabitantFaceDeclaration extends FamilyFaceDeclaration {
  /** Absent = `parameter` (every face the five agent-shell manifests
   * declared is a parameter aperture over its owner). */
  readonly kind?: InhabitantFaceKind
  /** Required when kind is `document`; refused on any other kind. */
  readonly document?: DocumentBodyDeclaration
  /** Required when kind is `conversation`; refused on any other kind. */
  readonly conversation?: ConversationBodyDeclaration
  /** The lifecycle the face's strip offers. Absent = `['dock']`. */
  readonly dock?: readonly FaceDockLifecycle[]
  /** `admitted` (absent default): the native owner exists today and the face
   * reads it. `waiting`: declared, owner not landed — the face renders an
   * honest waiting state, carries no body, and its note names the owner it
   * waits for. */
  readonly admission?: 'admitted' | 'waiting'
}

// ---------------------------------------------------------------------------
// the other §5.5 doors, declared beside the browser categories

/** A panel-slot entry through `shell/panels.ts` — the registry that already
 * exists; the manifest declares, the registry renders. */
export interface InhabitantPanelSlot {
  /** The existing PanelSlot names (shell/panels.ts). */
  readonly slot: 'center' | 'right-dock' | 'bottom' | 'browser-section'
  /** The registered panel id (namespaced, e.g. "native.context"). */
  readonly panel: string
}

/** The detached-window kinds (desktop/cradle DetachedFrame / surface
 * bindings) a family's faces pop out through — the doors that already
 * exist, never a new windowing mechanism. */
export const DETACHED_KINDS = [
  'source', 'knowledge', 'file', 'encounter', 'browser', 'terminal',
  'flow', 'object', 'draft', 'system', 'explore', 'presentation',
  // A device face's own pop-out (seam 8): the family declares `device` beside its faces' pop-out lifecycle, and the
  // identity travels with the binding (native/detachedKinds.ts DeviceDetachIdentity). Native admission lands with the
  // receiving frame's device body; until then no native owner admits it.
  'device',
] as const
export type DetachedKind = (typeof DETACHED_KINDS)[number]

/** §5.5's one declared inhabitant manifest: what `FamilyManifest` admits,
 * extended with the §12 bundle's remaining doors and the generalised faces. */
export interface InhabitantManifest extends FamilyManifest {
  readonly faces: readonly InhabitantFaceDeclaration[]
  /** Panel-slot entries the family declares (absent = none). */
  readonly panelSlots?: readonly InhabitantPanelSlot[]
  /** Detached-window kinds the family's faces pop out through. */
  readonly detachedKinds?: readonly DetachedKind[]
  /** Suite capability refs this family homes (absent = none). A home is a
   * declaration, never a face: it says which family the capability lives in
   * (DEVICE-SEMANTICS-LOCK §4.2); the device that carries it is named in the
   * declaring extension's note. */
  readonly capabilities?: readonly string[]
}

/** A suite capability ref as the capability matrix spells it: `cap.<product>.<slug>`. */
export const CAPABILITY_REF_PATTERN = /^cap\.[a-z0-9-]+\.[a-z0-9-]+$/

// ---------------------------------------------------------------------------
// declared extensions — compose onto an admitted family, never rewrite it

/** An additive declaration onto an already-admitted family. The family's
 * owner-authored base manifest stays verbatim at the door; the extension is
 * declared by its own author (lane or owner) and composes on read. */
export interface FamilyExtension {
  /** Extension-scoped id, namespaced by family: `central:world-shell`. */
  readonly id: string
  /** The declaring author (owner or lane) — attribution is part of the record. */
  readonly by: string
  readonly faces?: readonly InhabitantFaceDeclaration[]
  readonly panelSlots?: readonly InhabitantPanelSlot[]
  readonly detachedKinds?: readonly DetachedKind[]
  /** Capability refs this extension homes in the family (see InhabitantManifest). */
  readonly capabilities?: readonly string[]
  readonly note?: string
}

interface ComposedFamily {
  readonly base: FamilyManifest
  readonly extensions: FamilyExtension[]
}

/** Extension ledger, keyed by family id. Read-only composition source — the
 * door's admission map is never written by this module. The door's reset
 * clears this ledger too (a reset that left extensions standing would
 * compose them onto re-admitted bases — the [L9 gap fix]). */
const extensions = new Map<FamilyManifestId, ComposedFamily>()
onFamilyManifestReset(() => extensions.clear())

const sameContents = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/** Declare one additive extension for an admitted family. Refuses an
 * unadmitted family (owner authority: the base declares first — the shell's
 * door is neutral, the keys are held by owners), a re-declaration with
 * different contents, and face-id collisions inside the family. */
export function declareFamilyExtension(familyId: FamilyManifestId, extension: FamilyExtension): FamilyExtension {
  const base = familyManifest(familyId)
  if (!base) {
    throw new Error(`Family "${familyId}" is not admitted; extensions compose onto an owner-admitted base, never ahead of it.`)
  }
  const composed = extensions.get(familyId) ?? {base, extensions: []}
  const prior = composed.extensions.find(candidate => candidate.id === extension.id)
  if (prior) {
    if (!sameContents(prior, extension)) {
      throw new Error(`Extension "${extension.id}" is already declared for family "${familyId}" with different contents.`)
    }
    return prior
  }
  // The Live semantic law over the extension's own faces, before composing
  // (lock §5): a face that would not keep its semantic never composes.
  const semanticFaults = (extension.faces ?? []).flatMap(face => validateFaceSemantic(face, {family: familyId}))
  if (semanticFaults.length) {
    throw new Error(`Extension "${extension.id}" for family "${familyId}" refuses — the Live semantic law (DEVICE-SEMANTICS-LOCK §5):\n- ${semanticFaults.join('\n- ')}`)
  }
  const claimed = new Set(base.faces.map(face => face.id))
  for (const declared of composed.extensions) {
    for (const face of declared.faces ?? []) claimed.add(face.id)
  }
  for (const face of extension.faces ?? []) {
    if (claimed.has(face.id)) {
      throw new Error(`Extension "${extension.id}" face "${face.id}" collides with a face already declared for family "${familyId}".`)
    }
  }
  composed.extensions.push(extension)
  extensions.set(familyId, composed)
  return extension
}

/** Whether the family carries declared extensions (test/diagnostic reader). */
export function familyExtensions(familyId: FamilyManifestId): readonly FamilyExtension[] {
  return extensions.get(familyId)?.extensions ?? []
}

/** The composed inhabitant manifest of one family: the owner's base, then
 * its declared extensions in declaration order. Undefined when the family
 * is not admitted at the door. The base manifest itself is never mutated. */
export function inhabitantManifest(familyId: FamilyManifestId): InhabitantManifest | undefined {
  const base = familyManifest(familyId)
  if (!base) return undefined
  const composed = extensions.get(familyId)
  if (!composed || !composed.extensions.length) return base as InhabitantManifest
  const faces = [...base.faces, ...composed.extensions.flatMap(extension => extension.faces ?? [])]
  const panelSlots = [
    ...(base as InhabitantManifest).panelSlots ?? [],
    ...composed.extensions.flatMap(extension => extension.panelSlots ?? []),
  ]
  // Deduplicated: a base and an extension may each declare the device kind (the family declares it once, honestly).
  const detachedKinds = [...new Set([
    ...(base as InhabitantManifest).detachedKinds ?? [],
    ...composed.extensions.flatMap(extension => extension.detachedKinds ?? []),
  ])] as DetachedKind[]
  const capabilities = [
    ...(base as InhabitantManifest).capabilities ?? [],
    ...composed.extensions.flatMap(extension => extension.capabilities ?? []),
  ]
  return {
    ...base,
    faces,
    ...(panelSlots.length ? {panelSlots} : {}),
    ...(detachedKinds.length ? {detachedKinds} : {}),
    ...(capabilities.length ? {capabilities} : {}),
  }
}

/** Every admitted family's composed manifest, door order (id-sorted). */
export function allInhabitantManifests(): InhabitantManifest[] {
  return allFamilyManifests()
    .map(manifest => inhabitantManifest(manifest.id))
    .filter((manifest): manifest is InhabitantManifest => manifest !== undefined)
}

// ---------------------------------------------------------------------------
// validation — the honesty law made checkable

const sameArray = <T,>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((entry, index) => entry === b[index])

/** Validate one composed manifest against the §12/§16 law. Returns the fault
 * list; empty means valid. The checks are the ones a declaration can carry
 * honestly or not — the owner reads, the waiting notes, the bodies. */
export function validateInhabitantManifest(manifest: InhabitantManifest): readonly string[] {
  const faults: string[] = []
  const claim = (faceId: string, message: string): void => { faults.push(`${manifest.id}/${faceId}: ${message}`) }

  for (const face of manifest.faces) {
    const kind = faceKind(face)
    const waiting = face.admission === 'waiting'

    // The Live semantic law: vocabulary, mode legality, invariant (lock §5).
    faults.push(...validateFaceSemantic(face, {family: manifest.id}))

    if (!INHABITANT_FACE_KINDS.includes(kind)) claim(face.id, `unknown face kind "${String(face.kind)}"`)

    // Bodies belong only to their kind.
    if (kind === 'document' && !face.document) claim(face.id, 'a document face declares a body (oi.document-frame/v1)')
    if (kind !== 'document' && face.document) claim(face.id, 'a non-document face carries a document body')
    if (kind === 'conversation' && !face.conversation) claim(face.id, 'a conversation face declares its binding')
    if (kind !== 'conversation' && face.conversation) claim(face.id, 'a non-conversation face carries a conversation binding')

    // Document bodies: the existing hosting path and the whole named router.
    if (face.document) {
      const body = face.document
      if (body.hosting !== 'oi.document-frame/v1') claim(face.id, `unknown hosting "${String(body.hosting)}" — the path is the existing iframe/island/postMessage contract`)
      if (!sameArray(body.saveRouter, SAVE_ROUTER_OUTCOMES)) {
        claim(face.id, `saveRouter must name all five outcomes in order (${SAVE_ROUTER_OUTCOMES.join(' | ')})`)
      }
      if (!body.messages.length) claim(face.id, 'a document body names its host↔frame message channels')
    }

    // Conversation bodies: the one binding schema.
    if (face.conversation && face.conversation.binding !== 'oi.nara-dialogue-binding/v1') {
      claim(face.id, `unknown conversation binding "${String(face.conversation.binding)}"`)
    }

    // Waiting is honest only when it says what it waits for — and carries no body.
    if (waiting) {
      if (!face.note) claim(face.id, "a waiting face names the owner it waits for (note)")
      if (face.document || face.conversation) claim(face.id, 'a waiting face carries no body — declared, waiting, honest')
    }

    // Instruments state whose instrument they are.
    if (kind === 'instrument' && !face.note) claim(face.id, 'an instrument face names its owner in its note')

    // Pop-out rides the pane engine's existing detach door: the family must
    // declare which detached kinds its faces pop out through.
    if ((face.dock ?? ['dock']).includes('pop-out') && !(manifest.detachedKinds ?? []).length) {
      claim(face.id, "a pop-out face requires the family's detachedKinds (the existing detach door)")
    }
  }

  // Panel slots use the existing registry's slots, by name.
  for (const entry of manifest.panelSlots ?? []) {
    if (!['center', 'right-dock', 'bottom', 'browser-section'].includes(entry.slot)) {
      faults.push(`${manifest.id}: panel "${entry.panel}" declares unknown slot "${String(entry.slot)}"`)
    }
  }

  // Detached kinds are the engine's kinds, not the family's invention.
  for (const kind of manifest.detachedKinds ?? []) {
    if (!(DETACHED_KINDS as readonly string[]).includes(kind)) {
      faults.push(`${manifest.id}: detached kind "${String(kind)}" is not one the pane engine admits`)
    }
  }

  // Capability homes: each ref is a matrix ref, and a family homes it once.
  const homed = new Set<string>()
  for (const ref of manifest.capabilities ?? []) {
    if (!CAPABILITY_REF_PATTERN.test(ref)) faults.push(`${manifest.id}: capability "${String(ref)}" is not a cap.<product>.<slug> ref`)
    if (homed.has(ref)) faults.push(`${manifest.id}: capability "${ref}" is homed twice in this family`)
    homed.add(ref)
  }

  // §16 — four surfaces and nowhere else is the schema's shape itself
  // (browser, faces, projections, inspectors + time + telemetry); the one
  // thing left to check is that telemetry is either declared or honestly null.
  if (manifest.telemetry !== null && typeof manifest.telemetry !== 'string') {
    faults.push(`${manifest.id}: telemetry is an observable id or an honest null`)
  }

  return faults
}

/** Validate every composed manifest; returns family → faults. Empty map = all valid. */
export function validateAllInhabitantManifests(): ReadonlyMap<FamilyManifestId, readonly string[]> {
  const faults = new Map<FamilyManifestId, readonly string[]>()
  for (const manifest of allInhabitantManifests()) {
    const found = validateInhabitantManifest(manifest)
    if (found.length) faults.set(manifest.id, found)
  }
  return faults
}
