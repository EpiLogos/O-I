// Choosing an attempt: its Return proposed to Central's receiving field, into the Flow its Run belongs to, by Software Factory's own
// Action `factory.attempt.choose` through the kernel's `act` (O-I #1006; desk/factoryReads.ts chooseAttemptOf). REPLACED (O-I #1006): the
// kernel composed the choice itself (factory_owner `attempt-receiving`, kernel/src/factory_receiving.rs, both deleted). The desk reads
// Factory's answer only for the Run and the attempt it named, and shows it in words (readAttemptChoice / attemptChoiceWords).
// Channel: documents in the shape Factory's session.rs `choose` answers (factory.session-task/v1), over a SCRIPTED host.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-attempt-receiving.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const M = await import("../src/contributions/factory/desk/factoryReads.ts");

const RUN = "run:A", ATTEMPT = "attempt:A1";
const expect = {runRef: RUN, attemptRef: ATTEMPT};
const answer = (overrides = {}) => ({contract: "factory.session-task/v1", state: "received", run_ref: RUN, attempt_ref: ATTEMPT,
  receipt: {needsReconciliation: false, centralResponse: {receivingRef: "receiving:R1"}}, ...overrides});

test("an answer is read only for the Run and attempt it names, in a state Factory gives", () => {
  assert.equal(M.readAttemptChoice(answer(), expect).state, "received");
  assert.equal(M.readAttemptChoice(answer({state: "already-received", receipt: undefined, receiving_ref: "receiving:R1"}), expect).receiving_ref, "receiving:R1");
  assert.equal(M.readAttemptChoice(answer({state: "needs-reconciliation"}), expect).state, "needs-reconciliation");
  assert.throws(() => M.readAttemptChoice(answer({run_ref: "run:B"}), expect), /Factory did not answer this attempt's choice/);
  assert.throws(() => M.readAttemptChoice(answer({attempt_ref: "attempt:A2"}), expect), /did not answer/);
  assert.throws(() => M.readAttemptChoice(answer({contract: "factory.session-list/v1"}), expect), /did not answer/);
  assert.throws(() => M.readAttemptChoice(answer({state: "retried"}), expect), /did not answer/, "a retry's answer is no choice");
  assert.throws(() => M.readAttemptChoice(answer({receiving_ref: 7}), expect), /did not answer/);
  assert.throws(() => M.readAttemptChoice("received", expect), /did not answer/);
  assert.throws(() => M.readAttemptChoice(null, expect), /did not answer/);
});

test("the words: a choice made, one Central holds already, and a call Central has not confirmed", () => {
  const words = overrides => M.attemptChoiceWords(M.readAttemptChoice(answer(overrides), expect));
  assert.deepEqual(words(), {ok: true, line: "Chosen: this attempt's Return was proposed to Central's receiving field, into the Flow its Run belongs to."});
  assert.deepEqual(words({state: "already-received", receipt: undefined, receiving_ref: "receiving:R1"}),
    {ok: true, line: "Already chosen: Central holds this attempt's Return as receiving:R1."});
  assert.deepEqual(words({state: "already-received", receipt: undefined}), {ok: true, line: "Already chosen: Central holds this attempt's Return."}, "nothing is invented");
  assert.equal(words({state: "needs-reconciliation"}).ok, false);
  assert.match(words({state: "needs-reconciliation"}).line, /Central's answer is not confirmed; it needs reconciling/);
});

test("the choice is Factory's factory.attempt.choose by `act`, on the shell window's channel; Factory's refusal is thrown in its words", async () => {
  const sent = [];
  let reply;
  const prior = globalThis.window;
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => { sent.push([command, args.op]); return reply }}};
  const TAURI = {kind: "tauri"};
  const target = {statePath: "/w/.factory/state.json", runRef: RUN, attemptRef: ATTEMPT};
  try {
    reply = {result: "action_dispatched", dispatch: {state: "invoked", data: answer()}};
    assert.equal((await M.chooseAttemptOf(TAURI, target)).state, "received");
    assert.deepEqual(sent, [["kernel_press", {op: "act", action: "factory.attempt.choose", input: {state: "/w/.factory/state.json", run_ref: RUN, attempt_ref: ATTEMPT}}]]);
    const flowless = `${RUN} belongs to no Central Flow, so its Return has nowhere to be received: a task written on a session's track is commissioned from your words, with no Flow, and its difference stays in the session's checkout, where Git / landing lands it`;
    reply = {result: "action_dispatched", dispatch: {state: "owner_refused", action: "factory.attempt.choose", message: flowless}};
    await assert.rejects(() => M.chooseAttemptOf(TAURI, target), {message: flowless});
    reply = {result: "action_dispatched", dispatch: {state: "invoked", data: answer({attempt_ref: "attempt:A9"})}};
    await assert.rejects(() => M.chooseAttemptOf(TAURI, target), /Factory did not answer this attempt's choice/, "another attempt's answer is not this one's");
  } finally {
    if (prior === undefined) delete globalThis.window; else globalThis.window = prior;
  }
});
