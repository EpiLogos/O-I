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
import {allSdkParamRows, allTransportBindings, familyProduct} from './define.ts'
import {isIconName} from './icons.ts'
import {DEVICE_FORMATS, SDK_MODES, TRANSPORT_ROWS, isSdkMode} from './modes.ts'
import {PRODUCT_IDS, isKnownProduct} from './products.ts'

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

/** The shell setters the shell actually arms today (derived from the
 * verified address table). A `shell.` write path must be armed here OR
 * declared by the family itself (`FamilyDeclaration.writers` — a fixture
 * arms its own fixture writers); anything else pretends a writer. */
export const ARMED_SHELL_SETTERS: readonly string[] = AGENT_SHELL_ADDRESS_TABLE
  .map(row => row.writePath)
  .filter((path): path is string => path !== undefined && path.startsWith('shell.'))

/** The locked time strata (WORLD-SHELL-DESIGN §15) — families bind these,
 * never fork clocks. Contributions are the family's own material names. */
export const TIME_STRATA = ['chronos', 'civil', 'cron', 'transport', 'occasion'] as const

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

  // Mode scoping and per-mode formats: the modes and shapes the ontology declares.
  for (const mode of device.modes ?? []) {
    if (!isSdkMode(mode)) claim(`mode "${mode}" is not one of the shell's modes (${SDK_MODES.join(' | ')})`)
  }
  for (const [mode, format] of Object.entries(device.formats ?? {})) {
    if (!isSdkMode(mode)) claim(`format key "${mode}" is not one of the shell's modes (${SDK_MODES.join(' | ')})`)
    else if (!(DEVICE_FORMATS as readonly string[]).includes(format)) {
      claim(`format "${format}" is not in the device ontology (${DEVICE_FORMATS.join(' | ')})`)
    }
  }

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
  if (input.type === 'enumerated' && input.writePath && !(input.values?.length)) {
    faults.push("a writable enumerated row names its values (the owner's actual choices) — a reading may carry the type bare, as the verified map's rows do")
  }
  if (input.type !== 'number' && input.type !== 'duration') {
    // The union only declares `range` on the scalar members; read it off the
    // record so a mis-carried range on any other variant still faults here.
    const carried = (input as { readonly range?: unknown }).range
    if (carried) faults.push(`a ${input.type} row carries no range — ranges are the scalar domain`)
  }
  if (input.type === 'number' || input.type === 'duration') {
    const range = (input as { readonly range?: { readonly min?: number; readonly max?: number; readonly unit?: string } }).range
    if (range?.min !== undefined && range?.max !== undefined && range.min >= range.max) {
      faults.push(`range [${range.min}, ${range.max}] is not an ordered domain — min < max`)
    }
    if (range?.unit !== undefined && range.min === undefined && range.max === undefined) {
      faults.push(`a ${input.type} row declares its domain: a unit without bounds has no domain to carry it`)
    }
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

/** The writer-membership law (family level, where `writers` is known): a
 * `shell.` path must be armed by the shell or declared by this family.
 * `kernel:` and `<tool>:` paths are shape-checked here; their unions live
 * with their owners (kernel op union, the tool's CLI) — a path that passes
 * shape but names nothing is a fault the owner's world gate catches on
 * first exercise, and the honesty note travels on the row. */
export function validateFamilyWriters(declaration: FamilyDeclaration, params: readonly SdkParamRow[]): readonly string[] {
  const faults: string[] = []
  const armed = new Set([...ARMED_SHELL_SETTERS, ...declaration.writers ?? []])
  for (const row of params) {
    if (row.writePath?.startsWith('shell.') && !armed.has(row.writePath)) {
      faults.push(`${declaration.id}/${row.deviceInstance}/${row.key}: writePath "${row.writePath}" is armed by no one — the shell arms ${ARMED_SHELL_SETTERS.join(', ')}; arm it in the shell first, or declare it on this family's writers (a fixture arms its own)`)
    }
  }
  return faults
}

// ---------------------------------------------------------------------------
// family checks (pre-admission)

/** The family law over a whole declaration: the kit's per-device checks run
 * on the DECLARED devices (they carry everything — modes, formats, rows),
 * plus the door's manifest law over the built shape. */
export function validateDeclaredFamily(
  declaration: FamilyDeclaration,
  manifest: InhabitantManifest,
  params: readonly SdkParamRow[],
): readonly string[] {
  const faults: string[] = [
    ...declaration.devices.flatMap(device => validateSdkDevice(device)),
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
  faults.push(...validateFamilyWriters(declaration, params))

  // Presentations: when declared, non-empty and of the door's vocabulary;
  // mode scoping non-empty; format keys within the face's declared scope.
  const PRESENTATIONS = ['compact', 'expanded', 'full']
  for (const device of declaration.devices) {
    if (device.presentations && !device.presentations.length) {
      faults.push(`${manifest.id}/${device.id}: presentations, when declared, name at least one presentation`)
    }
    for (const presentation of device.presentations ?? []) {
      if (!PRESENTATIONS.includes(presentation)) {
        faults.push(`${manifest.id}/${device.id}: presentation "${presentation}" is not one the door carries (${PRESENTATIONS.join(' | ')})`)
      }
    }
    if (device.modes && !device.modes.length) faults.push(`${manifest.id}/${device.id}: modes, when declared, name at least one mode`)
    for (const mode of Object.keys(device.formats ?? {})) {
      if (device.modes && !device.modes.includes(mode as never)) {
        faults.push(`${manifest.id}/${device.id}: format key "${mode}" is outside the face's declared mode scope`)
      }
    }
  }

  // §15: consumed strata are the locked five; contributions are free material names.
  for (const stratum of declaration.time?.consumes ?? []) {
    if (!(TIME_STRATA as readonly string[]).includes(stratum)) {
      faults.push(`${manifest.id}: time consumes "${stratum}" — strata are locked at the top (${TIME_STRATA.join(' | ')}); bind a stratum, never fork a clock`)
    }
  }

  // The product carving law (§12): a binding names a registered product, or
  // claims a NEW product with its authority; an unbound family does not
  // squat a product's name.
  if (declaration.product !== undefined) {
    if (!isKnownProduct(declaration.product)) {
      if (!declaration.newProduct) {
        faults.push(`${manifest.id}: product "${declaration.product}" is not in the registry — bind a registered product (${PRODUCT_IDS.join(' | ')}) or claim the new product through newProduct with its authority`)
      } else if (declaration.newProduct.id !== declaration.product) {
        faults.push(`${manifest.id}: newProduct.id "${declaration.newProduct.id}" does not match the bound product "${declaration.product}"`)
      } else if (!declaration.newProduct.authority.trim()) {
        faults.push(`${manifest.id}: a new-product claim names its commissioning authority (who ruled, where it stands)`)
      }
    } else if (declaration.newProduct) {
      faults.push(`${manifest.id}: "${declaration.product}" is a registered product — newProduct is only for carvings the registry does not carry yet`)
    }
  } else if (declaration.newProduct) {
    faults.push(`${manifest.id}: newProduct without a product binding — set product to the new product's id`)
  } else if (isKnownProduct(manifest.id)) {
    faults.push(`${manifest.id}: the family id names a product — bind product ("${manifest.id}") or rename; no product name squatting`)
  }

  // Transport bindings: Rev 5's table made addressable — every binding sits
  // on a declared row, in a declared mode, addressing a declared face's §14 row.
  for (const binding of declaration.transport ?? []) {
    if (!isSdkMode(binding.mode)) {
      faults.push(`${manifest.id}: transport binding mode "${binding.mode}" is not one of the shell's modes (${SDK_MODES.join(' | ')})`)
    }
    if (!TRANSPORT_ROWS.includes(binding.row as never)) {
      faults.push(`${manifest.id}: transport binding row "${binding.row}" is not a transport row (${TRANSPORT_ROWS.join(' | ')})`)
    }
    if (!faceIds.has(binding.face)) {
      faults.push(`${manifest.id}: transport binding addresses face "${binding.face}", which the family does not declare`)
      continue
    }
    const device = declaration.devices.find(candidate => candidate.id === binding.face)
    if (device && !device.params?.some(param => param.key === binding.key)) {
      faults.push(`${manifest.id}: transport binding addresses "${binding.face}/${binding.key}", which carries no such §14 row`)
    }
    if (device?.modes && !device.modes.includes(binding.mode)) {
      faults.push(`${manifest.id}: transport binding mode "${binding.mode}" is outside face "${binding.face}"'s mode scope`)
    }
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

  // §12: one product family per product — a declared carving is exclusive;
  // a second family for the same product composes through extensions.
  const productOwners = new Map<string, FamilyManifestId>()
  for (const manifest of allFamilyManifests()) {
    const bound = familyProduct(manifest.id)
    if (!bound) continue
    const prior = productOwners.get(bound)
    if (prior) {
      cross.push(`§12 carving: product "${bound}" is claimed by families "${prior}" and "${manifest.id}" — one product family per product; compose through the declared-extension path instead`)
    } else {
      productOwners.set(bound, manifest.id)
    }
  }

  // Rev 5: one meaning per (mode, row) — two families binding the same
  // transport row in the same mode is a double-booking.
  const rowOwners = new Map<string, FamilyManifestId>()
  for (const binding of allTransportBindings()) {
    const key = `${binding.mode}/${binding.row}`
    const prior = rowOwners.get(key)
    if (prior && prior !== binding.family) {
      cross.push(`transport double-booking: "${key}" is bound by families "${prior}" and "${binding.family}" — one meaning per mode's transport row`)
    } else {
      rowOwners.set(key, binding.family)
    }
  }

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
        (kit.unit ?? kit.range?.unit ?? undefined) === (row.unit ?? undefined) &&
        (kit.writePath ?? undefined) === (row.writePath ?? undefined)
      if (!agreed) {
        cross.push(`kit row "${row.family}/${row.deviceInstance}/${row.key}" contradicts the verified address table — the ownership map stands; align the declaration or re-verify the map`)
      }
    }
  }

  return {byFamily, cross}
}
