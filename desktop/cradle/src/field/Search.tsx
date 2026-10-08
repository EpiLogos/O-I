/**
 * Search, in the left sidebar. It answers at once from titles and paths (the index's light search) and
 * loads the full text only when the reader first focuses the box (`source.searchText`). Every hit says where
 * it lives; the station bars show where hits cluster. (Port of the site's search.ts.)
 *
 * A hit follows as a tangent (Enter, click) or turns the main page (Shift+Enter) — never navigates by itself.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {CorpusIndex, Hit} from "./corpusIndex";
import {fold} from "./corpusIndex";
import type {FieldRef} from "./model";
import type {FieldSource} from "./source";
import {Icon} from "./icons";

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]!);
function markUp(str: string, terms: string[]) {
  const f = fold(str);
  if (f.length !== str.length || !terms.length) return esc(str);
  const re = new RegExp(terms.map(reEsc).join("|"), "g");
  let m: RegExpExecArray | null, res = "", last = 0;
  while ((m = re.exec(f))) { if (!m[0]) { re.lastIndex++; continue; } res += esc(str.slice(last, m.index)) + "<mark>" + esc(str.slice(m.index, m.index + m[0].length)) + "</mark>"; last = m.index + m[0].length; }
  return res + esc(str.slice(last));
}
function snippet(body: string, terms: string[]) {
  const f = fold(body);
  let best = -1;
  for (const t of terms) { const p = f.indexOf(t); if (p >= 0 && (best < 0 || p < best)) best = p; }
  if (best < 0 || f.length !== body.length) return esc(body.slice(0, 150)) + (body.length > 150 ? "…" : "");
  const a = Math.max(0, best - 60), win = body.slice(a, a + 190);
  return (a > 0 ? "…" : "") + markUp(win, terms) + "…";
}

export interface SearchState {
  query: string; setQuery(q: string): void;
  scope: ReadonlySet<string>; toggleScope(facet: string): void;
  hits: Hit[]; terms: string[]; all: Hit[]; full: boolean; active: number; setActive(n: number): void;
  hitSet: ReadonlySet<FieldRef> | null;
  /** Fetch the full text (once) the first time the box is focused. */
  upgrade(): void;
}

export function useFieldSearch(index: CorpusIndex, source: FieldSource): SearchState {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ReadonlySet<string>>(new Set());
  const [full, setFull] = useState(index.hasText);
  const [active, setActive] = useState(0);
  const loading = useRef<Promise<void> | null>(null);
  const upgrade = useCallback(() => {
    if (index.hasText || loading.current || !source.searchText) return;
    loading.current = source.searchText().then(text => { index.setText(text); setFull(true); }, () => { loading.current = null; /* titles and paths still work */ });
  }, [index, source]);
  const result = useMemo(() => {
    const q = query.trim();
    if (!q) return {all: [] as Hit[], terms: [] as string[]};
    const r = index.search(q);
    return {all: r.hits, terms: r.terms};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, index, full]);
  const hits = useMemo(() => scope.size ? result.all.filter(h => scope.has(index.node(h.ref)!.facet)) : result.all, [result, scope, index]);
  const hitSet = useMemo(() => query.trim() ? new Set(hits.map(h => h.ref)) : null, [hits, query]);
  useEffect(() => setActive(0), [query, scope]);
  const toggleScope = useCallback((f: string) => setScope(s => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n; }), []);
  return {query, setQuery, scope, toggleScope, hits, terms: result.terms, all: result.all, full, active, setActive, hitSet, upgrade};
}

export function SearchBar({s, index, inputRef, onOpen, onOpenMain, onHover}: {
  s: SearchState; index: CorpusIndex; inputRef: React.RefObject<HTMLInputElement>;
  onOpen(ref: FieldRef): void; onOpenMain(ref: FieldRef): void; onHover(ref: FieldRef | null): void;
}) {
  const q = s.query.trim();
  const counts: Record<string, number> = {};
  for (const h of s.all) { const f = index.node(h.ref)!.facet; counts[f] = (counts[f] || 0) + 1; }
  const move = (d: number) => {
    const n = Math.min(s.hits.length, 80); if (!n) return;
    const k = (s.active + d + n) % n; s.setActive(k); onHover(s.hits[k].ref);
  };
  const status = !q ? "" : s.hits.length
    ? `${s.hits.length} page${s.hits.length === 1 ? "" : "s"}` + (s.scope.size ? ` in ${[...s.scope].map(f => index.facets.find(x => x.id === f)?.name).join(" + ")}` : "") + (s.full ? " · full text" : " · titles & paths · loading full text…")
    : s.full ? "No page matches" : "No title or path matches · loading full text…";
  return (
    <div className="search">
      <label className="search-bar">
        <Icon name="search" size={15}/>
        <input ref={inputRef} type="search" placeholder="Search" autoComplete="off" spellCheck={false} aria-label="Search" value={s.query}
          onChange={e => s.setQuery(e.target.value)} onFocus={s.upgrade}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { move(1); e.preventDefault(); }
            else if (e.key === "ArrowUp") { move(-1); e.preventDefault(); }
            else if (e.key === "Enter" && s.hits[s.active]) { e.preventDefault(); e.shiftKey ? onOpenMain(s.hits[s.active].ref) : onOpen(s.hits[s.active].ref); }
            else if (e.key === "Escape") { s.setQuery(""); (e.target as HTMLInputElement).blur(); e.stopPropagation(); }
          }}/>
        <kbd>/</kbd>
        {q ? <button className="search-x" type="button" aria-label="Clear search" onClick={() => { s.setQuery(""); inputRef.current?.focus(); }}><Icon name="x" size={12}/></button> : null}
      </label>
      {q ? <div className="shist">{index.facets.map(f => {
        const n = counts[f.id] || 0;
        return <button key={f.id} className="sh" type="button" aria-pressed={s.scope.has(f.id)} disabled={!n} title={`${f.name}: ${n} hits`}
          style={{"--rc": `var(--c-${f.tone})`, flex: `${Math.max(n, 0.001)} 1 ${n ? 40 : 0}px`} as React.CSSProperties} onClick={() => s.toggleScope(f.id)}>
          <span className="sh__bar"/><span className="sh__l">{f.id}<b>{n}</b></span></button>;
      })}</div> : null}
      <p className="sstatus" role="status" aria-live="polite">{status}</p>
    </div>
  );
}

export function SearchResults({s, index, onOpen, onHover}: {s: SearchState; index: CorpusIndex; onOpen(ref: FieldRef, e: React.MouseEvent): void; onHover(ref: FieldRef | null): void}) {
  const q = s.query.trim();
  if (!q) return null;
  if (!s.hits.length) return <div className="results"><p className="hits__none" dangerouslySetInnerHTML={{__html: `Nothing matches <b>${esc(q)}</b>.<br>Search folds diacritics: Śūnya is found as sunya.`}}/></div>;
  const shown = s.hits.slice(0, 80);
  return (
    <div className="results" onPointerLeave={() => onHover(null)}>
      <ol className="hits">{shown.map((h, k) => {
        const n = index.node(h.ref)!, where = (() => { const seg = index.pathOf(h.ref).slice(0, -1).map(f => f.label); return seg.length ? seg : [index.facets.find(f => f.id === n.facet)?.name ?? ""]; })();
        const title = n.kind === "movement" || n.kind === "room" || n.kind === "argument" ? n.label : n.title;
        return (
          <li key={h.ref} className={`hit${k === s.active ? " is-active" : ""}`} data-hov={h.ref} onPointerEnter={() => onHover(h.ref)}>
            <a href="#" tabIndex={-1} style={{"--rc": `var(--c-${index.group(n.group)?.tone ?? n.group})`} as React.CSSProperties} onClick={e => { e.preventDefault(); s.setActive(k); onOpen(h.ref, e); }}>
              <span className="hit__top"><span className="hit__dot"/><span className="hit__t" dangerouslySetInnerHTML={{__html: markUp(title, s.terms)}}/>{n.coord ? <span className="hit__c">{n.coord}</span> : null}</span>
              <span className="hit__where" dangerouslySetInnerHTML={{__html: where.map(esc).join("<i>›</i>")}}/>
              <span className="hit__s" dangerouslySetInnerHTML={{__html: snippet(index.rawText(h.ref), s.terms)}}/>
            </a>
          </li>
        );
      })}</ol>
      {s.hits.length > 80 ? <p className="hits__more">{s.hits.length - 80} more — narrow the query or pick a station above.</p> : null}
    </div>
  );
}
