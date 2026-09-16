export const SHARED_STAGE_SCHEMA = 'oi.shared-stage/v1';
export const SHARED_STAGE_STATES = Object.freeze(['open', 'closed']);
export const SHARED_STAGE_EDIT_TARGET_KINDS = Object.freeze([
  'world-presentation',
  'expression',
  'scene',
  'focus',
  'subject',
]);

/** The causal reference a stage mutation carries: the attributable
 * Activity/Action that caused the shared change. It never claims to be the
 * change's owner path — Contribution/Return stays a separate relation. */
export const SHARED_STAGE_CAUSAL_KINDS = Object.freeze(['activity', 'action', 'presentation-edit']);

const STAGE_KEYS = new Set([
  'schema',
  'shared_stage_ref',
  'field_ref',
  'revision',
  'state',
  'presenter_ref',
  'subject_ref',
  'presentation',
  'expression',
  'scene_ref',
  'focus_ref',
  'causal',
  'edits',
  'provenance',
]);

const PRESENTATION_KEYS = new Set(['ref', 'revision']);
const CAUSAL_KEYS = new Set(['kind', 'ref']);
const EDIT_KEYS = new Set([
  'edit_ref',
  'participant_ref',
  'at_revision',
  'target',
  'change',
  'causal',
  'occurred_at',
]);

export const SHARED_STAGE_MAX_EDITS = 64;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireExactKeys(value, allowed, name) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${name}.${key} is not part of ${SHARED_STAGE_SCHEMA}`);
  }
}

function requireRevision(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

/** One admitted presentation locus: WorldPresentation ref+revision, or an
 * Expression ref+revision. Reference does not transfer ownership — the
 * revision stays the native owner's. */
function validateLocus(locus, name, required) {
  const value = requireObject(locus, name);
  requireExactKeys(value, PRESENTATION_KEYS, name);
  requireString(value.ref, `${name}.ref`);
  if (required || value.revision !== undefined) requireRevision(value.revision, `${name}.revision`);
  return clone(value);
}

function validateCausal(causal, name) {
  const value = requireObject(causal, name);
  requireExactKeys(value, CAUSAL_KEYS, name);
  if (!SHARED_STAGE_CAUSAL_KINDS.includes(value.kind)) {
    throw new TypeError(`${name}.kind must be one of: ${SHARED_STAGE_CAUSAL_KINDS.join(', ')}`);
  }
  requireString(value.ref, `${name}.ref`);
  return clone(value);
}

/** One approved authored presentation edit carried on the stage. An edit is
 * presentation state on the stage only; it never writes canonical source, and
 * a new Expression revision still travels the `oi.expression/v1` CAS path. */
export function validateStageEdit(edit, name = 'stage edit') {
  const value = requireObject(edit, name);
  requireExactKeys(value, EDIT_KEYS, name);
  requireString(value.edit_ref, `${name}.edit_ref`);
  requireString(value.participant_ref, `${name}.participant_ref`);
  requireRevision(value.at_revision, `${name}.at_revision`);
  const target = requireObject(value.target, `${name}.target`);
  requireExactKeys(target, new Set(['kind', 'ref', 'revision']), `${name}.target`);
  if (!SHARED_STAGE_EDIT_TARGET_KINDS.includes(target.kind)) {
    throw new TypeError(`${name}.target.kind must be one of: ${SHARED_STAGE_EDIT_TARGET_KINDS.join(', ')}`);
  }
  requireString(target.ref, `${name}.target.ref`);
  if (target.revision !== undefined) requireRevision(target.revision, `${name}.target.revision`);
  const change = requireObject(value.change, `${name}.change`);
  if (Object.keys(change).length === 0) throw new TypeError(`${name}.change must carry at least one admitted presentation parameter`);
  if (value.causal !== undefined) validateCausal(value.causal, `${name}.causal`);
  requireString(value.occurred_at, `${name}.occurred_at`);
  if (Number.isNaN(Date.parse(value.occurred_at))) throw new TypeError(`${name}.occurred_at must be an ISO-compatible timestamp`);
  return clone(value);
}

function validateEdits(edits, name = 'stage edits') {
  if (!Array.isArray(edits)) throw new TypeError(`${name} must be an array`);
  if (edits.length > SHARED_STAGE_MAX_EDITS) throw new TypeError(`${name} exceeds ${SHARED_STAGE_MAX_EDITS} entries`);
  return edits.map((edit, index) => validateStageEdit(edit, `${name}[${index}]`));
}

function validateProvenance(provenance) {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new TypeError('stage provenance must be a non-empty array');
  }
  return provenance.map((entry, index) => {
    const value = requireObject(entry, `stage provenance[${index}]`);
    requireString(value.kind, `stage provenance[${index}].kind`);
    requireString(value.ref, `stage provenance[${index}].ref`);
    requireString(value.source_system, `stage provenance[${index}].source_system`);
    if (value.revision !== undefined) requireString(value.revision, `stage provenance[${index}].revision`);
    return clone(value);
  });
}

/**
 * The optional revisioned Shared Stage of one SharedField: the deliberate
 * co-inhabitation locus over material already admitted to that field.
 *
 * It synchronises only admitted shared presentation state. It never
 * synchronises local Workspace tabs/splits/window geometry, local
 * camera/read position, private drafts, Search history, Agent
 * transcripts/context, SessionSpace/Harness state, raw Nara/Personal state,
 * or GPU/particle/resonator/audio buffers — those stay local by default, and
 * this contract has no fields that could carry them.
 */
export function validateSharedStage(input) {
  const stage = requireObject(input, 'shared stage');
  requireExactKeys(stage, STAGE_KEYS, 'shared stage');

  if (stage.schema !== SHARED_STAGE_SCHEMA) throw new TypeError(`shared stage schema must be ${SHARED_STAGE_SCHEMA}`);
  requireString(stage.shared_stage_ref, 'shared_stage_ref');
  requireString(stage.field_ref, 'field_ref');
  requireRevision(stage.revision, 'revision');
  if (!SHARED_STAGE_STATES.includes(stage.state)) {
    throw new TypeError(`shared stage state must be one of: ${SHARED_STAGE_STATES.join(', ')}`);
  }
  if (stage.presenter_ref !== undefined) requireString(stage.presenter_ref, 'presenter_ref');
  requireString(stage.subject_ref, 'subject_ref');
  if (stage.presentation !== undefined) validateLocus(stage.presentation, 'stage presentation', false);
  if (stage.expression !== undefined) validateLocus(stage.expression, 'stage expression', true);
  if (stage.scene_ref !== undefined) requireString(stage.scene_ref, 'scene_ref');
  if (stage.focus_ref !== undefined) requireString(stage.focus_ref, 'focus_ref');
  if (stage.causal !== undefined) validateCausal(stage.causal, 'stage causal');
  validateEdits(stage.edits);
  validateProvenance(stage.provenance);

  return clone(stage);
}

/** Compose one approved authored presentation edit. */
export function createStageEdit(input) {
  requireObject(input, 'stage edit input');
  return validateStageEdit(clone(input));
}

/** Compose a stage contract. `revision` defaults to 1 for an opening stage;
 * later revisions must be advanced one step at a time through the hosted
 * reducer's revision check, never recomposed from nothing. */
export function createSharedStage(input) {
  requireObject(input, 'shared stage input');
  return validateSharedStage({
    revision: 1,
    state: 'open',
    edits: [],
    ...clone(input),
    schema: SHARED_STAGE_SCHEMA,
  });
}

/** Compose the next revision of an open stage. `expected_revision` must equal
 * the stage's current revision — the hosted reducer enforces the same check
 * server-side, so a stale writer is refused instead of silently winning. */
export function advanceSharedStage(stage, change, options) {
  const current = validateSharedStage(stage);
  requireObject(change, 'stage change');
  requireObject(options, 'stage advance options');
  requireRevision(options.expected_revision, 'expected_revision');
  if (options.expected_revision !== current.revision) {
    throw new TypeError(`stage advanced from under this writer: expected ${options.expected_revision}, stage is at ${current.revision}`);
  }
  if (current.state !== 'open') throw new TypeError('only an open stage can advance');
  const presenterRef = requireString(options.presenter_ref, 'presenter_ref');

  const next = clone(current);
  next.revision = current.revision + 1;
  next.presenter_ref = presenterRef;
  if (change.subject_ref !== undefined) next.subject_ref = requireString(change.subject_ref, 'change.subject_ref');
  if (change.presentation !== undefined) next.presentation = validateLocus(change.presentation, 'change.presentation', false);
  if (change.expression !== undefined) next.expression = validateLocus(change.expression, 'change.expression', true);
  if (change.scene_ref !== undefined) next.scene_ref = requireString(change.scene_ref, 'change.scene_ref');
  if (change.clear_scene_ref) delete next.scene_ref;
  if (change.focus_ref !== undefined) next.focus_ref = requireString(change.focus_ref, 'change.focus_ref');
  if (change.clear_focus_ref) delete next.focus_ref;
  if (change.causal !== undefined) next.causal = validateCausal(change.causal, 'change.causal');

  const edits = validateEdits(next.edits);
  if (change.edit !== undefined) {
    const edit = validateStageEdit(change.edit, 'change.edit');
    if (edit.at_revision !== next.revision) throw new TypeError('change.edit.at_revision must be the new stage revision');
    if (edit.participant_ref !== presenterRef) {
      throw new TypeError('change.edit.participant_ref must be the advancing presenter');
    }
    edits.push(edit);
  }
  next.edits = edits;
  return validateSharedStage(next);
}

/** Close an open stage. The stage stops being offered to the field; followers
 * keep their local view and the field relation is untouched. */
export function closeSharedStage(stage, options) {
  const current = validateSharedStage(stage);
  requireObject(options, 'stage close options');
  requireRevision(options.expected_revision, 'expected_revision');
  if (options.expected_revision !== current.revision) {
    throw new TypeError(`stage advanced from under this closer: expected ${options.expected_revision}, stage is at ${current.revision}`);
  }
  if (current.state !== 'open') throw new TypeError('only an open stage can close');
  const next = clone(current);
  next.revision = current.revision + 1;
  next.state = 'closed';
  return validateSharedStage(next);
}
