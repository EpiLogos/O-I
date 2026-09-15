import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
const ENGINE_ROOT='../../packages/oi-design-system/expressions-engine';
const ENGINE_FILE='../'+ENGINE_ROOT;
const INTAKE_SHA='7306b7b8882f54fec931922d46fdbaba9f656212';
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
 const {validateJourney,DEFAULT_ENGINE_SETTINGS}=await server.ssrLoadModule(`${ENGINE_ROOT}/shell/model.mjs`);
 const journey=nativeSnapshotToJourney({config:material});
 const sceneId=journey.scenes[0].id;
 const saved=validateJourney({...journey,savedScenes:{[sceneId]:journey.scenes[0]}});
 assert.equal(saved.savedScenes[sceneId].id,sceneId);assertions++;
 assert.throws(()=>validateJourney({...journey,savedScenes:{'scene:ghost':journey.scenes[0]}}),/Saved scene does not match/);assertions++;

 // —— Semantic-field intake (7306b7b) ————————————————————————————————
 // The refresh emits the engine's current schema version and still reopens
 // the previous schema-4 documents without rewriting their content.
 const {nativeChakras,toNativeEntity,fromNativeEntity}=await server.ssrLoadModule(`${ENGINE_ROOT}/shell/nativeBridge.mjs`);
 const exported=nativeExport(nativeSnapshotToJourney({config:material}).scenes[0]);
 assert.equal(exported.schemaVersion,5);assertions++;
 const reopened=nativeSnapshotToJourney({schemaVersion:4,config:material}).scenes[0];
 assert.equal(reopened.native.config.entities.length,material.entities.length);assertions++;

 // Pointer click refinement: the interaction settings carry through export
 // (authoring fraction → native radius at the 400-unit stage scale) and back.
 assert.equal(DEFAULT_ENGINE_SETTINGS.pointerClick,'pulse');assertions++;
 const clickScene=nativeSnapshotToJourney({config:material}).scenes[0];
 clickScene.engine.pointerClick='shove';clickScene.engine.pointerClickStrength=3.5;clickScene.engine.pointerClickRadius=0.6;
 const clickOut=nativeExport(clickScene).config;
 assert.equal(clickOut.interaction.clickMode,'shove');assertions++;
 assert.equal(clickOut.interaction.clickStrength,3.5);assertions++;
 assert.equal(clickOut.interaction.clickRadius,240);assertions++;
 const clickBack=nativeSnapshotToJourney({config:clickOut}).scenes[0];
 assert.equal(clickBack.engine.pointerClick,'shove');assertions++;
 assert.equal(clickBack.engine.pointerClickRadius,0.6);assertions++;

 // The semantic chakra field: bindings authored in the shell schema validate
 // against the scene's own entities, survive export and reopen, and the pure
 // runtime evaluates carrier poses into per-node affinity and spatial colour.
 const {makeSemanticChakraEntities,makeChakraSemanticField}=await server.ssrLoadModule(`${ENGINE_ROOT}/engine/semantics/chakraPresets.mjs`);
 const {SemanticFieldRuntime}=await server.ssrLoadModule(`${ENGINE_ROOT}/engine/semantics/semanticFieldRuntime.mjs`);
 const {CymaticResonator}=await server.ssrLoadModule(`${ENGINE_ROOT}/engine/cymaticResonator.mjs`);
 const nativeChakraEntities=makeSemanticChakraEntities('yantra');
 assert.equal(nativeChakraEntities.length,7);assertions++;
 const semanticField=makeChakraSemanticField(nativeChakraEntities,'resonanceAffinity');
 const chakraScene=nativeSnapshotToJourney({config:material}).scenes[0];
 chakraScene.entities=nativeChakras();
 chakraScene.semanticField=semanticField;
 validateJourney({...journey,scenes:[chakraScene]});assertions++;
 const chakraExport=nativeExport(chakraScene).config;
 assert.ok(chakraExport.semanticField);assertions++;
 assert.equal(chakraExport.semanticField.profile.profileId,'chakra-seven-v1');assertions++;
 assert.equal(chakraExport.semanticField.bindings.length,7);assertions++;
 const chakraBack=nativeSnapshotToJourney({config:chakraExport}).scenes[0];
 assert.equal(chakraBack.semanticField.bindings[0].semanticNodeId,'muladhara');assertions++;
 const resonator=new CymaticResonator();resonator.configure({baseFrequency:40,plateSize:700});
 const anchors=resonator.getAnchors();
 assert.equal(anchors.length,7);assertions++;
 assert.ok(anchors.every((a)=>typeof a.id==='string'&&Number.isFinite(a.frequencyHz)&&Number.isFinite(a.modeIndex)));assertions++;
 const lowest=[...anchors].sort((a,b)=>a.frequencyHz-b.frequencyHz)[0];
 const resonance={frequencyHz:lowest.frequencyHz,totalEnergy:1,coherence:1,
  modes:anchors.map((a)=>({modeIndex:a.modeIndex,m:a.m,n:a.n,frequencyHz:a.frequencyHz,coupling:0,active:true,re:0,im:0,energy:a.modeIndex===lowest.modeIndex?1:0})),
  anchors:anchors.map((a)=>({ ...a,energy:a.modeIndex===lowest.modeIndex?1:0}))};
 const runtime=new SemanticFieldRuntime();
 const state=runtime.evaluate({config:semanticField,resonance,
  poses:[{entityId:'ent_semantic_muladhara',x:0,y:-300,z:0,scale:1,extent:{width:94,height:94,rotation:0,normalized:true},tint:'#252720'}],
  entityTints:new Map(),forceEmitters:[],focus:null,delta:0});
 assert.equal(state.nodes.length,7);assertions++;
 const root=state.nodes.find((n)=>n.semanticNodeId==='muladhara');
 assert.ok(root&&root.directResonantEnergy===1&&root.affinity>0);assertions++;
 const colour=state.colorFields.find((f)=>f.semanticNodeId==='muladhara');
 assert.ok(colour&&colour.color==='#ff2255'&&colour.gain>0);assertions++;
 const idle=runtime.evaluate({config:{...semanticField,enabled:false},resonance,poses:[],entityTints:new Map(),forceEmitters:[],focus:null,delta:0});
 assert.equal(idle.nodes.length+idle.colorFields.length,0);assertions++;

 // The per-link source workflow: a sequence state carries its own source and
 // object state; the native link round trip preserves both, and the state
 // helpers label and resolve them without touching the entity base.
 const {stateSource,stateLabel}=await server.ssrLoadModule(`${ENGINE_ROOT}/shell/sourceState.mjs`);
 const flowScene=nativeSnapshotToJourney({config:material}).scenes[0];
 const flowEntity=flowScene.entities[0];
 flowEntity.sequence.enabled=true;flowEntity.sequence.sourcesVersion=1;
 const step={id:'state-k9',name:'K9 state',text:'K9',shape:'text',hold:2,transition:1,position:null,
  source:{kind:'ascii',ascii:{text:'K9'}},
  objectState:{size:{x:1,y:1},rotation:0,scale:2,tint:'#ff2255',tintWeight:1,force:{kind:'vortex',strength:1,radius:0.5,spin:0.2}}};
 flowEntity.sequence.steps=[step];
 validateJourney({...journey,scenes:[flowScene]});assertions++;
 assert.equal(stateSource(flowEntity,0)?.kind,'ascii');assertions++;
 assert.equal(stateLabel(step),'K9 state');assertions++;
 const flowNative=toNativeEntity(flowEntity);
 const link=flowNative.sequence.links[0];
 assert.equal(link.name,'K9 state');assertions++;
 assert.equal(link.source.ascii.text,'K9');assertions++;
 assert.equal(link.state.scale,2);assertions++;
 assert.equal(link.state.forces.mode,'vortex');assertions++;
 assert.equal(link.state.extent.width,400);assertions++;
 const flowBack=fromNativeEntity(flowNative);
 assert.equal(flowBack.sequence.steps[0].name,'K9 state');assertions++;
 assert.equal(flowBack.sequence.steps[0].source.ascii.text,'K9');assertions++;
 assert.equal(flowBack.sequence.steps[0].objectState.scale,2);assertions++;
 assert.equal(flowBack.sequence.steps[0].objectState.force.radius,0.5);assertions++;
 console.log(`Expression projection: ${assertions} native engine round-trip assertions passed (engine intake ${INTAKE_SHA.slice(0,7)}: semantic field, source states, pointer effects)`);
} finally {await server.close();}
