import test from 'node:test';
import assert from 'node:assert/strict';
import {ExpressionOperationFailure} from '../src/knowledge/expressionOutcome.ts';
import {ExpressionSaveError, requireSavedExpression} from '../src/knowledge/expressionSaveReceipt.ts';
import {performArtifactSave, inspectArtifactSave} from '../src/knowledge/artifactRecovery.ts';
const location={schema:'central.path-ref/v1',root:'/ground',path:'work.json',ref:'central:path:ground:work.json'};
const success={state:'saved',persisted:true,readback_verified:true,file:{location,revision:'file:r1'}};

test('save refusal reports the native diagnostic rather than an unexplained missing button',()=>{
 const result={state:'save_refused',owner_operation:'central.files.create',failure:{kind:'refused',message:'Unknown ordinary-file creation field'}};
 assert.throws(()=>requireSavedExpression(result),error=>error instanceof ExpressionOperationFailure
  && error.state==='save_refused' && error.persisted===undefined
  && error.message.includes('central.files.create')
  && error.message.includes('Unknown ordinary-file creation field')
  && error.result===result);
});

test('an acknowledged write with failed readback is not represented as unsaved or replayed',()=>{
 assert.throws(()=>requireSavedExpression({state:'saved_readback_failed',persisted:true,owner_operation:'central.files.create',error:'Source changed before readback'}),error=>
  error instanceof ExpressionOperationFailure && error.persisted===true && error.message.includes('owner reports a saved effect') && error.message.includes('Source changed before readback'));
});

test('saved transport state alone is not verified native persistence',()=>{
 assert.doesNotThrow(()=>requireSavedExpression(success));
 for(const bad of [{...success,readback_verified:false},{...success,persisted:false},{...success,file:undefined},{...success,file:{location,revision:''}},{...success,file:{location:{...location,root:''},revision:'r1'}}]){
  assert.throws(()=>requireSavedExpression(bad),ExpressionSaveError);
 }
 const error=new ExpressionSaveError({state:'save_refused',data:{content:'PRIVATE_SOURCE_MUST_NOT_BE_LOGGED',error:{message:'Access denied'}}});
 assert.ok(error.message.includes('Access denied'));assert.ok(!error.message.includes('PRIVATE_SOURCE'));
});

test('refused save keeps the exact request identity and never starts independent readback or retries',async()=>{
 const document={schema:'oi.expression/v1',expression_ref:'expression:a',revision:2,entities:{},relations:{}};
 const intent={schema:'oi.wiki-artifact-save/v1',document,destination:{parent:location,name:'saved.json',operation_ref:'operation:unchanged'}};
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(_url,options)=>{const op=JSON.parse(options.body);calls.push(op);
  const data=op.request.operation==='inspect'?{state:'read',document}:{state:'save_refused',owner_operation:'central.files.create',failure:{kind:'refused',message:'Unknown ordinary-file creation field'}};
  return {json:async()=>({ok:true,outcome:{result:'expression',data}})};
 };
 try{
  await assert.rejects(performArtifactSave({kind:'bridge',url:'http://controlled.invalid'},intent),/Unknown ordinary-file creation field/);
  assert.equal(calls.length,2);assert.equal(calls[1].request.operation_ref,'operation:unchanged');assert.equal(intent.destination.operation_ref,'operation:unchanged');
 }finally{globalThis.fetch=original;}
});

test('a successful receipt must agree with the independently read destination',async()=>{
 const document={schema:'oi.expression/v1',expression_ref:'expression:a',revision:2,entities:{},relations:{}};
 const intent={schema:'oi.wiki-artifact-save/v1',document,destination:{location,revision:'file:previous'}};
 const original=globalThis.fetch;let writes=0;
 globalThis.fetch=async(_url,options)=>{
  const op=JSON.parse(options.body);
  const outcome=op.op==='file_read'?{result:'file_read',reading:{location,revision:'file:changed-again',content:JSON.stringify(document)}}:
   {result:'expression',data:op.request.operation==='inspect'?{state:'read',document}:(writes++,success)};
  return {json:async()=>({ok:true,outcome})};
 };
 try{
  await assert.rejects(performArtifactSave({kind:'bridge',url:'http://controlled.invalid'},intent),/receipt and independent file reading disagree/);
  assert.equal(writes,1,'readback disagreement never retries a write');
 }finally{globalThis.fetch=original;}
});


test('read-only pending-save inspection refuses a redirected file even if its document matches',async()=>{
 const document={schema:'oi.expression/v1',expression_ref:'expression:a',revision:2,entities:{},relations:{}};
 const intent={schema:'oi.wiki-artifact-save/v1',document,destination:{location,revision:'file:r1'}};
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body));return {json:async()=>({ok:true,outcome:{result:'file_read',reading:{location:{...location,root:'/elsewhere'},revision:'r1',content:JSON.stringify(document)}}})};};
 try{
  await assert.rejects(inspectArtifactSave({kind:'bridge',url:'http://controlled.invalid'},intent),/redirected/);
  assert.equal(calls.length,1);assert.equal(calls[0].op,'file_read');
 }finally{globalThis.fetch=original;}
});
