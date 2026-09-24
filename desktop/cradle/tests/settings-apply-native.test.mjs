/** Production review/apply against real OI and AIKit in disposable homes.
 * The HTTP envelope forwards native documents; it substitutes no owner.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("native model-default Apply confirms and releases intent without a suite disclosure", {
  skip: process.env.OI_NATIVE_SETTINGS_APPLY !== "1", timeout: 180000,
}, async (t) => {
  const home = mkdtempSync(join(tmpdir(), "oi-settings-apply-"));
  const env = {...process.env, OI_HOME: join(home, "oi"), AIKIT_HOME: join(home, "aikit")};
  delete env.OI_CONFIG_SURFACE_FIXTURES;
  delete env.OI_CATALOG;
  const binary = process.env.OI_BIN;
  assert.ok(binary && env.OI_AIKIT_BIN, "OI_BIN and OI_AIKIT_BIN must name the candidate native executables");
  assert.ok(env.OI_NATIVE_PI_MODEL && env.OI_NATIVE_PI_PROVIDER, "supply an actually observed Pi model and provider");
  const native = (args, input) => JSON.parse(execFileSync(binary, args, {
    env, cwd: home, input: input === undefined ? undefined : JSON.stringify(input),
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 60000,
  }));
  const calls = [];
  let applied;
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const op = JSON.parse(body);
      calls.push(op.op);
      let outcome;
      if (op.op === "config_registry_read") {
        const document = native(["aikit", "config-contribution", "--json"]);
        outcome = {result: "config_registry_reading", reading: {mounts: [{owner_ref: document.owner.owner_ref, document}]}};
      } else if (op.op === "config_diff") {
        outcome = {result: "config_diff_reading", resolutions: native(["config", "diff", "--json"]).resolutions};
      } else if (op.op === "config_resolutions_read") {
        outcome = {result: "config_resolutions", resolutions: native(["config", "resolve", "--request-file", "-", "--json"], op.pairs).resolutions};
      } else if (op.op === "config_desired_hold") {
        native(["config", "hold", op.request.setting_ref, JSON.stringify(op.request.value), op.request.scope.scope_kind, "--json"]);
        outcome = {result: "config_desired_held"};
      } else if (op.op === "config_desired_discard") {
        native(["config", "discard", op.setting_ref, op.scope.scope_kind, "--json"]);
        outcome = {result: "config_desired_discarded"};
      } else if (op.op === "config_plan" || op.op === "config_apply") {
        assert.equal(op.requests.length, 1, "this native regression applies one model-default setting");
        const change = op.requests[0];
        const changeset = native(["config", "set", change.setting_ref, JSON.stringify(change.value), change.scope.scope_kind, "--json"]);
        if (op.op === "config_plan") {
          const planned = native(["config", "plan", "--request-file", "-", "--json"], changeset);
          outcome = {result: "config_planned", plans: planned.plans, errors: []};
        } else {
          applied = native(["config", "apply", "--request-file", "-", "--json"], changeset);
          outcome = {result: "config_applied", changeset: applied.changeset};
        }
      } else throw new Error(`Apply requested unrelated operation ${op.op}`);
      response.writeHead(200, {"content-type": "application/json"});
      response.end(JSON.stringify({ok: true, outcome: {...outcome, receipts: []}}));
    } catch (error) {
      response.writeHead(500, {"content-type": "application/json"});
      response.end(JSON.stringify({ok: false, error: String(error)}));
    }
  });
  try {
    native(["aikit", "project", "bind", "settings-apply-proof", "--directory", home, "--no-default-skill-sets", "--json"]);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    globalThis.__CRADLE_WALK__ = false;
    globalThis.window = {__OI_KERNEL_BRIDGE__: `http://127.0.0.1:${server.address().port}`, sessionStorage: {getItem: () => null}};
    const settings = await import("../src/workspace/settings/settingsData.ts");
    const changes = await import("../src/workspace/settings/changeModel.ts");
    const ref = "ai-kit:models:models.default";
    const scope = {scope_kind: "machine", scope_ref: null};
    const value = {pi: {model_id: env.OI_NATIVE_PI_MODEL, native_provider: env.OI_NATIVE_PI_PROVIDER}};
    await settings.loadRegistry();
    await changes.stageSetting({setting_ref: ref, scope, value});
    const reviewed = await changes.review();
    assert.equal(reviewed.changes.length, 1);
    assert.deepEqual(reviewed.changes[0].place, {kind: "section", id: "harnesses"}, "the real owner model-default review returns to the capability page");
    assert.equal(reviewed.changes[0].rowId, `setting:${ref}`);
    assert.deepEqual(reviewed.refusals, {});
    const started = performance.now();
    const result = await changes.applyReviewed(reviewed);
    t.diagnostic(`Native review/apply confirmation: ${Math.round(performance.now() - started)}ms; operations: ${calls.join(", ")}`);
    assert.equal(result.kind, "applied", JSON.stringify(result));
    assert.equal(result.appliedCount, 1, JSON.stringify(result));
    assert.equal(applied.changeset.status, "verified");
    assert.equal(applied.receipts[0].owner_ref, "ai-kit");
    assert.deepEqual(JSON.parse(readFileSync(join(env.AIKIT_HOME, "state/config/model-defaults.json"), "utf8")).models, value);
    const resolution = settings.settingsSnapshot().resolutions[settings.resolutionKey(ref, scope)];
    assert.deepEqual(resolution.native.effective.value, value, "the owner resolution confirms the saved default");
    const current = native(["config", "show", ref, "machine", "--json"]);
    assert.deepEqual(resolution.desired?.value ?? null, current.desired?.value ?? null, "the cache matches native intent after discard");
    assert.equal(resolution.desired?.source_ref, current.desired?.source_ref, "applied ChangeSet history retains its native identity across read times");
    assert.equal(changes.isStaged(current), false, "the owner retains no unapplied staged intent");
    assert.deepEqual(changes.stagedChanges(settings.settingsSnapshot()), []);
    assert.ok(calls.every(op => op.startsWith("config_")), "config Apply must not request suite/composition/harness disclosure");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(home, {recursive: true, force: true});
    delete globalThis.window;
    delete globalThis.__CRADLE_WALK__;
  }
});
