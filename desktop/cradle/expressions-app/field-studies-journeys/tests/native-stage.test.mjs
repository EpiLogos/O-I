// The InstrumentSession's admission of the Ta-Onta procedural stage's relayed
// operations (O-I #591 relay, PS-U first vertical): stage-state is a read (the
// field must not move), stage-evaluate is the host's own compiled plan (the
// generation must advance; samples and PCM must not) and its stage body is
// disclosed to the caller. Retire/bind/unbind are not studio-driven yet.
// Compiles nothing: the session module is plain ESM, driven through a scripted
// host transport with an inert audio context — no device, no PCM, no owner.
import test from 'node:test';import assert from 'node:assert/strict';
import {InstrumentSession} from '../src/native-field/ql/instrument-session.mjs';

const fakeContext=()=>({sampleRate:48000,currentTime:0,state:'running',
 createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),
 createBufferSource:()=>({connect(){},disconnect(){},start(){},stop(){}}),
 createBuffer:()=>({copyToChannel(){}}),
 addEventListener(){},removeEventListener(){}});

const frame=(over={})=>({schema:'ql.continuous-field/v1',sample_rate:48000,
 event_ref:'event:test',subject_ref:'subject:test',registry_revision:'1',
 geometry_ref:'geom:test',material_ref:'mat:test',model_ref:'model:test',
 generation:'1',samples_elapsed:'0',audio:[],targets:[],amplitudes_metres:[],
 clock:{centre_ref:'#3-5-5/0',field_ref:'#3-0'},m2_identity:{event_ref:'event:test'},standing:'test',...over});

// script: operation -> {field: frame overrides, stage: the stage body}
function makeSession(script){
 const sent=[];
 const transport={async request(envelope){
  sent.push(envelope);
  const step=script[envelope.command.operation];
  if(!step)throw new Error('script has no reply for '+envelope.command.operation);
  return {schema:'ql.field-host-receipt/v1',instance_ref:envelope.instance_ref,
   request_id:envelope.request_id,last_request_id:envelope.request_id,
   status:'ok',available:true,error:null,field:frame(step.field??{}),...(step.stage!==undefined?{stage:step.stage}:{})};
 }};
 const session=new InstrumentSession({context:fakeContext(),owner:{},transport,
  initialReceipt:{schema:'ql.field-host-receipt/v1',instance_ref:'test:instance',
   request_id:'0',last_request_id:'0',status:'ready',available:true,field:frame()},
  fieldBinding:{validate(){},apply(){}}});
 return {session,sent};
}

test('stage-state is a read: disclosed verbatim, field unchanged, not an act',async()=>{
 const {session,sent}=makeSession({'stage-state':{field:{},stage:{schema:'ql.stage-state/v1',subject_ref:'subject:test',slots:{form:{owner:null}}}}});
 const stage=await session.stageState();
 assert.equal(stage.schema,'ql.stage-state/v1');
 assert.deepEqual(sent[0].command,{operation:'stage-state'});
 assert.equal(session.reading.available,true,'a clean read leaves the lifetime whole');
 assert.equal(session.reading.acknowledged.generation,'1');
 assert.ok(!session.journal().acts.some(a=>a.operation==='stage-state'),'a disclosure read is not an owner act');
});

test('stage-state refuses a field that moved: reads never advance or reset',async()=>{
 const {session}=makeSession({'stage-state':{field:{generation:'2'}}});
 // The cursor law refuses first (an unchanged generation is the read contract);
 // the READ_OPERATIONS sameState law covers a moved basis at the same cursor.
 await assert.rejects(session.stageState(),/native cursor disagree|advanced or reset state/);
 assert.equal(session.reading.available,false,'an impossible read ends this lifetime');
});

test('stage-evaluate is admitted: the generation must advance, samples must not, the receipt is disclosed',async()=>{
 const {session,sent}=makeSession({'stage-evaluate':{field:{generation:'3'},stage:{schema:'ql.stage-receipt/v1',applied:true,contributions:[]}}});
 const reading=await session.operate({operation:'stage-evaluate',
  procedure:{schema:'ql.stage-procedure/v1',procedure_ref:'ta-onta:studio:first-vertical',revision:1,
   subject_ref:'subject:test',trigger:{trigger:'invocation'},selector:['material.damping'],
   changes:[{change:'damping',per_second:0.25}]}});
 assert.equal(reading.acknowledged.generation,'3');
 assert.equal(reading.acknowledged.samples_elapsed,'0','a plan never schedules data-plane samples');
 assert.equal(session.reading.available,true);
 const command=sent.find(e=>e.command.operation==='stage-evaluate').command;
 assert.equal(command.procedure.procedure_ref,'ta-onta:studio:first-vertical');
 const acts=session.journal().acts;
 assert.equal(acts.at(-1).operation,'stage-evaluate','an evaluation is an owner act');
});

test('a stage evaluation that did not advance the owner is a cursor disagreement',async()=>{
 const {session}=makeSession({'stage-evaluate':{field:{}}});
 await assert.rejects(session.operate({operation:'stage-evaluate',procedure:{schema:'ql.stage-procedure/v1'}}),/native cursor disagree/);
 assert.equal(session.reading.available,false,'an unexplained acknowledgement ends this lifetime');
});

test('stage retire/bind/unbind are not studio-driven yet: the admission list is exact',async()=>{
 const {session}=makeSession({});
 await assert.rejects(session.operate({operation:'stage-retire',procedure_ref:'x'}),/idle admitted owner/);
 await assert.rejects(session.operate({operation:'stage-bind',procedure:{}}),/idle admitted owner/);
 await assert.rejects(session.operate({operation:'stage-unbind',procedure_ref:'x'}),/idle admitted owner/);
});

test('a held owner takes no stage reads',async()=>{
 const {session}=makeSession({});
 session.hold('test hold');
 await assert.rejects(session.stageState(),/idle admitted owner/);
});
