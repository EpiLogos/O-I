import {
  canonicalProjection,
  createProjection,
  validateProjection,
} from './index.mjs';

export const PROJECTION_REFINEMENT_KIND = 'human-refinement';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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

function requireTimestamp(value, name) {
  requireString(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
}

function validateEditorProvenance(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('projection refinement provenance must be a non-empty array');
  }
  return value.map((entry, index) => {
    requireObject(entry, `projection refinement provenance[${index}]`);
    if (entry.kind !== PROJECTION_REFINEMENT_KIND) {
      throw new TypeError(`projection refinement provenance[${index}].kind must be ${PROJECTION_REFINEMENT_KIND}`);
    }
    requireString(entry.ref, `projection refinement provenance[${index}].ref`);
    requireString(entry.source_system, `projection refinement provenance[${index}].source_system`);
    requireString(entry.revision, `projection refinement provenance[${index}].revision`);
    return clone(entry);
  });
}

/**
 * Publish a new Projection revision which refines the public/shared representation
 * without pretending the canonical source system changed.
 *
 * Source system and source revision are copied verbatim from the prior Projection.
 * The new publishing Participant and human-refinement provenance are explicit, and the
 * prior Projection revision remains addressable through `supersedes`.
 */
export function refineProjection(previous, input) {
  const prior = validateProjection(previous);
  if (prior.state === 'withdrawn') throw new TypeError('Cannot refine a withdrawn projection');
  requireObject(input, 'projection refinement');

  const allowed = new Set([
    'publisher_participant_ref',
    'published_at',
    'representation',
    'provenance',
    'transport',
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new TypeError(`projection refinement.${key} is unsupported; canonical source state cannot be rewritten by refinement`);
    }
  }

  requireString(input.publisher_participant_ref, 'projection refinement.publisher_participant_ref');
  requireTimestamp(input.published_at, 'projection refinement.published_at');
  const editorProvenance = validateEditorProvenance(input.provenance);

  return createProjection({
    ...canonicalProjection(prior),
    projection_revision: prior.projection_revision + 1,
    state: 'published',
    source: clone(prior.source),
    publisher_participant_ref: input.publisher_participant_ref,
    published_at: input.published_at,
    representation: input.representation ?? prior.representation,
    provenance: [...prior.provenance.map(clone), ...editorProvenance],
    supersedes: {
      projection_ref: prior.projection_ref,
      projection_revision: prior.projection_revision,
      source_revision: prior.source.revision,
    },
    ...(input.transport ? { transport: clone(input.transport) } : {}),
  });
}
