import { useEffect, useMemo, useState } from 'react';
import { OIGlyph } from '@/components/ui/oi-mark';
import {
  WorldPresentationRenderer,
  portablePresentationRenderers,
  type WorldPresentation,
  type PresentationBinding,
} from '@/explore/presentation-components';
// @ts-ignore -- application boundary over canonical shared-field contracts.
import { createExploreBrowserModel } from '../explore-read-model.mjs';
// @ts-ignore -- shared application operations are intentionally language-neutral JS.
import { applyPresentationAuthoringOperation, authoringDisclosure, bindingAvailability, normalizeContributionField } from '../../shared-field/presentation-authoring.mjs';
// @ts-ignore -- canonical Projection refinement operation.
import { refineWorldPresentationProjection } from '../../shared-field/presentation-projection.mjs';

type ExploreEntry = {
  ref: string;
  kind: string;
  world_ref: string;
  label: string;
  summary?: string;
  revision?: string;
  provenance: Array<{ kind: string; ref: string; source_system: string; revision?: string }>;
};

type ExploreOpen = {
  resource: ExploreEntry;
  world?: ExploreEntry;
  world_presentation?: WorldPresentation;
  world_presentation_projection?: Record<string, any>;
  relations: { nodes: ExploreEntry[]; edges: Array<{ from: string; to: string; relation: string; origin: string }>; truncated: boolean };
  sources?: { ref: string; revision?: string; provenance: ExploreEntry['provenance'] };
  actions: string[];
};

type ExploreModel = {
  worlds(): ExploreEntry[];
  search(query?: string, options?: Record<string, unknown>): ExploreEntry[];
  open(ref: string, options?: Record<string, unknown>): ExploreOpen | undefined;
};

type Contribution = {
  contribution_ref: string;
  component_ref: string;
  surface_ref?: string;
  portable_renderer?: string;
  label: string;
  available: boolean;
  degraded: boolean;
  reason?: string;
  action_refs: string[];
  default_props: Record<string, unknown>;
  fallback: Record<string, unknown>;
  provenance: Array<Record<string, unknown>>;
};

type FieldMode = 'list' | 'tree' | 'graph';
type PageMode = 'read' | 'author' | 'preview';

function kindLabel(kind: string) {
  return kind.split(/[-_.]/g).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function contributionsFromPresentation(presentation?: WorldPresentation): Contribution[] {
  if (!presentation) return [];
  const seen = new Set<string>();
  const result: Contribution[] = [];
  for (const region of presentation.regions) {
    for (const binding of region.bindings) {
      const contributionRef = binding.contribution_ref ?? `bound:${binding.component_ref}`;
      if (seen.has(contributionRef)) continue;
      seen.add(contributionRef);
      result.push({
        contribution_ref: contributionRef,
        component_ref: binding.component_ref,
        ...(binding.surface_ref ? { surface_ref: binding.surface_ref } : {}),
        ...(binding.portable_renderer ? { portable_renderer: binding.portable_renderer } : {}),
        label: String(binding.fallback.title ?? binding.props.title ?? binding.component_ref),
        available: true,
        degraded: false,
        action_refs: [],
        default_props: clone(binding.props),
        fallback: clone(binding.fallback),
        provenance: clone(binding.provenance),
      });
    }
  }
  return result;
}

function provenanceText(value: Array<Record<string, unknown>> | undefined) {
  if (!value?.length) return 'No provenance disclosed';
  return value.map((item) => [item.source_system, item.ref, item.revision].filter(Boolean).join(' · ')).join('\n');
}

function RelationReading({ opened, mode, onOpen }: { opened: ExploreOpen; mode: FieldMode; onOpen: (ref: string) => void }) {
  if (mode === 'list') {
    return <div className="direct-relations">{opened.relations.nodes.map((node) => <button key={node.ref} onClick={() => onOpen(node.ref)}><span>{kindLabel(node.kind)}</span><strong>{node.label}</strong><small>{node.ref}</small></button>)}</div>;
  }
  if (mode === 'tree') {
    return <div className="direct-tree"><strong>{opened.resource.label}</strong>{opened.relations.edges.filter((edge) => edge.from === opened.resource.ref || edge.to === opened.resource.ref).map((edge, index) => {
      const ref = edge.from === opened.resource.ref ? edge.to : edge.from;
      const node = opened.relations.nodes.find((candidate) => candidate.ref === ref);
      return node ? <button key={`${edge.relation}:${index}`} onClick={() => onOpen(ref)}><span>{edge.relation}</span><strong>{node.label}</strong></button> : null;
    })}</div>;
  }
  return <div className="direct-graph" aria-label="Bounded relation presentation">{opened.relations.nodes.slice(0, 12).map((node) => <button key={node.ref} className={node.ref === opened.resource.ref ? 'is-focus' : ''} onClick={() => onOpen(node.ref)}><span>{kindLabel(node.kind)}</span><strong>{node.label}</strong></button>)}</div>;
}

function Inspector({
  opened,
  presentation,
  selectedBindingRef,
  selectedRegionRef,
  contributions,
  dirty,
}: {
  opened?: ExploreOpen;
  presentation?: WorldPresentation;
  selectedBindingRef: string | null;
  selectedRegionRef: string | null;
  contributions: Contribution[];
  dirty: boolean;
}) {
  if (!opened) return <div className="direct-inspector-empty">Select an addressable object to inspect it.</div>;
  const disclosure = presentation ? authoringDisclosure({
    presentation,
    projection_ref: opened.world_presentation_projection?.projection_ref ?? null,
    source_ref: opened.sources?.ref ?? opened.resource.ref,
    source_revision: opened.sources?.revision ?? opened.resource.revision ?? null,
    selected_binding_ref: selectedBindingRef,
    selected_region_ref: selectedBindingRef ? null : selectedRegionRef,
    contributions,
    mode: 'author',
    dirty,
  }) : null;
  const availability = presentation ? bindingAvailability(presentation, contributions, portablePresentationRenderers) : [];
  const selectedAvailability = selectedBindingRef ? availability.find((item: any) => item.binding_ref === selectedBindingRef) : null;
  return (
    <div className="direct-inspector-body">
      <div className="direct-eyebrow">Context</div>
      <h2>{opened.resource.label}</h2>
      <dl>
        <dt>Ref</dt><dd><code>{opened.resource.ref}</code></dd>
        <dt>World</dt><dd><code>{opened.resource.world_ref}</code></dd>
        {presentation ? <><dt>Presentation</dt><dd><code>{presentation.presentation_ref}</code></dd><dt>Revision</dt><dd>{presentation.revision}</dd></> : null}
      </dl>
      {disclosure?.selected ? <section><div className="direct-eyebrow">Selection</div><pre>{JSON.stringify(disclosure.selected, null, 2)}</pre></section> : null}
      {selectedAvailability ? <section><div className="direct-eyebrow">Availability</div><p>{selectedAvailability.renderer_available ? 'Renderer available' : 'Renderer fallback'}</p>{selectedAvailability.reason ? <small>{selectedAvailability.reason}</small> : null}</section> : null}
      <section><div className="direct-eyebrow">Provenance</div><pre>{presentation ? provenanceText(presentation.provenance) : provenanceText(opened.resource.provenance as any)}</pre></section>
      {disclosure ? <section><div className="direct-eyebrow">Agent-visible operations</div><div className="direct-chips">{disclosure.operations.map((operation: string) => <span key={operation}>{operation}</span>)}</div></section> : null}
    </div>
  );
}

export default function DirectExploreApp() {
  const [model, setModel] = useState<ExploreModel | null>(null);
  const [seedContributions, setSeedContributions] = useState<Contribution[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [fieldMode, setFieldMode] = useState<FieldMode>('graph');
  const [pageMode, setPageMode] = useState<PageMode>('read');
  const [showRelations, setShowRelations] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [working, setWorking] = useState<WorldPresentation | undefined>();
  const [workingFor, setWorkingFor] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedBindingRef, setSelectedBindingRef] = useState<string | null>(null);
  const [selectedRegionRef, setSelectedRegionRef] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState<{ regionRef: string; index: number } | null>(null);
  const [preparedRevision, setPreparedRevision] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/explore-public.json`)
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then((seed) => {
        const next = createExploreBrowserModel(seed) as ExploreModel;
        setModel(next);
        setSeedContributions(normalizeContributionField(seed.composition_contributions ?? []) as Contribution[]);
        const first = next.worlds()[0] ?? next.search('', { limit: 1 })[0];
        if (first) setSelectedRef(first.ref);
      })
      .catch(() => setFailed(true));
  }, []);

  const results = useMemo(() => model?.search(query, { limit: 64 }) ?? [], [model, query]);
  const opened = model && selectedRef ? model.open(selectedRef, { depth: 1, budget: 18 }) : undefined;
  const canonicalPresentation = opened?.resource.ref === opened?.resource.world_ref ? opened?.world_presentation : undefined;

  useEffect(() => {
    const presentationRef = canonicalPresentation?.presentation_ref ?? null;
    if (!canonicalPresentation || workingFor === presentationRef) return;
    setWorking(clone(canonicalPresentation));
    setWorkingFor(presentationRef);
    setDirty(false);
    setPreparedRevision(null);
    setSelectedBindingRef(null);
    setSelectedRegionRef(null);
  }, [canonicalPresentation, workingFor]);

  const presentation = workingFor === canonicalPresentation?.presentation_ref ? working : canonicalPresentation;
  const contributions = useMemo(() => {
    const combined = [...seedContributions, ...contributionsFromPresentation(presentation)];
    const seen = new Set<string>();
    return combined.filter((item) => !seen.has(item.contribution_ref) && seen.add(item.contribution_ref));
  }, [presentation, seedContributions]);

  function openRef(ref: string) {
    setSelectedRef(ref);
    setPageMode('read');
    setShowRelations(false);
    setRightOpen(false);
    setPreparedRevision(null);
  }

  function operate(operation: Record<string, unknown>) {
    if (!presentation) return;
    const next = applyPresentationAuthoringOperation(presentation, operation, contributions) as WorldPresentation;
    setWorking(next);
    setWorkingFor(next.presentation_ref);
    setDirty(true);
    setPreparedRevision(null);
  }

  function enterAuthor() {
    if (!canonicalPresentation) return;
    setWorking(clone(canonicalPresentation));
    setWorkingFor(canonicalPresentation.presentation_ref);
    setPageMode('author');
    setRightOpen(true);
    setShowRelations(false);
  }

  function saveWorkingState() {
    if (!presentation) return;
    localStorage.setItem(`oi.explore.working-presentation:${presentation.presentation_ref}`, JSON.stringify(presentation));
  }

  function prepareProjectionRevision() {
    if (!presentation || !opened?.world_presentation_projection) return;
    const previous = opened.world_presentation_projection;
    const editor = { participant_ref: 'participant:current-author', actor: { kind: 'human', ref: 'human:current-author' } };
    const next = refineWorldPresentationProjection(previous, presentation, { editor, note: 'Direct Explore authoring refinement' });
    setPreparedRevision(next);
  }

  const pageDominant = !leftOpen && !rightOpen;

  return (
    <div className="direct-explore oi-surface-light" style={{ '--direct-left': `${leftWidth}px`, '--direct-right': `${rightWidth}px` } as React.CSSProperties}>
      <header className="direct-topbar">
        <a href="./index.html" className="direct-mark" aria-label="O:I home"><OIGlyph /></a>
        <div className="direct-mode-switch" role="group" aria-label="Explore page mode">
          <button aria-pressed={pageMode === 'read'} onClick={() => setPageMode('read')}>Read</button>
          <button aria-pressed={pageMode === 'author'} disabled={!canonicalPresentation} onClick={enterAuthor}>Author</button>
          <button aria-pressed={pageMode === 'preview'} disabled={!presentation} onClick={() => setPageMode('preview')}>Preview</button>
        </div>
        <div className="direct-top-actions">
          <button onClick={() => setLeftOpen((value) => !value)} aria-expanded={leftOpen}>Navigator</button>
          <button onClick={() => setRightOpen((value) => !value)} aria-expanded={rightOpen}>Inspect</button>
          {pageMode === 'author' && <button onClick={saveWorkingState} disabled={!dirty}>Save working state</button>}
          {pageMode === 'author' && <button onClick={prepareProjectionRevision} disabled={!dirty || !opened?.world_presentation_projection}>Refine Projection</button>}
        </div>
      </header>

      <div className={pageDominant ? 'direct-workspace direct-workspace--full' : 'direct-workspace'}>
        {leftOpen ? <aside className="direct-navigator">
          <div className="direct-pane-head"><strong>Explore</strong><button onClick={() => setLeftOpen(false)}>×</button></div>
          <label className="direct-search"><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="World, agent, project, wiki, ref…" /></label>
          <div className="direct-results">{results.map((result) => <button key={result.ref} className={result.ref === selectedRef ? 'is-selected' : ''} onClick={() => openRef(result.ref)}><span>{kindLabel(result.kind)}</span><strong>{result.label}</strong><small>{result.summary ?? result.ref}</small></button>)}</div>
          <label className="direct-resize"><span>Width</span><input type="range" min="220" max="460" value={leftWidth} onChange={(event) => setLeftWidth(Number(event.target.value))} /></label>
        </aside> : null}

        <main className="direct-canvas" aria-label="Authored Explore canvas">
          {failed ? <div className="direct-empty"><strong>Explore provider unavailable.</strong><p>The application Surface remains intact but no public field can be read.</p></div> : null}
          {!failed && !opened ? <div className="direct-empty"><strong>No authored Projection is open.</strong><p>Explore does not substitute demo personalities or invented worlds. Open a projected world when one is available.</p></div> : null}
          {opened ? <>
            {!presentation ? <section className="direct-object-reading"><div className="direct-eyebrow">{kindLabel(opened.resource.kind)}</div><h1>{opened.resource.label}</h1><p>{opened.resource.summary}</p><code>{opened.resource.ref}</code></section> : null}
            {presentation ? <WorldPresentationRenderer
              presentation={presentation}
              onOpenRef={openRef}
              authoring={pageMode === 'author'}
              selectedBindingRef={selectedBindingRef}
              selectedRegionRef={selectedRegionRef}
              onSelectBinding={(bindingRef, regionRef) => { setSelectedBindingRef(bindingRef); setSelectedRegionRef(regionRef); setRightOpen(true); }}
              onSelectRegion={(regionRef) => { setSelectedRegionRef(regionRef); setSelectedBindingRef(null); setRightOpen(true); }}
              onEditProps={(bindingRef, patch) => operate({ type: 'edit-binding-props', binding_ref: bindingRef, patch })}
              onInsert={(regionRef, index) => setInsertTarget({ regionRef, index })}
              onMoveBinding={(bindingRef, regionRef, index) => operate({ type: 'move-binding', binding_ref: bindingRef, to_region_ref: regionRef, index })}
              onDuplicateBinding={(bindingRef) => operate({ type: 'duplicate-binding', binding_ref: bindingRef })}
              onRemoveBinding={(bindingRef) => { operate({ type: 'remove-binding', binding_ref: bindingRef }); setSelectedBindingRef(null); }}
            /> : null}
            {pageMode !== 'preview' ? <div className="direct-relations-toggle"><button onClick={() => setShowRelations((value) => !value)} aria-expanded={showRelations}>{showRelations ? 'Hide relations' : 'Relations'}</button><div role="group" aria-label="Relation view">{(['list', 'tree', 'graph'] as FieldMode[]).map((mode) => <button key={mode} aria-pressed={fieldMode === mode} onClick={() => { setFieldMode(mode); setShowRelations(true); }}>{mode}</button>)}</div></div> : null}
            {showRelations && pageMode !== 'preview' ? <RelationReading opened={opened} mode={fieldMode} onOpen={openRef} /> : null}
          </> : null}
        </main>

        {rightOpen && pageMode !== 'preview' ? <aside className="direct-inspector">
          <div className="direct-pane-head"><strong>Inspector</strong><button onClick={() => setRightOpen(false)}>×</button></div>
          <Inspector opened={opened} presentation={presentation} selectedBindingRef={selectedBindingRef} selectedRegionRef={selectedRegionRef} contributions={contributions} dirty={dirty} />
          <label className="direct-resize"><span>Width</span><input type="range" min="260" max="520" value={rightWidth} onChange={(event) => setRightWidth(Number(event.target.value))} /></label>
        </aside> : null}
      </div>

      {insertTarget && pageMode === 'author' ? <div className="direct-popover-backdrop" onClick={() => setInsertTarget(null)}><section className="direct-insert-popover" onClick={(event) => event.stopPropagation()} aria-label="Insert native contribution"><div className="direct-pane-head"><strong>Insert contribution</strong><button onClick={() => setInsertTarget(null)}>×</button></div>{contributions.length ? contributions.map((contribution) => <button key={contribution.contribution_ref} disabled={!contribution.available} onClick={() => { operate({ type: 'insert-contribution', region_ref: insertTarget.regionRef, index: insertTarget.index, contribution_ref: contribution.contribution_ref }); setInsertTarget(null); }}><span>{contribution.label}</span><code>{contribution.contribution_ref}</code><small>{contribution.available ? contribution.surface_ref ?? contribution.component_ref : contribution.reason ?? 'Unavailable'}</small></button>) : <p>No compatible contributions are disclosed by the operative field.</p>}</section></div> : null}

      {preparedRevision ? <div className="direct-revision-receipt" role="status"><strong>Projection revision prepared through canonical refinement.</strong><span>Source authority/revision are preserved. This static browser Surface has not claimed publication.</span><code>{String((preparedRevision as any).projection_ref)}@{String((preparedRevision as any).projection_revision)}</code></div> : null}
    </div>
  );
}
