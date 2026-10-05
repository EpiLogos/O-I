import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {blankScene,entity} from '../expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {emptyRetention} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';
import {validateSourceReply} from '../expressions-app/field-studies-journeys/src/proceduralSources.ts';
import {validatePendingProcedure,validateProceduralReply,proceduralReplyView,preparationRetryView} from '../expressions-app/field-studies-journeys/src/proceduralWorking.ts';

// Controlled authored/native wire inputs below test refusal only. They are
// never presented as compiled production, an applied receipt or owner ACK.
const expression='expression:independent-working',sceneRef=expression+':scene:main',entityRef=expression+':entity:body';
const scene=blankScene('Existing native recovery');scene.id=sceneRef;scene.entities=[entity('Body','O')];scene.entities[0].id=entityRef;
const original={schema:'oi.expression/v1',expression_ref:expression,revision:1,title:'Independent recovery',
  scenes:[{scene_ref:sceneRef,revision:1,title:scene.name,entity_refs:[entityRef],presentation:{schema:'oi.journey-scene/v1',scene,saved:null}}],
  entities:{[entityRef]:{entity_ref:entityRef,revision:1,title:'Body',subject:null,parameters:{scale:{value:1,automation:null}}}},
  relations:{},selection:{scene_ref:sceneRef,entity_ref:null},provenance:[],representations:[],refinements:[]};
const view=kernelDocumentToJourney(original);
const target={expression_ref:expression,scene_ref:sceneRef,entity_ref:entityRef,component:'entity',constituent_ref:null,property:'scale'};
function envelope(){return {operation_ref:'operation:independent-working',expression_ref:expression,expected_revision:1,
  actor:'agent:independent',scope:{kind:'addresses',addresses:[target]},sources:[],
  changes:[{change:'parameter_set',entity_ref:entityRef,parameter:'scale',value:2}],participants:[],timing:{kind:'immediate'},cause_ref:null};}
function operation(){const e=envelope();return {fingerprint:createHash('sha256').update(JSON.stringify(e)).digest('hex'),
  envelope:e,targets:[target],status:'prepared',accepted_revision:2,applied_revision:null,observations:[],failure:null};}
function sourceReply(){return {schema:'oi.expression-procedure-source-response/v1',native_result:{schema:'ql.scene-procedural-response/v1',operation:'prepare',result:{}},
  source:{schema:'oi.native-expression-composed-source/v1',ql_executable:'/invalid-controlled-input/ql',ql_selection:'installed',ql_revision:'controlled-negative-input',
    request_sha256:'a'.repeat(64),result_sha256:'b'.repeat(64),compiled_at_unix_ms:1}};}

test('A14 compiled source wire refuses wrong operation, missing revision and malformed executable/input/output provenance',()=>{
  for(const mutate of [r=>r.native_result.operation='regenerate',r=>r.native_result.schema='invented',
    r=>r.source.ql_revision=null,r=>r.source.ql_executable='relative/ql',r=>r.source.ql_selection='caller-defined',
    r=>r.source.request_sha256='not a digest',r=>r.source.result_sha256='a'.repeat(63),r=>r.source.compiled_at_unix_ms=0]){
    const r=sourceReply();mutate(r);assert.throws(()=>validateSourceReply(r,'prepare'));
  }
});

test('A05/A15 recovered prepare retains its exact original Expression and revision',()=>{
  for(const field of ['expression_ref','expected_revision']){
    const request={operation:'prepare',envelope:envelope()};
    request.envelope[field]=field==='expression_ref'?'expression:foreign':2;
    const p={kind:'procedural',request},before=structuredClone(p);
    assert.throws(()=>validatePendingProcedure(p,view),/basis|Expression|target/);assert.deepEqual(p,before);
  }
});

test('A05/A15 recovered action cannot invent or retarget its admitted operation identity',()=>{
  for(const mutate of [p=>delete p.accepted_operation,p=>p.request.operation_ref='operation:foreign',
    p=>p.accepted_operation.envelope.expression_ref='expression:foreign']){
    const p={kind:'procedural',request:{operation:'commit',operation_ref:operation().envelope.operation_ref},accepted_operation:operation()};
    mutate(p);const before=structuredClone(p);assert.throws(()=>validatePendingProcedure(p,view));assert.deepEqual(p,before);
  }
});

test('A05/A15 native receipt cannot change the full submitted intent or accepted fingerprint',()=>{
  for(const kind of ['submitted_intent','operation_id','accepted_fingerprint','conflict']){
    const op=operation(),pending={kind:'procedural',request:{operation:'prepare',envelope:envelope()}},reply={schema:'oi.expression-procedural/v1',operation:op};
    if(kind==='submitted_intent')op.envelope.changes[0].value=3;
    if(kind==='operation_id')op.envelope.operation_ref='operation:foreign';
    if(kind==='accepted_fingerprint'){pending.request={operation:'commit',operation_ref:op.envelope.operation_ref};pending.accepted_operation=operation();op.fingerprint='c'.repeat(64);}
    if(kind==='conflict')reply.state='revision_conflict';
    const before=structuredClone(pending);assert.throws(()=>validateProceduralReply(reply,pending));assert.deepEqual(pending,before);
  }
});

test('A05/A13 unrelated readback cannot substitute for the unique typed native journal basis',()=>{
  for(const kind of ['foreign_expression','unrelated_revision','missing_journal','duplicate_journal','accepted_revision','fingerprint']){
    const op=operation(),document=structuredClone(original);document.revision=2;
    const r=emptyRetention();r.operations=[structuredClone(op)];document.scenes[0].presentation.scene.procedural=r;
    if(kind==='foreign_expression')document.expression_ref='expression:foreign';
    if(kind==='unrelated_revision')document.revision=3;
    if(kind==='missing_journal')r.operations=[];
    if(kind==='duplicate_journal')r.operations.push(structuredClone(op));
    if(kind==='accepted_revision')r.operations[0].accepted_revision=3;
    if(kind==='fingerprint')r.operations[0].fingerprint='d'.repeat(64);
    const before=structuredClone(original);assert.throws(()=>proceduralReplyView(view,{schema:'oi.expression-procedural/v1',operation:op},document));
    assert.deepEqual(original,before);
  }
});


function retryInputs(){
  const op=operation(),document=structuredClone(original);document.revision=op.accepted_revision;
  document.scenes[0].revision=op.accepted_revision;
  const retained=emptyRetention();retained.operations=[structuredClone(op)];document.scenes[0].presentation.scene.procedural=retained;
  return {request:{operation:'prepare',envelope:envelope()},reply:{schema:'oi.expression-procedural/v1',operation:op},document};
}

test('A05/A15 lost preparation retry refuses every changed original native intent',()=>{
  for(const [label,mutate]of [
    ['actor',e=>e.actor='agent:foreign'],['operation',e=>e.operation_ref='operation:foreign'],
    ['original revision',e=>e.expected_revision=2],['source',e=>e.sources=[{ref:'source:foreign',revision:'2',availability:'available'}]],
    ['scope',e=>e.scope={kind:'expression'}],['changes',e=>e.changes[0].value=3],
    ['cause',e=>e.cause_ref='event:foreign'],['producer',e=>e.producer_ref='procedure-source:'+'a'.repeat(64)],
    ['participant',e=>e.participants=[{owner:'oi.point-cloud-field',instance_ref:'instance:negative-input',required_generation:1,targets:[target]}]]
  ]){
    const input=retryInputs();mutate(input.request.envelope);const before=structuredClone(input);
    assert.throws(()=>preparationRetryView(input.request,view,input.reply,input.document),undefined,label);
    assert.deepEqual(input,before,'refused retry changed original retained inputs: '+label);
  }
});

test('A05/A13 preparation retry refuses missing, duplicate or changed original native journal',()=>{
  for(const label of ['missing','duplicate','different fingerprint','different accepted revision','different envelope']){
    const input=retryInputs(),rows=input.document.scenes[0].presentation.scene.procedural.operations;
    if(label==='missing')rows.splice(0);
    else if(label==='duplicate')rows.push(structuredClone(rows[0]));
    else if(label==='different fingerprint')rows[0].fingerprint='d'.repeat(64);
    else if(label==='different accepted revision')rows[0].accepted_revision=3;
    else{rows[0].envelope.actor='agent:foreign';rows[0].fingerprint=createHash('sha256').update(JSON.stringify(rows[0].envelope)).digest('hex');}
    const before=structuredClone(input);
    assert.throws(()=>preparationRetryView(input.request,view,input.reply,input.document),undefined,label);
    assert.deepEqual(input,before);
  }
});

test('A05/A15 preparation retry refuses changed journal lifecycle, resolved targets or failure',async t=>{
  for(const label of ['cancelled','interrupted','failed','resolved target','failure']){
    await t.test(label,()=>{
    const input=retryInputs(),retained=input.document.scenes[0].presentation.scene.procedural.operations[0];
    if(label==='resolved target')retained.targets=[{...target,property:'position.x'}];
    else if(label==='failure')retained.failure='actual owner unavailable';
    else retained.status=label;
    const before=structuredClone(input);
    assert.throws(()=>preparationRetryView(input.request,view,input.reply,input.document),undefined,label);
    assert.deepEqual(input,before);
    });
  }
});

test('A05/A15 preparation retry refuses later foreign activity and restored owner history',async t=>{
  for(const label of ['later revision','foreign Expression','restored history']){
    await t.test(label,()=>{
    const input=retryInputs();
    if(label==='later revision'){input.document.revision=3;input.document.entities[entityRef].parameters.scale.value=1.5;}
    else if(label==='foreign Expression')input.document.expression_ref='expression:foreign';
    else input.reply.restored=true;
    const before=structuredClone(input);
    assert.throws(()=>preparationRetryView(input.request,view,input.reply,input.document),undefined,label);
    assert.deepEqual(input,before);
    });
  }
});

test('A05/A07/A13 actual qualified native Application artifact reaches normal recovery/readback consumer',
  {skip:!process.env.TA_ONTA_OUTPUT_READING_NATIVE_ARTIFACT&&'UNEXECUTED: actual compiled producer + Application Prepare/Commit artifact required'},async()=>{
    const evidence=JSON.parse(await readFile(process.env.TA_ONTA_OUTPUT_READING_NATIVE_ARTIFACT,'utf8'));
    assert.equal(evidence.schema,'oi.procedural-native-consumer-evidence/v1');
    assert.equal(evidence.scope,'qualified native Application consumer test; installed host not exercised');
    const initial=kernelDocumentToJourney(evidence.accepted_document),pending={kind:'procedural',request:{operation:'commit',
      operation_ref:evidence.prepared_creation_operation.envelope.operation_ref},accepted_operation:evidence.prepared_creation_operation};
    validatePendingProcedure(pending,initial);
    const receipt=validateProceduralReply(evidence.native_commit_reply,pending);
    assert.deepEqual(receipt.operation,evidence.creation_operation);
    const actual=proceduralReplyView(initial,receipt,evidence.document);
    assert.equal(actual.document.revision,evidence.accepted_document.revision+1);
    assert.equal(actual.document.expression_ref,initial.document.expression_ref);
    assert.deepEqual(Object.keys(actual.entity_ids).sort(),Object.keys(evidence.document.entities).sort());
    assert.ok(evidence.output_readings.length);
    for(const reading of evidence.output_readings){
      assert.equal(reading.native_owner,'oi.expression');assert.equal(reading.document_revision,actual.document.revision);
      assert.deepEqual(reading.applied_operation,evidence.creation_operation);
      assert.ok(actual.document.scenes.some(s=>s.scene_ref===reading.occurrence_ref));
    }
  });
