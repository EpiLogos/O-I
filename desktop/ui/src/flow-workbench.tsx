import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { type WorkbenchEvidence, type WorkbenchSemanticRef } from './workbench-native';
import './flow-workbench.css';

type FlowRecord = {
  flow_ref: string;
  source_ref: string;
  path: string;
  created_at_unix_seconds: number;
  current_revision: string;
  lifecycle: 'active' | 'dormant' | 'closed' | string;
  title?: string;
  scope_ref: string;
  privacy: string;
  revisions: Array<{
    revision: string;
    parent_revision?: string;
    actor: string;
    actor_kind: string;
    agent_session_ref?: string;
    recorded_at_unix_seconds: number;
    source_path: string;
    history_source: string;
  }>;
};

type FlowList = {
  version: string;
  provider: string;
  project_id: string;
  flows: FlowRecord[];
  source_role: string;
  automatic_agent_or_model_invocation: boolean;
};

type FlowDocument = {
  version: string;
  provider: string;
  flow: FlowRecord;
  content: string;
  dirty_external_revision_reconciled: boolean;
  automatic_agent_or_model_invocation: boolean;
};

type StandingContext = {
  version: string;
  binding: {
    flow_ref: string;
    source_ref: string;
    flow_revision: string;
    provider: string;
    project: string;
    context_resolution_version: string;
    context_resolution_hash: string;
    agent_session: string;
    agent?: string;
    agency?: string;
    provenance: string[];
  };
  lifecycle: string;
  disclosure: { state: 'disclosed'; body: string; digest: string } | { state: 'undisclosed'; reason: string };
  automatic_agent_or_model_invocation: boolean;
};

type FlowPreflight = {
  version: string;
  invocation_ref: string;
  standing: StandingContext;
  bounded: {
    automatic_agent_or_model_invocation: boolean;
    field?: {
      changes?: unknown[];
      objects?: unknown[];
      relations?: unknown[];
      returns?: unknown[];
      changed_source_payloads_retrieved?: boolean;
      automatic_agent_or_model_invocation?: boolean;
    };
  };
  praxis: {
    methods: Array<{ method: string; source: string; revision?: string }>;
    warnings: string[];
  };
  authority_refs: Array<{ authority: string; reference: string }>;
  automatic_agent_or_model_invocation: boolean;
};

type FlowContemplateResult = {
  version: string;
  transport: string;
  agent_session: string;
  flow_ref: string;
  preflight: FlowPreflight;
  flow_mutations: Array<{
    flow_ref: string;
    expected_revision: string;
    replacement: string;
    actor: string;
    agency?: string;
    agent_session: string;
    method?: string;
    invocation_ref?: string;
  }>;
  flow_owner_results: Array<{
    status: 'applied' | 'conflict';
    current: { flow_ref: string; source_ref: string; revision: string; provider: string };
  }>;
  agent_wiki: {
    current_index_revision: string;
    stale_resources: string[];
    next_objects: Array<{ resource_ref: string; revision: number; object_kind: string }>;
    human_source_proposals: Array<{ source: string; reason: string; evidence: string[] }>;
  };
  integrative_readings: unknown[];
  candidates: string[];
  tensions: string[];
  human_source_mutation_performed: boolean;
  automatic_agent_or_model_invocation: boolean;
};

type FlowProps = {
  selection?: WorkbenchSemanticRef;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
};

function semanticFlow(flow: FlowRecord): WorkbenchSemanticRef {
  return {
    ref: flow.flow_ref,
    kind: 'flow',
    native_owner: 'central',
    provenance: {
      source: flow.source_ref,
      revision: flow.current_revision,
    },
  };
}

function flowEvidence(flow: FlowRecord): WorkbenchEvidence {
  return {
    title: flow.title || flow.path,
    summary: `Flow · ${flow.lifecycle} · ${flow.current_revision}`,
    detail: flow,
  };
}

export function FlowNavigator({ selection, onSelect }: FlowProps) {
  const [snapshot, setSnapshot] = useState<FlowList | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const next = await invoke<FlowList>('flow_list');
      setSnapshot(next);
      setError('');
    } catch (reason) {
      setSnapshot(null);
      setError(messageFrom(reason));
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function createFlow() {
    setBusy(true);
    try {
      const document = await invoke<FlowDocument>('flow_create');
      await onSelect(semanticFlow(document.flow), flowEvidence(document.flow));
      setError('');
      await refresh();
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  return <section className="oi-flow-nav" aria-label="Flows">
    <header>
      <div><p className="oi-eyebrow">Live thinking</p><strong>Flows</strong></div>
      <div className="oi-flow-nav__actions">
        <button type="button" disabled={busy} onClick={() => void createFlow()}>New thought</button>
        <button type="button" disabled={busy} onClick={() => void refresh()}>↻</button>
      </div>
    </header>
    {error && <p className="oi-workbench__error">{error}</p>}
    {snapshot && <>
      <p className="oi-muted">Ordinary-file threads · stable FlowRef · no model call on open/save/refresh.</p>
      <div className="oi-flow-nav__list">
        {snapshot.flows.map((flow) => <button
          key={flow.flow_ref}
          type="button"
          className={selection?.ref === flow.flow_ref ? 'is-active' : ''}
          onClick={() => void onSelect(semanticFlow(flow), flowEvidence(flow))}
        >
          <strong>{flow.title || shortPath(flow.path)}</strong>
          <span>{flow.lifecycle} · {shortRevision(flow.current_revision)}</span>
          <small>{flow.path}</small>
        </button>)}
        {!snapshot.flows.length && <p className="oi-muted">No Flow yet. “New thought” creates a blank native-owner source and opens it in this same Project workbench.</p>}
      </div>
      <small>provider {snapshot.provider} · automatic Agent/model = {String(snapshot.automatic_agent_or_model_invocation)}</small>
    </>}
  </section>;
}

export function FlowWorkbench({ selection, onSelect }: FlowProps) {
  const flowRef = selection?.kind === 'flow' ? selection.ref : undefined;
  const [document, setDocument] = useState<FlowDocument | null>(null);
  const [buffer, setBuffer] = useState('');
  const [standing, setStanding] = useState<StandingContext | null>(null);
  const [preflight, setPreflight] = useState<FlowPreflight | null>(null);
  const [result, setResult] = useState<FlowContemplateResult | null>(null);
  const [history, setHistory] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'open' | 'save' | 'bind' | 'preview' | 'contemplate' | 'history' | ''>('');

  const dirty = document ? buffer !== document.content : false;
  const authoritySummary = useMemo(() => {
    const refs = result?.preflight.authority_refs ?? preflight?.authority_refs ?? [];
    return refs.reduce<Record<string, string[]>>((groups, entry) => {
      (groups[entry.authority] ??= []).push(entry.reference);
      return groups;
    }, {});
  }, [preflight, result]);

  async function open(ref: string) {
    setBusy('open');
    try {
      const next = await invoke<FlowDocument>('flow_open', { flowRef: ref });
      setDocument(next);
      setBuffer(next.content);
      setStanding(null);
      setPreflight(null);
      setResult(null);
      setHistory(null);
      setError('');
      await onSelect(semanticFlow(next.flow), flowEvidence(next.flow));
    } catch (reason) {
      setDocument(null);
      setError(messageFrom(reason));
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    if (flowRef) void open(flowRef);
    else {
      setDocument(null);
      setBuffer('');
      setStanding(null);
      setPreflight(null);
      setResult(null);
      setHistory(null);
      setError('');
    }
  // stable FlowRef is the document identity; revision updates do not reopen it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowRef]);

  async function save() {
    if (!document) return;
    setBusy('save');
    try {
      const next = await invoke<FlowDocument>('flow_save', {
        flowRef: document.flow.flow_ref,
        expectedRevision: document.flow.current_revision,
        content: buffer,
      });
      setDocument(next);
      setBuffer(next.content);
      setStanding(null);
      setPreflight(null);
      setResult(null);
      setError('');
      await onSelect(semanticFlow(next.flow), flowEvidence(next.flow));
    } catch (reason) {
      // The buffer is intentionally untouched. Owner-current revision is surfaced
      // in the error and can be explicitly re-read after the human reconciles.
      setError(messageFrom(reason));
    } finally {
      setBusy('');
    }
  }

  async function bind() {
    if (!document) return;
    setBusy('bind');
    try {
      const next = await invoke<StandingContext>('flow_bind', { flowRef: document.flow.flow_ref });
      setStanding(next);
      setError('');
    } catch (reason) { setError(messageFrom(reason)); }
    finally { setBusy(''); }
  }

  async function preview() {
    if (!document || dirty) return;
    setBusy('preview');
    try {
      const next = await invoke<FlowPreflight>('flow_contemplate_preflight', {
        flowRef: document.flow.flow_ref,
        authorityRefs: [],
      });
      setPreflight(next);
      setStanding(next.standing);
      setResult(null);
      setError('');
    } catch (reason) { setError(messageFrom(reason)); }
    finally { setBusy(''); }
  }

  async function contemplate() {
    if (!document || dirty) return;
    setBusy('contemplate');
    try {
      const next = await invoke<FlowContemplateResult>('flow_contemplate', {
        flowRef: document.flow.flow_ref,
        authorityRefs: [],
      });
      setResult(next);
      setPreflight(next.preflight);
      setStanding(next.preflight.standing);
      setError('');
      // Re-read only after the explicit operation; if the returned owner intent was
      // applied, the Canvas advances to the exact owner revision. No passive event
      // causes this model call or mutation.
      const current = await invoke<FlowDocument>('flow_open', { flowRef: document.flow.flow_ref });
      setDocument(current);
      setBuffer(current.content);
      await onSelect(semanticFlow(current.flow), flowEvidence(current.flow));
    } catch (reason) { setResult(null); setError(messageFrom(reason)); }
    finally { setBusy(''); }
  }

  async function readHistory() {
    if (!document) return;
    setBusy('history');
    try {
      setHistory(await invoke('flow_history', { flowRef: document.flow.flow_ref }));
      setError('');
    } catch (reason) { setError(messageFrom(reason)); }
    finally { setBusy(''); }
  }

  if (!flowRef) return null;

  return <section className="oi-flow" aria-label="Flow Canvas">
    <header className="oi-flow__header">
      <div>
        <p className="oi-eyebrow">Flow · live linguistic source</p>
        <h2>{document?.flow.title || document?.flow.path || flowRef}</h2>
        <p className="oi-muted">FlowRef continuity · ordinary source · current revision is refinable; exact history remains owner-held.</p>
      </div>
      <div className="oi-flow__header-actions">
        <button type="button" disabled={!document || busy !== '' || !dirty} onClick={() => void save()}>Save</button>
        <button type="button" disabled={!document || busy !== ''} onClick={() => void readHistory()}>History</button>
      </div>
    </header>

    {error && <p className="oi-workbench__error">{error}</p>}

    {document && <>
      <div className="oi-flow__facts">
        <code>{document.flow.flow_ref}</code>
        <code>{document.flow.source_ref}</code>
        <code>revision {shortRevision(document.flow.current_revision)}</code>
        <code>{document.flow.lifecycle}</code>
        <code>dirty = {String(dirty)}</code>
        <code>automatic Agent/model = {String(document.automatic_agent_or_model_invocation)}</code>
      </div>
      {document.dirty_external_revision_reconciled && <p className="oi-flow__notice">The owner reconciled a direct external edit into a new exact revision before this read.</p>}
      <textarea
        className="oi-flow__editor"
        aria-label="Current Flow"
        value={buffer}
        onChange={(event) => setBuffer(event.target.value)}
        placeholder=""
        spellCheck
      />
      <div className="oi-flow__actions">
        <button type="button" disabled={busy !== ''} onClick={() => void bind()}>Bind current AgentSession</button>
        <button type="button" disabled={busy !== '' || dirty} onClick={() => void preview()}>Preview Contemplate</button>
        <button className="oi-flow__contemplate" type="button" disabled={busy !== '' || dirty} onClick={() => void contemplate()}>Contemplate Flow</button>
        {dirty && <span>Save or reconcile the human buffer before binding it to deliberate Agent work.</span>}
      </div>
    </>}

    {standing && <section className="oi-flow__standing">
      <header><p className="oi-eyebrow">Standing context for this act</p><strong>{standing.binding.agent_session}</strong></header>
      <dl>
        <dt>Flow</dt><dd>{standing.binding.flow_ref}</dd>
        <dt>Revision</dt><dd>{standing.binding.flow_revision}</dd>
        <dt>ContextResolution</dt><dd>{standing.binding.context_resolution_version}</dd>
        <dt>Agent</dt><dd>{standing.binding.agent ?? '—'}</dd>
        <dt>Agency</dt><dd>{standing.binding.agency ?? '—'}</dd>
      </dl>
      <small>A later AgentSession can bind this same FlowRef/current owner revision; AgentSession remains conversation continuity.</small>
    </section>}

    {preflight && <section className="oi-flow__preflight">
      <header><p className="oi-eyebrow">Deterministic Flow preflight</p><strong>{preflight.invocation_ref}</strong></header>
      <div className="oi-flow__facts">
        <code>Method {preflight.praxis.methods.map((entry) => entry.method).join(' · ')}</code>
        <code>automatic Agent/model = {String(preflight.automatic_agent_or_model_invocation)}</code>
        <code>changed payload retrieval = {String(preflight.bounded.field?.changed_source_payloads_retrieved ?? false)}</code>
      </div>
    </section>}

    {(preflight || result) && <section className="oi-flow__authorities">
      <p className="oi-eyebrow">Distinct return authorities</p>
      <div>
        {['flow', 'wiki-reading', 'claim', 'ground', 'run', 'agent-session'].map((kind) => <article key={kind}>
          <strong>{authorityLabel(kind)}</strong>
          {(authoritySummary[kind] ?? []).map((ref) => <small key={ref}>{ref}</small>)}
          {!(authoritySummary[kind] ?? []).length && <small>owner category retained; no current ref</small>}
        </article>)}
      </div>
    </section>}

    {result && <section className="oi-flow__return">
      <header><p className="oi-eyebrow">Contemplate return · attributable</p><strong>{result.agent_session}</strong><small>{result.transport}</small></header>
      <div className="oi-flow__return-grid">
        <ReturnCard title="Flow owner" count={result.flow_owner_results.length}>
          {result.flow_owner_results.map((entry, index) => <p key={index}><strong>{entry.status}</strong> · {entry.current.revision}</p>)}
          <small>Expected-revision mutation through the native Flow owner.</small>
        </ReturnCard>
        <ReturnCard title="Agent Wiki / WikiReading" count={result.agent_wiki.next_objects.length + result.integrative_readings.length}>
          <p>{result.agent_wiki.next_objects.length} Wiki object plan · {result.integrative_readings.length} integrative reading</p>
        </ReturnCard>
        <ReturnCard title="Human Ground" count={result.agent_wiki.human_source_proposals.length}>
          {result.agent_wiki.human_source_proposals.map((proposal, index) => <p key={index}><strong>Proposal · Recognition required</strong><br />{proposal.source}<br />{proposal.reason}</p>)}
          <small>direct human-source mutation = {String(result.human_source_mutation_performed)}</small>
        </ReturnCard>
        <ReturnCard title="Open knowledge" count={result.candidates.length + result.tensions.length}>
          {result.candidates.map((entry) => <span key={`candidate:${entry}`}>{entry}</span>)}
          {result.tensions.map((entry) => <span key={`tension:${entry}`}>{entry}</span>)}
        </ReturnCard>
      </div>
    </section>}

    {history != null && <details className="oi-flow__history" open>
      <summary>Exact owner revision history / DAY continuity evidence</summary>
      <pre>{JSON.stringify(history, null, 2)}</pre>
    </details>}
  </section>;
}

function ReturnCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <article><header><strong>{title}</strong><small>{count}</small></header>{children}</article>;
}

function shortPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function shortRevision(revision: string) {
  return revision.length > 28 ? `${revision.slice(0, 12)}…${revision.slice(-10)}` : revision;
}

function authorityLabel(kind: string) {
  switch (kind) {
    case 'wiki-reading': return 'WikiReading';
    case 'agent-session': return 'AgentSession';
    default: return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

function messageFrom(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
