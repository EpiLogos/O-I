/**
 * The TechneAdapter floor (L5 Technē T0) — the renderer-side composition seam
 * between the instrument UIs and the native owners, in the pattern of the K9
 * focused-instrument sources (`../instrument/source.ts`, which this file does
 * not modify).
 *
 * Programme laws carried here (QL-MEF wayfinder §1–§2, §17):
 *   - the adapter is NOT a store — it composes attributable readings; every
 *     native owner keeps its own identity and mutation authority;
 *   - native refs are opaque and never rewritten;
 *   - missing QL/temporal/spatial/Expression facets are data, not errors;
 *   - native Actions are ROUTED, never executed: execution crosses the
 *     native authority seam (desktop KernelOp `invoke_action` / owner CLI);
 *   - capabilities come from the reading's own disclosure, never hard-coded
 *     per route.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateActionReceipt,
  validateActionRoute,
  validateReading,
  type NativeActionRef,
  type TechneActionReceipt,
  type TechneActionRoute,
  type TechneDisclosure,
  type TechneReading,
} from "./contract.ts";

/**
 * One adapter over the native owners for the instrument constellation.
 * Implementations compose readings; they never own domain state and never
 * execute Actions.
 */
export interface TechneAdapter {
  /** The reading for one subject, or a refusal (throw) when none exists. */
  reading(subjectRef: string): Promise<TechneReading>;
  /** Capability honesty for one subject; default derivation is the
   * reading's own disclosure. */
  capabilities(subjectRef: string): Promise<TechneDisclosure>;
  /** Resolve one mutation request to its owner route. Routing only: the
   * receipt names the owner, authority and expected effects; execution is
   * the native authority seam's business, never the adapter's. */
  routeAction(route: TechneActionRoute, reading: TechneReading): Promise<TechneActionReceipt>;
}

/** The default capability derivation: what the reading itself discloses. */
export function capabilitiesFromReading(reading: TechneReading): TechneDisclosure {
  return reading.disclosure;
}

/**
 * The shared routing law. An action routes only when the reading discloses
 * it and the route names the reading's own subject; every other shape comes
 * back as an explicit unrouted receipt. Nothing here executes anything.
 */
export function resolveActionRoute(reading: TechneReading, route: TechneActionRoute): TechneActionReceipt {
  const malformed = validateActionRoute(route);
  if (!malformed.valid) throw new Error(`Techne action route is malformed: ${malformed.errors.join("; ")}`);
  const disclosed: NativeActionRef | undefined = reading.actions?.find((action) => action.action_ref === route.action_ref);
  if (!disclosed) {
    return { action_ref: route.action_ref, native_owner: "unknown", routed: false, reason: `action ${route.action_ref} is not disclosed by reading ${reading.reading_ref} — routing refused`, expected_effects: [] };
  }
  if (route.subject_ref !== reading.subject.subject_ref) {
    return { action_ref: route.action_ref, native_owner: disclosed.native_owner, routed: false, reason: `route names subject ${route.subject_ref}, the reading discloses ${reading.subject.subject_ref} — one subject, one route`, authority: disclosed.authority, expected_effects: [] };
  }
  const receipt: TechneActionReceipt = {
    action_ref: disclosed.action_ref,
    native_owner: disclosed.native_owner,
    routed: true,
    authority: disclosed.authority,
    expected_effects: disclosed.expected_effects ?? [],
  };
  const checked = validateActionReceipt(receipt);
  if (!checked.valid) throw new Error(`Techne action receipt is malformed: ${checked.errors.join("; ")}`);
  return receipt;
}

/** Assert one reading satisfies the canonical contract; drift is a contract
 * bug, refused at the seam rather than rendered. */
export function assertReading(value: unknown): TechneReading {
  const checked = validateReading(value);
  if (!checked.valid) throw new Error(`ql.techne/v1 reading drifted from the contract: ${checked.errors.join("; ")}`);
  return value as TechneReading;
}

/**
 * One Technē source: the registered owner-side reader for a field of
 * subjects — the sibling of `FocusedInstrumentSource`. A source owns every
 * fact it returns; the desktop never reconstructs a reading behind its back.
 */
export interface TechneSource {
  ref: string;
  title: string;
  reading(subjectRef: string): Promise<TechneReading>;
  subscribe?(listener: () => void): () => void;
}

/** Compose a source over an adapter (or any reading function). Readings are
 * contract-checked at the seam. */
export function createTechneSource(options: { ref: string; title: string; adapter?: TechneAdapter; read?: (subjectRef: string) => Promise<TechneReading>; subscribe?: (listener: () => void) => () => void }): TechneSource {
  if (!options.ref.trim()) throw new Error("Technē source needs a stable ref");
  const read = options.read ?? ((subjectRef: string) => {
    if (!options.adapter) throw new Error(`Technē source ${options.ref} needs an adapter or a read function`);
    return options.adapter.reading(subjectRef);
  });
  return {
    ref: options.ref,
    title: options.title,
    async reading(subjectRef: string) {
      return assertReading(await read(subjectRef));
    },
    ...(options.subscribe ? { subscribe: options.subscribe } : {}),
  };
}

/** Compose an adapter over one registered source. */
export function adapterForSource(source: TechneSource): TechneAdapter {
  return {
    reading: (subjectRef) => source.reading(subjectRef),
    async capabilities(subjectRef) {
      return capabilitiesFromReading(await source.reading(subjectRef));
    },
    async routeAction(route, reading) {
      return resolveActionRoute(reading, route);
    },
  };
}

/**
 * The conformance adapter: serves the three shared QL-MEF fixtures
 * (`fixtures/techne/`, byte-exact copies with their canonical provenance
 * note). Fixture readings are the standing inputs until a lane's native
 * provider replaces them (wayfinder §18: "use the shared conformance
 * fixtures and then replace fixture inputs with native providers").
 */
export class FixtureTechneAdapter implements TechneAdapter {
  private readonly readings: readonly TechneReading[];

  constructor(readings: readonly TechneReading[]) {
    this.readings = readings.map(assertReading);
  }

  async reading(subjectRef: string): Promise<TechneReading> {
    const reading = this.readings.find((candidate) => candidate.subject.subject_ref === subjectRef);
    if (!reading) throw new Error(`No Technē reading is served for subject ${subjectRef}`);
    return reading;
  }

  async capabilities(subjectRef: string): Promise<TechneDisclosure> {
    return capabilitiesFromReading(await this.reading(subjectRef));
  }

  async routeAction(route: TechneActionRoute, reading: TechneReading): Promise<TechneActionReceipt> {
    return resolveActionRoute(reading, route);
  }
}

// ---------------------------------------------------------------------------
// The source registry — the K9 pattern (register / get / subscribe),
// written here rather than in ../instrument/source.ts, which stays untouched.
// ---------------------------------------------------------------------------

const sources = new Map<string, TechneSource>();
const sourceListeners = new Map<string, Set<() => void>>();
const registryListeners = new Set<() => void>();

function announce(ref: string) {
  for (const listener of sourceListeners.get(ref) ?? []) listener();
  for (const listener of registryListeners) listener();
}

/** Register one Technē source. Returns the unregister function. */
export function registerTechneSource(source: TechneSource): () => void {
  if (!source.ref.trim()) throw new Error("Technē source needs a stable ref");
  if (sources.has(source.ref)) throw new Error(`Technē source ${source.ref} is already registered`);
  sources.set(source.ref, source);
  announce(source.ref);
  return () => {
    if (sources.get(source.ref) === source) {
      sources.delete(source.ref);
      announce(source.ref);
    }
  };
}

/** The named source, or — with no ref — the first registered one (the
 * default field the instruments disclose over). */
export function techneSource(ref?: string): TechneSource | undefined {
  if (ref) return sources.get(ref);
  return sources.values().next().value;
}

/** Observe one source (or the registry) for changes, forwarding the source's
 * own subscribe where it provides one — the K9 registry discipline. */
export function subscribeTechneSource(ref: string, listener: () => void): () => void {
  let owner: TechneSource | undefined = sources.get(ref);
  let ownerStop = owner?.subscribe?.(listener);
  const registry = () => {
    const next = sources.get(ref);
    if (next !== owner) {
      ownerStop?.();
      owner = next;
      ownerStop = owner?.subscribe?.(listener);
    }
    listener();
  };
  let listeners = sourceListeners.get(ref);
  if (!listeners) {
    listeners = new Set();
    sourceListeners.set(ref, listeners);
  }
  listeners.add(registry);
  return () => {
    listeners?.delete(registry);
    if (!listeners?.size) sourceListeners.delete(ref);
    ownerStop?.();
  };
}

/** Observe registration changes for any source. */
export function subscribeTechneSources(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

/** Test/dev reset — production code never clears the registry. */
export function resetTechneSources() {
  sources.clear();
  sourceListeners.clear();
  registryListeners.clear();
}
