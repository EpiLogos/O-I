/** Production dictation client against the actual native kernel. No fake
 * speech server, browser storage substitute, microphone or provider call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readDictationStipulation,writeSttUrl,DEFAULT_STT_URL} from '../src/dictation/store.ts';
import {probeTranscriptionEndpoint,transcribeWav} from '../src/dictation/client.ts';
import {encodeWav16kMono} from '../src/dictation/wav.ts';

test('native dictation persists revisions, refuses remote targets and forged captures, and probes before any microphone',{skip:process.env.OI_NATIVE_DICTATION!=='1',timeout:90000},async()=>{
 assert.ok(process.env.OI_KERNEL_BIN,'OI_KERNEL_BIN names the current native bridge');
 const home=await mkdtemp(join(tmpdir(),'oi-dictation-native-'));let child,transport,stderr='';
 const start=async()=>{child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home,CURL_HOME:home},stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{text+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});transport={kind:'bridge',url};};
 const stop=async()=>{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}};
 try{
  await writeFile(join(home,'.curlrc'),`stderr = "${join(home,'inherited-curlrc-output')}"\n`);
  await start();assert.deepEqual(await readDictationStipulation(transport),{revision:0,stt_url:DEFAULT_STT_URL});
  for(const url of ['https://speech.example/inference','http://user:secret@127.0.0.1/inference','http://localhost.evil/inference','file:///tmp/audio','http://127.0.0.1/#redirect'])await assert.rejects(writeSttUrl(url,transport));
  const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const saved=await writeSttUrl(`http://127.0.0.1:${port}/inference`,transport);assert.equal(saved.revision,1);
  assert.equal((await writeSttUrl(saved.stt_url,transport)).revision,1,'no-op does not bump revision');
  assert.ok((await kernelOp(transport,{op:'dictation_configure',stt_url:DEFAULT_STT_URL,expected_revision:0})).error,'stale revision refused');
  await stop();await start();assert.deepEqual(await readDictationStipulation(transport),saved,'native configuration survives restart');
  await assert.rejects(probeTranscriptionEndpoint(transport),failure=>failure.kind==='service-down'&&failure.endpoint===saved.stt_url);
  await assert.rejects(access(join(home,'inherited-curlrc-output')),'native bounded transport must ignore inherited curl configuration');
  const forged=await transcribeWav(transport,'invented-capture-ref',encodeWav16kMono(new Float32Array(48)));assert.equal(forged.kind,'failed');assert.match(forged.detail,/capture|probe|lease/i);
  assert.deepEqual(JSON.parse(await readFile(join(home,'desktop/dictation.json'),'utf8')),saved);
  await writeFile(join(home,'desktop/dictation.json'),'not valid JSON');await assert.rejects(readDictationStipulation(transport),'invalid native state is visible, never defaulted');
 }finally{await stop();await rm(home,{recursive:true,force:true});}
});
