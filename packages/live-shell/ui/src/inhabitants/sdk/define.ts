/** The device authoring kit — how a family declares itself.
 *
 * The neutral door (`familyManifest.ts`) stays the ONLY admission store and
 * its manifest shape stays verbatim; this module is the typed front for
 * authors (human or agent):
 *
 * - `admitFamily(declaration)` builds the door manifest from a device list,
 *   validates it against the honesty law BEFORE admitting (a declaration
 *   that would fail the gate never reaches the door), admits, and registers
 *   the face presentations (title, mark, owner) and §14 parameter rows in
 *   SDK-side registries that compose with the door's reset.
 * - `declareDeviceExtension(declaration)` composes additive faces onto an
 *   already-admitted family through `declareFamilyExtension`, same
 *   validation-first discipline.
 * - param builders (`numberParam`, `enumParam`, `boolParam`, `stringParam`,
 *   `reading`) produce §14 rows: one owning family per row, `writePath`
 *   ONLY where a real owner write exists, disclosure verbatim where the
 *   source is absent. A row without a writePath IS a reading — that is the
 *   grammar, not a convention.
 *
 * The registries here hold PRESENTATION metadata only (what the face plate
 * and disclosure rows show); the door holds admission; neither invents a
 * second admission path.
 *
 * Pure module: no view, no I/O; registries reset with the door. */

import type {DevicePresentation, FamilyManifest, FamilyManifestId} from '../familyManifest.ts'
import {admitFamilyManifest, allFamilyManifests, familyManifest, onFamilyManifestReset} from '../familyManifest.ts'
import type {
  ConversationBodyDeclaration,
  DetachedKind,
  DocumentBodyDeclaration,
  FaceDockLifecycle,
  InhabitantFaceDeclaration,
  InhabitantFaceKind,
  InhabitantManifest,
} from '../manifest.ts'
import {DEFAULT_FACE_KIND, declareFamilyExtension, familyExtensions, standsAlone, validateInhabitantManifest, type FamilyExtension} from '../manifest.ts'
import type {AgentParamAddress} from '../agentParamAddresses.ts'
import {deriveAgentDeviceRows} from '../agentDeviceCatalogue.ts'
import type {IconName} from './icons.ts'
import type {DeviceFormat, SdkModeName, TransportSlotId} from './modes.ts'
import {MODE_DEFAULT_FORMAT, transportTargetSlots} from './modes.ts'
import type {LiveSemantic, SemanticInvariant} from './semantics.ts'
import {validateFaceSemantic} from './semantics.ts'
import {isKnownProduct} from './products.ts'
import type {NewProductAuthority} from './products.ts'
import {registerWriterAuthority, validateDeclaredFamily, validateFamilyWriters, validateSdkDevice, validateTransportBindings} from './validate.ts'

// ---------------------------------------------------------------------------
// §14 parameter rows (the grammar's types live in validate.ts — the law
// module owns them; this module re-exports for authoring convenience).

export type {SdkParamType} from './validate.ts'
export {SDK_PARAM_TYPES} from './validate.ts'

/** A §14 row authored through the kit: the address plus what its control
 * shows. `deviceInstance` is filled from the declaring device's face id.
 * The row's range is the kit's scalar domain — the address grammar's
 * {min,max} plus the control's unit. */
export type SdkParamRow = Omit<AgentParamAddress, 'range'> & {
  readonly range?: ParamRange
  /** Human label for the control (the plate's row name). */
  readonly title: string
  /** The control's mark from the cut, when the row renders one. */
  readonly icon?: IconName
  /** The telemetry observable that moves this row, when modulated. */
  readonly modulatedBy?: string
  /** The group the row sits in on the device's whole view (FOUNDATION F5: the runtime groups the rows). */
  readonly group?: string
  /** One of the device's most-played controls: the compact size shows up to four, macros first. */
  readonly compact?: boolean
  /** A macro: one knob that turns several rows at once, each within its own range (manual §10.4). */
  readonly macro?: {readonly maps: readonly {readonly key: string; readonly min?: number; readonly max?: number}[]}
}

export interface ParamRange {
  readonly min?: number
  readonly max?: number
  readonly unit?: string
}

interface ParamInputBase {
  readonly key: string
  readonly title: string
  readonly icon?: IconName
  /** The row's unit — carried top-level, matching the verified address
   * table's grammar (scalar controls also read it off the range). */
  readonly unit?: string
  /** The modulator: the telemetry observable that moves this row (§14 —
   * every modulated parameter shows its modulator). The gate checks the
   * observable against the admitted families' telemetry declarations. */
  readonly modulatedBy?: string
  /** The path the owner writes; ABSENT = the row is a reading. */
  readonly writePath?: string
  /** Verbatim disclosed absence or partial support. */
  readonly disclosure?: string
}

export interface NumberParamInput extends ParamInputBase {
  readonly type: 'number' | 'duration'
  readonly range?: ParamRange
}
export interface StringParamInput extends ParamInputBase {
  readonly type: 'string'
}
export interface BoolParamInput extends ParamInputBase {
  readonly type: 'boolean'
}
export interface EnumParamInput extends ParamInputBase {
  readonly type: 'enumerated'
  readonly values: readonly string[]
}
export interface NaturedReadingParamInput extends ParamInputBase {
  readonly type: 'stream' | 'scope' | 'route' | 'receipts'
}
/** A reading of any value type, with NO write path — `writePath?: never`
 * makes the checker refuse one. (The natured reading types fault at the
 * gate as well; a scalar reading is honest by the absence.) */
export type ReadingParamInput =
  | (StringParamInput & {readonly writePath?: never})
  | (NumberParamInput & {readonly writePath?: never})
  | (BoolParamInput & {readonly writePath?: never})
  | (EnumParamInput & {readonly writePath?: never})
  | (NaturedReadingParamInput & {readonly writePath?: never})
export type ParamInput =
  | NumberParamInput | StringParamInput | BoolParamInput | EnumParamInput | ReadingParamInput

// ---------------------------------------------------------------------------
// builders — the row grammar, stated once

export const numberParam = (input: NumberParamInput): ParamInput => input
export const stringParam = (input: StringParamInput): ParamInput => input
export const boolParam = (input: BoolParamInput): ParamInput => input
export const enumParam = (input: EnumParamInput): ParamInput => input
/** Marks the authored row as a reading. No write path exists for it — that
 * absence is the honesty law, and the type checker keeps it: reading rows'
 * types (`stream | scope | route | receipts`) admit no writePath. */
export const reading = (input: ReadingParamInput): ParamInput => input

// ---------------------------------------------------------------------------
// devices and families

export interface DeviceDeclaration {
  /** Face id — unique within the family; addressed as `${family}:${id}`. */
  readonly id: string
  /** The face plate's name (presentation registry; the door shape carries
   * ids and notes only). */
  readonly title: string
  /** The device's mark from the cut — required: the plate carries its mark
   * or it is not a face of this shell. */
  readonly icon: IconName
  /** The Live semantic this device occupies — required (lock §5.1). The
   * gate refuses an absent, unknown, mode-illegal or invariant-broken one. */
  readonly liveSemantic: LiveSemantic
  /** The device's invariant for its semantic (lock §5.3). */
  readonly invariant?: SemanticInvariant
  /** The holder(s) that hold this device (lock §4.8, §4.9; semantics.ts HOLDERS). */
  readonly heldBy?: readonly string[]
  readonly kind?: InhabitantFaceKind
  /** Mode scoping — the modes this face presents in (the mode-specific
   * plugin surface). Absent = the face presents wherever its family does. */
  readonly modes?: readonly SdkModeName[]
  /** Per-mode device format/shape (the mode's device ontology). Absent for
   * a mode = that mode's default format (MODE_DEFAULT_FORMAT). */
  readonly formats?: Partial<Record<SdkModeName, DeviceFormat>>
  /** The note the door stores: what the face reads, which owner op, what
   * waits. The honesty law lives here. */
  readonly note?: string
  readonly admission?: 'admitted' | 'waiting'
  /** Absent = `['compact', 'expanded', 'full']` (the agent-shell default). */
  readonly presentations?: readonly DevicePresentation[]
  /** The face's dock lifecycle. Pop-out is the device default: a device pops out unless it opts out (`popOut: false`) or
   * waits; see `devicePopsOut`. The author's other lifecycles (`dock`, `expand`) stand as declared. */
  readonly dock?: readonly FaceDockLifecycle[]
  /** Pop-out (rack-device lifecycle, seam 8). Absent = the face pops out only where its window can draw its body alone
   * (`faceStandsAlone`, manifest.ts): Central's day die, Flow and Nara conversation. The QL instrument does not pop out
   * (commit 853c6f176: its reading is published only in the main window). Every other face (parameter faces, the atlas
   * and knowledge-graph faces) stays in the main window. `false` = this face never pops
   * out. `true` = the author asks for pop-out, which is refused at declaration by name unless the face stands alone. A
   * waiting face does not pop out unless it says so (and only if it stands alone). */
  readonly popOut?: boolean
  readonly document?: DocumentBodyDeclaration
  readonly conversation?: ConversationBodyDeclaration
  /** The face's §14 rows, in plate order. */
  readonly params?: readonly ParamInput[]
}

/** Rev 5's transport table made addressable: in one mode, one transport
 * slot carries one of the family's §14 params. `row` names a transport row
 * (the coarse Rev-5 shape, `TRANSPORT_ROWS`) or a single slot id (the fine
 * addressing, `TRANSPORT_SLOT_IDS` — the shell bar's 28 slots); the gate
 * normalizes both onto slot occupancy so one meaning per slot holds. */
export interface TransportBinding {
  readonly mode: SdkModeName
  /** The transport row — or slot id — this binding sits on (see
   * TRANSPORT_ROWS / TRANSPORT_SLOT_IDS). */
  readonly row: string
  /** The addressed face's id (the §14 deviceInstance). */
  readonly face: string
  /** The addressed param key on that face. */
  readonly key: string
}

export interface FamilyDeclaration {
  readonly id: FamilyManifestId
  /** The native owner this family belongs to — the disclosure law: a face
   * names its owner. */
  readonly owner: string
  /** The product this family is the carving of (§12). Absent = a capability
   * family serving no single product (atlas-earth). A KNOWN product id, or
   * a NEW product claimed through `newProduct` with its authority. */
  readonly product?: string
  /** The authority for a NEW product carving (the seventh-product test:
   * admitted, never special-cased — but the claim is recorded). */
  readonly newProduct?: NewProductAuthority
  /** Browser category ids the family lists under. */
  readonly browser: readonly string[]
  readonly devices: readonly DeviceDeclaration[]
  /** The family's parameter-address grammar id (e.g. `<family>/parameter-address/v1`). */
  readonly paramsGrammar: string
  /** The family's transport bindings — Rev 5's per-mode slot meanings that
   * this family's params carry. */
  readonly transport?: readonly TransportBinding[]
  readonly projections?: readonly string[]
  readonly inspectors?: readonly string[]
  readonly time?: {readonly consumes: readonly string[]; readonly contributes: readonly string[]}
  /** Observable id for modulation, or an honest null (absent = null). */
  readonly telemetry?: string | null
  /** The `shell.<setter>` paths THIS family arms (fixture families declare
   * their own fixture writers; real families' setters must also be armed in
   * the shell — the gate checks both). */
  readonly writers?: readonly string[]
  /** The authority for self-armed writers — who commissions the arming; a
   * fixture names itself. Required when `writers` carries a path the shell
   * does not already arm. */
  readonly writerAuthority?: string
}

export interface AdmittedFamily {
  readonly manifest: InhabitantManifest
  readonly params: readonly SdkParamRow[]
}

export interface DeviceExtensionDeclaration {
  /** Namespaced by family: `central:world-shell`. */
  readonly id: string
  /** The declaring author — attribution is part of the record. */
  readonly by: string
  readonly family: FamilyManifestId
  readonly devices: readonly DeviceDeclaration[]
  readonly detachedKinds?: NonNullable<InhabitantManifest['detachedKinds']>
  readonly note?: string
}

// ---------------------------------------------------------------------------
// presentation registries — door-adjacent, reset with the door

export interface FacePresentation {
  readonly family: FamilyManifestId
  readonly faceId: string
  readonly title: string
  readonly icon: IconName
  readonly owner: string
  /** Mode scoping (absent = presents wherever its family does). */
  readonly modes?: readonly SdkModeName[]
  /** Per-mode device format (absent for a mode = that mode's default). */
  readonly formats?: Partial<Record<SdkModeName, DeviceFormat>>
  /** The product the family is the carving of, when declared. */
  readonly product?: string
}

const presentations = new Map<FamilyManifestId, Map<string, FacePresentation>>()
const paramRows = new Map<FamilyManifestId, SdkParamRow[]>()
const familyProducts = new Map<FamilyManifestId, string>()
const familyWritersRegistry = new Map<FamilyManifestId, readonly string[]>()
const transportBindingsRegistry = new Map<FamilyManifestId, TransportBinding[]>()

onFamilyManifestReset(() => {
  presentations.clear()
  paramRows.clear()
  familyProducts.clear()
  familyWritersRegistry.clear()
  transportBindingsRegistry.clear()
})

function registerFamilyArtifacts(
  family: FamilyManifestId,
  owner: string,
  devices: readonly DeviceDeclaration[],
  rows: readonly SdkParamRow[],
  declared?: {
    readonly product?: string
    readonly transport?: readonly TransportBinding[]
    readonly writers?: readonly string[]
  },
): void {
  const plate = new Map(presentations.get(family) ?? [])
  for (const device of devices) {
    const prior = plate.get(device.id)
    plate.set(device.id, {
      family,
      faceId: device.id,
      title: device.title,
      icon: device.icon,
      owner,
      ...(device.modes ? {modes: device.modes} : prior?.modes ? {modes: prior.modes} : {}),
      ...(device.formats ? {formats: device.formats} : prior?.formats ? {formats: prior.formats} : {}),
      ...(declared?.product ? {product: declared.product} : prior?.product ? {product: prior.product} : {}),
    })
  }
  presentations.set(family, plate)
  // Idempotent merge (loaders run freely — including from render): rows are
  // keyed by (deviceInstance, key); a re-registration never duplicates.
  const merged = new Map((paramRows.get(family) ?? []).map(existing => [`${existing.deviceInstance}/${existing.key}`, existing]))
  for (const row of rows) merged.set(`${row.deviceInstance}/${row.key}`, row)
  paramRows.set(family, [...merged.values()])
  if (declared?.product) familyProducts.set(family, declared.product)
  // Writers ACCUMULATE per family: adoption artifacts land in pieces (the
  // graph tools', the time control's), and a later artifact must not
  // unarm an earlier one's writers.
  if (declared?.writers) {
    const merged = new Set([...(familyWritersRegistry.get(family) ?? []), ...declared.writers])
    familyWritersRegistry.set(family, [...merged])
  }
  if (declared?.transport) {
    const mergedBindings = new Map((transportBindingsRegistry.get(family) ?? []).map(binding => [`${binding.mode}/${binding.row}/${binding.face}/${binding.key}`, binding]))
    for (const binding of declared.transport) mergedBindings.set(`${binding.mode}/${binding.row}/${binding.face}/${binding.key}`, binding)
    transportBindingsRegistry.set(family, [...mergedBindings.values()])
  }
}

/** The plate record of one face, when it was declared through the kit. */
export function facePresentation(family: FamilyManifestId, faceId: string): FacePresentation | undefined {
  return presentations.get(family)?.get(faceId)
}

/** Every kit-declared face of one family (door admission is the truth; this
 * is the presentation layer). */
export function facePresentations(family: FamilyManifestId): readonly FacePresentation[] {
  return [...presentations.get(family)?.values() ?? []]
}

/** The faces that present in one mode, across all kit-declared families —
 * the mode-scoped plugin surface. A face without mode scoping presents in
 * every mode; the mode's default format fills absent formats. */
export function facesForMode(mode: SdkModeName): readonly (FacePresentation & {format: DeviceFormat})[] {
  return [...presentations.values()].flatMap(plates => [...plates.values()])
    .filter(plate => !plate.modes || plate.modes.includes(mode))
    .map(plate => ({
      ...plate,
      format: plate.formats?.[mode] ?? MODE_DEFAULT_FORMAT[mode],
    }))
}

/** The product a family carves (§12): its declared binding, or — for a family admitted by hand, before the kit — the
 * registered product its own id names. The validator's squatting rule (an unbound family may not take a product's name)
 * is the same fact read the other way, so both readers see the six carvings and a second family cannot claim one. */
export function familyProduct(family: FamilyManifestId): string | undefined {
  return familyProducts.get(family) ?? (isKnownProduct(family) ? family : undefined)
}

/** The writers a family declared (its own armed shell paths). */
export function familyWriters(family: FamilyManifestId): readonly string[] {
  return familyWritersRegistry.get(family) ?? []
}

/** Every declared transport binding, family filled. */
export function allTransportBindings(): readonly (TransportBinding & {readonly family: FamilyManifestId})[] {
  return [...transportBindingsRegistry.entries()]
    .flatMap(([family, bindings]) => bindings.map(binding => ({...binding, family})))
}

/** The family's kit-registered §14 rows, in declaration order. */
export function sdkParamRows(family: FamilyManifestId): readonly SdkParamRow[] {
  return paramRows.get(family) ?? []
}

/** Adopt presentation artifacts (plate records + §14 rows) for an
 * ALREADY-admitted family — the adoption loaders' door (the verified
 * address table's rows enter the kit here; no door writes, the family's
 * owner-authored manifest stays theirs). Validated: the rows must agree
 * with the verified address table (they usually ARE table rows) and
 * address faces the manifest actually declares.
 *
 * The P0 adoption door (2026-10-11): an artifact may also carry the
 * family's `writers` (+ `writerAuthority` — the same self-arming law as
 * admission) and its `transport` bindings. Both run the SAME validation
 * the admission path runs — the writers law (`validateFamilyWriters` over
 * the artifact's own rows) and the binding law (target, face, row, mode) —
 * before anything registers, so an adoption that would fail the world gate
 * never lands. */
export interface AdoptedArtifacts {
  readonly family: FamilyManifestId
  readonly owner: string
  readonly presentation: FacePresentation
  readonly rows: readonly SdkParamRow[]
  /** The `shell.<setter>` paths this adoption arms for the family. */
  readonly writers?: readonly string[]
  /** Who commissions the arming (required when writers carry paths the
   * shell does not already arm). */
  readonly writerAuthority?: string
  /** Rev-5 transport bindings the adoption declares (row or slot ids). */
  readonly transport?: readonly TransportBinding[]
}

export function registerAdoptedArtifacts(artifacts: readonly AdoptedArtifacts[]): void {
  for (const artifact of artifacts) {
    if (!familyManifest(artifact.family)) {
      throw new Error(`Cannot adopt artifacts for "${artifact.family}" — the family is not admitted; owners declare first.`)
    }
  }
  // The writers authority speaks before the law reads it (the admission
  // path's own order): self-armed writers are legal only under a named
  // commission, so the authority registers first and the writers law
  // judges with it standing.
  for (const artifact of artifacts) {
    if (artifact.writerAuthority) registerWriterAuthority(artifact.family, artifact.writerAuthority)
  }
  // Validate BEFORE registering (the admission discipline, at the adoption
  // door): writers law and binding law over the artifact's own rows PLUS
  // the rows the family already carries — a binding may address a row the
  // verified table adopted earlier (effort, heartbeat), and the writers
  // law judges the family's whole registered row set either way.
  for (const artifact of artifacts) {
    const standingRows = paramRows.get(artifact.family) ?? []
    const rowsForLaw = [...standingRows, ...artifact.rows]
    const writerFaults = validateFamilyWriters(artifact.family, artifact.writers, rowsForLaw)
    if (writerFaults.length) {
      throw new Error(`Adoption for "${artifact.family}" refuses — the writers law:\n- ${writerFaults.join('\n- ')}`)
    }
    for (const fault of validateTransportBindings(artifact.family, artifact.transport ?? [], rowsForLaw, familyManifest(artifact.family)!, faceInstanceOf(artifact.family))) {
      throw new Error(`Adoption for "${artifact.family}" refuses — the transport binding law:\n- ${fault}`)
    }
  }
  for (const artifact of artifacts) {
    registerFamilyArtifacts(artifact.family, artifact.owner, [], artifact.rows, {
      ...(artifact.writers ? {writers: artifact.writers} : {}),
      ...(artifact.transport ? {transport: artifact.transport} : {}),
    })
    const plate = new Map(presentations.get(artifact.family) ?? [])
    plate.set(artifact.presentation.faceId, artifact.presentation)
    presentations.set(artifact.family, plate)
  }
}

/** The binding that occupies one mode's slot, family filled — the mode
 * bar's lookup (the slot's declared meaning carries a §14 param when a
 * binding — row or slot shaped — covers it). Undefined = the slot is
 * unbound (its waiting state is honest). */
export function transportBindingForSlot(mode: SdkModeName, slot: string): (TransportBinding & {readonly family: FamilyManifestId}) | undefined {
  for (const binding of allTransportBindings()) {
    if (binding.mode !== mode) continue
    if (transportTargetSlots(binding.row).includes(slot as TransportSlotId)) return binding
  }
  return undefined
}

/** The §14 row a binding addresses, resolved through the kit's registries
 * (the binding addresses the FACE; the row may be addressed by the chain
 * instance that face composes — the same mapping the binding law uses). */
export function transportBindingRow(binding: TransportBinding & {readonly family: FamilyManifestId}): SdkParamRow | undefined {
  const rows = sdkParamRows(binding.family)
  const direct = rows.find(row => row.deviceInstance === binding.face && row.key === binding.key)
  if (direct) return direct
  const instance = faceInstanceOf(binding.family)(binding.face) ?? binding.face
  return rows.find(row => row.deviceInstance === instance && row.key === binding.key)
}

/** The face→chain-instance resolver for the agent chain's faces: a §14 row
 * is addressed by the chain instance (`agent`, `gateway`, …) while a
 * transport binding addresses the composing face (`harness-model`, …).
 * Derived from the same catalogue the adoption loader maps rows with —
 * one mapping, not two. */
function faceInstanceOf(family: FamilyManifestId): (faceId: string) => string | undefined {
  const byFace = new Map<string, string>()
  for (const slot of deriveAgentDeviceRows(allFamilyManifests())) {
    for (const face of slot.faces) {
      if (face.family === family) byFace.set(face.faceId, slot.id)
    }
  }
  return faceId => byFace.get(faceId)
}

/** Every kit-registered row, across families (rows carry their family). */
export function allSdkParamRows(): readonly SdkParamRow[] {
  return [...paramRows.values()].flat()
}

// ---------------------------------------------------------------------------
// declaration → door shape

/** Whether an SDK device's window can draw its body alone: its id and kind name a standalone face (manifest.ts). */
function deviceStandsAlone(device: DeviceDeclaration): boolean {
  return standsAlone(device.id, device.kind ?? DEFAULT_FACE_KIND)
}

/** Whether an SDK device pops out. By default it does only where its window can draw its body alone, and not while it
 * waits. `popOut: false` opts out. A pop-out the author asks for (`popOut: true`, or `'pop-out'` in its dock) on a face
 * that cannot stand alone is refused here by name: its window would be empty. */
export function devicePopsOut(device: DeviceDeclaration): boolean {
  if (device.popOut === false) return false
  const asks = device.popOut === true || (device.dock ?? []).includes('pop-out')
  if (asks && !deviceStandsAlone(device)) {
    throw new Error(`Device "${device.id}" refuses pop-out — its body draws only in the main window (or it has none), so a window for it would be empty. Pop-out is offered only for faces that draw their body in a window of their own.`)
  }
  return device.popOut ?? (deviceStandsAlone(device) && device.admission !== 'waiting')
}

/** A device's dock lifecycle with the pop-out default applied (hand-written manifests declare their own `pop-out`). An
 * opt-out drops any `pop-out` from the dock; the other lifecycles stand as declared. */
function deviceDock(device: DeviceDeclaration): readonly FaceDockLifecycle[] | undefined {
  if (device.popOut === false) return device.dock?.filter(lifecycle => lifecycle !== 'pop-out')
  if (devicePopsOut(device)) return [...new Set<FaceDockLifecycle>([...(device.dock ?? ['dock']), 'pop-out'])]
  return device.dock
}

/** The detached kinds a family's devices pop out through: the `device` kind, declared once when any device pops out. */
function devicePopOutKinds(devices: readonly DeviceDeclaration[]): DetachedKind[] {
  return devices.some(device => deviceDock(device)?.includes('pop-out')) ? ['device'] : []
}

function buildFaces(devices: readonly DeviceDeclaration[]): InhabitantFaceDeclaration[] {
  return devices.map(device => ({
    id: device.id,
    presentations: device.presentations ?? ['compact', 'expanded', 'full'],
    liveSemantic: device.liveSemantic,
    ...(device.invariant ? {invariant: device.invariant} : {}),
    ...(device.heldBy ? {heldBy: device.heldBy} : {}),
    ...(device.modes ? {modes: device.modes} : {}),
    ...(device.note ? {note: device.note} : {}),
    ...(device.kind ? {kind: device.kind} : {}),
    ...(device.admission ? {admission: device.admission} : {}),
    ...(deviceDock(device) ? {dock: deviceDock(device)} : {}),
    ...(device.document ? {document: device.document} : {}),
    ...(device.conversation ? {conversation: device.conversation} : {}),
  }))
}

function buildRows(family: FamilyManifestId, devices: readonly DeviceDeclaration[]): SdkParamRow[] {
  return devices.flatMap(device => (device.params ?? []).map(input => kitRow(family, device.id, input)))
}

function kitRow(family: FamilyManifestId, deviceInstance: string, input: ParamInput): SdkParamRow {
  const {key, title, icon, unit, modulatedBy, writePath, disclosure, type, ...rest} = input
  return {
    family,
    deviceInstance,
    key,
    title,
    ...(icon ? {icon} : {}),
    ...(unit ? {unit} : {}),
    ...(modulatedBy ? {modulatedBy} : {}),
    type,
    ...(type === 'enumerated' ? {values: (rest as EnumParamInput).values} : {}),
    ...(type === 'number' || type === 'duration'
      ? ((rest as NumberParamInput).range ? {range: (rest as NumberParamInput).range} : {})
      : {}),
    ...(writePath ? {writePath} : {}),
    ...(disclosure ? {disclosure} : {}),
  }
}

/** Build the family manifest + rows WITHOUT admitting (validation and
 * scaffolding use this). */
export function buildFamilyDeclaration(declaration: FamilyDeclaration): {
  manifest: InhabitantManifest
  params: readonly SdkParamRow[]
} {
  const popOutKinds = devicePopOutKinds(declaration.devices)
  const manifest: InhabitantManifest = {
    id: declaration.id,
    ...(popOutKinds.length ? {detachedKinds: popOutKinds} : {}),
    browser: declaration.browser,
    faces: buildFaces(declaration.devices),
    params: {grammar: declaration.paramsGrammar},
    projections: declaration.projections ?? [],
    inspectors: declaration.inspectors ?? [],
    time: declaration.time ?? {consumes: [], contributes: []},
    telemetry: declaration.telemetry ?? null,
  }
  return {manifest, params: buildRows(declaration.id, declaration.devices)}
}

// ---------------------------------------------------------------------------
// admission — validate first, then the door

/** Validate, then admit the family at the neutral door and register its
 * presentation artifacts. Throws with the fault list when the declaration
 * breaks the law — a family that would fail the gate never reaches the door. */
export function admitFamily(declaration: FamilyDeclaration): AdmittedFamily {
  registerWriterAuthority(declaration.id, declaration.writerAuthority)
  // §12 exclusivity speaks first (door-state law): one product family per
  // product — a second family for a bound product composes through
  // extensions instead, whatever else its declaration carries.
  if (declaration.product) {
    for (const existing of allFamilyManifests()) {
      if (existing.id !== declaration.id && familyProduct(existing.id) === declaration.product) {
        throw new Error(`Family "${declaration.id}" refuses to admit — §12 carving: product "${declaration.product}" is already the family "${existing.id}"'s carving; one product family per product, so compose through the declared-extension path instead.`)
      }
    }
  }
  const {manifest, params} = buildFamilyDeclaration(declaration)
  const faults = validateDeclaredFamily(declaration, manifest, params)
  if (faults.length) {
    throw new Error(`Family "${declaration.id}" refuses to admit — the declaration breaks the device law:\n- ${faults.join('\n- ')}`)
  }
  admitFamilyManifest(manifest as FamilyManifest)
  registerFamilyArtifacts(declaration.id, declaration.owner, declaration.devices, params, {
    ...(declaration.product ? {product: declaration.product} : {}),
    ...(declaration.transport ? {transport: declaration.transport} : {}),
    ...(declaration.writers ? {writers: declaration.writers} : {}),
  })
  return {manifest, params}
}

/** Compose additive devices onto an admitted family (the extension path).
 * The family's owner-authored base stays verbatim at the door. The SAME
 * validation-first discipline as admission: the door's manifest law runs
 * over the COMPOSED result (base faces + extension faces) before anything
 * composes — an extension that would leave the family failing the gate is
 * refused with the fault list. */
export function declareDeviceExtension(declaration: DeviceExtensionDeclaration): FamilyExtension {
  const extensionKinds = [...new Set<DetachedKind>([...declaration.detachedKinds ?? [], ...devicePopOutKinds(declaration.devices)])]
  const extension: FamilyExtension = {
    id: declaration.id,
    by: declaration.by,
    ...(declaration.devices.length ? {faces: buildFaces(declaration.devices)} : {}),
    ...(extensionKinds.length ? {detachedKinds: extensionKinds} : {}),
    ...(declaration.note ? {note: declaration.note} : {}),
  }
  const base = familyManifest(declaration.family)
  if (!base) {
    throw new Error(`Family "${declaration.family}" is not admitted; extensions compose onto an owner-admitted base, never ahead of it.`)
  }
  // The composed shape includes the PRIOR extensions (N-F): validating
  // base+this-extension alone would false-refuse faces whose legality a
  // standing extension already carries (e.g. its detachedKinds).
  const prior = familyExtensions(declaration.family)
  const composedForValidation: InhabitantManifest = {
    ...(base as InhabitantManifest),
    faces: [
      ...(base as InhabitantManifest).faces,
      ...prior.flatMap(carried => carried.faces ?? []),
      ...(extension.faces ?? []),
    ],
    detachedKinds: [
      ...(base as InhabitantManifest).detachedKinds ?? [],
      ...prior.flatMap(carried => carried.detachedKinds ?? []),
      ...extension.detachedKinds ?? [],
    ],
  }
  const rows = buildRows(declaration.family, declaration.devices)
  const faults = [
    ...declaration.devices.flatMap(device => validateSdkDevice(device)),
    ...validateInhabitantManifest(composedForValidation),
    // The writers law at the extension layer too (N-A): the family's
    // registered writers arm the extension's rows.
    ...validateFamilyWriters(declaration.family, familyWriters(declaration.family), rows),
    // The declared per-mode formats face the Live semantic law at this door too (lock §5.4).
    ...declaration.devices.flatMap(device => device.formats ? validateFaceSemantic(device, {family: declaration.family, formats: device.formats}) : []),
  ]
  if (faults.length) {
    throw new Error(`Extension "${declaration.id}" refuses to compose — the declaration breaks the device law:\n- ${faults.join('\n- ')}`)
  }
  const composed = declareFamilyExtension(declaration.family, extension)
  const owner = facePresentations(declaration.family)[0]?.owner ?? declaration.family
  registerFamilyArtifacts(declaration.family, owner, declaration.devices, rows)
  return composed
}

/** Re-export the mode layer's lookup surface for authors (one import point:
 * `sdk/define.ts`). */
export {SDK_MODES, SDK_MODE_DECLARATIONS, TRANSPORT_ROWS, TRANSPORT_SLOTS, TRANSPORT_SLOT_IDS, TRANSPORT_ROW_SLOTS, DEVICE_FORMATS, MODE_DEFAULT_FORMAT, sdkMode, isSdkMode, isTransportTarget, transportSlot, transportTargetSlots} from './modes.ts'
export type {SdkModeName, SdkMode, TransportRowId, TransportSlotId, TransportSlot, DeviceFormat} from './modes.ts'
export {onFamilyManifestReset} from '../familyManifest.ts'
export {PRODUCTS, product, isKnownProduct} from './products.ts'
export type {ProductRecord, NewProductAuthority} from './products.ts'
/** The Live semantics vocabulary (lock §1) — one import point for authors. */
export {LIVE_SEMANTICS, LIVE_EXEMPLARS, isLiveSemantic, INVARIANT_FIELDS} from './semantics.ts'
export type {LiveSemantic, SemanticInvariant, SemanticMap} from './semantics.ts'
