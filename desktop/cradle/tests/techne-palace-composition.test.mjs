// Palace durable composition (L5 Technē M5′, QL-MEF #218) — proves the
// corrected contract: a region is planned as a real Scene of the Palace's
// own Expression, holding EXACTLY ONE contained Expression through that
// Scene's own body (`scene_body_set`) — never a marker Entity encoding
// another ref into an id string (that was a second store in disguise, and
// such members were never independently addressable anyway; removed along
// with `sanitiseSuffix`'s inverse). A Portal trigger opens the member
// natively, the guided path is `scene_reorder`, and region removal is an
// explicit act (`scene_remove`) only ever emitted for a name the caller
// names in `removedRegionNames` — never inferred. See
// kernel/tests/palace_composition_native.rs for the native proof that the
// kernel refuses an Entity subject bound to an Expression ref, which is
// exactly why a region holds one member, never several.
import test from "node:test";
import assert from "node:assert/strict";

import * as composition from "../src/techne/m0m5/palace/composition.ts";

const {
  planRegions,
  composeRegions,
  discoverRegions,
  readPalaceRegions,
  regionSceneRef,
  regionTriggerRef,
} = composition;

const ANCHOR = "expression:palace";

function emptySnapshot() {
  return {expression_ref: ANCHOR, revision: 1, scenes: [{scene_ref: `${ANCHOR}:scene:main`, title: "Main", body: null, triggers: []}]};
}

/** Apply a planned Change list to a snapshot, mirroring (a strict subset of)
 * what the kernel's own Document::apply does for the Changes this module
 * emits — enough to prove idempotent replay and readback without a live
 * kernel process. */
function applyChanges(snapshot, changes) {
  const scenes = snapshot.scenes.map(scene => ({...scene, triggers: [...(scene.triggers ?? [])]}));
  const scene = ref => scenes.find(s => s.scene_ref === ref);
  for (const change of changes) {
    if (change.change === "scene_create") scenes.push({scene_ref: change.scene_ref, title: change.title, body: null, triggers: []});
    else if (change.change === "scene_rename") scene(change.scene_ref).title = change.title;
    else if (change.change === "scene_remove") { const index = scenes.findIndex(s => s.scene_ref === change.scene_ref); if (index >= 0) scenes.splice(index, 1); }
    else if (change.change === "scene_body_set") scene(change.scene_ref).body = {carrier: change.body.carrier, subject_ref: change.body.subject_ref};
    else if (change.change === "scene_trigger_attach") scene(change.scene_ref).triggers.push({trigger_ref: change.trigger.trigger_ref, target: change.trigger.target});
    else if (change.change === "scene_trigger_detach") for (const s of scenes) s.triggers = s.triggers.filter(t => t.trigger_ref !== change.trigger_ref);
    else if (change.change === "scene_reorder") scenes.sort((a, b) => change.scene_refs.indexOf(a.scene_ref) - change.scene_refs.indexOf(b.scene_ref));
    else throw new Error(`unhandled change in test harness: ${change.change}`);
  }
  return {expression_ref: snapshot.expression_ref, revision: snapshot.revision + (changes.length > 0 ? 1 : 0), scenes};
}

test("a region plans as a real Scene holding its ONE Expression as the Scene's own body — no marker entities, no shared.values", () => {
  const changes = planRegions(emptySnapshot(), [{name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained work"}}]);
  assert.ok(changes);
  const kinds = changes.map(c => c.change);
  assert.ok(kinds.includes("scene_create"));
  assert.ok(kinds.includes("scene_body_set"), "the member rides as the region Scene's own body");
  assert.ok(kinds.includes("scene_trigger_attach"), "the member is Portal-openable");
  assert.ok(!kinds.includes("entity_add"), "no marker Entity is ever minted");
  assert.ok(!kinds.includes("scene_compose"), "no entity-membership list is ever composed");
  assert.ok(!kinds.includes("subject_bind"), "the kernel refuses an Entity subject bound to an Expression ref — never attempted");
  assert.ok(!kinds.includes("composition_set"), "composition_set/shared.values is the rejected design — never emitted");
  const create = changes.find(c => c.change === "scene_create");
  assert.equal(create.scene_ref, regionSceneRef(ANCHOR, "Study"));
  assert.equal(create.title, "Study");
  const body = changes.find(c => c.change === "scene_body_set");
  assert.equal(body.body.carrier, "expression_ref");
  assert.equal(body.body.subject_ref, "expression:contained");
  const trigger = changes.find(c => c.change === "scene_trigger_attach");
  assert.equal(trigger.trigger.trigger_ref, regionTriggerRef(ANCHOR, "Study"));
  assert.equal(trigger.trigger.target.kind, "portal");
  assert.equal(trigger.trigger.target.subject_ref, "expression:contained");
});

test("the composition.ts module exposes no ref-encoding suffix decoder or marker-entity minting — the API surface itself refuses a second-member path", () => {
  assert.equal(composition.memberEntityRef, undefined, "marker-entity ref minting is gone");
  assert.equal(composition.desanitiseSuffix, undefined, "the reversible-suffix decoder is gone — nothing decodes identity from an id string");
});

test("a fresh region also lands in the guided path order (scene_reorder), other Scenes keep their relative position", () => {
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  const changes = planRegions(emptySnapshot(), [region]);
  const reorder = changes.find(c => c.change === "scene_reorder");
  assert.ok(reorder);
  assert.deepEqual(reorder.scene_refs, [`${ANCHOR}:scene:main`, regionSceneRef(ANCHOR, "Study")]);
});

test("planRegions is null (nothing to compose) once the snapshot already matches", () => {
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  const first = planRegions(emptySnapshot(), [region]);
  const applied = applyChanges(emptySnapshot(), first);
  const second = planRegions(applied, [{...region, scene_ref: regionSceneRef(ANCHOR, "Study")}]);
  assert.equal(second, null, "an already-matching region composes to zero changes");
});

test("replaying the same composition twice is idempotent — no duplicate Scenes or triggers", () => {
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  let snapshot = emptySnapshot();
  const first = planRegions(snapshot, [region]);
  snapshot = applyChanges(snapshot, first);
  assert.equal(snapshot.scenes.length, 2, "one region Scene created, alongside main");
  assert.equal(snapshot.scenes.find(s => s.scene_ref === regionSceneRef(ANCHOR, "Study")).triggers.length, 1);

  const readback = discoverRegions(snapshot);
  const second = planRegions(snapshot, readback); // diff against the LIVE document first
  assert.equal(second, null, "replaying the identical composition emits nothing");

  const third = planRegions(snapshot, [{...region, scene_ref: regionSceneRef(ANCHOR, "Study")}]);
  assert.equal(third, null);
  assert.equal(snapshot.scenes.length, 2, "no duplicate Scene");
  assert.equal(snapshot.scenes.find(s => s.scene_ref === regionSceneRef(ANCHOR, "Study")).triggers.length, 1, "no duplicate trigger");
});

test("readback recovers the region's member from the Scene's own body alone — independently addressable, no decoding", () => {
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  const applied = applyChanges(emptySnapshot(), planRegions(emptySnapshot(), [region]));
  const [readback] = discoverRegions(applied);
  assert.equal(readback.member.expression_ref, "expression:contained");
  assert.equal(readback.name, "Study");
});

test("composeRegions carries the snapshot's own CAS basis, never an invented one", () => {
  const snapshot = {...emptySnapshot(), revision: 7};
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  const proposal = composeRegions(snapshot, [region], [{action_ref: "oi.expression.edit", native_owner: "oi.cradle.kernel", authority: "owner"}]);
  assert.ok(proposal);
  assert.equal(proposal.action_ref, "oi.expression.edit");
  assert.equal(proposal.input.expression_ref, ANCHOR);
  assert.equal(proposal.input.revision, "7");
});

test("composeRegions falls back to oi.expression.edit and returns null for an empty region set", () => {
  const proposal = composeRegions(emptySnapshot(), [], []);
  assert.equal(proposal, null);
});

test("region removal is explicit: omitting a region from the list alone changes nothing; naming it in removedRegionNames emits scene_remove", () => {
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  const snapshot = applyChanges(emptySnapshot(), planRegions(emptySnapshot(), [region]));

  // Merely not naming "Study" again is NOT a removal — no destructive
  // inference from an omission.
  const silentOmission = planRegions(snapshot, []);
  assert.equal(silentOmission, null, "an omitted region is never silently removed");

  // The explicit act: the person removed the region and saved.
  const explicitRemoval = planRegions(snapshot, [], ["Study"]);
  assert.ok(explicitRemoval);
  assert.deepEqual(explicitRemoval, [{change: "scene_remove", scene_ref: regionSceneRef(ANCHOR, "Study")}]);
  const afterRemoval = applyChanges(snapshot, explicitRemoval);
  assert.equal(afterRemoval.scenes.length, 1, "only main remains");
  const [readback] = readPalaceRegions(afterRemoval, ["Study"]);
  assert.equal(readback.scene_ref, null);
  assert.equal(readback.member, null);

  // Removing a region that was never created is a safe no-op (nothing to
  // remove — no crash, no invented Scene).
  assert.equal(planRegions(emptySnapshot(), [], ["Never Existed"]), null);
});

test("an explicit removal wins over a stale kept-region entry for the same name in the same call", () => {
  const region = {name: "Study", scene_ref: null, member: {expression_ref: "expression:contained", title: "Contained"}};
  const snapshot = applyChanges(emptySnapshot(), planRegions(emptySnapshot(), [region]));
  const changes = planRegions(snapshot, [{...region, scene_ref: regionSceneRef(ANCHOR, "Study")}], ["Study"]);
  assert.ok(changes);
  assert.ok(changes.some(c => c.change === "scene_remove" && c.scene_ref === regionSceneRef(ANCHOR, "Study")));
  assert.ok(!changes.some(c => c.change === "scene_body_set"), "a removed region's kept-list entry is never re-composed in the same call");
});
