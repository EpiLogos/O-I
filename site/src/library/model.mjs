import { validateExpressionComposition } from '../../../shared-field/expression-projection.mjs';
import { validateExpressionPresentation, resolveExpressionPresentation } from '../../../shared-field/expression-presentation.mjs';

const ident = /^[a-z0-9][a-z0-9-]{0,95}$/;
export const COLLECTIONS = ['all','central','actuation','aikit','factory','workcell','ql','whole'];
export function parseRoute(hash) {
 const [path,query='']=hash.replace(/^#\/?/,'').split('?');
 const p=new URLSearchParams(query), bits=path.split('/');
 const legacy=['oi','research','shared-field','build'].includes(bits[0])?bits[0]:'';
 let id=legacy || (bits[0]==='library'?bits[1]??'':'');
 if(id && !ident.test(id))id='unavailable';
 return {id,scene:p.get('scene')??'',edition:p.get('edition')??'',subject:p.get('subject')??'',face:['verso','full','detached'].includes(p.get('face'))?p.get('face'):'face',q:(p.get('q')??'').slice(0,300),collection:COLLECTIONS.includes(p.get('collection'))?p.get('collection'):'all',view:p.get('view')==='rows'?'rows':'gallery'};
}
export function routeHref(route) {
 const p=new URLSearchParams();
 for(const key of ['scene','edition','subject','face','q','collection','view'])if(route[key] && !['face','all','gallery'].includes(route[key]))p.set(key,String(route[key]));
 return '#/library'+(route.id?'/'+route.id:'')+(p.size?'?'+p:'');
}
/** Display capacity is bounded by the row itself, not the browser window. */
export function sceneCapacity(width,total) {return Math.max(0,Math.min(total,Math.floor((Math.max(0,width)-64)/142)));}
export function filterEntries(entries,q='',collection='all') {
 const words=q.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>(collection==='all'||e.collection===collection)&&words.every(w=>(e.title+' '+e.summary+' '+e.search).toLowerCase().includes(w)));
}
export function safeUrl(value,base='https://example.invalid/') {
 if(typeof value!=='string')return null;
 try{const u=new URL(value,base);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}
}
export function readIndex(value) {
 if(value?.schema!=='oi.site-library-index/v1'||!Array.isArray(value.entries)||value.entries.length>1000)throw new Error('This Library index is not supported.');
 const ids=new Set(),refs=new Set();
 for(const e of value.entries){
  if(!ident.test(e.id)||ids.has(e.id)||refs.has(e.expression_ref)||!String(e.expression_ref).startsWith('expression:'))throw new Error('The Library contains an ambiguous address.');
  if(!Number.isSafeInteger(e.revision)||e.revision<1||typeof e.title!=='string'||typeof e.summary!=='string'||typeof e.source_revision!=='string')throw new Error('A Library edition is incomplete.');
  if(!Array.isArray(e.scenes)||!e.scenes.length||new Set(e.scenes.map(s=>s.ref)).size!==e.scenes.length)throw new Error('The Scene address list is incomplete.');
  if(!/^\.\/data\/library\/[a-z0-9-]+\.json$/.test(e.url))throw new Error('The Library requested an unadmitted publication location.');
  ids.add(e.id);refs.add(e.expression_ref);
 }
 return value;
}
/** Admission is data-only. Renderer names, subject refs and revisions must agree. */
export function readEdition(value,entry) {
 const p=value?.publication;
 if(p?.schema!=='oi.expression-publication/v1'||p.projection?.state!=='published'||p.projection?.audience?.visibility!=='public')throw new Error('This work is not a public Expression publication.');
 const c=validateExpressionComposition(p.composition), expression=validateExpressionPresentation(p.expression);
 if(c.expression_ref!==entry.expression_ref||c.revision!==entry.revision||p.expression_ref!==c.expression_ref||p.expression_revision!==c.revision||expression.expression_ref!==c.expression_ref||expression.expression_revision!==c.revision||p.projection?.source?.ref!==c.expression_ref||String(p.projection?.source?.revision)!==String(c.revision)||value.source_basis?.revision!==entry.source_revision)throw new Error('The source or edition changed. Return to the Library and open its current edition.');
 if(c.scenes.length!==entry.scenes.length||c.scenes.some((s,i)=>s.scene_ref!==entry.scenes[i].ref))throw new Error('Scene addresses no longer match this edition.');
 if(c.scenes.some(s=>s.entity_refs.length>10))throw new Error('This edition exceeds the current native field capacity. Its source remains available from the publisher.');
 const binding=p.presentation?.regions?.flatMap(r=>r.bindings??[]).find(b=>b.portable_renderer==='oi.presentation/expression/v1');
 if(!binding||JSON.stringify(validateExpressionComposition(binding.props?.composition))!==JSON.stringify(c)||JSON.stringify(validateExpressionPresentation(binding.props?.expression))!==JSON.stringify(expression))throw new Error('The live body and its publication no longer address the same edition.');
 const admission=resolveExpressionPresentation(binding,{renderer_ref:'renderer:oi:expression-stage',available:true,focus:true,capture:false});
 if(admission.state!=='live')throw new Error('This publication has no available, admitted live body. The publisher must supply a compatible edition.');
 const allowed=new Map();
 for(const entity of Object.values(c.entities))for(const s of entity.subject?.sources??[])if(s.availability==='available')allowed.set(s.ref,s.revision);
 for(const [ref,reading] of Object.entries(value.readings??{}))if(!allowed.has(ref)||reading.subject_ref!==ref||reading.source_ref!==ref||reading.source_revision!==allowed.get(ref)||typeof reading.body!=='string'||reading.body.length>500000)throw new Error('The reading contains undisclosed or mismatched source material.');
 return {...value,publication:{...p,composition:c,expression}};
}
export function exactScene(edition,ref) {
 const scenes=edition.publication.composition.scenes;
 const scene=scenes.find(s=>s.scene_ref===ref);
 if(!scene)throw new Error('This exact Scene is not in the published edition.');
 return scene;
}
export function readPosition(storage,key) {try{const v=JSON.parse(storage.getItem(key)||'null');return v&&typeof v==='object'?v:null;}catch{return null;}}
export function writePosition(storage,key,value) {try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
