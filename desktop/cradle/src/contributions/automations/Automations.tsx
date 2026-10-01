import {useEffect, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {IconTabStrip} from "../../workspace/primitives/IconTabStrip";
import {routine, routineList, object, actionMessage, nextOccurrenceTimes, type RoutineList, type RoutineDetail, type MethodRow, type Invocation} from "./client";
import {RawDisclosure} from "../../shared/contributionPresentation";
// @ts-ignore -- owner-supplied names over retained exact identities.
import {subjectLabel} from "../../../../../shared-field/presentation-text.mjs";
import "./automations.css";

/** The owner's method list defines `payload` as the authored description
 * after METHOD:. Technical examples inside it remain authored prose. */
export function MethodMaterial({row}:{row:MethodRow}) {
  return <li data-method-ref={row.id}><strong>{subjectLabel(row,"Unnamed Method")}</strong><span>{row.active?"Active":"Inactive"}</span>
    <p style={{whiteSpace:"pre-wrap"}}>{row.payload}</p>
    <RawDisclosure value={row} label="Inspect exact Method reading"/>
  </li>;
}

export function HarnessTimer({job,index=0}:{job:RoutineList["foreign_reconciliation"]["providers"][number]["jobs"][number];index?:number}) {
  return <li data-job-id={job.job_id}><strong>{subjectLabel(job,`Unnamed timer ${index+1}`)}</strong><span>{job.active?"Active":"Inactive"} · {job.reconciled?"Reconciled":"Not reconciled"}</span>{!job.reconciled&&<p>This harness timer has not been adopted as a Routine.</p>}<RawDisclosure value={job} label="Inspect exact harness timer and reconciliation guidance"/></li>;
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
type View = "mine" | "methods" | "history" | "timers";
export function Automations({project}: {project?: string}) {
  const {transport} = useKernel();
  const [view, setView] = useState<View>("mine");
  const [reading, setReading] = useState<RoutineList>();
  const [methods, setMethods] = useState<MethodRow[]>();
  const [history, setHistory] = useState<Invocation[]>();
  const [selected, setSelected] = useState<string>();
  const [detail, setDetail] = useState<RoutineDetail>();
  const [error, setError] = useState<string>();
  const [detailError, setDetailError] = useState<string>();
  const [returned, setReturned] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setError(undefined);
    const request = view === "methods" ? "methods" : view === "history" ? "history" : "list";
    if (request === "list") setReading(undefined);
    else if (request === "methods") setMethods(undefined);
    else setHistory(undefined);
    void routine(transport, project, {action: request}).then(value => {
      if (!live) return;
      if (request === "list") setReading(routineList(value));
      else if (request === "methods") {
        const rows = object(value).methods;
        if (!Array.isArray(rows)) throw new Error("AIKit returned an unreadable Method list.");
        setMethods(rows.filter(row => typeof row?.id === "string" && typeof row?.name === "string") as MethodRow[]);
      } else {
        if (!Array.isArray(value)) throw new Error("AIKit returned an unreadable invocation history.");
        setHistory(value.filter(row => typeof row?.invocation_ref === "string") as Invocation[]);
      }
    }).catch(failure => {if (live) setError(message(failure));});
    return () => {live = false;};
  }, [transport, project, revision, view]);
  useEffect(() => {
    let live = true;
    setDetail(undefined); setDetailError(undefined);
    if (selected) void routine(transport, project, {action: "show", routine_ref: selected}).then(value => {
      if (object(value).routine !== selected) throw new Error("AIKit returned a different Routine.");
      if (live) setDetail(value as RoutineDetail);
    }).catch(failure => {if (live) setDetailError(message(failure));});
    return () => {live = false;};
  }, [selected, project, transport, revision]);
  async function act(action: "disable" | "run_now") {
    if (!selected || busy) return;
    setBusy(true); setReturned(undefined); setDetailError(undefined);
    try {setReturned(actionMessage(await routine(transport, project, {action, routine_ref: selected}))); setRevision(value => value + 1);}
    catch (failure) {setDetailError(message(failure));}
    finally {setBusy(false);}
  }
  return <section className="automations-surface" aria-label="Automations">
    <header className="oi-panel-head"><strong>Automations</strong><IconTabStrip aria-label="Automations view" current={view} onSelect={value => setView(value as View)} items={[
      {id: "mine", label: "Mine", icon: "agent"}, {id: "methods", label: "Methods", icon: "file"}, {id: "history", label: "History", icon: "history"}, {id: "timers", label: "Harness timers", icon: "settings"},
    ]}/><button disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh</button></header>
    <div className="automations-body oi-scroll">
      {error && <p role="alert">{error}</p>}
      {view === "mine" && <div className="automations-columns"><nav aria-label="My routines">
        {!reading && !error && <p role="status">Reading routines…</p>}
        {reading && !reading.routines.length && <p>No routines in this AIKit home.</p>}
        {reading?.routines.map((row,index) => <button className="automations-row" key={row.routine} aria-current={selected === row.routine ? "page" : undefined} onClick={() => {setSelected(row.routine); setReturned(undefined);}}><strong>{subjectLabel(row,`Unnamed routine ${index+1}`)}</strong><span>{row.state.replaceAll("-", " ")} · {row.trigger?.kind ?? "Trigger unavailable"}</span></button>)}
      </nav><section aria-label="Routine details">
        {!selected && <p>Select a routine to inspect its proof, schedule, authority and returned runs.</p>}
        {selected && !detail && !detailError && <p role="status">Reading routine…</p>}
        {detail && <><h2>{subjectLabel(detail,"Unnamed routine")}</h2><p>{detail.state.replaceAll("-", " ")}{detail.scheduler && ` · Scheduler ${detail.scheduler.observed_state}`}</p>
          <p>{detail.method_body?.startsWith("native:") ? "Runs native owner actions." : "Runs through its admitted agent connection."}</p>
          {detail.occurrence_error && <p role="status">Schedule unavailable: {detail.occurrence_error}</p>}
          {detail.trigger.kind === "schedule" && !detail.occurrence_error && <section aria-label="Next occurrences"><strong>Next occurrences</strong>{nextOccurrenceTimes(detail.next_occurrences).length ? <ul>{nextOccurrenceTimes(detail.next_occurrences).map(time => <li key={time}>{time}</li>)}</ul> : <p>No occurrence in the owner's next 24-hour window.</p>}</section>}
          <div className="automations-actions"><button disabled={busy || detail.state !== "enabled"} onClick={() => void act("run_now")}>Run now</button><button disabled={busy || detail.state === "disabled"} onClick={() => void act("disable")}>Disable</button></div>
          <details><summary>Proof and authority</summary><p>Method: {detail.method}</p><p>Proven revision: {detail.method_revision}</p><p>Proof: {detail.proof?.proof_ref ?? "Unavailable"}</p><p>{detail.proof?.verification_refs?.length ?? 0} verification references.</p><p>Authority: {detail.authority?.granted ? "Granted on the stored owner receipt" : "Not granted"}{detail.authority?.unattended ? " · unattended" : ""}.</p></details>
        </>}
        {detailError && <p role="alert">{detailError}</p>}{returned && <p role="status">{returned}</p>}
      </section></div>}
      {view === "methods" && <><h2>Methods</h2><p>A routine needs a successful Method run, explicit verification, and authority for its actions. Creating or enabling one here is awaiting a native verified-proof selection path.</p>{!methods && !error && <p role="status">Reading Methods…</p>}{methods?.length === 0 && <p>No Methods are available in this context.</p>}<ul className="automations-list">{methods?.map(row => <MethodMaterial key={row.id} row={row}/>)}</ul></>}
      {view === "history" && <><h2>Invocation history</h2><p>{selected ? `Showing ${reading?.routines.find(row => row.routine === selected)?.name ?? "the selected routine"}.` : "Showing all routines."} {selected && <button onClick={() => setSelected(undefined)}>All routines</button>}</p>{!history && !error && <p role="status">Reading invocations…</p>}{history?.filter(row => !selected || row.routine_ref === selected).length === 0 && <p>No admitted invocations.</p>}<ul className="automations-list">{history?.filter(row => !selected || row.routine_ref === selected).map(row => <li key={row.invocation_ref}><strong>{reading?.routines.find(routine => routine.routine === row.routine_ref)?.name ?? "Routine invocation"}</strong><span>{row.trigger_observed_at}</span><p>{actionMessage({outcome: row.outcome})}</p><details><summary>Native references and deliveries</summary><p>{row.routine_ref}</p><p>{row.invocation_ref}</p><p>{row.method_ref}</p>{row.provider_deliveries?.map(delivery => <p key={delivery.delivery_ref}>{delivery.provider}: {delivery.delivery_ref}</p>)}</details></li>)}</ul></>}
      {view === "timers" && <><h2>Harness timers</h2><p>Existing harness jobs are shown read-only. Reconciliation requires a proven Method and explicit adoption.</p>{!reading && !error && <p role="status">Reading harness timers…</p>}{reading?.foreign_reconciliation.providers.map(provider => <section key={provider.provider}><h3>{provider.provider}</h3>{!provider.jobs.length && <p>No timers found.</p>}<ul className="automations-list">{provider.jobs.map((job,index) => <HarnessTimer key={job.job_id} job={job} index={index}/>)}</ul></section>)}</>}
    </div>
  </section>;
}
