#!/usr/bin/env node
/** Actual retained Epii session + saved native Expression. Read only, no model
 * invocation, session provisioning, source edit or manufactured owner reading.
 * node tests/nara-runtime-readiness-native.mjs /absolute/config.json */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref,/^controlled:/);
assert.ok(config.output.includes('/T/'));assert.ok(config.file_path.startsWith('Work/controlled/'));
await mkdir(config.output,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(config.output,'vite-cache'),server:{middlewareMode:true,hmr:false,ws:false}});
const transport={kind:'bridge',url:config.bridge};let owned=false;
const op=async value=>{const response=await fetch(`${config.bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(120000)});const result=await response.json();assert.ok(!result.error,result.error);return result.outcome;};
const native=async value=>(await op(value)).data;
const checks=[];
try{
 const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
 const {ensureNativeCoordinateProfile,validateCoordinateExpression}=await server.ssrLoadModule('/src/nara/coordinateExpression.ts');
 const listed=await native({op:'expression',request:{operation:'list'}});
 owned=!listed.expressions.some(row=>row.expression_ref===config.binding.expression_ref);
 const opened=await hostedCompositionFile(transport,{operation:'open',path:config.file_path});
 assert.equal(opened.document.expression_ref,config.binding.expression_ref);
 await ensureNativeCoordinateProfile(request=>native({op:'expression',request}),async request=>validateCoordinateExpression(await native({op:'nara_coordinate',request})),opened.document);
 const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
 const request={...config.binding,role:'epii',operation:'context',expected_revision:identity.source.revision};
 const context=await native({op:'nara_dialogue',project:config.project,request});
 const spaces=(await op({op:'agency_read',project:config.project})).spaces;
 const result=await native({op:'nara_dialogue',project:config.project,request:{...request,operation:'readiness'}});
 const ready=result.runtime_readiness;assert.equal(ready.schema,'oi.nara-runtime-readiness/v1');
 assert.deepEqual(result.context,context.context);checks.push('Native readiness preserves the exact authority-bearing dialogue context');
 const row=(id,aspect)=>ready.faculties.find(f=>f.id===id).readings.find(r=>r.aspect===aspect);
 assert.equal(row('S4′','session').status,'observed');
 assert.equal(row('S4′','session').basis.agent_session_ref,context.context.agent_session_ref);
 assert.equal(row('S2′','provider').status,'observed');assert.ok(row('S2′','provider').basis.provider);
 checks.push('Actual persisted Epii attachment and provider journal are observed through their native owner');
 assert.equal(row('S3′','occasion').status,'not-observed');
 assert.equal(row('S2′','actions').basis.permitted_action_refs,null);
 assert.equal(ready.authority_granted,false);assert.equal(ready.provider_started,false);
 assert.deepEqual((await op({op:'agency_read',project:config.project})).spaces,spaces);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}})).document,opened.document);
 assert.deepEqual(await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}}),identity);
 checks.push('Actual missing occasion remains missing; native source, Expression and SessionSpace inventory are unchanged');
 const files=['kernel/src/nara_world_readiness.rs','kernel/src/nara_dialogue.rs','src/nara/runtimeReadiness.ts'];
 const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
 await writeFile(path.join(config.output,'receipt.json'),JSON.stringify({schema:'oi.nara-runtime-readiness-native-verification/v1',checks,result,sources,file_basis:{location:opened.file.location,revision:opened.file.revision},limits:['Native owner disclosure is not live inference, physical speech output, action authority or human Recognition']},null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,output:config.output}));
}finally{
 if(owned)await native({op:'expression',request:{operation:'close',expression_ref:config.binding.expression_ref,actor:'agent:nara-native-verification'}});
 await server.close();
}
