/** The Jankó surface in the real Expressions app, played, and measured in the sound it schedules.
 * QL compose → O:I kernel bridge → ql-field-host + C++ worker → iframe relay → InstrumentSession →
 * the panel's Jankó keys. A silent key (no voice of this sky at its note) is the negative control; a
 * sounding key strikes exactly the voices the owner's `played_addresses` names, and that voice's own
 * frequency must rise in the PCM blocks the page scheduled on its Web Audio graph.
 * Standing: real owners and a real browser page with SwiftShader WebGL; scheduled PCM, not speaker
 * output, and not a listening. Env: NATIVE_EXPRESSION_BRIDGE OI_QL_BIN OI_QL_FIELD_HOST_BIN
 * OI_QL_FIELD_WORKER_BIN (absolute); NATIVE_EXPRESSION_OUT for artifacts. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir,platform,cpus} from 'node:os';
import {createHash} from 'node:crypto';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
const paths={bridge:process.env.NATIVE_EXPRESSION_BRIDGE,ql:process.env.OI_QL_BIN,host:process.env.OI_QL_FIELD_HOST_BIN,worker:process.env.OI_QL_FIELD_WORKER_BIN};
for(const [name,path] of Object.entries(paths))assert.ok(path&&path.startsWith('/'),`Explicit absolute ${name} path required; no PATH or fixture fallback`);
const out=resolve(process.env.NATIVE_EXPRESSION_OUT??'walk/artifacts/native-expression-janko');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'native-expression-janko-'));
const report={schema:'oi.native-expression-janko-trace/v1',
 standing:'real QL compose, K8 C++ owner, O:I kernel relay and the app\'s own Jankó panel; PCM scheduled on the page\'s Web Audio graph; SwiftShader WebGL; not speaker output and not a listening',
 checks:[],failures:[],sources:{},machine:{platform:platform(),logical_cpus:cpus().length},pass:false};
for(const [name,path] of Object.entries(paths))report.sources[name]={path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')};
const central=join(temp,'central.py');
await writeFile(central,`#!/usr/bin/env python3\nimport json\nraise SystemExit(json.dumps({'ok':False,'error':'controlled Central: compose reads no Central file'}))\n`);await chmod(central,0o700);
const bridge=spawn(paths.bridge,['127.0.0.1:0'],{env:{...process.env,OI_BIN:central,OI_CENTRAL_ROOT:temp,OI_CENTRAL_PROJECT_QUERY:'',OI_QL_BIN:paths.ql,OI_QL_SKY_BIN:'/usr/bin/false',OI_QL_FIELD_HOST_BIN:paths.host,OI_QL_FIELD_WORKER_BIN:paths.worker},stdio:['ignore','pipe','pipe']});
let bridgeLog='',bridgeErr='';bridge.stdout.on('data',x=>bridgeLog+=x);bridge.stderr.on('data',x=>bridgeErr+=x);
const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('kernel bridge startup timed out')),15000);bridge.once('error',reject);bridge.once('exit',code=>{clearTimeout(timer);reject(new Error(`bridge exited ${code}: ${bridgeErr}`));});bridge.stdout.on('data',()=>{const match=bridgeLog.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});});
await build({stdin:{contents:`import {relayNativeChannel} from './src/expressions/nativeChannel.ts'; window.disposeRelay=relayNativeChannel(document.querySelector('iframe'),{kind:'bridge',url:location.origin});`,resolveDir:resolve('.')},bundle:true,platform:'browser',format:'esm',outfile:join(temp,'parent.js')});
const html=await readFile('expressions-app/field-studies-journeys/public/index.html');
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'&&req.url==='/op'){
  const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks);
  const response=await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body:bytes});
  res.setHeader('content-type','application/json');res.end(JSON.stringify(await response.json()));return;
 }
 if(req.url==='/parent.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(temp,'parent.js')));return;}
 res.setHeader('content-type','text/html');res.end(req.url?.startsWith('/app')?html:'<!doctype html><style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/app?host=expressions"></iframe><script type="module" src="/parent.js"></script>');
 }catch(error){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:String(error)}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
report.browser=browser.version();
// Every PCM block the page schedules, with the page time it was scheduled at.
const probe=`(()=>{window.__PCM__=[];const copy=AudioBuffer.prototype.copyToChannel;AudioBuffer.prototype.copyToChannel=function(source,channel,offset){if(source&&source.length>=128&&window.__PCM__.length<600)window.__PCM__.push({at:performance.now(),samples:Array.from(source)});return copy.call(this,source,channel,offset);};})();`;
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const goertzel=(x,hz,rate)=>{const w=2*Math.PI*hz/rate,c=2*Math.cos(w);let a=0,b=0;for(const v of x){const n=v+c*a-b;b=a;a=n;}return Math.sqrt(a*a+b*b-c*a*b)/Math.max(1,x.length);};
const check=(ok,text,detail)=>(ok?report.checks:report.failures).push(detail?{check:text,...detail}:text);
const concat=blocks=>blocks.flatMap(b=>b.samples);
try{
 const context=await browser.newContext({viewport:{width:1100,height:900}});
 await context.addInitScript(probe);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const frame=page.frames().find(f=>f!==page.mainFrame());
 const dismiss=frame.locator('#entry-gate:not([hidden]) [data-action="entry-dismiss"]');
 if(await dismiss.count()){await dismiss.click();await frame.waitForFunction(()=>document.querySelector('#entry-gate')?.hasAttribute('hidden'),null,{timeout:5000});}
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.native()?.renderer_requirements?.slot_count>0,null,{timeout:60000});
 const toggle=frame.locator('.workspace-cluster>.header-menu-toggle');if(await toggle.isVisible())await toggle.click({force:true});
 await frame.locator('[data-action="studio"]').click({force:true});
 await frame.locator('[data-action="studio-section"][data-value="native"]').click({force:true});
 await frame.locator('.native-field-panel summary',{hasText:'Other openings'}).click();
 await frame.locator('[data-ni="open-default"]').click();
 page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('[page]',m.type(),m.text().slice(0,300));});
 frame.page().on('console',()=>{});
 {const deadline=Date.now()+240000;let last='';
  for(;;){const n=await frame.evaluate(()=>{const r=window.__FIELD_STUDIES__.native();return{status:r.status,reason:r.reason,influence:!!r.instrument?.influence};});
   const line=JSON.stringify(n);if(line!==last){console.log('[open]',line);last=line;}
   if(n.status==='following'&&n.influence)break;
   if(n.status==='unavailable')throw new Error(`instrument unavailable: ${n.reason}`);
   if(Date.now()>deadline)throw new Error(`instrument did not open: ${line}`);
   await settle(1000);}}
 const influence=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().instrument.influence);
 const played=influence.played_addresses;
 check(!!played&&played.by_class?.length===12&&played.janko?.rows===6&&played.janko?.touch_points===3,'the owner discloses played addresses and the six-row Jankó surface',{standing:played?.standing});
 // The surface in the app: six rows of keys, laid out from the owner's projection.
 const surface=await frame.evaluate(()=>({rows:document.querySelectorAll('.ni-janko-row').length,keys:document.querySelectorAll('button.ni-jk').length,disabled:document.querySelectorAll('button.ni-jk:disabled').length,silent:document.querySelectorAll('button.ni-jk[data-silent="true"]').length}));
 report.surface=surface;
 check(surface.rows===6&&surface.keys===6*played.janko.columns,'the app lays out six rows of keys from the owner\'s projection',surface);
 check(surface.disabled===0,'the keys are live while the field follows',surface);
 await frame.locator('[data-ni-janko-block]').scrollIntoViewIfNeeded();await settle(300);
 await page.screenshot({path:join(out,'janko-surface.png')});
 // Sound on: the page's graph must be audible-state for the note (PCM is scheduled either way).
 await frame.locator('[data-ni="sound"]').click();await settle(500);
 const soundingClass=played.by_class.find(c=>c.voices.length);
 const silentClass=played.by_class.find(c=>!c.voices.length);
 check(!!soundingClass&&!!silentClass,'this sky has both a sounding class and a silent class to discriminate',{sounding:soundingClass?.pitch_class,silent:silentClass?.pitch_class});
 const rate=48000,hzs=soundingClass.voices.map(v=>v.frequency_hz);
 const windowPower=blocks=>hzs.map(hz=>goertzel(concat(blocks),hz,rate));
 const lastBlocks=async n=>(await frame.evaluate(count=>window.__PCM__.slice(-count),n));
 const press=async cls=>{const key=frame.locator(`button.ni-jk[data-jk-class="${cls}"]`).first();await key.scrollIntoViewIfNeeded();return key;};
 const steady=async()=>{await settle(2500);};
 // A. negative control: a silent key must not raise any sounding voice.
 await steady();
 const beforeSilent=windowPower(await lastBlocks(6));
 const silentKey=await press(silentClass.pitch_class);await silentKey.click();await settle(200);
 const silentStatus=await frame.locator('.native-field-panel [data-ni-v="key"]').textContent();
 await settle(2000);
 const afterSilent=windowPower(await lastBlocks(6));
 const silentStrikes=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().instrument.played?.strikes??0);
 report.silent_key={pitch_class:silentClass.pitch_class,status:silentStatus,power_before:beforeSilent,power_after:afterSilent,strikes_sent:silentStrikes};
 check(silentStrikes===0&&/silent/.test(silentStatus),'a silent key sends no strike and says so',{silentStatus});
 check(afterSilent.every((p,i)=>p<=beforeSilent[i]*1.25),'a silent key leaves the sounding voices decaying (negative control)',{beforeSilent,afterSilent});
 // B. a sounding key strikes exactly its voices.
 await steady();
 const beforeBlocks=await lastBlocks(6),before=windowPower(beforeBlocks);
 const countBefore=await frame.evaluate(()=>window.__PCM__.length);
 const key=await press(soundingClass.pitch_class);
 const clickedAt=await frame.evaluate(()=>performance.now());
 await key.click();
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().instrument.played?.strikes>=1,null,{timeout:15000});
 await settle(2500);
 const after=await frame.evaluate(n=>window.__PCM__.slice(n),countBefore);
 const afterPower=windowPower(after.slice(0,8));
 const reading=await frame.evaluate(()=>{const n=window.__FIELD_STUDIES__.native();return{status:n.status,played:n.instrument.played,refusal:n.instrument.refusal,voices:n.instrument.influence.voices.map(v=>v.frequency_hz)};});
 report.sounding_key={pitch_class:soundingClass.pitch_class,voices:soundingClass.voices,power_before:before,power_after:afterPower,reading};
 check(reading.refusal===null&&reading.played?.strikes===1,'the sounding key sent exactly one strike and the owner accepted it',{played:reading.played});
 check(afterPower.every((p,i)=>p>3*before[i]),'the struck voices\' own frequencies rise in the PCM the page scheduled',{before,afterPower});
 check(reading.voices.every((f,i)=>f===influence.voices[i].frequency_hz),'no voice was retuned by the played note',{});
 // Latency from the press to the page scheduling the first block that carries the note (lookahead excluded).
 const onset=after.findIndex(b=>windowPower([b]).some((p,i)=>p>3*before[i]));
 report.latency={press_to_scheduled_block_ms:onset>=0?after[onset].at-clickedAt:null,note:'time from the press to the page scheduling the first PCM block carrying the strike; the block then plays after the presentation lookahead (embedded policy: 8192-sample blocks, 500 ms lead), so note-to-ear latency is larger and is not measured here'};
 await frame.locator('[data-ni-janko-block]').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'janko-after-strike.png')});
 assert.deepEqual(errors,[]);
 report.pass=report.failures.length===0;
 console.log(JSON.stringify(report,null,2));
 assert.deepEqual(report.failures,[],'every check must hold');
}catch(error){report.failure=String(error);throw error;}
finally{
 await writeFile(join(out,'janko-trace.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(out,'kernel.log'),bridgeLog+'\n'+bridgeErr);
 await browser.close();await new Promise(r=>server.close(r));bridge.kill();await rm(temp,{recursive:true,force:true});
}
