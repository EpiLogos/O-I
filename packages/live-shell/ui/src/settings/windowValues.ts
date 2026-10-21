// The Settings window's values (manual §10.10; design package D9: catalogue settings__window.tsx `settings:window`), from the readings
// the window's own code makes (SettingsWorkspace.tsx's engine over the SettingsAdapter, and the page hooks of windowPages.ts). Pure: each
// mapper takes an owner's reading as the adapter hands it and returns the design's keys; a key the owner did not report is left out,
// never filled in. SETTINGS_WINDOW_WIRING classifies every key the design reads and every press it makes.
import type {Value} from '../frame/devices/designed'
import type {ChangeSetDocument, ConfigResolution, PlanBundle, ScopeAddress, SettingsAdapter} from './adapter'
import {basisChanged, categoryOf, draftOwnerChanged, editableValue, isSensitiveSetting, rawValue, settingKey, type Draft, type SettingEntry} from './model'
import type {HarnessReading} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import {effectiveChatDefault} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import type {ProfileDocument} from '../../../../../desktop/cradle/src/configuration/contracts'
import type {SystemCompositionReading} from '../../../../../desktop/cradle/src/workspace/settings/types'
import type {PresentationDocument} from '../../../../../desktop/cradle/src/kernel/types'
import type {MachineConnection, RemoteMachineDeclaration} from './machines'
import type {Invocation, MethodRow, RoutineDetail, RoutineList} from '../../../../../desktop/cradle/src/contributions/automations/client'
import {nextOccurrenceTimes} from '../../../../../desktop/cradle/src/contributions/automations/client'

export const SETTINGS_WINDOW_ID = 'settings:window'

const json = (value: unknown): string => JSON.stringify(value)
const rec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const txt = (x: unknown): string | undefined => (typeof x === 'string' && x ? x : undefined)
const at = (unixMs: number | null | undefined): string | undefined => (typeof unixMs === 'number' && unixMs > 0 ? new Date(unixMs).toISOString().slice(0, 16).replace('T', ' ') : undefined)

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

/** Every contributed setting at its chosen scope (the design's `settings`): the owner's descriptor (registry), its resolution there
 * (config_resolutions_read), where the value comes from, and when a change applies. Pure. */
export function settingRows(entries: readonly SettingEntry[], readings: Readonly<Record<string, ConfigResolution>>, scopes: Readonly<Record<string, ScopeAddress>>): Record<string, unknown>[] {
  return entries.map(entry => {
    const {spec} = entry, scope = scopes[spec.setting_ref], reading = scope ? readings[settingKey(spec.setting_ref, scope)] : undefined
    const kind = settingKind(entry), schema = spec.value_schema
    const value = editableValue(reading) ?? reading?.native?.effective?.value
    const row: Record<string, unknown> = {ref: spec.setting_ref, category: categoryOf(entry), owner: entry.owner, section: spec.section_ref, title: spec.title, kind,
      from: reading ? (reading.native?.declared ? 'here' : 'inherited') : 'unread', timing: spec.effect.kind, writable: writableAt(entry, scope)}
    if (schema.type === 'enum') row.options = schema.options.map(option => option.value)
    if (schema.type === 'table') row.columns = schema.columns.map(column => ({name: column.name, type: column.type}))
    if ((schema.type === 'number' || schema.type === 'integer') && (schema.minimum !== undefined || schema.maximum !== undefined)) row.range = `${schema.minimum ?? '…'} – ${schema.maximum ?? '…'}`
    if (kind === 'table' || kind === 'list') { const rows = reading ? entryRows(entry, value) : undefined; if (rows) row.rows = rows }
    else if (kind === 'secret') { const ref = reference(reading?.native?.effective?.value); if (ref) row.effective = ref }
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

export const scopeWords = (scope: ScopeAddress, choices: SettingsAdapter['scopeChoices']): string =>
  choices?.find(choice => choice.address.scope_kind === scope.scope_kind && choice.address.scope_ref === scope.scope_ref)?.title ?? (scope.scope_ref ? `${scope.scope_kind} · ${scope.scope_ref}` : scope.scope_kind)

/** The owners' plans for your local changes (config_plan_reviewed), as the Review page lists them. */
export function planRows(review: PlanBundle | null, entries: readonly SettingEntry[], choices: SettingsAdapter['scopeChoices']): Record<string, unknown>[] | undefined {
  if (!review) return undefined
  return review.plans.map(plan => ({ref: plan.setting_ref, title: entries.find(entry => entry.spec.setting_ref === plan.setting_ref)?.spec.title ?? plan.setting_ref,
    scope: scopeWords(plan.scope, choices), changes: plan.changes.map(change => change.summary), effect: plan.expected_effect.kind}))
}

/** The owners' answer to Apply or Reset (config_apply_reviewed, config_reset). */
export const resultValue = (result: ChangeSetDocument | null): string | undefined => (result
  ? json({status: result.status, operations: result.operations.map(operation => ({ref: operation.setting_ref, status: operation.status, ...(operation.error ? {message: operation.error.message} : {})}))}) : undefined)

/** The window's own readings as the design holds them: the adapter, its scopes, every setting at its scope (absent while the registry is read),
 * the drafts, conflicts and the settings that stand beside their instrument, the scope most settings stand at, the plans and the answer. Pure. */
export function windowCoreValues(input: {readonly adapter: Pick<SettingsAdapter, 'kind' | 'label' | 'simulated' | 'scopeChoices' | 'pointOfUseEntries' | 'ownerEpoch'>
  readonly entries: readonly SettingEntry[]; readonly readings: Readonly<Record<string, ConfigResolution>>; readonly scopes: Readonly<Record<string, ScopeAddress>>
  readonly drafts: Readonly<Record<string, Draft>>; readonly review: PlanBundle | null; readonly result: ChangeSetDocument | null; readonly loading: boolean; readonly query: string}): Record<string, Value> {
  const {adapter, entries, readings, scopes, drafts, review, result} = input
  const values: Record<string, Value> = {
    source: json({kind: adapter.kind, label: adapter.label, ...(adapter.simulated ? {simulated: true} : {})}),
    scopes: json((adapter.scopeChoices ?? []).map(choice => ({kind: choice.address.scope_kind, ref: choice.address.scope_ref, title: choice.title}))),
    conflicts: json(conflictRefs(entries, drafts, scopes, readings, adapter.ownerEpoch)),
    elsewhere: json((adapter.pointOfUseEntries ?? []).map(entry => ({ref: entry.setting_ref, title: entry.title, where: entry.destination.kind}))),
    search: input.query,
    ...draftValues(entries, drafts, scopes),
  }
  if (!input.loading) values.settings = json(settingRows(entries, readings, scopes))
  const scope = commonScope(scopes)
  if (scope) values.scope = json({kind: scope.scope_kind, ref: scope.scope_ref, title: scopeWords(scope, adapter.scopeChoices)})
  const plans = planRows(review, entries, adapter.scopeChoices)
  if (plans) values.plans = json(plans)
  const answered = resultValue(result)
  if (answered) values.result = answered
  return values
}

/** The scope most settings stand at: the one the design's single scope bar shows. */
export function commonScope(scopes: Readonly<Record<string, ScopeAddress>>): ScopeAddress | null {
  const counts = new Map<string, {scope: ScopeAddress; n: number}>()
  for (const scope of Object.values(scopes)) { const key = json([scope.scope_kind, scope.scope_ref]); const was = counts.get(key); counts.set(key, {scope, n: (was?.n ?? 0) + 1}) }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.scope ?? null
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

/** O:I's named profiles (profile_list): each profile, whether it is active, and the settings it keeps (a secret by its reference). */
export function profileValues(reading: {active_profile_ref: string | null; profiles: readonly ProfileDocument[]} | null, isSensitive: (ref: string) => boolean): Record<string, Value> {
  if (!reading) return {}
  return {profiles: json(reading.profiles.map(profile => ({ref: profile.profile_ref, title: profile.title ?? profile.profile_ref, active: profile.profile_ref === reading.active_profile_ref,
    settings: (profile.desired ?? []).map(entry => ({ref: entry.setting_ref, title: entry.setting_ref, ...(isSensitive(entry.setting_ref) || entry.secret_reference ? {secret: true} : {})}))})))}
}

/** Workcell's machine declarations and connection receipts (RemoteMachinesSource). */
export function machineValues(machines: readonly RemoteMachineDeclaration[] | null, connections: readonly MachineConnection[] | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (machines) values.machines = json(machines.map(machine => ({label: machine.label, endpoint: machine.endpoint, ...(machine.credential_ref ? {credential: machine.credential_ref} : {}),
    expects: machine.operations, ...(machine.note ? {note: machine.note} : {})})))
  if (connections) values.connections = json(connections.map(connection => ({label: connection.label, state: connection.state, protocol: connection.protocol,
    ...(connection.remote_software ? {remote: connection.remote_software} : {}), granted: connection.granted_operations,
    ...(at(connection.last_reconciled_at_unix_ms) ? {reconciled: at(connection.last_reconciled_at_unix_ms)} : {}), ...(connection.detail ? {detail: connection.detail} : {})})))
  return values
}

// ---------------------------------------------------------------------------------------------------------------- Automations

/** AIKit's routines in the chosen work context (kernel op `routine`: list, methods, history; the chosen routine's show), the harness timers
 * its list reconciles (foreign_reconciliation), and the contexts the window can read them in. Pure. */
export function automationValues(input: {readonly list: RoutineList | null; readonly methods: readonly MethodRow[] | null; readonly history: readonly Invocation[] | null
  readonly detail: RoutineDetail | null; readonly project: string | null; readonly options: unknown}): Record<string, Value> {
  const values: Record<string, Value> = {}
  const {list, methods, history, detail, project} = input
  values.contexts = json([{ref: '', title: 'This AIKit home'}, ...(project ? [{ref: project, title: project}] : [])])
  if (list) {
    values.routines = json(list.routines.map(routine => {
      const shown = detail?.routine === routine.routine ? detail : null
      return {ref: routine.routine, name: routine.name, state: routine.state, when: routine.trigger.kind + (routine.scheduler ? ` · ${routine.scheduler.provider}` : ''), method: routine.method,
        revision: routine.method_revision, verified: routine.state !== 'stale-proof', ...(shown?.authority ? {unattended: shown.authority.unattended} : {}),
        ...(shown && nextOccurrenceTimes(shown.next_occurrences)[0] ? {next: nextOccurrenceTimes(shown.next_occurrences)[0]} : {})}
    }))
    values.timers = json(list.foreign_reconciliation.providers.flatMap(provider => provider.jobs.map(job => ({name: job.name ?? job.job_id, provider: provider.provider,
      ...(job.active ? {} : {when: 'inactive'})}))))
  }
  if (methods) values.methods = json(methods.map(method => ({method: method.name || method.id})))
  if (history) values.history = json(history.map(row => ({at: row.trigger_observed_at, routine: row.routine_ref, ...(row.outcome ? {outcome: row.outcome.status} : {}),
    ...(row.provider_deliveries?.length ? {delivery: row.provider_deliveries.map(d => d.provider).join(', ')} : {})})))
  if (rec(input.options)) values.options = json(input.options)
  return values
}

// ---------------------------------------------------------------------------------------------------------------- Appearance, Products, System

/** The presentation owner's saved appearance (presentation_read), the theme library and the imported themes. */
export function appearanceValues(reading: PresentationDocument | null, library: readonly {id: string; name: string}[] | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (library) values.themes = json(library.map(theme => ({id: theme.id, name: theme.name})))
  if (!reading) return values
  values.theme = json({saved: reading.theme.id ?? reading.theme.appearance})
  values.imported = json(reading.custom_themes.map(theme => ({id: theme.id, name: theme.name})))
  return values
}

/** Each product's composition mount and its operations (system_composition_read), and the last operation's answer (product_action_run). */
export function productValues(reading: SystemCompositionReading | null, runnable: (action: NonNullable<SystemCompositionReading['owners'][number]['descriptor']>['actions'][number]) => boolean,
  ran: {product: string; title: string; ok: boolean; rows?: [string, unknown][]} | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (reading) values.products = json(reading.owners.map(mount => ({id: mount.product_id, ...(mount.descriptor?.owner.owner_version ? {version: mount.descriptor.owner.owner_version} : {}),
    state: mount.availability, ...(mount.reason ?? mount.error ? {reason: mount.reason ?? mount.error} : {}),
    actions: (mount.descriptor?.actions ?? []).map(action => ({ref: action.action_ref, title: action.title, runnable: runnable(action),
      ...(runnable(action) ? {} : {why: action.unavailable_reason ?? 'Choose its subject where you use it.'})})),
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

const NO = (what: string, capability: string) => `${what}: the settings adapter carries no ${capability} (src/settings/adapter.ts SettingsAdapter.${capability}); the native connector (src/native/configuration.ts connectNativeSettings) binds only the configuration plane and its scopes.`
export const NO_HARNESS = NO('Harnesses & models', 'harnesses')
export const NO_INVOKE = (what: string) => NO(what, 'invoke')
export const NO_PROFILES = NO('Profiles', 'profiles')
export const NO_MACHINES = NO('Remote machines', 'remoteMachines')
export const NO_PRODUCTS = NO('Products and System', 'readProducts')
export const NO_VISUALS = NO('Opening', 'visualPreferences')
export const NO_AUTHORING = NO('Making and enabling a routine', 'routineAuthoring')
export const NO_WORKCELL_SECRETS = 'Workcell\'s secret references, projections and scan (`workcell system --json` keys.references, `workcell secret projections`, `workcell secret scan`): no kernel route reaches them yet (T-COVERAGE §1.2).'
export const NO_SECURE_FIELD = 'Enter key: a write-only key goes to the native host\'s own secure field, never through the window; no host qualifies that capability here (SettingsAdapter.canEnterCredentialMaterial).'
export const NO_STANDING = 'A route\'s standing (unproven, observed, usable) is AIKit\'s model field (`aikit model-catalogue show`), which model_catalogue does not carry yet.'

/** Every key the design reads or presses, by where it stands. */
export const SETTINGS_WINDOW_WIRING = {
  reads: {
    source: 'the settings adapter itself: kind, label, simulated (SettingsAdapter)',
    scopes: 'the subjects a setting can apply to (SettingsAdapter.scopeChoices)',
    settings: 'every owner\'s contributed setting (config_registry_read) at its scope (config_resolutions_read)',
    conflicts: 'drafts whose owner reading or connection changed (model.ts basisChanged, draftOwnerChanged)',
    elsewhere: 'the settings whose editor stands beside its instrument (SettingsAdapter.pointOfUseEntries)',
    plans: 'the owners\' plans for your local changes (config_plan_reviewed)',
    result: 'the owners\' answer to Apply or Reset (config_apply_reviewed, config_reset)',
    providers: 'the configured providers (HarnessSource.read: the encounter providers)', heldDefault: 'the saved chat default (HarnessSource.read)',
    effectiveDefault: 'the provider new chats use, and its rule (harnessSource.ts effectiveChatDefault)', harnesses: 'each harness client (harness_status: aikit client status)',
    routes: 'the catalogue\'s declared routes (model_catalogue)', credentials: 'AIKit\'s credential binding metadata (credential_list), each Verify\'s verdict (credential_verify)',
    found: 'keys discovery found (credential_discover, presence only)', profiles: 'O:I\'s named profiles (SettingsAdapter.profiles listProfiles)',
    machines: 'Workcell\'s machine declarations (RemoteMachinesSource.readMachines)', connections: 'its connection receipts (RemoteMachinesSource.readConnections)',
    routines: 'AIKit\'s routines (kernel op routine: list)', methods: 'the Methods with a verified run (routine: methods)', history: 'each invocation (routine: history)',
    timers: 'the harness timers AIKit\'s routine list reconciles (routine: list foreign_reconciliation)',
    options: 'what a new routine may use (RoutineAuthoringSource.options)', contexts: 'the work contexts routines are read in: this AIKit home, or a project the request names',
    theme: 'the saved appearance (presentation_read)', themes: 'the theme library (SettingsAdapter.themeLibrary, else the design system\'s themes)', imported: 'the imported themes (presentation_read custom_themes)',
    visualLayer: 'the renderer\'s visual layer (SettingsAdapter.visualPreferences)', welcome: 'the renderer\'s welcome scene (SettingsAdapter.visualPreferences)',
    products: 'each product\'s mount and operations (system_composition_read)', ran: 'the last operation\'s answer (product_action_run)',
    system: 'each owner\'s System disclosure on its four axes (system_composition_read)',
  },
  writes: {
    plan: 'config_plan_reviewed', apply: 'config_apply_reviewed', reset: 'config_reset on the reading digest', keep: 'the draft re-based on the current reading (the window\'s own)',
    discard: 'every local change dropped (the window\'s own)', applyDefault: 'HarnessSource.holdDefault', restoreDefault: 'HarnessSource.discardDefault', install: 'client_install',
    reveal: 'settings_reveal', signIn: 'the conversation\'s connection control (SettingsAdapter.navigate)', discover: 'credential_discover', verify: 'credential_verify',
    rotate: 'credential_rotate with new.reference', revoke: 'credential_revoke', setup: 'credential_setup with new.credential and new.reference',
    useProfile: 'profile_use_plan, staged as local changes', saveProfile: 'createProfile and saveProfile with your valid local changes', importProfile: 'the system file picker, then createProfile and saveProfile',
    runNow: 'routine run', disableRoutine: 'routine disable', applyTheme: 'theme_apply', revertTheme: 'theme_revert', removeTheme: 'theme_remove',
    importTheme: 'the system file picker, then SettingsAdapter.importTheme (theme_import)', run: 'product_action_run', reread: 'system_composition_read again',
    visualLayer: 'the renderer\'s store (SettingsAdapter.visualPreferences.setEnabled)', welcome: 'the renderer\'s store (SettingsAdapter.visualPreferences.setWelcomeEnabled)',
    enableRoutine: 'RoutineAuthoringSource.enable under the routine\'s granted authority', reprove: 'RoutineAuthoringSource.reprove with a verified run of the current revision',
    createRoutine: 'RoutineAuthoringSource.create from the chosen Method, verified run, trigger and authority',
    addMachine: 'RemoteMachinesSource.add', connect: 'RemoteMachinesSource.connect', disconnect: 'RemoteMachinesSource.disconnect', removeMachine: 'RemoteMachinesSource.remove',
    openElsewhere: 'the setting\'s own editor beside its instrument (SettingsAdapter.navigate)', 'pick:<ref>': 'the system picker (SettingsAdapter.pickResource)',
  },
  local: {
    search: 'what you search for', scope: 'the scope the settings below are read and changed at', focus: 'the setting a press or a request opened', show: 'what Automations lists',
    context: 'Automations\' work context', routine: 'the routine chosen', product: 'the product chosen', owner: 'whose System reading shows', axes: 'four axes or the configuration',
    adding: 'the open form', rotating: 'the credential whose reference you replace', chatDefault: 'a provider chosen, not yet applied', themeDraft: 'an appearance chosen, not yet applied',
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
export const SETTINGS_LOCAL_KEYS = ['search', 'scope', 'focus', 'show', 'context', 'routine', 'product', 'owner', 'axes', 'adding', 'rotating', 'chatDefault', 'themeDraft',
  'new.name', 'new.method', 'new.proof', 'new.trigger', 'new.authority', 'new.profile', 'new.label', 'new.endpoint', 'new.credential', 'new.reference', 'new.note'] as const
