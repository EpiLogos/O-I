import {NativeProjection,type NativeProjectionPresentation} from './projection';

export interface SelectedSourceSceneBasis {
 readonly expression_ref:string;readonly document_revision:number;
 readonly scene_ref:string;readonly scene_revision:number;
}
const keys=['document_revision','expression_ref','scene_ref','scene_revision'];
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const completeBasis=(value:unknown)=>object(value)&&Object.keys(value).sort().join(',')===keys.join(',')
 &&typeof value.expression_ref==='string'&&value.expression_ref.length>0&&value.expression_ref.length<=4096
 &&typeof value.scene_ref==='string'&&value.scene_ref.length>0&&value.scene_ref.length<=4096
 &&Number.isSafeInteger(value.document_revision)&&(value.document_revision as number)>=0
 &&Number.isSafeInteger(value.scene_revision)&&(value.scene_revision as number)>=0;
const sameBasis=(value:unknown,basis:SelectedSourceSceneBasis)=>object(value)
 &&Object.keys(value).sort().join(',')===keys.join(',')
 &&keys.every(key=>value[key]===basis[key as keyof SelectedSourceSceneBasis]);

/** S14 qualifies its actual sole World carrier for a separate Source bootstrap.
 * It does not issue a selected Scene-to-sampler physical target map. This check
 * is reply discrimination within the original native opening, not a grant from
 * browser JSON. The admitted Session retains the actual FIELD authority. */
export function selectedSourceReceptionBasis(opening:unknown,basis:SelectedSourceSceneBasis){
 if(!completeBasis(basis)||!object(opening)||opening.schema!=='oi.native-expression-open/v1'
  ||opening.qualification!=='pending_source_bootstrap'||opening.source_current!==true
  ||opening.source_currentness!==null||!sameBasis(opening.selected_scene,basis)
  ||!completeBasis(opening.world_source_scene)||!object(opening.world_source_scene)||opening.world_source_scene.expression_ref!==basis.expression_ref
  ||opening.world_source_scene.document_revision!==basis.document_revision)
  throw Error('The original selected Source opening is not current at its actual Document and Scene basis.');
 return Object.freeze({...basis});
}

/** Source-carrier FIELD reception, separate from NativeProjection's physical
 * target publication. Every frame still passes the real three-argument native
 * receiver. Its projected carrier buffers are diagnostic only; authored sampler
 * buffers remain a basis for U's independently prepared native M3 target map. */
export class SelectedSourceReception {
 readonly purpose='selected_source_carrier' as const;
 private readonly receiver:NativeProjection;
 private readonly authoredA:Float32Array;private readonly authoredB:Float32Array;
 private readonly partitionSignature:string;
 private carrierTargets:{a:any;b:any;centre:any}|null=null;
 readonly basis:SelectedSourceSceneBasis;
 constructor(port:any,opening:any,basis:SelectedSourceSceneBasis,current:()=>boolean){
  if(!current())throw Error('The original selected Source binding changed before reception.');
  this.basis=selectedSourceReceptionBasis(opening,basis);
  if(typeof port?.readPartitionSnapshot!=='function')throw Error('The actual authored retained sampler snapshot is unavailable.');
  const snapshot=port.readPartitionSnapshot(),size=port.texWidth*port.texHeight;
  if(!Number.isSafeInteger(size)||size<1||size>1048576
   ||snapshot?.schema!=='oi.retained-partition-snapshot/v1'||snapshot.slot_count!==size
   ||snapshot.particle_count!==port.particleCount||typeof snapshot.partition_signature!=='string'
   ||!snapshot.partition_signature||!(snapshot.authored_target_a instanceof Float32Array)
   ||!(snapshot.authored_target_b instanceof Float32Array)||snapshot.authored_target_a.length!==size*4
   ||snapshot.authored_target_b.length!==size*4||!snapshot.authored_target_a.every(Number.isFinite)
   ||!snapshot.authored_target_b.every(Number.isFinite))throw Error('The actual authored retained sampler basis is incomplete.');
  this.partitionSignature=snapshot.partition_signature;
  // These are authored positions/density, never admitted FIELD or M3 positions.
  this.authoredA=snapshot.authored_target_a.slice();this.authoredB=snapshot.authored_target_b.slice();
  const carrierPort={texWidth:port.texWidth,texHeight:port.texHeight,particleCount:port.particleCount,
   targetA:port.targetA,targetB:port.targetB,
   get currentPosTarget(){return port.currentPosTarget;},get currentVelTarget(){return port.currentVelTarget;},
   get nextPosTarget(){return port.nextPosTarget;},get nextVelTarget(){return port.nextVelTarget;},
   readPartitionSnapshot:()=>port.readPartitionSnapshot(),
   // Keep the actual last receiver publication for Source diagnostics. This is
   // the diagnostic receiver, with no renderer target setter or physical ACK.
   setTargetTextures:(a:any,b:any,centre:any)=>{this.carrierTargets={a,b,centre};}};
  this.receiver=new NativeProjection(carrierPort,opening.receipt.field,opening.presentation as NativeProjectionPresentation);
  if(!current()){this.receiver.dispose();throw Error('The selected Source binding changed during reception.');}
 }
 get native(){return this.receiver.native;}
 get scale(){return this.receiver.scale;}
 setScale(scale:number){this.receiver.setScale(scale);}
 validate(frame:any){return this.receiver.validate(frame);}
 apply(frame:any){return this.receiver.apply(frame);}
 checkpoint(renderer:any){return this.receiver.checkpoint(renderer);}
 restore(renderer:any,checkpoint:any){this.receiver.restore(renderer,checkpoint);}
 authoredSamplerBasis(){return{standing:'authored_retained_sampler_basis' as const,
  partition_signature:this.partitionSignature,target_a:this.authoredA,target_b:this.authoredB};}
 inspect(){const received=this.receiver.inspect();return{purpose:this.purpose,physical_effect:'unobserved' as const,
  selected_scene:this.basis,authored_sampler_basis:this.authoredSamplerBasis(),
  carrier_field:{native:received.native,presentation_units_per_metre:received.presentation_units_per_metre,
   projected_a:this.carrierTargets?.a.image.data,projected_b:this.carrierTargets?.b.image.data,
   admitted_a:received.admitted_a}};}
 dispose(){this.receiver.dispose();}
}
