import {clone,uid,Journey,Scene,Entity,sceneContentDigest,SCENE_DURATION_MIN,SCENE_DURATION_MAX,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX,SCENE_TIMELINE_FACTS} from './model';
import {valueAt,segmentControls,curveParameter,type PropertyTrack,type CurvePoint} from './propertyTracks';

/** A timeline move would have changed a scene's content. Named so callers can tell it from a validation refusal. */
export class SceneContentMutationError extends Error{
 constructor(readonly sceneId:string){super(`A timeline move would change the content of scene ${sceneId}. Only order, duration and transition may move.`);this.name='SceneContentMutationError';}
}
/**
 * Every timeline operation runs through here. The move is first applied to a
 * copy; each scene that survives must keep its content digest, and only then is
 * the same move applied to the document. A move that would change content throws
 * and leaves the document untouched. `move` must be deterministic: it runs twice.
 * `editedRef` names the one Scene whose content this move may change (a split's left Scene).
 */
export function applyTimelineMove(j:Journey,move:(scenes:Scene[])=>void,editedRef?:string):void{
 const before=new Map(j.scenes.map(s=>[s.id,sceneContentDigest(s)]));
 const probe=clone(j.scenes);move(probe);
 for(const s of probe){if(s.id===editedRef)continue;const digest=before.get(s.id);if(digest!==undefined&&sceneContentDigest(s)!==digest)throw new SceneContentMutationError(s.id);}
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

// ---- E07: split a scene at the playhead -------------------------------------
type Pt=CurvePoint;
type Point=PropertyTrack['points'][number];
const lerpPt=(p:Pt,q:Pt,u:number):Pt=>({x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u});
// segmentControls and curveParameter are propertyTracks.ts's own (one curve definition for evaluation and the cut).
/** One property track's points cut at local time t. Points before t stay left; points from t on move right, re-based by t. Both sides carry valueAt(t) at the cut, so each side evaluates the original curve: a linear or hold segment is cut by its endpoints; a smooth or bezier segment is subdivided (de Casteljau), so its shape is kept exactly, not approximated. */
function splitPoints(points:Point[],t:number):{left:Point[];right:Point[]}{
 const rebase=(p:Point):Point=>({...clone(p),time:p.time-t});
 const value=valueAt(points,t);
 // Before the first point the track has no value: the whole track moves right.
 if(value===undefined)return {left:[],right:points.map(rebase)};
 // A point exactly at the cut is the boundary on both sides; its own handles carry the curve.
 const exact=points.findIndex(p=>p.time===t);
 if(exact>=0)return {left:clone(points.slice(0,exact+1)),right:points.slice(exact).map(rebase)};
 // After the last point the value holds: each side keeps one boundary point.
 const next=points.findIndex(p=>p.time>t);
 if(next<0)return {left:[...clone(points),{time:t,value}],right:[{time:0,value}]};
 const left=clone(points.slice(0,next)),prev=left[left.length-1],after=points[next];
 const rest=points.slice(next).map(rebase);
 const type=prev.type??'linear';
 if(type==='linear')return {left:[...left,{time:t,value}],right:[{time:0,value},...rest]};
 if(type==='hold')return {left:[...left,{time:t,value}],right:[{time:0,value,type:'hold'},...rest]};
 const c=segmentControls(prev,after,type==='smooth');
 const u=curveParameter(c,t);
 const q0=lerpPt(c[0],c[1],u),q1=lerpPt(c[1],c[2],u),q2=lerpPt(c[2],c[3],u);
 const r0=lerpPt(q0,q1,u),r1=lerpPt(q1,q2,u);
 const s=lerpPt(r0,r1,u);
 const handle=(from:Pt,to:Pt)=>({dt:to.x-from.x,dv:to.y-from.y});
 // The left half is [c0,q0,r0,s]; the right half is [s,r1,q2,c3].
 prev.type='bezier';prev.out=handle(c[0],q0);
 const [first,...others]=rest;
 return {left:[...left,{time:t,value,in:handle(s,r0)}],right:[{time:0,value,type:'bezier',out:handle(s,r1)},{...first,in:handle(c[3],q2)},...others]};
}
function splitTracks(tracks:PropertyTrack[],t:number):{left:PropertyTrack[];right:PropertyTrack[]}{
 const left:PropertyTrack[]=[],right:PropertyTrack[]=[];
 for(const track of tracks){const cut=splitPoints(track.points,t);if(cut.left.length)left.push({...clone(track),points:cut.left});if(cut.right.length)right.push({...clone(track),points:cut.right});}
 return {left,right};
}
/** The right Scene's sequences. The left keeps every sequence whole, so it plays exactly as before. On the right, the looping seconds clock starts its cycle at the step the clock is in at the cut, which is the step boundary at or before t. Only that plain clock is rotated (the step order is the cycle); other clocks, orders and jitter keep every step unchanged. Named limitation: a step is atomic, so the step containing t is not divided. The right restarts it at its boundary, with no phase offset. */
function rightSequence(sequence:Entity['sequence'],t:number):Entity['sequence']{
 const steps=sequence.steps,periods=steps.map(k=>Math.max(0.05,(k.hold??0)+(k.transition??0)));
 const total=periods.reduce((n,p)=>n+p,0);
 if(!sequence.enabled||sequence.manual||sequence.clock!=='seconds'||(sequence.order??'loop')!=='loop'||sequence.jitter||steps.length<2||!(total>0))return clone(sequence);
 const phase=t*(sequence.rateMul??1)+(sequence.phaseOffset??0)*periods[0];
 let e=((phase%total)+total)%total,k=0;
 while(k<steps.length-1&&e>=periods[k]){e-=periods[k];k++;}
 return {...clone(sequence),steps:[...clone(steps.slice(k)),...clone(steps.slice(0,k))],phaseOffset:0};
}
/** Both halves of a scene cut at t. The left keeps the scene's identity and everything before the cut; the right carries the rest. Named limitation: automation lanes (LFO and ramp) are copied whole to both halves, so the right's lanes restart on its own clock. */
function splitSceneContent(src:Scene,t:number,newId:string):{left:Scene;right:Scene}{
 const left:Scene=clone(src),right:Scene=clone(src);
 left.duration=t;
 right.id=newId;right.name=`${src.name} / split`.slice(0,160);right.duration=src.duration-t;right.transition=0;
 if(src.propertyTracks){const cut=splitTracks(src.propertyTracks,t);left.propertyTracks=cut.left.length?cut.left:undefined;right.propertyTracks=cut.right.length?cut.right:undefined;}
 // A recorded take interval is in scene-local time: clip it to the left, shift it to the right.
 const range=src.propertyTakeRange;
 left.propertyTakeRange=range&&range.start<t?{start:range.start,end:Math.min(range.end,t)}:undefined;
 right.propertyTakeRange=range&&range.end>t?{start:Math.max(0,range.start-t),end:range.end-t}:undefined;
 right.entities=src.entities.map(e=>({...clone(e),sequence:rightSequence(e.sequence,t)}));
 return {left,right};
}
/**
 * E07: cut a scene in two at local time `localT`. The left keeps `sceneId`, its content and its
 * duration (now `localT`); the right is a new Scene `newId`, named "<name> / split", with the rest of
 * the content, duration = the original less `localT`, and transition 0 (a true cut). Durations sum to
 * the original. Each side must last at least SCENE_DURATION_MIN, so a cut within 1 s of an edge is
 * refused by name: a shorter side could not validate. The whole split is one applyTimelineMove, and
 * `sceneId` is its one exempt content edit, so every other scene's content digest is unchanged. A
 * refusal throws before anything is written. Mutates `j`, as the sibling timeline operations do, and returns it.
 */
export function splitScene(j:Journey,sceneId:string,localT:number,newId:string):Journey{
 const index=indexOfScene(j,sceneId);
 if(!Number.isFinite(localT))throw new Error('Put the playhead inside the scene to split it.');
 if(localT<SCENE_DURATION_MIN||j.scenes[index].duration-localT<SCENE_DURATION_MIN)throw new Error(`Too close to an edge to split: each side of a cut must last at least ${SCENE_DURATION_MIN} second.`);
 if(j.scenes.length>=64)throw new Error('An expression can contain up to 64 scenes.');
 if(typeof newId!=='string'||!newId||j.scenes.some(s=>s.id===newId))throw new Error('The new scene needs an id that no other scene uses.');
 applyTimelineMove(j,scenes=>{const at=scenes.findIndex(s=>s.id===sceneId);const cut=splitSceneContent(scenes[at],localT,newId);scenes[at]=cut.left;scenes.splice(at+1,0,cut.right);},sceneId);
 return j;
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
