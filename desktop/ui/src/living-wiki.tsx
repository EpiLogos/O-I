import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { type WorkbenchSemanticRef } from './workbench-native';
import {
  canContemplate,
  freshnessLabel,
  livingSummary,
  relatedLivingState,
  type LivingWikiDesktopReading,
} from './living-wiki-model';
import './living-wiki.css';

type LivingWikiProps = {
  selection?: WorkbenchSemanticRef;
};

type BoundedPreflight = {
  version?: string;
  base?: {
    project?: string;
    focus?: string[];
    runtime_model?: string;
    harness?: string;
    agent?: string;
    agency?: string;
    ql?: unknown;
    automatic_agent_or_model_invocation?: boolean;
  };
  field?: {
    focus?: string[];
    changes?: unknown[];
    objects?: unknown[];
    relations?: unknown[];
    sources?: Array<{ source?: string; agent_retrieval_allowed?: boolean }>;
    returns?: unknown[];
    tensions?: string[];
    truncated?: boolean;
    changed_source_payloads_retrieved?: boolean;
    automatic_agent_or_model_invocation?: boolean;
  };
  automatic_agent_or_model_invocation?: boolean;
};

type ContemplateResult = {
  version: string;
  transport: string;
  agent_session: string;
  preflight: BoundedPreflight;
  agent_wiki: {
    current_index_revision: string;
    stale_resources: string[];
    next_objects: unknown[];
    human_source_proposals: Array<{ source: string; reason: string; evidence?: string[] }>;
  };
  integrative_readings: unknown[];
  candidates: string[];
  tensions: string[];
  human_source_mutation_performed: boolean;
};

export function LivingWikiWorkbench({ selection }: LivingWikiProps) {
  const [reading, setReading] = useState<LivingWikiDesktopReading | null>(null);
  const [preflight, setPreflight] = useState<BoundedPreflight | null>(null);
  const [result, setResult] = useState<ContemplateResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'status' | 'preview' | 'contemplate' | ''>('');

  const summary = useMemo(() => reading ? livingSummary(reading) : null, [reading]);
  const related = useMemo(
    () => reading ? relatedLivingState(reading, selection?.ref) : null,
    [reading, selection?.ref],
  );

  async function refresh() {
    setBusy('status');
    try {
      const next = await invoke<LivingWikiDesktopReading>('living_knowledge_status');
      setReading(next);
      setError('');
    } catch (reason) {
      setReading(null);
      setError(messageFrom(reason));
    } finally {
      setBusy('');
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function previewContemplate() {
    if (!canContemplate(selection?.ref)) return;
    setBusy('preview');
    try {
      const next = await invoke<BoundedPreflight>('living_contemplate_preflight', {
        focus: [selection!.ref],
      });
      setPreflight(next);
      setResult(null);
      setError('');
    } catch (reason) {
      setPreflight(null);
      setError(messageFrom(reason));
    } finally {
      setBusy('');
    }
  }

  async function contemplate() {
    if (!canContemplate(selection?.ref)) return;
    setBusy('contemplate');
    try {
      const next = await invoke<ContemplateResult>('living_contemplate', {
        focus: [selection!.ref],
      });
      setResult(next);
      setPreflight(next.preflight);
      setError('');
      await refresh();
    } catch (reason) {
      setResult(null);
      setError(messageFrom(reason));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="oi-living" aria-label="Living Knowledge">
      <header className="oi-living__header">
        <div>
          <p className="oi-eyebrow">Living Knowledge</p>
          <h3>Changed → Affected → Pending</h3>
          <p className="oi-muted">Central source revisions · AIKit dependency impact · deliberate Contemplate</p>
        </div>
        <button type="button" disabled={busy !== ''} onClick={() => void refresh()}>Re-read owners</button>
      </header>

      {error && <p className="oi-workbench__error">{error}</p>}

      {reading && summary && <>
        <div className="oi-living__summary" aria-label="Living Knowledge summary">
          <LivingCount label="Changed" value={summary.changed} />
          <LivingCount label="Affected" value={summary.affected} />
          <LivingCount label="Pending integration" value={summary.pending} />
        </div>
        <p className="oi-living__owner-line">
          source truth <strong>{reading.source_authority_owner}</strong> · impact <strong>{reading.impact_owner}</strong> · Contemplate <strong>{reading.contemplate_owner}</strong>
        </p>
        <div className="oi-living__laws">
          <code>source payloads exposed = {String(reading.source_payloads_exposed)}</code>
          <code>automatic Agent/model = {String(reading.automatic_agent_or_model_invocation)}</code>
          <code>horizon cursor = {reading.cursor}</code>
        </div>

        <details className="oi-living__details" open={summary.changed > 0}>
          <summary>Changed source revisions <small>{summary.changed}</small></summary>
          <div className="oi-living__rows">
            {reading.changed.map((entry) => <article key={`${entry.cursor}:${entry.source_ref}`} className="oi-living__row">
              <div><strong>{entry.source_ref}</strong><span>{entry.kind} · {entry.standing}</span></div>
              <small>{entry.provenance}{entry.roles.length ? ` · ${entry.roles.join(' · ')}` : ''}</small>
              {!entry.agent_retrieval_allowed && <em>Agent retrieval excluded</em>}
            </article>)}
            {!reading.changed.length && <p className="oi-muted">No source revision differences in the current Central horizon.</p>}
          </div>
        </details>

        <details className="oi-living__details">
          <summary>Affected knowledge <small>{summary.affected}</small></summary>
          <div className="oi-living__rows">
            {reading.impact.direct.affected.map((entry) => <article key={`direct:${entry.resource}:${entry.source}`} className="oi-living__row">
              <div><strong>{entry.resource}</strong><span>{freshnessLabel(entry.freshness)}</span></div>
              <small>{entry.relation} ← {entry.source}</small>
            </article>)}
            {reading.impact.transitive.map((entry) => <article key={`transitive:${entry.resource}:${entry.root_source}`} className="oi-living__row">
              <div><strong>{entry.resource}</strong><span>{freshnessLabel(entry.freshness)}</span></div>
              <small>{entry.relation} · through dependency field from {entry.root_source}</small>
            </article>)}
          </div>
        </details>

        <details className="oi-living__details">
          <summary>Impact paths <small>{reading.impact.paths.length}</small></summary>
          <div className="oi-living__rows">
            {reading.impact.paths.map((path, index) => <article key={`${path.resource}:${path.root_source}:${index}`} className="oi-living__path">
              <strong>{path.root_source} → {path.resource}</strong>
              <span>{freshnessLabel(path.freshness)}</span>
              <ol>{path.steps.map((step, stepIndex) => <li key={stepIndex}><code>{step.relation}</code> → {step.to}</li>)}</ol>
            </article>)}
          </div>
        </details>
      </>}

      <article className="oi-living__current">
        <div>
          <p className="oi-eyebrow">Current stable subject</p>
          <h4>{selection?.ref ?? 'Select a source, Wiki subject or reading'}</h4>
          {related && <p className="oi-muted">
            {related.changed.length} changed source relation · {related.affected.length} affected relation · {related.paths.length} impact path{related.paths.length === 1 ? '' : 's'}{related.pending ? ' · pending integration' : ''}
          </p>}
        </div>
        <div className="oi-living__actions">
          <button type="button" disabled={!canContemplate(selection?.ref) || busy !== ''} onClick={() => void previewContemplate()}>Preview Contemplate</button>
          <button className="oi-living__contemplate" type="button" disabled={!canContemplate(selection?.ref) || busy !== ''} onClick={() => void contemplate()}>Contemplate</button>
        </div>
      </article>

      {preflight && <details className="oi-living__preflight" open>
        <summary>Deterministic preflight</summary>
        <div className="oi-living__preflight-grid">
          <PreflightFact label="Focus" value={(preflight.field?.focus ?? preflight.base?.focus ?? []).join(' · ') || '—'} />
          <PreflightFact label="Agent" value={preflight.base?.agent ?? 'unresolved'} />
          <PreflightFact label="Agency" value={preflight.base?.agency ?? 'unresolved'} />
          <PreflightFact label="Model" value={preflight.base?.runtime_model ?? 'unresolved'} />
          <PreflightFact label="Harness" value={preflight.base?.harness ?? 'unresolved'} />
          <PreflightFact label="Formal / QL" value={preflight.base?.ql ? 'attached by owner profile' : 'ordinary path'} />
          <PreflightFact label="Changed payload retrieval" value={String(preflight.field?.changed_source_payloads_retrieved ?? false)} />
          <PreflightFact label="Automatic Agent/model" value={String(preflight.automatic_agent_or_model_invocation ?? preflight.field?.automatic_agent_or_model_invocation ?? false)} />
        </div>
        <p className="oi-muted">{preflight.field?.objects?.length ?? 0} Wiki objects · {preflight.field?.relations?.length ?? 0} relations · {preflight.field?.changes?.length ?? 0} relevant changes · {preflight.field?.returns?.length ?? 0} reversible returns{preflight.field?.truncated ? ' · bounded/truncated' : ''}</p>
      </details>}

      {result && <section className="oi-living__return" aria-label="Contemplate return">
        <header><p className="oi-eyebrow">Attributable return</p><h4>{result.agent_session}</h4><small>{result.transport}</small></header>
        <div className="oi-living__return-grid">
          <ReturnGroup title="Agent Wiki" count={result.agent_wiki.next_objects.length}>
            <p>Owner maintenance plan over canonical Wiki revision <code>{result.agent_wiki.current_index_revision}</code>.</p>
            {!!result.agent_wiki.stale_resources.length && <p>{result.agent_wiki.stale_resources.length} prior resource{result.agent_wiki.stale_resources.length === 1 ? '' : 's'} have moved basis.</p>}
          </ReturnGroup>
          <ReturnGroup title="Integrative readings" count={result.integrative_readings.length}>
            <p>Derived readings retain exact basis/provenance through AIKit.</p>
          </ReturnGroup>
          <ReturnGroup title="Tensions / candidates" count={result.tensions.length + result.candidates.length}>
            {result.tensions.map((entry) => <span key={`t:${entry}`}>{entry}</span>)}
            {result.candidates.map((entry) => <span key={`c:${entry}`}>{entry}</span>)}
          </ReturnGroup>
          <ReturnGroup title="Human-source proposals" count={result.agent_wiki.human_source_proposals.length}>
            {result.agent_wiki.human_source_proposals.map((proposal, index) => <article key={`${proposal.source}:${index}`} className="oi-living__proposal"><strong>Proposal · Recognition required</strong><span>{proposal.source}</span><p>{proposal.reason}</p></article>)}
            <small>Human source mutation performed = {String(result.human_source_mutation_performed)}</small>
          </ReturnGroup>
        </div>
      </section>}
    </section>
  );
}

function LivingCount({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function PreflightFact({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function ReturnGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <article><header><strong>{title}</strong><small>{count}</small></header>{children}</article>;
}

function messageFrom(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
