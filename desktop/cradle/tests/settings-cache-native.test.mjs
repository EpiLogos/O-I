/** Native cache regression. Real installed owners supply every document.
 * The HTTP transport forwards native command output; no owner is substituted.
 * Holds use an isolated OI_HOME and are never applied to an owner.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {execFileSync} from "node:child_process";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("native externally discarded hold is removed from the settings resolution cache", {
  skip: process.env.OI_NATIVE_SETTINGS_CACHE !== "1", timeout: 180000,
}, async () => {
  const home = mkdtempSync(join(tmpdir(), "oi-settings-cache-"));
  const env = {...process.env, OI_HOME: home};
  const binary = process.env.OI_BIN;
  assert.ok(binary, "OI_BIN must name the candidate native oi executable");
  const native = (args, input) => JSON.parse(execFileSync(binary, args, {
    env, input: input === undefined ? undefined : JSON.stringify(input),
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 60000,
  }));
  let resolutionReads = 0;
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const op = JSON.parse(body);
      let outcome;
      if (op.op === "config_registry_read") {
        const document = native(["aikit", "config-contribution", "--json"]);
        outcome = {result: "config_registry_reading", reading: {mounts: [{owner_ref: document.owner.owner_ref, document}]}};
      } else if (op.op === "config_diff") {
        outcome = {result: "config_diff_reading", resolutions: native(["config", "diff", "--json"]).resolutions};
      } else if (op.op === "config_resolutions_read") {
        resolutionReads += 1;
        const reading = native(["config", "resolve", "--request-file", "-", "--json"], op.pairs);
        outcome = {result: "config_resolutions", resolutions: reading.resolutions};
      } else throw new Error(`Unexpected operation ${op.op}`);
      response.writeHead(200, {"content-type": "application/json"});
      response.end(JSON.stringify({ok: true, outcome: {...outcome, receipts: []}}));
    } catch (error) {
      response.writeHead(500, {"content-type": "application/json"});
      response.end(JSON.stringify({ok: false, error: String(error)}));
    }
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    globalThis.__CRADLE_WALK__ = false;
    globalThis.window = {__OI_KERNEL_BRIDGE__: `http://127.0.0.1:${server.address().port}`, sessionStorage: {getItem: () => null}};
    const settings = await import("../src/workspace/settings/settingsData.ts");
    const ref = "ai-kit:skills:skills.capabilities";
    const scope = {scope_kind: "machine", scope_ref: null};
    native(["config", "hold", ref, "{}", "machine", "--json"]);
    await settings.loadRegistry();
    const key = settings.resolutionKey(ref, scope);
    assert.equal(settings.settingsSnapshot().resolutionsState.state, "ok");
    assert.ok(settings.settingsSnapshot().resolutions[key]?.desired, "the real held value enters the cache");
    const before = resolutionReads;
    native(["config", "discard", ref, "machine", "--json"]);
    await settings.loadResolutions();
    assert.equal(resolutionReads, before + 1, "a disappeared hold forces a targeted native reread");
    assert.equal(settings.settingsSnapshot().resolutions[key].schema, "oi.config-resolution/v1");
    assert.ok(settings.settingsSnapshot().resolutions[key].desired == null, "the cached hold must not survive the native discard (native None may be absent or null)");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(home, {recursive: true, force: true});
    delete globalThis.window;
    delete globalThis.__CRADLE_WALK__;
  }
});
