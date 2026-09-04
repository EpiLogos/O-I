/**
 * The one kernel-event source (02 §5, §7).
 *
 * The kernel pushes typed application events; the renderer subscribes once and
 * dispatches them to consumers. This module owns the contract on the renderer
 * side: envelope validation, the focus consumer derived from events, and the
 * source that fans events out. It performs no Tauri import — the host binding
 * is injected — so the whole seam is testable without a webview.
 *
 * Events are disclosure, not authority: consuming them grants the renderer no
 * capability and every fact they carry can be re-read from the kernel.
 */

export const KERNEL_EVENT_SCHEMA = 'oi.kernel-event/v1';
export const KERNEL_EVENT_VERSION = 1;
/** Topic the desktop host forwards kernel events on (kernel: KERNEL_EVENT_TOPIC). */
export const KERNEL_EVENT_TOPIC = 'oi:kernel-event';

/** Every 02 §5 event, tagged exactly as the kernel tags it on the wire. */
export const KERNEL_EVENT_TAGS = Object.freeze([
  'focus_changed',
  'world_changed',
  'source_changed',
  'activity_updated',
  'session_changed',
  'knowledge_changed',
  'attention_raised',
  'attention_resolved',
  'run_changed',
  'journey_changed',
  'material_changed',
  'composition_changed',
  'shared_field_changed',
]);

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function semanticRef(value, name) {
  record(value, name);
  if (typeof value.ref !== 'string' || value.ref.trim() === '') {
    throw new TypeError(`${name}.ref must be a non-empty string`);
  }
  return Object.freeze({ ...value });
}

/**
 * Validate one envelope exactly as the kernel emits it. Returns the typed
 * event as `{ event, ...payload }`; anything that is not this contract fails
 * closed instead of degrading into another event kind.
 */
export function parseKernelEventEnvelope(raw) {
  record(raw, 'kernel event envelope');
  if (raw.schema !== KERNEL_EVENT_SCHEMA) {
    throw new TypeError(`Unsupported kernel event schema: ${raw.schema}`);
  }
  if (raw.version !== KERNEL_EVENT_VERSION) {
    throw new TypeError(`Unsupported kernel event version: ${raw.version}`);
  }
  if (!KERNEL_EVENT_TAGS.includes(raw.event)) {
    throw new TypeError(`Unknown kernel event: ${raw.event}`);
  }
  const payload = { ...raw };
  delete payload.schema;
  delete payload.version;
  return Object.freeze({ event: raw.event, ...payload });
}

/**
 * The empty relation is `B0 No focus` (03 §B). Absent relations stay absent —
 * they are observations, never fabricated.
 */
export function emptyFocus() {
  return Object.freeze({ world: null, project: null, subject: null, journey: null, agency_encounter: null });
}

/** The five 02 §7 relation roles, in kernel serialisation order. */
const FOCUS_SLOTS = ['world', 'project', 'subject', 'journey', 'agency_encounter'];

function relation(value) {
  return value ? semanticRef(value, 'focus relation') : null;
}

/** Normalise a focus relation as the kernel serialises it (`oi.global-focus/v1`). */
export function normalizeFocus(value) {
  const focus = record(value, 'focus relation');
  return Object.freeze({
    world: relation(focus.world),
    project: relation(focus.project),
    subject: relation(focus.subject),
    journey: relation(focus.journey),
    agency_encounter: relation(focus.agency_encounter),
  });
}

function sameSemanticRef(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.ref === right.ref
    && left.kind === right.kind
    && left.native_owner === right.native_owner
    && JSON.stringify(left.provenance ?? null) === JSON.stringify(right.provenance ?? null);
}

/**
 * Whether two focus relations carry the same kernel facts. Used to keep
 * mirrors identity-stable: a repeated snapshot pull that says what the mirror
 * already says must not re-render the world.
 */
export function sameFocus(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return FOCUS_SLOTS.every((slot) => sameSemanticRef(left[slot], right[slot]));
}

/**
 * Bootstrap the focus consumer from a shell snapshot pull. The snapshot's
 * `focus` is the kernel relation; `selection` on an older snapshot is the same
 * kernel fact under its previous name — never a component-local copy.
 */
export function focusFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (snapshot.focus) return normalizeFocus(snapshot.focus);
  if (snapshot.selection) {
    return normalizeFocus({ subject: snapshot.selection });
  }
  return null;
}

/**
 * The one focus reducer: only `focus_changed` moves focus, and it replaces the
 * whole relation with the kernel's — exactly one current focus relation
 * renderer-wide, never an accumulation of per-component selections.
 */
export function reduceFocus(current, envelope) {
  if (envelope?.event !== 'focus_changed') return current ?? null;
  return normalizeFocus(envelope.focus);
}

/**
 * A focus consumer derived from events. Presentation reads it; it owns no
 * semantic authority — the kernel does (02 §6).
 *
 * The kernel's focus reaches this consumer two honest ways: pushed as
 * `focus_changed`, or pulled as a snapshot's `focus`/`selection` (a cold or
 * re-mounting surface, focus restore, a second window). Until the first
 * `focus_changed` flows, the pull is the newest kernel fact this surface has;
 * once events flow they are newer than any pull, so further pulls are refused
 * and can never clobber event-derived focus.
 */
export function createFocusConsumer(initial = null) {
  let focus = initial ? normalizeFocus(initial) : null;
  let eventDerived = false;
  return {
    apply(envelope) {
      focus = reduceFocus(focus, envelope);
      if (envelope?.event === 'focus_changed') eventDerived = true;
      return focus;
    },
    /**
     * Adopt kernel focus from a snapshot pull. Returns the adopted relation —
     * the same object as before when it says what the mirror already says — or
     * null when the pull was refused because events are authoritative.
     */
    seed(pulled) {
      if (eventDerived) return null;
      if (!pulled) return focus;
      const next = normalizeFocus(pulled);
      if (!focus || !sameFocus(focus, next)) focus = next;
      return focus;
    },
    /** Whether at least one kernel `focus_changed` has been applied. */
    eventDerived() {
      return eventDerived;
    },
    current() {
      return focus;
    },
    subject() {
      return focus?.subject ?? null;
    },
  };
}

/**
 * The kernel-event source: one subscription, many consumers. Unknown or
 * malformed envelopes fail closed and are reported, never silently reinterpreted;
 * a failing consumer cannot break the others.
 */
export function createKernelEventSource() {
  const consumers = new Set();
  const errors = [];
  let events = [];
  let status = 'unbound';

  return {
    /** Feed one raw host payload (already unwrapped from the transport). */
    ingest(raw) {
      let envelope;
      try {
        envelope = parseKernelEventEnvelope(raw);
      } catch (error) {
        errors.push(error);
        return null;
      }
      events = [...events.slice(-199), envelope];
      for (const consumer of consumers) {
        try {
          consumer(envelope);
        } catch (error) {
          errors.push(error);
        }
      }
      return envelope;
    },

    subscribe(consumer) {
      if (typeof consumer !== 'function') throw new TypeError('consumer must be a function');
      consumers.add(consumer);
      return () => consumers.delete(consumer);
    },

    events() {
      return [...events];
    },

    drainErrors() {
      return errors.splice(0, errors.length);
    },

    status() {
      return status;
    },

    markLive() {
      status = 'live';
    },

    markDegraded(reason) {
      status = 'degraded';
      errors.push(reason instanceof Error ? reason : new TypeError(String(reason)));
    },
  };
}

/**
 * Bind a source to the host transport. `listen` is injected so this stays
 * testable; in the desktop it is Tauri's `listen`. Exactly one binding feeds
 * the whole renderer, so every surface consumes the same kernel truth.
 */
export function bindKernelEventSource(source, listen) {
  if (typeof listen !== 'function') throw new TypeError('listen must be a function');
  let unlisten = null;
  const ready = Promise.resolve()
    .then(() => listen(KERNEL_EVENT_TOPIC, (event) => {
      source.ingest(event?.payload);
    }))
    .then((stop) => {
      unlisten = stop;
      source.markLive();
      return source;
    })
    .catch((error) => {
      source.markDegraded(error);
      return source;
    });
  return {
    ready,
    stop() {
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    },
  };
}
