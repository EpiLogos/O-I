export const WATCH_SCHEMA = 'oi.watch/v1';
export const WATCH_TARGET_KINDS = Object.freeze([
  'world',
  'agent',
  'project',
  'wiki-space',
  'wiki-node',
  'object',
]);
export const WATCH_STATES = Object.freeze(['active', 'paused']);
export const WATCH_NON_IMPLICATIONS = Object.freeze([
  'trust',
  'endorsement',
  'preference',
  'semantic-truth',
]);

const WATCH_KEYS = new Set([
  'schema',
  'watch_ref',
  'watcher_participant_ref',
  'field_ref',
  'target',
  'state',
  'created_at',
  'provenance',
]);

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
    if (!allowed.has(key)) throw new TypeError(`${name}.${key} is not part of ${WATCH_SCHEMA}`);
  }
}

function validateTarget(target) {
  requireObject(target, 'watch target');
  requireExactKeys(target, new Set(['kind', 'ref']), 'watch target');
  if (!WATCH_TARGET_KINDS.includes(target.kind)) {
    throw new TypeError(`watch target kind must be one of: ${WATCH_TARGET_KINDS.join(', ')}`);
  }
  requireString(target.ref, 'watch target ref');
}

function validateProvenance(provenance) {
  requireObject(provenance, 'watch provenance');
  requireExactKeys(provenance, new Set(['source_system', 'source_revision']), 'watch provenance');
  requireString(provenance.source_system, 'watch provenance source_system');
  requireString(provenance.source_revision, 'watch provenance source_revision');
}

/**
 * Validate the smallest neutral future-availability marker for an addressable O:I object.
 *
 * A Watch records only that a Participant wants future availability/change information
 * about a public/shared-field target. It intentionally carries no trust, endorsement,
 * preference, ranking, or semantic-truth judgement.
 */
export function validateWatch(input) {
  const watch = requireObject(input, 'watch');
  requireExactKeys(watch, WATCH_KEYS, 'watch');

  if (watch.schema !== WATCH_SCHEMA) throw new TypeError(`watch schema must be ${WATCH_SCHEMA}`);
  requireString(watch.watch_ref, 'watch_ref');
  requireString(watch.watcher_participant_ref, 'watcher_participant_ref');
  requireString(watch.field_ref, 'field_ref');
  validateTarget(watch.target);

  if (!WATCH_STATES.includes(watch.state)) {
    throw new TypeError(`watch state must be one of: ${WATCH_STATES.join(', ')}`);
  }

  requireString(watch.created_at, 'created_at');
  if (Number.isNaN(Date.parse(watch.created_at))) throw new TypeError('created_at must be an ISO-compatible timestamp');
  validateProvenance(watch.provenance);

  return clone(watch);
}

export function createWatch(input) {
  requireObject(input, 'watch input');
  return validateWatch({
    schema: WATCH_SCHEMA,
    state: 'active',
    ...clone(input),
  });
}

export function watchTargets(watch, semanticRef) {
  const valid = validateWatch(watch);
  requireString(semanticRef, 'semantic ref');
  return valid.target.ref === semanticRef;
}
