// Exact source-native Factory Run readings from genuine, isolated Ctrl process
// regressions. These are controlled native effects/auth fixtures, not an actual
// model worker, personal human decision or installed development completion.
// Only deliberately hostile inspection/cache inputs below are derived; no
// successful owner fixture is constructed in this test.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-native-owner-projections.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const D = await import("../src/contributions/factory/desk/runModel.ts");
const E = await import("../src/contributions/factory/live/eventMap.ts");
const I = await import("../src/contributions/factory/inhabitation/model.ts");
const directory = new URL("./fixtures/factory-native-owner-projections/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
const load = name => {
  const entry = manifest.fixtures[name];
  assert.ok(entry, `missing genuine native capture ${name}`);
  const bytes = readFileSync(new URL(entry.file, directory));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
  return JSON.parse(bytes.toString("utf8"));
};
const finished = load("native-finished");
const archived = load("native-finished-archived");
const aborted = load("native-aborted-archived");
const source = {statePath: "controlled-native-owner-capture", projectRef: finished.projectRef};
const live = run => ({runRef: run.runRef, attempts: run.nativeAttempts});
const current = (run, unit) => D.attemptsForRun(run, undefined, unit).filter(a => a.currentAttempt);

function hostileInspection(run, foreign = false) {
  const native = run.nativeAttempts;
  return {
    runRef: foreign ? "run:foreign-concurrent-inspection" : run.runRef,
    revision: native.revision + 10000,
    legs: Object.fromEntries(Object.keys(native.legs).map(unit => [unit, {
      status: "failed", executionRef: "execution:stale-inspection",
    }])),
    attempts: native.attempts.map(a => ({
      attemptRef: `inspection:stale:${a.attemptRef}`, workflowUnitRef: a.workflowUnitRef,
      executionRef: "execution:stale-inspection", currentAttempt: true,
      participant: {agentRef: "agent:unadmitted-inspection", agencyRef: "agency:unadmitted-inspection"},
      body: {modelRef: "model:unadmitted-inspection", agentSessionRef: "session:unadmitted-inspection"},
      return: {summary: "A stale cache cannot replace the current native Return."},
      verification: a.verifications.map(v => ({...v, outcome: "failed"})),
    })),
  };
}

test("genuine captures retain measured executable and source-only authority provenance", () => {
  assert.equal(manifest.sourceNative, true);
  assert.equal(manifest.modelInvoked, false);
  assert.equal(manifest.actualHumanWorldReply, false);
  assert.equal(manifest.installedDevelopmentRunCompletion, false);
  for (const name of ["native-finished", "native-finished-archived", "native-aborted-archived"]) {
    const run = load(name);
    const basis = JSON.parse(readFileSync(new URL(`${name}.invocation.json`, directory), "utf8"));
    assert.equal(run.contract, "factory.run-reading/v1");
    assert.equal(run.nativeAttempts.contract, "factory.attempt-reading/v1");
    assert.equal(run.runRef, run.nativeAttempts.runRef);
    assert.equal(basis.modelInvoked, false);
    assert.equal(basis.actualHumanWorldReply, false);
    assert.equal(basis.credentialsIncluded, false);
    assert.equal(basis.factory.sha256, manifest.fixtures[name].factory.sha256);
    assert.equal(basis.central.sha256, manifest.fixtures[name].central.sha256);
  }
});

test("Desk and live Expression preserve admitted Finish versus Abort before Archive", () => {
  for (const run of [finished, archived]) {
    assert.equal(E.ownerRunComplete(run.nativeAttempts, run.runRef), true);
    assert.equal(D.deskCard(source, run).state, "success");
    assert.equal(E.mapEvents(live(run), {}).filter(op => op.basis.entry === "attempt.run-complete").length, 1);
  }
  assert.equal(archived.nativeAttempts.archivedFrom, "finished");
  assert.equal(aborted.nativeAttempts.archivedFrom, "aborted");
  assert.equal(aborted.nativeAttempts.wholeRunState, "complete");
  assert.equal(aborted.nativeAttempts.completionVerified, false);
  assert.equal(E.ownerRunComplete(aborted.nativeAttempts, aborted.runRef), false);
  assert.equal(D.deskCard(source, aborted).state, "fail");
  assert.equal(E.mapEvents(live(aborted), {}).some(op => op.basis.entry === "attempt.run-complete"), false);
  assert.equal(D.unitSegments(aborted).every(segment => segment.standing === "returned"), true,
    "retained successful unit facts do not certify an aborted undertaking");
});

test("archival does not repeat the same Run's admitted completion event", () => {
  const first = E.mapEvents(live(finished), {});
  const cursor = E.advanceCursor(E.emptyCursor(), first);
  assert.equal(E.mapEvents(live(archived), {}, cursor).some(op => op.basis.entry === "attempt.run-complete"), false);
});

test("the exact native leg selects its immutable participant, body, Return and assessment", () => {
  for (const run of [finished, archived, aborted]) {
    for (const unit of run.nativeAttempts.requiredUnits) {
      const selected = current(run, unit);
      assert.equal(selected.length, 1);
      const native = run.nativeAttempts.attempts.find(a => a.attemptRef === selected[0].attemptRef);
      assert.equal(selected[0].executionRef, run.nativeAttempts.legs[unit].executionRef);
      assert.deepEqual(selected[0].participant, native.disposition.participant);
      assert.deepEqual(selected[0].body, native.disposition.body);
      assert.deepEqual(selected[0].return, native.readableReturn);
      assert.deepEqual(selected[0].verification, native.verifications);
    }
  }
});

test("newer stale or foreign inspection cannot replace the same Run's native execution", () => {
  for (const inspection of [hostileInspection(finished), hostileInspection(finished, true)]) {
    for (const unit of finished.nativeAttempts.requiredUnits) {
      assert.deepEqual(D.attemptsForRun(finished, inspection, unit), D.attemptsForRun(finished, undefined, unit));
      assert.deepEqual(D.legFor(finished, unit, inspection), finished.nativeAttempts.legs[unit]);
    }
    assert.deepEqual(D.unitSegments(finished, inspection), D.unitSegments(finished));
    assert.deepEqual(D.deskCard(source, finished, undefined, inspection).agents, D.deskCard(source, finished).agents);
  }
});

test("native selection survives array permutation and cannot be borrowed by a foreign Run", () => {
  const reversed = structuredClone(finished);
  reversed.nativeAttempts.attempts.reverse();
  for (const unit of finished.nativeAttempts.requiredUnits) {
    assert.deepEqual(current(reversed, unit), current(finished, unit));
  }
  const foreign = structuredClone(finished);
  foreign.nativeAttempts.runRef = "run:foreign-native-reading";
  assert.equal(D.nativeAttemptsFor(foreign), undefined);
  assert.notEqual(D.deskCard(source, foreign).state, "success");
  assert.deepEqual(D.attemptsForRun(foreign, hostileInspection(finished, true)), []);
  assert.equal(E.mapEvents(live(foreign), {}).some(op => op.basis.entry === "attempt.run-complete"), false);
});

test("genuine missing required Returns remain incomplete across Desk and live Expression", () => {
  for (const name of ["native-old-attempt-failed", "native-current-retry-failed", "native-current-retry-unknown"]) {
    const missing = load(name);
    const native = missing.nativeAttempts;
    assert.ok(native.requiredUnits.some(unit => !native.currentReturnedUnits.includes(unit)),
      "the genuine native capture retains a required unit without a current Return");
    assert.equal(native.completionVerified, false);
    assert.equal(E.ownerRunComplete(native, missing.runRef), false);
    assert.notEqual(D.deskCard(source, missing).state, "success");
    assert.equal(E.mapEvents(live(missing), {}).some(op => op.basis.entry === "attempt.run-complete"), false);
  }
});

test("a genuine rejected native result reopens its unit without erasing the Return", () => {
  const failed = load("native-old-attempt-failed");
  const unit = failed.nativeAttempts.requiredUnits[0];
  const [selected] = current(failed, unit);
  assert.equal(selected.verification.at(-1).outcome, "failed");
  assert.equal(failed.nativeAttempts.legs[unit].status, "failed");
  assert.equal(D.unitSegments(failed)[0].standing, "failed");
  assert.ok(selected.return?.returnRef);
  assert.equal(failed.nativeAttempts.wholeRunState, "failed");
  assert.equal(E.ownerRunComplete(failed.nativeAttempts, failed.runRef), false);
});

test("genuine successful current retry supersedes the old failed assessment and body", () => {
  const retry = load("native-current-retry-passed");
  const unit = retry.nativeAttempts.requiredUnits[0];
  const attempts = D.attemptsForRun(retry, hostileInspection(retry), unit);
  assert.equal(attempts.length, 2);
  const selected = I.currentAttemptOf(attempts);
  assert.equal(selected.outcome, "one");
  const [now] = selected.entries;
  const old = attempts.find(a => !a.currentAttempt);
  assert.equal(old.verification.at(-1).outcome, "failed");
  assert.equal(now.attemptRef, "attempt:native-inspect-source-retry");
  assert.equal(now.executionRef, retry.nativeAttempts.legs[unit].executionRef);
  assert.equal(now.taskRef, old.taskRef, "retry retains native task ancestry");
  assert.notEqual(now.body.agentSessionRef, old.body.agentSessionRef);
  const native = retry.nativeAttempts.attempts.find(a => a.attemptRef === now.attemptRef);
  assert.equal(native.dispatch.payload.record.session_ref, now.body.agentSessionRef,
    "the body is the session of the actual native Ctrl effect");
  const obligations = now.verification.at(-1).obligations;
  assert.equal(D.unitChecks(obligations, attempts).every(check => check.state === "passed"), true);
  assert.equal(retry.nativeAttempts.wholeRunState, "complete");
  assert.equal(retry.nativeAttempts.completionVerified, false);
  assert.equal(E.ownerRunComplete(retry.nativeAttempts, retry.runRef), false,
    "a successful retry is still distinct from admitted undertaking completion");
});

test("actual current latest unknown or failed assessment cannot inherit an earlier pass", () => {
  const passed = load("native-current-retry-passed");
  for (const outcome of ["unknown", "failed"]) {
    const changed = load(`native-current-retry-${outcome}`);
    const unit = changed.nativeAttempts.requiredUnits[0];
    const attempts = D.attemptsForRun(changed, hostileInspection(passed), unit);
    const [now] = I.currentAttemptOf(attempts).entries;
    assert.equal(now.verification.at(-1).outcome, outcome);
    assert.equal(now.verification.some(v => v.outcome === "passed"), true);
    const rows = D.unitChecks(now.verification.at(-1).obligations, attempts);
    assert.equal(rows.every(row => row.state === (outcome === "unknown" ? "outstanding" : "failed")), true);
    assert.equal(D.unitSegments(changed)[0].standing, "failed");
    assert.equal(changed.nativeAttempts.wholeRunState, "failed");
    assert.equal(E.ownerRunComplete(changed.nativeAttempts, changed.runRef), false);
    assert.deepEqual(now.return, current(passed, unit)[0].return,
      "the genuine current Return remains history while its certification is rejected");
  }
});

test("retry selection uses execution identity when the genuine native history is reordered", () => {
  const retry = load("native-current-retry-passed");
  const unit = retry.nativeAttempts.requiredUnits[0];
  const reversed = structuredClone(retry);
  reversed.nativeAttempts.attempts.reverse();
  assert.deepEqual(I.currentAttemptOf(D.attemptsForRun(reversed, undefined, unit)),
    I.currentAttemptOf(D.attemptsForRun(retry, undefined, unit)));
});

test("a stale native execution pointer yields no body and duplicate identity stays ambiguous", () => {
  const retry = load("native-current-retry-passed");
  const unit = retry.nativeAttempts.requiredUnits[0];
  const stale = structuredClone(retry);
  stale.nativeAttempts.legs[unit].executionRef = "execution:unadmitted-new-candidate";
  assert.equal(I.currentAttemptOf(D.attemptsForRun(stale, hostileInspection(retry), unit)).outcome, "none");
  const duplicate = structuredClone(retry);
  const currentNative = duplicate.nativeAttempts.attempts.find(a => a.executionRef === duplicate.nativeAttempts.legs[unit].executionRef);
  duplicate.nativeAttempts.attempts.push({...structuredClone(currentNative), attemptRef: "attempt:hostile-duplicate"});
  assert.equal(I.currentAttemptOf(D.attemptsForRun(duplicate, undefined, unit)).outcome, "ambiguous");
});
