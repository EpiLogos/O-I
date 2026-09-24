/** Real native producer -> production kernel/relay -> actual embedded stage.
 * Central disclosure alone is controlled; no fake field/PCM/M1/M2/M3 outputs.
 * Runs only with explicit binaries/input. Never connects to installed machines. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir,platform,cpus} from 'node:os';
import {createHash} from 'node:crypto';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
const paths={bridge:process.env.NATIVE_EXPRESSION_BRIDGE,host:process.env.OI_QL_FIELD_HOST_BIN,worker:process.env.OI_QL_FIELD_WORKER_BIN,input:process.env.NATIVE_EXPRESSION_INPUT};
for(const [name,path] of Object.entries(paths))assert.ok(path&&path.startsWith('/'),`Explicit absolute ${name} path required; no PATH or fixture fallback`);
const out=resolve(process.env.NATIVE_EXPRESSION_OUT??'walk/artifacts/native-expression-native');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'native-expression-joined-')),input=JSON.parse(await readFile(paths.input,'utf8'));
const report={schema:'oi.native-expression-joined-browser/v1',standing:'real C/Rust/C++ owner and WebGL; controlled Central disclosure and captured input; not installed Mac, live ephemeris, measured material or speaker/microphone evidence',checks:[],timings_ms:[],sources:{},machine:{platform:platform(),logical_cpus:cpus().length},pass:false};
for(const [name,path] of Object.entries(paths))report.sources[name]={path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')};
const central=join(temp,'central.py');
await writeFile(central,`#!/usr/bin/env python3
import json,pathlib,sys,hashlib
root=pathlib.Path(__file__).parent
content=(root/'binding.json').read_text()
def location(path):return {'schema':'central.path-ref/v1','ref':'controlled:path:'+path,'root':'controlled:root','path':path}
action=sys.argv[-2]
if action=='central.files.list':
 data={'schema':'central.directory-reading/v1','location':location('.'),'entries':[{'name':'binding.json','location':location('binding.json'),'kind':'file','byte_len':len(content.encode()),'retrieval_allowed':True}],'automatic_agent_or_model_invocation':False}
elif action=='central.files.read':
 data={'schema':'central.file-reading/v1','location':location('binding.json'),'revision':hashlib.sha256(content.encode()).hexdigest(),'byte_len':len(content.encode()),'content_encoding':'utf-8','content':content,'project':None,'source':None,'automatic_agent_or_model_invocation':False}
else:raise RuntimeError('Unexpected disclosure action '+action)
print(json.dumps({'ok':True,'data':data}))
`);await chmod(central,0o700);
const bridge=spawn(paths.bridge,['127.0.0.1:0'],{env:{...process.env,OI_BIN:central,OI_CENTRAL_ROOT:temp,OI_CENTRAL_PROJECT_QUERY:''},stdio:['ignore','pipe','pipe']});
let bridgeLog='',bridgeErr='';bridge.stdout.on('data',x=>bridgeLog+=x);bridge.stderr.on('data',x=>bridgeErr+=x);
const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('native kernel bridge startup timed out')),15000);bridge.once('error',reject);bridge.once('exit',code=>{clearTimeout(timer);reject(new Error(`bridge exited ${code}: ${bridgeErr}`));});bridge.stdout.on('data',()=>{const match=bridgeLog.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});});
let latestSources=null,lease=null,opens=0,closes=0,pcm=false,disconnect=false,observedClose;
const terminalClose=new Promise(resolve=>{observedClose=resolve;});
const frames=new Map(),key=frame=>`${frame.generation}:${frame.samples_elapsed}`;
await build({stdin:{contents:`import {relayNativeChannel} from './src/expressions/nativeChannel.ts'; window.disposeRelay=relayNativeChannel(document.querySelector('iframe'),{kind:'bridge',url:location.origin});`,resolveDir:resolve('.')},bundle:true,platform:'browser',format:'esm',outfile:join(temp,'parent.js')});
const html=await readFile('expressions-app/field-studies-journeys/public/index.html');
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'&&req.url==='/op'){
  const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks),op=JSON.parse(bytes);
  if(disconnect&&op.request?.operation==='exchange')throw new Error('explicit test transport disconnection after real native effects');
  const start=performance.now();const response=await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body:bytes});const result=await response.json();report.timings_ms.push({operation:op.request?.request?.command?.operation??op.request?.operation??op.op,elapsed:performance.now()-start});
  const data=result.outcome?.data;
  if(data?.schema==='oi.native-expression-open/v1'){opens++;lease=data.lease;frames.set(key(data.receipt.field),data.receipt.field);}
  if(data?.schema==='oi.native-expression-closed/v1'){closes++;lease=null;observedClose();}
  if(data?.field){frames.set(key(data.field),data.field);if(frames.size>128)frames.delete(frames.keys().next().value);if(data.field.audio.some(x=>Math.abs(x)>1e-8))pcm=true;}
  if(data?.sources)latestSources=data.sources;
  res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
 }
 if(req.url==='/parent.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(temp,'parent.js')));return;}
 res.setHeader('content-type','text/html');res.end(req.url?.startsWith('/app')?html:'<!doctype html><style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/app?host=expressions"></iframe><script type="module" src="/parent.js"></script>');
 }catch(error){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:String(error)}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const hardwareGPU=process.env.NATIVE_EXPRESSION_GPU==='hardware';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:hardwareGPU?[]:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
const interrupt=()=>{report.failure='Explicit local test interruption';void browser.close();};process.once('SIGTERM',interrupt);
report.browser=browser.version();report.renderer=hardwareGPU?'default browser GPU requested; actual renderer below':'Chromium software WebGL / SwiftShader';report.viewport='1100x800';
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);const frame=page.frames().find(f=>f!==page.mainFrame());
 // Entry gate is the ordinary New/Continue/Open front door; dismiss before the
 // field admits topology or native depth (gate can withhold the living stage).
 const dismiss=frame.locator('#entry-gate:not([hidden]) [data-action="entry-dismiss"]');
 if(await dismiss.count()){
  await dismiss.click();
  await frame.waitForFunction(()=>document.querySelector('#entry-gate')?.hasAttribute('hidden'),null,{timeout:5000});
 }
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.native()?.renderer_requirements?.slot_count>0,null,{timeout:60000});
 const topology=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().renderer_requirements);report.topology=topology;
 report.gpu=await frame.evaluate(()=>{for(const canvas of document.querySelectorAll('canvas')){const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info');return{vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};}}return{renderer:'unavailable'};});
 const count=topology.slot_count,samples=input.field.samples.length;
 // Explicit TEST geometry correspondence; never inserted into production.
 const binding={schema:'oi.native-expression-binding/v1',host:{instance_ref:'controlled:joined-browser',basis:input.basis,field:input.field},presentation:{units_per_metre:400,slots_a:Array.from({length:count},(_,i)=>i%samples),slots_b:Array.from({length:count},(_,i)=>(i+1)%samples)}};
 await writeFile(join(temp,'binding.json'),JSON.stringify(binding));
 await frame.locator('.native-field-panel>summary').click();await frame.locator('[name="native-path"]').fill('binding.json');await frame.locator('[data-native="source"]').click();await frame.locator('[data-native="connect"]').click();
 await frame.waitForFunction(()=>['following','held','unavailable'].includes(window.__FIELD_STUDIES__.native().status),null,{timeout:20000});
 assert.equal(await frame.evaluate(()=>window.__FIELD_STUDIES__.native().status),'following',await frame.locator('[data-native-status]').textContent());
 await frame.waitForFunction(()=>Number(window.__FIELD_STUDIES__.native().native?.presented.samples_elapsed)>0,null,{timeout:15000});
 assert.ok(pcm,'actual native PCM is nonzero');assert.equal(opens,1);report.checks.push('complete real native producer opens once and delivers nonzero PCM plus retained targets');
 await frame.locator('[data-native="hold"]').click();await page.waitForTimeout(200);
 const held=await frame.evaluate(()=>({reading:window.__FIELD_STUDIES__.native(),targets:Array.from(window.__FIELD_STUDIES__.nativeTargets().target_a).slice(0,32),positions:window.__FIELD_STUDIES__.inspect(true).positions}));
 const native=frames.get(`${held.reading.native.presented.generation}:${held.reading.native.presented.samples_elapsed}`);assert.ok(native,'presented cursor must name an actual native reply');
 for(let slot=0;slot<8;slot++)for(let axis=0;axis<3;axis++)assert.equal(held.targets[slot*4+axis],Math.fround(Math.fround(native.targets[slot%samples].position[axis])*400));
 await page.waitForTimeout(150);assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.inspect(true).positions),held.positions);report.checks.push('actual C++ coordinates reach exact mapped GPU slots; hold preserves particle positions');
 assert.equal(held.reading.domain.m3.sequence,latestSources.current.m3.transcription.sequence);
 await frame.waitForFunction(()=>document.querySelector('[data-transcription]')?.textContent.includes(window.__FIELD_STUDIES__.native().domain.m3.sequence));
 assert.equal(held.reading.domain.m1.coordinate,latestSources.current.m1.config.selected_coordinate);report.checks.push('M1 carrier and M3 transcription consume the real inspected outputs');
 await frame.locator('summary').filter({hasText:'Native domain controls'}).click();
 const tick12=(held.reading.domain.m1.tick12+1)%12;
 await frame.locator('[name="native-tick"]').fill(String(tick12));await frame.locator('[data-native="tick"]').click();
 await frame.waitForFunction(expected=>window.__FIELD_STUDIES__.native().domain?.m1.tick12===expected,tick12,{timeout:15000});
 assert.notDeepEqual(latestSources.current.m1.carrier.quadrature,held.reading.domain.m1.quadrature);
 await frame.waitForFunction(()=>document.querySelector('[data-carrier]')?.getAttribute('x2')===String(window.__FIELD_STUDIES__.native().domain.m1.quadrature[0]));
 report.checks.push('native M1 carrier tick changes returned quadrature and the actual stage vector without a renderer oscillator');
 const priorRNA=held.reading.domain.m3.rna;await frame.locator('[name="native-rna"]').selectOption(String(!priorRNA));await frame.locator('[data-native="transcription"]').click();
 await frame.waitForFunction(expected=>window.__FIELD_STUDIES__.native().domain?.m3.rna===expected,!priorRNA,{timeout:15000});
 assert.equal(latestSources.current.m3.transcription.rna,!priorRNA);assert.deepEqual(latestSources.original.input,input.basis);report.checks.push('M3 transcription edit returns real new source output without replacing original evidence');
 const mode=held.reading.domain.m2.modes[0],damping=mode.damping_per_second+.125;await frame.locator('[name="native-damping"]').fill(String(damping));await frame.locator('[data-native="damping"]').click();
 await frame.waitForFunction(expected=>window.__FIELD_STUDIES__.native().domain?.m2.modes[0].damping_per_second===expected,damping,{timeout:15000});
 assert.equal(latestSources.current.m2.resonator.modes[0].damping_per_second,damping);report.checks.push('M2 damping reaches the actual material owner with a newer coupled generation');
 await frame.locator('[name="native-phase"]').fill('179');await frame.locator('[data-native="axis"]').click();
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.nativeTargets()?.native?.clock?.inscription?.half_degrees===179,null,{timeout:15000});
 report.checks.push('continuous native phase is consumed without advancing a second renderer clock');
 await frame.locator('[data-native="hold"]').click();await page.screenshot({path:join(out,'native-domain.png')});
 await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({v:1,kind:'host-mode',mode:'techne'},'*'));await frame.waitForFunction(()=>window.__FIELD_STUDIES__.getState().hostMode==='techne');
 assert.equal(await frame.evaluate(()=>window.__FIELD_STUDIES__.native().lease),lease);assert.equal(opens,1);report.checks.push('host-mode switch retains native lease and app subject');
 disconnect=true;await frame.locator('[data-native="resume"]').click();await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='unavailable',null,{timeout:15000});
 const frozen=await frame.evaluate(()=>({state:window.__FIELD_STUDIES__.inspect(true),cursor:window.__FIELD_STUDIES__.native().native.acknowledged}));
 // Unavailability stops simulation immediately; the one required asynchronous
 // close must finish before a no-further-request assertion is meaningful.
 let closeTimer;try{await Promise.race([terminalClose,new Promise((_,reject)=>{closeTimer=setTimeout(()=>reject(new Error('native teardown did not finish')),6000);})]);}finally{clearTimeout(closeTimer);}
 assert.equal(closes,1);const stopped=report.timings_ms.length;await page.waitForTimeout(200);assert.equal(report.timings_ms.length,stopped);
 const after=await frame.evaluate(()=>({state:window.__FIELD_STUDIES__.inspect(true),cursor:window.__FIELD_STUDIES__.native().native.acknowledged}));
 assert.deepEqual(after.state.positions,frozen.state.positions);assert.deepEqual(after.state.velocities,frozen.state.velocities);assert.deepEqual(after.cursor,frozen.cursor);
 report.checks.push('disconnected producer stops GPU position, velocity, native cursor and request retries after its single required close');
 await frame.locator('[data-native="disconnect"]').click();await page.waitForTimeout(100);assert.equal(closes,1);
 await page.evaluate(()=>{window.disposeRelay();document.querySelector('iframe').remove();});await page.waitForTimeout(100);assert.equal(closes,1);assert.deepEqual(errors,[]);report.checks.push('native owner released exactly once');
 report.measurement={standing:'bounded single scenario, not sustained real-time performance acceptance',latency_by_operation:{}};
 for(const operation of new Set(report.timings_ms.map(x=>x.operation))){const values=report.timings_ms.filter(x=>x.operation===operation).map(x=>x.elapsed).sort((a,b)=>a-b);report.measurement.latency_by_operation[operation]={count:values.length,mean_ms:values.reduce((a,b)=>a+b,0)/values.length,p95_ms:values[Math.ceil(values.length*.95)-1],max_ms:values.at(-1)};}
 report.pass=true;report.requests={opens,closes};report.final_sources=latestSources;console.log(JSON.stringify({...report,final_sources:'retained in artifact'},null,2));
}catch(error){report.failure=String(error);report.reading=await page.frames().find(f=>f!==page.mainFrame())?.evaluate(()=>window.__FIELD_STUDIES__?.native()).catch(()=>null);await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error;}
finally{
 process.removeListener('SIGTERM',interrupt);
 if(lease)await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'native_expression',request:{operation:'close',lease}})}).catch(()=>{});
 await writeFile(join(out,'joined.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(out,'kernel.log'),bridgeLog+'\n'+bridgeErr);
 await browser.close();await new Promise(r=>server.close(r));bridge.kill();await rm(temp,{recursive:true,force:true});
}
