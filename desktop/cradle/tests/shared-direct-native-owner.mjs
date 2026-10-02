/** Captured actual Direct journal -> production Factory mapping/request/acceptance
 * -> real O:I Kernel/ActStore and Central material owner. Controlled replay of
 * retained activity; no new provider, tool effect, Factory Run or installed claim. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir, mkdtemp, cp, rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../node_modules/esbuild/lib/main.js';
import {nativeCentralWorld, releaseNativeBridge} from './native-expression-central.mjs';
const binary=process.env.NATIVE_EXPRESSION_BRIDGE;
assert.ok(binary?.startsWith('/'),'Explicit actual native bridge required');
const out=resolve(process.env.OI_SHARED_TEXT_OUT??'tests/artifacts/shared-direct-native');
await mkdir(out,{recursive:true});
const root=await mkdtemp(join(tmpdir(),'oi-shared-native-text-'));
const hash=async path=>{const h=createHash('sha256');for await(const bytes of createReadStream(path))h.update(bytes);return h.digest('hex');};
const journalPath=resolve('tests/fixtures/shared-direct-journal/native-turn.json');
const source=JSON.parse(await readFile('tests/fixtures/shared-direct-journal/source.json','utf8'));
const journal=JSON.parse(await readFile(journalPath,'utf8'));
assert.equal(await hash(journalPath),source.excerpt_sha256);
const report={schema:'oi.shared-native-text-owner-acceptance/v1',standing:'Actual Kernel/ActStore/Central material operations using captured actual Direct speech; controlled replay, no new model/tool invocation, installed or two-human claim',sources:{journal:{sha256:source.excerpt_sha256,events:journal.events.length,from:source.from,to:source.to},bridge:{path:binary,sha256:await hash(binary)}},checks:[],pass:false};
let bridge,endpoint,stdout='',stderr='';
const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(new Error('Native Direct replay exceeded its 120s bound')),120000);
try {
 const central=await nativeCentralWorld(root);report.native_owners=central.sources;report.initialization=central.initialization;
 const register=join(root,'Work/O-I/desktop/cradle/material/expressive-material');
 await cp(resolve('material/expressive-material'),register,{recursive:true});
 const materialPath=resolve('material/shared-field/shared-undertaking.expression.json');
 await cp(materialPath,join(register,'expression/shared-undertaking.expression.json'));
 report.sources.material={path:materialPath,sha256:await hash(materialPath)};
 await build({stdin:{contents:"export {mapEventsWithCursor,opKey} from './src/contributions/factory/live/eventMap.ts';export {requestFor,performWithRetry,cursorFromAct,requestAccepted,reconcilePendingDelivery} from './src/contributions/factory/live/producer.ts';export {resolveRepertoire} from './src/contributions/factory/live/repertoire.ts';",resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:join(root,'native-consumer.mjs')});
 const {mapEventsWithCursor,opKey,requestFor,performWithRetry,cursorFromAct,requestAccepted,reconcilePendingDelivery,resolveRepertoire}=await import(pathToFileURL(join(root,'native-consumer.mjs')).href);
 const startBridge=async()=>{
  stdout='';
  bridge=spawn(binary,['127.0.0.1:0'],{env:central.env,stdio:['ignore','pipe','pipe']});
  bridge.stdout.on('data',b=>{stdout=(stdout+b).slice(-16384);});bridge.stderr.on('data',b=>{stderr=(stderr+b).slice(-262144);});
  endpoint=await new Promise((accept,reject)=>{const timer=setTimeout(()=>reject(new Error('Native bridge startup exceeded15s')),15000);bridge.once('error',e=>{clearTimeout(timer);reject(e);});bridge.once('exit',code=>{clearTimeout(timer);reject(new Error(`Native bridge exited${code}: ${stderr}`));});bridge.stdout.on('data',()=>{const found=stdout.match(/http:\/\/127\.0\.0\.1:\d+/);if(found){clearTimeout(timer);accept(found[0]);}});});
 };
 await startBridge();
 const requests=[];
 const call=async(op,request)=>{requests.push({op,operation:request.operation});const response=await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,request}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});const value=await response.json();if(value.ok!==true)throw new Error(value.error??'Native operation failed');assert.equal(value.outcome?.result,op);return value.outcome.data;};
 const world=request=>call('expression_world',request);
 const initial=JSON.parse(await readFile('tests/fixtures/shared-native-expression/native-document.json','utf8'));
 await call('expression',{operation:'open',document:initial,actor:'agent:controlled-native-replay'});
 const listing=await world({operation:'material_list'});
 const material=listing.materials.find(row=>row.expression_ref==='expression:shared-undertaking-material');
 assert.ok(material,JSON.stringify(listing.unreadable));
 assert.ok(material.file_ref.startsWith('central:'),'Material identity must come from the actual native owner');
 const repertoire=resolveRepertoire(listing.materials,{explicit:material.file_ref});
 const character=listing.materials.find(row=>row.kind==='character'&&row.states?.idle&&row.states?.working&&row.states?.speaking);
 assert.ok(character,'Actual character repertoire required');
 const session=source.world_ref+'/'+journal.agent_session,actRef='act:controlled-retained-direct-native';
 const agentRef=source.world_ref+'/'+source.agent_ref;
 const initialScene=initial.scenes.find(scene=>scene.scene_ref===initial.selection.scene_ref);
 const bindings=Object.fromEntries(initialScene.presentation.scene.entities.map(body=>{
  const entity=initial.entities[body.id];assert.ok(entity?.subject?.subject_ref,'Every rendered role must retain its actual native subject');
  return [body.role,{kind:entity.subject.presentation_role==='being'?'agent':'object',subject_ref:entity.subject.subject_ref,entity_ref:entity.entity_ref,label:entity.title}];
 }));
 const agentEntity=Object.values(initial.entities).find(entity=>entity.subject?.subject_ref===source.participant_ref);
 assert.ok(agentEntity,'The actual working participant must have a native body');
 bindings.bo={...bindings.bo,agent_ref:agentRef,character_ref:character.file_ref};
 const cast=[{role:'bo',agent_ref:agentRef,label:'Bo',character_ref:character.file_ref,session_refs:[session],attempt_refs:[]}];
 const scope={cast,humanRefs:{[session]:source.world_ref+'/'+source.human_ref},replyRole:'resultText',replyChars:4096,messageRole:'communication',worldRef:source.world_ref,phaseScenes:{working:'work-passage',speaking:'review'}};
 let act=(await world({operation:'act_open',act_ref:actRef,expression_ref:initial.expression_ref,mode:'expressions',subject_ref:session,instrument_ref:session,actor:'agent:controlled-native-replay',bindings,cast:[{role:'bo',participant_ref:agentRef,label:'Bo',character_ref:character.file_ref}]})).act;
 const inspect=async()=> (await world({operation:'act_inspect',act_ref:actRef})).act;
 const mapped=mapEventsWithCursor({runRef:initial.expression_ref},{encounter:{[session]:journal.events},bounds:{[session]:{from:source.from,to:source.to}}},{performed:[],encounterAfter:{[session]:source.from-1}},scope);
 for(const op of mapped.ops){
  act=await inspect();
  if(cursorFromAct(act).performed.includes(opKey(op)))continue;
  const built=requestFor(op,repertoire,cast,{actRef,actor:'agent:controlled-native-replay'});
  assert.ok(built.request,built.reason);
  for(const[role,value]of Object.entries(built.request.bindings??{})){
   if(value.agent_ref===agentRef)built.request.bindings[role]={...value,...bindings.bo,state:value.state};
   else if(bindings[role]?.entity_ref)built.request.bindings[role]={...value,entity_ref:bindings[role].entity_ref};
  }
  const outcome=await performWithRetry(world,{...built.request,expected_act_revision:act.revision},actRef);
  assert.ok(cursorFromAct(outcome.act).performed.includes(opKey(op)),'Only actual accepted native occurrences are consumed');
 }
 act=await inspect();
 const full=journal.events.map(row=>row.event?.event?.Signal?.kind).filter(row=>row?.kind==='agent-message-chunk').map(row=>row.text).join('');
 const retained=act.sequence.find(p=>p.kind==='text'&&p.role==='resultText'&&p.text===full);
 assert.ok(retained,'Actual full Direct speech must be retained as native text');
 const pages=act.sequence.filter(p=>p.kind==='edition'&&p.native_ref===retained.native_ref);
 assert.ok(pages.length>1);assert.equal(pages.map(p=>p.text).join(''),full);
 const document=(await call('expression',{operation:'inspect',expression_ref:initial.expression_ref})).document;
 const selected=document.scenes.find(s=>s.scene_ref===document.selection.scene_ref);
 assert.deepEqual(Object.keys(document.entities).sort(),Object.keys(initial.entities).sort(),'Scene changes reuse actual subjects instead of minting parallel role bodies');
 for(const[ref,entity]of Object.entries(initial.entities))assert.deepEqual(document.entities[ref].subject,entity.subject,'Actual participant/work/source authority bindings remain unchanged');
 for(const body of selected.presentation.scene.entities)assert.ok(document.entities[body.id]?.subject?.subject_ref,'Every rendered body must still resolve an actual native subject');
 assert.equal(act.bindings.bo.agent_ref,agentRef);assert.equal(act.role_entities.bo,agentEntity.entity_ref);
 assert.equal(selected.presentation.scene.text.find(t=>t.role==='resultText').body,pages[0].text,'The actual terminal agent state preserves its first readable page');
 assert.equal(act.mode,'expressions');assert.equal(act.subject_ref,session);assert.equal(act.instrument_ref,session);
 assert.ok(!act.subject_ref.startsWith('run:'),'Direct activity preserves its own identity');
 report.checks.push('Actual Central-qualified Factory repertoire and real native Act operations','Complete2967byte Direct reply retained without truncation','Terminal local idle preserves the returned native page','Direct subject/instrument do not acquire Factory Run identity');
 const originalTextOp=mapped.ops.find(op=>op.operation==='act_text'&&op.role==='resultText');
 const changed=requestFor({...originalTextOp,text:full+'\nControlled different source bytes'},repertoire,cast,{actRef,actor:'agent:controlled-native-replay'}).request;
 const sameRequest=requestFor(originalTextOp,repertoire,cast,{actRef,actor:'agent:controlled-native-replay'}).request;
 assert.equal(requestAccepted(act,sameRequest),true);assert.equal(requestAccepted(act,changed),false);
 await assert.rejects(()=>performWithRetry(world,{...changed,expected_act_revision:act.revision},actRef),/already retains different source bytes/);
 assert.deepEqual(await inspect(),act);assert.deepEqual((await call('expression',{operation:'inspect',expression_ref:initial.expression_ref})).document,document);
 report.checks.push('Changed source bytes on the same accepted event basis remain a real native refusal, never recovered as acceptance');
 // Stop the actual producer bridge and resume a fresh body on its real
 // durable ActStore. Unknown delivery is reconciled with reads, not effects.
 report.interrupted_bridge_cleanup=await releaseNativeBridge(bridge);
 const beforeInterruption=requests.length;
 await assert.rejects(()=>reconcilePendingDelivery(world,sameRequest));
 assert.deepEqual(requests.slice(beforeInterruption),[{op:'expression_world',operation:'act_inspect'}]);
 await startBridge();
 const resumed=await reconcilePendingDelivery(world,sameRequest);
 assert.deepEqual(resumed.act,act,'Fresh body reads the unchanged durable native Act and retained text pages');
 await assert.rejects(()=>reconcilePendingDelivery(world,changed),/different native request material/);
 assert.deepEqual(requests.slice(beforeInterruption),Array.from({length:3},()=>({op:'expression_world',operation:'act_inspect'})),'Neither network loss nor recovery replays a native mutation');
 await call('expression',{operation:'open',document,actor:'agent:controlled-native-replay'});
 report.checks.push('Real bridge interruption holds uncertain delivery; a fresh body reconciles the durable native Act without replaying mutations');

 await writeFile(join(out,'document.json'),JSON.stringify(document,null,2)+'\n');
 await writeFile(join(out,'act.json'),JSON.stringify(act,null,2)+'\n');
 report.native_document={path:join(out,'document.json'),sha256:await hash(join(out,'document.json')),expression_ref:document.expression_ref,revision:document.revision};
 report.native_act={path:join(out,'act.json'),sha256:await hash(join(out,'act.json')),act_ref:actRef,revision:act.revision,pages:pages.length,complete_text_bytes:Buffer.byteLength(full)};
 // A real ended native Act refuses the next operation. The production
 // acceptance helper cannot turn the failure into a success receipt.
 await world({operation:'act_complete',act_ref:actRef,actor:'agent:controlled-native-replay',expected_act_revision:act.revision});
 const ended=await inspect(),before=(await call('expression',{operation:'inspect',expression_ref:initial.expression_ref})).document;
 await assert.rejects(()=>performWithRetry(world,{operation:'act_text',act_ref:actRef,actor:'agent:controlled-native-replay',role:'resultText',text:'This refused operation must not consume its source',expected_act_revision:ended.revision,event_basis:{family:'activity',source:'controlled-native-refusal',event_ref:session,occurrence:'after-complete'}},actRef),/Act has ended/);
 assert.deepEqual(await inspect(),ended);assert.deepEqual((await call('expression',{operation:'inspect',expression_ref:initial.expression_ref})).document,before);
 report.checks.push('Real native refusal has no acceptance and leaves the actual Act and Document unchanged');
 report.pass=true;
} catch(error) {report.failure=String(error);throw error;}
finally {
 clearTimeout(deadline);controller.abort();
 if(bridge){try{report.bridge_cleanup={ok:true,receipt:await releaseNativeBridge(bridge)};}catch(error){report.bridge_cleanup={ok:false,error:String(error)};report.pass=false;report.cleanup_failure=String(error);}}
 await writeFile(join(out,'native-owner.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(join(out,'kernel.log'),stdout+'\n'+stderr);
 await rm(root,{recursive:true,force:true});
 if(report.cleanup_failure)throw new Error(report.cleanup_failure);
}
console.log(JSON.stringify(report,null,2));
