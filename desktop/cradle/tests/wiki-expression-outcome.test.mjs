import test from 'node:test';
import assert from 'node:assert/strict';
import {ExpressionOperationFailure, requireExpressionOutcome} from '../src/knowledge/expressionOutcome.ts';
import {expressionOperation} from '../src/knowledge/constructionProjection.ts';

test('owner refusal remains actionable rather than a generic missing-readback message', () => {
  const result = {state:'save_refused', failure:{kind:'refused',message:'Unknown ordinary-file creation field'}};
  assert.throws(() => requireExpressionOutcome(result,'save_as'), error => {
    assert.ok(error instanceof ExpressionOperationFailure);
    assert.match(error.message,/Unknown ordinary-file creation field/);
    assert.equal(error.state,'save_refused');
    assert.equal(error.persisted,undefined,'absence of acknowledgement is not proof of no effect');
    assert.equal(error.result,result);
    return true;
  });
});
test('a saved effect with failed readback retains its receipt and is not replayed', () => {
  const result = {state:'saved_readback_failed',persisted:true,error:'Native source changed before readback',file:{revision:'r8'}};
  assert.throws(() => requireExpressionOutcome(result,'save_as'), error => {
    assert.equal(error.persisted,true);assert.equal(error.result.file.revision,'r8');
    assert.match(error.message,/Inspect its native file before any retry/);return true;
  });
});
test('revision and proposal conflicts are surfaced without implicit reconciliation', () => {
  for (const state of ['file_revision_conflict','revision_conflict','proposal_basis_conflict']) {
    assert.throws(() => requireExpressionOutcome({state},'save'),/pending intent has not been rebased/);
  }
  for (const state of ['ready','saved','opened','read','exported']) {
    assert.doesNotThrow(() => requireExpressionOutcome({state},'inspect'));
  }
});
test('the production client recognises domain refusal through an otherwise successful kernel outcome', async () => {
  let calls=0;
  const apply=async () => {calls++;return {result:'expression',data:{state:'save_refused',failure:{message:'Destination is read-only'}}};};
  await assert.rejects(expressionOperation({kind:'unavailable',reason:'not used'},{operation:'inspect',expression_ref:'expression:test'},apply),/Destination is read-only/);
  assert.equal(calls,1,'failure handling does not submit a retry');
});
