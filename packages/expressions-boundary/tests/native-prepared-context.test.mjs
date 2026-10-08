/** Real production binding/negative owner-reading checks. No successful native
 * reply, provider effect or delivered context is manufactured by this suite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preparedContextCurrent, preparedContextScopeKey, preparedContextSession, readDeliveredContext} from '../../live-shell/ui/src/native/preparedContextBinding.ts';
const archive='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const scope={workspaceId:'retained-workspace',accessEpoch:4,project:'O-I',sourceWorldRef:'world:source-owner',accompanying:{project:'O-I',ref:'agent-session:captured',space:'space:captured'}};

test('binding carries the disclosed World/project/session/space without selecting or preparing anything',()=>{
  assert.deepEqual(preparedContextSession(scope),{...scope.accompanying,sourceWorldRef:scope.sourceWorldRef});
  assert.equal(preparedContextSession({...scope,accompanying:undefined}),undefined);
  assert.equal(preparedContextSession({...scope,project:'',accompanying:undefined}),undefined,'Central empty project spelling remains explicit, never O-I fallback');
});
test('each actual destination dimension changes the retained key',()=>{
  const key=preparedContextScopeKey(scope);
  for(const next of [{workspaceId:'other'},{accessEpoch:5},{sourceWorldRef:'world:other'},{project:'other',accompanying:{...scope.accompanying,project:'other'}},{accompanying:{...scope.accompanying,ref:'agent-session:other'}},{accompanying:{...scope.accompanying,space:'space:other'}}]) assert.notEqual(preparedContextScopeKey({...scope,...next}),key);
});
test('foreign project and malformed admission basis refuse instead of inventing a destination',()=>{
  for(const next of [{workspaceId:''},{accessEpoch:NaN},{accessEpoch:-1},{accessEpoch:0.5},{sourceWorldRef:''},{accompanying:{...scope.accompanying,project:'other'}},{accompanying:{...scope.accompanying,ref:''}},{accompanying:{...scope.accompanying,space:''}}]) assert.throws(()=>preparedContextSession({...scope,...next}));
});
test('retired/hidden/unmounted destination blocks interaction qualification and late presentation',()=>{
  const key=preparedContextScopeKey(scope);
  assert.equal(preparedContextCurrent(scope,key,()=>true,true,true),true);
  for(const [current,mounted,visible] of [[false,true,true],[true,false,true],[true,true,false]]) assert.equal(preparedContextCurrent(scope,key,()=>current,mounted,visible),false);
  assert.equal(preparedContextCurrent({...scope,accessEpoch:5},key,()=>true,true,true),false);
  assert.equal(preparedContextCurrent({...scope,accompanying:{...scope.accompanying,ref:'agent-session:new'}},key,()=>true,true,true),false);
});
test('absence is not fabricated into a delivered empty list or an implicit session',()=>{
  assert.equal(readDeliveredContext(scope,undefined),undefined);
  assert.equal(readDeliveredContext(scope,{agent_session:scope.accompanying.ref}),undefined);
  assert.equal(readDeliveredContext({...scope,accompanying:undefined},{agent_session:scope.accompanying.ref}),undefined);
});
test('wrong session and malformed receipt fields fail before display',()=>{
  assert.throws(()=>readDeliveredContext(scope,{agent_session:'agent-session:foreign',prepared_context_receipts:[]}),/another native conversation/);
  for(const receipts of [null,{},[null],[{cursor:NaN}],[{cursor:0,revision:0,digest:'blake3:',standing:'unknown',items:[]}],[{cursor:0,revision:0,digest:'not-native',standing:'unknown',items:[]}]]) assert.throws(()=>readDeliveredContext(scope,{agent_session:scope.accompanying.ref,prepared_context_receipts:receipts}),/malformed/);
});
test('duplicate/corrupt native item identities never become delivered source provenance',()=>{
  const item={id:'item:malformed-check',title:'Carried',source_ref:'source:malformed-check'};
  for(const items of [[item,item],[{...item,source_revision:7}],[{...item,source_ref:''}],[{...item,id:''}]]) assert.throws(()=>readDeliveredContext(scope,{agent_session:scope.accompanying.ref,prepared_context_receipts:[{cursor:0,revision:0,digest:'blake3:malformed-check',standing:'invalid-input-test-only',items}]}),/malformed/);
});
test('actual archived rich Expression inspection cannot be relabelled as an Encounter receipt',async()=>{
  const receipt=JSON.parse(await readFile(archive,'utf8'));
  assert.deepEqual(receipt.before.document,receipt.after.document);
  assert.throws(()=>readDeliveredContext(scope,receipt.before),/another native conversation/);
  assert.throws(()=>readDeliveredContext(scope,receipt.before.document),/another native conversation/);
});
