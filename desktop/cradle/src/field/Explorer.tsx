/**
 * The explorer: the corpus's hierarchy, grouped and labelled — not a file dump. (Port of the site's
 * explorer.ts.) Rows mark the page in view, the reading position, pages with an Expression and pages
 * already visited; a row's click turns the MAIN page (the explorer, the pager and the breadcrumbs are the
 * main-page navigators — a tangent comes from the field or the text).
 */
import {memo, useEffect, useMemo, useRef} from "react";
import type {CorpusIndex, TreeEntry} from "./corpusIndex";
import type {FieldRef} from "./model";
import {Icon} from "./icons";

export interface ExplorerProps {
  index: CorpusIndex;
  current: FieldRef | null;
  /** Pages marked as "where the reading is" (a movement and its room). */
  reading: FieldRef[];
  visited: ReadonlySet<FieldRef>;
  open: ReadonlySet<string>;
  setOpen(key: string, open: boolean): void;
  openMain(ref: FieldRef): void;
  hidden?: boolean;
}

const keyOf = (f: TreeEntry) => f.key || f.id;
const XMark = () => <span className="tn__x" title="Has an Expression"><Icon name="expression" size={11}/></span>;

function Folder({f, depth, p}: {f: TreeEntry; depth: number; p: ExplorerProps}) {
  const isOpen = p.open.has(keyOf(f));
  const isSection = f.kind === "section";
  const hasCurrent = p.current != null && p.index.pathOf(p.current).includes(f);
  const x = f.ref ? p.index.expressionsOf(f.ref).length > 0 : false;
  const label = f.ref && !isSection
    ? <a className="tn__label" href="#" tabIndex={-1} onClick={e => { e.preventDefault(); e.stopPropagation(); p.openMain(f.ref!); if (!isOpen) p.setOpen(keyOf(f), true); }}>{f.label}</a>
    : <span className="tn__label">{f.label}</span>;
  return (
    <li className={`tn tn--${f.kind}${isOpen ? " is-open" : ""}${hasCurrent ? " has-current" : ""}`} data-id={f.id} role="treeitem" aria-expanded={isOpen} style={{"--rc": `var(--c-${f.group || "essay"})`} as React.CSSProperties}>
      <div className={`tn__row${f.ref && f.ref === p.current ? " is-current" : ""}${f.ref && p.reading.includes(f.ref) && f.ref !== p.current ? " is-reading" : ""}`}
        style={{"--d": depth} as React.CSSProperties} tabIndex={0} data-hov={f.ref} aria-current={f.ref && f.ref === p.current ? "page" : undefined}
        onClick={() => p.setOpen(keyOf(f), !isOpen)}>
        <button className="tn__chev" tabIndex={-1} type="button" aria-label={`Toggle ${f.label}`}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        {f.coord ? <span className="tn__coord">{f.coord}</span> : null}{label}
        {f.gloss && depth <= 1 ? <span className="tn__gloss">{f.gloss}</span> : null}
        {x ? <XMark/> : null}<span className="tn__count">{f.vcount ?? f.count}</span>
      </div>
      <ul className="tn__kids" role="group">{isOpen ? <Kids f={f} depth={depth} p={p}/> : null}</ul>
    </li>
  );
}

function Leaf({f, depth, p}: {f: TreeEntry; depth: number; p: ExplorerProps}) {
  const ref = f.ref!;
  const n = p.index.node(ref);
  return (
    <li className="tn tn--leaf" role="treeitem" style={{"--rc": `var(--c-${f.group || n?.group})`} as React.CSSProperties}>
      <div className={`tn__row${ref === p.current ? " is-current" : ""}${p.reading.includes(ref) && ref !== p.current ? " is-reading" : ""}${p.visited.has(ref) ? " is-visited" : ""}`}
        style={{"--d": depth} as React.CSSProperties} tabIndex={0} data-hov={ref} aria-current={ref === p.current ? "page" : undefined}
        onClick={() => p.openMain(ref)}>
        <span className="tn__chev tn__chev--none"/>
        {f.coord ? <span className="tn__coord">{f.coord}</span> : null}
        <a className="tn__label" href="#" tabIndex={-1} title={n?.title} onClick={e => e.preventDefault()}>{f.label}</a>
        {p.index.expressionsOf(ref).length ? <XMark/> : null}<span className="tn__v" aria-hidden="true"/>
      </div>
    </li>
  );
}

function Kids({f, depth, p}: {f: TreeEntry; depth: number; p: ExplorerProps}) {
  const vis = f.children.filter(c => !c.hidden);
  const bandable = vis.length > 60 && vis.every(c => c.kind === "leaf");
  const out: React.ReactNode[] = [];
  let last = "";
  for (const c of f.children) {
    if (c.hidden) continue;
    if (bandable) {
      const ch = (c.label.replace(/^[^A-Za-z0-9À-ɏ]+/, "")[0] || "#").toUpperCase();
      if (ch !== last) { last = ch; out.push(<li key={"b" + out.length + ch} className="tn__band">{ch}</li>); }
    }
    out.push(c.kind === "leaf" ? <Leaf key={c.id} f={c} depth={depth + 1} p={p}/> : <Folder key={c.id} f={c} depth={depth + 1} p={p}/>);
  }
  return <>{out}</>;
}

export const Explorer = memo(function Explorer(p: ExplorerProps) {
  const root = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => p.index.tree.children, [p.index]);
  // keep the page in view revealed (the chain opens, the row scrolls into the middle)
  useEffect(() => {
    if (p.current == null) return;
    for (const f of p.index.pathOf(p.current).slice(0, -1)) if (!p.open.has(keyOf(f))) p.setOpen(keyOf(f), true);
    requestAnimationFrame(() => {
      const row = root.current?.querySelector<HTMLElement>(".tn__row.is-current"); const sc = root.current?.closest<HTMLElement>(".explorer");
      if (!row || !sc) return;
      const r = row.getBoundingClientRect(), b = sc.getBoundingClientRect();
      if (b.height && (r.top < b.top + 40 || r.bottom > b.bottom - 40)) row.scrollIntoView({block: "center"});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.current, p.index]);
  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter"].includes(e.key)) return;
    const rows = [...(root.current?.querySelectorAll<HTMLElement>(".tn__row") ?? [])].filter(r => r.offsetParent);
    const i = rows.indexOf((document.activeElement as Element | null)?.closest?.(".tn__row") as HTMLElement);
    if (e.key === "ArrowDown") { rows[Math.min(rows.length - 1, i + 1)]?.focus(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { rows[Math.max(0, i - 1)]?.focus(); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const li = rows[i]?.parentElement; const f = li?.dataset.id ? p.index.entry(li.dataset.id) : undefined;
      if (f && f.kind !== "leaf") { p.setOpen(keyOf(f), e.key === "ArrowRight"); e.preventDefault(); }
    } else if (e.key === "Enter") rows[i]?.click();
  };
  return (
    <div className="tree-host" ref={root} hidden={p.hidden} onKeyDown={onKey}>
      <ul className="tree" role="tree">{sections.map(s => <Folder key={s.id} f={s} depth={0} p={p}/>)}</ul>
    </div>
  );
});
