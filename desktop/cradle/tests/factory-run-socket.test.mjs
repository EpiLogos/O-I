import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {mkdtemp,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {existingExpressionSocket} from '../walk/factory-run-socket.mjs';
async function server(t,handler){const directory=await mkdtemp(join(tmpdir(),'factory-socket-'));const path=join(directory,'expression.sock');const instance=net.createServer(handler);instance.listen(path);await once(instance,'listening');await chmod(path,0o600);t.after(async()=>{await new Promise(resolve=>instance.close(resolve));await rm(directory,{recursive:true,force:true});});return {path,instance,directory};}
test('socket client uses the native newline-delimited Request without a KernelOp wrapper',async t=>{let wire;const h=await server(t,client=>client.on('data',chunk=>{wire=JSON.parse(String(chunk));client.end(JSON.stringify({ok:true,outcome:{result:'expression',data:{state:'ready'}}})+'\n');}));const request={operation:'inspect',expression_ref:'expression:local'};assert.equal((await existingExpressionSocket(h.path,request)).ok,true);assert.deepEqual(wire,request);});
test('native refusal remains a refusal receipt rather than a transport success claim',async t=>{const h=await server(t,client=>client.on('data',()=>client.end('{"ok":false,"error":"authority denied"}\n')));assert.deepEqual(await existingExpressionSocket(h.path,{operation:'inspect'}),{ok:false,error:'authority denied'});});
test('disconnected native socket cannot pass',async t=>{const h=await server(t,()=>{});await new Promise(resolve=>h.instance.close(resolve));await assert.rejects(existingExpressionSocket(h.path,{operation:'inspect'}));});
test('world-accessible socket is refused before connecting',async t=>{let connected=false;const h=await server(t,()=>{connected=true;});await chmod(h.path,0o666);await assert.rejects(existingExpressionSocket(h.path,{operation:'inspect'}),/other users/);assert.equal(connected,false);});
test('truncated native reply cannot pass',async t=>{const h=await server(t,client=>client.on('data',()=>client.end('{"ok":true}')));await assert.rejects(existingExpressionSocket(h.path,{operation:'inspect'}),/complete response/);});
test('timeout never automatically replays a request',async t=>{let count=0;const h=await server(t,client=>client.on('data',()=>count++));await assert.rejects(existingExpressionSocket(h.path,{operation:'inspect'},{timeoutMs:30}),/no request was replayed/);assert.equal(count,1);});
test('reply budget is enforced',async t=>{const h=await server(t,client=>client.on('data',()=>client.end('x'.repeat(200))));await assert.rejects(existingExpressionSocket(h.path,{operation:'inspect'},{limit:100}),/reply exceeds/);});
