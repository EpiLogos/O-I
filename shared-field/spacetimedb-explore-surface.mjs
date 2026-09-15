import { EXPLORE_SURFACE_SEED_SCHEMA, createExploreSurfaceModel } from './explore-surface.mjs';
import { WORLD_PRESENTATION_SCHEMA } from './presentation.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function array(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

/**
 * Convert a validated hosted SpaceTimeDB snapshot into the existing Surface-neutral
 * Explore seed. SpaceTimeDB remains a provider of live shared state; it does not
 * acquire semantic ownership of entries, relations, Projections or presentations.
 */
export function exploreSurfaceSeedFromHostedSnapshot(snapshot, additions = {}) {
  record(snapshot, 'hosted Explore snapshot');
  record(additions, 'Explore Surface additions');

  const entries = array(snapshot.entries ?? [], 'hosted Explore snapshot.entries');
  const relations = array(snapshot.relations ?? [], 'hosted Explore snapshot.relations');
  const projections = array(snapshot.projections ?? [], 'hosted Explore snapshot.projections');

  const presentationProjections = projections.filter((projection) =>
    projection?.state === 'published' && projection?.representation?.kind === WORLD_PRESENTATION_SCHEMA
  );

  return {
    schema: EXPLORE_SURFACE_SEED_SCHEMA,
    entries: clone(entries),
    relations: clone(relations),
    presentations: [],
    presentation_projections: clone(presentationProjections),
    ...(Array.isArray(additions.composition_contributions)
      ? { composition_contributions: clone(additions.composition_contributions) }
      : {}),
    ...(additions.source_return && typeof additions.source_return === 'object'
      ? { source_return: clone(additions.source_return) }
      : {}),
  };
}

export function createExploreSurfaceModelFromHostedSnapshot(snapshot, additions = {}) {
  return createExploreSurfaceModel(exploreSurfaceSeedFromHostedSnapshot(snapshot, additions));
}
