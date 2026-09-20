#!/usr/bin/env node
// Start only by explicit local human action. No fake devices, automatic
// permissions, user-profile reuse, machine setup or provider calls.
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const args=process.argv.slice(2);assert.equal(args[0],'--consent-microphone-audio','Run locally with --consent-microphone-audio, then grant permission yourself');
const endpoint=new URL(args[1]??'http://127.0.0.1:8080/inference');
assert.ok(['http:','https:'].includes(endpoint.protocol)&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)&&!endpoint.username&&!endpoint.password,'An existing loopback speech endpoint without embedded credentials is required');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(args[2]??`walk/artifacts/local-audio-${Date.now()}.json`);
const words=[['quiet','bright','gentle','silver'],['river','garden','meadow','ocean'],['morning','window','evening','sunlight']];const phrase=words.map(group=>group[randomInt(group.length)]).join(' ');
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/local-audio',async(_request,response)=>{response.setHeader('content-type','text/html');response.end(await server.transformIndexHtml('/local-audio','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="oi-desktop"><script type="module" src="/tests/local-audio-page.ts"></script></body></html>'));});
await server.listen();let browser;let receipt={classification:'unexecuted real-audio check',passed:false};
try{
 browser=await chromium.launch({headless:false});const page=await browser.newPage({viewport:{width:1000,height:760}});
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/local-audio?${new URLSearchParams({endpoint:endpoint.href,phrase})}`);
 await page.waitForFunction(()=>window.localAudio?.done,null,{timeout:300000});receipt=await page.evaluate(()=>window.localAudio);
 assert.equal(receipt.passed,true,'Audio acceptance was not observed');
}catch(error){receipt={...receipt,error:String(error),passed:false};process.exitCode=1;}
finally{await browser?.close();await server.close();mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(out);}
