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
import {effectiveChatDefault} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import type {ProfileDocument} from '../../../../../desktop/cradle/src/configuration/contracts'
import type {SystemCompositionReading} from '../../../../../desktop/cradle/src/workspace/settings/types'
import type {PresentationDocument} from '../../../../../desktop/cradle/src/kernel/types'
import type {MachineConnection, RemoteMachineDeclaration} from './machines'
import type {Invocation, MethodRow, RoutineDetail, RoutineList} from '../../../../../desktop/cradle/src/contributions/automations/client'
import {actionMessage, nextOccurrenceTimes} from '../../../../../desktop/cradle/src/contributions/automations/client'

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
/** Setup (manual §10.11) is not bound in this window: the kernel op exists (desktop/cradle/src/kernel/types.ts `setup`), and nothing here calls it. */
export const NO_SETUP = 'Setup (manual §10.11): the kernel op `setup` (desktop/cradle/src/kernel/types.ts, the adoption controller\'s discover, plan and apply) is not bound to this window yet; Settings opens on Harnesses & models.'

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
    theme: 'the saved appearance, its revision and the renderers\' observations (presentation_read)', themes: 'the theme library (SettingsAdapter.themeLibrary, else the design system\'s themes)',
    imported: 'the imported themes (presentation_read custom_themes)',
    visualLayer: 'the renderer\'s visual layer (SettingsAdapter.visualPreferences)', welcome: 'the renderer\'s welcome scene (SettingsAdapter.visualPreferences)',
    products: 'each product\'s mount and operations (system_composition_read)', ran: 'the last operation\'s answer (product_action_run)',
    system: 'each owner\'s System disclosure on its four axes (system_composition_read)',
  },
  writes: {
    plan: 'config_plan_reviewed', apply: 'config_apply_reviewed', reset: 'config_reset on the reading digest', keep: 'the draft re-based on the current reading (the window\'s own)',
    discard: 'every local change dropped (the window\'s own)', returnToWork: 'the work Settings was opened from (the host\'s return)',
    reread: 'the owners read again: config_registry_read, config_resolutions_read and every opened page\'s reading',
    applyDefault: 'HarnessSource.holdDefault', restoreDefault: 'HarnessSource.discardDefault', install: 'client_install',
    reveal: 'settings_reveal', signIn: 'the conversation\'s connection control (SettingsAdapter.navigate)', discover: 'credential_discover', verify: 'credential_verify',
    rotate: 'credential_rotate with new.reference', revoke: 'credential_revoke', bind: 'credential_setup with new.credential and new.reference',
    useProfile: 'profile_use_plan, staged as local changes', saveProfile: 'createProfile and saveProfile with your valid local changes', importProfile: 'the system file picker, then createProfile and saveProfile',
    runNow: 'routine run_now on the basis read', disableRoutine: 'routine disable on the basis read', applyTheme: 'theme_apply', revertTheme: 'theme_revert', removeTheme: 'theme_remove',
    importTheme: 'the system file picker, then SettingsAdapter.importTheme (theme_import)', openExpressions: 'the Expressions editor (SettingsAdapter.navigate)',
    run: 'product_action_run', visualLayer: 'the renderer\'s store (SettingsAdapter.visualPreferences.setEnabled)', welcome: 'the renderer\'s store (SettingsAdapter.visualPreferences.setWelcomeEnabled)',
    enableRoutine: 'RoutineAuthoringSource.enable under the authority you chose', reprove: 'RoutineAuthoringSource.reprove on the verified run you chose',
    createRoutine: 'RoutineAuthoringSource.create from the chosen Method, verified run, trigger (a new schedule through prepareSchedule) and authority',
    checkCreation: 'RoutineAuthoringSource.readResult: a waiting creation read back, never sent again',
    addMachine: 'RemoteMachinesSource.add', connect: 'RemoteMachinesSource.connect', disconnect: 'RemoteMachinesSource.disconnect', removeMachine: 'RemoteMachinesSource.remove',
    openElsewhere: 'the setting\'s own editor beside its instrument (SettingsAdapter.navigate)', 'pick:<ref>': 'the system picker (SettingsAdapter.pickResource)',
  },
  local: {
    search: 'what you search for', hit: 'the search result ↑/↓ marked', scope: 'the scope a page\'s settings are read and changed at', focus: 'the setting a press or a request opened',
    details: 'the setting whose Details are open', show: 'what Automations lists',
    context: 'Automations\' work context', routine: 'the routine chosen', product: 'the product chosen', owner: 'whose System reading shows', axes: 'four axes or the configuration',
    adding: 'the open form', rotating: 'the credential whose reference you replace', chatDefault: 'a provider chosen, not yet applied', themeDraft: 'an appearance chosen, not yet applied',
    setupStep: 'the Setup step shown', folder: 'the folder the Projects step shows', make: 'what to make of it', wiki: 'its wiki to keep or copy', where: 'where it is adopted',
    'new.<field>': 'the open form\'s fields', 'draft:<ref>': 'your local change of a setting, until Review and Apply',
  },
  refused: {
    enterKey: NO_SECURE_FIELD, scan: NO_WORKCELL_SECRETS, revokeProjection: NO_WORKCELL_SECRETS,
    acceptStep: NO_SETUP, previewStep: NO_SETUP, rereadSetup: NO_SETUP,
  },
  absent: {
    secretRefs: NO_WORKCELL_SECRETS, projections: NO_WORKCELL_SECRETS, outside: NO_WORKCELL_SECRETS,
    setup: NO_SETUP, folders: NO_SETUP, setupPlan: NO_SETUP,
  },
} as const

/** The design keys the window holds as its own (SETTINGS_WINDOW_WIRING.local), exact. */
export const SETTINGS_LOCAL_KEYS = ['search', 'hit', 'scope', 'focus', 'details', 'show', 'context', 'routine', 'product', 'owner', 'axes', 'adding', 'rotating', 'chatDefault', 'themeDraft',
  'setupStep', 'folder', 'make', 'wiki', 'where',
  'new.name', 'new.description', 'new.method', 'new.proof', 'new.trigger', 'new.repeat', 'new.schedule', 'new.authority', 'new.profile', 'new.scopes', 'new.grant', 'new.reproof',
  'new.label', 'new.endpoint', 'new.credential', 'new.reference', 'new.note', 'new.expects'] as const
