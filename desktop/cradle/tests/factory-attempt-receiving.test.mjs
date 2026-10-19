// Choosing an attempt: its Return proposed to Central's receiving field (kernel factory_owner `attempt-receiving`, assembled from
// Factory's own admission reading and the host's grant). The desk reads the kernel's document only for the Run and the attempt it
// named, and shows the owner's words where it gave them (desk/factoryReads.ts readAttemptReceiving / attemptReceivingWords).
// Channel: FIXTURE documents in the shape kernel/src/factory_receiving.rs pins.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-attempt-receiving.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const M = await import("../src/contributions/factory/desk/factoryReads.ts");

const RUN = "run:A", ATTEMPT = "attempt:A1";
const expect = {runRef: RUN, attemptRef: ATTEMPT};
const target = {sourceRef: "central:source:flow-a", documentId: "doc:flow-a", sourceRevision: "rev:9", root: "/Users/test/Central"};
const answer = (overrides = {}) => ({contract: "oi.factory-attempt-receiving/v1", runRef: RUN, attemptRef: ATTEMPT, status: "received", changed: true, target,
  authorityRef: "central:native-action-authority#human", receipt: {receivingRef: "receiving:R1"}, refusal: null, ...overrides});
const refusal = (source, message) => ({source, step: null, message});

test("an answer is read only for the Run and attempt it names, in a status the kernel gives", () => {
  assert.equal(M.readAttemptReceiving(answer(), expect).status, "received");
  assert.throws(() => M.readAttemptReceiving(answer({runRef: "run:B"}), expect), /did not answer this attempt's receiving/);
  assert.throws(() => M.readAttemptReceiving(answer({attemptRef: "attempt:A2"}), expect), /did not answer/);
  assert.throws(() => M.readAttemptReceiving(answer({contract: "oi.factory-run-close/v1"}), expect), /did not answer/);
  assert.throws(() => M.readAttemptReceiving(answer({status: "accepted"}), expect), /did not answer/);
  assert.throws(() => M.readAttemptReceiving(answer({changed: "yes"}), expect), /did not answer/);
  assert.throws(() => M.readAttemptReceiving("received", expect), /did not answer/);
  assert.throws(() => M.readAttemptReceiving(null, expect), /did not answer/);
});

test("a refusal carries its reason and nothing else does", () => {
  assert.equal(M.readAttemptReceiving(answer({status: "refused", changed: false, receipt: null, refusal: refusal("driver", "No grant")}), expect).refusal.message, "No grant");
  assert.equal(M.readAttemptReceiving(answer({status: "uncertain", refusal: refusal("owner", "no answer")}), expect).status, "uncertain");
  assert.throws(() => M.readAttemptReceiving(answer({status: "refused", changed: false, refusal: null}), expect), /did not answer/, "a refusal with no reason");
  assert.throws(() => M.readAttemptReceiving(answer({status: "received", refusal: refusal("owner", "but")}), expect), /did not answer/, "a success with a reason to refuse");
  assert.throws(() => M.readAttemptReceiving(answer({status: "refused", changed: false, refusal: refusal("desk", "mine")}), expect), /did not answer/, "only the owner or the driver refuses");
  assert.throws(() => M.readAttemptReceiving(answer({status: "refused", changed: false, refusal: refusal("owner", "  ")}), expect), /did not answer/, "a blank reason is no reason");
});

test("the words are the owner's where it gave them: the driver's refusal alone, the owner's after its source, an unconfirmed call unconfirmed", () => {
  const words = overrides => M.attemptReceivingWords(M.readAttemptReceiving(answer(overrides), expect));
  assert.deepEqual(words(), {ok: true, line: "Chosen: this attempt's Return was proposed to Central's receiving field in the Flow doc:flow-a (receiving:R1)."});
  assert.deepEqual(words({status: "already-received", changed: false}), {ok: true, line: "Already chosen: Central holds this attempt's Return as receiving:R1."});
  assert.deepEqual(words({status: "refused", changed: false, receipt: null, refusal: refusal("driver", "scope not granted: the grant does not cover project:Factory.")}),
    {ok: false, line: "scope not granted: the grant does not cover project:Factory."});
  assert.deepEqual(words({status: "refused", changed: false, receipt: null, refusal: refusal("owner", "stale Factory state revision")}),
    {ok: false, line: "The owner refused the choice: stale Factory state revision"});
  assert.equal(words({status: "needs-reconciliation"}).ok, false);
  assert.match(words({status: "needs-reconciliation"}).line, /Central's answer is not confirmed/);
  assert.match(words({status: "uncertain", refusal: refusal("owner", "no answer")}).line, /may have run: no answer\. Read the attempt again/);
  // No receiving ref and no target: nothing is invented.
  assert.equal(words({receipt: null, target: null}).line, "Chosen: this attempt's Return was proposed to Central's receiving field.");
});
