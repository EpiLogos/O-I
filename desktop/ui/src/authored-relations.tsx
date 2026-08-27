import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type WorkbenchEvidence, type WorkbenchSemanticRef } from './workbench-native';
import './authored-relations.css';

type RelationNode = {
  resource: string;
  kind: string;
  label: string;
};

type RelationView = {
  query: { focus: string };
  nodes: RelationNode[];
  edges: Array<{ from: string; to: string; relation: string; direction: string; origin: unknown }>;
  truncated: boolean;
  warnings: string[];
};

type AuthoredAnchor = {
  start_byte?: number;
  end_byte?: number;
  field_path?: string;
};

type AuthoredEvidence = {
  source_ref: string;
  source_revision?: string;
  relation: string;
  raw_target: string;
  raw_token: string;
  display?: string;
  fragment?: string;
  channel: 'body' | 'metadata' | string;
  anchor: AuthoredAnchor;
  resolution: { state: string; target_ref?: string; candidate_refs?: string[] };
};

type AuthoredEdge = {
  ref: string;
  revision: number;
  from_ref: string;
  to_ref: string;
  relation: string;
  origin: string;
  provenance: Array<{
    source_ref: string;
    source_revision?: unknown;
    channel?: string;
    anchor?: AuthoredAnchor;
    raw_target?: string;
    source_authority?: string;
  }>;
  authored_relation?: AuthoredEvidence;
};

type PendingAuthoredRelation = {
  subject_ref: string;
  source_authority: string;
  evidence: AuthoredEvidence;
};

type AuthoredSubjectRelations = {
  version: string;
  subject_ref: string;
  resolved: RelationView;
  pending: PendingAuthoredRelation[];
  automatic_agent_or_model_invocation: boolean;
};

type ProjectSourceRelations = {
  authored?: AuthoredSubjectRelations;
  authored_edges?: AuthoredEdge[];
  [key: string]: unknown;
};

export function AuthoredRelationsWorkbench({
  selection,
  onSelect,
}: {
  selection?: WorkbenchSemanticRef;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
}) {
  const [reading, setReading] = useState<ProjectSourceRelations | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    if (!selection) {
      setReading(null);
      setError('');
      return () => { current = false; };
    }
    setBusy(true);
    void invoke<unknown>('knowledge_relations', {
      resourceRef: selection.ref,
      depth: 1,
      maxNodes: 96,
      maxEdges: 192,
    }).then((value) => {
      if (!current) return;
      setReading(isProjectSourceRelations(value) ? value : null);
      setError('');
    }).catch((reason) => {
      if (!current) return;
      setReading(null);
      setError(messageFrom(reason));
    }).finally(() => {
      if (current) setBusy(false);
    });
    return () => { current = false; };
  }, [selection?.ref]);

  const authored = reading?.authored;
  const focus = authored?.subject_ref;
  const edges = reading?.authored_edges ?? [];
  const outgoing = useMemo(() => focus ? edges.filter((edge) => edge.from_ref === focus) : [], [edges, focus]);
  const incoming = useMemo(() => focus ? edges.filter((edge) => edge.to_ref === focus) : [], [edges, focus]);
  const nodes = useMemo(() => new Map((authored?.resolved.nodes ?? []).map((node) => [node.resource, node])), [authored]);

  async function follow(edge: AuthoredEdge) {
    if (!focus) return;
    const target = edge.from_ref === focus ? edge.to_ref : edge.from_ref;
    const node = nodes.get(target);
    const evidence = edge.authored_relation ?? provenanceEvidence(edge);
    await onSelect({
      ref: target,
      kind: node?.kind ?? 'knowledge-relation',
      native_owner: 'ai-kit',
      provenance: {
        source: `AIKit authored relation ${edge.ref}`,
        revision: sourceRevision(edge),
      },
    }, {
      title: node?.label ?? evidence?.display ?? evidence?.raw_target ?? target,
      summary: `${edge.relation} · ${edge.origin} · ${evidence?.channel ?? 'source'}`,
      detail: edge,
    });
  }

  if (!selection) return null;

  return (
    <section className="oi-authored-relations" aria-label="Authored relations">
      <header className="oi-authored-relations__header">
        <div>
          <p className="oi-eyebrow">Living Wiki · authored topology</p>
          <h3>Relations in the language</h3>
          <p className="oi-muted">AIKit resolves source-authored links and Properties into the existing Wiki field. O:I presents that owner state; selecting or viewing it does not invoke an Agent/model.</p>
        </div>
        <span className="oi-authored-relations__state">{busy ? 'reading…' : authored ? 'source-derived' : 'no authored source relation'}</span>
      </header>

      {error && <p className="oi-workbench__error">Authored relations: {error}</p>}
      {authored && <div className="oi-authored-relations__grid">
        <RelationGroup title="Outgoing" count={outgoing.length}>
          {outgoing.map((edge) => <RelationRow key={edge.ref} edge={edge} target={edge.to_ref} node={nodes.get(edge.to_ref)} onFollow={() => void follow(edge)} />)}
        </RelationGroup>
        <RelationGroup title="Backlinks" count={incoming.length}>
          {incoming.map((edge) => <RelationRow key={edge.ref} edge={edge} target={edge.from_ref} node={nodes.get(edge.from_ref)} onFollow={() => void follow(edge)} />)}
        </RelationGroup>
        <RelationGroup title="Unresolved" count={authored.pending.length}>
          {authored.pending.map((pending, index) => <PendingRow key={`${pending.evidence.source_ref}:${pending.evidence.raw_target}:${index}`} pending={pending} />)}
        </RelationGroup>
      </div>}

      {authored && <footer className="oi-authored-relations__footer">
        <span>{authored.version}</span>
        <span>focus <code>{authored.subject_ref}</code></span>
        <span>derived index · rebuildable</span>
        <span>automatic Agent/model invocation = {String(authored.automatic_agent_or_model_invocation)}</span>
      </footer>}
    </section>
  );
}

function RelationGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <article className="oi-authored-relations__group"><header><strong>{title}</strong><small>{count}</small></header><div>{children}{count === 0 && <p className="oi-muted">None in the current bounded reading.</p>}</div></article>;
}

function RelationRow({ edge, target, node, onFollow }: { edge: AuthoredEdge; target: string; node?: RelationNode; onFollow: () => void }) {
  const evidence = edge.authored_relation ?? provenanceEvidence(edge);
  const anchor = anchorLabel(evidence?.anchor ?? edge.provenance[0]?.anchor);
  return <details className="oi-authored-relation">
    <summary>
      <span><strong>{edge.relation}</strong><small>{edge.origin} · {evidence?.channel ?? edge.provenance[0]?.channel ?? 'source'}</small></span>
      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onFollow(); }}>{node?.label ?? evidence?.display ?? evidence?.raw_target ?? target}</button>
    </summary>
    <dl>
      <dt>Target</dt><dd><code>{target}</code></dd>
      <dt>Authored token</dt><dd><code>{evidence?.raw_token ?? edge.provenance[0]?.raw_target ?? 'owner evidence'}</code></dd>
      <dt>Source</dt><dd><code>{evidence?.source_ref ?? edge.provenance[0]?.source_ref}</code>{sourceRevision(edge) && <> @ <code>{sourceRevision(edge)}</code></>}</dd>
      <dt>Anchor</dt><dd>{anchor}</dd>
      <dt>Origin</dt><dd>{edge.origin}{edge.provenance[0]?.source_authority ? ` · source authority ${edge.provenance[0].source_authority}` : ''}</dd>
    </dl>
  </details>;
}

function PendingRow({ pending }: { pending: PendingAuthoredRelation }) {
  const evidence = pending.evidence;
  const candidates = evidence.resolution.candidate_refs ?? [];
  return <details className="oi-authored-relation oi-authored-relation--pending">
    <summary><span><strong>{evidence.relation}</strong><small>{evidence.channel} · {evidence.resolution.state}</small></span><code>{evidence.raw_target}</code></summary>
    <dl>
      <dt>Authored token</dt><dd><code>{evidence.raw_token}</code></dd>
      <dt>Source</dt><dd><code>{evidence.source_ref}</code>{evidence.source_revision && <> @ <code>{evidence.source_revision}</code></>}</dd>
      <dt>Anchor</dt><dd>{anchorLabel(evidence.anchor)}</dd>
      <dt>Source authority</dt><dd>{pending.source_authority}</dd>
      {candidates.length > 0 && <><dt>Candidates</dt><dd>{candidates.join(' · ')}</dd></>}
    </dl>
  </details>;
}

function isProjectSourceRelations(value: unknown): value is ProjectSourceRelations {
  return !!value && typeof value === 'object' && ('authored' in value || 'authored_edges' in value);
}

function provenanceEvidence(edge: AuthoredEdge): Partial<AuthoredEvidence> | undefined {
  const provenance = edge.provenance[0];
  if (!provenance) return undefined;
  return {
    source_ref: provenance.source_ref,
    source_revision: provenance.source_revision == null ? undefined : String(provenance.source_revision),
    relation: edge.relation,
    raw_target: provenance.raw_target ?? '',
    raw_token: provenance.raw_target ?? '',
    channel: provenance.channel ?? 'source',
    anchor: provenance.anchor ?? {},
    resolution: { state: 'resolved', target_ref: edge.to_ref },
  };
}

function sourceRevision(edge: AuthoredEdge) {
  const revision = edge.authored_relation?.source_revision ?? edge.provenance[0]?.source_revision;
  return revision == null ? undefined : String(revision);
}

function anchorLabel(anchor?: AuthoredAnchor) {
  if (!anchor) return 'owner provenance';
  if (anchor.field_path) return anchor.field_path;
  if (anchor.start_byte != null && anchor.end_byte != null) return `bytes ${anchor.start_byte}–${anchor.end_byte}`;
  return 'owner provenance';
}

function messageFrom(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
