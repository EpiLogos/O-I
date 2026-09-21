/** Actual production Personal UI + existing native WebGL Expressions app.
 * Native content/operations are controlled fixtures; no live person or model. */
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import {source,parent,nativeOwner,capabilities} from './nara-personal-fixtures.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),artifacts=new URL('./artifacts/nara-personal/',import.meta.url);
const app=await readFile(new URL('../expressions-app/public/field-studies.html',import.meta.url),'utf8');
let outcome='in-progress';
const owner=nativeOwner(),files=new Map([[source.location.ref,structuredClone(source)]]),requests=[],checks=[],errors=[];
const snapshot={focus:{},surfaces:{},buffers:{},navigator:{root:{work:{projects:[]}}}};
const bridge=httpServer(async(req,res)=>{
 res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','content-type');res.setHeader('content-type','application/json');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url.startsWith('/events')){res.end(JSON.stringify({ok:true,receipts:[]}));return;}
 try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const op=JSON.parse(Buffer.concat(chunks));requests.push(op);let outcome;
 switch(op.op){
 case 'state':outcome={result:'state',snapshot};break;
 case 'files_list':outcome={result:'directory_read',directory:{...parent,entries:op.path==='Control/user/flows'?[]:[...files.values()].map(f=>({location:f.location,name:f.location.path.split('/').pop(),kind:'file',retrieval_allowed:true,byte_len:f.content.length}))}};break;
 case 'file_read':{const f=files.get(op.location.ref);if(!f)throw Error('Controlled source is absent');outcome={result:'file_read',reading:f};break;}
 case 'file_operation':{const r=op.request,current=files.get(op.location.ref);if(r.action!=='write')throw Error('Unserved file action');let data;
  if((current?.revision??'')!==r.expected_revision)data={outcome:'conflict',current};else{const next={...structuredClone(source),location:op.location,content:r.content,revision:'r-written-'+requests.length};files.set(op.location.ref,next);data={outcome:current?'written':'created',revision:next.revision};}outcome={result:'file_operation',data};break;}
 case 'invoke_action':{assert.equal(op.invocation.action,'ql.nara.personal');outcome={result:'action_dispatched',dispatch:{state:'invoked',owner_operation:'ql nara --request-file - --json',data:await owner.call(op.invocation.input)}};break;}
 default:throw Error('Unserved controlled operation '+op.op);
 }
 res.end(JSON.stringify({ok:true,outcome:{...outcome,receipts:[]}}));
 }catch(e){res.end(JSON.stringify({ok:false,error:e.message}));}
});bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
const bridgeURL=`http://127.0.0.1:${bridge.address().port}`;
const server=await createServer({configFile:false,root,appType:'custom',plugins:[react()],resolve:{alias:{'@epilogos/oi-design-system':fileURLToPath(new URL('../../../packages/oi-design-system/',import.meta.url))}},server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/identity-app',(_req,res)=>{res.setHeader('content-type','text/html');res.end(app);});
server.middlewares.use('/personal',async(_req,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/personal','<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:20px"><main id="root" style="max-width:640px"></main><iframe id="identity-app" src="/identity-app" title="Existing Expressions" style="width:940px;height:650px"></iframe><script type="module" src="/tests/nara-personal-page.tsx"></script></body></html>'));});
await server.listen();let browser,page;
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log('PASS '+label);};
try{
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1100,height:900}});page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(url=>{window.__OI_KERNEL_BRIDGE__=url;},bridgeURL);
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/personal`);await page.getByRole('button',{name:'Open my personal field',exact:true}).waitFor();
 check(owner.calls.length===0,'entry does not access private QL records, model or microphone');
 check(await page.getByRole('button',{name:'Open my personal field',exact:true}).isDisabled(),'native personal access waits for explicit consent');
 check(await page.getByRole('button',{name:'Open my current Day',exact:true}).isVisible(),'existing Day writing is reachable without QL consent or profile completion');
 await page.getByText('Start in my own words',{exact:true}).click();await page.getByLabel('Personal note filename').fill('my-own-words.md');await page.getByLabel('Personal note',{exact:true}).fill('These are my exact words; dates remain unknown.');
 await page.evaluate(()=>window.personalTest.unmount());await page.evaluate(()=>window.personalTest.mount());await page.getByText('Start in my own words',{exact:true}).click();check(await page.getByLabel('Personal note',{exact:true}).inputValue()==='These are my exact words; dates remain unknown.','unsaved human prose survives remount without browser persistence');
 await page.getByRole('button',{name:'Save my words to Central',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Personal note"]')?.value==='');check([...files.values()].some(f=>f.content==='These are my exact words; dates remain unknown.'),'explicit save invokes native exclusive source creation and exact readback');check(owner.calls.length===0,'writing in Central does not silently produce an identity assessment');
 await page.getByLabel('Open private personal records').check();await page.getByRole('button',{name:'Open my personal field',exact:true}).click();await page.getByLabel('Personal occasion').selectOption(owner.current.target.record_ref);await page.getByRole('button',{name:'Continue this occasion',exact:true}).click();await page.getByLabel('Identity layer').waitFor();check(await page.getByLabel('Identity layer').locator('option').count()===6,'all six source-backed optional identity layers are reachable');
 await page.getByLabel('Identity layer').selectOption('natal-chart');await page.getByRole('button',{name:'Review this source for the layer',exact:true}).click();const before=owner.current.revision;await page.getByRole('button',{name:'Reject without mutation',exact:true}).click();check(owner.current.revision===before,'rejecting a reviewed identity link has no native mutation');
 await page.getByRole('button',{name:'Review this source for the layer',exact:true}).click();await page.getByRole('button',{name:'Apply this reviewed change',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-label="Review personal change"]'));check(owner.current.domain.identity.slots[1].protected_value_ref.ref_id.includes('my-own-words.md'),'accepted identity link addresses the exact saved source without copying its prose');
 await page.getByRole('button',{name:'Centres',exact:true}).click();await page.getByRole('heading',{name:'Seven receiving centres',exact:true}).waitFor();const centre=page.getByRole('combobox',{name:'Centre',exact:true});await centre.waitFor();check(await centre.locator('option').count()===7,'seven independent receiving centres are not replaced by cymatic stations');await centre.selectOption('6');check(await centre.inputValue()==='6','the seventh receiving centre is independently selectable by its native ordinal');
 for(const [name,heading] of [['Oracle','Oracle'],['Practice','Practice'],['Perspectives','Perspectives'],['Returns','Returns and writing']]){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name:heading,exact:true}).waitFor();check(await page.locator('.nara-personal fieldset').isVisible(),name+' uses the existing native personal instrument view');}
 await page.getByRole('button',{name:'Identity',exact:true}).click();await page.getByText('Private identity rendering',{exact:true}).click();
 await page.getByRole('button',{name:'Review native identity basis',exact:true}).click();await page.getByRole('button',{name:'Accept this native identity basis',exact:true}).waitFor();
 check(await page.getByRole('button',{name:'Show private identity pattern',exact:true}).isDisabled(),'unaccepted native identity cannot be shown');
 await page.getByRole('button',{name:'Leave identity unaccepted',exact:true}).click();const unchanged=owner.current.revision;check(owner.current.domain.identity.identity_hash_ref===null,'identity review rejection leaves native hash unaccepted');
 await page.getByRole('button',{name:'Review native identity basis',exact:true}).click();await page.getByRole('button',{name:'Accept this native identity basis',exact:true}).click();await page.getByText('2 of 6 layers supplied. This basis is accepted.',{exact:true}).waitFor();check(owner.current.revision===unchanged+1,'identity acceptance is one real addressed native operation in the controlled owner');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Identity rendering window"]')?.options.length===2);
 const frame=page.frame({url:/identity-app/});assert.ok(frame);await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.capabilities?.kind==='production');
 const ordinary=await frame.evaluate(()=>JSON.stringify(window.__FIELD_STUDIES__.getDocument()));
 const host=await page.getByLabel('Identity rendering window').locator('option').nth(1).getAttribute('value');await page.getByLabel('Identity rendering window').selectOption(host);
 await page.getByRole('button',{name:'Show private identity pattern',exact:true}).click();await frame.waitForFunction(()=>document.body.dataset.privateIdentity==='true');
 check(await frame.locator('#app').evaluate(el=>el.inert),'the real existing Expressions app enters a private presentation without a second renderer');
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.telemetry()===null);check(await frame.evaluate(()=>JSON.stringify(window.__FIELD_STUDIES__.getDocument()))===ordinary,'private identity does not mutate DocumentStore or create a library scene');
 check(await frame.evaluate(()=>{try{window.__FIELD_STUDIES__.capture(320,240);return false;}catch{return true;}}),'ordinary native capture cannot export the private identity');
 check(await frame.evaluate(()=>window.__FIELD_STUDIES__.inspect().private===true),'generic engine diagnostics do not expose private shape parameters');
 check(!(await frame.evaluate(()=>JSON.stringify(localStorage))).includes('sha256-native-identity-basis'),'private identity fingerprint is absent from browser scene persistence');
 await mkdir(artifacts,{recursive:true});await frame.locator('#stage').screenshot({path:fileURLToPath(new URL('controlled-private-native.png',artifacts))});
 await frame.getByRole('button',{name:'Return to my Expression',exact:true}).click();await frame.waitForFunction(()=>!document.body.hasAttribute('data-private-identity'));check(await frame.evaluate(()=>JSON.stringify(window.__FIELD_STUDIES__.getDocument()))===ordinary,'return restores the same authored Expression, not a claimed GPU rewind');
 check(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('These are my exact words'),'human personal prose is absent from browser persistence');
 check(errors.length===0,'no production UI or native-renderer browser errors');
 outcome='passed';
}catch(error){outcome='failed';throw error;}finally{
 await mkdir(artifacts,{recursive:true});if(page)await page.screenshot({path:fileURLToPath(new URL('controlled-personal-ui.png',artifacts)),fullPage:true}).catch(()=>{});
 await writeFile(new URL('browser-receipt.json',artifacts),JSON.stringify({outcome,standing:'controlled-personal-owner-real-browser-native-WebGL-not-live-person-or-model',checks,errors},null,2));await browser?.close();await server.close();bridge.closeAllConnections();await new Promise(resolve=>bridge.close(resolve));
}
