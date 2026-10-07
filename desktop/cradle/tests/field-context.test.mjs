// The field's encounter as a prepared-turn contribution, against a model of the owner's prepared-context contract
// (aikit.prepared-context/v1 over the kernel `encounter` op: read / edit add|remove, revision + digest, ≤32 items).
// The model is an in-memory HTTP bridge — it stands in for AIKit, which this test does not run.
//   node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/field-context.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createHash} from "node:crypto";
import {fieldApply, freshEncounter} from "../src/field/model.ts";
import {registerFieldHost, currentFieldContext, fieldOperate, fieldContextReading, fieldContextLines} from "../src/field/fieldHost.ts";
import {fieldItemStatus, fieldItemGeneration, isFieldItem, prepareFieldContext, withdrawFieldContext, fieldContextProvider, setFieldContextKept, fieldSelector, parseFieldSelector} from "../src/context/fieldContext.ts";
import {reviewedContext, registerContextProvider, registerSelectionValidator, announceContext} from "../src/context/nativeContext.ts";
import {observationIsCurrent} from "../src/context/ComponentSelection.ts";
import {buildSituationFrame} from "../src/context/situation.ts";

globalThis.window ??= {dispatchEvent() {}, localStorage: {getItem: () => null, setItem() {}}};
globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

function ownerModel(project, session) {
  const st = {revision: 0, items: [], log: []};
  const digest = () => "blake3:" + createHash("sha256").update(JSON.stringify(st.items.map(i => i.id))).digest("hex");
  const ctx = () => ({schema: "aikit.prepared-context/v1", scope: {project, agent_session: session}, revision: st.revision, digest: digest(), items: st.items});
  const server = createServer((req, res) => {
    let body = ""; req.on("data", c => body += c); req.on("end", () => {
      const op = JSON.parse(body), r = op.request.request;
      st.log.push(r.operation + (r.mutation ? ":" + r.mutation.operation : ""));
      if (r.operation === "edit") {
        if (r.basis !== st.revision) { res.end(JSON.stringify({ok: false, error: "stale basis"})); return; }
        if (r.mutation.operation === "add") { if (st.items.length >= 32) return res.end(JSON.stringify({ok: false, error: "full"})); st.items.push({id: "item-" + (++st.revision) + "-" + st.items.length, selection: r.mutation.selection, expression: {}, canonical_expression: "@sel"}); }
        else if (r.mutation.operation === "remove") { st.items = st.items.filter(i => i.id !== r.mutation.id); st.revision++; }
      }
      res.end(JSON.stringify({ok: true, outcome: {result: "encounter_reading", data: ctx()}}));
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({st, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close()})));
}

function mountField(binding = "b1") {
  let state = freshEncounter("project:example", {ref: "ref:A", revision: "rev-a", span: "M16"});
  const titles = {"ref:A": "Alpha", "ref:B": "Beta", "ref:C": "Gamma"};
  const stop = registerFieldHost({binding_id: binding, world_ref: "project:example", state: () => state, apply: op => { const r = fieldApply(state, op); state = r.state; return r; }, describe: ref => ({title: titles[ref] ?? ref})});
  return {stop, op: o => fieldOperate(o, binding)};
}

test("selector round-trips the binding and generation", () => {
  assert.deepEqual(parseFieldSelector(fieldSelector("b-1", 7)), {binding: "b-1", generation: 7});
  assert.equal(parseFieldSelector("css > selector"), undefined);
});

test("the delivered context names the generation and every ref by role; a later selection leaves the delivered basis alone", async () => {
  const owner = await ownerModel("P", "S"), field = mountField();
  const transport = {kind: "bridge", url: owner.url};
  try {
    field.op({op: "select", ref: "ref:B"});
    field.op({op: "open-preview", target: {ref: "ref:C", revision: "rev-c"}});
    const gen = currentFieldContext().generation;
    const prepared = await prepareFieldContext(transport, "P", "S");
    const item = prepared.items.find(isFieldItem);
    assert.ok(item, "one field item is prepared");
    assert.equal(fieldItemGeneration(item), gen);
    const text = item.selection.text;
    for (const needle of [`field generation ${gen}`, "main: Alpha (ref:A) @ rev-a · at M16", "tangent (page, preview): Gamma (ref:C)", "selected: Beta (ref:B)", "- primary: ref:A", "- tangent: ref:C", "- selected: ref:B"]) assert.ok(text.includes(needle), needle + "\n" + text);
    assert.equal(item.selection.source_ref, "ref:A"); assert.equal(item.selection.source_revision, "rev-a");
    assert.equal(item.selection.anchor.kind, "observation"); assert.equal(item.selection.owner, "Field");

    // the turn is dispatched against the context as read: it reviews the field item as current
    registerSelectionValidator(async it => { if (it.selection.anchor.kind === "observation" && !await observationIsCurrent(it.selection.anchor.key)) throw new Error("observation changed"); });
    const expectation = await reviewedContext(transport, "P", "S");
    assert.ok(expectation.reviewed.includes(item.id), "the delivered expectation names the field item");
    const deliveredDigest = expectation.digest;

    // a NEW selection after delivery: the field moves on; the delivered basis (item, digest) is untouched
    field.op({op: "select", ref: "ref:A"});
    const live = currentFieldContext();
    assert.equal(live.generation, gen + 1);
    const status = fieldItemStatus(item, live);
    assert.equal(status.state, "stale"); assert.equal(status.held, gen); assert.equal(status.live, gen + 1);
    assert.equal(owner.st.items.find(i => i.id === item.id).selection.text, text, "the already-prepared item is not rewritten behind the turn");
    assert.equal(expectation.digest, deliveredDigest);

    // …and the validator now refuses the stale item rather than letting it ride into the next turn
    await assert.rejects(() => reviewedContext(transport, "P", "S"), /observation changed/);

    // the next turn is prepared against the new generation
    const next = await prepareFieldContext(transport, "P", "S");
    const fresh = next.items.filter(isFieldItem);
    assert.equal(fresh.length, 1, "the old field item was replaced, not accumulated");
    assert.equal(fieldItemGeneration(fresh[0]), gen + 1);
    assert.equal(fieldItemStatus(fresh[0], currentFieldContext()).state, "current");
    assert.ok(fresh[0].selection.text.includes("selected: Alpha (ref:A)"));
    const again = await reviewedContext(transport, "P", "S");
    assert.ok(again.reviewed.includes(fresh[0].id));
    // preparing an unchanged generation writes nothing
    const before = owner.st.log.length;
    await prepareFieldContext(transport, "P", "S");
    assert.equal(owner.st.log.length, before + 1, "one read, no edit");
  } finally { field.stop(); owner.close(); }
});

test("kept current: the provider refreshes the field item before a turn reads the context; off, it does not touch it", async () => {
  const owner = await ownerModel("P", "S"), field = mountField("b2");
  const transport = {kind: "bridge", url: owner.url};
  const stopProvider = registerContextProvider(fieldContextProvider);
  try {
    registerSelectionValidator(async it => { if (it.selection.anchor.kind === "observation" && !await observationIsCurrent(it.selection.anchor.key)) throw new Error("observation changed"); });
    setFieldContextKept(false);
    await reviewedContext(transport, "P", "S");
    assert.equal(owner.st.items.length, 0, "present is not prepared: nothing was added");
    globalThis.window.localStorage.getItem = () => "1";
    setFieldContextKept(true);
    field.op({op: "open-preview", target: {ref: "ref:B", revision: "rev-b"}});
    const exp1 = await reviewedContext(transport, "P", "S");
    const g1 = currentFieldContext().generation;
    assert.equal(owner.st.items.filter(isFieldItem).length, 1);
    assert.equal(fieldItemGeneration(owner.st.items.find(isFieldItem)), g1);
    field.op({op: "keep"}); field.op({op: "select", ref: "ref:C"});
    const exp2 = await reviewedContext(transport, "P", "S");
    const g2 = currentFieldContext().generation;
    assert.ok(g2 > g1);
    assert.equal(owner.st.items.filter(isFieldItem).length, 1);
    assert.equal(fieldItemGeneration(owner.st.items.find(isFieldItem)), g2, "each turn carries the generation it was prepared against");
    assert.notDeepEqual(exp1.reviewed, exp2.reviewed);
    await withdrawFieldContext(transport, "P", "S");
    assert.equal(owner.st.items.filter(isFieldItem).length, 0);
  } finally { stopProvider(); field.stop(); owner.close(); setFieldContextKept(false); }
});

test("with no field open there is nothing to prepare, and it says so", async () => {
  const owner = await ownerModel("P", "S");
  try { await assert.rejects(() => prepareFieldContext({kind: "bridge", url: owner.url}, "P", "S"), /No field is open/); } finally { owner.close(); }
  void announceContext; void fieldContextReading; void fieldContextLines;
});

test("the situation frame carries the field's present encounter at its generation (read-only; present is not prepared)", () => {
  const field = mountField("b3");
  try {
    field.op({op: "select", ref: "ref:B"});
    const layout = {root: null, surfaces: {}, closedStack: [], focusedGroupId: null, agencyDepth: "strip"};
    const workspace = {id: "w", name: "W", writing: "", layout, modeLayouts: {}, projectNavigation: {}, recentPlaces: []};
    const frame = buildSituationFrame({workspace, snapshot: {focus: {}, surfaces: {}, buffers: {}}, field: currentFieldContext()});
    assert.equal(frame.field.generation, currentFieldContext().generation);
    assert.equal(frame.field.selected.ref, "ref:B");
    assert.equal(buildSituationFrame({workspace, snapshot: {focus: {}, surfaces: {}, buffers: {}}}).field, undefined);
  } finally { field.stop(); }
});
