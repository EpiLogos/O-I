/**
 * U: the typed knowledge relationship authored from two live occurrences
 * targets their EXACT constellation participations. A repeated source keeps
 * its separate participations; ambiguity is refused, never guessed.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/scene-constellation-relation.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {occurrenceParticipation, readSceneRelationRequest, registerProject} from "../src/techne/sceneConstellationRelation.ts";
import {knowledgeEntityRef} from "../src/knowledge/expressionProjection.ts";

const PARTICIPATION = "aikit.constellation-participation/v1";
const member = (ref, participation) => ({ref, [PARTICIPATION]: {participation_ref: participation, role_ref: null, sources: []}});
const frame = {ref: "wiki:frame:one", revision: 3, constellations: [{members: [member("source:a", "participation:first"), member("source:a", "participation:second"), member("source:b", "participation:beta")]}]};

test("one source in two roles resolves to the participation the occurrence discloses", async () => {
  const first = {subject_ref: "source:a", readings: [{ref: "wiki:frame:one", revision: "3", availability: "available"}, {ref: "participation:first", revision: "3", availability: "available"}]};
  const second = {subject_ref: "source:a", readings: [{ref: "participation:second", revision: "3", availability: "available"}]};
  assert.equal(await occurrenceParticipation(frame, {expression_ref: "expression:x", entity_ref: "e:1", subject: first}), "participation:first");
  assert.equal(await occurrenceParticipation(frame, {expression_ref: "expression:x", entity_ref: "e:2", subject: second}), "participation:second");
});

test("a constellation projection's minted occurrence identity selects its exact participation", async () => {
  const subject = {subject_ref: "source:a", readings: [{ref: "source:a", revision: "r1", availability: "available"}]};
  for (const participation of ["participation:first", "participation:second"]) {
    const entity_ref = await knowledgeEntityRef("expression:x", participation);
    assert.equal(await occurrenceParticipation(frame, {expression_ref: "expression:x", entity_ref, subject}), participation);
  }
  await assert.rejects(occurrenceParticipation(frame, {expression_ref: "expression:other", entity_ref: await knowledgeEntityRef("expression:x", "participation:first"), subject}), /several roles/);
});

test("a single participation is used when the occurrence discloses none", async () => {
  assert.equal(await occurrenceParticipation(frame, {expression_ref: "expression:x", entity_ref: "e:9", subject: {subject_ref: "source:b", readings: []}}), "participation:beta");
});

test("ambiguous repeated source and non-members are refused", async () => {
  await assert.rejects(occurrenceParticipation(frame, {expression_ref: "expression:x", entity_ref: "e:9", subject: {subject_ref: "source:a", readings: []}}), /several roles/);
  await assert.rejects(occurrenceParticipation(frame, {expression_ref: "expression:x", entity_ref: "e:9", subject: {subject_ref: "source:z", readings: []}}), /not a member/);
});

test("the request must carry an exact revision, two occurrences and a bounded meaning", () => {
  const valid = {expression_ref: "expression:x", revision: 4, scene_ref: "scene:1", from_entity_ref: "e:1", to_entity_ref: "e:2", relation: " qualifies ", direction: "directed"};
  assert.equal(readSceneRelationRequest(valid).relation, "qualifies");
  assert.throws(() => readSceneRelationRequest({...valid, revision: undefined}), /exact Expression revision/);
  assert.throws(() => readSceneRelationRequest({...valid, to_entity_ref: "e:1"}), /two different members/);
  assert.throws(() => readSceneRelationRequest({...valid, relation: ""}), /relationship meaning/);
  assert.throws(() => readSceneRelationRequest({...valid, relation: "x".repeat(161)}), /relationship meaning/);
  assert.throws(() => readSceneRelationRequest({...valid, direction: "sideways"}), /directed, undirected/);
});

test("the register's own path names its Project; foreign paths are refused", () => {
  assert.equal(registerProject("Work/Notes/ProjectCentral/agents/wiki/wiki.json"), "Notes");
  assert.equal(registerProject("Control/agents/wiki/wiki.json"), undefined);
  assert.throws(() => registerProject("Work/Notes/other.json"), /outside Central/);
});
