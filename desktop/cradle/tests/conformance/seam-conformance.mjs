#!/usr/bin/env node
/** Native-kernel protocol campaign. Never browser/native-app UX acceptance.
 * Requires an explicitly isolated running candidate bridge and one real owner
 * setting request. No substitute owner, canned outcome, or implicit live-user
 * mutation. Lane B closes event/theme debt; assertions are already strict.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {assertKernelReceipt,assertKernelLog} from './receipt-law.mjs';
export async function runSeamConformance({op,events,request,themeOperations=[]}){
 const checks=[],failures=[],observations=[];
 const check=(name,fn)=>{try{fn();checks.push({name,passed:true});}catch(error){const message=String(error.message);checks.push({name,passed:false,error:message});failures.push({name,error:message});}};
 const invoke=async operation=>{const result=await op(operation);observations.push({operation,result});for(const receipt of result.receipts??[])assertKernelReceipt(receipt);return result;};
 const surface_id=`conformance-${randomUUID()}`;
 const before=await events();assertKernelLog(before);const cursor=before.at(-1)?.seq??0;
 const opened=await invoke({op:'surface_open',surface_id,kind:'file',title:'Native conformance observation'});
 check('surface open emits its exact identity',()=>assert.ok(opened.receipts?.some(r=>r.event==='surface_changed'&&r.surface_id===surface_id)));
 const closed=await invoke({op:'surface_close',surface_id});
 check('surface close emits its exact identity',()=>assert.ok(closed.receipts?.some(r=>r.event==='surface_changed'&&r.surface_id===surface_id)));
 const held=await invoke({op:'config_desired_hold',request});
 check('successful desired hold emits a kernel event',()=>assert.ok(held.receipts?.length,'B-settings-effect-events: native desired change emitted no kernel receipt'));
 const planned=await invoke({op:'config_plan',requests:[request]});
 check('plan is a native refusal-free read with no world effect',()=>{assert.deepEqual(planned.errors??[],[]);assert.ok(planned.plans?.length);assert.equal(planned.receipts?.length??0,0);});
 const applied=await invoke({op:'config_apply',requests:[request]});
 check('native setting apply emits kernel and owner receipts',()=>{assert.ok(applied.receipts?.length,'B-settings-effect-events: native apply emitted no kernel receipt');assert.ok(applied.owner_receipts?.length,'native owner apply receipts absent');});
 if(themeOperations.length){for(const operation of themeOperations){const outcome=await invoke(operation);check(`${operation.op} emits a theme effect receipt`,()=>assert.ok(outcome.receipts?.length));}}
 else failures.push({name:'theme import/apply/revert',error:'B-theme-persistence/B-theme-imports: no implemented typed theme operations supplied; unexecuted, not passed'});
 const log=(await events()).filter(r=>r.seq>cursor);check('ordered log contains each returned event exactly once',()=>{assertKernelLog(log);const returned=observations.flatMap(x=>x.result.receipts??[]);assert.deepEqual(log,returned);});
 return {schema:'oi.desktop-seam-conformance/v1',spec_ref:'docs/cradle/02-ARCHITECTURE.md §5; canonical conformance plan Lane A §5',grade:'D',classification:'deterministic real-kernel protocol campaign on disposable owner storage; no native-app or inference acceptance',accepted:false,passed:failures.length===0,checks,failures,observations};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.env.OI_CONFORMANCE_DISPOSABLE,'1','launch an isolated candidate bridge; explicitly attest disposable OI_HOME/AIKIT_HOME before any mutation');
 const [url,requestPath,outputPath,themePath]=process.argv.slice(2);assert.ok(url&&requestPath&&outputPath,'usage: OI_CONFORMANCE_DISPOSABLE=1 node tests/conformance/seam-conformance.mjs LOOPBACK_BRIDGE REQUEST_JSON OUTPUT_JSON [THEME_OPS_JSON]');
 const endpoint=new URL(url);assert.ok(['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)&&endpoint.protocol==='http:','only an explicitly local native test bridge');
 const json=async(path,body)=>{const response=await fetch(`${endpoint.origin}${path}`,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});const result=await response.json();assert.equal(result.ok,true,result.error);return result;};
 const request=JSON.parse(readFileSync(requestPath,'utf8'));const themeOperations=themePath?JSON.parse(readFileSync(themePath,'utf8')):[];
 try{const result=await runSeamConformance({op:async body=>(await json('/op',body)).outcome,events:async()=>(await json('/events?since=1')).receipts,request,themeOperations});writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');console.log(`${result.checks.length} checks, ${result.failures.length} failures; ${outputPath}`);if(!result.passed)process.exitCode=1;}catch(error){writeFileSync(outputPath,JSON.stringify({spec_ref:'canonical conformance plan Lane A §5',grade:'D',classification:'deterministic native campaign interrupted',passed:false,accepted:false,error:String(error)},null,2)+'\n');throw error;}
}
