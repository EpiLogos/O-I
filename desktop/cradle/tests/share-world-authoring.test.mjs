// Share / Project → World relations (shared-field/expression-projection.mjs
// `oi.world/authored-by`, `oi.world/expresses`): which constellation a
// constructed Expression came from, which Position this Cradle acts for, and
// which hosted World (if any) holds them — over the owners' real shapes: the
// subject bindings constructionProjection writes, the installed
// `aikit whoami --full --json` reading, and the field client's snapshot.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/share-world-authoring.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const W = await import("../src/explore/worldAuthoring.ts");
const {projectExpression, hostedExpressionArgs} = await import("../../../shared-field/expression-projection.mjs");

const FRAME = "wiki:frame:6b0c1f2e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const POSITION = "central:position:project:O-I:anima-4";
const reading = (ref) => ({ref, revision: "1", availability: "available"});

/** A constructed Expression as projectProvidedLocalWhole leaves it: each
 * member's subject binding reads its own subject and the frame. */
function constructed(frames = [FRAME, FRAME]) {
  const ref = "expression:knowledge-construction";
  const member = (name, frame) => ({
    entity_ref: `${ref}:entity:${name}`, revision: 1, title: name,
    subject: {subject_ref: `wiki:node:${name}`, native_owner: "ai-kit", presentation_role: "thing", sources: [reading(`central:source:project:O-I:ProjectCentral/${name}.md`)], readings: [reading(`wiki:node:${name}`), ...(frame ? [reading(frame)] : [])], actions: []},
    parameters: {glyph: {value: name[0], automation: null}, x: {value: 0, automation: null}},
  });
  const entities = Object.fromEntries(frames.map((frame, index) => { const entity = member(`m${index}`, frame); return [entity.entity_ref, entity]; }));
  return {schema: "oi.expression/v1", expression_ref: ref, revision: 3, title: "What grounds O-I?", scenes: [{scene_ref: `${ref}:scene:knowledge`, revision: 1, title: "Knowledge", entity_refs: Object.keys(entities)}], entities, relations: {}, selection: {scene_ref: `${ref}:scene:knowledge`, entity_ref: null}, provenance: [], representations: []};
}

test("the constellation a constructed Expression was projected from is the one frame every member reads", () => {
  assert.equal(W.projectedConstellationRef(constructed()), FRAME);
  assert.equal(W.projectedConstellationRef(constructed([FRAME, "wiki:frame:another"])), undefined, "two frames: none");
  assert.equal(W.projectedConstellationRef(constructed([FRAME, undefined])), undefined, "a member without the frame: none");
  assert.equal(W.projectedConstellationRef({entities: {}}), undefined);
  const sf1 = {entities: {e: {subject: {subject_ref: "central:being:frank", readings: [reading("aikit:reading:private")]}}}};
  assert.equal(W.projectedConstellationRef(sf1), undefined, "a private reading is not a constellation");
});

test("the Cradle acts for a Position only when its own body is proven to hold an occupied one", () => {
  const installed = JSON.parse(readFileSync(new URL("./fixtures/inhabitation-installed/whoami-factory-guardian.json", import.meta.url), "utf8"));
  const data = installed.data ?? installed;
  assert.equal(data.resolved_by, "flag");
  assert.equal(W.actingPositionRef(data), undefined, "a Position named by flag, occupied by another body, is not one this Cradle acts for");
  const occupied = {facets: {occupancy: {state: "present"}}};
  assert.equal(W.actingPositionRef({...data, resolved_by: "env", occupant_generation: "actuation:generation:270c"}), data.position_ref);
  assert.equal(W.actingPositionRef({schema: "aikit.inhabitation-reading/v1", resolved_by: "agent-session", position_ref: POSITION, ...occupied}), POSITION);
  assert.equal(W.actingPositionRef({schema: "aikit.inhabitation-reading/v1", resolved_by: "env", position_ref: POSITION, ...occupied}), undefined, "env without a verified generation");
  assert.equal(W.actingPositionRef({schema: "aikit.inhabitation-reading/v1", resolved_by: "agent-session", position_ref: POSITION, facets: {occupancy: {state: "absent"}}}), undefined, "vacant or refuted");
  assert.equal(W.actingPositionRef({schema: "aikit.inhabitation-reading/v1", resolved_by: "none", ...occupied}), undefined);
  assert.equal(W.actingPositionRef(undefined), undefined);
});

/** A snapshot of the field the World bundle was published into. */
function snapshot() {
  const world = "world:central:project:O-I";
  const field = "oi:field:central:project:O-I";
  const entries = [
    {ref: world, kind: "central-world", world_ref: world, label: "O-I — a ProjectCentral world", aliases: []},
    {ref: `${world}/${POSITION}`, kind: "world-position", world_ref: world, label: "Anima 4", aliases: [POSITION, "@anima-4"], meta: {local_ref: POSITION}},
    {ref: `${world}/${FRAME}`, kind: "constellation", world_ref: world, label: "What grounds O-I?", aliases: [FRAME], meta: {local_ref: FRAME}},
    {ref: "expression:someone-else", kind: "expression", world_ref: "world:desktop:x", label: "x", aliases: []},
  ];
  return {
    entries,
    entry_fields: {[world]: field, [`${world}/${POSITION}`]: field, [`${world}/${FRAME}`]: field, "expression:someone-else": "oi:field:desktop:x"},
    fields: [{schema: "oi.shared-field/v1", field_ref: field, kind: "explore", visibility: "public", title: "O-I — a ProjectCentral world", provenance: [{kind: "human-publication", ref: "participant:central:owner", source_system: "central", revision: "oi.world-sources/v1:0123456789abcdef"}]}],
  };
}

test("the World hosting the authoring refs is found in the snapshot, with its field's own contract", () => {
  const host = W.worldHostFor(snapshot(), {position_ref: POSITION, constellation_ref: FRAME});
  assert.deepEqual({field_ref: host.field_ref, world_ref: host.world_ref, label: host.label, hosts: host.hosts}, {field_ref: "oi:field:central:project:O-I", world_ref: "world:central:project:O-I", label: "O-I — a ProjectCentral world", hosts: {position: true, constellation: true}});
  assert.equal(host.field.title, "O-I — a ProjectCentral world");
  assert.deepEqual(W.worldHostFor(snapshot(), {constellation_ref: FRAME}).hosts, {position: false, constellation: true});
  assert.equal(W.worldHostFor(snapshot(), {position_ref: "central:position:project:O-I:nobody"}), undefined);
  assert.equal(W.worldHostFor(snapshot(), {}), undefined);
  assert.ok(W.entriesWithField(snapshot()).every(entry => typeof entry.field_ref === "string"));
});

test("placed beside its World, the shared Expression carries both World relations; left in its own field, neither", () => {
  const document = constructed();
  const authoring = {position_ref: POSITION, constellation_ref: W.projectedConstellationRef(document)};
  const host = W.worldHostFor(snapshot(), authoring);
  const base = {document, selection: {}, publisher: {identity_ref: "human:frank"}, audience: {visibility: "public"}, projection_ref: "projection:desktop:test", published_at: "2026-09-24T10:00:00.000Z", authoring, field_entries: W.entriesWithField(snapshot())};
  const placed = projectExpression({...base, field_ref: host.field_ref, world_ref: host.world_ref, field: host.field});
  assert.deepEqual(hostedExpressionArgs(placed).putExploreRelations.map(relation => [relation.relation, relation.toRef]), [
    ["oi.world/authored-by", `world:central:project:O-I/${POSITION}`],
    ["oi.world/expresses", `world:central:project:O-I/${FRAME}`],
  ]);
  const apart = projectExpression(base);
  assert.deepEqual(apart.relations, []);
  assert.deepEqual(apart.omissions.world_relations.map(omission => omission.reason), ["hosted in another SharedField; relations never cross a field boundary", "hosted in another SharedField; relations never cross a field boundary"]);
});
