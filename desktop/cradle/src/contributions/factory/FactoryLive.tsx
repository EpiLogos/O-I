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
 *
 * Live follow (Factory Expressions FX-C2): this module is also the owner of
 * the Run's producer loop — the native follow the hardened products supply
 * (`factory telemetry watch --resume`, the attempt reading's revision, each
 * participant's encounter journal `after` cursor, the Gateway population and
 * Communiques, Factory custody) performed into the Run's Expression act
 * (live/producer.ts). One producer per Run, OWNED BY THE RUN: started and
 * stopped explicitly (startRunLive / stopRunLive, driven by the Run's Live
 * control). Views only subscribe (followRunLive) and release their
 * subscription; closing a view never stops or loses work, and reopening
 * re-attaches to the in-flight production. The law: WORLD-SHELL-DESIGN.md §7
 * ("the Run's Expression production moved out of view lifetime").
 */
import {createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode} from "react";
import {emitExpressionCue} from "../../stage/cues";
import {attemptRead, buildViewOf} from "./development";
import type {FactoryBuildView, FactoryMaterialSelection} from "./types";
import type {KernelTransportStatus} from "../../kernel/types";
import {encounter, type JournalPage} from "../../encounter/client";
import {cardCharacterRef, readAgentCard} from "../../agency/agentCardReading";
import {readFactoryInhabitation, watchTelemetry} from "./desk/factoryReads";
import {readConversation, readPopulation} from "./inhabitation/reads";
import {viaTransport} from "../../expression/world";
import {LiveProducer, actRefFor, liveExpressionRefFor, type LiveIO, type LiveState} from "./live/producer";
import {contextOfUnits} from "./live/repertoire";
import {syncRunExpression} from "./live/liveObjects";
import {readAndComposeRunExpression} from "./run-expression";

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

// ---------------------------------------------------------------------------
// Live follow: the producer-to-UI connection (one producer per Run)
// ---------------------------------------------------------------------------

export interface LiveRunSource {runKey: string; runRef: string; statePath: string; project?: string; goal?: string; worldRef?: string | null; explicitExpression?: string;
  /** The workflow inspection's units (task types, SkillSets, skills for the repertoire). */
  units?: {key?: string; workflowUnitRef?: string; praxisRefs?: string[]; agentRequirements?: {agentSetRefs?: string[]}}[]}
interface LiveHolder {producer: LiveProducer; state: LiveState; unsubscribe: () => void}
const liveHolders = new Map<string, LiveHolder>();
const liveListeners = new Set<() => void>();
const emitLive = () => { for (const listener of [...liveListeners]) listener(); };

/** The kernel reads the producer follows, each through its existing owner
 * route. A read that fails is a named unavailable source in the state. */
export function kernelLiveIO(transport: KernelTransportStatus, source: LiveRunSource): LiveIO {
  const project = source.project ?? "";
  return {
    readAttempts: () => attemptRead(transport, source.statePath, source.runRef),
    watch: resume => watchTelemetry(transport, source.statePath, {resume, durationSecs: 4, maxEvents: 1, runRef: source.runRef}),
    readJournal: async (session, after) => encounter<JournalPage>(transport, project, {action: "read", agent_session: session, after, limit: 256}),
    readPopulation: async () => {
      const read = await readPopulation(transport, source.project);
      if (read.state !== "read") throw new Error(read.reason);
      return read.data;
    },
    readConversation: async (position, withPosition) => {
      const read = await readConversation(transport, position, withPosition, source.project);
      if (read.state !== "read") throw new Error(read.reason);
      return read.data.communiques ?? [];
    },
    readCustody: async () => {
      const read = await readFactoryInhabitation(transport, source.statePath, source.runRef);
      if (read.state !== "read") throw new Error(read.reason);
      return (read.data.runs ?? []).filter(run => run.run_ref === source.runRef).flatMap(run => run.custody ?? []);
    },
    readCard: async agentRef => {
      const card = await readAgentCard(transport, agentRef, source.worldRef);
      const character = cardCharacterRef(card);
      return typeof character === "string" && character ? {character_ref: character} : {};
    },
    syncExpression: async () => {
      const readCard = (agentRef: string) => readAgentCard(transport, agentRef, source.worldRef);
      await syncRunExpression(transport, () => readAndComposeRunExpression(transport, source.statePath, source.runRef, liveExpressionRefFor(source.runRef), undefined, undefined, readCard), "desktop:factory-live");
    },
    world: viaTransport(transport),
  };
}

/** The Run's own state for its live production: `stopped` only by the
 * person's explicit stop. A Run not stopped is followed whenever a view
 * shows it (the default), and the state is session-scoped; the kernel act
 * is the durable record. */
const liveIntent = new Map<string, "following" | "stopped">();
/** Views subscribed to each Run's live state (a count, never a lifetime). */
const liveSubscribers = new Map<string, number>();
/** Injectable IO: the kernel by default; tests supply a recording fake. */
export type LiveIOFactory = (transport: KernelTransportStatus, source: LiveRunSource) => LiveIO;

/** Start the Run's production (idempotent). A stopped predecessor's loop is
 * awaited first, so a successor never performs into the same act while the
 * predecessor is still mid-passage: exactly-once holds across a stop. */
export async function startRunLive(transport: KernelTransportStatus, source: LiveRunSource, makeIO: LiveIOFactory = kernelLiveIO): Promise<void> {
  liveIntent.set(source.runKey, "following");
  const held = liveHolders.get(source.runKey);
  if (held?.producer.following) return;
  if (held) await held.producer.stop();
  // A stop may have arrived while the predecessor wound down, or a
  // concurrent start may already hold the Run.
  if (liveIntent.get(source.runKey) !== "following" || liveHolders.get(source.runKey)?.producer.following) return;
  held?.unsubscribe();
  const explicit = source.explicitExpression ?? explicitByRun.get(source.runKey);
  const producer = new LiveProducer(makeIO(transport, source), {
    runRef: source.runRef, goal: source.goal, actRef: actRefFor(source.runRef), expressionRef: liveExpressionRefFor(source.runRef),
    actor: "desktop:factory-live", context: {...contextOfUnits(source.units ?? []), ...(explicit ? {explicit} : {})},
  });
  const created: LiveHolder = {producer, state: producer.state, unsubscribe: () => {}};
  created.unsubscribe = producer.subscribe(state => { created.state = state; emitLive(); });
  liveHolders.set(source.runKey, created);
  producer.start();
  emitLive();
}

/** The Run's explicit stop: the production ends at its next passage boundary
 * and the promise settles when it has. The act keeps every passage performed;
 * Follow resumes it. */
export async function stopRunLive(runKey: string): Promise<void> {
  liveIntent.set(runKey, "stopped");
  const held = liveHolders.get(runKey);
  emitLive();
  if (!held) return;
  await held.producer.stop();
  emitLive();
}

/** A view subscribes to the Run's live state. The release only drops the
 * subscriber count; it never stops the production. The first subscriber of a
 * Run that has not been stopped starts it (the Run's default), through the
 * same start the Run's control uses. */
export function followRunLive(transport: KernelTransportStatus, source: LiveRunSource, makeIO: LiveIOFactory = kernelLiveIO): () => void {
  liveSubscribers.set(source.runKey, (liveSubscribers.get(source.runKey) ?? 0) + 1);
  if (liveIntent.get(source.runKey) !== "stopped") void startRunLive(transport, source, makeIO);
  emitLive();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (liveSubscribers.get(source.runKey) ?? 1) - 1;
    if (count > 0) liveSubscribers.set(source.runKey, count); else liveSubscribers.delete(source.runKey);
    emitLive();
  };
}

/** Views currently subscribed to a Run (diagnostics and tests). */
export const runLiveSubscribers = (runKey: string) => liveSubscribers.get(runKey) ?? 0;

/** The Run's live state (undefined while no view holds it). */
export function useRunLive(runKey: string | undefined): LiveState | undefined {
  return useSyncExternalStore(
    listener => { liveListeners.add(listener); return () => { liveListeners.delete(listener); }; },
    () => (runKey ? liveHolders.get(runKey)?.state : undefined),
    () => undefined,
  );
}
/** Tier 1: select an Expression (or Scene) for this Run's act explicitly;
 * `undefined` returns to workflow → task/SkillSet → generic resolution. */
export async function selectRunExpression(runKey: string, fileRef: string | undefined): Promise<void> {
  // The person's choice outlives this view: reopening the Run's Live (or
  // coming back from Technè) keeps the Expression they chose.
  if (fileRef) explicitByRun.set(runKey, fileRef); else explicitByRun.delete(runKey);
  await liveHolders.get(runKey)?.producer.select(fileRef);
}
const explicitByRun = new Map<string, string>();
/** Tests / diagnostics: how many Runs have a production following now. */
export const heldLiveFollows = () => [...liveHolders.values()].filter(holder => holder.producer.following).length;
/** Tests / diagnostics: the Run's production (following or stopped). */
export const heldRunLive = (runKey: string): LiveProducer | undefined => liveHolders.get(runKey)?.producer;
