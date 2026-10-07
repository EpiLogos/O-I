// The field encounter reducer: the site's page-over-page conventions as pure operations.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/field-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {fieldApply, fieldReplay, fieldContextRefs, freshEncounter, parsePersistedField, freshView, TRAIL_LIMIT} from "../src/field/model.ts";

const W = "project:example";
const A = {ref: "ref:A", revision: "sha256:a"}, B = {ref: "ref:B", revision: "sha256:b"}, C = {ref: "ref:C"}, D = {ref: "ref:D"};
const start = () => freshEncounter(W, A);
const apply = (s, ...ops) => fieldReplay(s, ops).state;

test("select marks a ref and never navigates or opens a tab", () => {
  const s0 = start();
  const r = fieldApply(s0, {op: "select", ref: B.ref});
  assert.equal(r.state.selected, B.ref);
  assert.deepEqual(r.state.primary, A);
  assert.equal(r.state.tabs.length, 0);
  assert.equal(r.state.focus, "primary");
  assert.equal(r.state.tangent, undefined);
  assert.equal(r.state.generation, 1);
  // selecting the same ref again is not a change
  const again = fieldApply(r.state, {op: "select", ref: B.ref});
  assert.equal(again.changed, false);
  assert.equal(again.state.generation, 1);
  // clearing the selection is
  assert.equal(fieldApply(r.state, {op: "select", ref: null}).state.selected, undefined);
});

test("open-preview opens an italic preview tab beside the main page, which stays", () => {
  const s = apply(start(), {op: "open-preview", target: B});
  assert.deepEqual(s.primary, A);
  assert.equal(s.tabs.length, 1);
  assert.equal(s.tabs[0].preview, true);
  assert.equal(s.tabs[0].kind, "page");
  assert.equal(s.focus, s.tabs[0].id);
  assert.equal(s.tangent?.ref, B.ref);
  assert.equal(s.tangent?.revision, B.revision);
});

test("the next tangent replaces the standing preview; a kept tab is not replaced", () => {
  let s = apply(start(), {op: "open-preview", target: B});
  const first = s.tabs[0].id;
  s = apply(s, {op: "open-preview", target: C});
  assert.equal(s.tabs.length, 1, "preview slot is reused");
  assert.equal(s.tabs[0].ref, C.ref);
  assert.equal(s.tabs[0].id, first);
  s = apply(s, {op: "keep"});
  assert.equal(s.tabs[0].preview, false);
  s = apply(s, {op: "open-preview", target: D});
  assert.deepEqual(s.tabs.map(t => [t.ref, t.preview]), [[C.ref, false], [D.ref, true]]);
  assert.equal(s.tangent.ref, D.ref);
});

test("a ref already open is focused, not duplicated; the main page too", () => {
  let s = apply(start(), {op: "open-preview", target: B}, {op: "keep"}, {op: "open-preview", target: C});
  assert.equal(s.tabs.length, 2);
  s = apply(s, {op: "open-preview", target: B});
  assert.equal(s.tabs.length, 2);
  assert.equal(s.tangent.ref, B.ref);
  s = apply(s, {op: "open-preview", target: {ref: A.ref, span: "M16"}});
  assert.equal(s.focus, "primary");
  assert.equal(s.primary.span, "M16");
  assert.equal(s.tabs.length, 2);
});

test("pages and Expressions hold separate preview slots", () => {
  let s = apply(start(), {op: "open-preview", target: B}, {op: "open-preview", target: {ref: "expression:x"}, kind: "expression", scene: "s1"});
  assert.equal(s.tabs.length, 2);
  assert.deepEqual(s.tabs.map(t => [t.kind, t.preview]), [["page", true], ["expression", true]]);
  assert.deepEqual(s.scene, {expression_ref: "expression:x", scene_id: "s1"});
  // following a page out of an Expression opens it beside; the Expression stays
  s = apply(s, {op: "open-preview", target: C});
  assert.equal(s.tabs.length, 2);
  assert.equal(s.tabs.find(t => t.kind === "expression").ref, "expression:x");
  assert.equal(s.tabs.find(t => t.kind === "page").ref, C.ref);
});

test("a dirty standing preview is kept, never replaced", () => {
  const base = apply(start(), {op: "open-preview", target: B});
  const dirty = {...base, tabs: base.tabs.map(t => ({...t, dirty: true}))};
  const s = apply(dirty, {op: "open-preview", target: C});
  assert.equal(s.tabs.length, 2);
  assert.equal(s.tabs[0].ref, B.ref);
  assert.equal(s.tabs[0].preview, false, "the dirty tab is kept");
  assert.equal(s.tabs[1].ref, C.ref);
});

test("promote makes a tangent the main page, leaving the old page on the trail", () => {
  let s = apply(start(), {op: "open-preview", target: B}, {op: "select", ref: C.ref});
  const r = fieldApply(s, {op: "promote"});
  assert.equal(r.state.primary.ref, B.ref);
  assert.equal(r.state.primary.revision, B.revision);
  assert.equal(r.state.tabs.length, 0);
  assert.equal(r.state.focus, "primary");
  assert.equal(r.state.selected, undefined);
  assert.deepEqual(r.state.trail, [A]);
  // back returns to the previous main page
  const b = fieldApply(r.state, {op: "back"});
  assert.deepEqual(b.state.primary, A);
  assert.equal(b.state.trail.length, 0);
});

test("promoting an Expression hands it to its own page and does not move the primary", () => {
  const s = apply(start(), {op: "open-preview", target: {ref: "expression:x"}, kind: "expression", scene: "s2"});
  const r = fieldApply(s, {op: "promote"});
  assert.deepEqual(r.state.primary, A);
  assert.deepEqual(r.effects, [{effect: "open-expression-page", ref: "expression:x", scene: "s2"}]);
  assert.equal(r.changed, false);
});

test("back from a tangent returns to the main passage without closing the tangent", () => {
  const s = apply(start(), {op: "open-preview", target: B}, {op: "back"});
  assert.equal(s.focus, "primary");
  assert.equal(s.tangent, undefined);
  assert.equal(s.tabs.length, 1);
  // back from the main page with nothing earlier is refused, not a silent no-op
  const r = fieldApply(start(), {op: "back"});
  assert.equal(r.changed, false);
  assert.equal(r.effects[0].effect, "refused");
});

test("open-main is a navigation: a tangent that becomes the page leaves the strip, the old page goes on the trail", () => {
  let s = apply(start(), {op: "open-preview", target: B}, {op: "keep"}, {op: "open-preview", target: C});
  s = apply(s, {op: "open-main", target: B});
  assert.equal(s.primary.ref, B.ref);
  assert.deepEqual(s.tabs.map(t => t.ref), [C.ref]);
  assert.deepEqual(s.trail.map(t => t.ref), [A.ref]);
  assert.equal(s.focus, "primary");
});

test("the trail is bounded", () => {
  let s = start();
  for (let i = 0; i < TRAIL_LIMIT + 10; i++) s = apply(s, {op: "open-main", target: {ref: "ref:n" + i}});
  assert.equal(s.trail.length, TRAIL_LIMIT);
});

test("close returns to a neighbour or the main page and clears an Expression's scene", () => {
  let s = apply(start(), {op: "open-preview", target: B}, {op: "keep"}, {op: "open-preview", target: {ref: "expression:x"}, kind: "expression", scene: "s1"});
  const x = s.tabs.find(t => t.kind === "expression");
  s = apply(s, {op: "close", tab: x.id});
  assert.equal(s.scene, undefined);
  assert.equal(s.focus, s.tabs[0].id);
  s = apply(s, {op: "close", tab: s.tabs[0].id});
  assert.equal(s.focus, "primary");
  assert.equal(fieldApply(s, {op: "close", tab: "nope"}).effects[0].effect, "refused");
});

test("locate records the reading position of the target in view", () => {
  let s = apply(start(), {op: "locate", span: "M16"});
  assert.equal(s.primary.span, "M16");
  s = apply(s, {op: "open-preview", target: B}, {op: "locate", span: "intro"});
  assert.equal(s.primary.span, "M16");
  assert.equal(s.tabs[0].span, "intro");
});

test("set-emphasis, library is left when something is opened", () => {
  let s = apply(start(), {op: "set-emphasis", emphasis: "library"});
  assert.equal(s.emphasis, "library");
  s = apply(s, {op: "open-preview", target: B});
  assert.equal(s.emphasis, "essay");
  assert.equal(fieldApply(s, {op: "set-emphasis", emphasis: "bogus"}).effects[0].effect, "refused");
});

test("constellation: gather, de-duplicate, leave", () => {
  let s = apply(start(), {op: "enter-constellation", refs: [B.ref, C.ref, B.ref]});
  assert.deepEqual(s.constellation, {refs: [B.ref, C.ref]});
  assert.equal(fieldApply(s, {op: "enter-constellation", refs: []}).effects[0].effect, "refused");
  s = apply(s, {op: "leave-constellation"});
  assert.equal(s.constellation, undefined);
});

test("generation advances once per real change and records no-ops as none", () => {
  let s = start();
  const gens = [];
  for (const op of [
    {op: "select", ref: B.ref}, {op: "select", ref: B.ref}, {op: "open-preview", target: B}, {op: "keep"}, {op: "keep"},
    {op: "back"}, {op: "set-emphasis", emphasis: "essay"},
  ]) { s = fieldApply(s, op).state; gens.push(s.generation); }
  assert.deepEqual(gens, [1, 1, 2, 3, 3, 4, 4]);
});

test("context refs name the primary, the tangent, the selection and the constellation by role", () => {
  const s = apply(start(), {op: "open-preview", target: B}, {op: "select", ref: C.ref}, {op: "enter-constellation", refs: [D.ref]});
  assert.deepEqual(fieldContextRefs(s), [
    {role: "primary", ref: A.ref}, {role: "tangent", ref: B.ref}, {role: "selected", ref: C.ref}, {role: "constellation", ref: D.ref},
  ]);
});

test("persisted state round-trips and anything malformed is dropped, not guessed", () => {
  const s = apply(start(), {op: "open-preview", target: B}, {op: "keep"}, {op: "select", ref: C.ref}, {op: "enter-constellation", refs: [D.ref]}, {op: "locate", span: "M16"});
  const raw = JSON.parse(JSON.stringify({encounter: s, view: {...freshView(), railWidth: 410, open: ["f1"]}}));
  const back = parsePersistedField(raw);
  assert.deepEqual(JSON.parse(JSON.stringify(back.encounter)), JSON.parse(JSON.stringify(s)));
  assert.equal(back.view.railWidth, 410);
  assert.deepEqual(back.view.open, ["f1"]);
  assert.equal(parsePersistedField({encounter: {...raw.encounter, schema: "x"}}), undefined);
  assert.equal(parsePersistedField({encounter: {...raw.encounter, primary: {}}}), undefined);
  assert.equal(parsePersistedField(null), undefined);
  // a focus that names a missing tab falls back to the main page
  const dangling = parsePersistedField({...raw, encounter: {...raw.encounter, focus: "t99"}});
  assert.equal(dangling.encounter.focus, "primary");
  assert.equal(dangling.encounter.tangent, undefined);
});
