import { SPARSE_REPRESENTATION_SCHEMA, createProjection, validateProjection } from './index.mjs';
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
 * Compile owner-supplied authored Wiki edges into an already-eligible public
 * sparse Projection. `eligiblePublicRoutes` is the output of publication/privacy
 * authority: absence from that mapping means the relation target stays private.
 *
 * This operation never parses source language and never mutates canonical source
 * or the input Projection. It adds only presentation links for exact
 * `origin=authored` edges incident on the projected subject.
 */
export function compileEligibleAuthoredRelationProjection(value, authoredEdges, eligiblePublicRoutes) {
  const projection = validateProjection(value);
  requireRecord(eligiblePublicRoutes, 'eligible public routes');
  if (!Array.isArray(authoredEdges)) throw new TypeError('authored edges must be an array');

  // A local/private relation cannot become public merely because it exists.
  if (projection.audience.visibility !== 'public') return projection;
  if (projection.representation.kind !== SPARSE_REPRESENTATION_SCHEMA) {
    throw new TypeError(`Authored relation public compilation requires ${SPARSE_REPRESENTATION_SCHEMA}`);
  }

  const payload = requireRecord(projection.representation.payload, 'sparse projection representation');
  if (payload.schema !== SPARSE_REPRESENTATION_SCHEMA) {
    throw new TypeError(`Authored relation public compilation requires ${SPARSE_REPRESENTATION_SCHEMA} payload`);
  }

  const subjectRef = projection.subject.ref;
  const items = [];
  const seen = new Set();
  for (const candidate of authoredEdges) {
    const edge = requireRecord(candidate, 'authored edge');
    if (edge.origin !== 'authored') continue;
    const outgoing = edge.from_ref === subjectRef;
    const incoming = edge.to_ref === subjectRef;
    if (!outgoing && !incoming) continue;
    const targetRef = outgoing ? edge.to_ref : edge.from_ref;
    if (typeof targetRef !== 'string' || !targetRef) continue;
    const href = eligiblePublicRoutes[targetRef];
    if (typeof href !== 'string' || href.trim() === '') continue;
    const key = `${edge.ref ?? ''}\0${targetRef}\0${edge.relation ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const evidence = edge.authored_relation && typeof edge.authored_relation === 'object'
      ? edge.authored_relation
      : null;
    items.push({
      ref: targetRef,
      label: evidence?.display ?? evidence?.raw_target ?? targetRef,
      href,
      description: `${edge.relation ?? 'references'} · authored · ${outgoing ? 'outgoing' : 'backlink'}`,
    });
  }

  if (items.length === 0) return projection;
  const groups = Array.isArray(payload.groups) ? clone(payload.groups) : [];
  groups.push({ label: 'Related', items });
  return createProjection({
    ...projection,
    representation: {
      ...clone(projection.representation),
      payload: { ...clone(payload), groups },
    },
  });
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
