import { useMemo, useState } from 'react';
// @ts-ignore -- pure deterministic Surface projection over the canonical relation read model.
import { buildRelationLayout } from './relation-layout.mjs';
import './relation-field.css';

export type RelationNode = {
  ref: string;
  kind: string;
  label: string;
  summary?: string;
  world_ref?: string;
};

export type RelationEdge = {
  from: string;
  to: string;
  relation: string;
  origin: string;
  direction?: string;
  provenance?: Array<Record<string, unknown>>;
};

export type RelationView = {
  focus: string;
  depth: number;
  budget: number;
  nodes: RelationNode[];
  edges: RelationEdge[];
  truncated: boolean;
};

type FieldMode = 'list' | 'tree' | 'graph';

type RelationFieldProps = {
  view: RelationView;
  mode: FieldMode;
  onModeChange: (mode: FieldMode) => void;
  onOpen: (ref: string) => void;
  onDepthChange: (depth: 1 | 2) => void;
};

function kindLabel(kind: string) {
  return kind.split(/[-_.]/g).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function relationLabel(relation: string) {
  const parts = relation.split(/[/.]/g).filter(Boolean);
  return parts.at(-1)?.replaceAll('-', ' ') ?? relation;
}

function shortLabel(label: string, max = 25) {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function activationProps(ref: string, onOpen: (ref: string) => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: () => onOpen(ref),
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(ref);
      }
    },
  };
}

function GraphView({ view, onOpen }: { view: RelationView; onOpen: (ref: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const layout = useMemo(() => buildRelationLayout(view), [view]);
  const visibleWidth = layout.width / zoom;
  const visibleHeight = layout.height / zoom;
  const viewBoxX = (layout.width - visibleWidth) / 2;
  const viewBoxY = (layout.height - visibleHeight) / 2;
  const origins = useMemo(() => [...new Set(view.edges.map((edge) => edge.origin))].sort(), [view.edges]);

  return <div className="relation-graph-shell">
    <div className="relation-graph-toolbar" aria-label="Graph controls">
      <span>{view.nodes.length} nodes · {view.edges.length} relations{view.truncated ? ' · bounded' : ''}</span>
      <div>
        <button type="button" onClick={() => setZoom((value) => Math.max(.8, Number((value - .15).toFixed(2))))} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Reset graph zoom">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => setZoom((value) => Math.min(1.75, Number((value + .15).toFixed(2))))} aria-label="Zoom in">+</button>
      </div>
    </div>
    <svg
      className="relation-graph"
      viewBox={`${viewBoxX} ${viewBoxY} ${visibleWidth} ${visibleHeight}`}
      role="img"
      aria-label="Bounded typed relation graph. Select any node to recenter Explore around it."
    >
      <defs>
        <marker id="relation-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      <g className="relation-graph__edges">
        {layout.edges.map((edge: RelationEdge & { path: string; label_x: number; label_y: number }, index: number) => {
          const active = hovered && (edge.from === hovered || edge.to === hovered);
          return <g key={`${edge.from}:${edge.relation}:${edge.to}:${index}`} className={active ? 'relation-edge is-active' : 'relation-edge'}>
            <path d={edge.path} markerEnd={edge.direction === 'reverse' ? undefined : 'url(#relation-arrow)'} />
            <g transform={`translate(${edge.label_x} ${edge.label_y})`}>
              <rect x="-46" y="-9" width="92" height="18" rx="9" />
              <text textAnchor="middle" dominantBaseline="central">{shortLabel(relationLabel(edge.relation), 16)}</text>
            </g>
            <title>{edge.relation} · {edge.origin}</title>
          </g>;
        })}
      </g>
      <g className="relation-graph__nodes">
        {layout.nodes.map((node: RelationNode & { x: number; y: number; tier: number; focus: boolean }) => {
          const width = node.focus ? 210 : 174;
          const height = node.focus ? 76 : 62;
          const active = hovered === node.ref;
          return <g
            key={node.ref}
            className={`relation-node relation-node--tier-${node.tier}${node.focus ? ' is-focus' : ''}${active ? ' is-hovered' : ''}`}
            transform={`translate(${node.x} ${node.y})`}
            onMouseEnter={() => setHovered(node.ref)}
            onMouseLeave={() => setHovered(null)}
            {...activationProps(node.ref, onOpen)}
          >
            <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={node.focus ? 20 : 16} />
            <text className="relation-node__kind" textAnchor="middle" y={node.focus ? -11 : -8}>{kindLabel(node.kind)}</text>
            <text className="relation-node__label" textAnchor="middle" y={node.focus ? 13 : 11}>{shortLabel(node.label, node.focus ? 28 : 22)}</text>
            <title>{node.label} · {node.ref}</title>
          </g>;
        })}
      </g>
    </svg>
    {origins.length ? <div className="relation-graph-legend" aria-label="Relation origins">{origins.map((origin) => <span key={origin}>{origin}</span>)}</div> : null}
  </div>;
}

function ListView({ view, onOpen }: { view: RelationView; onOpen: (ref: string) => void }) {
  return <div className="relation-list">{view.nodes.map((node) => <button key={node.ref} type="button" className={node.ref === view.focus ? 'is-focus' : ''} onClick={() => onOpen(node.ref)}><span>{kindLabel(node.kind)}</span><strong>{node.label}</strong><small>{node.summary ?? node.ref}</small></button>)}</div>;
}

function TreeView({ view, onOpen }: { view: RelationView; onOpen: (ref: string) => void }) {
  const focus = view.nodes.find((node) => node.ref === view.focus);
  const direct = view.edges.filter((edge) => edge.from === view.focus || edge.to === view.focus);
  return <div className="relation-tree">
    <button type="button" className="relation-tree__focus" onClick={() => onOpen(view.focus)}><span>{focus ? kindLabel(focus.kind) : 'Focus'}</span><strong>{focus?.label ?? view.focus}</strong></button>
    <div className="relation-tree__branches">{direct.map((edge, index) => {
      const ref = edge.from === view.focus ? edge.to : edge.from;
      const node = view.nodes.find((candidate) => candidate.ref === ref);
      if (!node) return null;
      return <button type="button" key={`${edge.relation}:${ref}:${index}`} onClick={() => onOpen(ref)}><span>{relationLabel(edge.relation)}</span><strong>{node.label}</strong><small>{edge.origin}</small></button>;
    })}</div>
  </div>;
}

export function RelationField({ view, mode, onModeChange, onOpen, onDepthChange }: RelationFieldProps) {
  const focus = view.nodes.find((node) => node.ref === view.focus);
  return <section className="relation-field" aria-label="Explore local whole">
    <header className="relation-field__header">
      <div>
        <span className="relation-field__eyebrow">Local whole</span>
        <h1>{focus?.label ?? view.focus}</h1>
        <p>{focus?.summary ?? 'Addressable object and its bounded typed neighbourhood.'}</p>
      </div>
      <div className="relation-field__controls">
        <div role="group" aria-label="Relation presentation">{(['graph', 'tree', 'list'] as FieldMode[]).map((candidate) => <button key={candidate} type="button" aria-pressed={mode === candidate} onClick={() => onModeChange(candidate)}>{candidate}</button>)}</div>
        <div role="group" aria-label="Relation depth"><button type="button" aria-pressed={view.depth === 1} onClick={() => onDepthChange(1)}>Near</button><button type="button" aria-pressed={view.depth === 2} onClick={() => onDepthChange(2)}>Wider</button></div>
      </div>
    </header>
    {mode === 'graph' ? <GraphView view={view} onOpen={onOpen} /> : null}
    {mode === 'tree' ? <TreeView view={view} onOpen={onOpen} /> : null}
    {mode === 'list' ? <ListView view={view} onOpen={onOpen} /> : null}
  </section>;
}
