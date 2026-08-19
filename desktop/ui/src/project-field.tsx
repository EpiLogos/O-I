import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { WorkbenchEvidence, WorkbenchSemanticRef } from './workbench';
import './project-field.css';

type NativeOwnerReading = {
  owner: string;
  action: string;
  available: boolean;
  data?: unknown;
  error?: string;
};

type SourceDescriptor = {
  source: string;
  relative_path: string;
  kind: string;
  standing: string;
  provenance: string;
  truth_standing: string;
  roles: string[];
  treatment: string;
  recognition?: string;
  exists: boolean;
  agent_readable: boolean;
  is_directory: boolean;
  revision?: string;
};

type ContextSourceHit = {
  resource: string;
  name: string;
  relation: { project?: string };
  freshness: unknown;
  disclosure: {
    exists: boolean;
    known_to_exist: boolean;
    askable: boolean;
    retrieved: boolean;
    focused: boolean;
  };
  availability: unknown;
  eligibility: unknown;
  sources: unknown[];
  providers: string[];
};

type LocalSource = {
  source: string;
  relative_path: string;
  candidate: { path: string };
  classification: { role: string; authority: string; reason: string };
};

type ProjectFieldSnapshot = {
  version: string;
  project: string;
  orientation: {
    project_id: string;
    human_root: string;
    human_material_count: number;
    recognised_human_source_count: number;
    ground_status: string;
    governance_present: boolean;
    canonical_wiki: string;
    canonical_wiki_exists: boolean;
    native_project_root: string;
  };
  account: {
    preferred_authored_aperture: string;
    preferred_human_sources: Array<{
      source: string;
      relative_path: string;
      provenance: string;
      truth_standing: string;
      roles: string[];
      treatment: string;
    }>;
    other_source_relations: unknown[];
    agent_wiki: string;
    native_project_root: string;
  };
  sources: SourceDescriptor[];
  source_horizon: ContextSourceHit[];
  local_sources: {
    version: string;
    files_visited: number;
    truncated: boolean;
    sources: LocalSource[];
  };
  central_actions: string[];
  projects: NativeOwnerReading;
  ground: NativeOwnerReading;
  now_day: NativeOwnerReading;
  project_map: {
    owner: string;
    version: string;
    available: boolean;
    source?: string;
    error?: string;
  };
  disclosure_law: string[];
};

type WorkItem = { name: string; path?: string; [key: string]: unknown };
type SourceMode = 'source' | 'ground' | 'knowledge' | 'map' | 'now';

type ProjectFieldProps = {
  selection?: WorkbenchSemanticRef;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
};

function useProjectField() {
  const [snapshot, setSnapshot] = useState<ProjectFieldSnapshot | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setSnapshot(await invoke<ProjectFieldSnapshot>('project_field_snapshot'));
      setError('');
    } catch (reason) {
      setSnapshot(null);
      setError(messageFrom(reason));
    }
  }

  useEffect(() => { void refresh(); }, []);
  return { snapshot, error, refresh };
}

export function ProjectNavigator({ selection, onSelect }: ProjectFieldProps) {
  const { snapshot, error, refresh } = useProjectField();
  const projects = workItems(snapshot?.projects.data);
  const sources = snapshot?.sources.filter((entry) => !entry.is_directory) ?? [];
  const recognised = sources.filter(isRecognisedHumanSource);
  const wiki = sources.filter((entry) => entry.kind === 'canonical-wiki' || entry.kind === 'adopted-wiki' || entry.kind === 'root-wiki');
  const other = sources.filter((entry) => !recognised.includes(entry) && !wiki.includes(entry));

  async function selectSource(source: SourceDescriptor) {
    await onSelect(
      semanticSource(source),
      {
        title: source.relative_path,
        summary: sourceSummary(source),
        detail: source,
      },
    );
  }

  async function selectProject() {
    if (!snapshot) return;
    await onSelect(
      {
        ref: snapshot.project,
        kind: 'project',
        native_owner: 'ai-kit',
        provenance: { source: 'AIKit ProjectCentral binding' },
      },
      {
        title: snapshot.orientation.project_id,
        summary: `Project identity from Central manifest · Ground ${snapshot.orientation.ground_status}`,
        detail: snapshot.orientation,
      },
    );
  }

  return (
    <section className="oi-project-nav" aria-label="Project Navigator">
      <header className="oi-project-nav__header">
        <div><p className="oi-eyebrow">Native Project field</p><strong>Projects & source</strong></div>
        <button type="button" onClick={() => void refresh()}>↻</button>
      </header>
      {error && <p className="oi-workbench__error">Project field: {error}</p>}
      {snapshot && (
        <>
          <NavGroup title="Current Project" count={1}>
            <NavRef
              label={snapshot.orientation.project_id}
              meta={`Ground · ${snapshot.orientation.ground_status}`}
              active={selection?.ref === snapshot.project}
              onClick={() => void selectProject()}
            />
          </NavGroup>
          <NavGroup title="Projects" count={projects.length}>
            {projects.map((project) => (
              <ProjectWorkItem key={project.name} project={project} />
            ))}
            {!snapshot.projects.available && <OwnerAbsence reading={snapshot.projects} />}
          </NavGroup>
          <NavGroup title="Human Ground" count={recognised.length}>
            {recognised.map((source) => (
              <NavRef key={source.source} label={source.relative_path} meta={source.truth_standing} active={selection?.ref === source.source} onClick={() => void selectSource(source)} />
            ))}
          </NavGroup>
          <NavGroup title="Agent Wiki" count={wiki.length}>
            {wiki.map((source) => (
              <NavRef key={source.source} label={source.relative_path} meta="agent-maintained" active={selection?.ref === source.source} onClick={() => void selectSource(source)} />
            ))}
          </NavGroup>
          <NavGroup title="Project source" count={other.length}>
            {other.slice(0, 18).map((source) => (
              <NavRef key={source.source} label={source.relative_path} meta={`${source.provenance} · ${source.truth_standing}`} active={selection?.ref === source.source} onClick={() => void selectSource(source)} />
            ))}
          </NavGroup>
          <NavGroup title="NOW / DAY" count={snapshot.now_day.available ? 1 : 0}>
            <span className="oi-project-nav__quiet">{snapshot.now_day.available ? 'Native temporal field available' : 'No accepted/configured NOW owner reading'}</span>
          </NavGroup>
        </>
      )}
    </section>
  );
}

export function ProjectFieldCanvas({ selection, onSelect }: ProjectFieldProps) {
  const { snapshot, error, refresh } = useProjectField();
  const [mode, setMode] = useState<SourceMode>('source');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ContextSourceHit[]>([]);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedSource = useMemo(
    () => snapshot?.sources.find((source) => source.source === selection?.ref),
    [snapshot, selection],
  );

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await invoke<ContextSourceHit[]>('project_source_search', { query: query.trim() });
      setHits(result);
      setMode('source');
      setDetail(null);
      setDetailError('');
    } catch (reason) {
      setDetailError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  async function selectHit(hit: ContextSourceHit) {
    const source = snapshot?.sources.find((entry) => entry.source === hit.resource);
    await onSelect(
      source ? semanticSource(source) : {
        ref: hit.resource,
        kind: 'context-source',
        native_owner: 'ai-kit',
        provenance: { source: 'AIKit ContextSourceIndex' },
      },
      {
        title: hit.name,
        summary: `selected only · retrieved=${hit.disclosure.retrieved} · Agent Context unchanged`,
        detail: hit,
      },
    );
  }

  async function readSelected() {
    if (!selection) return;
    setBusy(true);
    try {
      const result = await invoke('project_source_read', { resourceRef: selection.ref });
      setDetail(result);
      setMode('source');
      setDetailError('');
      await refresh();
    } catch (reason) {
      setDetailError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  async function explainSelected() {
    if (!selection) return;
    setBusy(true);
    try {
      setDetail(await invoke('project_source_explain', { resourceRef: selection.ref }));
      setDetailError('');
    } catch (reason) {
      setDetailError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  async function reflectSelected() {
    if (!selection) return;
    setBusy(true);
    try {
      setDetail(await invoke('project_reflection', { resourceRef: selection.ref }));
      setMode('map');
      setDetailError('');
    } catch (reason) {
      setDetailError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  async function ownerAction(action: string, input: unknown) {
    setBusy(true);
    try {
      setDetail(await invoke('project_owner_action', { action, input }));
      setDetailError('');
      await refresh();
    } catch (reason) {
      setDetailError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <section className="oi-project-field"><p className="oi-workbench__error">Project field: {error}</p></section>;
  if (!snapshot) return <section className="oi-project-field"><p className="oi-muted">No native Project field configured.</p></section>;

  const selectedHorizon = snapshot.source_horizon.find((entry) => entry.resource === selection?.ref);
  const projects = workItems(snapshot.projects.data);
  const humanSources = snapshot.sources.filter(isRecognisedHumanSource);
  const wikiSources = snapshot.sources.filter((source) => source.kind.includes('wiki'));

  return (
    <section className="oi-project-field" aria-label="Projects Files Ground Knowledge ProjectMap">
      <header className="oi-project-field__header">
        <div>
          <p className="oi-eyebrow">Project · native owner composition</p>
          <h2>{snapshot.orientation.project_id}</h2>
          <p className="oi-muted">Central source authority + AIKit ResourceRef, Knowledge and ProjectMap. O:I owns presentation and stable selection only.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>Re-read owners</button>
      </header>

      <div className="oi-project-field__law" aria-label="Disclosure distinctions">
        {snapshot.disclosure_law.map((law) => <code key={law}>{law}</code>)}
      </div>

      <div className="oi-project-field__modes" role="tablist" aria-label="Project field modes">
        {(['source', 'ground', 'knowledge', 'map', 'now'] as SourceMode[]).map((entry) => (
          <button key={entry} type="button" className={mode === entry ? 'is-active' : ''} onClick={() => setMode(entry)}>{entry === 'map' ? 'ProjectMap' : entry === 'now' ? 'NOW / DAY' : entry}</button>
        ))}
      </div>

      {mode === 'source' && (
        <div className="oi-project-field__body">
          <article className="oi-project-card oi-project-card--wide">
            <p className="oi-eyebrow">Search · descriptor horizon</p>
            <form className="oi-project-field__search" onSubmit={search}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source names and descriptors" />
              <button type="submit" disabled={busy}>Search</button>
            </form>
            {!!hits.length && <div className="oi-project-field__results">{hits.map((hit) => (
              <button key={hit.resource} type="button" onClick={() => void selectHit(hit)}>
                <strong>{hit.name}</strong><span>{hit.resource}</span><small>retrieved={String(hit.disclosure.retrieved)} · selection does not retrieve</small>
              </button>
            ))}</div>}
          </article>

          <article className="oi-project-card">
            <p className="oi-eyebrow">Selected ResourceRef</p>
            {selection ? (
              <>
                <h3>{selectedSource?.relative_path ?? selection.ref}</h3>
                <p>{selectedSource ? sourceSummary(selectedSource) : selection.kind}</p>
                <dl className="oi-project-field__facts">
                  <dt>Selected</dt><dd>yes</dd>
                  <dt>Retrieved</dt><dd>{selectedHorizon ? String(selectedHorizon.disclosure.retrieved) : 'not a ContextSource'}</dd>
                  <dt>Agent Context</dt><dd>unchanged by P2</dd>
                </dl>
                <div className="oi-project-field__actions">
                  <button type="button" disabled={!selectedHorizon || busy} onClick={() => void readSelected()}>Read source</button>
                  <button type="button" disabled={!selectedHorizon || busy} onClick={() => void explainSelected()}>Explain</button>
                  <button type="button" disabled={!snapshot.project_map.available || busy} onClick={() => void reflectSelected()}>ProjectMap</button>
                </div>
              </>
            ) : <p className="oi-muted">Choose a stable source or Knowledge ref. Nothing is retrieved merely by selecting it.</p>}
          </article>

          <article className="oi-project-card">
            <p className="oi-eyebrow">Native Projects</p>
            <h3>{projects.length} Work item{projects.length === 1 ? '' : 's'}</h3>
            {projects.slice(0, 8).map((project) => <div className="oi-project-row" key={project.name}><span>{project.name}</span><div><button type="button" onClick={() => void ownerAction('work.open', { query: project.name })}>Open</button><button type="button" onClick={() => void ownerAction('work.reveal', { query: project.name })}>Reveal</button></div></div>)}
            {!snapshot.projects.available && <OwnerAbsence reading={snapshot.projects} />}
          </article>

          <article className="oi-project-card oi-project-card--wide">
            <p className="oi-eyebrow">Explicit retrieval / reading</p>
            {detail != null ? <pre>{jsonPreview(detail)}</pre> : <p className="oi-muted">Reading and Explain results appear here. Source payload remains in its AIKit provider; O:I does not persist it.</p>}
          </article>
        </div>
      )}

      {mode === 'ground' && (
        <div className="oi-project-field__body">
          <article className="oi-project-card">
            <p className="oi-eyebrow">Human-authored Ground</p>
            <h3>{snapshot.orientation.ground_status}</h3>
            <p>{snapshot.orientation.recognised_human_source_count} explicitly recognised human source{snapshot.orientation.recognised_human_source_count === 1 ? '' : 's'}.</p>
            <small>Preferred aperture: {snapshot.account.preferred_authored_aperture}</small>
          </article>
          <article className="oi-project-card oi-project-card--wide">
            <p className="oi-eyebrow">Recognised source relations</p>
            {humanSources.map((source) => <SourceRelation key={source.source} source={source} onSelect={() => void onSelect(semanticSource(source), { title: source.relative_path, summary: sourceSummary(source), detail: source })} />)}
            {!humanSources.length && <p className="oi-muted">No source has been recognised as human-authored/adopted. Location alone is not authorship.</p>}
          </article>
          <article className="oi-project-card">
            <p className="oi-eyebrow">Central Ground owner</p>
            {snapshot.ground.available ? <pre>{jsonPreview(snapshot.ground.data)}</pre> : <OwnerAbsence reading={snapshot.ground} />}
            <button type="button" disabled={!snapshot.central_actions.includes('projectcentral.ground.plan') || busy} onClick={() => void ownerAction('projectcentral.ground.plan', { project: projectQuery(snapshot) })}>Plan in Central</button>
            <p className="oi-muted">P2 does not proxy <code>projectcentral.ground.apply</code>. Human-accepted source mutation remains at the Central authority boundary.</p>
          </article>
        </div>
      )}

      {mode === 'knowledge' && (
        <div className="oi-project-field__body">
          <article className="oi-project-card oi-project-card--wide">
            <p className="oi-eyebrow">Agent Wiki / Knowledge</p>
            <h3>{snapshot.orientation.canonical_wiki_exists ? 'Canonical Agent Wiki available' : 'Canonical Agent Wiki not materialised'}</h3>
            <p>{snapshot.orientation.canonical_wiki}</p>
            <p className="oi-muted">The Knowledge workbench below is the AIKit <strong>ProjectCentral → SemanticWikiIndex → KnowledgeApplication</strong> projection. LIST / TREE / GRAPH / Reading / Explain / History remain native AIKit operations; this P2 surface does not create a DesktopWiki.</p>
          </article>
          {wikiSources.map((source) => <article className="oi-project-card" key={source.source}><p className="oi-eyebrow">{source.kind}</p><h3>{source.relative_path}</h3><p>{source.standing} · {source.provenance}</p></article>)}
        </div>
      )}

      {mode === 'map' && (
        <div className="oi-project-field__body">
          <article className="oi-project-card">
            <p className="oi-eyebrow">AIKit ProjectMap</p>
            <h3>{snapshot.project_map.available ? 'Bound' : 'Not configured'}</h3>
            <p>{snapshot.project_map.version}</p>
            {snapshot.project_map.source && <small>{snapshot.project_map.source}</small>}
            {snapshot.project_map.error && <p className="oi-workbench__error">{snapshot.project_map.error}</p>}
          </article>
          <article className="oi-project-card oi-project-card--wide">
            <p className="oi-eyebrow">Meaning ↔ code reflection</p>
            <p className="oi-muted">Reflection is a bounded read over the existing AIKit ProjectMap. No graph is copied into O:I.</p>
            <button type="button" disabled={!selection || !snapshot.project_map.available || busy} onClick={() => void reflectSelected()}>Reflect selected ResourceRef</button>
            {detail != null && <pre>{jsonPreview(detail)}</pre>}
          </article>
        </div>
      )}

      {mode === 'now' && (
        <div className="oi-project-field__body">
          <article className="oi-project-card oi-project-card--wide">
            <p className="oi-eyebrow">Central NOW / DAY · temporal material</p>
            <h3>{snapshot.now_day.available ? 'Owner reading available' : 'Owner reading absent'}</h3>
            <p className="oi-muted">NOW/DAY is neither Project Ground nor Agent Wiki canon. P2 presents the owner reading only when the configured Central build exposes it.</p>
            {snapshot.now_day.available ? <pre>{jsonPreview(snapshot.now_day.data)}</pre> : <OwnerAbsence reading={snapshot.now_day} />}
          </article>
        </div>
      )}

      {detailError && <p className="oi-workbench__error">{detailError}</p>}
    </section>
  );
}

function NavGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <details className="oi-project-nav__group" open><summary><span>{title}</span><small>{count}</small></summary><div>{children}</div></details>;
}

function NavRef({ label, meta, active, onClick }: { label: string; meta: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`oi-project-nav__ref ${active ? 'is-active' : ''}`} onClick={onClick}><strong>{label}</strong><span>{meta}</span></button>;
}

function ProjectWorkItem({ project }: { project: WorkItem }) {
  return <div className="oi-project-nav__work"><strong>{project.name}</strong>{project.path && <span>{project.path}</span>}</div>;
}

function SourceRelation({ source, onSelect }: { source: SourceDescriptor; onSelect: () => void }) {
  return <button type="button" className="oi-source-relation" onClick={onSelect}><strong>{source.relative_path}</strong><span>{source.provenance} · {source.truth_standing}</span><small>{source.roles.join(' · ') || source.treatment}</small></button>;
}

function OwnerAbsence({ reading }: { reading: NativeOwnerReading }) {
  return <p className="oi-project-nav__quiet">{reading.action}: {reading.error ?? 'native owner reading unavailable'}</p>;
}

function isRecognisedHumanSource(source: SourceDescriptor) {
  return source.provenance === 'human-authored' || source.provenance === 'human-adopted';
}

function semanticSource(source: SourceDescriptor): WorkbenchSemanticRef {
  return {
    ref: source.source,
    kind: source.kind,
    native_owner: source.kind.includes('wiki') ? 'ai-kit' : 'central',
    provenance: { source: `${source.provenance}:${source.relative_path}`, revision: source.revision },
  };
}

function sourceSummary(source: SourceDescriptor) {
  return `${source.provenance} · ${source.truth_standing} · ${source.treatment}`;
}

function workItems(value: unknown): WorkItem[] {
  if (!value || typeof value !== 'object') return [];
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is WorkItem => !!item && typeof item === 'object' && typeof (item as WorkItem).name === 'string');
}

function projectQuery(snapshot: ProjectFieldSnapshot) {
  const projects = workItems(snapshot.projects.data);
  const direct = projects.find((item) => item.name === snapshot.orientation.project_id || snapshot.orientation.project_id.endsWith(`/${item.name}`));
  return direct?.name ?? snapshot.orientation.project_id.split('/').at(-1) ?? snapshot.orientation.project_id;
}

function jsonPreview(value: unknown) {
  const rendered = JSON.stringify(value, null, 2) ?? '';
  return rendered.length > 12000 ? `${rendered.slice(0, 12000)}\n…` : rendered;
}

function messageFrom(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
