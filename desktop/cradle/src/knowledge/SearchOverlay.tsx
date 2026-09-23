import { useEffect, useRef, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { KnowledgeAddress, KnowledgeHit, KnowledgeRequest } from "../kernel/types";
import { knowledge } from "./client";
import { OwnerActions } from "./OwnerActions";
import { graphAddress } from "./graph";
import { searchLeaderLabel } from "./leader";
import "./knowledge.css";
import "@epilogos/oi-design-system/search.css";
import "./search.css";
import "./palette.css";
import {Glyph} from "../workspace/Glyph";

import {progressiveSearch, searchKeys, preserveSearchSelection, type ResolutionRow} from "./searchProgress";
import type {EncounterRow} from "../encounter/EncounterList";
import type {FlowInstanceRow} from "../flow/instances";
import {listFlowInstances} from "../flow/instances";
import {readConversations} from "../workspace/left/ChatRows";
import {nativeAgentOwner} from "../agency/nativeAgentClient";
export {normalizeResolution} from "./searchProgress";

/** The palette's typed tabs (10-SIDEBARS §3.1): All · Chats · Agents · Files
 * · Flows · Actions. Each tab filters one REAL source; a tab whose source or
 * open route the frame does not lend is omitted, never faked. */
export interface PaletteSources {
  /** The registers whose conversations Chats lists ("" = Central's root). */
  registers?: string[];
  onOpenChat?: (row: EncounterRow) => Promise<void> | void;
  onOpenFlow?: (row: FlowInstanceRow) => Promise<void>;
  /** The agent roster's home (the Agency surface). */
  onOpenAgents?: () => void;
  /** The app's own verbs (New chat, New flow, a mode…), each a real route. */
  actions?: {label: string; hint?: string; run: () => void}[];
}
type PaletteTab = "all" | "chats" | "agents" | "files" | "flows" | "actions";
interface TypedItem {key: string; label: string; detail: string; open: () => Promise<void> | void}

type Props = {
  typed?: PaletteSources;
  leader: boolean;
  onLeaderChange: (shift: boolean) => void;
  shortcutError?: string;
  project?: string;
  onClose: () => void;
  onOpen: (address: KnowledgeAddress, title: string, project?: string) => Promise<void>;
};
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function SearchOverlay({ project, onClose, onOpen, leader, onLeaderChange, shortcutError, typed }: Props) {
  const { transport } = useKernel();
  const dialog = useRef<HTMLDialogElement>(null);
  const epoch = useRef(0);
  const composition = useRef(false);
  const opening = useRef(false);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [hits, setHits] = useState<KnowledgeHit[]>([]);
  const [rows, setRows] = useState<ResolutionRow[]>([]);
  const [selected, setSelected] = useState(0);
  const selectedKey = useRef<string>();
  const [pendingProviders, setPendingProviders] = useState<string[]>([]);
  const [absences, setAbsences] = useState<string[]>([]);
  const [resolutionAbsences, setResolutionAbsences] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [detail, setDetail] = useState<unknown>();
  const [detailBusy, setDetailBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const count = hits.length + rows.length;
  // ---- typed tabs -------------------------------------------------------
  const [tab, setTab] = useState<PaletteTab>("all");
  const [typedSelected, setTypedSelected] = useState(0);
  const [chats, setChats] = useState<{rows?: EncounterRow[]; error?: string}>({});
  const [agents, setAgents] = useState<{rows?: {ref: string; name: string; purpose: string}[]; error?: string}>({});
  const [flows, setFlows] = useState<{rows?: FlowInstanceRow[]; error?: string}>({});
  const tabs: {id: PaletteTab; label: string}[] = [
    {id: "all", label: "All"},
    ...(typed?.onOpenChat ? [{id: "chats" as const, label: "Chats"}] : []),
    ...(typed?.onOpenAgents ? [{id: "agents" as const, label: "Agents"}] : []),
    {id: "files", label: "Files"},
    ...(typed?.onOpenFlow ? [{id: "flows" as const, label: "Flows"}] : []),
    {id: "actions", label: "Actions"},
  ];
  const registersKey = (typed?.registers ?? []).join("|");
  useEffect(() => {
    if (tab !== "chats" || chats.rows || chats.error) return;
    let live = true;
    void Promise.allSettled((typed?.registers ?? [project ?? ""]).map(register => readConversations(transport, register))).then(results => {
      if (!live) return;
      const rows = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
      const failed = results.filter(result => result.status === "rejected").length;
      setChats({rows, error: failed && !rows.length ? "Couldn't read the conversations." : undefined});
    });
    return () => { live = false; };
  }, [tab, registersKey, transport]);
  useEffect(() => {
    if (tab !== "agents" || agents.rows || agents.error) return;
    let live = true;
    void nativeAgentOwner(transport, project)({action: "roster"}).then(value => {
      const roster = value as {profiles?: {profile?: {ref?: string; name?: string; purpose?: string; agent_ref?: string}}[]};
      if (live) setAgents({rows: (roster.profiles ?? []).map(entry => ({ref: entry.profile?.ref ?? entry.profile?.agent_ref ?? "", name: entry.profile?.name ?? entry.profile?.agent_ref ?? "Agent", purpose: entry.profile?.purpose ?? ""})).filter(row => row.ref)});
    }).catch(failure => { if (live) setAgents({error: `Couldn't read the agent roster: ${message(failure)}`}); });
    return () => { live = false; };
  }, [tab, transport, project]);
  useEffect(() => {
    if (tab !== "flows" || flows.rows || flows.error) return;
    let live = true;
    void listFlowInstances(transport).then(rows => { if (live) setFlows({rows}); }).catch(failure => { if (live) setFlows({error: `Couldn't read your flows: ${message(failure)}`}); });
    return () => { live = false; };
  }, [tab, transport]);
  useEffect(() => setTypedSelected(0), [tab, query]);
  const needle = query.trim().toLowerCase();
  const matches = (...values: string[]) => !needle || values.some(value => value.toLowerCase().includes(needle));
  const isFileHit = (hit: KnowledgeHit) => hit.address.kind === "source" || /file|source|document/i.test(hit.kind);
  const typedItems: TypedItem[] = tab === "chats" ? (chats.rows ?? []).filter(row => matches(row.title, row.project)).map(row => ({key: `${row.project}:${row.ref}`, label: row.title, detail: `Chat · ${row.project || "Central"}`, open: () => typed?.onOpenChat?.(row)}))
    : tab === "agents" ? (agents.rows ?? []).filter(row => matches(row.name, row.purpose)).map(row => ({key: row.ref, label: row.name, detail: row.purpose || "Agent", open: () => typed?.onOpenAgents?.()}))
    : tab === "files" ? hits.filter(isFileHit).map(hit => ({key: searchKeys([hit], [])[0], label: hit.label, detail: `${hit.kind} · ${hit.snippet}`, open: () => onOpen(hit.address, hit.label, project)}))
    : tab === "flows" ? (flows.rows ?? []).filter(row => matches(row.name)).map(row => ({key: row.location.ref, label: row.name.replace(/\.html$/i, ""), detail: `Flow · ${row.location.path}`, open: () => typed?.onOpenFlow?.(row)}))
    : tab === "actions" ? [
        ...(typed?.actions ?? []).filter(action => matches(action.label, action.hint ?? "")).map(action => ({key: `app:${action.label}`, label: action.label, detail: action.hint ?? "Action", open: () => action.run()})),
        ...rows.filter(row => row.actions.length > 0).map((row, index) => ({key: `${row.reference}:${index}`, label: row.label, detail: `${row.kind} · ${row.owner}`, open: () => openRow(row)})),
      ]
    : [];
  const typedState = tab === "chats" ? (chats.error ?? (!chats.rows ? "Reading conversations…" : undefined))
    : tab === "agents" ? (agents.error ?? (!agents.rows ? "Reading the agent roster…" : undefined))
    : tab === "flows" ? (flows.error ?? (!flows.rows ? "Reading your flows…" : undefined))
    : (tab === "files" || tab === "actions") && busy ? "Searching…" : undefined;
  const openTyped = async (item: TypedItem | undefined) => {
    if (!item || opening.current) return;
    opening.current = true; setIsOpening(true); setError(undefined);
    try { await item.open(); onClose(); }
    catch (failure) { setError(message(failure)); }
    finally { opening.current = false; setIsOpening(false); }
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const field = previous instanceof HTMLTextAreaElement || previous instanceof HTMLInputElement ? previous : null;
    const caret = field && field.selectionStart !== null ? { start: field.selectionStart, end: field.selectionEnd, direction: field.selectionDirection } : null;
    const selection = window.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      ++epoch.current;
      modal?.close();
      if (!previous?.isConnected) return;
      previous.focus({ preventScroll: true });
      if (field && caret) field.setSelectionRange(caret.start, caret.end, caret.direction ?? undefined);
      else if (ranges.length) {
        const current = window.getSelection();
        current?.removeAllRanges();
        for (const range of ranges) if (range.startContainer.isConnected) current?.addRange(range);
      }
    };
  }, []);

  useEffect(() => {
    const request = ++epoch.current;
    setError(undefined);
    setDetail(undefined);
    setDetailBusy(false);
    setHits([]);
    setRows([]);
    setAbsences([]);
    setResolutionAbsences([]);
    setSelected(0);
    selectedKey.current = undefined;
    setPendingProviders([]);
    setBusy(!composing);
    if (composing) return;
    // Preserve the literal native query; publish each owner's response as it
    // arrives rather than holding usable results behind the slowest provider.
    const controller = new AbortController();
    progressiveSearch(
      () => knowledge(transport, project, {action: "search", query}, {signal: controller.signal}),
      () => knowledge(transport, project, {action: "resolve", query}, {signal: controller.signal}),
      snapshot => {
        if (epoch.current !== request) return;
        const index = preserveSearchSelection(selectedKey.current, snapshot.hits, snapshot.rows);
        setHits(snapshot.hits);
        setRows(snapshot.rows);
        setSelected(index);
        selectedKey.current = searchKeys(snapshot.hits, snapshot.rows)[index];
        setAbsences(snapshot.absences);
        setResolutionAbsences(snapshot.resolutionAbsences);
        setError(snapshot.error);
        setPendingProviders(snapshot.pending);
        setBusy(snapshot.pending.length > 0);
      },
      controller.signal,
    );
    return () => { controller.abort(); ++epoch.current; };
  }, [query, composing, project, transport, generation]);

  // Invalidate synchronously, not only when the next effect runs. A pending
  // old response or an Enter in the same input turn cannot open a stale row.
  const changeQuery = (value: string) => {
    ++epoch.current;
    setBusy(true);
    setHits([]);
    setRows([]);
    setDetail(undefined);
    setSelected(0);
    selectedKey.current = undefined;
    setQuery(value);
  };
  const showDetail = async (request: KnowledgeRequest) => {
    const current = epoch.current;
    setDetailBusy(true);
    setError(undefined);
    try {
      const data = await knowledge(transport, project, request);
      if (epoch.current === current) setDetail(data);
    } catch (failure) {
      if (epoch.current === current) setError(message(failure));
    } finally {
      if (epoch.current === current) setDetailBusy(false);
    }
  };
  const openAddress = async (address: KnowledgeAddress, title: string) => {
    if (composition.current || opening.current || !count) return;
    opening.current = true;
    setIsOpening(true);
    setError(undefined);
    try { await onOpen(address, title, project); onClose(); }
    catch (failure) { setError(message(failure)); }
    finally { opening.current = false; setIsOpening(false); }
  };
  const openRow = (row: ResolutionRow) => {
    // AIKit resolution rows always carry a local address; a hosted row
    // (native_owner shared-field) would not, and is not what resolve returns.
    const address = graphAddress({
      ref: row.reference, kind: row.kind, label: row.label, native_owner: row.owner,
      provenance: { source: row.owner, detail: row.provenance }, actions: row.actions,
    });
    if (!address) { setError(`No local address for ${row.reference}`); return; }
    return openAddress(address, row.label);
  };
  const accept = () => {
    if (composition.current || opening.current || !count) return;
    const hit = hits[selected];
    const row = rows[selected - hits.length];
    if (hit) void openAddress(hit.address, hit.label);
    else if (row) void openRow(row);
  };
  const selectResult = (index: number) => {
    selectedKey.current = searchKeys(hits, rows)[index];
    setSelected(index);
  };
  const navigate = (delta: number) => {
    if (composition.current || !count) return;
    const next = (selected + delta + count) % count;
    selectResult(next);
    dialog.current?.querySelector(`[data-search-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return <dialog ref={dialog} className="search-aperture search-glass" aria-label="Search Central"
    onKeyDownCapture={event => {
      if (composition.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        // Escape belongs to the IME, not the search input's native clear act.
        // Enter must not submit the current row while a composition is live.
        if (event.key === "Escape" || event.key === "Enter") event.preventDefault();
        return;
      }
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        if (tab !== "all") { const length = typedItems.length; if (length) setTypedSelected(value => (value + (event.key === "ArrowDown" ? 1 : -1) + length) % length); }
        else navigate(event.key === "ArrowDown" ? 1 : -1);
      }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}
    onCancel={event => { event.preventDefault(); if (!composition.current) onClose(); }}>
    <form className="search-query" onSubmit={event => { event.preventDefault(); if (tab !== "all") void openTyped(typedItems[typedSelected]); else accept(); }}>
      <span className="search-symbol" aria-hidden="true"><Glyph name="search" size={16}/></span>
      <input spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" autoFocus
        aria-label="Search or resolve" type="search" disabled={isOpening}
        aria-controls="knowledge-search-results" aria-activedescendant={count && !composing ? `knowledge-search-${selected}` : undefined}
        value={query} onChange={event => changeQuery(event.target.value)}
        onCompositionStart={() => { composition.current = true; ++epoch.current; setComposing(true); }}
        onCompositionEnd={event => { composition.current = false; ++epoch.current; setBusy(true); setQuery(event.currentTarget.value); setComposing(false); }}
        onKeyDown={event => { if (event.key === "Enter" && (composition.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}
        placeholder={`Search ${project ?? "Central"}`} />
      <button type="button" className="search-dismiss" aria-label="Close search" onClick={onClose}><kbd>esc</kbd></button>
    </form>
    <nav className="search-tabs" role="tablist" aria-label="Result kinds">
      {tabs.map(entry => <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} data-palette-tab={entry.id} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
    </nav>
    {tab !== "all" && <div className="search-scroll search-typed" role="tabpanel" aria-label={tabs.find(entry => entry.id === tab)?.label}>
      {error && <p role="alert">{error}</p>}
      {typedState && !typedItems.length ? <p className="search-empty" role="status">{typedState}</p>
        : !typedItems.length ? <p className="search-empty">{needle ? `No ${tabs.find(entry => entry.id === tab)?.label.toLowerCase()} match "${query.trim()}".` : `No ${tabs.find(entry => entry.id === tab)?.label.toLowerCase()} here yet.`}</p>
        : <ul aria-label={`${tabs.find(entry => entry.id === tab)?.label} results`}>{typedItems.map((item, index) => <li key={item.key} data-selected={typedSelected === index}>
            <button className="search-result" aria-current={typedSelected === index ? "true" : undefined} onFocus={() => setTypedSelected(index)} onPointerMove={() => setTypedSelected(index)} onClick={() => void openTyped(item)}>
              <span className="search-result-kind" aria-hidden="true">↗</span><span className="search-result-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
            </button>
          </li>)}</ul>}
    </div>}
    <div className="search-scroll" hidden={tab !== "all" || undefined}>
      <header className="search-context"><span title={project ?? "Central"}>{project ?? "Central"}</span><span role="status" aria-live="polite">{isOpening ? "Opening…" : composing ? "Composing…" : busy ? `${count ? `${count} results · ` : ""}${pendingProviders.length} ${pendingProviders.length === 1 ? "source" : "sources"} loading…` : `${count} ${count === 1 ? "result" : "results"}`}</span></header>
      {shortcutError && <p role="alert">{shortcutError}</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset className="search-results-frame" disabled={isOpening || composing}>
        <div id="knowledge-search-results">
          <ul aria-label="Search results" aria-busy={busy}>{hits.map((hit, index) => <li key={searchKeys([hit], [])[0]} data-search-index={index} data-selected={selected === index}>
            <button className="search-result" id={`knowledge-search-${index}`} aria-current={selected === index ? "true" : undefined}
              onFocus={() => selectResult(index)} onPointerMove={() => selectResult(index)} onClick={() => void openAddress(hit.address, hit.label)}>
              <span className="search-result-kind" aria-hidden="true">↗</span><span className="search-result-copy"><strong>{hit.label}</strong><small>{hit.kind} · {hit.snippet}</small></span>
            </button>
            <button className="search-row-more" aria-label={`Explain ${hit.label}`} onClick={() => void showDetail({ action: "explain", address: hit.address })}>Explain</button>
          </li>)}</ul>
          {rows.length > 0 && <section aria-label="Owner resolution results"><header>Resources &amp; actions</header><div role="list">{rows.map((row, index) => <div role="listitem" className="search-resolution-row" key={`${row.reference}:${index}`} data-search-index={hits.length + index} data-selected={selected === hits.length + index}>
            <button className="search-result" id={`knowledge-search-${hits.length + index}`} aria-current={selected === hits.length + index ? "true" : undefined}
              onFocus={() => selectResult(hits.length + index)} onPointerMove={() => selectResult(hits.length + index)} onClick={() => void openRow(row)}>
              <span className="search-result-kind" aria-hidden="true">↗</span><span className="search-result-copy"><strong>{row.label}</strong><small>{row.kind} · {row.owner}</small></span>
            </button>
            <details className="search-row-detail"><summary aria-label={`Actions and provenance for ${row.label}`}>Details</summary>
              <OwnerActions node={{ ref: row.reference, actions: row.actions }} transport={transport} project={project} onDispatched={() => { ++epoch.current; setBusy(true); setGeneration(value => value + 1); }} />
              <p>{row.reference}</p>{row.provenance.map((item, i) => <p key={i}>{item}</p>)}
            </details>
          </div>)}</div></section>}
        </div>
      </fieldset>
      {!busy && !composing && !count && !error && <p className="search-empty">No results in the available native sources.</p>}
      {resolutionAbsences.length > 0 && <details><summary>Resolution provider messages ({resolutionAbsences.length})</summary>{resolutionAbsences.map((item, i) => <p key={i}>{item}</p>)}</details>}
      {absences.length > 0 && <details><summary>Unavailable sources ({absences.length})</summary>{absences.map((item, i) => <p key={i}>{item}</p>)}</details>}
      {detailBusy && <p role="status">Reading owner evidence…</p>}
      {detail !== undefined && <details className="search-evidence" open><summary>Owner evidence</summary><pre>{JSON.stringify(detail, null, 2)}</pre></details>}
      <section id="search-options" className="search-options" hidden={!optionsOpen} aria-label="Search options">
        <label className="search-shortcut">Shortcut <select aria-label="Search shortcut" value={String(leader)} onChange={event => onLeaderChange(event.target.value === "true")}><option value="false">{searchLeaderLabel(false)}</option><option value="true">{searchLeaderLabel(true)}</option></select></label>
        <p>AIKit interprets the full query. Result actions run only when you choose them.</p>
        <dl className="search-syntax"><div><dt>Address</dt><dd><code>@</code> or <code>@0</code>–<code>@5</code></dd></div><div><dt>Relations</dt><dd><code>@# - + x / =</code></dd></div><div><dt>Group / literal</dt><dd><code>( … )</code> · <code>"quoted subject"</code> · escapes</dd></div></dl>
        <p className="search-syntax-note">Separate operators from subjects with spaces; punctuation inside paths and identifiers stays literal. Query completions are not exposed by the current kernel.</p>
      </section>
    </div>
    <footer className="search-footer"><span className="search-key-hints"><kbd>↑</kbd><kbd>↓</kbd> select <kbd>↵</kbd> open</span><span className="search-footer-actions"><button disabled={detailBusy || busy || isOpening} onClick={() => void showDetail({ action: "history" })}>History</button><button aria-label="Search options" aria-controls="search-options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(value => !value)}>Options</button></span></footer>
  </dialog>;
}
