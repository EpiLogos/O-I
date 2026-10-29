/**
 * The encounter bridge over the shell's ONE selection spine
 * (WORLD-SHELL-DESIGN §2, §10 seam 3).
 *
 * The spine is the shell's existing tripartite state machine: mode (the
 * workspace's ShellMode over the book's WorkspaceMode), World context (the
 * workspace book's `WorldContext` — world, subject, reading, trail — which
 * rides through every mode switch and reload), and the kernel access epoch
 * (`accessEpoch`/`accessReady` in shell/workspace.tsx). This module adds no
 * state: it is a SUBSCRIBER and a ROUTER over that spine, so a projection
 * module can read the encounter and propagate a selection change as an
 * encounter transition — never as per-view state, never into a second
 * navigation store.
 *
 * Epoch guard: every subscription captures the accessEpoch at subscribe
 * time. Deliveries skip registrations whose epoch is no longer current, so
 * a stale callback is retired with its connection generation — the same
 * guard `nativeAccessCurrent(epoch)` gives the shell's own views.
 *
 * The Atlas five-state mapping (World · Focus · Manifestation · Thread ·
 * Deep) is documented on the contract in
 * `desktop/cradle/src/surface/projectionModules.ts`; this implementation is
 * what makes it true over the live spine.
 */
import type {EncounterBridge, EncounterListener, EncounterSnapshot} from '../../../../../desktop/cradle/src/surface/projectionModules';
import type {CandidateWorkspace} from '../continuity';
import type {WorkspaceReading} from '../shell/workspaceTypes';
import {moveOnTrail, readOnTrail, stopOf, type WorldContext} from '../../../../../desktop/cradle/src/workspace/store';
import type {WorkspaceMode} from '../../../../../desktop/cradle/src/workspace/mode';

/** A move into `mode` (manual §10.7: "Every place you go is kept on the trail"): the trail grows by the place it lands on — the
 * mode, the world, THE selection, the subject and the reading, which ride through — stamped with its time. chooseMode makes a mode
 * switch one (App.tsx); the spine's subject transition below makes a subject change one. The book's own trail law
 * (desktop/cradle/src/workspace/store.ts) adds nothing for the place you stand on, and keeps the return after a walk. */
export function moveTo(context: WorldContext, mode: WorkspaceMode, at: number = Date.now()): WorldContext {
  return moveOnTrail(context, stopOf(mode, context, at));
}

export interface SpineEncounterBridge extends EncounterBridge {
  /** Deliver the current spine reading to every live registration. The
   * React host calls this after each of its renders — the render IS the
   * spine's publication; the bridge keeps no state of its own. */
  publish(): void;
}

// ── the workspace the spine stands in ─────────────────────────────────────

/** The workspace of the book the spine stands in: the book's storage namespace (continuity: storageNamespace.key), the active
 * workspace id and its world. A projection whose memories are kept per workspace reads it here (the Earth atlas,
 * projections/atlas/AtlasProjectionPanel.tsx). */
export interface SpineWorkspace {
  readonly namespace: string
  readonly workspaceId: string
  readonly world?: string
}

/** The spine the last bridge was made over: the host's live reading of the book, never a copy. The native Workbench, which hosts every
 * projection pane (native/Workbench.tsx), makes its bridge as it first renders, so the workspace stands before any pane's module mounts. */
let spine: {readonly current: {book: CandidateWorkspace}} | null = null
let told: SpineWorkspace | null = null
const workspaceListeners = new Set<() => void>()

/** The workspace the spine stands in now; null while no host has made a bridge (a standalone harness). */
export function spineWorkspace(): SpineWorkspace | null {
  const book = spine?.current.book
  const namespace = book?.storageNamespace?.key
  const workspaceId = book?.current?.id
  if (typeof namespace !== 'string' || typeof workspaceId !== 'string') return null
  return {namespace, workspaceId, world: book?.current.context?.world}
}

/** Told when the workspace the spine stands in, or its world, changes (each publication compares). Returns the unsubscribe. */
export function subscribeSpineWorkspace(listener: () => void): () => void {
  workspaceListeners.add(listener)
  return () => { workspaceListeners.delete(listener) }
}

function tellWorkspace(): void {
  const now = spineWorkspace()
  if (now?.namespace === told?.namespace && now?.workspaceId === told?.workspaceId && now?.world === told?.world) return
  told = now
  for (const listener of [...workspaceListeners]) listener()
}

export function createSpineEncounterBridge(
  latest: {readonly current: {book: CandidateWorkspace; workspace: WorkspaceReading}},
): SpineEncounterBridge {
  interface Registration {listener: EncounterListener; epoch: number}
  const registrations = new Set<Registration>();
  spine = latest;
  told = spineWorkspace();
  const snapshot = (): EncounterSnapshot => {
    const origin = latest.current, context = origin.book.current.context;
    return {
      mode: origin.workspace.mode,
      world: context?.world,
      subject: context?.subject,
      // THE selection, which a following pane turns to (projectionModules followedRefOf).
      selection: context?.selection,
      reading: context?.reading,
      trail: context?.trail,
      accessEpoch: origin.workspace.accessEpoch,
      presented: true,
    };
  };
  const publish = () => {
    tellWorkspace();
    const epoch = latest.current.workspace.accessEpoch;
    const reading = snapshot();
    for (const registration of registrations) {
      // The epoch guard: a registration captured on a retired connection
      // generation never receives again.
      if (registration.epoch !== epoch) continue;
      registration.listener(reading);
    }
  };
  return {
    snapshot,
    publish,
    subscribe(listener) {
      const registration: Registration = {listener, epoch: latest.current.workspace.accessEpoch};
      registrations.add(registration);
      // A mount renders from fact: one immediate delivery of the current
      // spine, then transitions as they are published.
      listener(snapshot());
      return () => {registrations.delete(registration);};
    },
    transition(intent) {
      const book = latest.current.book;
      // The mode a stop is made in: the book's own tree mode (Central's tree names none).
      const mode = (): WorkspaceMode => book.current.layout?.mode ?? 'base';
      if (intent.kind === 'subject') {
        // Selection propagates as an encounter transition into the ONE
        // WorldContext owner. Refs and titles only — never content.
        // A subject change is a move: the trail grows by the place it lands on (encounter.ts: the trail grows on every
        // transition), and where it came from is the stop before it, which Back reaches. Re-selecting the same subject is no
        // transition.
        book.setContext(context => {
          const next = {ref: intent.ref, kind: intent.subjectKind, title: intent.title};
          if (context.subject?.ref !== undefined && context.subject.ref === intent.ref) return {...context, subject: next};
          return moveTo({...context, subject: next}, mode());
        });
        return;
      }
      if (intent.kind === 'occasion') {
        // An occasion change is a move; a new point in the reading you stand on is where you stand (the book's readOnTrail).
        book.setContext(context => readOnTrail(context, mode(), {ref: intent.ref, ...(intent.position ? {position: intent.position} : {})}, Date.now()));
        return;
      }
      // 'present' is pane-local by contract (the projection's own cut —
      // Timeline's session/arrangement, the rack's Deep depth). The spine
      // holds no presentation state, so there is nothing to route — that is
      // the contract, not a swallowed write.
    },
  };
}
