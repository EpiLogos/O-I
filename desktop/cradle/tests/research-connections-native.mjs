/** Actual NativeWorking -> native kernel bridge; only response loss is injected.
 * Native records and checkpoint files are real, isolated under a temporary home. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const require=createRequire(new URL('../expressions-app/package.json',import.meta.url));
const {build}=require('esbuild');
const home=await mkdtemp(join(tmpdir(),'oi-native-connections-'));
let child,stderr='',url;
async function stop(){if(!child)return;const exited=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(exited)await exited;child=undefined;}
async function start(){
 child=spawn(process.env.OI_KERNEL_BIN??join(root,'cli/target/debug/walk-bridge'),['127.0.0.1:0'],{env:{...process.env,OI_HOME:home},detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
 url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(stderr||'Native bridge startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native bridge exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{text+=chunk;const found=/listening on (http:\/\/[^ ]+)/.exec(text);if(found){clearTimeout(timer);resolve(found[1]);}});});
}
try{
 const module=join(home,'working.mjs');
 await build({stdin:{contents:`export {NativeWorking} from './nativeWorking';export {blankJourney,entity,clone} from './model';`,resolveDir:join(root,'desktop/cradle/expressions-app/field-studies-journeys/src'),loader:'ts'},outfile:module,bundle:true,platform:'node',format:'esm'});
 const {NativeWorking,blankJourney,entity,clone}=await import(pathToFileURL(module));
 await start();
 let calls=0,loseNext=false;
 const native=async request=>{calls++;const response=await fetch(url+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request})});const value=await response.json();assert.equal(value.ok,true,value.error);return value.outcome.data;};
 const checkpoint=join(home,'checkpoint.json');
 const ports={expression:async request=>{const response=await native(request);if(loseNext&&request.operation==='edit'){loseNext=false;throw Error('Reply lost after actual native edit');}return response;},file:async()=>{throw Error('No file operation requested');},checkpoint:async(_id,value)=>writeFile(checkpoint,JSON.stringify(value)),mint:()=> 'expression:native-connection-check'};
 const work=new NativeWorking(ports),journey=blankJourney();journey.name='Native connection acceptance';journey.scenes[0].entities=[entity('First','First'),entity('Second','Second')];
 await work.commit({journey,sceneId:journey.scenes[0].id,entityId:null});
 const basis=work.state.view,refs=basis.document.scenes[0].entity_refs;
 const binding={binding_ref:basis.document.expression_ref+':relation:connection-native-proof',native_owner:'oi',relation:{ref:basis.document.expression_ref+':relation:connection-native-proof:related',revision:'1',availability:'available'},from_entity_ref:refs[0],to_entity_ref:refs[1],provenance:[]};
 const beforeCalls=calls;
 const first=await work.editConnections([{change:'relation_bind',binding}]);
 assert.equal(calls-beforeCalls,2,'edit is followed by independent native inspect');
 assert.deepEqual(first.document.relations[binding.binding_ref],binding);
 assert.equal(first.journey.id,basis.journey.id);assert.deepEqual(first.entity_ids,basis.entity_ids);assert.deepEqual(Object.keys(first.bindings),Object.keys(basis.bindings));
 assert.equal(work.state.pending,undefined);
 const changed={...binding,relation:{...binding.relation,ref:binding.binding_ref+':supports',revision:'2'}};
 loseNext=true;await assert.rejects(()=>work.editConnections([{change:'relation_bind',binding:changed}]),/Reply lost/);
 const saved=JSON.parse(await readFile(checkpoint,'utf8'));assert.equal(saved.pending.kind,'connections');
 const recovered=new NativeWorking(ports);recovered.restore(saved,first.journey);const callsBeforeInspect=calls;
 assert.match(await recovered.inspectPending(),/Recovered the exact native connection/);assert.equal(calls-callsBeforeInspect,1,'recovery reads without replaying mutation');
 assert.deepEqual(recovered.state.view.document.relations[binding.binding_ref],changed);
 await recovered.select({scene_ref:recovered.state.view.document.scenes[0].scene_ref,binding_ref:binding.binding_ref});
 const removed=await recovered.editConnections([{change:'relation_remove',binding_ref:binding.binding_ref}]);
 assert.equal(removed.document.relations[binding.binding_ref],undefined);assert.equal(removed.document.selection.relation_ref,undefined);
 await recovered.editConnections([{change:'relation_bind',binding:changed}]);
 const stable=recovered.state.view.document;const unknown={...changed,native_owner:'semantic-wiki'};
 await assert.rejects(()=>recovered.editConnections([{change:'relation_bind',binding:unknown}]),/O:I owner/);
 assert.deepEqual((await native({operation:'inspect',expression_ref:stable.expression_ref})).document,stable,'source owner refusal leaves real native document unchanged');
 const tampered=clone(saved);tampered.pending.request.expected_revision++;
 assert.throws(()=>new NativeWorking(ports).restore(tampered,first.journey),/captured|native basis/);
 const stale=new NativeWorking(ports);stale.restore(recovered.state,recovered.state.view.journey);
 await native({operation:'edit',expression_ref:stable.expression_ref,expected_revision:stable.revision,actor:'human:concurrent-proof',changes:[{change:'rename',title:'Concurrent native title'}]});
 await assert.rejects(()=>stale.editConnections([{change:'relation_remove',binding_ref:binding.binding_ref}]));
 assert.equal(stale.state.pending.kind,'connections');await assert.rejects(()=>stale.inspectPending(),/revision_conflict/);
 assert.equal((await native({operation:'inspect',expression_ref:stable.expression_ref})).document.title,'Concurrent native title');
 // A real owner process restart forgets its open drafts. Reopen the exact
 // acknowledged checkpoint, preserving local unsaved material and pending intent.
 const restartRecord=stale.state,localDraft=clone(restartRecord.view.journey);
 localDraft.scenes[0].entities[0].text='Uncommitted local text retained through restart';
 await assert.rejects(()=>new NativeWorking(ports).reopenCheckpoint(restartRecord,localDraft),'a recovery checkpoint cannot replace independently changed open native work');
 assert.equal((await native({operation:'inspect',expression_ref:stable.expression_ref})).document.title,'Concurrent native title');
 await stop();await start();
 assert.equal((await native({operation:'list'})).expressions.length,0,'actual fresh native process has no open drafts');
 const restarted=new NativeWorking(ports),beforeRestore=calls;
 const resumed=await restarted.reopenCheckpoint(restartRecord,localDraft);
 assert.equal(calls-beforeRestore,1,'recovery opens acknowledged state without replaying pending edits');
 assert.deepEqual((await native({operation:'inspect',expression_ref:stable.expression_ref})).document,restartRecord.view.document);
 assert.deepEqual(resumed.journey,localDraft,'uncommitted local material remains local and is not discarded');
 assert.deepEqual(restarted.state.pending,restartRecord.pending,'interrupted intent is retained for inspection');
 console.log(JSON.stringify({result:'passed',checks:['actual relation commit and independent readback','retained draft/scene/entity identities','durable lost-reply recovery without replay','source-owned relation refusal','tampered checkpoint refusal','concurrent revision conflict retains exact intent','deleting focused relation clears native selection','real process restart reopens exact acknowledged basis','unsaved local material and interrupted intent survive restart','recovery refuses independently changed native work'],native_calls:calls}));
}finally{
 await stop();
 await rm(home,{recursive:true,force:true});
}
