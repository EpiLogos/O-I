import { createProjection, validateProjection } from './index.mjs';
import { refineProjection } from './projection-refinement.mjs';
import { WORLD_PRESENTATION_SCHEMA, validateWorldPresentation } from './presentation.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireRecord(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

/**
 * Create a normal oi.projection/v1 whose representation is a portable world
 * presentation. The world presentation remains representation, never the
 * canonical Human/Agent/Project/Wiki identity it arranges.
 */
export function createWorldPresentationProjection(input) {
  requireRecord(input, 'world presentation projection');
  const presentation = validateWorldPresentation(input.presentation);
  return createProjection({
    ...clone(input.projection),
    representation: {
      kind: WORLD_PRESENTATION_SCHEMA,
      payload: presentation,
    },
  });
}

export function worldPresentationFromProjection(value) {
  const projection = validateProjection(value);
  if (projection.representation.kind !== WORLD_PRESENTATION_SCHEMA) {
    throw new TypeError(`Projection is not a ${WORLD_PRESENTATION_SCHEMA} representation`);
  }
  const presentation = validateWorldPresentation(projection.representation.payload);
  if (presentation.world_ref !== projection.subject.ref) {
    throw new TypeError('World presentation world_ref must match Projection subject.ref');
  }
  return presentation;
}

/**
 * Human/agent authoring creates a new Projection revision through the already
 * canonical refinement operation. Working state may retain the published
 * WorldPresentation revision while it is edited; ratification advances that
 * representation revision exactly once. Source system/revision are preserved.
 */
export function refineWorldPresentationProjection(previous, presentation, input) {
  const prior = validateProjection(previous);
  const priorPresentation = worldPresentationFromProjection(prior);
  let nextPresentation = validateWorldPresentation(presentation);
  if (nextPresentation.world_ref !== prior.subject.ref) {
    throw new TypeError('World presentation world_ref must match Projection subject.ref');
  }
  if (nextPresentation.presentation_ref !== priorPresentation.presentation_ref) {
    throw new TypeError('World presentation presentation_ref must remain stable across refinement');
  }
  if (nextPresentation.revision < priorPresentation.revision) {
    throw new TypeError('World presentation revision cannot move backwards during refinement');
  }
  if (nextPresentation.revision === priorPresentation.revision) {
    nextPresentation = validateWorldPresentation({
      ...clone(nextPresentation),
      revision: priorPresentation.revision + 1,
    });
  }

  return refineProjection(prior, {
    ...clone(input),
    representation: {
      kind: WORLD_PRESENTATION_SCHEMA,
      payload: nextPresentation,
    },
  });
}
