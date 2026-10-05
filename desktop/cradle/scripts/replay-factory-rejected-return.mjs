// Replay the real consumer with separately retained native evidence. No capture,
// private identity, owner mutation or successful fixture is embedded here.
// From desktop/cradle:
// node --experimental-strip-types --import ./tests/ts-register.mjs \
//   ./scripts/replay-factory-rejected-return.mjs \
//   --manifest /absolute/retained/manifest.json --manifest-sha256 <sha256>
import test from "node:test";
import assert from "node:assert/strict";
import {constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname, isAbsolute, join, basename} from "node:path";
import {performance} from "node:perf_hooks";

const D = await import("../src/contributions/factory/desk/runModel.ts");
const E = await import("../src/contributions/factory/live/eventMap.ts");
const X = await import("../src/contributions/factory/run-expression.ts");
const I = await import("../src/contributions/factory/inhabitation/model.ts");
const started = performance.now();
const options = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  assert.ok(["--material-directory", "--manifest", "--manifest-sha256"].includes(argv[i]), "unknown replay option");
  assert.ok(typeof argv[i + 1] === "string" && !options.has(argv[i]), "missing or duplicate replay option");
  options.set(argv[i], argv[i + 1]);
}
assert.notEqual(options.has("--manifest"), options.has("--material-directory"), "select one explicit absolute manifest or material directory");
assert.match(options.get("--manifest-sha256") ?? "", /^[a-f0-9]{64}$/, "the retained manifest digest is required");
const manifestPath = options.has("--manifest") ? options.get("--manifest") : join(options.get("--material-directory"), "manifest.json");
assert.ok(isAbsolute(manifestPath), "retained material must have an absolute path");
const directory = dirname(manifestPath);
assert.equal(realpathSync(directory), directory, "retained material directory must be canonical");
const directoryFD = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
const directoryBasis = fstatSync(directoryFD, {bigint: true});
assert.ok(directoryBasis.isDirectory(), "retained material must be a directory");
const signature = s => [s.dev, s.ino, s.mode, s.nlink, s.size, s.mtimeNs, s.ctimeNs];
const pins = [];
const checks = [];
const directoryCheck = () => {
  assert.equal(realpathSync(directory), directory, "retained directory was redirected");
  const held = fstatSync(directoryFD, {bigint: true});
  const named = lstatSync(directory, {bigint: true});
  assert.deepEqual([held.dev, held.ino, held.mode], [directoryBasis.dev, directoryBasis.ino, directoryBasis.mode]);
  assert.deepEqual([named.dev, named.ino, named.mode], [directoryBasis.dev, directoryBasis.ino, directoryBasis.mode]);
};
function heldRead(path, maximum, expected) {
  directoryCheck();
  assert.equal(performance.now() - started < 10_000, true, "retained material read exceeded its bound");
  assert.equal(dirname(path), directory, "capture escaped the explicit retained directory");
  const before = lstatSync(path, {bigint: true});
  assert.ok(before.isFile() && before.nlink === 1n && before.size <= BigInt(maximum), "capture must be a bounded single-link regular file");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const chunks = [];
  let count = 0;
  try {
    assert.deepEqual(signature(fstatSync(fd, {bigint: true})), signature(before));
    const buffer = Buffer.alloc(65_536);
    while (true) {
      assert.ok(performance.now() - started < 10_000, "retained material read exceeded its bound");
      const n = readSync(fd, buffer, 0, buffer.length, null);
      if (n === 0) break;
      count += n;
      assert.ok(count <= maximum, "capture grew beyond its bound");
      chunks.push(Buffer.from(buffer.subarray(0, n)));
    }
    assert.deepEqual(signature(fstatSync(fd, {bigint: true})), signature(before));
  } finally {
    closeSync(fd);
  }
  const check = () => {
    directoryCheck();
    assert.deepEqual(signature(lstatSync(path, {bigint: true})), signature(before), "retained capture changed");
  };
  check();
  assert.equal(BigInt(count), before.size, "capture did not reach exact EOF");
  const value = Buffer.concat(chunks);
  const sha256 = createHash("sha256").update(value).digest("hex");
  assert.equal(sha256, expected, "retained capture digest differs");
  checks.push(check);
  pins.push({file: basename(path), bytes: count, sha256, fullEOF: true});
  return value;
}

try {
  const manifest = JSON.parse(heldRead(manifestPath, 65_536, options.get("--manifest-sha256")).toString("utf8"));
  assert.equal(manifest.schema, "actual-installed-native-owner-captures/v1");
  const required = ["before.json", "after.json", "full-run.json", "RETURN.md", "SHA256SUMS"];
  assert.deepEqual(Object.keys(manifest.captures).sort(), [...required].sort(), "missing or foreign capture family");
  const material = new Map(required.map(name => {
    const entry = manifest.captures[name];
    assert.equal(entry.file, name, "capture member name differs");
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && entry.bytes <= 4_194_304);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const value = heldRead(join(directory, name), 4_194_304, entry.sha256);
    assert.equal(value.length, entry.bytes);
    return [name, value];
  }));
  const decode = name => JSON.parse(material.get(name).toString("utf8"));
  const before = decode("before.json"), after = decode("after.json"), run = decode("full-run.json");
  assert.equal(before.contract, "factory.attempt-reading/v1");
  assert.equal(after.contract, "factory.attempt-reading/v1");
  assert.equal(run.contract, "factory.run-reading/v1");
  assert.equal(before.runRef, manifest.runRef);
  assert.equal(after.runRef, manifest.runRef);
  assert.equal(run.runRef, manifest.runRef);
  assert.deepEqual([before.revision, after.revision], manifest.ownerRevisions);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(run.revision, manifest.runRevision);
  assert.deepEqual(run.nativeAttempts, after, "full Run has a foreign or changed native basis");
  const select = reading => {
    const selected = reading.attempts.filter(a => a.attemptRef === manifest.attemptRef);
    assert.equal(selected.length, 1, "retained attempt must be unique");
    return selected[0];
  };
  const prior = select(before), native = select(after), unit = native.workflowUnitRef;
  assert.ok(after.requiredUnits.includes(unit), "retained attempt is not a required unit");
  assert.equal(native.executionRef, after.legs[unit].executionRef);
  const source = {statePath: manifestPath, projectRef: run.projectRef};
  const document = X.composeRunExpression({run, statePath: manifestPath}, "expression:retained-rejected-native-return");
  const ops = E.mapEvents({runRef: run.runRef, attempts: after}, {});

  await test("retained native rejection keeps the actual candidate and produced Return", () => {
    assert.equal(before.legs[unit].status, "returned");
    assert.equal(after.legs[unit].status, "failed");
    assert.equal(native.verifications.at(-1).outcome, "failed");
    assert.deepEqual(native.disposition, prior.disposition);
    assert.equal(native.taskRef, prior.taskRef);
    assert.equal(native.executionRef, prior.executionRef);
    assert.deepEqual(native.readableReturn, prior.readableReturn);
    assert.deepEqual(after.legs[unit].artifacts, before.legs[unit].artifacts);
  });
  await test("a failed required result supplies no accepted unit or consumer completion", () => {
    assert.equal(after.wholeRunState, "failed");
    assert.equal(after.completionVerified, false);
    assert.equal(before.currentReturnedUnits.includes(unit), true);
    assert.equal(after.currentReturnedUnits.includes(unit), false);
    assert.equal(E.ownerRunComplete(after, run.runRef), false);
    assert.equal(ops.some(op => op.basis.entry === "attempt.run-complete"), false);
    assert.ok(ops.some(op => op.basis.entry === "attempt.fail"));
    assert.ok(ops.some(op => op.basis.entry === "attempt.return"));
    assert.equal(D.runState(run), "fail");
    assert.equal(D.deskCard(source, run).state, "fail");
    assert.deepEqual(D.acceptedUnitProgress(run), {accepted: after.currentReturnedUnits.length, required: after.requiredUnits.length});
    assert.ok(after.currentReturnedUnits.length < after.requiredUnits.length);
  });
  await test("the current rejected Return and artifacts remain inspectable as produced material", () => {
    const selected = I.currentAttemptOf(D.attemptsForRun(run, undefined, unit));
    assert.equal(selected.outcome, "one");
    assert.equal(selected.entries[0].attemptRef, native.attemptRef);
    assert.equal(selected.entries[0].verification.at(-1).outcome, "failed");
    assert.deepEqual(selected.entries[0].return, native.readableReturn);
    assert.ok(X.currentReturnedAttempts(run).some(a => a.attemptRef === native.attemptRef));
    const returned = document.scenes.filter(s => s.title === "Returned work").flatMap(s => s.entity_refs.map(ref => document.entities[ref].subject.subject_ref));
    assert.ok(returned.includes(native.attemptRef));
    assert.ok(native.readableReturn.artifactRefs.length > 0);
    for (const ref of native.readableReturn.artifactRefs) {
      const entity = Object.values(document.entities).find(e => e.subject?.subject_ref === ref);
      assert.ok(entity?.subject.readings.some(r => r.ref === native.readableReturn.returnRef));
    }
    const body = material.get("RETURN.md");
    const hash = createHash("sha256").update(body).digest("hex");
    assert.ok(material.get("SHA256SUMS").toString("utf8").split("\n").some(line => line.startsWith(hash + "  ") && line.endsWith("/RETURN.md")));
    assert.ok(body.toString("utf8").includes("Attempt: " + native.attemptRef));
    assert.ok(body.toString("utf8").includes("Execution: " + native.executionRef));
    assert.ok(native.readableReturn.evidenceRefs.some(ref => ref.endsWith("/RETURN.md")));
  });
  await test("the explicitly retained native material remains unchanged through replay", () => {
    for (const check of checks) check();
  });
  console.log(JSON.stringify({schema: "factory.rejected-return-consumer-replay/v1", runRef: run.runRef,
    attemptRef: native.attemptRef, unitRef: unit, ownerRevisions: manifest.ownerRevisions,
    acceptedUnits: after.currentReturnedUnits.length, requiredUnits: after.requiredUnits.length,
    cardState: D.runState(run), inputs: pins, nativeMutation: false, installedGUI: false,
    OriginalUnitAcceptance: false}));
} finally {
  closeSync(directoryFD);
}
