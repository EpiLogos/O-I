import {esc} from './icons';

/** Lane-3 E11, pure logic: the typed transition per seam, its validation, the blend weights at a fraction, the wipe's
 * held rectangle, and the seam glyph and chooser HTML. The compositing lives in app.ts (the preview overlay) and in
 * production.ts (the config blend). A seam's transition belongs to the scene it enters: its kind and parameters ride on
 * that Scene beside its duration (`transition`), so they travel whole with the scene's material. Absent = crossfade,
 * the default every existing document already has, so an unchanged seam keeps the document byte-identical. */

export const TRANSITION_KINDS=['cut','crossfade','dip-to-colour','wipe'] as const;
export type TransitionKind=(typeof TRANSITION_KINDS)[number];
export const WIPE_DIRECTIONS=['left','right','up','down'] as const;
export type WipeDirection=(typeof WIPE_DIRECTIONS)[number];
/** Where, as a fraction of the transition, the colour is fully reached. */
export const DIP_AT_MIN=.2,DIP_AT_MAX=.8,DIP_AT_DEFAULT=.5;
export interface TransitionParams {at?:number;direction?:WipeDirection}
export interface TransitionSpec extends TransitionParams {kind:TransitionKind}

const PARAMS:Record<TransitionKind,readonly string[]>={cut:[],crossfade:[],'dip-to-colour':['at'],wipe:['direction']};
const KIND_LABEL:Record<TransitionKind,string>={cut:'Cut',crossfade:'Crossfade','dip-to-colour':'Dip to colour',wipe:'Wipe'};
const DIRECTION_LABEL:Record<WipeDirection,string>={left:'Wipe left',right:'Wipe right',up:'Wipe up',down:'Wipe down'};

export function transitionKindOf(spec:TransitionSpec|undefined|null):TransitionKind{return spec?.kind??'crossfade';}
export function kindLabel(kind:TransitionKind):string{return KIND_LABEL[kind];}
/** The label of the one undo entry a seam change makes, in the app's voice. */
export function transitionLabel(kind:TransitionKind):string{return `Set transition ${kind}`;}

/** Validates a stored spec. Unknown kinds and parameters are refused by name; parameters are bounded. Crossfade is never
 * kept: it normalises to absent, the document's default. */
export function validateTransitionSpec(value:unknown):TransitionSpec|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('A scene transition must be an object with a kind.');
 const v=value as Record<string,unknown>,kind=v.kind;
 if(typeof kind!=='string'||!(TRANSITION_KINDS as readonly string[]).includes(kind))throw new Error(`Unknown transition kind ${JSON.stringify(String(kind).slice(0,40))}. Choose cut, crossfade, dip-to-colour or wipe.`);
 const k=kind as TransitionKind;
 for(const key of Object.keys(v))if(key!=='kind'&&!PARAMS[k].includes(key))throw new Error(`Transition ${k} takes no ${key} parameter.`);
 if(k==='crossfade')return undefined;
 const out:TransitionSpec={kind:k};
 if(v.at!==undefined){
  if(typeof v.at!=='number'||!Number.isFinite(v.at)||v.at<DIP_AT_MIN||v.at>DIP_AT_MAX)throw new Error(`Dip to colour reaches its colour between ${DIP_AT_MIN} and ${DIP_AT_MAX} of the transition.`);
  out.at=v.at;
 }
 if(v.direction!==undefined){
  if(!(WIPE_DIRECTIONS as readonly unknown[]).includes(v.direction))throw new Error('A wipe runs left, right, up or down.');
  out.direction=v.direction as WipeDirection;
 }
 return out;
}

/** The spec for a kind and its parameters, validated. Parameters the kind does not take are refused by name. */
export function transitionSpecFor(kind:TransitionKind,params:TransitionParams={}):TransitionSpec|undefined{
 const raw:Record<string,unknown>={kind};
 if(params.at!==undefined)raw.at=params.at;
 if(params.direction!==undefined)raw.direction=params.direction;
 return validateTransitionSpec(raw);
}

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

const GLYPH:Record<TransitionKind,string>={
 cut:'<rect x="2.5" y="3" width="4.5" height="10" rx="1"/><rect x="9" y="3" width="4.5" height="10" rx="1"/>',
 crossfade:'<circle cx="6" cy="8" r="4.5"/><circle cx="10" cy="8" r="4.5"/>',
 'dip-to-colour':'<path d="M2.5 3.5 8 10l5.5-6.5"/><path d="M2.5 13.5h11"/>',
 wipe:'<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M7.5 3v10"/>',
};
const ARROW:Record<WipeDirection,string>={left:'M13 8H3M6 5 3 8l3 3',right:'M3 8h10M10 5l3 3-3 3',up:'M8 13V3M5 6l3-3 3 3',down:'M8 3v10M5 10l3 3 3-3'};
const svg=(body:string)=>`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export function transitionGlyph(kind:TransitionKind):string{return svg(GLYPH[kind]);}
export function directionGlyph(direction:WipeDirection):string{return svg(`<path d="${ARROW[direction]}"/>`);}

/** The seam glyph between two clips: an icon button at the seam's left edge, placed in percent of the track. */
export function seamGlyphHTML(scene:{id:string;name:string;transitionSpec?:TransitionSpec},leftPercent:number):string{
 const kind=transitionKindOf(scene.transitionSpec),label=`${kindLabel(kind)} into ${scene.name}`;
 return `<button type="button" class="seam-glyph" data-action="seam-transition" data-scene-id="${esc(scene.id)}" style="left:${leftPercent.toFixed(3)}%" aria-label="${esc(label)}" title="${esc(label)}">${transitionGlyph(kind)}</button>`;
}

/** The compact chooser for the seam into a scene: kind, its parameters, and the duration (the scene's `transition`). */
export function seamChooserHTML(scene:{id:string;name:string;transition:number;transitionSpec?:TransitionSpec},seconds:{min:number;max:number}):string{
 const spec=scene.transitionSpec,kind=transitionKindOf(spec),id=esc(scene.id);
 const kinds=TRANSITION_KINDS.map(k=>`<button type="button" class="seam-kind" data-action="set-transition-kind" data-scene-id="${id}" data-kind="${k}" aria-pressed="${k===kind}" aria-label="${esc(kindLabel(k))}" title="${esc(kindLabel(k))}">${transitionGlyph(k)}</button>`).join('');
 const at=spec?.at??DIP_AT_DEFAULT;
 const param=kind==='dip-to-colour'
  ?`<label class="seam-param"><span>Colour reached at</span><input type="range" min="${DIP_AT_MIN}" max="${DIP_AT_MAX}" step=".05" value="${at}" data-transition-at data-scene-id="${id}" aria-valuetext="${Math.round(at*100)} percent of the transition"></label>`
  :kind==='wipe'
   ?`<div class="seam-directions" role="group" aria-label="Wipe direction">${WIPE_DIRECTIONS.map(d=>`<button type="button" data-action="set-transition-direction" data-scene-id="${id}" data-direction="${d}" aria-pressed="${(spec?.direction??'left')===d}" aria-label="${esc(DIRECTION_LABEL[d])}" title="${esc(DIRECTION_LABEL[d])}">${directionGlyph(d)}</button>`).join('')}</div>`
   :'';
 return `<div class="seam-chooser" role="group" aria-label="${esc(`Transition into ${scene.name}`)}"><div class="seam-kinds">${kinds}</div>${param}<label class="seam-seconds"><span>Seconds</span><input type="number" min="${seconds.min}" max="${seconds.max}" step=".1" value="${scene.transition}" data-transition-seconds data-scene-id="${id}"></label></div>`;
}

/** The timeline write of a seam change: its kind (absent for crossfade) and its duration. Callers run it inside
 * applyTimelineMove, so the write is guarded like every other timeline fact and the change is one labelled edit. */
export function writeSeamTransition(scenes:Array<{id:string;transition:number;transitionSpec?:TransitionSpec}>,sceneId:string,spec:TransitionSpec|undefined,seconds:number):void{
 const s=scenes.find(v=>v.id===sceneId);if(!s)throw new Error('That scene is no longer in this expression.');
 if(spec)s.transitionSpec=JSON.parse(JSON.stringify(spec));else delete s.transitionSpec;
 s.transition=seconds;
}

/** E11b, pure: the production compositor's seam. Only the painted kinds (dip to colour, wipe) need a compositing pass;
 * cut and crossfade draw directly, exactly as before. */
export function isPaintedKind(kind:TransitionKind):boolean{return kind==='dip-to-colour'||kind==='wipe';}

/** True from a painted transition's start up to its end. The first frame (fraction 0) is in force, so a wipe shows the held
 * outgoing frame from the outset; for any other kind, or outside the transition, the frame draws directly. */
export function paintedOverlayActive(spec:TransitionSpec|undefined|null,fraction:number):boolean{
 return !!spec&&isPaintedKind(spec.kind)&&fraction>=0&&fraction<1;
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
