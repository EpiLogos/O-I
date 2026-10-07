import {useEffect, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {IconTabStrip} from "../../workspace/primitives/IconTabStrip";
import {routine, routineList, object, actionMessage, nextOccurrenceTimes, scheduleRecord, authorityRecord, createRefusal, createReceiptMessage, type RoutineList, type RoutineDetail, type MethodRow, type Invocation, type ScheduleShape, type RoutineAuthority} from "./client";
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
type View = "mine" | "draft" | "methods" | "history" | "timers";
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
    const request = view === "methods" || view === "draft" ? "methods" : view === "history" ? "history" : "list";
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
      {id: "mine", label: "Mine", icon: "agent"}, {id: "draft", label: "New", icon: "agent"}, {id: "methods", label: "Methods", icon: "file"}, {id: "history", label: "History", icon: "history"}, {id: "timers", label: "Harness timers", icon: "settings"},
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
          <RoutineAdoption project={project} routine_ref={detail.routine} state={detail.state} refresh={() => setRevision(value => value + 1)}/>
          <details><summary>Proof and authority</summary><p>Method: {detail.method}</p><p>Proven revision: {detail.method_revision}</p><p>Proof: {detail.proof?.proof_ref ?? "Unavailable"}</p><p>{detail.proof?.verification_refs?.length ?? 0} verification references.</p><p>Authority: {detail.authority?.granted ? "Granted on the stored owner receipt" : "Not granted"}{detail.authority?.unattended ? " · unattended" : ""}.</p></details>
        </>}
        {detailError && <p role="alert">{detailError}</p>}{returned && <p role="status">{returned}</p>}
      </section></div>}
      {view === "draft" && <DraftRoutine project={project} methods={methods} onDone={() => setRevision(value => value + 1)}/>}
      {view === "methods" && <><h2>Methods</h2><p>A routine needs a successful Method run, explicit verification, and authority for its actions. Draft a Routine from a proven basis under New, then enable it with a fresh authority receipt.</p>{!methods && !error && <p role="status">Reading Methods…</p>}{methods?.length === 0 && <p>No Methods are available in this context.</p>}<ul className="automations-list">{methods?.map(row => <MethodMaterial key={row.id} row={row}/>)}</ul></>}
      {view === "history" && <><h2>Invocation history</h2><p>{selected ? `Showing ${reading?.routines.find(row => row.routine === selected)?.name ?? "the selected routine"}.` : "Showing all routines."} {selected && <button onClick={() => setSelected(undefined)}>All routines</button>}</p>{!history && !error && <p role="status">Reading invocations…</p>}{history?.filter(row => !selected || row.routine_ref === selected).length === 0 && <p>No admitted invocations.</p>}<ul className="automations-list">{history?.filter(row => !selected || row.routine_ref === selected).map(row => <li key={row.invocation_ref}><strong>{reading?.routines.find(routine => routine.routine === row.routine_ref)?.name ?? "Routine invocation"}</strong><span>{row.trigger_observed_at}</span><p>{actionMessage({outcome: row.outcome})}</p><details><summary>Native references and deliveries</summary><p>{row.routine_ref}</p><p>{row.invocation_ref}</p><p>{row.method_ref}</p>{row.provider_deliveries?.map(delivery => <p key={delivery.delivery_ref}>{delivery.provider}: {delivery.delivery_ref}</p>)}</details></li>)}</ul></>}
      {view === "timers" && <><h2>Harness timers</h2><p>Existing harness jobs are shown read-only. Reconciliation requires a proven Method and explicit adoption.</p>{!reading && !error && <p role="status">Reading harness timers…</p>}{reading?.foreign_reconciliation.providers.map(provider => <section key={provider.provider}><h3>{provider.provider}</h3>{!provider.jobs.length && <p>No timers found.</p>}<ul className="automations-list">{provider.jobs.map((job,index) => <HarnessTimer key={job.job_id} job={job} index={index}/>)}</ul></section>)}</>}
    </div>
  </section>;
}

type AuthorityDraft = {authority_ref: string; revision: string; action_refs: string; granted: boolean; unattended: boolean};
const noAuthority: AuthorityDraft = {authority_ref: "", revision: "", action_refs: "", granted: true, unattended: false};

function AuthorityFields({value, onChange}: {value: AuthorityDraft; onChange: (next: AuthorityDraft) => void}) {
  return <fieldset className="automations-form-cluster">
    <legend>Authority</legend>
    <label className="oi-field">Authority reference<input className="oi-input" value={value.authority_ref} onChange={event => onChange({...value, authority_ref: event.target.value})} placeholder="authority/owner-desk"/></label>
    <label className="oi-field">Action references (comma-separated; they must be the proven Method's own Actions)<input className="oi-input" value={value.action_refs} onChange={event => onChange({...value, action_refs: event.target.value})} placeholder="action/read, action/report"/></label>
    <label className="oi-field">Authority revision (optional)<input className="oi-input" value={value.revision} onChange={event => onChange({...value, revision: event.target.value})}/></label>
    <label className="automations-check"><input type="checkbox" checked={value.granted} onChange={event => onChange({...value, granted: event.target.checked})}/> The owner granted this authority.</label>
    <label className="automations-check"><input type="checkbox" checked={value.unattended} onChange={event => onChange({...value, unattended: event.target.checked})}/> Runs unattended. Schedule and event triggers need this to enable.</label>
  </fieldset>;
}

export function DraftRoutine({project, methods, onDone}: {project?: string; methods?: MethodRow[]; onDone: () => void}) {
  const {transport} = useKernel();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState("");
  const [triggerKind, setTriggerKind] = useState<"manual" | "daily" | "cron" | "every" | "once">("manual");
  const [dailyTime, setDailyTime] = useState("09:00");
  const [cronExpression, setCronExpression] = useState("0 9 * * 1");
  const [everyValue, setEveryValue] = useState(30);
  const [everyUnit, setEveryUnit] = useState<"minute" | "hour" | "day">("minute");
  const [onceAt, setOnceAt] = useState("");
  const [authority, setAuthority] = useState<AuthorityDraft>(noAuthority);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [error, setError] = useState<string>();
  const [returned, setReturned] = useState<string>();
  function scheduleShape(): ScheduleShape {
    if (triggerKind === "daily") return {kind: "daily", time: dailyTime};
    if (triggerKind === "cron") return {kind: "cron", expression: cronExpression};
    if (triggerKind === "every") return {kind: "every", interval_ms: everyValue * (everyUnit === "minute" ? 60_000 : everyUnit === "hour" ? 3_600_000 : 86_400_000)};
    const instant = new Date(onceAt);
    if (Number.isNaN(instant.getTime())) throw new Error("A once schedule needs a readable date and time.");
    return {kind: "once", rfc3339: instant.toISOString()};
  }
  async function submit() {
    if (busy) return;
    setRefusal(undefined); setError(undefined); setReturned(undefined);
    const missing = createRefusal({name, method, proof});
    if (missing) {setRefusal(missing); return;}
    let trigger: string;
    let record: RoutineAuthority;
    try {
      trigger = triggerKind === "manual" ? JSON.stringify({kind: "manual"}) : JSON.stringify(scheduleRecord(name.trim(), scheduleShape()));
      record = authorityRecord(authority);
    } catch (problem) {setRefusal(message(problem)); return;}
    setBusy(true);
    try {
      const receipt = await routine(transport, project, {action: "create", name: name.trim(), description: description.trim() || undefined, method: method.trim(), proof_json: proof.trim(), trigger_json: trigger, authority_json: JSON.stringify(record)});
      setReturned(createReceiptMessage(receipt));
      onDone();
    } catch (failure) {setError(message(failure));} finally {setBusy(false);}
  }
  return <section aria-label="Draft a routine" className="automations-form">
    <h2>Draft a routine</h2>
    <p>A Routine starts from a proven basis: a Method run that succeeded and was verified. Pick the Method, attach the basis <code>aikit method prove</code> produced, describe the trigger, and state the authority. It is created in Draft and runs only when explicitly enabled.</p>
    {!methods && <p role="status">Reading Methods…</p>}
    {methods?.length === 0 && <p className="oi-refusal">No Methods are available in this context.</p>}
    <label className="oi-field">Name<input className="oi-input" value={name} onChange={event => setName(event.target.value)} placeholder="Daily demo"/></label>
    <label className="oi-field">Description (optional)<input className="oi-input" value={description} onChange={event => setDescription(event.target.value)}/></label>
    <label className="oi-field">Method<select className="oi-input" value={method} onChange={event => setMethod(event.target.value)}>{methods?.map(row => <option key={row.id} value={row.id}>{subjectLabel(row, row.id)}</option>)}</select></label>
    <label className="oi-field">Proven basis (the JSON `aikit method prove` returned, or an @file path to it)<input className="oi-input" value={proof} onChange={event => setProof(event.target.value)} placeholder="@/path/to/proven-basis.json"/></label>
    <label className="oi-field">Trigger
      <select className="oi-input" value={triggerKind} onChange={event => setTriggerKind(event.target.value as typeof triggerKind)}>
        <option value="manual">Manual — runs when asked</option>
        <option value="daily">Daily at a time</option>
        <option value="cron">Cron expression</option>
        <option value="every">Every interval</option>
        <option value="once">Once at an instant</option>
      </select>
    </label>
    {triggerKind === "daily" && <label className="oi-field">Time (hh:mm, the policy timezone)<input className="oi-input" value={dailyTime} onChange={event => setDailyTime(event.target.value)} placeholder="09:00"/></label>}
    {triggerKind === "cron" && <label className="oi-field">Cron expression (5 fields, the policy timezone)<input className="oi-input" value={cronExpression} onChange={event => setCronExpression(event.target.value)} placeholder="0 9 * * 1"/></label>}
    {triggerKind === "every" && <div className="automations-inline">
      <label className="oi-field">Every<input className="oi-input" type="number" min={1} value={everyValue} onChange={event => setEveryValue(Number(event.target.value))}/></label>
      <label className="oi-field">Unit<select className="oi-input" value={everyUnit} onChange={event => setEveryUnit(event.target.value as typeof everyUnit)}><option value="minute">minutes</option><option value="hour">hours</option><option value="day">days</option></select></label>
    </div>}
    {triggerKind === "once" && <label className="oi-field">When<input className="oi-input" type="datetime-local" value={onceAt} onChange={event => setOnceAt(event.target.value)}/></label>}
    {triggerKind !== "manual" && <p>Occurrences are resolved by Central's civil-time policy once the Routine is stored; a missed occurrence is skipped by default.</p>}
    <AuthorityFields value={authority} onChange={setAuthority}/>
    {refusal && <p className="oi-refusal">{refusal}</p>}
    {error && <p role="alert">{error}</p>}
    {returned && <p role="status">{returned}</p>}
    <div className="automations-actions"><button disabled={busy || !methods?.length} onClick={() => void submit()}>Create draft</button></div>
  </section>;
}

function RoutineAdoption({project, routine_ref, state, refresh}: {project?: string; routine_ref: string; state: RoutineDetail["state"]; refresh: () => void}) {
  const {transport} = useKernel();
  const [open, setOpen] = useState<"enable" | "reprove">();
  const [authority, setAuthority] = useState<AuthorityDraft>(noAuthority);
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [error, setError] = useState<string>();
  const [returned, setReturned] = useState<string>();
  if (state === "enabled") return null;
  async function submitEnable() {
    if (busy) return;
    setRefusal(undefined); setError(undefined); setReturned(undefined);
    let record: RoutineAuthority;
    try {record = authorityRecord(authority);} catch (problem) {setRefusal(message(problem)); return;}
    setBusy(true);
    try {
      setReturned(actionMessage(await routine(transport, project, {action: "enable", routine_ref, authority_json: JSON.stringify(record)})));
      refresh();
    } catch (failure) {setError(message(failure));} finally {setBusy(false);}
  }
  async function submitReprove() {
    if (busy) return;
    setRefusal(undefined); setError(undefined); setReturned(undefined);
    if (!proof.trim()) {setRefusal("Reproof needs the proven basis `aikit method prove` produced for the Method's new revision."); return;}
    setBusy(true);
    try {
      setReturned(actionMessage(await routine(transport, undefined, {action: "reprove", routine_ref, proof_json: proof.trim()})));
      refresh();
    } catch (failure) {setError(message(failure));} finally {setBusy(false);}
  }
  return <div className="automations-adoption">
    <div className="automations-actions">
      <button aria-expanded={open === "enable"} onClick={() => setOpen(open === "enable" ? undefined : "enable")}>Enable…</button>
      {state === "stale-proof" && <button aria-expanded={open === "reprove"} onClick={() => setOpen(open === "reprove" ? undefined : "reprove")}>Reprove…</button>}
    </div>
    {open === "enable" && <form className="automations-form" onSubmit={event => {event.preventDefault(); void submitEnable();}}>
      <p>Enable with a fresh authority receipt. AIKit refuses before any write if the authority names Actions outside the proven Method{state === "draft" ? " or the receipt is missing" : ""}.</p>
      <AuthorityFields value={authority} onChange={setAuthority}/>
      {refusal && <p className="oi-refusal">{refusal}</p>}
      {error && <p role="alert">{error}</p>}
      {returned && <p role="status">{returned}</p>}
      <div className="automations-actions"><button type="submit" disabled={busy}>Enable routine</button></div>
    </form>}
    {open === "reprove" && <form className="automations-form" onSubmit={event => {event.preventDefault(); void submitReprove();}}>
      <p>Attach the proven basis for the Method's new revision. Reproof never silently resumes automation: the Routine returns to Disabled until enabled again.</p>
      <label className="oi-field">Proven basis (JSON, or an @file path)<input className="oi-input" value={proof} onChange={event => setProof(event.target.value)} placeholder="@/path/to/proven-basis.json"/></label>
      {refusal && <p className="oi-refusal">{refusal}</p>}
      {error && <p role="alert">{error}</p>}
      {returned && <p role="status">{returned}</p>}
      <div className="automations-actions"><button type="submit" disabled={busy}>Reprove routine</button></div>
    </form>}
  </div>;
}
