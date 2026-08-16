import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import '@epilogos/oi-design-system/tokens.css';
import './shell.css';

type Destination = 'home' | 'personal' | 'build' | 'explore' | 'system';
type SuiteCondition = 'empty' | 'partial' | 'broken' | 'full';

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

  useEffect(() => {
    invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
  }, []);

  async function openDestination(destination: Destination) {
    try {
      await invoke('open_destination', { destination });
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
    } catch {
      setSnapshot((current) => ({ ...current, destination }));
    }
  }

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
        <span className="oi-state" data-state={snapshot.suite_condition}>
          {snapshot.suite_condition}
        </span>
      </header>

      <section className="oi-shell__canvas" aria-label="Primary content canvas">
        <p className="oi-eyebrow">{snapshot.destination}</p>
        <h1>{titleFor(snapshot.destination)}</h1>
        <p className="oi-lead">{copyFor(snapshot.destination)}</p>
        {snapshot.destination === 'system' && <SystemSurface surfaces={snapshot.surfaces} />}
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
          <p className="oi-muted">No object selected. The root-agent region receives the same stable Ref as the canvas, not a private UI copy of Context.</p>
        )}
      </aside>

      <footer className="oi-shell__drawer" aria-label="Deep drawer">
        <span>Trajectory / terminal / events</span>
        <span>reserved native Surface slot</span>
      </footer>
    </main>
  );
}

function SystemSurface({ surfaces }: { surfaces: Surface[] }) {
  if (!surfaces.length) {
    return <div className="oi-empty">No registered O:I surfaces disclosed.</div>;
  }
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
    personal: 'Central-owned authored ground will appear here through its native read models and Actions.',
    build: 'Factory Project, Run, Candidate, Claim and Evidence meaning stays native to Software Factory.',
    explore: 'O:I Explore read models remain the source for shared-field navigation and provenance.',
    system: 'Registration and reachability are shown without inventing native product health.',
  }[destination];
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
