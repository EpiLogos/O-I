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
import type {TrailStop} from '../../../../../desktop/cradle/src/workspace/store';
import type {WorkspaceMode} from '../../../../../desktop/cradle/src/workspace/mode';

export interface SpineEncounterBridge extends EncounterBridge {
  /** Deliver the current spine reading to every live registration. The
   * React host calls this after each of its renders — the render IS the
   * spine's publication; the bridge keeps no state of its own. */
  publish(): void;
}

export function createSpineEncounterBridge(
  latest: {readonly current: {book: CandidateWorkspace; workspace: WorkspaceReading}},
): SpineEncounterBridge {
  interface Registration {listener: EncounterListener; epoch: number}
  const registrations = new Set<Registration>();
  const snapshot = (): EncounterSnapshot => {
    const origin = latest.current, context = origin.book.current.context;
    return {
      mode: origin.workspace.mode,
      world: context?.world,
      subject: context?.subject,
      reading: context?.reading,
      trail: context?.trail,
      accessEpoch: origin.workspace.accessEpoch,
      presented: true,
    };
  };
  const publish = () => {
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
      if (intent.kind === 'subject') {
        // Selection propagates as an encounter transition into the ONE
        // WorldContext owner. Refs and titles only — never content.
        // A subject change is a new encounter: the trail grows by the stop
        // it came from (encounter.ts: the trail grows on every subject
        // transition), so the encounter link can push it and Back walks it.
        // Re-selecting the same subject is no transition.
        const mode = latest.current.workspace.mode;
        book.setContext(context => {
          const next = {ref: intent.ref, kind: intent.subjectKind, title: intent.title};
          if (context.subject?.ref !== undefined && context.subject.ref === intent.ref) return {...context, subject: next};
          return {...context, subject: next, trail: [...(context.trail ?? []), trailStopFrom(String(mode), context.subject)]};
        });
        return;
      }
      if (intent.kind === 'occasion') {
        book.setContext(context => ({
          ...context,
          reading: {ref: intent.ref, ...(intent.position ? {position: intent.position} : {})},
        }));
        return;
      }
      // 'present' is pane-local by contract (the projection's own cut —
      // Timeline's session/arrangement, the rack's Deep depth). The spine
      // holds no presentation state, so there is nothing to route — that is
      // the contract, not a swallowed write.
    },
  };
}

/** The trail stop a subject transition leaves: where the person came from. */
export function trailStopFrom(mode: string, previous: {ref?: string; kind?: string; title?: string} | undefined): TrailStop {
  const stopMode = (mode === 'audio' ? 'base' : mode) as WorkspaceMode;
  return {mode: stopMode, label: previous?.title || stopMode, surfaceRef: previous?.ref, surfaceKind: previous?.kind};
}
