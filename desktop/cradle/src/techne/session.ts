/**
 * The DisclosureSession store (L5 Technē T0) — the Cradle's one ephemeral
 * cross-instrument disclosure session (QL-MEF wayfinder §3–§5). One subject,
 * one source-qualified selection, one reading basis, one agent-session ref,
 * carried across instruments; each navigation hop preserves subject, source
 * basis and selection unless the person deliberately refreshed.
 *
 * This is presentation-seam state owned by the Cradle — never a canonical
 * domain object and never a second agent/session store: the agent-session
 * ref rides the selection verbatim from the owner grammar and is never
 * minted or rewritten here, and Epii co-reference keeps flowing through the
 * kernel's one GlobalFocusState (the surface binding names the subject as
 * its ref; focus.subject follows the active surface; AgentLayer reads it).
 *
 * Plain observable store (subscribe/get); zero React dependency. Erasable
 * TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  TECHNE_CONTRACT,
  validateSelection,
  validateSession,
  type DisclosureSelection,
  type DisclosureSession,
  type TechneInstrument,
} from "./contract.ts";
import type {SurfaceBinding} from "../surface/types";

export interface DisclosureSessionStore {
  /** The one current session, or null while nothing is disclosed. */
  get(): DisclosureSession | null;
  subscribe(listener: () => void): () => void;
  /** Set (or replace) the source-qualified selection. A selection on a new
   * subject or reading basis opens a new session; one on the current basis
   * replaces the selection in place. */
  setSelection(selection: DisclosureSelection): DisclosureSession;
  /** Project the current session into another instrument: subject, source
   * basis, reading_ref, snapshot and agent_session_ref are preserved, the
   * selection is co-referenced, one navigation hop is recorded. Returns the
   * co-referenced session. */
  openInInstrument(instrument: TechneInstrument): DisclosureSession;
  /** End the session (austere rest). */
  clear(): void;
}

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

/** The session ref names the Cradle's own ephemeral disclosure-session
 * grammar (§3); it is not a native owner ref and carries no agent semantics. */
function mintSessionRef(): string {
  return `techne:disclosure-session:${crypto.randomUUID()}`;
}

export function createDisclosureSessionStore(): DisclosureSessionStore {
  let current: DisclosureSession | null = null;
  const listeners = new Set<() => void>();

  const store: DisclosureSessionStore = {
    get() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSelection(selection) {
      const checked = validateSelection(selection);
      if (!checked.valid) throw new Error(`Disclosure selection drifted from the contract: ${checked.errors.join("; ")}`);
      const sameBasis = current !== null
        && current.subject_ref === selection.subject_ref
        && current.reading_ref === selection.reading_ref;
      const next: DisclosureSession = sameBasis && current
        ? {...current, selection, instrument: selection.instrument}
        : {
            contract: TECHNE_CONTRACT,
            session_ref: mintSessionRef(),
            subject_ref: selection.subject_ref,
            selection,
            instrument: selection.instrument,
            reading_ref: selection.reading_ref,
            navigation: [],
          };
      const session = checkedSession(next);
      current = session;
      notify(listeners);
      return session;
    },
    openInInstrument(instrument) {
      if (!current) throw new Error("No DisclosureSession is open — select a subject first");
      if (instrument === current.instrument) return current;
      const selection: DisclosureSelection = {...current.selection, instrument};
      const next: DisclosureSession = {
        ...current,
        selection,
        instrument,
        navigation: [...current.navigation ?? [], {
          from_instrument: current.instrument,
          to_instrument: instrument,
          selection_ref: current.selection.selection_ref,
        }],
      };
      const session = checkedSession(next);
      current = session;
      notify(listeners);
      return session;
    },
    clear() {
      if (current === null) return;
      current = null;
      notify(listeners);
    },
  };
  return store;
}

/** A session that drifted from the contract is a bug, refused before it is
 * ever observable. */
function checkedSession(session: DisclosureSession): DisclosureSession {
  const checked = validateSession(session);
  if (!checked.valid) throw new Error(`DisclosureSession drifted from the contract: ${checked.errors.join("; ")}`);
  return session;
}

/** Two sessions are co-referenced when they disclose the same subject on the
 * same reading basis — what one AgentSession follows across instruments. */
export function coReferenced(a: DisclosureSession, b: DisclosureSession): boolean {
  return a.subject_ref === b.subject_ref && a.reading_ref === b.reading_ref;
}

/**
 * The surface binding for a DisclosureSession: ONE new surface kind
 * `"techne"`, whose payload names the instrument, subject and selection.
 * `ref` is the session subject — the kernel's `surface_focus` makes the
 * active surface's ref the one global focus subject, so the AgentLayer's
 * AgentSubject follows the session through the existing mechanism, and
 * `agent_session_ref` (nullable, owner-grammar) rides inside the selection.
 */
export function techneSurfaceBinding(session: DisclosureSession, surfaceId?: string): SurfaceBinding {
  return {
    id: surfaceId ?? crypto.randomUUID(),
    kind: "techne",
    ref: session.subject_ref,
    title: `Technē · ${session.instrument}`,
    techne: {
      instrument: session.instrument,
      subjectRef: session.subject_ref,
      selectionRef: session.selection.selection_ref,
    },
  };
}

/** The Cradle's one current disclosure session (the host and later instrument
 * lanes subscribe to this; tests build their own stores). */
export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();
