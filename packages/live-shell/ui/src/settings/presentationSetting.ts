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
import {ownedEntry, ownedOperation, ownedPlan, ownedResolution, planBasis, planValue, withOwnerAnswers, withOwnerPlans, type OwnedSetting} from './ownedSettings'
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

/** Why the Theme row's Reset stands dimmed: the presentation owner keeps one saved theme and no wider value to return to. */
export const THEME_NO_RESET = 'The presentation owner keeps no wider value to return to: Revert returns to the appearance saved before the last one.'

/** The theme as the engine reads an owner's setting: its descriptor, every appearance and library theme its choices. */
export function themeEntry(library: ThemeLibrary): SettingEntry {
  return ownedEntry({ref: THEME_SETTING_REF, owner: THEME_OWNER, section: 'presentation', native: 'presentation.theme', title: 'Theme',
    description: 'Light, Dark, the system\'s, or a theme from the library or one you imported. Scene, glyph, material and musical controls stay in their editors.',
    options: [...APPEARANCES.map(a => ({value: a.value, title: a.title})), ...library.map(t => ({value: t.id, title: t.name}))], scope: THEME_SCOPE, effect: THEME_EFFECT, resets: false})
}

/** The owner's reading of the theme as a resolution at this machine: saved here, its basis the owner's revision. */
export function themeResolution(reading: PresentationDocument): ConfigResolution {
  const value = themeValue(reading.theme)
  return ownedResolution(THEME_SETTING_REF, THEME_SCOPE, THEME_OWNER, 'presentation_read', {declared: value, effective: value}, themeDigest(reading))
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
  const now = themeValue(reading.theme), next = themeValue(themeOf(draft.value, library))
  return ownedPlan({ref: THEME_SETTING_REF, scope: THEME_SCOPE, id: `presentation-theme-${reading.revision}`, basis: themeDigest(reading), before: now, after: next,
    summary: `${themeName(now, library)} → ${themeName(next, library)}`, native: 'presentation.theme', effect: THEME_EFFECT})
}

/** Apply the presentation owner's plan: read again, refused where the saved theme moved since the plan, else theme_apply. The answer is an
 * operation of the same table as every owner's, and the owner's new reading where it answered. */
export async function applyTheme(adapter: Pick<SettingsAdapter, 'invoke'>, plan: PlanDocument, library: ThemeLibrary): Promise<{operation: ChangeSetOperation; reading: PresentationDocument | null}> {
  const operation = (status: ChangeSetOperation['status'], message?: string) => ownedOperation(plan, THEME_OWNER, status, message)
  try {
    const before = await readTheme(adapter)
    if (planBasis(plan) !== themeDigest(before)) return {operation: operation('failed', 'The saved appearance changed after review. Nothing was applied; review your change again.'), reading: before}
    if (!adapter.invoke) throw new Error('The appearance owner is not connected.')
    const answer = await adapter.invoke({op: 'theme_apply', ...themeOf(planValue(plan), library)} as KernelOp)
    if (answer.error || answer.outcome?.result !== 'presentation_reading') return {operation: operation('failed', answer.error ?? 'The appearance owner did not acknowledge theme_apply.'), reading: null}
    return {operation: operation('applied'), reading: answer.outcome.document}
  } catch (cause) { return {operation: operation('failed', cause instanceof Error ? cause.message : String(cause)), reading: null} }
}

/** The theme on the window's one path for owned settings (ownedSettings.ts): planned and applied through the presentation owner, whose new
 * reading `take` hands to the Appearance page; its Reset dimmed (THEME_NO_RESET). */
export function themeOwned(adapter: Pick<SettingsAdapter, 'invoke'>, reading: PresentationDocument, library: ThemeLibrary, take: (reading: PresentationDocument) => void): OwnedSetting {
  return {entry: themeEntry(library), scope: THEME_SCOPE, reading: themeResolution(reading), noReset: THEME_NO_RESET,
    plan: async draft => { const now = await readTheme(adapter); take(now); return themePlanOn(now, draft, library) },
    apply: async plan => { const answer = await applyTheme(adapter, plan, library); if (answer.reading) take(answer.reading); return answer.operation }}
}

/** The plans of the configuration plane and the presentation owner, as one Review (ownedSettings.ts withOwnerPlans). */
export const withThemePlan = (bundle: PlanBundle | null, plan: PlanDocument | null): PlanBundle => withOwnerPlans(bundle, plan ? [plan] : [])

/** The owners' answers as one table (ownedSettings.ts withOwnerAnswers). */
export const withThemeAnswer = (result: ChangeSetDocument | null, operation: ChangeSetOperation | null): ChangeSetDocument => withOwnerAnswers(result, operation ? [operation] : [])
