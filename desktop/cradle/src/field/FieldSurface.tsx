/**
 * The field — Base's (Central's) default centre. The site's graph–pages–Expressions anatomy, native:
 *
 *   left     title · search · explorer tree
 *   centre   tabs · article · breadcrumb footer          (and the Library gallery, as a view)
 *   right    graph · contents · connections              (a panel you can drag, put away, or open as a drawer)
 *
 * One coordinated LOCUS drives every region: the page in view (a sequence at a position stands on that
 * position's page) moves the graph, the contents, the rail, the explorer marks, the tab and the breadcrumb.
 * One typed encounter (`model.ts`) is the only state that is about *what* — every pointer, key and agent
 * operation is a `FieldOp` through the controller. What the field reads comes from a `FieldSource`; the Epi
 * world swaps the adapter (essay edition on, a linked local corpus off) and adds nothing to this host.
 */
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {SurfaceBinding} from "../surface/types";
import {useEpiLens} from "../workspace/lens";
import {useKernel} from "../kernel/KernelProvider";
import {viaTransport} from "../expression/world";
import {createWorldSync, type DescribedRef, type WorldSync} from "./worldSync";
import "./field.css";
import "./vendor/katex/katex.css";   // the edition's maths, bundled: no CDN fetch (scripts/vendor-katex.mjs)
import {FieldIcons, Icon} from "./icons";
import {locusRef} from "./filterModel";
import {type FieldEncounter, type FieldEffect, type FieldFilter, type FieldRef} from "./model";
import type {CorpusIndex} from "./corpusIndex";
import {useFieldController, type FieldBindingView} from "./useFieldController";
import {useFieldSource} from "./useFieldSource";
import {type FieldExpression, type FieldExpressionIndex, type FieldReading, type FieldSource} from "./source";
import {Explorer} from "./Explorer";
import {FieldUtility} from "./Utility";
import {gatherToTechne} from "./constellation";
import type {HostedHostContext} from "../contributions/contracts";
import {SearchBar, SearchResults, useFieldSearch} from "./Search";
import {Tabs} from "./Tabs";
import {Article, type Following} from "./Article";
import {Connections, Contents, GraphPane, type ContentEntry} from "./Right";
import {Crumbs, ExpressionFrame, Library, Lightbox, Rail, type LibraryState} from "./Center";
import type {GraphHandle} from "./graphView";

/* ───────── the host's appearance and the pane's size ───────── */
function useHostTheme(root: React.RefObject<HTMLElement>): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useLayoutEffect(() => {
    const read = () => {
      const el = root.current?.closest<HTMLElement>("[data-theme]");
      const t = el?.dataset.theme;
      setTheme(t === "dark" || t === "light" ? t : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    };
    read();
    const owner = root.current?.closest<HTMLElement>("[data-theme]");
    const mo = owner ? new MutationObserver(read) : null;
    if (owner && mo) mo.observe(owner, {attributes: true, attributeFilter: ["data-theme"]});
    const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", read);
    return () => { mo?.disconnect(); mq.removeEventListener("change", read); };
  }, [root]);
  return theme;
}
function useWidth(el: React.RefObject<HTMLElement>): number {
  const [w, setW] = useState(1440);
  useLayoutEffect(() => {
    const e = el.current; if (!e) return;
    setW(Math.round(e.getBoundingClientRect().width) || 1440);
    const ro = new ResizeObserver(es => setW(Math.round(es[0].contentRect.width) || 1440));
    ro.observe(e); return () => ro.disconnect();
  }, [el]);
  return w;
}

const NO_REFS: readonly FieldRef[] = [];
const visitedKey = (world: string) => `oi-cradle.field.visited.${world}`;
function loadVisited(world: string): Set<string> {
  try { const v = JSON.parse(window.localStorage.getItem(visitedKey(world)) ?? "[]"); return new Set(Array.isArray(v) ? v.filter(x => typeof x === "string") : []); } catch { return new Set(); }
}

/* ───────── the surface ───────── */
export function FieldSurface({binding, onView, host: hostOps}: {binding: SurfaceBinding; onView?: (view: NonNullable<SurfaceBinding["view"]>) => void; host?: HostedHostContext}) {
  const lens = useEpiLens();
  const s = useFieldSource(lens.on);
  const host = useRef<HTMLDivElement>(null);
  if (s.status !== "ready") {
    return (
      <div className="field-host" ref={host}>
        <div className="field-root page no-field" data-theme="light" data-left="open" data-view="essay">
          <FieldIcons/>
          <div className="center" style={{padding: "3rem 2rem 0", overflow: "auto"}}>
            <p className="ahead__eyebrow"><span>{lens.on ? "Epi-Logos" : "Central"}</span><span>{s.status === "loading" ? "Opening" : "Not connected"}</span></p>
            <h1 className="ahead__title">{s.status === "loading" ? "Opening the field…" : s.title}</h1>
            {s.status === "unavailable" ? <p className="ahead__deck" role="status">{s.reason}</p> : null}
            {s.status === "unavailable" && s.setup ? s.setup : null}
            <div style={{marginTop: "auto", paddingTop: 24}}><FieldUtility host={hostOps} orientation="bar"/></div>
          </div>
        </div>
      </div>
    );
  }
  return <FieldLoaded key={s.source.world_ref} binding={binding} source={s.source} index={s.index} onView={onView} hostOps={hostOps}/>;
}

function FieldLoaded({binding, source, index, onView, hostOps}: {binding: SurfaceBinding; source: FieldSource; index: CorpusIndex; onView?: (view: NonNullable<SurfaceBinding["view"]>) => void; hostOps?: HostedHostContext}) {
  const world = source.world_ref;
  const themeRef = useRef<"light" | "dark">("light");
  const host = useRef<HTMLDivElement>(null), rootEl = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null), progress = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null), footRef = useRef<HTMLElement>(null);
  const theme = useHostTheme(host);
  themeRef.current = theme;
  const width = useWidth(host);
  const narrow = width <= 1099, phone = width <= 759;

  // ── the encounter ──
  const expressionsRef = useRef<Map<string, FieldExpression>>(new Map());
  const [xindex, setXindex] = useState<FieldExpressionIndex | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    (source.expressions?.() ?? Promise.resolve(null)).then(x => { if (!live) return; expressionsRef.current = new Map((x?.entries ?? []).map(e => [e.ref, e])); setXindex(x); }, () => live && setXindex(null));
    return () => { live = false; };
  }, [source]);
  const xmap = useMemo(() => new Map((xindex?.entries ?? []).map(e => [e.ref, e])), [xindex]);
  const shortTitle = useCallback((t: string) => source.shortTitle?.(t) ?? t, [source]);

  const onEffect = useCallback((effect: FieldEffect) => {
    if (effect.effect !== "open-expression-page") return;
    // an Expression opens whole, in its own page: the published renderer, outside the field (as the site does)
    const entry = expressionsRef.current.get(effect.ref);
    const v = entry ? source.expressionView?.(entry, effect.scene, themeRef.current) : null;
    if (!v) return;
    const u = new URL(v.url); u.searchParams.delete("embed"); u.searchParams.delete("theme");
    window.open(u.href, "_blank", "noopener,noreferrer");
  }, [source]);
  const viewRef = useRef(binding.view); viewRef.current = binding.view;
  const persist = useCallback((value: FieldBindingView) => { onView?.({...(viewRef.current ?? {}), field: value}); }, [onView]);
  // ── the shared world seam (worldSync.ts): selection and tangents ARE the kernel's selection and portal operations ──
  const kernel = useKernel();
  const syncRef = useRef<WorldSync | null>(null);
  const quietUntil = useRef(0), inflight = useRef(0);
  const ctl = useFieldController({
    bindingId: binding.id, world_ref: world, index, stored: binding.view?.field, persist, onEffect,
    onChange: (prev, next, op, meta) => {
      const sync = syncRef.current; if (!sync || meta.remote) return;
      inflight.current++;
      void sync.mirror(prev, next, op, meta.origin).finally(() => { inflight.current--; quietUntil.current = performance.now() + 700; });
    },
    describe: ref => { const n = index.node(ref); if (n) return {title: n.title, revision: n.revision}; const e = expressionsRef.current.get(ref); return e ? {title: e.title} : undefined; },
  });
  const {state, view, apply, patchView} = ctl;
  const describeRef = useCallback((ref: FieldRef): DescribedRef | undefined => {
    const n = index.node(ref);
    if (n) return {title: n.title, revision: n.revision, owner: "Central", kind: "source", page: true};   // a corpus page is a Central source ref; its owner is never the field
    const e = expressionsRef.current.get(ref);
    return e ? {title: e.title, owner: "Expressions", kind: "expression", page: false} : undefined;
  }, [index]);
  const transportKey = JSON.stringify(kernel.transport);
  useEffect(() => {
    if (kernel.transport.kind === "unavailable") { syncRef.current = null; return; }
    const sync = createWorldSync(viaTransport(kernel.transport), {binding: binding.id, actor: `field:${binding.id}`, describe: describeRef});
    syncRef.current = sync;
    let disposed = false, pulling = false;
    // restored tangents are (re)registered with the kernel: portal records do not outlive a restart
    const st = ctl.stateRef.current;
    if (st.tabs.length || st.selected) void sync.mirror({...st, tabs: [], selected: undefined}, st, {op: "focus", tab: st.focus});
    const pull = async () => {
      if (disposed || pulling || inflight.current > 0 || performance.now() < quietUntil.current) return;
      pulling = true;
      try {
        const {ops, adopt} = await sync.inbound(ctl.stateRef.current);
        if (disposed || inflight.current > 0) return;
        for (const op of ops) ctl.apply(op, {remote: true});                // projections of the kernel's records: never echoed back
        sync.bind(ctl.stateRef.current, adopt);
      } catch { /* the kernel is momentarily unreachable: the field keeps what it shows */ }
      finally { pulling = false; }
    };
    void pull();
    const timer = window.setInterval(pull, 1500);
    (window as unknown as {__oiFieldPull?: () => Promise<void>}).__oiFieldPull = pull;
    return () => { disposed = true; window.clearInterval(timer); if (syncRef.current === sync) syncRef.current = null; };
  }, [transportKey, binding.id, describeRef]);                                // eslint-disable-line react-hooks/exhaustive-deps
  // the kernel's own events (a selection_set elsewhere moves the one global focus) are the prompt to read again
  const kfocus = JSON.stringify(kernel.snapshot.focus), ksurfaces = Object.keys(kernel.snapshot.surfaces).length;
  useEffect(() => { const t = window.setTimeout(() => (window as unknown as {__oiFieldPull?: () => Promise<void>}).__oiFieldPull?.(), 120); return () => window.clearTimeout(t); }, [kfocus, ksurfaces]);
  const filter = view.filter;
  const setFilter = useCallback((f: FieldFilter) => patchView(v => ({...v, filter: f})), [patchView]);

  // ── what is in view, and the one locus ──
  const tab = state.focus === "primary" ? null : state.tabs.find(t => t.id === state.focus) ?? null;
  const inViewIsExpression = tab?.kind === "expression";
  const pageTarget = tab && tab.kind === "page" ? tab : state.primary;
  const xEntry = tab?.kind === "expression" ? xmap.get(tab.ref) : undefined;
  const locus: FieldRef | null = inViewIsExpression
    ? (xEntry?.about.find(r => index.has(r)) ?? state.primary.ref)
    : locusRef(index, pageTarget.ref, pageTarget.span);
  const seqPlace = inViewIsExpression ? undefined : index.sequenceAt(pageTarget.ref);
  const spanHere = seqPlace ? (seqPlace.at ? seqPlace.at.span : pageTarget.span ?? seqPlace.sequence.items[0]?.span ?? null) : null;
  const readingRefs = useMemo(() => {
    if (!seqPlace) return [] as FieldRef[];
    const span = spanHere ? seqPlace.sequence.items.find(i => i.span === spanHere) : undefined;
    return span ? [span.ref, ...(span.section.ref ? [span.section.ref] : [])] : [];
  }, [seqPlace, spanHere]);
  const posLabel = useCallback((ref: FieldRef, span: string | undefined) => {
    const p = index.sequenceAt(ref); if (!p) return null;
    return p.at ? p.at.coord : span ?? null;
  }, [index]);

  // ── visited (a per-viewer convenience) ──
  const [visited, setVisited] = useState<Set<FieldRef>>(() => loadVisited(world));
  useEffect(() => {
    if (!locus || visited.has(locus)) return;
    const next = new Set(visited); next.add(locus); setVisited(next);
    try { window.localStorage.setItem(visitedKey(world), JSON.stringify([...next].slice(-2000))); } catch { /* ignore */ }
  }, [locus, visited, world]);

  // ── search ──
  const search = useFieldSearch(index, source);
  const searching = search.query.trim().length > 0;

  // ── ops that people and keys share ──
  const followTangent = useCallback((ref: FieldRef, span?: string) => apply({op: "open-preview", target: {ref, revision: index.node(ref)?.revision, span}}), [apply, index]);
  const followMain = useCallback((ref: FieldRef, span?: string) => apply({op: "open-main", target: {ref, revision: index.node(ref)?.revision, span}}), [apply, index]);
  const openExpression = useCallback((ref: FieldRef, scene?: string) => {
    const e = expressionsRef.current.get(ref);
    apply({op: "open-preview", target: {ref}, kind: "expression", scene: scene ?? e?.scenes[0]?.id});
  }, [apply]);
  const onFollow = useCallback((f: Following) => (f.main ? followMain(f.ref, f.span) : followTangent(f.ref, f.span)), [followMain, followTangent]);

  // ── hover: one bus, applied to whatever shows the ref ──
  const graph = useRef<GraphHandle | null>(null);
  const hoverRef = useRef<FieldRef | null>(null), hot = useRef<Element[]>([]);
  const setHover = useCallback((ref: FieldRef | null, from?: "graph") => {
    if (hoverRef.current === ref) return; hoverRef.current = ref;
    for (const el of hot.current) el.classList.remove("is-hover"); hot.current = [];
    if (ref != null && rootEl.current) {
      for (const el of rootEl.current.querySelectorAll(`[data-hov="${CSS.escape(ref)}"]`)) { if (el.closest(".graph-container")) continue; el.classList.add("is-hover"); hot.current.push(el); }
    }
    if (from !== "graph") graph.current?.setHover(ref);
  }, []);

  // ── layout state ──
  const [drawer, setDrawer] = useState(false);
  const [lib, setLib] = useState<LibraryState>({q: "", coll: "all", here: false, mode: "grid"});
  const [lightbox, setLightbox] = useState<{src: string; alt: string; caption: string} | null>(null);
  const emphasis = state.emphasis;
  const library = emphasis === "library";
  const leftOpen = view.left === "open";
  const rightClosed = view.right === "closed" && emphasis === "essay";
  const setEmphasis = useCallback((e: FieldEncounter["emphasis"]) => { if (e !== "essay" && view.right === "closed") patchView({right: "open"}); apply({op: "set-emphasis", emphasis: e}); }, [apply, patchView, view.right]);
  const toggleLibrary = useCallback(() => setEmphasis(state.emphasis === "library" ? "essay" : "library"), [setEmphasis, state.emphasis]);
  const focusSearch = useCallback(() => {
    if (narrow) setDrawer(true); else if (!leftOpen) patchView({left: "open"});
    setTimeout(() => { searchInput.current?.focus(); searchInput.current?.select(); }, 30);
  }, [narrow, leftOpen, patchView]);
  const setDrawerOpen = useCallback((open: boolean) => setDrawer(open), []);
  useEffect(() => { if (!narrow) setDrawer(false); }, [narrow]);
  useEffect(() => { if (narrow) setDrawer(false); }, [state.focus, state.primary.ref, narrow]);

  // the field panel's width: drag its left edge, arrow keys on the handle, double-click to reset
  const DEFAULT_W = 340;
  const maxW = Math.round(Math.min(900, width * 0.66));
  const railW = Math.max(260, Math.min(maxW, view.railWidth ?? DEFAULT_W));
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{x: number; w: number} | null>(null);
  const [dragW, setDragW] = useState<number | null>(null);
  const shownW = dragW ?? railW;
  const setW = (w: number) => Math.max(260, Math.min(maxW, Math.round(w)));

  // ── reading: scroll, anchors, contents ──
  const panes = useRef<Map<string, HTMLElement | null>>(new Map());
  const tops = useRef<Map<string, number>>(new Map());
  const anchors = useRef<{span: string; top: number}[]>([]);
  const pin = useRef<{span: string; until: number} | null>(null);
  const settling = useRef(false);
  const lastTop = useRef(0);
  const [contents, setContents] = useState<ContentEntry[] | null>(null);
  // where the reader was is remembered per page in view, not per tab slot (a preview slot is reused by the next tangent)
  const viewKey = `${state.focus}:${tab ? tab.ref : state.primary.ref}`;
  const readingRef = useRef<{reading: FieldReading; pane: HTMLElement} | null>(null);
  const base = () => (scroller.current ? scroller.current.getBoundingClientRect().top - scroller.current.scrollTop : 0);
  const measure = useCallback(() => {
    const pane = readingRef.current?.pane; const sc = scroller.current;
    anchors.current = [];
    if (!pane || !sc || !sc.clientHeight || pane.hidden || !seqPlace) return;
    const b = base();
    anchors.current = seqPlace.sequence.items.map(i => { const a = pane.querySelector<HTMLElement>("#" + CSS.escape(i.span)); return a ? {span: i.span, top: a.getBoundingClientRect().top - b} : null; }).filter((x): x is {span: string; top: number} => !!x);
  }, [seqPlace]);
  const glide = (top: number, smooth: boolean) => { const sc = scroller.current!; sc.scrollTo({top: Math.max(0, top), behavior: smooth && Math.abs(top - sc.scrollTop) < sc.clientHeight * 2 ? "smooth" : "auto"}); };
  const scrollToSpan = useCallback((span: string, smooth = true) => {
    measure(); const a = anchors.current.find(x => x.span === span);
    if (a) { glide(a.top - 24, smooth); pin.current = {span, until: performance.now() + 2500}; return true; }
    return false;
  }, [measure]);
  const scrollToId = useCallback((id: string, smooth = true) => {
    const pane = readingRef.current?.pane; const el = pane?.querySelector<HTMLElement>("#" + CSS.escape(id)); if (!el) return false;
    glide(el.getBoundingClientRect().top - base() - 24, smooth); return true;
  }, []);
  const lastSpanRef = useRef<string | null>(null);
  const lastWidth = useRef(0);
  // the reader's position is only derived from the scroll once the page in view has been put where the encounter says (a page
  // that has just loaded sits at its top; that is not where the reader is)
  const settledFor = useRef<string | null>(null);
  const onScroll = useCallback(() => {
    const sc = scroller.current; if (!sc || settling.current || !sc.clientHeight || library || inViewIsExpression || settledFor.current !== viewKey) return;
    lastTop.current = sc.scrollTop; tops.current.set(viewKey, sc.scrollTop);
    const max = sc.scrollHeight - sc.clientHeight;
    if (progress.current) progress.current.style.transform = `scaleX(${max > 0 ? sc.scrollTop / max : 0})`;
    if (seqPlace && !seqPlace.at) {
      const y = sc.scrollTop + 90; let span: string | null = null;
      for (const a of anchors.current) { if (a.top <= y) span = a.span; else break; }
      if (span == null && anchors.current.length) span = anchors.current[0].span;
      if (span && span !== lastSpanRef.current) { lastSpanRef.current = span; apply({op: "locate", span}); }
    }
  }, [seqPlace, viewKey, library, inViewIsExpression, apply]);
  const raf = useRef(0);
  useEffect(() => {
    const sc = scroller.current; if (!sc) return;
    const on = () => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; onScroll(); }); };
    const cancelPin = () => { pin.current = null; };
    sc.addEventListener("scroll", on, {passive: true});
    for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) sc.addEventListener(t, cancelPin, {passive: true});
    return () => { sc.removeEventListener("scroll", on); for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) sc.removeEventListener(t, cancelPin); };
  }, [onScroll]);
  // layout shifts under a pinned position (lazy images, rails opening) re-seat it
  useEffect(() => {
    const sc = scroller.current; if (!sc) return;
    const ro = new ResizeObserver(() => {
      if (!sc.clientHeight) return; measure();
      // the pane's width changed (a rail opened, the window narrowed): text reflows, so the reader is put back at the position held
      if (sc.clientWidth !== lastWidth.current) {
        const first = lastWidth.current === 0; lastWidth.current = sc.clientWidth;
        const held = ctl.stateRef.current.focus === "primary" ? ctl.stateRef.current.primary.span : undefined;
        if (!first && held && !library && !inViewIsExpression && seqPlace && !seqPlace.at && anchors.current.some(a => a.span === held)) { settling.current = true; scrollToSpan(held, false); settling.current = false; }
      }
      const p = pin.current;
      if (p && performance.now() < p.until) { const a = anchors.current.find(x => x.span === p.span); if (a && Math.abs(sc.scrollTop - (a.top - 24)) > 2) sc.scrollTo({top: Math.max(0, a.top - 24), behavior: "auto"}); }
      onScroll();
    });
    ro.observe(sc); for (const p of panes.current.values()) if (p) ro.observe(p);
    return () => ro.disconnect();
  });

  /** A body is on screen: build the contents, measure the anchors, and put the reader where the locus says. */
  const onReading = useCallback((reading: FieldReading, pane: HTMLElement | null) => {
    if (!pane || pane.hidden) return;
    readingRef.current = {reading, pane};
    settledFor.current = null;
    const sp = index.sequenceAt(reading.ref);
    const entries: ContentEntry[] = [];
    if (sp && !sp.at) {
      let room = "";
      for (const it of sp.sequence.items) {
        if (it.section.id !== room) { room = it.section.id; entries.push({key: "r" + room, level: 2, label: it.section.label, mark: it.section.coord, go: () => scrollToSpan(it.span, true)}); }
        entries.push({key: it.span, level: 3, label: it.label, mark: it.coord, go: () => scrollToSpan(it.span, true)});
      }
    } else {
      for (const h of pane.querySelectorAll<HTMLElement>("article h2, article h3")) entries.push({key: h.id || (h.textContent ?? ""), level: h.tagName === "H2" ? 2 : 3, label: (h.textContent ?? "").trim(), go: () => scrollToId(h.id, true)});
    }
    setContents(entries);
    requestAnimationFrame(() => {
      const sc = scroller.current; if (!sc) return;                 // unmounted while the frame was pending
      measure(); settling.current = true;
      const saved = tops.current.get(viewKey);
      const span = (stateRefSpan() ?? undefined);
      if (saved != null) { sc.scrollTop = saved; pin.current = null; }
      else if (sp && !sp.at && span && anchors.current.some(a => a.span === span)) scrollToSpan(span, false);
      else if (span && !sp && scrollToId(span, false)) { /* jumped to a heading */ }
      else sc.scrollTop = 0;
      settling.current = false; lastTop.current = sc.scrollTop; settledFor.current = viewKey;
      lastSpanRef.current = sp && !sp.at ? (anchors.current.find(a => a.top <= sc.scrollTop + 90) ?.span ?? span ?? null) : null;
      onScroll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, viewKey, measure, scrollToSpan, scrollToId, onScroll]);
  const stateRefSpan = () => (ctl.stateRef.current.focus === "primary" ? ctl.stateRef.current.primary.span : ctl.stateRef.current.tabs.find(t => t.id === ctl.stateRef.current.focus)?.span);

  // contents for an Expression: its scenes
  const expressionContents: ContentEntry[] | null = useMemo(() => {
    if (!tab || tab.kind !== "expression" || !xEntry) return null;
    return xEntry.scenes.map((sc, k) => ({key: sc.id, level: 3 as const, label: sc.name, mark: String(k + 1).padStart(2, "0"), here: sc.id === (tab.scene ?? xEntry.scenes[0]?.id), go: () => {
      frames.current.get(tab.id)?.contentWindow?.postMessage({type: "oi-scene", scene: sc.id}, "*");
      apply({op: "set-scene", scene_id: sc.id});
    }}));
  }, [tab, xEntry, apply]);
  const frames = useRef<Map<string, HTMLIFrameElement | null>>(new Map());
  const pageContents = useMemo(() => contents?.map(c => (seqPlace && !seqPlace.at && c.level === 3 ? {...c, here: c.key === spanHere} : c)) ?? null, [contents, seqPlace, spanHere]);

  // the tab came into view or went out of it: save where it was (the scroller is shared) and re-settle on arrival
  const prevKey = useRef(viewKey);
  useEffect(() => {
    if (prevKey.current !== viewKey) {
      const sc = scroller.current; if (sc && sc.clientHeight && !library) tops.current.set(prevKey.current, lastTop.current);
      prevKey.current = viewKey;
      requestAnimationFrame(() => { const sc2 = scroller.current; if (!sc2) return; const t = tops.current.get(viewKey); settling.current = true; sc2.scrollTop = t ?? 0; settling.current = false; lastTop.current = sc2.scrollTop; measure(); settledFor.current = viewKey; });
    }
  }, [viewKey, library, measure]);
  // back from the Library: the page is where it was left
  const wasLibrary = useRef(library);
  useEffect(() => { if (wasLibrary.current && !library) requestAnimationFrame(() => { const sc = scroller.current; const t = tops.current.get(viewKey); if (sc && t != null) { sc.scrollTop = t; measure(); onScroll(); } }); wasLibrary.current = library; }, [library, viewKey, measure, onScroll]);

  // ── keys ── (only while the field is what the person is in: its own focus, or nothing in particular is focused)
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keysRef.current = (e: KeyboardEvent) => {
    const root = rootEl.current; if (!root || !root.offsetParent) return;
    const target = e.target as Element | null;
    if (!(root.contains(target) || target === document.body || target === document.documentElement)) return;
    if (e.key === "Escape") { if (drawer) setDrawer(false); return; }
    if (e.altKey && e.key === "ArrowLeft" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); apply({op: "back"}); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "") || (target as HTMLElement | null)?.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey || target?.closest?.(".graph-svg")) return;
    if (e.key === "/") { e.preventDefault(); focusSearch(); }
    else if (e.key === "1") setEmphasis("essay"); else if (e.key === "2") setEmphasis("split"); else if (e.key === "3") setEmphasis("field"); else if (e.key === "4") setEmphasis("library");
    else if (e.key.toLowerCase() === "l") toggleLibrary();
    else if (e.key === "[") patchView({left: leftOpen ? "closed" : "open"});
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e);
    // capture phase: the shell's own key handling must not swallow the field's keys while the field is what the person is in
    window.addEventListener("keydown", on, true); return () => window.removeEventListener("keydown", on, true);
  }, []);
  // the agent's and the host's route in: this field's apply, nothing else
  const openExternal = useCallback((url: string) => window.open(url, "_blank", "noopener,noreferrer"), []);
  useEffect(() => {
    const el = rootEl.current; if (!el) return;
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && a.target === "_blank" && a.closest(".field-body")) { e.preventDefault(); openExternal(a.href); }
    };
    el.addEventListener("click", click, true); return () => el.removeEventListener("click", click, true);
  }, [openExternal]);

  const [stale, setStale] = useState<{ref: FieldRef; current: string} | null>(null);
  useEffect(() => { if (stale) { apply({op: "open-main", target: {ref: stale.ref, revision: stale.current}}); /* a stale hold is refreshed, never coerced silently */ setStale(null); } }, [stale, apply]);

  const here = state.selected ?? null;
  const onPointerOver = (e: React.PointerEvent) => {
    const t = (e.target as Element).closest?.("[data-hov], a[data-fref]") as HTMLElement | null; if (!t) return;
    setHover(t.dataset.hov ?? t.dataset.fref ?? null);
  };
  const onPointerOut = (e: React.PointerEvent) => { if ((e.target as Element).closest?.("[data-hov], a[data-fref]")) setHover(null); };

  const crumbCurrent = inViewIsExpression ? locus : pageTarget.ref;
  const mainPane = (
    <Article key={state.primary.ref} source={source} index={index} target={state.primary} expressions={xmap} shortTitle={shortTitle} isMain
      hidden={library || state.focus !== "primary"} onFollow={onFollow} onExpression={ref => openExpression(ref)}
      onJump={id => scrollToId(id, true)} onLightbox={img => setLightbox(figureOf(img))} onReading={onReading}
      onStale={(ref, current) => setStale({ref, current})} paneRef={el => { panes.current.set("main", el); }}/>
  );
  const tangentPane = tab && tab.kind === "page" ? (
    <Article key={"t:" + tab.ref} source={source} index={index} target={tab} expressions={xmap} shortTitle={shortTitle} isMain={false}
      hidden={library} onFollow={onFollow} onExpression={ref => openExpression(ref)} onJump={id => scrollToId(id, true)}
      onLightbox={img => setLightbox(figureOf(img))} onReading={onReading}
      onStale={(ref, current) => apply({op: "open-preview", target: {ref, revision: current}})} paneRef={el => { panes.current.set("tangent", el); }}/>
  ) : null;

  const layoutKey = `${emphasis}|${view.left}|${view.right}|${shownW}|${narrow}|${phone}|${width}`;
  const rootStyle = {"--rw": `${shownW}px`} as React.CSSProperties;

  return (
    <div className="field-host" ref={host} data-field-binding={binding.id}>
      <div ref={rootEl} className="field-root page" tabIndex={-1} data-theme={theme} data-view={emphasis} data-left={leftOpen ? "open" : "closed"}
        data-right={rightClosed ? "closed" : undefined} data-drawer={drawer ? "open" : "closed"} data-resizing={resizing ? "1" : undefined} style={rootStyle}
        onPointerDownCapture={() => rootEl.current?.focus({preventScroll: true})} onPointerOver={onPointerOver} onPointerOut={onPointerOut}
        data-generation={state.generation} data-focus={state.focus}
        data-encounter={(window as unknown as {__OI_FIELD_PROBE__?: boolean}).__OI_FIELD_PROBE__ ? JSON.stringify(state) : undefined}>
        <FieldIcons/>
        <div className="fq-body">
          <aside className="left sidebar" aria-label="Browse">
            <div className="rail-left">
              <button className="ibtn" type="button" aria-label="Open the explorer" onClick={() => patchView({left: "open"})}><Icon name="tree" size={18}/></button>
              <button className="ibtn" type="button" aria-label="Search" onClick={focusSearch}><Icon name="search" size={18}/></button>
              {!narrow && !leftOpen ? <FieldUtility host={hostOps} orientation="rail"/> : null}
            </div>
            <div className="left-inner">
              <div className="page-title">
                <span className="page-title__mark" aria-hidden="true">O<i>:</i>I</span>
                <span className="page-title__text">{source.label}</span>
                <button className="ibtn ibtn--sm sidebar-collapse" type="button" aria-label="Put the explorer away" onClick={() => patchView({left: "closed"})}><Icon name="chev" style={{transform: "scaleX(-1)"}}/></button>
                <button className="ibtn ibtn--sm drawer-close" type="button" aria-label="Close" onClick={() => setDrawer(false)}><Icon name="x"/></button>
              </div>
              <SearchBar s={search} index={index} inputRef={searchInput} onOpen={followTangent} onOpenMain={followMain} onHover={ref => setHover(ref)}/>
              <div className="explorer">
                <Explorer index={index} current={crumbCurrent} reading={readingRefs} visited={visited} hidden={searching}
                  open={useMemo(() => new Set(view.open ?? index.defaultOpen), [view.open, index])}
                  setOpen={(key, open) => patchView(v => { const cur = new Set(v.open ?? index.defaultOpen); open ? cur.add(key) : cur.delete(key); return {...v, open: [...cur]}; })}
                  openMain={ref => followMain(ref)}/>
                {searching ? <SearchResults s={search} index={index} onHover={ref => setHover(ref)} onOpen={(ref, e) => (e.metaKey || e.ctrlKey || e.shiftKey ? followMain(ref) : followTangent(ref))}/> : null}
              </div>
              {narrow || leftOpen ? <FieldUtility host={hostOps} orientation="bar"/> : null}
              <p className="left-foot">{index.nodes.length.toLocaleString("en-US")} pages{index.footnote ? <><br/>{index.footnote}</> : null}</p>
            </div>
          </aside>

          <main className="center">
            <header className="center-head">
              <button className="ibtn head-browse" type="button" aria-label="Browse" onClick={() => setDrawerOpen(!drawer)}><Icon name="tree" size={18}/></button>
              {state.focus !== "primary" || state.trail.length ? (
                <button className="ibtn ibtn--sm field-back" type="button" aria-label={state.focus !== "primary" ? "Back to the main passage" : "Back to the previous main page"} title={state.focus !== "primary" ? "Back to the main passage (Alt+←)" : "Back to the previous main page (Alt+←)"} onClick={() => apply({op: "back"})}><Icon name="chev" style={{transform: "scaleX(-1)"}}/></button>
              ) : null}
              <Tabs index={index} state={state} expressions={xmap} shortTitle={shortTitle} apply={op => apply(op)} posLabel={posLabel}/>
              <div className="seg viewseg" role="group" aria-label="Library">
                <button type="button" aria-pressed={library} title="Library: the Expressions (L)" onClick={toggleLibrary}><Icon name="library" size={15}/><span>Library</span></button>
              </div>
            </header>
            <div className="progress" aria-hidden="true"><i ref={progress}/></div>
            <div className={`center-scroll${!library && inViewIsExpression ? " has-x" : ""}`} ref={scroller}>
              {mainPane}
              {tangentPane}
              {!library && tab?.kind === "expression" ? (
                <div className="article fpane tangent-pane is-expression" key={"x:" + tab.id}>
                  <ExpressionFrame key={tab.ref} source={source} entry={xEntry} scene={tab.scene} theme={theme}
                    onOpenPage={ref => followTangent(ref)} reg={f => { frames.current.set(tab.id, f); }}/>
                </div>
              ) : null}
              {library ? <Library source={source} index={index} xindex={xindex} focus={locus} ui={lib} setUi={setLib} shortTitle={shortTitle}
                open={(ref, scene) => openExpression(ref, scene)} openPage={ref => followTangent(ref)} assetUrl={e => source.coverUrl?.(e)}/> : null}
            </div>
            <Rail sequence={seqPlace?.sequence} here={spanHere} hidden={library || inViewIsExpression || !seqPlace}
              onGo={it => (seqPlace && !seqPlace.at ? scrollToSpan(it.span, true) : followTangent(it.ref))} onHover={ref => setHover(ref)}/>
            <footer className="center-foot" ref={footRef}>
              <Crumbs index={index} current={crumbCurrent} openMain={ref => followMain(ref)} hostRef={host}/>
              <span className="head-pos">{spanHere && seqPlace ? <span className="pos"><b>{seqPlace.at ? seqPlace.at.coord : spanHere}</b><i>/{seqPlace.sequence.items.length}</i></span> : null}</span>
            </footer>
          </main>

          <aside className="right sidebar" aria-label="The field">
            <div className="rsz" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the field panel (drag, or arrow keys; double-click to reset)"
              onPointerDown={e => { if (e.button) return; e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); drag.current = {x: e.clientX, w: shownW}; setResizing(true); }}
              onPointerMove={e => { if (drag.current) setDragW(setW(drag.current.w + (drag.current.x - e.clientX))); }}
              onPointerUp={() => { if (!drag.current) return; drag.current = null; setResizing(false); if (dragW != null) patchView({railWidth: dragW}); setDragW(null); }}
              onPointerCancel={() => { drag.current = null; setResizing(false); setDragW(null); }}
              onDoubleClick={() => patchView({railWidth: DEFAULT_W})}
              onKeyDown={e => {
                const step = e.shiftKey ? 80 : 24;
                if (e.key === "ArrowLeft") { e.preventDefault(); patchView({railWidth: setW(shownW + step)}); }
                else if (e.key === "ArrowRight") { e.preventDefault(); patchView({railWidth: setW(shownW - step)}); }
                else if (e.key === "Home" || e.key === "Enter") { e.preventDefault(); patchView({railWidth: DEFAULT_W}); }
              }}/>
            <div className="right-inner">
              <GraphPane index={index} focus={locus} selected={here ?? undefined} filter={filter} setFilter={setFilter} hits={search.hitSet} visited={visited}
                select={ref => apply({op: "select", ref}, {origin: "graph"})} openTangent={ref => followTangent(ref)} openMain={ref => followMain(ref)} openExpression={ref => openExpression(ref)}
                gathered={state.constellation?.refs ?? NO_REFS} defaultTitle={`Gathered at ${index.node(locus ?? "")?.label ?? "the field"}`}
                gather={ref => { const cur = state.constellation?.refs ?? []; const next = cur.includes(ref) ? cur.filter(r => r !== ref) : [...cur, ref]; apply(next.length ? {op: "enter-constellation", refs: next} : {op: "leave-constellation"}); }}
                leaveConstellation={() => apply({op: "leave-constellation"})}
                openInTechne={async (title, question) => {
                  try {
                    await gatherToTechne({transport: kernel.transport, apply: kernel.apply, source, refs: [...(ctl.stateRef.current.constellation?.refs ?? [])], title, question,
                      projects: kernel.snapshot.navigator?.root?.work.projects ?? [], returnTo: {place: {ref: ctl.stateRef.current.primary.ref, title: index.node(ctl.stateRef.current.primary.ref)?.title ?? "the field"}}});
                    return undefined;
                  } catch (e) { return e instanceof Error ? e.message : String(e); }
                }}
                hover={ref => setHover(ref, "graph")} collapse={() => patchView({right: "closed"})} onGraph={g => { graph.current = g; }} layoutKey={layoutKey}/>
              <div className="right-scroll">
                <Contents entries={inViewIsExpression ? expressionContents : pageContents}/>
                <Connections index={index} focus={locus} filter={filter} setFilter={setFilter} spanLabel={seqPlace && !seqPlace.at && spanHere ? spanHere : null}
                  onOpen={(ref, e) => (e.metaKey || e.ctrlKey || e.shiftKey ? followMain(ref) : followTangent(ref))} onHover={ref => setHover(ref)}/>
              </div>
            </div>
            <div className="rail-right">
              <button className="ibtn" type="button" aria-label="Open the field" onClick={() => patchView({right: "open"})}><Icon name="field" size={18}/></button>
              <span className="rail-right__t">The field</span>
            </div>
          </aside>
        </div>
        <nav className="bottombar" aria-label="Panels">
          <button type="button" aria-pressed={emphasis === "essay"} onClick={() => setEmphasis("essay")}><Icon name="essay" size={18}/><span>Reading</span></button>
          <button type="button" aria-pressed={emphasis === "field"} onClick={() => setEmphasis("field")}><Icon name="field" size={18}/><span>Field</span></button>
          <button type="button" aria-pressed={library} onClick={toggleLibrary}><Icon name="library" size={18}/><span>Library</span></button>
          <button type="button" onClick={focusSearch}><Icon name="search" size={18}/><span>Search</span></button>
        </nav>
        <div className="scrim" onClick={() => setDrawer(false)}/>
        <Lightbox figure={lightbox} onClose={() => setLightbox(null)}/>
      </div>
    </div>
  );
}

function figureOf(img: HTMLImageElement) {
  const cap = img.closest("figure")?.querySelector("figcaption");
  return {src: img.currentSrc || img.src, alt: img.alt, caption: cap ? cap.innerHTML : ""};
}

