/** Real Central disclosure, Wiki persistence, kernel Action and editor recovery.
 * Test material is authored only in a new disposable native World. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,rm,realpath,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRegister,invoke} from '../src/knowledge/construction.ts';
import {readParticipationEvidence} from '../src/knowledge/participationEvidence.ts';
import {readFactsBasis,factsKey,prepareFacts,saveFacts,inspectFacts,restoreFactsCheckpoints} from '../src/knowledge/wikiFacts.ts';

test('node and whole facts cross the real Action, preserve scope and recover exact pending intent',{
 skip:process.env.OI_NATIVE_WIKI_FACTS!=='1',timeout:120000,
},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const retained=process.env.OI_NATIVE_WIKI_FACTS_DIR;
 const scratch=retained??await mkdtemp(join(tmpdir(),'oi-wiki-facts-'));
 if(retained)await mkdir(scratch); // Never overwrite prior native evidence.
 const root=join(await realpath(scratch),'Central'),home=join(scratch,'oi-home');
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 const native=(binary,args,input)=>{const reply=JSON.parse(execFileSync(binary,args,{env,input:input===undefined?undefined:JSON.stringify(input),encoding:'utf8',timeout:30000}));assert.equal(reply.ok,true,JSON.stringify(reply));return reply.data;};
 const central=(action,input)=>native(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run',action,'-'],input);
 const aikit=(args,input)=>native(env.OI_AIKIT_BIN,['--json','-C',root,...args],input);
 let child,stderr='';
 try{
  await mkdir(root);await mkdir(home);central('central.init',{});await mkdir(join(root,'TestMaterial'));
  const parent=central('central.files.list',{path:'TestMaterial'}).location;
  central('central.files.create',{parent,name:'observations.txt',content:'Synthetic authoring proof: a reported occurrence in 2024, an approximate place, and a whole spanning 1900–1950. No historical claim.',expected_absent:true,operation_ref:'operation:facts-evidence',actor:'human:verification',actor_kind:'human'});
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/\S+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url},initial=await readRegister(transport),evidence=await readParticipationEvidence(transport,'TestMaterial/observations.txt');
  const wikiFile=join(root,initial.file.location.path),nodeRef='wiki:node:facts-proof',wholeRef='wiki:frame:facts-proof';
  aikit(['wiki','node','create',nodeRef,'--file',wikiFile,'--stdin'],{profile:'okf-wiki/v1',object:'node',ref:nodeRef,revision:1,type:'TestObservation',title:'Authored facts proof',space_refs:[initial.spaces[0].ref],source_refs:[evidence.source_ref],tags:['synthetic-test'],provenance:[{source_ref:evidence.source_ref,source_revision:evidence.revision}]});
  let register=await readRegister(transport);
  const create={schema:'aikit.constellation-action/v1',frame_ref:wholeRef,expected_revision:0,actor_ref:'human:verification',operation_ref:'operation:facts-whole-create',changes:[{change:'create',anchor_ref:'wiki:anchor:facts-proof',title:'Facts whole proof',inquiry:{question:'Are node, whole and participation facts kept distinct?'},space_refs:[register.spaces[0].ref],frame:null},...['first','second'].map(name=>({change:'member_add',member:{subject_ref:nodeRef,participation:{participation_ref:'participation:facts-'+name,role_ref:null,sources:[],note:name}}}))]};
  await invoke(transport,undefined,'aikit.constellation.apply',wholeRef,{location:register.file.location,expected_file_revision:register.file.revision,request:create,sources:[]});
  register=await readRegister(transport);
  const temporal=[{kind:'occurrence',instant:'2024-01-02T03:04:05Z',precision:'minute',source_ref:evidence.source_ref}],places=[{place_ref:'wiki:place:facts-proof',precision:'approximate',uncertainty:'The witness describes a wider area.',source_ref:evidence.source_ref}];
  const checkpoint={basis:readFactsBasis(register,nodeRef),draft:{temporal,places,facet_sources:[evidence]}};
  checkpoint.pending=prepareFacts(checkpoint);
  const originalIntent=structuredClone(checkpoint.pending),key=factsKey(checkpoint.basis.target);
  const recovered=restoreFactsCheckpoints(JSON.parse(JSON.stringify({[key]:checkpoint})))[key];
  assert.deepEqual(recovered.pending,originalIntent);
  const saved=await saveFacts(transport,undefined,recovered);assert.equal(saved.revision,2);assert.deepEqual(saved.values,{temporal,places});
  assert.deepEqual(recovered.pending,originalIntent,'save does not discard the caller’s retained operation');
  const reopened=aikit(['wiki-construct','facts-inspect',nodeRef,'--file',wikiFile]);assert.equal(reopened.reading.object.revision,2);assert.deepEqual(reopened.reading.object['aikit.techne-facet/v1'].spatial,places);assert.deepEqual(reopened.reading.object.tags,['synthetic-test']);
  register=await readRegister(transport);const frame=register.frames.find(row=>row.ref===wholeRef);
  assert.equal(frame['aikit.techne-facet/v1'],undefined);for(const member of frame.constellations[0].members)assert.equal(member['aikit.techne-facet/v1'],undefined);
  const whole={basis:readFactsBasis(register,wholeRef),draft:{temporal:[{kind:'valid',interval:{from:'1900-01-01T00:00:00Z',to:'1950-01-01T00:00:00Z'},source_ref:evidence.source_ref}],places:[],facet_sources:[evidence]}};whole.pending=prepareFacts(whole);
  await saveFacts(transport,undefined,whole);assert.deepEqual((await inspectFacts(transport,undefined,nodeRef)).values,{temporal,places});
  const after=await readFile(wikiFile,'utf8');
  assert.deepEqual(await saveFacts(transport,undefined,recovered),saved,'lost acknowledgement is recovered by native operation identity');assert.equal(await readFile(wikiFile,'utf8'),after);
  const changedIntent=structuredClone(recovered);changedIntent.pending.changes=changedIntent.pending.changes.filter(change=>change.change==='temporal_set');
  await assert.rejects(saveFacts(transport,undefined,changedIntent),/operation identity|different content|reused/,'matching final facts must not bypass the native operation digest');assert.equal(await readFile(wikiFile,'utf8'),after);assert.ok(changedIntent.pending);
  const stale=structuredClone(recovered);stale.pending.operation_ref='operation:facts-stale';await assert.rejects(saveFacts(transport,undefined,stale),/changed since these inputs/);assert.equal(await readFile(wikiFile,'utf8'),after);assert.equal(stale.pending.operation_ref,'operation:facts-stale');
  register=await readRegister(transport);
  const clear={basis:readFactsBasis(register,nodeRef),draft:{temporal:[],places,facet_sources:[evidence]}};clear.pending=prepareFacts(clear);await saveFacts(transport,undefined,clear);
  assert.deepEqual((await inspectFacts(transport,undefined,nodeRef)).values,{temporal:[],places});
  const bad={basis:await inspectFacts(transport,undefined,nodeRef),draft:{temporal,places,facet_sources:[{...evidence,revision:'stale'}]}};bad.pending=prepareFacts(bad);const beforeRefusal=await readFile(wikiFile,'utf8');await assert.rejects(saveFacts(transport,undefined,bad),/evidence file changed/);assert.equal(await readFile(wikiFile,'utf8'),beforeRefusal);
  register=await readRegister(transport);
  await assert.rejects(invoke(transport,undefined,'aikit.wiki.facts.apply',register.source_ref,{location:register.file.location,expected_file_revision:register.file.revision,request:bad.pending,sources:[]}),/identity disagree/);
  central('central.files.write',{location:evidence.location,expected_revision:evidence.revision,content:'Synthetic evidence revised after the acknowledged save.',actor:'human:verification',actor_kind:'human'});
  await assert.rejects(saveFacts(transport,undefined,whole),/evidence file changed/,'a recorded write cannot silently confirm an obsolete evidence basis');assert.ok(whole.pending);assert.equal(await readFile(wikiFile,'utf8'),beforeRefusal);
  const proof={state:'verified',node_ref:nodeRef,whole_ref:wholeRef,node_and_whole_independent:true,participations_unchanged:true,uncertainty_retained:true,pending_recovered:true,stale_object_and_source_refused:true,changed_operation_refused:true,obsolete_saved_basis_retained:true,independent_cli_reopen:true};
  if(retained)await writeFile(join(scratch,'native-facts-proof.json'),JSON.stringify({...proof,environment:Object.fromEntries(['CENTRAL_ROOT','OI_CENTRAL_ROOT','OI_HOME','AIKIT_HOME','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'].map(key=>[key,env[key]]))},null,2)+'\n');
  console.log(JSON.stringify(proof));
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}if(!retained)await rm(scratch,{recursive:true,force:true});}
});
