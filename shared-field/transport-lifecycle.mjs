/** Native transport callbacks disclose availability; cached rows do not establish it.
 * Construct before DbConnection; wire connected/disconnected/connectError to its
 * callbacks, and subscribing/applied/subscriptionError to the actual subscription.
 * Identity is transport provenance, never Participant or human authority.
 */
export function createExploreTransportLifecycle() {
  let state = { state: 'not-connected', changed_at: new Date().toISOString() };
  const listeners = new Set();
  function transition(next, details = {}) {
    state = { ...details, state: next, changed_at: new Date().toISOString() };
    for (const listener of listeners) listener({ type: 'transport', transport: structuredClone(state) });
  }
  return Object.freeze({
    status: () => structuredClone(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    connected(identity) { transition('connected', { identity: String(identity) }); },
    subscribing() { transition('subscribing', { identity: state.identity }); },
    applied() {
      if (!['connected', 'subscribing', 'available'].includes(state.state)) throw new Error('Subscription applied without connected transport');
      transition('available', { identity: state.identity });
    },
    disconnected(error) { transition('offline', { identity: state.identity, ...(error ? { error: String(error.message ?? error) } : {}) }); },
    connectError(error) { transition('error', { error: String(error.message ?? error) }); },
    subscriptionError(error) { transition('error', { identity: state.identity, error: String(error.message ?? error) }); },
    disposed() { transition('disposed', { identity: state.identity }); },
  });
}
