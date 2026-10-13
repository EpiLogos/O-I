import * as THREE from 'three';
import {holdFit,paintedPassParams,renderTargetAction,srgbUnit,type HoldFit,type TransitionSpec,type RenderTargetAction} from './transitionMath';

/** E11b: the compositing layer for painted transitions on the production field. The field renders its live frame into a
 * target; a full-screen pass then writes the frame to the canvas (or to a capture target). The pass flattens each frame
 * over its own field ground, so the output is opaque and does not depend on the canvas's CSS background: a dip lands on
 * the colour exactly, and a held wipe side keeps the outgoing ground.
 *
 * E11c decisions. (1) The held frame is captured clean: the field draws it with the authoring furniture hidden, through the
 * same visibility toggle as withCleanFrame (PointCloudField owns that toggle). (2) Every pass restores the render target it
 * found, so nothing is left bound to the hold. (3) The held frame is fitted to the output's aspect (contain, see holdFit):
 * a still of another aspect shows the outgoing frame whole, never stretched, with the ground in the margins. (4) Alpha: a
 * painted transition frame is opaque (alpha 1 everywhere). Outside a painted transition, capture is unchanged and keeps its
 * alpha. The pure parameters come from transitionMath.ts; this file only owns the GPU objects. */
export interface TransitionOverlay {spec:TransitionSpec;fraction:number;colour:string;ground:string}

const VERT=`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;

// Output is opaque by construction: gl_FragColor alpha is 1. The hold is sampled through the aspect fit (uHoldScale/uHoldOffset);
// where the held image does not reach, the ground shows.
const FRAG=`uniform sampler2D tLive;uniform sampler2D tHold;uniform vec3 uColour;uniform float uColourW;uniform vec3 uGround;uniform float uUseHold;uniform vec4 uHoldRect;uniform vec2 uHoldScale;uniform vec2 uHoldOffset;
varying vec2 vUv;
void main(){
 vec4 live=texture2D(tLive,vUv);
 vec3 rgb=live.rgb*(1.0-uColourW)+uColour*uColourW;
 float a=live.a*(1.0-uColourW)+uColourW;
 vec3 c=rgb+uGround*(1.0-a);
 if(uUseHold>0.5){
  vec2 p=gl_FragCoord.xy;
  vec2 h=(vUv-uHoldOffset)/uHoldScale;
  vec3 held=texture2D(tHold,clamp(h,0.0,1.0)).rgb;
  bool inRect=p.x>=uHoldRect.x&&p.x<uHoldRect.x+uHoldRect.z&&p.y>=uHoldRect.y&&p.y<uHoldRect.y+uHoldRect.w;
  bool inHold=h.x>=0.0&&h.x<=1.0&&h.y>=0.0&&h.y<=1.0;
  if(inRect)c=inHold?held:uGround;
 }
 gl_FragColor=vec4(c,1.0);
}`;

type Size={width:number;height:number};
type Rgb=[number,number,number];
type HoldRect=[number,number,number,number];
const NO_HOLD:HoldRect=[0,0,0,0];
const NO_FIT:HoldFit={scale:[1,1],offset:[0,0]};

export class TransitionPass {
 private overlay:TransitionOverlay|null=null;
 private live:THREE.WebGLRenderTarget|null=null;
 private hold:THREE.WebGLRenderTarget|null=null;
 private holdReady=false;
 private readonly material:THREE.ShaderMaterial;
 private readonly quad:THREE.Mesh;
 private readonly quadScene=new THREE.Scene();
 private readonly quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);

 constructor(){
  this.material=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,depthTest:false,depthWrite:false,blending:THREE.NoBlending,
   uniforms:{tLive:{value:null},tHold:{value:null},uColour:{value:new THREE.Vector3()},uColourW:{value:0},uGround:{value:new THREE.Vector3()},uUseHold:{value:0},uHoldRect:{value:new THREE.Vector4()},uHoldScale:{value:new THREE.Vector2(1,1)},uHoldOffset:{value:new THREE.Vector2()}}});
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
  this.quad.frustumCulled=false;
  this.quadScene.add(this.quad);
 }

 /** A painted overlay is in force; otherwise the field draws directly and this pass costs nothing. */
 get active(){return this.overlay!==null;}

 /** Sets this frame's overlay. Leaving a transition releases both targets. */
 setOverlay(overlay:TransitionOverlay|null){
  this.overlay=overlay;
  if(!overlay){this.target('live',null);this.target('hold',null);}
 }

 /** Holds the outgoing frame, flattened over the outgoing ground. Called at the transition's start, before the new
 * configuration reaches the GPU, so the target holds the previous frame exactly as it was last shown. The caller draws the
 * scene clean (furniture hidden) around this call. The render target that was bound is bound again on return. */
 captureHold(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,size:Size,ground:string){
  const previous=renderer.getRenderTarget();
  try{
   const live=this.target('live',size),hold=this.target('hold',size);
   if(!live||!hold)return;
   this.renderLive(renderer,scene,camera,live);
   this.quadPass(renderer,{colourW:0,useHold:false,holdRect:NO_HOLD},live,null,hold,size,[0,0,0],srgbUnit(ground));
   this.holdReady=true;
  }finally{renderer.setRenderTarget(previous);}
 }

 /** Presents the scene through the overlay into `out` (null = the canvas). Returns false when no overlay is in force, so the
 * caller draws the scene directly, as it did before this pass existed. The render target that was bound is bound again. */
 present(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,out:THREE.WebGLRenderTarget|null):boolean{
  const overlay=this.overlay;
  if(!overlay)return false;
  const size=out?{width:out.width,height:out.height}:drawingSize(renderer);
  const live=this.target('live',size);
  if(!live)return false;
  const previous=renderer.getRenderTarget();
  try{
   this.renderLive(renderer,scene,camera,live);
   const params=paintedPassParams(overlay.spec,overlay.fraction,size.width,size.height,this.holdReady);
   this.quadPass(renderer,params,live,this.hold,out,size,srgbUnit(overlay.colour),srgbUnit(overlay.ground));
  }finally{renderer.setRenderTarget(previous);}
  return true;
 }

 dispose(){
  this.live?.dispose();this.hold?.dispose();this.live=null;this.hold=null;this.holdReady=false;
  this.quad.geometry.dispose();this.material.dispose();
 }

 private renderLive(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,live:THREE.WebGLRenderTarget){
  renderer.setRenderTarget(live);renderer.clear();renderer.render(scene,camera);
 }

 /** Writes the composite into `out` (null = the canvas). `outSize` is the output's pixel size; the held frame is fitted to it. */
 private quadPass(renderer:THREE.WebGLRenderer,params:{colourW:number;useHold:boolean;holdRect:HoldRect},live:THREE.WebGLRenderTarget,hold:THREE.WebGLRenderTarget|null,out:THREE.WebGLRenderTarget|null,outSize:Size,colour:Rgb,ground:Rgb){
  const u=this.material.uniforms,fit=hold?holdFit(outSize,{width:hold.width,height:hold.height}):NO_FIT;
  u.tLive.value=live.texture;u.tHold.value=(hold??live).texture;
  (u.uColour.value as THREE.Vector3).set(colour[0],colour[1],colour[2]);
  (u.uGround.value as THREE.Vector3).set(ground[0],ground[1],ground[2]);
  u.uColourW.value=params.colourW;u.uUseHold.value=params.useHold&&this.holdReady?1:0;
  (u.uHoldRect.value as THREE.Vector4).set(...params.holdRect);
  (u.uHoldScale.value as THREE.Vector2).set(fit.scale[0],fit.scale[1]);
  (u.uHoldOffset.value as THREE.Vector2).set(fit.offset[0],fit.offset[1]);
  renderer.setRenderTarget(out);renderer.render(this.quadScene,this.quadCamera);
 }

 private target(which:'live'|'hold',needed:Size|null):THREE.WebGLRenderTarget|null{
  const current=this[which];
  const action:RenderTargetAction=renderTargetAction(current?{width:current.width,height:current.height}:null,needed);
  if(action==='release'||action==='resize'){current?.dispose();this[which]=null;if(which==='hold')this.holdReady=false;}
  if((action==='allocate'||action==='resize')&&needed){
   this[which]=new THREE.WebGLRenderTarget(needed.width,needed.height,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});
  }
  return this[which];
 }
}

function drawingSize(renderer:THREE.WebGLRenderer):Size{
 const v=renderer.getDrawingBufferSize(new THREE.Vector2());
 return {width:Math.round(v.x),height:Math.round(v.y)};
}
