/** Explicitly authored synthetic test material in a new native World.
 * No personal wiki writes, substituted owner replies, RC database, or inferred
 * historical/cultural assertions. Run with the pinned native owner binaries. */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile,appendFile,realpath,copyFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {readRegister,decodeRegister} from '../src/knowledge/construction.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {kernelOp} from '../src/kernel/bridge.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {readWikiSceneTechne} from '../src/techne/wikiReadingProvider.ts';

for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN','OI_TIMELINE_STRESS_DIR'])assert.ok(process.env[key],`${key} must explicitly name the native candidate/output`);
const scratch=process.env.OI_TIMELINE_STRESS_DIR;assert.ok(isAbsolute(scratch),'output must be absolute');
const profileOnly=process.env.OI_TIMELINE_STRESS_PROFILE_ONLY==='1';
if(profileOnly)assert.ok((await stat(scratch)).isDirectory());else await mkdir(scratch); // Only explicit profile replay may reuse already admitted source.
const rootPath=join(scratch,'Central');await mkdir(rootPath,{recursive:profileOnly});const root=await realpath(rootPath);
const env={...process.env,OI_HOME:join(scratch,'oi-home'),AIKIT_HOME:join(scratch,'aikit-home'),CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:''};
await mkdir(env.OI_HOME,{recursive:profileOnly});await mkdir(env.AIKIT_HOME,{recursive:profileOnly});
let binaries={},snapshotStartedAt=new Date().toISOString();
const snapshotPath=join(scratch,'native-binary-snapshot.json');
let previousSnapshot;
try{previousSnapshot=JSON.parse(await readFile(snapshotPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(previousSnapshot){
 assert.ok(profileOnly,'only an explicit profile replay may reuse pinned native binaries');
 binaries=previousSnapshot.binaries;snapshotStartedAt=previousSnapshot.snapshot_started_at;
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN']){const pin=binaries[key];assert.ok(pin&&pin.path.startsWith(join(scratch,'native-binaries')+'/'));assert.equal(createHash('sha256').update(await readFile(pin.path)).digest('hex'),pin.sha256,'pinned native executable changed');env[key]=pin.path;}
}else{
 await mkdir(join(scratch,'native-binaries'));
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN']){const original=env[key],pinned=join(scratch,'native-binaries',basename(original));await copyFile(original,pinned,constants.COPYFILE_FICLONE);env[key]=pinned;binaries[key]={original,path:pinned,sha256:createHash('sha256').update(await readFile(pinned)).digest('hex')};}
 await writeFile(snapshotPath,JSON.stringify({snapshot_started_at:snapshotStartedAt,binaries},null,2)+'\n');
}
const timings=[],transcript=join(scratch,'native-commands.ndjson');let child,stderr='';
async function measured(label,fn){const started=performance.now();try{const value=await fn();timings.push({label,elapsed_ms:Math.round((performance.now()-started)*1000)/1000,state:'ok'});return value;}catch(error){timings.push({label,elapsed_ms:Math.round((performance.now()-started)*1000)/1000,state:'failed',error:String(error)});throw error;}}
async function native(binary,args,input,label){return measured(label,async()=>{const result=spawnSync(binary,args,{env,input:input===undefined?undefined:JSON.stringify(input),encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});let reply;try{reply=JSON.parse(result.stdout);}catch{throw Error(`${label}: native exit ${result.status}: ${result.error??result.stderr??result.stdout}`);}await appendFile(transcript,JSON.stringify({label,args,exit_code:result.status,ok:reply.ok,receipt:reply})+'\n');assert.equal(result.status,0,JSON.stringify(reply));assert.equal(reply.ok,true,JSON.stringify(reply));return reply.data;});}
const central=(action,input)=>native(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run',action,'-'],input,action);
const count=192,frameRef='wiki:frame:synthetic-timeline-stress',actor='human:commissioned-synthetic-test-data';
const categories=['test-observation','test-process','test-operator','test-artifact','test-location','test-receipt'];
const sparse=[1,10,100,250,500,750,1000,1200,1400,1500,1700,1800,1900,1950,2100,3000,5000,7500,9998,9999];
const instant=(year,day=1)=>`${String(year).padStart(4,'0')}-01-${String(day).padStart(2,'0')}T12:00:00Z`;
function dateFor(i){if(i<32)return instant(sparse[i%sparse.length]);const cluster=[1600,1850,2000,2020][Math.floor((i-32)/40)];return instant(cluster,1+(i%20));}
const nodes=Array.from({length:count},(_,i)=>{const date=dateFor(i),category=categories[i%categories.length],ref=`wiki:node:synthetic-timeline-${String(i).padStart(3,'0')}`;return {ref,date,category,title:`TEST ${String(i).padStart(3,'0')} · ${category.slice(5)} · ${date.slice(0,10)}`,participation:`participation:synthetic-timeline:${i}`};});
try{
 if(!profileOnly){await central('central.init',{});await mkdir(join(root,'TestMaterial'));}
 const parent=(await central('central.files.list',{path:'TestMaterial'})).location;
 const source=profileOnly?await (async()=>{const listing=await central('central.files.list',{path:'TestMaterial'}),location=listing.entries.find(row=>row.name==='README-synthetic-timeline.txt')?.location;assert.ok(location);const current=await central('central.files.read',{location});assert.ok(current.content.startsWith('SYNTHETIC TEST DATA.'));return {current,location,revision:current.revision};})():await central('central.files.create',{parent,name:'README-synthetic-timeline.txt',content:'SYNTHETIC TEST DATA. These dates, categories, locations and relations are deterministic stress-test inputs explicitly commissioned for UI performance testing. They are not historical or cultural claims. Nodes, temporal facts, source tags, relations and places belong to native Wiki/constellation owners; Scene is only composition. Do not promote into personal knowledge.\n',expected_absent:true,operation_ref:'synthetic-timeline:source:first-save',actor,actor_kind:'human'});
 const sourceRef=source.current.source?.source_ref??source.location.ref,sourceRevision=source.revision;
 child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>{stderr+=chunk;});
 const url=await new Promise((yes,no)=>{let stdout='';const timer=setTimeout(()=>no(Error('Native bridge startup exceeded30s: '+stderr)),30000);child.once('error',error=>{clearTimeout(timer);no(error);});child.once('exit',code=>{clearTimeout(timer);no(Error('Bridge exited '+code+': '+stderr));});child.stdout.on('data',chunk=>{stdout+=chunk;const match=/listening on (http:\/\/\S+)/.exec(stdout);if(match){clearTimeout(timer);yes(match[1]);}});});
 const transport={kind:'bridge',url};const before=await measured('native-register-initial',()=>readRegister(transport)),space=before.spaces[0].ref,wikiFile=join(root,before.file.location.path);
 if(!profileOnly)for(const [i,node] of nodes.entries()){
  const body={profile:'okf-wiki/v1',object:'node',ref:node.ref,revision:1,type:node.category,title:node.title,space_refs:[space],source_refs:[sourceRef],provenance:[{source_ref:sourceRef,source_revision:sourceRevision}],tags:['synthetic-test',node.category,i<32?'sparse-era':`dense-${node.date.slice(0,4)}`],
   'aikit.techne-facet/v1':{contract:'aikit.techne-facet/v1',temporal:[{facet_ref:`wiki:temporal:synthetic-node-${i}`,kind:i%5===0?'valid':'occurrence',...(i%5===0?{interval:{from:node.date,to:instant(Math.min(9999,Number(node.date.slice(0,4))+1)),from_precision:'day',to_precision:'year'}}:{instant:node.date,precision:i<32?'year':'day'}),source_ref:sourceRef,uncertainty:'Explicit synthetic performance-test input'}]}};
  await native(env.OI_AIKIT_BIN,['--json','-C',root,'wiki','node','create',node.ref,'--file',wikiFile,'--stdin'],body,`native-node-${i}`);
  if((i+1)%32===0)console.log(`Native synthetic nodes admitted: ${i+1}/${count}`);
 }
 const changes=[{change:'create',anchor_ref:'wiki:anchor:synthetic-timeline',title:'SYNTHETIC Timeline stress — 192 subjects',inquiry:{question:'How does the real Timeline handle sparse eras, dense dates, source categories and exact native relations?',purpose:'Explicit UI load test, never a historical claim'},space_refs:[space],frame:null},...nodes.map(node=>({change:'member_add',member:{subject_ref:node.ref,participation:{participation_ref:node.participation,role_ref:null,sources:[],note:node.title}}}))];
 for(let i=0;i<128;i++)changes.push({change:'relation_put',relation:{relation_ref:`wiki:edge:synthetic-timeline-${i}`,expected_revision:null,from_participation_ref:nodes[i].participation,to_participation_ref:nodes[(i+17)%count].participation,relation:['test:precedes','test:co-occurs','test:contrasts','test:archetype-reference'][i%4],direction:['directed','undirected','bidirectional'][i%3],standing:'asserted',evidence:[{source_ref:sourceRef,source_revision:sourceRevision}],temporal:[{facet_ref:`wiki:temporal:synthetic-edge-${i}`,kind:i%2?'receipt':'occurrence',instant:nodes[i].date,precision:i<32?'year':'day',source_ref:sourceRef,uncertainty:'Explicit synthetic relation timing'}]}});
 for(let i=0;i<32;i++)changes.push({change:'place_set',participation_ref:nodes[i].participation,places:[{place_ref:`wiki:place:synthetic-${i}`,identity:{names:[{name:`TEST coordinate ${i}`} ]},geometry:{type:'point',coordinates:[-160+(i%8)*40,-60+Math.floor(i/8)*40]},precision:i%2?'approximate':'exact',source_ref:sourceRef}]});
 let revision=0;
 if(!profileOnly)for(let offset=0;offset<changes.length;offset+=200){const basis=await central('central.files.read',{location:before.file.location});const applied=await native(env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct','apply','--file',wikiFile],{basis_content:basis.content,request:{schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:revision,actor_ref:actor,operation_ref:`operation:synthetic-timeline:${offset}`,changes:changes.slice(offset,offset+200)}},`native-construction-${offset}`);const fresh=await central('central.files.read',{location:before.file.location});revision=decodeRegister(fresh,before.source_ref).frames.find(f=>f.ref===frameRef).revision;assert.ok(applied);}
 const fresh=await central('central.files.read',{location:before.file.location}),register=decodeRegister(fresh,before.source_ref),frame=register.frames.find(row=>row.ref===frameRef);
 const raw=JSON.parse(fresh.content),objects=Array.isArray(raw)?raw:raw.objects;assert.equal(nodes.filter(node=>objects.some(row=>row.ref===node.ref&&row.tags?.includes('synthetic-test'))).length,count);
 const opened=await measured('native-scene-construction',()=>projectConstruction(transport,undefined,frame,register.relations,register));assert.equal(opened.state,'ready',JSON.stringify(opened));
 const document=opened.document,scene=document.scenes.find(row=>row.scene_ref===document.selection.scene_ref);assert.equal(scene.entity_refs.length,count);assert.equal(Object.keys(document.relations).length,128);assert.ok(Buffer.byteLength(JSON.stringify(document))<=512*1024);
 const saved=await kernelOp(transport,{op:'expression',request:{operation:'save_as',expression_ref:document.expression_ref,expected_revision:document.revision,parent,name:'synthetic-timeline-stress.expression.json',operation_ref:'synthetic-timeline:expression:first-save',actor,actor_kind:'human'}});assert.equal(saved.error,undefined,JSON.stringify(saved));assert.equal(saved.outcome?.result,'expression');assert.equal(saved.outcome.data.state,'saved',JSON.stringify(saved));
 publishWikiNativeRegisters([]);
 const request={expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref};
 const reading=await measured('native-scene-techne-reading',()=>readWikiSceneTechne(transport,request));assert.equal(reading.temporal.length,320);assert.equal(reading.spatial.length,32);
 const sourceBefore=await readFile(wikiFile);
 const compiled=await build({stdin:{contents:"export {readingInstruments,nativeInstrumentTitles} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../expressions-app/field-studies-journeys/tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')),conversion=api.kernelDocumentToJourney(document);
 const instruments=await measured('real-instrument-projection',()=>api.readingInstruments(reading,api.nativeInstrumentTitles(conversion,conversion.startSceneId)));
 const walk=await measured('real-timeline-walk-wide',()=>instruments.timeline.getTimelineWalk(scene.scene_ref,{startYear:1,endYear:9999}));assert.equal(walk.earthboundNodes.length,320);
 const dense=await measured('real-timeline-walk-dense',()=>instruments.timeline.getTimelineWalk(scene.scene_ref,{startYear:1999,endYear:2001}));assert.ok(dense.earthboundNodes.length>=40);
 assert.deepEqual(await readFile(wikiFile),sourceBefore,'reading/profile never changes native source');
 const result={schema:'oi.synthetic-timeline-stress/v1',synthetic:true,snapshot_started_at:snapshotStartedAt,environment:envKeys(),binaries,source_path:wikiFile,source_ref:sourceRef,frame_ref:frameRef,expression_ref:document.expression_ref,scene_ref:scene.scene_ref,revision:document.revision,saved:saved.outcome.data,counts:{native_subjects:count,native_categories:6,native_relations:128,native_places:32,timeline_anchors:walk.earthboundNodes.length,dense_2000_anchors:dense.earthboundNodes.length,document_bytes:Buffer.byteLength(JSON.stringify(document))},timings,limits:{scene_members:256,document_bytes:512*1024,construction_changes_per_request:256,used_changes_per_request:200},boundaries:['Synthetic data only; no factual history/culture claims.','Dates are verified four-digit CE RFC3339; BCE is not claimed.','Native source tags and archetype-reference relations are retained, but current adapter does not expose tag filtering or archetypal lighting from these declarations.','Native load and projection timings are measured here; actual desktop draw/LOD timing remains for native app profiling.'],reading,document};
 await writeFile(join(scratch,'native-stress-proof.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({state:'prepared',artifact:join(scratch,'native-stress-proof.json'),counts:result.counts,timings:timings.filter(row=>!row.label.startsWith('native-node-'))},null,2));
 function envKeys(){return Object.fromEntries(['OI_HOME','AIKIT_HOME','CENTRAL_ROOT','OI_CENTRAL_ROOT','OI_CENTRAL_PROJECT_QUERY','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'].map(key=>[key,env[key]]));}
}catch(error){await writeFile(join(scratch,profileOnly?'profile-failure.json':'failure.json'),JSON.stringify({error:String(error),timings,stderr},null,2)+'\n');throw error;}
finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}}
