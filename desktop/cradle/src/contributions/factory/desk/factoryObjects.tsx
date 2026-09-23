/**
 * The Factory object kinds (11-FACTORY §6, Ruling D1) on the shared object
 * page registry (src/agent/objects/registry.ts): a run, a work unit, an
 * attempt, a check, a NOW record. Each ObjectRef is IDENTITY ONLY — the
 * state path, run and subject refs, encoded in `ref` — and each page READS
 * its object from the owner when it mounts (development run + workflow
 * inspection, Central's NOW reading); nothing is carried as a copy. A tool
 * call is the shared `tape-event` kind. Fields first, content second, Show
 * raw last; absent fields are omitted.
 */
import {registerObjectKind, type ObjectReading, type ObjectRef} from "../../../agent/objects/registry";
import {nowReading, type NowReading} from "../../../receiving/now";
import {inspectWorkflow, readJourney, readRun} from "./factoryReads";
import {nowProjectOf} from "./nowRecord";
import {agentName, isGuardian, readRoster} from "../sidebar/FactoryAgentsTab";
import type {FactoryObjectRef} from "./RunPage";
import {attemptsFor, firstSentence, frontierNode, legStanding, refTail, runState, RUN_STATE_WORD, runTitle, unitChecks, unitOf, type RunReading, type WorkflowInspection} from "./runModel";

const SEP = "|";
const enc = (...parts: string[]) => parts.map(encodeURIComponent).join(SEP);
const dec = (ref: string) => ref.split(SEP).map(part => { try { return decodeURIComponent(part); } catch { return part; } });

/** A Factory object's identity for the registry, from what the Run page knows. */
export function factoryObject(object: FactoryObjectRef, runs: {runKey: string; statePath: string; runRef: string; title: string; project?: string}[], title?: string): ObjectRef {
  if (object.kind === "now-record") return {kind: "factory-now", ref: object.ref, title: title ?? "NOW record"};
  if (object.kind === "agent") return {kind: "factory-agent", ref: object.ref, title: object.label ?? refTail(object.ref) ?? "Agent"};
  const run = runs.find(entry => entry.runKey === object.runKey);
  const statePath = run?.statePath ?? "", runRef = run?.runRef ?? "";
  const base = {project: run?.project};
  if (object.kind === "work-unit") return {...base, kind: "factory-unit", ref: enc(statePath, runRef, object.unitRef), title: title ?? "Work unit"};
  if (object.kind === "attempt") return {...base, kind: "factory-attempt", ref: enc(statePath, runRef, object.attemptRef), title: title ?? "Attempt"};
  return {...base, kind: "factory-check", ref: enc(statePath, runRef, object.unitRef, object.check), title: title ?? object.check};
}
export function factoryRunObject(statePath: string, runRef: string, title: string, project?: string): ObjectRef {
  return {kind: "factory-run", ref: enc(statePath, runRef), title, ...(project ? {project} : {})};
}

async function runAndInspection(transport: Parameters<typeof readRun>[0], statePath: string, runRef: string): Promise<{run: RunReading; inspection?: WorkflowInspection}> {
  const run = await readRun(transport, statePath, runRef);
  const inspection = await inspectWorkflow(transport, statePath, runRef).catch(() => undefined);
  return {run, inspection};
}
const runWords = (run: RunReading) => runTitle(undefined, run.destination, run.runRef);
const pick = (fields: [string, unknown][]) => fields.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => ({label, value: value as string}));

registerObjectKind({kind: "factory-run", label: "Run", glyph: "factory", read: async (object, {transport}) => {
  const [statePath, runRef] = dec(object.ref);
  const {run, inspection} = await runAndInspection(transport, statePath, runRef);
  const journey = run.owningJourneyRefs?.[0] ? await readJourney(transport, statePath, run.owningJourneyRefs[0]).catch(() => undefined) : undefined;
  const state = runState(run.lifecycle);
  const frontier = frontierNode(run);
  return {kindLabel: "Run", title: runTitle(journey?.commission?.purpose, run.destination, run.runRef), state: RUN_STATE_WORD[state],
    fields: pick([["Purpose", journey?.commission?.purpose], ["Next", frontier?.kind === "destination" ? undefined : frontier?.label],
      ["Units", inspection?.totalUnits !== undefined ? String(inspection.totalUnits) : undefined], ["Attempts", inspection?.totalAttempts !== undefined ? String(inspection.totalAttempts) : undefined],
      ["Destination", run.destination]]),
    raw: {run, journey}} satisfies ObjectReading;
}});

registerObjectKind({kind: "factory-unit", label: "Work unit", glyph: "factory", read: async (object, {transport}) => {
  const [statePath, runRef, unitRef] = dec(object.ref);
  const {run, inspection} = await runAndInspection(transport, statePath, runRef);
  const unit = unitOf(inspection, unitRef);
  const node = Object.values(run.runMap?.nodes ?? {}).find(item => item.semanticRef === unitRef);
  if (!unit && !node) throw new Error("The owner's run map no longer names this work unit.");
  const attempts = attemptsFor(inspection, unitRef);
  const checks = unitChecks(unit?.requiredVerification, attempts);
  const leg = inspection?.legs?.[unitRef];
  const frontier = frontierNode(run);
  const barriers = (inspection?.barriers ?? []).filter(barrier => barrier.waitsFor?.includes(unitRef) || barrier.releases?.includes(unitRef));
  const standing = node ? `${node.state ? node.state[0].toUpperCase() + node.state.slice(1) + " · " : ""}${legStanding(node, leg).replace("-", " ")}` : undefined;
  return {kindLabel: "Work unit", title: unit?.developmentalConcern ?? node!.label, state: standing,
    fields: pick([
      ["Kind", `Work unit${frontier?.semanticRef === unitRef ? " · frontier" : ""} of ${runWords(run)}`],
      ["Standing", standing], ["Concern", unit?.developmentalConcern], ["Must change", unit?.requiredDifference], ["Returns", unit?.requiredReturn?.contract],
      ["Required checks", checks.length ? `${checks.filter(check => check.state === "passed").length} of ${checks.length} passed` : undefined],
      ["Depends on", (unit?.dependencies ?? []).map(ref => unitOf(inspection, ref)?.developmentalConcern ?? refTail(ref)).join("; ") || "–"],
      ["Held by", barriers.length ? barriers.map(barrier => `gate · ${barrier.key.replace(/-/g, " ")}${barrier.complete ? " (passed)" : " (held)"}`).join("; ") : undefined],
      ["May", unit?.permittedEffects?.join("; ")], ["Stops when", unit?.stopConditions], ["Escalates when", unit?.escalationConditions],
      ["Attempts", attempts.length ? String(attempts.length) : "None yet"],
    ]),
    relations: [
      ...checks.map(check => ({label: check.state, object: {kind: "factory-check", ref: enc(statePath, runRef, unitRef, check.text), title: check.text, ...(object.project ? {project: object.project} : {})}})),
      ...attempts.map((attempt, index) => ({label: `attempt ${index + 1}`, object: {kind: "factory-attempt", ref: enc(statePath, runRef, attempt.attemptRef), title: `Attempt ${index + 1}${attempt.status ? ` · ${attempt.status}` : ""}`, ...(object.project ? {project: object.project} : {})}})),
    ],
    raw: unit ?? node} satisfies ObjectReading;
}});

registerObjectKind({kind: "factory-attempt", label: "Attempt", glyph: "activity", read: async (object, {transport}) => {
  const [statePath, runRef, attemptRef] = dec(object.ref);
  const {inspection} = await runAndInspection(transport, statePath, runRef);
  const attempt = inspection?.attempts?.find(item => item.attemptRef === attemptRef);
  if (!attempt) throw new Error("The owner's workflow inspection does not name this attempt.");
  const unit = unitOf(inspection, attempt.workflowUnitRef);
  const body = attempt.body;
  return {kindLabel: "Attempt", title: `${refTail(attempt.participant?.agentRef) ?? "Agent"} · ${unit?.developmentalConcern ?? "attempt"}`, state: attempt.status ?? undefined,
    fields: pick([
      ["Agent", refTail(attempt.participant?.agentRef)], ["Harness", refTail(body?.harnessRef)], ["Model", refTail(body?.modelRef)], ["Route", refTail(body?.routeRef)],
      ["Session", body?.agentSessionRef ? "recorded on the attempt" : undefined], ["Workcell", refTail(body?.workcellRef)],
      ["Status", attempt.status ?? undefined],
      ["Verifications", attempt.verification?.length ? attempt.verification.map(receipt => `${receipt.outcome ?? "unknown"}${receipt.sourceRevision ? ` at ${receipt.sourceRevision.slice(0, 7)}` : ""} (${receipt.obligations?.length ?? 0} checks)`).join("; ") : undefined],
    ]),
    content: attempt.return?.summary ? <p className="object-text">{attempt.return.summary}</p> : undefined,
    raw: attempt} satisfies ObjectReading;
}});

registerObjectKind({kind: "factory-check", label: "Check", glyph: "verify", read: async (object, {transport}) => {
  const [statePath, runRef, unitRef, check] = dec(object.ref);
  const {inspection} = await runAndInspection(transport, statePath, runRef);
  const unit = unitOf(inspection, unitRef);
  const row = unitChecks(unit?.requiredVerification, attemptsFor(inspection, unitRef)).find(item => item.text === check);
  if (!row) throw new Error("The unit no longer requires this check.");
  return {kindLabel: "Check", title: check, state: row.state,
    fields: pick([["Assertion", check], ["Basis", unit?.developmentalConcern], ["Tested state", row.revision ?? (row.state === "outstanding" ? "not yet tested" : undefined)], ["Result", row.state],
      ["What remains", row.state === "passed" ? "Nothing for this check." : "A verification receipt that names this check."]])} satisfies ObjectReading;
}});

registerObjectKind({kind: "factory-now", label: "NOW record", glyph: "today", read: async (object, {transport}) => {
  const reading = await nowReading<NowReading>(transport, nowProjectOf(object.ref), {kind: "read", now_ref: object.ref});
  const record = reading.record;
  return {kindLabel: "NOW record", title: firstSentence(record.purpose), state: record.lifecycle,
    fields: pick([["Purpose", record.purpose], ["Participants", record.participant_refs.length ? record.participant_refs.map(refTail).join(", ") : "–"],
      ["Sources", record.source_refs.length ? String(record.source_refs.length) : "–"], ["Lifecycle", record.lifecycle]]),
    raw: reading} satisfies ObjectReading;
}});

registerObjectKind({kind: "factory-agent", label: "Agent", glyph: "agent", read: async (object, {transport}) => {
  const roster = await readRoster(transport, object.project);
  const profile = roster.find(entry => entry.agentRef === object.ref);
  return {kindLabel: isGuardian(object.ref) ? "Guardian" : "Agent", title: agentName(profile, object.ref),
    state: profile ? (profile.accepted ? "accepted" : "proposed — not yet accepted") : "not in this scope's roster",
    fields: pick([["Purpose", profile?.purpose], ["Identity", object.ref],
      ["Skills", profile?.skillRefs.length ? profile.skillRefs.map(refTail).join(", ") : undefined],
      ["Setup", profile ? (profile.accepted ? "Accepted definition in Central's roster" : "A proposed definition awaiting acceptance") : undefined]]),
    raw: profile} satisfies ObjectReading;
}});
