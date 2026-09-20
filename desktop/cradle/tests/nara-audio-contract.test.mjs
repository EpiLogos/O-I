import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {once} from 'node:events';
import {BrowserSpeechAudio} from '../src/nara/audio.ts';import {encodeWav16kMono} from '../src/dictation/wav.ts';import {attachment,deferred} from './nara-runtime-fixtures.mjs';

test('HTTP adapter sends real multipart WAV and configured TTS JSON to loopback service',async()=>{
 const requests=[];const wav=await encodeWav16kMono(new Float32Array(1600)).arrayBuffer();
 const server=createServer(async(req,res)=>{let body=Buffer.alloc(0);for await(const chunk of req)body=Buffer.concat([body,chunk]);requests.push({url:req.url,headers:req.headers,body});if(req.url==='/inference'){res.setHeader('content-type','application/json');res.end(JSON.stringify({text:'Returned transcript'}));}else{res.setHeader('content-type','audio/wav');res.end(Buffer.from(wav));}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 try{const routes=attachment().speech;routes.stt.endpoint=`http://127.0.0.1:${port}/inference`;routes.tts.endpoint=`http://127.0.0.1:${port}/v1/audio/speech`;
 const audio=new BrowserSpeechAudio(),signal=new AbortController().signal;
 assert.equal(await audio.transcribe(new Blob([wav],{type:'audio/wav'}),routes,signal),'Returned transcript');
 const returned=await audio.synthesize('The actual native reply',routes,signal);assert.equal(returned.size,wav.byteLength);
 assert.equal(requests.length,2);assert.match(requests[0].headers['content-type'],/^multipart\/form-data; boundary=/);
 assert.ok(requests[0].body.includes(Buffer.from('RIFF')));assert.ok(requests[0].body.includes(Buffer.from('name="response_format"')));
 assert.deepEqual(JSON.parse(requests[1].body.toString()),{model:routes.tts.model,input:'The actual native reply',voice:routes.tts.voice,response_format:'wav'});
 assert.equal(requests[0].headers.authorization,undefined);assert.equal(requests[1].headers.cookie,undefined);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('empty STT, HTTP failures, oversized bodies and invalid WAV never become speech',async()=>{
 const original=globalThis.fetch;const audio=new BrowserSpeechAudio(),routes=attachment().speech,signal=new AbortController().signal;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({text:''}));await assert.rejects(audio.transcribe(new Blob(['wav']),routes,signal),/no transcript/);
  globalThis.fetch=async()=>new Response('private provider error',{status:503});await assert.rejects(audio.synthesize('text',routes,signal),/HTTP 503/);
  globalThis.fetch=async()=>new Response('x',{headers:{'content-length':String(33*1024*1024)}});await assert.rejects(audio.synthesize('text',routes,signal),/audio limit/);
  globalThis.fetch=async()=>new Response('<html>no audio</html>');await assert.rejects(audio.synthesize('text',routes,signal),/WAV/);
 }finally{globalThis.fetch=original;}
});
test('HTTP redirect is refused rather than sending private speech onward',async()=>{
 const server=createServer((_req,res)=>{res.writeHead(307,{location:'https://example.invalid/collect'});res.end();});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const routes=attachment().speech;routes.stt.endpoint=`http://127.0.0.1:${server.address().port}/inference`;await assert.rejects(new BrowserSpeechAudio().transcribe(new Blob(['wav']),routes,new AbortController().signal));}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('physical-input permission race stops every late stream track before creating WebAudio',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator'),gate=deferred();let stopped=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>gate.promise}}});
 try{const c=new AbortController(),audio=new BrowserSpeechAudio(),pending=audio.capture(c.signal);c.abort();gate.resolve({getTracks:()=>[{stop:()=>stopped++}]});await assert.rejects(pending,{name:'AbortError'});assert.equal(stopped,1);}
 finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
test('playback phase is driven by actual onplaying and interruption releases media URL',async()=>{
 const previous=globalThis.Audio,create=URL.createObjectURL,revoke=URL.revokeObjectURL;let instance,started=0,revoked=0;
 globalThis.Audio=class {constructor(){instance=this;}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){}};
 URL.createObjectURL=()=> 'blob:controlled';URL.revokeObjectURL=()=>{revoked++;};
 try{const c=new AbortController(),audio=new BrowserSpeechAudio(),play=audio.play(new Blob(['wav']),c.signal,()=>started++);await Promise.resolve();assert.equal(started,0);instance.onplaying();assert.equal(started,1);c.abort();await assert.rejects(play,{name:'AbortError'});assert.equal(revoked,1);assert.equal(instance.onplaying,null);audio.stop();assert.equal(revoked,1);}
 finally{globalThis.Audio=previous;URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
