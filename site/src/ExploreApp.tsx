import { useEffect, useMemo, useState } from 'react';
import { OIGlyph } from '@/components/ui/oi-mark';
import {
  WorldPresentationRenderer,
  type PresentationBinding,
  type PresentationRegion,
  type WorldPresentation,
} from '@/explore/presentation-components';
// @ts-ignore -- tested JS application boundary over canonical shared-field contracts.
import { createExploreBrowserModel } from '../explore-read-model.mjs';

type ExploreEntry = {
  ref: string;
  kind: string;
  world_ref: string;
  label: string;
  summary?: string;
  revision?: string;
  provenance: Array<{ kind: string; ref: string; source_system: string; revision?: string }>;
  locators: Array<{ surface: string; locator: string }>;
  has_world_presentation?: boolean;
};

type ExploreEdge = {
  from: string;
  to: string;
  relation: string;
  origin: string;
  provenance: Array<{ source_system: string; ref: string; revision?: string }>;
};

type ExploreOpen = {
  resource: ExploreEntry;
  world?: ExploreEntry;
  world_presentation?: WorldPresentation;
  world_presentation_projection?: Record<string, unknown>;
  relations: {
    focus: string;
    depth: number;
    budget: number;
    nodes: ExploreEntry[];
    edges: ExploreEdge[];
    truncated: boolean;
  };
  sources?: { ref: string; revision?: string; provenance: ExploreEntry['provenance'] };
  explain?: Record<string, unknown>;
  actions: string[];
};

type ExploreModel = {
  worlds(): ExploreEntry[];
  search(query?: string, options?: Record<string, unknown>): ExploreEntry[];
  open(ref: string, options?: Record<string, unknown>): ExploreOpen | undefined;
};

type FieldMode = 'list' | 'tree' | 'graph';
type AppMode = 'field' | 'compose';

const DRAFT_KEY = 'oi.explore.world-presentation-draft/v1';

function kindLabel(kind: string) {
  return kind
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function relationPeer(edge: ExploreEdge, focus: string) {
  return edge.from === focus ? edge.to : edge.from;
}

function Provenance({ entry }: { entry: ExploreEntry }) {
  return (
    <div className="explore-provenance">
      {entry.provenance.map((item, index) => (
        <div key={`${item.ref}:${index}`}>
          <span>{item.source_system}</span>
          <strong>{item.ref}</strong>
          {item.revision ? <code>{item.revision}</code> : null}
        </div>
      ))}
    </div>
  );
}

function ListField({ opened, onOpen }: { opened: ExploreOpen; onOpen: (ref: string) => void }) {
  return (
    <div className="relation-list">
      {opened.relations.nodes.map((node) => {
        const relations = opened.relations.edges.filter((edge) => edge.from === node.ref || edge.to === node.ref);
        return (
          <button
            type="button"
            key={node.ref}
            className={node.ref === opened.resource.ref ? 'relation-row relation-row--focus' : 'relation-row'}
            onClick={() => onOpen(node.ref)}
          >
            <span className="relation-row__kind">{kindLabel(node.kind)}</span>
            <strong>{node.label}</strong>
            <span>{node.summary ?? node.ref}</span>
            <small>{relations.length} relation{relations.length === 1 ? '' : 's'}</small>
          </button>
        );
      })}
    </div>
  );
}

function TreeField({ opened, onOpen }: { opened: ExploreOpen; onOpen: (ref: string) => void }) {
  const byRef = new Map(opened.relations.nodes.map((node) => [node.ref, node]));
  return (
    <div className="relation-tree">
      <button type="button" className="relation-tree__root" onClick={() => onOpen(opened.resource.ref)}>
        <span>Focus</span>
        <strong>{opened.resource.label}</strong>
      </button>
      <div className="relation-tree__branches">
        {opened.relations.edges
          .filter((edge) => edge.from === opened.resource.ref || edge.to === opened.resource.ref)
          .map((edge, index) => {
            const peerRef = relationPeer(edge, opened.resource.ref);
            const peer = byRef.get(peerRef);
            if (!peer) return null;
            return (
              <button type="button" key={`${edge.from}:${edge.to}:${edge.relation}:${index}`} onClick={() => onOpen(peerRef)}>
                <span>{edge.relation}</span>
                <strong>{peer.label}</strong>
                <small>{edge.origin}</small>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function GraphField({ opened, onOpen }: { opened: ExploreOpen; onOpen: (ref: string) => void }) {
  const nodes = opened.relations.nodes.slice(0, 12);
  const focusIndex = Math.max(0, nodes.findIndex((node) => node.ref === opened.resource.ref));
  const ordered = [nodes[focusIndex], ...nodes.filter((_, index) => index !== focusIndex)].filter(Boolean);
  const positions = new Map<string, { x: number; y: number }>();
  ordered.forEach((node, index) => {
    if (index === 0) {
      positions.set(node.ref, { x: 50, y: 50 });
      return;
    }
    const angle = ((index - 1) / Math.max(ordered.length - 1, 1)) * Math.PI * 2 - Math.PI / 2;
    positions.set(node.ref, { x: 50 + Math.cos(angle) * 38, y: 50 + Math.sin(angle) * 36 });
  });

  return (
    <div className="relation-graph" aria-label="Bounded local relation graph">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {opened.relations.edges.map((edge, index) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          return <line key={`${edge.from}:${edge.to}:${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}
      </svg>
      {ordered.map((node, index) => {
        const position = positions.get(node.ref)!;
        return (
          <button
            type="button"
            key={node.ref}
            className={index === 0 ? 'relation-node relation-node--focus' : 'relation-node'}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            onClick={() => onOpen(node.ref)}
          >
            <span>{kindLabel(node.kind)}</span>
            <strong>{node.label}</strong>
          </button>
        );
      })}
    </div>
  );
}

function RelationField({
  opened,
  mode,
  onMode,
  onOpen,
}: {
  opened: ExploreOpen;
  mode: FieldMode;
  onMode: (mode: FieldMode) => void;
  onOpen: (ref: string) => void;
}) {
  return (
    <section className="local-whole" aria-labelledby="local-whole-title">
      <header className="local-whole__header">
        <div>
          <div className="explore-label">Bounded local whole</div>
          <h2 id="local-whole-title">Relations around this object</h2>
        </div>
        <div className="view-switch" role="group" aria-label="Relation presentation">
          {(['list', 'tree', 'graph'] as FieldMode[]).map((value) => (
            <button type="button" key={value} aria-pressed={mode === value} onClick={() => onMode(value)}>
              {value}
            </button>
          ))}
        </div>
      </header>
      {mode === 'list' ? <ListField opened={opened} onOpen={onOpen} /> : null}
      {mode === 'tree' ? <TreeField opened={opened} onOpen={onOpen} /> : null}
      {mode === 'graph' ? <GraphField opened={opened} onOpen={onOpen} /> : null}
      {opened.relations.truncated ? <p className="local-whole__truncated">Relation budget reached. Recenter to continue.</p> : null}
    </section>
  );
}

function defaultPresentation(worldRef: string, title: string): WorldPresentation {
  return {
    schema: 'oi.world-presentation/v1',
    presentation_ref: `draft:${worldRef}:presentation`,
    world_ref: worldRef,
    revision: 1,
    title,
    summary: '',
    theme: { tokens: {} },
    regions: [
      {
        region_ref: 'region:opening',
        role: 'opening',
        label: 'Opening',
        bindings: [],
      },
    ],
    provenance: [
      {
        kind: 'local-authoring-draft',
        ref: `draft:${worldRef}:presentation`,
        source_system: 'browser-local-draft',
        revision: 'draft@1',
      },
    ],
  };
}

function newTextBinding(index: number): PresentationBinding {
  return {
    binding_ref: `draft:binding:${Date.now()}:${index}`,
    component_ref: 'oi.presentation.component:text',
    portable_renderer: 'oi.presentation/text/v1',
    props: { title: 'Text', text: 'Write here.' },
    fallback: { title: 'Text', text: 'Write here.' },
    provenance: [
      {
        kind: 'local-authoring-draft',
        ref: `draft:binding:${index}`,
        source_system: 'browser-local-draft',
        revision: 'draft@1',
      },
    ],
  };
}

function PresentationComposer({ initial, onClose }: { initial?: WorldPresentation; onClose: () => void }) {
  const [worldRef, setWorldRef] = useState(initial?.world_ref ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [regions, setRegions] = useState<PresentationRegion[]>(initial?.regions ?? []);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initial) return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as WorldPresentation;
      setWorldRef(draft.world_ref ?? '');
      setTitle(draft.title ?? '');
      setSummary(draft.summary ?? '');
      setRegions(Array.isArray(draft.regions) ? draft.regions : []);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [initial]);

  const draft = useMemo<WorldPresentation | undefined>(() => {
    if (!worldRef.trim() || !title.trim()) return undefined;
    const base = initial ? structuredClone(initial) : defaultPresentation(worldRef.trim(), title.trim());
    base.world_ref = worldRef.trim();
    base.title = title.trim();
    base.summary = summary.trim();
    base.regions = regions.length ? regions : defaultPresentation(worldRef.trim(), title.trim()).regions;
    return base;
  }, [initial, regions, summary, title, worldRef]);

  function updateBinding(regionIndex: number, bindingIndex: number, patch: Record<string, string>) {
    setRegions((current) =>
      current.map((region, rIndex) => {
        if (rIndex !== regionIndex) return region;
        return {
          ...region,
          bindings: region.bindings.map((binding, bIndex) => {
            if (bIndex !== bindingIndex) return binding;
            return { ...binding, props: { ...binding.props, ...patch } };
          }),
        };
      }),
    );
    setSaved(false);
  }

  function addText(regionIndex: number) {
    setRegions((current) =>
      current.map((region, index) =>
        index === regionIndex ? { ...region, bindings: [...region.bindings, newTextBinding(region.bindings.length)] } : region,
      ),
    );
    setSaved(false);
  }

  function addRegion() {
    setRegions((current) => [
      ...current,
      {
        region_ref: `draft:region:${Date.now()}`,
        role: 'primary',
        label: `Region ${current.length + 1}`,
        bindings: [],
      },
    ]);
    setSaved(false);
  }

  function saveDraft() {
    if (!draft) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSaved(true);
  }

  async function copyDraft() {
    if (!draft) return;
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="composer-shell">
      <header className="composer-header">
        <div>
          <div className="explore-label">World presentation composer</div>
          <h1>{initial ? 'Edit projection presentation.' : 'Author a projection space.'}</h1>
          <p>
            Drafts stay browser-local until a Participant identity and Projection provider publish them. A local draft is not
            an Explore entry and does not acquire source authority by existing here.
          </p>
        </div>
        <button type="button" onClick={onClose} className="quiet-button">
          Return to field
        </button>
      </header>

      <div className="composer-grid">
        <section className="composer-controls">
          <label>
            <span>World ref</span>
            <input value={worldRef} onChange={(event) => setWorldRef(event.target.value)} placeholder="world:…" />
          </label>
          <label>
            <span>Presentation title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          </label>
          <label>
            <span>Summary</span>
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} />
          </label>

          <div className="composer-regions">
            {regions.map((region, regionIndex) => (
              <section key={region.region_ref} className="composer-region">
                <div className="composer-region__head">
                  <label>
                    <span>Region</span>
                    <input
                      value={region.label ?? ''}
                      onChange={(event) =>
                        setRegions((current) =>
                          current.map((item, index) =>
                            index === regionIndex ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button type="button" onClick={() => addText(regionIndex)}>
                    + Text component
                  </button>
                </div>
                {region.bindings.map((binding, bindingIndex) => (
                  <div key={binding.binding_ref} className="composer-binding">
                    <code>{binding.portable_renderer ?? binding.component_ref}</code>
                    <label>
                      <span>Title</span>
                      <input
                        value={typeof binding.props.title === 'string' ? binding.props.title : ''}
                        onChange={(event) => updateBinding(regionIndex, bindingIndex, { title: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Text</span>
                      <textarea
                        rows={5}
                        value={typeof binding.props.text === 'string' ? binding.props.text : ''}
                        onChange={(event) => updateBinding(regionIndex, bindingIndex, { text: event.target.value })}
                      />
                    </label>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <div className="composer-actions">
            <button type="button" onClick={addRegion}>
              + Region
            </button>
            <button type="button" onClick={saveDraft} disabled={!draft}>
              {saved ? 'Draft saved locally' : 'Save local draft'}
            </button>
            <button type="button" onClick={copyDraft} disabled={!draft}>
              {copied ? 'Copied' : 'Copy manifest'}
            </button>
          </div>
        </section>

        <section className="composer-preview" aria-label="World presentation preview">
          {draft ? (
            <WorldPresentationRenderer presentation={draft} />
          ) : (
            <div className="explore-empty explore-empty--preview">
              <strong>World ref and title are required.</strong>
              <p>The preview will render the portable composition without publishing it.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ExploreApp() {
  const [model, setModel] = useState<ExploreModel | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [fieldMode, setFieldMode] = useState<FieldMode>('graph');
  const [appMode, setAppMode] = useState<AppMode>('field');
  const [editPresentation, setEditPresentation] = useState<WorldPresentation | undefined>();

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/explore-public.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Explore provider returned ${response.status}`);
        return response.json();
      })
      .then((seed) => {
        if (!active) return;
        const nextModel = createExploreBrowserModel(seed) as ExploreModel;
        setModel(nextModel);
        const firstWorld = nextModel.worlds()[0];
        if (firstWorld) setSelectedRef(firstWorld.ref);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const allResults = useMemo(() => (model ? model.search(query, { limit: 64 }) : []), [model, query]);
  const kinds = useMemo(() => [...new Set(allResults.map((result) => result.kind))].sort(), [allResults]);
  const results = kind === 'all' ? allResults : allResults.filter((result) => result.kind === kind);
  const opened = model && selectedRef ? model.open(selectedRef, { depth: 1, budget: 18 }) : undefined;
  const worlds = model?.worlds() ?? [];

  function openRef(ref: string) {
    setSelectedRef(ref);
    setAppMode('field');
    window.requestAnimationFrame(() => document.querySelector('.explore-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function beginEdit(presentation?: WorldPresentation) {
    setEditPresentation(presentation);
    setAppMode('compose');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (appMode === 'compose') {
    return <PresentationComposer initial={editPresentation} onClose={() => setAppMode('field')} />;
  }

  return (
    <div className="explore-app oi-surface-light">
      <header className="explore-nav">
        <a href="./index.html" className="explore-nav__mark" aria-label="O:I home">
          <OIGlyph />
        </a>
        <nav>
          <a href="./index.html">Understand</a>
          <span aria-current="page">Explore</span>
          <a href="./index.html#build">Build</a>
          <button type="button" onClick={() => beginEdit()}>
            Compose
          </button>
        </nav>
      </header>

      <main>
        <section className="explore-opening">
          <div className="explore-label explore-label--signal">
            <span className="meta-signal" aria-hidden="true" /> Open field
          </div>
          <h1>Explore.</h1>
          <p>Search and move through explicitly projected worlds, agents, projects, knowledge and work.</p>
          <div className="explore-search">
            <label htmlFor="explore-query">Search the shared field</label>
            <div>
              <input
                id="explore-query"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="World, agent, project, wiki, node, ref…"
                autoComplete="off"
              />
              <span aria-hidden="true">⌕</span>
            </div>
          </div>
        </section>

        {failed ? (
          <section className="explore-empty" role="status">
            <strong>Explore provider unavailable.</strong>
            <p>The Surface is intact, but this browser could not resolve its public field provider.</p>
          </section>
        ) : null}

        {!failed && model ? (
          <section className="explore-workspace" aria-label="Explore workspace">
            <aside className="explore-index">
              <div className="explore-index__head">
                <div>
                  <span>Worlds</span>
                  <strong>{worlds.length}</strong>
                </div>
                <div>
                  <span>Results</span>
                  <strong>{results.length}</strong>
                </div>
              </div>

              {kinds.length ? (
                <div className="kind-filter" role="group" aria-label="Filter Explore results">
                  <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
                    All
                  </button>
                  {kinds.map((value) => (
                    <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
                      {kindLabel(value)}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="explore-results">
                {results.map((result) => (
                  <button
                    type="button"
                    key={result.ref}
                    className={result.ref === selectedRef ? 'explore-result explore-result--selected' : 'explore-result'}
                    onClick={() => openRef(result.ref)}
                  >
                    <span>{kindLabel(result.kind)}</span>
                    <strong>{result.label}</strong>
                    <small>{result.summary ?? result.ref}</small>
                  </button>
                ))}
              </div>
            </aside>

            <div className="explore-canvas">
              {!opened ? (
                <div className="explore-empty explore-empty--field">
                  <div className="explore-label">No projected public worlds</div>
                  <strong>The field is presently empty on this provider.</strong>
                  <p>
                    Nothing synthetic is substituted for authored Projection. Compose a local draft now, or connect a public
                    Projection provider and published worlds will appear through the same search/read-model seam.
                  </p>
                  <button type="button" onClick={() => beginEdit()}>
                    Compose a world presentation
                  </button>
                </div>
              ) : (
                <>
                  <section className="explore-focus" aria-labelledby="explore-focus-title">
                    <header>
                      <div>
                        <div className="explore-label">{kindLabel(opened.resource.kind)}</div>
                        <h2 id="explore-focus-title">{opened.resource.label}</h2>
                        <p>{opened.resource.summary}</p>
                      </div>
                      <div className="explore-focus__identity">
                        <span>Semantic ref</span>
                        <code>{opened.resource.ref}</code>
                        {opened.resource.revision ? <small>{opened.resource.revision}</small> : null}
                      </div>
                    </header>

                    {opened.resource.ref === opened.resource.world_ref && opened.world_presentation ? (
                      <>
                        <WorldPresentationRenderer presentation={opened.world_presentation} onOpenRef={openRef} />
                        <div className="presentation-actions">
                          <button type="button" onClick={() => beginEdit(opened.world_presentation)}>
                            Edit presentation draft
                          </button>
                          <span>Publishing remains a Projection revision through the connected provider.</span>
                        </div>
                      </>
                    ) : null}

                    <RelationField opened={opened} mode={fieldMode} onMode={setFieldMode} onOpen={openRef} />
                  </section>
                </>
              )}
            </div>

            <aside className="explore-inspector">
              {opened ? (
                <>
                  <div className="explore-label">Inspect</div>
                  <h2>{opened.resource.label}</h2>
                  <dl>
                    <div>
                      <dt>Kind</dt>
                      <dd>{opened.resource.kind}</dd>
                    </div>
                    <div>
                      <dt>World</dt>
                      <dd>{opened.world?.label ?? opened.resource.world_ref}</dd>
                    </div>
                    <div>
                      <dt>Ref</dt>
                      <dd>{opened.resource.ref}</dd>
                    </div>
                  </dl>
                  <div className="explore-inspector__actions">
                    {opened.actions.map((action) => (
                      <span key={action}>{action}</span>
                    ))}
                  </div>
                  <div className="explore-inspector__section">
                    <div className="explore-label">Provenance</div>
                    <Provenance entry={opened.resource} />
                  </div>
                </>
              ) : (
                <>
                  <div className="explore-label">Inspect</div>
                  <p>Select an addressable object to reveal its semantic ref, source and bounded relations.</p>
                </>
              )}
            </aside>
          </section>
        ) : null}
      </main>
    </div>
  );
}
