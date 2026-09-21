/**
 * The Journey save lane (parent integration, 2026-09-19) — unit proofs:
 *   1. the wiki-grounded payload binds the register's Expression and
 *      discloses the kernel's own edit action when a document stands, and
 *      honestly omits both when none does;
 *   2. a real composeSceneProposal over that payload routes
 *      (resolveActionRoute) and, through the kernel adapter, EXECUTES:
 *      the kernel edit runner receives the scene_create change with the
 *      standing revision, the edited document is adopted, and the receipt
 *      names the applied effect;
 *   3. a revision conflict re-reads the standing generation, retains the
 *      proposal and refuses automatic application onto a different basis;
 *   4. no standing document → the honest refusal, nothing submitted;
 *   5. an undisclosed action → back unrouted, unchanged (the ported law).
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/techne-journey-submit.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {wikiReadingPayload} = await import("../src/techne/wikiReadingProvider.ts");
const {submitSceneComposition, kernelTechneAdapter, JOURNEY_ACTOR} = await import("../src/techne/kernelTechneAdapter.ts");
const {resolveActionRoute} = await import("../src/techne/m0m5/adapter.ts");
const {composeSceneProposal} = await import("../src/techne/m0m5/journey/compose.ts");
const {validateReading} = await import("../src/techne/contract.ts");
const {TECHNE_CONTRACT} = await import("../src/techne/techneReading.ts");

const REGISTER = {key: "central", title: "Central"};
const SUBJECT = {ref: "wiki:central", kind: "wiki-register", title: "Central"};

const readyReading = (overrides = {}) => ({
  state: "ready",
  register: REGISTER,
  wiki: {
    state: "ready",
    spaces: [{object: "space", ref: "central:wiki:root", title: "Central"}],
    nodes: [{object: "node", ref: "central:wiki:alpha", title: "Alpha"}, {object: "node", ref: "central:wiki:beta", title: "Beta"}],
    constellations: [],
  },
  wikiBasis: {path: "Control/agents/wiki/wiki.json", revision: "central.content-fnv1a64/v1:1:test", location: {root: "central", path: "Control/agents/wiki/wiki.json"}},
  relations: {state: "available", focusRef: "central:wiki:root", edges: [
    {relation: "wiki:child", from: "central:wiki:root", to: "central:wiki:alpha", provider: null, authority: null, revision: "r9"},
    {relation: "wiki:child", from: "central:wiki:root", to: "central:wiki:beta", provider: null, authority: null, revision: "r9"},
  ], truncated: false, warnings: []},
  ...overrides,
});

const standingDocument = (revision = 7) => ({
  schema: "oi.expression/v1",
  expression_ref: "expression:techne-m0.central.78478f8e",
  revision,
  title: "Central wiki",
  scenes: [{scene_ref: "expression:techne-m0.central.78478f8e:scene:overview", revision: 1, title: "Overview", entity_refs: []}],
  entities: {}, relations: {}, selection: {scene_ref: "expression:techne-m0.central.78478f8e:scene:overview", entity_ref: null},
  provenance: [], representations: [], refinements: [],
});

const groundSelection = (reading) => ({
  selection_ref: `ql.techne:selection:${reading.subject.subject_ref}:whole`,
  subject_ref: reading.subject.subject_ref,
  reading_ref: reading.reading_ref,
  instrument: "journey",
  focus_refs: [reading.whole.whole_ref],
});

test("the payload binds the standing Expression and discloses the kernel edit action", () => {
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: readyReading(), document: standingDocument()});
  const checked = validateReading(payload);
  assert.ok(checked.valid, `payload drifted: ${checked.errors?.join("; ")}`);
  const bound = payload.expressions?.[0];
  assert.equal(bound?.expression_ref, "expression:techne-m0.central.78478f8e");
  assert.equal(bound?.revision, "7");
  const edit = payload.actions?.find(action => action.action_ref === "oi.expression.edit");
  assert.ok(edit, "the kernel edit action is disclosed");
  assert.equal(edit.native_owner, "oi.cradle.kernel");
  assert.ok(payload.disclosure.instruments.find(entry => entry.instrument === "journey")?.available, "journey disclosed available");
});

test("without a standing document the payload omits Expression and Actions, and journey is refused with its reason", () => {
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: readyReading()});
  const checked = validateReading(payload);
  assert.ok(checked.valid, `payload drifted: ${checked.errors?.join("; ")}`);
  assert.equal(payload.expressions, undefined);
  assert.equal(payload.actions, undefined);
  const journey = payload.disclosure.instruments.find(entry => entry.instrument === "journey");
  assert.equal(journey.available, false);
  assert.match(journey.reason, /not open in this window/);
});

test("a real compose routes and the kernel adapter executes it: scene_create applied, document adopted", async () => {
  const document = standingDocument(7);
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: readyReading(), document});
  const reading = payload;
  const proposal = composeSceneProposal({reading, selection: groundSelection(reading), title: "First Journey"});
  assert.equal(proposal.route.action_ref, "oi.expression.edit");

  // The ported routing law routes the composed proposal (disclosure-gated).
  const routed = resolveActionRoute(reading, proposal.route);
  assert.equal(routed.routed, true, JSON.stringify(routed));
  assert.equal(routed.action_ref, "oi.expression.edit");

  // The applied effect, driven through the executor with injected seams
  // (the adapter's routeAction runs the same executor against the real
  // window state; in this unit the seams stand in for kernel and store).
  const submitted = [];
  let adopted = null;
  const outcome = await submitSceneComposition(
    {kind: "bridge", url: "http://127.0.0.1:1"},
    proposal.input,
    {
      runner: async (_transport, request) => {
        submitted.push(request);
        return {outcome: {result: "expression", data: {document: {...document, revision: 8, scenes: [...document.scenes, {scene_ref: proposal.input.change.scene_ref, revision: 2, title: proposal.input.change.title, entity_refs: []}]}}}};
      },
      readStanding: () => document,
      adopt: (_ref, doc) => { adopted = doc; },
    },
  );
  assert.equal(outcome.ok, true, `executor refused: ${outcome.ok ? "" : outcome.reason}`);
  assert.equal(outcome.revision, 8);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].op, "expression");
  assert.equal(submitted[0].request.operation, "edit");
  assert.equal(submitted[0].request.actor, JOURNEY_ACTOR);
  assert.equal(submitted[0].request.expected_revision, 7);
  assert.deepEqual(submitted[0].request.changes, [proposal.input.change]);
  assert.equal(adopted?.revision, 8);
  assert.ok(adopted.scenes.some(scene => scene.scene_ref === proposal.input.change.scene_ref));
});

test("a revision conflict refreshes the mirror but does not retry a constructive edit", async () => {
  const document = standingDocument(7);
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: readyReading(), document});
  const proposal = composeSceneProposal({reading: payload, selection: groundSelection(payload), title: "Conflict Scene"});
  const calls = [];
  const outcome = await submitSceneComposition(
    {kind: "bridge", url: "http://127.0.0.1:1"},
    proposal.input,
    {
      runner: async (_transport, request) => {
        calls.push(request);
        if (request.request.operation === "inspect") {
          return {outcome: {result: "expression", data: {document: standingDocument(9)}}};
        }
        const expected = request.request.expected_revision;
        if (expected === 7) return {outcome: {result: "expression", data: {state: "revision_conflict", expression_ref: proposal.input.expression_ref, expected_revision: 7, current_revision: 9}}};
        return {outcome: {result: "expression", data: {document: {...standingDocument(9), scenes: [...standingDocument(9).scenes, {scene_ref: proposal.input.change.scene_ref, revision: 2, title: proposal.input.change.title, entity_refs: []}]}}}};
      },
      readStanding: () => document,
      adopt: () => {},
    },
  );
  assert.equal(outcome.ok, false);
  assert.match(outcome.reason,/revision_conflict/);
  assert.equal(calls.length, 2, "edit and inspect only; no silent rebase");
  assert.equal(calls.filter(call=>call.request.operation==="edit").length,1);
});

test("no standing document: the honest refusal, nothing submitted", async () => {
  const submitted = [];
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: readyReading(), document: standingDocument()});
  const proposal = composeSceneProposal({reading: payload, selection: groundSelection(payload), title: "Never Saved"});
  const outcome = await submitSceneComposition(
    {kind: "bridge", url: "http://127.0.0.1:1"},
    proposal.input,
    {runner: async () => { submitted.push(1); throw new Error("must not run"); }, readStanding: () => undefined, adopt: () => {}},
  );
  assert.equal(outcome.ok, false);
  assert.match(outcome.reason, /not open in this window/);
  assert.equal(submitted.length, 0);
});

test("an undisclosed action comes back unrouted, unchanged (the ported law)", () => {
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: readyReading(), document: standingDocument()});
  const route = {
    action_ref: "oi.expression.destroy",
    subject_ref: payload.subject.subject_ref,
    input: {anything: true},
  };
  const resolution = resolveActionRoute(payload, route);
  assert.equal(resolution.routed, false);
  assert.ok(resolution.reason, "the unrouted receipt names its reason");
});

 test("captured source/construction basis is checked before submitting", async()=>{
  let calls=0;
  const input={expression_ref:standingDocument().expression_ref,revision:"6",change:{change:"scene_create",scene_ref:"expression:test:scene:new",title:"New"}};
  const outcome=await submitSceneComposition({kind:"bridge",url:"http://127.0.0.1:1"},input,{readStanding:()=>standingDocument(7),runner:async()=>{calls++;throw new Error("must not submit");}});
  assert.equal(outcome.ok,false);assert.match(outcome.reason,/stale/);assert.equal(calls,0);
 });
