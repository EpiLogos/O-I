/**
 * The Library's browser: scope + search + results, composed as one body a
 * host surface can present as a popover or a pane. Fills its host
 * (`height:100%`), owns its own scrolling, and never queries a provider
 * before it is mounted — mounting IS "the person opening the browser".
 *
 * Providers are fanned out debounced (250ms) with AbortController
 * cancellation on every new query and on unmount; the literal text filter
 * runs client-side over whatever the providers most recently returned, so
 * typing feels instant while the owner reads settle behind it.
 *
 * Two presentations of the same collection data (owner Wayfinder §8):
 * BROWSE — the columnar Web inventory (LibraryBrowse), where things live
 * and which constellation/Scene entering means; SEARCH — the established
 * card gallery (LibraryResults), for finding and choosing. The view is
 * presentation state (persisted per viewer, guarded); the Technē summon
 * presents either one through the `oi:library-view` event / the summon's
 * last ask (techneSummon.tsx).
 */
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {resolveCollectionSelection} from "./collectionSelection";
import {CollectionMembershipEditor} from "./CollectionMembershipEditor";
import {IconChoiceStrip,IconTab} from "../workspace/primitives/IconTabStrip";
import {Glyph} from "../workspace/Glyph";
import {MODE_CURATION, type WorkspaceMode} from "../workspace/mode";
import type {LibraryCoverage, LibraryItem, LibraryKind, LibraryQuery, LibraryScopeId} from "./scope";
import {LibraryScope} from "./LibraryScope";
import {LibraryResults} from "./LibraryResults";
import {LibraryBrowse} from "./LibraryBrowse";
import {libraryProviders, subscribeLibraryProviders, useBuiltInLibraryProviders} from "./providers";
import {lastSummonView} from "./techneSummon";
import "./library.css";

/** "here" filters providers/kinds by the current mode (SCOPE SEMANTICS). */
const HERE_KINDS: Record<WorkspaceMode, LibraryKind[]> = {
  base: ["projected-object", "page"],
  factory: ["projected-object", "page"],
  techne: ["composition", "world", "projected-object", "page"],
  expressions: ["composition", "world"],
  "epi-logos": ["composition", "place", "page"],
  settings: ["projected-object", "page"],
};

const DEBOUNCE_MS = 250;
const VIEW_STORAGE = "oi-cradle.library.view.v1";

type LibraryView = "browse" | "gallery";

function initialView(): LibraryView {
  // The Technē summon's last ask wins over the remembered view — the summon
  // IS the person asking for a specific presentation right now.
  const summoned = lastSummonView();
  if (summoned) return summoned;
  try {
    const remembered = window.localStorage.getItem(VIEW_STORAGE);
    return remembered === "gallery" ? "gallery" : "browse";
  } catch { return "browse"; }
}

export function LibraryBrowser({mode, onOpen, onMessage, initialScope}: {
  mode: WorkspaceMode;
  onOpen: (item: LibraryItem, how: "page" | "expression" | "instrument" | "source") => void;
  onMessage?: (message: string) => void;
  initialScope?: LibraryScopeId;
}) {
  useBuiltInLibraryProviders();
  const {transport} = useKernel();
  const [openError, setOpenError] = useState("");
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const opening = useRef<AbortController | null>(null);
  useEffect(() => () => { opening.current?.abort(); }, []);
  const openItem = useCallback((item: LibraryItem, how: "page" | "expression" | "instrument" | "source") => {
    opening.current?.abort();
    const controller = new AbortController(); opening.current = controller;
    setOpenError("");
    void (async () => {
      try {
        const resolved = await resolveCollectionSelection(transport, item, controller.signal);
        if (controller.signal.aborted) return;
        if (resolved.collectionMemberships?.length && how === "expression" && !resolved.expressionRef) throw new Error("This saved Journey has no native Expression binding yet. Open its exact source or use the Expressions collection import.");
        await onOpen(resolved, resolved.collectionMemberships?.length && how === "page" ? "source" : how);
      } catch (cause) {
        if (!controller.signal.aborted) setOpenError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
  }, [transport, onOpen]);
  const [scope, setScope] = useState<LibraryScopeId>(initialScope ?? "here");
  const [view, setView] = useState<LibraryView>(initialView);
  const [text, setText] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [coverage, setCoverage] = useState<LibraryCoverage[]>([]);
  const contextKey = `${scope}:${mode}`;
  const [readingContext, setReadingContext] = useState("");
  useEffect(() => { opening.current?.abort(); setOpenError(""); }, [contextKey]);
  const [selectedRef, setSelectedRef] = useState<string | undefined>();
  const registeredProviders = useSyncExternalStore(subscribeLibraryProviders, libraryProviders, libraryProviders);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { window.localStorage.setItem(VIEW_STORAGE, view); } catch { /* per-viewer convenience only */ } }, [view]);

  // The Technē summon presents a specific view while the browser is already
  // mounted; a late-mounting browser reads the same ask at init.
  useEffect(() => {
    const onView = (event: Event) => {
      const detail = (event as CustomEvent<{view?: LibraryView; focus?: string}>).detail;
      if (detail?.view === "browse" || detail?.view === "gallery") setView(detail.view);
      if (detail?.focus === "search") requestAnimationFrame(() => searchRef.current?.focus());
    };
    window.addEventListener("oi:library-view", onView);
    return () => window.removeEventListener("oi:library-view", onView);
  }, []);

  // Re-read at subscription time as well as on changes: built-in providers
  // register in an earlier effect on this same mount. A passive subscription
  // alone misses those first events and can leave the Library empty forever.

  const relevantProviders = useMemo(() => {
    const kinds = scope === "here" ? HERE_KINDS[mode] : undefined;
    return registeredProviders.filter(provider => {
      if (scope === "shared" && !provider.scopes.includes("shared")) return false;
      if (kinds && !provider.kinds.some(kind => kinds.includes(kind))) return false;
      if (provider.modes && !provider.modes.includes(mode)) return false;
      return true;
    });
  }, [scope, mode, registeredProviders]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const kinds = scope === "here" ? HERE_KINDS[mode] : undefined;
      const query: LibraryQuery = {scope, mode, text, kinds, fresh: refreshGeneration > 0};
      Promise.all(relevantProviders.map(provider =>
        provider.list(query, controller.signal).catch((cause): {items: LibraryItem[]; coverage: LibraryCoverage} => ({
          items: [], coverage: {provider: provider.id, state: "unavailable", reason: cause instanceof Error ? cause.message : String(cause)},
        })),
      )).then(results => {
        if (controller.signal.aborted) return;
        const literal = text.trim().toLowerCase();
        let nextItems = results.flatMap(result => result.items);
        if (literal) nextItems = nextItems.filter(item =>
          item.title.toLowerCase().includes(literal) || item.summary?.toLowerCase().includes(literal) || item.ref.toLowerCase().includes(literal) || item.collectionMemberships?.some(m => [m.title, m.member_id, m.group, m.manifest_path].some(value => value.toLowerCase().includes(literal))));
        setReadingContext(contextKey);
        setItems(nextItems);
        setCoverage(results.map(result => result.coverage));
        setSelectedRef(current => current && nextItems.some(item => item.ref === current) ? current : undefined);
      }).catch(cause => {
        if (!controller.signal.aborted) onMessage?.(cause instanceof Error ? cause.message : String(cause));
      });
    }, DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [relevantProviders, scope, mode, text, onMessage, refreshGeneration, contextKey]);

  // The literal filter is INSTANT over whatever the providers most recently
  // returned ("typing feels instant while the owner reads settle behind
  // it") — a client-side filter of the existing reads, never a second index.
  const literal = text.trim().toLowerCase();
  const eligibleItems = useMemo(() => readingContext === contextKey
    ? items.filter(item => relevantProviders.some(provider => provider.id === item.provider)) : [],
    [items, readingContext, contextKey, relevantProviders]);
  const visibleItems = useMemo(() => literal
    ? eligibleItems.filter(item =>
        item.title.toLowerCase().includes(literal)
        || item.summary?.toLowerCase().includes(literal)
        || item.ref.toLowerCase().includes(literal)
        || item.collectionMemberships?.some(m => [m.title, m.member_id, m.group, m.manifest_path].some(value => value.toLowerCase().includes(literal))))
    : eligibleItems, [eligibleItems, literal]);

  // Epi-Logos places register externally and are never imported here
  // (COMMON-BRIEF: another agent owns src/epilogos); until one registers,
  // name the absence honestly instead of showing an empty "Places" group.
  const epiCoverage: LibraryCoverage[] = mode === "epi-logos" && !relevantProviders.some(provider => provider.kinds.includes("place"))
    ? [{provider: "epi-logos-places", state: "unavailable", reason: "Epi-Logos places register when that world's sources connect"}]
    : [];
  const allCoverage = (readingContext === contextKey ? coverage : []).concat(epiCoverage);

  const move = useCallback((delta: number) => {
    if (visibleItems.length === 0) return;
    const at = visibleItems.findIndex(item => item.ref === selectedRef);
    const next = visibleItems[(at + delta + visibleItems.length) % visibleItems.length] ?? visibleItems[0];
    setSelectedRef(next.ref);
  }, [visibleItems, selectedRef]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inSearch = target === searchRef.current;
      if (!inSearch && target?.closest("button,input,textarea,select,summary")) return;
      if (event.key === "/" && !inSearch) { event.preventDefault(); searchRef.current?.focus(); return; }
      if (event.key === "ArrowDown") { event.preventDefault(); move(1); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); move(-1); return; }
      if (event.key === "Enter") {
        const current = visibleItems.find(item => item.ref === selectedRef);
        if (current) { event.preventDefault(); openItem(current, "page"); }
        return;
      }
      if (event.key === "Escape" && inSearch) setText("");
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [move, visibleItems, selectedRef, openItem]);

  return <div ref={rootRef} className="lib-browser" data-library-view={view}>
    <div className="oi-panel-head lib-head">
      <span className="oi-eyebrow">Library</span>
      <div className="lib-head-controls">
        <LibraryScope value={scope} mode={mode} onChange={setScope}/>
        <IconChoiceStrip className="lib-view" aria-label="Library presentation">
          <IconTab choice icon="columns" label="Browse" selected={view==="browse"} data-view-choice="browse"
            title="Browse / location — the columnar Web inventory" onClick={()=>setView("browse")}>Browse</IconTab>
          <IconTab choice icon="search" label="Search" selected={view==="gallery"} data-view-choice="gallery"
            title="Search / discovery — the card gallery" onClick={()=>setView("gallery")}>Search</IconTab>
        </IconChoiceStrip>
      </div>
    </div>
    <div className="oi-tool-row lib-search-row">
      <Glyph name="search" size={13}/>
      <input ref={searchRef} className="oi-input lib-search" type="search" aria-label="Search the Library"
        placeholder={`Search ${MODE_CURATION[mode]?.label ?? mode}`} value={text}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setText(""); } }}/>
    </div>
    {readingContext === contextKey && openError && <p className="oi-refusal" role="alert">{openError}</p>}
    <button type="button" className="oi-action" onClick={() => { opening.current?.abort(); setRefreshGeneration(g => g + 1); }}>Refresh sources</button>
    {visibleItems.find(item => item.ref === selectedRef) && <CollectionMembershipEditor item={visibleItems.find(item => item.ref === selectedRef)!} onChanged={() => setRefreshGeneration(g => g + 1)}/>}
    {view === "browse"
      ? <div className="lib-results oi-scroll"><LibraryBrowse items={visibleItems} coverage={allCoverage} selectedRef={selectedRef}
          onSelect={item => setSelectedRef(item.ref)} onOpen={openItem} scope={scope} onScopeChange={setScope}/></div>
      : <LibraryResults items={visibleItems} coverage={allCoverage} selectedRef={selectedRef} onSelect={item => setSelectedRef(item.ref)} onOpen={openItem}/>}
  </div>;
}
