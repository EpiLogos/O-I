// Opt-in native-owner tests. No browser, provider, model, protocol double or
// synthesized owner reply is used. Failed disposable grounds remain evidence.
import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync} from "node:fs";
import {isAbsolute, join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";
import {nativeOwnerCleanup} from "./scenarios/plural-flow.mjs";

const enabled = process.env.OI_NATIVE_CLEANUP_AIKIT_BIN !== undefined;
if (process.env.OI_REQUIRE_NATIVE_CLEANUP === "1") assert.ok(enabled, "actual native AIKit binary is required");
const native = (f, request) => JSON.parse(execFileSync(f.aikit, ["--json", "-C", f.projectRoot, "session-space", "encounter", "--request-json", JSON.stringify(request)], {env: f.env, encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024}));
const start = f => JSON.parse(execFileSync(f.aikit, ["--json", "-C", f.projectRoot, "session-space", "encounter-start"], {env: f.env, encoding: "utf8", timeout: 20000}));
const ownerControl = f => nativeOwnerCleanup({aikit: f.aikit, projectRoot: f.projectRoot, ownerEnv: f.env, directories: f.dirs, evidenceRoot: f.evidence});
function fixture(name) {
  const aikit = process.env.OI_NATIVE_CLEANUP_AIKIT_BIN;
  const evidenceRoot = process.env.OI_NATIVE_CLEANUP_EVIDENCE_DIR;
  assert.ok(aikit && isAbsolute(aikit), "native executable must be an absolute actual owner path");
  assert.ok(evidenceRoot && isAbsolute(evidenceRoot) && existsSync(evidenceRoot), "an existing allocated evidence directory is required");
  assert.equal(createHash("sha256").update(readFileSync(aikit)).digest("hex"), process.env.OI_NATIVE_CLEANUP_AIKIT_SHA256, "native owner executable must match the pinned cut");
  const evidence = mkdtempSync(join(evidenceRoot, `${name}-`));
  const dirs = ["root", "aikit", "oi"].map(s => mkdtempSync(join(tmpdir(), `oi-plural-cleanup-${s}-`)));
  const projectRoot = join(dirs[0], "Work/Flowlab");
  mkdirSync(projectRoot, {recursive: true});
  const env = {...process.env, AIKIT_HOME: dirs[1]};
  delete env.CENTRAL_NATIVE_TOKEN;
  const version = execFileSync(aikit, ["--version"], {encoding: "utf8", timeout: 5000});
  writeFileSync(join(evidence, "provenance.json"), JSON.stringify({aikit, sha256: process.env.OI_NATIVE_CLEANUP_AIKIT_SHA256, version, directories: dirs, noProviderOrModel: true}));
  return {aikit, evidence, dirs, projectRoot, env};
}
function receipts(f) {
  return readdirSync(f.evidence).filter(s => s.startsWith("plural-flow-owner-cleanup-")).map(s => JSON.parse(readFileSync(join(f.evidence, s), "utf8")));
}
async function observedExit(pid) {
  const deadline = Date.now() + 5000;
  while (true) {
    const p = spawnSync("ps", ["-p", String(pid), "-o", "pid=,stat="], {encoding: "utf8", timeout: 2000});
    assert.equal(p.error, undefined);
    if (p.status === 1 && !p.stdout.trim()) return;
    assert.ok(Date.now() < deadline, `actual owner ${pid} did not disappear`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
test("actual native owner ACK and exit precede disposal, and repeated cleanup does not redispatch", {skip: !enabled}, async () => {
  const f = fixture("native-disposal");
  const owner = ownerControl(f);
  owner.starting();
  const opening = start(f);
  owner.started(opening);
  const first = await owner.cleanup();
  const second = await owner.cleanup();
  assert.deepEqual(second, first);
  assert.equal(first.nativeReceipt.ok, true);
  assert.equal(first.nativeReceipt.data.pid, opening.data.pid);
  assert.equal(first.nativeReceipt.data.shutdown, true);
  assert.deepEqual(first.nativeReceipt.data.stopped, [], "empty native owner was used; no model inference is claimed");
  assert.ok(f.dirs.every(p => !existsSync(p)));
  const r = receipts(f);
  assert.deepEqual(r.map(x => x.phase).sort(), ["disposed", "native-quiescence-confirmed"]);
  const beforeDisposal = r.find(x => x.phase === "native-quiescence-confirmed");
  assert.deepEqual(beforeDisposal.deleted, []);
  assert.equal(beforeDisposal.operations.filter(x => x.argv.includes(JSON.stringify({action: "shutdown", expected_pid: opening.data.pid}))).length, 1);
});
test("a replaced actual owner is not stopped by stale cleanup", {skip: !enabled}, async () => {
  const f = fixture("native-replacement");
  const stale = ownerControl(f);
  stale.starting();
  const old = start(f);
  stale.started(old);
  const stopped = native(f, {action: "shutdown", expected_pid: old.data.pid});
  assert.equal(stopped.ok, true);
  assert.equal(stopped.data.shutdown, true);
  await observedExit(old.data.pid);
  const successor = ownerControl(f);
  successor.starting();
  const replacement = start(f);
  successor.started(replacement);
  try {
    assert.notEqual(replacement.data.pid, old.data.pid);
    await assert.rejects(stale.cleanup(), /owner changed/);
    assert.ok(f.dirs.every(existsSync));
    assert.equal(native(f, {action: "health"}).data.pid, replacement.data.pid);
    const refused = receipts(f).find(x => x.phase === "recovery-required");
    assert.equal(refused.ownerPid, old.data.pid);
    assert.ok(!refused.operations.some(x => x.argv.some(arg => arg.includes('"action":"shutdown"'))));
  } finally {
    await successor.cleanup();
  }
});
test("native shutdown does not authorize deleting a replacement directory object", {skip: !enabled}, async () => {
  const f = fixture("native-directory-change");
  const owner = ownerControl(f);
  owner.starting();
  const opening = start(f);
  owner.started(opening);
  const original = `${f.dirs[2]}-retained-original`;
  renameSync(f.dirs[2], original);
  mkdirSync(f.dirs[2]);
  writeFileSync(join(f.dirs[2], "replacement.txt"), "replacement object must survive\n");
  await assert.rejects(owner.cleanup(), /directory object changed/);
  assert.ok(f.dirs.every(existsSync));
  assert.ok(existsSync(original));
  assert.equal(readFileSync(join(f.dirs[2], "replacement.txt"), "utf8"), "replacement object must survive\n");
  const r = receipts(f).find(x => x.phase === "recovery-required");
  assert.equal(r.shutdown.data.pid, opening.data.pid);
  assert.equal(r.shutdown.data.shutdown, true);
  assert.deepEqual(r.deleted, []);
  await observedExit(opening.data.pid);
});
test("an actual startup failure retains primary failure and ground without guessing an owner", {skip: !enabled}, async () => {
  const f = fixture("native-startup-refusal");
  const owner = ownerControl(f);
  // This is an actual filesystem refusal at the native owner's state path.
  writeFileSync(join(f.dirs[1], "state"), "not a directory\n");
  owner.starting();
  let primary;
  try { start(f); } catch (error) { primary = error; }
  assert.ok(primary, "actual native startup must reject a regular-file state path");
  await assert.rejects(owner.cleanup(primary), /without a retained successful Health/);
  assert.ok(f.dirs.every(existsSync));
  const r = receipts(f).find(x => x.phase === "recovery-required");
  assert.equal(r.primaryError, String(primary.stack ?? primary));
  assert.equal(r.ownerPid, null);
  assert.deepEqual(r.operations, []);
  assert.deepEqual(r.deleted, []);
});
