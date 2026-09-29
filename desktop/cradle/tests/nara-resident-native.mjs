#!/usr/bin/env node
/** Real retained Prime session: explicit native reconnect followed by two
 * resident opens, with unchanged provider pins, native ID and transcript. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.expression_ref,/^expression:controlled-epii-/);
assert.equal(typeof config.expected_body_revision,'string');assert.ok(config.expected_body_revision.length);
assert.equal(typeof config.expected_native_session_id,'string');assert.ok(config.expected_native_session_id.length);
assert.ok(config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
await mkdir(config.output,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(config.output,'resident-module-cache'),server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]}});
let native,opened;
try{
 const {kernelOp}=await server.ssrLoadModule('/src/kernel/bridge.ts');
 const transport={kind:'bridge',url:config.bridge};
 native=async request=>{const r=await kernelOp(transport,request);if(r.error||!r.outcome)throw Error(r.error||JSON.stringify(r));return r.outcome.data;};
 const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
 opened=await hostedCompositionFile(transport,{operation:'open',path:config.file_path});
 assert.equal(opened.document.expression_ref,config.binding.expression_ref);
 const request={...config.binding,role:'epii',operation:'lookup'};
 const binding=await native({op:'nara_dialogue',project:config.project,request});
 assert.equal(binding.provisioning.agent_session,config.expected_agent_session_ref);
 const {agent_session,space,provider}=binding.provisioning;
 const before=await native({op:'encounter',project:config.project,request:{action:'view',agent_session}});
 const status=await native({op:'encounter',project:config.project,request:{action:'status',agent_session}});
 assert.ok(!['TurnInFlight','InterruptRequested'].includes(status.state));
 const receipts=[];
 for(const action of ['reconnect','open','open']){
  const receipt=await native({op:'encounter',project:config.project,request:{action,agent_session,space,provider}});
  await writeFile(path.join(config.output,`resident-${receipts.length}-${action}.json`),JSON.stringify(receipt,null,2));
  assert.equal(receipt.native_session_id,config.expected_native_session_id);
  assert.equal(receipt.body_ref,'agent-body/epi-prime-ql');
  assert.equal(receipt.body_revision,config.expected_body_revision);
  receipts.push(receipt);
 }
 const resolved=await native({op:'nara_dialogue',project:config.project,request:{...request,operation:'resolve'}});
 assert.equal(resolved.provisioning.agent_session,agent_session);
 assert.equal(resolved.provisioning.open.native_session_id,config.expected_native_session_id);
 const after=await native({op:'encounter',project:config.project,request:{action:'view',agent_session}});
 // Native lifecycle events may append; user/assistant messages stay exact.
 const turns=reading=>reading.blocks.filter(b=>['user','assistant','completed','error','cancelled'].includes(b.kind));
 assert.deepEqual(turns(after),turns(before));
 await writeFile(path.join(config.output,'resident-receipt.json'),JSON.stringify({schema:'oi.nara-resident-native/v1',agent_session,native_session_id:config.expected_native_session_id,body_ref:receipts[0].body_ref,body_revision:receipts[0].body_revision,receipts,checks:['Explicit reconnect preserves recorded Prime native session','Repeated resident open retains exact acting-body pins','Production dialogue resolution passes strict body guard','Retained user/assistant/terminal blocks remain unchanged'],limits:['No model inference performed by this readiness regression']},null,2));
 process.stdout.write(JSON.stringify({ok:true,agent_session,native_session_id:config.expected_native_session_id})+'\n');
}catch(error){await writeFile(path.join(config.output,'failure.json'),JSON.stringify({error:String(error)},null,2));throw error;}finally{
 try{if(opened&&native){const closed=await native({op:'expression',request:{operation:'close',expression_ref:opened.document.expression_ref,actor:'agent:nara-native-verification'}});assert.equal(closed.state,'closed');await writeFile(path.join(config.output,'closed.json'),JSON.stringify(closed,null,2));}}finally{await server.close();}
}
