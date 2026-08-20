import { createExploreBrowserModel } from './explore-read-model.mjs';
import { exploreSurfaceSeedFromHostedSnapshot } from '../shared-field/spacetimedb-explore-surface.mjs';

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

/**
 * Static/file carrier for a public Explore browser Surface.
 * This is a provider implementation, not the Explore application model itself.
 */
export function createStaticExploreBrowserProvider({ source, fetchImpl = fetch }) {
  if (typeof source !== 'string' || source.trim() === '') throw new TypeError('static Explore provider source is required');
  requireFunction(fetchImpl, 'static Explore provider fetchImpl');

  async function current() {
    const response = await fetchImpl(source);
    if (!response.ok) throw new Error(`Explore provider returned ${response.status}`);
    return createExploreBrowserModel(await response.json());
  }

  return Object.freeze({
    kind: 'static',
    current,
    subscribe() {
      return () => undefined;
    },
    status() {
      return { kind: 'static', live: false, source };
    },
  });
}

/**
 * Adapter over the already-real shared-field createLiveExploreApplication facade.
 *
 * It deliberately consumes only the facade's snapshot/subscribe surface. The
 * browser does not learn SpaceTimeDB row identities or table semantics; generated
 * client construction remains a transport/provider responsibility.
 */
export function createLiveExploreBrowserProvider(liveApplication) {
  if (!liveApplication || typeof liveApplication !== 'object') {
    throw new TypeError('live Explore application is required');
  }
  requireFunction(liveApplication.snapshot, 'live Explore application.snapshot');
  requireFunction(liveApplication.subscribe, 'live Explore application.subscribe');

  function current() {
    return createExploreBrowserModel(exploreSurfaceSeedFromHostedSnapshot(liveApplication.snapshot()));
  }

  function subscribe(listener) {
    requireFunction(listener, 'live Explore browser provider listener');
    return liveApplication.subscribe((event) => {
      if (event?.type !== 'rebuild') return;
      listener({ event, model: current() });
    });
  }

  function status() {
    return typeof liveApplication.status === 'function'
      ? { kind: 'live', live: true, ...liveApplication.status() }
      : { kind: 'live', live: true };
  }

  return Object.freeze({ kind: 'live', current, subscribe, status });
}

export { exploreSurfaceSeedFromHostedSnapshot as browserSeedFromHostedSnapshot };
