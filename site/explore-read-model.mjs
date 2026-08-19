import {
  createExploreSurfaceModel,
  EXPLORE_SURFACE_SEED_SCHEMA,
} from '../shared-field/explore-surface.mjs';

export const EXPLORE_BROWSER_SEED_SCHEMA = EXPLORE_SURFACE_SEED_SCHEMA;

/**
 * Hosted/browser adapter over the same renderer-neutral Explore application
 * consumed by desktop and structured Agent Surfaces.
 *
 * Browser code owns rendering and provider lifecycle only. Search, semantic refs,
 * relation expansion, Projection identity and WorldPresentation validation remain
 * in the shared Explore application model.
 */
export function createExploreBrowserModel(seed) {
  return createExploreSurfaceModel(seed);
}
