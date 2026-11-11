// Factory Live event → expression inventory (FX-C1; contract §5). Every
// event family maps over REAL owner fixtures: the Factory attempt reading and
// telemetry watch over the disposable specimen ground (installed factory CLI,
// including a native fail + retry), the AIKit gateway population and
// conversation readings, a real custody receipt, real encounter journal
// excerpts, and a real claude stream-json body transcript. Skill invocation
// has no real record on this machine; its synthetic events mirror the
// providers' exact envelopes and are named as such.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-live-event-map.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const M = await import("../src/contributions/factory/live/eventMap.ts");
const live = JSON.parse(readFileSync(new URL("./fixtures/factory-live-events.json", import.meta.url), "utf8"));
const tape = JSON.parse(readFileSync(new URL("./fixtures/tape-journal.json", import.meta.url), "utf8"));
const usage = JSON.parse(readFileSync(new URL("./fixtures/tape-usage-journal.json", import.meta.url), "utf8"));

const [before, after] = live.attemptReadings;
const reviewSession = after.attempts.find(a => a.attemptRef === "attempt:specimen-review-1").disposition.body.agentSessionRef;
const surveySession = after.attempts.find(a => a.attemptRef === "attempt:specimen-survey-1").disposition.body.agentSessionRef;
const custodyRun = live.custody.custody.run_ref;

// Synthetic skill loads, in the providers' own envelopes (tape-model.test.mjs shapes).
const signal = (cursor, kind, fields = {}) => ({cursor, event: {kind: "provider", event: {Signal: {sequence: cursor, native_session_id: "n", provenance: [], kind: {kind, ...fields}}}}});
const piSkillRead = signal(900, "tool-call", {payload: {type: "tool_execution_start", toolCallId: "call_skill_1", toolName: "read", args: {path: "/Users/admin/.pi/skills/anima-expressive-composition/SKILL.md"}}});
const piSkillReadAgain = signal(905, "tool-call", {payload: {type: "tool_execution_start", toolCallId: "call_skill_2", toolName: "read", args: {path: "/Users/admin/.pi/skills/anima-expressive-composition/SKILL.md"}}});
const acpSkill = signal(910, "tool-call", {payload: {sessionUpdate: "tool_call", toolCallId: "tc-skill", kind: "other", title: "Skill", rawInput: {skill: "chronos-act-continuity"}}});
const claudeSkill = {type: "assistant", session_id: "s", message: {content: [{type: "tool_use", id: "toolu_skill", name: "Skill", input: {skill: "aletheia-expressive-return"}}]}};

function readingsFor(extra = {}) {
  return {runRef: live.runRef, goal: "Release notes follow the changelog's order", attempts: after, telemetry: live.telemetryWatch, custody: [], population: live.population, communiques: [], ...extra};
}

test("the inventory names every spec §5 family, with exact source, event, identity and payload paths", () => {
  const families = new Set(M.EVENT_INVENTORY.map(entry => entry.family));
  for (const family of M.EVENT_FAMILIES) assert.ok(families.has(family), `no inventory entry for ${family}`);
  const ids = new Set();
  for (const entry of M.EVENT_INVENTORY) {
    assert.ok(!ids.has(entry.id), `duplicate ${entry.id}`); ids.add(entry.id);
    assert.ok(entry.event && entry.identity.length && entry.payload.length && entry.yields.length, entry.id);
    for (const y of entry.yields) assert.ok(["act_select", "act_gesture", "act_text"].includes(y.op), entry.id);
  }
  // Every family is available from a NATIVE source (the harness transcript is extra).
  for (const family of M.EVENT_FAMILIES) assert.ok(M.EVENT_INVENTORY.some(e => e.family === family && e.native), `${family} has no native source`);
});

test("the cast comes from attempt participants, then custody and Communique Positions; the first is lead", () => {
  const cast = M.castOf(readingsFor());
  assert.deepEqual(cast.map(c => c.agent_ref), ["agent/specimen-surveyor", "agent/specimen-reviewer"]);
  assert.equal(cast[0].role, "participants.0");
  assert.ok(cast[1].session_refs.includes("agent-session/specimen-review") && cast[1].session_refs.includes("agent-session/specimen-review-2"), "a retry's new session joins the same cast member");
  const withCommuniques = M.castOf({runRef: "run:x", population: live.population, communiques: live.conversation.communiques});
  assert.deepEqual(withCommuniques.map(c => c.agent_ref).sort(), ["agent/anima", "central:position:project:O-I:factory-guardian"].sort(),
    "an occupied Position names its agent; a vacant one stays its Position (never a guessed agent)");
});

test("real Factory attempt readings map: arrival, activity, review, artifact, continuation, fail", () => {
  const ops = M.mapEvents(readingsFor(), {});
  const entries = ops.map(op => op.basis.entry);
  for (const id of ["attempt.start", "attempt.dispatch", "attempt.observation", "attempt.tracking", "attempt.verification", "attempt.return", "attempt.retry", "telemetry.correlation"]) {
    assert.ok(entries.includes(id), `missing ${id}`);
  }
  const arrival = ops.find(op => op.basis.entry === "attempt.start");
  assert.equal(arrival.operation, "act_select"); assert.equal(arrival.scene, "arrival");
  assert.equal(arrival.bindings.self.agent_ref, "agent/specimen-surveyor"); assert.equal(arrival.bindings.self.state, "working");
  assert.equal(arrival.bindings.goal.label, "Release notes follow the changelog's order");
  assert.deepEqual(arrival.basis.detail.skills, ["praxis:specimen/cite-before-claiming"], "the attempt's selected skills ride as detail for the panel");
  const verifications = ops.filter(op => op.basis.entry === "attempt.verification");
  assert.deepEqual(verifications.map(op => op.bindings.outcome.value).sort(), [0.5, 0.5, 1]);
  const ret = ops.find(op => op.basis.entry === "attempt.return");
  assert.equal(ret.operation, "act_text"); assert.equal(ret.role, "resultText"); assert.match(ret.text, /^Section order is decided/);
  assert.equal(ret.bindings.artifact.subject_ref, "artifact:specimen/survey-section-order");
  const retry = ops.find(op => op.basis.entry === "attempt.retry");
  assert.equal(retry.scene, "continuation"); assert.equal(retry.basis.event_ref, "attempt:specimen-review-2");
  assert.equal(retry.bindings.self.agent_ref, "agent/specimen-reviewer", "the retry continues with the existing cast");
  // The failure is in the BEFORE-retry leg history only if read then; the
  // failed reading after fail (revision 22) is reconstructed from the retry's
  // re-resolution evidence. The fail family maps over a leg history that
  // carries `failed`:
  const failedLeg = structuredClone(before);
  const unit = Object.keys(failedLeg.legs).find(key => failedLeg.legs[key].status === "active");
  failedLeg.legs[unit].status = "failed"; failedLeg.legs[unit].statusHistory = ["active", "failed"]; failedLeg.legs[unit].failureReason = "The changelog check could not run";
  const failOps = M.mapEvents(readingsFor({attempts: failedLeg}), {});
  const fail = failOps.find(op => op.basis.entry === "attempt.fail");
  assert.equal(fail.scene, "review"); assert.equal(fail.bindings.outcome.value, 0);
});

test("telemetry watch lines for this run only; the cursor line becomes the resume cursor", () => {
  const ops = M.mapEvents(readingsFor({attempts: undefined}), {});
  assert.equal(ops.filter(op => op.basis.entry === "telemetry.correlation").length, 2);
  const other = M.mapEvents({runRef: "run:other", telemetry: live.telemetryWatch}, {});
  assert.equal(other.length, 0);
  const cursor = M.advanceCursor(M.emptyCursor(), ops, {}, live.telemetryWatch);
  assert.deepEqual(cursor.telemetry, {stateRevision: live.telemetryWatch.at(-1).cursor.stateRevision});
});

test("run completion: every leg returned performs the completion Scene with the whole cast", () => {
  const done = structuredClone(before);
  for (const leg of Object.values(done.legs)) { leg.status = "returned"; leg.statusHistory = ["active", "returned"]; }
  const ops = M.mapEvents(readingsFor({attempts: done}), {});
  const completion = ops.find(op => op.basis.entry === "attempt.run-complete");
  assert.equal(completion.scene, "completion");
  assert.ok(completion.bindings["participants.0"] && completion.bindings["participants.1"] && completion.bindings.resultText);
});

test("custody transitions: in-progress arrives, completed completes, the rest continue (real receipt)", () => {
  const receipt = live.custody;
  const completed = structuredClone(receipt);
  completed.custody.transitions.push({revision: 2, to: "completed", reason: "Returned the proposed wiki revision through NOW.", at_unix_ms: receipt.custody.assigned_at_unix_ms + 60000});
  completed.custody.transitions.push({revision: 3, to: "released", reason: "Tenure ended.", at_unix_ms: receipt.custody.assigned_at_unix_ms + 70000});
  const ops = M.mapEvents({runRef: custodyRun, population: live.population, custody: [completed]}, {});
  assert.deepEqual(ops.map(op => op.basis.entry).filter(id => id.startsWith("custody.")), ["custody.in-progress", "custody.completed", "custody.released"]);
  const arrival = ops.find(op => op.basis.entry === "custody.in-progress");
  assert.equal(arrival.bindings.self.agent_ref, "agent/aletheia", "the Position's occupant from the population reading");
  assert.equal(arrival.bindings.goal.subject_ref, "central:wiki:root");
  assert.ok(ops.some(op => op.basis.entry === "gateway.occupancy"), "the occupied Position arrives from the population reading");
});

test("Communiques: each is a handoff from sender to recipient with its body, addressed by communique ref", () => {
  const ops = M.mapEvents({runRef: "run:x", population: live.population, communiques: live.conversation.communiques}, {});
  const handoffs = ops.filter(op => op.basis.entry === "gateway.communique");
  assert.equal(handoffs.length, live.conversation.communiques.length);
  const toAnima = handoffs.find(op => op.basis.detail.to === "central:position:project:O-I:anima-4");
  assert.equal(toAnima.scene, "handoff"); assert.equal(toAnima.bindings.recipient.agent_ref, "agent/anima");
  assert.match(toAnima.bindings.caption.text, /^From the Factory Guardian/);
  assert.ok(new Set(handoffs.map(op => op.basis.event_ref)).size === handoffs.length);
});

test("real encounter journals: messages, tool operations, replies, thoughts and turn ends", () => {
  const readings = readingsFor();
  const ops = M.mapEvents(readings, {encounter: {[reviewSession]: tape.acp, [surveySession]: tape.pi}});
  const entries = new Set(ops.map(op => op.basis.entry));
  for (const id of ["encounter.user-message", "encounter.agent-message", "encounter.tool-call", "encounter.reply", "encounter.thought", "encounter.turn-end"]) assert.ok(entries.has(id), `missing ${id}`);
  const pi = ops.filter(op => op.basis.event_ref === surveySession);
  const tool = pi.find(op => op.basis.entry === "encounter.tool-call");
  assert.equal(tool.operation, "act_gesture"); assert.equal(tool.gesture, "operate"); assert.equal(tool.role, "participants.0");
  assert.equal(tool.basis.detail.tool, "bimba_list_coordinates");
  assert.equal(pi.filter(op => op.basis.entry === "encounter.tool-call").length, 1, "the tool result joins its call — one gesture");
  const reply = pi.find(op => op.basis.entry === "encounter.reply" && op.operation === "act_text");
  assert.ok(reply.text.length > 1, "a run of chunks is one text that grows");
  assert.equal(pi.filter(op => op.basis.entry === "encounter.reply" && op.operation === "act_text").length, 1);
  assert.equal(pi.filter(op => op.basis.entry === "encounter.turn-end").length, 1, "completed + TurnEnded are one turn end");
  const message = ops.find(op => op.basis.entry === "encounter.agent-message");
  assert.equal(message.bindings.sender.agent_ref, "human:owner"); assert.equal(message.bindings.recipient.agent_ref, "agent/specimen-reviewer");
  // ACP tool_call and its tool_call_update share toolCallId: one gesture per call.
  const acpTools = ops.filter(op => op.basis.event_ref === reviewSession && op.basis.entry === "encounter.tool-call");
  assert.equal(acpTools.length, new Set(acpTools.map(op => op.basis.occurrence)).size);
});

test("repeated invocations are separate occurrences (real usage journal: consecutive bash calls)", () => {
  const ops = M.mapEvents(readingsFor(), {encounter: {[surveySession]: usage.events}});
  const calls = ops.filter(op => op.basis.entry === "encounter.tool-call");
  assert.ok(calls.length >= 2);
  assert.equal(new Set(calls.map(op => op.basis.occurrence)).size, calls.length);
});

test("skill invocation: Pi SKILL.md read, ACP Skill tool, claude Skill tool_use — each a skill gesture, separately addressed", () => {
  const ops = M.mapEvents(readingsFor(), {encounter: {[surveySession]: [piSkillRead, piSkillReadAgain, acpSkill]}, harness: {[surveySession]: [claudeSkill]}});
  const skills = ops.filter(op => op.basis.family === "skill-invocation");
  assert.deepEqual(skills.map(op => op.skill), ["anima-expressive-composition", "anima-expressive-composition", "chronos-act-continuity", "aletheia-expressive-return"]);
  assert.ok(skills.every(op => op.operation === "act_gesture" && op.gesture === "invoke-skill"));
  assert.equal(new Set(skills.map(op => op.basis.occurrence)).size, 4, "two loads of the same skill are two occurrences");
});

test("the real claude body transcript: Task dispatch is a handoff, Read a tool operation (not native)", () => {
  const ops = M.mapEvents(readingsFor(), {harness: {[surveySession]: live.claudeStream}});
  const delegation = ops.find(op => op.basis.entry === "harness.delegation");
  assert.equal(delegation.scene, "handoff"); assert.match(delegation.bindings.caption.text, /Anansi|blueprint/i);
  assert.ok(ops.some(op => op.basis.entry === "harness.tool"));
  assert.equal(M.inventoryEntry("harness.delegation").native, false);
});

test("every family maps over the fixtures together", () => {
  const custody = structuredClone(live.custody);
  custody.custody.transitions.push({revision: 2, to: "completed", reason: "done", at_unix_ms: custody.custody.assigned_at_unix_ms + 1});
  const done = structuredClone(before);
  for (const leg of Object.values(done.legs)) { leg.status = "returned"; leg.statusHistory = ["active", "returned"]; }
  const all = [
    ...M.mapEvents(readingsFor(), {encounter: {[reviewSession]: tape.acp, [surveySession]: [...tape.pi, piSkillRead]}}),
    ...M.mapEvents({runRef: custodyRun, population: live.population, custody: [custody], communiques: live.conversation.communiques}, {}),
    ...M.mapEvents(readingsFor({attempts: done}), {}),
  ];
  const families = new Set(all.map(op => op.basis.family));
  assert.deepEqual([...M.EVENT_FAMILIES].filter(f => !families.has(f)), []);
  for (const op of all) assert.ok(M.inventoryEntry(op.basis.entry), `op without inventory entry ${op.basis.entry}`);
});

test("the cursor skips what was performed; a later journal page yields only new occurrences", () => {
  const first = M.mapEvents(readingsFor(), {encounter: {[surveySession]: tape.pi.slice(0, 5)}});
  const cursor = M.advanceCursor(M.emptyCursor(), first, {encounter: {[surveySession]: tape.pi.slice(0, 5)}}, live.telemetryWatch, after.revision);
  const again = M.mapEvents(readingsFor(), {encounter: {[surveySession]: tape.pi.slice(0, 5)}}, cursor);
  assert.equal(again.length, 0, "nothing re-performed");
  const later = M.mapEvents(readingsFor(), {encounter: {[surveySession]: tape.pi}}, cursor);
  assert.ok(later.length > 0 && later.every(op => op.basis.source === "aikit-encounter"));
  assert.equal(cursor.attemptRevision, after.revision);
});

test("occurrence keys: correlations by correlationRef, run completion once, whatever the revision", () => {
  const first = M.mapEvents(readingsFor({attempts: undefined}), {});
  const moved = live.telemetryWatch.map(line => line.type === "execution-correlation" ? {...line, stateRevision: line.stateRevision + 5} : line);
  const again = M.mapEvents(readingsFor({attempts: undefined, telemetry: moved}), {}, M.advanceCursor(M.emptyCursor(), first));
  assert.equal(again.length, 0, "a later state revision re-emits the same correlations; none is performed twice");
  assert.ok(first.every(op => op.basis.event_ref.startsWith("execution-correlation:")));
  const done = structuredClone(before);
  for (const leg of Object.values(done.legs)) { leg.status = "returned"; leg.statusHistory = ["active", "returned"]; }
  const complete = M.mapEvents(readingsFor({attempts: done}), {});
  const later = {...structuredClone(done), revision: done.revision + 3};
  const next = M.mapEvents(readingsFor({attempts: later}), {}, M.advanceCursor(M.emptyCursor(), complete));
  assert.ok(!next.some(op => op.basis.entry === "attempt.run-complete"), "completion is performed once per run");
});

test("a reply split across passes is one speaking state and one text; completed + TurnEnded across passes is one turn end", () => {
  const pages = [tape.pi.filter(e => e.cursor <= 49), tape.pi.filter(e => e.cursor > 49 && e.cursor <= 70), tape.pi.filter(e => e.cursor > 70)];
  let cursor = M.emptyCursor();
  const all = [];
  for (const page of pages) {
    const journals = {encounter: {[surveySession]: page}};
    const {ops, sessions} = M.mapEventsWithCursor(readingsFor({attempts: after, telemetry: []}), journals, cursor);
    const mine = ops.filter(op => op.basis.source === "aikit-encounter");
    all.push(...mine);
    cursor = M.advanceCursor(cursor, ops, journals, undefined, undefined, sessions);
  }
  assert.equal(all.filter(op => op.basis.entry === "encounter.reply" && op.operation === "act_select").length, 1);
  const texts = all.filter(op => op.basis.entry === "encounter.reply" && op.operation === "act_text");
  assert.equal(texts.length, 1); assert.ok(texts[0].text.length > 1, "the whole run's text, once, when it closes");
  assert.equal(all.filter(op => op.basis.entry === "encounter.turn-end").length, 1);
  const keys = all.map(M.opKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("character states are object-local (role + state); Scenes carry no role/state", () => {
  const ops = M.mapEvents(readingsFor(), {encounter: {[surveySession]: tape.pi}});
  for (const op of ops.filter(op => op.operation === "act_select")) {
    if ("state" in op) { assert.ok(op.role && !("scene" in op)); }
    else assert.ok(op.scene && !("role" in op));
  }
});

test("the Run's window keeps other work between the same Positions out (Communiques, occupancy)", () => {
  const window = M.runWindow(before);
  assert.ok(window?.from, "a window starts at the first attempt");
  const inside = M.mapEvents({runRef: "run:x", population: live.population, communiques: live.conversation.communiques}, {});
  assert.ok(inside.some(op => op.basis.entry === "gateway.communique"));
  const outside = M.mapEvents({runRef: "run:x", population: live.population, communiques: live.conversation.communiques, window: {from: Date.now() + 86_400_000}}, {});
  assert.ok(!outside.some(op => op.basis.entry === "gateway.communique"), "Communiques sent before the Run are not its exchanges");
  assert.equal(M.castOf({runRef: "run:x", population: live.population, communiques: live.conversation.communiques, window: {from: Date.now() + 86_400_000}}).length, 0);
});

test("a session's other work before and after a completed Run is not the Run's (journal bounds)", () => {
  // The real layout of the acceptance Run's Aletheia journal: a peer message
  // first, then the Run's task, a turn end, then later unrelated owner turns.
  const msg = (cursor, sender) => ({cursor, event: {kind: "agent-message", sender, delivery_ref: `d${cursor}`, request: {submission: {turn: {packet: {text: `from ${sender}`}}}}}});
  const end = cursor => ({cursor, event: {kind: "provider", event: {TurnEnded: {stop: {Completed: {}}}}}});
  const user = cursor => ({cursor, event: {kind: "user-message", text: "later work"}});
  const events = [user(10), end(11), msg(20, "agent/anima"), end(21), msg(22, "run:R"), end(23), user(30), end(31)];
  assert.deepEqual(M.journalBounds(events, "run:R", new Set(["agent/anima"]), true), {from: 20, to: 23});
  assert.deepEqual(M.journalBounds(events, "run:R", new Set(["agent/anima"]), false), {from: 20, to: Infinity});
  assert.deepEqual(M.journalBounds(events.filter(e => e.cursor !== 22), "run:R", new Set(), true), {from: -Infinity, to: Infinity}, "a session the Run never addressed is the attempt's own");
});

// be2k ruling 4 (DLW build ruling 2026-11-10): the event map's other paths are plain too: the Run's goal where the Run hands over, a
// skill's caption, a delegate's name and the name of someone outside the cast. A ref and a skill's own name stay as read.
test("the Run's goal as a sender, a skill's caption, a delegate's name and a person's name reach the scene plain; refs and skills stay as read (be2k)", () => {
  const msg = (cursor, sender) => ({cursor, event: {kind: "agent-message", sender, delivery_ref: `d${cursor}`, request: {submission: {turn: {packet: {text: "go"}}}}}});
  const skill = signal(930, "tool-call", {payload: {sessionUpdate: "tool_call", toolCallId: "tc-laced", kind: "other", title: "Skill", rawInput: {skill: "chron\u202eos\u200b"}}});
  const harness = {type: "assistant", session_id: "s", message: {content: [{type: "tool_use", id: "toolu_laced", name: "Skill", input: {skill: "ale\u2066theia\u2069"}},
    {type: "tool_use", id: "toolu_task", name: "Task", input: {subagent_type: "Ana\u202ensi\u200b", description: "Draw the blueprint"}}]}};
  const ops = M.mapEvents(readingsFor({goal: "Release\u202e notes\u200b"}), {encounter: {[surveySession]: [msg(920, live.runRef), msg(925, "world:x/Ma\u202era\u200b"), skill]}, harness: {[surveySession]: [harness]}});
  const messages = ops.filter(op => op.basis.entry === "encounter.agent-message");
  assert.deepEqual(messages.map(op => [op.bindings.sender.agent_ref ?? op.bindings.sender.subject_ref, op.bindings.sender.label]),
    [[live.runRef, "Release notes"], ["world:x/Ma\u202era\u200b", "Mara"]], "the goal and a name shown plain; the ref as read");
  const skills = ops.filter(op => op.basis.family === "skill-invocation");
  assert.deepEqual(skills.map(op => [op.skill, op.bindings.caption.text]), [["chron\u202eos\u200b", "chronos"], ["ale\u2066theia\u2069", "aletheia"]]);
  const delegation = ops.find(op => op.basis.entry === "harness.delegation");
  assert.deepEqual([delegation.bindings.recipient.agent_ref, delegation.bindings.recipient.label], ["Ana\u202ensi\u200b", "Anansi"]);
});

// be2i ruling 7 (DLW build ruling 2026-11-09): what an agent or Factory wrote reaches the scene plain, through the shared set
// (shared/plainText.ts), so no bidi control reorders a caption and no control or invisible character stands in one.
test("an attempt's returned words reach the scene plain: no bidi control, control or invisible character (be2i)", () => {
  const attempts = structuredClone(after);
  attempts.attempts[2].readableReturn.summary = "Section\u202e order\u0007is\u200b decided\u3164 in one place";
  const ret = M.mapEvents(readingsFor({attempts}), {}).find(op => op.basis.entry === "attempt.return");
  assert.equal(ret.text, "Section order is decided in one place");
});

// be2j ruling 3 (DLW build ruling 2026-11-09): an agent's label and the run's goal are someone's words: they reach the scene on one line,
// plain (shared/plainText.ts oneLineText), and a label with nothing visible left gives way to the agent's own name. Refs stay as read.
test("an agent's label and the run's goal reach the scene on one line, plain; a label with nothing visible left gives way to the agent's name (be2j)", () => {
  const population = structuredClone(live.population), positions = (population.data ?? population).positions;
  positions.find(row => row.occupancy?.agent_ref === "agent/anima").label = "Anima\u202e 4\u200b\n(M4)";
  positions.find(row => row.position_ref.endsWith(":factory-guardian")).label = "\u200b\u3164";
  const cast = M.castOf({runRef: "run:x", population, communiques: live.conversation.communiques});
  assert.deepEqual(Object.fromEntries(cast.map(member => [member.agent_ref, member.label])),
    {"agent/anima": "Anima 4 (M4)", "central:position:project:O-I:factory-guardian": "factory-guardian"});
  const arrival = goal => M.mapEvents(readingsFor({goal}), {}).find(op => op.basis.entry === "attempt.start");
  const shown = arrival("Release\u202e notes\u2066 follow\u2069 the\u2028order\u200b");
  assert.deepEqual([shown.bindings.goal.label, shown.bindings.caption.text], ["Release notes follow the order", "Release notes follow the order"]);
  assert.equal(arrival("\u200b\u3164").bindings.goal, undefined, "a goal with nothing visible left is no goal shown");
});

// be2l ruling 4 (DLW build ruling 2026-11-10): where a name shows nothing, the scene says who or what in its own word: the Run for a
// goal, Someone for a person, skill for a skill, subagent for a delegate, on the journal's path and on the harness's.
test("a goal, a person, a skill and a delegate whose name shows nothing are The Run, Someone, skill and subagent (be2l ruling 4)", () => {
  const unseen = "\u{200b}\u{3164}";
  const msg = (cursor, sender) => ({cursor, event: {kind: "agent-message", sender, delivery_ref: `d${cursor}`, request: {submission: {turn: {packet: {text: "go"}}}}}});
  const call = (cursor, id, title, rawInput) => signal(cursor, "tool-call", {payload: {sessionUpdate: "tool_call", toolCallId: id, kind: "other", title, rawInput}});
  const harness = {type: "assistant", session_id: "s", message: {content: [{type: "tool_use", id: "toolu_unseen", name: "Skill", input: {skill: unseen}},
    {type: "tool_use", id: "toolu_task", name: "Task", input: {subagent_type: unseen, description: "Draw the blueprint"}}]}};
  const ops = M.mapEvents(readingsFor({goal: unseen}), {encounter: {[surveySession]: [msg(920, live.runRef), msg(925, `world:x/${unseen}`), call(930, "tc-skill", "Skill", {skill: unseen}), call(931, "tc-task", "Task", {subagent_type: unseen, description: "Survey"})]}, harness: {[surveySession]: [harness]}});
  assert.deepEqual(ops.filter(op => op.basis.entry === "encounter.agent-message").map(op => op.bindings.sender.label), ["The Run", "Someone"]);
  assert.deepEqual(ops.filter(op => op.basis.family === "skill-invocation").map(op => [op.skill, op.bindings.caption.text]), [[unseen, "skill"], [unseen, "skill"]]);
  const delegations = ops.filter(op => op.bindings.recipient?.agent_ref === unseen);
  assert.deepEqual(delegations.map(op => [op.basis.entry, op.bindings.recipient.label]).sort(), [["encounter.delegation", "subagent"], ["harness.delegation", "subagent"]]);
});

// be2l ruling 8: a label made from the tail of a ref, a synthesis's barrier key and a line of progress made from a ref are drawn plain;
// the refs themselves stay as read. Nothing the map hands the scene as a label or as words holds a character of the set.
test("labels made from ref tails, a barrier key and progress lines reach the scene plain; the refs stay as read (be2l ruling 8)", () => {
  const SET = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u;
  const attempts = structuredClone(after);
  for (const attempt of attempts.attempts) attempt.taskRef = attempt.taskRef.replace(/section/, "sec\u{202e}tion\u{200b}");
  const survey = attempts.attempts[2];
  survey.readableReturn.artifactRefs = ["artifact:specimen/sur\u{2066}vey\u{2069}-order"];
  survey.tracking = [{kind: "pro\u{200b}gress", factRef: "fact:1", subjectRef: "central:wiki/ro\u{202e}ot"}];
  survey.observations = [{phase: "observed", receiptRef: "receipt:1"}];
  attempts.syntheses = {"synthesis:1": {synthesisRef: "synthesis:1", barrierKey: "bar\u{202e}rier\u{200b} one", integratedDifference: "Both orders agree"}};
  const custody = structuredClone(live.custody);
  custody.custody.work_ref = "central:wiki:ro\u{202e}ot\u{200b}";
  const ops = [...M.mapEvents(readingsFor({attempts}), {}), ...M.mapEvents({runRef: custodyRun, population: live.population, custody: [custody]}, {})];
  const words = ops.flatMap(op => [op.text, ...Object.values(op.bindings ?? {}).flatMap(binding => [binding.label, binding.text])]).filter(text => typeof text === "string");
  assert.ok(words.length > 20, "the scene was handed its words");
  assert.deepEqual(words.filter(text => SET.test(text)), []);
  const labels = entry => ops.filter(op => op.basis.entry === entry).flatMap(op => Object.values(op.bindings).map(binding => binding.label)).filter(Boolean);
  assert.deepEqual(ops.find(op => op.basis.entry === "attempt.synthesis").bindings.artifact, {kind: "object", subject_ref: "synthesis:1", label: "barrier one"});
  assert.ok(labels("attempt.return").includes("survey-order"), JSON.stringify(labels("attempt.return")));
  assert.ok(labels("custody.in-progress").includes("root"), JSON.stringify(labels("custody.in-progress")));
  assert.ok(ops.some(op => op.basis.entry === "attempt.tracking" && op.text === "progress · root"), JSON.stringify(ops.filter(op => op.basis.entry === "attempt.tracking")));
  assert.ok(ops.some(op => op.bindings?.progressText?.text === "review-section-order · observed" || op.bindings?.progressText?.text === "survey-section-order · observed"));
  assert.ok(ops.some(op => Object.values(op.bindings ?? {}).some(binding => binding.subject_ref === custody.custody.work_ref)), "the ref stays as read");
});

// be2n ruling 4 (DLW build ruling 2026-11-11): the phase of a dispatch and of an observation is the owner's word, drawn in a line of
// progress: it reaches the scene plain, and one that shows nothing reads as the map's own word.
test("a dispatch's and an observation's phase reach the scene plain; one that shows nothing is dispatched or observed (be2n ruling 4)", () => {
  const SET = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u;
  const lines = (dispatched, observed) => {
    const attempts = structuredClone(after);
    const survey = attempts.attempts[2];
    survey.dispatch = {phase: dispatched, receiptRef: "receipt:d"};
    survey.observations = [{phase: observed, receiptRef: "receipt:o"}];
    const ops = M.mapEvents(readingsFor({attempts}), {});
    const sent = ops.filter(op => op.basis.entry === "attempt.dispatch" && op.operation === "act_text" && op.basis.event_ref === survey.attemptRef).map(op => op.text);
    const seen = ops.filter(op => op.basis.entry === "attempt.observation" && op.basis.event_ref === survey.attemptRef).map(op => op.bindings.progressText.text);
    return {sent, seen};
  };
  const laced = lines("hand\u{202e}ed\u{200b} over", "read\u{2066}ing\u{2069} the\u{2028}plan");
  assert.equal(laced.sent.length, 1);
  assert.ok(laced.sent[0].endsWith(" · handed over"), JSON.stringify(laced.sent));
  assert.equal(laced.seen.length, 1);
  assert.ok(laced.seen[0].endsWith(" · reading the plan"), JSON.stringify(laced.seen));
  for (const text of [...laced.sent, ...laced.seen]) assert.ok(!SET.test(text), JSON.stringify(text));
  const blank = lines("\u{200b}\u{3164}", "\u{202e}");
  assert.ok(blank.sent[0].endsWith(" · dispatched"), JSON.stringify(blank.sent));
  assert.ok(blank.seen[0].endsWith(" · observed"), JSON.stringify(blank.seen));
});

// be2o ruling 6 (DLW build ruling 2026-11-11): a verification's outcome and a custody state that is not one of the known ones are the
// owner's words, drawn in a caption: they reach the scene plain. One that shows nothing reads "nothing visible"; one that is exactly
// those words stands in quotes. The value read from the outcome is still read from the word as it came.
test("a verification's outcome and an unknown custody state reach the scene plain (be2o ruling 6)", () => {
  const SET = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u;
  const captions = (outcome, obligations = []) => {
    const attempts = structuredClone(after);
    const survey = attempts.attempts[2];
    survey.verifications = [{verificationRef: "verification:x", outcome, obligations}];
    return M.mapEvents(readingsFor({attempts}), {}).filter(op => op.basis.entry === "attempt.verification" && op.basis.event_ref === survey.attemptRef)
      .map(op => [op.bindings.caption.text, op.bindings.outcome.value]);
  };
  assert.deepEqual(captions("pas\u{202e}sed\u{200b} late", [{}, {}]), [["passed late · 2 checked", 0.5]]);
  assert.deepEqual(captions("passed"), [["passed", 1]]);
  assert.deepEqual(captions("pas\u{200b}sed"), [["passed", 0.5]], "a word that only reads as passed is not the owner's passed: the value is not raised by cleaning");
  assert.deepEqual(captions("failed"), [["failed", 0]]);
  assert.deepEqual(captions("\u{200b}\u{202e}"), [["nothing visible", 0.5]]);
  assert.deepEqual(captions("nothing visible"), [["\"nothing visible\"", 0.5]]);
  const states = (to, reason) => {
    const custody = structuredClone(live.custody);
    custody.custody.transitions.push({revision: 2, to, ...(reason ? {reason} : {}), at_unix_ms: custody.custody.assigned_at_unix_ms + 70000});
    return M.mapEvents({runRef: custodyRun, population: live.population, custody: [custody]}, {}).filter(op => op.basis.entry === "custody.released").map(op => op.bindings.caption.text);
  };
  assert.deepEqual(states("re\u{202e}leased\u{2028}early", "Tenure\u{200b} ended."), ["released early · Tenure ended."]);
  assert.deepEqual(states("released"), ["released"]);
  assert.deepEqual(states("\u{2066}\u{2069}", "why"), ["nothing visible · why"]);
  assert.deepEqual(states("nothing visible"), ["\"nothing visible\""]);
  for (const text of [...captions("pas\u{202e}sed", [{}]).map(pair => pair[0]), ...states("re\u{202e}leased")]) assert.ok(!SET.test(text), JSON.stringify(text));
});
