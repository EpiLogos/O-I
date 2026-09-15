/** Real hosted regression: a bad relation is isolated to its unavailable
 * reading, including on a fresh connection, and repair restores its exact ref.
 * All injected rows are in a run-scoped PRIVATE field, invisible to other runs.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSharedField } from '../social.mjs';
import { createExploreEntry } from '../explore.mjs';
import { open, close, fieldSnapshot, resolveTarget, rows, waitUntil } from './field-lib';

const target = resolveTarget();
if (!target.bound) throw new Error(target.reason);
const run = randomUUID(), label = `relation-recovery-${run}`;
const fieldRef = `oi:field:relation-recovery:${run}`;
const ref = `world:relation-recovery:${run}`, nextRef = `${ref}:note`;
const relationRef = `relation:${run}:source`, brokenRef = `relation:${run}:repair`;
const provenance = [{kind:'acceptance-source',ref:`source:relation-recovery:${run}`,source_system:'o-i',revision:'1'}];
let owner = await open(target.target, label);
const outsider = await open(target.target, `${label}-outsider`);
let damaged = false;
const putRelation = async (relation_ref:string, kind:string, valid:boolean) => {
  const relation = {from:ref,to:nextRef,relation:kind,origin:'source',...(valid?{relation_ref,provenance:[{...provenance[0],ref:relation_ref}]}:{private_body:'PRIVATE_REJECTED_RELATION_BODY'})};
  await owner.conn.reducers.putExploreRelation({relationRef:relation_ref,fieldRef,fromRef:ref,toRef:nextRef,relation:kind,origin:'source',relationJson:JSON.stringify(relation)});
};
try {
  const field = createSharedField({field_ref:fieldRef,kind:'explore',visibility:'private',title:'Private relation recovery acceptance',provenance});
  await owner.conn.reducers.putSharedField({fieldRef,kind:field.kind,visibility:field.visibility,contractJson:JSON.stringify(field)});
  for (const [entryRef,label] of [[ref,'Relation recovery world'],[nextRef,'Source note']]) {
    const entry = createExploreEntry({ref:entryRef,kind:'artifact',world_ref:ref,label,revision:'1',provenance});
    await owner.conn.reducers.putExploreEntry({semanticRef:entryRef,fieldRef,worldRef:ref,kind:entry.kind,label,revision:'1',entryJson:JSON.stringify(entry)});
  }
  await putRelation(relationRef,'supports',true);
  await waitUntil(()=>owner.live.snapshot().relations.some((edge:any)=>edge.relation_ref===relationRef),'valid source relation');
  await putRelation(brokenRef,'response-to',false); damaged=true;
  await waitUntil(()=>owner.live.status().relation_errors.some((row:any)=>row.relation_ref===brokenRef),'isolated unavailable relation');
  const degraded=fieldSnapshot(owner);
  assert.ok(degraded.entries.some((entry:any)=>entry.ref===ref));
  assert.ok(degraded.relations.some((edge:any)=>edge.relation_ref===relationRef));
  assert.ok(!degraded.relations.some((edge:any)=>edge.relation_ref===brokenRef));
  assert.equal(degraded.status.material.state,'degraded');
  assert.equal(JSON.stringify(degraded).includes('PRIVATE_REJECTED_RELATION_BODY'),false);
  assert.equal(rows(outsider.conn.db.sharedField).some((row:any)=>row.fieldRef===fieldRef),false);
  assert.equal(fieldSnapshot(outsider).relation_errors.some((row:any)=>row.relation_ref===brokenRef),false);
  close(owner);
  owner=await open(target.target,label);
  assert.ok(fieldSnapshot(owner).relation_errors.some((row:any)=>row.relation_ref===brokenRef));
  assert.ok(owner.live.search('Relation recovery world').some((entry:any)=>entry.ref===ref));
  await putRelation(brokenRef,'response-to',true); damaged=false;
  await waitUntil(()=>!owner.live.status().relation_errors.some((row:any)=>row.relation_ref===brokenRef),'owner repair restoration');
  const restored=fieldSnapshot(owner);
  const edge=restored.relations.find((edge:any)=>edge.relation_ref===brokenRef);
  assert.equal(edge.from,ref);assert.equal(edge.to,nextRef);
  assert.equal(edge.provenance[0].ref,brokenRef);assert.equal(edge.provenance[0].revision,'1');
  console.log(JSON.stringify({schema:'oi.relation-recovery.acceptance/v1',target:target.target.name,passed:true,field_ref:fieldRef,checks:['unrelated subjects retained','valid relations retained','bad relation explicitly unavailable','private payload omitted','outsider cannot see test rows','fresh connection tolerates bad relation','source repair restores exact identity and revision']},null,2));
} finally {
  if(damaged)await putRelation(brokenRef,'response-to',true).catch(error=>console.error('Private acceptance relation repair failed:',String(error)));
  close(owner);close(outsider);
}
