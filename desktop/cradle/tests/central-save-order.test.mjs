import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DayFormSession,formEdits,unmappedChanges} from '../src/central/dayForm.ts';

// Rust/serde's native JSON objects are key-ordered; the original browser
// editor retains insertion order. These are the same JSON values, not drift.
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const payload=JSON.parse(readFileSync(new URL('../documents/ql-daily-die.html',import.meta.url),'utf8')
  .match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)[1]);
const basis=()=>({sourceRef:'source:order-test',documentId:'document:order-test',revision:'r1',payload:structuredClone(payload),
  fields:Object.keys(payload).map(key=>({id:`original:${key}`,template_pointer:`/${key}`}))});
const reading=(b,expected)=>({schema:'central.document-reading/v1',source:{ref:b.sourceRef},revision:{revision:b.revision},
 document_id:b.documentId,document:{document_id:b.documentId,kind:'day',template_payload:sorted(b.payload),fields:b.fields},
 automatic_agent_or_model_invocation:false,operation_receipt:{status:'committed',previous_revision:expected,revision:b.revision}});

test('native object serialization order alone creates no field edits or unmapped changes',()=>{
 const b=basis();assert.deepEqual(formEdits(b,sorted(b.payload)),[]);assert.deepEqual(unmappedChanges(b,sorted(b.payload)),[]);
});

test('same retained form binding in different key order is not an identity mutation',()=>{
 const b=basis();b.payload._oi_form_source={schema:'oi.original-day-form/v1',revision:'r1',location:{schema:'central.path-ref/v1',ref:'path:original',path:'Work/material/original.html'}};
 assert.deepEqual(formEdits(b,sorted(b.payload)),[]);
});

test('real original form accepts a key-reordered native acknowledgement and clears only acknowledged edits',async()=>{
 const session=new DayFormSession(basis()),draft=structuredClone(session.basis.payload);draft.fields.p0_quick_thoughts='native saved text';session.stage(draft);
 let calls=0;
 await session.save(async input=>{
  calls++;assert.equal(input.field_id,'original:fields');assert.equal(input.expected_revision,'r1');
  const next=structuredClone(session.basis);next.payload.fields=input.value;next.revision='r2';
  return reading(next,input.expected_revision);
 });
 assert.equal(calls,1);assert.equal(session.saved,1);assert.equal(session.basis.revision,'r2');assert.equal(session.draft,undefined);assert.equal(session.blocked,undefined);
});

test('array order, primitive type and missing keys are still meaningful edits',()=>{
 for(const change of [p=>{p.sessions=[{b:2,a:1},{b:4,a:3}];},p=>{p.fields.p0_quick_thoughts=0;},p=>{delete p.body.p5_learning_1;}]){
  const b=basis(),draft=structuredClone(b.payload);change(draft);assert.ok(formEdits(b,draft).length);
 }
 const b=basis();b.payload.sessions=[{b:2,a:1},{b:4,a:3}];const draft=sorted(b.payload);draft.sessions.reverse();assert.deepEqual(formEdits(b,draft).map(e=>e.id),['original:sessions']);
});

test('a reordered acknowledgement with a genuinely changed nested value remains an unknown effect',async()=>{
 const session=new DayFormSession(basis()),draft=structuredClone(session.basis.payload);draft.fields.p0_quick_thoughts='expected';session.stage(draft);
 let calls=0;
 const writer=async input=>{calls++;const next=structuredClone(session.basis);next.revision='r2';next.payload.fields=input.value;next.payload.fields.p0_quick_thoughts='contradictory';return reading(next,input.expected_revision);};
 await assert.rejects(session.save(writer),/acknowledgement/);await assert.rejects(session.save(writer));assert.equal(calls,1);assert.ok(session.draft);assert.ok(session.blocked);
});

test('review after a native reordering retains an independently changed nested sibling',()=>{
 const b=basis();b.payload.fields.extra={second:'base',first:'base'};const session=new DayFormSession(b);
 const draft=structuredClone(b.payload);draft.fields.extra.second='mine';session.stage(draft);
 const fresh={...structuredClone(b),revision:'r2',payload:sorted(b.payload)};fresh.payload.fields.extra.first='external';
 session.observe(fresh);session.reviewOnto(fresh);
 assert.deepEqual(session.draft.fields.extra,{first:'external',second:'mine'});
});
