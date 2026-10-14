import {esc} from './icons';
import {TRANSITION_KINDS,WIPE_DIRECTIONS,DIP_AT_MIN,DIP_AT_MAX,DIP_AT_DEFAULT,SWITCH_MODES,CURVE_TYPES,type TransitionKind,type WipeDirection,type TransitionParams,type TransitionSpec,type SwitchMode,type CurveType,type TransitionCurve,type CurveHandle} from '../../src/engine/transitionMath';
import {validateCurveEdit,valueAt,type Interpolation} from './propertyTracks';

/** Lane-3 E11, pure logic: the typed transition per seam, its validation, the seam glyph and chooser HTML, and the timeline
 * write. The arithmetic the production compositor uses (dip weights, the wipe's held rectangle, the pass parameters, the
 * colour bytes, the aspect mapping) lives in src/engine/transitionMath.ts, the one implementation; it is re-exported here
 * so the app and the tests keep one import path. A seam's transition belongs to the scene it enters: its kind and parameters
 * ride on that Scene beside its duration (`transition`), so they travel whole with the scene's material. Absent = crossfade,
 * the default every existing document already has, so an unchanged seam keeps the document byte-identical. */

export {TRANSITION_KINDS,WIPE_DIRECTIONS,DIP_AT_MIN,DIP_AT_MAX,DIP_AT_DEFAULT,SWITCH_MODES,CURVE_TYPES,dipWeights,wipeHoldRect,paintedPassParams,srgbUnit,renderTargetAction,transitionColourOf,holdFit,holdSampleUv,compositeMirror}
 from '../../src/engine/transitionMath';
export type {TransitionKind,WipeDirection,TransitionParams,TransitionSpec,PaintedPassParams,RenderTargetAction,HoldFit,PixelSize,SwitchMode,CurveType,TransitionCurve,CurveHandle}
 from '../../src/engine/transitionMath';

/** Lane-3 E08 and lane-5 T5 share one curve vocabulary. The engine restates it because it imports nothing; this line fails
 * to compile if the two ever diverge. */
const _curveVocabularyIsE08:[CurveType] extends [Interpolation]?([Interpolation] extends [CurveType]?true:never):never=true;
void _curveVocabularyIsE08;

/** The parameters each kind takes. A cut has no blend, so it takes a switch mode (when the cut lands) and no curve. */
const PARAMS:Record<TransitionKind,readonly string[]>={cut:['switchMode'],crossfade:['switchMode','curve'],'dip-to-colour':['at','switchMode','curve'],wipe:['direction','switchMode','curve']};
const SWITCH_LABEL:Record<SwitchMode,string>={immediate:'Immediate',sync:'Sync','at-end':'At end'};
const CURVE_LABEL:Record<CurveType,string>={linear:'Linear',hold:'Hold',smooth:'Smooth',bezier:'Bezier'};
export function switchLabel(mode:SwitchMode):string{return SWITCH_LABEL[mode];}
export function curveLabel(type:CurveType):string{return CURVE_LABEL[type];}

/** Lane-5 T5: the switch mode of a seam. Absent is immediate, the behaviour every document already has. */
export function switchModeOf(spec:TransitionSpec|undefined|null):SwitchMode{return spec?.switchMode??'immediate';}
/** The curve of a seam, or undefined where the blend is linear (absent). */
export function curveOf(spec:TransitionSpec|undefined|null):TransitionCurve|undefined{return spec?.curve;}

/** Lane-5 T5: the blend's progress at a fraction f in [0,1] through the seam's curve. Absent, or a linear curve, is the
 * identity (clamped), so a seam without a curve blends exactly as before. Other curves are the E08 segment law itself:
 * the same `valueAt` the property tracks evaluate, over a two-point segment from progress 0 to progress 1. */
export function curveProgress(curve:TransitionCurve|undefined|null,fraction:number):number{
 const f=Number.isFinite(fraction)?Math.min(1,Math.max(0,fraction)):0;
 if(!curve||curve.type==='linear')return f;
 return valueAt([{time:0,value:0,type:curve.type,out:curve.out},{time:1,value:1,in:curve.in}],f)??f;
}

/** Validates an E08 curve on a seam: the type by name, then the handles through E08's own edit validator (handle time inside
 * its segment, handle value inside the channel range, here progress 0 to 1). Handles belong to a bezier only. A linear curve
 * is absent, so it normalises away. */
export function validateTransitionCurve(value:unknown):TransitionCurve|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('A transition curve must be an object with a type.');
 const v=value as Record<string,unknown>,type=v.type;
 if(typeof type!=='string'||!(CURVE_TYPES as readonly string[]).includes(type))throw new Error(`Unknown transition curve ${JSON.stringify(String(type).slice(0,40))}. Choose linear, hold, smooth or bezier.`);
 for(const key of Object.keys(v))if(key!=='type'&&key!=='out'&&key!=='in')throw new Error(`A transition curve takes no ${key} parameter.`);
 const t=type as CurveType;
 if(t!=='bezier'&&(v.out!==undefined||v.in!==undefined))throw new Error('Only a bezier curve takes handles.');
 const out=v.out as CurveHandle|undefined,inn=v.in as CurveHandle|undefined;
 validateCurveEdit([{time:0,value:0,type:t as Interpolation,out},{time:1,value:1,in:inn}],{min:0,max:1},[{key:0},{key:1},{handle:0,end:'out'},{handle:1,end:'in'}]);
 if(t==='linear')return undefined;
 const curve:TransitionCurve={type:t};
 if(out!==undefined)curve.out={dt:out.dt,dv:out.dv};
 if(inn!==undefined)curve.in={dt:inn.dt,dv:inn.dv};
 return curve;
}
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
 const out:TransitionSpec={kind:k};
 if(v.at!==undefined){
  if(typeof v.at!=='number'||!Number.isFinite(v.at)||v.at<DIP_AT_MIN||v.at>DIP_AT_MAX)throw new Error(`Dip to colour reaches its colour between ${DIP_AT_MIN} and ${DIP_AT_MAX} of the transition.`);
  out.at=v.at;
 }
 if(v.direction!==undefined){
  if(!(WIPE_DIRECTIONS as readonly unknown[]).includes(v.direction))throw new Error('A wipe runs left, right, up or down.');
  out.direction=v.direction as WipeDirection;
 }
 // Lane-5 T5: the switch mode and the curve are edge facts. Immediate and linear are the absent defaults and are not written.
 if(v.switchMode!==undefined){
  if(typeof v.switchMode!=='string'||!(SWITCH_MODES as readonly string[]).includes(v.switchMode))throw new Error(`Unknown switch mode ${JSON.stringify(String(v.switchMode).slice(0,40))}. Choose immediate, sync or at-end.`);
  if(v.switchMode!=='immediate')out.switchMode=v.switchMode as SwitchMode;
 }
 if(v.curve!==undefined){const curve=validateTransitionCurve(v.curve);if(curve)out.curve=curve;}
 // Crossfade is the document's default and is carried by absence, unless an edge fact (a switch mode or a curve) makes it differ.
 if(k==='crossfade'&&out.switchMode===undefined&&out.curve===undefined)return undefined;
 return out;
}

/** The spec for a kind and its parameters, validated. Parameters the kind does not take are refused by name. */
export function transitionSpecFor(kind:TransitionKind,params:TransitionParams={}):TransitionSpec|undefined{
 const raw:Record<string,unknown>={kind};
 if(params.at!==undefined)raw.at=params.at;
 if(params.direction!==undefined)raw.direction=params.direction;
 if(params.switchMode!==undefined)raw.switchMode=params.switchMode;
 if(params.curve!==undefined)raw.curve=params.curve;
 return validateTransitionSpec(raw);
}

/** Lane-5 T5: a seam's edge facts are its switch mode and its curve. They are not kind parameters, so a kind change or a
 * seconds edit does not own them and must not drop them. */
export function edgeFactsOf(spec:TransitionSpec|undefined|null):Pick<TransitionParams,'switchMode'|'curve'>{
 return {switchMode:spec?.switchMode,curve:spec?.curve};
}

/** The spec a seam takes when its edge facts are replaced: the kind and parameters kept, the switch mode and curve set as given
 * (`undefined` = the default), and validated the same way a load is. A cut takes no curve, so a curve is dropped with a cut. */
export function specWithEdge(spec:TransitionSpec|undefined|null,edge:Partial<Pick<TransitionParams,'switchMode'|'curve'>>):TransitionSpec|undefined{
 const base:Record<string,unknown>={kind:transitionKindOf(spec)};
 if(spec?.at!==undefined)base.at=spec.at;
 if(spec?.direction!==undefined)base.direction=spec.direction;
 const switchMode='switchMode' in edge?edge.switchMode:spec?.switchMode;
 const curve='curve' in edge?edge.curve:spec?.curve;
 if(switchMode!==undefined)base.switchMode=switchMode;
 if(curve!==undefined&&base.kind!=='cut')base.curve=curve;
 return validateTransitionSpec(base);
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
 // Lane-5 T5: the kind and its parameters come from `spec`; the switch mode and curve come from `spec` when it names them, else
 // they are kept from the seam as it stands. Without edge facts this writes exactly what it wrote before.
 const next=specWithEdge(spec,{switchMode:spec?.switchMode??s.transitionSpec?.switchMode,curve:spec?.curve??s.transitionSpec?.curve});
 if(next)s.transitionSpec=next;else delete s.transitionSpec;
 s.transition=seconds;
}

/** Lane-5 T5: the edge a seam's switch mode or curve edit writes, validated. The result is the whole seam spec, or undefined
 * when the seam returns to the default (crossfade, immediate, linear). The caller owns the labelled write. */
export function seamEdgeSpec(spec:TransitionSpec|undefined|null,edit:{switchMode?:SwitchMode;curve?:TransitionCurve|undefined}):TransitionSpec|undefined{
 return specWithEdge(spec,{...('switchMode' in edit?{switchMode:edit.switchMode}:{}),...('curve' in edit?{curve:edit.curve}:{})} as Partial<Pick<TransitionParams,'switchMode'|'curve'>>);
}

/** Lane-5 T5 / T8: the one scene field a loop exit writes. It belongs to the scene whose exit edge wraps (the last scene), so it
 * travels with that scene through a reorder. Absent is the loop wrapping, the behaviour every document already has. */
export function writeLoopExit(scenes:Array<{id:string;breakAtEnd?:boolean}>,sceneId:string,on:boolean):void{
 const s=scenes.find(v=>v.id===sceneId);if(!s)throw new Error('That scene is no longer in this expression.');
 if(on)s.breakAtEnd=true;else delete s.breakAtEnd;
}

/** The label of the one undo entry an edge edit makes, in the app's voice. */
export function edgeEditLabel(edit:{kind:'switch';mode:SwitchMode}|{kind:'curve';type:CurveType}|{kind:'loop';on:boolean}):string{
 if(edit.kind==='switch')return `Set transition switch ${switchLabel(edit.mode).toLowerCase()}`;
 if(edit.kind==='curve')return `Set transition curve ${curveLabel(edit.type).toLowerCase()}`;
 return edit.on?'Set loop exit at end':'Clear loop exit';
}


/** E11b, pure: the production compositor's seam. Only the painted kinds (dip to colour, wipe) need a compositing pass;
 * cut and crossfade draw directly, exactly as before. */
export function isPaintedKind(kind:TransitionKind):boolean{return kind==='dip-to-colour'||kind==='wipe';}

/** True from a painted transition's start up to its end. The first frame (fraction 0) is in force, so a wipe shows the held
 * outgoing frame from the outset; for any other kind, or outside the transition, the frame draws directly. */
export function paintedOverlayActive(spec:TransitionSpec|undefined|null,fraction:number):boolean{
 return !!spec&&isPaintedKind(spec.kind)&&fraction>=0&&fraction<1;
}
