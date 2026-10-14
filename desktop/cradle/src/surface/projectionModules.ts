/**
 * The projection module boundary (WORLD-SHELL-DESIGN §10 seams 2–3).
 *
 * Each projection mounts as a MODULE with mount/unmount + encounter
 * subscription — the Atlas's vanilla-TS controller mounts the way the
 * retained app's controller does; no React rewrite of a vanilla engine, and
 * no React-shaped constraint on future modules. The shell's pane engine
 * (this surface system) hosts the module inside a pane of a projection kind
 * (`types.ts` PROJECTION_PANE_KINDS); the module owns everything it renders
 * into its element.
 *
 * APERTURE LAW (seam 3): the encounter — mode × WorldContext × kernel
 * epoch — is the ONLY selection spine. Nothing here stores selection. A
 * module reads the encounter through its `EncounterBridge` and propagates a
 * selection change by dispatching an `EncounterTransitionIntent` through the
 * same bridge, which the host routes to the one navigation owner (the
 * workspace book's `WorldContext`). The bridge is a subscriber and a router,
 * never a store.
 *
 * The Atlas (Archetypal-Earth) independently converged on the same shape.
 * Its five-state machine binds onto the spine WITHOUT a second selection
 * store, as follows — modules from that port should read this table as the
 * whole mapping:
 *
 *   Atlas state    Spine reading
 *   ────────────   ─────────────────────────────────────────────────────────
 *   World          the projection overview: `mode` + `world`, with NO
 *                  `subject` pinned (the pane follows the encounter)
 *   Focus          `subject` — the selection (`WorldContext.subject`)
 *   Manifestation  `reading` — an Expression/occurrence opened
 *                  (`WorldContext.reading`, ref + position)
 *   Thread         `trail` — the route back (`WorldContext.trail`)
 *   Deep           the rack/detail disclosure — the focused pane's device
 *                  depth; a pane-local presentation, reached through
 *                  `{kind:'present'}` transitions, never spine state
 *
 *   Kernel epoch   `accessEpoch` — every callback registration captures it;
 *                  an advance retires the registration (see `subscribe`).
 *
 * Every state of the Atlas's hash router ("every state is linkable and Back
 * works") is then expressible as one encounter snapshot — the model for
 * linkable encounters in the shell.
 */
import {isProjectionPaneKind, type ProjectionPaneKind} from "./types";

// ---------------------------------------------------------------------------
// the encounter bridge — the one selection spine, read and routed

/** The WorldContext fields, spelled neutrally so a module needs no import
 * from a host workspace store. `world` is the host's WorldRef spelling
 * ('central' | 'epi-logos' in this shell). */
export interface EncounterSubject {ref?: string; kind?: string; title: string; project?: string}
export interface EncounterSnapshot {
  /** The shell mode standing (the host's WorkspaceMode/ShellMode spelling). */
  mode: string;
  /** The selected world (WorldContext.world). */
  world?: string;
  /** The selection — Atlas Focus. Absent = no subject pinned (World). */
  subject?: EncounterSubject;
  /** The opened reading — Atlas Manifestation. */
  reading?: {ref: string; position?: string};
  /** The route back — Atlas Thread. */
  trail?: readonly {mode: string; label: string; position?: string}[];
  /** The kernel connection generation at publication (Atlas Deep gate). */
  accessEpoch: number;
  /** Whether the hosting pane is presented or concealed-retained. */
  presented: boolean;
}

export type EncounterListener = (snapshot: EncounterSnapshot) => void;

/** Selection changes propagate as encounter transitions — never per-view
 * state, never a write into the bridge. `subject`/`occasion` route to the
 * spine's WorldContext owner; `present` is pane-local presentation (which
 * cut of the projection the pane shows — Timeline's session/arrangement —
 * or the rack's Deep depth), disclosed so co-present panes may mirror it
 * but owned by the pane. */
export type EncounterTransitionIntent =
  | {kind: "subject"; ref?: string; title: string; subjectKind?: string}
  | {kind: "occasion"; ref: string; position?: string}
  | {kind: "present"; presentation: string};

export interface EncounterBridge {
  snapshot(): EncounterSnapshot;
  /**
   * Subscribe to encounter transitions. The registration captures the
   * kernel accessEpoch at subscribe time; when the epoch advances (the
   * host's `accessEpoch`/`accessReady` guard) the registration is RETIRED —
   * it stops delivering and its unsubscribe becomes a no-op — so a stale
   * callback can never act on a retired connection. The listener receives
   * the current snapshot once, immediately, so a mount renders from fact.
   */
  subscribe(listener: EncounterListener): () => void;
  /** Propagate a selection change as an encounter transition through the
   * spine. Implementations route to the ONE navigation owner; they must not
   * keep a shadow of it. May refuse honestly (throw) when the host has no
   * navigation owner to route to. */
  transition(intent: EncounterTransitionIntent): void;
}

/** The honest absence bridge: a host that has not admitted an encounter
 * spine delivers one immediate, clearly-minimal snapshot and routes
 * nothing. Modules stay mountable (a projection may run standalone in its
 * own dev harness) without a fabricated spine. */
export const absentEncounterBridge: EncounterBridge = {
  snapshot: () => ({mode: "unhosted", presented: true, accessEpoch: 0}),
  subscribe: (listener) => {
    listener(absentEncounterBridge.snapshot());
    return () => {};
  },
  transition: (intent) => {
    throw Error(`No encounter spine is admitted here; the ${intent.kind} transition was refused, not swallowed`);
  },
};

// ---------------------------------------------------------------------------
// the module contract

export interface ProjectionModuleContext {
  /** The pane kind this instance serves. */
  kind: ProjectionPaneKind;
  /** The hosting pane binding's identity and subject slice. */
  binding: {id: string; title: string; subject_ref?: string};
  /** The pane body element — the module owns its content and must leave it
   * clean on unmount. The host sizes it; the module fills it. */
  element: HTMLElement;
  /** The encounter spine (seam 3). */
  encounter: EncounterBridge;
}

export interface ProjectionModuleHandle {
  /** Full teardown: subscriptions, engines, DOM children. After unmount the
   * element is empty and every retired callback is inert. */
  unmount(): void;
  /** Concealed-retained notice: the host hides the element (display:none,
   * the pane tier's concealment) and tells the module so its engines may
   * pause off-screen. State MUST survive until `unmount` — that is the
   * hidden-inhabitant law: returning to the pane restores the actual
   * camera, selection and temporal state without a rebuild. */
  setVisible?(visible: boolean): void;
}

export interface ProjectionModuleRegistration {
  /** Stable module id (e.g. 'atlas-earth' — the atlas port's mount.ts
   * adopts this door under kind 'projection.earth'). */
  id: string;
  /** The one pane kind the module mounts. */
  kind: ProjectionPaneKind;
  /** One build of the kind's instrument, when the kind has several (manual §10.2); they answer to the same controls. */
  build?: {id: string; label: string};
  /** Mount one instance. May be async (an engine that resolves on first
   * paint). A rejection must leave the element clean; the host shows the
   * failure as the pane's honest body. */
  create(context: ProjectionModuleContext): ProjectionModuleHandle | Promise<ProjectionModuleHandle>;
}

const admitted = new Map<ProjectionPaneKind, ProjectionModuleRegistration[]>();

/** Admit a module for a pane kind (an instrument type). A kind may have several builds (manual §10.2: "Some instruments
 * come in more than one build … Each build answers to the same controls"): a registration that declares a build joins
 * the kind's builds, the first admitted standing as its default. Without a build, a second, different registration
 * for a taken kind REFUSES — kinds are not silently replaced (the admission law: declared, never swapped underneath).
 * Re-admitting the same id replaces it in place. */
export function registerProjectionModule(registration: ProjectionModuleRegistration): void {
  if (!isProjectionPaneKind(registration.kind)) {
    throw Error(`"${registration.kind}" is not a projection pane kind`);
  }
  const builds = admitted.get(registration.kind) ?? [];
  const same = builds.findIndex(held => held.id === registration.id && held.build?.id === registration.build?.id);
  if (same >= 0) { builds[same] = registration; return; }
  const unbuilt = builds.find(held => !held.build || !registration.build);
  if (unbuilt) {
    throw Error(`Projection kind "${registration.kind}" is already admitted by "${unbuilt.id}"; refusing replacement by "${registration.id}"`);
  }
  if (builds.some(held => held.build!.id === registration.build!.id)) {
    throw Error(`Projection kind "${registration.kind}" already has a build "${registration.build!.id}"`);
  }
  admitted.set(registration.kind, [...builds, registration]);
}

/** The module for a pane kind: the named build, or the kind's default (its first admitted build). */
export function projectionModule(kind: ProjectionPaneKind, build?: string): ProjectionModuleRegistration | undefined {
  const builds = admitted.get(kind);
  return (build ? builds?.find(held => held.build?.id === build) : undefined) ?? builds?.[0];
}

/** Every build admitted for a pane kind, default first. */
export function projectionBuilds(kind: ProjectionPaneKind): readonly ProjectionModuleRegistration[] {
  return admitted.get(kind) ?? [];
}

/** Every admitted pane kind (the instrument types the browser lists). */
export function admittedProjectionKinds(): ProjectionPaneKind[] {
  return [...admitted.keys()];
}

/** Test-only: clear the door between cases. */
export function resetProjectionModulesForTest(): void {
  admitted.clear();
}
