// T-FACTORY-1: the Run's live production is the Run's, not the view's.
// (1) an explicit stop takes effect at a passage boundary, never mid-request,
//     and the pause between passes ends at once;
// (2) an interruption leaves a resumable act: a successor producer over the
//     same act (the kernel's passages) performs exactly the rest, with no
//     occurrence sent twice, and the union equals an uninterrupted follow.
// The IO is the injected recording fake of factory-live-producer.test.mjs
// (its owner fixtures); the kernel's own act operations are not exercised.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-live-lifetime.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
const P = await import("../src/contributions/factory/live/producer.ts");
const E = await import("../src/contributions/factory/live/eventMap.ts");
const live = JSON.parse(readFileSync(new URL("./fixtures/factory-live-events.json", import.meta.url), "utf8"));
const tape = JSON.parse(readFileSync(new URL("./fixtures/tape-journal.json", import.meta.url), "utf8"));
const [, after] = live.attemptReadings;

const materialRoot = new URL("../material/factory-expressions/", import.meta.url);
const curated = readdirSync(materialRoot, {recursive: true}).filter(path => String(path).endsWith(".expression.json")).map(path => {
  const document = JSON.parse(readFileSync(new URL(String(path), materialRoot), "utf8"));
  const reuse = document.reuse;
  return {file_ref: `central:Work/O-I/desktop/cradle/material/expressive-material/${path}`, revision: "seed", title: reuse.title, kind: reuse.kind, roles: reuse.roles ?? [], states: reuse.states ?? {}, gestures: reuse.gestures ?? {}, playback: reuse.playback ?? [], entry_scene_ref: reuse.entry_scene_ref ?? null, associations: reuse.associations ?? {}, expression_ref: document.expression_ref, location: {schema: "central.path-ref/v1", ref: path, root: "/", path}};
});

// The kernel as a recording fake: `recorded` is the act's passage sequence,
// shared by every producer that follows this act (a successor reads it back).
function fakeIO({journals = {}, material = curated, recorded = []} = {}) {
  let opened = recorded.length > 0;
  const sent = [];
  return {
    sent,
    readAttempts: async () => after,
    watch: async () => ({contract: "oi.factory-telemetry-watch/v1", lines: live.telemetryWatch.filter(l => l.type !== "cursor"), cursor: {stateRevision: 21}}),
    readJournal: async (session, afterCursor) => ({events: (journals[session] ?? []).filter(e => e.cursor > afterCursor)}),
    world: async request => {
      sent.push(request);
      const act = () => ({act_ref: request.act_ref, expression_ref: "expression:x", mode: "factory", phase: "running", revision: recorded.length + 1, cast: request.cast ?? [], position: recorded.length, sequence: [...recorded]});
      if (request.operation === "material_list") return {state: "materials", schema: "oi.expression-material-list/v1", register: "Work/O-I/desktop/cradle/material/expressive-material", folders: {}, materials: material, unreadable: [], truncated: false};
      if (request.operation === "act_open") { opened = true; return {state: "act_opened", act: act()}; }
      if (request.operation === "act_inspect") return {state: "act", act: act()};
      if (request.operation === "act_list") return {state: "acts", acts: recorded.length || opened ? [{act_ref: config.actRef, passages: recorded.length}] : [], persistent: true, store_errors: []};
      if (request.event_basis || request.operation === "act_operate") recorded.push({index: recorded.length, kind: request.operation, event_basis: request.event_basis, operation: request.operation_kind, native_ref: request.native_ref});
      return {state: "performed", act: act()};
    },
  };
}
const config = {runRef: live.runRef, goal: "Release notes follow the changelog's order", actRef: P.actRefFor(live.runRef), expressionRef: P.liveExpressionRefFor(live.runRef), actor: "desktop:factory-live", context: {}};
const session = after.attempts.find(a => a.attemptRef === "attempt:specimen-survey-1").disposition.body.agentSessionRef;
const basisOf = request => JSON.stringify(request.event_basis);

test("an uninterrupted follow: the reference sequence every interrupted follow must reach", async () => {
  const recorded = [];
  const io = fakeIO({journals: {[session]: tape.pi}, recorded});
  const producer = new P.LiveProducer(io, config);
  await producer.open();
  await producer.pass();
  assert.ok(recorded.length > 3, "the specimen Run has more than three recorded passages to interrupt");
});

test("a stop mid-pass ends at the next passage boundary; the act keeps what was performed", async () => {
  const recorded = [];
  const io = fakeIO({journals: {[session]: tape.pi}, recorded});
  const base = io.world;
  let producer;
  // Stop once three passages are on the act: the request that recorded the
  // third completes in full; the loop breaks before the fourth.
  io.world = async request => {
    const outcome = await base(request);
    if (request.event_basis && recorded.length === 3) producer.stop();
    return outcome;
  };
  producer = new P.LiveProducer(io, config);
  await producer.open();
  const partial = await producer.pass();
  assert.equal(recorded.length, 3, "no passage was cut mid-request, none started after the stop");
  assert.equal(partial.length, 3, "the pass reports exactly the performed operations");
  assert.equal(producer.following, false);
});

test("an interruption is resumable: a successor performs exactly the rest, never twice", async () => {
  // Reference: one uninterrupted follow of the same Run.
  const referenceRecorded = [];
  const reference = new P.LiveProducer(fakeIO({journals: {[session]: tape.pi}, recorded: referenceRecorded}), config);
  await reference.open();
  await reference.pass();
  const expected = referenceRecorded.map(request => basisOf(request));

  // Interrupted after three passages, then a successor over the same act.
  const recorded = [];
  const first = fakeIO({journals: {[session]: tape.pi}, recorded});
  const base = first.world;
  let producer;
  first.world = async request => {
    const outcome = await base(request);
    if (request.event_basis && recorded.length === 3) producer.stop();
    return outcome;
  };
  producer = new P.LiveProducer(first, config);
  await producer.open();
  await producer.pass();
  assert.equal(recorded.length, 3);

  const successor = new P.LiveProducer(fakeIO({journals: {[session]: tape.pi}, recorded}), config);
  await successor.open();
  assert.ok(successor.state.cursor.performed.length >= 3, "the successor's cursor comes back from the three passages on the act");
  await successor.pass();

  const combined = recorded.map(request => basisOf(request));
  assert.equal(new Set(combined).size, combined.length, "no occurrence is recorded twice across the interruption");
  assert.deepEqual(combined, expected, "interrupted then resumed reaches the same act as an uninterrupted follow");
});

test("stop cuts the pause between passes short; the loop exits and stop() settles", async () => {
  const io = fakeIO({journals: {[session]: tape.pi}, recorded: []});
  const producer = new P.LiveProducer(io, config);
  producer.start();
  const deadline = Date.now() + 5000;
  while (producer.state.lastPassAt === undefined && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(producer.state.lastPassAt !== undefined, "the first pass completed");
  const began = Date.now();
  await producer.stop();
  assert.ok(Date.now() - began < 1000, "the stop did not wait out the inter-pass pause");
  assert.equal(producer.state.status, "stopped");
  assert.equal(producer.following, false);
});

// T-REVIEW-6 (#10): a producer of a Run finished outside the desk stops itself
// at a pass boundary, and only that; a Run still in progress keeps following.
test("a producer stops itself when its own reading shows the Run finished", async () => {
  const recorded = [];
  const io = fakeIO({journals: {[session]: tape.pi}, recorded});
  let reads = 0;
  io.readLifecycle = async () => { reads++; return "finished"; };
  let finished = 0;
  const producer = new P.LiveProducer(io, {...config, onRunFinished: () => { finished++; }});
  producer.start();
  const deadline = Date.now() + 5000;
  while (producer.following && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(producer.following, false, "the producer ended itself without an explicit stop");
  assert.equal(producer.state.status, "stopped");
  assert.equal(finished, 1, "the owner of the producer is told once");
  const atStop = reads;
  assert.ok(recorded.length > 0, "the finishing pass performed its passages before ending");
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(reads, atStop, "no further pass reads the Run after it finished");
});

test("a Run whose reading is still in progress keeps following", async () => {
  const io = fakeIO({journals: {[session]: tape.pi}, recorded: []});
  io.readLifecycle = async () => "active";
  let finished = 0;
  const producer = new P.LiveProducer(io, {...config, onRunFinished: () => { finished++; }});
  producer.start();
  const deadline = Date.now() + 5000;
  while (producer.state.lastPassAt === undefined && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(producer.state.lastPassAt !== undefined, "the first pass completed");
  assert.equal(producer.following, true, "an active Run is followed");
  assert.equal(finished, 0);
  await producer.stop();
});
