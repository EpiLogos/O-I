/**
 * Desk — the run board (11-FACTORY §2). Every run in the one scope, what
 * state it is in, and which one needs you. Open one.
 *
 * Every line of a card is a real field (runModel.deskCard); a line without a
 * value is omitted. Sources are DISCOVERED (`factory project locate` over
 * Central's own roots for the scope); a hand-named source survives only as
 * the ⟳ menu's fallback. Reading is explicit — on first show for a scope and
 * on ⟳ — with no polling; cards order by identity and never resort under the
 * pointer; nothing auto-selects.
 *
 * States (§2, F1–F5): reading (skeleton columns, "Reading runs…"), empty
 * ("No runs yet." + New run), partial (one line naming unreadable sources +
 * Retry), error ("Couldn't read the Desk." + Retry), search-empty.
 */
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {Glyph} from "../../../workspace/Glyph";
import {formatRelativeTime} from "../../../shared/relativeTime";
import {useScope} from "../../../workspace/scope";
import {MenuButton} from "./MenuButton";
import {readDeskSources, writeDeskSources, type DeskSource} from "./deskModel";
import {deskScrollTop, openRunPage, readDesk, rememberDeskScroll, scopeKeyOf, useDeskReading, useSelectedRun} from "./deskStore";
import {DESK_COLUMNS, RUN_STATE_GLYPH, RUN_STATE_WORD, cardMatches, deskColumn, initials, type DeskCard, type DeskColumn} from "./runModel";
import "./fdesk.css";

/** A short age for a card footer: "now", "40m", "3h", "Mon", "18 Sep". */
export function shortAge(iso: string | undefined, now = Date.now()): string | undefined {
  if (!iso) return undefined;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return undefined;
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const date = new Date(at);
  if (hours < 24 * 7) return date.toLocaleDateString("en-GB", {weekday: "short"});
  return date.toLocaleDateString("en-GB", {day: "numeric", month: "short"});
}

export interface DeskProps {
  /** New run…: the start passage (see FactoryCentre — Tasks, where the
   * Factory agent authors the commission). */
  onNewRun?: () => void;
  /** + Add to Desk → Agent… / Team… / Skill…: open those objects' pages. */
  onAddObject?: (kind: "agent" | "team" | "skill") => void;
}

export function Desk({onNewRun, onAddObject}: DeskProps) {
  const kernel = useKernel();
  const scope = useScope();
  const reading = useDeskReading();
  const selected = useSelectedRun();
  const [query, setQuery] = useState("");
  const [, tick] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const scopeKey = scopeKeyOf(scope);
  const current = reading?.scopeKey === scopeKey ? reading : undefined;

  // Read on first show for this scope; afterwards only on ⟳.
  useEffect(() => {
    if (current) return;
    void readDesk(kernel.transport, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, kernel.transport]);
  // The "read Xm ago" label ages in place — a label re-render, not a read.
  useEffect(() => { const id = window.setInterval(() => tick(value => value + 1), 30_000); return () => window.clearInterval(id); }, []);
  // Going back from a Run page restores the board's scroll.
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = deskScrollTop(); }, []);

  const refresh = () => void readDesk(kernel.transport, scope);
  const allCards = useMemo(() => Object.values(current?.runs ?? {}).map(entry => entry.card).sort((a, b) => a.key.localeCompare(b.key)), [current?.runs]);
  const shown = useMemo(() => allCards.filter(card => cardMatches(card, query)), [allCards, query]);
  const columns = useMemo(() => {
    const out = new Map<DeskColumn, DeskCard[]>(DESK_COLUMNS.map(column => [column.key, []]));
    for (const card of shown) out.get(deskColumn(card))!.push(card);
    return out;
  }, [shown]);

  const firstRead = !current || (current.status === "reading" && !current.readAt);
  const unreadable = [...(current?.discovery?.unreadable ?? []), ...(current?.refused ?? [])];
  const aggregate = scope.kind === "all";
  const open = (card: DeskCard) => {
    rememberDeskScroll(scroller.current?.scrollTop ?? 0);
    openRunPage(card.key);
  };

  return <div className="fdesk" ref={scroller} aria-label="Desk" data-desk-state={firstRead ? "reading" : current?.status}>
    <header className="fdesk-head">
      <h1>Desk</h1>
      <div className="fdesk-tools">
        <label className="fdesk-search">
          <Glyph name="search" size={13}/>
          <input aria-label="Search runs" placeholder="Search runs" value={query} onChange={event => setQuery(event.target.value)} spellCheck={false}/>
        </label>
        <MenuButton ariaLabel="Refresh the Desk" label={<><Glyph name="refresh" size={13}/><span data-desk-read-label>{current?.status === "reading" ? "reading…" : current?.readAt ? `read ${formatRelativeTime(current.readAt)}` : "read"}</span></>}
          content={close => <RefreshMenu onRefresh={() => { close(); refresh(); }} onAdded={() => { close(); refresh(); }}/>}/>
        <MenuButton ariaLabel="Add to Desk" label={<><Glyph name="plus" size={13}/><span>Add to Desk</span></>} rows={[
          {label: "New run…", hint: "commission it with the Factory agent", onSelect: onNewRun, disabled: !onNewRun},
          {label: "Agent…", onSelect: () => onAddObject?.("agent"), disabled: !onAddObject, separatorBefore: true},
          {label: "Team…", onSelect: () => onAddObject?.("team"), disabled: !onAddObject},
          {label: "Skill…", onSelect: () => onAddObject?.("skill"), disabled: !onAddObject},
        ]}/>
      </div>
    </header>

    {current?.status === "error"
      ? <div className="fdesk-state" role="alert" data-desk-empty="error"><p>Couldn't read the Desk.</p><p className="fdesk-state-why">{current.error}</p><button type="button" className="fdesk-link" onClick={refresh}>Retry</button></div>
      : <>
        {!firstRead && unreadable.length > 0 && <p className="fdesk-partial" role="status" data-desk-partial>
          {unreadable.length} source{unreadable.length === 1 ? "" : "s"} couldn't be read — {unreadable.map(entry => `${entry.label} (${entry.error})`).join("; ")}.{" "}
          <button type="button" className="fdesk-link" onClick={refresh}>Retry</button>
        </p>}
        {firstRead
          ? <div className="fdesk-columns" aria-busy="true">
            {DESK_COLUMNS.map(column => <section key={column.key} className="fdesk-column" aria-label={column.label}>
              <h2 className="fdesk-column-head">{column.label}</h2>
              <div className="fdesk-skeleton" aria-hidden="true"/><div className="fdesk-skeleton" aria-hidden="true"/>
            </section>)}
            <p className="fdesk-reading" role="status">Reading runs…</p>
          </div>
          : allCards.length === 0
            ? unreadable.length > 0
              // Partial with nothing readable is never an empty healthy board.
              ? <div className="fdesk-state" data-desk-empty="partial"><p>No runs could be read.</p></div>
              : <div className="fdesk-state" data-desk-empty="empty"><p>No runs yet.</p>{onNewRun && <button type="button" className="oi-action oi-action-primary" onClick={onNewRun}>New run</button>}</div>
            : shown.length === 0
              ? <div className="fdesk-state" data-desk-empty="search"><p>No runs match “{query}”.</p><button type="button" className="fdesk-link" onClick={() => setQuery("")}>Clear</button></div>
              : <div className="fdesk-columns">
                {DESK_COLUMNS.map(column => {
                  const cards = columns.get(column.key) ?? [];
                  return <section key={column.key} className="fdesk-column" aria-label={`${column.label} · ${cards.length}`} data-column={column.key}>
                    <h2 className="fdesk-column-head">{column.label} · {cards.length}</h2>
                    {cards.map(card => <RunCard key={card.key} card={card} aggregate={aggregate} selected={selected === card.key} onOpen={open}/>)}
                  </section>;
                })}
              </div>}
      </>}
  </div>;
}

function RunCard({card, aggregate, selected, onOpen}: {card: DeskCard; aggregate: boolean; selected: boolean; onOpen: (card: DeskCard) => void}) {
  const age = shortAge(card.startedAt);
  // With All projects in scope each card names its project; the name is
  // shown in every scope (it is never a ref).
  const footer = [card.projectName, age].filter(Boolean).join(" · ");
  void aggregate;
  return <button type="button" className="fdesk-card" data-state={card.state} data-selected={selected ? "true" : undefined} data-run-card={card.runRef}
    onClick={() => onOpen(card)} aria-label={`${RUN_STATE_WORD[card.state]} — ${card.title}`}>
    <span className="fdesk-card-state" data-state={card.state}>
      <span className="fdesk-glyph" aria-hidden="true">{card.needsYou > 0 || card.blocked ? "!" : RUN_STATE_GLYPH[card.state]}</span>
      {RUN_STATE_WORD[card.state]}
      {card.needsYou > 0 && <span className="fdesk-needs" data-needs-you={card.needsYou}>{card.needsYou}</span>}
    </span>
    <strong className="fdesk-card-title" data-card-title>{card.title}</strong>
    {card.next && <span className="fdesk-card-next" data-card-next>Next: {card.next}</span>}
    {card.units.length > 0 && <span className="fdesk-units" role="img" aria-label={`${card.units.length} unit${card.units.length === 1 ? "" : "s"}: ${card.units.map(unit => unit.standing.replace("-", " ")).join(", ")}`}>
      {card.units.map(unit => <span key={unit.id} className="fdesk-unit" data-standing={unit.standing} title={unit.label}/>)}
    </span>}
    <span className="fdesk-card-foot">
      {footer && <span className="fdesk-card-where" data-card-footer>{footer}</span>}
      {card.agents.length > 0 && <span className="fdesk-avatars">{card.agents.slice(0, 3).map(name => <span key={name} className="fdesk-avatar" title={name}>{initials(name)}</span>)}</span>}
    </span>
  </button>;
}

/** The ⟳ menu: refresh, and the hand-named source fallback. */
function RefreshMenu({onRefresh, onAdded}: {onRefresh: () => void; onAdded: () => void}) {
  const [adding, setAdding] = useState(false);
  const [statePath, setStatePath] = useState("");
  const [projectRef, setProjectRef] = useState("");
  const [project, setProject] = useState("");
  const add = () => {
    if (!statePath.trim() || !projectRef.trim()) return;
    const existing = readDeskSources();
    const source: DeskSource = {statePath: statePath.trim(), projectRef: projectRef.trim(), ...(project.trim() ? {centralProject: project.trim()} : {})};
    if (!existing.some(entry => entry.statePath === source.statePath && entry.projectRef === source.projectRef)) writeDeskSources([...existing, source]);
    onAdded();
  };
  return <div className="fmenu-body">
    <button type="button" role="menuitem" className="fmenu-row" onClick={onRefresh}><span>Read the Desk again</span></button>
    {!adding
      ? <button type="button" role="menuitem" className="fmenu-row" onClick={() => setAdding(true)}><span>Add Factory source…</span><small>when discovery can't find it</small></button>
      : <form className="fmenu-form" onSubmit={event => { event.preventDefault(); add(); }}>
        <label>State path<input className="oi-input" value={statePath} onChange={event => setStatePath(event.target.value)} spellCheck={false} autoComplete="off" placeholder="/…/.factory/development-state.json"/></label>
        <label>Project ref<input className="oi-input" value={projectRef} onChange={event => setProjectRef(event.target.value)} spellCheck={false} autoComplete="off" placeholder="project:…"/></label>
        <label>Project name (optional)<input className="oi-input" value={project} onChange={event => setProject(event.target.value)} spellCheck={false} autoComplete="off"/></label>
        <button type="submit" className="oi-action" disabled={!statePath.trim() || !projectRef.trim()}>Add source</button>
      </form>}
  </div>;
}
