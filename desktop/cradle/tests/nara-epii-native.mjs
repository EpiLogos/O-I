#!/usr/bin/env node
/** Actual controlled Epii inquiry through production UI, AIKit, QL and native
 * Expression review. No answer, registry, source or provider double.
 * node tests/nara-epii-native.mjs /absolute/controlled-native-config.json
 * Submits one explicit controlled inquiry. No microphone or personal source.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer,optimizeDeps} from 'vite';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
import {waitForNativeTurn} from './nara-native-turn.mjs';
import {chromium} from 'playwright';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref,/^controlled:/);
assert.ok(config.world.includes('/Control/agents/now/clearings/')&&config.world.includes('/T/')&&config.world.endsWith('/world'));
const resuming=Number.isSafeInteger(config.resume_answer_block_id)&&config.resume_answer_block_id>0;
if(resuming)assert.match(config.binding.expression_ref,/^expression:controlled-epii-/);
const output=path.join(path.dirname(process.argv[2]),'nara-epii-native');await mkdir(output,{recursive:true});
const nativeAt=async (bridge,request)=>{
 const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)});
 const result=await response.json();if(result.ok===false||result.error||!result.outcome)throw Error(result.error||`Native ${request.op} returned no outcome: ${JSON.stringify(result)}`);return result.outcome.data;
};
const native=request=>nativeAt(config.bridge,request);
if(config.file_path){
 const fileOwner=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'file-owner-cache'),server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,entries:[]}});
 try{
  const {hostedCompositionFile}=await fileOwner.ssrLoadModule('/src/expressions/hostedComposition.ts');
  const opened=await hostedCompositionFile({kind:'bridge',url:config.bridge},{operation:'open',path:config.file_path});
  assert.equal(opened.document.expression_ref,config.binding.expression_ref);
  if(resuming){
   const {ensureNativeCoordinateProfile}=await fileOwner.ssrLoadModule('/src/nara/coordinateExpression.ts');
   await ensureNativeCoordinateProfile(request=>native({op:'expression',request}),request=>native({op:'nara_coordinate',request}),opened.document);
  }
  await writeFile(path.join(output,'opened-source.json'),JSON.stringify(opened,null,2));
 }finally{await fileOwner.close();}
}
const source=await native({op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}});
const expression_ref=resuming?config.binding.expression_ref:`expression:controlled-epii-${randomUUID()}`;
const fork=resuming?source:await native({op:'expression',request:{operation:'fork',expression_ref:source.document.expression_ref,expected_revision:source.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-native-verification'}});
assert.ok(fork.document?.selection.entity_ref,'Controlled source must have a selected actual centre');
const originalSubjects=Object.fromEntries(Object.entries(fork.document.entities).map(([id,entity])=>[id,entity.subject]));
const files=['src/nara/coordinateExpression.ts','src/expressions/naraChannel.ts','src/expressions/hostedApp.ts','expressions-app/field-studies-journeys/src/CoordinateAtlas.tsx','kernel/src/nara_epii.rs','kernel/src/nara_voice_answer.rs','src/nara/nativeEpii.ts','expressions-app/field-studies-journeys/src/EpiiReview.tsx'];
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const events=[],errors=[],checks=[];
const parentModule=`
import {kernelOp} from '/src/kernel/bridge.ts';
import {relayNaraChannel} from '/src/expressions/naraChannel.ts';
import {relayKernelChannel} from '/src/expressions/hostedApp.ts';
const transport={kind:'bridge',url:${JSON.stringify(config.bridge)}};
window.documentReading=${JSON.stringify(fork.document)};
const frame=document.querySelector('iframe');
relayKernelChannel(frame,transport);
relayNaraChannel(frame,transport,{project:()=>${JSON.stringify(config.project)},expression:()=>window.documentReading});
window.acceptDocument=async document=>{
 const reply=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:document.expression_ref}});
 if(reply.error||reply.outcome?.data.document.revision!==document.revision)throw Error(reply.error??'Native adoption readback differs');
 window.documentReading=reply.outcome.data.document;
};
frame.src='/epii-child';`;
const childModule=`
import {installNaraInstrument} from '/expressions-app/field-studies-journeys/src/naraInstrument.tsx';
import {installKernelExpressions} from '/expressions-app/field-studies-journeys/src/kernelExpressions.ts';
installKernelExpressions();
installNaraInstrument({nativeView:()=>({document:parent.documentReading}),sceneId:()=>parent.documentReading.selection.scene_ref,acceptNativeDocument:document=>parent.acceptDocument(document)});`;
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{host:'127.0.0.1',port:0,hmr:false},optimizeDeps:{noDiscovery:true,entries:[],include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},plugins:[{name:'native-epii-replay',configureServer(server){server.middlewares.use((req,res,next)=>{
 const route=req.url?.split('?')[0];
 if(route==='/epii-parent'||route==='/epii-child'){res.setHeader('Content-Type','text/html');res.end(route==='/epii-parent'?'<iframe style="width:100%;height:1100px"></iframe><script type="module" src="/epii-parent.js"></script>':'<div id="app"><header class="header-actions"></header></div><script type="module" src="/epii-child.js"></script>');}
 else if(route==='/epii-parent.js'||route==='/epii-child.js'){res.setHeader('Content-Type','application/javascript');res.end(route==='/epii-parent.js'?parentModule:childModule);}else next();
});}}]});
let browser,page;
try{
 await optimizeDeps(server.config);await server.listen();browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1400,height:1200}});
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',request=>{if(request.url()===`${config.bridge}/op`&&request.method()==='POST'){const op=request.postDataJSON();events.push({op:op.op,operation:op.request?.operation});}});
 await page.goto(`${server.resolvedUrls.local[0]}epii-parent`,{waitUntil:'commit'});
 const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Nara',exact:true}).click({timeout:90000});
 await frame.getByLabel('Saved profiles',{exact:true}).selectOption(config.binding.source_ref);
 await frame.getByRole('button',{name:'Save and use identity',exact:true}).click({timeout:90000});
 await frame.getByText('Saved. This identity is selected for the Expression.',{exact:true}).waitFor({timeout:90000});
 if(!resuming){
 await frame.getByRole('button',{name:'Coordinate Atlas',exact:true}).click();
 await frame.getByLabel('Coordinate reference',{exact:true}).fill('#4.1');
 await frame.getByRole('button',{name:'Read coordinate',exact:true}).click();
 await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).click({timeout:90000});
 await frame.getByText('Adopted #4.1 as the Expression profile. Centre identities are unchanged.',{exact:true}).waitFor({timeout:90000});
 }
 const before=(await native({op:'expression',request:{operation:'inspect',expression_ref}})).document;
 const target=Object.values(before.entities).find(entity=>entity.subject?.subject_ref&&entity.entity_ref!==before.selection.entity_ref);
 assert.ok(target,'An actual different native centre is required for this proof');
 await frame.getByRole('button',{name:'With Nara',exact:true}).click();
 await frame.getByRole('button',{name:'Ask Epii',exact:true}).click();
 let delegatedInput;
 if(!resuming){
 await frame.getByLabel('Message Epii',{exact:true}).fill(`This is a controlled native integration inquiry. Use only the native coordinate_binding, origin_context and focus_targets supplied in this inquiry. They are the admitted source readings; do not research files or search the world. Give a two-sentence synthesis of that supplied source. Cite exact supplied grammar_sources/property_sources and their methods/evidence only when supported. No tool calls are needed except reading the current timestamp if unavailable. Propose the exact admitted focus ${target.subject.subject_ref}. Return the complete structured enrichment JSON required by this native inquiry, with exact source references actually supplied; leave method_refs or evidence_refs empty when no corresponding method or evidence was consulted. Respect property_value_standing: the property payload values are not loaded. Make no changes and initiate no actions.`);
 const delegatedResponse=page.waitForResponse(response=>response.url()===`${config.bridge}/op`&&response.request().method()==='POST'&&response.request().postDataJSON()?.op==='nara_epii'&&response.request().postDataJSON()?.request?.operation==='delegate',{timeout:90000});
 delegatedResponse.catch(()=>{});
 await frame.getByRole('button',{name:'Request inquiry',exact:true}).click();
 const delegated=await (await delegatedResponse).json();
 assert.ok(delegated.outcome?.data?.agent_session_ref,delegated.error||JSON.stringify(delegated));
 delegatedInput=JSON.parse(delegated.outcome.data.text);
 }
 const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
 const binding={...config.binding,expression_ref,role:'epii',operation:'lookup',expected_revision:identity.source.revision};
 const lookup=await native({op:'nara_dialogue',project:config.project,request:binding});
 assert.ok(lookup.provisioning?.agent_session);
 const inputDeadline=Date.now()+30000;
 let retainedInput;
 while(Date.now()<inputDeadline){
  const reading=await native({op:'encounter',project:config.project,request:{action:'view',agent_session:lookup.provisioning.agent_session}});
  try{retainedInput=JSON.parse(reading.blocks.filter(block=>block.kind==='user').map(block=>block.text).join(''));}catch{}
  if(retainedInput)break;
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(resuming)delegatedInput=retainedInput;
 assert.ok(retainedInput,'The original native inquiry must remain in the actual AIKit transcript');
 if(!resuming)assert.deepEqual(retainedInput,delegatedInput,'The actual AIKit transcript must retain the complete native inquiry, including source payload');
 const coordinate=await native({op:'nara_coordinate',request:{coordinate_ref:'#4.1',face:'bimba'}});
 assert.deepEqual(retainedInput.coordinate_binding,coordinate.binding,'The admitted inquiry must carry the exact native coordinate sources and their standing');
 assert.ok(coordinate.binding.grammar_sources.length&&coordinate.binding.property_sources.length);
 assert.equal(retainedInput.origin_context.profile_ref,coordinate.binding.resolved_profile_ref);
 await writeFile(path.join(output,'retained-delegation.json'),JSON.stringify(retainedInput,null,2));
 checks.push(resuming?'Actual saved Expression reopened through native file owner; original AIKit delegation retains the exact independently resolved coordinate reading':'Actual native delegation and retained AIKit transcript carry the exact independently resolved coordinate source reading');
 await waitForNativeTurn(native,config.project,lookup.provisioning.agent_session,0,output,'epii');
 await frame.getByRole('button',{name:'Review Epii proposal',exact:true}).last().waitFor({timeout:30000});
 // Read the actual native transcript; the original completed answer remains
 // authoritative, while the visible review is only a projection.
 const conversation=await native({op:'encounter',project:config.project,request:{action:'view',agent_session:lookup.provisioning.agent_session}});
 const block=conversation.blocks.filter(block=>block.kind==='assistant').at(-1);assert.ok(block);
 if(resuming)assert.equal(block.id,config.resume_answer_block_id,'Review must address the exact retained native completed answer');
 const review=await native({op:'nara_epii',project:config.project,request:{operation:'inspect',binding,answer_block_id:block.id}});
 assert.equal(review.apply_allowed,true);assert.ok(review.focus_targets.some(value=>value.ref===target.subject.subject_ref));
 assert.ok(review.enrichment.source_refs.length,'The actual model return must cite the supplied source reading');
 // A commissioned requirement is enforced from the config, not from the
 // enrichment contract's permissiveness: a brief that demands a non-null
 // Factory commission fails the run when the model returns one without it.
 if(config.require_commission){
  const proposal=review.enrichment.factory_commission_proposal;
  assert.ok(proposal,'The commissioned inquiry must return a non-null factory_commission_proposal');
  assert.equal(proposal.proposed_owner_ref,'factory','The commission proposal must name the Factory owner');
  const missing=config.require_commission.evidence_paths.filter(path=>!(proposal.diagnosis_refs??[]).some(ref=>ref.includes(path)));
  assert.deepEqual(missing,[],'The commission proposal must cite every commissioned evidence path');
  checks.push('The enrichment carries the required non-null Factory commission proposal citing the exact evidence paths');
 }
 const suppliedRefs=new Set();
 const collect=value=>{if(typeof value==='string')suppliedRefs.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};
 collect(retainedInput.coordinate_binding);collect(retainedInput.origin_context);
 for(const ref of [...review.enrichment.source_refs,...review.enrichment.method_refs,...review.enrichment.evidence_refs])assert.ok(suppliedRefs.has(ref),`The bounded return cited a reference absent from its supplied native reading: ${ref}`);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,before);
 checks.push('Actual native Epii turn retains structured delegation, source-bearing enrichment and exact original context without Expression mutation');
 await frame.getByRole('button',{name:'Review Epii proposal',exact:true}).last().click();
 await frame.getByRole('button',{name:'Reject proposal',exact:true}).last().click({timeout:90000});
 await frame.getByText('Proposal dismissed. The Expression was not changed; the original return remains in the conversation.',{exact:true}).waitFor();
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,before);
 checks.push('Actual Reject UI leaves the full native Expression unchanged');
 await frame.getByRole('button',{name:'Review Epii proposal',exact:true}).last().click();
 await frame.getByRole('button',{name:`Accept focus: ${target.title}`,exact:true}).click({timeout:90000});
 await page.waitForFunction(expected=>window.documentReading?.selection.entity_ref===expected,target.entity_ref,{timeout:90000});
 const accepted=(await native({op:'expression',request:{operation:'inspect',expression_ref}})).document;
 assert.equal(accepted.revision,before.revision+2);assert.equal(accepted.selection.entity_ref,target.entity_ref);
 assert.deepEqual(Object.fromEntries(Object.entries(accepted.entities).map(([id,entity])=>[id,entity.subject])),originalSubjects);
 const refinement=accepted.refinements.at(-1);assert.equal(refinement.decision.state,'accepted');assert.equal(refinement.basis_revision,before.revision);
 assert.equal(refinement.proposed_by,lookup.provisioning.agent_session);assert.ok(refinement.evidence_refs.some(source=>source.ref.includes(lookup.provisioning.agent_session)));
 checks.push('Actual Accept UI invokes native source-gated atomic Propose+Review, advances exactly two revisions and refreshes the selected subject');
 const stale=await native({op:'nara_epii',project:config.project,request:{operation:'inspect',binding,answer_block_id:block.id}});
 assert.equal(stale.apply_allowed,false);assert.deepEqual(stale.enrichment,review.enrichment);
 await assert.rejects(()=>native({op:'nara_epii',project:config.project,request:{operation:'accept',binding,answer_block_id:block.id,focus_ref:target.subject.subject_ref}}),/changed|stale|revision|basis/i);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,accepted);
 checks.push('A retained return remains reviewable after revision change, but native repeated acceptance is refused without mutation');
 await page.screenshot({path:path.join(output,'accepted.png'),fullPage:true});
 const released=await native({op:'expression',request:{operation:'edit',expression_ref,expected_revision:accepted.revision,actor:'agent:nara-native-verification',changes:accepted.profiles.filter(profile=>profile.profile_ref.startsWith('profile:epi-coordinate-')).map(profile=>({change:'profile_release',profile_ref:profile.profile_ref}))}});
 await page.evaluate(document=>window.acceptDocument(document),released.document);
 const unavailable=await native({op:'nara_epii',project:config.project,request:{operation:'inspect',binding,answer_block_id:block.id}});
 assert.equal(unavailable.apply_allowed,false);assert.deepEqual(unavailable.enrichment,review.enrichment);assert.ok(unavailable.reason);
 await assert.rejects(()=>native({op:'nara_epii',project:config.project,request:{operation:'accept',binding,answer_block_id:block.id,focus_ref:target.subject.subject_ref}}),/profile|coordinate|basis/i);
 await assert.rejects(()=>native({op:'nara_epii',project:config.project,request:{operation:'delegate',binding,brief:'Read the currently admitted native coordinate source.'}}),/profile|coordinate|basis/i);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,released.document);
 checks.push('After native coordinate profile release, the valid original enrichment remains reviewable with apply_allowed:false, and both acceptance and new delegation are refused without mutation');
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'retained-after-profile-release.png'),fullPage:true});
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.nara-epii-native-verification/v1',expression_ref,checks,events,sources,provenance:review.provenance,refinement,limits:['Controlled source-mounted UI with actual native owners and model response; not installed app or physical device proof','Focus review only; other proposals remain retained source material and are not executed']},null,2));
 process.stdout.write(JSON.stringify({ok:true,checks:checks.length,receipt:path.join(output,'receipt.json')})+'\n');
}catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),errors,events,expression_ref},null,2));throw error;}
finally{
 try{
  const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
  const lookup=await native({op:'nara_dialogue',project:config.project,request:{...config.binding,expression_ref,role:'epii',operation:'lookup',expected_revision:identity.source.revision}});
  const session=lookup.provisioning?.agent_session;
  if(session&&!lookup.provisioning.resume_required){
   const status=await native({op:'encounter',project:config.project,request:{action:'status',agent_session:session}});
   if(['TurnInFlight','InterruptRequested'].includes(status.state))await native({op:'encounter',project:config.project,request:{action:'cancel',agent_session:session,reason:'Controlled Epii verification ended before completion'}});
  }
 }catch(error){await writeFile(path.join(output,'cleanup-failure.json'),JSON.stringify({error:String(error)},null,2));process.exitCode=1;}
 await browser?.close();try{await closeControlledExpression(server,config.bridge,expression_ref,output,'Controlled Epii verification ended; exact reviewed return retained');}finally{await server.close();}
}
