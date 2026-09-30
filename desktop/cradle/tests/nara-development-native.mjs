#!/usr/bin/env node
/** Explicit controlled development inquiry through actual native Epii,
 * attributed Flow retention and InstanceCommission. Factory intake remains
 * a separate native owner operation; this receipt never claims it ran. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
import {waitForNativeTurn} from './nara-native-turn.mjs';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(config.world.includes('/Control/agents/now/clearings/')&&config.world.includes('/T/'));
assert.ok(config.output.startsWith(config.world.slice(0,config.world.indexOf('/T/')+3)));
assert.match(config.binding.person_ref,/^controlled:/);
const brief=await readFile(config.brief_file,'utf8');assert.ok(brief.trim().length&&brief.length<16384);
await mkdir(config.output,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(config.output,'module-cache'),server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]}});
const transport={kind:'bridge',url:config.bridge};
let native,expression_ref,dialogue;
try{
 const {kernelOp}=await server.ssrLoadModule('/src/kernel/bridge.ts');
 native=async request=>{const r=await kernelOp(transport,request);if(r.error||!r.outcome)throw Error(r.error||JSON.stringify(r));return r.outcome.data;};
 const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
 const opened=await hostedCompositionFile(transport,{operation:'open',path:config.file_path});
 assert.equal(opened.document.expression_ref,config.binding.expression_ref);
 const {adoptCoordinateExpression,ensureNativeCoordinateProfile}=await server.ssrLoadModule('/src/nara/coordinateExpression.ts');
 const coordinate=await native({op:'nara_coordinate',request:{coordinate_ref:'#4.1',face:'bimba'}});
 let document;
 if(config.resume_expression===true){
  assert.match(opened.document.expression_ref,/^expression:controlled-epii-/);
  expression_ref=opened.document.expression_ref;
  await ensureNativeCoordinateProfile(request=>native({op:'expression',request}),request=>native({op:'nara_coordinate',request}),opened.document);
  document=opened.document;
 }else{
  expression_ref=`expression:controlled-epii-${randomUUID()}`;
  const fork=await native({op:'expression',request:{operation:'fork',expression_ref:opened.document.expression_ref,expected_revision:opened.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-native-verification'}});
  document=await adoptCoordinateExpression(request=>native({op:'expression',request}),coordinate,fork.document,fork.document.selection.entity_ref);
 }
 const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
 const {selectCurrentIdentity,currentIdentity}=await server.ssrLoadModule('/src/nara/identity/current.ts');
 selectCurrentIdentity(identity.reading,identity.source);
 const {acquireNativeDialogue,lookupNativeDialogue,submitNativeTurn}=await server.ssrLoadModule('/src/nara/nativeDialogue.ts');
 if(config.resume_expression===true){
  dialogue=await lookupNativeDialogue(transport,config.project,currentIdentity(),expression_ref,'epii',true);
  assert.ok(dialogue,'Continue only the actual retained canonical session');
  const live=await native({op:'encounter',project:config.project,request:{action:'status',agent_session:dialogue.provisioning.agent_session}});
  const providers=await native({op:'encounter',project:config.project,request:{action:'providers'}});
  const configured=providers.find(provider=>provider.id===dialogue.provisioning.provider);
  assert.equal(live.state,'Resident');assert.equal(live.error,null);
  assert.equal(live.provider.body_ref,'agent-body/epi-prime-ql');
  assert.ok(configured?.body_revision);assert.equal(live.provider.body_revision,configured.body_revision);
  assert.equal(live.provider.body_ref,configured.body_ref);
  await writeFile(path.join(config.output,'live-native-admission.json'),JSON.stringify({live,configured},null,2));
 }else dialogue=await acquireNativeDialogue(transport,config.project,currentIdentity(),expression_ref,'epii');
 const {nativeEpii}=await server.ssrLoadModule('/src/nara/nativeEpii.ts');
 const delegated=await nativeEpii(transport,config.project,{operation:'delegate',binding:dialogue.binding,brief});
 assert.deepEqual(JSON.parse(delegated.text).coordinate_binding,coordinate.binding);
 await writeFile(path.join(config.output,'delegated.json'),JSON.stringify(delegated,null,2));
 await writeFile(path.join(config.output,'active.json'),JSON.stringify({expression_ref,agent_session_ref:dialogue.provisioning.agent_session,binding:dialogue.binding},null,2));
 const previous=await native({op:'encounter',project:config.project,request:{action:'view',agent_session:dialogue.provisioning.agent_session}});
 const baseline=Math.max(0,...previous.blocks.map(block=>block.id));
 if(config.expected_agent_session_ref)assert.equal(dialogue.provisioning.agent_session,config.expected_agent_session_ref);
 await writeFile(path.join(config.output,'before-turn.json'),JSON.stringify(previous,null,2));
 await submitNativeTurn(transport,dialogue,delegated.text);
 const conversation=await waitForNativeTurn(native,config.project,dialogue.provisioning.agent_session,baseline,config.output,'epii-development',360000);
 const block=conversation.blocks.filter(b=>b.kind==='assistant').at(-1);assert.ok(block);
 const review=await nativeEpii(transport,config.project,{operation:'inspect',binding:dialogue.binding,answer_block_id:block.id});
 assert.equal(review.apply_allowed,true);
 const proposal=review.enrichment.factory_commission_proposal;
 assert.equal(proposal?.proposed_owner_ref,'factory','Only an actual returned Factory proposal can be commissioned');
 assert.ok(proposal.discrepancy.trim()&&proposal.diagnosis_refs.length);
 if(config.evidence_paths)assert.deepEqual([...proposal.diagnosis_refs].sort(),[...config.evidence_paths].sort(),'The returned diagnosis must cite the exact evidence sources commissioned in this inquiry');
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,document);
 const retention=await server.ssrLoadModule('/src/nara/nativeReturn.ts');
 const instances=await server.ssrLoadModule('/src/flow/instances.ts');
 const {appendEntry}=await server.ssrLoadModule('/src/flow/instance.ts');
 const destination=JSON.parse(await readFile(config.destination_receipt,'utf8'));assert.equal(destination.world,config.world);
 const answer=await retention.readNativeAnswer(transport,dialogue,block.id);
 const flow=await instances.readFlowInstance(transport,destination.location);
 const kept=await retention.retainAnswerInFlow(transport,flow,answer);
 const retained=await instances.readFlowInstance(transport,destination.location);
 const participant=retained.doc.meta.participants.find(p=>p.kind==='agent'&&p.ref===dialogue.provisioning.agent_session);assert.ok(participant);
 // The commissioned text is the actual Epii discrepancy, linked back to its
 // retained answer. It is neither a fabricated model reply nor a human entry.
 const appended=appendEntry(retained.html,proposal.discrepancy,{participant,replyTo:{entryId:kept.entryId,anchor:null}});
 const committed=await kernelOp(transport,{op:'instance_commission',location:retained.location,expected_revision:retained.revision,content:appended.html,agent_session_ref:dialogue.provisioning.agent_session});
 assert.ok(!committed.error,committed.error);assert.equal(committed.outcome?.result,'instance_commissioned');
 assert.equal(committed.outcome.outcome.state,'commissioned');
 const after=await instances.readFlowInstance(transport,destination.location);
 assert.equal(after.html,appended.html);
 assert.equal(after.doc.entries.length,retained.doc.entries.length+1);
 assert.deepEqual(after.doc.entries.filter(e=>e.id!==appended.entry.id),retained.doc.entries);
 // The standing destination: the person is asked through Central receiving
 // — the Inbox's own queue — with a proposal request, not a document edit.
 // Accepting it commissions the Run through Factory's intake (carried by the
 // O:I guardian family) and records that Run back on the request; nothing
 // here fills Factory authority fields for the person.
 let receivingSubmission;
 if(config.receiving_destination){
  const subject=`Commission: ${proposal.proposal_ref}`.slice(0,280);
  const submitted=await native({op:'receiving',project:config.project||null,request:{Submit:{
   producer_key:`epii-development-commission:${proposal.proposal_ref}`,
   occurred_at_unix_seconds:Math.floor(Date.now()/1000),task_ref:expression_ref,
   request:{kind:'proposal',subject,body:proposal.discrepancy,proposed_owner_ref:'factory',proposal_ref:proposal.proposal_ref},
   summary:proposal.discrepancy.slice(0,8192),
   evidence_refs:proposal.diagnosis_refs,
   declared_producer:{ref:dialogue.provisioning.agent_session,actor_kind:'agent',attribution:'claimed'},
  }}});
  receivingSubmission={return_ref:submitted.return_ref??null,schema:submitted.schema??null,kind:submitted.record?.kind??null};
  assert.ok(receivingSubmission.return_ref,'The receiving owner must acknowledge the proposal request with a return reference');
  assert.equal(receivingSubmission.kind,'request','The proposal reaches the person as a request, not a document edit');
 }
 await writeFile(path.join(config.output,'receipt.json'),JSON.stringify({schema:'oi.nara-development-handoff/v1',expression_ref,binding:dialogue.binding,agent_session_ref:dialogue.provisioning.agent_session,answer_block_id:block.id,review,proposal,flow:{location:after.location,revision:after.revision,answer_entry_id:kept.entryId,commission_entry_id:appended.entry.id,participant},instance_commission:committed.outcome.outcome,receiving:receivingSubmission??null,factory_intake:receivingSubmission?'submitted-to-receiving':'not-yet-performed',limits:['Controlled native inquiry, Flow commission and receiving submission only; the Factory Commission itself is the person\'s own accept-and-commission act through the Factory owner','No human Day mutation or Expression proposal applied']},null,2));
 process.stdout.write(JSON.stringify({ok:true,expression_ref,answer_block_id:block.id,receipt:path.join(config.output,'receipt.json')})+'\n');
}catch(error){await writeFile(path.join(config.output,'failure.json'),JSON.stringify({error:String(error),expression_ref,agent_session_ref:dialogue?.provisioning.agent_session},null,2));throw error;}
finally{
 try{
  if(dialogue){const status=await native({op:'encounter',project:config.project,request:{action:'status',agent_session:dialogue.provisioning.agent_session}});if(['TurnInFlight','InterruptRequested'].includes(status.state))await native({op:'encounter',project:config.project,request:{action:'cancel',agent_session:dialogue.provisioning.agent_session,reason:'Bounded development enquiry ended'}});}
  if(expression_ref)await closeControlledExpression(server,config.bridge,expression_ref,config.output,'Retain actual development inquiry and close owned verification fork');
 }finally{await server.close();}
}
