// World inhabitation in the Cradle (WORLD-INHABITATION-V1; CROSSWALK §8/§15):
// the pure model the Agents aperture, the Desk owner line, Live → Positions
// and Context → Prepared context render from, plus the joins that must never
// pick silently (session → run, current attempt, current session) and the
// cursor-following whole inspection.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-inhabitation-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const M = await import("../src/contributions/factory/inhabitation/model.ts");
const F = await import("../src/contributions/factory/fixtures/inhabitation.ts");
const P = await import("../src/contributions/factory/desk/inspectionPages.ts");
const R = await import("../src/contributions/factory/desk/runModel.ts");
const S = await import("../src/contributions/factory/desk/deskStore.ts");
const I = await import("../src/contributions/factory/inhabitation/reads.ts");

const refs = {projectWorld: "project:O-I", runA: "run:A", runB: "run:B", sessionA: "session:A", rootNow: "central:now:control:root:wc", childNow: "central:now:control:root:child"};
const read = data => ({state: "read", data, source: "aikit gateway who"});
const factoryRead = data => ({state: "read", data, source: "factory development inhabitation"});
const titleOf = runRef => runRef === "run:A" ? "Survey then review" : undefined;

test("population aperture: every standing maps to words, and an unknown is never drawn present", () => {
  const aperture = M.populationAperture(read(F.populationFixture(refs)), undefined, titleOf);
  assert.equal(aperture.state, "read");
  assert.deepEqual(aperture.onRun, [], "no run selected → no run section");
  const byHandle = Object.fromEntries([...aperture.world, ...aperture.inherited].map(row => [row.handle, row]));
  assert.equal(byHandle["@oi"].occupancy.mark, "●");
  assert.equal(byHandle["@oi"].occupancy.words, "Occupied · active");
  assert.equal(byHandle["@oi"].occupancy.agent, "oi-field-guardian");
  assert.equal(byHandle["@oi"].work.words, "Working on Survey then review", "a read run is named by its title");
  assert.equal(byHandle["@oi"].undelivered, 2);
  assert.equal(byHandle["@factory-guardian"].occupancy.mark, "◐");
  assert.equal(byHandle["@factory-guardian"].work.outcome, "ambiguous");
  assert.equal(byHandle["@factory-guardian"].work.attention, true);
  assert.match(byHandle["@factory-guardian"].work.words, /ambiguous — 2 candidates/);
  assert.equal(byHandle["@anima-4"].occupancy.state, "vacant");
  assert.equal(byHandle["@anima-4"].occupancy.mark, "○");
  assert.equal(byHandle["@anima-4"].work.words, "No current work");
  assert.equal(byHandle["@aikit-guardian"].occupancy.mark, "?");
  assert.match(byHandle["@aikit-guardian"].occupancy.words, /unavailable — the occupancy ledger could not be read/);
  assert.match(byHandle["@aikit-guardian"].work.words, /unavailable — custody unreadable/);
  // Occupied with no presence reported: occupied, but never drawn present.
  assert.equal(byHandle["@central-guardian"].occupancy.state, "occupied");
  assert.notEqual(byHandle["@central-guardian"].occupancy.mark, "●");
  assert.match(byHandle["@central-guardian"].occupancy.words, /presence not reported/);
  assert.deepEqual(aperture.inherited.map(row => row.handle), ["@central-guardian"], "inherited root Positions are their own section");
  assert.equal(aperture.world.length, 4);
  assert.equal(aperture.absences.length, 1, "a failed facet is carried as a named absence");
  // An occupancy state the view does not know is not coerced into one it does.
  assert.equal(M.occupancyView({state: "resting"}).mark, "?");
  assert.equal(M.occupancyView(undefined).mark, "?");
});

test("population aperture: the selected run's Positions lead, including ones the population does not list", () => {
  const run = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A", titleOf);
  const aperture = M.populationAperture(read(F.populationFixture(refs)), run, titleOf);
  assert.deepEqual(aperture.onRun.map(row => row.handle), ["@factory-guardian", "@workcell-guardian"]);
  assert.equal(aperture.onRun[0].basis, "population", "a Position the population lists keeps its population row");
  assert.equal(aperture.onRun[1].basis, "factory");
  assert.equal(aperture.onRun[1].occupancy.mark, "?", "a Position only Factory names has unknown occupancy — not vacant, not present");
  assert.ok(!aperture.world.some(row => row.handle === "@factory-guardian"), "a run Position is not listed twice");
  // A run Factory reads with no Positions says so; an unreadable Factory reading names its reason.
  const empty = M.populationAperture(read(F.populationFixture(refs)), M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:B"));
  assert.equal(empty.runAbsence, "Factory names no Position on this run.");
  const failed = M.populationAperture(read(F.populationFixture(refs)), M.runInhabitationView({state: "unavailable", reason: "error: unrecognized subcommand 'inhabitation'", source: "factory development inhabitation"}, "run:A"));
  assert.match(failed.runAbsence, /couldn't be read — error: unrecognized subcommand 'inhabitation'/);
});

test("population aperture: an unreadable population is a named absence, never an empty roster", () => {
  const aperture = M.populationAperture({state: "unavailable", reason: "error: unrecognized subcommand 'who'", source: "aikit gateway who"});
  assert.equal(aperture.state, "unavailable");
  assert.equal(aperture.reason, "error: unrecognized subcommand 'who'");
  assert.equal(aperture.source, "aikit gateway who");
  assert.equal(aperture.world.length + aperture.inherited.length + aperture.onRun.length, 0);
  // …and Factory's run Positions still show, with unknown occupancy.
  const run = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A");
  const withRun = M.populationAperture({state: "unavailable", reason: "down", source: "aikit gateway who"}, run);
  assert.equal(withRun.onRun.length, 2);
  assert.ok(withRun.onRun.every(row => row.occupancy.mark === "?"));
  assert.match(withRun.onRun[0].occupancy.words, /who is here couldn't be read/);
});

test("search narrows by words a person reads", () => {
  const aperture = M.populationAperture(read(F.populationFixture(refs)));
  assert.deepEqual(aperture.world.filter(row => M.rowMatches(row, "vacant")).map(row => row.handle), ["@anima-4"]);
  assert.deepEqual(aperture.world.filter(row => M.rowMatches(row, "factory")).map(row => row.handle), ["@factory-guardian"]);
});

test("a run's inhabitation: custody, occupants, NOW and owner-stated ambiguity", () => {
  const view = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A", titleOf);
  assert.equal(view.state, "read");
  assert.equal(view.rootNow, refs.rootNow);
  assert.equal(view.childNow, refs.childNow);
  const [factory, workcell] = view.positions;
  assert.equal(factory.custodyWords, "in progress");
  assert.equal(workcell.custodyWords, "blocked");
  assert.deepEqual(factory.occupants[0], {relation: "attempt participant", agent: "factory-guardian", session: "session:A", workcell: "local", harnessModel: "pi · deepseek-v4-pro"});
  assert.equal(view.ambiguities.length, 1);
  assert.match(view.ambiguities[0], /@factory-guardian carries more than one current work/);
  assert.deepEqual(M.runOwners(view), ["@factory-guardian", "@workcell-guardian"], "live custody (in progress, blocked) names the owners");
  assert.equal(M.runInhabitationView(undefined, "run:A"), undefined, "not read is not an empty reading");
  const unavailable = M.runInhabitationView({state: "unavailable", reason: "timed out", source: "factory development inhabitation"}, "run:A");
  assert.equal(unavailable.state, "unavailable");
  assert.deepEqual(M.runOwners(unavailable), [], "an unreadable reading names no owner");
  // An owner-stated ambiguous occupant relation is an ambiguity too.
  const occupantAmbiguous = M.runInhabitationView(factoryRead({runs: [{run_ref: "run:X", positions: [{position_ref: "p", handle: "@p", occupants: [{relation: "execution-body", state: "ambiguous", reason: "two open tenures"}]}]}]}), "run:X");
  assert.deepEqual(occupantAmbiguous.ambiguities, ["@p: two open tenures"]);
});

test("Desk card: owner line, ambiguity puts the card in Needs you, owners are searchable", () => {
  const source = {statePath: "/s", projectRef: "project:1", projectKey: "central-project:O-I"};
  const run = {runRef: "run:A", lifecycle: "active", destination: "survey-then-review", runMap: {nodes: {}, edges: []}};
  const plain = R.deskCard(source, run);
  assert.deepEqual(plain.owners, []);
  assert.equal(R.deskColumn(plain), "active");
  const view = M.runInhabitationView(factoryRead(F.factoryInhabitationFixture(refs)), "run:A");
  const card = R.deskCard(source, run, undefined, undefined, {owners: M.runOwners(view), ambiguities: view.ambiguities});
  assert.deepEqual(card.owners, ["@factory-guardian", "@workcell-guardian"]);
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
  assert.deepEqual(M.currentSessions([past]), {outcome: "none", entries: []}, "a past attempt never stands in for now");
  const now = {attemptRef: "a2", currentAttempt: true, status: "active", body: {agentSessionRef: "s-now", sessionSpaceRef: "space:1"}};
  assert.deepEqual(M.currentSessions([past, now]), {outcome: "one", entries: [{ref: "s-now", space: "space:1", attemptRef: "a2"}]});
  const other = {attemptRef: "a3", currentAttempt: true, status: "active", body: {agentSessionRef: "s-other"}};
  assert.equal(M.currentSessions([now, other]).outcome, "ambiguous");
  const detachedCurrent = {attemptRef: "a4", currentAttempt: true, status: "returned", body: {agentSessionRef: "s-done"}};
  assert.equal(M.currentSessions([detachedCurrent]).outcome, "none", "a current attempt that is not active is not carrying the run now");
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
  assert.deepEqual(cursors, [undefined, {revision: 4, runRef: "run:A", offset: 2}], "the owner's cursor is passed back verbatim");
  assert.equal(whole.pages, 2);
  assert.equal(whole.partial, undefined);
  assert.deepEqual(whole.inspection.attempts.map(a => a.attemptRef), ["a1", "a2", "a3"], "attempts beyond the first page are read");
  assert.deepEqual(Object.keys(whole.inspection.legs).sort(), ["u1", "u2"]);
  assert.deepEqual(whole.inspection.telemetry.map(t => t.telemetryRef), ["t1"], "rows are deduplicated by their own refs");
  assert.equal("nextCursor" in whole.inspection, false);
});

test("the whole inspection: a refused later page, a spent budget or a short count is partial, in words", async () => {
  const page = (next, extra = {}) => ({attempts: [{attemptRef: `a${Math.random()}`}], nextCursor: next, ...extra});
  const stale = await P.followInspection(async cursor => { if (cursor) throw new Error("Snapshot or selection changed; reselect the same stable unit/attempt with a fresh cursor"); return page({offset: 1}); });
  assert.match(stale.partial, /Read 1 page of this run's inspection; the next page was refused — Snapshot or selection changed/);
  assert.equal(stale.inspection.attempts.length, 1, "the pages read are kept");
  const endless = await P.followInspection(async () => page({offset: 1}), 3);
  assert.equal(endless.pages, 3);
  assert.match(endless.partial, /first 3 pages .* the owner has more/);
  const short = await P.followInspection(async () => ({attempts: [{attemptRef: "a1"}], totalAttempts: 5, nextCursor: null}));
  assert.match(short.partial, /1 of 5 attempts/);
  await assert.rejects(() => P.followInspection(async () => { throw new Error("Run has no native attempt field"); }), /Run has no native attempt field/, "a first-page refusal is the caller's error, as before");
});

test("boundary normalisation and failure words", () => {
  assert.deepEqual(M.snakeKeys({positionRef: "p", currentWork: {runRef: "run:1"}, "workflow-unit:1AB": {agentSessionRef: "s"}, legs: {"run:X": 1}}),
    {position_ref: "p", current_work: {run_ref: "run:1"}, "workflow-unit:1AB": {agent_session_ref: "s"}, legs: {"run:X": 1}}, "ref keys are never rewritten");
  assert.deepEqual(M.ownerReadFailure('{"kind":"timeout","message":"aikit gateway who did not answer within 20000 ms","operation_may_have_run":false}', "aikit gateway who"),
    {state: "unavailable", reason: "aikit gateway who did not answer within 20000 ms", source: "aikit gateway who", kind: "timeout"});
  assert.deepEqual(M.ownerReadFailure(new Error("Project is outside Central's disclosed ground"), "aikit whoami"),
    {state: "unavailable", reason: "Project is outside Central's disclosed ground", source: "aikit whoami"});
});

test("the prepared-context basis: the Refocus chain nested in order, the joined reading's NOW refs", () => {
  const chain = M.refocusChain(F.refocusFixture(refs));
  assert.deepEqual(chain.map(row => row.level), ["Current operation", "Workflow unit", "Run", "Journey", "Project intent", "ProjectCentral ground"]);
  assert.deepEqual(chain.map(row => row.depth), [0, 1, 2, 3, 4, 5]);
  assert.equal(chain[3].words, "absent — the run names no Journey", "an absent link says so, with its reason");
  assert.deepEqual(M.refocusChain({schema: "aikit.refocus-reading/v1"}), []);
  const basis = M.preparedBasis(F.whoamiFixture(refs));
  assert.equal(basis.preparedContext, "prepared NOW context · revision r7");
  assert.equal(basis.rootNow, refs.rootNow);
  assert.equal(basis.childNow, refs.childNow);
  const bare = M.preparedBasis(F.whoamiFixture({...refs, rootNow: undefined, childNow: undefined}));
  assert.equal(bare.rootNow, undefined);
  assert.equal(bare.rootNowWords, "absent — no Workcell root NOW");
  assert.equal(M.facetWords(M.facetOf(F.whoamiFixture(refs), "authority")), "unavailable — the authority reading timed out");
  assert.equal(M.facetWords(undefined), "not reported");
  assert.equal(M.facetWords({state: "maybe"}), "“maybe” (not a standing this view knows)");
  // Facets under `facets` are read the same way.
  assert.equal(M.facetOf({schema: "aikit.inhabitation-reading/v1", facets: {position: {state: "present", ref: "p"}}}, "position").ref, "p");
});

test("the kernel seam: AIKit reads travel as inhabitation_read and a failure is a named absence", async () => {
  const bridge = {kind: "bridge", url: "http://kernel-test"};
  const old = globalThis.fetch;
  const seen = [];
  try {
    globalThis.fetch = async (_url, init) => { const op = JSON.parse(init.body); seen.push(op); return {ok: true, json: async () => op.request.kind === "population"
      ? {ok: true, outcome: {result: "inhabitation_reading", data: {schema: "aikit.population-reading/v1", positions: [{positionRef: "p", handle: "@p"}]}}}
      : {ok: false, error: '{"kind":"owner-refused-or-failed","message":"error: unrecognized subcommand \'whoami\'","operation_may_have_run":false}'}}; };
    const population = await I.readPopulation(bridge, "O-I");
    assert.equal(population.state, "read");
    assert.equal(population.data.positions[0].position_ref, "p", "a camelCase owner spelling is normalised at the boundary");
    assert.deepEqual(seen[0], {op: "inhabitation_read", request: {kind: "population", project: "O-I"}});
    const whoami = await I.readWhoami(bridge, "central:position:project:O-I:p", "O-I");
    assert.deepEqual(whoami, {state: "unavailable", reason: "error: unrecognized subcommand 'whoami'", source: "aikit whoami", kind: "owner-refused-or-failed"});
    assert.deepEqual(seen[1].request, {kind: "whoami", position: "central:position:project:O-I:p", project: "O-I"});
  } finally { globalThis.fetch = old; }
});

test("Factory's current work: none, one, and every candidate of an ambiguity", () => {
  const titleOf = runRef => runRef === "run:A" ? "Survey then review" : undefined;
  assert.equal(M.currentWorkWords({schema: "factory.current-work/v1", outcome: "none", considered: 3, basis: "no in-progress custody"}), "none of 3 considered (no in-progress custody)");
  assert.equal(M.currentWorkWords({schema: "factory.current-work/v1", outcome: "one", current: {run_ref: "run:A"}}, titleOf), "one — Survey then review");
  assert.equal(M.currentWorkWords({schema: "factory.current-work/v1", outcome: "ambiguous", candidates: [{run_ref: "run:A"}, {work_ref: "workflow-unit:X9"}], basis: "two in-progress custodies"}, titleOf),
    "ambiguous — Survey then review; X9 (two in-progress custodies)", "every candidate is listed, not the first");
  assert.match(M.currentWorkWords({schema: "factory.current-work/v1", outcome: "several"}), /not an outcome this view knows/);
});
