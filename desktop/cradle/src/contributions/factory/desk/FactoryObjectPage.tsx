/**
 * Factory object pages (11-FACTORY §6, Ruling D1): what Inspect opens — a work
 * unit, an attempt, a check, a NOW record, an agent — in place with ← back.
 * Labelled fields first, content second, the owner's verbatim reading only
 * behind Show raw. Every field is the owner's; an absent field is omitted.
 */
import type {ReactNode} from "react";
import {runEntry, useDeskReading, type RunEntry} from "./deskStore";
import {objectUnder} from "./objectNav";
import {useNowRecord} from "./nowRecord";
import {BackBar, type FactoryObjectRef, type RunPageHost} from "./RunPage";
import {attemptsFor, frontierNode, legStanding, refTail, unitChecks, unitOf, type InspectionAttempt} from "./runModel";

const KIND_WORD: Record<FactoryObjectRef["kind"], string> = {"work-unit": "work unit", attempt: "attempt", check: "check", "now-record": "NOW record", agent: "agent"};

export function objectTitle(object: FactoryObjectRef | undefined): string | undefined {
  if (!object) return undefined;
  if (object.kind === "work-unit") {
    const entry = runEntry(object.runKey);
    return unitOf(entry?.inspection, object.unitRef)?.developmentalConcern ?? "Work unit";
  }
  if (object.kind === "attempt") return "Attempt";
  if (object.kind === "check") return object.check;
  if (object.kind === "agent") return object.label ?? refTail(object.ref) ?? "Agent";
  return "NOW record";
}

export function FactoryObjectPage({object, onBack, host}: {object: FactoryObjectRef; onBack: () => void; host: RunPageHost}) {
  useDeskReading();
  const under = objectUnder();
  const runKey = "runKey" in object ? object.runKey : undefined;
  const entry = runEntry(runKey);
  const backLabel = objectTitle(under) ?? entry?.card.title ?? "Desk";
  return <div className="frun fobject" aria-label={`${KIND_WORD[object.kind]} page`} data-object-page={object.kind}>
    <BackBar onBack={onBack} label={backLabel}/>
    {object.kind === "work-unit" && entry && <UnitPage entry={entry} unitRef={object.unitRef} host={host}/>}
    {object.kind === "attempt" && entry && <AttemptPage entry={entry} attemptRef={object.attemptRef}/>}
    {object.kind === "check" && entry && <CheckPage entry={entry} unitRef={object.unitRef} check={object.check}/>}
    {object.kind === "now-record" && <NowPage nowRef={object.ref}/>}
    {object.kind === "agent" && <Page title={object.label ?? refTail(object.ref) ?? "Agent"} kind="agent" fields={[["Identity", object.ref]]} raw={object}/>}
    {"runKey" in object && !entry && <p className="frun-empty">This run is no longer in the Desk's reading.</p>}
  </div>;
}

function Page({title, kind, fields, raw, children}: {title: string; kind: string; fields: [string, ReactNode | undefined][]; raw?: unknown; children?: ReactNode}) {
  return <>
    <header className="fobject-head"><h1 data-object-title>{title}</h1><span className="frun-pill">{kind}</span></header>
    <dl className="fobject-fields">
      {fields.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {children}
    {raw !== undefined && <details className="frun-raw"><summary>Show raw</summary><pre>{JSON.stringify(raw, null, 2)}</pre></details>}
  </>;
}

function UnitPage({entry, unitRef, host}: {entry: RunEntry; unitRef: string; host: RunPageHost}) {
  const unit = unitOf(entry.inspection, unitRef);
  const node = Object.values(entry.run.runMap?.nodes ?? {}).find(item => item.semanticRef === unitRef);
  const attempts = attemptsFor(entry.inspection, unitRef);
  const checks = unitChecks(unit?.requiredVerification, attempts);
  const frontier = frontierNode(entry.run);
  const leg = entry.inspection?.legs?.[unitRef];
  const barriers = (entry.inspection?.barriers ?? []).filter(barrier => barrier.waitsFor?.includes(unitRef) || barrier.releases?.includes(unitRef));
  const dependsOn = (unit?.dependencies ?? []).map(ref => unitOf(entry.inspection, ref)?.developmentalConcern ?? refTail(ref)).join("; ");
  const standing = node ? `${node.state ? node.state[0].toUpperCase() + node.state.slice(1) : ""}${node.state ? " · " : ""}${legStanding(node, leg).replace("-", " ")}` : undefined;
  return <Page title={unit?.developmentalConcern ?? node?.label ?? "Work unit"} kind="work unit" raw={unit ?? node} fields={[
    ["Kind", <>Work unit{frontier?.semanticRef === unitRef ? " · frontier" : ""} of {entry.card.title}</>],
    ["Standing", standing],
    ["Concern", unit?.developmentalConcern],
    ["Must change", unit?.requiredDifference],
    ["Returns", unit?.requiredReturn?.contract],
    ["Required checks", checks.length ? `${checks.filter(check => check.state === "passed").length} of ${checks.length} passed` : undefined],
    ["Depends on", dependsOn || "–"],
    ["Held by", barriers.length ? barriers.map(barrier => `gate · ${barrier.key.replace(/-/g, " ")}`).join("; ") : undefined],
    ["May", unit?.permittedEffects?.join("; ")],
    ["Stops when", unit?.stopConditions],
    ["Escalates when", unit?.escalationConditions],
    ["Attempts", attempts.length ? `${attempts.length}` : "None yet"],
  ]}>
    {checks.length > 0 && <ul className="fmap-checks fobject-list" aria-label="Required checks">{checks.map(check => <li key={check.text} data-check-state={check.state}>
      <button type="button" className="fobject-link" onClick={() => host.onOpenObject?.({kind: "check", runKey: entry.card.key, unitRef, check: check.text})}><span className="fcheck" data-state={check.state} aria-label={check.state}/>{check.text}</button>
    </li>)}</ul>}
    {attempts.length > 0 && <ul className="fobject-list" aria-label="Attempts">{attempts.map((attempt, index) => <li key={attempt.attemptRef}>
      <button type="button" className="fobject-link" onClick={() => host.onOpenObject?.({kind: "attempt", runKey: entry.card.key, attemptRef: attempt.attemptRef})}>Attempt {index + 1}{attempt.status ? ` · ${attempt.status}` : ""}</button>
    </li>)}</ul>}
  </Page>;
}

function AttemptPage({entry, attemptRef}: {entry: RunEntry; attemptRef: string}) {
  const attempt: InspectionAttempt | undefined = entry.inspection?.attempts?.find(item => item.attemptRef === attemptRef);
  if (!attempt) return <p className="frun-empty">This attempt is not in the owner's current inspection.</p>;
  const unit = unitOf(entry.inspection, attempt.workflowUnitRef);
  const body = attempt.body;
  return <Page title={`${refTail(attempt.participant?.agentRef) ?? "Agent"} · ${unit?.developmentalConcern ?? "attempt"}`} kind="attempt" raw={attempt} fields={[
    ["Agent", refTail(attempt.participant?.agentRef)],
    ["Harness", refTail(body?.harnessRef)],
    ["Model", refTail(body?.modelRef)],
    ["Route", refTail(body?.routeRef)],
    ["Session", body?.agentSessionRef ? "recorded" : undefined],
    ["Workcell", refTail(body?.workcellRef)],
    ["Status", attempt.status ?? undefined],
    ["Verifications", attempt.verification?.length ? attempt.verification.map(receipt => `${receipt.outcome ?? "unknown"}${receipt.sourceRevision ? ` at ${receipt.sourceRevision.slice(0, 7)}` : ""} (${receipt.obligations?.length ?? 0} checks)`).join("; ") : undefined],
    ["Readable return", attempt.return?.summary],
  ]}/>;
}

function CheckPage({entry, unitRef, check}: {entry: RunEntry; unitRef: string; check: string}) {
  const unit = unitOf(entry.inspection, unitRef);
  const row = unitChecks(unit?.requiredVerification, attemptsFor(entry.inspection, unitRef)).find(item => item.text === check);
  return <Page title={check} kind="check" fields={[
    ["Assertion", check],
    ["Basis", unit?.developmentalConcern],
    ["Tested state", row?.revision ? row.revision : row?.state === "outstanding" ? "not yet tested" : undefined],
    ["Result", row?.state],
    ["What remains", row?.state === "passed" ? "Nothing for this check." : "A verification receipt that names this check."],
  ]}/>;
}

function NowPage({nowRef}: {nowRef: string}) {
  const now = useNowRecord(nowRef);
  if (now.state === "reading") return <p className="frun-note" role="status">Reading the NOW record…</p>;
  if (now.state === "refused") return <p className="frun-note" role="alert">Couldn't read the NOW record: {now.error}</p>;
  const record = now.reading!.record;
  return <Page title={record.task_ref.replace(/^control:task:/, "").replace(/-/g, " ")} kind="NOW record" raw={now.reading} fields={[
    ["Purpose", record.purpose],
    ["Participants", record.participant_refs.length ? record.participant_refs.map(refTail).join(", ") : "–"],
    ["Sources", record.source_refs.length ? `${record.source_refs.length}` : "–"],
    ["Lifecycle", record.lifecycle],
  ]}/>;
}
