// The field on the shared ExpressionWorld seam, against the REAL kernel (the prebuilt walk bridge on a disposable ground):
// a human field select / tangent and an agent's selection_set / portal_open mean the same thing and read back the same.
//   node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/field-world.test.mjs
// Skips (and says so) without a built walk-bridge.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync, spawn} from "node:child_process";
import {existsSync, mkdirSync, mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {fieldApply, freshEncounter} from "../src/field/model.ts";
import {createWorldSync, planOutbound, planInbound, portalRefOf} from "../src/field/worldSync.ts";
import {viaTransport} from "../src/expression/world.ts";

const bin = process.env.FIELD_BRIDGE_BIN ?? resolve(import.meta.dirname, "../kernel/target/debug/walk-bridge");
const have = existsSync(bin);
const W = "project:Field", R = p => `central:source:project:Field:${p}`;
const PAGES = {[R("README.md")]: "Harbour Notes", [R("notes/alpha.md")]: "Alpha Tide", [R("notes/beta.md")]: "Beta Mooring", [R("notes/deep/gamma.md")]: "Gamma Depth"};
const describe = ref => PAGES[ref] ? {title: PAGES[ref], revision: "rev:" + PAGES[ref][0], owner: "Central", kind: "source", page: true} : ref.startsWith("expression:") ? {title: ref, owner: "Expressions", kind: "expression", page: false} : undefined;

let ground, child, call;
test.before(async () => {
  if (!have) return;
  const root = mkdtempSync(join(tmpdir(), "oi-fworld-")), home = mkdtempSync(join(tmpdir(), "oi-fworld-home-"));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const c = (a, i = {}) => execFileSync(ctrl, ["--root", root, "--json", "action", "run", a, JSON.stringify(i)], {encoding: "utf8"});
  c("central.init"); mkdirSync(join(root, "Work", "Field")); c("projectcentral.init", {project: "Field", project_id: "field-world"});
  const port = 4600 + Math.floor(Math.random() * 150);
  child = spawn(bin, [`127.0.0.1:${port}`], {cwd: root, env: {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: "Field"}, stdio: "ignore"});
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/state`)).ok) break; } catch { /* wait */ } await new Promise(r => setTimeout(r, 250)); }
  call = viaTransport({kind: "bridge", url: `http://127.0.0.1:${port}`});
  ground = {root, home};
});
test.after(() => { child?.kill(); if (ground) { rmSync(ground.root, {recursive: true, force: true}); rmSync(ground.home, {recursive: true, force: true}); } });
const T = (name, fn) => test(name, {skip: have ? false : "no built walk-bridge (set FIELD_BRIDGE_BIN)"}, fn);
const field = binding => { let state = freshEncounter(W, {ref: R("README.md")}); const sync = createWorldSync(call, {binding, actor: `field:${binding}`, describe}); const apply = async (op, origin) => { const prev = state; const r = fieldApply(state, op); state = r.state; await sync.mirror(prev, state, op, origin); return r; }; const pull = async () => { const {ops, adopt} = await sync.inbound(state); for (const op of ops) state = fieldApply(state, op).state; sync.bind(state, adopt); return ops; }; return {sync, apply, pull, get state() { return state; }}; };
const read = () => call({operation: "selection_read"});
const portals = async () => (await call({operation: "portal_inspect"})).portals;

test("planners are pure: select means selection_set only; a tangent means portal_open preview; keep/promote re-place; close closes", () => {
  const c = {binding: "b", actor: "field:b", describe};
  const s0 = freshEncounter(W, {ref: R("README.md")});
  const sel = fieldApply(s0, {op: "select", ref: R("notes/alpha.md")}).state;
  assert.deepEqual(planOutbound(s0, sel, {op: "select", ref: R("notes/alpha.md")}, c, "graph").map(r => r.operation), ["selection_set"]);
  assert.equal(planOutbound(s0, sel, {op: "select", ref: R("notes/alpha.md")}, c, "graph")[0].native_owner, "Central");
  const t = fieldApply(sel, {op: "open-preview", target: {ref: R("notes/beta.md")}}).state;
  const open = planOutbound(sel, t, {op: "open-preview", target: {ref: R("notes/beta.md")}}, c);
  assert.deepEqual(open.map(r => [r.operation, r.placement, r.target_ref, r.surface_kind]), [["portal_open", "preview", R("notes/beta.md"), "field"]]);
  const k = fieldApply(t, {op: "keep"}).state;
  assert.equal(planOutbound(t, k, {op: "keep"}, c)[0].placement, "beside");
  assert.equal(planOutbound(t, k, {op: "keep"}, c)[0].portal_ref, open[0].portal_ref, "re-placing never re-derives identity");
  const p = fieldApply(k, {op: "promote"}).state;
  assert.equal(planOutbound(k, p, {op: "promote"}, c)[0].placement, "full");
  const x = fieldApply(k, {op: "close", tab: k.tabs[0].id}).state;
  assert.equal(planOutbound(k, x, {op: "close", tab: k.tabs[0].id}, c)[0].operation, "portal_close");
  assert.equal(portalRefOf("b", k.tabs[0]), open[0].portal_ref);
  // inbound: a foreign selection of a page is a select (no navigation); a foreign field portal is a tangent; one of another corpus is ignored
  const plan = planInbound(s0, {selection: {subject_ref: R("notes/beta.md"), kind: "source", native_owner: "Central", origin: "agent"}, portals: [{portal_ref: "agent-p", target_ref: R("notes/deep/gamma.md"), surface_id: "s", surface_kind: "field", placement: "preview", title: "G", opened_by: "agent"}, {portal_ref: "other", target_ref: "central:source:project:Else:x.md", surface_id: "s2", surface_kind: "field", placement: "preview", title: "?", opened_by: "agent"}]}, c, new Map());
  assert.deepEqual(plan.ops.map(o => o.op), ["select", "open-preview"]);
  assert.deepEqual(plan.adopt, [["agent-p", R("notes/deep/gamma.md")]]);
});

T("pointer select ≡ selection_set ≡ a second caller's selection_set: the same selection_read", async () => {
  const a = field("fa"), target = R("notes/alpha.md"), rev = describe(target).revision;
  await a.apply({op: "select", ref: target}, "graph");
  const viaField = await read();
  assert.equal(viaField.state, "selected");
  assert.deepEqual(viaField.selection, {subject_ref: target, kind: "source", native_owner: "Central", origin: "graph", revision: rev});
  // the same selection made directly through the kernel seam (what an agent's `oi desktop expression` carries)
  await call({operation: "selection_set", origin: "graph", subject_ref: R("notes/beta.md"), kind: "source", native_owner: "Central", revision: "x"});
  await call({operation: "selection_set", origin: "graph", subject_ref: target, kind: "source", native_owner: "Central", revision: rev});
  assert.deepEqual((await read()).selection, viaField.selection, "direct selection_set reads back identically");
  // …and a second field (a second caller)
  const b = field("fb");
  await call({operation: "selection_set", origin: "graph", subject_ref: R("notes/beta.md"), kind: "source", native_owner: "Central", revision: "x"});
  await b.apply({op: "select", ref: target}, "graph");
  assert.deepEqual((await read()).selection, viaField.selection, "a second caller's select reads back identically");
});

T("an external selection_set moves the field's selected node with NO navigation and no tab", async () => {
  const a = field("fc"), start = a.state;
  await a.pull();                                   // adopts whatever stands, as a mounting field does
  await call({operation: "selection_set", origin: "agent", subject_ref: R("notes/deep/gamma.md"), kind: "source", native_owner: "Central", revision: "g1"});
  const ops = await a.pull();
  assert.deepEqual(ops.map(o => o.op), ["select"]);
  assert.equal(a.state.selected, R("notes/deep/gamma.md"));
  assert.equal(a.state.tabs.length, 0); assert.equal(a.state.focus, "primary"); assert.deepEqual(a.state.primary, start.primary);
  assert.equal((await a.pull()).length, 0, "nothing further to do once it agrees");
  // the person clears the selection here: the kernel has no "clear", and the field must not re-apply the same one
  await a.apply({op: "select", ref: null});
  assert.equal((await a.pull()).length, 0); assert.equal(a.state.selected, undefined);
  // a selection of something that is not a page of this corpus does not move it
  await call({operation: "selection_set", origin: "agent", subject_ref: "central:source:project:Else:z.md", kind: "source", native_owner: "Central"});
  assert.equal((await a.pull()).length, 0);
});

T("tangents are portal records: open-preview → preview, keep → beside, promote → full, close → closed; the same tangent either way", async () => {
  const a = field("fd");
  await a.apply({op: "open-preview", target: {ref: R("notes/alpha.md")}});
  let mine = (await portals()).filter(p => p.portal_ref.startsWith("field-portal:fd:"));
  assert.deepEqual(mine.map(p => [p.placement, p.target_ref, p.surface_kind, p.opened_by]), [["preview", R("notes/alpha.md"), "field", "field:fd"]]);
  await a.apply({op: "open-preview", target: {ref: R("notes/beta.md")}});            // the next tangent replaces the preview
  mine = (await portals()).filter(p => p.portal_ref.startsWith("field-portal:fd:"));
  assert.deepEqual(mine.map(p => p.target_ref), [R("notes/beta.md")], "the replaced preview's portal is closed");
  await a.apply({op: "keep"});
  mine = (await portals()).filter(p => p.portal_ref.startsWith("field-portal:fd:"));
  assert.equal(mine[0].placement, "beside"); assert.equal(mine[0].target_ref, R("notes/beta.md"));
  await a.apply({op: "promote"});
  mine = (await portals()).filter(p => p.portal_ref.startsWith("field-portal:fd:"));
  assert.equal(mine[0].placement, "full", "promote re-places the same portal, canonical ref preserved");
  assert.equal(a.state.primary.ref, R("notes/beta.md"));
  await a.apply({op: "open-main", target: {ref: R("notes/deep/gamma.md")}});
  assert.equal((await portals()).filter(p => p.portal_ref.startsWith("field-portal:fd:")).length, 0, "moving the main page releases the promoted page's portal");
  await a.apply({op: "open-preview", target: {ref: R("notes/alpha.md")}});
  await a.apply({op: "close", tab: a.state.tabs[0].id});
  assert.equal((await portals()).filter(p => p.portal_ref.startsWith("field-portal:fd:")).length, 0, "close → portal_close");
});

T("an agent's portal_open (surface_kind field) opens the same tangent a double-click does; re-placing keeps it; closing closes it", async () => {
  const a = field("fe");
  const open = placement => call({operation: "portal_open", portal_ref: "agent-portal-1", target_ref: R("notes/deep/gamma.md"), surface_kind: "field", surface_id: "agent-surface-1", placement, title: "Gamma", actor: "agent:x"});
  await open("preview");
  await a.pull();
  assert.equal(a.state.tabs.length, 1); assert.deepEqual([a.state.tabs[0].ref, a.state.tabs[0].preview, a.state.tabs[0].kind], [R("notes/deep/gamma.md"), true, "page"]);
  assert.equal(a.state.focus, a.state.tabs[0].id, "it is in view, as a double-click leaves it");
  assert.equal(a.state.primary.ref, R("README.md"), "the main page is untouched");
  await open("beside"); await a.pull();
  assert.equal(a.state.tabs[0].preview, false, "re-placed beside = kept");
  await a.pull(); assert.equal(a.state.tabs.length, 1, "no duplicate on the next read");
  await call({operation: "portal_close", portal_ref: "agent-portal-1", actor: "agent:x"});
  await a.pull();
  assert.equal(a.state.tabs.length, 0, "the agent closed it");
  // closing here an adopted tangent closes the agent's portal too (no loop that reopens it)
  await open("preview"); await a.pull();
  await a.apply({op: "close", tab: a.state.tabs[0].id});
  assert.equal((await portals()).some(p => p.portal_ref === "agent-portal-1"), false);
  await a.pull(); assert.equal(a.state.tabs.length, 0);
});
