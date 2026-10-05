/** Actual hosted PointCloudField GPU owner; no native/world/installed claim. */
import * as THREE from 'three';
import {PointCloudField,DEFAULT_CONFIG} from '__POINT_CLOUD_FIELD__';
import {makeFormation,makePin} from '__FIELD_MODEL__';
const bridge=window as any;
const need=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
const same=(a:number[],b:number[])=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
async function hash(values:number[]){const data=Float32Array.from(values);const h=await crypto.subtle.digest('SHA-256',data.buffer);return Array.from(new Uint8Array(h),v=>v.toString(16).padStart(2,'0')).join('');}
async function save(name:string,value:unknown){await bridge.saveStationaryArtifact(name,value);}
const cases:any[]=[];
function create(count:number){
 const canvas=document.createElement('canvas');canvas.style.width='512px';canvas.style.height='384px';document.body.append(canvas);
 const entities=Array.from({length:count},(_,i)=>makeFormation({id:`controlled:body:${i}`,name:`Body ${i}`,x:(i-(count-1)/2)*110,y:i%2?35:-35,z:i*2,scale:.4,share:1,shape:{kind:'glyph',text:['A','◆','C','D'][i]}}));
 entities.push(makeFormation({id:'controlled:disabled',name:'Disabled body',enabled:false,shape:{kind:'glyph',text:'E'}}));
 const pin=makePin({id:'controlled:pin',name:'Pin',x:0,y:0,z:0});
 const config=structuredClone(DEFAULT_CONFIG);Object.assign(config,{particleCount:4096,entities:[...entities,pin]});
 Object.assign(config.fluid,{turbulence:0,vortexStrength:0,returnSpeed:3,dispersion:0,thermalJitter:0,gravityX:45,gravityY:-20,gravityZ:3});
 for(const key of ['medium','relational','pairwise','toroidalMorph','cymatics'])if((config as any)[key]) (config as any)[key].enabled=false;
 const engine:any=new PointCloudField(canvas,config,true),renderer:THREE.WebGLRenderer=engine.renderer,sim=engine.simulator;
 need(typeof engine.stationaryFormationAdmissionState==='function'&&typeof engine.admitStationaryFormations==='function','actual owner API must exist');
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 const environment={browser:navigator.userAgent,webgl2:renderer.capabilities.isWebGL2,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};need(environment.webgl2,'actual WebGL2 required');
 function velocityPair(){const arrays=[];for(const rt of [sim.currentVelTarget,sim.nextVelTarget]){const a=new Float32Array(sim.texWidth*sim.texHeight*4);renderer.readRenderTargetPixels(rt,0,0,sim.texWidth,sim.texHeight,a);arrays.push(Array.from(a));}return arrays;}
 function read(){const gpu=engine.inspectState(true),partitions=engine.entities.getPartitions().map((p:any)=>({...p})),targets=Array.from(engine.entities.buildSeed().subarray(0,sim.particleCount*4)) as number[];if(gpu.partitions!==undefined)need(JSON.stringify(gpu.partitions)===JSON.stringify(partitions),'public partition diagnostic agrees with actual owner');if(gpu.targets!==undefined)need(same(gpu.targets,targets),'public target diagnostic agrees with actual owner');return{gpu:{...gpu,partitions,targets},diagnostic_origin:{particles:'actual inspectState(true) GPUreadback',partitions:'actual EntityRuntime.getPartitions()',targets:'actual EntityRuntime.buildSeed()'},cas:engine.stationaryFormationAdmissionState(),simulatorSeeds:sim.seedGeneration,velocityPair:velocityPair()};}
 function close(){engine.destroy({releaseContext:true});canvas.remove();}
 return{engine,renderer,sim,environment,read,close};
}
function invariant(before:any,after:any){
 for(const key of ['simTime','steps','seeds','particleCount'])need(Object.is(before.gpu[key],after.gpu[key]),`admission must preserve ${key}`);
 need(before.simulatorSeeds===after.simulatorSeeds,'simulator seed counter invariant');
 need(same(before.gpu.velocities,after.gpu.velocities),'all current GPU velocities byte-equal');
 need(before.velocityPair.every((v:number[],i:number)=>same(v,after.velocityPair[i])),'both velocity ping-pong buffers byte-equal');
}
async function refuse(c:any,label:string,request:any){
 const before=c.read(),target=c.renderer.getRenderTarget(),material=c.sim.quadMesh.material;let error='';
 try{c.engine.admitStationaryFormations(request);}catch(e){error=String(e);}
 const after=c.read();need(error,`${label} must refuse`);invariant(before,after);need(same(before.gpu.positions,after.gpu.positions),'refusal must preserve every GPU position');
 need(JSON.stringify(before.cas)===JSON.stringify(after.cas),'refusal must preserve renderer local CAS');need(c.renderer.getRenderTarget()===target&&c.sim.quadMesh.material===material,'refusal preserves renderer bindings');
 await save(label,{request,error,before,after});cases.push({name:label,passed:true,error});
}
async function main(){
 for(const count of [2,4]){const c=create(count);try{
  // Actual motion establishes nonzero velocities; no manually authored GPU state.
  for(let i=0;i<24;i++)c.engine.advance(1/120);
  const moving=c.read();need(moving.gpu.steps>0&&moving.gpu.simTime>0&&moving.gpu.velocities.some((v:number,i:number)=>i%4!==3&&Math.abs(v)>1e-5),'actual motion and nonzero GPU velocity required');
  const selected=count===2?['controlled:body:0']:['controlled:body:2','controlled:body:0'];
  const edits=c.engine.config.entities.map((e:any)=>selected.includes(e.id)?{...e,x:e.x+130,y:e.y-45,scale:e.scale*1.15}:e);
  c.engine.updateConfig({entities:edits});c.engine.advance(0);const before=c.read();invariant(moving,before);need(same(moving.gpu.positions,before.gpu.positions),'target edit and zero advance do not reset resident positions');
  need(!same(moving.gpu.targets,before.gpu.targets),'actual owner baked/transformed targets change');
  const ranges=before.gpu.partitions.filter((p:any)=>selected.includes(p.entityId));need(ranges.length===selected.length,'exact selected body ranges present');
  const sentinel=new THREE.WebGLRenderTarget(7,9);c.renderer.setRenderTarget(sentinel);const previousMaterial=c.sim.quadMesh.material;
  const request={entity_ids:selected,expected_revision:before.cas.revision,partition_signature:before.cas.partition_signature,source_revision:`controlled:authored-target-edit:${count}:1`};
  c.engine.admitStationaryFormations(request);need(c.renderer.getRenderTarget()===sentinel&&c.sim.quadMesh.material===previousMaterial,'actual GPU copy restores renderer target/material');
  const after=c.read();invariant(before,after);need(after.cas.revision===before.cas.revision+1,'one successful local CAS commit');
  let selectedGap=0,unselectedGap=0,selectedChange=0;
  for(let i=0;i<before.gpu.particleCount;i++){const chosen=ranges.some((p:any)=>i>=p.start&&i<p.end);for(let axis=0;axis<4;axis++){
   const at=i*4+axis;const expected=chosen?before.gpu.targets[at]:before.gpu.positions[at];need(Object.is(after.gpu.positions[at],expected),chosen?'selected actual GPU RGBA must equal actual target':'all unselected actual GPU RGBA must remain byte-equal');
   if(chosen){selectedGap=Math.max(selectedGap,Math.abs(after.gpu.positions[at]-before.gpu.targets[at]));selectedChange=Math.max(selectedChange,Math.abs(after.gpu.positions[at]-before.gpu.positions[at]));}else unselectedGap=Math.max(unselectedGap,Math.abs(after.gpu.positions[at]-before.gpu.positions[at]));
  }}need(selectedChange>1,'selected actual receiving bodies visibly change their position domain');
  const id=`${count}-formations-positive`;await save(id,{request,environment:c.environment,before,after,ranges,selected_target_gap:selectedGap,unselected_position_gap:unselectedGap,selected_change:selectedChange});
  cases.push({name:id,passed:true,selected_target_gap:selectedGap,unselected_position_gap:unselectedGap,selected_change:selectedChange,all_velocity_unchanged:true,seeds:after.gpu.seeds,simTime:after.gpu.simTime,steps:after.gpu.steps,positions_sha256:await hash(after.gpu.positions),velocities_sha256:await hash(after.gpu.velocities),environment:c.environment});
  c.renderer.setRenderTarget(null);sentinel.dispose();
  await refuse(c,`${count}-stale-counter`,request);
  const next={...request,expected_revision:after.cas.revision};
  await refuse(c,`${count}-duplicate-source`,next);
  if(count===4)await refuse(c,`${count}-duplicate-reordered-source`,{...next,entity_ids:[...selected].reverse()});
  const fresh={...next,source_revision:`controlled:authored-target-edit:${count}:2`};
  await refuse(c,`${count}-wrong-signature`,{...fresh,partition_signature:'controlled:wrong-partition'});
  await refuse(c,`${count}-duplicate-ids`,{...fresh,entity_ids:[selected[0],selected[0]]});
  await refuse(c,`${count}-missing-body`,{...fresh,entity_ids:[selected[0],'controlled:missing']});
  await refuse(c,`${count}-disabled-body`,{...fresh,entity_ids:[selected[0],'controlled:disabled']});
  await refuse(c,`${count}-pin-is-not-formation`,{...fresh,entity_ids:[selected[0],'controlled:pin']});
  await refuse(c,`${count}-empty-source`,{...fresh,source_revision:'   '});
  const old=c.engine.stationaryFormationAdmissionState();c.engine.updateConfig({entities:c.engine.config.entities.map((e:any)=>e.id==='controlled:body:0'?{...e,share:e.share*3}:e)});c.engine.advance(0);
  need(old.partition_signature!==c.engine.stationaryFormationAdmissionState().partition_signature,'actual source layout change must alter signature');
  await refuse(c,`${count}-actual-reranged-stale-signature`,{...fresh,partition_signature:old.partition_signature});
 }finally{c.close();}}
 return{schema:'epi.real-stationary-formation-gpu-owner/v1',passed:true,scope:'Actual hosted renderer primitive with controlled authored targets, real WebGL2. No QL/native scene consumer, app bridge, ordinary or managed installed world claim. source_revision is an opaque authored test admission tag; app semantic qualification remains separate.',cases};
}
main().then(async value=>{await bridge.saveStationaryProof(value);bridge.acceptance=value;}).catch(async error=>{const value={schema:'epi.real-stationary-formation-gpu-owner/v1',passed:false,error:String(error),stack:error?.stack,cases};await bridge.saveStationaryProof(value);bridge.acceptance=value;});
