import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { WorkbenchEvidence, WorkbenchSemanticRef } from './workbench';
import './native-command.css';

type PaletteMode = 'search' | 'command';

type Availability =
  | 'available'
  | 'unresolved'
  | 'unavailable'
  | 'ready'
  | 'degraded'
  | 'pending-native-adapter'
  | 'unknown';

type ContextAvailability =
  | 'available'
  | { unresolved: { reasons: string[] } }
  | { unavailable: { reasons: string[] } };

type ContextResource = {
  resource: {
    descriptor: {
      id: string;
      kind: string;
      name: string;
      description: string;
      owner?: string;
    };
    eligibility?: unknown;
    providers?: unknown[];
  };
  availability: ContextAvailability;
};

type ContextResolution = {
  version: string;
  project_binding: { project: string };
  agent?: unknown;
  agency?: unknown;
  host?: unknown;
  capabilities: ContextResource[];
  actions: ContextResource[];
  context_sources: ContextResource[];
  model_candidates: ContextResource[];
  harness_candidates: ContextResource[];
  execution_offers: ContextResource[];
  warnings: string[];
};

type Contribution = {
  contribution: {
    contribution_ref: string;
    native_owner: string;
    availability: string;
    provenance: { source: string; revision?: string };
    read_model_ref?: WorkbenchSemanticRef;
    accepted_selection_kinds?: string[];
    actions?: Array<{
      action_ref: string;
      native_owner: string;
      availability: string;
      required_capability_ref?: string;
    }>;
  };
};

type SessionSpaceState = {
  definition: { id: string };
  label?: string;
  revision: number;
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

type KnowledgeSearchResult = { hits: KnowledgeHit[]; absences: string[] };

type FactoryBuildSnapshot = {
  revision: number;
  view: {
    actions: Array<{
      actionRef: string;
      label: string;
      subjectKinds: string[];
      requiredCapabilityRef: string;
    }>;
  };
};

export type NativePaletteResult = {
  channel: 'reading' | 'action';
  ref: string;
  kind: string;
  label: string;
  summary: string;
  nativeOwner: string;
  source: string;
  availability: Availability;
  subjectRef?: string;
  subjectKind?: string;
  requiredCapabilityRef?: string;
  authority: string;
};

export function NativeSearchCommand({
  selection,
  onSelect,
  onActionResult,
}: {
  selection?: WorkbenchSemanticRef;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
  onActionResult?: (result: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NativePaletteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function openFromHost(event: Event) {
      const detail = (event as CustomEvent<{ mode?: PaletteMode }>).detail;
      setMode(detail?.mode ?? 'search');
      setOpen(true);
    }
    window.addEventListener('oi:open-command', openFromHost);
    return () => window.removeEventListener('oi:open-command', openFromHost);
  }, []);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
    void refresh(query);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => void refresh(query), 70);
    return () => window.clearTimeout(handle);
  }, [query, selection?.ref, open, mode]);

  const visible = useMemo(
    () => results.filter((result) => mode === 'command' ? result.channel === 'action' : result.channel === 'reading'),
    [results, mode],
  );

  async function refresh(nextQuery: string) {
    const trimmed = nextQuery.trim();
    const gathered: NativePaletteResult[] = [];
    const [context, contributions, spaces, factory] = await Promise.all([
      invoke<ContextResolution | null>('aikit_context_resolution').catch(() => null),
      invoke<Contribution[]>('contribution_catalog').catch(() => []),
      invoke<SessionSpaceState[]>('aikit_session_spaces').catch(() => []),
      invoke<FactoryBuildSnapshot | null>('factory_build_snapshot').catch(() => null),
    ]);

    if (context) gathered.push(...contextResults(context));
    gathered.push(...contributionResults(contributions, selection));
    gathered.push(...sessionSpaceResults(spaces));
    gathered.push(...factoryActionResults(factory, selection));

    if (trimmed) {
      const knowledge = await invoke<KnowledgeSearchResult>('knowledge_search', { query: trimmed, limit: 12 }).catch(() => null);
      if (knowledge) gathered.push(...knowledgeResults(knowledge));
    }

    const next = dedupe(gathered)
      .filter((result) => !trimmed || resultMatches(result, trimmed))
      .sort((left, right) => rankResult(right, trimmed) - rankResult(left, trimmed) || left.label.localeCompare(right.label))
      .slice(0, 60);
    setResults(next);
    setSelectedIndex(0);
  }

  async function activateResult(result: NativePaletteResult) {
    if (result.channel === 'reading') {
      const subject: WorkbenchSemanticRef = {
        ref: result.ref,
        kind: result.kind,
        native_owner: result.nativeOwner,
        provenance: { source: result.source },
      };
      await onSelect(subject, {
        title: result.label,
        summary: `${result.summary} · ${result.availability}`,
        detail: { nativeOwner: result.nativeOwner, authority: result.authority, source: result.source },
      });
      setStatus(`Selected ${result.ref}. Selection is a ref; Agent Context disclosure remains native-owned.`);
      setOpen(false);
      return;
    }

    if (!result.subjectRef) {
      setStatus('Action is discoverable, but no current native subject binding applies. No invocation was attempted.');
      return;
    }
    if (result.nativeOwner !== 'software-factory' && result.nativeOwner !== 'factory') {
      setStatus(`Action ${result.ref} remains native-owned by ${result.nativeOwner}; this P1 host has no owner dispatcher binding for it.`);
      return;
    }

    try {
      const returned = await invoke('dispatch_contextual_factory_action', {
        emission: { actionRef: result.ref, subjectRef: result.subjectRef },
        operationId: crypto.randomUUID(),
      });
      onActionResult?.(returned);
      setStatus(`Native ${result.nativeOwner} handler returned for ${result.ref}.`);
      setOpen(false);
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function onPaletteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(0, visible.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const result = visible[selectedIndex];
      if (result) void activateResult(result);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = visible[selectedIndex];
    if (result) void activateResult(result);
  }

  return (
    <>
      <div className="oi-native-command__triggers" aria-label="Universal Search and Command">
        <button type="button" onClick={() => { setMode('search'); setOpen(true); }}>Search <kbd>⌘P</kbd></button>
        <button type="button" onClick={() => { setMode('command'); setOpen(true); }}>Command <kbd>⌘K</kbd></button>
      </div>
      {open && (
        <div className="oi-native-command__backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="oi-native-command" role="dialog" aria-modal="true" aria-label={mode === 'command' ? 'Command palette' : 'Universal search'}>
            <header>
              <div className="oi-native-command__mode">
                <button type="button" data-active={mode === 'search'} onClick={() => setMode('search')}>Search</button>
                <button type="button" data-active={mode === 'command'} onClick={() => setMode('command')}>Command</button>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Search or Command">Esc</button>
            </header>
            <form onSubmit={onSubmit}>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onPaletteKeyDown}
                placeholder={mode === 'command' ? 'Find a native Action' : 'Find a native Resource or Reading'}
                aria-label={mode === 'command' ? 'Find native Action' : 'Find native Resource'}
              />
            </form>
            <div className="oi-native-command__results" role="listbox">
              {visible.map((result, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  key={`${result.channel}:${result.ref}:${result.subjectRef ?? '-'}`}
                  data-selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => void activateResult(result)}
                >
                  <span className="oi-native-command__result-main">
                    <strong>{result.label}</strong>
                    <small>{result.summary}</small>
                  </span>
                  <span className="oi-native-command__result-meta">
                    <code>{result.ref}</code>
                    <span>{result.nativeOwner}</span>
                    {result.subjectRef && <span>subject · {result.subjectRef}</span>}
                    <span>{result.availability}</span>
                    {result.requiredCapabilityRef && <span>requires · {result.requiredCapabilityRef}</span>}
                    <span>{result.authority}</span>
                  </span>
                </button>
              ))}
              {!visible.length && <p>No current native {mode === 'command' ? 'Action' : 'Resource/Reading'} descriptors match.</p>}
            </div>
            <footer>
              <span>ResourceRef / ActionRef preserved</span>
              <span>discoverable ≠ authorised</span>
              <span>selection ≠ Context disclosure</span>
            </footer>
          </section>
        </div>
      )}
      {status && <span className="oi-native-command__status" role="status">{status}</span>}
    </>
  );
}

function contextResults(context: ContextResolution): NativePaletteResult[] {
  const resourceGroups = [
    ...context.capabilities,
    ...context.context_sources,
    ...context.model_candidates,
    ...context.harness_candidates,
    ...context.execution_offers,
  ];
  const readings = resourceGroups.map((entry) => resourceResult(entry, 'reading'));
  const actions = context.actions.map((entry) => resourceResult(entry, 'action'));
  return [...readings, ...actions];
}

function resourceResult(entry: ContextResource, channel: 'reading' | 'action'): NativePaletteResult {
  const descriptor = entry.resource.descriptor;
  return {
    channel,
    ref: descriptor.id,
    kind: descriptor.kind,
    label: descriptor.name,
    summary: descriptor.description,
    nativeOwner: descriptor.owner ?? 'native-owner-unresolved',
    source: 'AIKit ContextResolution',
    availability: availabilityFrom(entry.availability),
    authority: channel === 'action' ? 'native authority required at invocation' : 'native reading',
  };
}

function contributionResults(contributions: Contribution[], selection?: WorkbenchSemanticRef): NativePaletteResult[] {
  const results: NativePaletteResult[] = [];
  for (const { contribution } of contributions) {
    if (contribution.read_model_ref) {
      results.push({
        channel: 'reading',
        ref: contribution.read_model_ref.ref,
        kind: contribution.read_model_ref.kind,
        label: contribution.contribution_ref,
        summary: `Native contribution reading from ${contribution.native_owner}`,
        nativeOwner: contribution.native_owner,
        source: contribution.provenance.source,
        availability: contributionAvailability(contribution.availability),
        authority: 'read-only contribution projection',
      });
    }
    const subjectApplies = Boolean(selection && contribution.accepted_selection_kinds?.includes(selection.kind));
    for (const action of contribution.actions ?? []) {
      results.push({
        channel: 'action',
        ref: action.action_ref,
        kind: 'action',
        label: action.action_ref,
        summary: `Canonical Action from ${action.native_owner}`,
        nativeOwner: action.native_owner,
        source: contribution.provenance.source,
        availability: action.availability === 'available' ? 'available' : 'unavailable',
        subjectRef: subjectApplies ? selection?.ref : undefined,
        subjectKind: subjectApplies ? selection?.kind : undefined,
        requiredCapabilityRef: action.required_capability_ref,
        authority: 'native authority required at invocation',
      });
    }
  }
  return results;
}

function sessionSpaceResults(spaces: SessionSpaceState[]): NativePaletteResult[] {
  return spaces.map((space) => ({
    channel: 'reading',
    ref: space.definition.id,
    kind: 'session-space',
    label: space.label ?? space.definition.id,
    summary: `AIKit SessionSpace application revision ${space.revision}`,
    nativeOwner: 'ai-kit',
    source: 'AIKit SessionSpace application',
    availability: 'available',
    authority: 'native reading',
  }));
}

function knowledgeResults(result: KnowledgeSearchResult): NativePaletteResult[] {
  return result.hits.map((hit) => ({
    channel: 'reading',
    ref: hit.resource,
    kind: hit.kind,
    label: hit.label,
    summary: hit.snippet || `${hit.authority} Knowledge reading`,
    nativeOwner: hit.provider,
    source: `AIKit Knowledge · ${hit.authority}`,
    availability: 'available',
    authority: hit.authority,
  }));
}

function factoryActionResults(snapshot: FactoryBuildSnapshot | null, selection?: WorkbenchSemanticRef): NativePaletteResult[] {
  if (!snapshot) return [];
  return snapshot.view.actions.map((action) => {
    const applies = Boolean(selection && action.subjectKinds.includes(selection.kind));
    return {
      channel: 'action',
      ref: action.actionRef,
      kind: 'action',
      label: action.label,
      summary: 'Factory-owned contextual Build Action',
      nativeOwner: 'software-factory',
      source: `FactoryBuildView revision ${snapshot.revision}`,
      availability: 'available',
      subjectRef: applies ? selection?.ref : undefined,
      subjectKind: applies ? selection?.kind : undefined,
      requiredCapabilityRef: action.requiredCapabilityRef,
      authority: 'pre-issued native authority required; palette cannot create it',
    };
  });
}

function dedupe(results: NativePaletteResult[]) {
  const byIdentity = new Map<string, NativePaletteResult>();
  for (const result of results) {
    const key = `${result.channel}:${result.ref}:${result.subjectRef ?? '-'}`;
    const previous = byIdentity.get(key);
    if (!previous || previous.nativeOwner === 'native-owner-unresolved') byIdentity.set(key, result);
  }
  return [...byIdentity.values()];
}

function resultMatches(result: NativePaletteResult, query: string) {
  const lower = query.toLowerCase();
  return [result.label, result.summary, result.ref, result.kind, result.nativeOwner, result.subjectRef ?? '']
    .some((candidate) => candidate.toLowerCase().includes(lower) || fuzzyIncludes(candidate.toLowerCase(), lower));
}

function rankResult(result: NativePaletteResult, query: string) {
  if (!query) return result.subjectRef ? 30 : 10;
  const lower = query.toLowerCase();
  if (result.label.toLowerCase().startsWith(lower)) return 100;
  if (result.ref.toLowerCase().includes(lower)) return 80;
  if (result.summary.toLowerCase().includes(lower)) return 60;
  return 20;
}

function fuzzyIncludes(candidate: string, query: string) {
  let index = 0;
  for (const character of candidate) {
    if (character === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return query.length === 0;
}

function availabilityFrom(value: ContextAvailability): Availability {
  if (value === 'available') return 'available';
  if ('unresolved' in value) return 'unresolved';
  if ('unavailable' in value) return 'unavailable';
  return 'unknown';
}

function contributionAvailability(value: string): Availability {
  if (value === 'ready' || value === 'degraded') return value;
  if (value === 'pending_native_adapter') return 'pending-native-adapter';
  if (value === 'unavailable') return 'unavailable';
  return 'unknown';
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
