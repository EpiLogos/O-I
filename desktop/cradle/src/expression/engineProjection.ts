import {generatedWikiAppearance} from "../../../../packages/oi-design-system/expressions-engine/oi/wikiPresentation.mjs";
import type {Entity, ExpressionDocument, Relation} from "./types";
import {blankScene} from "@epilogos/oi-design-system/expressions-engine/shell/model.mjs";
import {nativeExport} from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";

const material = nativeExport(blankScene()).config;
export const FORMATION_BUDGET = 10;
export const PIN_BUDGET = 8;
const value = (entity:Entity, key:string, fallback:string|number) => entity.parameters[key]?.value ?? fallback;
const primitives = new Set(["ring", "disc", "square", "triangle"]);

/** A bounded renderer window over the FULL native Scene. Selection can bring
 * a previously unloaded occurrence into view; it never deletes membership. */
export function expressionWindow(document:ExpressionDocument, start=0) {
  const scene=document.scenes.find(s=>s.scene_ref===document.selection.scene_ref);
  if(!scene) throw new Error("Expression scene unavailable");
  const forms:string[]=[], pins:string[]=[];
  for(const ref of scene.entity_refs) {
    const entity=document.entities[ref];
    if(!entity) throw new Error(`Expression entity unavailable: ${ref}`);
    (value(entity,"kind","formation")==="pin" ? pins : forms).push(ref);
  }
  const selected=document.selection.entity_ref;
  const relation=document.selection.relation_ref ? document.relations[document.selection.relation_ref] : null;
  const forced=selected ? [selected] : relation ? [relation.from_entity_ref,relation.to_entity_ref] : [];
  const page=Math.max(0,Math.min(Math.floor(start/FORMATION_BUDGET)*FORMATION_BUDGET,Math.floor(Math.max(0,forms.length-1)/FORMATION_BUDGET)*FORMATION_BUDGET));
  const visible=forms.slice(page,page+FORMATION_BUDGET);
  const include=(window:string[],all:string[],budget:number) => {
    for(const ref of forced) if(all.includes(ref) && !window.includes(ref)) {
      if(window.length===budget){let replace=window.length-1;while(replace>=0 && forced.includes(window[replace]))replace--;if(replace>=0)window.splice(replace,1);}
      window.push(ref);
    }
  };
  include(visible,forms,FORMATION_BUDGET);
  const visiblePins=pins.slice(0,PIN_BUDGET);include(visiblePins,pins,PIN_BUDGET);
  visible.push(...visiblePins);
  const shown=new Set(visible);
  return {scene,visible,hidden:scene.entity_refs.filter(ref=>!shown.has(ref)),total:scene.entity_refs.length};
}

/** Material projection, not another document or physics owner. Correspondence
 * travels separately from shape, and only exact co-present occurrences bind. */
export function expressionConfig(document:ExpressionDocument, start=0):Record<string,unknown> {
  const window=expressionWindow(document,start);
  const automations:unknown[]=[];
  const entities=window.visible.map((ref,index)=>{
    const entity=document.entities[ref], v=(key:string,fallback:string|number)=>value(entity,key,fallback);
    for(const [key,p] of Object.entries(entity.parameters)) if(p.automation){
      const a=p.automation;
      const path = ({width:"extent.width",height:"extent.height",rotation:"extent.rotation",frequency:"shape.frequencyHz",force_strength:"forces.strength",force_radius:"forces.radius",force_spin:"forces.spin"} as Record<string,string>)[key] ?? key;
      automations.push({id:`${ref}:automation:${key}`,path:`entities.${index}.${path}`,enabled:true,type:"lfo",waveform:a.waveform,min:a.min,max:a.max,rateHz:a.rate_hz,phase:0,blend:"replace"});
    }
    const appearance=window.scene.presentation?null:generatedWikiAppearance(document,entity);
    const shapeName=appearance?.shape??String(v("shape","glyph"));
    const shape=primitives.has(shapeName)?{kind:"primitive",primitive:shapeName}
      : shapeName==="yantra"?{kind:"yantra",yantraId:v("yantra","anahata")}
      : shapeName==="cymatic"?{kind:"cymatic",frequencyHz:v("frequency",396),plateGeometry:"square",dimension:"2D"}
      : {kind:"glyph",text:v("glyph",entity.title.slice(0,120))};
    const ascii=v("ascii","");
    const image=v("image","");
    // Native engine source carriers. No URL fetch, guessed source path or
    // implicit disclosure: image bytes must already be deliberately admitted.
    const source=ascii?{kind:"ascii",ascii:{text:String(ascii)}}
      : image?{kind:"image",image:{name:entity.title,dataUrl:String(image),mode:"luminance",threshold:0.5,scale:1}}:undefined;
    return {id:ref,name:appearance?.title??entity.title,kind:v("kind","formation"),enabled:true,
      x:v("x",0),y:v("y",0),z:v("z",0),scale:v("scale",1),share:v("share",1),shape,
      ...(source?{authoringSource:source}:{}),
      extent:{width:v("width",400),height:v("height",400),rotation:v("rotation",0),normalized:true},
      forces:{mode:v("force_mode","none"),strength:v("force_strength",0),radius:v("force_radius",100),spin:v("force_spin",0)},
      sequence:{advance:"off",links:[]}};
  });
  const visible=new Set(window.visible);
  const allRelations=Object.values(document.relations ?? {});
  const relations:Relation[]=allRelations.filter(r=>visible.has(r.from_entity_ref)&&visible.has(r.to_entity_ref)&&r.relation.availability==="available");
  return {sourceType:"composition",glyph:" ",particleCount:8192,entities,automations,
    // O:I-authored renderer extension reads this before native migration. It
    // retains occurrence identity and source standing, never infers semantics.
    oiExpressionBindings:{schema:"oi.expression-render-bindings/v1",expression_ref:document.expression_ref,
      scene_ref:window.scene.scene_ref,relations,
      hidden_entity_refs:window.hidden,total_entities:window.total,
      unrendered_relation_refs:allRelations.filter(r=>!relations.includes(r)).map(r=>r.binding_ref),
      body:window.scene.body ?? null},
    color:structuredClone(material.color),colorMode:material.colorMode,
    material:structuredClone(material.material),particleSize:structuredClone(material.particleSize),style:material.style,dotShape:material.dotShape,
    backgroundColor:material.backgroundColor,backgroundMode:material.backgroundMode};
}
