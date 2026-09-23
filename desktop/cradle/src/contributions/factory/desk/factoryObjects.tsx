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
import {inspectWorkflow, readCurrentWork, readJourney, readRun} from "./factoryReads";
import {peekDeskReading, titleOfRun} from "./deskStore";
import {nowProjectOf} from "./nowRecord";
import {agentName, isGuardian, readRoster} from "../sidebar/FactoryAgentsTab";
import {peekPopulation, readWhoami} from "../inhabitation/reads";
import {currentWorkWords, facetNowRef, facetOf, facetWords, occupancyView, positionName, warningWords, workView, WHOAMI_FACETS} from "../inhabitation/model";
import type {FactoryObjectRef} from "./RunPage";
import {attemptsFor, firstSentence, frontierNode, legStanding, refTail, runState, RUN_STATE_WORD, runTitle, unitChecks, unitOf, type RunReading, type WorkflowInspection} from "./runModel";

const SEP = "|";
const enc = (...parts: string[]) => parts.map(encodeURIComponent).join(SEP);
const dec = (ref: string) => ref.split(SEP).map(part => { try { return decodeURIComponent(part); } catch { return part; } });

/** A Factory object's identity for the registry, from what the Run page knows. */
export function factoryObject(object: FactoryObjectRef, runs: {runKey: string; statePath: string; runRef: string; title: string; project?: string}[], title?: string): ObjectRef {
  if (object.kind === "now-record") return {kind: "factory-now", ref: object.ref, title: title ?? "NOW record"};
  if (object.kind === "agent") return {kind: "factory-agent", ref: object.ref, title: object.label ?? refTail(object.ref) ?? "Agent"};
  if (object.kind === "position") return {kind: "factory-position", ref: object.ref, title: object.label ?? refTail(object.ref) ?? "Position"};
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

async function runAndInspection(transport: Parameters<typeof readRun>[0], statePath: string, runRef: string): Promise<{run: RunReading; inspection?: WorkflowInspection; partial?: string}> {
  const run = await readRun(transport, statePath, runRef);
  const whole = await inspectWorkflow(transport, statePath, runRef).catch(() => undefined);
  return {run, inspection: whole?.inspection, ...(whole?.partial ? {partial: whole.partial} : {})};
}
const runWords = (run: RunReading) => runTitle(undefined, run.destination, run.runRef);
const pick = (fields: [string, unknown][]) => fields.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => ({label, value: value as string}));

registerObjectKind({kind: "factory-run", label: "Run", glyph: "factory", read: async (object, {transport}) => {
  const [statePath, runRef] = dec(object.ref);
  const {run, inspection, partial} = await runAndInspection(transport, statePath, runRef);
  const journey = run.owningJourneyRefs?.[0] ? await readJourney(transport, statePath, run.owningJourneyRefs[0]).catch(() => undefined) : undefined;
  const state = runState(run.lifecycle);
  const frontier = frontierNode(run);
  return {kindLabel: "Run", title: runTitle(journey?.commission?.purpose, run.destination, run.runRef), state: RUN_STATE_WORD[state],
    fields: pick([["Purpose", journey?.commission?.purpose], ["Next", frontier?.kind === "destination" ? undefined : frontier?.label],
      ["Units", inspection?.totalUnits !== undefined ? String(inspection.totalUnits) : undefined], ["Attempts", inspection?.totalAttempts !== undefined ? String(inspection.totalAttempts) : undefined],
      ["Destination", run.destination], ["Inspection", partial]]),
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
  const legWords = node ? legStanding(node, leg).replace("-", " ") : undefined;
  const mapWords = node?.state ?? undefined;
  const standing = node ? [mapWords, legWords].filter((word, index, all) => word && all.indexOf(word) === index).map((word, index) => index === 0 ? word![0].toUpperCase() + word!.slice(1) : word).join(" · ") : undefined;
  return {kindLabel: "Work unit", title: unit?.developmentalConcern ?? node!.label, state: standing,
    fields: pick([
      ["Kind", `Work unit${frontier?.semanticRef === unitRef ? " · frontier" : ""} of ${runWords(run)}`],
      ["Standing", standing], ["Concern", unit?.developmentalConcern], ["Must change", unit?.requiredDifference], ["Hands back", unit?.requiredReturn?.contract],
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
    // The participant's agent page — where the profile detail the Agents
    // aperture no longer lists (it lists Positions) stays reachable.
    relations: attempt.participant?.agentRef ? [{label: "agent", object: {kind: "factory-agent", ref: attempt.participant.agentRef, title: agentName(undefined, attempt.participant.agentRef), ...(object.project ? {project: object.project} : {})}}] : undefined,
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

/** A Position (WORLD-INHABITATION-V1): the joined `aikit whoami --position P
 * --full` reading, every facet with its standing, in the contract's order.
 * When the joined reading cannot be had, the page says so and shows only what
 * the population reading already stated for this Position — never a guess.
 * The occupant's agent profile is a relation (secondary detail). */
/** Factory's own current-work derivation for the Position, per Desk source
 * in scope (`factory development current-work`): the candidates behind an
 * ambiguity, so it can be resolved — never collapsed to one. */
async function factoryCurrentWork(transport: Parameters<typeof readRun>[0], positionRef: string): Promise<{label: string; value: string}[]> {
  const sources = peekDeskReading()?.discovery?.sources ?? [];
  if (!sources.length) return [{label: "Factory current work", value: "not read — no Factory source is in the Desk's reading"}];
  const reads = await Promise.all(sources.map(source => readCurrentWork(transport, source.statePath, positionRef).then(read => ({source, read}))));
  return reads.map(({source, read}) => ({label: sources.length > 1 ? `Factory current work · ${source.project ?? "Central"}` : "Factory current work",
    value: read.state === "read" ? currentWorkWords(read.data, runRef => titleOfRun(runRef)) : `unavailable — ${read.reason} (${read.source})`}));
}

registerObjectKind({kind: "factory-position", label: "Position", glyph: "agent", read: async (object, {transport}) => {
  const [joined, factoryWork] = await Promise.all([readWhoami(transport, object.ref, object.project), factoryCurrentWork(transport, object.ref)]);
  const held = peekPopulation(object.project)?.read;
  const row = held?.state === "read" ? held.data.positions?.find(position => position.position_ref === object.ref) : undefined;
  if (joined.state === "unavailable") {
    const occupancy = occupancyView(row?.occupancy);
    return {kindLabel: "Position", title: row ? positionName(row) : object.title, state: `joined reading unavailable — ${joined.reason}`,
      fields: [...pick([["Handle", row?.handle ?? undefined], ["Role", refTail(row?.role_ref ?? undefined)], ["Occupancy", row ? occupancy.words : undefined], ["Current work", row ? workView(row.current_work, runRef => titleOfRun(runRef)).words : undefined],
        ["Joined reading", `unavailable — ${joined.reason} (${joined.source})`]]), ...factoryWork],
      raw: row} satisfies ObjectReading;
  }
  const reading = joined.data;
  const titleOf = (runRef: string) => titleOfRun(runRef);
  // The owner's value objects, read where their shapes are the owners':
  // the Position record (central.world-position/v1) and the occupancy
  // (actuation.position-occupancy/v1).
  const positionValue = facetOf(reading, "position")?.value as {record?: {label?: string; handle?: string; purpose?: string; profile_ref?: string | null; eligible_agent_refs?: string[]}} | undefined;
  const record = positionValue?.record;
  const occupancyValue = facetOf(reading, "occupancy")?.value as {current?: {agent_ref?: string | null}} | undefined;
  const occupantAgent = occupancyValue?.current?.agent_ref ?? undefined;
  const eligible = (record?.eligible_agent_refs ?? []).filter((ref): ref is string => typeof ref === "string");
  const nowRelation = (name: string, label: string) => {
    const ref = facetNowRef(facetOf(reading, name));
    return ref ? [{label, object: {kind: "factory-now", ref, title: label}}] : [];
  };
  const profileAgent = occupantAgent ?? eligible[0];
  const warnings = (joined.warnings ?? []).map(warningWords);
  return {kindLabel: "Position", title: record?.label ?? (row ? positionName(row) : object.title),
    state: facetWords("occupancy", facetOf(reading, "occupancy")),
    fields: [
      ...pick([["Handle", record?.handle ?? row?.handle ?? undefined], ["Purpose", record?.purpose]]),
      ...WHOAMI_FACETS.map(([name, label]) => ({label, value: facetWords(name, facetOf(reading, name), titleOf)})),
      ...factoryWork,
      ...pick([["Profile", record?.profile_ref ? refTail(record.profile_ref) : undefined], ["Eligible agents", eligible.length ? eligible.map(refTail).join(", ") : undefined],
        ["Owner warnings", warnings.length ? warnings.join("; ") : undefined]]),
    ],
    relations: [
      ...nowRelation("root_now", "Root NOW"), ...nowRelation("child_now", "Child NOW"), ...nowRelation("return_destination", "Return destination"),
      ...(profileAgent ? [{label: occupantAgent ? "occupant's agent profile" : "eligible agent profile", object: {kind: "factory-agent", ref: profileAgent, title: refTail(profileAgent) ?? "Agent", ...(object.project ? {project: object.project} : {})}}] : []),
    ],
    raw: reading} satisfies ObjectReading;
}});
