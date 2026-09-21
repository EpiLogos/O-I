/** Offline interaction proof of the production authoring drawer. Responses,
 * host hooks and recovery sink are controlled doubles; no native-save, real
 * Stage, persistent-storage, latest-main or installed-app claim is made here.
 * It supplements, and never replaces, wiki-constructive-browser.mjs. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/wiki-recovery');mkdirSync(out,{recursive:true});
const receipt={scope:'production WikiConstructionPanel and its source clients; controlled host/response/checkpoint doubles; in-memory browser document, no native execution',checks:[],passed:false};
const check=(value,name)=>{assert.ok(value,name);receipt.checks.push(name);};
const built=await build({root,configFile:false,logLevel:'warn',plugins:[react(),{
 name:'controlled-recovery-host',enforce:'pre',resolveId(id){
  if(id.endsWith('/kernel/KernelProvider'))return '\0recovery-kernel';
  if(id.endsWith('/stage/ExpressionStage'))return '\0recovery-stage';
 },load(id){
  if(id==='\0recovery-kernel')return 'export function useKernel(){return window.__WIKI_RECOVERY__.kernel;}';
  if(id==='\0recovery-stage')return 'export function useExpressionStage(){return {present(){throw new Error("This proof must not substitute a fake Stage for rendered evidence")},focusSelection(){}};}';
 }}],define:{__CRADLE_WALK__:'false','process.env.NODE_ENV':'"production"'},resolve:{alias:{three:resolve(root,'node_modules/three')}},
 build:{write:false,target:'es2021',minify:false,cssCodeSplit:false,lib:{entry:resolve(root,'tests/wiki-recovery-page.tsx'),name:'WikiRecoveryProof',formats:['iife']},rollupOptions:{output:{inlineDynamicImports:true}}}});
const output=(Array.isArray(built)?built[0]:built).output;
const javascript=output.filter(item=>item.type==='chunk').map(item=>item.code).join('\n');
const css=output.filter(item=>item.type==='asset'&&item.fileName.endsWith('.css')).map(item=>String(item.source)).join('\n');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{})});
receipt.browser=browser.version();
async function pageFor(scenario){
 const page=await browser.newPage({viewport:{width:1000,height:900},reducedMotion:'reduce'});
 page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',error=>{errors.push(String(error));console.error('Component error:',String(error));});
 // No network navigation or policy overrides. Only isolated component content
 // is installed in memory. Test IDs use random bytes when about:blank does not
 // expose the secure-context randomUUID convenience; production is unchanged.
 await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;font-family:system-ui,sans-serif"><p style="max-width:24rem;padding:1rem;color:#555">Controlled recovery test. Host responses and checkpoints are test doubles; the native runtime and Stage are not running here.</p><div id="root"></div></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(scenario=>{
  if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')});
  window.__WIKI_RECOVERY__={scenario,reads:[],effects:[],checkpoints:[],savedCallbacks:0};
 },scenario);
 await page.addScriptTag({content:javascript});
 await page.getByLabel('Open saved constellation').waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[role="status"]')).some(el=>el.textContent.includes('Reading native')));
 return {page,errors};
}
try{
 {
  const {page,errors}=await pageFor('first-save');
  await page.getByRole('button',{name:'Retry exact file save',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Unknown ordinary-file creation field'}).waitFor();
  check((await page.getByRole('alert').innerText()).includes('central.files.create'),'first-save refusal retains the actual owner diagnostic in the production drawer');
  check(await page.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).count()===0,'refused first save never advertises Return as available');
  await page.screenshot({path:resolve(out,'first-save-refusal.png')});
  await page.evaluate(()=>{window.__WIKI_RECOVERY__.refuseSave=false;});
  await page.getByRole('button',{name:'Retry exact file save',exact:true}).click();
  await page.getByText('Save and Return composition',{exact:true}).click();
  await page.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).waitFor();
  const saves=await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.filter(op=>op.op==='expression'));
  check(saves.length===2&&saves.every(op=>op.request.operation_ref==='operation:first-save'),'explicit first-save retry retains the same intended operation identity');
  await page.evaluate(()=>{window.__WIKI_RECOVERY__.rejectCheckpoint=true;});
  await page.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'checkpoint storage refused'}).waitFor();
  check(await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.every(op=>op.op!=='invoke_action')),'a failed Return checkpoint prevents dispatch');
  await page.evaluate(()=>{window.__WIKI_RECOVERY__.rejectCheckpoint=false;window.__WIKI_RECOVERY__.failReturn=true;});
  await page.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'artifact remains saved'}).waitFor();
  await page.evaluate(()=>{window.__WIKI_RECOVERY__.failReturn=false;});
  await page.getByRole('button',{name:'Retry exact Return',exact:true}).click();
  await page.getByRole('button',{name:'Returned to constellation',exact:true}).waitFor();
  const returns=await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.filter(op=>op.op==='invoke_action'));
  check(returns.length===2&&returns[0].invocation.input.request.operation_ref===returns[1].invocation.input.request.operation_ref,'lost Return response preserves the original operation for explicit retry');
  check(await page.getByRole('button',{name:'Returned to constellation',exact:true}).isDisabled(),'only confirmed Return disables the completed action');
  check(errors.length===0,`first-save and Return: no uncaught component errors (${errors.join('; ')})`);
  await page.screenshot({path:resolve(out,'returned.png')});await page.close();
 }
 for(const scenario of ['pending-absent','recorded','replaced','file-conflict','retry-replaced']){
  const {page,errors}=await pageFor(scenario);
  if(scenario==='pending-absent'){
   await page.getByRole('button',{name:'Inspect saved state',exact:true}).click();
   await page.getByRole('status').filter({hasText:'Retry the exact retained Return'}).waitFor();
   check(await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.length===0),'inspection of absent Return is read-only');
   await page.getByRole('button',{name:'Retry exact Return',exact:true}).click();
   await page.getByRole('status').filter({hasText:'Saved in the native Wiki'}).waitFor();
   check(await page.evaluate(()=>window.__WIKI_RECOVERY__.effects[0].invocation.input.request.operation_ref===window.__WIKI_RECOVERY__.pending.operation_ref),'checkpoint restoration sends exactly the retained Return, without opening/replacing a live Expression');
  }else if(scenario==='retry-replaced'){
   await page.getByRole('button',{name:'Retry exact Return',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'current attachment differs'}).waitFor();
   check(await page.getByRole('button',{name:'Retry exact Return',exact:true}).count()===1,'an idempotent reply cannot clear recovery for an attachment replaced by a later edit');
   check(await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.length===1&&window.__WIKI_RECOVERY__.savedCallbacks===0),'a mismatched acknowledged Return causes no automatic replay or false saved callback');
  }else if(scenario==='file-conflict'){
   await page.getByRole('button',{name:'Retry exact Return',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'file has changed'}).waitFor();
   check(await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.length===0),'changed saved artifact refuses before any native action');
  }else{
   await page.getByRole('button',{name:'Inspect saved state',exact:true}).click();
   if(scenario==='recorded'){
    await page.getByRole('status').filter({hasText:'native result has been recovered'}).waitFor();
    check(await page.getByRole('button',{name:'Retry exact Return',exact:true}).count()===0,'recorded exact Return resolves pending state without a duplicate action');
   }else{
    await page.getByRole('alert').filter({hasText:'current attachment no longer matches'}).waitFor();
    check(await page.getByRole('button',{name:'Retry exact Return',exact:true}).count()===1,'later replacement is not reported as current returned composition');
   }
   check(await page.evaluate(()=>window.__WIKI_RECOVERY__.effects.length===0),`${scenario}: native result inspection never dispatches a write`);
  }
  check(errors.length===0,`${scenario}: no uncaught component errors (${errors.join('; ')})`);
  await page.close();
 }
 receipt.passed=true;console.log(JSON.stringify(receipt));
}catch(error){receipt.failure=String(error);for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});receipt.visible=await page.locator('body').innerText().catch(()=>null);}throw error;}
finally{writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await browser.close();}
