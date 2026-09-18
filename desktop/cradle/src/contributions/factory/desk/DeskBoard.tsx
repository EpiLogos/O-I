/**
 * The Desk (FACTORY-UI-INTEGRATION-HANDOFF §11): the live overview of whole
 * Runs — one card per actual Run, never per tool call, execution or session;
 * child work stays inside its Run's card. Kanban-like display groups over the
 * native status (Needs attention / Active / Queued / Recent) — placement is
 * presentation, the card always carries the run's own state.
 *
 * Cross-project is a bounded aggregation over explicitly configured Factory
 * sources (state path + project ref, remembered as display preferences) —
 * never a new root Project, copied Run registry or widened grant. Every read
 * is the owner's own developmental read; a refused or unreachable source
 * renders as partial coverage, never as an empty healthy board.
 *
 * Cards are stable: placement derives from the run's state and the card
 * orders by its identity, so arriving updates never reshuffle the board
 * under the pointer, and nothing here selects, starts or stops work —
 * opening a card changes the working view only.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {Glyph} from "../../../workspace/Glyph";
import {formatRelativeTime} from "../../../shared/relativeTime";
import {handToPanelInspect} from "../../../agent/planes/panelInspect";
import {receiving, type ReceivingPage, type ReturnRow} from "../../../receiving/client";
import {buildSnapshot, buildViewOf, developmentRead} from "../development";
import {useFactoryLive} from "../FactoryLive";
import {publishFactorySelection} from "../sidebar/sidebarModel";
import {ScenarioBar} from "../sidebar/ScenarioBar";
import {
  DESK_GROUPS, cacheDeskRow, deskGroupOf, deskRowKey, openDeskDetail,
  readDeskSources, setLastDeskRun, useDeskFixture, writeDeskSources,
  type DeskGroupKey, type DeskRow, type DeskSource,
} from "./deskModel";
import "./desk.css";

const STATUS_GLYPH: Record<string, Parameters<typeof Glyph>[0]["name"]> = {
  queued: "dot", running: "activity", success: "check", fail: "warning", blocked: "stop", cancelled: "stop",
};

interface SourceState { source: DeskSource; state: "reading" | "read" | "refused"; detail?: string; runs?: number }
type ScopeFilter = "all" | string; // "" = all; otherwise a central-project scope label
const PREFS_KEY = "oi-factory-desk-board-prefs.v1";
interface BoardPrefs { query?: string; scope?: ScopeFilter }
function readPrefs(): BoardPrefs { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as BoardPrefs; } catch { return {}; } }

export function DeskBoard({project, onMessage}:{project?:string; onMessage?:(message:string)=>void}) {
  const kernel = useKernel();
  const live = useFactoryLive();
  const fixtureRows = useDeskFixture();
  const [sources, setSources] = useState<DeskSource[]>(() => readDeskSources());
  const [rows, setRows] = useState<Record<string, DeskRow>>({});
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>({});
  const [prefs, setPrefs] = useState<BoardPrefs>(() => readPrefs());
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const setPref = (change: Partial<BoardPrefs>) => setPrefs(prev => {
    const next = {...prev, ...change};
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience */ }
    return next;
  });

  const readSource = useCallback(async (source: DeskSource, gen: number) => {
    const alive = () => generation.current === gen;
    const putRow = (row: DeskRow) => { if (!alive()) return; cacheDeskRow(row); setRows(existing => ({...existing, [row.key]: row})); };
    setSourceStates(existing => ({...existing, [deskRowKey(source, "")]: {source, state: "reading"}}));
    try {
      const projectReading = await developmentRead<{projectRef?: string; journeys?: {runRefs?: string[]}[]}>(kernel.transport, source.statePath, "project", source.projectRef);
      if (!alive()) return;
      const runRefs = [...new Set((projectReading.journeys ?? []).flatMap(journey => Array.isArray(journey.runRefs) ? journey.runRefs : []))];
      setSourceStates(existing => ({...existing, [deskRowKey(source, "")]: {source, state: "read", runs: runRefs.length}}));
      // Bounded concurrency: two run reads at a time per source, results land
      // as they arrive — the board fills without one big blocking fan-out.
      const queue = [...runRefs];
      const workers = Array.from({length: Math.min(2, queue.length)}, async () => {
        for (;;) {
          const runRef = queue.shift();
          if (!runRef || !alive()) return;
          const key = deskRowKey(source, runRef);
          putRow({key, locator: {...source, runRef}, state: "reading"});
          try {
            const document = await buildSnapshot(kernel.transport, source.statePath, source.projectRef, runRef);
            const view = buildViewOf(document);
            if (!view) throw new Error("The reading did not carry a build view");
            putRow({key, locator: {...source, runRef}, state: "read", view});
            // The live field observes exactly what the Desk actually read —
            // no poll loop anywhere (see FactoryLive.tsx).
            live.observe({key, runRef, statePath: source.statePath, projectRef: source.projectRef, document});
          } catch (reason) {
            putRow({key, locator: {...source, runRef}, state: "refused", error: String(reason instanceof Error ? reason.message : reason)});
          }
        }
      });
      await Promise.all(workers);
    } catch (reason) {
      if (alive()) setSourceStates(existing => ({...existing, [deskRowKey(source, "")]: {source, state: "refused", detail: String(reason instanceof Error ? reason.message : reason)}}));
    }
  }, [kernel.transport, live]);

  // The labelled dev scenario's fixture rows run through the same live
  // observation machinery — the scenario's own labelled data, never a native
  // read claim behind it.
  useEffect(() => {
    if (!fixtureRows) return;
    for (const row of fixtureRows) {
      live.observe({key: deskRowKey(row.locator, row.locator.runRef), runRef: row.locator.runRef, statePath: row.locator.statePath, projectRef: row.locator.projectRef, document: row.view});
    }
  }, [fixtureRows, live]);

  const refresh = useCallback(() => {
    const gen = ++generation.current;
    setBusy(true);
    setRows({});
    void Promise.all([...(fixtureRows ? [] : sources.map(source => readSource(source, gen)))]).finally(() => { if (generation.current === gen) setBusy(false); });
  }, [fixtureRows, readSource, sources]);

  // The board reads when it mounts and on explicit refresh — there is no
  // native watch on this cut, and the board never invents one.
  useEffect(() => {
    refresh();
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureRows, sources.map(source => `${source.statePath}\u0000${source.projectRef}\u0000${source.centralProject ?? ""}`).join("|")]);

  const openRun = (row: DeskRow) => {
    if (row.state !== "read" || !row.view) return;
    setLastDeskRun(row.locator);
    cacheDeskRow(row);
    openDeskDetail(row.locator);
    // The chosen Run becomes the right sidebar's subject — the Run plane
    // reads the same selection; origin "desk" marks where it was chosen.
    publishFactorySelection({statePath: row.locator.statePath, projectRef: row.locator.projectRef, runRef: row.locator.runRef, view: row.view, observedAtUnixMs: Date.now(), origin: "desk"});
  };

  // One row set whatever its origin: the labelled dev scenario's fixture rows,
  // or what the board has actually read. Filters and grouping run over the
  // same pipeline either way — the scenario shows the board, not a bypass.
  const boardRows: DeskRow[] = useMemo(() => fixtureRows
    ? fixtureRows.map(row => ({key: deskRowKey(row.locator, row.locator.runRef), locator: row.locator, state: "read" as const, view: row.view}))
    : Object.values(rows),
  [fixtureRows, rows]);
  const shown = useMemo(() => {
    const query = prefs.query?.trim().toLowerCase() ?? "";
    const scope = prefs.scope ?? "all";
    return boardRows.filter(row => {
      if (row.state !== "read" || !row.view) return true; // refused/reading rows stay visible for honesty
      if (scope !== "all" && (row.locator.centralProject ?? "") !== scope) return false;
      if (!query) return true;
      const haystack = `${row.view.run.label} ${row.view.project.label} ${row.locator.runRef} ${row.view.frontier.title}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [boardRows, prefs.query, prefs.scope]);
  const grouped = useMemo(() => {
    const out = new Map<DeskGroupKey, DeskRow[]>();
    for (const group of DESK_GROUPS) out.set(group.key, []);
    for (const row of [...shown].sort((a, b) => a.key.localeCompare(b.key))) {
      if (row.state !== "read" || !row.view) continue;
      out.get(deskGroupOf(row.view))!.push(row);
    }
    return out;
  }, [shown]);
  const scopeOptions = useMemo(() => [...new Set([
    ...sources.map(source => source.centralProject),
    ...boardRows.map(row => row.locator.centralProject),
  ].filter((entry): entry is string => !!entry))], [sources, boardRows]);
  const needsYouCount = grouped.get("attention")!.reduce((sum, row) => sum + (row.view?.humanRequests.length ?? 0), 0);

  const addSource = (source: DeskSource) => {
    setSources(existing => existing.some(entry => entry.statePath === source.statePath && entry.projectRef === source.projectRef) ? existing : [...existing, source]);
    writeDeskSources(sources.some(entry => entry.statePath === source.statePath && entry.projectRef === source.projectRef) ? sources : [...sources, source]);
  };

  return <div className="desk-board" aria-label="Desk — live Runs">
    <header className="desk-board-head">
      <div className="desk-board-title">
        <h1>Desk</h1>
        <p>Whole Runs across your Projects{needsYouCount > 0 ? <> · <strong>{needsYouCount} waiting on you</strong></> : null}</p>
      </div>
      <div className="desk-board-tools">
        <label className="desk-board-search">
          <Glyph name="search" size={13}/>
          <input aria-label="Search Runs" placeholder="Search Runs…" value={prefs.query ?? ""} onChange={event => setPref({query: event.target.value})} spellCheck={false}/>
        </label>
        <select aria-label="Project scope" value={prefs.scope ?? "all"} onChange={event => setPref({scope: event.target.value})}>
          <option value="all">All Projects</option>
          {scopeOptions.map(entry => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <button className="oi-action" onClick={refresh} disabled={busy}>{busy ? "Reading…" : "Refresh"}</button>
        <ScenarioBar/>
      </div>
    </header>

    <AddSource onAdd={addSource} fixtureActive={!!fixtureRows}/>

    {fixtureRows ? <p className="desk-board-fixture-note oi-note">Dev scenario — labelled fixture Runs, no native read behind them.</p> : <>
      {sources.length === 0 && <p className="desk-board-empty oi-note">No Factory source is configured yet. Add one — a developmental state path and the Project ref it serves — and its Runs appear here. The desk reads only what you name; it never invents a source.</p>}
      <SourceStates states={Object.values(sourceStates)}/>
    </>}
    <div className="desk-columns">
      {DESK_GROUPS.map(group => <BoardGroup key={group.key} label={group.label} rows={grouped.get(group.key) ?? []} onOpen={openRun}/>)}
    </div>
    {!fixtureRows && boardRows.some(row => row.state === "refused") && <section className="desk-board-refused" aria-label="Runs that could not be read">
      <h3>Could not be read</h3>
      {boardRows.filter(row => row.state === "refused").map(row => <p key={row.key} role="alert"><code>{row.locator.runRef}</code> — {row.error}</p>)}
    </section>}

    <ReceivingStrip project={project} onMessage={onMessage}/>
  </div>;
}

// ---------------------------------------------------------------------------
// board groups and cards
// ---------------------------------------------------------------------------

function BoardGroup({label, rows, onOpen}:{label:string; rows:DeskRow[]; onOpen:(row:DeskRow)=>void}) {
  return <section className="desk-group" aria-label={`${label} — ${rows.length} run${rows.length === 1 ? "" : "s"}`} data-empty={rows.length === 0 ? "true" : undefined}>
    <h2 className="desk-group-head">{label} <span>{rows.length}</span></h2>
    <div className="desk-group-body">
      {rows.map(row => <RunCard key={row.key} row={row} onOpen={onOpen}/>)}
      {rows.length === 0 && <p className="desk-group-empty oi-note">Nothing here.</p>}
    </div>
  </section>;
}

function RunCard({row, onOpen}:{row:DeskRow; onOpen:(row:DeskRow)=>void}) {
  const live = useFactoryLive();
  const observation = live.observationOf(row.key);
  const view = row.view!;
  const status = view.run.status;
  const participants = [...new Set(view.agencies.map(agency => agency.label))];
  const running = view.executions.filter(execution => execution.status === "running").length;
  const checks = {
    supported: view.claims.filter(claim => claim.status === "supported").length,
    challenged: view.claims.filter(claim => claim.status === "challenged" || claim.status === "superseded").length,
  };
  const latest = view.trajectories.reduce((latest, trace) => {
    const started = Date.parse(trace.startedAt ?? "");
    return Number.isFinite(started) && (!latest || started > latest) ? started : latest;
  }, 0);
  const tokens = view.trajectories.reduce((sum, trace) => sum + (trace.totalTokens ?? 0), 0);
  return <article className="desk-card" data-status={status}>
    <button className="desk-card-open" onClick={() => onOpen(row)}>
      <span className="desk-card-top">
        <span className="desk-card-state" data-status={status}><Glyph name={STATUS_GLYPH[status] ?? "dot"} size={12}/>{status}</span>
        <span className="desk-card-project">{view.project.label}{row.locator.centralProject ? <small> · {row.locator.centralProject}</small> : null}</span>
      </span>
      <strong className="desk-card-title">{view.run.label}</strong>
      <span className="desk-card-step" data-frontier-mode={view.frontier.mode}>{view.frontier.title}</span>
      <span className="desk-card-facts">
        {view.executions.length > 0 && <span>{running > 0 ? <><b>{running}</b> running · </> : null}{view.executions.length} execution{view.executions.length === 1 ? "" : "s"}</span>}
        {(checks.supported > 0 || checks.challenged > 0) && <span className={checks.challenged > 0 ? "desk-card-checks-attention" : undefined}>{checks.supported} supported{checks.challenged > 0 ? ` · ${checks.challenged} challenged` : ""}</span>}
        {view.candidates.length > 0 && <span>{view.candidates.length} produced</span>}
        {tokens > 0 && <span>{tokens.toLocaleString()} tokens</span>}
        {latest > 0 && <span>{formatRelativeTime(latest)}</span>}
      </span>
      {participants.length > 0 && <span className="desk-card-agents">{participants.join(" · ")}</span>}
    </button>
    {view.humanRequests.length > 0 && <div className="desk-card-needs" role="status">
      <Glyph name="verify" size={12}/>
      <p>{view.humanRequests[0].question}</p>
      {view.humanRequests.length > 1 && <small>{view.humanRequests.length - 1} more</small>}
    </div>}
    {observation && (observation.changed || observation.unseen.length > 0) && <div className="desk-card-live" role="status">
      <Glyph name="activity" size={12}/>
      <p>{observation.unseen.length > 0 ? `${observation.unseen.length} new output${observation.unseen.length === 1 ? "" : "s"} since your last review` : "Run updated since your last review"}</p>
      <button type="button" onClick={() => live.acknowledge(observation.key, observation.revision)}>Acknowledge</button>
    </div>}
  </article>;
}

function SourceStates({states}:{states:SourceState[]}) {
  const visible = states.filter(state => state.state !== "read" || state.runs === 0);
  if (!visible.length) return null;
  return <div className="desk-source-states" aria-label="Source coverage">
    {visible.map(state => <p key={deskRowKey(state.source, "")} data-source-state={state.state} role={state.state === "refused" ? "alert" : "status"}>
      <code>{state.source.projectRef}</code>{state.source.centralProject ? <small> · {state.source.centralProject}</small> : null} — {state.state === "reading" ? "reading…" : state.state === "read" ? "the owner's project reading names no Runs." : `read refused: ${state.detail}`}
    </p>)}
  </div>;
}

/** One Factory source: the caller-disclosed state path and the Project ref it
 * serves, optionally under a Central project scope label. Remembered as a
 * display preference; the desk never invents one. */
function AddSource({onAdd, fixtureActive}:{onAdd:(source:DeskSource)=>void; fixtureActive:boolean}) {
  const [open, setOpen] = useState(false);
  const [statePath, setStatePath] = useState("");
  const [projectRef, setProjectRef] = useState("");
  const [centralProject, setCentralProject] = useState("");
  const submit = () => {
    if (!statePath.trim() || !projectRef.trim()) return;
    onAdd({statePath: statePath.trim(), projectRef: projectRef.trim(), ...(centralProject.trim() ? {centralProject: centralProject.trim()} : {})});
    setStatePath(""); setProjectRef(""); setCentralProject(""); setOpen(false);
  };
  return <details className="desk-addsource" open={open} onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}>
    <summary>Add Factory source</summary>
    <div className="desk-addsource-form">
      <label>Developmental state path<input className="oi-input" value={statePath} onChange={event => setStatePath(event.target.value)} placeholder="/absolute/path/to/developmental-state.json" spellCheck={false} autoComplete="off"/></label>
      <label>Factory Project ref<input className="oi-input" value={projectRef} onChange={event => setProjectRef(event.target.value)} placeholder="project:…" spellCheck={false} autoComplete="off"/></label>
      <label>Central Project scope (optional)<input className="oi-input" value={centralProject} onChange={event => setCentralProject(event.target.value)} placeholder="e.g. Factory" spellCheck={false} autoComplete="off"/></label>
      <div className="oi-action-group">
        <button className="oi-action" disabled={!statePath.trim() || !projectRef.trim()} onClick={submit}>Add source</button>
        {import.meta.env.DEV && <button className="oi-action" onClick={() => {onAdd({statePath: "/Users/admin/.local/state/oi/testing/factory-desk-provider.json", projectRef: "project:01ARZ3NDEKTSV4RRFFQ69G5FAW", centralProject: "Factory"}); setOpen(false);}}>Use testing specimen</button>}
      </div>
      {fixtureActive && <small className="oi-note">The dev scenario board is showing; sources read again when the scenario is exited.</small>}
    </div>
  </details>;
}

// ---------------------------------------------------------------------------
// receiving: what arrived for the person, Run or not
// ---------------------------------------------------------------------------

/** The compact receiving strip: pending human Returns for the browsed
 * project — the same native items the sidebar's Context plane shows. Incoming
 * material with no Run association stays reachable here; the desk never
 * invents a Run to file it under. */
function ReceivingStrip({project, onMessage}:{project?:string; onMessage?:(message:string)=>void}) {
  const kernel = useKernel();
  const [page, setPage] = useState<ReceivingPage>();
  const [state, setState] = useState<"reading" | "read" | "absent">("reading");
  useEffect(() => {
    if (!project) { setState("absent"); return; }
    let live = true;
    setState("reading");
    receiving<ReceivingPage>(kernel.transport, project, {kind: "list", limit: 20})
      .then(next => { if (live) { setPage(next); setState("read"); } })
      .catch(() => { if (live) setState("absent"); });
    return () => { live = false; };
  }, [kernel.transport, project]);
  if (state === "absent") return null;
  const rows = (page?.returns ?? []).filter(row => row.status !== "included" && row.status !== "rejected");
  const open = (row: ReturnRow) => {
    void receiving<unknown>(kernel.transport, project!, {kind: "read", return_ref: row.return_ref})
      .then(reading => handToPanelInspect({kind: "central-return", ref: row.return_ref, title: `Return · ${row.document_id}`, payload: reading, source: "Desk"}))
      .catch(reason => onMessage?.(String(reason)));
  };
  return <section className="desk-receiving" aria-label={`Receiving — ${rows.length} item${rows.length === 1 ? "" : "s"} waiting`}>
    <h2><Glyph name="report" size={13}/> Needs you — receiving <span>{state === "reading" ? "reading…" : `${rows.length} waiting`}</span></h2>
    {state === "read" && !rows.length && <p className="oi-note">Nothing is waiting on you.</p>}
    {rows.map(row => <button key={row.return_ref} className="desk-receiving-row" onClick={() => open(row)} title={row.return_ref}>
      <span className="factory-inbox-dot" aria-hidden="true"/>
      <span className="desk-receiving-text"><strong>{row.document_id}</strong><small>{row.author.principal_ref} · {row.status}{row.received_at_unix_seconds ? ` · ${formatRelativeTime(row.received_at_unix_seconds * 1000)}` : ""}</small></span>
    </button>)}
  </section>;
}
