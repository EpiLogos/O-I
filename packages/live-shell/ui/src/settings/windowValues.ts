// The Settings window's values (manual §10.10; the catalogue design settings__window.tsx `settings:window`), from the readings the
// window's own code makes (SettingsWorkspace.tsx's engine over the SettingsAdapter, and the page hooks of windowPages.ts). Ported from
// the parked port (7cba70d10) and from what the window drew before it: the rows, the Details and the help aside of SettingsWorkspace.tsx,
// the typed controls of controls.tsx, the pages' readings. Pure: each mapper takes an owner's reading as the adapter hands it and returns
// the design's keys; a key the owner did not report is left out, never filled in. SETTINGS_WINDOW_WIRING classifies every key the design
// reads and every press it makes.
import type {Value} from '../frame/devices/designed'
import type {ChangeSetDocument, ConfigResolution, ContributionMount, PlanBundle, ScopeAddress, SettingsAdapter} from './adapter'
import {basisChanged, categoryOf, displayValue, draftOwnerChanged, editableValue, isSensitiveSetting, rawValue, settingHelp, settingKey, settingWords, tableRepresentation,
  type Draft, type SettingEntry} from './model'
import type {HarnessReading} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import {effectiveChatDefault, shapeHarnessClients} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import type {ProfileDocument} from '../../../../../desktop/cradle/src/configuration/contracts'
import type {SystemCompositionReading} from '../../../../../desktop/cradle/src/workspace/settings/types'
import type {PresentationDocument} from '../../../../../desktop/cradle/src/kernel/types'
import type {MachineConnection, RemoteMachineDeclaration} from './machines'
import type {Invocation, MethodRow, RoutineDetail, RoutineList} from '../../../../../desktop/cradle/src/contributions/automations/client'
import {actionMessage, nextOccurrenceTimes} from '../../../../../desktop/cradle/src/contributions/automations/client'
import type {AdoptionDiscovery, AdoptionState} from '../../../../../desktop/cradle/src/configuration/adoptionController'

export const SETTINGS_WINDOW_ID = 'settings:window'

const json = (value: unknown): string => JSON.stringify(value)
const rec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const txt = (x: unknown): string | undefined => (typeof x === 'string' && x ? x : undefined)
const at = (unixMs: number | null | undefined): string | undefined => (typeof unixMs === 'number' && unixMs > 0 ? new Date(unixMs).toISOString().slice(0, 16).replace('T', ' ') : undefined)

// ---------------------------------------------------------------------------------------------------------------- scopes

const SINGULAR: Readonly<Record<string, string>> = {machine: 'This machine', world: 'World', ground: 'Ground'}
/** A scope in words: the adapter's own title for it, else its kind and subject (SettingsWorkspace.tsx scopeWord). */
export const scopeWords = (scope: ScopeAddress, choices?: SettingsAdapter['scopeChoices']): string =>
  choices?.find(choice => choice.address.scope_kind === scope.scope_kind && choice.address.scope_ref === scope.scope_ref)?.title
    ?? (scope.scope_ref ? `${scope.scope_kind} · ${scope.scope_ref}` : SINGULAR[scope.scope_kind] ?? scope.scope_kind)

/** Every scope the Applies to chooser offers: the adapter's subjects, then the singular kinds and the exact subjects the owners' settings
 * allow (the per-setting chooser in Details offered both: SettingsWorkspace.tsx ScopeControl). */
export function scopeOptions(entries: readonly SettingEntry[], choices: SettingsAdapter['scopeChoices']): {kind: string; ref: string | null; title: string}[] {
  const out = new Map<string, {kind: string; ref: string | null; title: string}>()
  const add = (scope: ScopeAddress) => { const key = json([scope.scope_kind, scope.scope_ref]); if (!out.has(key)) out.set(key, {kind: scope.scope_kind, ref: scope.scope_ref, title: scopeWords(scope, choices)}) }
  for (const choice of choices ?? []) add(choice.address)
  for (const entry of entries) for (const allowed of entry.spec.allowed_scopes)
    if (allowed.scope_ref !== null || SINGULAR[allowed.scope_kind]) add({scope_kind: allowed.scope_kind, scope_ref: allowed.scope_ref})
  return [...out.values()]
}

/** The scope most of these settings stand at: the one a page's Applies to shows. */
export function commonScope(scopes: Readonly<Record<string, ScopeAddress>>, refs?: readonly string[]): ScopeAddress | null {
  const counts = new Map<string, {scope: ScopeAddress; n: number}>()
  for (const [ref, scope] of Object.entries(scopes)) {
    if (refs && !refs.includes(ref)) continue
    const key = json([scope.scope_kind, scope.scope_ref]), was = counts.get(key)
    counts.set(key, {scope, n: (was?.n ?? 0) + 1})
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.scope ?? null
}

// ---------------------------------------------------------------------------------------------------------------- the owners' settings

/** The kind of control a setting's value takes, by its value schema (the design's choice | toggle | number | text | path | list | table |
 * secret). A sensitive setting is a secret whatever its schema: its material stays with the credential owner. Pure. */
export function settingKind(entry: SettingEntry): string {
  if (isSensitiveSetting(entry.spec)) return 'secret'
  const type = entry.spec.value_schema.type
  return type === 'enum' ? 'choice' : type === 'boolean' ? 'toggle' : type === 'number' || type === 'integer' ? 'number' : type === 'table' ? 'table'
    : type === 'list' ? 'list' : type === 'path' ? 'path' : 'text'
}

/** Whether the window may stage a change of the setting at its scope (SettingsWorkspace.tsx's `writable`, unchanged). */
export const writableAt = (entry: SettingEntry, scope: ScopeAddress | undefined): boolean =>
  entry.spec.writable && entry.spec.operations.plan && entry.spec.operations.apply && entry.available && !!scope && !isSensitiveSetting(entry.spec)

const scalar = (value: unknown): Value | undefined => (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined)
/** A secret's reference, as the owner names it (a string, or `{ref}`); never its material. */
const reference = (value: unknown): string | undefined => txt(value) ?? (rec(value) ? txt(value.ref) ?? txt(value.reference) : undefined)

/** The entries of a table or list setting as rows: each table row a record, each list item `{item}`. */
function entryRows(entry: SettingEntry, value: unknown): Record<string, unknown>[] | undefined {
  if (value === undefined || value === null) return undefined
  const raw = rawValue(entry.spec, value)
  if (!Array.isArray(raw)) return undefined
  return entry.spec.value_schema.type === 'list' ? raw.map(item => ({item})) : raw.filter(rec)
}

/** An axis's provenance in words (SettingsWorkspace.tsx provenance, unchanged). */
function provenance(value: unknown): string {
  if (!value) return 'Source not reported'
  if (typeof value === 'string') return value
  return Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') || 'Source not reported'
}

/** Details, as the row's Details panel read them (SettingsWorkspace.tsx): the native identity and its place, your preference, the owner's
 * four axes, your change, the default, the reconciliation, the reading basis, and an unavailable owner's reason. Words only. */
export function settingDetails(entry: SettingEntry, reading: ConfigResolution | undefined, draft: Draft | undefined): Record<string, string> {
  const {spec} = entry, secret = isSensitiveSetting(spec), effective = reading?.native?.effective, staged = reading?.native?.staged
  return {
    identity: spec.setting_ref, where: `${entry.owner} · ${String(spec.native_ref)}`,
    desired: reading?.desired ? displayValue(reading.desired.value, secret) : 'No desired preference reported',
    declared: displayValue(reading?.native?.declared?.value, secret), effective: displayValue(effective?.value, secret), provenance: provenance(effective?.provenance),
    active: displayValue(reading?.native?.active?.value, secret),
    staged: `${displayValue(staged?.value, secret)}${staged ? ` · ${staged.stage_state} · ${staged.stage_ref ?? 'No stage reference reported'}` : ''}`,
    proposed: draft ? displayValue(draft.value ?? draft.raw, secret) : 'No local change',
    default: spec.default !== undefined ? displayValue(spec.default, secret) : spec.default_semantics === 'computed' ? 'Computed by owner' : 'No literal default contributed',
    reconciliation: reading ? `${reading.reconciliation.status}${reading.reconciliation.reason ? ` · ${reading.reconciliation.reason}` : ''}` : 'Not read',
    basis: reading?.native_reading?.reading_digest ?? 'Not reported',
    ...(entry.available ? {} : {connection: entry.reason ?? 'Owner unavailable'}),
  }
}

/** A dependent column waits for its harness: the permission modes a harness advertises (controls.tsx, unchanged). */
const DEPENDS_ON_HARNESS: Readonly<Record<string, string>> = {'ai-kit:permissions:permissions.default-mode': 'mode'}
/** Central's skill standing column carries its own vocabulary (controls.tsx, model.ts validateDraft). */
const STANDING = [{value: 'active', title: 'Active'}, {value: 'retired', title: 'Retired'}]
/** The columns a changed harness drops, so a choice is never carried to another harness (controls.tsx). */
const DEPENDENTS = ['model', 'mode']

/** Each table row's choices by column (SettingsAdapter.choices, read for the row as it stands with your change), or why a dependent column
 * stands closed. Pure. */
export function tableCells(entry: SettingEntry, rows: readonly Record<string, unknown>[], adapter: Pick<SettingsAdapter, 'choices'>): Record<string, {choices?: {value: string; title: string}[]; why?: string}>[] | undefined {
  const schema = entry.spec.value_schema
  if (schema.type !== 'table') return undefined
  type Cell = {choices?: {value: string; title: string}[]; why?: string}
  const cells = rows.map(row => Object.fromEntries(schema.columns.flatMap((column): [string, Cell][] => {
    const choices = entry.spec.setting_ref === 'central:skills:central.skills' && column.name === 'standing' ? STANDING : adapter.choices?.(entry.spec, column.name, row) ?? null
    const dependent = DEPENDS_ON_HARNESS[entry.spec.setting_ref] === column.name
    if (choices?.length) return [[column.name, {choices: choices.map(choice => ({value: choice.value, title: choice.title}))}]]
    if (dependent) return [[column.name, {why: 'Read this harness\'s advertised modes first.'}]]
    if (choices) return [[column.name, {why: 'The owner\'s catalogue for this column is unavailable.'}]]
    return []
  })))
  return cells.some(cell => Object.keys(cell).length) ? cells : undefined
}

/** Every contributed setting at its chosen scope (the design's `settings`): the owner's descriptor (registry), its resolution there
 * (config_resolutions_read), where the value comes from, when a change applies, the help the aside gave, and its Details. Pure. */
export function settingRows(input: {readonly entries: readonly SettingEntry[]; readonly readings: Readonly<Record<string, ConfigResolution>>
  readonly scopes: Readonly<Record<string, ScopeAddress>>; readonly drafts?: Readonly<Record<string, Draft>>; readonly adapter?: Pick<SettingsAdapter, 'choices' | 'scopeChoices'>}): Record<string, unknown>[] {
  const {entries, readings, scopes, drafts = {}, adapter = {}} = input
  return entries.map(entry => {
    const {spec} = entry, scope = scopes[spec.setting_ref], reading = scope ? readings[settingKey(spec.setting_ref, scope)] : undefined
    const draft = scope ? drafts[settingKey(spec.setting_ref, scope)] : undefined
    const kind = settingKind(entry), schema = spec.value_schema
    const value = editableValue(reading) ?? reading?.native?.effective?.value
    const row: Record<string, unknown> = {ref: spec.setting_ref, category: categoryOf(entry), owner: entry.owner, section: spec.section_ref, title: spec.title, kind,
      from: reading ? (reading.native?.declared ? 'here' : 'inherited') : 'unread', timing: spec.effect.kind, writable: writableAt(entry, scope),
      help: settingHelp(spec), words: settingWords(spec, entry.owner), details: settingDetails(entry, reading, draft)}
    if (spec.effect.summary) row.effect = spec.effect.summary
    if (scope) row.at = scopeWords(scope, adapter.scopeChoices)
    if (schema.type === 'enum') row.options = (schema.options ?? []).map(option => ({value: String(option.value), title: option.title ?? String(option.value)}))
    if (schema.type === 'table') row.columns = schema.columns.map(column => ({name: column.name, type: column.type}))
    if (schema.type === 'number' || schema.type === 'integer') row.range = `${schema.minimum ?? '−∞'} – ${schema.maximum ?? '∞'}${schema.type === 'integer' ? ' · whole numbers' : ''}`
    if (schema.type === 'reference' && schema.subject_kind) row.hint = schema.subject_kind
    if (schema.type === 'path') row.hint = 'Native path'
    if (kind === 'table' || kind === 'list') {
      const rows = reading ? entryRows(entry, value) : undefined
      if (rows) row.rows = rows
      if (kind === 'table') {
        const now = Array.isArray(draft?.raw) ? (draft!.raw as unknown[]).filter(rec) : rows ?? []
        const cells = tableCells(entry, now, adapter)
        if (cells) row.cells = cells
        const columns = schema.type === 'table' ? schema.columns.map(column => column.name) : []
        const dropped = DEPENDENTS.filter(name => columns.includes(name))
        if (columns.includes('harness') && dropped.length) row.clears = {harness: dropped}
        if ((draft?.representation ?? tableRepresentation(spec, editableValue(reading) ?? spec.default)) === 'record') row.fixed = true
      }
    } else if (kind === 'secret') { const ref = reference(reading?.native?.effective?.value); if (ref) row.effective = ref }
    else { const now = scalar(value); if (now !== undefined) row.effective = now }
    return row
  })
}

/** The draft at a setting's chosen scope, keyed by its scope (SettingsWorkspace.tsx keys drafts by setting and scope). */
export const draftAt = (drafts: Readonly<Record<string, Draft>>, ref: string, scope: ScopeAddress | undefined): Draft | undefined => (scope ? drafts[settingKey(ref, scope)] : undefined)

/** Your local change of each setting at its chosen scope, as the design holds it: `draft:<ref>`, a JSON string for a list or a table. */
export function draftValues(entries: readonly SettingEntry[], drafts: Readonly<Record<string, Draft>>, scopes: Readonly<Record<string, ScopeAddress>>): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const entry of entries) {
    const draft = draftAt(drafts, entry.spec.setting_ref, scopes[entry.spec.setting_ref])
    if (!draft) continue
    const raw = draft.raw
    values[`draft:${entry.spec.setting_ref}`] = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? raw : json(raw)
  }
  return values
}

/** The drafts whose owner reading or owner connection changed since you made them (model.ts basisChanged, draftOwnerChanged). */
export function conflictRefs(entries: readonly SettingEntry[], drafts: Readonly<Record<string, Draft>>, scopes: Readonly<Record<string, ScopeAddress>>,
  readings: Readonly<Record<string, ConfigResolution>>, ownerEpoch: string | undefined): string[] {
  return entries.flatMap(entry => {
    const scope = scopes[entry.spec.setting_ref], draft = draftAt(drafts, entry.spec.setting_ref, scope)
    const reading = scope ? readings[settingKey(entry.spec.setting_ref, scope)] : undefined
    return draft && ((!!reading && basisChanged(draft, reading)) || draftOwnerChanged(draft, ownerEpoch)) ? [entry.spec.setting_ref] : []
  })
}

/** The owners whose contribution cannot be read, each with its reason (the cards the window drew under every page). */
export function ownerValues(mounts: readonly ContributionMount[]): {owner: string; reason: string}[] {
  return mounts.flatMap(mount => !mount.document || mount.availability.state === 'unavailable'
    ? [{owner: mount.owner_ref, reason: mount.error ?? mount.availability.reason ?? 'Contribution unavailable'}] : [])
}

/** The owners' plans for your local changes (config_plan_reviewed), as the Review page lists them, with the plan's own words for what the
 * change does. */
export function planRows(review: PlanBundle | null, entries: readonly SettingEntry[], choices: SettingsAdapter['scopeChoices']): Record<string, unknown>[] | undefined {
  if (!review) return undefined
  return review.plans.map(plan => ({ref: plan.setting_ref, title: entries.find(entry => entry.spec.setting_ref === plan.setting_ref)?.spec.title ?? plan.setting_ref,
    scope: scopeWords(plan.scope, choices), changes: plan.changes.map(change => change.summary), effect: plan.expected_effect.kind,
    ...(plan.expected_effect.summary ? {summary: plan.expected_effect.summary} : {})}))
}

/** The owners' answer to Apply or Reset (config_apply_reviewed, config_reset), each operation named by its setting's title. */
export const resultValue = (result: ChangeSetDocument | null, entries: readonly SettingEntry[] = []): string | undefined => (result
  ? json({status: result.status, operations: result.operations.map(operation => ({ref: operation.setting_ref,
    title: entries.find(entry => entry.spec.setting_ref === operation.setting_ref)?.spec.title ?? operation.setting_ref, status: operation.status,
    ...(operation.error ? {message: operation.error.message} : {})}))}) : undefined)

/** The window's own readings as the design holds them: the adapter, its scopes, every setting at its scope (absent while the registry is
 * read), the owners that cannot be read, the drafts, conflicts and the settings that stand beside their instrument, the scope most settings
 * stand at and each page's, the plans (kept after Apply, beside the answer), the refusals the owners gave instead of a plan, and the answer.
 * Pure. */
export function windowCoreValues(input: {readonly adapter: Pick<SettingsAdapter, 'kind' | 'label' | 'simulated' | 'scopeChoices' | 'pointOfUseEntries' | 'ownerEpoch' | 'choices'>
  readonly mounts: readonly ContributionMount[]; readonly entries: readonly SettingEntry[]; readonly readings: Readonly<Record<string, ConfigResolution>>
  readonly scopes: Readonly<Record<string, ScopeAddress>>; readonly drafts: Readonly<Record<string, Draft>>; readonly review: PlanBundle | null
  readonly answered: PlanBundle | null; readonly result: ChangeSetDocument | null; readonly loading: boolean; readonly query: string}): Record<string, Value> {
  const {adapter, entries, readings, scopes, drafts, result} = input
  const values: Record<string, Value> = {
    source: json({kind: adapter.kind, label: adapter.label, ...(adapter.simulated ? {simulated: true} : {})}),
    scopes: json(scopeOptions(entries, adapter.scopeChoices)),
    conflicts: json(conflictRefs(entries, drafts, scopes, readings, adapter.ownerEpoch)),
    elsewhere: json((adapter.pointOfUseEntries ?? []).map(entry => ({ref: entry.setting_ref, title: entry.title, where: `its ${entry.destination.kind}`,
      words: `${entry.description} ${entry.synonyms ?? ''}`.trim(), scope: scopeWords(entry.scope, adapter.scopeChoices)}))),
    search: input.query,
    ...draftValues(entries, drafts, scopes),
  }
  if (!input.loading) {
    values.settings = json(settingRows({entries, readings, scopes, drafts, adapter}))
    values.owners = json(ownerValues(input.mounts))
  }
  const scope = commonScope(scopes)
  if (scope) values.scope = json({kind: scope.scope_kind, ref: scope.scope_ref, title: scopeWords(scope, adapter.scopeChoices)})
  const pages: Record<string, unknown> = {}
  for (const category of new Set(entries.map(categoryOf))) {
    const mine = commonScope(scopes, entries.filter(entry => categoryOf(entry) === category).map(entry => entry.spec.setting_ref))
    if (mine) pages[category] = {kind: mine.scope_kind, ref: mine.scope_ref, title: scopeWords(mine, adapter.scopeChoices)}
  }
  if (Object.keys(pages).length) values.pageScopes = json(pages)
  const bundle = input.review ?? input.answered
  const plans = planRows(bundle, entries, adapter.scopeChoices)
  if (plans) values.plans = json(plans)
  if (bundle?.errors.length) values.planErrors = json(bundle.errors.map(error => `${error.error_code}: ${error.message}`))
  const answered = resultValue(result, entries)
  if (answered) values.result = answered
  return values
}

/** Search's keys (↑/↓ move the mark through the results, Enter opens the one marked): the new mark, the result to open, or nothing. Pure. */
export function searchStep(count: number, hit: number, key: string): {hit: number} | {open: number} | null {
  if (count <= 0) return null
  const now = Math.min(Math.max(hit, 0), count - 1)
  if (key === 'ArrowDown') return {hit: Math.min(now + 1, count - 1)}
  if (key === 'ArrowUp') return {hit: Math.max(now - 1, 0)}
  if (key === 'Enter') return {open: now}
  return null
}

// ---------------------------------------------------------------------------------------------------------------- Harnesses & models

/** Harnesses & models (the adapter's HarnessSource over harness_status, model_catalogue and the providers): the providers, the saved
 * default and the one in effect, each harness client, and the catalogue's routes. A section the owner refused stays absent. Pure. */
export function harnessValues(reading: HarnessReading | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (!reading) return values
  if (reading.providers.state === 'ok') {
    values.providers = json(reading.providers.rows.map(row => ({id: row.id, label: row.label})))
    if (reading.defaultState.state === 'ok') {
      const held = reading.heldDefault?.value ?? null
      if (held) values.heldDefault = held
      const effective = effectiveChatDefault(reading.providers.rows, held)
      if (effective) values.effectiveDefault = json(effective)
    }
  }
  if (reading.harnesses.state === 'ok') values.harnesses = json(reading.harnesses.rows.map(row => ({client: row.client, harness: row.harness, installed: row.installed,
    detection: row.detected ? 'detected' : row.detection, ...(row.detection_reason ? {reason: row.detection_reason} : {}), capability: row.capability,
    ...(row.effect ? {effect: row.effect} : {}), ...(folderOf(row.config_dir) ? {folder: folderOf(row.config_dir)} : {}),
    ...(row.adapter_gap ? {gap: {contract: row.adapter_gap.missing_contract, skill: row.adapter_gap.authoring_skill_ref}} : {})})))
  if (reading.catalogue.state === 'ok') values.routes = json(reading.catalogue.rows.entries.map(entry => ({model: entry.model, name: entry.name,
    routes: entry.routes.map(route => ({provider: route.provider, key: route.credential_required}))})))
  return values
}
/** A harness's configuration folder, as the owner names it (its first absolute path; HarnessPreferences.tsx's reveal path). */
export const folderOf = (configDir: string | null): string | undefined => {
  const path = configDir?.split(' (')[0]?.split(' and ')[0]?.trim()
  return path?.startsWith('/') ? path : undefined
}

// ---------------------------------------------------------------------------------------------------------------- Credentials, Profiles, Machines

export interface CredentialRow { readonly credential: string; readonly provider: string; readonly reference: string | null; readonly revoked: boolean; readonly verifiedAt: number | null }
/** AIKit's credential binding metadata (credential_list), each with the verdict a Verify read back. No material enters these values. */
export function credentialValues(rows: readonly CredentialRow[] | null, verdicts: Readonly<Record<string, string>>, found: number | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (rows) values.credentials = json(rows.map(row => ({credential: row.credential, provider: row.provider, ...(row.reference ? {reference: row.reference} : {}), revoked: row.revoked,
    ...(row.verifiedAt ? {verifiedAt: at(row.verifiedAt * 1000)} : {}), ...(verdicts[row.credential] ? {verdict: verdicts[row.credential]} : {})})))
  if (found !== null) values.found = found
  return values
}

/** O:I's named profiles (profile_list): each profile, whether it is active, and the settings it keeps with their scope and value (a secret
 * by its reference only; ProfilePreferences.tsx "Settings in this profile"). */
export function profileValues(reading: {active_profile_ref: string | null; profiles: readonly ProfileDocument[]} | null, isSensitive: (ref: string) => boolean): Record<string, Value> {
  if (!reading) return {}
  return {profiles: json(reading.profiles.map(profile => ({ref: profile.profile_ref, title: profile.title ?? profile.profile_ref, active: profile.profile_ref === reading.active_profile_ref,
    settings: (profile.desired ?? []).map(entry => {
      const scope = `${entry.scope.scope_kind}${entry.scope.scope_ref ? ` · ${entry.scope.scope_ref}` : ''}`
      return isSensitive(entry.setting_ref) || entry.secret_reference ? {ref: entry.setting_ref, title: entry.setting_ref, scope, secret: true}
        : {ref: entry.setting_ref, title: entry.setting_ref, scope, value: displayValue(entry.value)}
    })})))}
}

/** Workcell's machine declarations and connection receipts (RemoteMachinesSource), the control operations a declaration may expect, and the
 * workcell they belong to. */
export function machineValues(machines: readonly RemoteMachineDeclaration[] | null, connections: readonly MachineConnection[] | null,
  allowed: readonly string[] | null, scope: ScopeAddress | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (machines) values.machines = json(machines.map(machine => ({label: machine.label, endpoint: machine.endpoint, ...(machine.credential_ref ? {credential: machine.credential_ref} : {}),
    expects: machine.operations, ...(machine.note ? {note: machine.note} : {})})))
  if (connections) values.connections = json(connections.map(connection => ({label: connection.label, state: connection.state, protocol: connection.protocol,
    ...(connection.remote_software ? {remote: connection.remote_software} : {}), granted: connection.granted_operations,
    ...(at(connection.last_reconciled_at_unix_ms) ? {reconciled: at(connection.last_reconciled_at_unix_ms)} : {}),
    ...(at(connection.expires_at_unix_ms) ? {expires: at(connection.expires_at_unix_ms)} : {}), ...(connection.detail ? {detail: connection.detail} : {})})))
  if (machines && allowed) values.operations = json(allowed)
  if (scope) values.workcell = `Workcell${scope.scope_ref ? ` · ${scope.scope_ref}` : ''}`
  return values
}

// ---------------------------------------------------------------------------------------------------------------- Automations

/** AIKit's routines in the chosen work context (kernel op `routine`: list, methods, history; the chosen routine's show), the harness timers
 * its list reconciles (foreign_reconciliation), the contexts the window can read them in, what a new routine may use, the receipts the
 * chosen routine may be enabled and reproved on, and a creation that waits for its result. Pure. */
export function automationValues(input: {readonly list: RoutineList | null; readonly methods: readonly MethodRow[] | null; readonly history: readonly Invocation[] | null
  readonly detail: RoutineDetail | null; readonly project: string | null; readonly projects?: readonly {ref: string; title: string}[]; readonly options: unknown
  readonly grants?: readonly {ref: string; title: string}[] | null; readonly reproofs?: readonly {ref: string; title: string}[] | null; readonly pending?: string | null}): Record<string, Value> {
  const values: Record<string, Value> = {}
  const {list, methods, history, detail, project} = input
  const contexts = new Map<string, {ref: string; title: string}>([['', {ref: '', title: 'This AIKit home'}]])
  for (const row of input.projects ?? []) contexts.set(row.ref, row)
  if (project && !contexts.has(project)) contexts.set(project, {ref: project, title: project})
  values.contexts = json([...contexts.values()])
  if (list) {
    values.routines = json(list.routines.map(routine => {
      const shown = detail?.routine === routine.routine ? detail : null
      const runs = shown ? nextOccurrenceTimes(shown.next_occurrences) : []
      const text = shown?.method_body ?? methods?.find(row => row.id === routine.method)?.payload
      return {ref: routine.routine, name: routine.name, state: routine.state, when: routine.trigger.kind + (routine.scheduler ? ` · ${routine.scheduler.provider}` : ''), method: routine.method,
        revision: routine.method_revision, verified: routine.state !== 'stale-proof', ...(routine.scheduler ? {scheduler: `${routine.scheduler.provider} · ${routine.scheduler.observed_state}`} : {}),
        ...(shown?.authority ? {unattended: shown.authority.unattended, authority: `${shown.authority.granted ? 'granted' : 'not granted'}${shown.authority.unattended ? ' · unattended' : ''}`} : {}),
        ...(runs[0] ? {next: runs[0], nextRuns: runs.slice(0, 4)} : {}), ...(shown?.occurrence_error ? {nextError: 'The schedule could not be resolved.'} : {}),
        ...(text ? {methodText: text} : {}), ...(shown?.proof ? {proof: shown.proof.proof_ref} : {})}
    }))
    values.timers = json(list.foreign_reconciliation.providers.flatMap(provider => provider.jobs.map(job => ({name: job.name ?? job.job_id, provider: provider.provider,
      adopted: job.reconciled, ...(job.reason ? {reason: job.reason} : {}), ...(job.active ? {} : {when: 'inactive'})}))))
  }
  if (methods) values.methods = json(methods.map(method => ({method: method.id, name: method.name, text: method.payload, active: method.active})))
  if (history) values.history = json(history.map(row => ({at: row.trigger_observed_at, routine: list?.routines.find(routine => routine.routine === row.routine_ref)?.name ?? row.routine_ref,
    ...(row.outcome ? {outcome: row.outcome.status, message: actionMessage({outcome: row.outcome})} : {}), ...(row.provider_deliveries?.length ? {delivery: row.provider_deliveries.map(d => d.provider).join(', ')} : {}),
    detail: [row.invocation_ref, row.method_ref, ...(row.provider_deliveries ?? []).map(d => `${d.provider} ${d.delivery_ref}`)].join(' · ')})))
  if (rec(input.options)) values.options = json(input.options)
  if (input.grants) values.grants = json(input.grants)
  if (input.reproofs) values.reproofs = json(input.reproofs)
  if (input.pending) values.pendingCreation = input.pending
  return values
}

// ---------------------------------------------------------------------------------------------------------------- Appearance, Products, System

/** The presentation owner's saved appearance (presentation_read) with its revision and the renderers' advisory observations, the theme
 * library and the imported themes. */
export function appearanceValues(reading: PresentationDocument | null, library: readonly {id: string; name: string}[] | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (library) values.themes = json(library.map(theme => ({id: theme.id, name: theme.name})))
  if (!reading) return values
  values.theme = json({saved: reading.theme.id ?? reading.theme.appearance, revision: reading.revision, observations: Object.keys(reading.observations ?? {}).length})
  values.imported = json(reading.custom_themes.map(theme => ({id: theme.id, name: theme.name})))
  return values
}

/** Each product's composition mount, what it says of itself, its operations (system_composition_read), and the last operation's answer
 * (product_action_run). */
export function productValues(reading: SystemCompositionReading | null, runnable: (action: NonNullable<SystemCompositionReading['owners'][number]['descriptor']>['actions'][number]) => boolean,
  ran: {product: string; title: string; ok: boolean; at?: string; rows?: [string, unknown][]} | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (reading) values.products = json(reading.owners.map(mount => ({id: mount.product_id, ...(mount.descriptor?.owner.owner_version ? {version: mount.descriptor.owner.owner_version} : {}),
    state: mount.availability, ...(mount.reason ?? mount.error ? {reason: mount.reason ?? mount.error} : {}), ...(mount.descriptor?.about ? {about: mount.descriptor.about} : {}),
    actions: (mount.descriptor?.actions ?? []).filter(action => action.exposure?.ui !== false).map(action => ({ref: action.action_ref, title: action.title, runnable: runnable(action),
      ...(runnable(action) ? {} : {why: action.availability === 'disclosed' ? 'Choose its subject at the point of use.' : action.unavailable_reason ?? 'No native operation available.'})})),
    ...(at(mount.provenance.observed_at_unix_ms) ? {observed: at(mount.provenance.observed_at_unix_ms)} : {}), ...(mount.provenance.digest ? {digest: mount.provenance.digest} : {}),
    degraded: (mount.descriptor?.degradations ?? []).map(d => ({subject: d.subject_ref ?? mount.product_id, state: d.state, ...(d.reason ? {reason: d.reason} : {})})),
    obligations: mount.descriptor?.obligations ?? []})))
  if (ran) values.ran = json(ran)
  return values
}

/** Each owner's System disclosure on its four axes (oi.product-settings-disclosure/v2 through system_composition_read). */
export function systemValues(reading: SystemCompositionReading | null): Record<string, Value> {
  if (!reading) return {}
  return {system: json(reading.owners.flatMap(mount => !mount.descriptor ? [] : [{id: mount.product_id, ...(mount.descriptor.owner.owner_version ? {version: mount.descriptor.owner.owner_version} : {}),
    ...(mount.provenance.digest ? {digest: mount.provenance.digest} : {}), ...(at(mount.provenance.observed_at_unix_ms) ? {observed: at(mount.provenance.observed_at_unix_ms)} : {}),
    settings: mount.descriptor.sections.flatMap(section => section.settings.map(setting => ({section: section.title, key: setting.key, title: setting.title, mutable: setting.mutable === true,
      ...(setting.native_path ? {path: setting.native_path} : {}), drift: setting.drift ?? {state: 'none'},
      ...(setting.kind === 'secret' ? {} : {declared: setting.axes.declared, effective: setting.axes.effective, active: setting.axes.active, staged: setting.axes.staged})})))}]))}
}

// ---------------------------------------------------------------------------------------------------------------- Setup (manual §10.11)

/** One folder Setup's Projects step reads. In the ground's Work (place `work`): work.list's member, its projectcentral.inspect (or the
 * refusal in Central's words), its own material (central.files.list of the folder, hidden entries and ProjectCentral aside) and the
 * parts of its ProjectCentral already there (central.files.list of ProjectCentral). Standing elsewhere under the world's folder (place
 * `elsewhere`): work.candidates's member, with the signals Central found it by (git, agents, claude, wiki, obsidian); Central inspects
 * no ProjectCentral outside its Work, so it has none. */
export interface SetupWorkFolder {readonly name: string; readonly path: string; readonly place?: 'work' | 'elsewhere'; readonly relative?: string; readonly signals?: readonly string[]
  readonly inspection: unknown; readonly material: readonly string[]; readonly parts: readonly string[]
  /** For a project made in a world Setup founded: what its Accept has still to finish — the person's grant and its bounds reaching it
   * (`extension`), Factory's placement (`placement`). Absent or empty: nothing is left. */
  readonly left?: readonly SetupLeft[]}
/** What a project's Accept finishes once it is made (SetupWorkFolder.left). */
export type SetupLeft = 'extension' | 'placement'
/** A preview Setup asked for: the folder and the choices it was asked on, the steps Central would take, in order, and for a folder brought
 * into Work, the digest Central's work.bring is pressed on. */
export interface SetupPreview {readonly folder: string; readonly make: string; readonly where: string; readonly wiki?: string; readonly lines: readonly string[]; readonly digest?: string
  /** Central's preview of extending the person's grant and the ground's bounds to the project (`central.ground.project.preview`). */
  readonly extension?: SetupExtension
  /** Whether Factory keeps the project's runs and pads (`factory_owner` locate), in a world Setup founded. */
  readonly placement?: SetupPlacement}
/** Factory's placement of a project as the Projects step reads it (the kernel's `factory_owner` locate): `absent` (Accept makes it through
 * Factory's own `project setup-central`), `located` (Factory keeps it already), `refused` (Factory said why), `unreached` (Setup reaches no
 * Factory here). */
export interface SetupPlacement {readonly state: 'absent' | 'located' | 'refused' | 'unreached'; readonly project: string; readonly error?: string}
/** What the Projects step says, before Accept, of Factory keeping the project's runs and pads, in plain words. Pure. */
export function setupPlacementLine(name: string, placement: SetupPlacement, bring = false): string {
  const its = possessive(name)
  switch (placement.state) {
    case 'absent': return bring ? `Once it stands in Work as a project, Factory keeps ${its} runs and pads.` : `Factory keeps ${its} runs and pads.`
    case 'located': return `Factory keeps ${its} runs and pads already.`
    case 'refused': return `Factory does not say whether it keeps ${its} runs and pads: ${placement.error ?? 'no reason given'}`
    case 'unreached': return `Setup reaches no Factory here, so ${its} runs and pads are not kept: ${placement.error ?? 'no Factory route'}`
  }
}
/** A name's possessive in plain English: field-notes', atlas', tide's. Pure. */
export const possessive = (name: string): string => (/s$/i.test(name) ? `${name}'` : `${name}'s`)
/** Central's `central.ground.project.preview` as the Projects step reads it (ctrl ground_projects.rs, O-I #740): `absent` (Accept extends
 * the person's grant to the project and makes its Work member writable, on `digest`), `present` (it is theirs already), `hand-authored`
 * or `unfounded` (Central extends nothing: `reason`), or `refused` (Central did not answer: `error`). */
export type SetupExtension =
  | {readonly state: 'absent' | 'present' | 'hand-authored' | 'unfounded' | 'no-ground'; readonly project: string; readonly project_id: string; readonly digest?: string | null; readonly reason?: string | null}
  | {readonly state: 'refused'; readonly project: string; readonly project_id: string; readonly error: string}
/** What the Projects step says, before Accept, of the person's grant and the ground's bounds reaching the project, in plain words: `bring`
 * when the folder comes into Work first, and is yours to act in once it stands there as a project. Pure. */
export function setupExtensionLine(name: string, extension: SetupExtension, bring = false): string {
  switch (extension.state) {
    case 'absent': return bring ? `Once it stands in Work as a project, you act as you in ${name}, and its agents may write inside it.` : `You act as you in ${name}, and its agents may write inside it.`
    case 'present': return `You act as you in ${name} already, and its agents may write inside it.`
    case 'hand-authored': return `You keep your key and your ground's bounds by hand: Central extends neither to ${name}, so you act as you in it only as you grant it yourself.`
    case 'unfounded': return `Your ground keeps no key or bounds of yours yet: accept the Ground step, and ${name} becomes yours to act in.`
    case 'no-ground': return `Make your ground first: ${name} becomes yours to act in once it stands in it.`
    case 'refused': return `Central does not say whether you act as you in ${name}: ${extension.error}`
  }
}
/** The Machines step as Setup reads it: the Workcell this computer answers as (`workcell status --json`: workcell_ref, its source and
 * health, or Workcell's refusal) and the Workcells Central's current machine is bound to (machine.declaration's workcell bindings;
 * none until it is adopted). */
export interface SetupMachine {readonly state: 'read'; readonly workcell: {readonly workcell_ref?: unknown; readonly workcell_ref_source?: unknown; readonly health?: unknown} | {readonly error: string}; readonly bound: readonly string[]}
/** A detected agent tool as the Harnesses and skills step reads it (`aikit client status`): AIKit's client and harness names and its
 * folder. Only the tools AIKit detects on this computer; one that is not installed is not a tool you use. */
export interface SetupHarness {readonly client: string; readonly harness: string; readonly folder?: string}
/** A skill root AIKit discovers (`aikit init`: its label, path, valid skills and problems, and who owns it — foreign, adopted with the
 * procedure that adopted it, or generated with its generation), and the skills `aikit collate --all` names in it. */
export interface SetupSkillRoot {readonly label: string; readonly path: string; readonly skills: number; readonly problems: number; readonly names: readonly string[]
  readonly standing: string; readonly procedure?: string; readonly generation?: string}
/** The Harnesses and skills step: the tools and the skill roots, or AIKit's refusal to read them, in its words. */
export type SetupHarnesses = {readonly state: 'read'; readonly harnesses: readonly SetupHarness[]; readonly roots: readonly SetupSkillRoot[]} | {readonly state: 'refused'; readonly error: string}
/** A key AIKit's discovery finds (`aikit credential discover`, presence only): where it lies and its name, never its value; the credential
 * a binding of it satisfies (AIKit's proposal; none for a name AIKit knows no provider for) and whether that is bound. */
export interface SetupKeyFinding {readonly source: string; readonly location: string; readonly name: string; readonly credential?: string; readonly bound: boolean}
/** A provider a detected tool reaches (`aikit harness auth <harness>`): the variable that carries its key, and its own login in AIKit's
 * words; or AIKit's refusal to say (`unread`). */
export interface SetupHarnessProvider {readonly harness: string; readonly folder?: string; readonly provider: string; readonly envVar?: string; readonly ownLogin?: string; readonly unread?: string}
/** The Credentials step: the keys found, the providers the tools reach and AIKit's bindings (metadata only), or AIKit's refusal. */
export type SetupCredentials = {readonly state: 'read'; readonly findings: readonly SetupKeyFinding[]; readonly providers: readonly SetupHarnessProvider[]; readonly bindings: readonly CredentialRow[]}
  | {readonly state: 'refused'; readonly error: string}
/** What Setup holds: native oi's adoption state for the Ground step (the cradle's AdoptionController snapshot), AIKit for the Harnesses
 * and skills and Credentials steps, Central's Work and the folders of work elsewhere for the Projects step (`elsewhere`: Central's
 * refusal to read them, in its words), Workcell and Central for the Machines step, the preview asked last, and the folder brought into
 * Work last (shown next until you choose another). */
/** Central's reading of the ground's civil-time policy (`central.time.policy.preview`, central.civil-time-adoption-preview/v1): the policy
 * the ground keeps (`recognised`), the one Accept would adopt — this computer's IANA zone, the Day turning at midnight — with the digest
 * Accept is pressed on (`absent`, or `no-ground` before the ground is made), or why Central does not recognise what stands
 * (`unrecognised`). */
export interface CivilTimePreview {readonly state: string; readonly source_path?: string; readonly policy?: {readonly timezone?: unknown; readonly day_boundary_minutes?: unknown} | null
  readonly digest?: string | null; readonly reason?: string | null}
/** The civil-time reading, or Central's refusal to give it, in its words. */
export type SetupCivilTime = {readonly state: 'read'; readonly preview: CivilTimePreview} | {readonly state: 'refused'; readonly error: string}
/** The person's first layer of identity (§10.11, §24.6), read through the identity owner (SetupSource.identity): the identity kept in the
 * ground (its name, date of birth, source and revision, and the profile itself, so a correction is a new revision of the same person),
 * none yet, the owner's refusal, or why this host reaches no identity owner. */
export type SetupBirth = {readonly state: 'read'; readonly kept: {readonly name: string; readonly date: string | null; readonly source_ref: string; readonly revision: string; readonly profile: Readonly<Record<string, unknown>>} | null}
  | {readonly state: 'refused'; readonly error: string} | {readonly state: 'unavailable'; readonly why: string}
/** Central's reading of a founding source the ground keeps or would adopt (`central.ground.placement.preview`): `present` (kept, never
 * replaced), `absent` or `no-ground` (Accept adopts it, on `digest`), with Central's reason; or Central's refusal. */
export type SetupFounding = {readonly state: 'read'; readonly preview: {readonly state: string; readonly digest?: string | null; readonly reason?: string | null}}
  | {readonly state: 'refused'; readonly error: string}
/** The person's key (SetupSource.groundAuthority, the kernel's ground_authority preview): whether this host can keep one here (HOME the
 * world's own folder), why not, and Central's preview of the grant it would keep (`central`: present, absent or no-ground, its digest).
 * It never carries the key, nor its digest. */
export type SetupKey = {readonly state: 'read'; readonly reading: {readonly keeps?: unknown; readonly why?: unknown; readonly central?: {readonly state?: unknown; readonly digest?: unknown; readonly reason?: unknown}}}
  | {readonly state: 'refused'; readonly error: string}
/** The Day's form (SetupSource.groundForm, the kernel's ground_form preview): carried by the ground's O-I project (`state: project`),
 * or Central's preview of keeping the application's own form in the ground (`central`: present, absent or no-ground, its digest). */
export type SetupForm = {readonly state: 'read'; readonly reading: {readonly state?: unknown; readonly carried_by?: unknown; readonly central?: {readonly state?: unknown; readonly digest?: unknown; readonly reason?: unknown}}}
  | {readonly state: 'refused'; readonly error: string}
/** AIKit's disclosure of the agent tools (SetupSource.harnessDisclosure, aikit.harness-disclosure/v1), or its refusal. */
export type SetupDisclosure = {readonly state: 'read'; readonly reading: unknown} | {readonly state: 'refused'; readonly error: string}
export interface SetupSnapshot {
  readonly adoption: Partial<Pick<AdoptionState, 'discovery' | 'plan' | 'error' | 'busy' | 'unresolved'>>
  /** How the ground keeps your days (Central's civil-time policy), once read. */
  readonly civilTime?: SetupCivilTime
  /** The folder and name chosen for the ground (SetupWalk.groundAt): read by native oi's discover; absent, the world's own. */
  readonly groundAt?: {readonly folder: string; readonly name: string}
  readonly birth?: SetupBirth
  readonly disclosure?: SetupDisclosure
  /** The ground's bounds (its root placement policy), once Central is asked. */
  readonly placement?: SetupFounding
  /** The person's key, once the host is asked. */
  readonly key?: SetupKey
  /** The Day's form, once the host is asked. */
  readonly form?: SetupForm
  readonly folders: {readonly state: 'unread'} | {readonly state: 'read'; readonly folders: readonly SetupWorkFolder[]; readonly elsewhere?: string} | {readonly state: 'refused'; readonly error: string}
  readonly plan: SetupPreview | null
  readonly machine?: SetupMachine
  readonly brought?: string | null
  readonly harnesses?: SetupHarnesses
  readonly credentials?: SetupCredentials
}

/** Whether native oi reads the ground as bound and recognised: the Ground step's change is made. Pure. */
export function groundBound(discovery: AdoptionDiscovery | undefined): boolean {
  if (!discovery?.bound_ground || discovery.ground.outcome !== 'recognized') return false
  return [discovery.selected_ground, discovery.ground.canonical_path].includes(discovery.bound_ground)
}

/** The Ground step from native oi's discovery (oi.setup/v1): the ground bound and recognised (accepted), a new one Central would make in
 * the folder chosen, an existing one adopted where it is, or one Central cannot read, named with its reason. A refused read or a blocked
 * plan stands on the row in native oi's words. Undefined before any reading. Pure. */
export function setupGroundStep(adoption: SetupSnapshot['adoption'], civil?: SetupCivilTime, placement?: SetupFounding, key?: SetupKey, form?: SetupForm): Record<string, unknown> | undefined {
  const discovery = adoption.discovery
  if (!discovery) return adoption.error ? {step: 'ground', state: 'found', items: [{name: 'Your ground', why: adoption.error}]} : undefined
  const where = discovery.selected_ground ?? discovery.suggested_ground
  // What the ground keeps beside itself: its days, its bounds, and the person's key (each absent until its owner is asked).
  const founding = [setupDaysItem(civil), setupBoundsItem(placement), setupFormItem(form), setupKeyItem(key)].flatMap(item => (item ? [item] : []))
  if (groundBound(discovery)) {
    // The ground stands; it is accepted once Central keeps its days, its bounds and the key (a reading not taken leaves its standing).
    const kept = (!civil || (civil.state === 'read' && civil.preview.state === 'recognised'))
      && (!placement || (placement.state === 'read' && placement.preview.state === 'present'))
      && (!key || (key.state === 'read' && key.reading.central?.state === 'present'))
      && (!form || (form.state === 'read' && (form.reading.state === 'project' || form.reading.central?.state === 'present')))
    return {step: 'ground', state: kept ? 'accepted' : 'found', items: [{name: 'Your ground', where, change: 'Central keeps it here · nothing in it moved'}, ...founding]}
  }
  const outcome = discovery.ground.outcome
  const item: Record<string, string> = outcome === 'new' ? {name: 'A new ground', where, change: 'Central makes your ground here and checks it · nothing else is made'}
    : outcome === 'recognized' ? {name: 'Your ground', where, change: 'Central adopts it where it is · nothing in it moves'}
      : {name: 'Your ground', where, why: discovery.ground.reason ?? `Central did not recognise ${where} as a ground it can read.`}
  const why = adoption.plan?.blocked.length ? adoption.plan.blocked.join(' ') : adoption.error
  return {step: 'ground', state: 'found', items: [why ? {...item, why} : item, ...founding]}
}

/** The ground's bounds as a row of the Ground step: the root placement policy Accept adopts — what is written in the ground stays inside
 * it, nothing outside it granted (`adopts`) — the one the ground keeps, or why Central keeps none, in its words. Pure. */
export function setupBoundsItem(placement: SetupFounding | undefined): Record<string, unknown> | undefined {
  if (!placement) return undefined
  const where = 'Control/user/placement.json'
  if (placement.state === 'refused') return {name: 'Your ground\'s bounds', where, why: `Central did not say how your ground's bounds are kept: ${placement.error}`}
  const preview = placement.preview
  if (preview.state === 'present') return {name: 'Your ground\'s bounds', where, change: 'Central keeps your ground\'s bounds as they stand'}
  if ((preview.state === 'absent' || preview.state === 'no-ground') && preview.digest)
    return {name: 'Your ground\'s bounds', where, adopts: true, change: 'What is written in your ground stays inside it: Central keeps its bounds, and grants nothing outside it'}
  return {name: 'Your ground\'s bounds', where, why: preview.reason ?? `Central keeps no bounds it recognises here (${preview.state}).`}
}
/** The Day's form as a row of the Ground step (§18.2: today's Day is made from it, and its page reads it where it stands): the one the
 * ground's O-I project carries, the one Central keeps in the ground, the application's own form Accept has Central keep (`adopts`), or
 * why not, in its owner's words. Pure. */
export function setupFormItem(form: SetupForm | undefined): Record<string, unknown> | undefined {
  if (!form) return undefined
  if (form.state === 'refused') return {name: 'Your Day\'s form', why: `Central did not say where your Day's form is kept: ${form.error}`}
  const reading = form.reading, central = reading.central, state = txt(central?.state)
  if (reading.state === 'project') return {name: 'Your Day\'s form', where: txt(reading.carried_by) ?? 'Work/O-I', change: `Today's Day is made from the Day form in ${txt(reading.carried_by) ?? 'Work/O-I'}`}
  const where = 'Control/forms/ql-daily-die.html'
  if (state === 'present') return {name: 'Your Day\'s form', where, change: 'Central keeps the Day\'s form in your ground'}
  if ((state === 'absent' || state === 'no-ground') && txt(central?.digest))
    return {name: 'Your Day\'s form', where, adopts: true, change: 'Central keeps the Day\'s form in your ground, so today\'s Day can be made'}
  return {name: 'Your Day\'s form', where, why: txt(central?.reason) ?? `Central keeps no Day form here (${state ?? 'not said'}).`}
}
/** The person's key as a row of the Ground step (manual §10.11): the key Accept has Central keep, so only you act as you here
 * (`adopts`), the one kept already, or why none can be kept here (this window not a world's own), in the host's words. Pure. */
export function setupKeyItem(key: SetupKey | undefined): Record<string, unknown> | undefined {
  if (!key) return undefined
  const where = 'Control/user/native-action-authority.json'
  if (key.state === 'refused') return {name: 'Your key', where, why: `Central did not say how your key is kept: ${key.error}`}
  const central = key.reading.central, state = txt(central?.state)
  if (state === 'present') return {name: 'Your key', where, change: 'Central keeps your key in this world · only you act as you here'}
  if (key.reading.keeps !== true) return {name: 'Your key', where, why: txt(key.reading.why) ?? 'This window cannot keep a key here.'}
  if ((state === 'absent' || state === 'no-ground') && txt(central?.digest))
    return {name: 'Your key', where, adopts: true, change: 'Central keeps a key in this world so that only you act as you here'}
  return {name: 'Your key', where, why: txt(central?.reason) ?? `Central keeps no key it recognises here (${state ?? 'not said'}).`}
}

/** When the day turns, from a policy's boundary in minutes after local midnight. Pure. */
const turnsAt = (minutes: unknown): string => {
  const at = typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 0 && minutes < 1440 ? minutes : 0
  return at === 0 ? 'midnight' : `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`
}
/** How the ground keeps your days, as a row of the Ground step (manual §10.11, §18.2): the policy Accept adopts — this computer's time
 * zone, turning at midnight (`adopts`: Accept writes it) — the one the ground keeps, or why Central does not keep one, in its words.
 * Undefined before Central is asked. Pure. */
export function setupDaysItem(civil: SetupCivilTime | undefined): Record<string, unknown> | undefined {
  if (!civil) return undefined
  if (civil.state === 'refused') return {name: 'Your days', why: `Central did not say how your days are kept: ${civil.error}`}
  const preview = civil.preview, zone = txt(preview.policy?.timezone), where = preview.source_path ?? 'Control/user/civil-time-policy.json'
  if (preview.state === 'recognised' && zone) return {name: 'Your days', where, change: `Your days follow ${zone} and turn at ${turnsAt(preview.policy?.day_boundary_minutes)} · Central keeps this in your ground`}
  if ((preview.state === 'absent' || preview.state === 'no-ground') && zone && preview.digest)
    return {name: 'Your days', where, adopts: true, change: `Your days follow this computer's time zone, ${zone}, and turn at ${turnsAt(preview.policy?.day_boundary_minutes)}`}
  return {name: 'Your days', where, why: preview.reason ?? `Central does not keep a civil-time policy it recognises here (${preview.state}).`}
}
/** The folder a ground path stands in, and its name. Pure. */
export function groundParts(path: string): {folder: string; name: string} {
  const trimmed = path.replace(/\/+$/, ''), at = trimmed.lastIndexOf('/')
  return at <= 0 ? {folder: at === 0 ? '/' : '', name: trimmed.slice(at + 1)} : {folder: trimmed.slice(0, at), name: trimmed.slice(at + 1)}
}
/** A ground's path, from its folder and name. Pure. */
export const groundPath = (folder: string, name: string): string => (folder === '/' ? `/${name}` : `${folder.replace(/\/+$/, '')}/${name}`)
/** Why a name cannot be a ground's (a single visible folder name), or null. Pure. */
export function groundNameRefusal(name: string): string | null {
  return !name.trim() || name !== name.trim() || /[\/\\\u0000]/.test(name) || name.startsWith('.')
    ? 'A ground\'s name is one folder name: not empty, without / and not starting with a dot.' : null
}

const PC_PARTS = ['user', 'agents', 'wiki', 'now'] as const
/** A folder as the Projects step draws it: what Central finds there (projectcentral.inspect: no wiki, one, several, a ProjectCentral
 * it cannot read, or the ground in place), the wikis a folder keeps to adopt, its material and the ProjectCentral parts already there.
 * A folder elsewhere is what work.candidates found: an OKF wiki at its top (`wiki.json`), or none; nothing of ProjectCentral. Pure. */
export function setupFolder(row: SetupWorkFolder): Record<string, unknown> {
  if (row.place === 'elsewhere') {
    const wikis = row.signals?.includes('wiki') ? ['wiki.json'] : []
    return {path: row.path, title: row.name, place: 'elsewhere', finds: wikis.length ? 'one' : 'none', wikis, material: [...row.material], central: []}
  }
  const inspection = rec(row.inspection) ? row.inspection : {}
  const errors = Array.isArray(inspection.manifest_errors) ? inspection.manifest_errors : []
  const manifest = rec(inspection.manifest) ? inspection.manifest : null
  const candidates = (Array.isArray(inspection.wiki_candidates) ? inspection.wiki_candidates : []).flatMap(row => (rec(row) && txt(row.source) ? [txt(row.source)!] : []))
  const finds = !txt(inspection.outcome) || errors.length || (manifest && inspection.outcome !== 'already_conformant') ? 'unreadable'
    : inspection.outcome === 'already_conformant' ? 'ground' : !candidates.length ? 'none' : candidates.length === 1 ? 'one' : 'many'
  const central = PC_PARTS.filter(part => (part === 'wiki' ? !!manifest && rec(manifest.wiki) : row.parts.includes(part)))
  return {path: row.path, title: row.name, place: 'work', finds, wikis: finds === 'ground' || finds === 'unreadable' ? [] : candidates, material: [...row.material], central,
    ...(finds === 'ground' && row.left?.length ? {left: [...row.left]} : {})}
}

/** The choices the Projects step stands on, as the design reads them: the folder shown (the one you chose, else the one brought into
 * Work last, else the first), what to make, where (a folder of Work where it stands; a folder elsewhere Into Work, since Central keeps a
 * project in its Work), and the wiki (the folder's one, else the one you chose). Pure. */
export function setupChoice(folders: readonly Record<string, unknown>[], held: (key: string) => Value | undefined, brought?: string | null): {folder?: string; make?: string; where: string; wiki?: string} {
  const chosen = txt(held('folder')) ?? txt(brought), folder = folders.find(f => f.path === chosen) ?? folders[0]
  const wikis = Array.isArray(folder?.wikis) ? folder!.wikis as string[] : []
  const wiki = wikis.length === 1 ? wikis[0] : txt(held('wiki'))
  const where = txt(held('where')) ?? (folder?.place === 'elsewhere' ? 'work' : 'stands')
  return {...(txt(folder?.path) ? {folder: txt(folder!.path)} : {}), ...(txt(held('make')) ? {make: txt(held('make'))} : {}), where, ...(wiki ? {wiki} : {})}
}

/** The Machines step (manual §10.11: "Makes this computer a workcell") from Workcell and Central: this computer as the Workcell it
 * answers as, accepted once Central's current machine is bound to that Workcell; a binding to another Workcell, or a refusal, named in
 * its owner's words. Undefined before it is read. Pure. */
export function setupMachineStep(machine: SetupMachine | undefined): Record<string, unknown> | undefined {
  if (!machine) return undefined
  const workcell = machine.workcell
  if ('error' in workcell) return {step: 'machines', state: 'found', items: [{name: 'This computer', why: `Workcell did not say which Workcell this computer is: ${workcell.error}`}]}
  const ref = txt(workcell.workcell_ref)
  if (!ref) return {step: 'machines', state: 'found', items: [{name: 'This computer', why: 'Workcell\'s status names no Workcell for this computer.'}]}
  if (machine.bound.includes(ref)) return {step: 'machines', state: 'accepted', items: [{name: 'This computer', where: ref, change: `Central's current machine is bound to Workcell ${ref}`}]}
  const item: Record<string, string> = {name: 'This computer', where: ref, change: `Central adopts this computer as your current machine, bound to Workcell ${ref}${txt(workcell.workcell_ref_source) ? ` (Workcell's ${txt(workcell.workcell_ref_source)} identity)` : ''}`}
  if (machine.bound.length) item.why = `Central's current machine is bound to ${machine.bound.join(', ')}, not to ${ref}: resolve the binding in Control/machines/current.json first. Nothing is rebound.`
  return {step: 'machines', state: 'found', items: [item]}
}

/** The tools AIKit detects on this computer, from its client status (harnessSource.ts shapeHarnessClients): each one's client, harness and
 * folder. A tool AIKit does not detect is not one you use. Pure. */
export function setupHarnessClients(status: unknown): SetupHarness[] {
  return shapeHarnessClients(status).filter(row => row.detected).map(row => ({client: row.client, harness: row.harness, ...(folderOf(row.config_dir) ? {folder: folderOf(row.config_dir)} : {})}))
}

/** The skill roots AIKit discovers (`aikit init`'s roots), each with who owns it as init names it (`ownership`: foreign, adopted with its
 * `procedure`, or generated with its `generation`) and the skills `aikit collate --all` names under its label. A root init names no
 * ownership for stands `unknown`. Pure. */
export function setupSkillRoots(init: unknown, collate: unknown): SetupSkillRoot[] {
  const roots = rec(init) && Array.isArray(init.roots) ? init.roots.filter(rec) : []
  const clusters = rec(collate) && Array.isArray(collate.clusters) ? collate.clusters.filter(rec) : []
  return roots.flatMap((root): SetupSkillRoot[] => {
    const label = txt(root.label), path = txt(root.path)
    if (!label || !path) return []
    const names = clusters.filter(cluster => Array.isArray(cluster.where) && cluster.where.some(where => rec(where) && where.root === label)).flatMap(cluster => (txt(cluster.name) ? [cluster.name as string] : []))
    const ownership = txt(root.ownership), procedure = txt(root.procedure), generation = txt(root.generation)
    return [{label, path, skills: typeof root.skills === 'number' ? root.skills : 0, problems: typeof root.problems === 'number' ? root.problems : 0, names: [...names].sort(),
      standing: ownership && ['foreign', 'adopted', 'generated'].includes(ownership) ? ownership : 'unknown', ...(procedure ? {procedure} : {}), ...(generation ? {generation} : {})}]
  })
}
/** The namespace a root's skills are adopted under: AIKit's own label for the root, without its @ (`@claude` → `skill/claude/…`). */
export const setupNamespace = (root: Pick<SetupSkillRoot, 'label'>): string => root.label.replace(/^@/, '')
const SETUP_HELD = new Set(['adopted', 'generated'])
const skillsWord = (n: number) => `${n} skill${n === 1 ? '' : 's'}`

/** The Harnesses and skills step (manual §10.11: "Each agent tool you use, with its settings, its instructions and its skills"): each skill
 * root under the tool whose folder holds it (else under AIKit's label for it), the change Accept makes — AIKit adopts its skills, and the
 * tool reads them where they were, its settings and instructions as they are — or, once AIKit holds the root, that it does. A tool with
 * no skills, and a root AIKit cannot place, are named and left alone. Accepted once AIKit holds every root that keeps skills. Pure. */
export function setupHarnessStep(reading: SetupHarnesses | undefined, disclosure?: SetupDisclosure): Record<string, unknown> | undefined {
  if (!reading) return undefined
  if (reading.state === 'refused') return {step: 'harnesses', state: 'found', items: [{name: 'Your agent tools', why: reading.error}]}
  const ownerOf = (root: SetupSkillRoot) => reading.harnesses.find(tool => tool.folder && (root.path === tool.folder || root.path.startsWith(`${tool.folder}/`)))
  const items: Record<string, unknown>[] = reading.roots.map(root => {
    const tool = ownerOf(root), name = tool?.harness ?? root.label, by = tool?.harness ?? 'The tool'
    const listed = root.names.length ? ` (${root.names.join(', ')})` : ''
    if (!root.skills) return {name, where: root.path, why: 'It keeps no skills AIKit can read: nothing to adopt.'}
    if (SETUP_HELD.has(root.standing)) return {name, where: root.path,
      change: `AIKit holds its ${skillsWord(root.skills)}${listed} (${root.standing}${root.procedure ? ` · procedure ${root.procedure}` : root.generation ? ` · generation ${root.generation}` : ''}) · ${by} reads them where they were`}
    if (root.standing !== 'foreign') return {name, where: root.path, why: `AIKit does not say whether it holds these skills (aikit init names no ownership for ${root.label}): they are left as they are.`}
    return {name, where: root.path, change: `AIKit adopts its ${skillsWord(root.skills)}${listed} as skill/${setupNamespace(root)}/… · ${by} reads them where they were · its settings and instructions stay as they are${root.problems ? ` · AIKit names ${root.problems} entr${root.problems === 1 ? 'y' : 'ies'} it cannot read` : ''}`}
  })
  for (const tool of reading.harnesses) if (!reading.roots.some(root => ownerOf(root) === tool)) items.push({name: tool.harness, where: tool.folder ?? tool.client, why: 'It keeps no skills here: nothing to adopt. Its settings stay as they are.'})
  const keeping = reading.roots.filter(root => root.skills > 0)
  // What AIKit reads of each tool besides its skills (its disclosure): its instructions, settings and models; or why it said nothing.
  const tools = disclosure?.state === 'read' ? reading.harnesses.flatMap(tool => { const row = setupToolDisclosure(disclosure.reading, tool); return row ? [row] : [] }) : []
  const said = disclosure?.state === 'refused' ? {disclosure: `AIKit did not say what it reads of each tool's settings and instructions: ${disclosure.error}`} : {}
  // Nothing to bring in is done (manual §10.11: what you leave out is not shown as missing), and says so.
  if (!keeping.length) return {step: 'harnesses', state: 'accepted', items, tools, ...said,
    said: `Nothing to bring in: ${reading.harnesses.length ? 'no agent tool here keeps skills AIKit can adopt' : 'AIKit finds no agent tool on this computer'}. Each tool stays as it is.`}
  return {step: 'harnesses', state: keeping.every(root => SETUP_HELD.has(root.standing)) ? 'accepted' : 'found', items, tools, ...said}
}
/** What AIKit's disclosure says of one detected tool (aikit.harness-disclosure/v1, its profile by the tool's harness name): where its
 * instructions lie (the guidance layer), where its settings lie, the providers its models reach. AIKit names where these lie, not what they
 * hold: the model a tool uses is named as not read, and left as it is. Undefined where AIKit discloses no profile for it. Pure. */
export function setupToolDisclosure(reading: unknown, tool: SetupHarness): Record<string, unknown> | undefined {
  const profiles = rec(reading) && Array.isArray(reading.profiles) ? reading.profiles.filter(rec) : []
  const profile = profiles.find(row => rec(row.disclosure) && row.disclosure.slug === tool.harness)
  const layers = profile && rec(profile.disclosure) && Array.isArray(profile.disclosure.layers) ? profile.disclosure.layers.filter(rec) : null
  if (!layers) return undefined
  const native = (name: string) => layers.filter(layer => layer.layer === name).flatMap(layer => (Array.isArray(layer.native) ? layer.native.filter(rec).flatMap(row => (txt(row.name) ? [row.name as string] : [])) : []))
  const auth = layers.filter(layer => layer.layer === 'models').flatMap(layer => (rec(layer.auth) ? Object.values(layer.auth).flatMap(rows => (Array.isArray(rows) ? rows.filter(rec) : [])) : []))
  const models = [...new Set(auth.flatMap(row => (txt(row.provider_ref) ? [(row.provider_ref as string).replace(/^provider:/, '')] : [])))]
  return {harness: tool.harness, ...(tool.folder ? {folder: tool.folder} : {}), instructions: native('guidance'), settings: native('settings'), models,
    unread: `AIKit reads where ${tool.harness}'s settings lie, not what they hold: the model it uses is not read here, and is left as it is.`}
}

/** AIKit's discovery findings (`aikit credential discover`): each key's source, place and name, the credential AIKit proposes for it, and
 * whether that is bound. Discovery is presence only; there is no field a value could travel in. Pure. */
export function setupKeyFindings(discover: unknown): SetupKeyFinding[] {
  const findings = rec(discover) && Array.isArray(discover.findings) ? discover.findings.filter(rec) : []
  return findings.flatMap((row): SetupKeyFinding[] => {
    const location = txt(row.location), name = txt(row.name)
    if (!location || !name) return []
    return [{source: txt(row.source) ?? 'unknown', location, name, ...(txt(row.proposed_credential_ref) ? {credential: row.proposed_credential_ref as string} : {}), bound: row.already_bound === true}]
  })
}
/** The providers a detected tool reaches, from AIKit's auth options for it (`aikit harness auth <harness>`: the variable that carries each
 * provider's key, and the tool's own login in AIKit's words), by provider. Pure. */
export function setupHarnessProviders(tool: SetupHarness, auth: unknown): SetupHarnessProvider[] {
  const rows = (key: string) => (rec(auth) && Array.isArray(auth[key]) ? (auth[key] as unknown[]).filter(rec) : [])
  const provider = (row: Record<string, unknown>) => txt(row.provider_ref)?.replace(/^provider:/, '')
  const names = [...new Set([...rows('env_var'), ...rows('own_login')].flatMap(row => (provider(row) ? [provider(row)!] : [])))]
  return names.map(name => {
    const envVar = txt(rows('env_var').find(row => provider(row) === name)?.env_var), ownLogin = txt(rows('own_login').find(row => provider(row) === name)?.note)
    return {harness: tool.harness, ...(tool.folder ? {folder: tool.folder} : {}), provider: name, ...(envVar ? {envVar} : {}), ...(ownLogin ? {ownLogin} : {})}
  })
}
/** The credential a provider's key binds as (AIKit's own convention, `credential:<provider>`: discovery proposes it, client status names it). */
const credentialFor = (provider: string) => `credential:${provider}`
/** The schemes of a stored-secret reference AIKit declares (`aikit credential setup --ref`): a place in a store, never a key. */
export const SECRET_REFERENCE = /^(keychain|op|pass|varlock):\/\/\S+$/

/** The Credentials step (manual §10.11: "Where each provider's key lies: the place, never the value"; Accept "binds each key by
 * reference"): each key AIKit found, where it lies and the binding Accept makes of it by the reference you give (the one you chose shows
 * it), or that it is bound and to what; a name AIKit knows no provider for is left as it is; each provider a detected tool reaches that no
 * key or binding covers is named with how the tool reaches it (its own login, in AIKit's words) and left alone; a binding AIKit keeps
 * that no finding shows stands as bound. Accepted once a key is bound and none found waits. Pure. */
export function setupCredentialStep(reading: SetupCredentials | undefined, held: (key: string) => Value | undefined): Record<string, unknown> | undefined {
  if (!reading) return undefined
  if (reading.state === 'refused') return {step: 'credentials', state: 'found', items: [{name: 'Your keys', why: reading.error}]}
  const bound = new Map(reading.bindings.filter(row => !row.revoked).map(row => [row.credential, row.reference]))
  const open = reading.findings.filter(row => row.credential && !row.bound && !bound.has(row.credential))
  const chosen = txt(held('credential')) ?? open[0]?.credential, reference = txt(held('reference'))
  const items: Record<string, unknown>[] = reading.findings.map(row => {
    if (!row.credential) return {name: row.name, where: row.location, why: `AIKit knows no provider for ${row.name}: it is left as it is.`}
    if (row.bound || bound.has(row.credential)) return {name: row.name, where: row.location, credential: row.credential, bound: true,
      change: `${row.credential} is bound by reference${bound.get(row.credential) ? ` to ${bound.get(row.credential)}` : ''} · the key stays where it lies`}
    return {name: row.name, where: row.location, credential: row.credential,
      change: `AIKit binds ${row.credential} ${row.credential === chosen && reference ? `to ${reference}` : 'by the reference you give'} · the key stays where it lies; the DLW never shows it and never keeps it`}
  })
  const covered = new Set([...reading.findings.flatMap(row => (row.credential ? [row.credential] : [])), ...bound.keys()])
  for (const [credential, where] of bound) if (!reading.findings.some(row => row.credential === credential))
    items.push({name: credential, where: where ?? credential, credential, bound: true, change: `bound by reference${where ? ` to ${where}` : ''}`})
  for (const provider of reading.providers) {
    if (provider.unread) { items.push({name: provider.harness, where: provider.folder ?? provider.harness, why: provider.unread}); continue }
    if (covered.has(credentialFor(provider.provider))) continue
    covered.add(credentialFor(provider.provider))
    items.push({name: `${provider.provider} for ${provider.harness}`, where: provider.folder ?? provider.harness,
      why: provider.ownLogin ?? `No key for it lies on this computer${provider.envVar ? ` (${provider.envVar} is not set)` : ''}.`})
  }
  // Nothing waiting to be bound is done (manual §10.11: what you leave out is not shown as missing), and says so.
  if (!open.length) return {step: 'credentials', state: 'accepted', items, ...(bound.size ? {} : {said: 'Nothing to bind: AIKit finds no provider\'s key waiting on this computer. Each tool keeps its own login.'})}
  return {step: 'credentials', state: 'found', items}
}

/** Setup's values (the design's setup, folders and setupPlan): the Ground step from native oi; Harnesses and skills and Credentials from
 * AIKit; Machines from Workcell and Central; once there is a ground, the Projects step from Central's Work, accepted once a project
 * stands with its ground; the preview, only for the choices it was asked on. A step not read yet stands absent. Pure. */
export function setupValues(snapshot: SetupSnapshot, held: (key: string) => Value | undefined): Record<string, Value> {
  const values: Record<string, Value> = {}
  const steps: Record<string, unknown>[] = []
  const ground = setupGroundStep(snapshot.adoption, snapshot.civilTime, snapshot.placement, snapshot.key, snapshot.form)
  const discovery = snapshot.adoption.discovery
  if (ground && discovery && !groundBound(discovery)) {
    // The folder and name of a ground to make (§10.11: "makes a new one in the folder you choose, under the name you give it"): the ones
    // chosen, else where native oi reads it; a name you typed stands for the row until it is read.
    const read = groundParts(discovery.selected_ground ?? discovery.suggested_ground), at = snapshot.groundAt ?? read
    const folder = txt(held('groundFolder')) ?? at.folder, name = txt(held('groundName')) ?? at.name
    if (!txt(held('groundFolder'))) values.groundFolder = at.folder
    if (!txt(held('groundName'))) values.groundName = at.name
    const items = ground.items as Record<string, unknown>[]
    const where = groundPath(folder, name), refusal = groundNameRefusal(name) ?? (folder.startsWith('/') ? null : 'A ground\'s folder is a full path, from /.')
    if (items[0] && refusal) items[0] = {name: 'Your ground', where, why: refusal}
    else if (items[0] && where !== items[0].where) items[0] = {name: 'Your ground', where, why: `Not read yet: Setup reads ${where} before Accept makes anything.`}
  }
  if (ground) steps.push(ground)
  if (discovery && groundBound(discovery) && snapshot.birth) {
    // Once the ground is made, your date of birth (§10.11): kept, not given yet (never shown as missing), or why it cannot be kept here.
    const birth = snapshot.birth
    values.birth = json(birth.state === 'read' ? (birth.kept ? {state: 'kept', name: birth.kept.name, date: birth.kept.date} : {state: 'absent'})
      : birth.state === 'refused' ? {state: 'refused', why: birth.error} : {state: 'unavailable', why: birth.why})
    if (birth.state === 'read' && birth.kept) {
      if (!txt(held('birthName'))) values.birthName = birth.kept.name
      if (!txt(held('birthDate')) && birth.kept.date) values.birthDate = birth.kept.date
    }
  }
  const harnesses = setupHarnessStep(snapshot.harnesses, snapshot.disclosure)
  if (harnesses) steps.push(harnesses)
  const credentials = setupCredentialStep(snapshot.credentials, held)
  if (credentials) steps.push(credentials)
  const machines = setupMachineStep(snapshot.machine)
  if (machines) steps.push(machines)
  if (snapshot.folders.state === 'read') {
    const folders = snapshot.folders.folders.map(setupFolder)
    values.folders = json(folders)
    const elsewhere = snapshot.folders.elsewhere
    // Accepted once a project stands with its ground and nothing is left to finish on it.
    steps.push({step: 'projects', state: folders.some(folder => folder.finds === 'ground' && !folder.left) ? 'accepted' : 'found', items: elsewhere ? [{name: 'Folders of work elsewhere', why: elsewhere}] : []})
    const plan = snapshot.plan, choice = setupChoice(folders, held, snapshot.brought)
    // Defaults the design reads where you chose nothing: the folder brought in last, and a folder elsewhere comes Into Work.
    if (!txt(held('folder')) && choice.folder && choice.folder === txt(snapshot.brought)) values.folder = choice.folder
    if (!txt(held('where')) && choice.where === 'work') values.where = 'work'
    // A preview stands only for the choices it was asked on; bringing a folder in is asked on the folder and where alone.
    if (plan && plan.folder === choice.folder && plan.where === choice.where && (plan.make === 'bring' || (plan.make === choice.make && plan.wiki === choice.wiki))) values.setupPlan = json(plan.lines)
  }
  if (steps.length) values.setup = json(steps)
  return values
}

// ---------------------------------------------------------------------------------------------------------------- the classification

/** A page's capability this adapter does not carry (the development and unavailable adapters carry few; native/configuration.ts binds them). */
const NO = (what: string, capability: string) => `${what}: this settings adapter carries no ${capability} (src/settings/adapter.ts SettingsAdapter.${capability}).`
export const NO_HARNESS = NO('Harnesses & models', 'harnesses')
export const NO_INVOKE = (what: string) => NO(what, 'invoke')
export const NO_PROFILES = NO('Profiles', 'profiles')
export const NO_MACHINES = NO('Remote machines', 'remoteMachines')
export const NO_PRODUCTS = NO('Products and System', 'readProducts')
export const NO_VISUALS = NO('Opening', 'visualPreferences')
export const NO_AUTHORING = NO('Making and enabling a routine', 'routineAuthoring')
export const NO_NAVIGATE = (what: string) => `${what} stands beside its instrument, and this window reaches no other place from here (SettingsAdapter.navigate).`
export const NO_WORKCELL_SECRETS = 'Workcell\'s secret references, projections and scan (`workcell system --json` keys.references, `workcell secret projections`, `workcell secret scan`): no kernel route reaches them yet (T-COVERAGE §1.2).'
export const NO_SECURE_FIELD = 'Enter key: a write-only key goes to the native host\'s own secure field, never through the window; no host qualifies that capability here (SettingsAdapter.canEnterCredentialMaterial).'
export const NO_STANDING = 'A route\'s standing (unproven, observed, usable) is AIKit\'s model field (`aikit model-catalogue show`), which model_catalogue does not carry yet.'
export const NO_SETUP_SOURCE = NO('Setup', 'setup')
/** Why Setup's AIKit steps stand unread where the host hands Setup no AIKit (SetupSource.aikit). */
export const NO_SETUP_AIKIT = 'Setup reaches no AIKit here (SetupSource.aikit): Harnesses and skills and Credentials are AIKit\'s.'

/** Every key the design reads or presses, by where it stands. */
export const SETTINGS_WINDOW_WIRING = {
  reads: {
    source: 'the settings adapter itself: kind, label, simulated (SettingsAdapter)',
    scopes: 'the subjects a setting can apply to (SettingsAdapter.scopeChoices, and the scopes the owners\' settings allow)',
    settings: 'every owner\'s contributed setting (config_registry_read) at its scope (config_resolutions_read), with its help and Details',
    owners: 'the owners whose contribution cannot be read, with their reason (config_registry_read mounts)',
    pageScopes: 'the scope most of a page\'s settings stand at',
    conflicts: 'drafts whose owner reading or connection changed (model.ts basisChanged, draftOwnerChanged)',
    elsewhere: 'the settings whose editor stands beside its instrument (SettingsAdapter.pointOfUseEntries)',
    plans: 'the owners\' plans for your local changes (config_plan_reviewed), kept beside their answer after Apply',
    planErrors: 'what the owners refused instead of planning (config_plan_reviewed errors)',
    result: 'the owners\' answer to Apply or Reset (config_apply_reviewed, config_reset)',
    back: 'the name of the work Settings returns to (SettingsRequest.returnLabel)',
    providers: 'the configured providers (HarnessSource.read: the encounter providers)', heldDefault: 'the saved chat default (HarnessSource.read)',
    effectiveDefault: 'the provider new chats use, and its rule (harnessSource.ts effectiveChatDefault)', harnesses: 'each harness client (harness_status: aikit client status)',
    routes: 'the catalogue\'s declared routes (model_catalogue)', credentials: 'AIKit\'s credential binding metadata (credential_list), each Verify\'s verdict (credential_verify)',
    found: 'keys discovery found (credential_discover, presence only)', profiles: 'O:I\'s named profiles (SettingsAdapter.profiles listProfiles)',
    machines: 'Workcell\'s machine declarations (RemoteMachinesSource.readMachines)', connections: 'its connection receipts (RemoteMachinesSource.readConnections)',
    operations: 'the control operations a declaration may expect (RemoteMachinesSource.allowedOperations)', workcell: 'the workcell the machines belong to (RemoteMachinesSource.scope)',
    routines: 'AIKit\'s routines (kernel op routine: list; the chosen one\'s show)', methods: 'the Methods with a verified run (routine: methods)', history: 'each invocation (routine: history)',
    timers: 'the harness timers AIKit\'s routine list reconciles (routine: list foreign_reconciliation)',
    options: 'what a new routine may use (RoutineAuthoringSource.options)', contexts: 'the work contexts routines are read in: this AIKit home, or a project',
    grants: 'the authorities the chosen routine may be enabled under (RoutineAuthoringSource.options)', reproofs: 'the verified runs the chosen routine may be reproved on (RoutineAuthoringSource.options)',
    pendingCreation: 'a creation AIKit has not acknowledged yet (RoutineAuthoringSource.create pending)',
    theme: 'the saved appearance, its revision and the renderers\' observations (presentation_read); the theme you choose is the setting oi:presentation:theme, a local change like every owner\'s', themes: 'the theme library (SettingsAdapter.themeLibrary, else the design system\'s themes)',
    imported: 'the imported themes (presentation_read custom_themes)',
    visualLayer: 'the renderer\'s visual layer (SettingsAdapter.visualPreferences)', welcome: 'the renderer\'s welcome scene (SettingsAdapter.visualPreferences)',
    products: 'each product\'s mount and operations (system_composition_read)', ran: 'the last operation\'s answer (product_action_run)',
    system: 'each owner\'s System disclosure on its four axes (system_composition_read)',
    setup: 'Setup\'s steps (manual §10.11): Ground from native oi\'s adoption (the kernel op `setup`: status and discover) and Central\'s civil-time preview (central.time.policy.preview: how your days are kept), its bounds (central.ground.placement.preview), its Day\'s form (SetupSource.groundForm: the kernel\'s ground_form preview, carried by the ground\'s O-I project or kept in Control/forms) and the person\'s key (SetupSource.groundAuthority: the kernel\'s ground_authority preview, never the key), accepted once the ground is bound and recognised and Central keeps its days, bounds, Day form and key; Harnesses and skills also show what AIKit discloses of each tool (SetupSource.harnessDisclosure: aikit harness disclose), and a step with nothing to adopt or bind is accepted and says so; Machines from Workcell\'s status (op workcell_status_read) and Central\'s machine.declaration of role current, accepted once that binds the Workcell this computer answers as; Projects from Central\'s Work, accepted once a project stands with its ground. Harnesses and skills from AIKit: the tools its client status detects (op harness_status), the skill roots aikit init discovers (aikit_read init) with who owns each (its ownership: foreign, adopted, generated), and the skills aikit collate --all names in each, accepted once AIKit holds every root that keeps skills. Credentials from AIKit: where aikit credential discover finds each key (presence only), the providers aikit harness auth names for each detected tool (op harness_auth_describe) and the bindings aikit credential list keeps (metadata only), accepted once a key is bound and none found waits; items carry the credential a row binds, and bound',
    folders: 'the folders of the ground\'s Work (Central work.list), each with Central\'s projectcentral.inspect, its material and its ProjectCentral parts (central.files.list); then the folders of work that stand elsewhere under the world\'s folder (Central work.candidates)',
    groundFolder: 'the folder the Ground step would make your ground in: the one chosen (the system\'s chooser, then native oi\'s discover with it), else the folder native oi reads the world\'s ground in',
    birth: 'your name and date of birth as the identity owner keeps them (SetupSource.identity: the kernel\'s nara_identity list and open), once the ground is made; absent until you give them, never shown as missing',
    setupPlan: 'the preview of the folder and choices shown: Central\'s projectcentral.adopt.preview or projectcentral.migrate.preview operations; for Create, the inspection Central plans projectcentral.init on; for a folder elsewhere, Central\'s work.bring.preview',
  },
  writes: {
    plan: 'config_plan_reviewed, and the presentation owner\'s plan of a theme change (presentation_read on the basis it was made on; settings/presentationSetting.ts)', apply: 'config_apply_reviewed, and theme_apply for the presentation owner\'s plan', reset: 'config_reset on the reading digest', keep: 'the draft re-based on the current reading (the window\'s own)',
    discard: 'every local change dropped (the window\'s own)', returnToWork: 'the work Settings was opened from (the host\'s return)',
    reread: 'the owners read again: config_registry_read, config_resolutions_read and every opened page\'s reading',
    applyDefault: 'HarnessSource.holdDefault', restoreDefault: 'HarnessSource.discardDefault', install: 'client_install',
    reveal: 'settings_reveal', signIn: 'the conversation\'s connection control (SettingsAdapter.navigate)', discover: 'credential_discover', verify: 'credential_verify',
    rotate: 'credential_rotate with new.reference', revoke: 'credential_revoke', bind: 'credential_setup with new.credential and new.reference',
    useProfile: 'profile_use_plan, staged as local changes', saveProfile: 'createProfile and saveProfile with your valid local changes', importProfile: 'the system file picker, then createProfile and saveProfile',
    runNow: 'routine run_now on the basis read', disableRoutine: 'routine disable on the basis read', revertTheme: 'theme_revert', removeTheme: 'theme_remove',
    importTheme: 'the system file picker, then SettingsAdapter.importTheme (theme_import)', openExpressions: 'the Expressions editor (SettingsAdapter.navigate)',
    run: 'product_action_run', visualLayer: 'the renderer\'s store (SettingsAdapter.visualPreferences.setEnabled)', welcome: 'the renderer\'s store (SettingsAdapter.visualPreferences.setWelcomeEnabled)',
    enableRoutine: 'RoutineAuthoringSource.enable under the authority you chose', reprove: 'RoutineAuthoringSource.reprove on the verified run you chose',
    createRoutine: 'RoutineAuthoringSource.create from the chosen Method, verified run, trigger (a new schedule through prepareSchedule) and authority',
    checkCreation: 'RoutineAuthoringSource.readResult: a waiting creation read back, never sent again',
    addMachine: 'RemoteMachinesSource.add', connect: 'RemoteMachinesSource.connect', disconnect: 'RemoteMachinesSource.disconnect', removeMachine: 'RemoteMachinesSource.remove',
    openElsewhere: 'the setting\'s own editor beside its instrument (SettingsAdapter.navigate)', 'pick:<ref>': 'the system picker (SettingsAdapter.pickResource)',
    acceptStep: 'Ground: native oi\'s reviewed plan (the kernel op `setup`: plan, then apply with its review token; Central only — custom, products [central]) for the folder and name shown, read back by discover; then Central\'s central.time.policy.adopt and central.ground.placement.adopt on their previews\' digests, the kernel\'s ground_form keep (the application\'s own Day form through central.ground.form.adopt, where no O-I project carries it) and its ground_authority adopt (the key made in the world\'s own folder, only its digest sent to central.ground.authority.adopt), each recognised by that acceptance and read back by its preview (an older ground gets only what it lacks). Machines: Central\'s machine.adopt-current (role current, the Workcell this computer answers as), read back by machine.declaration; the host then reads its world again. Projects: a folder elsewhere comes into Work by Central\'s work.bring on its preview\'s digest, read back by work.list; a folder of Work becomes a project by Central\'s projectcentral.init, adopt or migrate as previewed, read back by projectcentral.inspect; once it stands as a project, Central\'s central.ground.project.adopt on its preview\'s digest (central.ground.project.preview, asked with Preview) extends the person\'s grant to it and makes its Work member writable, read back by its preview. Harnesses and skills: for each skill root AIKit reads as foreign, AIKit\'s plan (aikit_read adopt-plan: aikit adopt ROOT --namespace LABEL, nothing moves) and, when it adopts the skills read, aikit adopt ROOT --namespace LABEL --yes --expect-digest on its review digest (aikit_write adopt), read back by aikit init as adopted and still keeping its skills; the tool keeps reading them where they were. Credentials: aikit credential setup CREDENTIAL --ref REFERENCE (op credential_setup with the reference you give, never material) for the key chosen, read back by aikit credential list; a reference that names no store (op://, keychain://, pass://, varlock://) is refused before anything is sent',
    previewStep: 'Central\'s projectcentral.adopt.preview or migrate.preview for the folder and wiki chosen; Create previews from Central\'s inspection (it has no preview of projectcentral.init); a folder elsewhere previews Central\'s work.bring.preview',
    chooseGroundFolder: 'the system\'s folder chooser (the native host\'s choose_folder, purpose ground), then native oi\'s discover of the ground there under the name shown',
    keepBirth: 'the identity owner\'s save (SetupSource.identity: the kernel\'s nara_identity save — QL checks it, Central keeps it in the ground) of your name and date of birth, read back by its list and open; a correction is a new revision of the same identity',
    rereadSetup: 'native oi\'s status and discover, then AIKit\'s tools, skill roots, keys and bindings, Workcell\'s status and Central\'s machine declaration, Central\'s Work and the folders of work elsewhere, read again',
  },
  local: {
    search: 'what you search for', hit: 'the search result ↑/↓ marked', scope: 'the scope a page\'s settings are read and changed at', focus: 'the setting a press or a request opened',
    details: 'the setting whose Details are open', show: 'what Automations lists',
    context: 'Automations\' work context', routine: 'the routine chosen', product: 'the product chosen', owner: 'whose System reading shows', axes: 'four axes or the configuration',
    adding: 'the open form', rotating: 'the credential whose reference you replace', chatDefault: 'a provider chosen, not yet applied',
    setupStep: 'the Setup step shown', folder: 'the folder the Projects step shows', make: 'what to make of it', wiki: 'its wiki to keep or copy', where: 'where it is adopted',
    groundFolder: 'the folder you type for a new ground (else the one chosen or read)', groundName: 'the name you give a new ground (else the one native oi reads)',
    birthName: 'your name, kept with your date of birth', birthDate: 'your date of birth, until Keep keeps it',
    credential: 'the key the Credentials step binds (a found key\'s credential)', reference: 'where that key lies in your secure store, which Accept binds it to: a reference, never the key',
    'new.<field>': 'the open form\'s fields', 'draft:<ref>': 'your local change of a setting, until Review and Apply',
  },
  refused: {
    enterKey: NO_SECURE_FIELD, scan: NO_WORKCELL_SECRETS, revokeProjection: NO_WORKCELL_SECRETS,
  },
  absent: {
    secretRefs: NO_WORKCELL_SECRETS, projections: NO_WORKCELL_SECRETS, outside: NO_WORKCELL_SECRETS,
  },
} as const

/** The design keys the window holds as its own (SETTINGS_WINDOW_WIRING.local), exact. */
export const SETTINGS_LOCAL_KEYS = ['search', 'hit', 'scope', 'focus', 'details', 'show', 'context', 'routine', 'product', 'owner', 'axes', 'adding', 'rotating', 'chatDefault',
  'setupStep', 'folder', 'make', 'wiki', 'where', 'credential', 'reference', 'groundFolder', 'groundName', 'birthName', 'birthDate',
  'new.name', 'new.description', 'new.method', 'new.proof', 'new.trigger', 'new.repeat', 'new.schedule', 'new.authority', 'new.profile', 'new.scopes', 'new.grant', 'new.reproof',
  'new.label', 'new.endpoint', 'new.credential', 'new.reference', 'new.note', 'new.expects'] as const
