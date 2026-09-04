import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import '@epilogos/oi-design-system/tokens.css';
import './shell.css';
import type { CurrentWorldReading } from './current-world';
import type { WorldRecognitionAccount } from './world-recognition';
import { RuntimeObservationSurface } from './runtime-observation';
import { NativeSearchCommand } from './native-command';
import { ExploreWorkbenchSurface } from './explore-workbench';
import { PersonalProfileSurface } from './personal-profile';
import { SystemWorkbench } from './system-workbench';
import {
  HostSurfaceDescriptor,
  ProfessionalWorkbenchHost,
  WorkbenchHostHandle,
} from './workbench-host';
import { WorkbenchEvidence, WorkbenchSemanticRef, WorkbenchSurface } from './workbench';
import { kernelEventStatus, subscribeKernelEvents, useKernelFocus } from './kernel-events';
import type { KernelFocusRelation } from './kernel-event-model.mjs';
import { WorldTreeSurface } from './world-tree';
import { WorldSubjectSurface, type SubjectSaveState } from './world-subject';
import type { CompositionReading, SubjectReading, TreeSubjectRef, WorldTreeReading } from './world-tree-model.mjs';

type Destination = 'home' | 'personal' | 'build' | 'explore' | 'system';
type SuiteCondition = 'empty' | 'partial' | 'broken' | 'full';
type ContributionAvailability = 'ready' | 'degraded' | 'pending_native_adapter' | 'unavailable';

type SemanticRef = {
  ref: string;
  kind: string;
  native_owner: string;
  provenance: { source: string; revision?: string };
};

type Surface = {
  id: string;
  public_name: string;
  function: string;
  repository: string;
  native_entry: string;
  state: 'missing' | 'installed' | 'registered' | 'broken';
  detail?: string;
};

type Snapshot = {
  schema: 'oi.desktop-shell/v1';
  destination: Destination;
  suite_condition: SuiteCondition;
  destinations: Destination[];
  surfaces: Surface[];
  selection?: SemanticRef;
  /** The one global focus relation (02 §7), kernel-owned. */
  focus?: KernelFocusRelation;
  current_world?: CurrentWorldReading;
  world_recognition?: WorldRecognitionAccount;
  warnings: string[];
};

type Contribution = {
  contribution: {
    contribution_ref: string;
    native_owner: string;
    target_contract?: string;
    availability: ContributionAvailability;
    regions: string[];
    read_model_ref?: SemanticRef;
    accepted_selection_kinds: string[];
    actions: Array<{
      action_ref: string;
      native_owner: string;
      availability: 'available' | 'unavailable';
      required_capability_ref?: string;
    }>;
    detail?: string;
    provenance: { source: string; revision?: string };
  };
  package?: { package_ref: string; source_revision: string };
};

type FactoryBuildSnapshot = {
  contract: 'factory.build-view/v1';
  providerContract: 'factory.build-view-provider/v1';
  revision: number;
  provenance: {
    owner: string;
    factoryStateRevision: number;
    runRevision: number;
    runMapRevision: number;
    source: string;
  };
  view: {
    project: { projectRef: string; label: string };
    run: { runRef: string; runMapRef: string; label: string; status: string };
    frontier: { subjectRef: string; title: string; mode: string; summary: string };
    candidates: Array<{
      candidateRef: string;
      label: string;
      status: string;
      claimRefs: string[];
      evidenceRefs: string[];
      producingExecutionRefs: string[];
    }>;
    humanRequests: Array<{
      humanRequestRef: string;
      question: string;
      whyHuman: string;
      evidenceRefs?: string[];
    }>;
    executions: Array<{
      executionRef: string;
      status: string;
      sessionSpaceRef?: string;
      harnessRef?: string;
      nativeTrajectoryRef?: string;
    }>;
    actions: Array<{
      actionRef: string;
      label: string;
      subjectKinds: string[];
      requiredCapabilityRef: string;
    }>;
  };
};

const preview: Snapshot = {
  schema: 'oi.desktop-shell/v1',
  destination: 'home',
  suite_condition: 'empty',
  destinations: ['home', 'personal', 'build', 'explore', 'system'],
  surfaces: [],
  warnings: ['Browser preview: native O:I composition is unavailable outside the Rust shell.'],
};

/**
 * The canvas surfaces of the resting shell (01 §2, §11).
 *
 * There is no destination set to choose from: the World tree is the resting
 * canvas, and every other surface is reached by walking the tree or by
 * summoning depth. Each entry keeps the SurfaceRef it has always had — the
 * retirement of destination navigation does not mint new Surface identity.
 */
const CANVAS_SURFACES: HostSurfaceDescriptor[] = [
  {
    surfaceRef: 'surface/oi/world-tree',
    title: 'World tree',
    nativeOwner: 'central',
    region: 'canvas',
    provenance: 'O:I World tree Projection over Central owner readings',
  },
  {
    surfaceRef: 'surface/oi/world-subject',
    title: 'Subject',
    nativeOwner: 'central',
    region: 'canvas',
    provenance: 'O:I subject reading served through the owner authority gate',
  },
  {
    surfaceRef: 'surface/oi/workbench',
    title: 'Workbench',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I professional host',
  },
  {
    surfaceRef: 'surface/oi/personal-host',
    title: 'Personal',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I host destination; native content remains product-owned',
  },
  {
    surfaceRef: 'surface/oi/build-host',
    title: 'Build',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I host destination over Factory native reading',
  },
  {
    surfaceRef: 'surface/oi/explore-host',
    title: 'Explore',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I workbench projection of the renderer-neutral Explore application',
  },
  {
    surfaceRef: 'surface/oi/system-host',
    title: 'System',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I six-product composition workbench; native state remains owner-owned',
  },
];

const WORLD_TREE_SURFACE = 'surface/oi/world-tree';
const WORLD_SUBJECT_SURFACE = 'surface/oi/world-subject';

/** The one subject the shell has asked the owner to serve. Not a selection
 * copy: the kernel owns focus; this only remembers which reading to render. */
type OpenedSubject = {
  subject: TreeSubjectRef;
  reading: SubjectReading | null;
};

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(preview);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [factoryBuild, setFactoryBuild] = useState<FactoryBuildSnapshot | null>(null);
  const [aikitContext, setAikitContext] = useState<unknown>(null);
  const [workbenchEvidence, setWorkbenchEvidence] = useState<WorkbenchEvidence | null>(null);
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [lastEvent, setLastEvent] = useState<string>('');
  const [worldTree, setWorldTree] = useState<WorldTreeReading | null>(null);
  const [composition, setComposition] = useState<CompositionReading | null>(null);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [opened, setOpened] = useState<OpenedSubject | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SubjectSaveState>({});
  const [focusError, setFocusError] = useState<string | null>(null);
  const hostRef = useRef<WorkbenchHostHandle | null>(null);

  // The one global focus (02 §7): bootstrapped from the kernel's snapshot pull,
  // then moved only by FocusChanged events. No surface keeps its own copy.
  const focus = useKernelFocus(snapshot.focus ?? snapshot.selection);
  const selection = focus?.subject ?? undefined;

  useEffect(() => subscribeKernelEvents((event) => {
    setLastEvent(event.event);
    // The tree is a Projection the kernel composes; these are the pushes that
    // make a pulled tree stale, so each one re-reads it.
    if (event.event === 'world_changed' || event.event === 'focus_changed') void refreshWorldTree();
    if (event.event === 'composition_changed') void refreshComposition();
    if (event.event === 'source_changed' && opened) void rereadSubject(opened.subject);
  }), [opened]);

  useEffect(() => {
    invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
    invoke<Contribution[]>('contribution_catalog').then(setContributions).catch(() => setContributions([]));
    invoke<unknown>('aikit_context_resolution').then(setAikitContext).catch(() => setAikitContext(null));
    void refreshWorldTree();
    void refreshComposition();
    void refreshFactoryBuild();
  }, []);

  async function refreshWorldTree() {
    try {
      setWorldTree(await invoke<WorldTreeReading>('world_tree'));
      setWorldError(null);
    } catch (error) {
      // A failed tree read is a state, not a blank: the reason is disclosed.
      setWorldError(`World tree unavailable: ${String(error)}`);
    }
  }

  async function refreshComposition() {
    try {
      setComposition(await invoke<CompositionReading>('composition_reading'));
    } catch {
      setComposition(null);
    }
  }

  async function refreshFactoryBuild() {
    try {
      const next = await invoke<FactoryBuildSnapshot | null>('factory_build_snapshot');
      setFactoryBuild(next);
      setContributions(await invoke<Contribution[]>('contribution_catalog'));
    } catch {
      setFactoryBuild(null);
    }
  }

  async function refreshAikitContext() {
    try {
      setAikitContext(await invoke<unknown>('aikit_context_resolution'));
    } catch {
      setAikitContext(null);
    }
  }

  async function reobserveWorld() {
    try {
      setSnapshot(await invoke<Snapshot>('reconcile_world'));
    } catch {
      invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
    }
    await refreshWorldTree();
    await refreshComposition();
  }

  /** Open a World node or source from the tree (01 §2): one kernel operation
   * that selects AND reads, so focus and the reading can never drift apart.
   * The kernel mutates the one focus relation and pushes FocusChanged; the UI
   * re-renders from that event. No optimistic local selection (02 §5 key loop). */
  async function openWorldSubject(subject: TreeSubjectRef) {
    setSubjectError(null);
    setSaveState({});
    try {
      const reading = await invoke<SubjectReading>('open_subject', { subject });
      setOpened({ subject, reading });
      hostRef.current?.openSurface(WORLD_SUBJECT_SURFACE, 'canvas', subject.ref);
    } catch (error) {
      setSubjectError(`Open refused: ${String(error)}`);
      hostRef.current?.openSurface(WORLD_SUBJECT_SURFACE, 'canvas', subject.ref);
    }
  }

  /** Save through the owner's authority gate (02 §9.4). A refusal is kept as
   * the structured failure it arrived as and disclosed as data — never mined
   * out of prose (K2 fix F-M4). */
  async function saveWorldSubject(subject: TreeSubjectRef, sourceRef: string | null, expectedRevision: string | number | null, content: string) {
    if (!sourceRef) return;
    setSaveState({ busy: true });
    try {
      const report = await invoke<{ source_ref: string; revision: string; changed: boolean }>('save_subject', {
        sourceRef,
        expectedRevision: expectedRevision == null ? '' : String(expectedRevision),
        content,
        actor: 'human:desktop',
      });
      setSaveState({ report });
      await rereadSubject(subject);
    } catch (failure) {
      setSaveState({ failure: failure as NonNullable<SubjectSaveState['failure']> });
    }
  }

  async function rereadSubject(subject: TreeSubjectRef) {
    setSaveState({});
    try {
      const reading = await invoke<SubjectReading>('open_subject', { subject });
      setOpened((current) => (current && current.subject.ref === subject.ref ? { subject, reading } : current));
    } catch (error) {
      setSubjectError(`Re-read refused: ${String(error)}`);
    }
  }

  async function selectWorkbenchRef(subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) {
    setWorkbenchEvidence(evidence);
    // The kernel mutates the one focus relation and pushes FocusChanged; the UI
    // re-renders from that event. No optimistic local selection — without a
    // native bridge nothing is selected (02 §5 key loop). A refused select
    // discloses: the old focus stays on screen, and the refusal is named (M3).
    try {
      await invoke('select_semantic_ref', { subject });
      setFocusError(null);
    } catch (error) {
      setFocusError(`Selection refused: ${String(error)}`);
    }
  }

  const rootAgency = contributions.find((entry) => entry.contribution.native_owner === 'actuation');
  const surfaces = useMemo(() => CANVAS_SURFACES, []);

  const handleRef = useCallback((handle: WorkbenchHostHandle) => {
    hostRef.current = handle;
  }, []);

  return (
    <ProfessionalWorkbenchHost
      surfaces={surfaces}
      restSurfaceRef={WORLD_TREE_SURFACE}
      onHostReady={handleRef}
      identity={(
        <>
          <strong>{opened?.subject.ref ?? focus?.project?.ref ?? focus?.world?.ref ?? 'World tree'}</strong>
          {focus?.world?.ref && <code>{focus.world.ref}</code>}
          {focus?.project?.ref && <code>{focus.project.ref}</code>}
        </>
      )}
      command={(
        <NativeSearchCommand
          selection={selection}
          onSelect={selectWorkbenchRef}
          onActionResult={(result) => {
            setActionResult(result);
            void refreshFactoryBuild();
          }}
        />
      )}
      navigator={(
        <NavigatorHost snapshot={snapshot} contributions={contributions} selection={selection} focus={focus}>
          <WorldTreeSurface
            reading={worldTree}
            composition={composition}
            focus={focus}
            error={worldError}
            onOpen={openWorldSubject}
          />
        </NavigatorHost>
      )}
      sidecar={(
        <AgencySidecar selection={selection} evidence={workbenchEvidence} rootAgency={rootAgency} focusError={focusError} />
      )}
      lower={<LowerRegion actionResult={actionResult} />}
      system={(
        <SystemRegion
          surfaces={snapshot.surfaces}
          contributions={contributions}
          aikitContext={aikitContext}
          factoryBuild={factoryBuild}
          composition={composition}
          warnings={snapshot.warnings}
        />
      )}
      status={(
        <>
          <span>O:I · {snapshot.suite_condition}</span>
          <span>{selection ? `selected ${selection.ref}` : 'no semantic selection'}</span>
          <span>events {kernelEventStatus()}</span>
          {lastEvent && <span>last event {lastEvent}</span>}
          {focusError && <span role="alert">{focusError}</span>}
          <span>selection ≠ Agent Context disclosure</span>
          <span>Surface ≠ Action</span>
        </>
      )}
      renderSurface={(surface, binding) => (
        <CanvasSurface
          surface={surface}
          binding={binding}
          focus={focus}
          suiteSurfaces={snapshot.surfaces}
          warnings={snapshot.warnings}
          contributions={contributions}
          factoryBuild={factoryBuild}
          aikitContext={aikitContext}
          selection={selection}
          currentWorld={snapshot.current_world}
          worldRecognition={snapshot.world_recognition}
          onSelect={selectWorkbenchRef}
          onRefreshFactory={refreshFactoryBuild}
          onReobserveWorld={reobserveWorld}
          worldTree={worldTree}
          composition={composition}
          worldError={worldError}
          opened={opened}
          subjectError={subjectError}
          saveState={saveState}
          onOpenSubject={openWorldSubject}
          onSaveSubject={saveWorldSubject}
          onRereadSubject={rereadSubject}
        />
      )}
    />
  );
}

function NavigatorHost({
  snapshot,
  contributions,
  selection,
  focus,
  children,
}: {
  snapshot: Snapshot;
  contributions: Contribution[];
  selection?: SemanticRef;
  focus: KernelFocusRelation | null;
  children: React.ReactNode;
}) {
  return (
    <div className="oi-p1-navigator">
      <p className="oi-eyebrow">World navigator</p>
      {children}
      <p className="oi-eyebrow">Host contract</p>
      <p className="oi-muted">The desktop is walked as one tree, not a menu of destinations. Project/files/Ground/Knowledge navigation belongs to #106.</p>
      <div className="oi-workbench__relations">
        <strong>Current focus</strong>
        {focus?.world?.ref && <code>{focus.world.ref}</code>}
        {focus?.project?.ref && <code>{focus.project.ref}</code>}
        {selection ? <code>{selection.ref}</code> : !focus?.world?.ref && <span className="oi-muted">None</span>}
      </div>
      <div className="oi-workbench__relations">
        <strong>Native contributions</strong>
        {contributions.map((entry) => (
          <span key={entry.contribution.contribution_ref}>
            {entry.contribution.native_owner} · {entry.contribution.availability}
          </span>
        ))}
      </div>
      <div className="oi-workbench__relations">
        <strong>Suite</strong>
        <span>{snapshot.suite_condition}</span>
      </div>
    </div>
  );
}

function AgencySidecar({
  selection,
  evidence,
  rootAgency,
  focusError,
}: {
  selection?: SemanticRef;
  evidence: WorkbenchEvidence | null;
  rootAgency?: Contribution;
  focusError?: string | null;
}) {
  return (
    <>
      <p className="oi-eyebrow">Shared semantic focus</p>
      <h2>Agency</h2>
      {focusError && <p className="oi-world-tree__error" role="alert">{focusError}</p>}
      {selection ? (
        <dl className="oi-ref">
          <dt>Ref</dt><dd>{selection.ref}</dd>
          <dt>Kind</dt><dd>{selection.kind}</dd>
          <dt>Owner</dt><dd>{selection.native_owner}</dd>
          <dt>Source</dt><dd>{selection.provenance.source}</dd>
        </dl>
      ) : (
        <p className="oi-muted">No object selected. The host carries only a stable semantic ref; it does not disclose the object into Agent Context.</p>
      )}
      {evidence && (
        <div className="oi-inspector-evidence">
          <p className="oi-eyebrow">Reading / Explain / History</p>
          <strong>{evidence.title}</strong>
          <p className="oi-muted">{evidence.summary}</p>
          {evidence.detail != null && (
            <details><summary>Native detail</summary><pre>{JSON.stringify(evidence.detail, null, 2)}</pre></details>
          )}
        </div>
      )}
      <div className="oi-root-agency">
        <p className="oi-eyebrow">Root Agency slot</p>
        {rootAgency ? (
          <>
            <strong>{rootAgency.contribution.availability}</strong>
            <p className="oi-muted">{rootAgency.contribution.target_contract ?? 'native adapter pending'}</p>
            <small>{rootAgency.contribution.provenance.source}</small>
          </>
        ) : <p className="oi-muted">No Actuation reading disclosed. #107 owns the canonical conversation/Cradle body, not P1.</p>}
      </div>
      <div className="oi-p1-agent-slot" aria-label="Inherited AgentSession portal slot" />
    </>
  );
}

function LowerRegion({ actionResult }: { actionResult: unknown }) {
  return (
    <div className="oi-p1-lower">
      <p className="oi-eyebrow">Terminal · trajectory · events · evidence · material</p>
      <p className="oi-muted">P1 establishes the lower/deep host region. Product-specific bodies remain native-owned and are supplied by #106–#110 or alternate native Surfaces.</p>
      <RuntimeObservationSurface />
      {actionResult != null && (
        <details><summary>Most recent native Action return</summary><pre>{JSON.stringify(actionResult, null, 2)}</pre></details>
      )}
    </div>
  );
}

function SystemRegion({
  surfaces,
  contributions,
  aikitContext,
  factoryBuild,
  composition,
  warnings,
}: {
  surfaces: Surface[];
  contributions: Contribution[];
  aikitContext: unknown;
  factoryBuild: FactoryBuildSnapshot | null;
  composition: CompositionReading | null;
  warnings: string[];
}) {
  return (
    <SystemWorkbench
      mode="rail"
      surfaces={surfaces}
      contributions={contributions}
      aikitContext={aikitContext}
      factoryBuild={factoryBuild}
      composition={composition}
      warnings={warnings}
    />
  );
}

function CanvasSurface({
  surface,
  binding,
  focus,
  suiteSurfaces,
  warnings,
  contributions,
  factoryBuild,
  aikitContext,
  composition,
  selection,
  currentWorld,
  worldRecognition,
  onSelect,
  onRefreshFactory,
  onReobserveWorld,
  worldTree,
  worldError,
  opened,
  subjectError,
  saveState,
  onOpenSubject,
  onSaveSubject,
  onRereadSubject,
}: {
  surface: HostSurfaceDescriptor;
  binding: { bindingId: string; surfaceRef: string; subjectRef?: string };
  focus: KernelFocusRelation | null;
  suiteSurfaces: Surface[];
  warnings: string[];
  contributions: Contribution[];
  factoryBuild: FactoryBuildSnapshot | null;
  aikitContext: unknown;
  composition: CompositionReading | null;
  selection?: WorkbenchSemanticRef;
  currentWorld?: CurrentWorldReading;
  worldRecognition?: WorldRecognitionAccount;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
  onRefreshFactory: () => Promise<void>;
  onReobserveWorld?: () => void;
  worldTree: WorldTreeReading | null;
  worldError: string | null;
  opened: OpenedSubject | null;
  subjectError: string | null;
  saveState: SubjectSaveState;
  onOpenSubject: (subject: TreeSubjectRef) => Promise<void>;
  onSaveSubject: (subject: TreeSubjectRef, sourceRef: string | null, expectedRevision: string | number | null, content: string) => Promise<void>;
  onRereadSubject: (subject: TreeSubjectRef) => Promise<void>;
}) {
  if (surface.surfaceRef === WORLD_TREE_SURFACE) {
    return (
      <WorldTreeSurface
        reading={worldTree}
        composition={composition}
        focus={focus}
        error={worldError}
        onOpen={onOpenSubject}
      />
    );
  }

  if (surface.surfaceRef === WORLD_SUBJECT_SURFACE) {
    return (
      <>
        <SurfacePresentationNote bindingId={binding.bindingId} title="Subject" />
        {subjectError && <p className="oi-world-tree__error" role="alert">{subjectError}</p>}
        <WorldSubjectSurface
          reading={opened?.reading ?? null}
          focus={focus}
          treeReading={worldTree}
          saveState={saveState}
          onSave={onSaveSubject}
          onReread={onRereadSubject}
          onOpenSubject={onOpenSubject}
        />
      </>
    );
  }

  const visibleContributions = contributions.filter((entry) => ownerVisibleAt(entry.contribution.native_owner, surface.surfaceRef));

  if (surface.surfaceRef === 'surface/oi/workbench') {
    return (
      <>
        <SurfacePresentationNote bindingId={binding.bindingId} title="The local O:I workbench." />
        <WorkbenchSurface selection={selection} currentWorld={currentWorld} worldRecognition={worldRecognition} onSelect={onSelect} onReobserveWorld={onReobserveWorld} />
      </>
    );
  }

  if (surface.surfaceRef === 'surface/oi/personal-host') {
    return (
      <>
        <SurfacePresentationNote bindingId={binding.bindingId} title="Personal ground." />
        <PersonalProfileSurface aikitContext={aikitContext} />
        <ContributionSurface contributions={visibleContributions} />
      </>
    );
  }

  if (surface.surfaceRef === 'surface/oi/build-host') {
    return (
      <>
        <SurfacePresentationNote bindingId={binding.bindingId} title="Development in view." />
        {factoryBuild ? (
          <FactoryBuildSurface snapshot={factoryBuild} onRefresh={onRefreshFactory} />
        ) : (
          <p className="oi-muted">No live FactoryBuildView provider is bound. #108 consumes the source-faithful Factory Build body; the host will not fabricate it.</p>
        )}
        <ContributionSurface contributions={visibleContributions} />
      </>
    );
  }

  if (surface.surfaceRef === 'surface/oi/explore-host') {
    return (
      <>
        <SurfacePresentationNote bindingId={binding.bindingId} title="Addressable worlds." />
        <p className="oi-lead">Explore is the workbench projection of the same renderer-neutral application used by hosted/browser and structured Agent Surfaces. Local rendering does not change Projection, SharedField or publication standing.</p>
        <ExploreWorkbenchSurface onSelect={onSelect} />
        <ContributionSurface contributions={visibleContributions} />
      </>
    );
  }

  return (
    <>
      <SurfacePresentationNote bindingId={binding.bindingId} title="Six owners, one composed field." />
      <p className="oi-lead">System composes owner-native state without acquiring configuration, Action, credential, provider, Agent or Run authority.</p>
      <SystemWorkbench
        surfaces={suiteSurfaces}
        contributions={contributions}
        aikitContext={aikitContext}
        factoryBuild={factoryBuild}
        composition={composition}
        warnings={warnings}
      />
    </>
  );
}

/** Presentation identity is never substituted for a native Surface or a
 * semantic subject ref — the small print every summoned surface carries. */
function SurfacePresentationNote({ bindingId, title }: { bindingId: string; title: string }) {
  return (
    <header className="oi-canvas-surface__head">
      <h1>{title}</h1>
      <small className="oi-muted">provider-local presentation {bindingId} — tab/split identity is presentation state and is never substituted for a native Surface or semantic subject ref.</small>
    </header>
  );
}

function FactoryBuildSurface({
  snapshot,
  onRefresh,
}: {
  snapshot: FactoryBuildSnapshot;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="oi-contributions" aria-label="Live Factory Build Surface">
      <p className="oi-eyebrow">Factory-owned live reading · revision {snapshot.revision}</p>
      <article>
        <div><span className="oi-contribution-state" data-state="ready">ready</span><h3>{snapshot.view.run.label}</h3></div>
        <p>{snapshot.view.frontier.title}</p>
        <dl>
          <dt>Project</dt><dd>{snapshot.view.project.projectRef}</dd>
          <dt>Run</dt><dd>{snapshot.view.run.runRef}</dd>
          <dt>RunMap</dt><dd>{snapshot.view.run.runMapRef}</dd>
          <dt>Frontier</dt><dd>{snapshot.view.frontier.mode} · {snapshot.view.frontier.summary}</dd>
        </dl>
        <button type="button" onClick={() => void onRefresh()}>Refresh native reading</button>
      </article>
      {snapshot.view.candidates.map((candidate) => (
        <article key={candidate.candidateRef}>
          <div><span className="oi-contribution-state" data-state="ready">{candidate.status}</span><h3>{candidate.label}</h3></div>
          <p>{candidate.candidateRef}</p>
          <small>{candidate.claimRefs.length} claims · {candidate.evidenceRefs.length} evidence refs</small>
        </article>
      ))}
      {snapshot.view.humanRequests.map((request) => (
        <article key={request.humanRequestRef}>
          <div><span className="oi-contribution-state" data-state="degraded">human request</span><h3>{request.question}</h3></div>
          <p>{request.whyHuman}</p>
        </article>
      ))}
      {snapshot.view.actions.map((action) => (
        <article key={action.actionRef}>
          <div><span className="oi-contribution-state" data-state="ready">discoverable Action</span><h3>{action.label}</h3></div>
          <p>{action.actionRef}</p>
          <small>Requires native Capability grant: {action.requiredCapabilityRef}</small>
        </article>
      ))}
    </section>
  );
}

function ContributionSurface({ contributions }: { contributions: Contribution[] }) {
  if (!contributions.length) return null;
  return (
    <section className="oi-contributions" aria-label="Native product contributions">
      <p className="oi-eyebrow">Native contributions</p>
      {contributions.map(({ contribution, package: envelope }) => (
        <article key={contribution.contribution_ref}>
          <div>
            <span className="oi-contribution-state" data-state={contribution.availability}>{contribution.availability.replaceAll('_', ' ')}</span>
            <h3>{contribution.contribution_ref}</h3>
          </div>
          <p>{contribution.detail ?? 'Native product reading.'}</p>
          <dl>
            <dt>Owner</dt><dd>{contribution.native_owner}</dd>
            <dt>Contract</dt><dd>{contribution.target_contract ?? 'not yet published'}</dd>
            <dt>Revision</dt><dd>{contribution.provenance.revision ?? 'unversioned'}</dd>
            {envelope && <><dt>Package</dt><dd>{envelope.package_ref}</dd></>}
          </dl>
        </article>
      ))}
    </section>
  );
}

/** Owner contributions are composed by walking, not by destination: a host
 * surface shows the owners whose readings it composes. */
function ownerVisibleAt(owner: string, surfaceRef: string) {
  if (surfaceRef === 'surface/oi/personal-host') return owner === 'central' || owner === 'actuation' || owner === 'ai-kit';
  if (surfaceRef === 'surface/oi/build-host') return owner === 'software-factory' || owner === 'factory' || owner === 'ai-kit';
  if (surfaceRef === 'surface/oi/explore-host') return owner === 'oi-explore';
  return false;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
