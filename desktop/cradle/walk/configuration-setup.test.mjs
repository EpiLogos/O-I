/** Controlled interaction of production forms/adapters over the existing C0
 * fixture world. D evidence only, not an installed/native/Mac/H acceptance. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/configuration-setup');
mkdirSync(out,{recursive:true});
const entry=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PlanDrawer} from '/src/configuration/PlanDrawer.tsx';
import {SetupFlow} from '/src/configuration/SetupFlow.tsx';
import {SetupFlowController,settingsOf} from '/src/configuration/setupFlow.ts';
import {createSetupNative} from '/src/configuration/setupNative.ts';
import {createFixtureConfigPlaneSource} from '/src/configuration/fixtureSource.ts';
import {createLiveConfigPlaneSource} from '/src/configuration/liveSource.ts';
import '/src/configuration/configuration.css';
const fixture=await createFixtureConfigPlaneSource();
const calls=[];const flags={receipt:false,readback:false,unknown:false};
let applied=false;
const wrapped={...fixture};
for(const verb of ['readRegistry','readResolutions','holdDesired','plan','apply','receipts']) {
  wrapped[verb]=async (...args)=>{
    calls.push({verb,args:structuredClone(args)});
    if(verb==='readResolutions'&&applied&&flags.readback) throw Error('controlled readback outage');
    if(verb==='receipts'&&flags.receipt) throw Error('controlled receipt outage');
    if(verb==='apply') {applied=true;const result=await fixture.apply(...args);if(flags.unknown)throw Error('controlled lost response');return result;}
    return fixture[verb](...args);
  };
}
const registry=await fixture.readRegistry();
const specs=settingsOf(registry.mounts);
const model={setting_ref:'ai-kit:resolution:model.default',scope:{scope_kind:'project',scope_ref:'epilogos/o-i'},value:'sonnet-next'};
const verify={setting_ref:'oi:verify:verify.before-run',scope:{scope_kind:'world',scope_ref:null},value:true};
const params=new URLSearchParams(location.search);
const requests=params.has('partial')?[model,verify]:[model];
const nativeCalls=[];
const native=createSetupNative(async op=>{
  nativeCalls.push(op);
  if(op.op==='files_list')return {outcome:{result:'directory_read',directory:{schema:'central.directory-reading/v1',location:{schema:'central.path-ref/v1',ref:'fixture:ground',root:'/fixture',path:'/fixture'},entries:[],automatic_agent_or_model_invocation:false}}};
  if(op.op==='sources_list')return {outcome:{result:'sources_listed',listing:{schema:'fixture:listing',project:'',availability:'horizon',sources:[{ref:'fixture:source:one',path:'A real owner-shaped test source',treatment:'human-authored',agent_retrieval_allowed:false}]}}};
  if(op.op==='source_open')return {outcome:{result:'source_opened',buffer:{source_ref:op.source_ref,project:'',world_ref:'fixture:world',content:'Controlled source, not a demo corpus claim.',saved_content:'',base_revision:'fixture-r1',dirty:false}}};
  throw Error('Unexpected native test operation');
});
// This leg exercises the production live source against a controlled typed
// kernel, not a second configuration implementation or an installed owner.
const live=createLiveConfigPlaneSource(async op=>{
  nativeCalls.push(op);
  switch(op.op){
    case 'config_registry_read':return {outcome:{result:'config_registry_reading',reading:await wrapped.readRegistry()}};
    case 'config_resolutions_read':return {outcome:{result:'config_resolutions',resolutions:await wrapped.readResolutions(op.pairs)}};
    case 'config_desired_hold':await wrapped.holdDesired(op.request);return {outcome:{result:'config_desired_held',entry:{}}};
    case 'config_plan':return {outcome:{result:'config_planned',...await wrapped.plan(op.requests)}};
    case 'config_apply':return {outcome:{result:'config_applied',changeset:await wrapped.apply((await fixture.plan(op.requests)).plans)}};
    case 'config_receipts':return {outcome:{result:'config_receipts',document:{receipts:await wrapped.receipts('')}}};
    default:throw Error('Unexpected typed operation '+op.op);
  }
});
const controller=new SetupFlowController(params.has('live')?live:wrapped,requests,specs);
function Root(){
 const [open,setOpen]=React.useState(true);
 return React.createElement(React.Fragment,null,
  React.createElement('p',null,'Controlled C0 fixture world — no installed or human acceptance'),
  React.createElement('button',{onClick:()=>setOpen(true)},'Reopen setup'),
  open?(params.has('live')?React.createElement(SetupFlow,{controller,native,startAtReview:true,onClose:()=>setOpen(false),onApplied:()=>{}}):React.createElement(PlanDrawer,{source:wrapped,requests,settings:specs,onClose:()=>setOpen(false),onApplied:()=>{}})):null);
}
window.__SETUP__={calls,flags,nativeCalls};
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Root)));
`;
// No SPA fallback: otherwise Vite serves the normal welcome screen instead
// of the explicit controlled entry, producing a misleading locator timeout.
const server=await createServer({root,appType:'custom',configFile:false,plugins:[react(),{name:'controlled-setup-entry',resolveId(id){if(id==='/@setup-entry')return '\0setup-entry';},load(id){if(id==='\0setup-entry')return entry;}}],define:{__CRADLE_WALK__:'true'},server:{host:'127.0.0.1',port:1443,strictPort:true,fs:{allow:[resolve(root,'../..')]}}});
server.middlewares.use(async(req,res,next)=>{
  if(!req.url?.startsWith('/__setup.html'))return next();
  try{const html=await server.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@setup-entry"></script></body></html>');res.statusCode=200;res.setHeader('Content-Type','text/html');res.end(html);}catch(error){next(error);}
});
await server.listen();
const report={grade:'D',scope:'production SetupFlow, PlanDrawer, live/native adapters; existing controlled C0 fixture world',checks:[],browsers:[],passed:false};
try{
 for(const [name,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  report.browsers.push({name,version:browser.version()});
  const page=await browser.newPage({viewport:{width:1000,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const dialog=page.getByRole('dialog',{name:'Plan and apply'});
  const count=verb=>page.evaluate(verb=>window.__SETUP__.calls.filter(call=>call.verb===verb).length,verb);
  const check=(ok,label)=>{assert.ok(ok,`${name}: ${label}`);report.checks.push(`${name}: ${label}`);};
  const visit=async(query='')=>{await page.goto('http://127.0.0.1:1443/__setup.html'+query);await page.getByText('Controlled C0 fixture world — no installed or human acceptance',{exact:true}).waitFor();await dialog.locator('[data-config-apply]:not([disabled])').waitFor();};
  const apply=async()=>{await dialog.locator('[data-config-apply]').click();await dialog.locator('[data-changeset-status]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-config-drawer]')?.getAttribute('aria-busy')==='false');};
  try{
   await visit();check(await count('apply')===0&&await count('holdDesired')===0,'review and discovery have no writes');
   await dialog.getByRole('button',{name:'Back to settings',exact:true}).click();
   await dialog.getByRole('group',{name:'Default model',exact:true}).getByLabel('Desired value',{exact:true}).selectOption('opus');
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});
   await page.getByRole('button',{name:'Reopen setup'}).click();
   check(await dialog.getByRole('group',{name:'Default model',exact:true}).getByLabel('Desired value',{exact:true}).inputValue()==='opus','Cancel/remount retains edited draft');
   await dialog.locator('[data-setup-plan]').click();await dialog.locator('[data-config-apply]:not([disabled])').waitFor();
   await apply();check(await count('apply')===1&&await count('holdDesired')===1,'one explicit application crosses existing source once');
   check((await dialog.innerText()).includes('Native active'),'result separates actual native axes');
   await page.screenshot({path:resolve(out,name+'-result.png')});
   await visit('?partial');await apply();
   check(await dialog.locator('[data-changeset-status="partially_applied"]').count()===1,'existing partial fixture renders truthful result');
   await dialog.locator('[data-setup-retry]').click();
   check(await dialog.getByRole('group',{name:'Verify before run',exact:true}).count()===1&&await dialog.getByRole('group',{name:'Default model',exact:true}).count()===0,'retry draft excludes applied sibling');
   await visit();await page.evaluate(()=>window.__SETUP__.flags.receipt=true);await apply();
   check((await dialog.innerText()).includes('Receipt history is unavailable'),'receipt failure retains applied result');
   await dialog.locator('[data-setup-readback]').click();
   check(await count('apply')===1,'readback retry does not replay write');
   await visit('?live');await apply();
   await dialog.getByRole('button',{name:'Find sources in this world'}).click();
   await dialog.getByLabel('Native source',{exact:true}).selectOption('fixture:source:one');
   await dialog.getByRole('button',{name:'Open selected source'}).click();
   await dialog.getByText('Controlled source, not a demo corpus claim.',{exact:true}).waitFor();
   const nativeCalls=await page.evaluate(()=>window.__SETUP__.nativeCalls);
   check(nativeCalls.filter(op=>op.op==='config_apply').length===1&&nativeCalls.some(op=>op.op==='source_open'&&op.source_ref==='fixture:source:one'),'production live adapter then useful native source action');
   check(nativeCalls.filter(op=>op.op==='sources_list').every(op=>!('project' in op)),'root source discovery invents no Project');
   await page.setViewportSize({width:430,height:700});await page.screenshot({path:resolve(out,name+'-narrow.png')});
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   check(errors.length===0,'no uncaught browser errors: '+errors.join('; '));
  }catch(error){report.failure={browser:name,error:String(error),pageErrors:errors,visibleText:await page.locator('body').innerText().catch(()=>'<unavailable>')};console.error(JSON.stringify(report.failure));await page.screenshot({path:resolve(out,name+'-failure.png')}).catch(()=>{});throw error;}finally{await browser.close();}
 }
 report.passed=true;console.log(JSON.stringify(report));
}finally{writeFileSync(resolve(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');await server.close();}
