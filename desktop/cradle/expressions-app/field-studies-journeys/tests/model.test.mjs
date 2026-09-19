import {reorderFocus} from '../build/timeline.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {oiMark,fieldStudies,sevenCentres,smallLanguage,blankJourney,blankScene,validateJourney,clone,entity,pin} from '../build/model.js';
import {DocumentStore} from '../build/store.js';
import {project,unproject,defaultCamera,facePlane} from '../build/camera.js';
import {sequenceAt,evaluateParameters,arrange,phases,focusAt} from '../build/timeline.js';
test('all curated journeys validate and have named, independent scenes',()=>{for(const f of [oiMark,fieldStudies,sevenCentres,smallLanguage,blankJourney]){const j=f();assert.deepEqual(validateJourney(j),j);assert.ok(j.scenes.every(s=>s.name&&s.character));}});
test('journeys authored before autoFitSizes validate and receive the default',()=>{const j=JSON.parse(JSON.stringify(fieldStudies()));delete j.scenes[0].engine.autoFitSizes;assert.equal(validateJourney(j).scenes[0].engine.autoFitSizes,true);});
test('journeys authored before the collision sections validate and receive defaults',()=>{const j=JSON.parse(JSON.stringify(fieldStudies()));delete j.scenes[0].engine.mediumEnabled;delete j.scenes[0].engine.collisionEnabled;delete j.scenes[0].engine.collisionMode;delete j.scenes[0].engine.pairwiseEnabled;const e=validateJourney(j).scenes[0].engine;assert.equal(e.mediumEnabled,false);assert.equal(e.collisionEnabled,false);assert.equal(e.collisionMode,'obstacle');assert.equal(e.pairwiseEnabled,false);});
test('the O:I mark is one expression with a day and a night scene of the same O/I',()=>{const j=oiMark();assert.deepEqual(j.scenes.map(s=>s.name),['Day','Night']);for(const s of j.scenes){assert.deepEqual(s.entities.map(e=>e.text),['O','I']);assert.equal(s.field.material,'ink');}const day=j.scenes[0].field,night=j.scenes[1].field;assert.equal(day.background,'#f4f2eb');assert.equal(night.background,'#1d231f');assert.deepEqual(day.palette,['#252720','#252720']);assert.deepEqual(night.palette,['#eee9d9','#a9b399']);});
test('opening composition preserves two persistent O/I entities',()=>{const s=fieldStudies().scenes[0];assert.deepEqual(s.entities.map(e=>e.text),['O','I']);assert.ok(s.entities[0].size.x>1.4);assert.equal(s.field.material,'ink');});
test('pins have zero particle share, without altering scene palette',()=>{const s=fieldStudies().scenes[0],before=clone(s);s.entities.push(pin({x:.2,y:.3,z:.4}));assert.equal(s.entities.at(-1).share,0);assert.deepEqual(s.field,before.field);assert.deepEqual(s.entities.slice(0,2),before.entities);});
test('projection/unprojection are inverse on 3D working planes',()=>{for(const plane of ['XY','XZ','YZ']){const c=defaultCamera();c.mode='3d';c.yaw=.54;c.pitch=.44;c.plane=plane;c.depth=.24;c.zoom=1.3;c.panX=16;c.panY=-19;const v=plane==='XY'?{x:.2,y:-.3,z:.24}:plane==='XZ'?{x:.2,y:.24,z:-.3}:{x:.24,y:.2,z:-.3};const p=project(v,c,1440,1000),back=unproject(p.x,p.y,c,1440,1000);for(const k of ['x','y','z'])assert.ok(Math.abs(v[k]-back[k])<1e-9);}});
test('edge-on working plane fails explicitly rather than placing at invented depth',()=>{const c=defaultCamera();c.plane='XZ';assert.throws(()=>unproject(500,500,c,1440,1000),/edge-on/);facePlane(c);assert.doesNotThrow(()=>unproject(500,500,c,1440,1000));});
test('grid snapping rounds only the working-plane coordinates',()=>{const c=defaultCamera();c.snap=true;c.depth=.123;const v=unproject(700,410,c,1440,1000);assert.equal(v.z,.123);assert.ok(Math.abs(v.x*10-Math.round(v.x*10))<1e-10);});
test('preview slider transactions produce one undo entry',()=>{const store=new DocumentStore(fieldStudies());store.begin();store.touch();store.document.scenes[0].field.params.size=1;store.begin();store.touch();store.document.scenes[0].field.params.size=2;store.finish();assert.equal(store.undoStack.length,1);store.undo();assert.equal(store.document.scenes[0].field.params.size,2.8);store.redo();assert.equal(store.document.scenes[0].field.params.size,2);});
test('entity sequence position keyframes are local offsets',()=>{const s=fieldStudies().scenes[0],e=s.entities[0];e.sequence.enabled=true;e.sequence.steps[0].position={x:.2,y:.3,z:.4};const a=sequenceAt(e,s,0);assert.equal(a.position.x,e.position.x+.2);e.position.x+=.5;assert.ok(Math.abs(sequenceAt(e,s,0).position.x-a.position.x-.5)<1e-12);});
test('morph-clock sequence advances one link per toroidal cycle',()=>{const s=fieldStudies().scenes[0],e=s.entities[0];e.sequence.enabled=true;e.sequence.clock='morph';e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'second',text:'&'});s.morph.thetaRate=.5;assert.equal(sequenceAt(e,s,.1).from,0);assert.equal(sequenceAt(e,s,2.1).from,1);assert.equal(sequenceAt(e,s,4.1).from,0);});
test('automation never changes base values or the document',()=>{const s=fieldStudies().scenes[0];s.automation.push({id:'lane',enabled:true,target:'field.size',type:'lfo',wave:'sine',min:.4,max:2,rate:.25,phase:0,blend:'replace',duration:4,delay:0,loop:'once',firedAt:null});const before=JSON.stringify(s);assert.equal(evaluateParameters(s,2).size,2);assert.equal(JSON.stringify(s),before);});
test('ramp waits to be fired and respects delay',()=>{const s=fieldStudies().scenes[0];const l={id:'ramp',enabled:true,target:'field.size',type:'ramp',wave:'sine',min:.5,max:2,rate:.1,phase:0,blend:'replace',duration:2,delay:1,loop:'once',firedAt:null};s.automation.push(l);assert.equal(evaluateParameters(s,3).size,2.8);l.firedAt=3;assert.equal(evaluateParameters(s,3.5).size,2.8);assert.equal(evaluateParameters(s,6).size,2);});
test('arrangement preserves identities, sequence and tint',()=>{const s=sevenCentres().scenes[0],before=clone(s.entities);arrange(s.entities,'ring');s.entities.forEach((e,i)=>{assert.equal(e.id,before[i].id);assert.deepEqual(e.sequence,before[i].sequence);assert.equal(e.tint,before[i].tint);});});
test('focus order is independent of spatial coordinates',()=>{const s=sevenCentres().scenes[1];const before=s.entities.map(e=>clone(e.position));assert.equal(focusAt(s,.1).entity.id,s.entities[0].id);assert.equal(focusAt(s,4.1).entity.id,s.entities[1].id);assert.deepEqual(s.entities.map(e=>e.position),before);});
test('phase evaluation is pure and bounded',()=>{const s=fieldStudies().scenes[0],before=JSON.stringify(s);for(const law of ['theta','product','sum','beat']){s.morph.law=law;const p=phases(s,2.2);assert.ok(p.drive>=0&&p.drive<=1);}s.morph.law='theta';assert.equal(JSON.stringify(s),before);});
test('unknown production snapshots are rejected without silent migration',()=>{assert.throws(()=>validateJourney({schemaVersion:4,entities:[]}),/schema-4/);});
test('HTML-bearing identifiers are rejected; text remains ordinary text',()=>{const j=fieldStudies();j.scenes[0].entities[0].id='bad\" onmouseover=\"';assert.throws(()=>validateJourney(j),/entity/);const k=fieldStudies();k.scenes[0].text.push({id:'words',visible:true,kicker:'',title:'',italic:'',body:'',x:.1,y:.2,width:240,size:36,align:'left'});k.scenes[0].text[0].title='<script>alert(1)</script>';assert.equal(validateJourney(k).scenes[0].text[0].title,k.scenes[0].text[0].title);});
test('invalid numbers, duplicate scene IDs and excessive counts fail closed',()=>{const j=fieldStudies();j.scenes[0].entities[0].position.x=NaN;assert.throws(()=>validateJourney(j),/transform|Non-finite/);const a=fieldStudies();a.scenes[1].id=a.scenes[0].id;assert.throws(()=>validateJourney(a),/scene/);const b=fieldStudies();b.scenes[0].entities=Array.from({length:33},()=>entity('x'));assert.throws(()=>validateJourney(b),/limits/);});
test('round-trip includes framing and optional text',()=>{const j=fieldStudies();j.scenes[0].view={mode:'3d',yaw:.4,pitch:.2,zoom:1.2,panX:.1,panY:-.1};j.scenes[0].text.push({id:'words',visible:false,kicker:'',title:'Optional words',italic:'',body:'',x:.1,y:.2,width:240,size:36,align:'left'});assert.deepEqual(validateJourney(JSON.parse(JSON.stringify(j))),j);});

test('focus-route reordering skips interleaved pins and preserves spatial positions',()=>{const a=entity('A'),b=entity('B'),p=pin({x:.2,y:.3,z:.4});const entities=[a,p,b];const positions=entities.map(e=>({...e.position}));assert.equal(reorderFocus(entities,b.id,-1),true);assert.deepEqual(entities.map(e=>e.id),[b.id,p.id,a.id]);assert.deepEqual(a.position,positions[0]);assert.deepEqual(p.position,positions[1]);assert.deepEqual(b.position,positions[2]);});

// Review-requested workspace contracts.
import {railPressed} from '../build/rail.js';
import {axisView,orbitBy} from '../build/orbitControl.js';
import {featuredExpressions,startingPoints,forkExpression} from '../build/expressions.js';
import {defaultWorkspace,validateWorkspace,moveBeltEntry,formationSummary,syncHeldState} from '../build/workspacePreferences.js';
import {PARAMETERS} from '../build/registry.js';
import {toNativeEntity,toNativeConfig} from '../build/nativeBridge.js';
import {nativeBinding,entityTargets} from '../build/nativeParameters.js';
import {paperStops} from '../build/paper.js';
test('ambient paper glow stays faint and fades monotonically without a cyan halo',()=>{
 const s=fieldStudies().scenes[0];s.engine.backgroundMode='ambientGlow';s.field.background='#09090b';s.field.palette=['#00f0ff','#ffe600'];s.field.params.native_backgroundGlowIntensity=.45;
 const stops=paperStops(s);assert.deepEqual(stops.map(s=>s.offset),[0,.58,1]);
 assert.deepEqual(stops[0].color,[8,38,42]);
 for(let i=1;i<stops.length;i++)for(let channel=0;channel<3;channel++)assert.ok(stops[i].color[channel]<=Math.max(stops[0].color[channel],9),JSON.stringify(stops));
 // A convex interpolation between opaque stops cannot create an intermediate colour peak.
 for(let i=1;i<stops.length;i++)for(let t=0;t<=1;t+=.01)for(let c=0;c<3;c++){
  const value=stops[i-1].color[c]*(1-t)+stops[i].color[c]*t;
  assert.ok(value<=Math.max(stops[i-1].color[c],stops[i].color[c])+1e-9);
 }
});
test('paper modes retain solid and vignette endpoints, including light paper',()=>{
 const s=fieldStudies().scenes[0];s.field.background='#ffffff';s.engine.backgroundMode='solid';assert.deepEqual(paperStops(s).map(s=>s.color),[[255,255,255],[255,255,255]]);
 s.engine.backgroundMode='vignette';assert.deepEqual(paperStops(s).at(-1).color,[224,224,224]);
 s.engine.backgroundMode='adaptive';assert.deepEqual(paperStops(s).map(s=>s.offset),[0,.4,.75,1]);
});
test('starter toolbelt resolves to real native field and entity controls',()=>{
 const prefs=defaultWorkspace(),scene=fieldStudies().scenes[0];
 for(const entry of prefs.entries)assert.ok(entry.scope==='field'?nativeBinding(entry.key):entityTargets(scene).find(t=>t.key===entry.key),entry.key);
 assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(prefs))),prefs);
});
test('toolbelt reordering retains identity and named bindings across serialization',()=>{
 const p=defaultWorkspace();p.entries.push({id:'named',key:'sequence.transition',scope:'named',entityId:'opening-o',sceneId:'study-0',journeyId:'field-studies'});
 const before=structuredClone(p.entries.at(-1));assert.equal(moveBeltEntry(p.entries,'named',-1),true);
 const restored=validateWorkspace(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(restored.entries.at(-2),before);assert.equal(moveBeltEntry(p.entries,'speed',-1),false);
});
test('invalid and future workspace preferences fail without accepting ambiguous targets',()=>{
 const p=defaultWorkspace();assert.throws(()=>validateWorkspace({...p,version:2}));
 assert.throws(()=>validateWorkspace({...p,entries:[p.entries[0],p.entries[0]]}));
 assert.throws(()=>validateWorkspace({...p,entries:[{id:'bad',key:'sequence.hold',scope:'named'}]}));
});
test('formation summary discloses states without merging independent entities',()=>{
 const s=fieldStudies().scenes[0],e=s.entities[0];assert.match(formationSummary(e),/single state/);
 e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'interval',text:'I'});e.sequence.manual=true;
 assert.equal(formationSummary(e),'O ↔ I · manual');e.sequence.enabled=true;assert.equal(formationSummary(e),'O → I · playing');
 assert.equal(s.entities.length,2);assert.equal(s.entities[1].text,'I');
});
test('editing a held glyph reaches the real native target without discarding its sequence',()=>{
 const e=entity('Held form');e.sequence.steps[0].text='A';syncHeldState(e,0);
 assert.equal(toNativeEntity(e).shape.text,'A');assert.equal(toNativeEntity(e).sequence.links[0].shape.text,'A');
 e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'second-state',text:'I'});syncHeldState(e,1);
 assert.equal(toNativeEntity(e).shape.text,'I');assert.equal(e.sequence.steps[0].text,'A');
 e.sequence.enabled=true;const n=toNativeEntity(e);assert.deepEqual(n.sequence.links.map(l=>l.shape.text),['A','I']);
});
test('cursor selection remains active alongside an independently toggled panel',()=>{assert.equal(railPressed('select','select','text',false),true);assert.equal(railPressed('text','select','text',false),true);assert.equal(railPressed('interact','select','text',false),false);assert.equal(railPressed('text','select','',false),false);assert.equal(railPressed('select','select','',false),true);assert.equal(railPressed('formation','interact','formation',false),true);assert.equal(railPressed('pin','interact','',true),true);});
test('camera axis views and orbit preserve construction plane and physical independence',()=>{const c=defaultCamera();c.plane='XZ';c.depth=.3;c.grid=true;c.snap=true;c.panX=20;c.zoom=1.2;for(const a of ['X','-X','Y','-Y','Z','-Z']){axisView(c,a);assert.equal(c.plane,'XZ');assert.equal(c.depth,.3);assert.equal(c.panX,20);assert.equal(c.zoom,1.2);}orbitBy(c,55,5);assert.ok(Math.abs(c.yaw)<=Math.PI);assert.equal(c.pitch,Math.PI/2);});
test('all material, composition and native starting modes are validated editable expressions',()=>{const modes=startingPoints();assert.equal(modes.filter(m=>m.group==='Material').length,8);assert.equal(modes.filter(m=>m.group==='Composition').length,5);assert.ok(modes.filter(m=>m.group==='Native').length>10);for(const m of modes){assert.deepEqual(validateJourney(m.expression),m.expression);assert.equal(m.expression.scenes.length,m.id==='source-twelve-faces'?12:1);const copy=forkExpression(m.expression);assert.notEqual(copy.id,m.expression.id);copy.scenes[0].name='Changed';assert.notEqual(m.expression.scenes[0].name,copy.scenes[0].name);}});
test('starter expressions and blank scenes contain no compulsory editorial text',()=>{for(const j of [...featuredExpressions(),blankJourney()])assert.ok(j.scenes.every(s=>s.text.length===0));});

const workflow=await import('../build/sceneWorkflow.js');
const panelLayout=await import('../build/panelResize.js');
const recents=await import('../build/recentWork.js');
test('explicit scene saves retain an independent configuration through edits and restoration',()=>{
 const j=blankJourney(),s=j.scenes[0];assert.equal(workflow.sceneSaveState(j,s),'Draft');
 workflow.saveScene(j,s,'  First light  ');assert.equal(s.name,'First light');assert.equal(workflow.sceneSaveState(j,s),'Saved');
 const original=s.field.params.recovery;s.field.params.recovery=original+1;
 assert.equal(workflow.sceneSaveState(j,s),'Edited since save');assert.equal(j.savedScenes[s.id].field.params.recovery,original);
 assert.ok(workflow.restoreScene(j,s.id));assert.equal(j.scenes[0].field.params.recovery,original);assert.equal(workflow.sceneSaveState(j,j.scenes[0]),'Saved');
 assert.throws(()=>workflow.saveScene(j,j.scenes[0],'   '));
});
test('next scene is a real independent draft with stable formation identities',()=>{
 const j=blankJourney(),s=j.scenes[0];s.entities.push(entity('O'));workflow.saveScene(j,s,'Origin');const next=workflow.nextSceneFrom(j,s);
 assert.notEqual(next.id,s.id);assert.equal(next.entities[0].id,s.entities[0].id);assert.equal(workflow.sceneSaveState(j,next),'Draft');
 next.entities[0].text='I';assert.equal(s.entities[0].text,'O');assert.equal(j.savedScenes[s.id].entities[0].text,'O');
 assert.deepEqual(workflow.savedSceneIndices(j),[0]);workflow.saveScene(j,next,'Interval');assert.deepEqual(workflow.savedSceneIndices(j),[0,1]);
 const roundtrip=validateJourney(JSON.parse(JSON.stringify(j)));assert.deepEqual(roundtrip.savedScenes,j.savedScenes);
});
test('legacy scene saves migrate once and corrupt checkpoints are rejected',()=>{
 const j=fieldStudies();delete j.savedScenes;workflow.initialiseSceneSaves(j);assert.equal(Object.keys(j.savedScenes).length,j.scenes.length);
 j.scenes[0].name='Edited';workflow.initialiseSceneSaves(j);assert.notEqual(j.savedScenes[j.scenes[0].id].name,'Edited');
 const broken=clone(j);broken.savedScenes[broken.scenes[0].id].duration=-1;assert.throws(()=>validateJourney(broken));
 const orphan=clone(j);orphan.scenes.shift();assert.throws(()=>validateJourney(orphan));
});
test('scene differences expose actual numeric parameter changes',()=>{const a=blankScene(),b=clone(a);b.field.params.recovery+=.5;b.name='Renamed';assert.deepEqual(workflow.sceneParameterChanges(a,b),[{path:'field.params.recovery',from:a.field.params.recovery,to:b.field.params.recovery}]);});
test('panel sizes clamp to the usable viewport',()=>{assert.deepEqual(panelLayout.panelSize(900,900,800,600),{width:776,height:460});assert.deepEqual(panelLayout.panelSize(100,100,1440,900),{width:220,height:180});});
test('recently opened work moves first without duplicates, missing entries are ignored',()=>{const a=blankJourney(),b=blankJourney();const ids=recents.recordRecent([a.id,'missing',b.id],b.id);assert.deepEqual(ids,[b.id,a.id,'missing']);assert.deepEqual(recents.recentJourneys([a,b],ids).map(j=>j.id),[b.id,a.id]);assert.deepEqual(recents.recordRecent(null,a.id),[a.id]);});

const tracks=await import('../build/propertyTracks.js');
const beltPicker=await import('../build/beltPicker.js');
test('scene-owned toolbelts copy, save, restore and round-trip independently',()=>{const j=blankJourney(),s=j.scenes[0];s.toolbelt=defaultWorkspace().entries;workflow.saveScene(j,s,'First');const next=workflow.nextSceneFrom(j,s);next.toolbelt.pop();assert.equal(s.toolbelt.length,6);assert.equal(next.toolbelt.length,5);workflow.saveScene(j,next,'Second');const loaded=validateJourney(JSON.parse(JSON.stringify(j)));assert.equal(loaded.savedScenes[next.id].toolbelt.length,5);loaded.scenes[1].toolbelt=[];workflow.restoreScene(loaded,next.id);assert.equal(loaded.scenes[1].toolbelt.length,5);});
test('property picker exposes real registry controls and distinguishes formation identities',()=>{const s=fieldStudies().scenes[0],items=beltPicker.beltCandidates(s);assert.equal(items.length,PARAMETERS.filter(p=>p.preview).length+entityTargets(s).length);assert.equal(new Set(items.map(i=>i.id)).size,items.length);for(const c of items.filter(c=>c.entry.scope==='field'))assert.ok(PARAMETERS.some(p=>p.key===c.entry.key));const pending=new Set(items.slice(0,3).map(i=>i.id));const html=beltPicker.pickerHTML(s,[],pending);assert.match(html,/3 selected/);assert.equal((html.match(/ checked/g)||[]).length,3);});
test('large scene toolbelts have no arbitrary 128-property cutoff',()=>{const prefs=defaultWorkspace();prefs.entries=Array.from({length:180},(_,i)=>({id:'control-'+i,key:'recovery',scope:'field'}));assert.equal(validateWorkspace(prefs).entries.length,180);});
test('recorded keyframes interpolate actual native parameters without mutating saved configuration',()=>{const s=fieldStudies().scenes[0],base=clone(s),track={id:'spring-take',bind:'field.params.recovery',points:[{time:2,value:1},{time:4,value:3}]};s.propertyTracks=[track];assert.equal(tracks.valueAt(track.points,1),undefined);assert.equal(tracks.valueAt(track.points,3),2);assert.equal(tracks.valueAt(track.points,8),3);const evaluated=tracks.evaluateTracks(s,3);assert.equal(evaluated.field.params.recovery,2);assert.equal(s.field.params.recovery,base.field.params.recovery);assert.equal(toNativeConfig(evaluated).fluid.returnSpeed,2);});
test('entity property tracks retain independent formation identity',()=>{const s=fieldStudies().scenes[0],first=s.entities[0],other=clone(s.entities[1]);s.propertyTracks=[{id:'move',entityId:first.id,bind:'entity.position.x',points:[{time:0,value:0},{time:2,value:1}]}];const evaluated=tracks.evaluateTracks(s,1);assert.equal(evaluated.entities[0].position.x,.5);assert.deepEqual(evaluated.entities[1],other);assert.notEqual(s.entities[0].position.x,.5);});
test('replacement and appended property takes preserve other tracks and out-of-range keys',()=>{const existing=[{id:'a',bind:'field.params.recovery',points:[{time:0,value:1},{time:2,value:2},{time:4,value:1}]},{id:'b',bind:'field.params.speed',points:[{time:0,value:1}]}];const take=[{id:'new',bind:'field.params.recovery',points:[{time:1,value:3},{time:3,value:4}]}];const merged=tracks.mergeTake(existing,take,1,3);assert.deepEqual(merged[0].points,[{time:0,value:1},{time:1,value:3},{time:3,value:4},{time:4,value:1}]);assert.deepEqual(merged[1],existing[1]);assert.equal(existing[0].points.length,3);const appended=tracks.mergeTake(merged,[{...take[0],points:[{time:5,value:5},{time:6,value:6}]}],5,6);assert.equal(appended[0].points.length,6);});
test('keyframe validation rejects unsafe paths, unordered and non-finite points',()=>{const t={id:'valid',bind:'field.params.recovery',points:[{time:0,value:1},{time:1,value:2}]};assert.deepEqual(tracks.validateTracks([t]),[t]);for(const invalid of [{...t,bind:'entity.__proto__.polluted'},{...t,points:[{time:1,value:1},{time:0,value:2}]},{...t,points:[{time:0,value:NaN}]}])assert.throws(()=>tracks.validateTracks([invalid]));const j=blankJourney();j.scenes[0].propertyTracks=[t];workflow.saveScene(j,j.scenes[0],'Take');assert.deepEqual(validateJourney(JSON.parse(JSON.stringify(j))).savedScenes[j.scenes[0].id].propertyTracks,[t]);});
test('expression clock sums scene lengths and resolves scene-local offsets',()=>{const j=fieldStudies();assert.deepEqual(tracks.expressionTiming(j,2,3),{start:28,total:112,time:31});});
test('recording captures native defaults even before a property has been edited',()=>{const s=fieldStudies().scenes[0];delete s.field.params.native_fluid__viscosity;const t={id:'default',bind:'field.params.native_fluid__viscosity',points:[{time:0,value:.8},{time:1,value:.9}]};assert.ok(Number.isFinite(tracks.readTrackValue(s,t)));s.propertyTracks=[t];assert.ok(Math.abs(toNativeConfig(tracks.evaluateTracks(s,.5)).fluid.viscosity-.85)<1e-8);});
test('recorded optional entity properties evaluate through the native adapter',()=>{const s=fieldStudies().scenes[0],e=s.entities[0];delete e.scale;const t={id:'scale',entityId:e.id,bind:'entity.scale',points:[{time:0,value:1},{time:2,value:2}]};assert.ok(Number.isFinite(tracks.readTrackValue(s,t)));s.propertyTracks=[t];assert.equal(tracks.evaluateTracks(s,1).entities[0].scale,1.5);assert.equal(toNativeConfig(tracks.evaluateTracks(s,1)).entities[0].scale,1.5);});
test('recording preserves a held value before a gesture instead of inventing a ramp',()=>{const t={id:'held',bind:'field.params.recovery',points:[]};tracks.sampleTrack(t,.05,1,0);tracks.sampleTrack(t,4,1,3.95);tracks.sampleTrack(t,4.05,2,4);assert.deepEqual(t.points,[{time:0,value:1},{time:4,value:1},{time:4.05,value:2}]);assert.equal(tracks.valueAt(t.points,3),1);assert.equal(tracks.valueAt(t.points,4.05),2);});
test('saved playback timing excludes drafts and uses saved durations',()=>{const j=blankJourney();workflow.saveScene(j,j.scenes[0],'One');j.scenes[0].duration=30;workflow.nextSceneFrom(j,j.scenes[0]);assert.deepEqual(tracks.expressionTiming(j,0,3,true),{start:0,total:12,time:3});});

test('semantic chakra starters use stable bindings rather than native station or chakra entity fields',()=>{
 const modes=startingPoints();
 for(const id of ['composition-chakra_body','composition-kundalini_focus','composition-chakra_cymatic']){
  const item=modes.find(v=>v.id===id);assert.ok(item,id);const scene=item.expression.scenes[0];
  assert.equal(scene.semanticField?.bindings.length,7,id+' semantic bindings');
  assert.equal(scene.semanticField?.profile.profileId,'chakra-seven-v1');
  const native=toNativeConfig(scene);assert.equal(native.semanticField?.bindings.length,7);
  assert.ok(native.entities.every(e=>e.stationIndex===undefined&&e.chakraId===undefined),'new semantic presets must not put chakra authority back on entities');
  if(id!=='composition-chakra_body')assert.equal(native.resonanceDrive?.kind,'semanticFocus');
 }
});

test('semantic bindings survive expression round-trip by stable entity identity',()=>{
 const source=startingPoints().find(v=>v.id==='composition-chakra_cymatic').expression;
 const round=validateJourney(JSON.parse(JSON.stringify(source)));const scene=round.scenes[0];
 assert.equal(scene.semanticField?.bindings.length,7);
 const ids=new Set(scene.entities.map(e=>e.id));
 for(const binding of scene.semanticField.bindings)for(const carrier of binding.carriers)if(carrier.kind==='entity')assert.ok(ids.has(carrier.id),carrier.id);
 const native=toNativeConfig(scene);assert.deepEqual(native.semanticField,scene.semanticField);assert.equal(native.resonanceDrive?.kind,'semanticFocus');
});
