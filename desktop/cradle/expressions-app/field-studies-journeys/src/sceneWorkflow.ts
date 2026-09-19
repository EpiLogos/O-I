import {clone,uid,Journey,Scene} from './model';

/** Older documents contain finished scenes, before drafts had a separate status. */
export function initialiseSceneSaves(j:Journey){
 if(j.savedScenes===undefined)j.savedScenes=Object.fromEntries(j.scenes.map(s=>[s.id,clone(s)]));
 return j;
}
export function sceneSaveState(j:Journey,s:Scene):'Draft'|'Saved'|'Edited since save'{
 const saved=j.savedScenes?.[s.id];
 const compare=(scene:Scene)=>{const {toolbelt,pointerScope,...rest}=scene;return rest;};return !saved?'Draft':JSON.stringify(compare(saved))===JSON.stringify(compare(s))?'Saved':'Edited since save';
}
export function saveScene(j:Journey,s:Scene,name:string){
 const trimmed=name.trim();if(!trimmed||trimmed.length>160)throw new Error('Give this scene a name of 1–160 characters.');
 s.name=trimmed;(j.savedScenes??={})[s.id]=clone(s);
}
export function nextSceneFrom(j:Journey,s:Scene):Scene{
 if(j.scenes.length>=64)throw new Error('An expression can contain up to 64 scenes.');
 const index=j.scenes.findIndex(v=>v.id===s.id);if(index<0)throw new Error('The source scene is no longer in this expression.');
 const next=clone(s);next.id=uid('scene');next.name=(s.name+' / next').slice(0,160);
 j.scenes.splice(index+1,0,next);return next;
}
export function restoreScene(j:Journey,id:string){
 const saved=j.savedScenes?.[id],i=j.scenes.findIndex(s=>s.id===id);if(!saved||i<0)return false;
 const pointerScope=j.scenes[i].pointerScope;j.scenes[i]=clone(saved);j.scenes[i].pointerScope=pointerScope;return true;
}
export function savedSceneIndices(j:Journey){return j.scenes.flatMap((s,i)=>j.savedScenes?.[s.id]?[i]:[]);}
export function sceneParameterChanges(a:Scene,b:Scene):Array<{path:string;from:number;to:number}>{
 const changes:Array<{path:string;from:number;to:number}>=[];
 const walk=(x:unknown,y:unknown,path:string)=>{
  if(typeof x==='number'&&typeof y==='number'&&x!==y){changes.push({path,from:x,to:y});return;}
  if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y))for(const key of Object.keys(x))if(key!=='native')walk((x as any)[key],(y as any)[key],path?path+'.'+key:key);
 };
 for(const key of ['field','engine','morph','composition'] as const)walk(a[key],b[key],key);
 for(const entity of a.entities){const other=b.entities.find(e=>e.id===entity.id);if(other)walk(entity,other,'entity:'+entity.id);}
 return changes;
}
