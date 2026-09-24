import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const artifact=process.env.OI_RESEARCH_NATIVE_ARTIFACT;
test('Research instruments preserve actual native construction and owner reading boundaries', {
 skip:artifact?false:'Set OI_RESEARCH_NATIVE_ARTIFACT to wiki-native-artifact.json emitted by the real native M0 owner test',
},async()=>{
const engine=resolve(fileURLToPath(new URL('..',import.meta.url))),repo=resolve(engine,'../../../..');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');
const temporary=await mkdtemp(join(tmpdir(),'oi-research-native-'));
try {
const out=join(temporary,'adapters.mjs');
await build({stdin:{contents:`export * from './src/researchInstrumentsData.ts';export {kernelDocumentToJourney} from './src/kernelDocumentBridge.ts';export {wikiReadingPayload,wikiSceneReadingPayload} from '../../src/techne/wikiReadingProvider.ts';`,resolveDir:engine},tsconfig:engine+'/tsconfig.json',nodePaths:[repo+'/desktop/cradle/expressions-app/node_modules'],bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
const api=await import(pathToFileURL(out));
const actual=JSON.parse(await readFile(artifact,'utf8'));assert.equal(actual.reading.state,'ready');
const view=api.kernelDocumentToJourney(actual.document);
const reading=api.wikiReadingPayload({register:actual.register,subject:{kind:'wiki',ref:'wiki:'+actual.register.key},reading:actual.reading,document:actual.document});
const models=await api.readingInstruments(reading);assert.equal(models.reading.reading_ref,reading.reading_ref);
const scene=view.journey.scenes.find(s=>s.entities.length);assert.ok(scene,'actual native scene contains source members');
for(const actualScene of view.journey.scenes){
 const current=api.nativeInstrumentCanvas(view,actualScene.id);
 api.assertInstrumentReadingScope(reading,view,actualScene.id);
 for(const node of current.nodes)assert.ok(actual.document.entities[node.id],'every Scene card is an actual native member');
}
const canvas=api.nativeInstrumentCanvas(view,scene.id),binding=view.bindings[scene.id];
assert.equal(canvas.nodes.length,scene.entities.length);
for(const node of canvas.nodes){assert.ok(actual.document.entities[node.id]);const id=canvas.occurrences.get(node.id),entity=scene.entities.find(e=>e.id===id);assert.ok(entity);assert.equal(node.position.x/api.CANVAS_UNITS,entity.position.x);assert.equal(-node.position.y/api.CANVAS_UNITS,entity.position.y);if(node.type==='note')assert.equal(api.expressionTextFromNote(node.content),entity.text);else if(node.type==='resource')assert.equal(node.absolutePath,actual.document.entities[node.id].subject.subject_ref,'source card stays an exact native binding, not an editable note');}
for(const edge of canvas.edges){
 const native=actual.document.relations[edge.id];assert.ok(native);assert.equal(edge.sourceNodeId,native.from_entity_ref);assert.equal(edge.targetNodeId,native.to_entity_ref);
 const type=native.provenance.find(source=>source.ref.startsWith('wiki:relation-type:'))?.ref.slice('wiki:relation-type:'.length);
 if(type)assert.equal(edge.label,type,'the source relation type labels the edge, never its observation ID');
}
const scoped=api.wikiSceneReadingPayload({register:actual.register,reading:actual.reading,document:actual.document,sceneRef:binding.scene_ref});
const titles=api.nativeInstrumentTitles(view,scene.id),named=await api.readingInstruments(scoped,titles);
for(const node of named.bundle.nodes)if(titles.has(node.graphNodeId)){assert.equal(node.title,titles.get(node.graphNodeId));assert.equal((await named.dataSource.loadNode(node.graphNodeId)).title,titles.get(node.graphNodeId),'actual instrument repository receives the disclosed native title');}
assert.deepEqual(scoped.expressions,[{expression_ref:actual.document.expression_ref,revision:String(actual.document.revision),scene_ref:binding.scene_ref}]);
api.assertInstrumentReadingScope(reading,view,scene.id);
const unrelated={...reading,subject:{...reading.subject,subject_ref:'unrelated:subject'},expressions:[]};assert.throws(()=>api.assertInstrumentReadingScope(unrelated,view,scene.id),/No source reading is bound/);
const stale={...unrelated,expressions:[{expression_ref:view.document.expression_ref,scene_ref:binding.scene_ref,revision:String(view.document.revision+1)}]};assert.throws(()=>api.assertInstrumentReadingScope(stale,view,scene.id),/No source reading is bound/);
const ownerTime=await models.dataSource.loadTimelineView();if(!reading.temporal?.length)assert.equal(ownerTime.nodes.length,0,'no current date is invented');
const ownerPlaces=await models.places.getLocatedNodes(reading.subject.subject_ref);if(!reading.spatial?.length)assert.equal(ownerPlaces.length,0,'basemap geography is not native personal place data');
assert.equal(models.dataSource.saveTimelineLayout,undefined,'no memory-only layout save presented as persistence');
await assert.rejects(models.timeline.getTimelineWalk('unrelated:subject',{startYear:0,endYear:3000}),/does not address/);
await assert.rejects(models.places.getLocatedNodes('unrelated:subject'),/does not address/);
assert.throws(()=>api.expressionTextFromNote(JSON.stringify([{type:'heading',content:[]}])),/plain text/);
assert.throws(()=>api.expressionTextFromNote(JSON.stringify([{type:'paragraph',content:[{type:'text',text:'cannot discard formatting',styles:{bold:true}}]}])),/Rich text/);
const result={status:'passed',artifact,source:actual.source,expression_ref:actual.document.expression_ref,revision:actual.document.revision,scene_ref:binding.scene_ref,nodes:canvas.nodes.length,relations:canvas.edges.length,temporal:ownerTime.nodes.length,places:ownerPlaces.length,checks:['real native identities and exact occurrence mapping','native positions roundtrip','exact plain text roundtrip','source relations preserved','matching native Expression revision accepted','foreign and stale scope refused','dates and places never invented','no memory-only layout writes','cross-scope repository requests refused','unsupported rich text refused']};
console.log(JSON.stringify(result));
} finally {await rm(temporary,{recursive:true,force:true});}
});
