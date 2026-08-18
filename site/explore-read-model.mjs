import { createExploreApplication } from '../shared-field/explore.mjs';
import { validateProjection } from '../shared-field/index.mjs';
import { validateWorldPresentation } from '../shared-field/presentation.mjs';
import { worldPresentationFromProjection } from '../shared-field/presentation-projection.mjs';

export const EXPLORE_BROWSER_SEED_SCHEMA = 'oi.explore-browser-seed/v1';

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
 * Browser application adapter over the canonical Explore application seam.
 * React receives this read model; it does not own search, semantic refs,
 * relation expansion, Projection identity, or WorldPresentation validation.
 */
export function createExploreBrowserModel(seed) {
  requireRecord(seed, 'Explore browser seed');
  if (seed.schema !== EXPLORE_BROWSER_SEED_SCHEMA) {
    throw new TypeError(`Unsupported Explore browser seed schema: ${seed.schema}`);
  }

  const entries = requireArray(seed.entries ?? [], 'Explore browser seed.entries');
  const relations = requireArray(seed.relations ?? [], 'Explore browser seed.relations');
  const app = createExploreApplication({ entries, relations });

  const presentations = new Map();
  for (const rawPresentation of requireArray(seed.presentations ?? [], 'Explore browser seed.presentations')) {
    const presentation = validateWorldPresentation(rawPresentation);
    if (presentations.has(presentation.world_ref)) {
      throw new TypeError(`Duplicate WorldPresentation for ${presentation.world_ref}`);
    }
    presentations.set(presentation.world_ref, presentation);
  }

  const presentationProjections = new Map();
  for (const rawProjection of requireArray(
    seed.presentation_projections ?? [],
    'Explore browser seed.presentation_projections',
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
