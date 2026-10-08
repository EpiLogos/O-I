import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {
  MAX_BODY_ACTIONS, MAX_SPAN, MAX_TRIGGERS_PER_SCENE, PORTAL_PLACEMENTS, SCENE_BODY_CARRIERS, SCENE_BODY_HOST_CARRIERS,
  TRIGGER_OCCASIONS, TRIGGER_OPERATIONS,
  type NativeSceneBodyPresentation, type NativeSceneMaterialIntent, type NativeTriggerTargetIntent,
} from '../../../../expressions-boundary/src/sceneMaterialEdits'
import type {SceneFaceModel} from './nativeSceneFaceModel.ts'

/** Pure facts and intent builders for the Scene body and Jump trigger device. No React, no commits: the panel sends what these return. */
export type BodyCarrier = (typeof SCENE_BODY_CARRIERS)[number]
export type TriggerOccasionName = (typeof TRIGGER_OCCASIONS)[number]
export type PortalPlacementName = (typeof PORTAL_PLACEMENTS)[number]
export type TriggerKind = NativeTriggerTargetIntent['kind']
export type TriggerOperation = (typeof TRIGGER_OPERATIONS)[number]
/** The disclosed native body and triggers the reading carries (`nativeScene`, written by hostEditor's reading builder). */
export type NativeBodyRow = NonNullable<NonNullable<NativeEditorReading['nativeScene']>['body']>
export type NativeTriggerRow = NonNullable<NativeEditorReading['nativeScene']>['triggers'][number]
export type NativeActionRow = NativeBodyRow['actions'][number]

export const CARRIER_LABELS: Record<BodyCarrier, string> = {
  engine_composition: 'Engine composition', text_source: 'Text source', glyph_form: 'Glyph form', image_media: 'Image',
  file_thing: 'File', knowledge_whole: 'Knowledge whole', html_surface: 'HTML surface', agent_surface: 'Agent surface', expression_ref: 'Another Expression',
}
export const PRESENTATION_LABELS: Record<NativeSceneBodyPresentation, string> = {live: 'Live', inline: 'Inline', preview: 'Preview', degraded: 'Degraded'}
export const OCCASION_LABELS: Record<TriggerOccasionName, string> = {
  scene_enter: 'Scene enters', scene_leave: 'Scene leaves', activate: 'Activated', select: 'Selected', sequence_transition: 'Sequence moves on',
}
export const PLACEMENT_LABELS: Record<PortalPlacementName, string> = {preview: 'Preview', overlay: 'Overlay', beside: 'Beside', full: 'Full', detached: 'Detached', re_dock: 'Re-dock'}
export const TARGET_LABELS: Record<TriggerKind, string> = {
  expression_operation: 'Read this Expression', portal: 'Open a portal', native_action: 'Run a disclosed native Action', navigate: 'Jump to a Scene',
}
export const OPERATION_LABELS: Record<TriggerOperation, string> = {inspect: 'Inspect', list: 'List', export: 'Export'}
export const TRIGGER_KINDS = ['expression_operation', 'portal', 'native_action', 'navigate'] as const satisfies readonly TriggerKind[]
/** The trigger id grammar the boundary admits (sceneMaterialEdits triggerPlan). */
const TRIGGER_ID = /^[A-Za-z0-9._-]{1,128}$/
/** Native file refs are named in the inspector with a 500 character field. */
export const SUBJECT_MAX = 500

export type IntentResult = {intent: NativeSceneMaterialIntent; problem: null} | {intent: null; problem: string}
const refuse = (problem: string): IntentResult => ({intent: null, problem})
const accept = (intent: NativeSceneMaterialIntent): IntentResult => ({intent, problem: null})

/** One summary line for the rack and Browser: `body: <carrier or none> · N triggers`. An absent nativeScene is named as not disclosed. */
export function bodySummary(reading: NativeEditorReading): string {
  const native = reading.nativeScene
  if (!native) return 'Scene body not disclosed'
  const count = native.triggers.length
  return `body: ${native.body ? native.body.carrier : 'none'} · ${count} trigger${count === 1 ? '' : 's'}`
}

export interface CarrierOption {carrier: BodyCarrier; label: string; resolvable: boolean; reason: string | null}
/** All nine admitted carriers in contract order. Only the host-resolvable ones can be set; the rest name why. */
export function carrierOptions(): CarrierOption[] {
  return SCENE_BODY_CARRIERS.map(carrier => {
    if (carrier === 'engine_composition') return {carrier, label: CARRIER_LABELS[carrier], resolvable: false,
      reason: "This is the Scene's default body: use Clear body to show the live composition"}
    const resolvable = (SCENE_BODY_HOST_CARRIERS as readonly string[]).includes(carrier)
    return {carrier, label: CARRIER_LABELS[carrier], resolvable, reason: resolvable ? null : 'no host resolver yet'}
  })
}

/** The honest presentation matrix of expression_carrier.rs validate_body. A resolved text or image body is renderable, so Degraded is refused. */
export function presentationProblem(presentation: NativeSceneBodyPresentation, capability: 'renderable' | 'degrades_to_thing' | 'unavailable'): string | null {
  const honest = (presentation === 'live' || presentation === 'inline') ? capability === 'renderable'
    : presentation === 'preview' ? capability !== 'unavailable'
    : capability !== 'renderable'
  return honest ? null : presentation === 'degraded'
    ? 'Degraded needs a body that cannot render; a text or image body renders'
    : `${PRESENTATION_LABELS[presentation]} needs a capability this body does not disclose`
}

export interface BodyForm {carrier: BodyCarrier; presentation: NativeSceneBodyPresentation; subject: string; spanStart: string; spanEnd: string}
export const DEFAULT_BODY_FORM: BodyForm = {carrier: 'text_source', presentation: 'inline', subject: '', spanStart: '0', spanEnd: '0'}

/** The set intent for a body form, or the problem that keeps it out of any request. The host resolves the exact reading; the shell never
 * builds a body itself. A span of 0 to 0 is the whole file, as the inspector reads it. */
export function bodySetIntent(form: BodyForm): IntentResult {
  const option = carrierOptions().find(row => row.carrier === form.carrier)
  if (!option) return refuse('Unknown native Scene body carrier')
  if (!option.resolvable) return refuse(form.carrier === 'engine_composition' ? 'Use Clear body to show the engine composition' : `This carrier has no host resolver yet: ${form.carrier}`)
  const subject = form.subject.trim()
  if (!subject) return refuse('Name the native file ref or path first')
  if (subject.length > SUBJECT_MAX) return refuse(`The native ref is at most ${SUBJECT_MAX} characters`)
  const presentation = presentationProblem(form.presentation, 'renderable')
  if (presentation) return refuse(presentation)
  if (form.carrier === 'image_media') return accept({family: 'body', body: {operation: 'set', carrier: 'image_media', subject_ref: subject, presentation: form.presentation}})
  const start = form.spanStart.trim(), end = form.spanEnd.trim()
  if ((start === '' || start === '0') && (end === '' || end === '0'))
    return accept({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: subject, span: null, presentation: form.presentation}})
  const s = Number(start), e = Number(end)
  if (!Number.isSafeInteger(s) || !Number.isSafeInteger(e) || s < 0 || e <= s || e > MAX_SPAN)
    return refuse('Span start and end are whole numbers, with end after start (end 0 means the whole file)')
  return accept({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: subject, span: {start: s, end: e}, presentation: form.presentation}})
}

export const bodyClearIntent = (): NativeSceneMaterialIntent => ({family: 'body', body: {operation: 'clear'}})

/** A trigger's name for the reading and the Browser: the target as the kernel names it. */
export function triggerTargetLabel(target: NativeTriggerRow['target']): string {
  switch (target.kind) {
    case 'expression_operation': return `Expression ${target.operation}`
    case 'portal': return `Portal ${PLACEMENT_LABELS[target.placement as PortalPlacementName] ?? target.placement} · ${target.subject_ref}`
    case 'native_action': return `Native action ${target.action_ref} on ${target.target_ref}`
    case 'navigate': return `Jump to ${target.scene_ref ?? target.entity_ref ?? 'a Scene'}`
  }
}

export interface TriggerContext {
  count: number
  expressionRef: string
  /** Subjects the Scene discloses: its body subject. The reading carries no entity subjects, so portals name only the body. */
  subjects: readonly string[]
  /** Actions disclosed on the Scene body (the reading's body actions). */
  actions: readonly NativeActionRow[]
  /** Other native Scenes a jump may name, with the title to show. */
  scenes: readonly {scene_ref: string; title: string}[]
}
export interface TriggerForm {occasion: TriggerOccasionName; kind: TriggerKind; operation: TriggerOperation; placement: PortalPlacementName; subject: string; action: string; scene: string}
export const DEFAULT_TRIGGER_FORM: TriggerForm = {occasion: 'scene_enter', kind: 'navigate', operation: 'inspect', placement: 'overlay', subject: '', action: '', scene: ''}

/** Why one target kind cannot be chosen now, or null when it can. The reason is shown beside the disabled option. */
export function triggerKindProblem(kind: TriggerKind, context: TriggerContext): string | null {
  if (kind === 'expression_operation') return context.expressionRef ? null : 'This Expression has no native ref'
  if (kind === 'portal') return context.subjects.length ? null : 'No subject is disclosed on this Scene body, so a portal has nothing to open'
  if (kind === 'native_action') return context.actions.length ? null : "No native Action is disclosed on this Scene's body"
  return context.scenes.length ? null : 'No other native Scene is loaded to jump to'
}

/** A fresh trigger id: the boundary's grammar, unique in practice (time plus a random suffix). Injected clock and random for tests. */
export function newTriggerId(now: number, random: () => number): string {
  return `jump-${Math.floor(now).toString(36)}-${Math.floor(random() * 0x100000000).toString(36)}`
}

/** The attach intent for a trigger form, or the problem. Budget and grammar are checked before any request; the boundary stays the authority. */
export function triggerAttachIntent(form: TriggerForm, context: TriggerContext, triggerId: string): IntentResult {
  if (context.count >= MAX_TRIGGERS_PER_SCENE) return refuse(`This Scene already has ${MAX_TRIGGERS_PER_SCENE} triggers, the maximum. Remove one first.`)
  if (!(TRIGGER_OCCASIONS as readonly string[]).includes(form.occasion)) return refuse('Choose when the trigger fires')
  if (!TRIGGER_ID.test(triggerId)) return refuse('Trigger ids are 1–128 letters, digits, dots, dashes or underscores')
  const kindProblem = triggerKindProblem(form.kind, context)
  if (kindProblem) return refuse(kindProblem)
  let target: NativeTriggerTargetIntent
  if (form.kind === 'expression_operation') {
    if (!(TRIGGER_OPERATIONS as readonly string[]).includes(form.operation)) return refuse('Trigger operations are inspect, list or export; triggers never mutate documents')
    target = {kind: 'expression_operation', operation: form.operation, expression_ref: context.expressionRef}
  } else if (form.kind === 'portal') {
    const subject = context.subjects.find(ref => ref === form.subject) ?? context.subjects[0]
    if (!(PORTAL_PLACEMENTS as readonly string[]).includes(form.placement)) return refuse('Choose a portal placement')
    target = {kind: 'portal', placement: form.placement, subject_ref: subject}
  } else if (form.kind === 'native_action') {
    const action = context.actions.find(row => row.action_ref === form.action) ?? context.actions[0]
    target = {kind: 'native_action', action_ref: action.action_ref, target_ref: action.target_ref, authority_requirement: action.authority_requirement}
  } else {
    const scene = context.scenes.find(row => row.scene_ref === form.scene) ?? context.scenes[0]
    target = {kind: 'navigate', scene_ref: scene.scene_ref}
  }
  return accept({family: 'trigger', trigger: {operation: 'attach', trigger_id: triggerId, occasion: form.occasion, target}})
}

export const triggerDetachIntent = (triggerRef: string): NativeSceneMaterialIntent => ({family: 'trigger', trigger: {operation: 'detach', trigger_ref: triggerRef}})

/** The trigger context of a reading. Null when the reading carries no native Scene body or triggers (not disclosed). */
export function triggerContext(reading: NativeEditorReading): TriggerContext | null {
  const native = reading.nativeScene
  if (!native) return null
  const body = native.body
  return {
    count: native.triggers.length,
    expressionRef: reading.basis.expression_ref,
    subjects: body ? [body.subject_ref] : [],
    actions: body?.actions ?? [],
    scenes: (reading.scenes?.scenes ?? []).filter(row => row.scene_ref !== reading.basis.scene_ref).map(row => ({scene_ref: row.scene_ref, title: row.title || row.scene_ref})),
  }
}

export const bodyFaceModel: SceneFaceModel = {
  name: 'Scene body & Jump',
  groups: [{title: 'Scene body'}, {title: 'Jump triggers'}],
  summary: bodySummary,
  enabled: () => undefined,
  studio: 'scene',
}

export const BODY_ACTION_BUDGET = MAX_BODY_ACTIONS
export const BODY_TRIGGER_BUDGET = MAX_TRIGGERS_PER_SCENE
