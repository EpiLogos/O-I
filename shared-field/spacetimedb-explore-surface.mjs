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

  // Projection/SharedField membership rides the hosted rows' field columns,
  // surfaced by the snapshot as ref-keyed maps; it is read state, never part
  // of an entry's semantic identity.
  const entryFields = snapshot.entry_fields && typeof snapshot.entry_fields === 'object' && !Array.isArray(snapshot.entry_fields)
    ? snapshot.entry_fields
    : undefined;
  const relationFields = snapshot.relation_fields && typeof snapshot.relation_fields === 'object' && !Array.isArray(snapshot.relation_fields)
    ? snapshot.relation_fields
    : undefined;
  const fields = array(snapshot.fields ?? [], 'hosted Explore snapshot.fields')
    .filter((field) => field && typeof field === 'object');

  return {
    schema: EXPLORE_SURFACE_SEED_SCHEMA,
    entries: clone(entries),
    relations: clone(relations),
    presentations: [],
    presentation_projections: clone(presentationProjections),
    ...(entryFields ? { entry_fields: clone(entryFields) } : {}),
    ...(relationFields ? { relation_fields: clone(relationFields) } : {}),
    ...(fields.length ? { fields: clone(fields) } : {}),
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
