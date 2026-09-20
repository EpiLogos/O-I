/** Controlled browser evidence: production React + WebAudio + real HTTP,
 * synthetic input and explicitly labelled protocol owners, NOT a live model
 * or native macOS permission/experience verdict. Never touches existing ports. */
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import {attachment,controlledOwner,expression,fixture} from './nara-runtime-fixtures.mjs';
import {encodeWav16kMono} from '../src/dictation/wav.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),artifacts=new URL('./artifacts/nara-native/',import.meta.url);
const a=attachment(),owner=controlledOwner('Controlled native response; not an inference-model result.');
let doc=expression(a.context),stt=0,tts=0,sourceOpens=0;
const requests=[],checks=[],errors=[];
const snapshot={focus:{},surfaces:{},buffers:{}};
const wav=Buffer.from(await encodeWav16kMono(new Float32Array(32000)).arrayBuffer());
const bridge=httpServer(async(req,res)=>{
 res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','content-type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url.startsWith('/events')){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,receipts:[]}));return;}
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
  if(req.url==='/inference'){stt++;assert.ok(bytes.includes(Buffer.from('RIFF')));res.setHeader('content-type','application/json');res.end(JSON.stringify({text:'Controlled microphone transcript'}));return;}
  if(req.url==='/v1/audio/speech'){tts++;const body=JSON.parse(bytes);assert.equal(body.voice,a.speech.tts.voice);assert.equal(body.model,a.speech.tts.model);res.setHeader('content-type','audio/wav');res.end(wav);return;}
  const op=JSON.parse(bytes);requests.push(op);let outcome;
  switch(op.op){
   case 'state':outcome={result:'state',snapshot};break;
   case 'sources_list':outcome={result:'sources_listed',listing:{schema:'test',project:'test-project',sources:[],availability:'horizon'}};break;
   case 'source_open':{sourceOpens++;const content=JSON.stringify(a);outcome={result:'source_opened',buffer:{source_ref:op.source_ref,project:'test-project',world_ref:'world/test',content,saved_content:content,base_revision:'source-revision/1',dirty:false}};break;}
   case 'surface_open':snapshot.surfaces[op.surface_id]={...op};outcome={result:'surface_opened',snapshot};break;
   case 'encounter':{const binding=op.request.agent_session===a.epii.agent_session?a.epii:a.dialogue;outcome={result:'encounter_reading',data:await owner.call(binding,op.request)};break;}
   case 'expression':outcome={result:'expression',data:{document:doc,state:'ready'}};break;
   case 'expression_world':{
    const r=op.request;let data;
    if(r.operation==='selection_read')data={selection:{subject_ref:a.context.pointed_ref,kind:'relation',native_owner:'ql',revision:'source-rev/7',origin:'expression',expression_ref:a.context.expression_ref}};
    else if(r.operation==='act_perform'){assert.equal(r.expected_revision,doc.revision);doc.revision++;doc.selection={scene_ref:r.changes[0].scene_ref,entity_ref:r.changes[0].entity_ref};data={state:'act_running'};}
    else if(r.operation==='act_interrupt')data={state:'act_held'};
    else if(r.operation==='act_checkpoint')data={state:'checkpointed'};
    else if(r.operation==='act_restore'){doc.revision++;data={state:'act_restored'};}
    else throw Error('Unexpected controlled world operation '+r.operation);
    outcome={result:'expression_world',data};break;
   }
   default:throw Error('Unserved controlled operation '+op.op);
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,outcome:{...outcome,receipts:[]}}));
 }catch(error){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:error.message}));}
});
bridge.listen(0,'127.0.0.1');await once(bridge,'listening');const bridgeURL=`http://127.0.0.1:${bridge.address().port}`;
a.speech.stt.endpoint=bridgeURL+'/inference';a.speech.tts.endpoint=bridgeURL+'/v1/audio/speech';
const server=await createServer({configFile:false,root,appType:'custom',plugins:[react()],resolve:{alias:{'@epilogos/oi-design-system':fileURLToPath(new URL('../../../packages/oi-design-system/',import.meta.url))}},server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/nara-native',async(_req,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/nara-native','<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root" style="width:900px;height:760px"></div><script type="module" src="/tests/nara-native-page.tsx"></script></body></html>'));});
await server.listen();let browser;
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label);};
try{
 browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1000,height:800},permissions:['microphone']});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(url=>{window.__OI_KERNEL_BRIDGE__=url;},bridgeURL);
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/nara-native`);
 await page.getByRole('button',{name:'Attach existing encounter'}).waitFor();check(owner.sendCount===0&&stt===0,'Entry has no microphone, inference or native session effect');
 await page.getByLabel('Nara attachment source').fill('source/test/private-attachment');await page.getByRole('button',{name:'Attach existing encounter'}).click();await page.getByLabel('Message to Nara').waitFor();
 check(owner.requests.every(r=>r.action==='view'),'Attach reads existing session rather than creating one');
 check(await page.getByRole('button',{name:'Start microphone turn'}).isDisabled(),'Microphone is disabled until explicit voice consent');
 await page.getByLabel('Message to Nara').fill('Private controlled draft');await page.evaluate(()=>window.naraNativeTest.unmount());await page.evaluate(()=>window.naraNativeTest.mount());
 await page.getByLabel('Message to Nara').waitFor();check(await page.getByLabel('Message to Nara').inputValue()==='Private controlled draft','Presentation remount preserves the same private draft and attachment');
 await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='idle');
 await page.getByRole('button',{name:'Context and transcript',exact:true}).click();check((await page.getByRole('log').innerText()).includes(owner.answer),'Text displays the actual attributed native response');
 check(!(await page.getByRole('log').innerText()).includes('PRIVATE THOUGHT'),'Provider private thoughts never become transcript');
 check(tts===0&&stt===0,'Text-only path invokes no acoustic services');
 await page.getByLabel('Enable Nara voice').check();check(stt===0,'Enabling voice alone does not start microphone');
 await page.getByRole('button',{name:'Start microphone turn'}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='listening');
 await page.waitForTimeout(300);await page.getByRole('button',{name:'Finish microphone turn'}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='speaking');
 check(stt===1&&tts===1,'Real browser capture, multipart STT, native response and WAV playback form one controlled turn');
 await page.getByRole('button',{name:'Stop audio and hold'}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='interrupted');
 check(!owner.requests.some(r=>r.action==='cancel'),'Local interruption does not fabricate a provider cancel or cancel a peer turn');
 await page.getByLabel('Enable Nara voice').uncheck();owner.failSend=true;
 await page.getByLabel('Message to Nara').fill('Lost acknowledgement');await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='error');const sent=owner.sendCount;
 await page.getByRole('button',{name:'Recover original response'}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='idle');check(owner.sendCount===sent,'Uncertain delivery recovery reads the original result without resending');owner.failSend=false;
 owner.state='Disconnected';await page.getByRole('button',{name:'Reconnect same encounter'}).click();await page.waitForFunction(()=>document.querySelector('[data-nara-phase]')?.dataset.naraPhase==='idle');
 check(owner.requests.find(r=>r.action==='reconnect')?.agent_session===a.dialogue.agent_session,'Reconnect retains exact native AgentSession');
 const beforeSource=sourceOpens;await page.getByRole('button',{name:'Include current selection'}).click();check(sourceOpens===beforeSource,'Exact relation disclosure reads no private source body');
 owner.answer=turn=>{const {delegation:d}=JSON.parse(turn.packet.text),e=fixture('nara-epii-delegation-v1.json').enrichment;return JSON.stringify({...e,delegation_ref:d.delegation_ref,basis_context_ref:d.basis.context_ref,basis_expression_revision:d.basis.expression_revision,proposed_focus_refs:[a.context.pointed_ref]});};
 await page.getByLabel('Ask Epii for deeper inquiry').fill('Explain the selected relation');await page.getByRole('button',{name:'Delegate selected basis'}).click();await page.getByRole('button',{name:'Accept focus only'}).waitFor();
 const prior=doc.revision;await page.getByRole('button',{name:'Reject without mutation'}).click();check(doc.revision===prior,'Epii rejection leaves native Expression unchanged');
 check(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('Private controlled'),'Private dialogue is absent from browser persistence');
 await page.getByRole('button',{name:'Delegate selected basis'}).click();await page.getByRole('button',{name:'Accept focus only'}).last().click();await page.getByRole('button',{name:'Checkpoint performed state'}).waitFor();check(doc.revision===prior+1&&doc.selection.entity_ref==='entity/a','Authorised focus operates the exact source-bound native entity');
 await page.getByRole('button',{name:'Checkpoint performed state'}).click();await page.getByRole('button',{name:'Restore native draft checkpoint'}).click();await page.waitForTimeout(100);check(doc.revision===prior+2,'Checkpoint restore has native revision readback, not GPU rewind');
 await page.evaluate(()=>window.naraNativeTest.unmount());await page.evaluate(()=>window.naraNativeTest.mount());await page.getByLabel('Message to Nara').waitFor();check(owner.requests.filter(r=>['start','open','draft','prompt'].includes(r.action)).length===0,'No layout transition remints identities or overwrites the ordinary human composer');
 check(errors.length===0,'No browser runtime errors');await mkdir(artifacts,{recursive:true});await page.screenshot({path:fileURLToPath(new URL('controlled.png',artifacts)),fullPage:true});
}finally{
 await mkdir(artifacts,{recursive:true});await writeFile(new URL('receipt.json',artifacts),JSON.stringify({standing:'controlled-browser-not-live-provider-or-native-Mac',checks,errors,stt,tts},null,2));await browser?.close();await server.close();bridge.closeAllConnections();await new Promise(resolve=>bridge.close(resolve));
}
