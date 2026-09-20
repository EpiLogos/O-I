/** Production Library interaction on controlled owner protocol. Not installed Mac proof. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {memoryTransport,repositoryFiles,realManifests} from './collection-transport.mjs';

const out=new URL('./artifacts/collection-source/',import.meta.url);await fs.mkdir(out,{recursive:true});
const original=await repositoryFiles();const oldBase='Work/O-I/desktop/cradle/expressions-app/legacy-collections';
const base='Work/Corpus/ProjectCentral/user/collections';const manifest=JSON.parse(original.get(oldBase+'/manifest.json'));
const files=new Map([[base+'/authored.manifest.json',JSON.stringify(manifest)],...[...manifest.featured??[],...manifest.starters??[]].map(e=>[base+'/'+e.file,original.get(oldBase+'/'+e.file)])]);
const t=memoryTransport(files);const checks=[],errors=[];let browser,server,delayed=null;
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
try{
 server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});await server.listen();
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});
 const context=await browser.newContext({viewport:{width:1200,height:900}});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__='http://collection-controlled.invalid';localStorage.setItem('oi-cradle.library.view.v1','gallery');});
 await context.route('http://collection-controlled.invalid/**',async route=>{
  const req=route.request();let response;
  try{
   if(req.method()!=='POST')response={ok:true,events:[]};
   else{
    const op=req.postDataJSON();let result;
    if(delayed&&op.op==='file_read'&&!op.location.path.endsWith('.manifest.json'))await delayed.promise;
    if(op.op==='state')result={result:'state',snapshot:{focus:{},surfaces:{},buffers:{}}};
    else if(op.op==='expression')result={result:'expression',data:{schema:'oi.expression-index/v1',expressions:[]}};
    else if(op.op==='knowledge')result={result:'knowledge',data:{hits:[],absences:[]}};
    else if(op.op==='files_list'||op.op==='file_read'||op.op==='file_operation')result=await t.handle(op);
    else {response={ok:false,error:'Controlled test: optional owner not supplied'};}
    response??={ok:true,outcome:result};
   }
  }catch(e){response={ok:false,error:e.message};}
  await route.fulfill({json:response});
 });
 const url=server.resolvedUrls.local[0]+'tests/collection-browser-page.html';await page.goto(url);
 const members=[...manifest.featured??[],...manifest.starters??[]];const chosen=members.find(e=>e.id==='seven-centres');assert.ok(chosen);
 await page.getByRole('option',{name:new RegExp(chosen.name)}).waitFor();
 check('metadata discovery does not load composition bodies',t.ops.filter(o=>o.op==='file_read'&&!o.location.path.endsWith('.manifest.json')).length===0);
 await page.getByRole('option',{name:new RegExp(chosen.name)}).click();
 await page.getByRole('button',{name:'Open page',exact:true}).click();
 await page.waitForFunction(()=>window.collectionOpened.length===1);
 const opened=await page.evaluate(()=>window.collectionOpened[0]);
 check('second member opens exact native source instead of first sibling or collection alias',opened.item.sourceLocation.path===base+'/'+chosen.file&&opened.item.ref===opened.item.sourceLocation.ref&&opened.how==='source');
 check('source selection returns native revision separately from export time',opened.item.revision.startsWith('sha256:'));
 await page.getByText('Collection membership',{exact:true}).click();
 await page.getByLabel('Member label',{exact:true}).fill('Seven centres — reading view');
 const writesBefore=t.ops.filter(o=>o.op==='file_operation').length;
 await page.getByRole('button',{name:'Save label',exact:true}).focus();await page.keyboard.press('Enter');
 await page.getByRole('status').filter({hasText:'Membership saved'}).waitFor();
 await page.getByRole('option',{name:/Seven centres — reading view/}).waitFor();
 check('keyboard activation performs exactly one native membership write',t.ops.filter(o=>o.op==='file_operation').length===writesBefore+1);
 check('membership edit never rewrites subject body',files.get(base+'/'+chosen.file)===original.get(oldBase+'/'+chosen.file));
 await page.screenshot({path:new URL('library-membership.png',out).pathname,fullPage:true});
 // Source disappears after discovery; click must fail, not return the first sibling.
 files.delete(base+'/'+chosen.file);
 await page.getByRole('button',{name:'Open exact source',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'not present'}).waitFor();
 check('retired selection is an explicit refusal without another open',(await page.evaluate(()=>window.collectionOpened.length))===1);
 files.set(base+'/'+chosen.file,original.get(oldBase+'/'+chosen.file));
 await page.getByRole('button',{name:'Refresh sources',exact:true}).click();
 await page.getByRole('option',{name:/Seven centres — reading view/}).waitFor();
 // Hold an actual pending source read while the person switches horizon.
 let release;delayed={promise:new Promise(r=>{release=r;})};
 await page.getByRole('button',{name:'Open exact source',exact:true}).click();
 await page.getByRole('radio',{name:'Shared web',exact:true}).click();
 check('shared horizon immediately drops prior private items',await page.getByRole('option',{name:/Seven centres/}).count()===0);
 const privateOps=t.ops.length;release();delayed=null;
 await new Promise(r=>setTimeout(r,700));
 check('cancelled private source is not opened after horizon switch',(await page.evaluate(()=>window.collectionOpened.length))===1);
 check('shared queries do not initiate another private collection read',t.ops.length<=privateOps+1);
 check('no uncaught renderer exception',errors.length===0);
 await page.screenshot({path:new URL('library-shared-withdrawal.png',out).pathname,fullPage:true});
 await fs.writeFile(new URL('browser.json',out),JSON.stringify({standing:'controlled-browser',checks,errors,production:false,installed:false},null,2));
 console.log(JSON.stringify({standing:'controlled-browser',passed:checks.length,checks},null,2));
}catch(error){await fs.writeFile(new URL('browser-failure.json',out),JSON.stringify({checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();await server?.close();}
