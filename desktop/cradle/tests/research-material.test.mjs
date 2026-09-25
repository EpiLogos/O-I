import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const compiled=await build({stdin:{contents:"export * from './researchMaterial.ts';export {blankJourney,validateJourney,clone} from './model.ts';export {mapSceneOccurrences,mergeScenePage} from './sceneCorrespondence.ts';export {nativeInstrumentCanvas} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../expressions-app/field-studies-journeys/tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
test('research material actions retain rich notes, real dimensions and ink in the existing Journey',()=>{
 const journey=api.blankJourney(),scene=journey.scenes[0];
 api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:1,y:2},title:'Authored note'});
 const id=scene.entities.at(-1).id;
 const content=JSON.stringify([{type:'heading',props:{level:2},content:[{type:'text',text:'A real authored heading',styles:{bold:true}}]},{type:'bulletListItem',content:[{type:'text',text:'An authored list item',styles:{}}]}]);
 api.applyResearchMaterial(scene,{type:'card-content',id,content});
 api.applyResearchMaterial(scene,{type:'resize',id,width:640,height:320});
 api.applyResearchMaterial(scene,{type:'annotation-add',stroke:{id:'authored-stroke',points:[{x:10,y:20},{x:40,y:50,pressure:.5}],color:'#808080',width:3,opacity:1,createdAt:new Date().toISOString()}});
 const returned=api.validateJourney(JSON.parse(JSON.stringify(journey)));
 assert.equal(returned.scenes[0].research.cards[id].content,content);
 assert.deepEqual(returned.scenes[0].entities.find(e=>e.id===id).size,{x:1.6,y:.8});
 assert.equal(returned.scenes[0].research.strokes.length,1);
 assert.equal(returned.scenes[0].research.connections,undefined,'native relations have no copied research store');
});
test('research timeline layout CAS and malformed note refusals do not mutate working material',()=>{
 const scene=api.blankJourney().scenes[0];
 api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:0,y:0}});const id=scene.entities.at(-1).id;
 api.applyResearchMaterial(scene,{type:'timeline-layout',id,expectedRevision:null,value:{offsetY:30,width:240,height:160}});
 const before=api.clone(scene);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'timeline-layout',id,expectedRevision:null,value:{offsetY:100}}),/changed/);
 assert.deepEqual(scene,before);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'card-content',id,content:JSON.stringify([{type:'image',props:{url:'https://example.org/unrequested'}}])}),/media/);
 assert.deepEqual(scene,before);
 const invalid=api.clone(scene.research);invalid.cards['absent-occurrence']={type:'note',content:'[]'};
 assert.throws(()=>api.validateResearchMaterial(invalid,new Set(scene.entities.map(e=>e.id))),/existing occurrence/);
});
test('native occurrence mapping and hidden page merge retain exact research material identities',()=>{
 const scene=api.blankJourney().scenes[0];scene.entities=[];
 for(const name of ['Visible','Hidden'])api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:0,y:0},title:name});
 const [first,second]=scene.entities.map(e=>e.id),refs=new Map([[first,'expression:real:entity:first'],[second,'expression:real:entity:second']]);
 const native=api.mapSceneOccurrences(scene,'expression:real:scene:one',refs);
 assert.deepEqual(Object.keys(native.research.cards),[...refs.values()]);
 const visible=api.mapSceneOccurrences(native,'expression:real:scene:one',new Map(),new Set([refs.get(first)]));
 visible.research.cards[refs.get(first)].content='[{"type":"paragraph","content":[]}]';
 const merged=api.mergeScenePage(native,visible,new Set([refs.get(first)]));
 assert.equal(merged.research.cards[refs.get(second)].content,native.research.cards[refs.get(second)].content);
 assert.equal(merged.entities.length,2);
});
test('styling a real native source occurrence preserves source identity and never creates editable note content',{
 skip:!process.env.OI_RESEARCH_NATIVE_ARTIFACT?'Set OI_RESEARCH_NATIVE_ARTIFACT to the retained actual native M0 construction':false,
},async()=>{
 const actual=JSON.parse(await readFile(process.env.OI_RESEARCH_NATIVE_ARTIFACT,'utf8'));
 const view=api.kernelDocumentToJourney(actual.document);
 const scene=view.journey.scenes.find(scene=>view.bindings[scene.id].occurrences.some(o=>o.subject));
 assert.ok(scene,'actual native construction has source occurrences');
 const occurrence=view.bindings[scene.id].occurrences.find(o=>o.subject),id=occurrence.view_entity_id;
 const before=api.clone(view.document),binding=api.clone(occurrence.subject);
 assert.equal(api.nativeInstrumentCanvas(view,scene.id).nodes.find(n=>n.id===occurrence.entity_ref).type,'resource');
 api.applyResearchMaterial(scene,{type:'card-style',id,patch:{bgColour:'#334455'}});
 api.applyResearchMaterial(scene,{type:'resize',id,width:640,height:320});
 api.applyResearchMaterial(scene,{type:'card-caption',id,caption:'Presentation caption'});
 assert.equal(scene.research.cards[id].content,undefined,'style/caption never manufacture a note body');
 const shown=api.nativeInstrumentCanvas(view,scene.id).nodes.find(n=>n.id===occurrence.entity_ref);
 assert.equal(shown.type,'resource');assert.equal(shown.absolutePath,binding.subject_ref);
 assert.equal(shown.summary,'','source identity remains a binding, never an automatic card subtitle');
 assert.equal(shown.bgColour,'#334455');assert.deepEqual(shown.size,{width:640,height:320});
 assert.deepEqual(view.document,before,'source document is never mutated by presentation');
 assert.deepEqual(occurrence.subject,binding);
 // A prior version could have retained accidental empty note content. It may
 // remain recoverable material but must not override a native source binding.
 scene.research.cards[id].content='[]';
 assert.equal(api.nativeInstrumentCanvas(view,scene.id).nodes.find(n=>n.id===occurrence.entity_ref).type,'resource');
 api.applyResearchMaterial(scene,{type:'create-card',kind:'note',position:{x:0,y:0}});
 const local=scene.entities.at(-1),rich='[{"type":"heading","content":[{"type":"text","text":"Local rich note","styles":{"bold":true}}]}]';
 api.applyResearchMaterial(scene,{type:'card-content',id:local.id,content:rich});
 assert.equal(scene.research.cards[local.id].content,rich,'true local notes retain rich editing');
});
