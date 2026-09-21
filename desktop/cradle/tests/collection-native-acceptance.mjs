#!/usr/bin/env node
/** Run the production consumers against source-built Central + the real kernel.
 * Creates ONLY a uniquely named disposable ground. Does not connect to, change,
 * install into, or inspect a person's existing Central. No fake-provider fallback.
 * Node: --experimental-strip-types --import ./tests/ts-register.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readCollection} from '../src/expressions/collectionReadings.ts';
import {listFiles,readFile} from '../src/files/client.ts';
import {kernelOp} from '../src/kernel/bridge.ts';
import {nativeExpressionsProvider} from '../src/library/nativeExpressionsProvider.ts';
import {setNativeCollections,saveNativeCollectionMember,editManifestMembership} from '../src/library/collectionOperations.ts';
import {repositoryFiles,realManifests} from './collection-transport.mjs';

const ctrl=process.env.OI_CENTRAL_CTRL_BIN,bridgeBin=process.env.OI_COLLECTION_BRIDGE_BIN,oi=process.env.OI_BIN;
if(!ctrl||!path.isAbsolute(ctrl)||!bridgeBin||!path.isAbsolute(bridgeBin)||!oi||!path.isAbsolute(oi))throw new Error('Set absolute OI_BIN, OI_CENTRAL_CTRL_BIN and OI_COLLECTION_BRIDGE_BIN to the exact source-built executables. The kernel uses the native oi central route; no test double or installed-default fallback.');
const out=path.resolve(process.env.OI_COLLECTION_EVIDENCE??'tests/artifacts/collection-source');await fs.mkdir(out,{recursive:true});
const parent=await fs.mkdtemp(path.join(tmpdir(),'oi-collection-native-')),root=path.join(parent,'Central'),home=path.join(parent,'home');await fs.mkdir(root);await fs.mkdir(home);
const checks=[],corpora=[];let bridge,transport,bridgeLog='';
const env={...process.env,HOME:home,OI_HOME:home,OI_CENTRAL_ROOT:root,OI_BIN:oi,OI_CENTRAL_CTRL_BIN:ctrl,OI_CENTRAL_PROJECT_QUERY:'O-I'};
const sha=async p=>'sha256:'+createHash('sha256').update(await fs.readFile(p)).digest('hex');
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const provision=async(p,text)=>{const file=path.join(root,p);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);};
async function start(){
 bridge=spawn(bridgeBin,['127.0.0.1:0'],{env,stdio:['ignore','pipe','pipe']});bridge.stderr.on('data',b=>bridgeLog+=b);
 let output='';const url=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Native bridge did not publish its listening address')),15000);
  bridge.once('error',reject);bridge.once('exit',code=>reject(new Error('Native bridge exited '+code)));
  bridge.stdout.on('data',b=>{output+=b;bridgeLog+=b;const found=output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);if(found){clearTimeout(timer);resolve(found[1]);}});
 });transport={kind:'bridge',url};
}
async function stop(){const child=bridge;bridge=null;if(!child||child.exitCode!==null||child.signalCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
async function expression(request){const r=await kernelOp(transport,{op:'expression',request});assert.equal(r.error,undefined);assert.equal(r.outcome?.result,'expression');return r.outcome.data;}
try{
 const init=JSON.parse(execFileSync(ctrl,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000}));assert.equal(init.ok,true,JSON.stringify(init));
 await fs.mkdir(path.join(root,'Work/O-I'),{recursive:true});
 const project=JSON.parse(execFileSync(ctrl,['--root',root,'--json','action','run','projectcentral.init',JSON.stringify({project:'O-I',project_id:'collection-native-acceptance'})],{env,encoding:'utf8',timeout:30000}));assert.equal(project.ok,true,JSON.stringify(project));
 const files=await repositoryFiles();for(const [p,text] of files)await provision(p,text);
 await start();
 let firstMember;
 for(const name of realManifests){
  const manifestPath='Work/O-I/desktop/cradle/expressions-app/'+name;
  const r=await readCollection(transport,manifestPath,{fresh:true});assert.equal(r.status,'ready',JSON.stringify(r));assert.deepEqual(r.errors,[]);assert.equal(r.coverage.complete,true);
  const nativeDirectory=await listFiles(transport,manifestPath.slice(0,manifestPath.lastIndexOf('/')),true);
  for(const m of r.members){assert.equal(m.id,m.content.id);const p=manifestPath.slice(0,manifestPath.lastIndexOf('/'))+'/'+m.file;assert.deepEqual(m.content,JSON.parse(files.get(p)));assert.equal((await readFile(transport,m.location)).content,files.get(p));}
  firstMember??=r.members[0];corpora.push({manifest:manifestPath,manifestRevision:r.basis.revision,subjects:r.members.map(m=>({id:m.id,ref:m.location.ref,revision:m.source_revision})),directoryRef:nativeDirectory.location.ref});
 }
 check('every committed collection member matches its native source, content and revision (40 legacy + 9 essay/rooms + 43 E0 corpus + 112 Bimba coordinate lattice = 204)',corpora.reduce((n,c)=>n+c.subjects.length,0)===204);
 // Production native collection operation through Central file CAS. The real
 // authored manifest/member bytes above are not reduced to a toy schema.
 const name=realManifests[0],manifestPath='Work/O-I/desktop/cradle/expressions-app/'+name;
 let reading=await readCollection(transport,manifestPath,{readContents:false,fresh:true});const m=reading.members[1];
 const membership={manifest_path:manifestPath,manifest_location:reading.basis.location,manifest_revision:reading.basis.revision,member_id:m.id,slot:m.slot,file:m.file,group:m.group,title:m.name};
 const before=await readFile(transport,m.location);const result=await editManifestMembership(transport,membership,{kind:'rename',title:m.name+' · native readback'});
 check('manifest membership is saved and read back by actual Central',result.state==='saved');assert.deepEqual(await readFile(transport,m.location),before);
 await assert.rejects(editManifestMembership(transport,membership,{kind:'remove'}),/manifest changed/);check('stale manifest basis cannot overwrite the native source',true);
 const ref='expression:collection-native',entity=ref+':entity:source';
 await expression({operation:'create',expression_ref:ref,title:'Collection native roundtrip',actor:'human:collection-acceptance'});
 const composed=await expression({operation:'edit',expression_ref:ref,expected_revision:1,actor:'human:collection-acceptance',changes:[
  {change:'entity_add',scene_ref:ref+':scene:main',entity_ref:entity,title:firstMember.name},
  {change:'subject_bind',entity_ref:entity,binding:{subject_ref:firstMember.location.ref,native_owner:'central',presentation_role:'thing',sources:[{ref:firstMember.location.ref,revision:firstMember.source_revision,availability:'available'}],readings:[],actions:[]}},
  {change:'focus',scene_ref:ref+':scene:main',entity_ref:entity}
 ]});
 assert.equal(composed.state,'ready');
 // Provision an initial native file in the disposable test ground. This is
 // explicitly setup, not proof that the UI offers first-file creation.
 const docPath='Work/O-I/native.expression.json';await provision(docPath,JSON.stringify(composed.document));
 let dir=await listFiles(transport,'Work/O-I',true);const docLocation=dir.entries.find(e=>e.name==='native.expression.json').location;
 await expression({operation:'open_file',location:docLocation,actor:'human:collection-acceptance'});
 const edited=await setNativeCollections(transport,ref,2,['Native inquiry','Return']);assert.equal(edited.document.revision,3);
 const diskBefore=JSON.parse(await fs.readFile(path.join(root,docPath),'utf8'));check('live membership edit does not impersonate a source save',diskBefore.collections.length===0);
 await assert.rejects(setNativeCollections(transport,ref,2,['Stale overwrite']),/revision_conflict/);
 const saved=await saveNativeCollectionMember(transport,ref,3);check('Expression native save commits and verifies exact file revision',saved.dirty===false);
 const source=JSON.parse(await fs.readFile(path.join(root,docPath),'utf8'));assert.deepEqual(source.collections,['Native inquiry','Return']);assert.equal(source.entities[entity].subject.subject_ref,firstMember.location.ref);
 const index=await nativeExpressionsProvider(transport).list({scope:'local',mode:'techne',text:''},new AbortController().signal);assert.deepEqual(index.items.find(i=>i.ref===ref).nativeCollections,source.collections);
 check('native index joins collection labels to subject without reminting identity',true);
 // Concurrent writer changes the file after the binding was read.
 await setNativeCollections(transport,ref,3,['Pending source save']);await fs.appendFile(path.join(root,docPath),'\n');
 await assert.rejects(saveNativeCollectionMember(transport,ref,4),/file_revision_conflict/);check('concurrent source write is not overwritten or retried',true);
 await stop();await start();
 const reopened=await expression({operation:'open_file',location:docLocation,actor:'human:collection-acceptance'});
 assert.equal(reopened.document.revision,3);assert.deepEqual(reopened.document.collections,['Native inquiry','Return']);assert.equal(reopened.document.selection.entity_ref,entity);assert.equal(reopened.dynamic_state,'not_restored');
 check('restart reopens the saved source, exact selection and subjects, without claiming particle checkpoint',true);
 const sourceReturn=await readFile(transport,firstMember.location);assert.equal(sourceReturn.revision,firstMember.source_revision);
 check('exact source return still resolves after reopening',true);
 await fs.writeFile(path.join(out,'native.json'),JSON.stringify({standing:'source-built-native-disposable-ground',oi_source:process.env.OI_SOURCE_SHA??null,central_source:process.env.CENTRAL_SOURCE_SHA??null,binaries:{oi:await sha(oi),ctrl:await sha(ctrl),kernel:await sha(bridgeBin)},platform:process.platform,checks,corpora,installed:false,mac_interaction:false,real_model:false,microphone:false},null,2));
 console.log(JSON.stringify({standing:'source-built-native',checks,corpusSubjects:corpora.reduce((n,c)=>n+c.subjects.length,0)},null,2));
}catch(error){await fs.writeFile(path.join(out,'native-failure.json'),JSON.stringify({checks,corpora,error:String(error),stack:error.stack},null,2));throw error;}
finally{await stop();await fs.writeFile(path.join(out,'native-bridge.log'),bridgeLog);await fs.rm(parent,{recursive:true,force:true});}
