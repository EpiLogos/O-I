import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,validateJourney,clone,sceneContentDigest,SCENE_DURATION_MIN,SCENE_DURATION_MAX,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX} from '../build/model.js';
import {moveScene,retimeScene,removeScene,nextSceneFrom,applyTimelineMove,SceneContentMutationError,initialiseSceneSaves} from '../build/sceneWorkflow.js';

// Deterministic PRNG (mulberry32) so every failing sequence can be replayed by seed.
function prng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
// A fixture with transitions set and saved copies, so timeline moves meet every field a document carries.
function fixture(){const j=fieldStudies();j.scenes.forEach((s,i)=>{s.transition=1+(i%3)*.5;});return initialiseSceneSaves(clone(j));}
function reverseKeys(v){if(Array.isArray(v))return v.map(reverseKeys);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverseKeys(x)]));return v;}

test('the scene timing bounds are the document rule: validateJourney and retimeScene agree at every boundary',()=>{
 assert.deepEqual([SCENE_DURATION_MIN,SCENE_DURATION_MAX,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX],[1,3600,0,30]);
 const probes=[0,.99,1,3600,3600.1,NaN,Infinity];
 for(const d of probes){
  const j=fixture();j.scenes[0].duration=d;
  let documentOk=true;try{validateJourney(clone(j));}catch{documentOk=false;}
  const w=fixture();let workflowOk=true;try{retimeScene(w,w.scenes[0].id,{duration:d});}catch{workflowOk=false;}
  assert.equal(workflowOk,documentOk,`duration ${d}`);
 }
 for(const t of [-.1,0,30,30.1]){const j=fixture();j.scenes[0].transition=t;let documentOk=true;try{validateJourney(clone(j));}catch{documentOk=false;}const w=fixture();let workflowOk=true;try{retimeScene(w,w.scenes[0].id,{transition:t});}catch{workflowOk=false;}assert.equal(workflowOk,documentOk,`transition ${t}`);}
});

test('the content digest ignores timeline facts and key order, and sees every content change',()=>{
 const s=fixture().scenes[2],digest=sceneContentDigest(s);
 assert.equal(sceneContentDigest(clone(s)),digest);
 assert.equal(sceneContentDigest(reverseKeys(s)),digest);
 assert.equal(sceneContentDigest({...s,duration:s.duration+5,transition:s.transition+1}),digest);
 for(const change of [t=>{t.name+='!';},t=>{t.field.background='#000000';},t=>{t.entities[0].position.x+=.1;},t=>{t.entities[0].sequence.steps[0].hold+=1;},t=>{t.id='other';}]){
  const t=clone(s);change(t);assert.notEqual(sceneContentDigest(t),digest);
 }
});

test('a timeline move that would change a surviving scene throws the named error and leaves the document untouched',()=>{
 const j=fixture(),before=clone(j);
 assert.throws(()=>applyTimelineMove(j,scenes=>{scenes[0].field.params.size=9;}),e=>e instanceof SceneContentMutationError&&e.name==='SceneContentMutationError'&&e.sceneId===before.scenes[0].id);
 assert.deepEqual(j,before);
});

test('a timeline move may change order, duration and transition, and nothing else',()=>{
 const j=fixture(),target=j.scenes[2],digest=sceneContentDigest(target);
 applyTimelineMove(j,scenes=>{const t=scenes.find(v=>v.id===target.id);t.duration=77;t.transition=2;scenes.reverse();});
 const after=j.scenes.find(v=>v.id===target.id);
 assert.equal(after.duration,77);assert.equal(after.transition,2);assert.equal(sceneContentDigest(after),digest);
 assert.equal(j.scenes[0].id,fieldStudies().scenes[7].id);
});

test('moveScene addresses by ref, keeps the content, and refuses an index outside the expression',()=>{
 const j=fixture(),ids=j.scenes.map(s=>s.id),digests=new Map(j.scenes.map(s=>[s.id,sceneContentDigest(s)]));
 moveScene(j,ids[0],3);
 assert.deepEqual(j.scenes.map(s=>s.id),[ids[1],ids[2],ids[3],ids[0],ids[4],ids[5],ids[6],ids[7]]);
 for(const s of j.scenes)assert.equal(sceneContentDigest(s),digests.get(s.id));
 assert.throws(()=>moveScene(j,ids[0],8),/only move within/);
 assert.throws(()=>moveScene(j,'gone',0),/no longer in this expression/);
});

test('removeScene drops the saved copy so the document still validates, and an expression keeps one scene',()=>{
 const j=fixture(),id=j.scenes[1].id;
 removeScene(j,id);
 assert.equal(j.scenes.some(s=>s.id===id),false);assert.equal(j.savedScenes[id],undefined);
 assert.doesNotThrow(()=>validateJourney(clone(j)));
 const one=fixture();while(one.scenes.length>1)removeScene(one,one.scenes.at(-1).id);
 assert.throws(()=>removeScene(one,one.scenes[0].id),/Keep at least one scene/);
});

test('nextSceneFrom inserts a new scene after its source and leaves the source unchanged',()=>{
 const j=fixture(),source=j.scenes[3],digest=sceneContentDigest(source),copy=nextSceneFrom(j,source);
 assert.equal(j.scenes[4],copy);assert.equal(j.scenes[3],source);assert.equal(sceneContentDigest(source),digest);
 assert.equal(copy.name,source.name+' / next');assert.notEqual(copy.id,source.id);
});

test('property: random timeline sequences never change a surviving scene content, and every document still validates',()=>{
 const counts={moves:0,orderChanges:0,retimes:0,durationChanges:0,duplicates:0,removes:0};
 for(let seed=1;seed<=200;seed++){
  const rnd=prng(seed),j=fixture();
  const baseline=new Map(j.scenes.map(s=>[s.id,sceneContentDigest(s)]));
  for(let step=0;step<40;step++){
   const ids=j.scenes.map(s=>s.id),pick=()=>ids[Math.floor(rnd()*ids.length)];
   const orderBefore=ids.join('|'),durationsBefore=j.scenes.map(s=>s.duration).join('|');
   const op=rnd();
   if(op<.4){moveScene(j,pick(),Math.floor(rnd()*j.scenes.length));counts.moves++;}
   else if(op<.75){const edge=rnd()<.15?[SCENE_DURATION_MIN,SCENE_DURATION_MAX][Math.floor(rnd()*2)]:Math.round((SCENE_DURATION_MIN+rnd()*(SCENE_DURATION_MAX-SCENE_DURATION_MIN))*10)/10;const facts={duration:edge};if(rnd()<.3)facts.transition=Math.round(rnd()*300)/10;retimeScene(j,pick(),facts);counts.retimes++;}
   else if(op<.9&&j.scenes.length<64){const id=pick();nextSceneFrom(j,j.scenes.find(s=>s.id===id));counts.duplicates++;}
   else if(j.scenes.length>1){removeScene(j,pick());counts.removes++;}
   if(j.scenes.map(s=>s.id).join('|')!==orderBefore&&j.scenes.length===ids.length)counts.orderChanges++;
   if(j.scenes.map(s=>s.duration).join('|')!==durationsBefore&&j.scenes.length===ids.length)counts.durationChanges++;
   for(const s of j.scenes){
    if(!baseline.has(s.id))baseline.set(s.id,sceneContentDigest(s));
    assert.equal(sceneContentDigest(s),baseline.get(s.id),`seed ${seed} step ${step}: content of ${s.id} changed`);
   }
  }
  assert.doesNotThrow(()=>validateJourney(clone(j)),`seed ${seed}: document no longer validates`);
 }
 assert.ok(counts.orderChanges>0&&counts.durationChanges>0&&counts.duplicates>0&&counts.removes>0,JSON.stringify(counts));
});
