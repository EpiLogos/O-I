/** The timeline's category ids, in the vendored timeline's order (vendor timeline/categories.ts TIMELINE_CATEGORIES).
 * Import-free on purpose: researchMaterial.ts and timelineViews.ts are compiled by the cradle, the live shell and
 * expressions-boundary too, and importing the vendored categories module reaches its contracts and the vendored schema
 * (zod), which those roots do not install. The parity with the vendored list is pinned by
 * tests/timeline-category-ids.test.mjs, and the kernel's TIMELINE_CATEGORY_IDS by tests/timeline-views.test.mjs. */
export const TIMELINE_CATEGORY_IDS = [
  'historical-event', 'claim', 'interpretation', 'archetype', 'myth-in-time', 'myth',
  'speculation-contested', 'source', 'book-writing', 'constellation', 'institution-network-figure',
] as const;
