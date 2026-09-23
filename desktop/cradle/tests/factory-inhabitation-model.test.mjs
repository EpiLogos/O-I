// World inhabitation in the Cradle (WORLD-INHABITATION-V1; CROSSWALK §8/§15):
// the pure model the Agents aperture, the Desk owner line, Live → Positions
// and Context → Prepared context render from, plus the joins that must never
// pick silently (session → run, current attempt, current session) and the
// cursor-following whole inspection.
//
// Two inputs: the INSTALLED owners' real readings, captured 2026-09-24 from
// the O-I World (tests/fixtures/inhabitation-installed/: aikit 71a9972c —
// ai-kit #415 — and factory f0f4d7c3; the Factory Guardian occupied at
// generation 2 and holding custody of Factory#261), and the typed fixtures
// that hold the standings the live World does not yet
// (src/contributions/factory/fixtures/inhabitation.ts).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-inhabitation-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const M = await import("../src/contributions/factory/inhabitation/model.ts");
const F = await import("../src/contributions/factory/fixtures/inhabitation.ts");
const P = await import("../src/contributions/factory/desk/inspectionPages.ts");
const R = await import("../src/contributions/factory/desk/runModel.ts");
const S = await import("../src/contributions/factory/desk/deskStore.ts");
const I = await import("../src/contributions/factory/inhabitation/reads.ts");

const installed = name => JSON.parse(readFileSync(new URL(`./fixtures/inhabitation-installed/${name}.json`, import.meta.url), "utf8"));
const envelopeData = document => { assert.equal(document.ok, true, "the installed AIKit answers in its --json envelope"); return document.data; };
const refs = {projectWorld: "project:O-I", runA: "run:A", runB: "run:B", sessionA: "session:A", rootNow: "central:now:control:root:wc", childNow: "central:now:control:root:child"};
const read = data => ({state: "read", data, source: "aikit gateway who"});
const factoryRead = data => ({state: "read", data, source: "factory development inhabitation"});
const titleOf = runRef => runRef === "run:A" ? "Survey then review" : undefined;

// ------------------------------------------------------------------------
// The installed owners' real readings
// ------------------------------------------------------------------------

test("installed: the population reading maps every Position, occupancy exactly as the owner states it", () => {
  const population = envelopeData(installed("gateway-who"));
  assert.equal(population.schema, "aikit.population-reading/v1");
  const aperture = M.populationAperture(read(population));
  assert.equal(aperture.state, "read");
  assert.equal(aperture.world.length + aperture.inherited.length, population.positions.length);
  for (const row of aperture.world) {
    const owner = population.positions.find(position => position.position_ref === row.positionRef);
    assert.equal(row.handle, owner.handle);
    assert.equal(row.name, owner.label);
    assert.equal(row.definition, owner.definition);
    assert.equal(row.occupancy.state, owner.occupancy.state, "occupancy is the owner's state");
    assert.equal(row.occupancy.mark === "●", owner.occupancy.state === "occupied" && owner.occupancy.presence === "active", "drawn present exactly when the owner states an active occupant");
    assert.equal(row.undelivered, owner.communiques.undelivered);
  }
  const guardian = aperture.world.find(row => row.handle === "@factory-guardian");
  const owner = population.positions.find(position => position.handle === "@factory-guardian");
  assert.equal(guardian.work.outcome, owner.current_work.outcome);
  // With no title for its run (no Desk here), the work is named by the
  // owner's work ref as given; the run ref is carried for the Desk to title.
  assert.equal(guardian.work.words, `Working on ${owner.current_work.work_ref.split(/[:/]/).pop()}`);
  assert.equal(guardian.work.runRef ?? null, owner.current_work.run_ref ?? null);
  const titled = M.populationAperture(read(population), undefined, ref => ref === owner.current_work.run_ref ? "Disclose the World inhabitation reads" : undefined).world.find(row => row.handle === "@factory-guardian");
  if (owner.current_work.run_ref) assert.equal(titled.work.words, "Working on Disclose the World inhabitation reads");
  if (owner.occupancy.state === "occupied") assert.equal(guardian.occupancy.agent, owner.occupancy.agent_ref.split(/[:/]/).pop());
});

test("installed: the joined reading's facets are read from their value objects", () => {
  const whoami = envelopeData(installed("whoami-factory-guardian"));
  assert.equal(whoami.schema, "aikit.inhabitation-reading/v1");
  for (const [name] of M.WHOAMI_FACETS) assert.ok(M.facetOf(whoami, name), `facet ${name} is present in the reading`);
  const facet = name => M.facetOf(whoami, name);
  assert.match(M.facetWords("position", facet("position")), /^Software Factory Guardian · @factory-guardian · r1$/);
  const occupancy = facet("occupancy");
  if (occupancy.state === "present") {
    const current = occupancy.value.current;
    assert.equal(M.facetWords("occupancy", occupancy).startsWith(`${occupancy.value.state} · generation ${current.generation_ordinal} · ${current.kind} · ${current.agent_ref.split(/[:/]/).pop()}`), true, "occupancy read from Actuation's value object");
  } else assert.equal(M.facetWords("occupancy", occupancy), `${occupancy.state} — ${occupancy.reason}`);
  // current_work: the value object (Factory's own reading), not the summary
  // text the installed owner mis-renders (`? [in-progress] run -`, #415).
  const work = M.facetWords("current_work", facet("current_work"));
  assert.doesNotMatch(work, /\? \[in-progress\]/);
  assert.match(work, /^one: Factory#261 \(run: [^)]+\) — one in-progress work node github:EpiLogos\/Factory#261/);
  assert.equal(M.facetWords("prepared_context", facet("prepared_context")), `not-attempted — ${facet("prepared_context").reason}`);
  const basis = M.preparedBasis(whoami);
  assert.equal(basis.rootNow, facet("root_now").value.now_ref);
  const child = facet("child_now");
  if (child.state === "present") {
    assert.equal(basis.childNow, child.value.now_ref);
    assert.equal(basis.childNowWords, `child NOW · ${child.value.lifecycle}`);
  } else assert.equal(basis.childNowWords, `${child.state} — ${child.reason}`);
  assert.equal(basis.returnNow, facet("return_destination").value.now_ref);
});

test("installed: the Refocus trace, hop by hop, with the owner's gaps", () => {
  const refocus = envelopeData(installed("refocus-factory-guardian"));
  const chain = M.refocusChain(refocus);
  assert.deepEqual(chain.map(row => row.level), refocus.chain.map(hop => ({operation: "Current operation", "workflow-unit": "Workflow unit", run: "Run", journey: "Journey", intent: "Project intent", ground: "ProjectCentral ground"})[hop.hop]));
  for (const [index, hop] of refocus.chain.entries()) {
    if (hop.gap && !hop.ref) assert.deepEqual([chain[index].state, chain[index].words], ["gap", hop.gap], "a gap is the owner's words");
  }
  // A hop with a ref is named by the owner's detail, as given.
  for (const [index, hop] of refocus.chain.entries()) {
    if (hop.ref && hop.detail) assert.equal(chain[index].state, "present");
  }
  const operation = refocus.chain.find(hop => hop.hop === "operation");
  if (operation?.detail) assert.equal(chain[0].words, operation.detail);
});

test("installed: Factory's inhabitation reading — custody, no occupant yet, names joined by ref", () => {
  const reading = installed("factory-inhabitation");
  assert.equal(reading.schema, "factory.inhabitation-reading/v1");
  const population = envelopeData(installed("gateway-who"));
  const names = M.namesOf(population);
  const run = reading.runs[0];
  const view = M.runInhabitationView(factoryRead(reading), run.run_ref, {names: ref => names[ref], work: () => installed("factory-current-work-factory-guardian")});
  assert.equal(view.state, "read");
  assert.equal(view.lifecycle, run.lifecycle);
  assert.deepEqual(view.positions.map(position => position.positionRef), run.positions.map(position => position.position_ref));
  const guardian = view.positions[0];
  assert.equal(guardian.handle, "@factory-guardian", "the handle is Central's, joined by ref");
  assert.equal(guardian.inCustody, true);
  assert.equal(guardian.custodyWords, "in progress · Factory#261");
  assert.deepEqual(guardian.occupants, [], "no attempt names the Position yet");
  assert.equal(guardian.work.outcome, "one");
  assert.deepEqual(M.runOwners(view), ["@factory-guardian"]);
  assert.deepEqual(view.ambiguities, []);
  assert.deepEqual(M.positionsInCustody(reading), ["central:position:project:O-I:factory-guardian"]);
  // Without the population, the Position is named by its ref's own words —
  // never turned into a handle it may not have.
  const bare = M.runInhabitationView(factoryRead(reading), run.run_ref);
  assert.equal(bare.positions[0].handle, undefined);
  assert.equal(bare.positions[0].name, "factory-guardian");
});

test("installed: Factory's current work — one node, its run named from the candidates", () => {
  const cw = installed("factory-current-work-factory-guardian");
  assert.equal(cw.schema, "factory.current-work/v1");
  assert.equal(cw.current.run_ref, undefined, "the owner's current names no run; its candidates do");
  const title = ref => ref === cw.candidates[0].run_ref ? "Disclose the World inhabitation reads" : undefined;
  assert.equal(M.currentWorkWords(cw, title), `one: Factory#261 (run: Disclose the World inhabitation reads) — ${cw.basis}`);
  assert.equal(M.factoryWorkView(cw, title).words, "Working on Disclose the World inhabitation reads");
});

// ------------------------------------------------------------------------
// Standings the live World does not hold yet (typed fixtures)
// ------------------------------------------------------------------------

test("population aperture: every standing maps to words, and an unknown is never drawn present", () => {
  const aperture = M.populationAperture({...read(F.populationFixture(refs)), warnings: [{message: "the Gateway journal is behind"}]}, undefined, titleOf);
  assert.deepEqual(aperture.onRun, [], "no run selected → no run section");
  const byRef = Object.fromEntries([...aperture.world, ...aperture.inherited].map(row => [row.positionRef, row]));
  assert.equal(byRef[F.POSITION.root].occupancy.mark, "●");
  assert.equal(byRef[F.POSITION.root].work.words, "Working on Survey then review", "a read run is named by its title");
  assert.equal(byRef[F.POSITION.root].undelivered, 2);
  assert.equal(byRef[F.POSITION.factory].occupancy.mark, "◐");
  assert.match(byRef[F.POSITION.factory].work.words, /ambiguous — 2 candidates/);
  assert.equal(byRef[F.POSITION.anima].occupancy.words, "Vacant");
  assert.equal(byRef[F.POSITION.anima].undelivered, null, "an unread Gateway journal is unknown — never a zero");
  assert.equal(byRef[F.POSITION.aikit].occupancy.mark, "?");
  assert.equal(byRef[F.POSITION.aikit].work.words, "Current work unavailable — Factory refused: the developmental state is locked", "the absence's reason travels to the row");
  assert.equal(byRef[F.POSITION.undefinedPosition].definition, "absent");
  assert.equal(byRef[F.POSITION.undefinedPosition].name, "retired-office", "no definition → the ref's own words");
  assert.equal(byRef[F.POSITION.central].occupancy.state, "occupied");
  assert.notEqual(byRef[F.POSITION.central].occupancy.mark, "●");
  assert.match(byRef[F.POSITION.central].occupancy.words, /presence not reported/);
  assert.deepEqual(aperture.inherited.map(row => row.handle), ["@central-guardian"]);
  assert.equal(aperture.absences.length, 2);
  assert.deepEqual(aperture.warnings, ["the Gateway journal is behind"], "envelope warnings are carried as words");
  assert.equal(M.occupancyView({state: "resting"}).mark, "?");
  assert.equal(M.occupancyView(undefined).mark, "?");
});

test("population aperture: the selected run's Positions lead, including ones the population does not list", () => {
  const names = M.namesOf(F.populationFixture(refs));
  const run = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A", {names: ref => names[ref], titleOf, work: ref => ref === F.POSITION.factory ? F.currentWorkFixture(refs) : undefined});
  const aperture = M.populationAperture(read(F.populationFixture(refs)), run, titleOf);
  assert.deepEqual(aperture.onRun.map(row => row.positionRef), [F.POSITION.factory, F.POSITION.unlisted]);
  assert.equal(aperture.onRun[0].basis, "population");
  assert.equal(aperture.onRun[1].basis, "factory");
  assert.equal(aperture.onRun[1].occupancy.mark, "?", "a Position only Factory names has unknown occupancy — not vacant, not present");
  assert.equal(aperture.onRun[1].name, "workcell-guardian");
  assert.ok(!aperture.world.some(row => row.positionRef === F.POSITION.factory), "a run Position is not listed twice");
  const empty = M.populationAperture(read(F.populationFixture(refs)), M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:B"));
  assert.equal(empty.runAbsence, "Factory names no Position on this run.");
  const failed = M.populationAperture(read(F.populationFixture(refs)), M.runInhabitationView({state: "unavailable", reason: "the state is locked", source: "factory development inhabitation"}, "run:A"));
  assert.equal(failed.runAbsence, "Positions on this run couldn't be read — the state is locked");
});

test("population aperture: an unreadable population is a named absence, never an empty roster", () => {
  const aperture = M.populationAperture({state: "unavailable", reason: "aikit gateway who did not answer within 20000 ms", source: "aikit gateway who"});
  assert.equal(aperture.state, "unavailable");
  assert.equal(aperture.world.length + aperture.inherited.length + aperture.onRun.length, 0);
  const run = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A");
  const withRun = M.populationAperture({state: "unavailable", reason: "down", source: "aikit gateway who"}, run);
  assert.equal(withRun.onRun.length, 2);
  assert.ok(withRun.onRun.every(row => row.occupancy.mark === "?"));
  assert.match(withRun.onRun[0].occupancy.words, /who is here couldn't be read/);
});

test("search narrows by words a person reads", () => {
  const aperture = M.populationAperture(read(F.populationFixture(refs)));
  assert.deepEqual(aperture.world.filter(row => M.rowMatches(row, "vacant")).map(row => row.positionRef), [F.POSITION.anima, F.POSITION.undefinedPosition]);
  assert.deepEqual(aperture.world.filter(row => M.rowMatches(row, "idle")).map(row => row.handle), ["@factory-guardian"]);
});

test("a run's inhabitation: custody, occupants by attempt, placement NOW, unplaced attempts, Factory's ambiguity", () => {
  const names = M.namesOf(F.populationFixture(refs));
  const view = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A", {names: ref => names[ref], titleOf, work: ref => ref === F.POSITION.factory ? F.currentWorkFixture(refs) : undefined});
  const [factory, workcell] = view.positions;
  assert.equal(factory.custodyWords, "in progress · Factory#261");
  assert.equal(workcell.custodyWords, "blocked · Workcell#12");
  assert.deepEqual(factory.occupants.map(occupant => [occupant.attemptRef, occupant.current, occupant.legStatus, occupant.agent, occupant.harnessModel, occupant.workcell, occupant.placementNow, occupant.session]),
    [["attempt:review", true, "active", "factory-guardian", "pi · deepseek-v4-pro", "local", refs.childNow, "session:A"]]);
  assert.deepEqual(view.unplaced.map(occupant => occupant.attemptRef), ["attempt:survey"], "an attempt naming no Position is shown as such");
  assert.ok(view.unplaced[0].notes.some(note => note.startsWith("placement NOW: absent — the attempt was admitted without a placement NOW")), "absent facets carry Factory's reason");
  assert.equal(view.ambiguities.length, 1);
  assert.match(view.ambiguities[0], /^@factory-guardian carries more than one current work \(2 candidates\)$/);
  assert.deepEqual(M.runOwners(view), ["@factory-guardian", "workcell-guardian"]);
  assert.equal(M.runInhabitationView(undefined, "run:A"), undefined, "not read is not an empty reading");
  assert.deepEqual(M.runOwners(M.runInhabitationView({state: "unavailable", reason: "timed out", source: "factory development inhabitation"}, "run:A")), []);
  // An owner-stated ambiguous facet on an occupant is an ambiguity too.
  const ambiguous = F.factoryInhabitationFixture(refs);
  ambiguous.runs[0].occupants[0].body.workcell_ref = {state: "ambiguous", reason: "two Workcells claim the body", source: "factory"};
  const withFacet = M.runInhabitationView(factoryRead(ambiguous), "run:A", {names: ref => names[ref]});
  assert.deepEqual(withFacet.ambiguities, ["@factory-guardian: workcell ref: two Workcells claim the body"]);
});

test("Desk card: owner line, ambiguity puts the card in Needs you, owners are searchable", () => {
  const source = {statePath: "/s", projectRef: "project:1", projectKey: "central-project:O-I"};
  const run = {runRef: "run:A", lifecycle: "active", destination: "survey-then-review", runMap: {nodes: {}, edges: []}};
  const plain = R.deskCard(source, run);
  assert.deepEqual(plain.owners, []);
  assert.equal(R.deskColumn(plain), "active");
  const names = M.namesOf(F.populationFixture(refs));
  const view = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A", {names: ref => names[ref], work: ref => ref === F.POSITION.factory ? F.currentWorkFixture(refs) : undefined});
  const card = R.deskCard(source, run, undefined, undefined, {owners: M.runOwners(view), ambiguities: view.ambiguities});
  assert.deepEqual(card.owners, ["@factory-guardian", "workcell-guardian"]);
  assert.equal(R.deskColumn(card), "needs-you", "an owner-stated ambiguity is attention");
  assert.ok(R.cardMatches(card, "workcell-guardian"));
});

test("session → run: one is a join, several is an ambiguity — never the first match", () => {
  const entry = (key, sessions) => ({card: {key}, run: {runRef: key, executions: sessions.map(ref => ({executionRef: `e:${ref}`, agentSessionRef: ref}))}});
  const a = entry("run:A", ["s1", "s2"]), b = entry("run:B", ["s2"]), c = entry("run:C", []);
  S.__setDeskReadingForTest({scopeKey: "root", status: "read", refused: [], runs: {A: a, B: b, C: c}});
  assert.deepEqual(S.runsForSession("s1"), {outcome: "one", entries: [a]});
  const shared = S.runsForSession("s2");
  assert.equal(shared.outcome, "ambiguous");
  assert.deepEqual(shared.entries.map(item => item.run.runRef).sort(), ["run:A", "run:B"]);
  assert.deepEqual(S.runsForSession("s9"), {outcome: "none", entries: []});
  assert.deepEqual(S.runsForSession(undefined), {outcome: "none", entries: []});
  S.__setDeskReadingForTest(undefined);
});

test("the live session is only the current, active attempt's — no fallback to the past", () => {
  const past = {attemptRef: "a1", currentAttempt: false, status: "returned", body: {agentSessionRef: "s-old"}};
  assert.deepEqual(M.currentSessions([past]), {outcome: "none", entries: []});
  const now = {attemptRef: "a2", currentAttempt: true, status: "active", body: {agentSessionRef: "s-now", sessionSpaceRef: "space:1"}};
  assert.deepEqual(M.currentSessions([past, now]), {outcome: "one", entries: [{ref: "s-now", space: "space:1", attemptRef: "a2"}]});
  const other = {attemptRef: "a3", currentAttempt: true, status: "active", body: {agentSessionRef: "s-other"}};
  assert.equal(M.currentSessions([now, other]).outcome, "ambiguous");
  assert.equal(M.currentSessions([{attemptRef: "a4", currentAttempt: true, status: "returned", body: {agentSessionRef: "s-done"}}]).outcome, "none");
  assert.equal(M.currentAttemptOf([past]).outcome, "none", "no current attempt is none, never the last one");
  assert.equal(M.currentAttemptOf([past, now]).entries[0], now);
  assert.equal(M.currentAttemptOf([now, other]).outcome, "ambiguous");
});

test("the whole inspection: cursors followed to completion, merged by identity", async () => {
  const pages = [
    {contract: "factory.workflow-inspection/v1", revision: 4, runRef: "run:A", totalAttempts: 3, totalUnits: 2,
      units: [{workflowUnitRef: "u1"}], legs: {u1: {status: "active"}}, attempts: [{attemptRef: "a1", workflowUnitRef: "u1"}, {attemptRef: "a2", workflowUnitRef: "u1"}], telemetry: [{telemetryRef: "t1"}], nextCursor: {revision: 4, runRef: "run:A", offset: 2}},
    {contract: "factory.workflow-inspection/v1", revision: 4, runRef: "run:A", totalAttempts: 3, totalUnits: 2,
      units: [{workflowUnitRef: "u2"}], legs: {u2: {status: "returned"}}, attempts: [{attemptRef: "a3", workflowUnitRef: "u2"}], telemetry: [{telemetryRef: "t1"}], nextCursor: null},
  ];
  const cursors = [];
  const whole = await P.followInspection(async cursor => { cursors.push(cursor); return pages[cursors.length - 1]; });
  assert.deepEqual(cursors, [undefined, {revision: 4, runRef: "run:A", offset: 2}]);
  assert.equal(whole.pages, 2);
  assert.equal(whole.partial, undefined);
  assert.deepEqual(whole.inspection.attempts.map(a => a.attemptRef), ["a1", "a2", "a3"]);
  assert.deepEqual(Object.keys(whole.inspection.legs).sort(), ["u1", "u2"]);
  assert.deepEqual(whole.inspection.telemetry.map(t => t.telemetryRef), ["t1"]);
  assert.equal("nextCursor" in whole.inspection, false);
});

test("the whole inspection: a refused later page, a spent budget or a short count is partial, in words", async () => {
  let n = 0;
  const page = next => ({attempts: [{attemptRef: `a${n++}`}], nextCursor: next});
  const stale = await P.followInspection(async cursor => { if (cursor) throw new Error("Snapshot or selection changed; reselect the same stable unit/attempt with a fresh cursor"); return page({offset: 1}); });
  assert.match(stale.partial, /Read 1 page of this run's inspection; the next page was refused — Snapshot or selection changed/);
  assert.equal(stale.inspection.attempts.length, 1);
  const endless = await P.followInspection(async () => page({offset: 1}), 3);
  assert.equal(endless.pages, 3);
  assert.match(endless.partial, /first 3 pages .* the owner has more/);
  const short = await P.followInspection(async () => ({attempts: [{attemptRef: "a1"}], totalAttempts: 5, nextCursor: null}));
  assert.match(short.partial, /1 of 5 attempts/);
  await assert.rejects(() => P.followInspection(async () => { throw new Error("Run has no native attempt field"); }), /Run has no native attempt field/);
});

test("boundary normalisation and failure words", () => {
  assert.deepEqual(M.snakeKeys({positionRef: "p", currentWork: {runRef: "run:1"}, "workflow-unit:1AB": {agentSessionRef: "s"}, legs: {"run:X": 1}}),
    {position_ref: "p", current_work: {run_ref: "run:1"}, "workflow-unit:1AB": {agent_session_ref: "s"}, legs: {"run:X": 1}});
  assert.deepEqual(M.ownerReadFailure('{"kind":"timeout","message":"aikit gateway who did not answer within 20000 ms","operation_may_have_run":false}', "aikit gateway who"),
    {state: "unavailable", reason: "aikit gateway who did not answer within 20000 ms", source: "aikit gateway who", kind: "timeout"});
  assert.equal(M.warningWords({code: "x", message: "stale"}), "stale");
});

test("the prepared-context basis over fixtures: chain nested, gaps said, NOW refs from value objects", () => {
  const chain = M.refocusChain(F.refocusFixture(refs));
  assert.deepEqual(chain.map(row => row.level), ["Current operation", "Workflow unit", "Run", "Journey", "Project intent", "ProjectCentral ground"]);
  assert.deepEqual(chain.map(row => row.depth), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([chain[3].state, chain[3].words], ["gap", "no Journey or Commission is named by the current work or its Run"]);
  assert.equal(chain[5].words, "project.json", "a hop with only a ref is named by the ref's own words");
  const basis = M.preparedBasis(F.whoamiFixture(refs));
  assert.equal(basis.rootNow, refs.rootNow);
  assert.equal(basis.childNow, refs.childNow);
  assert.match(M.facetWords("current_work", M.facetOf(F.whoamiFixture(refs), "current_work"), titleOf), /^ambiguous — ambiguous: Factory#261 \(run: Survey then review\) \[in-progress\]; Factory#262 \(run: B\) \[in-progress\]/);
  assert.equal(M.facetWords("authority", M.facetOf(F.whoamiFixture(refs), "authority")), "unavailable — the authority reading timed out");
  assert.equal(M.facetWords("occupancy", M.facetOf(F.whoamiFixture(refs), "occupancy")), "occupied · generation 1 · initial · factory-guardian · idle");
  assert.equal(M.facetWords("peers", undefined), "not reported");
  assert.equal(M.facetWords("peers", {state: "maybe"}), "“maybe” (not a standing this view knows)");
});

test("Factory's current work: none, one, and every candidate of an ambiguity", () => {
  assert.equal(M.currentWorkWords({outcome: "none", considered: 3, basis: "no in-progress custody"}), "none (3 considered) — no in-progress custody");
  assert.equal(M.currentWorkWords(F.currentWorkFixture(refs), titleOf),
    "ambiguous: Factory#261 (run: Survey then review) [in-progress]; Factory#262 (run: B) [in-progress] — two in-progress work nodes from 2 relation(s): 2 custody, 0 running attempt(s)", "every candidate is listed, not the first");
  assert.match(M.currentWorkWords({outcome: "several"}), /not an outcome this view knows/);
});

test("the kernel seam: AIKit reads travel as inhabitation_read; warnings ride with the reading; a failure is a named absence", async () => {
  const bridge = {kind: "bridge", url: "http://kernel-test"};
  const old = globalThis.fetch;
  const seen = [];
  try {
    globalThis.fetch = async (_url, init) => { const op = JSON.parse(init.body); seen.push(op); return {ok: true, json: async () => op.request.kind === "population"
      ? {ok: true, outcome: {result: "inhabitation_reading", data: envelopeData(installed("gateway-who")), warnings: [{message: "journal behind"}]}}
      : {ok: false, error: '{"kind":"owner-refused-or-failed","message":"No Position @x here. Nothing was read. Run aikit gateway who.","operation_may_have_run":false}'}}; };
    const population = await I.readPopulation(bridge, "O-I");
    assert.equal(population.state, "read");
    assert.equal(population.data.positions.length, 9);
    assert.deepEqual(population.warnings, [{message: "journal behind"}]);
    assert.deepEqual(seen[0], {op: "inhabitation_read", request: {kind: "population", project: "O-I"}});
    const whoami = await I.readWhoami(bridge, "@x", "O-I");
    assert.deepEqual(whoami, {state: "unavailable", reason: "No Position @x here. Nothing was read. Run aikit gateway who.", source: "aikit whoami", kind: "owner-refused-or-failed"});
  } finally { globalThis.fetch = old; }
});
