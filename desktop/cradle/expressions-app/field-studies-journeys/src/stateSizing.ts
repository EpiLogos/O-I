import {Entity,SequenceStep,clone} from './model';
import {captureObjectState} from './sourceState';
import {fittedSize,inkAspect,measureInkBox} from '../../src/engine/glyphMetrics';
/** Normalization law: a glyph-defining edit refits size boxes with fittedSize so the new
 *  glyph fills its box undistorted (same area, same deliberate stretch) and every state
 *  renormalizes on a shared basis. Pure w.r.t. everything but the entities passed in. */
export type FontRef={fontFamily?:string;fontWeight?:string|number};
type ObjectState=NonNullable<SequenceStep['objectState']>;
/** Ink aspect of a glyph string under the engine rasterization law (empty text samples 'O'). */
const glyphAspect=(text:string,font:FontRef)=>inkAspect(measureInkBox(text,font.fontFamily,font.fontWeight));
/** Refits apply to text glyphs only: image/ASCII pools are aspect-true and manage their own geometry. */
const isTextGlyph=(shape:SequenceStep['shape'],source:SequenceStep['source'])=>shape==='text'&&!source;
/** The nearest earlier state carrying its own objectState, if any. */
const nearestState=(e:Entity,index:number):ObjectState|undefined=>{for(let i=index-1;i>=0;i--)if(e.sequence.steps[i]?.objectState)return e.sequence.steps[i].objectState;return undefined;};
/** Snapshot a new objectState starts from: the nearest earlier state's appearance, else the entity base. */
export function capturedStepState(e:Entity,index:number):ObjectState{
 return clone(nearestState(e,index)??captureObjectState(e).objectState!);
}
/** A step's effective box today: its own state box, else the entity base extent. */
const effectiveBox=(e:Entity,k:SequenceStep)=>k.objectState?.size??e.size;
/** An explicitly refitted legacy glyph must use the same normalized target law as new formations. */
function enableNormalisedExtent(e:Entity){
 if(e.native)e.native={...e.native,extent:{width:e.size.x*400,height:e.size.y*400,rotation:e.rotation*Math.PI/180,...e.native.extent,normalized:true}};
}
/** Refit one step's box for a text edit; a stateless step gains an objectState snapshot first. */
export function refitStepForText(e:Entity,index:number,prevText:string,nextText:string,font:FontRef){
 const k=e.sequence.steps[index];if(!k||!isTextGlyph(k.shape,k.source))return;
 const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,index);k.objectState.normalized=true;
 k.objectState.size=fittedSize(box,glyphAspect(prevText,font),glyphAspect(nextText,font));
}
/** Refit the entity base box for a held-entity text edit (the rendered extent when the sequence is off). */
export function refitEntityForText(e:Entity,prevText:string,nextText:string,font:FontRef){
 if(!isTextGlyph(e.shape,e.source))return;
 enableNormalisedExtent(e);
 e.size=fittedSize(e.size,glyphAspect(prevText,font),glyphAspect(nextText,font));
}
/** A font change re-derives every text box from the new glyph metrics at constant area. */
export function refitFormationForFont(e:Entity,prevFont:FontRef,nextFont:FontRef){
 if(!e.sequence.enabled&&!e.sequence.manual&&isTextGlyph(e.shape,e.source)){enableNormalisedExtent(e);e.size=fittedSize(e.size,glyphAspect(e.text,prevFont),glyphAspect(e.text,nextFont));}
 e.sequence.steps.forEach((k,i)=>{
  if(!isTextGlyph(k.shape,k.source))return;
  const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,i);k.objectState.normalized=true;
  k.objectState.size=fittedSize(box,glyphAspect(k.text,prevFont),glyphAspect(k.text,nextFont));
 });
}
/** Explicit "refit all states": each box re-derives from its glyph's natural aspect at constant area. */
export function refitFormationToGlyphs(e:Entity,font:FontRef){
 if(!e.sequence.enabled&&!e.sequence.manual&&isTextGlyph(e.shape,e.source)){enableNormalisedExtent(e);e.size=fittedSize(e.size,null,glyphAspect(e.text,font));}
 e.sequence.steps.forEach((k,i)=>{
  if(!isTextGlyph(k.shape,k.source))return;
  const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,i);k.objectState.normalized=true;
  // prev=null normalizes the stretch to 1: the box adopts the glyph aspect outright.
  k.objectState.size=fittedSize(box,null,glyphAspect(k.text,font));
 });
}
/** A glyph applied from the library adopts its own box: the step refits to the new
 *  glyph's natural aspect at constant area, so every glyph in a sequence keeps its
 *  self-contained scaling instead of stretching into the previous glyph's shape. */
export function refitStepForGlyph(e:Entity,index:number,text:string,font:FontRef){
 const k=e.sequence.steps[index];if(!k||!isTextGlyph(k.shape,k.source))return;
 const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,index);k.objectState.normalized=true;
 // prev=null: a placed glyph is a new state, not an edit of the old one — adopt its aspect outright.
 k.objectState.size=fittedSize(box,null,glyphAspect(text,font));
}
/** The held-entity form of the same law: a glyph applied to the entity base refits the base box. */
export function refitEntityForGlyph(e:Entity,text:string,font:FontRef){
 if(!isTextGlyph(e.shape,e.source))return;
 enableNormalisedExtent(e);
 e.size=fittedSize(e.size,null,glyphAspect(text,font));
}
/** Sampled sources already carry their ink aspect. A square envelope keeps that
 * aspect intact while retaining the same area as the other states. */
export function refitStepForSource(e:Entity,index:number){
 const k=e.sequence.steps[index];if(!k?.source)return;
 const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,index);k.objectState.normalized=true;
 const side=Math.sqrt(box.x*box.y);k.objectState.size={x:side,y:side};
}
