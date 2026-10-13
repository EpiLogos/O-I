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
const nestsDoc=(ref,child)=>({expression_ref:ref,entities:{},scenes:[{scene_ref:ref+':scene:main',entity_refs:[],body:{carrier:'expression_ref',subject_ref:child,reading:{ref:child,revision:'1',availability:'available'},recursion:{host_expression_ref:ref,max_depth:1}}}]});

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
 const req=new Map([[A,'rev:7']]);
 const root={ref:A,key:'rev:7'};
 assert.deepEqual(nested.nestedReadPlan(g,req,root,1),[],'bound 1: B would be level 2, so it is not read');
 assert.deepEqual(nested.nestedReadPlan(g,req,root,2),[{ref:B,key:'rev:1'}],'bound 2 reads B under the key its body records');
 g.set(B,nestsDoc(B,C));req.set(B,'rev:1');
 assert.deepEqual(nested.nestedReadPlan(g,req,root,2),[],'bound 2 never reads C (level 3)');
 assert.deepEqual(nested.nestedReadPlan(g,req,root,3),[{ref:C,key:'rev:1'}],'bound 3 reads C');
 assert.deepEqual(nested.nestedReadPlan(new Map(),new Map(),root,4),[root],'an empty graph asks for the subject first');
 assert.deepEqual(nested.nestedReadPlan(new Map(),new Map(),root,4,new Set([A])),[],'a document that failed to read is not retried in the same pass');
});

test('a document is current only under the key its occurrence requests it by; a moved recorded revision reads again', () => {
 const A='expression:a',B='expression:b';
 const g=new Map([[A,nestsDoc(A,B)],[B,savedDoc(B,1)]]);
 const req=new Map([[A,'rev:7'],[B,'rev:0']]);
 assert.deepEqual(nested.nestedReadPlan(g,req,{ref:A,key:'rev:7'},2),[{ref:B,key:'rev:1'}],'B was requested under an older revision: read again');
 req.set(B,'rev:1');
 assert.deepEqual(nested.nestedReadPlan(g,req,{ref:A,key:'rev:7'},2),[],'B is current under its recorded revision: kept');
 assert.deepEqual(nested.nestedReadPlan(g,req,{ref:A,key:'rev:9'},2),[{ref:A,key:'rev:9'}],'a moved revision of the subject reads the subject again');
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
test('the workspace reads the nested documents its open view names, re-derives the verdict live, and refreshes the host', async () => {
 const requested=[];let refreshed=0;
 const docs=new Map([[SUB,savedDoc(SUB,2)]]);
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);if(!docs.has(ref))throw new Error('absent '+ref);return docs.get(ref);},()=>refreshed++);
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 const sceneId=view.startSceneId;
 assert.equal(readers.view(view).bindings[sceneId].nested.state,'unread','before the read lands the verdict is unread, not guessed');
 await settle();
 assert.equal(refreshed,1,'the host is refreshed once the nested document arrives');
 assert.equal(readers.view(view).bindings[sceneId].nested.state,'ready');
 assert.deepEqual(requested,[SUB],'bound 1 reads the subject only');
 assert.equal(readers.document(SUB).expression_ref,SUB);
});

test('the workspace reads no deeper than the bound, and the refusal of a deeper chain appears live', async () => {
 const requested=[];
 const mid='expression:mid-d',deep='expression:deep-d';
 const docs=new Map([[SUB,nestsDoc(SUB,mid)],[mid,nestsDoc(mid,deep)],[deep,savedDoc(deep,1)]]);
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);if(!docs.has(ref))throw new Error('absent '+ref);return docs.get(ref);},()=>{});
 const view=bridge.kernelDocumentToJourney(host(bound(2)));
 readers.view(view);
 await settle();
 const live=readers.view(view);
 assert.deepEqual(requested,[SUB,mid],'bound 2 reads two levels; the third is never requested');
 assert.equal(live.bindings[view.startSceneId].nested.state,'refused');
 assert.match(live.bindings[view.startSceneId].nested.reason,/nests 3 levels deep; this placement admits 2/);
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

// ——— freshness: the cache is keyed by ref and by the revision each occurrence records ———
test('the key is the recorded revision, and an occurrence that records none is keyed by its structure', () => {
 assert.equal(nested.nestedKeyOf(SUB,'7',1),'rev:7');
 assert.equal(nested.nestedKeyOf(SUB,7,1),'rev:7');
 assert.equal(nested.nestedKeyOf(SUB,'',2),`structure:${SUB}:2`);
 assert.equal(nested.nestedBodyKey({subject_ref:SUB,reading:{revision:'7'},recursion:{max_depth:3}}),'rev:7');
});
test('a document is kept across host views while its recorded revision is unchanged: no re-read, and no unread flicker', async () => {
 const requested=[];let refreshed=0;
 const docs=new Map([[SUB,savedDoc(SUB,2)]]);
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);if(!docs.has(ref))throw new Error('absent');return docs.get(ref);},()=>refreshed++);
 readers.view(bridge.kernelDocumentToJourney(host(bound(1))));
 await settle();
 assert.deepEqual(requested,[SUB]);
 const view=bridge.kernelDocumentToJourney(host(bound(1)));
 assert.equal(readers.view(view).bindings[view.startSceneId].nested.state,'ready','ready at once: an unrelated host edit clears nothing');
 await settle();
 assert.deepEqual(requested,[SUB],'no re-read');
 assert.equal(refreshed,1,'no refresh for an unchanged document');
});
test('a nested document edited elsewhere is picked up when the recorded revision moves, and not before', async () => {
 const requested=[];
 const docs=new Map([[SUB,savedDoc(SUB,2)]]);
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);if(!docs.has(ref))throw new Error('absent');return docs.get(ref);},()=>{});
 readers.view(bridge.kernelDocumentToJourney(host(bound(1),'7')));
 await settle();
 docs.set(SUB,{...savedDoc(SUB,3),revision:8});
 readers.view(bridge.kernelDocumentToJourney(host(bound(1),'7')));
 await settle();
 assert.deepEqual(requested,[SUB],'the occurrence still records revision 7: the document is kept');
 assert.equal(readers.document(SUB).revision,7);
 const moved=bridge.kernelDocumentToJourney(host(bound(1),'8'));
 const pending=readers.view(moved);
 assert.equal(pending.bindings[moved.startSceneId].nested.state,'unread','the recorded revision moved: unread until it is read, not the old content');
 await settle();
 assert.deepEqual(requested,[SUB,SUB]);
 assert.equal(readers.document(SUB).revision,8);
 assert.equal(readers.view(moved).bindings[moved.startSceneId].nested.state,'ready');
});
test('an occurrence that records no revision is re-read only when its structure changes, never on every view', async () => {
 const requested=[];
 const docs=new Map([[SUB,savedDoc(SUB,1)]]);
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);return docs.get(ref);},()=>{});
 readers.view(bridge.kernelDocumentToJourney(host(bound(1),'')));
 await settle();
 readers.view(bridge.kernelDocumentToJourney(host(bound(1),'')));
 await settle();
 assert.deepEqual(requested,[SUB],'a new view of the same structure reads nothing');
 readers.view(bridge.kernelDocumentToJourney(host(bound(2),'')));
 await settle();
 assert.deepEqual(requested,[SUB,SUB],'a different depth is a structural change: read again');
});
test('a missing document reads unread, and is asked for again on the next view', async () => {
 const requested=[];
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);throw new Error('absent');},()=>{});
 const v1=bridge.kernelDocumentToJourney(host(bound(1)));
 assert.equal(readers.view(v1).bindings[v1.startSceneId].nested.state,'unread');
 await settle();
 readers.view(bridge.kernelDocumentToJourney(host(bound(1))));
 await settle();
 assert.deepEqual(requested,[SUB,SUB]);
});
test('the cache keeps exactly what the open view names', async () => {
 const orphan='expression:orphan';
 const docs=new Map([[SUB,savedDoc(SUB,1)],[orphan,savedDoc(orphan,1)]]);
 const readers=reads.nestedDocumentReads(async ref=>docs.get(ref),()=>{});
 await readers.readNested(orphan,'1',1);
 assert.ok(readers.document(orphan));
 readers.view(bridge.kernelDocumentToJourney(host(bound(1))));
 await settle();
 assert.equal(readers.document(orphan),undefined,'a document no open occurrence names is dropped');
 assert.ok(readers.document(SUB));
});
test('a placement reads the document under the revision it records, so the placed occurrence reads ready with no second read', async () => {
 const requested=[];
 const docs=new Map([[SUB,savedDoc(SUB,2)]]);
 const readers=reads.nestedDocumentReads(async ref=>{requested.push(ref);return docs.get(ref);},()=>{});
 await readers.readNested(SUB,7,1);
 const view=bridge.kernelDocumentToJourney(host(bound(1),'7'));
 assert.equal(readers.view(view).bindings[view.startSceneId].nested.state,'ready');
 await settle();
 assert.deepEqual(requested,[SUB],'one read, under the placement\'s recorded revision');
});
