import { createExploreApplication } from './explore.mjs';
import { validateProjection } from './index.mjs';
import { validateWorldPresentation } from './presentation.mjs';
import { worldPresentationFromProjection } from './presentation-projection.mjs';

export const EXPLORE_SURFACE_SEED_SCHEMA = 'oi.explore-browser-seed/v1';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

/**
 * Surface-neutral Explore application/read-model composition.
 *
 * Search, semantic refs, relation expansion, Projection identity and
 * WorldPresentation validation remain outside any particular renderer. Web,
 * desktop and structured agent Surfaces can consume this same application seam.
 */
export function createExploreSurfaceModel(seed) {
  requireRecord(seed, 'Explore Surface seed');
  if (seed.schema !== EXPLORE_SURFACE_SEED_SCHEMA) {
    throw new TypeError(`Unsupported Explore Surface seed schema: ${seed.schema}`);
  }

  const entries = requireArray(seed.entries ?? [], 'Explore Surface seed.entries');
  const relations = requireArray(seed.relations ?? [], 'Explore Surface seed.relations');
  const app = createExploreApplication({ entries, relations });

  const presentations = new Map();
  for (const rawPresentation of requireArray(seed.presentations ?? [], 'Explore Surface seed.presentations')) {
    const presentation = validateWorldPresentation(rawPresentation);
    if (presentations.has(presentation.world_ref)) {
      throw new TypeError(`Duplicate WorldPresentation for ${presentation.world_ref}`);
    }
    presentations.set(presentation.world_ref, presentation);
  }

  const presentationProjections = new Map();
  for (const rawProjection of requireArray(
    seed.presentation_projections ?? [],
    'Explore Surface seed.presentation_projections',
  )) {
    const projection = validateProjection(rawProjection);
    const presentation = worldPresentationFromProjection(projection);
    const previous = presentationProjections.get(presentation.world_ref);
    if (!previous || projection.projection_revision > previous.projection_revision) {
      presentationProjections.set(presentation.world_ref, projection);
      presentations.set(presentation.world_ref, presentation);
    }
  }

  function worlds() {
    const result = [];
    const seen = new Set();
    for (const entry of app.search('', { limit: Math.max(entries.length, 1) })) {
      if (entry.ref !== entry.world_ref || seen.has(entry.world_ref)) continue;
      seen.add(entry.world_ref);
      result.push({
        ...clone(entry),
        presentation: clone(presentations.get(entry.world_ref)),
        presentation_projection: clone(presentationProjections.get(entry.world_ref)),
      });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label) || a.ref.localeCompare(b.ref));
  }

  function search(query = '', options = {}) {
    return app.search(query, options).map((result) => ({
      ...clone(result),
      has_world_presentation: presentations.has(result.world_ref),
    }));
  }

  function open(ref, options = {}) {
    const opened = app.open(ref, options);
    if (!opened) return undefined;
    const worldRef = opened.resource.world_ref;
    return {
      ...clone(opened),
      world: clone(app.resolve(worldRef)),
      world_presentation: clone(presentations.get(worldRef)),
      world_presentation_projection: clone(presentationProjections.get(worldRef)),
      sources: clone(app.sources(ref)),
      explain: clone(app.explain(ref)),
    };
  }

  function presentation(worldRef) {
    return clone(presentations.get(worldRef));
  }

  function presentationProjection(worldRef) {
    return clone(presentationProjections.get(worldRef));
  }

  return Object.freeze({
    worlds,
    search,
    open,
    read: app.read,
    relations: app.relations,
    sources: app.sources,
    explain: app.explain,
    presentation,
    presentationProjection,
  });
}
