import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

const root=new URL('../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText}}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{NativeWorking,validateWorkingRecord},{DocumentStore},{prepareCompositionEdit},typescript]=await Promise.all([import(new URL('nativeWorking.ts',author)),import(new URL('store.ts',author)),import(new URL('kernelComposition.ts',author)),import(compiler)]);
const ts=typescript.default,text=await readFile(new URL('nativeRecovery.ts',author),'utf8'),source=ts.createSourceFile('nativeRecovery.ts',text,ts.ScriptTarget.Latest,true);
const declarations=source.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name).map(n=>n.getText(source).replace(/^export /,''));
const body=ts.transpileModule(declarations.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const base='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/';
const oldInput=JSON.parse(await readFile(base+'material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-native-checkpoint-2f475867-1745-4f6a-b2ff-8689da24dff9.json','utf8'));
const checkpointInput=JSON.parse(await readFile(base+'native-recovery-checkpoint-read-20261008.json','utf8'));
const draftInput=JSON.parse(await readFile(base+'native-recovery-draft-read-20261008.json','utf8'));
for(const input of [checkpointInput,draftInput]) {assert.equal(input.response.ok,true);assert.equal(input.response.outcome.result,'expression_recovery');assert.equal(input.response.outcome.data.state,'ready')}
const checkpoint=checkpointInput.response.outcome.data.record,draft=draftInput.response.outcome.data.record,old=oldInput.checkpoint;
assert.equal(old.id,checkpoint.id);assert.ok(old.revision<checkpoint.revision);
const address=row=>`${row.scope}:${row.kind}:${row.id}`;
const closed=Error('Native mutation is outside this read-only source verification');
function receiving(write=async()=>{throw closed},readInputs=[checkpointInput,draftInput]) {
  const state={revisions:new Map([[address(checkpoint),old.revision]]),queues:new Map(),readReceipts:new WeakMap(),latestReadRevisions:new Map()};
  const requests=[];
  const nativeRecoveryRequest=async request=>{
    requests.push(structuredClone(request));
    if(request.operation!=='read')return write(request);
    const input=readInputs.find(row=>JSON.stringify(row.request.request)===JSON.stringify(request));
    assert.ok(input,'every reading must have an actual archived native receipt');return structuredClone(input.response.outcome.data);
  };
  const bindings={...state,nativeRecoveryRequest,key:(scope,kind,id)=>`${scope}:${kind}:${id}`};
  const api=new Function(...Object.keys(bindings),body+'\nreturn {nativeRead,nativeWrite,validateNativeRecoveryBasis,acceptNativeRecoveryBasis};')(...Object.values(bindings));
  return {...state,...api,requests};
}

test('browsing a genuine newer checkpoint preserves captured CAS until explicit current adoption',async()=>{
  const r=receiving(),read=await r.nativeRead('checkpoint',checkpoint.id,checkpoint.scope);
  assert.deepEqual(read,checkpoint);assert.equal(r.revisions.get(address(checkpoint)),old.revision);
  await assert.rejects(r.nativeWrite('checkpoint',checkpoint.id,read.value,checkpoint.scope),error=>error===closed);
  assert.equal(r.requests.at(-1).expected_revision,old.revision);
  r.acceptNativeRecoveryBasis([read],()=>true);assert.equal(r.revisions.get(address(checkpoint)),checkpoint.revision);
  await assert.rejects(r.nativeWrite('checkpoint',checkpoint.id,read.value,checkpoint.scope),error=>error===closed);
  assert.equal(r.requests.at(-1).expected_revision,checkpoint.revision);
});

test('recovery adoption refuses copied or mutated receipt metadata and remains atomic across exact draft/checkpoint',async()=>{
  const r=receiving(),read=await r.nativeRead('checkpoint',checkpoint.id,checkpoint.scope),draftRead=await r.nativeRead('draft',draft.id,draft.scope);
  const before=new Map(r.revisions);
  assert.throws(()=>r.validateNativeRecoveryBasis([structuredClone(read)],()=>true),/exact native recovery record/);
  assert.throws(()=>r.acceptNativeRecoveryBasis([structuredClone(read)],()=>true),/exact native recovery record/);
  read.revision++;assert.throws(()=>r.acceptNativeRecoveryBasis([draftRead,read],()=>true),/exact native recovery record/);
  assert.deepEqual(r.revisions,before);read.revision--;
  const title=read.value.view.document.title;read.value.view.document.title+=' changed after read';
  assert.throws(()=>r.acceptNativeRecoveryBasis([draftRead,read],()=>true),/record body changed/);
  assert.deepEqual(r.revisions,before);read.value.view.document.title=title;
  assert.throws(()=>r.acceptNativeRecoveryBasis([read,read],()=>true),/only once/);
  assert.deepEqual(r.revisions,before);
  r.acceptNativeRecoveryBasis([read,draftRead],()=>true);
  assert.equal(r.revisions.get(address(checkpoint)),checkpoint.revision);assert.equal(r.revisions.get(address(draft)),draft.revision);
});

test('exact receipt preflight is read-only and acceptance rechecks immutable body and live current guard',async()=>{
 const r=receiving(),read=await r.nativeRead('checkpoint',checkpoint.id,checkpoint.scope),draftRead=await r.nativeRead('draft',draft.id,draft.scope),before=new Map(r.revisions);
 assert.equal(r.validateNativeRecoveryBasis([read,draftRead],()=>true),undefined);assert.deepEqual(r.revisions,before);
 draftRead.value.name+=' changed after preflight';
 assert.throws(()=>r.acceptNativeRecoveryBasis([read,draftRead],()=>true),/record body changed/);assert.deepEqual(r.revisions,before);
 draftRead.value.name=draft.value.name;
 assert.throws(()=>r.acceptNativeRecoveryBasis([read,draftRead],()=>false),/no longer current/);assert.deepEqual(r.revisions,before);
 r.acceptNativeRecoveryBasis([read,draftRead],()=>true);assert.equal(r.revisions.get(address(checkpoint)),checkpoint.revision);
});

test('retired adoption callback and a superseded genuine read cannot consume the held basis',async()=>{
  const r=receiving(),read=await r.nativeRead('checkpoint',checkpoint.id,checkpoint.scope);
  assert.throws(()=>r.acceptNativeRecoveryBasis([read],()=>false),/no longer current/);
  let checks=0;assert.throws(()=>r.acceptNativeRecoveryBasis([read],()=>++checks===1),/adoption changed/);
  assert.equal(r.revisions.get(address(checkpoint)),old.revision);
  // Replay a distinct genuine earlier read token; no revision or response is
  // invented. A later actual checkpoint receipt supersedes that revision.
  const earlier=oldInput.receipts.find(row=>row.request?.operation==='read'&&row.reply?.outcome?.data?.record?.revision===old.revision);
  assert.ok(earlier,'prior owner checkpoint receipt includes its exact read');
  const inputs=[{request:{request:earlier.request},response:earlier.reply}],second=receiving(undefined,inputs);
  const earlierRecord=await second.nativeRead('checkpoint',checkpoint.id,checkpoint.scope);
  inputs[0]=checkpointInput;await second.nativeRead('checkpoint',checkpoint.id,checkpoint.scope);
  assert.throws(()=>second.validateNativeRecoveryBasis([earlierRecord],()=>true),/newer recovery reading/);
  assert.throws(()=>second.acceptNativeRecoveryBasis([earlierRecord],()=>true),/newer recovery reading/);
  assert.equal(second.revisions.get(address(checkpoint)),old.revision);
});

test('an active exact-address write prevents adoption until its returning operation settles',async()=>{
  let reject;const pending=new Promise((_,r)=>{reject=r});const r=receiving(()=>pending),read=await r.nativeRead('checkpoint',checkpoint.id,checkpoint.scope);
  const writing=r.nativeWrite('checkpoint',checkpoint.id,read.value,checkpoint.scope);
  await new Promise(resolve=>setImmediate(resolve));
  assert.throws(()=>r.validateNativeRecoveryBasis([read],()=>true),/write is still returning/);
  assert.throws(()=>r.acceptNativeRecoveryBasis([read],()=>true),/write is still returning/);
  assert.equal(r.revisions.get(address(checkpoint)),old.revision);
  reject(closed);await assert.rejects(writing,error=>error===closed);
  r.acceptNativeRecoveryBasis([read],()=>true);assert.equal(r.revisions.get(address(checkpoint)),checkpoint.revision);
});

test('real NativeWorking checkpoint refusal retains rich local draft and dispatches no composition effect',async()=>{
  const r=receiving(),read=await r.nativeRead('checkpoint',checkpoint.id,checkpoint.scope),record=validateWorkingRecord(read.value,read.value.view.journey);
  const store=new DocumentStore(record.view.journey),local=structuredClone(store.document);
  local.scenes[0].entities[0].sequence.steps[0].hold=2.45;store.replace(local);
  const submitted={journey:structuredClone(store.document),sceneId:local.scenes[0].id,entityId:local.scenes[0].entities[0].id};
  assert.ok(prepareCompositionEdit(record.view,submitted.journey).changes.length);
  const work=new NativeWorking({checkpoint:(_id,value)=>r.nativeWrite('checkpoint',checkpoint.id,value,checkpoint.scope),expression:()=>assert.fail('An unretained checkpoint must not dispatch a native edit'),file:()=>assert.fail('No file mutation'),mint:()=>assert.fail('No new native identity')});
  work.restore(record,record.view.journey);const before=work.state;
  await assert.rejects(work.commit(submitted),error=>error===closed);
  assert.deepEqual(work.state,before);assert.deepEqual(store.document,submitted.journey);assert.equal(store.undoStack.length,1);
  assert.equal(r.requests.at(-1).expected_revision,old.revision);assert.equal(r.requests.at(-1).value.pending.kind,'edit');
  assert.deepEqual(r.requests.at(-1).value.pending.submitted.journey,submitted.journey);
  assert.deepEqual(store.document.scenes[0].entities[0].sequence.steps[0].layers,record.view.journey.scenes[0].entities[0].sequence.steps[0].layers);
});
