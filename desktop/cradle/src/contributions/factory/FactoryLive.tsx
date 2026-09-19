/**
 * Factory live updates, ported from the donor cut (PR #292 FactoryLive.tsx)
 * and adapted to the Desk architecture and THIS kernel cut.
 *
 * The donor's machinery is retained in shape: one observation per Run with a
 * revision signature, `changed`/`unseen` material derivations, an attention
 * cue when produced material arrives, and acknowledge-by-revision that never
 * lets an arrival replace a reviewed reading. Two donor paths are honestly
 * absent here because the live kernel (desktop/cradle/kernel/src/factory.rs)
 * does not carry them:
 *
 *   - the cheap revision-index poll over `factory_attempt_task_list_read`
 *     (the op is missing) — so there is NO polling loop at all: observations
 *     are recorded exactly when the Desk itself reads (board refresh, Run
 *     detail live-follow). Bounded by construction;
 *   - the `central-project-link-read` verification of the read's Project
 *     linkage (the development read is missing) — so the observation carries
 *     the Desk's own source disclosure (state path + project ref) instead,
 *     and every observation names which basis it was computed from.
 *
 * The revision signature prefers the owner's own disclosed revisions
 * (factory.build-view/v1 `revision` + provenance revisions); when the owner
 * document does not disclose them (the labelled dev scenario's fixture
 * views), a bounded content signature over the material-bearing view fields
 * is used and disclosed as such — never presented as an owner revision.
 */
import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from "react";
import {emitExpressionCue} from "../../stage/cues";
import {buildViewOf} from "./development";
import type {FactoryBuildView, FactoryMaterialSelection} from "./types";

export interface FactoryLiveMaterial extends FactoryMaterialSelection { version: string }
export interface FactoryLiveObservation {
  key: string;
  runRef: string;
  /** The state path + project ref the Desk read this Run through — the
   * caller's own disclosure, never invented here. */
  statePath: string;
  projectRef: string;
  revision: string;
  /** The owner's numeric build revision when the document disclosed one. */
  ownerRevision?: number;
  basis: "owner-revision" | "content";
  material: FactoryLiveMaterial[];
  changed: boolean;
  unseen: string[];
  observedAtUnixMs: number;
}
interface FactoryLiveReading {
  observe: (entry: {key: string; runRef: string; statePath: string; projectRef: string; document: unknown}) => void;
  acknowledge: (key: string, revision: string, subjectRef?: string) => void;
  observationOf: (key: string) => FactoryLiveObservation | undefined;
}
const Context = createContext<FactoryLiveReading>({observe: () => {}, acknowledge: () => {}, observationOf: () => undefined});

const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Produced material of a Run reading: the candidates and evidence the
 * owner's view discloses, each carrying its own version so arrival — not
 * mere presence — is what marks a subject unseen. */
function materialOf(view: FactoryBuildView): FactoryLiveMaterial[] {
  return [
    ...view.candidates.map(candidate => ({subjectRef: candidate.candidateRef, label: candidate.label, version: JSON.stringify([candidate.revision, candidate.status, candidate.label])})),
    ...view.evidence.map(evidence => ({subjectRef: evidence.evidenceRef, label: evidence.label, version: JSON.stringify([evidence.assessment ?? "", evidence.label])})),
  ];
}

/** The revision signature of one owner reading. Owner-disclosed revisions
 * when present; otherwise a bounded content signature over the fields whose
 * change means the Run's produced state moved. */
function signatureOf(document: unknown): {revision: string; ownerRevision?: number; basis: "owner-revision" | "content"} {
  const root = object(document);
  const provenance = root && object(root.provenance);
  const revision = root && integer(root.revision) ? root.revision : undefined;
  const factoryStateRevision = provenance && integer(provenance.factoryStateRevision) ? provenance.factoryStateRevision : undefined;
  const runRevision = provenance && integer(provenance.runRevision) ? provenance.runRevision : undefined;
  const runMapRevision = provenance && integer(provenance.runMapRevision) ? provenance.runMapRevision : undefined;
  if (revision !== undefined) {
    return {revision: JSON.stringify([revision, factoryStateRevision, runRevision, runMapRevision]), ownerRevision: revision, basis: "owner-revision"};
  }
  const view = buildViewOf(document);
  if (!view) return {revision: JSON.stringify(null), basis: "content"};
  return {
    revision: JSON.stringify([
      view.run.status, view.frontier.subjectRef, view.frontier.closureState ?? null,
      view.candidates.map(candidate => [candidate.candidateRef, candidate.revision, candidate.status]),
      view.evidence.map(evidence => evidence.evidenceRef),
      view.claims.map(claim => [claim.claimRef, claim.status]),
      view.humanRequests.map(request => request.humanRequestRef),
      view.executions.map(execution => [execution.executionRef, execution.status]),
    ]),
    basis: "content",
  };
}

/** One live observation field for the visible Factory centre surface. The
 * provider holds no timer and issues no reads of its own: every observation
 * arrives from a read the Desk actually performed, and each consuming
 * component holds exactly one context subscription, released on unmount. */
export function FactoryLiveProvider({children}: {children: ReactNode}) {
  const [observations, setObservations] = useState<Record<string, FactoryLiveObservation>>({});

  const observe = useCallback((entry: {key: string; runRef: string; statePath: string; projectRef: string; document: unknown}) => {
    setObservations(current => {
      const view = buildViewOf(entry.document);
      if (!view || view.run.runRef !== entry.runRef) return current; // not a reading for this Run — never observed
      const {revision, ownerRevision, basis} = signatureOf(entry.document);
      const material = materialOf(view);
      const previous = current[entry.key];
      if (previous && previous.revision === revision) return current; // nothing moved
      const before = new Map(previous?.material.map(item => [item.subjectRef, item.version]));
      const arrived = previous ? material.filter(item => before.get(item.subjectRef) !== item.version).map(item => item.subjectRef) : [];
      const unseen = previous
        ? [...new Set([...previous.unseen, ...arrived])].filter(ref => material.some(item => item.subjectRef === ref))
        : [];
      if (arrived.length) emitExpressionCue({kind: "attention", label: arrived.length === 1 ? "New Factory material" : "New Factory materials"});
      return {...current, [entry.key]: {
        key: entry.key, runRef: entry.runRef, statePath: entry.statePath, projectRef: entry.projectRef,
        revision, ownerRevision, basis, material,
        changed: Boolean(previous),
        unseen,
        observedAtUnixMs: Date.now(),
      }};
    });
  }, []);

  /** Arrival never replaces a reviewed reading: acknowledging a revision (or
   * one produced subject on it) only clears what the person has seen. A stale
   * acknowledge — different revision than currently held — is a no-op. */
  const acknowledge = useCallback((key: string, revision: string, subjectRef?: string) => {
    setObservations(current => {
      const held = current[key];
      if (!held || held.revision !== revision) return current;
      const unseen = subjectRef ? held.unseen.filter(ref => ref !== subjectRef) : [];
      return {...current, [key]: {...held, changed: subjectRef ? held.changed : false, unseen}};
    });
  }, []);

  const value = useMemo<FactoryLiveReading>(() => ({
    observe,
    acknowledge,
    observationOf: (key: string) => observations[key],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [observe, acknowledge, observations]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFactoryLive(): FactoryLiveReading {
  return useContext(Context);
}
