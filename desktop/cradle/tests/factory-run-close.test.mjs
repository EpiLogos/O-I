// T-FACTORY-2b: the Run's own lifecycle close after the person's Recognition.
// The owner's receipt or refusal is read as the kernel returned it (desk model:
// runModel.ts readRunClose / closeWords / settleRunClose). The owner's order
// rules are the conformance spec of packages/live-shell/ui/src/agent/
// the retired shell factoryQueueAdvance.ts (gone with #804; the kernel's run close is the one rule), as the Run's close: a close applies
// once, a replay is already-applied with its receipt, a refusal changes nothing
// and is shown in the owner's own words, and a closed Run stops its live
// production while a refused close leaves it as it is.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-run-close.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const M = await import("../src/contributions/factory/desk/runModel.ts");

const RUN = "run:A", REC = "recognition:R1";
const expect = {runRef: RUN, recognitionRef: REC};
const step = (target, status, previousRevision) => ({target, status, commandId: `command:run-close:${RUN}:${target}:r${previousRevision}`, receipt: {contract: "factory.attempt-action/v1", previousRevision, nextRevision: previousRevision + 1, operation: "transition-run"}});
const close = (overrides) => ({contract: "oi.factory-run-close/v1", runRef: RUN, recognitionRef: REC, status: "finished", lifecycle: "finished", steps: [step("finishing", "applied", 40), step("finished", "applied", 41)], refusal: null, ...overrides});
const refused = (message, source = "owner", step_ = "finished") => close({status: "refused", lifecycle: "finishing", steps: [step("finishing", "applied", 40)], refusal: {source, step: step_, message}});

test("a close is read only for the Run and Recognition it names", () => {
  assert.equal(M.readRunClose(close(), expect).status, "finished");
  assert.throws(() => M.readRunClose(close({runRef: "run:B"}), expect), /did not answer this Run's close/);
  assert.throws(() => M.readRunClose(close({recognitionRef: "recognition:R2"}), expect), /did not answer this Run's close/);
  assert.throws(() => M.readRunClose({...close(), contract: "factory.attempt-action/v1"}, expect));
});

test("a refusal must carry its reason, and a reason must come with a refusal", () => {
  assert.throws(() => M.readRunClose(close({status: "refused", refusal: null}), expect));
  assert.throws(() => M.readRunClose(refused("   "), expect));
  assert.throws(() => M.readRunClose(refused("ok", "elsewhere"), expect));
  assert.throws(() => M.readRunClose(close({refusal: {source: "owner", step: null, message: "stray"}}), expect));
});

test("a finished close applies once: finishing then finished, and Finished is shown", () => {
  const receipt = M.readRunClose(close(), expect);
  assert.deepEqual(receipt.steps.map(s => `${s.target}:${s.status}`), ["finishing:applied", "finished:applied"]);
  assert.deepEqual(M.closeWords(receipt), {state: "success", line: "Finished: the owner applied the close."});
});

test("a repeat close is already-finished: no step, and the Run reads Finished", () => {
  const receipt = M.readRunClose(close({status: "already-finished", steps: []}), expect);
  assert.equal(M.closeWords(receipt).state, "success");
  assert.match(M.closeWords(receipt).line, /already closed/);
  const replay = M.readRunClose(close({steps: [step("finished", "already-applied", 41)]}), expect);
  assert.equal(replay.steps[0].status, "already-applied", "an owner replay carries its receipt");
});

test("a refusal leaves the Run where the owner says and shows the owner's words verbatim", () => {
  const message = "Finished requires exact native review and receiving closure basis";
  const receipt = M.readRunClose(refused(message), expect);
  assert.equal(M.closeWords(receipt).state, "running", "the owner's lifecycle (finishing) is the Run's state");
  assert.equal(M.closeWords(receipt).line, `The owner refused the close: ${message}`);
  const held = M.readRunClose(refused("no receiving linked", "driver", null), expect);
  assert.equal(M.closeWords(held).line, "no receiving linked", "a driver refusal is shown in its words alone");
  const grant = "No native action authority grants the Factory Run close to this desk; the close waits for that grant (Control/user/native-action-authority.json).";
  assert.equal(M.closeWords(M.readRunClose(refused(grant, "driver", null), expect)).line, grant);
});

test("a next serial unit leaves the Run open", () => {
  const receipt = M.readRunClose({...close({status: "next-unit-started", lifecycle: "active", steps: [step("start-serial", "applied", 40)]})}, expect);
  assert.equal(M.closeStopsLive(receipt), false);
  assert.equal(M.closeWords(receipt).state, "running");
});

test("a closed Run's live production is stopped; a refused close leaves it as it is", () => {
  const stopped = [];
  const stop = runKey => { stopped.push(runKey); return Promise.resolve(); };
  const key = "source\u0000project\u0000run:A";
  assert.equal(M.settleRunClose(M.readRunClose(close(), expect), key, stop), true);
  assert.equal(M.settleRunClose(M.readRunClose(close({status: "already-finished", steps: []}), expect), key, stop), true);
  assert.equal(M.settleRunClose(M.readRunClose(refused("no"), expect), key, stop), false, "a refused close stops nothing");
  assert.equal(M.settleRunClose(M.readRunClose(close({status: "next-unit-started", lifecycle: "active", steps: []}), expect), key, stop), false);
  assert.deepEqual(stopped, [key, key], "exactly the two closed Runs are stopped, under the Run's own key");
});

test("the desk stops the live production through the Run's own control, on a close", () => {
  const handoff = readFileSync(new URL("../src/contributions/factory/desk/RunHandoff.tsx", import.meta.url), "utf8");
  assert.match(handoff, /import \{stopRunLive\} from "\.\.\/FactoryLive";/);
  assert.match(handoff, /settleRunClose\(outcome, cardKey\(entry\.card\.source, run\.runRef\), stopRunLive\)/);
});

test("the recognition the close follows is the owner's own recorded ref", () => {
  const answer = {record: {request: {mutation: {recognition: {recognition_ref: REC, subject_ref: "return:1", basis_refs: [REC]}}}}};
  assert.equal(M.recognitionRefOf(answer), REC);
  assert.equal(M.recognitionRefOf({record: {}}), undefined);
});

// T-REVIEW-6 (#7): a close whose walk ended with the Run unfinished, or whose
// reading is missing, stops nothing; the desk trusts the Run's own lifecycle.
test("a walk that ends with the Run unfinished is a driver refusal and stops no live production", () => {
  const stopped = [];
  const stop = runKey => { stopped.push(runKey); return Promise.resolve(); };
  const key = "source\u0000project\u0000run:A";
  const walk = close({status: "refused", lifecycle: "active", steps: [step("active", "applied", 40), step("active", "applied", 40), step("active", "applied", 40), step("active", "applied", 40)], refusal: {source: "driver", step: null, message: "The Run is active after 4 owner move(s); the close needs it finished or archived, so the close stops here."}});
  const receipt = M.readRunClose(walk, expect);
  assert.equal(receipt.status, "refused");
  assert.equal(M.settleRunClose(receipt, key, stop), false);
  assert.deepEqual(stopped, []);
});

test("a close that says Finished over an unfinished Run is not a close, and stops nothing", () => {
  const stopped = [];
  const stop = runKey => { stopped.push(runKey); return Promise.resolve(); };
  const key = "source\u0000project\u0000run:A";
  assert.throws(() => M.readRunClose(close({lifecycle: "finishing"}), expect), /did not answer this Run's close/);
  assert.throws(() => M.readRunClose(close({status: "already-finished", steps: [], lifecycle: null}), expect), /did not answer this Run's close/);
  // Even a receipt that reached settleRunClose unchecked does not stop the Run.
  const unfinished = close({lifecycle: "finishing"});
  assert.equal(M.closeStopsLive(unfinished), false);
  assert.equal(M.settleRunClose(unfinished, key, stop), false);
  assert.equal(M.settleRunClose(close({lifecycle: null}), key, stop), false);
  assert.deepEqual(stopped, []);
});
