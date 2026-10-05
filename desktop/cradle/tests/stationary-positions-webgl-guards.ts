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
async function main(){const c=create(4);try{for(let i=0;i<24;i++)c.engine.advance(1/120);const base=c.read(),p=base.gpu.partitions.filter((p:any)=>p.entityId.startsWith('controlled:body:'));need(p.length===4,'four actual owned body ranges');need(base.gpu.velocities.some((v:number,i:number)=>i%4!==3&&Math.abs(v)>1e-5),'actual nonzero velocities');const ranges=p.map((p:any)=>({start:p.start,end:p.end}));const targets=Float32Array.from(base.gpu.targets);const invalids:any[]=[['unsorted',[ranges[2],ranges[0]],targets],['overlapping',[ranges[0],ranges[0]],targets],['out-of-range',[{start:0,end:base.gpu.particleCount+1}],targets],['empty',[],targets],['wrong-target-length',[ranges[0]],targets.subarray(0,targets.length-4)]];const nonfinite=targets.slice();nonfinite[ranges[0].start*4]=NaN;invalids.push(['nonfinite-selected',[ranges[0]],nonfinite]);for(const [name,ranges,input] of invalids){const before=c.read(),rendererTarget=c.renderer.getRenderTarget(),material=c.sim.quadMesh.material;let error='';try{c.sim.admitStationaryPositions(input,ranges);}catch(e){error=String(e);}const after=c.read();need(error,'unlawful direct GPU range/target must reject');invariant(before,after);need(same(before.gpu.positions,after.gpu.positions),'direct GPU refusal preserves positions');need(JSON.stringify(before.cas)===JSON.stringify(after.cas),'direct GPU refusal preserves field CAS');need(c.renderer.getRenderTarget()===rendererTarget&&c.sim.quadMesh.material===material,'direct GPU refusal preserves bindings');await save('raw-'+name,{ranges,error,before,after});cases.push({name:'raw-'+name,passed:true,error});}return{schema:'epi.real-stationary-gpu-direct-guard/v1',passed:true,scope:'Actual GPU owner direct unlawful-range/target refusals. No positive scene/native/world/ordinary/installed claim.',cases,environment:c.environment};}finally{c.close();}}
main().then(async value=>{await bridge.saveStationaryProof(value);bridge.acceptance=value;}).catch(async error=>{const value={schema:'epi.real-stationary-gpu-direct-guard/v1',passed:false,error:String(error),stack:error?.stack,cases};await bridge.saveStationaryProof(value);bridge.acceptance=value;});
