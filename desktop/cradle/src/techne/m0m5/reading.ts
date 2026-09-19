/**
 * The one-reading bridge (T3, 2026-09-19) — from the cradle's ONE current
 * `TechneDisclosureState` (techneReading.ts) to the shapes the ported QL
 * M1′–M5′ instruments consume: one full `TechneReading` (ql.techne/v1) and
 * one `DisclosureSession` for the arrangement's subject.
 *
 * Laws this bridge keeps (owner wayfinder 2026-09-19 §20–§22, §VI–§VII):
 *   - resolve once, lens many: the reading and the session are built FROM
 *     what the disclosure already carries — never a second provider fetch,
 *     never a per-lens re-read. Switching lens never re-identifies the
 *     subject or re-opens the source.
 *   - the disclosure is the capability truth: absent facets (whole, QL
 *     warrant, temporal, spatial, expressions, actions) are data, not
 *     errors — the bridge never invents them. When the provider's wire
 *     payload IS a full contract reading, it is used whole (contract-checked
 *     at the seam), so owner-disclosed facets flow to the instruments.
 *   - the session is presentation-seam state (session.ts): one subject, one
 *     source-qualified selection, one reading basis, one agent-session ref;
 *     the bridge only ever ALIGNS the store with the active lens — the
 *     bodies' own selections (member/relation/place clicks) are never
 *     overwritten.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  TECHNE_CONTRACT,
  validateReading,
  validateSelection,
  type DisclosureSelection,
  type DisclosureSession,
  type TechneInstrument,
  type TechneReading,
} from "../contract.ts";
import {
  disclosureSession,
  type DisclosureSessionStore,
} from "../session.ts";
import type {TechneDisclosureState} from "../techneReading.ts";

/**
 * Build the one ql.techne/v1 reading for the subject from the current
 * disclosure state. Returns null while no reading stands (no-subject /
 * reading / unavailable — the caller renders those states honestly).
 */
export function bridgeReading(disclosure: TechneDisclosureState): TechneReading | null {
  if (disclosure.standing !== "read") return null;
  // Prefer the full contract reading when the wire payload IS one: the
  // provider may disclose whole/temporal/spatial/expressions/actions facets
  // the tab-bar subset (parseTechneReading) does not carry. Drift is refused
  // at the seam — the subset-derived reading below is the fallback, never a
  // guess over a refused payload.
  if (disclosure.raw !== undefined) {
    const checked = validateReading(disclosure.raw);
    if (checked.valid) return disclosure.raw as TechneReading;
  }
  const reading = disclosure.reading;
  const composed: TechneReading = {
    contract: TECHNE_CONTRACT,
    reading_ref: reading.readingRef,
    snapshot: {revision: reading.revision ?? null},
    subject: {
      subject_ref: reading.subject.subjectRef,
      native_owner: reading.subject.nativeOwner,
      ...(reading.subject.kind ? {kind: reading.subject.kind} : {}),
    },
    disclosure: {
      instruments: reading.disclosure.instruments.map((entry) => ({
        instrument: entry.instrument,
        available: entry.available,
        ...(entry.reason ? {reason: entry.reason} : {}),
        ...(entry.mPrime !== undefined ? {m_prime: entry.mPrime} : {}),
        ...(entry.reading ? {reading: entry.reading} : {}),
      })),
      ...(reading.disclosure.degraded.length
        ? {degraded: reading.disclosure.degraded.map((note) => ({instrument: note.instrument, reason: note.reason}))}
        : {}),
      ...(reading.disclosure.suggestions.length
        ? {suggestions: reading.disclosure.suggestions.map((note) => ({instrument: note.instrument, reason: note.reason}))}
        : {}),
    },
  };
  const checked = validateReading(composed);
  if (!checked.valid) throw new Error(`bridge composition drifted from the contract: ${checked.errors.join("; ")}`);
  return composed;
}

/**
 * The whole-scoped entry selection for one reading on one lens — the same
 * grammar the canvas selection model derives (stable
 * `ql.techne:selection:<subject>:<whole|subject>` ref, the reading's
 * snapshot as the selection's revision basis). This is only the ENTRY
 * selection; every body refines it through its own click model.
 */
export function groundSelection(reading: TechneReading, instrument: TechneInstrument): DisclosureSelection {
  const wholeRef = reading.whole?.whole_ref;
  const selection: DisclosureSelection = {
    selection_ref: `ql.techne:selection:${reading.subject.subject_ref}:${wholeRef ?? reading.subject.subject_ref}`,
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    instrument,
    ...(reading.snapshot?.revision ? {snapshot_revision: reading.snapshot.revision} : {}),
    ...(wholeRef ? {focus_refs: [wholeRef]} : {}),
  };
  const checked = validateSelection(selection);
  if (!checked.valid) throw new Error(`ground selection drifted from the contract: ${checked.errors.join("; ")}`);
  return selection;
}

/** The one-lens alignment memo: ensureSession is called on every lens render
 * and must be a no-op when the store already stands where the lens stands
 * (React double renders; body clicks refine selections between renders). */
let ensured: {key: string; sessionRef: unknown} | null = null;

/** Test/dev reset of the alignment memo — production never clears it. */
export function resetSessionAlignment(): void {
  ensured = null;
}

/**
 * Align the ONE disclosure session with the active lens over this reading.
 *   - store empty or on another subject/basis → open the session with the
 *     ground selection (a new basis is a new session; the person's refresh);
 *   - store co-referenced but on another lens's instrument → one navigation
 *     hop onto this lens (`openInInstrument`: subject, sources, selection
 *     basis and agent-session ref carried byte-exact);
 *   - otherwise → untouched (the bodies' own selections stand).
 * Returns the session the store now holds (null while the store could not
 * be aligned — the caller renders the honest no-session state for a frame).
 */
export function ensureSession(reading: TechneReading, instrument: TechneInstrument, store: DisclosureSessionStore = disclosureSession): DisclosureSession | null {
  const current = store.get();
  const key = `${reading.subject.subject_ref}|${reading.reading_ref}|${instrument}`;
  if (current && current.subject_ref === reading.subject.subject_ref && current.reading_ref === reading.reading_ref) {
    if (current.instrument === instrument) {
      ensured = {key, sessionRef: current};
      return current;
    }
    if (ensured?.key === key && store.get() === ensured.sessionRef) return store.get();
    const projected = store.openInInstrument(instrument);
    ensured = {key, sessionRef: projected};
    return projected;
  }
  if (ensured?.key === key && store.get() === ensured.sessionRef) return store.get();
  const opened = store.setSelection(groundSelection(reading, instrument));
  ensured = {key, sessionRef: opened};
  return opened;
}
