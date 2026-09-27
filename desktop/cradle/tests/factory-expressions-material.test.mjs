// Curated Factory Expressions starter material (FX-C4; contract §1): every
// Scene passes the Expressions application's own importer (validateJourney),
// every role in `reuse.roles` is a real role slot in the material (an entity
// or a text layer carrying `role`), states/gestures/playback name real
// Scenes, characters carry ≥3 states and a skill gesture, and the workflow
// Expression is associated with the QL-MEF expression-development workflow.
// (The kernel's own document validation runs in kernel `factory.rs` tests.)
// Run: node --test tests/factory-expressions-material.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {register} from "node:module";
import {readFileSync, readdirSync} from "node:fs";
register("./ts-transpile-hook.mjs", import.meta.url);
const M = await import("../expressions-app/field-studies-journeys/src/model.ts");

const root = new URL("../material/factory-expressions/", import.meta.url);
const files = readdirSync(root, {recursive: true}).map(String).filter(path => path.endsWith(".expression.json"));
const docs = Object.fromEntries(files.map(path => [path, JSON.parse(readFileSync(new URL(path, root), "utf8"))]));

test("the curated set: two characters, the reusable Scenes, the skill gesture, the workflow and generic Expressions", () => {
  for (const path of ["character/anima", "character/aletheia", "gesture/skill-invocation", "scene/arrival", "scene/work-passage", "scene/handoff", "scene/review", "scene/completion", "scene/explanation", "expression/expression-development", "expression/factory-generic"]) {
    assert.ok(docs[`${path}.expression.json`], `missing ${path}`);
  }
});

test("every Scene opens in the Expressions application's own importer", () => {
  for (const [path, doc] of Object.entries(docs)) {
    const journey = {schema: "oi.journey", version: 1, id: "check", name: doc.title.slice(0, 160), description: doc.presentation.description, loop: doc.presentation.loop,
      scenes: doc.scenes.map(scene => scene.presentation.scene), updatedAt: "2026-09-26T00:00:00Z"};
    assert.doesNotThrow(() => M.validateJourney(journey), path);
    for (const scene of doc.scenes) {
      assert.equal(scene.presentation.scene.id, scene.scene_ref, path);
      assert.equal(scene.presentation.scene.name, scene.title, path);
      for (const entity of scene.presentation.scene.entities) assert.ok(scene.entity_refs.includes(entity.id) && doc.entities[entity.id], `${path}: ${entity.id}`);
    }
  }
});

test("reuse: every role is a real slot; states, gestures, entry and playback name real Scenes", () => {
  for (const [path, doc] of Object.entries(docs)) {
    const reuse = doc.reuse;
    assert.equal(reuse.schema, "oi.expression-reuse/v1");
    assert.ok(["character", "scene", "expression", "gesture"].includes(reuse.kind), path);
    const scenes = new Set(doc.scenes.map(scene => scene.scene_ref));
    const entities = doc.scenes.flatMap(scene => scene.presentation.scene.entities);
    const texts = doc.scenes.flatMap(scene => scene.presentation.scene.text);
    for (const slot of reuse.roles) {
      if (slot.entity_ref) assert.ok(entities.some(e => e.id === slot.entity_ref && e.role === slot.role), `${path}: role ${slot.role} has no entity slot`);
      else assert.ok(texts.some(t => t.id === slot.text_id && t.role === slot.role), `${path}: role ${slot.role} has no text slot`);
    }
    for (const ref of [reuse.entry_scene_ref, ...Object.values(reuse.states ?? {}), ...Object.values(reuse.gestures ?? {}).map(g => g.scene_ref), ...(reuse.playback ?? [])]) {
      assert.ok(scenes.has(ref), `${path}: ${ref} is not a Scene of this document`);
    }
  }
});

test("characters: ≥3 saved states, a skill gesture, a preview state; two characters are distinct bodies", () => {
  const characters = Object.entries(docs).filter(([, doc]) => doc.reuse.kind === "character");
  assert.ok(characters.length >= 2);
  for (const [path, doc] of characters) {
    for (const name of ["idle", "working", "speaking"]) assert.ok(doc.reuse.states[name], `${path}: ${name}`);
    assert.ok(doc.reuse.gestures["invoke-skill"], path);
    assert.ok(doc.reuse.states[doc.reuse.preview_state], path);
    const working = doc.scenes.find(scene => scene.scene_ref === doc.reuse.states.working).presentation.scene;
    const self = working.entities.find(e => e.role === "self");
    assert.ok(self.sequence.enabled && self.sequence.steps.length >= 3, `${path}: the working state is a performed sequence`);
    assert.ok(self.sequence.steps.some(s => s.shape === "cymatic") && self.sequence.steps.some(s => s.shape === "yantra"), `${path}: resonance and yantra morphs`);
  }
  const bodyOf = doc => doc.scenes[0].presentation.scene.entities[0];
  const [a, b] = characters.map(([, doc]) => bodyOf(doc));
  assert.notEqual(a.tint, b.tint);
  assert.ok(a.layers?.length || a.source, "compound or sourced body");
  assert.ok(b.source?.kind === "ascii" || b.layers?.length, "compound or sourced body");
});

test("A→B, handoff and review carry their authored movement and resonance", () => {
  const passage = docs["scene/work-passage.expression.json"].scenes[0].presentation.scene;
  assert.ok(passage.automation.some(lane => lane.type === "ramp" && lane.target.endsWith(":x") && lane.min < lane.max));
  const handoff = docs["scene/handoff.expression.json"].scenes[0].presentation.scene;
  assert.deepEqual(handoff.entities.map(e => e.role).sort(), ["artifact", "recipient", "sender"]);
  assert.ok(handoff.text.some(t => t.role === "caption"));
  const review = docs["scene/review.expression.json"].scenes[0].presentation.scene;
  assert.ok(review.entities.some(e => e.shape === "cymatic") && review.resonanceDrive);
});

test("the workflow Expression: associated with expression-development, its playback order and named states", () => {
  const workflow = docs["expression/expression-development.expression.json"].reuse;
  assert.deepEqual(workflow.associations.workflow_keys, ["expression-development"]);
  assert.equal(workflow.playback.length, 6);
  assert.deepEqual(workflow.playback.map(ref => ref.replace(/^.*:scene:/, "")), ["arrival", "work-passage", "skill-invocation", "handoff", "review", "completion"]);
  for (const key of ["arrival", "work-passage", "handoff", "review", "completion", "continuation", "explanation", "skill-invocation"]) assert.ok(workflow.states[key], key);
  assert.deepEqual(docs["expression/factory-generic.expression.json"].reuse.associations.workflow_keys, ["factory:generic"]);
});
