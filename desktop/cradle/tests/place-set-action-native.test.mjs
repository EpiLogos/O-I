/** Canonical PlaceSet through the actual O:I Action, Central source read and
 * native Wiki writer. All writes are inside a disposable World. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readRegister,invoke} from '../src/knowledge/construction.ts';
import {readFile as readNativeFile} from '../src/files/client.ts';

test('native PlaceSet Action admits one current source basis and refuses missing, ambiguous or stale evidence',{skip:process.env.OI_NATIVE_PLACE_SET_ACTION!=='1',timeout:120000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const scratch=await realpath(await mkdtemp(join(tmpdir(),'oi-place-set-action-'))),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 const central=(action,input)=>{const out=JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run',action,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(out.ok,true,JSON.stringify(out));return out.data;};
 try{
  await mkdir(root);await mkdir(home);central('central.init',{});await mkdir(join(root,'Work/PlaceProof'),{recursive:true});
  const parent=central('central.files.list',{path:'Work/PlaceProof'}).location;
  const admitted=central('central.files.create',{parent,name:'survey.txt',content:'Source declares point [-0.09,51.51].',expected_absent:true,operation_ref:'native:place-source',actor:'native-regression',actor_kind:'human'});
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url},source=await readNativeFile(transport,admitted.location),register=await readRegister(transport);
  const basis={source_ref:source.source?.source_ref??source.location.ref,revision:source.revision,location:source.location};
  const frameRef='wiki:frame:place-action',participation='participation:wiki:place-action';
  const request={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-place-action-regression',operation_ref:'operation:wiki:place-action-create',changes:[{change:'create',anchor_ref:'wiki:anchor:place-action',title:'Native PlaceSet Action',inquiry:{question:'Does canonical location metadata retain its verified source?'},space_refs:[register.spaces[0].ref],frame:null},{change:'member_add',member:{subject_ref:register.spaces[0].ref,participation:{participation_ref:participation,role_ref:null,sources:[],note:'Placed native participation'}}}]};
  const created=await invoke(transport,undefined,'aikit.constellation.apply',frameRef,{location:register.file.location,expected_file_revision:register.file.revision,request,sources:[]});assert.equal(created.persisted,true);
  let current=await readRegister(transport),frame=current.frames.find(row=>row.ref===frameRef);
  const place={place_ref:'wiki:place:action-proof',geometry:{type:'point',coordinates:[-0.09,51.51]},precision:'exact',source_ref:basis.source_ref};
  const proposal={...request,expected_revision:frame.revision,operation_ref:'operation:wiki:place-action-set',changes:[{change:'place_set',participation_ref:participation,places:[place]}]};
  const bytes=await readFile(join(root,current.file.location.path));
  const action=async(sources,submitted=proposal)=>{const response=await kernelOp(transport,{op:'invoke_action',invocation:{action:'aikit.constellation.apply',target_ref:frameRef,input:{location:current.file.location,expected_file_revision:current.file.revision,request:submitted,sources}}});assert.equal(response.error,undefined,response.error);assert.equal(response.outcome?.result,'action_dispatched');return response.outcome.dispatch;};
  for(const sources of [[],[basis,basis],[basis,{...basis,revision:'another-revision'}]]){
   const refused=await action(sources);assert.equal(refused.state,'owner_refused');assert.match(refused.message,/unique disclosed source basis/);assert.deepEqual(await readFile(join(root,current.file.location.path)),bytes,'basis refusal does not write Wiki');
  }
  const stale=await action([{...basis,revision:'stale-observed-revision'}]);assert.equal(stale.state,'owner_refused');assert.match(stale.message,/source_revision_conflict/);assert.deepEqual(await readFile(join(root,current.file.location.path)),bytes);
  const nested=structuredClone(proposal);nested.changes[0].places[0].provenance=[{source_ref:basis.source_ref}];const denied=await action([basis],nested);assert.equal(denied.state,'owner_refused');assert.match(denied.message,/exact owner revision/,'the PlaceFacet exception does not exempt nested evidence');
  const saved=await action([basis]);assert.equal(saved.state,'invoked',JSON.stringify(saved));assert.equal(saved.data.persisted,true);assert.equal(saved.data.state,'saved');
  current=await readRegister(transport);frame=current.frames.find(row=>row.ref===frameRef);
  assert.deepEqual(frame.constellations[0].members[0]['aikit.techne-facet/v1'].spatial,[place],'canonical facet persisted without an illegal source_revision field');
  assert.equal((await readNativeFile(transport,source.location)).revision,basis.revision,'source material remains unchanged');
  assert.ok(!saved.data.continuity_warnings.some(row=>/source_revision_conflict/.test(row)),'fresh source survived post-write native readback');
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}await rm(scratch,{recursive:true,force:true});}
});
