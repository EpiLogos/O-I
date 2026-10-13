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
