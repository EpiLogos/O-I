/** Actual Settings/System surface, native kernel and setup owner in a private World.
 * Review/cancel only: this does not install, remove or invoke a provider. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve,dirname,join,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
import {nativeCentralWorld,retireNativeBrowserOwners} from '../tests/native-expression-central.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.OI_SYSTEM_NATIVE_OUT??join(root,'tests/artifacts/adoption-system'));
await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'oi-system-native-'));
const report={schema:'oi.system-native-ingress/v1',standing:'Actual SystemPanel/Settings page and native setup review in an initialized private World; no installation, provider or installed-machine acceptance',checks:[],passed:false};
let bridge,server,browser,browserOwner,endpoint;
let bridgeLog='';
const bounded=async(label,promise,ms=6000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' exceeded its finite deadline')),ms);})]);}finally{clearTimeout(timer);}};
async function setup(request){
 const response=await fetch(endpoint+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'setup',request}),signal:AbortSignal.timeout(35000)});
 const envelope=await response.json();assert.equal(envelope.ok,true,JSON.stringify(envelope));assert.equal(envelope.outcome.result,'setup_reading');assert.equal(envelope.outcome.data.schema,'oi.setup/v1');return envelope.outcome.data;
}
try{
 const central=await nativeCentralWorld(temp);report.native_owners=central.sources;report.central_initialization=central.initialization;
 const kernel=process.env.WIKI_KERNEL_BIN;assert.ok(kernel&&isAbsolute(kernel),'Explicit built native kernel required');
 const hash=createHash('sha256');for await(const chunk of createReadStream(kernel))hash.update(chunk);report.native_owners.kernel={path:kernel,sha256:hash.digest('hex')};
 bridge=spawn(kernel,['127.0.0.1:0'],{cwd:temp,env:central.env,stdio:['ignore','pipe','pipe']});
 bridge.stdout.on('data',chunk=>{bridgeLog=(bridgeLog+chunk).slice(-131072);});bridge.stderr.on('data',chunk=>{bridgeLog=(bridgeLog+chunk).slice(-131072);});
 endpoint=await bounded('Native kernel startup',new Promise((resolve,reject)=>{bridge.once('error',reject);bridge.once('exit',code=>reject(new Error('Native kernel exited '+code)));bridge.stdout.on('data',()=>{const match=bridgeLog.match(/http:\/\/127\.0\.0\.1:\d+/);if(match)resolve(match[0]);});}),15000);
 report.setup_before=await setup({action:'status'});
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';
import {KernelProvider} from '/src/kernel/KernelProvider.tsx';import {SystemPanel} from '/src/workspace/SystemPanel.tsx';import {SettingsNavigator} from '/src/workspace/settings/SettingsNavigator.tsx';
import '@epilogos/oi-design-system/tokens.css';import '@epilogos/oi-design-system/desktop.css';import '@epilogos/oi-design-system/themes/themes.css';import '/src/rest.css';import '/src/cradle.css';
window.__OI_KERNEL_BRIDGE__=new URLSearchParams(location.search).get('bridge');
createRoot(document.getElementById('root')).render(React.createElement(KernelProvider,null,React.createElement('div',{style:{display:'grid',gridTemplateColumns:'220px minmax(0,1fr)',height:'100vh'}},React.createElement(SettingsNavigator),React.createElement(SystemPanel))));`;
 server=await createServer({root,appType:'custom',configFile:false,define:{__CRADLE_WALK__:'false'},plugins:[react(),{name:'actual-native-system-entry',resolveId(id){if(id==='/@system-native-entry')return '\0system-native-entry';},load(id){if(id==='\0system-native-entry')return entry;}}],server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[resolve(root,'../..')]}}});
 server.middlewares.use(async(req,res,next)=>{try{if(!req.url?.startsWith('/__system.html'))return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><body style="margin:0"><div id="root"></div><script type="module" src="/@system-native-entry"></script></body></html>'));}catch(error){next(error);}});
 await server.listen();const url='http://127.0.0.1:'+server.httpServer.address().port+'/__system.html?bridge='+encodeURIComponent(endpoint);
 for(const[name,engine]of Object.entries({chromium,webkit})){
  browserOwner=await engine.launchServer({headless:true});browser=await engine.connect(browserOwner.wsEndpoint(),{timeout:15000});const page=await browser.newPage({viewport:{width:1100,height:1000}});page.setDefaultTimeout(60000);
  const calls=[],replies=[],pending=new Set(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('request',request=>{if(request.url()===endpoint+'/op'&&request.method()==='POST'){const op=request.postDataJSON();if(op.op==='setup')calls.push(op);}});
  page.on('response',response=>{const request=response.request();if(request.url()!==endpoint+'/op'||request.method()!=='POST'||request.postDataJSON()?.op!=='setup')return;const reading=response.json().then(value=>replies.push(value));pending.add(reading);void reading.finally(()=>pending.delete(reading)).catch(()=>{});});
  try{
   await page.goto(url);await page.getByRole('navigation',{name:'Settings sections'}).waitFor();
   await page.locator('[data-settings-product="oi"]').click();await page.locator('[data-product-page="oi"]').waitFor();
   assert.equal(calls.length,0,'Reading actual product settings must not start adoption');
   await page.getByRole('button',{name:'Install and set up…',exact:true}).click();
   await page.getByLabel('Composition',{exact:true}).selectOption('custom');await page.getByLabel('Central directory',{exact:true}).fill(temp);
   await page.getByLabel('Desktop',{exact:true}).selectOption('remove');
   await page.getByRole('button',{name:'Review effects and authority'}).click();await page.getByRole('region',{name:'Installation review'}).waitFor();
   await bounded('Native setup response capture',Promise.all([...pending]));
   const nativePlan=replies.map(reply=>reply.outcome?.data?.plan).find(Boolean);assert.ok(nativePlan,'Review must contain the actual native plan');
   assert.equal(nativePlan.selection.ground,temp);assert.equal(nativePlan.selection.desktop,'remove');assert.ok(nativePlan.review_token,'Native owner must issue the review identity');
   assert.equal(calls.filter(call=>call.request.action==='apply').length,0,'Review is not installation authority');
   await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await page.getByRole('dialog',{name:'Install and set up this World'}).waitFor({state:'detached'});
   await page.getByRole('button',{name:'Install and set up…',exact:true}).click();
   assert.equal(await page.getByLabel('Central directory',{exact:true}).inputValue(),temp);assert.equal(await page.getByLabel('Desktop',{exact:true}).inputValue(),'remove');
   await page.getByRole('button',{name:'Close',exact:true}).click();
   assert.equal(calls.filter(call=>['apply','prepare_desktop'].includes(call.request.action)).length,0);assert.deepEqual(errors,[]);
   await page.screenshot({path:join(out,name+'.png'),fullPage:true});
   report.checks.push({browser:name,version:browser.version(),passed:true,meaning:'Actual Settings product reaches actual native setup plan; exact private root, review/cancel/reentry, no apply or preparation',calls,replies});
  }catch(error){await page.screenshot({path:join(out,name+'-failure.png'),fullPage:true}).catch(()=>{});throw error;}
  finally{const cleanup=await retireNativeBrowserOwners({browser,browserOwner});assert.equal(cleanup.browser.ok,true,cleanup.browser.error);browser=undefined;browserOwner=undefined;}
 }
 report.setup_after=await setup({action:'status'});assert.deepEqual(report.setup_after,report.setup_before,'Review/cancel must preserve the native effect journal');report.passed=true;
}catch(error){report.error=String(error);report.passed=false;throw error;}
finally{
 report.owner_cleanup=await retireNativeBrowserOwners({bridge,browser,browserOwner,server:server?.httpServer});
 for(const [owner,result]of Object.entries(report.owner_cleanup))if(!result.ok){report.passed=false;report.cleanup_error=owner+': '+result.error;}
 if(server)try{await bounded('Vite owner retirement',server.close());}catch(error){report.passed=false;report.cleanup_error=String(error);}
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(out,'kernel.log'),bridgeLog);
 await rm(temp,{recursive:true,force:true});if(report.cleanup_error)throw new Error(report.cleanup_error);
}
