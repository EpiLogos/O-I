import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExploreSurface } from './ExploreSurface';
import type { WorkbenchEvidence, WorkbenchSemanticRef } from './workbench';
import './explore-workbench.css';

type ExploreEntry = {
  ref: string;
  kind: string;
  world_ref: string;
  label: string;
  revision?: string;
  provenance: Array<{ kind: string; ref: string; source_system: string; revision?: string }>;
};

type ExploreOpened = {
  resource: ExploreEntry;
  world_presentation_projection?: {
    projection_ref: string;
    projection_revision: number;
    state: string;
    audience: { visibility: string };
    source: { system: string; revision: string };
  };
  explain?: unknown;
  sources?: unknown;
};

export function ExploreWorkbenchSurface({
  onSelect,
}: {
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
}) {
  const [seed, setSeed] = useState<unknown | null>(null);
  const [providerState, setProviderState] = useState<'loading' | 'ready' | 'unbound' | 'degraded'>('loading');

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setProviderState('loading');
    try {
      const next = await invoke<unknown | null>('explore_surface_seed');
      setSeed(next);
      setProviderState(next ? 'ready' : 'unbound');
    } catch {
      setSeed(null);
      setProviderState('degraded');
    }
  }

  async function select(entry: ExploreEntry, opened: ExploreOpened) {
    const provenance = entry.provenance[0];
    const subject: WorkbenchSemanticRef = {
      ref: entry.ref,
      kind: entry.kind,
      native_owner: 'oi-explore',
      provenance: {
        source: provenance?.source_system ?? 'oi-explore',
        ...((provenance?.revision ?? entry.revision) ? { revision: provenance?.revision ?? entry.revision } : {}),
      },
    };
    const projection = opened.world_presentation_projection;
    await onSelect(subject, {
      title: entry.label,
      summary: projection
        ? `Explore reading of ${entry.ref} through ${projection.projection_ref} revision ${projection.projection_revision}.`
        : `Explore reading of ${entry.ref}; no WorldPresentation Projection is disclosed for this object.`,
      detail: {
        world_ref: entry.world_ref,
        projection: projection ?? null,
        sources: opened.sources ?? null,
        explain: opened.explain ?? null,
        privacy: 'selection != Agent Context disclosure != Projection selection != SharedField admission != public != remote Agent authority',
      },
    });
  }

  return <>
    <div className="desktop-explore__provider-bar" data-state={providerState}>
      <span>Explore application · shared renderer-neutral model</span>
      <span>{providerState === 'ready' ? 'projected field bound' : providerState === 'loading' ? 'reading provider…' : providerState === 'unbound' ? 'no local projected field bound' : 'provider degraded'}</span>
      <button type="button" onClick={() => void refresh()}>Refresh field</button>
    </div>
    <ExploreSurface seed={seed} onSelect={select} />
  </>;
}
