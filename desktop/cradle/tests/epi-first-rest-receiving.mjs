import assert from 'node:assert/strict';
/** The exact first-rest gates shared by the original whole and the actual
 * required-body counterproof. Native inputs and expected32 refs are supplied
 * only from their independently admitted controlled owner Document. */
export function createEpiFirstRestReceivingGate({check,artifact,sha}){
function requirePartitions(reading,entities,label){
 const parts=reading.rendered?.partitions??[];
 for(const entity of entities){const part=parts.find(p=>p.entityId===entity);assert.ok(part&&part.end>part.start,`${label}: actual renderer partition for ${entity}`);}
 check(parts.length===entities.length,`${label}: every required native occurrence has a nonempty resident render partition (${entities.length})`);
}
function requireInitialRestTargets(reading,entities,label){
 const resident=reading.rendered,positions=resident?.positions,targets=resident?.targets;
 assert.ok(reading.state.fieldPaused&&reading.state.simTime===0&&resident?.simTime===0&&resident.steps===0,
  label+': compare only the actual unplayed first rest');
 assert.ok(Array.isArray(positions)&&Array.isArray(targets)&&positions.length===resident.particleCount*4&&targets.length===positions.length,
  label+': paired real GPU positions and actual owner target readbacks are required');
 const statuses=reading.telemetry.sourceStatus,maskRoles=['degree','governor','decan','codon','skin','aperture'];
 const maskReadings=maskRoles.map(role=>{const entity=reading.working.native_ref+':entity:world-register-'+role;
  const rows=Object.entries(statuses).filter(([key])=>JSON.parse(key)[0]===entity);
  assert.equal(rows.length,1,label+': one actual decoded mask source for '+role);
  assert.ok(rows[0][1].includes('source active'),label+': the actual '+role+' source decoded successfully');
  return{role,entity_ref:entity,status:rows[0][1]};});
 const deltas=new Float64Array(resident.particleCount);let max=0,mismatches=0;
 for(let i=0;i<positions.length;i++)assert.ok(Number.isFinite(positions[i])&&Number.isFinite(targets[i]),label+': finite actual paired readback at '+i);
 for(let particle=0;particle<resident.particleCount;particle++){let squared=0;for(let axis=0;axis<3;axis++){const offset=particle*4+axis;squared+=(positions[offset]-targets[offset])**2;}
  const gap=Math.sqrt(squared);deltas[particle]=gap;max=Math.max(max,gap);if(gap!==0)mismatches++;}
 const byPartition=entities.map(entity=>{const p=resident.partitions.find(row=>row.entityId===entity);assert.ok(p&&p.end>p.start);
  let max_gap=0,mismatched=0;for(let i=p.start;i<p.end;i++){max_gap=Math.max(max_gap,deltas[i]);if(deltas[i]!==0)mismatched++;}
  return{entity_ref:entity,count:p.end-p.start,max_gap,mismatched};});
 artifact(label+'-resident-target-admission.json',{scope:'Actual first-rest receiving comparison only; source semantic expectations and visual composition remain separate',
  simTime:resident.simTime,steps:resident.steps,seeds:resident.seeds,bakes:resident.bakes,particle_count:resident.particleCount,
  positions_sha256:sha(JSON.stringify(positions)),actual_owner_targets_sha256:sha(JSON.stringify(targets)),max_gap:max,mismatches,maskReadings,byPartition});
 check(max===0&&mismatches===0&&byPartition.length===32&&byPartition.every(row=>row.mismatched===0),
  label+': all actual resident particles receive the decoded authored targets for every32 required bodies before play or manual reseeding');
}
 return{requirePartitions,requireInitialRestTargets};
}
