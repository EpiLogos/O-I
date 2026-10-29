// The settings whose owners stand outside the configuration plane, on the window's one path (manual §10.10: "Every setting an owner contributes
// stands as one row"; "A change is local until you review it … Review changes asks each owner to plan your changes … Apply sends the plans the
// owners made. Each owner answers in the same table"). The presentation owner's theme (presentationSetting.ts) and O:I's chat default
// (chatDefaultSetting.ts) contribute nothing to the configuration registry; each stands here as an entry with its reading as a resolution, so
// the engine (SettingsWorkspace.tsx) holds a change of it as a draft like every other, and asks its own owner to plan it, apply it and, where
// the owner keeps a wider value, reset it. The plans and the answers join the configuration plane's in one Review and one answer table.
// Pure, apart from the owners' operations each setting carries.
import type {ChangeSetDocument, ConfigResolution, PlanBundle, PlanDocument, ScopeAddress} from './adapter'
import type {ChangeSetOperation, ExpectedEffect} from '../../../../../desktop/cradle/src/configuration/contracts'
import type {Draft, SettingEntry} from './model'

/** One owned setting: its entry and its owner's reading at its scope, and its owner's acts. */
export interface OwnedSetting {
  readonly entry: SettingEntry
  readonly scope: ScopeAddress
  readonly reading: ConfigResolution
  /** The owner's plan for your change, read again on the basis you made it on; rejects in the owner's words where that moved. */
  plan(draft: Draft): Promise<PlanDocument>
  /** The owner applies its plan: its answer, an operation of the answer table (refused in its words, never thrown). */
  apply(plan: PlanDocument): Promise<ChangeSetOperation>
  /** The owner removes the value set here and resolves it again (Reset on its row), where it keeps a wider one; its words. */
  reset?(): Promise<string>
  /** Why Reset stands dimmed on its row, where the owner keeps no wider value. */
  readonly noReset?: string
}

export const ownedRef = (setting: OwnedSetting): string => setting.entry.spec.setting_ref

/** An owned setting's entry: writable at its one scope, planned and applied by its owner. */
export function ownedEntry(input: {ref: string; owner: string; section: string; native: string; title: string; description: string
  options: readonly {value: string; title: string}[]; scope: ScopeAddress; effect: ExpectedEffect; resets: boolean}): SettingEntry {
  return {owner: input.owner, available: true, reason: null, spec: {setting_ref: input.ref, section_ref: input.section, native_ref: input.native, title: input.title,
    description: input.description, value_schema: {type: 'enum', options: input.options.map(option => ({...option}))}, allowed_scopes: [{...input.scope}], writable: true,
    profileable: false, sensitive: false, default_semantics: 'none', effect: input.effect, operations: {validate: true, plan: true, apply: true, reset: input.resets}}}
}

/** An owner's reading as a resolution at its scope: declared here where the owner keeps a value here, else only in effect. */
export function ownedResolution(ref: string, scope: ScopeAddress, owner: string, path: string, value: {declared?: string; effective?: string}, digest: string,
  drift?: string): ConfigResolution {
  const axis = (v: string | undefined) => (v === undefined ? undefined : {value: v, provenance: {owner_ref: owner, path}})
  return {schema: 'oi.config-resolution/v1', setting_ref: ref, scope, desired: null,
    native: {...(value.declared !== undefined ? {declared: axis(value.declared)} : {}), ...(value.effective !== undefined ? {effective: axis(value.effective)} : {})},
    native_reading: {reading_digest: digest, observed_at_unix_ms: null}, reconciliation: drift ? {status: 'drifted', reason: drift} : {status: 'satisfied', reason: null}}
}

/** An owner's plan of one change, in the configuration plane's form, so the Review lists it beside theirs. */
export function ownedPlan(input: {ref: string; scope: ScopeAddress; id: string; basis: string; before: string; after: string; summary: string; native: string; effect: ExpectedEffect}): PlanDocument {
  return {schema: 'oi.config-plan/v1', plan_id: input.id, plan_digest: `${input.basis}→${input.after}`, setting_ref: input.ref, scope: input.scope,
    changes: [{summary: input.summary, native_ref: input.native, before_ref: input.before, after_ref: input.after}], expected_effect: input.effect}
}

/** The basis a plan was made on (ownedPlan's digest). */
export const planBasis = (plan: PlanDocument): string => plan.plan_digest.slice(0, plan.plan_digest.lastIndexOf('→'))
/** The value a plan applies. */
export const planValue = (plan: PlanDocument): string => String(plan.changes[0]?.after_ref ?? '')

/** An owner's answer to its plan, as an operation of the answer table. */
export function ownedOperation(plan: PlanDocument, owner: string, status: ChangeSetOperation['status'], message?: string): ChangeSetOperation {
  return {op_id: plan.plan_id, depends_on: [], owner_ref: owner, setting_ref: plan.setting_ref, scope: plan.scope, kind: 'apply', plan_digest: plan.plan_digest, status,
    receipt_ref: null, error: message ? {code: 'refused', message} : null}
}

/** The configuration plane's plans and the owned settings' owners' plans, as one Review. */
export const withOwnerPlans = (bundle: PlanBundle | null, plans: readonly PlanDocument[]): PlanBundle =>
  ({plans: [...(bundle?.plans ?? []), ...plans], errors: [...(bundle?.errors ?? [])]})

/** The configuration plane's plans alone (the owned settings' are their owners'). */
export const configPlansOf = (plans: readonly PlanDocument[], owned: ReadonlySet<string>): PlanDocument[] => plans.filter(plan => !owned.has(plan.setting_ref))

/** The owners' answers as one table: the configuration plane's changeset, with the owned settings' operations beside it. */
export function withOwnerAnswers(result: ChangeSetDocument | null, answers: readonly ChangeSetOperation[]): ChangeSetDocument {
  const operations = [...(result?.operations ?? []), ...answers]
  const done = operations.filter(o => o.status === 'applied' || o.status === 'verified').length
  const status: ChangeSetDocument['status'] = !answers.length && result ? result.status : done === operations.length ? 'applied' : done === 0 ? 'failed' : 'partially_applied'
  return {schema: 'oi.config-changeset/v1', changeset_id: result?.changeset_id ?? answers[0]?.op_id ?? 'owned', created_at_unix_ms: result?.created_at_unix_ms ?? 0,
    requested: [...(result?.requested ?? []), ...answers.map(answer => ({setting_ref: answer.setting_ref, scope: answer.scope}))], operations,
    verification: result?.verification ?? null, status}
}
