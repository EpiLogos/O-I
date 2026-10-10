/** Scene-material edits the shell may propose: page text layers, and the Scene
 * body and jump-trigger relations. Pure: no store, clock, owner or network.
 *
 * Routing. Page text is Scene material that prepareCompositionEdit already
 * diffs (kernelComposition.ts emits scene_material_set), so it rides `apply`
 * beside the other Journey-owned families: one store change, one commit.
 * Body and trigger changes are native relations the composition diff does not
 * emit. Adding them to `apply` would need a second native call after commit,
 * which is not one gesture, one native operation. They ride a separate request,
 * `scene-material`, whose planner runs inside nativeWorkspace.edit(view => ...):
 * the flushed view supplies the expression_ref and revision the CAS is taken
 * from, and a single editConnections call carries the change. */
import {clone, uid, validateJourney, type Journey, type TextLayer} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import type {
  CarrierKind, KernelConversion, KernelExpressionDocument, KernelScene, KernelSceneBody,
  KernelSceneTrigger, KernelTextSpan, TriggerOccasion, TriggerTarget,
} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import type {NativeEditorBasis} from './editor';

// ——— Page text layers (Scene.text) ———
/** expression_scene.rs:174 — the kernel's only bound on text layers. */
export const TEXT_LAYER_BUDGET = 16;
/** model.ts:35 TextLayer.align; inspector.ts:99 Alignment select. */
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
/** inspector.ts:97 maxlength attributes. The kernel does not bound these strings. */
export const TEXT_MAX_LENGTH = {kicker: 300, title: 300, italic: 300, body: 5000} as const;
/** inspector.ts:98 and :100 numeric controls. The steps are not enforced here. */
export const TEXT_NUMERIC_RANGE = {size: [14, 150], width: [60, 1000], x: [-0.5, 1.5], y: [-0.5, 1.5]} as const;
/** app.ts:682, the block created by "Add a text block". */
const TEXT_LAYER_DEFAULTS = {visible: true, kicker: 'A MOMENT IN THE FIELD', title: 'Your words,', italic: 'in this space.', body: '', x: 0.07, y: 0.24, width: 240, size: 38, align: 'left'} as const;
/** Single-line fields refuse C0 controls and DEL; body also allows newline, tab and CR. */
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001f\u007f]/;
const BODY_FORBIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export type NativeTextLayerField = 'visible' | 'kicker' | 'title' | 'italic' | 'body' | 'x' | 'y' | 'width' | 'size' | 'align';
export type NativeTextLayerValues = Partial<Pick<TextLayer, NativeTextLayerField>>;
/** Page text changes for `apply`. `role` is native slot material and is not editable here. */
export type NativeSceneTextChange =
  | {kind: 'text-layer-add'}
  | {kind: 'text-layer-remove'; layer_id: string}
  | {kind: 'text-layer-set'; layer_id: string; values: NativeTextLayerValues};

function textField(value: unknown, max: number, label: string, forbidden: RegExp): string {
  if (typeof value !== 'string' || value.length > max) throw Error(`${label} must be text of at most ${max} characters`);
  if (forbidden.test(value)) throw Error(`${label} must be text without control characters`);
  return value;
}
function numberField(value: unknown, [min, max]: readonly [number, number], label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${label} must be between ${min} and ${max}`);
  return value;
}
/** Validates exactly the fields the inspector edits, each against its own bound. */
export function validateTextLayerValues(values: unknown): NativeTextLayerValues {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error('Text layer values are one object of named fields');
  const entries = Object.entries(values);
  if (!entries.length) throw Error('Supply at least one text layer field');
  const out: NativeTextLayerValues = {};
  for (const [key, value] of entries) {
    switch (key) {
      case 'visible':
        if (typeof value !== 'boolean') throw Error('Text layer visibility is yes or no');
        out.visible = value; break;
      case 'kicker': case 'title': case 'italic':
        out[key] = textField(value, TEXT_MAX_LENGTH[key], key, SINGLE_LINE_FORBIDDEN); break;
      case 'body':
        out.body = textField(value, TEXT_MAX_LENGTH.body, 'body', BODY_FORBIDDEN); break;
      case 'size': case 'width': case 'x': case 'y':
        out[key] = numberField(value, TEXT_NUMERIC_RANGE[key], key); break;
      case 'align':
        if (!(TEXT_ALIGNS as readonly unknown[]).includes(value)) throw Error('Alignment is left, center or right');
        out.align = value as TextLayer['align']; break;
      default: throw Error(`Unsupported text layer field: ${key}`);
    }
  }
  return out;
}

/** One named page-text gesture over the Journey document. The kernel diff, not
 * this function, turns the result into scene_material_set. */
export function applyNativeSceneTextChanges(document: Journey, sceneId: string, changes: readonly NativeSceneTextChange[]): Journey {
  const next = clone(document), scene = next.scenes.find(row => row.id === sceneId);
  if (!scene) throw Error('The captured scene no longer exists');
  for (const change of changes) {
    if (change.kind === 'text-layer-add') {
      if (scene.text.length >= TEXT_LAYER_BUDGET) throw Error(`A Scene supports ${TEXT_LAYER_BUDGET} text layers`);
      scene.text.push({id: uid('text'), ...TEXT_LAYER_DEFAULTS});
      continue;
    }
    const layer = scene.text.find(row => row.id === change.layer_id);
    if (!layer) throw Error('The text layer no longer exists in this Scene');
    if (change.kind === 'text-layer-remove') scene.text = scene.text.filter(row => row !== layer);
    else if (change.kind === 'text-layer-set') Object.assign(layer, validateTextLayerValues(change.values));
    else throw Error('Unsupported text layer edit');
  }
  validateJourney(next);
  return next;
}

// ——— Scene body and jump triggers (native relations, one scene-material request) ———
/** expression_carrier.rs CARRIER_KINDS (line 38), names by CarrierKind::name. */
export const SCENE_BODY_CARRIERS = ['engine_composition', 'text_source', 'glyph_form', 'image_media', 'file_thing', 'knowledge_whole', 'html_surface', 'agent_surface', 'expression_ref'] as const satisfies readonly CarrierKind[];
/** expression_carrier.rs BodyPresentation (line 78). */
export const SCENE_BODY_PRESENTATIONS = ['live', 'inline', 'preview', 'degraded'] as const;
/** expression_carrier.rs BodyCapability (line 89), serde tag `state`. */
export const SCENE_BODY_CAPABILITY_STATES = ['renderable', 'degrades_to_thing', 'unavailable'] as const;
/** expression_carrier.rs validate_body: MAX_BODY_ACTIONS (148), MAX_SPAN (149), recursion 1..=4. */
export const MAX_BODY_ACTIONS = 16;
export const MAX_SPAN = 8_000_000;
export const RECURSION_DEPTHS = [1, 2, 3, 4] as const;
/** expression_trigger.rs TRIGGER_OCCASIONS (line 22). */
export const TRIGGER_OCCASIONS = ['scene_enter', 'scene_leave', 'activate', 'select', 'sequence_transition'] as const satisfies readonly TriggerOccasion[];
/** expression_trigger.rs TriggerTarget (line 62), serde tag `kind`. */
export const TRIGGER_TARGET_KINDS = ['expression_operation', 'portal', 'native_action', 'navigate'] as const;
/** expression_trigger.rs PortalPlacement (line 49), serde snake_case: ReDock is `re_dock`. */
export const PORTAL_PLACEMENTS = ['preview', 'overlay', 'beside', 'full', 'detached', 're_dock'] as const;
/** expression_trigger.rs TRIGGER_OPERATIONS (line 94). */
export const TRIGGER_OPERATIONS = ['inspect', 'list', 'export'] as const;
/** expression_trigger.rs MAX_TRIGGERS_PER_SCENE (line 105). */
export const MAX_TRIGGERS_PER_SCENE = 8;

/** Optional on a set: the host's exact reading is resolved as inline, and the planner applies this presentation, then checks it
 * against the disclosed capability (checkSceneBody). Absent keeps the resolved presentation. */
export type NativeSceneBodyPresentation = (typeof SCENE_BODY_PRESENTATIONS)[number];
export type NativeSceneBodyIntent =
  | {operation: 'clear'}
  | {operation: 'set'; carrier: 'engine_composition'}
  | {operation: 'set'; carrier: 'text_source'; subject_ref: string; span: KernelTextSpan | null; presentation?: NativeSceneBodyPresentation}
  | {operation: 'set'; carrier: 'expression_ref'; subject_ref: string; max_depth: 1 | 2 | 3 | 4}
  | {operation: 'set'; carrier: 'glyph_form' | 'image_media' | 'file_thing' | 'knowledge_whole' | 'html_surface' | 'agent_surface'; subject_ref: string; presentation?: NativeSceneBodyPresentation};
export type NativeTriggerTargetIntent =
  | {kind: 'expression_operation'; operation: 'inspect' | 'list' | 'export'; expression_ref: string}
  | {kind: 'portal'; placement: 'preview' | 'overlay' | 'beside' | 'full' | 'detached' | 're_dock'; subject_ref: string; scene_ref?: string}
  | {kind: 'native_action'; action_ref: string; target_ref: string; authority_requirement: string}
  | {kind: 'navigate'; scene_ref?: string; entity_ref?: string};
export type NativeSceneTriggerIntent =
  | {operation: 'attach'; trigger_id: string; occasion: TriggerOccasion; target: NativeTriggerTargetIntent}
  | {operation: 'detach'; trigger_ref: string};
export type NativeSceneMaterialIntent =
  | {family: 'body'; body: NativeSceneBodyIntent}
  | {family: 'trigger'; trigger: NativeSceneTriggerIntent};
/** The kernel Change grammar, exactly as nativeWorkspace.edit sends it. */
export type NativeSceneMaterialChange =
  | {change: 'scene_body_set'; scene_ref: string; body: KernelSceneBody}
  | {change: 'scene_body_clear'; scene_ref: string}
  | {change: 'scene_trigger_attach'; scene_ref: string; trigger: KernelSceneTrigger}
  | {change: 'scene_trigger_detach'; trigger_ref: string};
export interface NativeSceneMaterialRequest {operation: 'scene-material'; basis: NativeEditorBasis; intent: NativeSceneMaterialIntent}
export interface NativeSceneMaterialPlan {
  label: string;
  /** The exact native revision the planner was computed against. The owner's
   * editConnections call carries this same expected_revision. */
  basis: {expression_ref: string; revision: number; scene_ref: string};
  /** Empty when the native value already holds (no-op). */
  changes: NativeSceneMaterialChange[];
}

const TEXT_ENCODER = new TextEncoder();
const NATIVE_TEXT_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f]/;
/** expression.rs text(): bounded nonempty text without control characters. */
function nativeText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || TEXT_ENCODER.encode(value).length > 4096 || NATIVE_TEXT_FORBIDDEN.test(value))
    throw Error(`${label} must be bounded nonempty text without control characters`);
  return value;
}
function closedKeys(value: object, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error(`Unsupported ${label} operand`);
}
const isReferencedSubject = (ref: string) => ref.startsWith('expression:') || ref.startsWith('edition:');

/** Mirror of expression_carrier.rs validate_body over a host-resolved body. */
function checkSceneBody(body: KernelSceneBody, expressionRef: string): void {
  nativeText(body.subject_ref, 'Scene-body subject_ref');
  nativeText(body.native_owner, 'Scene-body native_owner');
  nativeText(body.reading.ref, 'Scene-body reading ref');
  nativeText(body.reading.revision, 'Scene-body reading revision');
  if (body.provenance.length > 256) throw Error('Scene-body provenance budget exceeded');
  for (const row of body.provenance) {nativeText(row.ref, 'Scene-body provenance ref'); nativeText(row.revision, 'Scene-body provenance revision');}
  if (body.actions.length > MAX_BODY_ACTIONS) throw Error('Scene-body Action budget exceeded');
  const seen = new Set<string>();
  for (const action of body.actions) {
    nativeText(action.action_ref, 'Scene-body action_ref');
    nativeText(action.authority_requirement, 'Scene-body authority_requirement');
    if (action.target_ref !== body.subject_ref || seen.has(action.action_ref)) throw Error('Scene-body Action target must match the placed subject; duplicate Action');
    seen.add(action.action_ref);
  }
  if (body.capability.state !== 'renderable') nativeText(body.capability.reason, 'Scene-body capability reason');
  if (body.span && (!Number.isSafeInteger(body.span.start) || !Number.isSafeInteger(body.span.end) || body.span.start < 0 || body.span.start >= body.span.end || body.span.end > MAX_SPAN))
    throw Error('Text span must be a bounded nonempty range');
  switch (body.carrier) {
    case 'engine_composition':
      if (body.subject_ref !== expressionRef) throw Error("The engine-composition body is this Expression's own composition");
      if (body.presentation !== 'live' || body.capability.state !== 'renderable') throw Error('The engine-composition body is the live rendered composition');
      if (body.span || body.recursion) throw Error('Engine-composition bodies carry no span or recursion bound');
      break;
    case 'expression_ref': {
      if (!isReferencedSubject(body.subject_ref)) throw Error('An expression_ref body must reference an Expression or Edition ref');
      if (!body.recursion) throw Error('An expression_ref body must declare its recursion bound');
      if (body.recursion.host_expression_ref !== expressionRef) throw Error('Recursion host must be the containing Expression');
      if (!(RECURSION_DEPTHS as readonly number[]).includes(body.recursion.max_depth)) throw Error('Recursion depth must be within 1..=4');
      break;
    }
    default:
      if (isReferencedSubject(body.subject_ref) || body.subject_ref.startsWith('asset:')) throw Error('Scene-body subjects remain native; Expression/Edition/asset refs are not native subjects');
      if (body.span && body.carrier !== 'text_source') throw Error('Selected spans apply only to text_source bodies');
      if (body.recursion) throw Error('Only expression_ref bodies carry a recursion bound');
  }
  const honest = (body.presentation === 'live' || body.presentation === 'inline') && body.capability.state === 'renderable'
    || body.presentation === 'preview' && body.capability.state !== 'unavailable'
    || body.presentation === 'degraded' && body.capability.state !== 'renderable';
  if (!honest) throw Error('Scene-body presentation must match disclosed capability: live/inline require a renderable adapter; degraded carries the honest fallback; unavailable bodies are not presented');
}

function bodyPlan(doc: KernelExpressionDocument, scene: KernelScene, binding: KernelConversion['bindings'][string], intent: NativeSceneBodyIntent, resolved: KernelSceneBody | undefined): {label: string; changes: NativeSceneMaterialChange[]} {
  const sceneRef = scene.scene_ref;
  if (intent.operation === 'clear') {
    closedKeys(intent, ['operation'], 'Scene body');
    return {label: 'Clear Scene body', changes: binding.body ? [{change: 'scene_body_clear', scene_ref: sceneRef}] : []};
  }
  if (intent.operation !== 'set') throw Error('Unsupported Scene body operation');
  if (!(SCENE_BODY_CARRIERS as readonly string[]).includes(intent.carrier)) throw Error('Unknown native Scene body carrier');
  let subject: string, span: KernelTextSpan | null = null, recursion: {host_expression_ref: string; max_depth: number} | null = null;
  if (intent.carrier === 'engine_composition') {
    closedKeys(intent, ['operation', 'carrier'], 'Scene body');
    subject = doc.expression_ref;
  } else if (intent.carrier === 'expression_ref') {
    closedKeys(intent, ['operation', 'carrier', 'subject_ref', 'max_depth'], 'Scene body');
    subject = nativeText(intent.subject_ref, 'subject_ref');
    if (!isReferencedSubject(subject)) throw Error('An expression_ref body must reference an Expression or Edition ref');
    if (!(RECURSION_DEPTHS as readonly number[]).includes(intent.max_depth)) throw Error('Recursion depth must be within 1..=4');
    recursion = {host_expression_ref: doc.expression_ref, max_depth: intent.max_depth};
  } else {
    closedKeys(intent, intent.carrier === 'text_source' ? ['operation', 'carrier', 'subject_ref', 'span', 'presentation'] : ['operation', 'carrier', 'subject_ref', 'presentation'], 'Scene body');
    subject = nativeText(intent.subject_ref, 'subject_ref');
    if (isReferencedSubject(subject) || subject.startsWith('asset:')) throw Error('Scene-body subjects remain native; Expression/Edition/asset refs are not native subjects');
    if (intent.carrier === 'text_source' && !('span' in intent)) throw Error('Text source bodies name a span or null');
    if (intent.carrier === 'text_source' && intent.span !== null) {
      const {start, end} = intent.span;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end || end > MAX_SPAN) throw Error('Text span must be a bounded nonempty range');
      span = {start, end};
    }
  }
  const presentation = (intent as {presentation?: unknown}).presentation;
  if (presentation !== undefined && !(SCENE_BODY_PRESENTATIONS as readonly unknown[]).includes(presentation)) throw Error('Unknown Scene body presentation');
  if (!resolved) throw Error('Resolve the exact native reading of this body before preparing its change');
  const body = clone(resolved);
  if (presentation !== undefined) body.presentation = presentation as NativeSceneBodyPresentation;
  if (body.carrier !== intent.carrier || body.subject_ref !== subject) throw Error('The resolved native body names a different subject or carrier; nothing was written');
  const spanMatches = (body.span === null && span === null) || (!!body.span && !!span && body.span.start === span.start && body.span.end === span.end);
  const recursionMatches = (body.recursion === null && recursion === null) || (!!body.recursion && !!recursion && body.recursion.host_expression_ref === recursion.host_expression_ref && body.recursion.max_depth === recursion.max_depth);
  if (!spanMatches || !recursionMatches) throw Error('The resolved native body differs from the requested span or recursion bound');
  checkSceneBody(body, doc.expression_ref);
  return {label: 'Set Scene body', changes: [{change: 'scene_body_set', scene_ref: sceneRef, body}]};
}

function triggerTarget(doc: KernelExpressionDocument, scene: KernelScene, raw: NativeTriggerTargetIntent): TriggerTarget {
  if (!raw || typeof raw !== 'object') throw Error('Choose one trigger target');
  const disclosedActions = [
    ...Object.values(doc.entities).flatMap(entity => (entity.subject?.actions ?? []) as {action_ref: string; target_ref: string}[]),
    ...doc.scenes.flatMap(row => ((row.body as {actions?: unknown} | null | undefined)?.actions ?? []) as {action_ref: string; target_ref: string}[]),
  ];
  switch (raw.kind) {
    case 'expression_operation': {
      closedKeys(raw, ['kind', 'operation', 'expression_ref'], 'trigger target');
      if (!(TRIGGER_OPERATIONS as readonly string[]).includes(raw.operation)) throw Error('Trigger operations are inspect, list or export; triggers never mutate documents');
      const expression_ref = nativeText(raw.expression_ref, 'expression_ref');
      if (!expression_ref.startsWith('expression:')) throw Error('Trigger must name a valid Expression ref');
      return {kind: 'expression_operation', operation: raw.operation, expression_ref};
    }
    case 'portal': {
      closedKeys(raw, ['kind', 'placement', 'subject_ref', 'scene_ref'], 'trigger target');
      if (!(PORTAL_PLACEMENTS as readonly string[]).includes(raw.placement)) throw Error('Unknown portal placement');
      const subject_ref = nativeText(raw.subject_ref, 'subject_ref');
      const bodySubject = (scene.body as {subject_ref?: unknown} | null | undefined)?.subject_ref;
      const disclosed = bodySubject === subject_ref || scene.entity_refs.some(ref => doc.entities[ref]?.subject?.subject_ref === subject_ref);
      if (!disclosed) throw Error("Portal trigger subject must be disclosed on this scene's body or entities");
      if (raw.scene_ref !== undefined && !doc.scenes.some(row => row.scene_ref === raw.scene_ref)) throw Error('Portal trigger names an absent scene');
      return {kind: 'portal', placement: raw.placement, subject_ref, ...(raw.scene_ref !== undefined ? {scene_ref: raw.scene_ref} : {})};
    }
    case 'native_action': {
      closedKeys(raw, ['kind', 'action_ref', 'target_ref', 'authority_requirement'], 'trigger target');
      const action_ref = nativeText(raw.action_ref, 'action_ref'), target_ref = nativeText(raw.target_ref, 'target_ref');
      const authority_requirement = nativeText(raw.authority_requirement, 'authority_requirement');
      if (!disclosedActions.some(action => action.action_ref === action_ref && action.target_ref === target_ref))
        throw Error('Trigger native Action must be disclosed on a bound subject or scene body');
      return {kind: 'native_action', action_ref, target_ref, authority_requirement};
    }
    case 'navigate': {
      closedKeys(raw, ['kind', 'scene_ref', 'entity_ref'], 'trigger target');
      if (raw.scene_ref === undefined && raw.entity_ref === undefined) throw Error('Navigate trigger must name a scene or entity');
      const targetScene = raw.scene_ref === undefined ? undefined : doc.scenes.find(row => row.scene_ref === raw.scene_ref);
      if (raw.scene_ref !== undefined && !targetScene) throw Error('Navigate trigger names an absent scene');
      if (raw.entity_ref !== undefined) {
        if (typeof raw.entity_ref !== 'string' || !doc.entities[raw.entity_ref]) throw Error('Navigate trigger names an absent entity');
        if (targetScene && !targetScene.entity_refs.includes(raw.entity_ref)) throw Error('Navigate trigger entity is outside the named scene');
      }
      return {kind: 'navigate', ...(raw.scene_ref !== undefined ? {scene_ref: raw.scene_ref} : {}), ...(raw.entity_ref !== undefined ? {entity_ref: raw.entity_ref} : {})};
    }
    default: throw Error('Unknown trigger target kind');
  }
}

function triggerPlan(doc: KernelExpressionDocument, scene: KernelScene, binding: KernelConversion['bindings'][string], intent: NativeSceneTriggerIntent): {label: string; changes: NativeSceneMaterialChange[]} {
  if (intent.operation === 'detach') {
    closedKeys(intent, ['operation', 'trigger_ref'], 'trigger');
    if (!binding.triggers.some(row => row.trigger_ref === intent.trigger_ref)) throw Error('That trigger is not on this Scene');
    return {label: 'Remove Scene trigger', changes: [{change: 'scene_trigger_detach', trigger_ref: intent.trigger_ref}]};
  }
  if (intent.operation !== 'attach') throw Error('Unsupported trigger operation');
  closedKeys(intent, ['operation', 'trigger_id', 'occasion', 'target'], 'trigger');
  if (typeof intent.trigger_id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(intent.trigger_id))
    throw Error('Trigger ids are 1–128 letters, digits, dots, dashes or underscores');
  if (!(TRIGGER_OCCASIONS as readonly string[]).includes(intent.occasion)) throw Error('Unknown trigger occasion');
  if (binding.triggers.length >= MAX_TRIGGERS_PER_SCENE) throw Error('Scene trigger budget exceeded');
  const trigger_ref = `${doc.expression_ref}:trigger:${intent.trigger_id}`;
  if (doc.scenes.some(row => (row.triggers ?? []).some(existing => (existing as {trigger_ref?: unknown}).trigger_ref === trigger_ref)))
    throw Error('Scene trigger already exists');
  const target = triggerTarget(doc, scene, intent.target);
  return {label: 'Add Scene trigger', changes: [{change: 'scene_trigger_attach', scene_ref: scene.scene_ref, trigger: {trigger_ref, occasion: intent.occasion, target}}]};
}

/** Plans one body or trigger change against the flushed native view. The
 * basis is checked here, against the view the owner will write to. `resolved`
 * is the host's exact native reading for a body `set` (never built from the
 * shell's request). Preparation writes nothing. */
export function prepareNativeSceneMaterialEdit(view: KernelConversion, basis: NativeEditorBasis, intent: NativeSceneMaterialIntent, resolved?: KernelSceneBody): NativeSceneMaterialPlan {
  const doc = view.document;
  if (basis.expression_ref !== doc.expression_ref || basis.revision !== doc.revision)
    throw Error('The captured native Expression revision changed; nothing was written');
  const scene = doc.scenes.find(row => row.scene_ref === basis.scene_ref);
  const binding = Object.values(view.bindings).find(row => row.scene_ref === basis.scene_ref);
  if (!scene || !binding) throw Error('Choose one exact captured native Scene ref');
  if (!intent || typeof intent !== 'object') throw Error('Supply one named native Scene material intent');
  const planned = intent.family === 'body' ? bodyPlan(doc, scene, binding, intent.body, resolved)
    : intent.family === 'trigger' ? triggerPlan(doc, scene, binding, intent.trigger)
    : undefined;
  if (!planned) throw Error('Unsupported native Scene material family');
  closedKeys(intent, ['family', intent.family], 'Scene material');
  return {label: planned.label, basis: {expression_ref: doc.expression_ref, revision: doc.revision, scene_ref: basis.scene_ref}, changes: planned.changes};
}

/** The body carriers a host can resolve today: the app reads their exact native reading (nativeSceneBody.ts prepareNativeSceneBody) and
 * renders them (sceneBodies.ts). Every other carrier is refused by name until a resolver and a renderer both exist. */
export const SCENE_BODY_HOST_CARRIERS = ['text_source', 'image_media'] as const;
export type NativeSceneBodyHostCarrier = (typeof SCENE_BODY_HOST_CARRIERS)[number];

/** What the host must read before the planner can run. `none`: nothing to read. `read`: resolve this exact native subject. `refuse`:
 * the request names a carrier or subject the host cannot take, so nothing is read or written. */
export type NativeSceneMaterialReadRequirement =
  | {kind: 'none'}
  | {kind: 'read'; carrier: NativeSceneBodyHostCarrier; subject_ref: string; span: KernelTextSpan | null}
  | {kind: 'refuse'; problem: string};

/** Pure gate before any host read, so a refused carrier never reaches a file read. The planner stays the authority for the full shape. */
export function sceneMaterialReadRequirement(intent: NativeSceneMaterialIntent): NativeSceneMaterialReadRequirement {
  if (!intent || typeof intent !== 'object') return {kind: 'refuse', problem: 'Supply one named native Scene material intent'};
  if (intent.family === 'trigger') return {kind: 'none'};
  if (intent.family !== 'body' || !intent.body || typeof intent.body !== 'object') return {kind: 'refuse', problem: 'Unsupported native Scene material family'};
  const body = intent.body as {operation?: unknown; carrier?: unknown; subject_ref?: unknown; span?: unknown};
  if (body.operation === 'clear') return {kind: 'none'};
  if (body.operation !== 'set') return {kind: 'refuse', problem: 'Unsupported Scene body operation'};
  if (body.carrier === 'engine_composition') return {kind: 'refuse', problem: "The engine composition is this Scene's default body: use Clear body to show it"};
  if (typeof body.carrier !== 'string' || !(SCENE_BODY_CARRIERS as readonly string[]).includes(body.carrier)) return {kind: 'refuse', problem: 'Unknown native Scene body carrier'};
  if (!(SCENE_BODY_HOST_CARRIERS as readonly string[]).includes(body.carrier)) return {kind: 'refuse', problem: `This carrier has no host resolver yet: ${body.carrier}`};
  const carrier = body.carrier as NativeSceneBodyHostCarrier;
  if (typeof body.subject_ref !== 'string' || !body.subject_ref.trim() || NATIVE_TEXT_FORBIDDEN.test(body.subject_ref))
    return {kind: 'refuse', problem: 'subject_ref must be bounded nonempty text without control characters'};
  const subject = body.subject_ref;
  if (subject.startsWith('expression:') || subject.startsWith('edition:') || subject.startsWith('asset:'))
    return {kind: 'refuse', problem: 'Scene-body subjects remain native; Expression/Edition/asset refs are not native subjects'};
  if (carrier !== 'text_source') {
    if ('span' in body) return {kind: 'refuse', problem: 'Unsupported Scene body operand: span'};
    return {kind: 'read', carrier, subject_ref: subject, span: null};
  }
  if (!('span' in body)) return {kind: 'refuse', problem: 'Text source bodies name a span or null'};
  if (body.span === null) return {kind: 'read', carrier, subject_ref: subject, span: null};
  const span = body.span as {start?: unknown; end?: unknown};
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || (span.start as number) < 0 || (span.start as number) >= (span.end as number) || (span.end as number) > MAX_SPAN)
    return {kind: 'refuse', problem: 'Text span must be a bounded nonempty range'};
  return {kind: 'read', carrier, subject_ref: subject, span: {start: span.start as number, end: span.end as number}};
}
