#!/usr/bin/env node
/** Real retained native owner receipts -> actual Epi reception module.
 * Explicit qualified inputs; no authored positive document, native mock,
 * bridge mutation, GPU substitute or successful skip. See placement contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pin=p=>({path:path.resolve(p),sha256:digest(fs.readFileSync(p))});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const equal=(a,b)=>assert.deepEqual(a,b);
function qualified(input,role){
 assert.equal(typeof input?.path,'string',role+' requires actual input path');
 assert.match(input.sha256,/^[0-9a-f]{64}$/,role+' requires independently supplied source SHA256');
 const actual=pin(input.path);assert.equal(actual.sha256,input.sha256,role+' changed since qualification');return actual;
}
function pointer(value,p){
 assert.equal(typeof p,'string','Explicit JSON pointer required');
 if(p==='')return value;assert.ok(p.startsWith('/'),'JSON pointer must start with /');
 for(const part of p.slice(1).split('/')){const key=part.replaceAll('~1','/').replaceAll('~0','~');assert.ok(value!==null&&typeof value==='object'&&Object.hasOwn(value,key),'Missing actual native pointer '+p);value=value[key];}
 return value;
}
const stamp=()=>new Date().toISOString();
const argv=process.argv.slice(2);assert.equal(argv.length,2,'Use --config <qualified-inputs.json>');assert.equal(argv[0],'--config');
const configPath=path.resolve(argv[1]),cfg=read(configPath),out=path.resolve(cfg.output_dir);
assert.equal(cfg.schema,'oi.epi-held-reception-regression-config/v1');
assert.ok(!fs.existsSync(path.join(out,'receipt.json')),'Retain previous proof; choose a new output directory');fs.mkdirSync(out,{recursive:true});
const receiptPath=path.join(out,'receipt.json');
const report={schema:'oi.epi-held-reception-native-regression/v1',started_utc:stamp(),passed:false,
 scope:'Actual retained native owner document/live reading -> actual source/module guard. No native process/bridge mutation, GPU pixels or admission side-effect proof, ordinary successor, installed/physical audio/source numerical readiness/H acceptance.',
 config:pin(configPath),driver:pin(fileURLToPath(import.meta.url)),inputs:[],checks:[],static_source_checks:[],independent_findings:[]};
try{
 const roles=['native_document','live_readback','semantic_expectations','bimba_content','production_source','app_source','native_field_source'];
 for(const role of roles)report.inputs.push({role,...qualified(cfg[role],role)});
 assert.equal(cfg.native_document.provenance,'retained-real-native-owner-operation');
 assert.equal(cfg.live_readback.provenance,'retained-real-native-owner-operation');
 const original=read(cfg.native_document.path),nativeCapture=read(cfg.live_readback.path);
 // Receipt success standing is required separately from the document pointer.
 assert.equal(pointer(original,cfg.native_document.success_pointer),true,'Native owner operation must have actually succeeded');
 const document=pointer(original,cfg.native_document.json_pointer),live=pointer(nativeCapture,cfg.live_readback.json_pointer);
 const e=read(cfg.semantic_expectations.path),content=read(cfg.bimba_content.path);
 assert.equal(e.schema,'oi.epi-held-reception-semantic-expectations/v1');
 assert.equal(e.standing,'independent-source-and-owner-receipt-expectations');
 assert.equal(content.source_revision,e.bimba_source_revision);
 const nodes=content.content.nodes;
 for(const c of [e.current_m3_coordinate,e.other_m3_coordinate,e.wrong_personal_coordinate])assert.ok(Object.hasOwn(nodes,c),'Independent native source coordinate absent: '+c);
 assert.ok(e.current_m3_coordinate.startsWith('M3-'));assert.ok(e.other_m3_coordinate.startsWith('M3-'));assert.notEqual(e.current_m3_coordinate,e.other_m3_coordinate);
 assert.equal(nodes[e.current_m3_coordinate].properties.c_1_name,e.current_m3_source_name);
 assert.equal(nodes[e.other_m3_coordinate].properties.c_1_name,e.other_m3_source_name);
 assert.equal(nodes[e.wrong_personal_coordinate].properties.c_1_name,e.wrong_personal_source_name);
 assert.equal(e.personal_locus,'ql:m-coordinate:bimba:M4.4.4.4','Canonical locus is a source contract');
 assert.equal(document.expression_ref,e.instance_ref);assert.equal(document.revision,e.document_revision);
 assert.equal(typeof cfg.esbuild_bin,'string');assert.equal(typeof cfg.node_modules,'string');
 const moduleEntry=path.join(out,'actual-production-exports.mjs'),moduleBundle=path.join(out,'actual-production.bundle.mjs'),metaFile=path.join(out,'metafile.json');
 fs.writeFileSync(moduleEntry,'export {readEpiWorldRecord,epiSceneReception,epiStationaryReception} from '+JSON.stringify(path.resolve(cfg.production_source.path))+';\n');
 const buildArgs=[moduleEntry,'--bundle','--platform=node','--format=esm','--outfile='+moduleBundle,'--metafile='+metaFile];
 const build=spawnSync(cfg.esbuild_bin,buildArgs,{encoding:'utf8',cwd:out,env:{...process.env,NODE_PATH:path.resolve(cfg.node_modules)}});
 fs.writeFileSync(path.join(out,'build.log'),String(build.stdout??'')+String(build.stderr??''));
 report.build={executable:pin(cfg.esbuild_bin),argv:buildArgs,exit_code:build.status,log:pin(path.join(out,'build.log'))};assert.equal(build.status,0,'Actual module compilation failed');
 report.build.bundle=pin(moduleBundle);report.build.metafile=pin(metaFile);
 report.compiled_inputs=[];
 const snapDir=path.join(out,'source-snapshots');fs.mkdirSync(snapDir,{recursive:true});
 for(const [i,f] of Object.keys(read(metaFile).inputs).entries()){
  const actual=path.resolve(out,f),copy=path.join(snapDir,String(i).padStart(3,'0')+'-'+path.basename(actual));
  fs.writeFileSync(copy,fs.readFileSync(actual));report.compiled_inputs.push({original:pin(actual),snapshot:pin(copy)});
 }
 for(const role of roles)qualified(cfg[role],role);
 const {readEpiWorldRecord,epiSceneReception,epiStationaryReception}=await import(pathToFileURL(moduleBundle).href);
 const base=structuredClone(document),record=readEpiWorldRecord(document);
 assert.ok(record?.native_readback,'Actual stored native act is required');
 assert.equal(record.world.instance_ref,e.instance_ref);assert.equal(record.person_ref,e.person_ref);
 assert.equal(record.world.event_ref,e.event_ref);assert.equal(record.world.snapshot_ref,e.snapshot_ref);
 assert.equal(record.receiving.personal.canonical_locus,e.personal_locus);
 assert.equal(record.source_basis.source_revision,e.bimba_source_revision);assert.equal(record.world.registers.source_revision,e.bimba_source_revision);
 for(const n of [record.native_readback,live]){
  assert.equal(n.schema,'ql.scene-source-reading/v1');assert.equal(n.event_ref,e.event_ref);assert.equal(n.subject_ref,e.person_ref);
  assert.equal(n.form_process.instance_ref,e.instance_ref);assert.equal(n.form_process.process_subject_ref,e.process_subject_ref);
  assert.equal(n.form_process.current_reading.ref,'ql:m-coordinate:bimba:'+e.current_m3_coordinate);
  assert.equal(n.form_process.current_reading.revision,e.bimba_source_revision);assert.equal(n.form_process.triplet,e.current_triplet);
  assert.equal(n.form_process.hexagram_glyph,e.current_hexagram_glyph);equal(n.continuous_clock.inscription,e.inscription_phase);equal(n.continuous_clock.lensing,e.lensing_phase);
 }
 const scene=document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref)?.presentation?.scene;assert.ok(scene,'Actual native cosmic Scene material required');
 const otherRef='ql:m-coordinate:bimba:'+e.other_m3_coordinate;
 function check(name,fn){const before=JSON.stringify(document),sceneBefore=JSON.stringify(scene);fn();assert.equal(JSON.stringify(document),before,'Helper mutated native owner input');assert.equal(JSON.stringify(scene),sceneBefore,'Helper mutated native Scene');report.checks.push({name,passed:true});}
 function refused(name,fn){check(name,()=>assert.throws(fn));}
 function mutateDoc(fn){const d=structuredClone(document),r=d.scenes.find(s=>s.presentation?.scene?.epiWorld)?.presentation.scene.epiWorld;assert.ok(r);fn(r,d);return d;}
 function mutation(name,fn){refused(name,()=>readEpiWorldRecord(mutateDoc(fn)));}
 check('Actual retained native record validates unchanged',()=>equal(record,scene.epiWorld));
 check('Actual live current readback emits exact four-body packet',()=>{const p=epiStationaryReception(scene,record,live,document);equal(p.entityIds,['clock-a-hand','clock-b-hand','current-form','current-form-hinge'].map(x=>e.instance_ref+':entity:world-'+x));assert.ok(p.sourceRevision.includes(JSON.stringify(live.continuous_clock)));});
 check('Transient live absence retains acknowledged native act',()=>{const saved=epiStationaryReception(scene,record,undefined,document),current=epiStationaryReception(scene,record,live,document);equal(saved.entityIds,current.entityIds);assert.ok(saved.sourceRevision.includes(JSON.stringify(record.native_readback.continuous_clock)));equal(epiSceneReception(scene,record,undefined).scene,epiSceneReception(scene,record,live).scene);});
 check('Independent expected native ClockA determinant produces authored target',()=>{const h=epiSceneReception(scene,record,undefined).scene.entities.find(x=>x.id===e.instance_ref+':entity:world-clock-a-hand');assert.ok(h);assert.equal(e.clock_a_xy.length,2);for(const [i,key] of ['x','y'].entries())assert.ok(Math.abs(h.position[key]-e.clock_a_xy[i])<1e-12,'Independently expected authored coordinate differs');});
 check('Same acknowledged act repeats same source key without mutation',()=>equal(epiStationaryReception(scene,record,undefined,document),epiStationaryReception(scene,record,undefined,document)));
 check('Immutable opening fallback is not a new stationary act',()=>{const d=mutateDoc(r=>{delete r.native_readback;delete r.continuation_start;}),r=readEpiWorldRecord(d);equal(epiStationaryReception(scene,r,undefined,d),undefined);});
 check('Personal scene receives no cosmic static ranges',()=>{const s=document.scenes.find(s=>s.scene_ref===e.instance_ref+':scene:personal')?.presentation?.scene;assert.ok(s);equal(epiStationaryReception(s,record,live,document),undefined);});
 mutation('Foreign process instance rejected',r=>r.native_readback.form_process.instance_ref=e.instance_ref+':foreign');
 mutation('Foreign stable process subject rejected',r=>r.native_readback.form_process.process_subject_ref=e.process_subject_ref+':foreign');
 mutation('Foreign readback event rejected',r=>r.native_readback.event_ref=e.event_ref+':foreign');
 mutation('Foreign readback person rejected',r=>r.native_readback.subject_ref=e.person_ref+':foreign');
 mutation('Foreign process event rejected',r=>r.native_readback.form_process.event_ref=e.event_ref+':foreign');
 mutation('Foreign process person rejected',r=>r.native_readback.form_process.subject_ref=e.person_ref+':foreign');
 mutation('Unavailable current source rejected',r=>r.native_readback.form_process.current_reading.availability='unavailable');
 mutation('Wrong M4 current source rejected',r=>r.native_readback.form_process.current_reading.ref=e.personal_locus);
 mutation('Stale current Bimba source rejected',r=>r.native_readback.form_process.current_reading.revision=e.bimba_source_revision+':stale');
 mutation('Retained continuation mismatch rejected',r=>r.continuation_start.tick12+=1);
 mutation('Missing retained continuation rejected',r=>delete r.continuation_start);
 mutation('Wrong canonical current-ref mirror rejected',r=>r.native_readback.form_process.reading.reading.ref=otherRef);
 mutation('Wrong current-ref mirror revision rejected',r=>r.native_readback.form_process.reading.reading.revision=e.bimba_source_revision+':stale');
 mutation('Unavailable current-ref mirror rejected',r=>r.native_readback.form_process.reading.reading.availability='unavailable');
 mutation('Missing current-ref mirror rejected',r=>delete r.native_readback.form_process.reading.reading);
 mutation('Wrong canonical current subject rejected',r=>r.native_readback.form_process.canonical_subject_ref=otherRef);
 mutation('Same title with wrong Personal-locus branch rejected',(r,d)=>{d.entities[r.receiving.personal.locus_entity_ref].subject.subject_ref='ql:m-coordinate:bimba:'+e.wrong_personal_coordinate;});
 refused('Missing current native owner document rejected',()=>epiStationaryReception(scene,record,live,undefined));
 refused('Stale local record versus actual owner rejected',()=>{const local=structuredClone(record);local.authored_revision+='-stale';epiStationaryReception(scene,local,live,document);});
 refused('New current owner record versus prior local act rejected',()=>{const d=mutateDoc(r=>r.authored_revision+='-new');epiStationaryReception(scene,record,live,d);});
 refused('Disabled receiving formation rejected before packet',()=>{const s=structuredClone(scene);s.entities.find(x=>x.id===e.instance_ref+':entity:world-clock-a-hand').enabled=false;epiStationaryReception(s,record,live,document);});
 refused('Missing receiving formation rejected before packet',()=>{const s=structuredClone(scene);s.entities=s.entities.filter(x=>x.id!==e.instance_ref+':entity:world-clock-a-hand');epiStationaryReception(s,record,live,document);});
 mutation('Current reading replaced with distinct same-source M3 subject rejected',r=>r.native_readback.form_process.current_reading.ref=otherRef);
 equal(document,base);assert.equal(report.checks.length,30);
 // Static source checks are separate. This is not execution of an ordinary
 // callback, frame invalidation, native event or GPU side effect.
 const app=fs.readFileSync(cfg.app_source.path,'utf8'),ui=fs.readFileSync(cfg.native_field_source.path,'utf8');
 assert.match(app,/import\s*\{installNativeField\}\s*from\s*["']\.\/nativeField["']/);
 assert.match(ui,/controller\.onChange\s*=\s*\(\)\s*=>\s*\{\s*update\(\);\s*onNativeChanged\?\.\(\);\s*\}/);
 assert.match(ui,/setInterval\(\(\)\s*=>\s*\{\s*void controller\.refreshSources\(\);\s*update\(\);\s*\},250\)/);
 assert.match(app,/installNativeField\(engine,\(\)\s*=>\s*\{fieldPaused=false;needsFrame=true;renderAll\(\);\},\(\)\s*=>\s*\{needsFrame=true;\}\)/);
 report.static_source_checks.push({name:'Exact local nativeField import, native-change callback invalidates held frame without Resume, timer polling refreshes panel only',standing:'static-source-check-only',passed:true});
 for(const role of roles)qualified(cfg[role],role);
 report.passed=true;
}catch(error){report.failure=String(error);report.stack=error?.stack;}
finally{report.finished_utc=stamp();fs.writeFileSync(receiptPath,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,static_source_checks:report.static_source_checks.length,receipt:pin(receiptPath)}));
if(!report.passed)process.exitCode=1;
