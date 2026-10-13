import {clone,uid,Journey,Scene,sceneContentDigest,SCENE_DURATION_MIN,SCENE_DURATION_MAX,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX,SCENE_TIMELINE_FACTS} from './model';

/** A timeline move would have changed a scene's content. Named so callers can tell it from a validation refusal. */
export class SceneContentMutationError extends Error{
 constructor(readonly sceneId:string){super(`A timeline move would change the content of scene ${sceneId}. Only order, duration and transition may move.`);this.name='SceneContentMutationError';}
}
/**
 * Every timeline operation runs through here. The move is first applied to a
 * copy; each scene that survives must keep its content digest, and only then is
 * the same move applied to the document. A move that would change content throws
 * and leaves the document untouched. `move` must be deterministic: it runs twice.
 */
export function applyTimelineMove(j:Journey,move:(scenes:Scene[])=>void):void{
 const before=new Map(j.scenes.map(s=>[s.id,sceneContentDigest(s)]));
 const probe=clone(j.scenes);move(probe);
 for(const s of probe){const digest=before.get(s.id);if(digest!==undefined&&sceneContentDigest(s)!==digest)throw new SceneContentMutationError(s.id);}
 move(j.scenes);
}
function indexOfScene(j:Journey,sceneId:string):number{
 const index=j.scenes.findIndex(s=>s.id===sceneId);if(index<0)throw new Error('The scene is no longer in this expression.');return index;
}
/** Move a scene to position `to`. Scenes are addressed by ref, never by the index they stand at. */
export function moveScene(j:Journey,sceneId:string,to:number):void{
 const from=indexOfScene(j,sceneId);
 if(!Number.isInteger(to)||to<0||to>=j.scenes.length)throw new Error('A scene can only move within this expression.');
 applyTimelineMove(j,scenes=>{const [item]=scenes.splice(from,1);scenes.splice(to,0,item);});
}
/** Change a scene's duration and/or transition, under the same bounds validateJourney applies. */
export function retimeScene(j:Journey,sceneId:string,facts:{duration?:number;transition?:number}):void{
 const index=indexOfScene(j,sceneId);
 const inRange=(n:unknown,a:number,b:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
 if(facts.duration!==undefined&&!inRange(facts.duration,SCENE_DURATION_MIN,SCENE_DURATION_MAX))throw new Error(`A scene lasts ${SCENE_DURATION_MIN}–${SCENE_DURATION_MAX} seconds.`);
 if(facts.transition!==undefined&&!inRange(facts.transition,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX))throw new Error(`A transition lasts ${SCENE_TRANSITION_MIN}–${SCENE_TRANSITION_MAX} seconds.`);
 applyTimelineMove(j,scenes=>{const s=scenes[index];if(facts.duration!==undefined)s.duration=facts.duration;if(facts.transition!==undefined)s.transition=facts.transition;});
}
/** Remove a scene and its saved copy. An expression keeps at least one scene. */
export function removeScene(j:Journey,sceneId:string):void{
 const index=indexOfScene(j,sceneId);
 if(j.scenes.length<=1)throw new Error('Keep at least one scene in the expression.');
 applyTimelineMove(j,scenes=>{scenes.splice(index,1);});
 if(j.savedScenes)delete j.savedScenes[sceneId];
}

/** Older documents contain finished scenes, before drafts had a separate status. */
export function initialiseSceneSaves(j:Journey){
 if(j.savedScenes===undefined)j.savedScenes=Object.fromEntries(j.scenes.map(s=>[s.id,clone(s)]));
 return j;
}
export function sceneSaveState(j:Journey,s:Scene):'Draft'|'Saved'|'Edited since save'{
 const saved=j.savedScenes?.[s.id];
 // Timeline facts (duration, transition) are where a Scene sits in the Expression, not what it contains: a retimed clip keeps its save.
 const compare=(scene:Scene)=>{const {toolbelt,pointerScope,...rest}=scene;return Object.fromEntries(Object.entries(rest).filter(([key])=>!(SCENE_TIMELINE_FACTS as readonly string[]).includes(key)));};return !saved?'Draft':JSON.stringify(compare(saved))===JSON.stringify(compare(s))?'Saved':'Edited since save';
}
export function saveScene(j:Journey,s:Scene,name:string){
 const trimmed=name.trim();if(!trimmed||trimmed.length>160)throw new Error('Give this scene a name of 1–160 characters.');
 s.name=trimmed;(j.savedScenes??={})[s.id]=clone(s);
}
export function nextSceneFrom(j:Journey,s:Scene):Scene{
 if(j.scenes.length>=64)throw new Error('An expression can contain up to 64 scenes.');
 const index=j.scenes.findIndex(v=>v.id===s.id);if(index<0)throw new Error('The source scene is no longer in this expression.');
 const next=clone(s);next.id=uid('scene');next.name=(s.name+' / next').slice(0,160);
 applyTimelineMove(j,scenes=>{scenes.splice(index+1,0,next);});return next;
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
