/** Local research presentation of the SAME native Scene. Canonical source
 * bodies/relations are never edited by these material actions. */
import {clone,entity,uid,type Scene} from './model.js';

export interface ResearchCard {
 type:'note'|'image';
 importedAt?:string; content?:string; caption?:string;
 color?:string; dotColour?:string; bgColour?:string; textColour?:string;
 /** Canvas display size only — never the Expression's own size. A
  * source-bound occurrence keeps its own expressive body regardless of how
  * large or small its card renders on this presentation Canvas. */
 size?:{width:number;height:number};

}
export interface ResearchViewport {x:number;y:number;zoom:number}
export interface ResearchStroke {id:string;points:{x:number;y:number;pressure?:number}[];color:string;width:number;opacity:number;createdAt:string}
/** A presentation-only visual grouping over existing occurrence ids — never
 * a membership/semantic record. `z` orders overlapping frames for drawing
 * (bring-to-front / send-to-back are presentation state, nothing else). */
export interface ResearchFrame {label:string;memberRefs:string[];z:number}
/** A named saved view: camera + the presentation state a person would
 * expect a "view" to restore — which cards were selected and which frame
 * sits on top. Never a second copy of graph material. */
export interface ResearchNamedView {viewport:ResearchViewport;selectedRefs:string[];frameOrder:string[]}
export interface ResearchMaterial {
 schema:'oi.research-scene/v1';cards:Record<string,ResearchCard>;strokes:ResearchStroke[];

 views:Record<string,ResearchViewport>; timeline:Record<string,{offsetY:number;width?:number;height?:number;lane?:string;layoutRevision?:number}>;
 frames:Record<string,ResearchFrame>; namedViews:Record<string,ResearchNamedView>;
}
export type ResearchMaterialAction =
 | {type:'resize';id:string;width:number;height:number}
 | {type:'duplicate';id:string}
 | {type:'create-card';kind:ResearchCard['type'];position:{x:number;y:number};title?:string;dataUrl?:string}
 | {type:'card-content';id:string;content:string}
 | {type:'card-caption';id:string;caption:string}
 | {type:'card-style';id:string;patch:Partial<Pick<ResearchCard,'color'|'dotColour'|'bgColour'|'textColour'>>}
 | {type:'annotation-add';stroke:ResearchStroke}
 | {type:'annotation-remove';id:string}
 | {type:'viewport';key:string;value:ResearchViewport}
 | {type:'timeline-layout';id:string;value:ResearchMaterial['timeline'][string];expectedRevision:number|null}
 | {type:'frame-save';id:string;label:string;memberRefs:string[]}
 | {type:'frame-remove';id:string}
 | {type:'frame-order';id:string;direction:'front'|'back'}
 | {type:'view-save';name:string;viewport:ResearchViewport;selectedRefs:string[];frameOrder:string[]}
 | {type:'view-remove';name:string};
const color=(value:unknown)=>typeof value==='string'&&/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
const finite=(v:unknown,low:number,high:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=low&&v<=high;
const text=(v:unknown,max=4096)=>typeof v==='string'&&v.length<=max;
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function require(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
function keys(value:object,allowed:string[]){require(Object.keys(value).every(key=>allowed.includes(key)),'Unknown research presentation field');}
export function validateResearchContent(content:string):void {
 require(text(content,65536),'Research note exceeds 64 KiB');const blocks:unknown=JSON.parse(content);
 require(Array.isArray(blocks)&&blocks.length<=256,'Research note requires bounded BlockNote blocks');
 const inspect=(v:unknown,depth=0):void=>{
  require(depth<=24,'Research note nesting exceeds its bound');
  if(Array.isArray(v)){require(v.length<=1024,'Research note array exceeds its bound');v.forEach(x=>inspect(x,depth+1));}
  else if(object(v))for(const [key,value] of Object.entries(v)){
   require(!['__proto__','prototype','constructor'].includes(key),'Unsafe note property');
   if(key==='type')require(!['image','video','audio','file'].includes(String(value)),'Insert media through the native image/resource action');
   if(key==='href')require(typeof value==='string'&&/^(https?:|mailto:)/i.test(value),'Unsupported note link');
   if(key==='url')require(!value,'Note media requires a native resource binding');
   inspect(value,depth+1);
  }else require(v===null||typeof v==='boolean'||typeof v==='string'||typeof v==='number'&&Number.isFinite(v),'Invalid note value');
 };inspect(blocks);
}
export function emptyResearchMaterial():ResearchMaterial{return {schema:'oi.research-scene/v1',cards:{},strokes:[],views:{},timeline:{},frames:{},namedViews:{}};}
export function pruneResearchOccurrence(scene:Scene,id:string):void {
 if(!scene.research)return;delete scene.research.cards[id];
 // A removed occurrence can neither remain frame membership nor be
 // addressed by a saved view's selection — both are ref-carrying
 // presentation state over occurrences that still exist. Research material
 // saved before frames/named views existed carries neither field.
 const frames=scene.research.frames??={};const namedViews=scene.research.namedViews??={};
 for(const frame of Object.values(frames))frame.memberRefs=frame.memberRefs.filter(ref=>ref!==id);
 for(const key of Object.keys(frames))if(!frames[key].memberRefs.length)delete frames[key];
 for(const view of Object.values(namedViews))view.selectedRefs=view.selectedRefs.filter(ref=>ref!==id);
}
export function validateResearchMaterial(value:unknown,ids:ReadonlySet<string>):asserts value is ResearchMaterial {
 require(object(value),'Research material must be an object');keys(value,['schema','cards','strokes','views','timeline','frames','namedViews']);
 require(value.schema==='oi.research-scene/v1','Unsupported research material');
 require(new TextEncoder().encode(JSON.stringify(value)).length<=262144,'Research material exceeds 256 KiB');
 for(const key of ['cards','views','timeline'])require(object(value[key])&&Object.keys(value[key]).length<=(key==='views'?16:256),'Research record count exceeds its bound');
 // Backward-compatible: research material persisted before frames/named
 // views existed carries neither field. Absent is valid (treated as empty);
 // present is validated strictly like every other record collection.
 if(value.frames!==undefined)require(object(value.frames)&&Object.keys(value.frames).length<=64,'Research frame count exceeds its bound');
 if(value.namedViews!==undefined)require(object(value.namedViews)&&Object.keys(value.namedViews).length<=32,'Research named view count exceeds its bound');
 for(const [,frame] of Object.entries(value.frames??{}) as [string,{label?:unknown;memberRefs?:unknown;z?:unknown}][]){
  require(object(frame),'Invalid frame');keys(frame,['label','memberRefs','z']);
  require(text(frame.label,160)&&!!frame.label,'Invalid frame label');
  require(Array.isArray(frame.memberRefs)&&frame.memberRefs.length>=1&&frame.memberRefs.length<=64&&frame.memberRefs.every(ref=>typeof ref==='string'&&ids.has(ref)),'Invalid frame membership');
  require(Number.isInteger(frame.z),'Invalid frame order');
 }
 for(const [,view] of Object.entries(value.namedViews??{}) as [string,{viewport?:unknown;selectedRefs?:unknown;frameOrder?:unknown}][]){
  require(object(view),'Invalid named view');keys(view,['viewport','selectedRefs','frameOrder']);
  validateViewport(view.viewport);
  require(Array.isArray(view.selectedRefs)&&view.selectedRefs.length<=64&&view.selectedRefs.every(ref=>typeof ref==='string'),'Invalid view selection');
  require(Array.isArray(view.frameOrder)&&view.frameOrder.length<=64&&view.frameOrder.every(ref=>typeof ref==='string'),'Invalid view frame order');
 }
 for(const [id,card] of Object.entries(value.cards) as [string,ResearchCard][]){
  require(ids.has(id)&&object(card),'Research card must address an existing occurrence');
  keys(card,['type','importedAt','content','caption','color','dotColour','bgColour','textColour','size']);
  require(['note','image'].includes(card.type),'Unknown research card kind');
  if(card.importedAt!==undefined)require(card.type==='image'&&text(card.importedAt,64)&&Number.isFinite(Date.parse(card.importedAt)),'Invalid image import time');
  if(card.content!==undefined){require(card.type==='note','Only note cards carry note content');validateResearchContent(card.content);}
  for(const key of ['caption'] as const)if(card[key]!==undefined)require(text(card[key]),'Research caption exceeds its bound');
  for(const key of ['color','dotColour','bgColour','textColour'] as const)if(card[key]!==undefined)require(color(card[key]),'Research colour is invalid');
  if(card.size!==undefined){require(object(card.size),'Invalid card display size');keys(card.size,['width','height']);require(finite(card.size.width,40,40000)&&finite(card.size.height,40,40000),'Invalid card display size');}
 }
 require(Array.isArray(value.strokes)&&value.strokes.length<=128,'Annotation count exceeds its bound');
 const seen=new Set<string>();for(const stroke of value.strokes){require(object(stroke),'Invalid annotation');keys(stroke,['id','points','color','width','opacity','createdAt']);require(text(stroke.id,160)&&!!stroke.id&&!seen.has(stroke.id),'Duplicate annotation');seen.add(stroke.id);require(color(stroke.color)&&finite(stroke.width,.1,100)&&finite(stroke.opacity,0,1)&&text(stroke.createdAt,64)&&Number.isFinite(Date.parse(stroke.createdAt)),'Invalid annotation style');require(Array.isArray(stroke.points)&&stroke.points.length>0&&stroke.points.length<=4096,'Annotation point budget exceeded');for(const p of stroke.points)require(object(p)&&finite(p.x,-40000,40000)&&finite(p.y,-40000,40000)&&(p.pressure===undefined||finite(p.pressure,0,1)),'Invalid annotation point');}
 for(const view of Object.values(value.views))validateViewport(view);
 for(const layout of Object.values(value.timeline) as ResearchMaterial['timeline'][string][]){require(object(layout),'Invalid timeline layout');keys(layout,['offsetY','width','height','lane','layoutRevision']);require((layout.lane===undefined||text(layout.lane,1024))&&(layout.layoutRevision===undefined||Number.isSafeInteger(layout.layoutRevision)&&layout.layoutRevision>=1),'Invalid timeline layout revision');require(finite(layout.offsetY,-40000,40000)&&(layout.width===undefined||finite(layout.width,40,40000))&&(layout.height===undefined||finite(layout.height,40,40000)),'Invalid timeline layout');}
}
function validateViewport(v:unknown):void{require(object(v),'Invalid research viewport');keys(v,['x','y','zoom']);require(finite(v.x,-1e8,1e8)&&finite(v.y,-1e8,1e8)&&finite(v.zoom,.001,1e5),'Research viewport exceeds its bound');}
/** Mutate only the supplied working Scene; caller persists through the existing
 * composition CAS. Validate before replacing so a refusal leaves it intact. */
export function applyResearchMaterial(scene:Scene,action:ResearchMaterialAction):void {
 const next=clone(scene);const research=next.research??=emptyResearchMaterial();
 // Research material saved before frames/named views existed carries
 // neither field; backfill on first write so every action below can assume
 // both are present, matching every other record collection here.
 research.frames??={};research.namedViews??={};
 const target=(id:string)=>{const found=next.entities.find(e=>e.id===id);require(found&&!found.locked,'Occurrence is missing or locked');return found;};
 // Presentation metadata must not manufacture a local note body over a
 // source-bound occurrence. Only explicit note creation/content owns content.
 const card=(id:string)=>{const e=target(id);return research.cards[id]??={type:e.source?.kind==='image'?'image':'note'};};
 switch(action.type){
 // Canvas display size is Research Canvas presentation only. It must never
 // reach the entity's own `size`, which is the Expression's expressive
 // body — resizing a card on this Canvas is not editing the source.
 case 'resize':{require(finite(action.width,40,40000)&&finite(action.height,40,40000),'Invalid card size');card(action.id).size={width:action.width,height:action.height};break;}
 case 'duplicate':{const original=target(action.id),copy=clone(original);copy.id=uid('research');copy.name=original.name+' copy';copy.position.x+=.1;copy.position.y-=.1;delete copy.native;next.entities.push(copy);if(research.cards[action.id])research.cards[copy.id]=clone(research.cards[action.id]);break;}
 case 'create-card':{require(finite(action.position.x,-100,100)&&finite(action.position.y,-100,100),'Invalid card position');const title=action.title??(action.kind==='image'?'Image':'Note');require(text(title,160)&&!!title,'Invalid card title');const e=entity(title,title.slice(0,120),{...action.position,z:0});e.id=uid('research');e.size={x:.6,y:.4};const c:ResearchCard={type:action.kind};if(action.kind==='note'){c.content='[]';e.shape='disc';e.text='';for(const step of e.sequence.steps){step.shape='disc';step.text='';}}if(action.kind==='image'){require(typeof action.dataUrl==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(action.dataUrl),'Choose a PNG/JPEG/WebP image');require(action.dataUrl.length<=262144,'Image exceeds native document budget; select a smaller image');c.importedAt=new Date().toISOString();e.source={kind:'image',image:{dataUrl:action.dataUrl,mode:'luminance',threshold:.5,invert:false,scale:1,name:title}};}next.entities.push(e);research.cards[e.id]=c;break;}
 case 'card-content':{const c=card(action.id);require(c.type==='note','Only note cards own rich note content');validateResearchContent(action.content);c.content=action.content;break;}
 case 'card-caption':card(action.id).caption=action.caption;break;
 case 'card-style':Object.assign(card(action.id),action.patch);break;
 case 'annotation-add':research.strokes.push(clone(action.stroke));break;
 case 'annotation-remove':research.strokes=research.strokes.filter(s=>s.id!==action.id);break;
 case 'viewport':research.views[action.key]=clone(action.value);break;
 case 'timeline-layout':{const previous=research.timeline[action.id];require(action.expectedRevision===(previous?.layoutRevision??null),'Timeline layout changed; reload before editing again');research.timeline[action.id]={...clone(action.value),layoutRevision:(previous?.layoutRevision??0)+1};break;}
 // A frame is a presentation grouping over existing occurrence ids — never
 // a constellation-membership change (that is the native owner's business
 // through its own explicit Action). Re-saving an existing frame id keeps
 // its current z so re-labelling or re-grouping never silently re-orders it.
 case 'frame-save':{
  require(text(action.label,160)&&!!action.label.trim(),'Invalid frame label');
  require(Array.isArray(action.memberRefs)&&action.memberRefs.length>=1&&action.memberRefs.length<=64,'A frame needs at least one member');
  const members=[...new Set(action.memberRefs)];
  for(const ref of members)require(next.entities.some(e=>e.id===ref),'Frame member is missing');
  const existing=research.frames[action.id];
  research.frames[action.id]={label:action.label,memberRefs:members,z:existing?.z??Object.keys(research.frames).length};
  break;
 }
 case 'frame-remove':delete research.frames[action.id];break;
 case 'frame-order':{
  const frame=research.frames[action.id];require(frame,'Frame is missing');
  const others=Object.entries(research.frames).filter(([id])=>id!==action.id).map(([,f])=>f.z);
  frame.z=action.direction==='front'?(others.length?Math.max(...others):frame.z)+1:(others.length?Math.min(...others):frame.z)-1;
  break;
 }
 // A saved view restores camera plus the presentation state a person would
 // expect it to: which cards were selected, and which frame sits on top —
 // never a second copy of graph material.
 case 'view-save':{
  require(text(action.name,160)&&!!action.name.trim(),'Invalid view name');
  validateViewport(action.viewport);
  require(Array.isArray(action.selectedRefs)&&action.selectedRefs.length<=64&&action.selectedRefs.every(ref=>typeof ref==='string'),'Invalid view selection');
  require(Array.isArray(action.frameOrder)&&action.frameOrder.length<=64&&action.frameOrder.every(ref=>typeof ref==='string'),'Invalid view frame order');
  research.namedViews[action.name]={viewport:clone(action.viewport),selectedRefs:[...action.selectedRefs],frameOrder:[...action.frameOrder]};
  break;
 }
 case 'view-remove':delete research.namedViews[action.name];break;
 }
 require(next.entities.length<=32,'Scene authoring occurrence limit reached');
 validateResearchMaterial(research,new Set(next.entities.map(e=>e.id)));
 Object.assign(scene,next);
}
