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
 *
 * Ported donor surfaces (PR #292) live here in the Desk's own design: the
 * live-follow control (FactoryLive observation + revision acknowledge — no
 * poll loop), the Produced material section (CandidateReading subject
 * browser + FactoryMaterialSurface reading, fixture-labelled when the
 * labelled dev scenario carries the Run), and the attempt-handoff section
 * (FactoryHandoffSurface reading the owner's task-scoped attempt list and task
 * through the live kernel).
 */
import {useCallback, useEffect, useRef, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {Glyph} from "../../../workspace/Glyph";
import {EncounterList, type EncounterRow} from "../../../encounter/EncounterList";
import {buildSnapshot, buildViewOf} from "../development";
import {CandidateReading} from "../CandidateReading";
import {FactoryMaterialSurface} from "../FactoryMaterialSurface";
import {FactoryHandoffSurface} from "../FactoryHandoffSurface";
import {useFactoryLive} from "../FactoryLive";
import {DeskRunView} from "./DeskRunView";
import {publishFactorySelection} from "../sidebar/sidebarModel";
import {cacheDeskRow, deskFixtureFor, peekDeskRow, runSessionRefs, type DeskRunLocator} from "./deskModel";
import type {FactoryBuildView, FactoryMaterialSelection} from "../types";
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
  const live = useFactoryLive();
  const rowKey = `${locator.statePath}\u0000${locator.projectRef}\u0000${locator.runRef}`;
  const fixture = deskFixtureFor(locator);
  const cached = peekDeskRow(rowKey);
  const [view, setView] = useState<FactoryBuildView | undefined>(cached?.state === "read" ? cached.view : undefined);
  const [state, setState] = useState<"read" | "reading" | "refused">(cached?.state === "read" ? "read" : cached?.state === "refused" ? "refused" : "reading");
  const [error, setError] = useState<string | undefined>(cached?.error);
  const [busy, setBusy] = useState(false);
  const [materialSubject, setMaterialSubject] = useState<FactoryMaterialSelection>();
  const [rows, setRows] = useState<EncounterRow[]>([]);
  const [activeTaskRef, setActiveTaskRef] = useState<string | undefined>();
  const generation = useRef(0);

  // The Run's own read — once on open, again on the explicit live-follow
  // Refresh. The labelled dev scenario reads its fixture view (no native
  // read behind it); production reads the owner's build snapshot only.
  const readRun = useCallback(async () => {
    const gen = ++generation.current;
    setBusy(true);
    try {
      if (fixture) {
        setView(fixture.view); setState("read"); setError(undefined);
        cacheDeskRow({key: rowKey, locator, state: "read", view: fixture.view});
        live.observe({key: rowKey, runRef: locator.runRef, statePath: locator.statePath, projectRef: locator.projectRef, document: fixture.view});
        return;
      }
      if (!view) setState("reading");
      const document = await buildSnapshot(kernel.transport, locator.statePath, locator.projectRef, locator.runRef);
      if (generation.current !== gen) return;
      const served = buildViewOf(document);
      if (!served) throw new Error("The reading did not carry a build view");
      setView(served); setState("read"); setError(undefined);
      cacheDeskRow({key: rowKey, locator, state: "read", view: served});
      live.observe({key: rowKey, runRef: locator.runRef, statePath: locator.statePath, projectRef: locator.projectRef, document});
    } catch (reason) {
      if (generation.current !== gen) return;
      setState("refused"); setError(String(reason instanceof Error ? reason.message : reason));
    } finally {
      if (generation.current === gen) setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, kernel.transport, locator.projectRef, locator.runRef, locator.statePath, live, rowKey]);

  useEffect(() => {
    void readRun();
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locator.statePath, locator.projectRef, locator.runRef]);

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

  const observation = live.observationOf(rowKey);
  const unseen = observation?.unseen.length ?? 0;

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

    {/* Live-follow (donor FactoryLive machinery, adapted — see FactoryLive.tsx):
        one explicit read + revision acknowledge; no poll loop, no timer. */}
    {view && <div className="desk-detail-live" data-fixture={fixture ? "true" : undefined} role="status">
      <span className="desk-detail-live-basis">
        {fixture ? "dev scenario · labelled fixture content basis"
          : observation?.basis === "owner-revision" ? `live · owner build revision ${observation.ownerRevision}`
          : observation ? "live · content basis (owner revisions not disclosed)"
          : "live · not yet observed"}
      </span>
      {unseen > 0 && <strong>{unseen} new output{unseen === 1 ? "" : "s"} since your last review</strong>}
      <span className="desk-detail-live-actions">
        <button className="oi-action" onClick={() => void readRun()} disabled={busy}>{busy ? "Reading…" : "Refresh"}</button>
        {observation && (observation.changed || observation.unseen.length > 0) &&
          <button className="oi-action" onClick={() => live.acknowledge(observation.key, observation.revision)}>Acknowledge</button>}
      </span>
    </div>}

    {view && <div className="desk-detail-build"><DeskRunView view={view} statePath={locator.statePath} runRef={locator.runRef}/></div>}

    {/* Produced material: the owner's candidates and evidence for this Run,
        opened through the material reading (donor FactoryMaterialSurface). */}
    {view && <section className="desk-detail-material" aria-label="Produced material" data-fixture={fixture ? "true" : undefined}>
      <h2><Glyph name="material" size={13}/> Produced material</h2>
      {fixture && <p className="oi-note desk-detail-fixture-note">Dev scenario — the labelled fixture Run's own view; no native Factory read stands behind it.</p>}
      {view.candidates.length + view.evidence.length > 0
        ? <>
          <CandidateReading view={view} onOpenMaterial={selection => setMaterialSubject(selection)}/>
          {materialSubject && <FactoryMaterialSurface
            statePath={locator.statePath}
            projectRef={locator.projectRef}
            runRef={locator.runRef}
            subjectRef={materialSubject.subjectRef}
            expectedRevision={!fixture && observation?.basis === "owner-revision" ? observation.ownerRevision : undefined}
            fixtureView={fixture?.view}
            onDismiss={() => setMaterialSubject(undefined)}/>}
        </>
        : <p className="oi-note">The owner's reading retained no produced candidate or evidence for this Run.</p>}
    </section>}

    {/* Attempt handoff: the owner's task-scoped attempt list and task reading,
        reached through the live kernel; the surface renders the real read
        states and invents nothing (FactoryHandoffSurface / attempt-task.ts). */}
    {view && <section className="desk-detail-handoff" aria-label="Attempt handoff">
      <h2><Glyph name="report" size={13}/> Attempt handoff</h2>
      <FactoryHandoffSurface transport={kernel.transport} statePath={locator.statePath} runRef={locator.runRef}/>
    </section>}

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
