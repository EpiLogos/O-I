/** Real local native ActText -> production relay -> built ordinary app DOM.
 * Captured historical Direct speech is input, never a fresh provider response.
 * Real Canvas2D calls test typography consumption, not GPU shape or H. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,mkdtemp,rm,stat,realpath,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build,stop as stopBuild} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(root,'../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cap=64*1024*1024;
async function bounded(path,maximum=cap){const info=await stat(path);assert.ok(info.isFile()&&info.size<=maximum,'Bounded regular artifact required: '+path);const bytes=await readFile(path);assert.ok(bytes.length<=maximum);return bytes;}
// Executable images have their own bound and stream digest. The 64MiB
// receiving-material limit remains unchanged; a debug build is not material.
async function executableDigest(path){const info=await stat(path);assert.ok(info.isFile()&&info.size>0&&info.size<=512*1024*1024,'Bounded actual executable image required: '+path);const digest=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(path,{highWaterMark:64*1024})){bytes+=chunk.length;assert.ok(bytes<=info.size,'Executable image grew during qualification');digest.update(chunk);}assert.equal(bytes,info.size,'Complete executable image required');return {bytes,sha256:digest.digest('hex')};}
async function responseBytes(response,maximum=cap){assert.ok(response.ok,'HTTP '+response.status);const reader=response.body.getReader(),parts=[];let total=0;try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum)throw Error('Native response exceeds declared receiving bound');parts.push(value);}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}return Buffer.concat(parts.map(p=>Buffer.from(p)));}
const binary=process.env.NATIVE_TEXT_BRIDGE,expectedHash=process.env.NATIVE_TEXT_BRIDGE_SHA256;
assert.ok(binary?.startsWith('/'),'Exact absolute candidate walk-bridge required');assert.match(expectedHash??'',/^[a-f0-9]{64}$/,'External candidate build must qualify its binary digest');
const binaryPath=await realpath(binary),binaryImage=await executableDigest(binaryPath);assert.equal(binaryImage.sha256,expectedHash);
const out=resolve(process.env.NATIVE_TEXT_OUT??join(root,'tests/artifacts/native-expression-text'));
await mkdir(out,{recursive:true});const temp=await mkdtemp(join(tmpdir(),'oi-native-text-receiving-'));
const report={schema:'oi.native-text-receiving-browser/v1',passed:false,checks:[],sources:{},native:[],observations:[],errors:[],standing:'Historical captured native speech, current real local Kernel/ActStore, built ordinary app and real Canvas2D. No fresh Nara/Epii, provider, hardware GPU, installed, audio or H acceptance.'};
let bridge,server,browser,page,frame;const logs={stdout:'',stderr:''};let overflow=false;
const log=(stream,chunk)=>{if(logs[stream].length+chunk.length>1024*1024){overflow=true;bridge?.kill('SIGTERM');return;}logs[stream]+=chunk.toString();};
const check=(truth,label)=>{assert.ok(truth,label);report.checks.push(label);};
const source=async(name,path,expected)=>{const bytes=await bounded(path);if(expected)assert.equal(hash(bytes),expected);report.sources[name]={path,bytes:bytes.length,sha256:hash(bytes)};return bytes;};
const turnPath=join(root,'tests/fixtures/shared-direct-journal/native-turn.json'),docPath=join(root,'tests/fixtures/shared-native-expression/native-document.json');
async function post(op,request){const raw=JSON.stringify({op,request});assert.ok(Buffer.byteLength(raw)<=32*1024*1024);const result=JSON.parse((await responseBytes(await fetch(endpoint+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:raw}))).toString('utf8'));assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.outcome.result,op);return result.outcome.data;}
let endpoint;
const receiptPath=join(out,'receipt.json'),pendingReceiptPath=join(out,'.receipt.pending.json');
async function retainReceipt(){await writeFile(pendingReceiptPath,JSON.stringify(report,null,2)+'\n');await rename(pendingReceiptPath,receiptPath);}
try{
 // A new attempt cannot inherit an earlier green receipt.
 await retainReceipt();
 const original=JSON.parse((await source('document',docPath,'7180b2ae20a67b9ada0509f313f0c08a1e03b5929e3f93544e1a78c8016b057e')).toString('utf8'));
 const turn=JSON.parse((await source('turn',turnPath,'f58e0a3381e406db563d50f5d941648d6d0344a90d24b307b7ebcdfd70e91337')).toString('utf8'));
 const chunks=turn.events.filter(row=>row.event?.event?.Signal?.kind?.kind==='agent-message-chunk').map(row=>row.event.event.Signal.kind.text);
 assert.equal(chunks.length,852);const fullBody=chunks.join('');assert.equal(Buffer.byteLength(fullBody),2967);assert.equal(hash(Buffer.from(fullBody)),'99825459850f96ffb234969fa3a7f267f1b6c84f58fc230ffa7191e8f31a9c65');
 const provenance=JSON.parse((await source('generatedProvenance',join(repo,'packages/oi-design-system/expressions-engine/PROVENANCE.json'))).toString('utf8'));
 for(const name of ['capture','model']){const output='shell/'+name+'.mjs',receipt=provenance.module_refreshes?.[output];assert.ok(receipt,'Actual named native compiler receipt required: '+output);await source(name+'Source',join(repo,receipt.source),receipt.source_sha256);await source(name+'Generated',join(repo,'packages/oi-design-system/expressions-engine',output),receipt.output_sha256);assert.match(receipt.compiler,/^esbuild@/);}
 await source('appSource',join(root,'expressions-app/field-studies-journeys/src/app.ts'));
 const html=await source('builtApplication',join(root,'expressions-app/field-studies-journeys/public/index.html'));
 const meta=JSON.parse((await source('builtApplicationInputs',join(root,'expressions-app/field-studies-journeys/build/bundle-metafile.json'))).toString('utf8'));assert.ok(meta.inputs['src/app.ts'],'Actual app.ts standalone build input required');assert.ok(meta.inputs['src/capture.ts']);assert.ok(meta.inputs['src/model.ts']);
 for(const name of ['home','oi','ground'])await mkdir(join(temp,name));
 const env={PATH:process.env.PATH??'/usr/bin:/bin',HOME:join(temp,'home'),OI_HOME:join(temp,'oi'),OI_CENTRAL_ROOT:join(temp,'ground'),OI_CENTRAL_PROJECT_QUERY:'',OI_BIN:'/nonexistent/oi',OI_AIKIT_BIN:'/nonexistent/aikit',OI_CENTRAL_CTRL_BIN:'/nonexistent/ctrl'};
 // External faculties are unavailable, not substituted. All operations below
 // belong to the real local Expression/Act/recovery owners in this process.
 bridge=spawn(binaryPath,['127.0.0.1:0'],{cwd:temp,env,stdio:['ignore','pipe','pipe']});bridge.stdout.on('data',chunk=>log('stdout',chunk));bridge.stderr.on('data',chunk=>log('stderr',chunk));
 endpoint=await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Owned native bridge startup timed out')),15000);const clean=()=>{clearTimeout(timer);bridge.off('error',failed);bridge.off('exit',exited);bridge.stdout.off('data',ready);};const failed=error=>{clean();no(error);};const exited=code=>failed(Error('Owned bridge exited '+code));const ready=()=>{const found=logs.stdout.match(/http:\/\/127\.0\.0\.1:\d+/);if(found){clean();yes(found[0]);}};bridge.once('error',failed);bridge.once('exit',exited);bridge.stdout.on('data',ready);ready();});
 report.bridge={pid:bridge.pid,path:binaryPath,sha256:expectedHash,argv:[binaryPath,'127.0.0.1:0'],cwd:temp,external_faculties:'explicitly unavailable; none invoked'};
 if(process.platform==='linux'){const image=await realpath('/proc/'+bridge.pid+'/exe');assert.equal(image,binaryPath);const actual=await executableDigest('/proc/'+bridge.pid+'/exe');assert.equal(actual.sha256,expectedHash);assert.equal(actual.bytes,binaryImage.bytes);report.bridge.process_image={path:image,...actual};}
 const opened=await post('expression',{operation:'open',document:original,actor:'agent:controlled-native-replay'});assert.deepEqual(opened.document,original);
 const legacy=(await post('expression',{operation:'fork',expression_ref:original.expression_ref,expected_revision:original.revision,new_expression_ref:'expression:controlled-native-text-legacy',actor:'agent:controlled-native-replay'})).document;assert.ok(legacy);
 const selected=original.scenes.find(scene=>scene.scene_ref===original.selection.scene_ref),material=structuredClone(selected.presentation),layer=material.scene.text.find(text=>text.role==='resultText');assert.ok(layer,'Actual native text role required');
 layer.bodySize=18;layer.passage={schema:'oi.expression-text-passages/v1',capacity_chars:360,max_newlines:8,maximum_pages:64};
 const edited=await post('expression',{operation:'edit',expression_ref:original.expression_ref,expected_revision:original.revision,actor:'agent:controlled-native-replay',changes:[{change:'scene_material_set',scene_ref:selected.scene_ref,presentation:material}]});
 const actRef='act:controlled-native-text-receiving';await post('expression_world',{operation:'act_open',act_ref:actRef,expression_ref:original.expression_ref,mode:'expressions',actor:'agent:controlled-native-replay'});
 const basis={family:'agent-message',source:'aikit-encounter',event_ref:turn.agent_session,occurrence:'cursor:1917'};
 const filled=await post('expression_world',{operation:'act_text',act_ref:actRef,actor:'agent:controlled-native-replay',role:'resultText',text:fullBody,event_basis:basis,expected_revision:edited.document.revision});assert.equal(filled.state,'act_performed');assert.equal(filled.act.bindings.resultText.text,fullBody);
 const pages=filled.act.sequence.filter(p=>p.kind==='edition');assert.ok(pages.length>1);assert.equal(pages.map(p=>p.text).join(''),fullBody);
 const native=(await post('expression',{operation:'inspect',expression_ref:original.expression_ref})).document;assert.equal(native.selection.scene_ref,pages[0].scene_ref);report.native.push({opened,edited,filled,document:native});
 check(true,'Real native ActText retains all 2967 captured bytes and selects its acknowledged native first page');
 await build({stdin:{contents:`import {relayKernelChannel} from './src/expressions/hostedApp.ts';window.disposeRelay=relayKernelChannel(document.querySelector('iframe'),{kind:'bridge',url:location.origin});`,resolveDir:root},bundle:true,platform:'browser',format:'esm',outfile:join(temp,'parent.js')});
 server=createServer(async(req,res)=>{try{
  if(req.method==='POST'&&req.url==='/op'){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>32*1024*1024)throw Error('Native request exceeds declared bound');parts.push(part);}const bytes=Buffer.concat(parts);const request=JSON.parse(bytes.toString('utf8'));assert.ok(['expression','expression_world','expression_recovery'].includes(request.op),'Unexpected external faculty operation '+request.op);const response=await responseBytes(await fetch(endpoint+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:bytes}));res.setHeader('Content-Type','application/json');res.end(response);return;}
  if(req.url==='/parent.js'){res.setHeader('Content-Type','text/javascript');res.end(await bounded(join(temp,'parent.js')));return;}
  if(req.url?.startsWith('/generated/')){const name=req.url.slice('/generated/'.length);assert.match(name,/^[\w-]+\.mjs$/);assert.ok(provenance.files['shell/'+name]);res.setHeader('Content-Type','text/javascript');res.end(await bounded(join(repo,'packages/oi-design-system/expressions-engine/shell',name)));return;}
  res.setHeader('Content-Type','text/html');if(req.url?.startsWith('/app'))res.end(html);else res.end('<!doctype html><style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/app?host=expressions"></iframe><script type="module" src="/parent.js"></script>');
 }catch(error){report.errors.push(String(error));res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:String(error)}));}});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();report.renderer='Chromium software WebGL; typography/canvas only, no native numerical shape proof';
 page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});page.on('pageerror',error=>report.errors.push(String(error)));
 await page.goto('http://127.0.0.1:'+server.address().port);frame=page.frames().find(candidate=>candidate!==page.mainFrame());assert.ok(frame);
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.workspaceReady&&window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable());await frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady());
 assert.equal(await frame.evaluate(ref=>window.__FIELD_STUDIES__.openNative(ref),native.expression_ref),true);
 await frame.waitForFunction(basis=>{const api=window.__FIELD_STUDIES__,state=api.nativeWorking();return state?.native_ref===basis.ref&&state.revision===basis.revision&&!state.busy&&!state.failed;},{ref:native.expression_ref,revision:native.revision});
 const showed=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),state:window.__FIELD_STUDIES__.getState(),native:window.__FIELD_STUDIES__.nativeWorking()}));const active=showed.document.scenes[showed.state.sceneIndex],text=active.text.find(layer=>layer.role==='resultText');assert.ok(text);assert.equal(active.id,native.selection.scene_ref);assert.equal(text.body,pages[0].text);assert.equal(text.bodySize,18);report.native.push({showed});
 check(true,'Ordinary production native adoption presents the exact acknowledged page, role and complete first-page text');
 const readTypography=()=>frame.evaluate(async id=>{const api=window.__FIELD_STUDIES__,doc=api.getDocument(),state=api.getState(),scene=doc.scenes[state.sceneIndex],text=scene.text.find(t=>t.id===id),article=document.querySelector('[data-text-id='+JSON.stringify(id)+']'),p=article?.querySelector('p');if(!text||!p)throw Error('Actual current text/paragraph missing');const {textLayout,paintText}=await import('/generated/capture.mjs');const canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Actual Canvas2D unavailable');const calls=[],fill=ctx.fillText.bind(ctx);ctx.fillText=(...args)=>{calls.push({font:ctx.font,text:args[0]});return fill(...args);};paintText(ctx,{...scene,text:[text]},innerWidth,innerHeight);const bodyCalls=calls.filter(call=>call.font===textLayout(text,innerWidth,innerHeight).body+'px Arial'&&call.text!==text.kicker);return{width:innerWidth,height:innerHeight,text,dom:p.textContent,inline:p.style.fontSize,computed:getComputedStyle(p).fontSize,layout:textLayout(text,innerWidth,innerHeight),calls:bodyCalls,canvas:canvas.toDataURL('image/png')};},text.id);
 for(const width of [360,760,1000,1440]){await page.setViewportSize({width,height:900});await frame.waitForFunction(w=>innerWidth===w,width);const sample=await readTypography();assert.equal(sample.dom,pages[0].text);assert.equal(sample.inline,'18px');assert.equal(sample.computed,'18px');assert.equal(sample.layout.body,18);assert.ok(sample.calls.some(call=>call.font==='18px Arial'&&call.text));assert.equal(sample.calls.map(call=>call.text).join(''),sample.text.body.replace(/\n/g,''),'The real painter retains every literal page-body character across word and grapheme breaks');const png=Buffer.from(sample.canvas.split(',')[1],'base64');assert.ok(png.length<=4*1024*1024);await writeFile(join(out,'capture-'+width+'.png'),png);delete sample.canvas;report.observations.push(sample);}
 check(true,'Actual current native first-page DOM and source-qualified real Canvas2D painter consume authored18px at every viewport');
 await page.setViewportSize({width:1440,height:900});await frame.evaluate(()=>window.__FIELD_STUDIES__.openEditor('scene'));await frame.locator('[data-action="studio-section"][data-value="text"]').click();await frame.locator('[data-action="select-text"][data-id='+JSON.stringify(text.id)+']').click();
 for(const bodySize of [8,24,72]){const input=frame.locator('#inspector-content [data-bind="text.bodySize"]').first();await input.fill(String(bodySize));await input.press('Enter');await frame.waitForFunction(({id,value})=>{const api=window.__FIELD_STUDIES__,d=api.getDocument(),s=api.getState();return d.scenes[s.sceneIndex].text.find(t=>t.id===id)?.bodySize===value;},{id:text.id,value:bodySize});const sample=await readTypography();assert.equal(sample.dom,pages[0].text);assert.equal(sample.inline,bodySize+'px');assert.equal(sample.computed,bodySize+'px');assert.equal(sample.layout.body,bodySize);assert.ok(sample.calls.some(call=>call.font===bodySize+'px Arial'&&call.text));delete sample.canvas;report.observations.push(sample);}
 check(true,'Ordinary supporting-text control updates real DOM and capture without dropping the retained text; these are local draft edits, not native file save proof');
 const still=(await post('expression',{operation:'inspect',expression_ref:native.expression_ref})).document;assert.deepEqual(still,native,'Local typography draft must not overwrite the performing native Act');
 assert.equal((await post('expression_world',{operation:'act_inspect',act_ref:actRef})).act.bindings.resultText.text,fullBody);
 assert.equal(await frame.evaluate(ref=>window.__FIELD_STUDIES__.openNative(ref),legacy.expression_ref),true);
 await frame.waitForFunction(ref=>window.__FIELD_STUDIES__.nativeWorking()?.native_ref===ref&&!window.__FIELD_STUDIES__.nativeWorking()?.busy,legacy.expression_ref);
 for(const width of [360,760,1000,1440]){await page.setViewportSize({width,height:900});await frame.waitForFunction(w=>innerWidth===w,width);const sample=await readTypography();assert.equal(sample.text.role,'resultText');assert.equal(sample.text.bodySize,undefined);assert.equal(sample.inline,'','Legacy material must retain CSS sizing without a new inline override');assert.equal(sample.computed,(width<761?10:11)+'px');assert.equal(sample.layout.body,width<761?10:11);assert.ok(sample.calls.some(call=>call.font===(width<761?10:11)+'px Arial'&&call.text));delete sample.canvas;report.observations.push(sample);}
 check(true,'An actual native fork of the unchanged legacy material retains responsive CSS/Canvas2D sizing with no inline override');
 assert.equal((await executableDigest(binaryPath)).sha256,expectedHash);assert.equal(overflow,false);assert.deepEqual(report.errors,[]);await page.screenshot({path:join(out,'ordinary-text.png')});report.passed=true;
}catch(error){report.failure=String(error);throw error;}
finally{
 const encounterPassed=report.passed;report.passed=false;
 const cleanup=[];report.cleanup=cleanup;
 const attempt=async(name,operation)=>{try{await operation();cleanup.push({name,ok:true});}catch(error){cleanup.push({name,ok:false,error:String(error)});report.passed=false;process.exitCode=1;}};
 // Retain an incomplete result before any cleanup, then attempt every owned
 // resource/retention independently; the original encounter error survives.
 await attempt('falseReceiptBeforeCleanup',retainReceipt);
 for(const [name,operation] of [
  ['relay',async()=>{if(page&&!page.isClosed())await page.evaluate(()=>window.disposeRelay?.());}],
  ['browser',async()=>{await browser?.close();}],
  ['server',async()=>{if(server?.listening)await new Promise((yes,no)=>server.close(error=>error?no(error):yes()));}],
  ['bridge',async()=>{if(bridge&&bridge.exitCode===null&&bridge.signalCode===null){const ended=new Promise(resolve=>bridge.once('exit',resolve));bridge.kill('SIGTERM');let timer;await Promise.race([ended,new Promise(resolve=>{timer=setTimeout(()=>{bridge.kill('SIGKILL');resolve();},5000);})]);clearTimeout(timer);await ended;}}],
  ['compiler',async()=>{stopBuild();}],
  ['temporaryGround',async()=>{await rm(temp,{recursive:true,force:true});}],
  ['stdoutLog',async()=>{await writeFile(join(out,'bridge.stdout.log'),logs.stdout);}],
  ['stderrLog',async()=>{await writeFile(join(out,'bridge.stderr.log'),logs.stderr);}]
 ])await attempt(name,operation);
 report.passed=encounterPassed&&cleanup.every(row=>row.ok);
 // Atomic final publication happens only after cleanup and log retention.
 // A write/rename failure leaves the earlier false guard as the receipt.
 try{await retainReceipt();}
 catch(error){report.passed=false;process.exitCode=1;cleanup.push({name:'finalReceipt',ok:false,error:String(error)});try{await retainReceipt();}catch(retentionError){cleanup.push({name:'failedReceiptRetry',ok:false,error:String(retentionError)});console.error('Native text receipt retention failed:',String(retentionError));}}
 if(!report.passed)process.exitCode=1;
}
