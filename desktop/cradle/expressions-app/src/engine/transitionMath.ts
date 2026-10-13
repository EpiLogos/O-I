/** Lane-3 E11c, pure: the transition arithmetic the production engine needs (the dip's weights, the wipe's held rectangle,
 * the pass parameters, the colour bytes, the render-target action, and the held frame's aspect mapping). This module has
 * no imports, so the engine does not depend on the app. field-studies-journeys/src/transitions.ts re-exports these; there
 * is one implementation. */

export const TRANSITION_KINDS=['cut','crossfade','dip-to-colour','wipe'] as const;
export type TransitionKind=(typeof TRANSITION_KINDS)[number];
export const WIPE_DIRECTIONS=['left','right','up','down'] as const;
export type WipeDirection=(typeof WIPE_DIRECTIONS)[number];
/** Where, as a fraction of the transition, the colour is fully reached. */
export const DIP_AT_MIN=.2,DIP_AT_MAX=.8,DIP_AT_DEFAULT=.5;
export interface TransitionParams {at?:number;direction?:WipeDirection}
export interface TransitionSpec extends TransitionParams {kind:TransitionKind}

const clamp01=(n:number)=>Number.isFinite(n)?Math.min(1,Math.max(0,n)):0;

/** Dip to colour: the outgoing scene gives way to the colour over the first part of the transition (fraction below
 * `at`), then the colour gives way to the incoming scene. The three weights sum to 1 at every fraction. */
export function dipWeights(fraction:number,at:number=DIP_AT_DEFAULT):{outgoing:number;colour:number;incoming:number}{
 const f=clamp01(fraction);
 if(f<at){const outgoing=1-f/at;return {outgoing,colour:1-outgoing,incoming:0};}
 const colour=1-(f-at)/(1-at);
 return {outgoing:0,colour,incoming:1-colour};
}

/** Wipe: the rectangle the outgoing scene still holds at a fraction. The incoming scene shows in the rest. The mask edge
 * sits at the fraction along the axis the wipe travels: a right wipe reveals from the left, a down wipe from the top. */
export function wipeHoldRect(direction:WipeDirection,fraction:number,width:number,height:number):{x:number;y:number;width:number;height:number}{
 const e=clamp01(fraction);
 switch(direction){
  case 'right':return {x:e*width,y:0,width:(1-e)*width,height};
  case 'left':return {x:0,y:0,width:(1-e)*width,height};
  case 'down':return {x:0,y:e*height,width,height:(1-e)*height};
  case 'up':return {x:0,y:0,width,height:(1-e)*height};
 }
}

/** The pass parameters for a painted transition at a fraction, on a target of the given pixel size. `colourW` is the share
 * of the colour laid over the live frame (dipWeights). A wipe's hold rectangle is in GL framebuffer coordinates (origin
 * bottom-left), the space a fragment reads from gl_FragCoord. Until the outgoing frame is held a wipe has nothing to hold,
 * so it draws the live frame everywhere rather than inventing one. */
export interface PaintedPassParams{colourW:number;useHold:boolean;holdRect:[number,number,number,number]}
export function paintedPassParams(spec:TransitionSpec,fraction:number,width:number,height:number,holdReady:boolean):PaintedPassParams{
 const f=clamp01(fraction),empty:[number,number,number,number]=[0,0,0,0];
 if(spec.kind==='dip-to-colour')return {colourW:dipWeights(f,spec.at).colour,useHold:false,holdRect:empty};
 if(spec.kind==='wipe'){
  if(!holdReady)return {colourW:0,useHold:false,holdRect:empty};
  const r=wipeHoldRect(spec.direction??'left',f,width,height);
  return {colourW:0,useHold:true,holdRect:[r.x,height-(r.y+r.height),r.width,r.height]};
 }
 return {colourW:0,useHold:false,holdRect:empty};
}

/** A #rgb or #rrggbb colour as sRGB unit components. The division is exact to the 8-bit channel, so a colour written
 * through the pass reads back as the same bytes the field's background was authored with. */
export function srgbUnit(hex:string):[number,number,number]{
 const m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
 if(!m)throw new Error(`A transition colour is a #rgb or #rrggbb hex value, not ${JSON.stringify(String(hex).slice(0,24))}.`);
 const digits=m[1].length===3?[...m[1]].map(c=>c+c).join(''):m[1],n=parseInt(digits,16);
 return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

/** What a compositing target needs this frame: nothing, a fresh target, a resize (which drops its content, so a held frame
 * must be captured again), or release when the transition has ended. */
export type RenderTargetAction='none'|'allocate'|'resize'|'release';
export function renderTargetAction(current:{width:number;height:number}|null,needed:{width:number;height:number}|null):RenderTargetAction{
 if(!needed)return current?'release':'none';
 if(!current)return 'allocate';
 return current.width===needed.width&&current.height===needed.height?'none':'resize';
}

/** The colour a dip reaches: the incoming field's background when it is a hex value the pass can write exactly, else the
 * paper colour the field already falls back to. A dip never throws inside the render loop. */
export function transitionColourOf(background:string|undefined|null):string{
 return background&&/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background.trim())?background.trim():'#f4f2eb';
}

/** Aspect mapping for the held frame. The hold is captured at the canvas's size; a still may be a different aspect. The
 * held image is fitted inside the output (contain): it keeps its own proportions, is never stretched, and the margins it
 * does not cover show the ground. `scale` and `offset` map output UV to hold UV: holdUv = (outUv - offset) / scale. */
export interface HoldFit{scale:[number,number];offset:[number,number]}
export interface PixelSize{width:number;height:number}
const IDENTITY_FIT:HoldFit={scale:[1,1],offset:[0,0]};
export function holdFit(out:PixelSize,hold:PixelSize):HoldFit{
 if(!(out.width>0&&out.height>0&&hold.width>0&&hold.height>0))return {scale:[...IDENTITY_FIT.scale],offset:[...IDENTITY_FIT.offset]};
 const outAspect=out.width/out.height,holdAspect=hold.width/hold.height;
 if(Math.abs(outAspect-holdAspect)<1e-9)return {scale:[1,1],offset:[0,0]};
 if(holdAspect>outAspect){const sy=outAspect/holdAspect;return {scale:[1,sy],offset:[0,(1-sy)/2]};}
 const sx=holdAspect/outAspect;return {scale:[sx,1],offset:[(1-sx)/2,0]};
}
/** The hold's UV at an output UV, or null where the held image does not reach (the ground shows there). */
export function holdSampleUv(uv:[number,number],fit:HoldFit):[number,number]|null{
 const u=(uv[0]-fit.offset[0])/fit.scale[0],v=(uv[1]-fit.offset[1])/fit.scale[1];
 return u>=0&&u<=1&&v>=0&&v<=1?[u,v]:null;
}

/** CPU mirror of the pass's composite (the shader in transitionPass.ts): the live pixel mixed toward the colour by colourW,
 * then laid over the ground. The output alpha is always 1: a painted transition frame is opaque. */
export function compositeMirror(live:[number,number,number,number],colourW:number,colour:[number,number,number],ground:[number,number,number]):[number,number,number,number]{
 const a=live[3]*(1-colourW)+colourW;
 const rgb=[0,1,2].map(i=>live[i]*(1-colourW)+colour[i]*colourW+ground[i]*(1-a));
 return [rgb[0],rgb[1],rgb[2],1];
}
