import type {ExpressionDocument} from "./types";
/** A projection into the existing native engine, never a parallel scene/clock.
 * Domain values and source bodies have no path into this material vocabulary. */
export function expressionConfig(document:ExpressionDocument):Record<string,unknown> {
 const scene=document.scenes.find(s=>s.scene_ref===document.selection.scene_ref);
 if(!scene) throw new Error("Expression scene unavailable");
 const automations:unknown[]=[];
 const entities=scene.entity_refs.map((ref,index)=>{
  const entity=document.entities[ref];
  if(!entity) throw new Error("Expression entity unavailable");
  const value=(key:string,fallback:string|number)=>entity.parameters[key]?.value??fallback;
  for(const [key,p] of Object.entries(entity.parameters)) if(p.automation){
   const a=p.automation;
   automations.push({id:`${ref}:automation:${key}`,path:`entities.${index}.${key}`,enabled:true,type:"lfo",waveform:a.waveform,min:a.min,max:a.max,rateHz:a.rate_hz,phase:0,blend:"replace"});
  }
  return {id:ref,name:entity.title,kind:"formation",enabled:true,x:value("x",0),y:value("y",0),z:value("z",0),scale:value("scale",1),share:value("share",1),shape:{kind:"glyph",text:value("glyph","O")},sequence:{advance:"off",links:[]}};
 });
 return {sourceType:"composition",glyph:" ",particleCount:8192,entities,automations};
}
