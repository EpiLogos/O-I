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
import {admitFamilyManifest, onFamilyManifestReset} from '../familyManifest.ts'
import type {
  ConversationBodyDeclaration,
  DocumentBodyDeclaration,
  FaceDockLifecycle,
  InhabitantFaceDeclaration,
  InhabitantFaceKind,
  InhabitantManifest,
} from '../manifest.ts'
import {declareFamilyExtension, type FamilyExtension} from '../manifest.ts'
import type {AgentParamAddress} from '../agentParamAddresses.ts'
import type {IconName} from './icons.ts'
import {validateDeclaredFamily, validateSdkDevice} from './validate.ts'

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
  readonly kind?: InhabitantFaceKind
  /** The note the door stores: what the face reads, which owner op, what
   * waits. The honesty law lives here. */
  readonly note?: string
  readonly admission?: 'admitted' | 'waiting'
  /** Absent = `['compact', 'expanded', 'full']` (the agent-shell default). */
  readonly presentations?: readonly DevicePresentation[]
  readonly dock?: readonly FaceDockLifecycle[]
  readonly document?: DocumentBodyDeclaration
  readonly conversation?: ConversationBodyDeclaration
  /** The face's §14 rows, in plate order. */
  readonly params?: readonly ParamInput[]
}

export interface FamilyDeclaration {
  readonly id: FamilyManifestId
  /** The native owner this family belongs to — the disclosure law: a face
   * names its owner. */
  readonly owner: string
  /** Browser category ids the family lists under. */
  readonly browser: readonly string[]
  readonly devices: readonly DeviceDeclaration[]
  /** The family's parameter-address grammar id (e.g. `<family>/parameter-address/v1`). */
  readonly paramsGrammar: string
  readonly projections?: readonly string[]
  readonly inspectors?: readonly string[]
  readonly time?: {readonly consumes: readonly string[]; readonly contributes: readonly string[]}
  /** Observable id for modulation, or an honest null (absent = null). */
  readonly telemetry?: string | null
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
}

const presentations = new Map<FamilyManifestId, Map<string, FacePresentation>>()
const paramRows = new Map<FamilyManifestId, SdkParamRow[]>()

onFamilyManifestReset(() => {
  presentations.clear()
  paramRows.clear()
})

function registerFamilyArtifacts(
  family: FamilyManifestId,
  owner: string,
  devices: readonly DeviceDeclaration[],
  rows: readonly SdkParamRow[],
): void {
  const plate = new Map(presentations.get(family) ?? [])
  for (const device of devices) {
    plate.set(device.id, {family, faceId: device.id, title: device.title, icon: device.icon, owner})
  }
  presentations.set(family, plate)
  // Idempotent merge (loaders run freely — including from render): rows are
  // keyed by (deviceInstance, key); a re-registration never duplicates.
  const merged = new Map((paramRows.get(family) ?? []).map(existing => [`${existing.deviceInstance}/${existing.key}`, existing]))
  for (const row of rows) merged.set(`${row.deviceInstance}/${row.key}`, row)
  paramRows.set(family, [...merged.values()])
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

/** The family's kit-registered §14 rows, in declaration order. */
export function sdkParamRows(family: FamilyManifestId): readonly SdkParamRow[] {
  return paramRows.get(family) ?? []
}

/** Every kit-registered row, across families (rows carry their family). */
export function allSdkParamRows(): readonly SdkParamRow[] {
  return [...paramRows.values()].flat()
}

// ---------------------------------------------------------------------------
// declaration → door shape

function buildFaces(devices: readonly DeviceDeclaration[]): InhabitantFaceDeclaration[] {
  return devices.map(device => ({
    id: device.id,
    presentations: device.presentations ?? ['compact', 'expanded', 'full'],
    ...(device.note ? {note: device.note} : {}),
    ...(device.kind ? {kind: device.kind} : {}),
    ...(device.admission ? {admission: device.admission} : {}),
    ...(device.dock ? {dock: device.dock} : {}),
    ...(device.document ? {document: device.document} : {}),
    ...(device.conversation ? {conversation: device.conversation} : {}),
  }))
}

function buildRows(family: FamilyManifestId, devices: readonly DeviceDeclaration[]): SdkParamRow[] {
  return devices.flatMap(device => (device.params ?? []).map(input => kitRow(family, device.id, input)))
}

function kitRow(family: FamilyManifestId, deviceInstance: string, input: ParamInput): SdkParamRow {
  const {key, title, icon, writePath, disclosure, type, ...rest} = input
  return {
    family,
    deviceInstance,
    key,
    title,
    ...(icon ? {icon} : {}),
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
  const manifest: InhabitantManifest = {
    id: declaration.id,
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
  const {manifest, params} = buildFamilyDeclaration(declaration)
  const faults = validateDeclaredFamily(declaration, manifest, params)
  if (faults.length) {
    throw new Error(`Family "${declaration.id}" refuses to admit — the declaration breaks the device law:\n- ${faults.join('\n- ')}`)
  }
  admitFamilyManifest(manifest as FamilyManifest)
  registerFamilyArtifacts(declaration.id, declaration.owner, declaration.devices, params)
  return {manifest, params}
}

/** Compose additive devices onto an admitted family (the extension path).
 * The family's owner-authored base stays verbatim at the door. */
export function declareDeviceExtension(declaration: DeviceExtensionDeclaration): FamilyExtension {
  const faults = declaration.devices.flatMap(device => validateSdkDevice(device))
  const extension: FamilyExtension = {
    id: declaration.id,
    by: declaration.by,
    ...(declaration.devices.length ? {faces: buildFaces(declaration.devices)} : {}),
    ...(declaration.detachedKinds ? {detachedKinds: declaration.detachedKinds} : {}),
    ...(declaration.note ? {note: declaration.note} : {}),
  }
  if (faults.length) {
    throw new Error(`Extension "${declaration.id}" refuses to compose — the declaration breaks the device law:\n- ${faults.join('\n- ')}`)
  }
  const composed = declareFamilyExtension(declaration.family, extension)
  const rows = buildRows(declaration.family, declaration.devices)
  const owner = facePresentations(declaration.family)[0]?.owner ?? declaration.family
  registerFamilyArtifacts(declaration.family, owner, declaration.devices, rows)
  return composed
}
