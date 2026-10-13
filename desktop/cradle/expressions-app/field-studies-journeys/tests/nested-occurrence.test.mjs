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
 await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:[`src/${name}.ts`],bundle:true,format:'esm',platform:'node',target:'es2022',outfile,logLevel:'silent',
  loader:{'.woff':'empty','.woff2':'empty','.ttf':'empty','.svg':'empty','.png':'empty','.jpg':'empty','.webp':'empty','.css':'empty'}});
 return import(pathToFileURL(outfile).href);
}
const bridge=await load('kernelDocumentBridge');
const nested=await load('nestedOccurrence');
const markers=await load('journeyMarkers');
const reads=await load('nestedReads');
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));

const HOST='expression:host-a',SUB='expression:saved-b',SCENE=HOST+':scene:main';
const read=ref=>({ref,revision:'r1',availability:'available'});
const entityRefs=n=>Array.from({length:n},(_,i)=>`${SUB}:entity:e${i}`);
const entity=ref=>({entity_ref:ref,title:ref.split(':').pop(),subject:null,parameters:{glyph:{value:'A'},x:{value:0},y:{value:0},z:{value:0}}});
function host(bodyRecursion){
 const body={carrier:'expression_ref',subject_ref:SUB,native_owner:'oi',reading:{ref:SUB,revision:'7',availability:'available'},provenance:[{ref:SUB,revision:'7',availability:'available'}],actions:[],presentation:'inline',capability:{state:'renderable'},span:null,recursion:bodyRecursion};
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
const nestsDoc=(ref,child)=>({expression_ref:ref,entities:{},scenes:[{scene_ref:ref+':scene:main',entity_refs:[],body:{carrier:'expression_ref',subject_ref:child}}]});

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
 assert.deepEqual(nested.nestedReadPlan(g,A,1),[],'bound 1: B would be level 2, so it is not read');
 assert.deepEqual(nested.nestedReadPlan(g,A,2),[B],'bound 2 reads B');
 g.set(B,nestsDoc(B,C));
 assert.deepEqual(nested.nestedReadPlan(g,A,2),[],'bound 2 never reads C (level 3)');
 assert.deepEqual(nested.nestedReadPlan(g,A,3),[C],'bound 3 reads C');
 assert.deepEqual(nested.nestedReadPlan(new Map(),A,4),[A],'an empty graph asks for the subject first');
 assert.deepEqual(nested.nestedReadPlan(new Map(),A,4,new Set([A])),[],'a document that failed to read is not retried');
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
