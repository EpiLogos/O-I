/**
 * The centre's furniture: the breadcrumb footer (every crumb is a way back; every separator opens that
 * level's siblings), the reading rail (a sequence as an edge of ticks), the Library gallery, the Expression
 * frame and the lightbox. Ports of shell.ts / reader.ts / library.ts / tabs.ts presentation; each verb is
 * handed up to become one `FieldOp`.
 */
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {CorpusIndex, TreeEntry} from "./corpusIndex";
import type {FieldRef} from "./model";
import type {FieldExpression, FieldExpressionIndex, FieldSequence, FieldSource} from "./source";
import {hereExpressions} from "./filterModel";
import {Icon} from "./icons";

/* ───────── breadcrumbs (the footer) ───────── */
export function Crumbs({index, current, openMain, hostRef}: {index: CorpusIndex; current: FieldRef | null; openMain(ref: FieldRef): void; hostRef: React.RefObject<HTMLElement>}) {
  const chain = current ? index.pathOf(current) : [];
  const ol = useRef<HTMLOListElement>(null), wrap = useRef<HTMLElement>(null);
  const [pop, setPop] = useState<{key: string; left: number; top: number; title: string; items: TreeEntry[]} | null>(null);
  const home = index.home;

  const fit = () => {
    const o = ol.current, w = wrap.current; if (!o || !w) return;
    const items = [...o.children].filter(c => !c.classList.contains("cr--more")) as HTMLElement[]; items.forEach(li => (li.hidden = false));
    o.querySelector(".cr--more")?.remove();
    const room = w.clientWidth - 6, cur = items[items.length - 1];
    if (!cur) return;
    const natural = (li: HTMLElement) => (li === cur ? (cur.querySelector(".cr__l") as HTMLElement).scrollWidth + 8 : li.offsetWidth);
    const total = () => items.filter(li => !li.hidden).reduce((s, li) => s + natural(li), 0) + (o.querySelector(".cr--more") ? 28 : 0);
    let k = 1;
    while (total() > room && k < items.length - 1) { items[k].hidden = true; k++; }
    if (k > 1) {
      const hid = items.slice(1, k).map(li => li.querySelector(".cr__l")?.textContent).join(" › ");
      const more = document.createElement("li"); more.className = "cr cr--more"; more.innerHTML = `<span class="cr__l" title="${hid.replace(/"/g, "&quot;")}">…</span><i class="cr__sep">›</i>`;
      items[1].before(more);
    }
  };
  useLayoutEffect(fit, [chain.map(f => f.id).join("/")]);                  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const w = wrap.current; if (!w) return; let last = -1;
    const ro = new ResizeObserver(es => { const x = Math.round(es[0].contentRect.width); if (x === last) return; last = x; fit(); });
    ro.observe(w); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!pop) return;
    const away = (e: Event) => { const t = e.target as Element; if (!t.closest(".cpop") && !t.closest(".cr__s") && !t.closest("[data-kids]")) setPop(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setPop(null); } };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc, true); };
  }, [pop]);
  useEffect(() => setPop(null), [current]);

  const open = (btn: HTMLElement, f: TreeEntry, mode: "kids" | "sibs") => {
    const key = mode + f.id; if (pop?.key === key) { setPop(null); return; }
    const host = hostRef.current!.getBoundingClientRect(), r = btn.getBoundingClientRect();
    const items = (mode === "kids" ? f.children : f.parent!.children).filter(c => !c.hidden || mode === "kids");
    const flat = mode === "kids" && items.length === 1 && items[0].kind === "folder" ? items[0].children : items;
    setPop({key, left: Math.max(8, Math.min(host.width - 308, r.left - host.left - 10)), top: Math.max(8, r.top - host.top - Math.min(60 * 8, 56 + flat.slice(0, 80).length * 30) - 6), title: mode === "kids" ? f.label : f.parent!.label, items: flat});
  };
  const go = (x: TreeEntry) => { setPop(null); const t = x.ref ?? index.firstLeaf(x); if (t) openMain(t); };

  return (
    <>
      <nav className="breadcrumb-container" ref={wrap} aria-label="Where you are">
        <ol ref={ol}>
          {chain.map((f, k) => {
            const last = k === chain.length - 1, sib = f.parent ? f.parent.children.length : 0;
            const target = f.ref ?? (k === 0 ? home : null);
            const label = target != null && !last
              ? <a className="cr__l" href="#" data-ni={target} onClick={e => { e.preventDefault(); setPop(null); openMain(target); }}>{f.label}</a>
              : !last && f.children.length
                ? <button className="cr__l cr__f" type="button" data-kids={f.id} aria-haspopup="true" title={`What is in ${f.label}`} onClick={e => { e.stopPropagation(); open(e.currentTarget, f, "kids"); }}>{f.label}</button>
                : <span className="cr__l" aria-current={last ? "page" : undefined}>{f.label}</span>;
            return (
              <li key={f.id} className={`cr${last ? " cr--cur" : ""}`}>{label}
                {!last && sib > 1 ? <button className="cr__s" type="button" data-fid={f.id} aria-label={`Siblings of ${f.label}`} onClick={e => { e.stopPropagation(); open(e.currentTarget, f, "sibs"); }}><Icon name="chev" size={12}/></button> : !last ? <i className="cr__sep">›</i> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      {pop ? (
        <div className="cpop" style={{left: pop.left, top: pop.top}} role="menu">
          <p className="cpop__h">{pop.title} <span>{pop.items.length}</span></p>
          <ul>{pop.items.slice(0, 80).map(s => (
            <li key={s.id}><a href="#" className={current && index.pathOf(current).includes(s) ? "is-here" : ""} style={{"--rc": `var(--c-${s.group || "essay"})`} as React.CSSProperties} onClick={e => { e.preventDefault(); e.stopPropagation(); go(s); }}>
              <i/>{s.coord ? <em>{s.coord}</em> : null}<span>{s.label}</span><b>{s.kind === "folder" ? s.count : ""}</b></a></li>
          ))}</ul>
          {pop.items.length > 80 ? <p className="cpop__more">+{pop.items.length - 80} more in the explorer</p> : null}
        </div>
      ) : null}
    </>
  );
}

/* ───────── the reading rail ───────── */
export function Rail({sequence, here, onGo, onHover, hidden}: {sequence: FieldSequence | undefined; here: string | null; onGo(item: FieldSequence["items"][number]): void; onHover(ref: FieldRef | null): void; hidden: boolean}) {
  if (!sequence) return <nav className="mrail" hidden aria-label="Sequence"/>;
  let room = "";
  return (
    <nav className="mrail" aria-label={sequence.label} hidden={hidden} onPointerLeave={() => onHover(null)}>
      {sequence.items.map(it => {
        const brk = it.section.id !== room; room = it.section.id;
        return (
          <button key={it.span} className={`mrail__t${brk ? " is-first" : ""}${here === it.span ? " is-here" : ""}`} type="button" data-span={it.span} aria-label={`${it.coord} ${it.label}`}
            onClick={() => onGo(it)} onPointerEnter={() => onHover(it.ref)}>
            <i/><span className="mrail__tip"><b>{it.coord}</b> {it.label}<em>{it.section.coord ?? it.section.label}</em></span>
          </button>
        );
      })}
    </nav>
  );
}

/* ───────── an Expression, as a tab: the full renderer in a frame ───────── */
export function ExpressionFrame({source, entry, scene, theme, onOpenPage, reg}: {
  source: FieldSource; entry: FieldExpression | undefined; scene: string | undefined; theme: "light" | "dark";
  onOpenPage(ref: FieldRef): void; reg(frame: HTMLIFrameElement | null): void;
}) {
  const view = entry ? source.expressionView?.(entry, scene, theme) ?? null : null;
  const frame = useRef<HTMLIFrameElement>(null);
  const url = useRef<string | null>(null);
  if (view && url.current === null) url.current = view.url;       // the frame loads once; scene and theme travel by message
  useEffect(() => { reg(frame.current); return () => reg(null); }, [reg, view?.url]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "oi-open" && typeof e.data.slug === "string") { const ref = source.resolveToken?.(e.data.slug); if (ref) onOpenPage(ref); }
    };
    window.addEventListener("message", on); return () => window.removeEventListener("message", on);
  }, [source, onOpenPage]);
  useEffect(() => { try { frame.current?.contentWindow?.postMessage({type: "oi-theme", theme}, "*"); } catch { /* cross-origin frames ignore */ } }, [theme]);
  if (!entry) return <p className="stubnote">This Expression is not in the published collection.</p>;
  if (!view) return <p className="stubnote"><b>{entry.title}</b> has no renderer in this edition.</p>;
  return <iframe ref={frame} className="xframe" data-x={entry.ref} title={entry.title} src={url.current ?? view.url} allow="fullscreen" loading="eager"/>;
}

/* ───────── the Library: the Expressions, as a view of the field ───────── */
const DETAIL: Record<string, string> = {
  essay: "The sovereign reading path.", rooms: "Eight rooms, each its own Expression.", symbolon: "The relation itself, and its twelvefold spine.",
  arguments: "A01–A36 and their conjugates.", matheme: "Visionary operative logic, worked scene by scene.", mytheme: "Formed, lived operations: the worlds.",
  episteme: "Concepts, dossiers, etymologies, histories, lenses.", products: "The S0–S5 product field.",
};
const foldq = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export interface LibraryState { q: string; coll: string; here: boolean; mode: "grid" | "rows" }

export function Library({source, index, xindex, focus, ui, setUi, shortTitle, open, openPage, assetUrl}: {
  source: FieldSource; index: CorpusIndex; xindex: FieldExpressionIndex | null | undefined; focus: FieldRef | null;
  ui: LibraryState; setUi(u: LibraryState): void; shortTitle(t: string): string;
  open(ref: FieldRef, scene?: string): void; openPage(ref: FieldRef): void; assetUrl(entry: FieldExpression): string | undefined;
}) {
  const names = source.libraryNames?.() ?? {};
  const here = useMemo(() => hereExpressions(index, focus), [index, focus]);
  const list = useMemo(() => {
    if (!xindex) return [];
    let l = xindex.entries;
    if (ui.coll !== "all") l = l.filter(e => e.collection === ui.coll);
    if (ui.here) l = l.filter(e => here.has(e.ref));
    const q = foldq(ui.q.trim());
    if (q) l = l.filter(e => foldq(e.title + " " + e.summary + " " + e.scenes.map(s => s.name).join(" ") + " " + e.about.map(r => index.node(r)?.label ?? "").join(" ")).includes(q));
    return l;
  }, [xindex, ui, here, index]);
  if (xindex === undefined) return <section className="library fpane"><p className="xcount" role="status">Opening the Library…</p></section>;
  if (!xindex) return <section className="library fpane"><section className="xempty"><h2>The Library is not in this edition.</h2><p>This corpus was published without its Expression layer.</p></section></section>;
  const hereN = xindex.entries.filter(e => here.has(e.ref)).length;
  const groups = xindex.collections.filter(c => list.some(e => e.collection === c.id));
  const q = ui.q.trim();
  const card = (e: FieldExpression) => {
    const scenes = e.scenes.slice(0, 5), pages = e.about.map(r => index.node(r)).filter(Boolean), cover = assetUrl(e);
    return (
      <article key={e.ref} className={`xcard${here.has(e.ref) ? " is-here" : ""}`} data-x={e.ref}>
        <button className="xcard__open" type="button" aria-label={`Open ${shortTitle(e.title)}`} onClick={() => open(e.ref)}>
          <span className="xcard__cover">{cover ? <img src={cover} alt="" loading="lazy" width={640} height={400}/> : null}<span className="xcard__n">{String(e.scenes.length).padStart(2, "0")} Scenes</span>{here.has(e.ref) ? <span className="xcard__here">Here</span> : null}</span>
          <span className="xcard__copy"><strong>{shortTitle(e.title)}</strong><span className="xcard__sub">{e.summary}</span></span>
        </button>
        {ui.mode === "rows" ? <small className="xcard__where">{e.group}</small> : null}
        <div className="xcard__scenes" aria-label="Scenes">
          {scenes.map((s, k) => <button key={s.id} type="button" className="xchip-s" title={s.name} onClick={() => open(e.ref, s.id)}><span>{String(k).padStart(2, "0")}</span>{s.name}</button>)}
          {e.scenes.length > scenes.length ? <button type="button" className="xchip-s xchip-s--more" onClick={() => open(e.ref)}>+{e.scenes.length - scenes.length}</button> : null}
        </div>
        {pages.length ? <div className="xcard__pages"><span>On the page{pages.length > 1 ? "s" : ""}</span>
          {pages.slice(0, 2).map(p => <a key={p!.ref} href="#" onClick={ev => { ev.preventDefault(); openPage(p!.ref); }}>{p!.coord ? p!.coord + " · " + p!.label : p!.label}</a>)}
          {pages.length > 2 ? <em>+{pages.length - 2}</em> : null}</div> : null}
      </article>
    );
  };
  return (
    <section className="library fpane">
      <header className="xhead"><div><p className="eyebrow">O:I · THE PUBLISHED COLLECTION</p><h1>Expressions<span>.</span></h1><p>Enter the work. Follow its relations.<br/>Turn to the source.</p></div></header>
      <div className="xtools">
        <label className="xsearch"><Icon name="search" size={15}/><input type="search" value={ui.q} placeholder="Find an idea, a world, a scene" aria-label="Search the Expressions" onChange={e => setUi({...ui, q: e.target.value})}/></label>
        <div className="seg seg--sm" role="group" aria-label="Library view">
          <button type="button" aria-pressed={ui.mode === "grid"} onClick={() => setUi({...ui, mode: "grid"})}>Gallery</button>
          <button type="button" aria-pressed={ui.mode === "rows"} onClick={() => setUi({...ui, mode: "rows"})}>Columns</button>
        </div>
      </div>
      <nav className="xcolls" aria-label="Collections">
        <button type="button" aria-pressed={ui.coll === "all" && !ui.here} onClick={() => setUi({...ui, coll: "all", here: false})}>All · {xindex.entries.length}</button>
        <button type="button" aria-pressed={ui.here} disabled={!hereN} title="Expressions about this page and what the graph shows around it" onClick={() => setUi({...ui, here: !ui.here, coll: ui.here ? ui.coll : "all"})}>Here · {hereN}</button>
        {xindex.collections.map(c => <button key={c.id} type="button" aria-pressed={ui.coll === c.id} onClick={() => setUi({...ui, coll: c.id, here: false})}>{names[c.id] ?? c.label} · {c.count}</button>)}
      </nav>
      <div className="xresults">
        <p className="xcount" role="status">{list.length} {list.length === 1 ? "Expression" : "Expressions"}{q ? ` matching “${q}”` : ""}{ui.here ? " here" : ""}</p>
        {!list.length ? (
          <section className="xempty"><h2>{ui.here ? "Nothing here has an Expression." : "No Expression matches."}</h2><p>{ui.here ? "Move along the graph, or look at the whole collection." : "Try another phrase, or the whole collection."}</p><button type="button" onClick={() => setUi({q: "", coll: "all", here: false, mode: ui.mode})}>Show everything</button></section>
        ) : groups.map(g => (
          <section key={g.id} className="xsection"><header><h2>{names[g.id] ?? g.label}</h2><span>{g.detail ?? DETAIL[g.id] ?? ""}</span></header>
            <div className={ui.mode === "grid" ? "xgrid" : "xrows"}>{list.filter(e => e.collection === g.id).map(card)}</div></section>
        ))}
      </div>
    </section>
  );
}

/* ───────── the lightbox: a figure, enlarged ───────── */
export function Lightbox({figure, onClose}: {figure: {src: string; alt: string; caption: string} | null; onClose(): void}) {
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dlg.current; if (!d) return; if (figure && !d.open) d.showModal(); if (!figure && d.open) d.close(); }, [figure]);
  return (
    <dialog className="lightbox" ref={dlg} onClose={onClose} onClick={e => { if (e.target === dlg.current) onClose(); }}>
      {figure ? <>
        <form method="dialog"><button className="lb__x" type="submit" aria-label="Close">×</button></form>
        <div className="lb__mat"><img src={figure.src} alt={figure.alt}/></div>
        {figure.caption ? <div className="lb__cap" dangerouslySetInnerHTML={{__html: figure.caption}}/> : null}
      </> : null}
    </dialog>
  );
}
