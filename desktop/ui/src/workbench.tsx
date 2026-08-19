import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './workbench.css';

export type WorkbenchSemanticRef = {
  ref: string;
  kind: string;
  native_owner: string;
  provenance: { source: string; revision?: string };
};

export type WorkbenchEvidence = {
  title: string;
  summary: string;
  detail?: unknown;
};

type SessionSpaceState = {
  version: string;
  revision: number;
  definition: {
    version: string;
    id: string;
    projects: string[];
    provenance: string[];
  };
  label?: string;
  project_contexts: Record<string, unknown>;
  agent_sessions: Record<string, { agent_session: string; purpose?: string; provenance: string[] }>;
  surfaces: Record<string, { surface: string; component?: string; purpose?: string; provenance: string[] }>;
  native_references: Record<string, unknown>;
  focus?: { target: string; region?: string; provenance: string[] };
};

type SessionSpaceReading = {
  state: SessionSpaceState;
  explanation: unknown;
  history: unknown[];
};

type KnowledgeHit = {
  resource: string;
  kind: string;
  label: string;
  score: number;
  snippet: string;
  provider: string;
  authority: string;
};

type KnowledgeSearchResult = {
  query: string;
  hits: KnowledgeHit[];
  absences: string[];
};

type RelationNode = {
  resource: string;
  kind: string;
  label: string;
  state?: string;
};

type RelationEdge = {
  from: string;
  to: string;
  relation: string;
  direction: string;
  origin: {
    provider?: string;
    lens?: string;
    authority: string;
    revision?: string;
  };
};

type KnowledgeRelationView = {
  query: { focus: string; depth: number; max_nodes: number; max_edges: number; filters: string[] };
  nodes: RelationNode[];
  edges: RelationEdge[];
  truncated: boolean;
  warnings: string[];
};

type KnowledgeReading = {
  resource: string;
  provider?: string;
  lens?: string;
  revision?: string;
  freshness?: string;
  authority: string;
  content?: string;
  evidence: string[];
  why_selected: string;
};

type KnowledgeExplanation = {
  provider?: string;
  authority: string;
  summary: string;
  sources: string[];
  detail?: unknown;
};

type KnowledgeMode = 'list' | 'tree' | 'graph' | 'reading' | 'history';

type ConnectionSignal = {
  sequence: number;
  native_session_id?: string;
  kind: {
    kind: string;
    text?: string;
    message?: string;
    stop_reason?: string;
    [key: string]: unknown;
  };
  provenance: string[];
};

type AgentSurfaceReading = {
  descriptor: {
    connection_ref: string;
    adapter_ref: string;
    state: string;
    [key: string]: unknown;
  };
  binding: {
    agent_session?: string;
    native_session_id: string;
    [key: string]: unknown;
  };
  signals: ConnectionSignal[];
};

export function WorkbenchSurface({
  onSelect,
  onAgentSessionChange,
}: {
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
  onAgentSessionChange: (agentSessionRef: string | null) => void;
}) {
  const [spaces, setSpaces] = useState<SessionSpaceState[]>([]);
  const [spaceRef, setSpaceRef] = useState<string>('');
  const [space, setSpace] = useState<SessionSpaceReading | null>(null);
  const [spaceError, setSpaceError] = useState<string>('');
  const [mode, setMode] = useState<KnowledgeMode>('list');
  const [query, setQuery] = useState('');
  const [knowledge, setKnowledge] = useState<KnowledgeSearchResult | null>(null);
  const [knowledgeDetail, setKnowledgeDetail] = useState<unknown>(null);
  const [knowledgeError, setKnowledgeError] = useState<string>('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeHit | null>(null);

  useEffect(() => {
    void refreshSpaces();
  }, []);

  async function refreshSpaces() {
    try {
      const next = await invoke<SessionSpaceState[]>('aikit_session_spaces');
      setSpaces(next);
      setSpaceError('');
      const preferred = spaceRef || next[0]?.definition.id || '';
      if (preferred) await openSpace(preferred);
    } catch (error) {
      setSpaces([]);
      setSpace(null);
      onAgentSessionChange(null);
      setSpaceError(messageFrom(error));
    }
  }

  async function openSpace(nextRef: string) {
    if (!nextRef) return;
    try {
      const next = await invoke<SessionSpaceReading>('aikit_session_space_read', {
        sessionSpaceRef: nextRef,
      });
      setSpaceRef(nextRef);
      setSpace(next);
      setSpaceError('');
      const firstAgent = Object.keys(next.state.agent_sessions)[0] ?? null;
      onAgentSessionChange(firstAgent);
      await onSelect(
        {
          ref: nextRef,
          kind: 'session-space',
          native_owner: 'ai-kit',
          provenance: { source: 'AIKit SessionSpace application', revision: String(next.state.revision) },
        },
        {
          title: next.state.label ?? nextRef,
          summary: `canonical SessionSpace · semantic revision ${next.state.revision}`,
          detail: { explanation: next.explanation, history: next.history },
        },
      );
    } catch (error) {
      setSpaceError(messageFrom(error));
    }
  }

  async function focusAgent(agentSessionRef: string) {
    onAgentSessionChange(agentSessionRef);
    try {
      if (spaceRef) {
        await invoke('aikit_session_space_focus', {
          request: {
            session_space_ref: spaceRef,
            target_ref: agentSessionRef,
            region: 'conversation',
          },
        });
        await openSpace(spaceRef);
      }
      await onSelect(
        {
          ref: agentSessionRef,
          kind: 'agent-session',
          native_owner: 'ai-kit',
          provenance: { source: 'AIKit SessionSpace attachment' },
        },
        {
          title: 'AgentSession',
          summary: `${agentSessionRef} · canonical identity independent of provider Surface`,
        },
      );
    } catch (error) {
      setSpaceError(messageFrom(error));
    }
  }

  async function searchKnowledge(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      const result = await invoke<KnowledgeSearchResult>('knowledge_search', {
        query: query.trim(),
        limit: 20,
      });
      setKnowledge(result);
      setSelectedKnowledge(result.hits[0] ?? null);
      setKnowledgeDetail(null);
      setMode('list');
      setKnowledgeError('');
    } catch (error) {
      setKnowledgeError(messageFrom(error));
    }
  }

  async function selectKnowledge(hit: KnowledgeHit, nextMode: KnowledgeMode = 'reading') {
    try {
      setSelectedKnowledge(hit);
      const subject: WorkbenchSemanticRef = {
        ref: hit.resource,
        kind: hit.kind,
        native_owner: hit.provider,
        provenance: { source: `${hit.authority}:${hit.provider}` },
      };

      let detail: unknown;
      if (nextMode === 'graph' || nextMode === 'tree') {
        detail = await invoke<KnowledgeRelationView>('knowledge_relations', {
          resourceRef: hit.resource,
          depth: 2,
          maxNodes: 80,
          maxEdges: 160,
        });
      } else if (nextMode === 'history') {
        detail = await invoke('knowledge_history', { resourceRef: hit.resource });
      } else {
        const reading = await invoke<KnowledgeReading>('knowledge_read', { resourceRef: hit.resource });
        const explanation = await invoke<KnowledgeExplanation>('knowledge_explain', { resourceRef: hit.resource });
        detail = { reading, explanation };
      }

      if (spaceRef) {
        await invoke('aikit_session_space_focus', {
          request: {
            session_space_ref: spaceRef,
            target_ref: hit.resource,
            region: `knowledge:${nextMode}`,
          },
        });
        await openSpace(spaceRef);
      }

      setKnowledgeDetail(detail);
      setMode(nextMode);
      setKnowledgeError('');
      await onSelect(subject, {
        title: hit.label,
        summary: `${hit.kind} · ${hit.authority} · ${hit.provider}`,
        detail,
      });
    } catch (error) {
      setKnowledgeError(messageFrom(error));
    }
  }

  const agentRefs = useMemo(() => Object.keys(space?.state.agent_sessions ?? {}), [space]);
  const surfaceRefs = useMemo(() => Object.keys(space?.state.surfaces ?? {}), [space]);
  const projectRefs = useMemo(() => space?.state.definition.projects ?? [], [space]);
  const nativeRefs = useMemo(() => Object.keys(space?.state.native_references ?? {}), [space]);

  return (
    <section className="oi-workbench" aria-label="Native O:I workbench">
      <header className="oi-workbench__header">
        <div>
          <p className="oi-eyebrow">AIKit application projection</p>
          <h2>Workbench</h2>
          <p className="oi-muted">One SessionSpace relation; canvas, Encounter and Knowledge change focus around the same stable refs.</p>
        </div>
        <button type="button" onClick={() => void refreshSpaces()}>Re-read native state</button>
      </header>

      <div className="oi-workbench__spacebar">
        <label>
          <span>SessionSpace</span>
          <select value={spaceRef} onChange={(event) => void openSpace(event.target.value)}>
            {!spaces.length && <option value="">No native SessionSpace observed</option>}
            {spaces.map((entry) => (
              <option key={entry.definition.id} value={entry.definition.id}>
                {entry.label ?? entry.definition.id}
              </option>
            ))}
          </select>
        </label>
        {space && <span className="oi-workbench__revision">rev {space.state.revision}</span>}
        {space?.state.focus && <span className="oi-workbench__focus">focus · {space.state.focus.target}</span>}
      </div>
      {spaceError && <p className="oi-workbench__error">SessionSpace: {spaceError}</p>}

      <div className="oi-workbench__grid">
        <article className="oi-workbench__pane">
          <p className="oi-eyebrow">SessionSpace</p>
          <h3>Resolved relations</h3>
          {space ? (
            <>
              <RelationList label="Projects" refs={projectRefs} empty="No Project membership authored." />
              <AgentRelationList refs={agentRefs} onFocus={focusAgent} />
              <RelationList label="Surfaces" refs={surfaceRefs} empty="No Surface attachment authored." />
              <RelationList label="Native bindings" refs={nativeRefs} empty="No provider/host/material ref authored." />
              <details>
                <summary>Explain / History</summary>
                <pre>{jsonPreview({ explanation: space.explanation, history: space.history })}</pre>
              </details>
            </>
          ) : <p className="oi-muted">Open a native SessionSpace to inspect its authored relations.</p>}
        </article>

        <article className="oi-workbench__pane oi-workbench__knowledge">
          <p className="oi-eyebrow">ProjectCentral → SemanticWiki → AIKit</p>
          <h3>Knowledge</h3>
          <form onSubmit={searchKnowledge} className="oi-workbench__search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this local project world" />
            <button type="submit" disabled={!query.trim()}>Search</button>
          </form>
          <div className="oi-workbench__modes" aria-label="Knowledge presentation">
            {(['list', 'tree', 'graph', 'reading', 'history'] as KnowledgeMode[]).map((entry) => (
              <button
                key={entry}
                type="button"
                className={mode === entry ? 'is-active' : ''}
                disabled={entry !== 'list' && !selectedKnowledge}
                onClick={() => {
                  if (entry === 'list') {
                    setMode('list');
                    return;
                  }
                  if (selectedKnowledge) void selectKnowledge(selectedKnowledge, entry);
                }}
              >{entry}</button>
            ))}
          </div>
          {knowledge?.absences.map((absence) => <p className="oi-muted" key={absence}>{absence}</p>)}
          {mode === 'list' && (
            <div className="oi-workbench__hits">
              {knowledge?.hits.map((hit) => (
                <button
                  key={hit.resource}
                  type="button"
                  className={selectedKnowledge?.resource === hit.resource ? 'is-current' : ''}
                  onClick={() => void selectKnowledge(hit)}
                >
                  <strong>{hit.label}</strong>
                  <span>{hit.kind} · {hit.authority}</span>
                  {hit.snippet && <small>{hit.snippet}</small>}
                </button>
              ))}
              {knowledge && !knowledge.hits.length && <p className="oi-muted">No matching local Knowledge refs.</p>}
            </div>
          )}
          {(mode === 'tree' || mode === 'graph') && knowledgeDetail != null && (
            <RelationPresentation mode={mode} view={knowledgeDetail as KnowledgeRelationView} />
          )}
          {(mode === 'reading' || mode === 'history') && knowledgeDetail != null && (
            <pre className="oi-workbench__detail">{jsonPreview(knowledgeDetail)}</pre>
          )}
          {knowledgeError && <p className="oi-workbench__error">Knowledge: {knowledgeError}</p>}
        </article>
      </div>
    </section>
  );
}

export function AgentEncounterSurface({
  agentSessionRef,
  onSelect,
}: {
  agentSessionRef: string | null;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
}) {
  const [surface, setSurface] = useState<AgentSurfaceReading | null>(null);
  const [input, setInput] = useState('');
  const [signals, setSignals] = useState<ConnectionSignal[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSurface(null);
    setSignals([]);
    setInput('');
    setError('');
  }, [agentSessionRef]);

  async function openAgent() {
    if (!agentSessionRef) return;
    setBusy(true);
    try {
      const reading = await invoke<AgentSurfaceReading>('agent_surface_open', {
        request: {
          agent_session_ref: agentSessionRef,
          mode: 'create',
        },
      });
      setSurface(reading);
      setSignals(reading.signals);
      setError('');
      await onSelect(
        {
          ref: agentSessionRef,
          kind: 'agent-session',
          native_owner: 'ai-kit',
          provenance: { source: 'AIKit AgentSession connection binding' },
        },
        {
          title: 'AgentSession conversation',
          summary: `${agentSessionRef} · provider-native ${reading.binding.native_session_id}`,
          detail: reading,
        },
      );
    } catch (nextError) {
      setError(messageFrom(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function sendAgent(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || !surface) return;
    setBusy(true);
    setInput('');
    try {
      const returned = await invoke<ConnectionSignal[]>('agent_surface_send', { text });
      setSignals((current) => [...current, ...returned]);
      setError('');
    } catch (nextError) {
      setError(messageFrom(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function cancelAgent() {
    try {
      await invoke('agent_surface_cancel');
      setError('');
    } catch (nextError) {
      setError(messageFrom(nextError));
    }
  }

  async function closeAgent() {
    try {
      await invoke('agent_surface_close');
      setError('');
    } catch (nextError) {
      setError(messageFrom(nextError));
    } finally {
      setSurface(null);
      // Provider material is an ephemeral renderer projection, not a transcript
      // authority. Closing the Surface deliberately drops this local view.
      setSignals([]);
    }
  }

  const visibleSignals = signals.filter((signal) =>
    ['agent-message-chunk', 'status', 'completed', 'cancelled', 'degraded'].includes(signal.kind.kind),
  );

  return (
    <div className="oi-agent-encounter">
      <p className="oi-eyebrow">AgentSession</p>
      <h3>Conversation</h3>
      {!agentSessionRef && <p className="oi-muted">Select an AgentSession from the current SessionSpace.</p>}
      {agentSessionRef && <code>{agentSessionRef}</code>}
      {agentSessionRef && !surface && (
        <button type="button" disabled={busy} onClick={() => void openAgent()}>Open native conversation</button>
      )}
      {surface && (
        <>
          <dl className="oi-ref">
            <dt>Canonical</dt><dd>{surface.binding.agent_session ?? agentSessionRef}</dd>
            <dt>Provider</dt><dd>{surface.binding.native_session_id}</dd>
            <dt>Connection</dt><dd>{surface.descriptor.connection_ref}</dd>
          </dl>
          <div className="oi-agent-encounter__stream" aria-live="polite">
            {!visibleSignals.length && <p className="oi-muted">Conversation open. No provider material returned yet.</p>}
            {visibleSignals.map((signal) => (
              <p key={signal.sequence} data-kind={signal.kind.kind}>
                {signal.kind.text ?? signal.kind.message ?? signal.kind.stop_reason ?? signal.kind.kind}
              </p>
            ))}
          </div>
          <form onSubmit={sendAgent} className="oi-agent-encounter__prompt">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Continue this AgentSession…"
              rows={4}
            />
            <div className="oi-agent-encounter__actions">
              <button type="submit" disabled={busy || !input.trim()}>Send</button>
              <button type="button" disabled={!busy} onClick={() => void cancelAgent()}>Interrupt</button>
              <button type="button" onClick={() => void closeAgent()}>Close</button>
            </div>
          </form>
        </>
      )}
      {error && <p className="oi-workbench__error">AgentSession: {error}</p>}
      <small className="oi-muted">Model, harness and provider remain observable composition facts; none substitutes for Agent identity.</small>
    </div>
  );
}

function RelationList({ label, refs, empty }: { label: string; refs: string[]; empty: string }) {
  return (
    <div className="oi-workbench__relations">
      <strong>{label}</strong>
      {refs.length ? refs.map((ref) => <code key={ref}>{ref}</code>) : <span className="oi-muted">{empty}</span>}
    </div>
  );
}

function AgentRelationList({ refs, onFocus }: { refs: string[]; onFocus: (ref: string) => Promise<void> }) {
  return (
    <div className="oi-workbench__relations">
      <strong>AgentSessions</strong>
      {refs.length ? refs.map((ref) => (
        <button type="button" className="oi-workbench__ref-button" key={ref} onClick={() => void onFocus(ref)}>{ref}</button>
      )) : <span className="oi-muted">No AgentSession attachment authored.</span>}
    </div>
  );
}

function RelationPresentation({ mode, view }: { mode: 'tree' | 'graph'; view: KnowledgeRelationView }) {
  if (mode === 'tree') {
    const outgoing = view.edges.filter((edge) => edge.from === view.query.focus);
    const incoming = view.edges.filter((edge) => edge.to === view.query.focus);
    return (
      <div className="oi-relation-tree" aria-label="Knowledge tree presentation">
        <code>{view.query.focus}</code>
        {outgoing.map((edge, index) => (
          <p key={`out-${edge.relation}-${edge.to}-${index}`}>↳ <strong>{edge.relation}</strong> → {edge.to}</p>
        ))}
        {incoming.map((edge, index) => (
          <p key={`in-${edge.relation}-${edge.from}-${index}`}>↰ <strong>{edge.relation}</strong> ← {edge.from}</p>
        ))}
        {!outgoing.length && !incoming.length && <p className="oi-muted">No direct provider relations in this bounded view.</p>}
      </div>
    );
  }

  return (
    <div className="oi-relation-graph" aria-label="Knowledge graph presentation">
      <div className="oi-relation-graph__nodes">
        {view.nodes.map((node) => <span key={node.resource} title={node.resource}>{node.label}</span>)}
      </div>
      <div className="oi-relation-graph__edges">
        {view.edges.map((edge, index) => (
          <p key={`${edge.from}-${edge.relation}-${edge.to}-${index}`}>
            <code>{edge.from}</code> <strong>{edge.relation}</strong> <code>{edge.to}</code>
            <small>{edge.origin.authority}{edge.origin.provider ? ` · ${edge.origin.provider}` : ''}</small>
          </p>
        ))}
      </div>
      {view.truncated && <p className="oi-muted">Bounded relation view truncated at its requested budget.</p>}
    </div>
  );
}

function jsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
