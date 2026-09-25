import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const artifact=process.env.OI_NATIVE_TIMELINE_PROOF;
test('Timeline filters and occurrence previews consume retained actual native readings',{skip:!artifact},async()=>{
 const actual=JSON.parse(await readFile(artifact,'utf8'));
 assert.ok(actual.schema.startsWith('oi.native-'));assert.ok(actual.reading.temporal.length);
 const source=fileURLToPath(new URL('../src/',import.meta.url));
 const compiled=await build({stdin:{contents:"export {readingInstruments,nativeInstrumentTitles,nativeInstrumentPreviews} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';export {createTechneTransport} from '../../vendor/research-canvas/packages/desktop-api/src/techneTransport.ts';",resolveDir:source},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const before=JSON.stringify(actual.document),view=api.kernelDocumentToJourney(actual.document),sceneId=view.startSceneId;
 const previews=api.nativeInstrumentPreviews(view,sceneId);
 for(const [ref,preview]of previews){const occurrence=view.bindings[sceneId].occurrences.find(row=>row.subject?.subject_ref===ref);assert.ok(occurrence);const entity=view.journey.scenes.find(row=>row.id===sceneId).entities.find(row=>row.id===occurrence.view_entity_id);assert.equal(preview.body,entity.text);assert.equal(preview.summary,entity.text.slice(0,512));}
 const data=await api.readingInstruments(actual.reading,api.nativeInstrumentTitles(view,sceneId),previews),all=await data.dataSource.loadTimelineView();
 assert.ok(all.nodes.length>0,'actual native dates reach Timeline');
 assert.equal((await data.dataSource.loadTimelineView(undefined,{tags:{include:['not-disclosed-by-this-owner']}})).nodes.length,0,'tag include no longer silently returns every card');
 assert.equal((await data.dataSource.loadTimelineView(undefined,{tags:{include:[]}})).nodes.length,0,'explicit empty include means none');
 assert.deepEqual((await data.dataSource.loadTimelineView(undefined,{tags:{exclude:['not-disclosed-by-this-owner']}})).nodes,all.nodes);
 assert.equal(data.dataSource.styleCapability.available,false);assert.match(data.dataSource.styleCapability.reason,/native Scene/);
 assert.equal(data.dataSource.archetypeCapability.available,false);
 assert.equal(JSON.stringify(actual.document),before,'view filtering and text preview never mutate native work');
 // Production transport contract correctness independent of owner admission:
 // these are view records, not an assertion that native sources contain tags.
 const bundle=structuredClone(data.bundle),dated=bundle.nodes.filter(row=>row.isTemporal);assert.ok(dated.length>=2);
 dated[0].evidenceTags=['keep','both'];dated[1].evidenceTags=['other','both'];
 const first=dated[0].graphNodeId,second=dated[1].graphNodeId;
 bundle.relationships=[{id:'filter-contract-a',sourceGraphNodeId:first,targetGraphNodeId:second,relType:'supports',properties:{}},{id:'filter-contract-b',sourceGraphNodeId:first,targetGraphNodeId:second,relType:'contrasts',properties:{}}];
 const transport=api.createTechneTransport(bundle),load=filters=>transport.loadTimelineView({workspaceId:bundle.workspaceId,filters});
 assert.deepEqual((await load({tags:{include:['keep']}})).nodes.map(row=>row.node.graphNodeId),[first]);
 assert.deepEqual((await load({tags:{include:['both'],exclude:['other']}})).nodes.map(row=>row.node.graphNodeId),[first]);
 assert.equal((await load({tags:{include:['keep']}})).relationships.length,0,'no dangling filtered endpoints');
 assert.deepEqual((await load({relationTypes:{include:['supports']}})).relationships.map(row=>row.relType),['supports']);
 assert.deepEqual((await load({relationTypes:{exclude:['supports']}})).relationships.map(row=>row.relType),['contrasts']);
 assert.equal((await load({relationTypes:{include:[]}})).relationships.length,0,'all relation types deselected is not all');
 console.log(JSON.stringify({artifact,nativeTemporalCards:all.nodes.length,nativeOccurrencePreviews:previews.size,checks:'native reading filter/refusal and production transport include/exclude/endpoint integrity'}));
});
