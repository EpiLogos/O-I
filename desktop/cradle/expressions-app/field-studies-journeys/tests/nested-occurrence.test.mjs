// E14 nested expression occurrence in the authoring app: the kernel bridge
// keeps the native `expression_ref` body on its Scene and reports the nested
// verdict (ready / refused / unread) against the host budget, refusing by name
// and never dropping a level silently. Bundles the pure modules on the fly:
//   node --test tests/nested-occurrence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'oi-nested-test-'));
async function load(name){
 const outfile=path.join(out,name+'.mjs');
 await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:[name.startsWith('/')?name:`src/${name}.ts`],bundle:true,format:'esm',platform:'node',target:'es2022',outfile,logLevel:'silent',
  loader:{'.woff':'empty','.woff2':'empty','.ttf':'empty','.svg':'empty','.png':'empty','.jpg':'empty','.webp':'empty','.css':'empty'}});
 return import(pathToFileURL(outfile).href);
}
const bridge=await load('kernelDocumentBridge');
const nested=await load('nestedOccurrence');
const markers=await load('journeyMarkers');
const reads=await load(process.env.NESTED_READS_SRC??'nestedReads');
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));

const HOST='expression:host-a',SUB='expression:saved-b',SCENE=HOST+':scene:main';
const read=ref=>({ref,revision:'r1',availability:'available'});
const entityRefs=n=>Array.from({length:n},(_,i)=>`${SUB}:entity:e${i}`);
const entity=ref=>({entity_ref:ref,title:ref.split(':').pop(),subject:null,parameters:{glyph:{value:'A'},x:{value:0},y:{value:0},z:{value:0}}});
function host(bodyRecursion,revision='7'){
 const body={carrier:'expression_ref',subject_ref:SUB,native_owner:'oi',reading:{ref:SUB,revision,availability:'available'},provenance:[{ref:SUB,revision,availability:'available'}],actions:[],presentation:'inline',capability:{state:'renderable'},span:null,recursion:bodyRecursion};
 return {schema:'oi.expression/v1',expression_ref:HOST,revision:2,title:'Host',entities:{[HOST+':entity:local']:entity(HOST+':entity:local')},
  scenes:[{scene_ref:SCENE,title:'Main',revision:1,entity_refs:[HOST+':entity:local'],body}],relations:{},selection:{scene_ref:SCENE,entity_ref:null},provenance:[],representations:[],refinements:[]};
}
function savedDoc(ref,count,scenes){
 return {schema:'oi.expression/v1',expression_ref:ref,revision:7,title:'Saved B',entities:Object.fromEntries(entityRefs(count).map(r=>[r,entity(r)])),
  scenes:scenes??[{scene_ref:ref+':scene:main',title:'Main',revision:1,entity_refs:entityRefs(count),body:null}],relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[],refinements:[]};
}
const bound=(max_depth=2)=>({host_expression_ref:HOST,max_depth});

test('a nested body is kept as the native expression_ref body and reads unread until its document is supplied', () => {
 const view=bridge.kernelDocumentToJourney(host(bound()));
 const binding=view.bindings[view.startSceneId];
 assert.equal(binding.body.carrier,'expression_ref');
 assert.equal(binding.body.subject_ref,SUB);
 assert.equal(binding.nested.state,'unread');
 assert.match(binding.nested.reason,/is not read yet/);
});

test('with the nested document read, the occurrence is ready at its depth and member count', () => {
 const graph=new Map([[SUB,savedDoc(SUB,3)]]);
 const view=bridge.kernelDocumentToJourney(host(bound()),{nestedDocuments:graph});
 const binding=view.bindings[view.startSceneId];
 assert.equal(binding.nested.state,'ready');
 assert.equal(binding.nested.depth,1);
 assert.equal(binding.nested.members,3);
 assert.equal(view.notes.some(n=>/refused/.test(n)),false);
});

test('a chain deeper than the admitted depth is refused by name, and the note says so', () => {
 const mid='expression:mid-c';
 const graph=new Map([[SUB,savedDoc(SUB,1,[{scene_ref:SUB+':scene:main',title:'Main',revision:1,entity_refs:[],body:{carrier:'expression_ref',subject_ref:mid,recursion:{host_expression_ref:SUB,max_depth:1}}}])],[mid,savedDoc(mid,1)]]);
 const view=bridge.kernelDocumentToJourney(host(bound(1)),{nestedDocuments:graph});
 const binding=view.bindings[view.startSceneId];
 assert.equal(binding.nested.state,'refused');
 assert.match(binding.nested.reason,/nests 2 levels deep; this placement admits 1/);
 assert.ok(view.notes.some(n=>n.includes(SCENE)&&/admits 1/.test(n)),'refusal is noted against its Scene');
 assert.equal(binding.body.carrier,'expression_ref','the native body is retained, never dropped');
});

test('an occurrence that would contain its host is refused, not followed', () => {
 const graph=new Map([[SUB,savedDoc(SUB,1,[{scene_ref:SUB+':scene:main',title:'Main',revision:1,entity_refs:[],body:{carrier:'expression_ref',subject_ref:HOST,recursion:{host_expression_ref:SUB,max_depth:1}}}])]]);
 const view=bridge.kernelDocumentToJourney(host(bound()),{nestedDocuments:graph});
 assert.match(view.bindings[view.startSceneId].nested.reason,/would contain its own host Expression/);
});

test('a Scene without a nested body has no nested verdict (no regression for other bodies)', () => {
 const doc=host(null);doc.scenes[0].body=null;
 const view=bridge.kernelDocumentToJourney(doc);
 assert.equal(view.bindings[view.startSceneId].nested,null);
});

test('the placement and the bridge agree: a body the app places reads ready in the bridge', () => {
 const body=nested.nestedBodyFor(HOST,{expression_ref:SUB,revision:7},2);
 const doc=host(body.recursion);
 doc.scenes[0].body=body;
 const view=bridge.kernelDocumentToJourney(doc,{nestedDocuments:new Map([[SUB,savedDoc(SUB,2)]])});
 assert.equal(view.bindings[view.startSceneId].nested.state,'ready');
 assert.equal(view.bindings[view.startSceneId].nested.depth,1);
});

// ——— playback (E14): host time -> nested time, clipping, the depth gate and the live verdict ———
const READY={subject_ref:SUB,max_depth:1,state:'ready',depth:1,members:0};
const nestsDoc=(ref,child)=>({expression_ref:ref,revision:1,entities:{},scenes:[{scene_ref:ref+':scene:main',entity_refs:[],body:{carrier:'expression_ref',subject_ref:child,reading:{ref:child,revision:'1',availability:'available'},recursion:{host_expression_ref:ref,max_depth:1}}}]});

test('host time maps onto the nested Expression exactly as the journey clock maps it (sceneAtJourneyTime)', () => {
 const durations=[2,0,1.5,3],total=6.5;
 for(let t=0;t<total;t+=0.25){
  const want=markers.sceneAtJourneyTime(durations,t),got=nested.nestedFrameAt(t,100,durations,READY);
  assert.equal(got.kind,'scene',`t=${t}`);
  assert.equal(got.sceneIndex,want.sceneIndex,`scene at t=${t}`);
  assert.ok(Math.abs(got.local-want.local)<1e-9,`local at t=${t}`);
 }
});

test('the occurrence is clipped at the host Scene duration', () => {
 const f=nested.nestedFrameAt(3,4,[2,3],READY);
 assert.equal(f.kind,'scene');assert.equal(f.sceneIndex,1);assert.equal(f.local,1);
 assert.deepEqual(nested.nestedFrameAt(4,4,[2,3],READY),{kind:'clipped'});
 assert.deepEqual(nested.nestedFrameAt(9,4,[2,3],READY),{kind:'clipped'});
});

test('past the nested content the occurrence shows nothing, even while the host Scene runs on', () => {
 assert.deepEqual(nested.nestedFrameAt(2,6,[2],READY),{kind:'end'});
 assert.deepEqual(nested.nestedFrameAt(4.5,6,[2],READY),{kind:'end'});
 assert.deepEqual(nested.nestedFrameAt(0,6,[],READY),{kind:'end'});
});

test('zero-length Scenes have no span, and a boundary belongs to the Scene it starts', () => {
 const d=[0,2,0,1];
 assert.deepEqual(nested.nestedFrameAt(0,10,d,READY),{kind:'scene',sceneIndex:1,local:0});
 assert.deepEqual(nested.nestedFrameAt(2,10,d,READY),{kind:'scene',sceneIndex:3,local:0});
 assert.deepEqual(nested.nestedFrameAt(2.5,10,d,READY),{kind:'scene',sceneIndex:3,local:0.5});
 assert.deepEqual(nested.nestedFrameAt(3,10,d,READY),{kind:'end'});
});

test('an unread document is an honest notice, never a guess; a refused occurrence says why', () => {
 const unread={subject_ref:SUB,max_depth:1,state:'unread',reason:`Nested expression ${SUB} is not read yet.`};
 const u=nested.nestedFrameAt(0,5,[2],unread);
 assert.equal(u.kind,'unread');
 assert.match(nested.nestedNotice(u),/is not read yet/);
 const refused={subject_ref:SUB,max_depth:1,state:'refused',reason:'The occurrence nests 2 levels deep; this placement admits 1.'};
 const r=nested.nestedFrameAt(1,5,[2],refused);
 assert.equal(r.kind,'refused');
 assert.match(nested.nestedNotice(r),/admits 1/);
 assert.equal(nested.nestedNotice({kind:'scene',sceneIndex:0,local:0}),null);
 assert.equal(nested.nestedFrameAt(1,5,[2],null).kind,'refused');
});

test('the read plan never reads a document deeper than the placement bound', () => {
 const A='expression:a',B='expression:b',C='expression:c';
 const g=new Map([[A,nestsDoc(A,B)]]);
 const listed=new Map([[A,1],[B,1],[C,1]]);
 assert.deepEqual(nested.nestedReadPlan(g,listed,A,1),[],'bound 1: B would be level 2, so it is not read');
 assert.deepEqual(nested.nestedReadPlan(g,listed,A,2),[B],'bound 2: B is missing and is asked for');
 g.set(B,nestsDoc(B,C));
 assert.deepEqual(nested.nestedReadPlan(g,listed,A,2),[],'bound 2 never reads C (level 3)');
 assert.deepEqual(nested.nestedReadPlan(g,listed,A,3),[C],'bound 3 reads C');
 assert.deepEqual(nested.nestedReadPlan(new Map(),listed,A,4),[A],'an empty graph asks for the subject first');
});
test('a document is current only at the revision the library lists it at; a stale one is asked for, and keeps playing until then', () => {
 const A='expression:a',B='expression:b';
 const g=new Map([[A,nestsDoc(A,B)],[B,nestsDoc(B,'expression:c')]]);
 assert.deepEqual(nested.nestedReadPlan(g,new Map([[A,2],[B,1]]),A,1),[A],'A moved to revision 2: the root is asked for');
 assert.deepEqual(nested.nestedReadPlan(g,new Map([[A,1],[B,2]]),A,2),[B],'B moved: it is asked for, and A still names it at the bound');
 assert.deepEqual(nested.nestedReadPlan(g,new Map([[A,2],[B,1]]),A,2,ref=>ref!==A),[],'a stale A held back by its wait still names its Scenes: B is current, so nothing new is asked');
 assert.deepEqual(nested.nestedReadPlan(g,new Map([[A,1],[B,1]]),A,2),[],'both current: nothing is asked for');
});
test('a missing document is held back by its wait; the wait grows 1 s, 2 s, 4 s, up to five minutes', () => {
 assert.equal(nested.nestedBackoffMs(0),0);
 assert.equal(nested.nestedBackoffMs(1),1000);
 assert.equal(nested.nestedBackoffMs(2),2000);
 assert.equal(nested.nestedBackoffMs(3),4000);
 assert.equal(nested.nestedBackoffMs(20),300000);
 assert.deepEqual(nested.nestedReadPlan(new Map(),new Map([['expression:a',1]]),'expression:a',1,()=>false),[],'held back: not asked');
});
test('the changed note says a placed occurrence records another revision than the Expression\'s current one', () => {
 assert.equal(nested.nestedChangedSincePlaced('7',8),true);
 assert.equal(nested.nestedChangedSincePlaced('7',7),false);
 assert.equal(nested.nestedChangedSincePlaced('7',undefined),false,'not listed: nothing to compare');
 assert.equal(nested.nestedChangedSincePlaced(' 7 ',7),false);
});

test('the live verdict re-derives from the workspace graph: unread becomes ready once read, and a refusal appears live', () => {
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 const sceneId=view.startSceneId;
 assert.equal(view.bindings[sceneId].nested.state,'unread');
 const ready=bridge.withNestedVerdicts(view,new Map([[SUB,savedDoc(SUB,2)]]));
 assert.equal(ready.bindings[sceneId].nested.state,'ready');
 assert.equal(ready.bindings[sceneId].nested.depth,1);
 const mid='expression:mid-c';
 const chain=new Map([[SUB,savedDoc(SUB,1,[{scene_ref:SUB+':scene:main',title:'Main',revision:1,entity_refs:[],body:{carrier:'expression_ref',subject_ref:mid,recursion:{host_expression_ref:SUB,max_depth:1}}}])],[mid,savedDoc(mid,1)]]);
 const refused=bridge.withNestedVerdicts(view,chain);
 assert.equal(refused.bindings[sceneId].nested.state,'refused');
 assert.match(refused.bindings[sceneId].nested.reason,/admits 1/);
 assert.equal(view.bindings[sceneId].nested.state,'unread','the view it was derived from is not mutated');
 const plain=bridge.kernelDocumentToJourney(host(bound(1)));
 plain.bindings[sceneId].body=null;
 assert.equal(bridge.withNestedVerdicts(plain,new Map()),plain,'a view with no nested body is returned as it is');
});

// ——— the workspace's live verdict: the same factory nativeWorkspace installs ———
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
/** A workspace harness: the kernel read, the kernel list (mutable rows), and a clock the test moves. */
function harness({docs=new Map([[SUB,savedDoc(SUB,2)]]),rows=[{expression_ref:SUB,revision:7}]}={}){
 const h={reads:[],lists:0,refreshes:0,t:0,rows,docs,listFails:false};
 h.readers=reads.nestedDocumentReads(
  async ref=>{h.reads.push(ref);const d=h.docs.get(ref);if(!d)throw new Error('absent '+ref);return d;},
  ()=>{h.refreshes++;},
  async()=>{h.lists++;if(h.listFails)throw new Error('list failed');return h.rows;},
  ()=>h.t);
 return h;
}
test('the workspace reads the nested documents its open view names, re-derives the verdict live, and refreshes the host', async () => {
 const h=harness();
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 assert.equal(h.readers.view(view).bindings[view.startSceneId].nested.state,'unread','before the list and read land, the verdict is unread');
 await settle();
 assert.equal(h.refreshes,1,'the host is refreshed once the list and the read land');
 assert.equal(h.readers.view(view).bindings[view.startSceneId].nested.state,'ready');
 assert.deepEqual(h.reads,[SUB],'bound 1 reads the subject only');
});
test('the workspace reads no deeper than the bound, and a deeper chain is refused live', async () => {
 const mid='expression:mid-d',deep='expression:deep-d';
 const h=harness({docs:new Map([[SUB,nestsDoc(SUB,mid)],[mid,nestsDoc(mid,deep)],[deep,savedDoc(deep,1)]]),rows:[{expression_ref:SUB,revision:1},{expression_ref:mid,revision:1}]});
 const view=bridge.kernelDocumentToJourney(host(bound(2)));
 h.readers.view(view);
 await settle();
 const live=h.readers.view(view);
 assert.deepEqual(h.reads,[SUB,mid],'bound 2 reads two levels; the third is never requested');
 assert.equal(live.bindings[view.startSceneId].nested.state,'refused');
 assert.match(live.bindings[view.startSceneId].nested.reason,/nests 3 levels deep; this placement admits 2/);
});
test('the list is one call per host view, and a view that is seen again makes no second call', async () => {
 const h=harness();
 for(let i=0;i<3;i++){h.readers.view(bridge.kernelDocumentToJourney(host(bound(1))));await settle();}
 assert.equal(h.lists,3);
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 h.readers.view(view);h.readers.view(view);h.readers.view(view);
 await settle();
 assert.equal(h.lists,4,'the same view object is scanned once');
});
test('a document the library lists at the same revision is kept across host views: no re-read, and no unread flicker', async () => {
 const h=harness();
 h.readers.view(bridge.kernelDocumentToJourney(host(bound(1))));
 await settle();
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 assert.equal(h.readers.view(view).bindings[view.startSceneId].nested.state,'ready','ready at once: an unrelated host edit clears nothing');
 await settle();
 assert.deepEqual(h.reads,[SUB],'no re-read');
});
test('an edit elsewhere is picked up with no re-record: the list moves, the document is read again, and the occurrence is marked changed', async () => {
 const h=harness();
 h.readers.view(bridge.kernelDocumentToJourney(host(bound(1),'7')));
 await settle();
 h.docs.set(SUB,{...savedDoc(SUB,3),revision:8});
 h.rows=[{expression_ref:SUB,revision:8}];
 const view=bridge.kernelDocumentToJourney(host(bound(1),'7'));
 const pending=h.readers.view(view).bindings[view.startSceneId].nested;
 assert.equal(pending.state,'ready','until the new revision is read, the current content it holds still plays');
 await settle();
 assert.deepEqual(h.reads,[SUB,SUB]);
 assert.equal(h.readers.document(SUB).revision,8);
 const live=h.readers.view(view).bindings[view.startSceneId].nested;
 assert.equal(live.state,'ready');
 assert.equal(live.changed,true,'the occurrence records revision 7; the library lists 8: changed, and it still plays');
});
test('placing again at the current revision clears the changed note; nothing is re-recorded by the library moving', async () => {
 const h=harness();
 h.readers.view(bridge.kernelDocumentToJourney(host(bound(1),'7')));
 await settle();
 h.rows=[{expression_ref:SUB,revision:8}];
 h.docs.set(SUB,{...savedDoc(SUB,2),revision:8});
 const stale=bridge.kernelDocumentToJourney(host(bound(1),'7'));
 h.readers.view(stale);await settle();
 assert.equal(h.readers.view(stale).bindings[stale.startSceneId].nested.changed,true,'the recorded revision is still 7');
 const placed=bridge.kernelDocumentToJourney(host(bound(1),'8'));
 h.readers.view(placed);await settle();
 assert.equal(h.readers.view(placed).bindings[placed.startSceneId].nested.changed,undefined,'recorded 8, current 8: no note');
});
test('a missing document backs off on a growing wait, and the wait resets once the list shows it again', async () => {
 const h=harness({rows:[]});
 const at=t=>{h.t=t;const v=bridge.kernelDocumentToJourney(host(bound(1)));h.readers.view(v);return settle();};
 await at(0);
 assert.deepEqual(h.reads,[SUB],'the first ask is made at once');
 await at(500);assert.equal(h.reads.length,1,'held back inside the first second');
 await at(1000);assert.equal(h.reads.length,2,'asked again once 1 s has passed');
 await at(2000);assert.equal(h.reads.length,2,'the second wait is 2 s');
 await at(3000);assert.equal(h.reads.length,3,'asked again at 3 s');
 await at(6999);assert.equal(h.reads.length,3,'the third wait is 4 s');
 h.rows=[{expression_ref:SUB,revision:7}];
 await at(7000);
 assert.equal(h.reads.length,3,'listed at its current revision: nothing to read, and the wait is reset');
 h.rows=[];
 await at(7000);assert.equal(h.reads.length,4,'unlisted again: asked at once, at the first wait, not the fourth');
 await at(7999);assert.equal(h.reads.length,4,'the reset wait is 1 s');
 await at(8000);assert.equal(h.reads.length,5);
});
test('a failed read is held back the same way, and not asked again within the same view', async () => {
 const h=harness({docs:new Map()});
 const at=t=>{h.t=t;h.readers.view(bridge.kernelDocumentToJourney(host(bound(1))));return settle();};
 await at(0);
 assert.equal(h.reads.length,1);
 await at(500);
 assert.equal(h.reads.length,1,'held back');
 await at(1000);
 assert.equal(h.reads.length,2,'asked again after 1 s');
});
test('a failed list makes no reads and keeps the cache as it stands', async () => {
 const h=harness();
 h.listFails=true;
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 assert.equal(h.readers.view(view).bindings[view.startSceneId].nested.state,'unread');
 await settle();
 assert.deepEqual(h.reads,[],'no listing, no asks');
 assert.equal(h.refreshes,0);
});
test('the cache keeps exactly what the open view names', async () => {
 const orphan='expression:orphan';
 const h=harness({docs:new Map([[SUB,savedDoc(SUB,1)],[orphan,savedDoc(orphan,1)]]),rows:[{expression_ref:SUB,revision:7},{expression_ref:orphan,revision:7}]});
 await h.readers.readNested(orphan,7,1);
 assert.ok(h.readers.document(orphan));
 h.readers.view(bridge.kernelDocumentToJourney(host(bound(1))));
 await settle();
 assert.equal(h.readers.document(orphan),undefined,'a document no open occurrence names is dropped');
 assert.ok(h.readers.document(SUB));
});
test('a placement reads under the revision it places, once, and the placed occurrence is not marked changed', async () => {
 const h=harness();
 await h.readers.readNested(SUB,7,1);
 assert.deepEqual(h.reads,[SUB]);
 const view=bridge.kernelDocumentToJourney(host(bound(1),'7'));
 assert.equal(h.readers.view(view).bindings[view.startSceneId].nested.state,'ready');
 await settle();
 assert.deepEqual(h.reads,[SUB],'no second read');
 assert.equal(h.readers.view(view).bindings[view.startSceneId].nested.changed,undefined);
});


// ——— seams between nested Scenes: the app\'s own seam rule, over the nested Expression\'s own Scenes ———
const SEAM_SCENES=[{duration:2,transition:0,kind:'crossfade'},{duration:3,transition:1.5,kind:'dip-to-colour'},{duration:1,transition:0.5,kind:'cut'},{duration:2,transition:1,kind:'wipe'}];
test('a seam names the outgoing and incoming nested Scenes and its kind, from the entering Scene\'s own transition', () => {
 assert.equal(nested.nestedSeamAt(SEAM_SCENES,0,0),null,'the first Scene played has no entering seam');
 assert.deepEqual(nested.nestedSeamAt(SEAM_SCENES,1,0),{incoming:1,outgoing:0,kind:'dip-to-colour',seconds:1.5,elapsed:0});
 assert.equal(nested.nestedSeamAt(SEAM_SCENES,1,1.2).elapsed,1.2);
 assert.equal(nested.nestedSeamAt(SEAM_SCENES,1,1.5),null,'the transition ends at its own length');
 assert.equal(nested.nestedSeamAt(SEAM_SCENES,2,0),null,'a cut has no seam');
 assert.deepEqual(nested.nestedSeamAt(SEAM_SCENES,3,0.4),{incoming:3,outgoing:2,kind:'wipe',seconds:1,elapsed:0.4});
});
test('the seam matches the journey clock over the whole nested Expression: the same entering Scene and local time as sceneAtJourneyTime', () => {
 const durations=SEAM_SCENES.map(s=>s.duration);
 let active=0;
 for(let t=0;t<8;t+=0.05){
  const at=markers.sceneAtJourneyTime(durations,t),k=at.sceneIndex,scene=SEAM_SCENES[k];
  const expected=k>0&&scene.kind!=='cut'&&scene.transition>0&&at.local<scene.transition;
  const got=nested.nestedSeamAt(SEAM_SCENES,k,at.local);
  assert.equal(got!==null,expected,`seam at t=${t.toFixed(2)}`);
  if(got){active++;assert.equal(got.incoming,k);assert.equal(got.outgoing,k-1);assert.ok(Math.abs(got.elapsed-at.local)<1e-9);}
 }
 assert.ok(active>0,'the sample crosses at least one seam');
});
test('zero-length Scenes are skipped when finding the outgoing Scene, as the journey clock skips them', () => {
 const scenes=[{duration:2,transition:0,kind:'crossfade'},{duration:0,transition:1,kind:'wipe'},{duration:3,transition:1,kind:'dip-to-colour'}];
 assert.deepEqual(nested.nestedSeamAt(scenes,2,0.5),{incoming:2,outgoing:0,kind:'dip-to-colour',seconds:1,elapsed:0.5});
});
test('the seam mode is the app\'s own rule: a crossfade overlays, a painted kind composes its blend, a cut draws nothing', async () => {
 assert.equal(nested.nestedSeamMode('crossfade'),'crossfade');
 assert.equal(nested.nestedSeamMode('dip-to-colour'),'painted');
 assert.equal(nested.nestedSeamMode('wipe'),'painted');
 assert.equal(nested.nestedSeamMode('cut'),'none');
 const transitions=await load('transitions');
 assert.equal(transitions.transitionKindOf(undefined),'crossfade','an unset transition is a crossfade, as the app reads it');
 assert.equal(transitions.transitionKindOf({kind:'wipe',direction:'left'}),'wipe');
});
test('a seam starts once per boundary crossing: the key holds within a Scene and changes at its boundary', () => {
 const key=(t,i,local)=>nested.nestedBoundaryKey(SUB,i,t,local);
 assert.equal(key(2.5,1,0.5),key(2.9,1,0.9));
 assert.notEqual(key(2.5,1,0.5),key(5.5,2,0));
 assert.equal(key(5,2,0),key(5.2,2,0.2));
});
test('of seams in flight at several levels, the one that began latest is taken', () => {
 assert.equal(nested.latestNestedSeam([{n:'outer',elapsed:1.2},{n:'inner',elapsed:0.3}],x=>x.elapsed).n,'inner');
 assert.equal(nested.latestNestedSeam([],x=>x.elapsed),null);
});

// ——— freshness: the list is the source of revisions; waits and changed-since-placed are pure ———
test('the cache is keyed by the revision the library lists, and the occurrence\'s recorded revision is only compared', () => {
 assert.equal(nested.nestedChangedSincePlaced(7,8),true);
 assert.equal(nested.nestedChangedSincePlaced('7',7),false);
});
