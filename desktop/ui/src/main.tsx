import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import '@epilogos/oi-design-system/tokens.css';
import './shell.css';

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

  useEffect(() => {
    invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
    invoke<Contribution[]>('contribution_catalog').then(setContributions).catch(() => setContributions([]));
  }, []);

  async function openDestination(destination: Destination) {
    try {
      await invoke('open_destination', { destination });
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
    } catch {
      setSnapshot((current) => ({ ...current, destination }));
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
        {snapshot.destination === 'system' && <SystemSurface surfaces={snapshot.surfaces} />}
        <ContributionSurface contributions={visibleContributions} />
      </section>

      <aside className="oi-shell__inspector" aria-label="Context and root agent region">
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
          <p className="oi-muted">No object selected. Canvas and root-agent regions share one stable Ref; O:I does not copy wholesale Context into contributions.</p>
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
        <span>reserved native Surface slot</span>
      </footer>
    </main>
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
  if (destination === 'build') return owner === 'software-factory' || owner === 'ai-kit';
  if (destination === 'explore') return owner === 'oi-explore';
  return false;
}

function titleFor(destination: Destination) {
  return {
    home: 'The local O:I whole.',
    personal: 'Personal ground.',
    build: 'Development in view.',
    explore: 'Addressable worlds.',
    system: 'Composition, disclosed.',
  }[destination];
}

function copyFor(destination: Destination) {
  return {
    home: 'A sparse local surface over the installed six-product field.',
    personal: 'Central-owned authored ground and Actuation-owned world-binding readings enter here without moving their semantics into O:I.',
    build: 'Factory Build remains pending its source-faithful #144/#145 implementation; O:I shows that boundary rather than inventing it.',
    explore: 'The current shared-field Explore read model is hostable now, with canonical refs independent of SpaceTimeDB transport IDs.',
    system: 'Registration, reachability and native contribution status are shown without inventing product-native health.',
  }[destination];
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
