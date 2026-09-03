import React, { useEffect, useMemo, useState } from 'react';
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
  SurfaceFocus,
  SurfacePresentationBinding,
} from './workbench-host';
import { WorkbenchEvidence, WorkbenchSemanticRef, WorkbenchSurface } from './workbench';

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

const ROOT_SURFACES: Record<Destination, HostSurfaceDescriptor> = {
  home: {
    surfaceRef: 'surface/oi/workbench',
    title: 'Workbench',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I professional host',
  },
  personal: {
    surfaceRef: 'surface/oi/personal-host',
    title: 'Personal',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I host destination; native content remains product-owned',
  },
  build: {
    surfaceRef: 'surface/oi/build-host',
    title: 'Build',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I host destination over Factory native reading',
  },
  explore: {
    surfaceRef: 'surface/oi/explore-host',
    title: 'Explore',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I workbench projection of the renderer-neutral Explore application',
  },
  system: {
    surfaceRef: 'surface/oi/system-host',
    title: 'System',
    nativeOwner: 'o-i',
    region: 'canvas',
    provenance: 'O:I six-product composition workbench; native state remains owner-owned',
  },
};

const DESTINATION_BY_SURFACE = new Map(
  Object.entries(ROOT_SURFACES).map(([destination, surface]) => [surface.surfaceRef, destination as Destination]),
);

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(preview);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [factoryBuild, setFactoryBuild] = useState<FactoryBuildSnapshot | null>(null);
  const [aikitContext, setAikitContext] = useState<unknown>(null);
  const [workbenchEvidence, setWorkbenchEvidence] = useState<WorkbenchEvidence | null>(null);
  const [actionResult, setActionResult] = useState<unknown>(null);

  useEffect(() => {
    invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
    invoke<Contribution[]>('contribution_catalog').then(setContributions).catch(() => setContributions([]));
    invoke<unknown>('aikit_context_resolution').then(setAikitContext).catch(() => setAikitContext(null));
    void refreshFactoryBuild();
  }, []);

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
  }

  async function openDestination(destination: Destination) {
    try {
      await invoke('open_destination', { destination });
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
      if (destination === 'build' || destination === 'system') await refreshFactoryBuild();
      if (destination === 'personal' || destination === 'system') await refreshAikitContext();
    } catch {
      setSnapshot((current) => ({ ...current, destination }));
    }
  }

  async function selectWorkbenchRef(subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) {
    setWorkbenchEvidence(evidence);
    try {
      await invoke('select_semantic_ref', { subject });
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
    } catch {
      // Browser preview has no native bridge. This fallback is presentation only;
      // native builds always use the privileged stable-ref selection boundary.
      setSnapshot((current) => ({ ...current, selection: subject }));
    }
  }

  function onSurfaceFocus(focus: SurfaceFocus) {
    const destination = DESTINATION_BY_SURFACE.get(focus.surfaceRef);
    if (destination) void openDestination(destination);
  }

  const rootAgency = contributions.find((entry) => entry.contribution.native_owner === 'actuation');
  const surfaces = useMemo(() => Object.values(ROOT_SURFACES), []);

  return (
    <ProfessionalWorkbenchHost
      surfaces={surfaces}
      initialSurfaceRef={ROOT_SURFACES.home.surfaceRef}
      onSurfaceFocus={onSurfaceFocus}
      command={(
        <NativeSearchCommand
          selection={snapshot.selection}
          onSelect={selectWorkbenchRef}
          onActionResult={(result) => {
            setActionResult(result);
            void refreshFactoryBuild();
          }}
        />
      )}
      navigator={(
        <NavigatorHost surfaces={surfaces} snapshot={snapshot} contributions={contributions} />
      )}
      sidecar={(
        <AgencySidecar selection={snapshot.selection} evidence={workbenchEvidence} rootAgency={rootAgency} />
      )}
      lower={<LowerRegion actionResult={actionResult} />}
      system={(
        <SystemRegion
          surfaces={snapshot.surfaces}
          contributions={contributions}
          aikitContext={aikitContext}
          factoryBuild={factoryBuild}
          currentWorld={snapshot.current_world}
          warnings={snapshot.warnings}
        />
      )}
      status={(
        <>
          <span>O:I · {snapshot.suite_condition}</span>
          <span>{snapshot.selection ? `selected ${snapshot.selection.ref}` : 'no semantic selection'}</span>
          <span>selection ≠ Agent Context disclosure</span>
          <span>Surface ≠ Action</span>
        </>
      )}
      renderSurface={(surface, binding) => (
        <RootCanvasSurface
          surface={surface}
          binding={binding}
          suiteSurfaces={snapshot.surfaces}
          warnings={snapshot.warnings}
          contributions={contributions}
          factoryBuild={factoryBuild}
          aikitContext={aikitContext}
          selection={snapshot.selection}
          currentWorld={snapshot.current_world}
          worldRecognition={snapshot.world_recognition}
          onSelect={selectWorkbenchRef}
          onRefreshFactory={refreshFactoryBuild}
          onReobserveWorld={reobserveWorld}
        />
      )}
    />
  );
}

function NavigatorHost({
  surfaces,
  snapshot,
  contributions,
}: {
  surfaces: HostSurfaceDescriptor[];
  snapshot: Snapshot;
  contributions: Contribution[];
}) {
  return (
    <div className="oi-p1-navigator">
      <p className="oi-eyebrow">Host contract</p>
      <p className="oi-muted">P1 exposes placement and shared focus only. Project/files/Ground/Knowledge navigation belongs to #106.</p>
      <div className="oi-workbench__relations">
        <strong>Canvas Surfaces</strong>
        {surfaces.map((surface) => <code key={surface.surfaceRef}>{surface.surfaceRef}</code>)}
      </div>
      <div className="oi-workbench__relations">
        <strong>Current selection</strong>
        {snapshot.selection ? <code>{snapshot.selection.ref}</code> : <span className="oi-muted">None</span>}
      </div>
      <div className="oi-workbench__relations">
        <strong>Native contributions</strong>
        {contributions.map((entry) => (
          <span key={entry.contribution.contribution_ref}>
            {entry.contribution.native_owner} · {entry.contribution.availability}
          </span>
        ))}
      </div>
    </div>
  );
}

function AgencySidecar({
  selection,
  evidence,
  rootAgency,
}: {
  selection?: SemanticRef;
  evidence: WorkbenchEvidence | null;
  rootAgency?: Contribution;
}) {
  return (
    <>
      <p className="oi-eyebrow">Shared semantic focus</p>
      <h2>Agency / Inspector</h2>
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
  currentWorld,
  warnings,
}: {
  surfaces: Surface[];
  contributions: Contribution[];
  aikitContext: unknown;
  factoryBuild: FactoryBuildSnapshot | null;
  currentWorld?: CurrentWorldReading;
  warnings: string[];
}) {
  return (
    <SystemWorkbench
      mode="rail"
      surfaces={surfaces}
      contributions={contributions}
      aikitContext={aikitContext}
      factoryBuild={factoryBuild}
      currentWorld={currentWorld}
      warnings={warnings}
    />
  );
}

function RootCanvasSurface({
  surface,
  binding,
  suiteSurfaces,
  warnings,
  contributions,
  factoryBuild,
  aikitContext,
  selection,
  currentWorld,
  worldRecognition,
  onSelect,
  onRefreshFactory,
  onReobserveWorld,
}: {
  surface: HostSurfaceDescriptor;
  binding: SurfacePresentationBinding;
  suiteSurfaces: Surface[];
  warnings: string[];
  contributions: Contribution[];
  factoryBuild: FactoryBuildSnapshot | null;
  aikitContext: unknown;
  selection?: WorkbenchSemanticRef;
  currentWorld?: CurrentWorldReading;
  worldRecognition?: WorldRecognitionAccount;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
  onRefreshFactory: () => Promise<void>;
  onReobserveWorld?: () => void;
}) {
  const destination = DESTINATION_BY_SURFACE.get(surface.surfaceRef) ?? 'home';
  const visibleContributions = contributions.filter((entry) => ownerVisibleAt(entry.contribution.native_owner, destination));

  if (destination === 'home') {
    return (
      <>
        <p className="oi-eyebrow">Professional host · inherited application substrate</p>
        <h1>The local O:I workbench.</h1>
        <p className="oi-lead">Regions, tabs, splits and presentation focus compose around the same stable refs; SessionSpace, AgentSession and Knowledge remain AIKit/native application state.</p>
        <WorkbenchSurface selection={selection} currentWorld={currentWorld} worldRecognition={worldRecognition} onSelect={onSelect} onReobserveWorld={onReobserveWorld} />
      </>
    );
  }

  if (destination === 'personal') {
    return (
      <>
        <SurfaceHeader destination={destination} binding={binding} />
        <PersonalProfileSurface aikitContext={aikitContext} />
        <ContributionSurface contributions={visibleContributions} />
      </>
    );
  }

  if (destination === 'build') {
    return (
      <>
        <SurfaceHeader destination={destination} binding={binding} />
        {factoryBuild ? (
          <FactoryBuildSurface snapshot={factoryBuild} onRefresh={onRefreshFactory} />
        ) : (
          <p className="oi-muted">No live FactoryBuildView provider is bound. #108 consumes the source-faithful Factory Build body; the host will not fabricate it.</p>
        )}
        <ContributionSurface contributions={visibleContributions} />
      </>
    );
  }

  if (destination === 'explore') {
    return (
      <>
        <SurfaceHeader destination={destination} binding={binding} />
        <p className="oi-lead">Search, READ and bounded GRAPH/TREE/LIST use the same renderer-neutral Explore application as hosted/browser and structured Agent access. Local rendering does not change Projection, SharedField or publication standing.</p>
        <ExploreWorkbenchSurface onSelect={onSelect} />
        <ContributionSurface contributions={visibleContributions} />
      </>
    );
  }

  if (destination === 'system') {
    return (
      <>
        <SurfaceHeader destination={destination} binding={binding} />
        <SystemWorkbench
          surfaces={suiteSurfaces}
          contributions={contributions}
          aikitContext={aikitContext}
          factoryBuild={factoryBuild}
          currentWorld={currentWorld}
          warnings={warnings}
        />
      </>
    );
  }

  return (
    <>
      <SurfaceHeader destination={destination} binding={binding} />
      <p className="oi-lead">{copyFor(destination)}</p>
      <ContributionSurface contributions={visibleContributions} />
    </>
  );
}

function SurfaceHeader({ destination, binding }: { destination: Destination; binding: SurfacePresentationBinding }) {
  return (
    <>
      <p className="oi-eyebrow">{destination} · provider-local presentation {binding.bindingId}</p>
      <h1>{titleFor(destination)}</h1>
      <small className="oi-muted">Tab/split identity is presentation state and is never substituted for a native Surface or semantic subject ref.</small>
    </>
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

function ownerVisibleAt(owner: string, destination: Destination) {
  if (destination === 'home' || destination === 'system') return true;
  if (destination === 'personal') return owner === 'central' || owner === 'actuation' || owner === 'ai-kit';
  if (destination === 'build') return owner === 'software-factory' || owner === 'factory' || owner === 'ai-kit';
  if (destination === 'explore') return owner === 'oi-explore';
  return false;
}

function titleFor(destination: Destination) {
  return {
    home: 'The local O:I workbench.',
    personal: 'Personal ground.',
    build: 'Development in view.',
    explore: 'Addressable worlds.',
    system: 'Six owners, one composed field.',
  }[destination];
}

function copyFor(destination: Destination) {
  return {
    home: 'One native workspace over AIKit SessionSpace, AgentSession conversation and project Knowledge.',
    personal: 'Central-authored AgentProfiles and AIKit effective resolution remain distinct while appearing in one Personal application field.',
    build: 'Factory Build remains product-owned and source-faithful; the host only composes its current read model and canonical Actions.',
    explore: 'Explore is the workbench projection of the same renderer-neutral application used by hosted/browser and structured Agent Surfaces.',
    system: 'System composes owner-native state without acquiring configuration, Action, credential, provider, Agent or Run authority.',
  }[destination];
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
