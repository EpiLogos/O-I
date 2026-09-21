import * as THREE from 'three';
import {RetainedFieldBinding} from './ql/retained-field.mjs';
/** Explicit presentation transform; the admitted native frames stay in metres.
 * No position/state is integrated here. Density remains the authored fourth channel.
 */
export class NativeProjection {
 readonly native:RetainedFieldBinding;
 private a:THREE.DataTexture|null=null; private b:THREE.DataTexture|null=null;
 private inputA:any;private inputB:any;private centre:any;
 private port:any; private _scale:number; private dead=false;
 private frame:any;
 constructor(port:any,receipt:any,presentation:any){
  this.port=port;this._scale=this.checkScale(presentation?.units_per_metre);
  this.frame=receipt;
  this.checkPositions(receipt);
  const proxy={texWidth:port.texWidth,texHeight:port.texHeight,particleCount:port.particleCount,
   get currentPosTarget(){return port.currentPosTarget;},get currentVelTarget(){return port.currentVelTarget;},
   get nextPosTarget(){return port.nextPosTarget;},get nextVelTarget(){return port.nextVelTarget;},
   setTargetTextures:(a:any,b:any,centre:any)=>{this.inputA=a;this.inputB=b;this.centre=centre;this.sync();}
  };
  try{this.native=new RetainedFieldBinding(proxy,{initialFrame:receipt,targetA:port.targetA,targetB:port.targetB,
   slotsA:presentation.slots_a,slotsB:presentation.slots_b});}
  catch(error){this.a?.dispose();this.b?.dispose();throw error;}
 }
 private checkScale(value:number){if(!Number.isFinite(value)||value<=0||value>1e6)throw new Error('presentation units/metre must be in (0, 1000000]');return value;}
 private checkPositions(frame:any,scale=this._scale){
  if(!Array.isArray(frame?.targets))throw new Error('native targets unavailable');
  for(const target of frame.targets){if(!Array.isArray(target.position)||target.position.length!==3||target.position.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)||!Number.isFinite(Math.fround(v*scale))))throw new Error('native target cannot be represented at this presentation scale');}
 }
 get scale(){return this._scale;}
 setScale(scale:number){this.checkScale(scale);this.checkPositions(this.frame,scale);this._scale=scale;this.sync();}
 validate(frame:any){if(this.dead)throw new Error('native projection disposed');this.checkPositions(frame);return this.native.validate(frame);}
 apply(frame:any){this.validate(frame);const changed=this.native.apply(frame);this.frame=frame;if(changed)this.sync();return changed;}
 private sync(){
  if(!this.inputA||!this.inputB)return;
  const fill=(source:any,texture:THREE.DataTexture|null)=>{
   if(!texture){texture=new THREE.DataTexture(source.image.data.slice(),source.image.width,source.image.height,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;}
   const data=texture.image.data as unknown as Float32Array,input=source.image.data as Float32Array;
   for(let i=0;i<input.length;i+=4){data[i]=input[i]*this._scale;data[i+1]=input[i+1]*this._scale;data[i+2]=input[i+2]*this._scale;data[i+3]=input[i+3];}
   texture.needsUpdate=true;return texture;
  };
  this.a=fill(this.inputA,this.a);this.b=fill(this.inputB,this.b);this.port.setTargetTextures(this.a,this.b,this.centre);
 }
 checkpoint(renderer:any){return this.native.checkpoint(renderer);}
 restore(renderer:any,checkpoint:any){this.native.restore(renderer,checkpoint);this.sync();}
 inspect(){return{native:this.native.lastReceipt,presentation_units_per_metre:this._scale,target_a:this.a?.image.data,target_b:this.b?.image.data};}
 dispose(){if(this.dead)return;this.dead=true;this.native.dispose();this.a?.dispose();this.b?.dispose();}
}
