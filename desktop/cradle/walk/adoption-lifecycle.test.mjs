/** Real production form/controller/adapter with a controlled native endpoint.
 * This is interaction evidence, not installation or provider/Mac acceptance. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/adoption-lifecycle');mkdirSync(out,{recursive:true});
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {AdoptionFlow} from '/src/configuration/AdoptionFlow.tsx';
import {AdoptionController} from '/src/configuration/adoptionController.ts';
import {createAdoptionNative} from '/src/configuration/adoptionNative.ts';
import '/src/configuration/configuration.css';
const calls=[];let journal;const flags={lost:false,disconnected:false};
const discovery={schema:'oi.setup/v1',basis:'controlled',target:'controlled/browser',bound_ground:'/existing/Central',suggested_ground:'/existing/Central',selected_ground:'/existing/Central',ground:{outcome:'recognized'},desktop:{state:'absent'},warnings:[],products:[{id:'central',title:'Central',purpose:'Retain native ground',present:true,registered:true,managed:false},{id:'actuation',title:'Actuation',purpose:'Optional',present:false,registered:false,managed:false}],choices:[{id:'0/1/2',title:'Useful existing World',description:'Retain native tools',products:['central'],hosted:false},{id:'custom',title:'Individual products',description:'Add only what you select',products:[],hosted:false}]};
const native=createAdoptionNative(async op=>{
 calls.push(structuredClone(op));if(flags.disconnected)return {outcome:null,error:'Controlled disconnected native handler'};
 const r=op.request;let data={schema:'oi.setup/v1'};
 if(r.action==='status')Object.assign(data,{journal,disposition:journal?'outcome_unknown':undefined});
 if(r.action==='discover')data.discovery=discovery;
 if(r.action==='plan')data.plan={schema:'oi.adoption-plan/v1',engagement_contract:'native/v1',selection:r.selection,discovery,steps:[{title:'Retain recognised Central',effects:['Existing files and Control remain unchanged.'],operation:{kind:'record_composition'}}],blocked:[],notices:['Installation grants no new Agent authority.'],review_token:'controlled-review',created_at_unix_ms:Date.now(),expires_at_unix_ms:Date.now()+60000};
 if(r.action==='apply'){journal={schema:'oi.adoption-journal/v1',plan:r.plan,records:[{state:'verified',message:'Controlled native readback'}]};if(flags.lost)throw Error('Controlled lost reply after dispatch');Object.assign(data,{journal,disposition:'verified'});}
 if(r.action==='recheck')Object.assign(data,{journal,disposition:'verified'});
 if(r.action==='prepare_desktop')Object.assign(data,{bundle:'/staging/Desktop.zip',sha256:'a'.repeat(64)});
 return {outcome:{result:'setup_reading',data}};
});
const controller=new AdoptionController(native);
function Root(){const[open,setOpen]=React.useState(true);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setOpen(true)},'Reopen adoption'),open&&React.createElement(AdoptionFlow,{controller,chooseGround:async()=>'/picked/Central',onClose:()=>setOpen(false),onApplied:()=>{},onConfigure:()=>{window.configured=true}}));}
window.adoption={calls,flags,controller};createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Root)));
`;
const server=await createServer({root,appType:'custom',configFile:false,plugins:[react(),{name:'adoption-test',resolveId(id){if(id==='/@adoption-test')return '\0adoption-test';},load(id){if(id==='\0adoption-test')return entry;}}],server:{host:'127.0.0.1',port:1553,strictPort:true,fs:{allow:[resolve(root,'../..')]}}});
server.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__adoption.html'))return next();try{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><body><div id="root"></div><script type="module" src="/@adoption-test"></script></body></html>'));}catch(error){next(error);}});
await server.listen();const report={scope:'controlled production adoption interaction',passed:false,browsers:[],checks:[]};
try {
 for(const [name,engine] of Object.entries({chromium,webkit})) {
  const browser=await engine.launch({headless:true});report.browsers.push({name,version:browser.version()});
  const page=await browser.newPage({viewport:{width:1000,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const count=()=>page.evaluate(()=>window.adoption.calls.filter(c=>c.request.action==='apply').length);
  try {
   await page.goto('http://127.0.0.1:1553/__adoption.html');const dialog=page.getByRole('dialog',{name:'Install and set up this World'});
   await page.getByLabel('Composition',{exact:true}).selectOption('custom');await page.getByRole('checkbox',{name:/Central/}).check();
   await page.getByRole('button',{name:'Choose Central folder…'}).click();await page.getByLabel('Central directory',{exact:true}).waitFor();
   assert.equal(await page.getByLabel('Central directory',{exact:true}).inputValue(),'/picked/Central');
   await page.getByRole('button',{name:'Review effects and authority'}).click();await page.getByRole('button',{name:'Apply this reviewed plan'}).waitFor();assert.equal(await count(),0);
   await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByLabel('Desktop',{exact:true}).selectOption('remove');
   await page.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});await page.getByRole('button',{name:'Reopen adoption'}).click();assert.equal(await page.getByLabel('Desktop',{exact:true}).inputValue(),'remove');
   await page.getByRole('button',{name:'Review effects and authority'}).click();await page.evaluate(()=>window.adoption.flags.lost=true);await page.getByRole('button',{name:'Apply this reviewed plan'}).click();await page.getByRole('heading',{name:'Installation outcome needs a readback'}).waitFor();assert.equal(await count(),1);
   await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Reopen adoption'}).click();assert.equal(await page.getByRole('button',{name:'Review remaining work'}).isDisabled(),true);assert.equal(await count(),1);
   await page.getByRole('button',{name:'Recheck native effects'}).click();await page.getByRole('heading',{name:'Native installation verified'}).waitFor();assert.equal(await count(),1);
   await page.getByRole('button',{name:'Configure capabilities',exact:true}).click();assert.equal(await page.evaluate(()=>window.configured),true);
   await page.screenshot({path:resolve(out,name+'-readback.png'),fullPage:true});
   await page.getByRole('button',{name:'Review remaining work'}).click();await page.evaluate(()=>window.adoption.flags.disconnected=true);await page.getByRole('button',{name:'Review effects and authority'}).click();await page.getByRole('alert').filter({hasText:'disconnected'}).waitFor();assert.equal(await count(),1);
   assert.deepEqual(errors,[]);report.checks.push(name+': picker, composition, Back/Cancel/remount, one apply, lost reply, read-only recovery, configure callback, disconnected handler');
  } finally {await page.screenshot({path:resolve(out,name+'-final.png'),fullPage:true}).catch(()=>{});await browser.close();}
 }
 report.passed=true;
} catch(error){report.error=String(error);throw error;}
finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await server.close();}
