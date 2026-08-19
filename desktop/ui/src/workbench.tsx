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

type KnowledgeMode = 'list' | 'graph' | 'reading' | 'history';

export function WorkbenchSurface({
  onSelect,
}: {
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
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
  const [agentSessionRef, setAgentSessionRef] = useState('');
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [agentSignals, setAgentSignals] = useState<unknown[]>([]);
  const [agentError, setAgentError] = useState('');

  useEffect(() => {
    refreshSpaces();
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
      const firstAgent = Object.keys(next.state.agent_sessions)[0] ?? '';
      if (!agentSessionRef || !next.state.agent_sessions[agentSessionRef]) {
        setAgentSessionRef(firstAgent);
      }
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
      setKnowledgeDetail(null);
      setMode('list');
      setKnowledgeError('');
    } catch (error) {
      setKnowledgeError(messageFrom(error));
    }
  }

  async function selectKnowledge(hit: KnowledgeHit, nextMode: KnowledgeMode = 'reading') {
    try {
      const subject: WorkbenchSemanticRef = {
        ref: hit.resource,
        kind: hit.kind,
        native_owner: hit.provider,
        provenance: { source: `${hit.authority}:${hit.provider}` },
      };

      let detail: unknown;
      if (nextMode === 'graph') {
        detail = await invoke('knowledge_relations', {
          resourceRef: hit.resource,
          depth: 2,
          maxNodes: 80,
          maxEdges: 160,
        });
      } else if (nextMode === 'history') {
        detail = await invoke('knowledge_history', { resourceRef: hit.resource });
      } else {
        const reading = await invoke('knowledge_read', { resourceRef: hit.resource });
        const explanation = await invoke('knowledge_explain', { resourceRef: hit.resource });
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

  async function openAgent() {
    if (!agentSessionRef) return;
    try {
      const reading = await invoke<unknown>('agent_surface_open', {
        request: {
          agent_session_ref: agentSessionRef,
          mode: 'create',
        },
      });
      setAgentSignals([reading]);
      setAgentOpen(true);
      setAgentError('');
      await onSelect(
        {
          ref: agentSessionRef,
          kind: 'agent-session',
          native_owner: 'ai-kit',
          provenance: { source: 'AIKit AgentSession connection binding' },
        },
        {
          title: 'AgentSession',
          summary: `${agentSessionRef} · provider binding preserved separately`,
          detail: reading,
        },
      );
    } catch (error) {
      setAgentError(messageFrom(error));
    }
  }

  async function sendAgent(event: FormEvent) {
    event.preventDefault();
    const text = agentInput.trim();
    if (!text || !agentOpen) return;
    setAgentInput('');
    try {
      const signals = await invoke<unknown[]>('agent_surface_send', { text });
      setAgentSignals((current) => [...current, { human: text }, ...signals]);
      setAgentError('');
    } catch (error) {
      setAgentError(messageFrom(error));
    }
  }

  async function cancelAgent() {
    try {
      await invoke('agent_surface_cancel');
    } catch (error) {
      setAgentError(messageFrom(error));
    }
  }

  async function closeAgent() {
    try {
      await invoke('agent_surface_close');
    } catch (error) {
      setAgentError(messageFrom(error));
    } finally {
      setAgentOpen(false);
      // Signals are a renderer projection of provider material, not a transcript
      // authority. Closing the Surface deliberately drops this ephemeral view.
      setAgentSignals([]);
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
          <p className="oi-muted">One SessionSpace relation; document, conversation and Knowledge change focus around stable refs.</p>
        </div>
        <button type="button" onClick={refreshSpaces}>Re-read native state</button>
      </header>

      <div className="oi-workbench__spacebar">
        <label>
          <span>SessionSpace</span>
          <select value={spaceRef} onChange={(event) => openSpace(event.target.value)}>
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
              <RelationList label="AgentSessions" refs={agentRefs} empty="No AgentSession attachment authored." />
              <RelationList label="Surfaces" refs={surfaceRefs} empty="No Surface attachment authored." />
              <RelationList label="Native bindings" refs={nativeRefs} empty="No provider/host/material ref authored." />
              <details>
                <summary>Explain / History</summary>
                <pre>{jsonPreview({ explanation: space.explanation, history: space.history })}</pre>
              </details>
            </>
          ) : <p className="oi-muted">Open a native SessionSpace to inspect its authored relations.</p>}
        </article>

        <article className="oi-workbench__pane oi-workbench__conversation">
          <p className="oi-eyebrow">Generic AgentSession Surface</p>
          <h3>Conversation</h3>
          <label>
            <span>Canonical AgentSession</span>
            <select value={agentSessionRef} onChange={(event) => setAgentSessionRef(event.target.value)} disabled={agentOpen}>
              {!agentRefs.length && <option value="">No attached AgentSession</option>}
              {agentRefs.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
            </select>
          </label>
          <div className="oi-workbench__actions">
            {!agentOpen ? (
              <button type="button" disabled={!agentSessionRef} onClick={openAgent}>Open native Surface</button>
            ) : (
              <>
                <button type="button" onClick={cancelAgent}>Interrupt</button>
                <button type="button" onClick={closeAgent}>Close Surface</button>
              </>
            )}
          </div>
          <div className="oi-workbench__messages" aria-live="polite">
            {!agentSignals.length && <p className="oi-muted">Provider material appears here when a configured native AgentSession is opened. O:I stores no second transcript.</p>}
            {agentSignals.map((signal, index) => <pre key={index}>{jsonPreview(signal)}</pre>)}
          </div>
          <form onSubmit={sendAgent} className="oi-workbench__prompt">
            <textarea
              value={agentInput}
              onChange={(event) => setAgentInput(event.target.value)}
              placeholder="Continue the current AgentSession…"
              disabled={!agentOpen}
            />
            <button type="submit" disabled={!agentOpen || !agentInput.trim()}>Send</button>
          </form>
          {agentError && <p className="oi-workbench__error">AgentSession: {agentError}</p>}
        </article>

        <article className="oi-workbench__pane oi-workbench__knowledge">
          <p className="oi-eyebrow">ProjectCentral → SemanticWiki → AIKit</p>
          <h3>Knowledge</h3>
          <form onSubmit={searchKnowledge} className="oi-workbench__search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this local project world" />
            <button type="submit" disabled={!query.trim()}>Search</button>
          </form>
          <div className="oi-workbench__modes" aria-label="Knowledge presentation">
            {(['list', 'graph', 'reading', 'history'] as KnowledgeMode[]).map((entry) => (
              <button key={entry} type="button" className={mode === entry ? 'is-active' : ''} onClick={() => setMode(entry)}>{entry}</button>
            ))}
          </div>
          {knowledge?.absences.map((absence) => <p className="oi-muted" key={absence}>{absence}</p>)}
          {mode === 'list' && (
            <div className="oi-workbench__hits">
              {knowledge?.hits.map((hit) => (
                <button key={hit.resource} type="button" onClick={() => selectKnowledge(hit)}>
                  <strong>{hit.label}</strong>
                  <span>{hit.kind} · {hit.authority}</span>
                  {hit.snippet && <small>{hit.snippet}</small>}
                </button>
              ))}
              {knowledge && !knowledge.hits.length && <p className="oi-muted">No matching local Knowledge refs.</p>}
            </div>
          )}
          {mode !== 'list' && knowledge?.hits[0] && !knowledgeDetail && (
            <div className="oi-workbench__mode-actions">
              <button type="button" onClick={() => selectKnowledge(knowledge.hits[0], mode)}>
                Open first result as {mode}
              </button>
            </div>
          )}
          {mode !== 'list' && knowledgeDetail != null && <pre className="oi-workbench__detail">{jsonPreview(knowledgeDetail)}</pre>}
          {knowledgeError && <p className="oi-workbench__error">Knowledge: {knowledgeError}</p>}
        </article>
      </div>
    </section>
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
