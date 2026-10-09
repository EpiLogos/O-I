/** The device law, made checkable — the SDK's validation gate.
 *
 * Two layers:
 * - `validateSdkDevice` / `validateDeclaredFamily` run BEFORE admission:
 *   `admitFamily` refuses a declaration that breaks the law, so a family
 *   that would fail the gate never reaches the door.
 * - `validateAdmittedWorld` runs over everything standing: the door's own
 *   manifest validator plus the §14 cross-checks — kit rows against the
 *   verified ownership map (`AGENT_SHELL_ADDRESS_TABLE`), one owning
 *   address per (family, device, key).
 *
 * The fault strings are written for the author who reads them (usually an
 * agent): each names the law and the fix. `scripts/validate-devices.mjs`
 * is the CI voice of this module.
 *
 * Pure: no view, no store, no I/O. */

import type {FamilyManifestId} from '../familyManifest.ts'
import {allFamilyManifests, familyManifest} from '../familyManifest.ts'
import type {InhabitantManifest} from '../manifest.ts'
import {validateInhabitantManifest} from '../manifest.ts'
import {AGENT_SHELL_ADDRESS_TABLE} from '../agentParamAddresses.ts'
import type {DeviceDeclaration, FamilyDeclaration, ParamInput, SdkParamRow} from './define.ts'
import {allSdkParamRows} from './define.ts'
import {isIconName} from './icons.ts'

// ---------------------------------------------------------------------------
// the parameter grammar

/** The parameter types in use across the shell's devices (the agent-shell
 * address table is the reference set). A family needing a new type adds it
 * here in a reviewed change — the set is the grammar, not a guess. */
export const SDK_PARAM_TYPES = [
  'number', 'string', 'boolean', 'enumerated', 'duration',
  'stream', 'scope', 'route', 'receipts',
] as const
export type SdkParamType = (typeof SDK_PARAM_TYPES)[number]

/** Types whose rows are readings by nature — a writePath on one is a fault. */
const READ_ONLY_TYPES: readonly SdkParamType[] = ['stream', 'scope', 'route', 'receipts']

/** The write-path grammar: `kernel:<op>` (the kernel op union), `shell.<setter>`
 * (the shell's own armed setters), or `<tool>:<command>` (a native owner's
 * CLI — `workcell-cli:git commit`). Anything else is not a path an owner
 * stands behind. */
export function isWritePath(candidate: string): boolean {
  if (/^kernel:[a-z][a-z0-9_]*$/.test(candidate)) return true
  if (/^shell\.[a-z][a-zA-Z0-9]*$/.test(candidate)) return true
  return /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?:[ ][\w./-]+)*$/.test(candidate)
}

const PARAM_KEY = /^[a-z0-9][a-z0-9-]*$/
const FACE_ID = /^[a-z0-9][a-z0-9-]*$/

// ---------------------------------------------------------------------------
// per-device checks (pre-admission; also used standalone by extensions)

/** The device law over one declaration: identity, mark, honesty of its rows. */
export function validateSdkDevice(device: DeviceDeclaration): readonly string[] {
  const faults: string[] = []
  const claim = (message: string): void => { faults.push(`${device.id}: ${message}`) }

  if (!FACE_ID.test(device.id)) claim(`face id must be lowercase kebab (${FACE_ID})`)
  if (!device.title.trim()) claim('a device declares its human title (the plate shows it)')
  if (!device.icon) claim('a device declares its mark (icon) from the cut — the plate carries it or it is not a face')
  else if (!isIconName(device.icon)) claim(`icon "${device.icon}" is not a mark of the cut — pick from ICON_NAMES or cut a new mark into icon-cut.html and re-run scripts/sync-icons.mjs`)

  const waiting = device.admission === 'waiting'
  if (waiting && !device.note) claim('a waiting face names the owner it waits for (note)')

  // Bodies belong to their kind (mirrored pre-admission; the composed check
  // lives in the door's validateInhabitantManifest).
  if (device.kind === 'document' && !device.document) claim('a document face declares a body (oi.document-frame/v1)')
  if (device.kind !== 'document' && device.document) claim('a non-document face carries a document body')
  if (device.kind === 'conversation' && !device.conversation) claim('a conversation face declares its binding')
  if (device.kind !== 'conversation' && device.conversation) claim('a non-conversation face carries a conversation binding')

  const keys = new Set<string>()
  for (const input of device.params ?? []) {
    const fault = validateSdkParam(input)
    for (const message of fault) claim(`param "${input.key}": ${message}`)
    if (keys.has(input.key)) claim(`param "${input.key}": duplicate key on the face`)
    keys.add(input.key)
    if (waiting && input.writePath) {
      claim(`param "${input.key}": a waiting face carries no write path — the owner it waits for would be pretended`)
    }
  }
  return faults
}

/** The §14 row law for one authored row; empty = honest. */
export function validateSdkParam(input: ParamInput): readonly string[] {
  const faults: string[] = []
  if (!PARAM_KEY.test(input.key)) faults.push(`key must be lowercase kebab (${PARAM_KEY})`)
  if (!input.title.trim()) faults.push('a row declares its human label')
  if (!(SDK_PARAM_TYPES as readonly string[]).includes(input.type)) {
    faults.push(`type "${input.type}" is not in the grammar (${SDK_PARAM_TYPES.join(' | ')}) — extend SDK_PARAM_TYPES in a reviewed change, never inline a private type`)
  }
  if (input.type === 'enumerated' && !(input.values?.length)) {
    faults.push("an enumerated row names its values (the owner's actual choices)")
  }
  if (input.type !== 'number' && input.type !== 'duration' && 'range' in input && input.range) {
    faults.push(`a ${input.type} row carries no range — ranges are the scalar domain`)
  }
  if ((READ_ONLY_TYPES as readonly string[]).includes(input.type) && input.writePath) {
    faults.push(`a ${input.type} row is a reading by nature — writePath pretends a writer`)
  }
  if (input.writePath !== undefined) {
    if (!isWritePath(input.writePath)) {
      faults.push(`writePath "${input.writePath}" is not an owner path — use kernel:<op>, shell.<setter>, or <tool>:<command>`)
    }
  }
  return faults
}

// ---------------------------------------------------------------------------
// family checks (pre-admission)

/** The family law over a whole declaration: the door's manifest law plus
 * §14 coverage — every row addresses a declared face of this family. */
export function validateDeclaredFamily(
  declaration: FamilyDeclaration,
  manifest: InhabitantManifest,
  params: readonly SdkParamRow[],
): readonly string[] {
  const faults: string[] = [
    ...manifest.faces.flatMap(face => validateSdkDevice({
      id: face.id,
      title: declaration.devices.find(device => device.id === face.id)?.title ?? '',
      icon: declaration.devices.find(device => device.id === face.id)?.icon ?? '' as DeviceDeclaration['icon'],
      kind: face.kind,
      note: face.note,
      admission: face.admission,
      presentations: face.presentations,
      dock: face.dock,
      document: face.document,
      conversation: face.conversation,
      params: declaration.devices.find(device => device.id === face.id)?.params ?? [],
    })),
    ...validateInhabitantManifest(manifest),
  ]
  const faceIds = new Set(manifest.faces.map(face => face.id))
  for (const row of params) {
    if (!faceIds.has(row.deviceInstance)) {
      faults.push(`param "${row.family}/${row.deviceInstance}/${row.key}" addresses face "${row.deviceInstance}", which the family does not declare`)
    }
  }
  if (!declaration.owner.trim()) {
    faults.push(`${manifest.id}: a family names its native owner — the disclosure law`)
  }
  return faults
}

// ---------------------------------------------------------------------------
// the world gate (post-admission; the CLI's voice)

export interface WorldGateResult {
  /** family id → fault list; only families with faults appear. */
  readonly byFamily: ReadonlyMap<FamilyManifestId, readonly string[]>
  /** Cross-family faults (ownership map, §14 uniqueness). */
  readonly cross: readonly string[]
}

/** Validate everything standing: every admitted family through the door's
 * validator and the SDK's checks, the kit rows against the agent-shell
 * address table, and one-owning-address uniqueness. Empty everywhere = the
 * world passes the gate. */
export function validateAdmittedWorld(): WorldGateResult {
  const byFamily = new Map<FamilyManifestId, readonly string[]>()
  for (const manifest of allFamilyManifests()) {
    const faults = validateInhabitantManifest(manifest as InhabitantManifest)
    if (faults.length) byFamily.set(manifest.id, faults)
  }

  const cross: string[] = []

  // §14 uniqueness across kit rows: one owning address per (family, device, key).
  const seen = new Map<string, SdkParamRow>()
  for (const row of allSdkParamRows()) {
    const address = `${row.family}/${row.deviceInstance}/${row.key}`
    const prior = seen.get(address)
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) {
      cross.push(`§14 collision: "${address}" is declared twice with different contents`)
    }
    seen.set(address, row)
  }

  // The verified ownership map stands: every table row's family is admitted,
  // and a kit row cannot contradict it.
  for (const row of AGENT_SHELL_ADDRESS_TABLE) {
    if (!familyManifest(row.family)) {
      cross.push(`address table row "${row.family}/${row.deviceInstance}/${row.key}" names family "${row.family}", which the door has not admitted`)
      continue
    }
    const kit = seen.get(`${row.family}/${row.deviceInstance}/${row.key}`)
    if (kit) {
      const agreed =
        kit.type === row.type &&
        JSON.stringify(kit.values ?? null) === JSON.stringify(row.values ?? null) &&
        JSON.stringify(kit.range ?? null) === JSON.stringify(row.range ?? null) &&
        (kit.writePath ?? undefined) === (row.writePath ?? undefined)
      if (!agreed) {
        cross.push(`kit row "${row.family}/${row.deviceInstance}/${row.key}" contradicts the verified address table — the ownership map stands; align the declaration or re-verify the map`)
      }
    }
  }

  return {byFamily, cross}
}
