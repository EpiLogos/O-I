// Two pages whose owners answer and whose bindings were behind (W2; T-COVERAGE §1.3 follow-up):
//
// The Flow's Thought page (manual §18.1 Thought; central__flow-document.tsx): Contemplate is AIKit's Flow cognition, reached through the
// kernel's invoke_action `action:contemplate-flow` (kernel/src/flow_cognition.rs dispatch_contemplate). Asked bare it answers the
// deterministic preflight (`aikit flow preflight`: what would be read and touched; it records nothing); asked again with that record it
// runs Contemplate once (`aikit flow contemplate`, aikit.flow-cognition/v1: cognition, unavailable or refused, each with its words).
// Changed since is the kernel's op flow_changed_since over that thought. Nothing runs by itself: each is a press (preflightRead,
// contemplate, sinceRead), as the cradle's own surface asks them (desktop/cradle/src/flow/contemplate.tsx). AIKit keeps no read of a Flow's
// last thought (T-COVERAGE §1.5), so a thought stands only once this window asked for it.
//
// The Workspace's Ground and Self pages (manual §18.1 Ground; central__workspace.tsx): Central's `projectcentral.inspect {project}`
// (what it would make of the folder), `projectcentral.self.inspect {project}` (central.development-field-reading/v1: the self aperture,
// tier bindings, UX and EX relations) — readings through invoke_action — and the preview of a treatment: `projectcentral.adopt.preview`
// or `projectcentral.migrate.preview {project, source}` (projectcentral-mutation-plan); Central has no preview of `projectcentral.init`.
// Accept (`projectcentral.init {project, project_id}`, `adopt` or `migrate {project, project_id, source}`), Ensure (`projectcentral.self.ensure
// {project}`) and a tier's Relate (`projectcentral.self.tier.relate {project, source_ref, tier, acceptance}`) write the world's ground as the
// person's own presses, which the kernel carries with the person's authority (action.rs PERSON_ACTS). Binding a source as an intended
// experience or a return (`projectcentral.self.ux.relate`, `ex.relate`) is not among those presses, so it stands disabled naming that.
//
// Pure: no React, no transport. The readers are pageDevices.ts.
import type {Value} from '../../frame/devices/designed'
import type {ActionAnswer} from './useCentralReadings'

const rec = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const txt = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const count = (value: unknown): number | undefined => (Array.isArray(value) ? value.length : undefined)

// ---------------------------------------------------------------------------------------------------------------- the Flow's Thought

export const CONTEMPLATE_FLOW_ACTION = 'action:contemplate-flow'

/** What this window holds of one Flow's Thought: the preflight, the thought and what changed since, each as its owner answered; and the
 * Flow's last thought as AIKit keeps it (lane W11: `aikit flow thoughts`, the kernel's aikit_read flow-thoughts) with what changed since
 * that one (flow_changed_since on its kept record). A run in this window stands over the kept one. */
export interface FlowThought {
  readonly flowRef: string | null
  readonly preflight?: ActionAnswer
  readonly thought?: ActionAnswer
  readonly since?: {readonly status: 'answered'; readonly value: unknown} | {readonly status: 'refused'; readonly error: string} | {readonly status: 'reading'}
  /** `aikit flow thoughts <flow> --limit 1` (aikit.flow-thoughts/v1 {flow, thoughts [{recorded_at_unix_ms, thought}], unreadable}). */
  readonly kept?: ActionAnswer
  /** What changed since the kept thought (flow_changed_since with its `thought`). */
  readonly keptSince?: FlowThought['since']
}

/** The Flow's last kept thought ({at (ms), thought: the FlowThoughtRecord a successful contemplation returned}); null when AIKit keeps
 * none (thoughts are kept only when a host executor runs a contemplation — the kernel's Contemplate does); undefined when the answer is
 * not the reading. Pure. */
export function lastKeptThought(reading: unknown): {at?: number; thought: Record<string, unknown>} | null | undefined {
  if (!rec(reading) || reading.version !== 'aikit.flow-thoughts/v1' || !Array.isArray(reading.thoughts)) return undefined
  const first = reading.thoughts.find(rec)
  if (!first || !rec(first.thought)) return null
  return {...(typeof first.recorded_at_unix_ms === 'number' ? {at: first.recorded_at_unix_ms} : {}), thought: first.thought}
}

/** A kept thought's instant in the window's clock ('21 Oct 14:30'). */
function keptAt(ms: number | undefined, timeZone?: string): string | undefined {
  if (ms === undefined) return undefined
  try { return new Intl.DateTimeFormat('en-GB', {timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(ms)).replace(',', '') } catch { return undefined }
}

/** The presses of the Thought page: ask the preflight; run Contemplate once on the preflight record; ask what changed since the thought. */
export interface ThoughtHand {
  readonly preflight: () => Promise<void>
  readonly contemplate: (record: Record<string, unknown>) => Promise<void>
  readonly since: (thought: Record<string, unknown>) => Promise<void>
}

/** The preflight as the design draws it ({state, reason?, invocation, model, harness, agent?, focus, changed, affected}), from AIKit's
 * answer by its own field names (ContemplatePreflight: focus, impact {changed_sources, affected [{resource, freshness}]}, runtime_model,
 * harness, agent; the record's invocation ref), or the owner's refusal as `unavailable` with its words. Undefined while unasked. Pure. */
export function preflightValue(answer: ActionAnswer | undefined): string | undefined {
  if (!answer || answer.status === 'reading') return undefined
  if (answer.status === 'refused') return JSON.stringify({state: 'unavailable', reason: answer.error})
  const data = rec(answer.value) ? answer.value : {}
  const preflight = rec(data.preflight) ? data.preflight : data
  const impact = rec(preflight.impact) ? preflight.impact : {}
  return JSON.stringify({state: 'ready',
    ...(txt(data.invocation_ref) ?? txt(preflight.invocation_ref) ? {invocation: txt(data.invocation_ref) ?? txt(preflight.invocation_ref)} : {}),
    ...(txt(preflight.runtime_model) ? {model: txt(preflight.runtime_model)} : {}), ...(txt(preflight.harness) ? {harness: txt(preflight.harness)} : {}),
    ...(txt(preflight.agent) ? {agent: txt(preflight.agent)} : {}),
    focus: list(preflight.focus).filter((ref): ref is string => typeof ref === 'string'),
    changed: list(impact.changed_sources).flatMap(ref => (typeof ref === 'string' ? [{title: ref}] : [])),
    affected: list(impact.affected).flatMap(row => (rec(row) && txt(row.resource) ? [{title: txt(row.resource), ...(txt(row.freshness) ? {freshness: txt(row.freshness)} : {})}] : []))})
}

/** The last thought as the design draws it ({state: cognition | unavailable | refused, reason?, tensions, candidates, proposals, intents}),
 * from aikit.flow-cognition/v1, or the owner's refusal of the run. Undefined while no run was asked. Pure. */
export function thoughtValue(answer: ActionAnswer | undefined): string | undefined {
  if (!answer || answer.status === 'reading') return undefined
  if (answer.status === 'refused') return JSON.stringify({state: 'refused', reason: answer.error})
  const data = rec(answer.value) ? answer.value : {}
  const state = data.state === 'cognition' || data.state === 'unavailable' || data.state === 'refused' ? data.state : undefined
  if (!state) return JSON.stringify({state: 'refused', reason: 'AIKit answered Contemplate in a form the page does not read (aikit.flow-cognition/v1 expected).'})
  if (state !== 'cognition') return JSON.stringify({state, reason: txt(data.reason) ?? ''})
  const thought = rec(data.thought) ? data.thought : {}
  return JSON.stringify({state, ...(txt(thought.invocation_ref) ? {cursor: txt(thought.invocation_ref)} : {}),
    tensions: count(thought.tensions) ?? 0, candidates: count(thought.candidates) ?? 0, proposals: count(thought.human_source_proposals) ?? 0, intents: count(thought.flow_mutations) ?? 0})
}

/** What changed since the thought as the design draws it ({state: available | empty | unavailable, reason?, changed, affected, open}),
 * from the kernel's flow_changed_since (its AIKit receipt, aikit.flow-changed-since/v1: changed_sources, affected_knowledge, unresolved).
 * Undefined while unasked. Pure. */
export function sinceValue(answer: FlowThought['since']): string | undefined {
  if (!answer || answer.status === 'reading') return undefined
  if (answer.status === 'refused') return JSON.stringify({state: 'unavailable', reason: answer.error})
  const reading = rec(answer.value) ? answer.value : {}
  const aikit = rec(reading.aikit) ? reading.aikit : {}
  if (aikit.state !== 'invoked') return JSON.stringify({state: 'unavailable', reason: txt(aikit.message) ?? txt(aikit.detail) ?? 'AIKit did not answer what changed since the thought.'})
  const receipt = rec(aikit.receipt) ? aikit.receipt : {}
  const changed = list(receipt.changed_sources), affected = list(receipt.affected_knowledge), open = list(receipt.unresolved)
  return JSON.stringify({state: changed.length || affected.length || open.length ? 'available' : 'empty', changed: changed.length, affected: affected.length,
    open: open.flatMap(row => (rec(row) && txt(row.kind) && txt(row.reference) ? [{kind: txt(row.kind), reference: txt(row.reference), ...(txt(row.state) ? {state: txt(row.state)} : {})}] : []))})
}

/** The Thought page's values (preflight, thought, since), where this window asked for them, else the Flow's last kept thought and what
 * changed since it. With no thought kept, `thought` is JSON null: the Flow has not been contemplated where AIKit keeps its thoughts. */
export function thoughtValues(thought: FlowThought | null, timeZone?: string): Record<string, Value> {
  const values: Record<string, Value> = {}
  const preflight = preflightValue(thought?.preflight)
  if (preflight) values.preflight = preflight
  if (thought?.thought) {
    const cognition = thoughtValue(thought.thought), since = sinceValue(thought.since)
    if (cognition) values.thought = cognition
    if (since) values.since = since
    return values
  }
  const last = thought?.kept?.status === 'answered' ? lastKeptThought(thought.kept.value) : undefined
  if (last === null) values.thought = 'null'
  else if (last) {
    const cognition = thoughtValue({status: 'answered', value: {state: 'cognition', thought: last.thought}})
    const at = keptAt(last.at, timeZone)
    if (cognition) values.thought = at ? JSON.stringify({...JSON.parse(cognition) as Record<string, unknown>, at}) : cognition
    const since = sinceValue(thought?.since ?? thought?.keptSince)
    if (since) values.since = since
  }
  return values
}

// ---------------------------------------------------------------------------------------------------------------- the Workspace's ground

export const PC_INSPECT_ACTION = 'projectcentral.inspect'
export const PC_SELF_INSPECT_ACTION = 'projectcentral.self.inspect'
export const PC_PREVIEW_ACTION: Readonly<Record<'adopt' | 'migrate', string>> = {adopt: 'projectcentral.adopt.preview', migrate: 'projectcentral.migrate.preview'}

/** What this window holds of the workspace's world's ground: its project, the inspection, the self reading, and the preview asked last. */
export interface WorkspaceGround {
  readonly project: string | null
  readonly pc?: ActionAnswer
  readonly self?: ActionAnswer
  readonly plan?: {readonly treatment: 'create' | 'adopt' | 'migrate'; readonly answer: ActionAnswer}
  /** Ask Central's preview of a treatment (adopt or migrate) for a source. */
  readonly preview?: (treatment: 'adopt' | 'migrate', source: string) => Promise<void>
  /** The person's Accept: make the world's ground by the treatment previewed (a source for adopt and migrate). */
  readonly accept?: (treatment: 'create' | 'adopt' | 'migrate', source: string | null) => Promise<void>
  /** The person's Ensure: give the world its ProjectCentral/self. */
  readonly ensure?: () => Promise<void>
  /** The person's Relate: bind a source of the world to a tier of its account. */
  readonly relate?: (tier: number, sourceRef: string) => Promise<void>
}

/** The person's presses that write the world's ground (action.rs PERSON_ACTS). A ProjectCentral's id is its project's name, as every
 * project.json keeps it (Work/<Name>/ProjectCentral/project.json `project_id`). */
export const PC_ACCEPT_ACTION: Readonly<Record<'create' | 'adopt' | 'migrate', string>> = {create: 'projectcentral.init', adopt: 'projectcentral.adopt', migrate: 'projectcentral.migrate'}
export const PC_SELF_ENSURE_ACTION = 'projectcentral.self.ensure'
export const PC_TIER_RELATE_ACTION = 'projectcentral.self.tier.relate'
export const acceptInput = (project: string, treatment: 'create' | 'adopt' | 'migrate', source: string | null): Record<string, unknown> =>
  ({project, project_id: project, ...(treatment === 'create' ? {} : {source})})
/** The held Relate is the person's acceptance of the relation (Central asks it explicitly: `acceptance: human-accepted`). */
export const relateInput = (project: string, tier: number, sourceRef: string): Record<string, unknown> =>
  ({project, source_ref: sourceRef, tier, acceptance: 'human-accepted'})

/** projectcentral.inspect's data as the design's `pc` ({outcome, reason, candidates [{source, space}], signals [{kind, path}], errors}). Pure. */
export function pcValue(data: unknown): string | undefined {
  if (!rec(data) || !txt(data.outcome)) return undefined
  return JSON.stringify({outcome: data.outcome, reason: txt(data.reason) ?? '',
    candidates: list(data.wiki_candidates).flatMap(row => (rec(row) && txt(row.source) ? [{source: txt(row.source), space: txt(row.space_ref) ?? ''}] : [])),
    signals: list(data.source_signals).flatMap(row => (rec(row) && txt(row.kind) && txt(row.path) ? [{kind: txt(row.kind), path: txt(row.path)}] : [])),
    errors: list(data.manifest_errors).map(String)})
}

/** projectcentral.self.inspect's data (central.development-field-reading/v1) as the design's `self` ({aperture {exists, status}, tiers
 * [{tier, label?, source}], ux [{ref, source}], ex [{ref, source, ux}], unbound [{source, hints}]}), in Central's own shapes
 * (ctrl/src/development_field.rs): a tier's sources are resolved sources ({ref, path, …}, or null where a bound ref no longer resolves), a
 * UX's and an EX's source is one, and an unbound source of the self folder is {ref, path, standing, provenance}. A source is named by its ref,
 * which is what Relate binds. Pure. */
export function selfValue(data: unknown): string | undefined {
  if (!rec(data) || data.schema !== 'central.development-field-reading/v1') return undefined
  const aperture = rec(data.self_aperture) ? data.self_aperture : {}
  const refOf = (source: unknown): string | undefined => (rec(source) ? txt(source.ref) ?? txt(source.path) : undefined)
  return JSON.stringify({
    aperture: {exists: aperture.exists === true, status: txt(aperture.status) ?? ''},
    tiers: list(data.tier_bindings).flatMap(row => rec(row) && typeof row.tier === 'number'
      ? list(row.sources).flatMap(source => { const ref = refOf(source); return ref ? [{tier: row.tier, ...(txt(row.canonical_label) ? {label: txt(row.canonical_label)} : {}), source: ref}] : [] }) : []),
    ux: list(data.ux).flatMap(row => (rec(row) && txt(row.ux_ref) ? [{ref: txt(row.ux_ref), source: refOf(row.source) ?? ''}] : [])),
    ex: list(data.ex).flatMap(row => (rec(row) && txt(row.ex_ref) ? [{ref: txt(row.ex_ref), source: refOf(row.source) ?? '', ux: list(row.ux_refs).map(String)}] : [])),
    unbound: list(aperture.unbound_sources).flatMap(row => {
      const ref = rec(row) ? txt(row.ref) : undefined
      return ref && rec(row) ? [{source: ref, hints: [txt(row.path), txt(row.standing) && `standing ${row.standing}`, txt(row.provenance) && `provenance ${row.provenance}`].filter((hint): hint is string => !!hint)}] : []
    }),
  })
}

/** A preview's data (projectcentral-mutation-plan) as the design's `pcPlan` ({treatment, operations, source?, target?, preserves}). Pure. */
export function planValue(treatment: 'create' | 'adopt' | 'migrate', data: unknown): string | undefined {
  if (!rec(data) || !Array.isArray(data.operations)) return undefined
  return JSON.stringify({treatment, operations: data.operations.map(String), ...(txt(data.source) ? {source: txt(data.source)} : {}), ...(txt(data.target) ? {target: txt(data.target)} : {}),
    preserves: data.preserves_source === true})
}

/** The Ground and Self pages' values, where Central answered. */
export function groundValues(ground: WorkspaceGround | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  const pc = ground?.pc?.status === 'answered' ? pcValue(ground.pc.value) : undefined
  const self = ground?.self?.status === 'answered' ? selfValue(ground.self.value) : undefined
  const plan = ground?.plan?.answer.status === 'answered' ? planValue(ground.plan.treatment, ground.plan.answer.value) : undefined
  if (pc) values.pc = pc
  if (self) values.self = self
  if (plan) values.pcPlan = plan
  return values
}
