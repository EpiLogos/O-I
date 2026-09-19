/**
 * The DisclosureSession store (L5 Technē T0) — the Cradle's one ephemeral
 * cross-instrument disclosure session (QL-MEF wayfinder §3–§5). One subject,
 * one source-qualified selection, one reading basis, one agent-session ref,
 * carried across instruments; each navigation hop preserves subject, source
 * basis and selection unless the person deliberately refreshed.
 *
 * TB0-1 (QL-MEF #212, consumed by #219): the session carries the dual-reading
 * state — the active application cut (3:3-conjugate ↔ 4:2-deep), the situated
 * ground (whole/project/world/context-frame/occasion/Return-target/reference-
 * frame/scene-focus refs) — and exposes `crossCut`, the coordinate-preserving
 * crossing between the two readings. Crossing changes the mode of disclosure
 * and available operation, never the subject, sources, occasion, Actions or
 * Return target.
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
 *
 * Ported into the O:I cradle (T3, 2026-09-19) from QL-MEF
 * `adapters/techne/surfaces/cradle/src/techne/session.ts` (main @ dbff5cc ==
 * techne/t9-integrated-field, byte-identical for this module). The one
 * adaptation: the cradle's `SurfaceBinding` (src/surface/types.ts) does not
 * carry QL's `techne` payload field, so `techneSurfaceBinding` names the
 * session subject through the binding's own `ref`/`kind`/`title` only — the
 * payload field is a parent-integrator reconciliation item, not a semantic
 * change (no instrument consumes it).
 */
import {
  TECHNE_CONTRACT,
  crossCutSession,
  instrumentReading,
  validateSelection,
  validateSession,
  type DisclosureSelection,
  type DisclosureSession,
  type TechneInstrument,
  type TechneReadingKind,
} from "./contract.ts";
import type {SurfaceBinding} from "../surface/types";

/** The session's situated ground (TB0-1): the native refs that must survive
 * cut crossings unchanged — the selected whole, Project/World/Context-Frame
 * focus, the current occasion, the Return target, the wider reference frame
 * and a focused Expression Scene. Every field is a native ref carried
 * verbatim; none is minted here. */
export interface DisclosureSessionGround {
  whole_ref?: string;
  project_ref?: string;
  world_ref?: string;
  context_frame_ref?: string;
  occasion_ref?: string;
  return_target_ref?: string;
  reference_frame_ref?: string;
  scene_focus_ref?: string;
}

export interface DisclosureSessionStore {
  /** The one current session, or null while nothing is disclosed. */
  get(): DisclosureSession | null;
  subscribe(listener: () => void): () => void;
  /** Set (or replace) the source-qualified selection. A selection on a new
   * subject or reading basis opens a new session; one on the current basis
   * replaces the selection in place. `ground` carries the situated ground
   * state (occasion, Return target, whole, …); given fields are applied
   * verbatim, omitted fields leave the session's ground untouched. */
  setSelection(selection: DisclosureSelection, ground?: DisclosureSessionGround): DisclosureSession;
  /** Project the current session into another instrument: subject, source
   * basis, reading_ref, snapshot and agent_session_ref are preserved, the
   * selection is co-referenced, one navigation hop is recorded. The active
   * application cut follows the instrument (a hop onto the other reading is
   * a cut crossing in effect); the dedicated `crossCut` adds the same-cut
   * refusal and is the crossing the dual-reading affordances ride. Returns
   * the co-referenced session. */
  openInInstrument(instrument: TechneInstrument): DisclosureSession;
  /** The TB0 dual-reading crossing: move the session to `target`'s
   * application cut over the same subject. Subject, selection basis,
   * sources, occasion, ground, Actions and Return target are carried
   * untouched byte-exact; a crossing onto the cut the session already
   * occupies is refused. */
  crossCut(target: TechneInstrument): { session: DisclosureSession; cut: TechneReadingKind };
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
    setSelection(selection, ground) {
      const checked = validateSelection(selection);
      if (!checked.valid) throw new Error(`Disclosure selection drifted from the contract: ${checked.errors.join("; ")}`);
      const sameBasis = current !== null
        && current.subject_ref === selection.subject_ref
        && current.reading_ref === selection.reading_ref;
      const next: DisclosureSession = sameBasis && current
        ? {...current, selection, instrument: selection.instrument, application_cut: instrumentReading(selection.instrument), ...(ground ? appliedGround(ground) : {})}
        : {
            contract: TECHNE_CONTRACT,
            session_ref: mintSessionRef(),
            subject_ref: selection.subject_ref,
            selection,
            instrument: selection.instrument,
            application_cut: instrumentReading(selection.instrument),
            reading_ref: selection.reading_ref,
            navigation: [],
            ...(ground ? appliedGround(ground) : {}),
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
        application_cut: instrumentReading(instrument),
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
    crossCut(target) {
      if (!current) throw new Error("No DisclosureSession is open — select a subject first");
      const crossed = crossCutSession(current, target);
      current = crossed.session;
      notify(listeners);
      return crossed;
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

/** Only defined ground fields are applied; a ground value must be a non-empty
 * ref (validateSession refuses anything else before it is observable). */
function appliedGround(ground: DisclosureSessionGround): DisclosureSessionGround {
  const applied: DisclosureSessionGround = {};
  for (const key of ["whole_ref", "project_ref", "world_ref", "context_frame_ref", "occasion_ref", "return_target_ref", "reference_frame_ref", "scene_focus_ref"] as const) {
    const value = ground[key];
    if (value !== undefined) applied[key] = value;
  }
  return applied;
}

/** Two sessions are co-referenced when they disclose the same subject on the
 * same reading basis — what one AgentSession follows across instruments. */
export function coReferenced(a: DisclosureSession, b: DisclosureSession): boolean {
  return a.subject_ref === b.subject_ref && a.reading_ref === b.reading_ref;
}

/**
 * The surface binding for a DisclosureSession: ONE new surface kind
 * `"techne"`, whose payload names the instrument, subject and selection.
 * `"techne"` binding for the session subject. Cradle adaptation: the
 * cradle's `SurfaceBinding` carries no `techne` payload field (QL-MEF's does),
 * so the subject rides the binding's own `ref` — the kernel's
 * `surface_focus` still makes the active surface's ref the one global focus
 * subject, and `agent_session_ref` (nullable, owner-grammar) rides inside the
 * selection. Adding the typed payload field is a parent-integrator
 * reconciliation item; no instrument consumes it today.
 */
export function techneSurfaceBinding(session: DisclosureSession, surfaceId?: string): SurfaceBinding {
  return {
    id: surfaceId ?? crypto.randomUUID(),
    kind: "techne",
    ref: session.subject_ref,
    title: `Technē · ${session.instrument}`,
  };
}

/** The Cradle's one current disclosure session (the host and later instrument
 * lanes subscribe to this; tests build their own stores). */
export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();
