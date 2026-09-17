/**
 * The bounded live-embedding budget (ES2 anti-recursion law,
 * docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md §4.1, §17 ES2):
 *
 *   - identity recursion is allowed and visible;
 *   - active renderer recursion is depth/budget bounded;
 *   - same-expression same-host embedding resolves to a link/portal rather
 *     than another live engine instance;
 *   - promotion/focus reuses the existing live host rather than cloning it.
 *
 * One JS realm = one host (a desktop window). The register tracks which
 * Expression refs currently hold a LIVE renderer here and how deep live
 * embedding has gone. `resolveEmbedding` is the single decision every live
 * Expression body consults before presenting: a second live body of the same
 * Expression in this window, or any live body beyond the depth budget,
 * resolves to an explicit PORTAL (a visible, addressable link naming the
 * live occurrence) instead of another engine.
 *
 * The module holds no document data — refs only — so it never becomes a
 * private store.
 */

/** Maximum live Expression renderers this host nests at once. The Global
 * Expression Stage already admits exactly one live presentation per window;
 * the depth budget states that law as data for embedded hosts. */
export const MAX_LIVE_EMBEDDING_DEPTH = 1;

/** @type {Map<string, {refs: Set<string>}>} */
const hosts = new Map();

const hostState = (host) => {
  const key = typeof host === "string" && host ? host : "window";
  let state = hosts.get(key);
  if (!state) { state = { refs: new Set() }; hosts.set(key, state); }
  return state;
};

export function liveEmbeddingDepth(host) {
  return hostState(host).refs.size;
}

/**
 * Resolve how this host admits one Expression ref as a presentation body.
 * Returns `{mode:"live"}` when a live renderer may present, or
 * `{mode:"portal", reason, live_host}` when the anti-recursion law resolves
 * the placement to a link/portal instead.
 */
export function resolveEmbedding(expressionRef, host) {
  if (typeof expressionRef !== "string" || !expressionRef.startsWith("expression:")) {
    throw new TypeError("resolveEmbedding expects a native Expression ref");
  }
  const state = hostState(host);
  if (state.refs.has(expressionRef)) {
    return { mode: "portal", reason: "same-expression is already live on this host", live_host: "this host" };
  }
  if (state.refs.size >= MAX_LIVE_EMBEDDING_DEPTH) {
    return { mode: "portal", reason: "this host's live-embedding depth budget is spent", live_host: "this host" };
  }
  return { mode: "live" };
}

/** Register a live body. Returns an idempotent release function. */
export function admitLive(expressionRef, host) {
  const state = hostState(host);
  state.refs.add(expressionRef);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.refs.delete(expressionRef);
    for (const [key, value] of hosts) if (value === state && value.refs.size === 0) hosts.delete(key);
  };
}

/** Atomic test-and-admit: resolve the embedding law and take the live slot
 * in one step. Returns `{admitted:true, release}` or
 * `{admitted:false, resolution}` — no window in which two bodies both
 * believe they hold the slot. */
export function tryAdmitLive(expressionRef, host) {
  const resolution = resolveEmbedding(expressionRef, host);
  if (resolution.mode !== "live") return { admitted: false, resolution };
  return { admitted: true, resolution, release: admitLive(expressionRef, host) };
}

/** Test/diagnostic view: which refs hold live bodies per host. */
export function inspectEmbeddings() {
  return Object.fromEntries([...hosts.entries()].map(([host, state]) => [host, [...state.refs]]));
}

/** Reset all hosts (tests only). */
export function resetEmbeddings() {
  hosts.clear();
}
