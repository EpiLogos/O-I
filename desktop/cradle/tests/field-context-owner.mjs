// The same seam against the REAL native owner: a disposable ground and AIKit home, a real session space and agent
// session, the prebuilt walk bridge fronting the kernel's `encounter` op. No provider turn is run and nothing is sent:
// this proves AIKit accepts, versions and returns the field's prepared item.
//   OI_AIKIT_BIN=$(which aikit) node --experimental-strip-types --import ./tests/ts-register.mjs tests/field-context-owner.mjs
import {execFileSync, spawn} from "node:child_process";
import {chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import assert from "node:assert/strict";
import {fieldApply, freshEncounter} from "../src/field/model.ts";
import {registerFieldHost, currentFieldContext, fieldOperate} from "../src/field/fieldHost.ts";
import {prepareFieldContext, isFieldItem, fieldItemGeneration, fieldItemStatus} from "../src/context/fieldContext.ts";
import {nativeContext} from "../src/context/nativeContext.ts";

globalThis.window ??= {dispatchEvent() {}, localStorage: {getItem: () => null, setItem() {}}};
globalThis.CustomEvent ??= class { constructor(t, i) { this.type = t; this.detail = i?.detail; } };
const aikit = process.env.OI_AIKIT_BIN;
const bridgeBin = process.env.FIELD_BRIDGE_BIN ?? resolve(import.meta.dirname, "../kernel/target/debug/walk-bridge");
if (!aikit || !existsSync(bridgeBin)) { console.log("SKIP — needs OI_AIKIT_BIN and a built walk-bridge"); process.exit(0); }

const root = mkdtempSync(join(tmpdir(), "oi-fctx-")), home = mkdtempSync(join(tmpdir(), "oi-fctx-home-"));
let child;
try {
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const call = (a, i = {}) => execFileSync(ctrl, ["--root", root, "--json", "action", "run", a, JSON.stringify(i)], {encoding: "utf8"});
  call("central.init"); mkdirSync(join(root, "Work", "Field")); call("projectcentral.init", {project: "Field", project_id: "field-ctx"});
  const projectRoot = join(root, "Work", "Field");
  const router = join(root, "oi-owner-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") { const c = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync("oi", args, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`); chmodSync(router, 0o755);
  const env = {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: "Field", AIKIT_HOME: join(root, ".aikit-home"), OI_AIKIT_BIN: aikit, OI_BIN: router};
  const native = (...p) => JSON.parse(execFileSync(aikit, ["--json", "session-space", "-C", projectRoot, ...p], {encoding: "utf8", env}));
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", projectRoot, "project", "bind", "field-ctx", "--directory", projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  assert.ok(bind.ok, JSON.stringify(bind));
  const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
  const space = "session-space/field-ctx", session = "agent-session/field-ctx";
  apply(native("create", space, "--label", "Field context"));
  for (const intent of [{operation: "bind-project-context", binding: native("project-context")}, {operation: "attach-agent-session", attachment: {agent_session: session, purpose: "Field context acceptance", provenance: ["field-context-owner test"]}}]) apply(native("stage", "--space", space, "--intent-json", JSON.stringify(intent)));
  native("encounter-configure", "--provider-json", JSON.stringify({id: "field-ctx-false", label: "never run", argv: ["/usr/bin/false"]}));
  native("encounter-start");
  const port = 4800 + Math.floor(Math.random() * 100);
  child = spawn(bridgeBin, [`127.0.0.1:${port}`], {cwd: root, env, stdio: "ignore"});
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/state`)).ok) break; } catch { /* wait */ } await new Promise(r => setTimeout(r, 250)); }
  const transport = {kind: "bridge", url: `http://127.0.0.1:${port}`};

  let state = freshEncounter("project:Field", {ref: "central:source:project:Field:README.md", revision: "central.content-fnv1a64/v1:1:aa"});
  registerFieldHost({binding_id: "fb1", world_ref: "project:Field", state: () => state, apply: op => { const r = fieldApply(state, op); state = r.state; return r; }});
  fieldOperate({op: "select", ref: "central:source:project:Field:notes/alpha.md"}, "fb1");
  fieldOperate({op: "open-preview", target: {ref: "central:source:project:Field:notes/beta.md", revision: "central.content-fnv1a64/v1:2:bb"}}, "fb1");
  const g1 = currentFieldContext().generation;
  const first = await prepareFieldContext(transport, "Field", session);
  const item = first.items.find(isFieldItem);
  assert.ok(item, "the real owner holds the field item: " + JSON.stringify(first.items.map(i => i.selection.title)));
  assert.equal(fieldItemGeneration(item), g1);
  assert.ok(item.selection.text.includes(`field generation ${g1}`) && item.selection.text.includes("tangent (page, preview)"));
  assert.match(first.digest, /^blake3:/);
  console.log(`PASS — AIKit accepted the field item (revision ${first.revision}, ${item.id}) at generation ${g1}`);

  fieldOperate({op: "select", ref: "central:source:project:Field:README.md"}, "fb1");
  const g2 = currentFieldContext().generation;
  assert.equal(fieldItemStatus(item, currentFieldContext()).state, "stale");
  const second = await prepareFieldContext(transport, "Field", session);
  assert.equal(second.items.filter(isFieldItem).length, 1);
  assert.equal(fieldItemGeneration(second.items.find(isFieldItem)), g2);
  assert.notEqual(second.digest, first.digest); assert.ok(second.revision > first.revision);
  const read = await nativeContext(transport, "Field", session);
  assert.equal(read.digest, second.digest);
  console.log(`PASS — a later selection replaced it at generation ${g2}; digest and revision advanced (${first.revision} → ${second.revision}); the stale item was detectable`);
  console.log("2/2 passed");
} catch (e) { console.error("FAIL —", e?.stack ?? e); process.exitCode = 1; }
finally { child?.kill(); rmSync(root, {recursive: true, force: true}); rmSync(home, {recursive: true, force: true}); }
