/**
 * The Desk's Run detail (FACTORY-UI-INTEGRATION-HANDOFF §11): the full
 * SSSF-derived monitor for one whole Run — the DeskRunView composition over
 * the owner's own build view and run readings — with the Run's genuinely
 * associated task conversations and the route back to the board (whose
 * scope, filters and scroll were never disturbed).
 *
 * Association is exact, never invented: a conversation is the Run's when its
 * agent-session ref is one the Run's own trajectories name as having carried
 * the work. A Run awaiting its first session stays visible with honest
 * absence — no fake transcript, no guessed pairing.
 */
import {useEffect, useRef, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {Glyph} from "../../../workspace/Glyph";
import {EncounterList, type EncounterRow} from "../../../encounter/EncounterList";
import {buildSnapshot, buildViewOf} from "../development";
import {DeskRunView} from "./DeskRunView";
import {publishFactorySelection} from "../sidebar/sidebarModel";
import {cacheDeskRow, peekDeskRow, runSessionRefs, type DeskRunLocator} from "./deskModel";
import type {FactoryBuildView} from "../types";
import "./desk.css";

const STATUS_GLYPH: Record<string, Parameters<typeof Glyph>[0]["name"]> = {
  queued: "dot", running: "activity", success: "check", fail: "warning", blocked: "stop", cancelled: "stop",
};

export function DeskRunDetail({locator, project, onBack, onOpenTask}:{
  locator: DeskRunLocator;
  project?: string;
  onBack: () => void;
  onOpenTask: (row: EncounterRow) => void | Promise<void>;
}) {
  const kernel = useKernel();
  const cached = peekDeskRow(`${locator.statePath}\u0000${locator.projectRef}\u0000${locator.runRef}`);
  const [view, setView] = useState<FactoryBuildView | undefined>(cached?.state === "read" ? cached.view : undefined);
  const [state, setState] = useState<"read" | "reading" | "refused">(cached?.state === "read" ? "read" : cached?.state === "refused" ? "refused" : "reading");
  const [error, setError] = useState<string | undefined>(cached?.error);
  const [rows, setRows] = useState<EncounterRow[]>([]);
  const [activeTaskRef, setActiveTaskRef] = useState<string | undefined>();
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    if (view) return;
    void (async () => {
      try {
        const document = await buildSnapshot(kernel.transport, locator.statePath, locator.projectRef, locator.runRef);
        const served = buildViewOf(document);
        if (!served) throw new Error("The reading did not carry a build view");
        if (generation.current !== gen) return;
        setView(served); setState("read");
        cacheDeskRow({key: `${locator.statePath}\u0000${locator.projectRef}\u0000${locator.runRef}`, locator, state: "read", view: served});
      } catch (reason) {
        if (generation.current !== gen) return;
        setState("refused"); setError(String(reason instanceof Error ? reason.message : reason));
      }
    })();
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locator.runRef]);

  // The opened Run is the sidebar's subject for as long as it is open here.
  useEffect(() => {
    if (!view) return;
    publishFactorySelection({statePath: locator.statePath, projectRef: locator.projectRef, runRef: locator.runRef, view, observedAtUnixMs: Date.now(), origin: "desk"});
  }, [locator, view]);

  const sessions = view ? new Set(runSessionRefs(view)) : new Set<string>();
  const carried = rows.filter(row => sessions.has(row.ref));
  const openTask = (row: EncounterRow) => {
    setActiveTaskRef(row.ref);
    void onOpenTask(row);
  };

  return <div className="desk-detail oi-scroll" aria-label={`Run detail — ${view?.run.label ?? locator.runRef}`}>
    <header className="desk-detail-head">
      <button className="oi-action" onClick={onBack}><Glyph name="arrow" size={12}/> Back to Desk</button>
      {view
        ? <div className="desk-detail-title">
          <h1>{view.run.label}</h1>
          <p>
            <span className="desk-card-state" data-status={view.run.status}><Glyph name={STATUS_GLYPH[view.run.status] ?? "dot"} size={12}/>{view.run.status}</span>
            <span> · {view.project.label}{locator.centralProject ? ` · ${locator.centralProject}` : ""} · <code>{locator.runRef}</code></span>
          </p>
        </div>
        : <div className="desk-detail-title"><h1><code>{locator.runRef}</code></h1><p>{locator.projectRef}</p></div>}
    </header>

    {state === "reading" && <p className="oi-note" role="status">Reading the owner's build view…</p>}
    {state === "refused" && <p className="oi-note" role="alert">The owner refused this Run's build view: {error}</p>}
    {view && <div className="desk-detail-build"><DeskRunView view={view} statePath={locator.statePath} runRef={locator.runRef}/></div>}

    <section className="desk-detail-tasks" aria-label="Task conversations">
      <h2><Glyph name="chat" size={13}/> Task conversations</h2>
      {carried.length > 0
        ? <div className="desk-detail-carried">
          {carried.map(row => <button key={row.ref} className="desk-receiving-row" data-carried="true" onClick={() => openTask(row)}>
            <Glyph name="chat" size={12}/>
            <span className="desk-receiving-text"><strong>{row.title}</strong><small>carried this Run's work · {row.project}</small></span>
          </button>)}
        </div>
        : <p className="oi-note">{view
          ? "No task conversation is associated with this Run yet — a conversation joins when its session carries the Run's work."
          : "The Run's conversations are named once its build view is read."}</p>}
      {project
        ? <div className="desk-detail-tasks-list">
          <h3>{project}</h3>
          <EncounterList project={project} variant="panel" activeRef={activeTaskRef} onOpen={onOpenTask} onRows={setRows}/>
        </div>
        : <p className="oi-note">Choose a project in the navigator to list its conversations.</p>}
    </section>
  </div>;
}
