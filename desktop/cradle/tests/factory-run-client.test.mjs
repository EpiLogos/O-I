import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {readings} from './factory-run-fixture.mjs';
import {composeRunExpression} from '../src/contributions/factory/run-expression.ts';
import {openNativeRunExpression,FactoryRunActionSession} from '../src/contributions/factory/run-expression-client.ts';

async function host(t,change=()=>{}) {
  const inputs=readings();const document=composeRunExpression(inputs,'expression:factory-client');
  const snapshot={...inputs,document,attemptAvailability:'available'};const calls=[];
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);const op=JSON.parse(Buffer.concat(chunks));calls.push(op);
    const request=op.request;
    let data=op.op==='expression'?(request.operation==='invoke'?{state:'action_result',action_ref:request.action_ref,target_ref:inputs.run.runRef,dispatch:{state:'owner_refused',message:'actual native refusal specimen'}}:{state:'ready',document}):op.op==='factory_attempt_read'?inputs.attempt:op.read==='run'?inputs.run:inputs.units;
    let body={ok:true,outcome:{result:op.op==='expression'?'expression':op.op==='factory_attempt_read'?'factory_attempt_reading':'factory_development_reading',data}};
    body=await change(structuredClone(body),op,calls,inputs)??body;
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(body));
  });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {snapshot,document,calls,transport:{kind:'bridge',url:`http://127.0.0.1:${server.address().port}`}};
}
test('open and inspect round-trip through existing production kernel transport',async t=>{
  const h=await host(t);assert.deepEqual(await openNativeRunExpression(h.transport,h.snapshot,'actor:local'),h.document);
  assert.deepEqual(h.calls.map(c=>c.request.operation),['open','inspect']);
});
for(const operation of ['open','inspect'])test(`disconnected ${operation} cannot certify a native presentation`,async t=>{
  const h=await host(t,(body,op)=>op.request?.operation===operation?{ok:false,error:`disconnected ${operation}`} :body);
  await assert.rejects(openNativeRunExpression(h.transport,h.snapshot,'actor:local'),/disconnected/);
});
test('a nominal successful open cannot return a different native Run',async t=>{
  const h=await host(t,(body,op)=>{if(op.request?.operation==='open')body.outcome.data.document.entities['expression:factory-client:entity:run'].subject.subject_ref='run:wrong';return body;});
  await assert.rejects(openNativeRunExpression(h.transport,h.snapshot,'actor:local'),/does not match/);
});
test('native revision conflict is preserved and never overwritten',async t=>{
  const h=await host(t,(body,op)=>{if(op.request?.operation==='open')body.outcome.data={state:'revision_conflict',current_revision:7};return body;});
  await assert.rejects(openNativeRunExpression(h.transport,h.snapshot,'actor:local'),error=>error.receipt?.current_revision===7);assert.equal(h.calls.length,1);
});
test('explicit Action carries the SAME target, original opaque input and native refusal',async t=>{
  const h=await host(t);const session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  const input={contract:'native.authority-request/v1',projectionRef:'occasion:one',nativeAuthority:{ref:'authority:actual'}};
  const result=await session.invoke('action:inspect',input);assert.equal(result.state,'owner-result');assert.equal(result.receipt.dispatch.state,'owner_refused');
  const invoke=h.calls.at(-1);assert.equal(invoke.op,'expression');assert.equal(invoke.request.operation,'invoke');assert.equal(invoke.request.entity_ref,'expression:factory-client:entity:run');assert.deepEqual(invoke.request.input,input);
  await assert.rejects(session.invoke('action:inspect',input),/requires refresh/);assert.equal(h.calls.filter(c=>c.request?.operation==='invoke').length,1);
});
test('undisclosed candidate Action cannot be requested against the Run',async t=>{
  const h=await host(t);const session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  await assert.rejects(session.invoke('action:recognise',{}),/not disclosed/);assert.equal(h.calls.length,0);
});
test('a changed Factory basis prevents dispatch rather than silently re-admitting work',async t=>{
  const h=await host(t,(body,op)=>{if(op.read==='run')body.outcome.data.destination='Changed required difference';return body;});
  const session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  await assert.rejects(session.invoke('action:inspect',{}),/changed/);assert.equal(h.calls.filter(c=>c.request).length,0);
});
test('stale retained workflow cannot request an effect',async t=>{
  const h=await host(t);h.snapshot.attempt.sourceCurrent=false;const session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  await assert.rejects(session.invoke('action:inspect',{}),/source is stale/);assert.equal(h.calls.length,0);
});
test('disconnected Action handler and unknown effect cannot be replayed automatically',async t=>{
  const h=await host(t,(body,op)=>op.request?.operation==='invoke'?{ok:false,error:'handler disconnected after send; effect unknown'}:body);
  const session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  await assert.rejects(session.invoke('action:inspect',{}),/effect unknown/);
  await assert.rejects(session.invoke('action:inspect',{}),/requires refresh/);assert.equal(h.calls.filter(c=>c.request).length,1);
});
test('wrong-target Action result is retained as error, not successful completion',async t=>{
  const h=await host(t,(body,op)=>{if(op.request?.operation==='invoke')body.outcome.data.target_ref='run:wrong';return body;});
  const session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  await assert.rejects(session.invoke('action:inspect',{}),error=>error.receipt?.target_ref==='run:wrong');
});
test('late native Action receipt survives disposal without becoming current success',async t=>{
  let session;const h=await host(t,(body,op)=>{if(op.request?.operation==='invoke')session.dispose();return body;});
  session=new FactoryRunActionSession(h.transport,h.snapshot,h.document,null);
  const result=await session.invoke('action:inspect',{});assert.equal(result.state,'late-result');assert.equal(result.receipt.dispatch.state,'owner_refused');
});
test('essential Run handler removal prevents an Action even after a successful open',async t=>{
  const h=await host(t,(body,op)=>op.read==='run'?{ok:false,error:'essential Run reader disconnected'}:body);
  const document=await openNativeRunExpression(h.transport,h.snapshot,'actor:local');const session=new FactoryRunActionSession(h.transport,h.snapshot,document,null);
  await assert.rejects(session.invoke('action:inspect',{}),/essential Run reader/);assert.equal(h.calls.filter(c=>c.request?.operation==='invoke').length,0);
});
