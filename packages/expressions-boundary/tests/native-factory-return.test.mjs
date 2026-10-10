/** Real production readers with the native channel closed. Archived native
 * Expression material is a negative input, not an accepted Factory receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
const {readNativeRunReturn,readRunReturn,readNativeRecognitionReceipt,recogniseRunReturn,runReturnTargetKey}=await import('../../../desktop/cradle/src/contributions/factory/desk/runReturnReading.ts');
const transport={kind:'unavailable',reason:'Actual Factory Return channel is closed for source verification.'};
const target={statePath:'retained-source',projectRef:'retained-project',runRef:'retained-run',attemptRef:'retained-attempt'};
const recognition={statePath:target.statePath,journeyRef:'retained-journey',subjectRef:'retained-return',basisRefs:['retained-evidence']};
test('real shared Run publication guard retires a replaced Desk or entry, including an equal-ref refresh',async()=>{
  const {captureRunEntryRead}=await import('../../../desktop/cradle/src/contributions/factory/desk/deskStore.ts');
  const archived=JSON.parse(await readFile(new URL('../../../desktop/cradle/tests/fixtures/factory-live-events.json',import.meta.url),'utf8'));
  assert.match(archived.source,/Owner-produced readings/);
  const native=archived.attemptReadings.at(-1),key=native.runRef;
  // Local projection wrappers retain actual archived native identities and
  // records. They are not native Run or Return replies, nor an IO fake.
  const entry={run:{runRef:native.runRef,revision:native.runRevision},inspection:native};
  const original={scopeKey:'archived-owner-model',status:'read',refused:[],runs:{[key]:entry}};
  let reading=original,live=true;
  const current=captureRunEntryRead(()=>reading,key,()=>live);
  assert.equal(current(),true);
  reading={...original};assert.equal(current(),false,'new Desk snapshot cannot receive the old async publication');
  reading=original;original.runs[key]=structuredClone(entry);assert.equal(current(),false,'equal refs do not revive another native cut');
  original.runs[key]=entry;live=false;assert.equal(current(),false);
  assert.equal(captureRunEntryRead(()=>undefined,key)(),false);
  assert.deepEqual(native,archived.attemptReadings.at(-1));
});
test('an incomplete target refuses before any Return read',async()=>{
  for(const key of Object.keys(target)){
    const changed={...target,[key]:''};assert.throws(()=>runReturnTargetKey(changed),/exact source/);
    await assert.rejects(readRunReturn(transport,changed,()=>true),/exact source/);
  }
});
test('retired read and recognition refuse predispatch with exact material still held',async()=>{
  const before=structuredClone({target,recognition});
  await assert.rejects(readRunReturn(transport,target,()=>false),/retired before/);
  await assert.rejects(recogniseRunReturn(transport,recognition,()=>false),/no request was sent/);
  assert.deepEqual({target,recognition},before);
});
test('actual native closed transport refusal cannot become a Return or Recognition receipt',async()=>{
  await assert.rejects(readRunReturn(transport,target,()=>true),/Actual Factory Return channel is closed/);
  await assert.rejects(recogniseRunReturn(transport,recognition,()=>true),/Actual Factory Return channel is closed/);
});
test('malformed and foreign owner envelopes cannot become this Return material',()=>{
  for(const value of [null,{}, {contract:'factory.attempt-return-reading/v1',runRef:'foreign'}, {contract:'factory.workflow-inspection/v1',runRef:target.runRef},{contract:'factory.attempt-return-reading/v1',projectRef:target.projectRef,runRef:target.runRef,revision:NaN}])assert.throws(()=>readNativeRunReturn(value,target),/exact native/);
});
test('transport status or an unrelated native receipt never fabricates Recognition',()=>{
  for(const value of [null,{}, {status:'applied'}, {contract:'factory.developmental-mutation-receipt/v1',status:'applied',record:{}},{contract:'factory.developmental-mutation-receipt/v1',status:'recorded'}])assert.throws(()=>readNativeRecognitionReceipt(value,recognition),/exact Journey\/Return/);
});
test('bad evidence scope refuses before Recognition dispatch without changing original refs',async()=>{
  for(const basisRefs of [[''],['same','same'],[()=>true],[NaN]])await assert.rejects(recogniseRunReturn(transport,{...recognition,basisRefs},()=>true),/actual Journey/);
  assert.deepEqual(recognition.basisRefs,['retained-evidence']);
});
test('actual archived rich native reading is retained losslessly and cannot become a Factory Return',async()=>{
  const raw=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json','utf8'));
  assert.deepEqual(raw.before.document,raw.after.document);
  assert.throws(()=>readNativeRunReturn(raw.before,target),/exact native/);
  assert.throws(()=>readNativeRecognitionReceipt(raw.before,recognition),/exact Journey\/Return/);
});
