import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
const ENGINE_ROOT='../../packages/oi-design-system/expressions-engine';
const ENGINE_FILE='../'+ENGINE_ROOT;
const INTAKE_SHA='9443f58fa8599f903d6affa61bc6fbed7109f640';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
let assertions=0;
try {
 // The vendored engine is the exact accepted intake revision — provenance is
 // part of the contract, not a comment.
 const provenance=JSON.parse(readFileSync(new URL(`${ENGINE_FILE}/PROVENANCE.json`,import.meta.url),'utf8'));
 assert.equal(provenance.sha,INTAKE_SHA);assertions++;
 const {expressionConfig}=await server.ssrLoadModule('/src/expression/engineProjection.ts');
 const {nativeSnapshotToJourney,nativeExport}=await server.ssrLoadModule(`${ENGINE_ROOT}/shell/nativeBridge.mjs`);
 const d={schema:'oi.expression/v1',expression_ref:'expression:test',revision:3,title:'Test',scenes:[{scene_ref:'expression:test:scene:main',revision:3,title:'Main',entity_refs:['expression:test:entity:a','expression:test:entity:b']}],selection:{scene_ref:'expression:test:scene:main',entity_ref:'expression:test:entity:a'},entities:{'expression:test:entity:a':{entity_ref:'expression:test:entity:a',revision:3,title:'A',parameters:{glyph:{value:'EX1',automation:null},x:{value:-100,automation:null},scale:{value:1,automation:{min:0.5,max:1.5,rate_hz:0.2,waveform:'sine'}}}},'expression:test:entity:b':{entity_ref:'expression:test:entity:b',revision:3,title:'B',parameters:{glyph:{value:'B',automation:null},x:{value:100,automation:null}}}}};
 const material=expressionConfig(d);
 const restored=nativeExport(nativeSnapshotToJourney({config:material}).scenes[0]).config;
 assert.equal(restored.entities[0].id,'expression:test:entity:a');assertions++;
 assert.equal(restored.entities[0].shape.text,'EX1');assertions++;
 assert.equal(restored.entities[0].x,-100);assertions++;
 assert.equal(restored.entities[1].id,'expression:test:entity:b');assertions++;
 assert.equal(restored.automations[0].enabled,true);assertions++;
 assert.equal(restored.automations[0].path,'entities.0.scale');assertions++;
 assert.equal(restored.automations[0].rateHz,0.2);assertions++;
 d.scenes[0].entity_refs.reverse();
 const reversed=nativeExport(nativeSnapshotToJourney({config:expressionConfig(d)}).scenes[0]).config;
 assert.equal(reversed.automations[0].path,'entities.1.scale');assertions++;
 assert.equal(reversed.entities[1].id,'expression:test:entity:a');assertions++;
 assert.equal(reversed.entities[1].shape.text,'EX1');assertions++;

 // Linked automation lanes (9443f58): a follower carries the leader's clock
 // through migration and back out to the native config; the morph waveform
 // maps losslessly in both directions.
 const leader={id:'field-pulse',path:'fluid.curlScale',enabled:true,type:'lfo',waveform:'morph',min:0,max:1,rateHz:0.2,phase:0,blend:'replace'};
 const follower={id:'entity-b-pulse',clockId:'field-pulse',path:'entities.1.scale',enabled:true,type:'lfo',waveform:'sine',min:0.5,max:1.5,rateHz:0.2,phase:0,blend:'replace'};
 const linked=nativeSnapshotToJourney({config:{...material,automations:[...material.automations,leader,follower]}}).scenes[0];
 const authored=Object.fromEntries(linked.automation.map((lane)=>[lane.id,lane]));
 assert.equal(authored['field-pulse'].wave,'morph');assertions++;
 assert.equal(authored['field-pulse'].clockId,undefined);assertions++;
 assert.equal(authored['entity-b-pulse'].clockId,'field-pulse');assertions++;
 assert.equal(authored['entity-b-pulse'].syncWith,'field-pulse');assertions++;
 const linkedOut=nativeExport(linked).config;
 assert.equal(linkedOut.automations.length,3);assertions++;
 assert.equal(linkedOut.automations.find((lane)=>lane.id==='field-pulse').waveform,'morph');assertions++;
 assert.equal(linkedOut.automations.find((lane)=>lane.id==='entity-b-pulse').clockId,'field-pulse');assertions++;

 // The unified morph drive law (9443f58): conjugate phases produce the
 // A→B progress; the pure surface is the same module the engine renders with.
 const {computeMorphDrive}=await server.ssrLoadModule(`${ENGINE_ROOT}/engine/morphSignal.mjs`);
 const mid=computeMorphDrive({},0,0);
 assert.equal(mid.signal,0);assertions++;
 assert.equal(mid.progress,0.5);assertions++;
 assert.equal(computeMorphDrive({},Math.PI/2,0).progress,1);assertions++;
 assert.equal(computeMorphDrive({},-Math.PI/2,0).progress,0);assertions++;
 const cycled=computeMorphDrive({},Math.PI*2*2.5,0);
 assert.equal(cycled.cycleIndex,2);assertions++;
 assert.ok(Math.abs(cycled.cycleFraction-0.5)<1e-12);assertions++;

 // Scene save workflow (9443f58): a saved scene must match a working scene
 // id and revalidate; a saved scene without its working scene refuses.
 const {validateJourney}=await server.ssrLoadModule(`${ENGINE_ROOT}/shell/model.mjs`);
 const journey=nativeSnapshotToJourney({config:material});
 const sceneId=journey.scenes[0].id;
 const saved=validateJourney({...journey,savedScenes:{[sceneId]:journey.scenes[0]}});
 assert.equal(saved.savedScenes[sceneId].id,sceneId);assertions++;
 assert.throws(()=>validateJourney({...journey,savedScenes:{'scene:ghost':journey.scenes[0]}}),/Saved scene does not match/);assertions++;
 console.log(`Expression projection: ${assertions} native engine round-trip assertions passed (engine intake ${INTAKE_SHA.slice(0,7)})`);
} finally {await server.close();}
