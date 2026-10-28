/**
 * Lane-5 T1b: the journey reads the Expression-wide disclosure, and only when it
 * asks. `scope: "expression"` returns every bound Scene of the document on the
 * owner's one reading (no per-Scene facets, so none is misattributed). Without
 * the flag, the reading stays the one Scene's own, exactly as before.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/journey-expression-reading.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {readingScopeOf, wikiExpressionReadingPayload, wikiSceneReadingPayload} = await import("../src/techne/wikiReadingProvider.ts");
const {validateReading} = await import("../src/techne/contract.ts");
const {beats} = await import("../src/techne/m0m5/journey/beats.ts");

const REGISTER = {key: "central", title: "Central"};
const EXPRESSION = "oi.expression:probe";
const SCENES = ["one", "two", "three"].map(name => ({scene_ref: `${EXPRESSION}:scene:${name}`, title: name, entity_refs: []}));
const DOCUMENT = {schema: "oi.expression/v1", expression_ref: EXPRESSION, revision: 7, scenes: SCENES, entities: {}, relations: {}, provenance: []};

const READY = {
  state: "ready",
  register: REGISTER,
  wiki: {state: "ready", spaces: [{object: "space", ref: "central:wiki:root", title: "Central"}],
    nodes: [{object: "node", ref: "central:wiki:battle", title: "The Battle"}], constellations: []},
  wikiBasis: {path: "Control/agents/wiki/wiki.json", revision: "central.content-fnv1a64/v1:1:test", location: {root: "central", path: "Control/agents/wiki/wiki.json"}},
  relations: {state: "available", focusRef: "central:wiki:root", edges: [], truncated: false, warnings: []},
};

test("the reading scope is the Expression only when the request asks for it; the default is the Scene", () => {
  assert.equal(readingScopeOf({expression_ref: EXPRESSION, revision: 7, scene_ref: SCENES[0].scene_ref}), "scene");
  assert.equal(readingScopeOf({expression_ref: EXPRESSION, revision: 7, scene_ref: SCENES[0].scene_ref, scope: "expression"}), "expression");
  assert.equal(readingScopeOf(undefined), "scene");
  assert.equal(readingScopeOf({scope: "scene"}), "scene");
});

test("the Expression-wide payload binds every Scene in document order, validates, and carries no per-Scene facets", () => {
  const payload = wikiExpressionReadingPayload({register: REGISTER, reading: READY, document: DOCUMENT});
  assert.deepEqual(validateReading(payload).errors, []);
  assert.equal(validateReading(payload).valid, true);
  assert.deepEqual(payload.expressions.map(row => row.scene_ref), SCENES.map(scene => scene.scene_ref));
  assert.ok(payload.expressions.every(row => row.expression_ref === EXPRESSION && row.revision === "7"));
  assert.equal(payload.subject.subject_ref, EXPRESSION);
  assert.equal(payload.temporal, undefined, "temporal facets are attributed per Scene, never document-wide");
  assert.equal(payload.spatial, undefined, "spatial facets are attributed per Scene, never document-wide");
  assert.equal(payload.provenance, undefined, "provenance is attributed per Scene, never document-wide");
  const journey = payload.disclosure.instruments.find(row => row.instrument === "journey");
  assert.equal(journey.available, true);
  assert.equal(payload.actions[0].action_ref, "oi.expression.edit");
  // The journey's beat model reads one beat per bound Scene, verbatim.
  const model = beats(payload);
  assert.deepEqual(model.beats.map(beat => beat.scene_ref), SCENES.map(scene => scene.scene_ref));
  assert.equal(model.unavailableReason, undefined);
});

// O-I #761 (manual §17.7 Return: "It sends them to the route that the reading names for new knowledge"): the Expression-wide reading a
// Palace stands on names the register's route for new knowledge — Central's receiving, the wiki's one door — as its governed write.
test("the Expression-wide reading names the register's route for new knowledge: Central's receiving, a governed write", () => {
  const payload = wikiExpressionReadingPayload({register: REGISTER, reading: READY, document: DOCUMENT});
  const governed = payload.actions.filter(action => action.authority === "governed-write");
  assert.deepEqual(governed.map(action => [action.action_ref, action.native_owner]), [["central.receiving.submit", "central"]]);
  assert.match(governed[0].summary, /proposal/);
  assert.equal(payload.snapshot.basis_ref, "central:source:Control/agents/wiki/wiki.json", "the sources the Return is proposed to");
  assert.equal(validateReading(payload).valid, true);
});

test("an Expression with no scenes yields no beats and the honest reason, never a beat", () => {
  const payload = wikiExpressionReadingPayload({register: REGISTER, reading: READY, document: {...DOCUMENT, scenes: []}});
  assert.deepEqual(validateReading(payload).errors, []);
  const model = beats(payload);
  assert.equal(model.beats.length, 0);
  assert.match(model.unavailableReason, /no Expression is bound/);
});

test("the Scene-scoped payload is unchanged: one binding, the requested Scene only", () => {
  const payload = wikiSceneReadingPayload({
    register: REGISTER,
    reading: READY,
    document: DOCUMENT,
    sceneRef: SCENES[1].scene_ref,
    declaredSpatial: {spatial: [], provenance: []},
    declaredTemporal: {temporal: [], provenance: []},
  });
  assert.deepEqual(payload.expressions, [{expression_ref: EXPRESSION, revision: "7", scene_ref: SCENES[1].scene_ref}]);
  assert.equal(payload.subject.subject_ref, SCENES[1].scene_ref);
  assert.equal(payload.actions, undefined, "the Scene reading never discloses the document-wide action list");
});
