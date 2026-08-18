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
 * Human/browser editing creates a new Projection revision through the already
 * canonical refinement operation. Source system/revision are preserved exactly;
 * only the public representation and attributable editor provenance change.
 */
export function refineWorldPresentationProjection(previous, presentation, input) {
  const prior = validateProjection(previous);
  const nextPresentation = validateWorldPresentation(presentation);
  if (nextPresentation.world_ref !== prior.subject.ref) {
    throw new TypeError('World presentation world_ref must match Projection subject.ref');
  }

  return refineProjection(prior, {
    ...clone(input),
    representation: {
      kind: WORLD_PRESENTATION_SCHEMA,
      payload: nextPresentation,
    },
  });
}
