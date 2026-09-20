import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {readings} from './factory-run-fixture.mjs';
import * as adapter from '../src/contributions/factory/run-expression.ts';
const er='expression:factory-regression';
const compose=input=>adapter.composeRunExpression(input,er);
const subjects=doc=>Object.values(doc.entities).map(e=>e.subject?.subject_ref);

test('native punctuation, reserved root and attempt names cannot overwrite entities',()=>{
  const data=readings(),before=structuredClone(data),doc=compose(data);
  assert.equal(doc.entities[`${er}:entity:run`].subject.subject_ref,data.run.runRef);
  for(const n of Object.values(data.run.runMap.nodes))assert.ok(subjects(doc).includes(`${data.run.runRef}#${n.id}`));
  assert.ok(subjects(doc).includes('a:b'));
  assert.ok(subjects(doc).includes('run:repair#a:b'));
  assert.ok(subjects(doc).includes('run:repair#a/b'));
  assert.deepEqual(data,before,'composition never mutates native readings');
});
test('every native edge preserves its actual endpoints and relation',()=>{
  const data=readings(),doc=compose(data);
  for(const edge of data.run.runMap.edges){
    const found=Object.values(doc.relations).find(r=>r.relation.ref===`factory.run-edge/${edge.relation}`&&doc.entities[r.from_entity_ref].subject.subject_ref===`${data.run.runRef}#${edge.from}`);
    assert.ok(found);assert.equal(doc.entities[found.to_entity_ref].subject.subject_ref,`${data.run.runRef}#${edge.to}`);
  }
});
test('every source/unit/attempt/session/tool-evidence/artifact/Return receiving link survives',()=>{
  const doc=compose(readings());const refs=subjects(doc);
  for(const ref of ['source:repair','unit:repair','source:repair#unit','a:b','attempt:retry','execution:repair','session:repair','operation:tool-result','evidence:tool','artifact:patch','artifact:retry','return:repair','return:retry','receiving:original','day:original','now:bounded','authority:actual','context:operative'])assert.ok(refs.includes(ref),ref);
  assert.ok(doc.scenes.filter(s=>s.scene_ref.includes(':scene:return')).flatMap(s=>s.entity_refs).length===2);
  const fromSubject=ref=>Object.entries(doc.entities).filter(([,e])=>e.subject?.subject_ref===ref).map(([id])=>id);
  const connected=(a,b)=>Object.values(doc.relations).some(r=>fromSubject(a).includes(r.from_entity_ref)&&fromSubject(b).includes(r.to_entity_ref));
  assert.ok(connected('source:repair','unit:repair'));assert.ok(connected('unit:repair','a:b'));assert.ok(connected('a:b','return:repair'));assert.ok(connected('return:repair','artifact:patch'));
});
test('duplicate and contrary receipts and verifications remain separate occurrences',()=>{
  const doc=compose(readings());const rels=Object.values(doc.relations).map(r=>r.relation.ref);
  for(const r of ['factory.correlation/owner-returned','factory.correlation/owner-uncertain','factory.correlation/verification-failed','factory.correlation/verification-passed'])assert.ok(rels.includes(r));
  assert.equal(subjects(doc).filter(ref=>ref==='receipt:result').length,4);
});
test('historical workflow remains stale and never relabels an old unit',()=>{
  const data=readings();data.attempt.sourceCurrent=false;data.units.units=data.units.units.filter(u=>u.workflowUnitRef!=='unit:repair');
  const doc=compose(data);assert.ok(subjects(doc).includes('unit:repair'));
  assert.ok(Object.values(doc.entities).some(e=>e.subject.readings.some(r=>r.ref==='factory.workflow-source/current'&&r.revision==='false')));
});
test('attempt-less topology is readable without inventing execution or Return',()=>{
  const data=readings();delete data.attempt;const doc=compose(data);
  assert.ok(subjects(doc).includes(data.run.runRef));assert.ok(!subjects(doc).includes('a:b'));
});
test('same Run validation refuses foreign, mixed-revision and malformed readings',()=>{
  for(const mutate of [d=>d.attempt.runRef='run:other',d=>d.run.runMap.runRef='run:other',d=>d.attempt.topologyRevision++,d=>d.attempt.runRevision++,d=>d.attempt.revision++,d=>d.units.projectRef='project:other',d=>d.units.provenance.buildStateRevision++,d=>d.attempt.attempts.push(structuredClone(d.attempt.attempts[0])),d=>d.run.runMap.edges[0].to='missing']){
    const data=readings();mutate(data);assert.throws(()=>compose(data));
  }
});
test('all entities are scene-addressable within current kernel budget',()=>{
  const doc=compose(readings()),placed=new Set(doc.scenes.flatMap(s=>s.entity_refs));
  for(const ref of Object.keys(doc.entities))assert.ok(placed.has(ref));
  assert.ok(doc.scenes.every(s=>s.entity_refs.length<=10));
  assert.ok(Object.values(doc.entities).every(e=>Object.keys(e.parameters).length===0));
});

// This exercises the actual production development.ts -> kernelOp -> HTTP
// transport, not a replacement developmentRead or a source-presence check.
async function bridge(t,change=()=>{}){
  const calls=[];const data=readings();
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const op=JSON.parse(Buffer.concat(chunks));calls.push(op);
    let body={ok:true,outcome:{result:op.op==='factory_attempt_read'?'factory_attempt_reading':'factory_development_reading',data:structuredClone(op.op==='factory_attempt_read'?data.attempt:op.read==='run'?data.run:data.units)}};
    body=change(body,op,calls,data)??body;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(body));
  });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {calls,data,transport:{kind:'bridge',url:`http://127.0.0.1:${server.address().port}`}};
}
test('production read path performs typed owner round trips and never dispatches on open',async t=>{
  const {calls,data,transport}=await bridge(t);const result=await adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er);
  assert.equal(result.document.entities[`${er}:entity:run`].subject.subject_ref,data.run.runRef);
  assert.equal(result.attemptAvailability,'available');assert.equal(calls.length,4);
  assert.ok(calls.every(c=>['factory_development_read','factory_attempt_read'].includes(c.op)&&c.state_path===data.statePath));
});
for(const disconnected of ['run','workflow-units','factory_attempt_read'])test(`essential ${disconnected} handler disconnected cannot pass`,async t=>{
  const {data,transport}=await bridge(t,(body,op)=>op.read===disconnected||op.op===disconnected?{ok:false,error:`disconnected ${disconnected}`} : body);
  await assert.rejects(adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er),/disconnected/);
});
test('only explicit native attempt absence permits a topology-only snapshot',async t=>{
  const {data,transport}=await bridge(t,(body,op)=>op.op==='factory_attempt_read'?{ok:false,error:'Run has no native attempt field'}:body);
  const result=await adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er);assert.equal(result.attemptAvailability,'missing');assert.match(result.attemptError,/no native attempt field/);
});
for(const error of ['authority denied','interrupted','stale native provider','late operation unknown'])test(`${error} is not normalised to empty success`,async t=>{
  const {data,transport}=await bridge(t,(body,op)=>op.op==='factory_attempt_read'?{ok:false,error}:body);
  await assert.rejects(adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er),new RegExp(error));
});
test('a wrong Run reply is rejected, not retried as if it were current',async t=>{
  const {data,transport,calls}=await bridge(t,(body,op)=>{if(op.op==='factory_attempt_read')body.outcome.data.runRef='run:foreign';return body;});
  await assert.rejects(adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er),/wrong-run/);assert.equal(calls.length,4);
});
test('a single source race is retried once with the rejected occasion retained',async t=>{
  const {data,transport,calls}=await bridge(t,(body,op,calls)=>{if(op.op==='factory_attempt_read'&&calls.length<5)body.outcome.data.runRevision=6;return body;});
  const result=await adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er);assert.equal(result.readConflicts.length,1);assert.equal(calls.length,8);
});
test('continuous mutation refuses after bounded reads, preserving both failed occasions',async t=>{
  const {data,transport,calls}=await bridge(t,(body,op)=>{if(op.op==='factory_attempt_read')body.outcome.data.runRevision=6;return body;});
  await assert.rejects(adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er),error=>error.code==='factory.expression.stale'&&error.readings.length===2);assert.equal(calls.length,8);
});
test('missing payload behind a nominal success is not an empty Run',async t=>{
  const {data,transport}=await bridge(t,(body,op)=>{if(op.op==='factory_attempt_read')delete body.outcome.data;return body;});
  await assert.rejects(adapter.readRunExpressionSnapshot(transport,data.statePath,data.run.runRef,er),/no reading or explicit native absence/);
});
