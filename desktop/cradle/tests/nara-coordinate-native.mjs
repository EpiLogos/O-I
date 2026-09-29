#!/usr/bin/env node
/** Controlled native Atlas adoption through production UI and relays.
 * node tests/nara-coordinate-native.mjs /absolute/native-replay-config.json
 * Forks only the configured controlled Expression. No fake registry/profiles.
 * Source-mounted browser integration, not installed app/device proof.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer,optimizeDeps} from 'vite';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
import {chromium} from 'playwright';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref,/^controlled:/);
assert.ok(config.world.includes('/Control/agents/now/clearings/')&&config.world.includes('/T/')&&config.world.endsWith('/world'));
const output=path.join(path.dirname(process.argv[2]),'nara-coordinate-native');await mkdir(output,{recursive:true});
const nativeAt=async (bridge,request)=>{
 const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)});
 const result=await response.json();if(result.error)throw Error(result.error);assert.ok(result.outcome);return result.outcome.data;
};
const native=request=>nativeAt(config.bridge,request);
const source=await native({op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}});
const expression_ref=`expression:controlled-atlas-${randomUUID()}`;
const fork=await native({op:'expression',request:{operation:'fork',expression_ref:source.document.expression_ref,expected_revision:source.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-native-verification'}});
assert.ok(fork.document?.selection.entity_ref,'Controlled source must have a selected actual native entity');
const originalSubjects=Object.fromEntries(Object.entries(fork.document.entities).map(([id,entity])=>[id,entity.subject]));
const files=['src/nara/coordinateExpression.ts','src/expressions/naraChannel.ts','src/expressions/hostedApp.ts','expressions-app/field-studies-journeys/src/CoordinateAtlas.tsx','kernel/src/nara_coordinate.rs','kernel/src/nara_world_readiness.rs','kernel/src/nara_dialogue.rs','src/nara/runtimeReadiness.ts','src/nara/instrumentProtocol.ts','tests/nara-coordinate-native.mjs'];
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const events=[],errors=[],checks=[],branchReadings=[];let runtimeReadiness=null;
const owned=[{bridge:config.bridge,expression_ref}];
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
frame.src='/atlas-child';`;
const childModule=`
import {installNaraInstrument} from '/expressions-app/field-studies-journeys/src/naraInstrument.tsx';
import {installKernelExpressions} from '/expressions-app/field-studies-journeys/src/kernelExpressions.ts';
installKernelExpressions();
installNaraInstrument({nativeView:()=>({document:parent.documentReading}),sceneId:()=>parent.documentReading.selection.scene_ref,acceptNativeDocument:document=>parent.acceptDocument(document)});`;
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{host:'127.0.0.1',port:0,hmr:false},optimizeDeps:{noDiscovery:true,entries:[],include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},plugins:[{name:'native-atlas-replay',configureServer(server){server.middlewares.use((req,res,next)=>{
 const route=req.url?.split('?')[0];
 if(route==='/atlas-parent'||route==='/atlas-child'){res.setHeader('Content-Type','text/html');res.end(route==='/atlas-parent'?'<iframe style="width:100%;height:1100px"></iframe><script type="module" src="/atlas-parent.js"></script>':'<div id="app"><header class="header-actions"></header></div><script type="module" src="/atlas-child.js"></script>');}
 else if(route==='/atlas-parent.js'||route==='/atlas-child.js'){res.setHeader('Content-Type','application/javascript');res.end(route==='/atlas-parent.js'?parentModule:childModule);}else next();
});}}]});
let browser,page;
try{
 await optimizeDeps(server.config);await server.listen();browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1400,height:1200}});
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',request=>{if(request.url()===`${config.bridge}/op`&&request.method()==='POST'){const op=request.postDataJSON();events.push({op:op.op,operation:op.request?.operation});}});
 await page.goto(`${server.resolvedUrls.local[0]}atlas-parent`,{waitUntil:'commit'});
 const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Nara',exact:true}).click({timeout:90000});
 if(config.runtime_readiness){
  await frame.getByLabel('Saved profiles',{exact:true}).selectOption(config.binding.source_ref);
  await frame.getByRole('button',{name:'Save and use identity',exact:true}).click({timeout:90000});
  await frame.getByText('Saved. This identity is selected for the Expression.',{exact:true}).waitFor({timeout:90000});
 }
 await frame.getByRole('button',{name:'Coordinate Atlas',exact:true}).click();
 await frame.getByLabel('Coordinate reference',{exact:true}).fill('#2-1');
 await frame.getByRole('button',{name:'Read coordinate',exact:true}).click();
 await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).waitFor({timeout:90000});
 const before=await native({op:'expression',request:{operation:'inspect',expression_ref}});
 assert.deepEqual(before.document,fork.document);checks.push('Actual Atlas preview does not change the native Expression');
 await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).click();
 await frame.getByText('Adopted #2-1 as the Expression profile. Centre identities are unchanged.',{exact:true}).waitFor({timeout:90000});
 const adopted=await native({op:'expression',request:{operation:'inspect',expression_ref}});
 const profile=adopted.document.profiles.at(-1);
 assert.deepEqual(Object.fromEntries(Object.entries(adopted.document.entities).map(([id,entity])=>[id,entity.subject])),originalSubjects);
 assert.deepEqual(adopted.document.selection,fork.document.selection);
 assert.equal(adopted.document.revision,fork.document.revision+1);
 const resolved=await native({op:'nara_coordinate',request:{coordinate_ref:'#2-1',face:'bimba'}});
 assert.equal(profile.profile_ref,resolved.binding.resolved_profile_ref);assert.equal(profile.revision,resolved.binding.profile_revision);
 assert.deepEqual(profile.source_basis,resolved.subject_binding.sources[0]);
 for(const expected of resolved.profiles){const stored=await native({op:'expression',request:{operation:'profile_inspect',profile_ref:expected.profile_ref}});assert.deepEqual(stored.profile,expected);}
 checks.push('Actual native profile definitions, source basis and single-CAS adoption preserve every existing subject binding and selection');
 const bad={...resolved.profiles.at(-1),title:'Changed content under the same native revision'};
 await assert.rejects(()=>native({op:'expression',request:{operation:'profile_define',profile:bad,actor:'agent:nara-native-negative-verification'}}),/revision|content/i);
 const retained=await native({op:'expression',request:{operation:'profile_inspect',profile_ref:profile.profile_ref}});assert.deepEqual(retained.profile,resolved.profiles.at(-1));
 checks.push('Native profile owner rejects same-revision changed content and preserves its source definition');
 await frame.getByLabel('Coordinate reference',{exact:true}).fill('#4.1');
 await frame.getByLabel('Coordinate face',{exact:true}).selectOption('pratibimba');
 await frame.getByRole('button',{name:'Read coordinate',exact:true}).click();
 await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).waitFor({timeout:90000});
 await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).click();
 await frame.getByText('Adopted #4.1 as the Expression profile. Centre identities are unchanged.',{exact:true}).waitFor({timeout:90000});
 let replacement=await native({op:'expression',request:{operation:'inspect',expression_ref}});
 const coordinateProfiles=replacement.document.profiles.filter(value=>value.profile_ref.startsWith('profile:epi-coordinate-'));
 assert.equal(coordinateProfiles.length,1);assert.match(coordinateProfiles[0].source_basis.ref,/^ql:m-coordinate:pratibimba:M4\.1$/);
 assert.equal(replacement.document.revision,adopted.document.revision+1);
 assert.deepEqual(Object.fromEntries(Object.entries(replacement.document.entities).map(([id,entity])=>[id,entity.subject])),originalSubjects);
 assert.deepEqual(replacement.document.profiles.filter(value=>!value.profile_ref.startsWith('profile:epi-coordinate-')),adopted.document.profiles.filter(value=>!value.profile_ref.startsWith('profile:epi-coordinate-')));
 checks.push('Explicit replacement atomically switches coordinate profile and face, preserves generic profiles and all existing subject bindings');
 if(config.all_m4_branches){
  const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
  const branches=['identity','embodied','oracle','transformation','context','integration'];
  let canonicalSession;
  for(let index=0;index<branches.length;index++)for(const face of ['bimba','pratibimba']){
   const coordinate=`#4.${index}`,previous=replacement.document;
   await frame.getByLabel('Coordinate reference',{exact:true}).fill(coordinate);
   await frame.getByLabel('Coordinate face',{exact:true}).selectOption(face);
   await frame.getByRole('button',{name:'Read coordinate',exact:true}).click();
   await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).waitFor({timeout:90000});
   assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,previous);
   await frame.getByRole('button',{name:'Use profile for this Expression',exact:true}).click();
   await frame.getByText(`Adopted ${coordinate} as the Expression profile. Centre identities are unchanged.`,{exact:true}).waitFor({timeout:90000});
   replacement=await native({op:'expression',request:{operation:'inspect',expression_ref}});
   const actual=await native({op:'nara_coordinate',request:{coordinate_ref:coordinate,face}});
   const context=await native({op:'nara_dialogue',project:config.project,request:{...config.binding,operation:'context',expression_ref,expected_revision:identity.source.revision}});
   assert.equal(replacement.document.revision,previous.revision+1);
   assert.deepEqual(Object.fromEntries(Object.entries(replacement.document.entities).map(([id,entity])=>[id,entity.subject])),originalSubjects);
   assert.deepEqual(replacement.document.selection,fork.document.selection);
   assert.equal(context.context.subject_ref,config.binding.person_ref);
   assert.equal(context.context.nara_ref,config.binding.nara_ref);
   assert.equal(context.context.expression_ref,expression_ref);
   assert.equal(context.context.m4_branch,branches[index]);
   assert.equal(context.context.active_m_focus,'m4');
   assert.equal(context.context.coordinate_ref,`M4.${index}`);
   assert.equal(context.coordinate_binding.face,face);
   assert.equal(context.context.profile_ref,actual.binding.resolved_profile_ref);
   assert.equal(context.world.registry_revision,actual.binding.rooted_world.registry_revision);
   assert.equal(context.context.occasion,null,'No Day/NOW is fabricated by Atlas selection');
   canonicalSession??=context.context.agent_session_ref;
   assert.equal(context.context.agent_session_ref,canonicalSession);
   for(const expected of actual.profiles){const stored=await native({op:'expression',request:{operation:'profile_inspect',profile_ref:expected.profile_ref}});assert.deepEqual(stored.profile,expected);}
   branchReadings.push({coordinate,face,context,projection:actual,expression_revision:replacement.document.revision});
   checks.push(`Actual UI/native ${coordinate} ${face} preserves person, Nara, canonical session, centre subjects and selection with exact source profile lineage`);
  }
  const reopened=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
  assert.deepEqual(reopened,identity);checks.push('All twelve branch/face encounters leave the saved native identity byte basis unchanged');
 }
 if(config.runtime_readiness){
  const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
  const request={...config.binding,operation:'context',expression_ref,expected_revision:identity.source.revision};
  const beforeContext=await native({op:'nara_dialogue',project:config.project,request});
  const agency=async()=>{const response=await fetch(`${config.bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'agency_read',project:config.project})});const value=await response.json();assert.ok(!value.error,value.error);return value.outcome.spaces;};
  const beforeSpaces=await agency();
  await frame.getByRole('button',{name:'Read runtime readiness',exact:true}).click();
  await frame.getByRole('heading',{name:'Khora',exact:true}).waitFor({timeout:90000});
  for(const name of ['Hen','Pleroma','Chronos','Anima','Aletheia'])assert.equal(await frame.getByRole('heading',{name,exact:true}).count(),1);
  const observed=await native({op:'nara_dialogue',project:config.project,request:{...request,operation:'readiness'}});
  runtimeReadiness=observed.runtime_readiness;
  assert.equal(runtimeReadiness.schema,'oi.nara-runtime-readiness/v1');
  assert.equal(observed.context.context_ref,beforeContext.context.context_ref);
  assert.deepEqual(observed.context,beforeContext.context);
  assert.equal(runtimeReadiness.authority_granted,false);assert.equal(runtimeReadiness.provider_started,false);
  assert.deepEqual(runtimeReadiness.faculties.map(f=>f.id),observed.coordinate_binding.ta_onta_faculties.map(f=>f.id));
  const row=(id,aspect)=>runtimeReadiness.faculties.find(f=>f.id===id).readings.find(r=>r.aspect===aspect);
  assert.equal(row('S3′','occasion').status,'not-observed');assert.equal(row('S4′','session').status,'not-observed');
  assert.equal(row('S2′','actions').status,'disclosed');assert.equal(row('S2′','actions').basis.permitted_action_refs,null);
  assert.equal(row('S2′','provider').status,'not-observed');assert.equal(row('S0′','renderer').status,'not-observed');
  assert.deepEqual(await agency(),beforeSpaces,'Readiness never creates or attaches a session to manufacture availability');
  assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,replacement.document);
  checks.push('Actual UI readiness discloses six native offices, preserves context/Expression, reports absent session/occasion honestly and starts no provider or attachment');
 }
 await page.screenshot({path:path.join(output,'atlas.png'),fullPage:true});
 await frame.getByLabel('Coordinate reference',{exact:true}).fill('#does-not-exist');await frame.getByRole('button',{name:'Read coordinate',exact:true}).click();
 await frame.getByRole('alert').waitFor({timeout:90000});
 const after=await native({op:'expression',request:{operation:'inspect',expression_ref}});assert.deepEqual(after.document,replacement.document);
 checks.push('Unknown coordinate is refused through actual UI and leaves adopted state intact');
 if(config.negative_bridge){
  assert.match(config.negative_bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.notEqual(config.negative_bridge,config.bridge,'Negative tests need an independent native profile store');
  const negative=request=>nativeAt(config.negative_bridge,request);
  const identity=await negative({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
  assert.equal(identity.reading.person_ref,config.binding.person_ref);assert.equal(identity.reading.nara_ref,config.binding.nara_ref);
  for(const [coordinate,part] of [['M3','leaf'],['M5','ancestor']]){
   const actual=await negative({op:'nara_coordinate',request:{coordinate_ref:coordinate,face:'bimba'}});
   const forgedIndex=part==='leaf'?actual.profiles.length-1:1;
   for(let index=0;index<actual.profiles.length;index++){
    const expected=actual.profiles[index];
    const profile=index===forgedIndex?{...expected,title:expected.title+' altered without its source changing'}:expected;
    await negative({op:'expression',request:{operation:'profile_define',profile,actor:'agent:nara-native-negative-verification'}});
   }
   const negativeRef=`expression:controlled-atlas-${part}-${randomUUID()}`;
   const document={...fork.document,profiles:[]};
   const imported=await negative({op:'expression',request:{operation:'open',document,actor:'agent:nara-native-negative-verification'}});
   if(!owned.some(value=>value.bridge===config.negative_bridge&&value.expression_ref===document.expression_ref))owned.push({bridge:config.negative_bridge,expression_ref:document.expression_ref});
   const opened=await negative({op:'expression',request:{operation:'fork',expression_ref:document.expression_ref,expected_revision:imported.document.revision,new_expression_ref:negativeRef,actor:'agent:nara-native-negative-verification'}});
   owned.push({bridge:config.negative_bridge,expression_ref:negativeRef});
   const applied=await negative({op:'expression',request:{operation:'edit',expression_ref:negativeRef,expected_revision:opened.document.revision,actor:'agent:nara-native-negative-verification',changes:[{change:'profile_adopt',adoption:{profile_ref:actual.binding.resolved_profile_ref,revision:actual.binding.profile_revision,source_basis:actual.subject_binding.sources[0]}}]}});
   await assert.rejects(()=>negative({op:'nara_dialogue',project:config.project,request:{...config.binding,operation:'context',expression_ref:negativeRef,expected_revision:identity.source.revision}}),/native source projection/);
   const retained=await negative({op:'expression',request:{operation:'inspect',expression_ref:negativeRef}});assert.deepEqual(retained.document,applied.document);
   checks.push(`Direct native Context refuses a forged ${part} profile under the real QL content ref without mutating the Expression`);
  }
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'refusal.png'),fullPage:true});
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.nara-coordinate-native-verification/v1',expression_ref,checks,events,sources,branchReadings,runtimeReadiness,limits:['Controlled source-mounted UI + native bridge integration; not installed app or physical device proof','Reopen across process restart remains a separate proof',...(Object.values(originalSubjects).every(Boolean)?[]:['Authored source has absent SubjectBindings; this run does not prove seven personal native centre identities']),...(config.negative_bridge?[]:['Native bypass negatives require an isolated negative_bridge and were not run'])],profile,entity_count:Object.keys(originalSubjects).length,native_subject_count:Object.values(originalSubjects).filter(Boolean).length},null,2));
 process.stdout.write(JSON.stringify({ok:true,expression_ref,checks:checks.length,receipt:path.join(output,'receipt.json')})+'\n');
}catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),errors,events,expression_ref},null,2));throw error;}
finally{await browser?.close();try{for(const ref of owned)await closeControlledExpression(server,ref.bridge,ref.expression_ref,output,'Native Atlas verification complete or failed; exact result retained');}finally{await server.close();}}
