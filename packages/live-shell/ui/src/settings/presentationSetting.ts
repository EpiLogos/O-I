// The window's appearance as one of the owners' settings (manual §10.10: "Every setting an owner contributes stands as one row"; "A change
// is local until you review it. Its row carries an amber mark, the page's name counts its changes, and the foot of the window counts them
// all. Review changes asks each owner to plan your changes … Apply sends the plans the owners made. Each owner answers in the same table").
// The presentation owner keeps the theme (presentation_read, theme_apply); it contributes no setting to the configuration registry, so the
// window's engine (SettingsWorkspace.tsx) reads its theme here as an entry of its own, at this machine, and plans and applies a change of it
// through the owner as it does every other owner's: the same draft, the same Review, the same answer table. Nothing else holds the choice.
// Ported from windowPages.ts useAppearancePage, as it stood (#758): the library offered (the adapter's, else the design system's themes,
// with the imported ones), a chosen id taken to the owner's theme, and the guard that re-reads the saved theme before theme_apply and
// refuses when it moved under the choice. Pure, apart from the owner's operations the adapter carries.
import type {ChangeSetDocument, ConfigResolution, PlanBundle, PlanDocument, ScopeAddress, SettingsAdapter} from './adapter'
import type {ChangeSetOperation} from '../../../../../desktop/cradle/src/configuration/contracts'
import type {Draft, SettingEntry} from './model'
import type {KernelOp, PresentationDocument, PresentationTheme} from '../../../../../desktop/cradle/src/kernel/types'

/** The theme's identity among the owners' settings: O:I's presentation owner, its theme. */
export const THEME_SETTING_REF = 'oi:presentation:theme'
/** The theme is this machine's (the presentation owner keeps one saved theme per installation). */
export const THEME_SCOPE: ScopeAddress = {scope_kind: 'machine', scope_ref: null}
const THEME_OWNER = 'oi'
const THEME_EFFECT = {kind: 'value-change' as const, summary: 'The presentation owner saves the appearance, and the window redraws in it.'}
/** The three appearances, then the library's themes (windowPages.ts THEMES of the old page; settings__window.tsx THEMES). */
const APPEARANCES: readonly {value: PresentationTheme['appearance']; title: string}[] = [{value: 'light', title: 'Light'}, {value: 'dark', title: 'Dark'}, {value: 'system', title: 'Follow system'}]

export type ThemeLibrary = readonly {readonly id: string; readonly name: string; readonly appearance: PresentationTheme['appearance']}[]

/** Whether a setting is the presentation owner's theme (planned and applied here, not through the configuration plane). */
export const isThemeSetting = (ref: string): boolean => ref === THEME_SETTING_REF

/** The value the theme's row holds: light | dark | system, or a library theme's id. */
export const themeValue = (theme: PresentationTheme): string => theme.id ?? theme.appearance

/** A theme value in words: an appearance's name, a library theme's name, else the id as the owner gave it. */
export function themeName(value: string, library: ThemeLibrary): string {
  return APPEARANCES.find(a => a.value === value)?.title ?? library.find(t => t.id === value)?.name ?? value
}

/** The library offered: the adapter's own, else the design system's, with the themes the owner holds imported. */
export function themeLibrary(base: ThemeLibrary, reading: PresentationDocument | null): ThemeLibrary {
  const imported = (reading?.custom_themes ?? []).map(t => ({id: t.id, name: t.name, appearance: t.appearance}))
  return [...base.filter(t => !imported.some(i => i.id === t.id)), ...imported]
}

/** The owner's theme for a value of the row: an appearance, or a library theme (useAppearancePage applyTheme, unchanged). */
export function themeOf(value: unknown, library: ThemeLibrary): PresentationTheme {
  const id = String(value)
  if (id === 'light' || id === 'dark' || id === 'system') return {appearance: id, id: null}
  const found = library.find(item => item.id === id)
  if (!found) throw new Error(`${id} is no theme of the library.`)
  return {id: found.id, appearance: found.appearance}
}

/** The reading basis a change of the theme is made on: the owner's revision and the theme it saved. */
export const themeDigest = (reading: PresentationDocument): string => `presentation:r${reading.revision}:${themeValue(reading.theme)}`

/** The theme as the engine reads an owner's setting: its descriptor, every appearance and library theme its choices. */
export function themeEntry(library: ThemeLibrary): SettingEntry {
  return {owner: THEME_OWNER, available: true, reason: null, spec: {
    setting_ref: THEME_SETTING_REF, section_ref: 'presentation', native_ref: 'presentation.theme', title: 'Theme',
    description: 'Light, Dark, the system\'s, or a theme from the library or one you imported. Scene, glyph, material and musical controls stay in their editors.',
    value_schema: {type: 'enum', options: [...APPEARANCES.map(a => ({value: a.value, title: a.title})), ...library.map(t => ({value: t.id, title: t.name}))]},
    allowed_scopes: [{scope_kind: 'machine', scope_ref: null}], writable: true, profileable: false, sensitive: false, default_semantics: 'none',
    effect: THEME_EFFECT, operations: {validate: true, plan: true, apply: true, reset: false}}}
}

/** The owner's reading of the theme as a resolution at this machine: saved here, its basis the owner's revision. */
export function themeResolution(reading: PresentationDocument): ConfigResolution {
  const value = themeValue(reading.theme), axis = {value, provenance: {owner_ref: THEME_OWNER, path: 'presentation_read'}}
  return {schema: 'oi.config-resolution/v1', setting_ref: THEME_SETTING_REF, scope: THEME_SCOPE, desired: null, native: {declared: axis, effective: axis},
    native_reading: {reading_digest: themeDigest(reading), observed_at_unix_ms: null}, reconciliation: {status: 'satisfied', reason: null}}
}

/** The owner's reading now (presentation_read through the adapter's kernel channel). */
export async function readTheme(adapter: Pick<SettingsAdapter, 'invoke'>): Promise<PresentationDocument> {
  if (!adapter.invoke) throw new Error('The appearance owner is not connected: the settings adapter carries no kernel channel.')
  const answer = await adapter.invoke({op: 'presentation_read'})
  if (answer.error || answer.outcome?.result !== 'presentation_reading') throw new Error(answer.error ?? 'The appearance owner did not return its reading.')
  return answer.outcome.document
}

/** The presentation owner's plan for your change of the theme: read again, and refused where the saved theme moved under your change (the
 * guard theme_apply kept, now at Review as every owner's plan is on the basis you edited on). */
export async function planTheme(adapter: Pick<SettingsAdapter, 'invoke'>, draft: Draft, library: ThemeLibrary): Promise<{plan: PlanDocument; reading: PresentationDocument}> {
  const reading = await readTheme(adapter)
  return {plan: themePlanOn(reading, draft, library), reading}
}

/** The plan on a reading just read: refused where it is not the basis the change was made on. */
export function themePlanOn(reading: PresentationDocument, draft: Draft, library: ThemeLibrary): PlanDocument {
  if (themeDigest(reading) !== draft.basis) throw new Error('The saved appearance changed. Your change is kept; Keep it on the current reading, or Undo it, before reviewing again.')
  const theme = themeOf(draft.value, library), now = themeValue(reading.theme), next = themeValue(theme)
  return {schema: 'oi.config-plan/v1', plan_id: `presentation-theme-${reading.revision}`, plan_digest: `${themeDigest(reading)}→${next}`,
    setting_ref: THEME_SETTING_REF, scope: THEME_SCOPE, changes: [{summary: `${themeName(now, library)} → ${themeName(next, library)}`, native_ref: 'presentation.theme', before_ref: now, after_ref: next}],
    expected_effect: THEME_EFFECT}
}

/** Apply the presentation owner's plan: read again, refused where the saved theme moved since the plan, else theme_apply. The answer is an
 * operation of the same table as every owner's, and the owner's new reading where it answered. */
export async function applyTheme(adapter: Pick<SettingsAdapter, 'invoke'>, plan: PlanDocument, library: ThemeLibrary): Promise<{operation: ChangeSetOperation; reading: PresentationDocument | null}> {
  const operation = (status: ChangeSetOperation['status'], message?: string): ChangeSetOperation => ({op_id: plan.plan_id, depends_on: [], owner_ref: THEME_OWNER,
    setting_ref: THEME_SETTING_REF, scope: THEME_SCOPE, kind: 'apply', plan_digest: plan.plan_digest, status, receipt_ref: null, error: message ? {code: 'refused', message} : null})
  try {
    const before = await readTheme(adapter)
    if (!plan.plan_digest.startsWith(`${themeDigest(before)}→`)) return {operation: operation('failed', 'The saved appearance changed after review. Nothing was applied; review your change again.'), reading: before}
    const after = plan.changes[0]?.after_ref
    if (!adapter.invoke) throw new Error('The appearance owner is not connected.')
    const answer = await adapter.invoke({op: 'theme_apply', ...themeOf(after, library)} as KernelOp)
    if (answer.error || answer.outcome?.result !== 'presentation_reading') return {operation: operation('failed', answer.error ?? 'The appearance owner did not acknowledge theme_apply.'), reading: null}
    return {operation: operation('applied'), reading: answer.outcome.document}
  } catch (cause) { return {operation: operation('failed', cause instanceof Error ? cause.message : String(cause)), reading: null} }
}

/** The plans of the configuration plane and the presentation owner, as one Review. */
export const withThemePlan = (bundle: PlanBundle | null, plan: PlanDocument | null): PlanBundle =>
  ({plans: [...(bundle?.plans ?? []), ...(plan ? [plan] : [])], errors: [...(bundle?.errors ?? [])]})

/** The configuration plane's plans alone (the theme's is the presentation owner's). */
export const configPlans = (plans: readonly PlanDocument[]): PlanDocument[] => plans.filter(plan => !isThemeSetting(plan.setting_ref))

/** The owners' answers as one table: the configuration plane's changeset, with the presentation owner's operation beside it. */
export function withThemeAnswer(result: ChangeSetDocument | null, operation: ChangeSetOperation | null): ChangeSetDocument {
  const operations = [...(result?.operations ?? []), ...(operation ? [operation] : [])]
  const done = operations.filter(o => o.status === 'applied' || o.status === 'verified').length
  const status: ChangeSetDocument['status'] = !operation && result ? result.status : done === operations.length ? 'applied' : done === 0 ? 'failed' : 'partially_applied'
  return {schema: 'oi.config-changeset/v1', changeset_id: result?.changeset_id ?? operation?.op_id ?? 'presentation', created_at_unix_ms: result?.created_at_unix_ms ?? 0,
    requested: [...(result?.requested ?? []), ...(operation ? [{setting_ref: operation.setting_ref, scope: operation.scope}] : [])], operations,
    verification: result?.verification ?? null, status}
}
