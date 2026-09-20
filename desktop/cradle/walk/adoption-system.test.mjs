/** SystemHome + real KernelProvider/HTTP bridge + AdoptionEntry.
 * Only the endpoint replies are controlled; no production fixture or shell mock. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/adoption-system');mkdirSync(out,{recursive:true});
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';
import {KernelProvider} from '/src/kernel/KernelProvider.tsx';
import {SystemHome} from '/src/workspace/settings/v2/SystemHome.tsx';
import '/src/configuration/configuration.css';
window.__OI_KERNEL_BRIDGE__=location.origin+'/__native';window.refreshes=0;
createRoot(document.getElementById('root')).render(React.createElement(KernelProvider,null,React.createElement(SystemHome,{nativePending:false,extras:{},pending:false,ground:null,onRefresh:()=>{window.refreshes++}})));`;
const calls=[];
const discovery={schema:'oi.setup/v1',basis:'controlled-system',target:'controlled/browser',bound_ground:null,suggested_ground:'/test/Central',selected_ground:null,ground:{outcome:'new'},desktop:{state:'absent'},warnings:[],products:[],choices:[{id:'0/1/2',title:'Existing tools',description:'Retain existing native tools',products:[],hosted:false},{id:'custom',title:'Selected products',description:'No compulsory stack',products:[],hosted:false}]};
const server=await createServer({root,appType:'custom',configFile:false,plugins:[react(),{name:'system-adoption-test',resolveId(id){if(id==='/@system-adoption-test')return '\0system-adoption-test';},load(id){if(id==='\0system-adoption-test')return entry;}}],server:{host:'127.0.0.1',port:1554,strictPort:true,fs:{allow:[resolve(root,'../..')]}}});
server.middlewares.use(async(req,res,next)=>{
 try {
  if(req.url?.startsWith('/__native/events')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,receipts:[]}));return;}
  if(req.url==='/__native/op'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)throw Error('oversized test request');}
   const op=JSON.parse(body);calls.push(op);let outcome;
   if(op.op==='state')outcome={result:'state',state:{focus:{},surfaces:{},buffers:{}},receipts:[]};
   if(op.op==='ground')outcome={result:'ground_reading',reading:{personal_ground:null},receipts:[]};
   if(op.op==='setup'){
    const r=op.request;const data={schema:'oi.setup/v1'};
    if(r.action==='status')Object.assign(data,{disposition:'not_started',journal:null});
    if(r.action==='discover')data.discovery=discovery;
    if(r.action==='plan')data.plan={schema:'oi.adoption-plan/v1',engagement_contract:'native/v1',selection:r.selection,discovery,steps:[],blocked:[],notices:['No new Agent authority'],review_token:'system-review',created_at_unix_ms:Date.now(),expires_at_unix_ms:Date.now()+60000};
    outcome={result:'setup_reading',data,receipts:[]};
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(outcome?{ok:true,outcome}:{ok:false,error:'Controlled owner does not serve this operation'}));return;
  }
  if(!req.url?.startsWith('/__system.html'))return next();
  res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><body><div id="root"></div><script type="module" src="/@system-adoption-test"></script></body></html>'));
 }catch(error){next(error);}
});
await server.listen();const report={scope:'controlled System ingress through production HTTP bridge',passed:false,checks:[]};
try{
 for(const[name,engine]of Object.entries({chromium,webkit})){
  calls.length=0;const browser=await engine.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:1554/__system.html');
   await page.getByRole('heading',{name:'This world',exact:true}).waitFor();
   assert.equal(calls.some(c=>c.op==='setup'),false,'System census must not start adoption');
   await page.getByRole('button',{name:'Install and set up…',exact:true}).click();
   await page.getByLabel('Composition',{exact:true}).selectOption('custom');
   await page.getByLabel('Central directory',{exact:true}).fill('/chosen/Central');
   await page.getByRole('button',{name:'Review effects and authority'}).click();
   await page.getByRole('button',{name:'Apply this reviewed plan'}).waitFor();
   assert.equal(calls.filter(c=>c.request?.action==='apply').length,0);
   assert.equal(calls.find(c=>c.request?.action==='plan').request.selection.ground,'/chosen/Central');
   await page.getByRole('button',{name:'Back',exact:true}).click();
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await page.getByRole('dialog',{name:'Install and set up this World'}).waitFor({state:'detached'});
   await page.getByRole('button',{name:'Install and set up…',exact:true}).click();
   assert.equal(await page.getByLabel('Central directory',{exact:true}).inputValue(),'/chosen/Central');
   await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByRole('button',{name:'Read the world again'}).click();
   assert.equal(await page.evaluate(()=>window.refreshes),1);
   assert.equal(calls.filter(c=>c.request?.action==='apply').length,0);assert.deepEqual(errors,[]);
   report.checks.push({browser:name,version:browser.version(),passed:true,meaning:'System opens production setup, exact scoped review, cancel/reentry and unchanged census refresh; no write'});
  }finally{await page.screenshot({path:resolve(out,name+'.png'),fullPage:true}).catch(()=>{});await browser.close();}
 }
 report.passed=true;
}catch(error){report.error=String(error);throw error;}
finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await server.close();}
