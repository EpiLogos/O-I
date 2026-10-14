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
/** THE selection (WorldContext.selection, spelled neutrally): the clip, track, Day or task every following pane moves with. */
export interface EncounterSelection {mode: string; kind: string; ref: string; title: string; track?: string}
export interface EncounterSnapshot {
  /** The shell mode standing (the host's WorkspaceMode/ShellMode spelling). */
  mode: string;
  /** The selected world (WorldContext.world). */
  world?: string;
  /** The selection — Atlas Focus. Absent = no subject pinned (World). */
  subject?: EncounterSubject;
  /** THE selection a following pane moves with (manual §10.2). Absent while the host does not publish it. */
  selection?: EncounterSelection;
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
// the pane's subject — follow or pin (manual §10.2)

/** What a pane follows: THE selection (WorldContext.selection), else the encounter's subject. */
export function followedRefOf(snapshot: Pick<EncounterSnapshot, "selection" | "subject">): string | undefined {
  return snapshot.selection?.ref ?? snapshot.subject?.ref;
}

/**
 * The subject one pane holds (manual §10.2: "A pane follows what you select, unless you pin it. A pinned pane keeps its
 * subject while you work elsewhere."). The pane shows its pin when it has one, else the ref it follows; a selection that
 * moves while the pane is pinned changes nothing the pane shows. A module reads `shown()` and is told when `pinned()` or
 * `shown()` changes — through this channel, never by being remounted: a pin must not tear down a retained engine. The
 * methods are closures: they do not depend on `this`, so `subject.subscribe` may be handed on as it stands.
 */
export interface PaneSubject {
  /** The ref the pane is pinned to (`binding.projection.subject_ref`); absent while it follows. */
  pinned(): string | undefined;
  /** The ref the pane shows now: its pin, else the selection it follows. */
  shown(): string | undefined;
  /** Notified when the pin or the shown ref changes. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** The host's side of a pane's subject: it sets the pin from the binding and the followed ref from the spine. */
export interface PaneSubjectControl extends PaneSubject {
  pin(ref: string | undefined): void;
  follow(ref: string | undefined): void;
}

export function createPaneSubject(initial: {pinned?: string; followed?: string} = {}): PaneSubjectControl {
  let pinned = initial.pinned;
  let followed = initial.followed;
  const listeners = new Set<() => void>();
  const shown = () => pinned ?? followed;
  const change = (apply: () => void) => {
    const before = [pinned, shown()];
    apply();
    if (before[0] === pinned && before[1] === shown()) return;
    for (const listener of [...listeners]) listener();
  };
  return {
    pinned: () => pinned,
    shown,
    subscribe(listener) {
      listeners.add(listener);
      return () => {listeners.delete(listener);};
    },
    pin(ref) {change(() => {pinned = ref;});},
    follow(ref) {change(() => {followed = ref;});},
  };
}

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
  /** The pane's subject: its pin, else the selection it follows. A host with no pin (a standalone harness) omits it, and the
   * module then follows. A module that declares `follows` reads it and reacts to its changes. */
  subject?: PaneSubject;
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
  /** The kind's content depends on a subject: a pane of it follows the selection or is pinned to one, and its module reads
   * `context.subject`. A kind that does not declare it has no follow/pin control — a pin it cannot honour is not offered. */
  follows?: boolean;
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

/** Whether panes of a kind follow the selection or pin to a subject: a module of the kind has declared it. */
export function followsSelection(kind: string): boolean {
  return isProjectionPaneKind(kind) && (admitted.get(kind) ?? []).some(held => held.follows === true);
}

/** Test-only: clear the door between cases. */
export function resetProjectionModulesForTest(): void {
  admitted.clear();
}
