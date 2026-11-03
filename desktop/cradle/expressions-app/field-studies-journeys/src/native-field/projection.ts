import * as THREE from 'three';
import {RetainedFieldBinding} from './ql/retained-field.mjs';
/** What presents the admitted frame as an object of the scene (src/engine/torusObject.ts TorusObject; O-I 851): per sample, in the
 * frame's own order, the place it is shown at in metres, or null to show the frame exactly as the owner gives it. */
export interface FramePresenter {present(frame:any):Float32Array|null;state():unknown}
/** Explicit presentation transform; the admitted native frames stay in metres.
 * No position/state is integrated here. Density remains the authored fourth channel.
 * A presenter (the torus object) may show each sample elsewhere — on the shape the figure law names, laid flat — from the same
 * admitted frame; with none, or while it shows the frame as it is, the targets are the native positions × scale exactly.
 */
export class NativeProjection {
 readonly native:RetainedFieldBinding;
 private a:THREE.DataTexture|null=null; private b:THREE.DataTexture|null=null;
 private inputA:any;private inputB:any;private centre:any;
 private port:any; private _scale:number; private dead=false;
 private frame:any;
 private presenter:FramePresenter|null=null;private presented:Float32Array|null=null;private held:any=null;
 private slotsA:ArrayLike<number>;private slotsB:ArrayLike<number>;
 constructor(port:any,receipt:any,presentation:any){
  this.port=port;this._scale=this.checkScale(presentation?.units_per_metre);
  this.frame=receipt;this.slotsA=presentation?.slots_a??[];this.slotsB=presentation?.slots_b??[];
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
 apply(frame:any){this.validate(frame);const changed=this.native.apply(frame);this.frame=frame;if(changed){this.present();this.sync();}return changed;}
 /** The object that presents each admitted frame (null: the frame as the owner gives it). It presents the current frame at once. */
 setPresenter(presenter:FramePresenter|null){if(this.dead)return;this.presenter=presenter;this.held=null;this.present();this.sync();}
 /** Present the current frame again: the presenter's state moved (its session, the plate laid flat) while no new frame came. */
 refresh(){if(this.dead||!this.presenter)return;this.present();this.sync();}
 private present(){
  if(!this.presenter){this.presented=null;return;}
  // Negative acceptance only: the picture held from one frame while the sound runs on. Nothing in the application sets this; the
  // one-cause test must fail under it (torus-object-851.test.mjs).
  const shown=(globalThis as any).__OI_TEST_CUT_TORUS_STATE__===true?(this.held??=this.frame):this.frame;
  this.presented=this.presenter.present(shown);
 }
 private sync(){
  if(!this.inputA||!this.inputB)return;
  const presented=this.presented;
  const fill=(source:any,texture:THREE.DataTexture|null,slots:ArrayLike<number>)=>{
   if(!texture){texture=new THREE.DataTexture(source.image.data.slice(),source.image.width,source.image.height,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;}
   const data=texture.image.data as unknown as Float32Array,input=source.image.data as Float32Array;
   if(presented&&slots.length*4===input.length){
    // Each texel shows its own sample where the object stands it; density stays the authored fourth channel.
    for(let t=0,i=0;i<input.length;t++,i+=4){const s=slots[t]*3;data[i]=presented[s]*this._scale;data[i+1]=presented[s+1]*this._scale;data[i+2]=presented[s+2]*this._scale;data[i+3]=input[i+3];}
   }else for(let i=0;i<input.length;i+=4){data[i]=input[i]*this._scale;data[i+1]=input[i+1]*this._scale;data[i+2]=input[i+2]*this._scale;data[i+3]=input[i+3];}
   texture.needsUpdate=true;return texture;
  };
  // Negative acceptance only: admitted frames stop short of the GPU-bound
  // textures. Nothing in the application sets this; a cut consumer must fail.
  if((globalThis as any).__OI_TEST_DISCONNECT_NATIVE_TARGETS__===true&&this.a&&this.b)return;
  this.a=fill(this.inputA,this.a,this.slotsA);this.b=fill(this.inputB,this.b,this.slotsB);this.port.setTargetTextures(this.a,this.b,this.centre);
 }
 checkpoint(renderer:any){return this.native.checkpoint(renderer);}
 restore(renderer:any,checkpoint:any){this.native.restore(renderer,checkpoint);this.sync();}
 inspect(){return{native:this.native.lastReceipt,presentation_units_per_metre:this._scale,target_a:this.a?.image.data,target_b:this.b?.image.data,admitted_a:this.inputA?.image.data,
  presented:this.presented,presented_shape:(this.presenter?.state() as any)?.morph??null};}
 /** The frame last admitted (metres), as the owner gave it. */
 get current(){return this.frame;}
 dispose(){if(this.dead)return;this.dead=true;this.presenter=null;this.native.dispose();this.a?.dispose();this.b?.dispose();}
}
