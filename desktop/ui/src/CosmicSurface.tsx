import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './cosmic.css';

type PrimitiveStatus = 'implemented' | 'partial' | 'stub' | 'research' | 'provider-unavailable' | 'degraded';

type CosmicAspect = {
  aspectRef: string;
  coordinate: "M1'" | "M2'" | "M3'";
  name: string;
  nativeOwner: 'epi';
  status: PrimitiveStatus;
  claimClass: string;
  operatorRefs: string[];
  semanticSources: string[];
  implementationSources: string[];
  data: Record<string, unknown>;
};

type CosmicReadiness = {
  capabilityRef: string;
  status: PrimitiveStatus;
  claimClass: string;
  detail: string;
};

type DeepWorkspaceEntry = {
  position: number;
  name: string;
  coordinate: string;
  workspaceRef: string;
  bimbaRef: string;
  status: PrimitiveStatus;
};

export type CosmicCurrentReading = {
  schema: 'epi.cosmic-current/v1';
  providerContract: 'epi.cosmic-current-provider/v1';
  contributionRef: 'epi.pratibimba.cosmic';
  nativeOwner: 'epi';
  cosmicRef: string;
  profileRef: string;
  coordinateRef: string;
  qlAddress: string;
  lensRef: string;
  sublensRef: string;
  contextFrame?: string;
  observedAtUnixMs: number;
  dayId?: string;
  nowPath?: string;
  current: Record<string, unknown>;
  movement: CosmicAspect;
  resonance: CosmicAspect;
  symbolic: CosmicAspect;
  readiness: CosmicReadiness[];
  deepWorkspaces: DeepWorkspaceEntry[];
  provenance: Record<string, unknown>;
};

type Props = {
  onSelection?: () => Promise<void> | void;
};

export function CosmicSurface({ onSelection }: Props) {
  const [reading, setReading] = useState<CosmicCurrentReading | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<DeepWorkspaceEntry | null>(null);
  const [message, setMessage] = useState('Reading the current matheme…');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setBusy(true);
    try {
      const next = await invoke<CosmicCurrentReading | null>('epi_cosmic_snapshot');
      if (!next) throw new Error('No Epi-owned Cosmic provider is configured.');
      setReading(next);
      setMessage('Current Epi state · source composed');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function openWorkspace(workspace: DeepWorkspaceEntry) {
    if (!reading) return;
    const sourceRevision = stringField(objectField(reading.provenance, 'sourceRevision'));
    await invoke('select_semantic_ref', {
      subject: {
        ref: workspace.workspaceRef,
        kind: 'epi-deep-workspace',
        native_owner: 'epi',
        provenance: {
          source: 'EpiLogos/Epi-Logos-C-Experiments::epi.cosmic-current/v1',
          revision: sourceRevision || undefined,
        },
      },
    });
    setSelectedWorkspace(workspace);
    await onSelection?.();
  }

  if (!reading) {
    return (
      <section className="cosmic-surface" aria-label="Integrated Cosmic instrument">
        <p className="oi-eyebrow">Epi / Pratibimba · M1′ + M2′ + M3′</p>
        <h1 className="cosmic-title">Cosmic.</h1>
        <p className="cosmic-state">{message}</p>
      </section>
    );
  }

  const movement = aspectSummary(reading.movement);
  const resonance = aspectSummary(reading.resonance);
  const symbolic = aspectSummary(reading.symbolic);
  const currentTick = numberField(reading.current, 'tick');
  const currentTick12 = numberField(reading.current, 'tick12');
  const position = numberField(reading.current, 'position6');
  const helix = stringField(reading.current, 'helix');
  const ratioRole = stringField(reading.current, 'ratioRole');
  const qlUse = objectField(reading.provenance, 'qlUse');
  const acceptedQl = stringArray(qlUse, 'accepted');
  const notPromoted = stringArray(qlUse, 'notPromoted');

  return (
    <section className="cosmic-surface" aria-label="Integrated Cosmic instrument">
      <header className="cosmic-header">
        <div>
          <p className="oi-eyebrow">Epi / Pratibimba · integrated M1′ + M2′ + M3′</p>
          <h1 className="cosmic-title">Cosmic.</h1>
        </div>
        <button type="button" className="cosmic-refresh" disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Reading…' : 'Re-read now'}
        </button>
      </header>

      <div className="cosmic-now" aria-label="Current Epi coordinate">
        <span>{reading.dayId ?? 'DAY provider not bound'}</span>
        <strong>P{position ?? '—'} {helix || '—'}</strong>
        <span>{reading.nowPath ?? `tick ${currentTick ?? '—'}`}</span>
      </div>

      {selectedWorkspace ? (
        <DeepWorkspace
          entry={selectedWorkspace}
          reading={reading}
          onBack={() => setSelectedWorkspace(null)}
        />
      ) : (
        <>
          <div className="cosmic-instrument" aria-label="Movement resonance symbolic relation">
            <AspectNode aspect={reading.movement} summary={movement} label="movement" />
            <div className="cosmic-core">
              <span className="cosmic-core__pulse" aria-hidden="true" />
              <small>one current profile</small>
              <strong>{ratioRole || 'current relation'}</strong>
              <span>tick {currentTick ?? '—'} / {currentTick12 ?? '—'}</span>
              <span>{reading.qlAddress}</span>
              <span>{reading.contextFrame ?? 'context frame inactive'}</span>
            </div>
            <AspectNode aspect={reading.resonance} summary={resonance} label="resonance" />
            <AspectNode aspect={reading.symbolic} summary={symbolic} label="symbol / time" wide />
          </div>

          <nav className="cosmic-depth" aria-label="Six deep Epi workspaces">
            {reading.deepWorkspaces.map((workspace) => (
              <button key={workspace.workspaceRef} type="button" onClick={() => void openWorkspace(workspace)}>
                <span>{workspace.coordinate}</span>
                <strong>{workspace.name}</strong>
              </button>
            ))}
          </nav>
        </>
      )}

      <footer className="cosmic-footer">
        <span>{message}</span>
        <span>{reading.profileRef}</span>
      </footer>

      <details className="cosmic-explain">
        <summary>Explain current state and readiness</summary>
        <div className="cosmic-explain__grid">
          <div>
            <strong>Identity</strong>
            <p>{reading.cosmicRef}</p>
            <p>{reading.profileRef}</p>
            <p>{reading.coordinateRef}</p>
          </div>
          <div>
            <strong>Formal binding actually used</strong>
            {acceptedQl.map((item) => <p key={item}>{item}</p>)}
            {notPromoted.map((item) => <p key={item}>not promoted · {item}</p>)}
          </div>
          <div>
            <strong>Readiness</strong>
            {reading.readiness.map((item) => (
              <p key={item.capabilityRef}><b>{item.status}</b> · {item.capabilityRef}<br />{item.detail}</p>
            ))}
          </div>
          <div>
            <strong>Aspect provenance</strong>
            {[reading.movement, reading.resonance, reading.symbolic].map((aspect) => (
              <p key={aspect.aspectRef}>{aspect.coordinate} {aspect.name} · {aspect.claimClass}<br />{aspect.operatorRefs.join(' · ')}</p>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function AspectNode({ aspect, summary, label, wide = false }: { aspect: CosmicAspect; summary: string[]; label: string; wide?: boolean }) {
  return (
    <article className={`cosmic-aspect${wide ? ' cosmic-aspect--wide' : ''}`} data-status={aspect.status}>
      <div className="cosmic-aspect__heading">
        <span>{aspect.coordinate}</span>
        <small>{label}</small>
      </div>
      <h2>{aspect.name}</h2>
      {summary.map((line) => <p key={line}>{line}</p>)}
      <small>{aspect.status} · {aspect.claimClass}</small>
    </article>
  );
}

function DeepWorkspace({ entry, reading, onBack }: { entry: DeepWorkspaceEntry; reading: CosmicCurrentReading; onBack: () => void }) {
  const aspect = entry.position === 1 ? reading.movement : entry.position === 2 ? reading.resonance : entry.position === 3 ? reading.symbolic : null;
  return (
    <article className="cosmic-workspace">
      <button type="button" onClick={onBack}>← Cosmic</button>
      <p className="oi-eyebrow">{entry.coordinate} · stable deep workspace entry</p>
      <h2>{entry.name}</h2>
      <p>{entry.workspaceRef}</p>
      {aspect ? (
        <>
          <p>{aspectSummary(aspect).join(' · ')}</p>
          <details>
            <summary>Sources and operators</summary>
            <p>{aspect.operatorRefs.join(' → ')}</p>
            <p>{aspect.semanticSources.join(' · ')}</p>
            <p>{aspect.implementationSources.join(' · ')}</p>
          </details>
        </>
      ) : (
        <p>This tranche establishes the addressable entry and keeps its current depth truthful; it does not fabricate a final {entry.coordinate} instrument here.</p>
      )}
    </article>
  );
}

function aspectSummary(aspect: CosmicAspect) {
  if (aspect.coordinate === "M1'") {
    const chromatic = objectField(aspect.data, 'chromatic');
    const diatonic = objectField(aspect.data, 'diatonic');
    return [
      `${stringField(aspect.data, 'helix') || '—'} · ${stringField(aspect.data, 'ratioRole') || '—'}`,
      `${stringField(chromatic, 'note') || '—'} ↔ ${stringField(chromatic, 'xPrimeNote') || '—'} · ${numberField(aspect.data, 'degree360') ?? '—'}°`,
      diatonic ? `diatonic ${stringField(diatonic, 'note') || stringField(diatonic, 'name') || 'active'}` : 'diatonic context not active',
    ];
  }
  if (aspect.coordinate === "M2'") {
    const lens = objectField(aspect.data, 'lensMode');
    const resonance72 = objectField(aspect.data, 'resonance72');
    return [
      `lens ${numberField(lens, 'lens') ?? '—'} · mode ${numberField(lens, 'mode') ?? '—'}`,
      `72-field anchor ${numberField(resonance72, 'lensAnchorIndex') ?? '—'}`,
      `form ${stringField(aspect.data, 'conjugateFormCharacter') || '—'} · numerical Vimarśā ready`,
    ];
  }
  const primitive = objectField(aspect.data, 'primitive');
  return [
    `codon ${stringField(primitive, 'codon') || '—'} · hexagram ${stringField(primitive, 'hexagram') || '—'}`,
    `address64 ${numberField(primitive, 'address64') ?? '—'}`,
    `${stringField(primitive, 'transcriptionState') || 'transcription unknown'} · ${stringField(primitive, 'datasetLutState') || 'dataset unknown'}`,
  ];
}

function objectField(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = (value as Record<string, unknown>)[key];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  return candidate as Record<string, unknown>;
}

function stringField(value: unknown, key?: string): string {
  const candidate = key && value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : value;
  return typeof candidate === 'string' ? candidate : '';
}

function numberField(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'number' ? candidate : null;
}

function stringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === 'string') : [];
}
