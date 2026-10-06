/**
 * One page, as the reader sees it: the site's article head (eyebrow, title, deck, meta, Expression chips), the
 * prose exactly as the source rendered it (typography, figures with captions, maths), and the pager.
 *
 * The body is trusted owner-produced markup of a pinned source (the adapter has already stripped scripts and
 * handlers and rewritten links into `data-fref` refs). Following a link is not decided here: the click is mapped
 * to a ref and handed up, where it becomes one `FieldOp` (a tangent; the main page when a modifier asks).
 */
import {memo, useEffect, useMemo, useRef, useState} from "react";
import type {CorpusIndex} from "./corpusIndex";
import type {FieldRef} from "./model";
import {FieldStaleRevision, type FieldExpression, type FieldReading, type FieldSource, type PagerItem} from "./source";
import {Icon} from "./icons";

const reads = new WeakMap<FieldSource, Map<string, Promise<FieldReading>>>();
/** Readings are cached per source and revision; a failure is never cached. */
export function readOnce(source: FieldSource, ref: FieldRef, revision?: string): Promise<FieldReading> {
  let m = reads.get(source); if (!m) reads.set(source, m = new Map());
  const key = ref + "@" + (revision ?? "");
  let p = m.get(key);
  if (!p) { p = source.read(ref, {revision}); m.set(key, p); p.catch(() => m!.delete(key)); }
  return p;
}

const sheets = new Set<string>();
/** Stylesheets the field carries itself (bundled, offline): a page that links one from a CDN is not asked to fetch it. */
const BUNDLED_SHEET = /\/katex(\.min)?\.css(\?|$)/;
function useStylesheets(urls: string[] | undefined) {
  useEffect(() => {
    for (const href of urls ?? []) {
      if (sheets.has(href) || BUNDLED_SHEET.test(href)) continue; sheets.add(href);
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.dataset.fieldSheet = "1"; document.head.appendChild(l);
    }
  }, [urls]);
}

export type Following = { ref: FieldRef; span?: string; main: boolean };

export interface ArticleProps {
  source: FieldSource;
  index: CorpusIndex;
  target: { ref: FieldRef; revision?: string; span?: string };
  expressions: ReadonlyMap<string, FieldExpression>;
  shortTitle(t: string): string;
  /** the pane in the main role? (its pager turns the main page; a tangent's pager follows in place) */
  isMain: boolean;
  hidden?: boolean;
  onFollow(f: Following): void;
  onExpression(ref: FieldRef): void;
  onJump(id: string): void;
  onLightbox(img: HTMLImageElement): void;
  onReading(reading: FieldReading | null, pane: HTMLElement | null): void;
  onStale(ref: FieldRef, current: string): void;
  paneRef?: (el: HTMLDivElement | null) => void;
}

function Pager({p, isMain, onFollow}: {p: NonNullable<FieldReading["pager"]>; isMain: boolean; onFollow: (f: Following) => void}) {
  const cell = (x: PagerItem | undefined, dir: "prev" | "next") => x
    ? <a className={`pager__${dir}`} href="#" onClick={e => { e.preventDefault(); onFollow({ref: x.ref, main: isMain}); }}><span>{x.sub}</span><b>{x.label}</b></a>
    : <span/>;
  return (
    <nav className="pager" aria-label="Navigation">
      {cell(p.prev, "prev")}
      {p.room ? <a className="pager__room" href="#" onClick={e => { e.preventDefault(); onFollow({ref: p.room!.ref, main: isMain}); }}>{p.room.label}</a> : <span/>}
      {cell(p.next, "next")}
    </nav>
  );
}

export const Article = memo(function Article(props: ArticleProps) {
  const {source, index, target, isMain} = props;
  const el = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<{ reading?: FieldReading; error?: unknown; ref?: string; key?: string }>({});
  const key = target.ref + "@" + (target.revision ?? "");
  useEffect(() => {
    let live = true;
    setState(s => (s.key === key ? s : {key}));
    readOnce(source, target.ref, target.revision).then(
      reading => { if (live) setState({reading, ref: target.ref, key}); },
      error => { if (live) setState({error, ref: target.ref, key}); },
    );
    return () => { live = false; };
  }, [source, key, target.ref, target.revision]);
  const reading = state.key === key ? state.reading : undefined;
  useStylesheets(reading?.stylesheets);
  const body = useMemo(() => ({__html: reading?.body ?? ""}), [reading]);
  const node = index.node(target.ref);
  const xs = index.expressionsOf(target.ref).map(r => props.expressions.get(r)).filter((e): e is FieldExpression => !!e);

  useEffect(() => {
    if (state.key === key && state.error instanceof FieldStaleRevision) props.onStale(target.ref, state.error.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, key]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as Element;
    const img = t.closest("figure.fig img, article > p > img") as HTMLImageElement | null;
    if (img) { props.onLightbox(img); return; }
    const chip = t.closest("a.xchip[data-x]") as HTMLElement | null;
    if (chip) { e.preventDefault(); props.onExpression(chip.dataset.x!); return; }
    const a = t.closest("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    if (a.dataset.fjump != null) { e.preventDefault(); props.onJump(a.dataset.fjump); return; }
    const ref = a.dataset.fref;
    if (!ref) return;                                   // not a page of this corpus: the host decides (opens outside)
    e.preventDefault();
    props.onFollow({ref, span: a.dataset.fspan, main: e.metaKey || e.ctrlKey || e.shiftKey});
  };

  const head = reading?.head;
  return (
    <div className="article fpane" ref={n => { el.current = n; props.paneRef?.(n); }} hidden={props.hidden} data-pane-ref={target.ref} onClick={onClick}>
      {reading && head ? (
        <div className="popover-hint article-head">
          <header className="ahead">
            <p className="ahead__eyebrow">{head.eyebrow.map((s, i) => <span key={i}>{s}</span>)}</p>
            <h1 className={`ahead__title${reading.title.length > 52 ? " ahead__title--long" : ""}`}>{reading.title}</h1>
            {head.deck ? <p className="ahead__deck">{head.deck}</p> : null}
            <p className="ahead__meta">{head.meta.map((s, i) => <span key={i}>{s}</span>)}</p>
            {xs.length ? (
              <p className="ahead__x" aria-label="Expressions of this page">
                {xs.slice(0, 3).map(e => (
                  <a key={e.ref} className="xchip" data-x={e.ref} href="#" onClick={ev => ev.preventDefault()}>
                    <Icon name="expression" size={13}/><span>{props.shortTitle(e.title)}</span><b>{e.scenes.length} scenes</b>
                  </a>
                ))}
                {xs.length > 3 ? <span className="xchip xchip--more">+{xs.length - 3}</span> : null}
              </p>
            ) : null}
          </header>
        </div>
      ) : null}
      {reading ? <div className="field-body" dangerouslySetInnerHTML={body}/> : null}
      {!reading && !state.error ? <p className="stubnote" role="status">Reading {node?.label ?? "the page"}…</p> : null}
      {state.key === key && state.error ? (
        state.error instanceof FieldStaleRevision
          ? <p className="stubnote" role="alert"><b>This page changed at its source.</b> It was held at {state.error.held.slice(0, 19)}…, and now stands at {state.error.current.slice(0, 19)}…. Reopening it at the current revision.</p>
          : <p className="stubnote" role="alert"><b>This page could not be read.</b> {state.error instanceof Error ? state.error.message : String(state.error)}</p>
      ) : null}
      {reading?.pager ? <div className="page-footer"><Pager p={reading.pager} isMain={isMain} onFollow={props.onFollow}/></div> : null}
      {reading ? <ReadingReady reading={reading} el={el} onReading={props.onReading}/> : null}
    </div>
  );
});

/** Tells the field a body is on screen (to measure anchors and build the contents). */
function ReadingReady({reading, el, onReading}: {reading: FieldReading; el: React.RefObject<HTMLElement | null>; onReading: ArticleProps["onReading"]}) {
  useEffect(() => {
    let r = 0;
    r = requestAnimationFrame(() => { r = requestAnimationFrame(() => onReading(reading, el.current)); });
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);
  return null;
}
