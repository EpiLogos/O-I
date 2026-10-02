// Factory Live producer (FX-C2): open the Run's act with its cast and goal,
// resolve the repertoire (explicit → workflow → task/SkillSet → generic) and
// perform mapped events as contract world requests, never re-performing an
// occurrence. The IO is a recording fake over the real owner fixtures; the
// kernel's own act operations are Lane B's and are not exercised here.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-live-producer.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
const P = await import("../src/contributions/factory/live/producer.ts");
const R = await import("../src/contributions/factory/live/repertoire.ts");
const E = await import("../src/contributions/factory/live/eventMap.ts");
const live = JSON.parse(readFileSync(new URL("./fixtures/factory-live-events.json", import.meta.url), "utf8"));
const tape = JSON.parse(readFileSync(new URL("./fixtures/tape-journal.json", import.meta.url), "utf8"));
const [, after] = live.attemptReadings;

// The curated starter material as `material_list` would report it.
const materialRoot = new URL("../material/factory-expressions/", import.meta.url);
const curated = readdirSync(materialRoot, {recursive: true}).filter(path => String(path).endsWith(".expression.json")).map(path => {
  const document = JSON.parse(readFileSync(new URL(String(path), materialRoot), "utf8"));
  const reuse = document.reuse;
  return {file_ref: `central:Work/O-I/desktop/cradle/material/expressive-material/${path}`, revision: "seed", title: reuse.title, kind: reuse.kind, roles: reuse.roles ?? [], states: reuse.states ?? {}, gestures: reuse.gestures ?? {}, playback: reuse.playback ?? [], entry_scene_ref: reuse.entry_scene_ref ?? null, associations: reuse.associations ?? {}, expression_ref: document.expression_ref, location: {schema: "central.path-ref/v1", ref: path, root: "/", path}};
});

// The world seam as a recording fake: act_open/act_inspect return the act
// with every recorded passage (so a reopen sees what was performed); an
// optional one-shot race answers `act_revision_conflict` once.
function fakeIO({journals = {}, material = curated, characters = {}, recorded = [], race = false} = {}) {
  let raced = !race;
  let opened = recorded.length > 0;
  const sent = [];
  const counts = {attempts: 0, watch: 0, conversation: 0, sync: 0};
  return {
    sent, counts,
    readAttempts: async () => { counts.attempts++; return after; },
    watch: async () => { counts.watch++; return {contract: "oi.factory-telemetry-watch/v1", lines: live.telemetryWatch.filter(l => l.type !== "cursor"), cursor: {stateRevision: 21}}; },
    readJournal: async (session, afterCursor) => ({events: (journals[session] ?? []).filter(e => e.cursor > afterCursor)}),
    syncExpression: async () => { counts.sync++; },
    readCard: async agent => characters[agent] ? {character_ref: characters[agent]} : {},
    world: async request => {
      sent.push(request);
      const act = () => ({act_ref: request.act_ref, expression_ref: "expression:x", mode: "factory", phase: "running", revision: recorded.length + 1, cast: request.cast ?? [], position: recorded.length, sequence: [...recorded]});
      if (request.operation === "material_list") return {state: "materials", schema: "oi.expression-material-list/v1", register: "Work/O-I/desktop/cradle/material/expressive-material", folders: {}, materials: material, unreadable: [], truncated: false};
      if (request.operation === "act_open") { opened = true; return {state: "act_opened", act: act()}; }
      if (request.operation === "act_inspect") return {state: "act", act: act()};
      if (request.operation === "act_list") return {state: "acts", acts: recorded.length || opened ? [{act_ref: config.actRef, passages: recorded.length}] : [], persistent: true, store_errors: []};
      if (!raced && request.operation.startsWith("act_")) { raced = true; return {state: "act_revision_conflict", act_ref: request.act_ref}; }
      if (request.event_basis || request.operation === "act_operate") recorded.push({index: recorded.length, kind: request.operation, mode: "factory", at_unix_ms: 0, event_basis: request.event_basis, operation: request.operation_kind, native_ref: request.native_ref});
      return {state: "performed", act: act()};
    },
  };
}
const config = {runRef: live.runRef, goal: "Release notes follow the changelog's order", actRef: P.actRefFor(live.runRef), expressionRef: P.liveExpressionRefFor(live.runRef), actor: "desktop:factory-live", context: {}};

test("the curated material resolves by precedence: explicit, workflow, generic", () => {
  const workflow = R.resolveRepertoire(curated, {workflowKey: "expression-development"});
  assert.equal(workflow.basis, "workflow"); assert.match(workflow.expression.file_ref, /expression-development/);
  const generic = R.resolveRepertoire(curated, {workflowKey: "specimen-release-notes"});
  assert.equal(generic.basis, "generic");
  const explicit = R.resolveRepertoire(curated, {explicit: workflow.expression.file_ref, workflowKey: "other"});
  assert.equal(explicit.basis, "explicit");
  for (const key of ["arrival", "work-passage", "handoff", "review", "completion", "continuation"]) {
    const scene = R.sceneFor(workflow, key);
    assert.ok(scene?.scene_ref, `workflow repertoire has no ${key}`);
  }
  assert.ok(R.gestureFor(workflow, "invoke-skill", "anima-expressive-composition", undefined), "a skill gesture resolves");
  assert.equal(R.characterFor(workflow, undefined, 0, "working").basis, "curated-character");
  assert.notEqual(R.characterFor(workflow, undefined, 0, "idle").file_ref, R.characterFor(workflow, undefined, 1, "idle").file_ref, "two participants get two bodies");
  assert.equal(R.characterFor(workflow, "central:profile-character", 0, "idle").file_ref, "central:profile-character");
});

test("open: the act carries the cast (with profile characters), the goal subject and the run instrument", async () => {
  const io = fakeIO({characters: {"agent/specimen-reviewer": "central:Work/O-I/desktop/cradle/material/expressive-material/character/aletheia.expression.json"}});
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  const open = io.sent.find(r => r.operation === "act_open");
  assert.equal(open.operation, "act_open"); assert.equal(open.mode, "factory");
  assert.equal(open.subject_ref, live.runRef); assert.equal(open.instrument_ref, live.runRef);
  assert.deepEqual(open.cast.map(c => c.role), ["participants.0", "participants.1", "lead"]);
  assert.equal(open.cast.find(c => c.participant_ref === "agent/specimen-reviewer").character_ref, "central:Work/O-I/desktop/cradle/material/expressive-material/character/aletheia.expression.json");
  assert.equal(open.material, undefined, "act_open carries no material (the kernel's act_open has none)");
  assert.equal(producer.state.repertoire.basis, "generic"); assert.match(producer.state.repertoire.expression.file_ref, /factory-generic/, "the specimen workflow has no association: the generic composition");
  assert.equal(producer.state.status, "following");
});

test("a small Run's first open performs its whole history in order; a second pass performs nothing new", async () => {
  const session = after.attempts.find(a => a.attemptRef === "attempt:specimen-survey-1").disposition.body.agentSessionRef;
  const io = fakeIO({journals: {[session]: tape.pi}});
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  const mapped = E.mapEvents({runRef: live.runRef, goal: config.goal, attempts: after, telemetry: live.telemetryWatch.filter(l => l.type !== "cursor")}, {encounter: {[session]: tape.pi}});
  assert.ok(mapped.length <= P.CATCH_UP.fullHistory, "the specimen Run is a small history");
  const performed = await producer.pass();
  assert.deepEqual(performed.map(E.opKey), mapped.map(E.opKey), "every mapped operation, in its mapped order");
  const requests = io.sent.filter(r => r.operation.startsWith("act_") && !["act_open", "act_inspect", "act_list"].includes(r.operation));
  assert.ok(requests.some(r => r.operation === "act_select" && r.bindings.self?.agent_ref === "agent/specimen-surveyor"), "each cast member's arrival is kept");
  assert.ok(requests.some(r => r.operation === "act_text" && r.role === "resultText"));
  const withBasis = requests.filter(r => r.operation !== "act_operate");
  assert.ok(withBasis.every(r => E.decodeBasis(r.event_basis)?.entry), "every request names its inventory entry (in its wire occurrence)");
  assert.ok(withBasis.every(r => Object.keys(r.event_basis).sort().join() === "event_ref,family,occurrence,source"), "the wire event_basis is exactly the kernel's");
  const keys = withBasis.map(r => { const b = E.decodeBasis(r.event_basis); return `${b.event_ref}|${b.occurrence}`; });
  assert.equal(new Set(keys).size, keys.length, "no occurrence is sent twice");
  const states = requests.filter(r => r.operation === "act_select" && r.state);
  assert.ok(states.length && states.every(r => r.role && r.material?.file_ref && !r.material.scene_ref), "character states are object-local: role + state + the character, no Scene");
  const scenes = requests.filter(r => r.operation === "act_select" && !r.state);
  assert.ok(scenes.length && scenes.every(r => r.material?.scene_ref && !r.role), "Scene changes name material.scene_ref");
  for (const family of ["arrival", "activity", "tool-operation", "message", "artifact", "review", "continuation"]) {
    assert.ok(requests.some(r => r.event_basis?.family === family), `the full history performs ${family}`);
  }
  assert.ok(!requests.some(r => r.operation === "act_operate" && r.operation_kind === "live.catch-up"), "no catch-up for a small history");
  assert.ok(!producer.state.performed.some(p => p.state === "skipped"));
  assert.equal(producer.state.performed.filter(p => p.state === "unresolved").length, 0, "the curated repertoire performs every event");
  const before = io.sent.length;
  assert.equal((await producer.pass()).length, 0);
  assert.equal(io.sent.filter(r => r.operation !== "act_inspect").length, before - io.sent.slice(0, before).filter(r => r.operation === "act_inspect").length, "nothing re-performed");
  assert.equal(io.counts.attempts, 2, "the attempt reading is gated on the watch cursor (open + first pass only)");
});

test("reopening Live rebuilds the cursor from the act: history is never re-appended", async () => {
  const session = after.attempts.find(a => a.attemptRef === "attempt:specimen-survey-1").disposition.body.agentSessionRef;
  const recorded = [];
  const first = fakeIO({journals: {[session]: tape.pi}, recorded});
  const producer = new P.LiveProducer(first, config);
  await producer.open();
  await producer.pass();
  const sentFirst = first.sent.filter(r => r.event_basis).length;
  assert.ok(sentFirst > 0);
  // A fresh view: a new producer, the same act (the kernel holds its passages).
  const second = fakeIO({journals: {[session]: tape.pi}, recorded});
  const reopened = new P.LiveProducer(second, config);
  await reopened.open();
  assert.ok(reopened.state.cursor.encounterAfter[session] >= 60, "the journal cursor comes back from the passages");
  await reopened.pass();
  assert.deepEqual(second.sent.filter(r => r.event_basis || r.operation === "act_operate").map(r => r.operation + " " + r.event_basis?.occurrence), [], "nothing performed twice — neither history nor the catch-up");
});

test("late arrivals join the Expression and the act's cast", async () => {
  const io = fakeIO();
  const producer = new P.LiveProducer(io, config);
  // Open over the reading before the retry's reviewer session existed.
  io.readAttempts = async () => ({...after, attempts: after.attempts.filter(a => a.attemptRef === "attempt:specimen-survey-1")});
  await producer.open();
  assert.equal(producer.state.cast.length, 1);
  io.readAttempts = async () => after;
  io.watch = async () => ({contract: "oi.factory-telemetry-watch/v1", lines: [], cursor: {stateRevision: 99}});
  await producer.pass();
  assert.equal(producer.state.cast.length, 2);
  assert.ok(io.counts.sync >= 1, "the Expression takes the newcomer");
  const reopen = io.sent.filter(r => r.operation === "act_open").at(-1);
  assert.ok(reopen.cast.some(c => c.participant_ref === "agent/specimen-reviewer"), "act_open (idempotent resume) with the updated cast");
});

test("with no material the events stay addressable but unresolved — never an invented Scene", async () => {
  const io = fakeIO({material: []});
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  await producer.pass();
  const unresolved = producer.state.performed.filter(p => p.state === "unresolved");
  assert.ok(unresolved.length > 0 && unresolved.every(p => /No material/.test(p.error)));
  assert.ok(producer.state.performed.some(p => p.state === "performed" && p.op.operation === "act_text"), "text still fills its role");
});

test("repertoire: the selected Expression's gestures, skill refs and unit context", () => {
  const units = after.attempts.map(a => ({key: a.taskRef, praxisRefs: a.disposition.praxisRefs, agentRequirements: {agentSetRefs: ["agent-set:anima"]}}));
  const context = R.contextOfUnits(units, after.attempts);
  assert.deepEqual(context.skillSetRefs, ["agent-set:anima"]);
  assert.ok(context.skillRefs.includes("praxis:specimen/cite-before-claiming"));
  const workflow = R.resolveRepertoire(curated, {workflowKey: "expression-development"});
  const gesture = R.gestureFor(workflow, "invoke-skill", "unrelated-skill", undefined);
  assert.equal(gesture.file_ref, workflow.expression.file_ref, "the selected Expression's own gesture wins over curated gestures");
  assert.equal(gesture.scene_ref, workflow.expression.gestures["invoke-skill"].scene_ref);
  const bySkill = R.resolveRepertoire(curated, {skillRefs: ["skill:chronos-act-continuity"]});
  assert.equal(bySkill.basis, "task-or-skillset"); assert.match(bySkill.expression.file_ref, /expression-development/);
});

test("a revision race is re-read and retried once with the fresh act revision", async () => {
  const io = fakeIO({race: true});
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  await producer.pass();
  const conflictIndex = io.sent.findIndex((r, i) => i > 0 && r.operation.startsWith("act_") && !["act_open", "act_inspect", "act_list"].includes(r.operation));
  const retried = io.sent.slice(conflictIndex + 1).find(r => r.operation === io.sent[conflictIndex].operation && r.expected_act_revision !== undefined);
  assert.ok(io.sent.slice(conflictIndex + 1).some(r => r.operation === "act_inspect"), "the act is re-read");
  assert.ok(retried, "the same request is retried with expected_act_revision");
  assert.equal(producer.state.performed.filter(p => p.state === "refused").length, 0);
});

// A multi-act world with the kernel's passage cap: act_select/act_gesture at
// the cap answer `act_passage_limit`; act_list/act_inspect read the chain.
function cappedWorld(cap) {
  const acts = new Map();
  const sent = [];
  const actOf = ref => acts.get(ref);
  const world = async request => {
    sent.push(request);
    const {operation} = request;
    if (operation === "material_list") return {state: "materials", folders: {}, materials: curated, unreadable: [], truncated: false};
    if (operation === "act_open") {
      if (!acts.has(request.act_ref)) acts.set(request.act_ref, {act_ref: request.act_ref, expression_ref: request.expression_ref, mode: "factory", phase: "running", revision: 1, cast: request.cast, summary: request.summary, subject_ref: request.subject_ref, instrument_ref: request.instrument_ref, position: 0, sequence: []});
      return {state: "act_opened", act: structuredClone(actOf(request.act_ref))};
    }
    if (operation === "act_inspect") return actOf(request.act_ref) ? {state: "act", act: structuredClone(actOf(request.act_ref))} : {state: "unknown_act"};
    if (operation === "act_list") return {state: "acts", acts: [...acts.values()].filter(a => a.expression_ref === request.expression_ref).map(a => ({act_ref: a.act_ref, phase: a.phase, passages: a.sequence.length})), persistent: true, store_errors: []};
    const act = actOf(request.act_ref);
    if ((operation === "act_select" || operation === "act_gesture") && act.sequence.length >= cap) return {state: "act_passage_limit", act_ref: act.act_ref};
    act.sequence.push({index: act.sequence.length, kind: operation, mode: "factory", at_unix_ms: 0, event_basis: request.event_basis, operation: request.operation_kind, native_ref: request.native_ref});
    act.revision++; act.position = act.sequence.length - 1;
    return {state: "performed", act: structuredClone(act)};
  };
  return {acts, sent, world};
}

test("at the passage cap the act rolls over to a successor; the chain is read back on reopen", async () => {
  const session = after.attempts.find(a => a.attemptRef === "attempt:specimen-survey-1").disposition.body.agentSessionRef;
  const capped = cappedWorld(6);
  const io = {...fakeIO({journals: {[session]: tape.pi}}), world: capped.world};
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  await producer.pass();
  const base = config.actRef;
  assert.ok(capped.acts.has(`${base}:2`), "a successor act was opened");
  const successor = capped.acts.get(`${base}:2`);
  assert.equal(successor.summary, `continues ${base}`);
  assert.equal(successor.subject_ref, live.runRef); assert.equal(successor.instrument_ref, live.runRef);
  assert.deepEqual(successor.cast.map(c => c.participant_ref), capped.acts.get(base).cast.map(c => c.participant_ref));
  const rollover = capped.sent.find(r => r.operation === "act_operate" && r.operation_kind === "live.rollover");
  assert.equal(rollover.act_ref, base); assert.equal(rollover.native_ref, `${base}:2`); assert.ok(rollover.event_basis, "act_operate carries its event_basis");
  assert.equal(producer.state.performed.filter(p => p.state === "refused").length, 0, "nothing lost at the cap");
  assert.equal(producer.state.act.act_ref, [...capped.acts.keys()].at(-1));
  assert.ok(producer.state.chain.some(a => a.act_ref === base), "the timeline carries the earlier act");
  // Reopen: resume the newest act of the chain; nothing is performed twice.
  const reopened = new P.LiveProducer({...fakeIO({journals: {[session]: tape.pi}}), world: capped.world}, config);
  const before = capped.sent.length;
  await reopened.open();
  assert.equal(reopened.state.act.act_ref, [...capped.acts.keys()].at(-1));
  await reopened.pass();
  const again = capped.sent.slice(before).filter(r => r.event_basis && r.operation !== "act_operate");
  assert.deepEqual(again.map(r => r.event_basis.occurrence), []);
});

test("a long history (above the threshold) falls back to the bounded catch-up", async () => {
  const session = after.attempts.find(a => a.attemptRef === "attempt:specimen-survey-1").disposition.body.agentSessionRef;
  // 200 separate tool calls in the Pi envelope (synthetic, real shape).
  const calls = Array.from({length: 200}, (_, i) => ({cursor: 1000 + i, event: {kind: "provider", event: {Signal: {sequence: i, native_session_id: "n", provenance: [], kind: {kind: "tool-call", payload: {type: "tool_execution_start", toolCallId: `call_${i}`, toolName: "bash", args: {command: `step ${i}`}}}}}}}));
  const io = fakeIO({journals: {[session]: calls}});
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  const performed = await producer.pass();
  assert.ok(performed.length <= P.CATCH_UP.factoryOps + P.CATCH_UP.journalEvents, `bounded (${performed.length})`);
  assert.ok(producer.state.performed.some(p => p.state === "skipped"), "older history is recorded as skipped, not sent");
  assert.ok(io.sent.some(r => r.operation === "act_operate" && r.operation_kind === "live.catch-up" && r.native_ref && r.event_basis), "the catch-up is a recorded operate passage");
  const journalSent = io.sent.filter(r => E.decodeBasis(r.event_basis)?.journal);
  assert.ok(journalSent.length && journalSent.every(r => E.decodeBasis(r.event_basis).journal.cursor >= 1000 + 200 - P.CATCH_UP.journalEvents), "only the journal's last events");
});

test("a cancelled act is set aside: reopening performs the Run afresh in a successor act", async () => {
  const capped = cappedWorld(1000);
  const io = {...fakeIO(), world: capped.world};
  const first = new P.LiveProducer(io, config);
  await first.open(); await first.pass();
  const base = capped.acts.get(config.actRef);
  const performedBefore = base.sequence.length;
  base.phase = "cancelled";
  const again = new P.LiveProducer({...fakeIO(), world: capped.world}, config);
  await again.open();
  assert.equal(again.state.act.act_ref, `${config.actRef}:2`, "the successor is opened");
  await again.pass();
  assert.equal(capped.acts.get(`${config.actRef}:2`).sequence.length, performedBefore, "the whole history is performed again into the successor");
});

test("a session's later work (after the completed Run) is not performed in later passes", async () => {
  const done = JSON.parse(readFileSync(new URL("./fixtures/factory-native-owner-projections/native-finished.run.json", import.meta.url), "utf8")).nativeAttempts;
  assert.equal(E.ownerRunComplete(done), true, "completion comes from the native owner reading");
  const session = done.attempts[0].disposition.body.agentSessionRef;
  const finishedConfig = {...config,runRef:done.runRef};
  const journal = [
    {cursor: 10, event: {kind: "agent-message", sender: done.runRef, delivery_ref: "d/task", request: {submission: {turn: {packet: {text: "the Run's task"}}}}}},
    {cursor: 11, event: {kind: "provider", event: {TurnEnded: {stop: {Completed: {}}}}}},
  ];
  const io = fakeIO({journals: {[session]: journal}});
  io.readAttempts = async () => done;
  const producer = new P.LiveProducer(io, finishedConfig);
  await producer.open();
  await producer.pass();
  journal.push({cursor: 20, event: {kind: "user-message", text: "unrelated later work"}}, {cursor: 21, event: {kind: "provider", event: {TurnEnded: {stop: {Completed: {}}}}}});
  io.watch = async () => ({contract: "oi.factory-telemetry-watch/v1", lines: [], cursor: {stateRevision: 99}});
  await producer.pass();
  const performed = io.sent.filter(r => r.event_basis && E.decodeBasis(r.event_basis)?.journal?.cursor >= 20);
  assert.deepEqual(performed.map(r => r.event_basis.occurrence), [], "nothing past the Run's span in that session");
  assert.ok(io.sent.some(r => E.decodeBasis(r.event_basis ?? {})?.entry === "encounter.agent-message"), "the Run's own message was performed");
});
