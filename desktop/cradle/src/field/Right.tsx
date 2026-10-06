/**
 * The right sidebar: the graph, the contents and the connections list. The graph and the list are two accounts
 * of ONE neighbourhood under ONE filter (`filterModel`): the filter menu changes both, and neither guesses a
 * list of its own. (Ports of graph.ts' toolbar, menu and connections list, and reader.ts' contents.)
 */
import {useEffect, useRef, useState} from "react";
import type {CorpusIndex} from "./corpusIndex";
import type {FieldFilter, FieldRef} from "./model";
import {filtersActive, groupConnections, neighbourhood} from "./filterModel";
import {mountGraph, type GraphHandle} from "./graphView";
import {Icon} from "./icons";
import type {FieldExpression} from "./source";

export interface GraphPaneProps {
  index: CorpusIndex;
  /** the page the field is standing on (a sequence at a position stands on that position's page) */
  focus: FieldRef | null;
  selected: FieldRef | undefined;
  filter: FieldFilter;
  setFilter(f: FieldFilter): void;
  hits: ReadonlySet<FieldRef> | null;
  visited: ReadonlySet<FieldRef>;
  select(ref: FieldRef | null): void;
  openTangent(ref: FieldRef): void;
  openMain(ref: FieldRef): void;
  openExpression(ref: FieldRef): void;
  hover(ref: FieldRef | null): void;
  collapse(): void;
  /** the gathered constellation (the encounter's), and the verbs on it */
  gathered: readonly FieldRef[];
  gather(ref: FieldRef): void;
  leaveConstellation(): void;
  openInTechne(title: string, question: string): Promise<string | undefined>;
  defaultTitle: string;
  onGraph?(h: GraphHandle | null): void;
  /** how the surface is arranged: a layout change re-measures the graph */
  layoutKey: string;
}

export function GraphPane(p: GraphPaneProps) {
  const box = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), card = useRef<HTMLDivElement>(null);
  const handle = useRef<GraphHandle | null>(null);
  const [menu, setMenu] = useState(false);
  const latest = useRef(p); latest.current = p;

  useEffect(() => {
    const g = mountGraph({
      box: box.current!, svg: svg.current!, card: card.current!,
      index: () => latest.current.index,
      filter: () => latest.current.filter,
      visited: ref => latest.current.visited.has(ref),
      expressionsOf: ref => latest.current.index.expressionsOf(ref),
      select: ref => latest.current.select(ref),
      openTangent: ref => latest.current.openTangent(ref),
      openMain: ref => latest.current.openMain(ref),
      openExpression: ref => latest.current.openExpression(ref),
      hover: ref => latest.current.hover(ref),
      gather: ref => latest.current.gather(ref),
    });
    handle.current = g; latest.current.onGraph?.(g);
    g.setGathered(latest.current.gathered); g.setFocus(latest.current.focus); g.setSelected(latest.current.selected ?? null); g.setHits(latest.current.hits);
    return () => { g.destroy(); handle.current = null; latest.current.onGraph?.(null); };
  }, [p.index]);                                                       // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { handle.current?.setFocus(p.focus); }, [p.focus]);
  useEffect(() => { handle.current?.setSelected(p.selected ?? null); }, [p.selected, p.focus]);
  useEffect(() => { handle.current?.setHits(p.hits); }, [p.hits]);
  useEffect(() => { handle.current?.setGathered(p.gathered); }, [p.gathered]);
  useEffect(() => { handle.current?.refresh(); }, [p.filter]);
  useEffect(() => { const t = setTimeout(() => handle.current?.resize(), 60); return () => clearTimeout(t); }, [p.layoutKey]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { const t = e.target as Element; if (!t.closest(".gmenu") && !t.closest("[data-filter-btn]")) setMenu(false); };
    document.addEventListener("pointerdown", away); return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  const nb = p.focus ? neighbourhood(p.index, p.focus, p.filter) : null;
  const count = nb ? nb.all.length : 0;
  return (
    <section className="graph">
      <div className="graph-head">
        <h3>Graph</h3>
        <span className="graph-count" title="Direct connections">{count || ""}</span>
        <div className="top__spacer"/>
        <button className={`ibtn ibtn--sm${filtersActive(p.filter) ? " is-on" : ""}`} data-filter-btn type="button" aria-haspopup="true" aria-expanded={menu} aria-label="Filter the graph" title="Filter · reach" onClick={e => { e.stopPropagation(); setMenu(m => !m); }}><Icon name="sliders"/></button>
        <button className="ibtn ibtn--sm" type="button" aria-label="Fit and recentre" title="Fit" onClick={() => handle.current?.fit()}><Icon name="fit"/></button>
        <button className="ibtn ibtn--sm sidebar-collapse" type="button" aria-label="Put the field away" onClick={p.collapse}><Icon name="chev"/></button>
        {menu && p.focus ? <FilterMenu index={p.index} focus={p.focus} filter={p.filter} setFilter={p.setFilter} reset={() => handle.current?.reset()}/> : null}
      </div>
      <div className="graph-container" ref={box}>
        <svg className="graph-svg" ref={svg} role="img" aria-label="Local graph: the page you are reading and what it links to"/>
        <div className="gcard" ref={card} hidden/>
      </div>
      {p.gathered.length ? <ConstellationBar index={p.index} refs={p.gathered} gather={p.gather} leave={p.leaveConstellation} openInTechne={p.openInTechne} defaultTitle={p.defaultTitle}/> : null}
    </section>
  );
}

function FilterMenu({index, focus, filter, setFilter, reset}: {index: CorpusIndex; focus: FieldRef; filter: FieldFilter; setFilter(f: FieldFilter): void; reset(): void}) {
  const nb = index.neighbours(focus, filter.hubs), counts: Record<string, number> = {};
  for (const r of nb.all) { const g = index.node(r)!.group; counts[g] = (counts[g] || 0) + 1; }
  const hidden = new Set(filter.hidden);
  return (
    <div className="gmenu" role="menu">
      <div className="gm__sec"><span className="gm__h">Reach</span>
        <div className="seg seg--sm">{([1, 2, 3] as const).map(d => <button key={d} aria-pressed={filter.depth === d} onClick={() => setFilter({...filter, depth: d})}>{d} hop{d > 1 ? "s" : ""}</button>)}</div>
      </div>
      <div className="gm__sec"><span className="gm__h">Show</span>
        {index.groups.map(g => (
          <label key={g.id} className="gm__row" style={{"--rc": `var(--c-${g.tone})`} as React.CSSProperties}>
            <input type="checkbox" data-reg={g.id} checked={!hidden.has(g.id)} onChange={e => setFilter({...filter, hidden: e.target.checked ? filter.hidden.filter(h => h !== g.id) : [...filter.hidden, g.id]})}/>
            <i/><span>{g.label}</span><b>{counts[g.id] || 0}</b>
          </label>
        ))}
        <label className="gm__row gm__row--hub"><input type="checkbox" data-hubs checked={filter.hubs} onChange={e => setFilter({...filter, hubs: e.target.checked})}/><i/><span>Index &amp; README pages</span><b>{index.hubNeighbourCount(focus)}</b></label>
      </div>
      <div className="gm__foot"><button data-reset title="Lay the graph out again" onClick={reset}>Reset layout</button><button data-all onClick={() => setFilter({depth: 1, hubs: false, hidden: []})}>Show everything</button></div>
    </div>
  );
}

/* ───────── connections ───────── */
export function Connections({index, focus, filter, setFilter, spanLabel, onOpen, onHover}: {
  index: CorpusIndex; focus: FieldRef | null; filter: FieldFilter; setFilter(f: FieldFilter): void; spanLabel: string | null;
  onOpen(ref: FieldRef, e: React.MouseEvent): void; onHover(ref: FieldRef | null): void;
}) {
  if (focus == null || !index.has(focus)) return <section className="backlinks"><div/></section>;
  const n = index.node(focus)!, nb = neighbourhood(index, focus, filter), outS = new Set(nb.out), inS = new Set(nb.in);
  const groups = groupConnections(index, nb);
  const hubHidden = !filter.hubs && !n.hub ? index.hubNeighbourCount(focus) : 0;
  const filtered = nb.raw.length - nb.all.length;
  const arrow = (r: FieldRef) => (outS.has(r) && inS.has(r) ? "⇄" : outS.has(r) ? "→" : "←");
  return (
    <section className="backlinks" onPointerLeave={() => onHover(null)}>
      <div>
        <div className="conn__head"><h3>{spanLabel ? `Connections at ${spanLabel}` : "Connections"}</h3><b className="conn__title">{n.label}</b>
          <span className="conn__counts">{groups.map(g => <span key={g.group.id} style={{"--rc": `var(--c-${g.group.tone})`} as React.CSSProperties}><i/>{g.refs.length}</span>)}<em>{nb.out.length} cites · {nb.in.length} cited by{filtered ? ` · ${filtered} filtered` : ""}</em></span></div>
        {groups.length ? groups.map(g => (
          <section key={g.group.id} className="conn__g" style={{"--rc": `var(--c-${g.group.tone})`} as React.CSSProperties}>
            <h4><i/>{g.group.label}<span>{g.refs.length}</span></h4>
            <ul>{g.refs.slice(0, 40).map(r => {
              const x = index.node(r)!;
              return (
                <li key={r} data-hov={r} data-ref={r} onPointerEnter={() => onHover(r)}>
                  <a href="#" title={x.title} onClick={e => { e.preventDefault(); onOpen(r, e); }}>
                    <span className="conn__a" title={outS.has(r) && inS.has(r) ? "mutual" : outS.has(r) ? "cited here" : "cites this"}>{arrow(r)}</span>
                    {x.coord ? <em>{x.coord}</em> : null}<span className="conn__t">{x.label}</span>
                    {index.expressionsOf(r).length ? <span className="conn__x" title="Has an Expression"><Icon name="expression" size={11}/></span> : null}
                    <span className="conn__w">{index.whereOf(r).split(" › ").slice(-1)[0]}</span>
                  </a>
                </li>
              );
            })}</ul>
            {g.refs.length > 40 ? <p className="conn__more">+{g.refs.length - 40} more</p> : null}
          </section>
        )) : <p className="conn__none">{filtered ? <>Everything here is filtered out. <button className="linkbtn" onClick={() => setFilter({...filter, hidden: []})}>Show all</button></> : "No links in or out of this page."}</p>}
        {hubHidden ? <p className="conn__hubs">{hubHidden} index &amp; README page{hubHidden === 1 ? "" : "s"} left out. <button className="linkbtn" onClick={() => setFilter({...filter, hubs: true})}>Include</button></p> : null}
      </div>
    </section>
  );
}

/* ───────── contents ───────── */
export interface ContentEntry { key: string; level: 1 | 2 | 3; label: string; mark?: string; here?: boolean; go: () => void }
export function Contents({entries}: {entries: ContentEntry[] | null}) {
  return (
    <section className="toc">
      <h3>On this page</h3>
      <div>
        {entries == null ? null : entries.length
          ? entries.map(e => <a key={e.key} className={`l${e.level}${e.here ? " is-here" : ""}`} href="#" onClick={ev => { ev.preventDefault(); e.go(); }}>{e.mark ? <b>{e.mark}</b> : null}{e.label}</a>)
          : <p className="toc__none">This page has no sections.</p>}
      </div>
    </section>
  );
}

export type ExpressionScenes = FieldExpression["scenes"];

/* ───────── the gathered constellation ───────── */
function ConstellationBar({index, refs, gather, leave, openInTechne, defaultTitle}: {index: CorpusIndex; refs: readonly FieldRef[]; gather(ref: FieldRef): void; leave(): void; openInTechne(title: string, question: string): Promise<string | undefined>; defaultTitle: string}) {
  const [form, setForm] = useState(false), [title, setTitle] = useState(""), [question, setQuestion] = useState("What do these pages hold together?");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const go = async () => { setBusy(true); setError(undefined); const refusal = await openInTechne(title.trim() || defaultTitle, question); setBusy(false); if (refusal) setError(refusal); else setForm(false); };
  return (
    <div className="gcons" role="group" aria-label="Gathered constellation">
      <div className="gcons__head"><b>Constellation</b><span>{refs.length} gathered</span><span className="top__spacer"/>
        <button type="button" className="linkbtn" onClick={() => setForm(f => !f)} aria-expanded={form}>Open in Technè</button>
        <button type="button" className="linkbtn" onClick={leave}>Leave</button></div>
      <ul className="gcons__list">{refs.map(r => <li key={r}><span>{index.node(r)?.label ?? r}</span><button type="button" aria-label={`Take ${index.node(r)?.label ?? r} out`} onClick={() => gather(r)}><Icon name="x" size={10}/></button></li>)}</ul>
      {form ? (
        <form className="gcons__form" onSubmit={e => { e.preventDefault(); void go(); }}>
          <input aria-label="Constellation title" placeholder={defaultTitle} value={title} disabled={busy} onChange={e => setTitle(e.target.value)}/>
          <input aria-label="Constellation question" value={question} disabled={busy} onChange={e => setQuestion(e.target.value)}/>
          {error ? <p className="gcons__err" role="alert">{error}</p> : null}
          <button type="submit" className="linkbtn" disabled={busy || !question.trim()}>{busy ? "Creating…" : "Create it in the Wiki and open Technè"}</button>
        </form>
      ) : null}
    </div>
  );
}
