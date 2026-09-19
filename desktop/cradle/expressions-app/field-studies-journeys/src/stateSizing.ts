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
/** Refit one step's box for a text edit; a stateless step gains an objectState snapshot first. */
export function refitStepForText(e:Entity,index:number,prevText:string,nextText:string,font:FontRef){
 const k=e.sequence.steps[index];if(!k||!isTextGlyph(k.shape,k.source))return;
 const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,index);
 k.objectState.size=fittedSize(box,glyphAspect(prevText,font),glyphAspect(nextText,font));
}
/** Refit the entity base box for a held-entity text edit (the rendered extent when the sequence is off). */
export function refitEntityForText(e:Entity,prevText:string,nextText:string,font:FontRef){
 if(!isTextGlyph(e.shape,e.source))return;
 e.size=fittedSize(e.size,glyphAspect(prevText,font),glyphAspect(nextText,font));
}
/** A font change re-derives every text box from the new glyph metrics at constant area. */
export function refitFormationForFont(e:Entity,prevFont:FontRef,nextFont:FontRef){
 if(!e.sequence.enabled&&!e.sequence.manual&&isTextGlyph(e.shape,e.source))e.size=fittedSize(e.size,glyphAspect(e.text,prevFont),glyphAspect(e.text,nextFont));
 e.sequence.steps.forEach((k,i)=>{
  if(!isTextGlyph(k.shape,k.source))return;
  const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,i);
  k.objectState.size=fittedSize(box,glyphAspect(k.text,prevFont),glyphAspect(k.text,nextFont));
 });
}
/** Explicit "refit all states": each box re-derives from its glyph's natural aspect at constant area. */
export function refitFormationToGlyphs(e:Entity,font:FontRef){
 if(!e.sequence.enabled&&!e.sequence.manual&&isTextGlyph(e.shape,e.source))e.size=fittedSize(e.size,null,glyphAspect(e.text,font));
 e.sequence.steps.forEach((k,i)=>{
  if(!isTextGlyph(k.shape,k.source))return;
  const box=effectiveBox(e,k);k.objectState??=capturedStepState(e,i);
  // prev=null normalizes the stretch to 1: the box adopts the glyph aspect outright.
  k.objectState.size=fittedSize(box,null,glyphAspect(k.text,font));
 });
}
