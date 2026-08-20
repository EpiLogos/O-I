import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { WorldPresentationRenderer, type WorldPresentation } from './world-presentation';
// @ts-ignore -- Surface-neutral application model owned outside the desktop renderer.
import { createExploreSurfaceModel } from '../../../shared-field/explore-surface.mjs';
import './explore-surface.css';

type Entry = {
  ref: string;
  kind: string;
  world_ref: string;
  label: string;
  summary?: string;
  revision?: string;
  provenance: Array<{ kind: string; ref: string; source_system: string; revision?: string }>;
};

type Edge = {
  from: string;
  to: string;
  relation: string;
  origin: string;
  direction?: string;
};

type Opened = {
  resource: Entry;
  relations: { focus: string; depth: number; budget: number; nodes: Entry[]; edges: Edge[]; truncated: boolean };
  world_presentation?: WorldPresentation;
  sources?: { ref: string; revision?: string };
};

type Model = {
  worlds(): Entry[];
  search(query?: string, options?: Record<string, unknown>): Entry[];
  open(ref: string, options?: Record<string, unknown>): Opened | undefined;
};

type Props = {
  seed: unknown | null;
  onSelect?: (entry: Entry) => void | Promise<void>;
};

type ViewMode = 'graph' | 'tree' | 'list';

function kindLabel(kind: string) {
  return kind.split(/[-_.]/g).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function relationLabel(relation: string) {
  return relation.split(/[/.]/g).filter(Boolean).at(-1)?.replaceAll('-', ' ') ?? relation;
}

function graphPositions(opened: Opened) {
  const width = 980;
  const height = 520;
  const cx = width / 2;
  const cy = height / 2;
  const focus = opened.relations.focus;
  const direct = new Set<string>();
  for (const edge of opened.relations.edges) {
    if (edge.from === focus) direct.add(edge.to);
    if (edge.to === focus) direct.add(edge.from);
  }
  const directRefs = [...direct].filter((ref) => ref !== focus);
  const outerRefs = opened.relations.nodes.map((node) => node.ref).filter((ref) => ref !== focus && !direct.has(ref));
  const positions = new Map<string, { x: number; y: number; tier: number }>();
  positions.set(focus, { x: cx, y: cy, tier: 0 });
  directRefs.forEach((ref, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(directRefs.length, 1);
    positions.set(ref, { x: cx + Math.cos(angle) * 300, y: cy + Math.sin(angle) * 155, tier: 1 });
  });
  outerRefs.forEach((ref, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(outerRefs.length, 1);
    positions.set(ref, { x: cx + Math.cos(angle) * 405, y: cy + Math.sin(angle) * 220, tier: 2 });
  });
  return { width, height, positions };
}

function DesktopGraph({ opened, onOpen }: { opened: Opened; onOpen: (ref: string) => void }) {
  const layout = useMemo(() => graphPositions(opened), [opened]);
  return <div className="desktop-explore__graph-shell">
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="desktop-explore__graph" role="img" aria-label="Bounded Explore relation graph">
      <defs><marker id="desktop-explore-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
      {opened.relations.edges.map((edge, index) => {
        const from = layout.positions.get(edge.from);
        const to = layout.positions.get(edge.to);
        if (!from || !to) return null;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return <g className="desktop-explore__edge" key={`${edge.from}:${edge.relation}:${edge.to}:${index}`}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#desktop-explore-arrow)" />
          <g transform={`translate(${mx} ${my})`}><rect x="-40" y="-8" width="80" height="16" rx="8" /><text textAnchor="middle" dominantBaseline="central">{relationLabel(edge.relation).slice(0, 14)}</text></g>
          <title>{edge.relation} · {edge.origin}</title>
        </g>;
      })}
      {opened.relations.nodes.map((node) => {
        const point = layout.positions.get(node.ref);
        if (!point) return null;
        const focus = node.ref === opened.relations.focus;
        const width = focus ? 196 : 156;
        const height = focus ? 68 : 54;
        return <g key={node.ref} className={`desktop-explore__node tier-${point.tier}${focus ? ' is-focus' : ''}`} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} onClick={() => onOpen(node.ref)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(node.ref); } }}>
          <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={focus ? 18 : 14} />
          <text className="desktop-explore__node-kind" textAnchor="middle" y={focus ? -9 : -7}>{kindLabel(node.kind)}</text>
          <text className="desktop-explore__node-label" textAnchor="middle" y={focus ? 13 : 11}>{node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}</text>
          <title>{node.ref}</title>
        </g>;
      })}
    </svg>
  </div>;
}

function DesktopTree({ opened, onOpen }: { opened: Opened; onOpen: (ref: string) => void }) {
  const focus = opened.relations.nodes.find((node) => node.ref === opened.relations.focus);
  return <div className="desktop-explore__tree"><strong>{focus?.label ?? opened.resource.label}</strong>{opened.relations.edges.filter((edge) => edge.from === opened.relations.focus || edge.to === opened.relations.focus).map((edge, index) => {
    const ref = edge.from === opened.relations.focus ? edge.to : edge.from;
    const node = opened.relations.nodes.find((candidate) => candidate.ref === ref);
    return node ? <button key={`${edge.relation}:${index}`} type="button" onClick={() => onOpen(ref)}><span>{relationLabel(edge.relation)}</span><strong>{node.label}</strong><small>{edge.origin}</small></button> : null;
  })}</div>;
}

function DesktopList({ opened, onOpen }: { opened: Opened; onOpen: (ref: string) => void }) {
  return <div className="desktop-explore__list">{opened.relations.nodes.map((node) => <button key={node.ref} type="button" className={node.ref === opened.relations.focus ? 'is-focus' : ''} onClick={() => onOpen(node.ref)}><span>{kindLabel(node.kind)}</span><strong>{node.label}</strong><small>{node.summary ?? node.ref}</small></button>)}</div>;
}

export function ExploreSurface({ seed, onSelect }: Props) {
  const model = useMemo<Model | null>(() => {
    if (!seed) return null;
    try { return createExploreSurfaceModel(seed) as Model; } catch { return null; }
  }, [seed]);
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [navigatorWidth, setNavigatorWidth] = useState(240);

  useEffect(() => {
    if (!model) { setSelectedRef(null); return; }
    const first = model.worlds()[0] ?? model.search('', { limit: 1 })[0];
    setSelectedRef((current) => current ?? first?.ref ?? null);
  }, [model]);

  const results = useMemo(() => {
    if (!model) return [];
    return query.trim() ? model.search(query, { limit: 36 }) : model.worlds();
  }, [model, query]);
  const opened = model && selectedRef ? model.open(selectedRef, { depth, budget: depth === 1 ? 18 : 32 }) : undefined;
  const presentation = opened && opened.resource.ref === opened.resource.world_ref ? opened.world_presentation : undefined;

  async function openRef(ref: string) {
    if (!model) return;
    const next = model.open(ref, { depth, budget: depth === 1 ? 18 : 32 });
    if (!next) return;
    setSelectedRef(ref);
    await onSelect?.(next.resource);
  }

  if (!seed) return <section className="desktop-explore desktop-explore--empty"><p className="oi-eyebrow">Explore</p><h2>No local projected field is bound.</h2><p>Configure a local Explore projection provider to search and traverse real worlds here. The desktop does not substitute fixtures or invented public content.</p></section>;
  if (!model) return <section className="desktop-explore desktop-explore--empty"><p className="oi-eyebrow">Explore</p><h2>The projected field could not be read.</h2><p>The provider payload failed the shared Explore Surface contract. No fallback ontology has been created.</p></section>;

  const style = { '--desktop-explore-nav': `${navigatorWidth}px` } as CSSProperties;
  return <section className="desktop-explore" aria-label="O:I Explore" style={style}>
    <header className="desktop-explore__searchbar">
      <label><span>Search the field</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="World, agent, project, wiki, ref…" autoComplete="off" /></label>
      <button type="button" className="desktop-explore__pane-toggle" aria-expanded={navigatorOpen} onClick={() => setNavigatorOpen((value) => !value)}>Navigator</button>
      <div className="desktop-explore__view-controls" role="group" aria-label="Explore relation view">{(['graph', 'tree', 'list'] as ViewMode[]).map((mode) => <button type="button" key={mode} aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}>{mode}</button>)}</div>
      <div className="desktop-explore__view-controls" role="group" aria-label="Explore relation depth"><button type="button" aria-pressed={depth === 1} onClick={() => setDepth(1)}>Near</button><button type="button" aria-pressed={depth === 2} onClick={() => setDepth(2)}>Wider</button></div>
    </header>

    <div className={navigatorOpen ? 'desktop-explore__body' : 'desktop-explore__body desktop-explore__body--full'}>
      {navigatorOpen ? <aside className="desktop-explore__results"><span className="oi-eyebrow">{query.trim() ? 'Results' : 'Worlds'}</span>{results.map((entry) => <button key={entry.ref} type="button" className={entry.ref === selectedRef ? 'is-selected' : ''} onClick={() => openRef(entry.ref)}><span>{kindLabel(entry.kind)}</span><strong>{entry.label}</strong><small>{entry.summary ?? entry.ref}</small></button>)}<label className="desktop-explore__resize"><span>Width</span><input type="range" min="210" max="390" value={navigatorWidth} onChange={(event) => setNavigatorWidth(Number(event.target.value))} /></label></aside> : null}
      <div className="desktop-explore__encounter">
        {!opened ? <div className="desktop-explore__no-result"><h2>No projected object is open.</h2></div> : <>
          <header className="desktop-explore__focus"><span className="oi-eyebrow">Local whole</span><h2>{opened.resource.label}</h2><p>{opened.resource.summary}</p><small>{opened.resource.ref}</small></header>
          {viewMode === 'graph' ? <DesktopGraph opened={opened} onOpen={openRef} /> : null}
          {viewMode === 'tree' ? <DesktopTree opened={opened} onOpen={openRef} /> : null}
          {viewMode === 'list' ? <DesktopList opened={opened} onOpen={openRef} /> : null}
          {presentation ? <div className="desktop-explore__presentation"><WorldPresentationRenderer presentation={presentation} onOpenRef={openRef} /></div> : <article className="desktop-explore__reading"><span className="oi-eyebrow">{kindLabel(opened.resource.kind)}</span><h3>{opened.resource.label}</h3><p>{opened.resource.summary ?? 'No fuller projected reading is currently supplied for this object.'}</p><dl><dt>Source</dt><dd>{opened.sources?.ref ?? opened.resource.ref}</dd><dt>Revision</dt><dd>{opened.sources?.revision ?? opened.resource.revision ?? 'not disclosed'}</dd></dl></article>}
        </>}
      </div>
    </div>
  </section>;
}
