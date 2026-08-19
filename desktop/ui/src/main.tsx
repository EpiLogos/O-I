import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import '@epilogos/oi-design-system/tokens.css';
import './shell.css';
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

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(preview);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [factoryBuild, setFactoryBuild] = useState<FactoryBuildSnapshot | null>(null);
  const [workbenchEvidence, setWorkbenchEvidence] = useState<WorkbenchEvidence | null>(null);

  useEffect(() => {
    invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
    invoke<Contribution[]>('contribution_catalog').then(setContributions).catch(() => setContributions([]));
    refreshFactoryBuild();
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

  async function openDestination(destination: Destination) {
    try {
      await invoke('open_destination', { destination });
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
      if (destination === 'build') await refreshFactoryBuild();
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
      // Browser preview has no native bridge. Keep only an ephemeral visual
      // selection there; native builds always use the privileged bridge above.
      setSnapshot((current) => ({ ...current, selection: subject }));
    }
  }

  const visibleContributions = useMemo(
    () => contributions.filter((entry) => ownerVisibleAt(entry.contribution.native_owner, snapshot.destination)),
    [contributions, snapshot.destination],
  );
  const rootAgency = contributions.find((entry) => entry.contribution.native_owner === 'actuation');

  return (
    <main className="oi-shell oi-surface-light" data-suite-state={snapshot.suite_condition}>
      <header className="oi-shell__topbar">
        <div className="oi-mark" aria-label="O:I">O:I</div>
        <nav aria-label="O:I destinations">
          {snapshot.destinations.map((destination) => (
            <button
              key={destination}
              className={snapshot.destination === destination ? 'is-active' : ''}
              onClick={() => openDestination(destination)}
            >
              {destination === 'home' ? 'Home' : destination[0].toUpperCase() + destination.slice(1)}
            </button>
          ))}
        </nav>
        <span className="oi-state" data-state={snapshot.suite_condition}>{snapshot.suite_condition}</span>
      </header>

      <section className="oi-shell__canvas" aria-label="Primary content canvas">
        <p className="oi-eyebrow">{snapshot.destination}</p>
        <h1>{titleFor(snapshot.destination)}</h1>
        <p className="oi-lead">{copyFor(snapshot.destination)}</p>
        {snapshot.destination === 'home' && <WorkbenchSurface onSelect={selectWorkbenchRef} />}
        {snapshot.destination === 'build' && factoryBuild && (
          <FactoryBuildSurface snapshot={factoryBuild} onRefresh={refreshFactoryBuild} />
        )}
        {snapshot.destination === 'system' && <SystemSurface surfaces={snapshot.surfaces} />}
        <ContributionSurface contributions={visibleContributions} />
      </section>

      <aside className="oi-shell__inspector" aria-label="Context and root agency region">
        <p className="oi-eyebrow">Encounter</p>
        <h2>Shared reference</h2>
        {snapshot.selection ? (
          <dl className="oi-ref">
            <dt>Ref</dt><dd>{snapshot.selection.ref}</dd>
            <dt>Kind</dt><dd>{snapshot.selection.kind}</dd>
            <dt>Owner</dt><dd>{snapshot.selection.native_owner}</dd>
            <dt>Source</dt><dd>{snapshot.selection.provenance.source}</dd>
          </dl>
        ) : (
          <p className="oi-muted">No object selected. Canvas, Knowledge and root-agency regions share one stable Ref; O:I does not copy wholesale Context into contributions.</p>
        )}
        {workbenchEvidence && (
          <div className="oi-inspector-evidence">
            <p className="oi-eyebrow">Explain / History</p>
            <strong>{workbenchEvidence.title}</strong>
            <p className="oi-muted">{workbenchEvidence.summary}</p>
            {workbenchEvidence.detail != null && (
              <details>
                <summary>Native detail</summary>
                <pre>{JSON.stringify(workbenchEvidence.detail, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
        <div className="oi-root-agency">
          <p className="oi-eyebrow">Root Agency</p>
          {rootAgency ? (
            <>
              <strong>{rootAgency.contribution.availability}</strong>
              <p className="oi-muted">{rootAgency.contribution.target_contract ?? 'native adapter pending'}</p>
              <small>{rootAgency.contribution.provenance.source}</small>
            </>
          ) : <p className="oi-muted">No Actuation reading disclosed.</p>}
        </div>
      </aside>

      <footer className="oi-shell__drawer" aria-label="Deep drawer">
        <span>Trajectory / terminal / events</span>
        <span>alternate native Surfaces remain attachable without changing SessionSpace identity</span>
      </footer>
    </main>
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
        <div>
          <span className="oi-contribution-state" data-state="ready">ready</span>
          <h3>{snapshot.view.run.label}</h3>
        </div>
        <p>{snapshot.view.frontier.title}</p>
        <dl>
          <dt>Project</dt><dd>{snapshot.view.project.projectRef}</dd>
          <dt>Run</dt><dd>{snapshot.view.run.runRef}</dd>
          <dt>RunMap</dt><dd>{snapshot.view.run.runMapRef}</dd>
          <dt>Frontier</dt><dd>{snapshot.view.frontier.mode} · {snapshot.view.frontier.summary}</dd>
          <dt>Factory revision</dt><dd>{snapshot.provenance.factoryStateRevision}</dd>
          <dt>RunMap revision</dt><dd>{snapshot.provenance.runMapRevision}</dd>
        </dl>
        <button type="button" onClick={() => onRefresh()}>Refresh product reading</button>
      </article>

      {snapshot.view.candidates.map((candidate) => (
        <article key={candidate.candidateRef}>
          <div>
            <span className="oi-contribution-state" data-state="ready">{candidate.status}</span>
            <h3>{candidate.label}</h3>
          </div>
          <p>{candidate.candidateRef}</p>
          <dl>
            <dt>Executions</dt><dd>{candidate.producingExecutionRefs.join(', ') || 'none'}</dd>
            <dt>Claims</dt><dd>{candidate.claimRefs.join(', ') || 'none'}</dd>
            <dt>Evidence</dt><dd>{candidate.evidenceRefs.join(', ') || 'none'}</dd>
          </dl>
        </article>
      ))}

      {snapshot.view.humanRequests.map((request) => (
        <article key={request.humanRequestRef}>
          <div>
            <span className="oi-contribution-state" data-state="degraded">human request</span>
            <h3>{request.question}</h3>
          </div>
          <p>{request.whyHuman}</p>
          <small>{request.humanRequestRef}</small>
        </article>
      ))}

      {snapshot.view.executions.map((execution) => (
        <article key={execution.executionRef}>
          <div>
            <span className="oi-contribution-state" data-state="ready">{execution.status}</span>
            <h3>{execution.executionRef}</h3>
          </div>
          <dl>
            <dt>Harness</dt><dd>{execution.harnessRef ?? 'not observed'}</dd>
            <dt>SessionSpace</dt><dd>{execution.sessionSpaceRef ?? 'not observed'}</dd>
            <dt>Native trajectory</dt><dd>{execution.nativeTrajectoryRef ?? 'not observed'}</dd>
          </dl>
        </article>
      ))}

      {snapshot.view.actions.map((action) => (
        <article key={action.actionRef}>
          <div>
            <span className="oi-contribution-state" data-state="ready">available Action</span>
            <h3>{action.label}</h3>
          </div>
          <p>{action.actionRef}</p>
          <small>Requires explicit Capability grant: {action.requiredCapabilityRef}</small>
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

function SystemSurface({ surfaces }: { surfaces: Surface[] }) {
  if (!surfaces.length) return <div className="oi-empty">No registered O:I surfaces disclosed.</div>;
  return (
    <div className="oi-surface-list">
      {surfaces.map((surface) => (
        <article key={surface.id}>
          <span className="oi-surface-list__state">{surface.state}</span>
          <h3>{surface.public_name}</h3>
          <p>{surface.function}</p>
          {surface.detail && <small>{surface.detail}</small>}
        </article>
      ))}
    </div>
  );
}

function ownerVisibleAt(owner: string, destination: Destination) {
  if (destination === 'home' || destination === 'system') return true;
  if (destination === 'personal') return owner === 'central' || owner === 'actuation';
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
    system: 'Composition, disclosed.',
  }[destination];
}

function copyFor(destination: Destination) {
  return {
    home: 'One native workspace over AIKit SessionSpace, AgentSession conversation and project Knowledge. Focus changes around stable refs; O:I does not become their state owner.',
    personal: 'Central-owned authored ground and Actuation-owned world-binding readings enter here without moving their semantics into O:I.',
    build: 'Factory now exposes a product-owned live FactoryBuildView provider over canonical state. When the local provider binding is configured, this canvas renders that observed revision directly; otherwise the Factory contribution remains explicitly degraded.',
    explore: 'The current shared-field Explore read model is hostable now, with canonical refs independent of SpaceTimeDB transport IDs.',
    system: 'Registration, reachability and native contribution status are shown without inventing product-native health.',
  }[destination];
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);