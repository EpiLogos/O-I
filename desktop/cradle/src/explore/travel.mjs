/**
 * Explore travel — the compact view state the global Explore destination
 * remembers (SHARED-FIELD-DESKTOP §1, §12): the current query, the selected
 * projected subject, the navigation history and which contextual depths
 * are open. Presentation state only: it never carries a cloned remote
 * payload, a transcript, a graph store or an owner identity. A foreign or
 * corrupt payload degrades to a fresh field, never to a guess.
 *
 * Pure and language-neutral so the desktop can unit-test the codec outside
 * a browser; the renderer wraps it in `ExploreSurface`.
 */
export const EXPLORE_TRAVEL_SCHEMA = 'oi.cradle.explore-travel/v1';
export const EXPLORE_TRAVEL_KEY = 'oi-cradle.explore.v1';
export const EXPLORE_TRAVEL_LIMIT = 32;
const DEPTHS = ['relations', 'source'];

export function freshExploreTravel() {
  return { schema: EXPLORE_TRAVEL_SCHEMA, visits: [{ query: '' }], index: 0 };
}

function validVisit(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.query !== 'string' || raw.query.length > 512) return null;
  const visit = { query: raw.query };
  if (raw.selected !== undefined) {
    if (typeof raw.selected !== 'string' || !raw.selected || raw.selected.length > 1024) return null;
    visit.selected = raw.selected;
  }
  if (raw.depth !== undefined) {
    if (!raw.depth || typeof raw.depth !== 'object' || Array.isArray(raw.depth)) return null;
    const depth = {};
    for (const key of Object.keys(raw.depth)) {
      if (!DEPTHS.includes(key) || typeof raw.depth[key] !== 'boolean') return null;
      depth[key] = raw.depth[key];
    }
    visit.depth = depth;
  }
  return visit;
}

/** Decode a persisted value into a valid travel, or a fresh one. */
export function decodeExploreTravel(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return freshExploreTravel();
  if (value.schema !== EXPLORE_TRAVEL_SCHEMA || !Array.isArray(value.visits) || value.visits.length === 0 || value.visits.length > EXPLORE_TRAVEL_LIMIT) return freshExploreTravel();
  const visits = value.visits.map(validVisit);
  if (visits.some((visit) => visit === null)) return freshExploreTravel();
  if (!Number.isInteger(value.index) || value.index < 0 || value.index >= visits.length) return freshExploreTravel();
  return { schema: EXPLORE_TRAVEL_SCHEMA, visits, index: value.index };
}

export function currentVisit(travel) {
  return travel.visits[travel.index];
}

/** Push a new visit after the current one (forward history is released), bounded. */
export function pushVisit(travel, visit) {
  const next = validVisit(visit);
  if (!next) throw new TypeError('explore visit is malformed');
  const visits = [...travel.visits.slice(0, travel.index + 1), next].slice(-EXPLORE_TRAVEL_LIMIT);
  return { schema: EXPLORE_TRAVEL_SCHEMA, visits, index: visits.length - 1 };
}

/** Replace the current visit in place (query typing, depth toggles). */
export function amendVisit(travel, change) {
  const merged = validVisit({ ...currentVisit(travel), ...change });
  if (!merged) throw new TypeError('explore visit change is malformed');
  if (change.selected === undefined && 'selected' in change) delete merged.selected;
  return { ...travel, visits: travel.visits.map((visit, index) => (index === travel.index ? merged : visit)) };
}

export function travelBy(travel, delta) {
  const index = Math.max(0, Math.min(travel.visits.length - 1, travel.index + delta));
  return index === travel.index ? travel : { ...travel, index };
}

export function canTravel(travel, delta) {
  const index = travel.index + delta;
  return index >= 0 && index < travel.visits.length;
}
