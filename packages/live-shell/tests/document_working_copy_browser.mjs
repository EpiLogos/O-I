import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

// Actual opaque document frame + Chromium WebStorage. No native route is
// replaced: this checks local recovery; owner CAS/installed admission are
// separate native replays.
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const require=createRequire(import.meta.url);
const ts=require(root+'/packages/live-shell/ui/node_modules/typescript/lib/typescript.js');
const {chromium}=require(process.env.OI_BROWSER_RUNTIME||'playwright');
const profile=await mkdtemp(join(tmpdir(),'oi-document-recovery-'));
const authored=await readFile(root+'/desktop/cradle/documents/ql-flow.html','utf8');
const bridge=await readFile(root+'/desktop/cradle/src/context/document-host.js','utf8');
const modules=new Map();
for(const [url,file] of [['/identity.mjs','document/identity.ts'],['/drafts.mjs','workspace/drafts.ts'],['/dayForm.mjs','central/dayForm.ts']]){
 const source=await readFile(root+'/desktop/cradle/src/'+file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace('"../document/identity"','"/identity.mjs"').replace('"../central/dayForm"','"/dayForm.mjs"').replace("'../central/dayForm'","'/dayForm.mjs'").replace("'../document/identity'","'/identity.mjs'");
 modules.set(url,code);
}

const {build}=require(root+'/packages/live-shell/ui/node_modules/esbuild');
const frameBundle=await build({entryPoints:[root+'/desktop/cradle/src/document/frame.ts'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{name:'actual-document-scripts',setup(build){build.onResolve({filter:/\?raw$/},args=>({path:resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'document-script'}));build.onLoad({filter:/.*/,namespace:'document-script'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}],alias:{react:root+'/packages/live-shell/ui/node_modules/react'}});
modules.set('/frame.mjs',frameBundle.outputFiles[0].text);
const server=createServer((request,response)=>{
 const code=modules.get(request.url);
 response.setHeader('Content-Type',code?'text/javascript':'text/html');
 response.end(code??'<html><body></body></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
let context;
let checks=0;
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.OI_BROWSER_EXECUTABLE?{executablePath:process.env.OI_BROWSER_EXECUTABLE}:{})});
 let page=await context.newPage();await page.goto(url);
 await page.evaluate(async()=>{window.store=await import('/drafts.mjs');window.identity=await import('/identity.mjs');window.observed=[];window.addEventListener('message',event=>{if(event.source===document.querySelector('iframe')?.contentWindow&&event.data?.type==='oi:document-host-changed')window.observed.push(event.data.result);});});
 await page.evaluate(({authored,bridge})=>{const frame=document.createElement('iframe');frame.sandbox='allow-scripts allow-forms';frame.srcdoc=authored.replace(/<head[^>]*>/i,head=>head+'<script>'+bridge+'</script>');document.body.append(frame);},{authored,bridge});
 const frame=page.frameLocator('iframe');
 await frame.locator('[aria-label="Title"]').fill('Actual browser recovery edit');
 await page.waitForFunction(()=>window.observed.some(value=>value.text?.includes('Actual browser recovery edit')));
 checks++;
 const observed=await page.evaluate(()=>window.observed.at(-1));
 // The real form initializes its own identity/revision. Its observed initial
 // payload supplies this local test's pinned bytes, without an owner receipt.
 const formatting=await page.evaluate(text=>window.identity.sameDocumentPayload(text,JSON.stringify(JSON.parse(text),null,2)),observed.text);assert.equal(formatting,true);checks++;
 const edited=JSON.parse(observed.text);
 const canonicalDoc=structuredClone(edited);canonicalDoc.meta.title='';
 const canonical=authored.replace(/(<script type="application\/json" id="ql-doc">)[\s\S]*?(<\/script>)/,(_,head,tail)=>head+JSON.stringify(canonicalDoc).replace(/</g,'\\u003c')+tail);
 const location={schema:'central.path-ref/v1',ref:'local-browser-recovery:'+profile,root:profile,path:'ql-flow.html'};
 const revision='local-browser-sha256:'+createHash('sha256').update(canonical).digest('hex');
 const copy={schema:'oi.cradle.page-working-copy/v1',location,scope:null,base_revision:revision,saved_content:canonical,frame_content:canonical,document:await page.evaluate(html=>window.identity.readDocumentIdentity(html),canonical),island:{text:observed.text,revision:observed.revision,documentId:observed.documentId}};
 await page.evaluate(({copy,canonical,revision})=>{
  const s=window.store,ref=copy.location.ref;
  const old={content:canonical+'\nsource typing one',base_revision:revision,saved_content:canonical};
  const newer={...old,content:canonical+'\nsource typing two'};
  s.writeDraftIntent(ref,old);s.writePageDraft(ref,copy);s.writeDraftIntent(ref,newer);s.acknowledgeDraft(ref,old);
  if(s.readDraft(ref).content!==newer.content||s.readDurableDraft(ref).acknowledged!==false)throw Error('Delayed source acknowledgement overwrote newer source typing');
  if(s.readPageDraft(ref).island.text!==copy.island.text)throw Error('Source typing erased page working copy');
  s.acknowledgeDraft(ref,newer);s.clearSavedDraft(ref,newer.content);
  if(s.readDraft(ref)!==null||!s.readPageDraft(ref))throw Error('Source clear did not preserve page variant');
  s.writeDraft(ref,newer);
 },{copy,canonical,revision});
 checks+=3;
 await context.close();context=undefined;
 context=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.OI_BROWSER_EXECUTABLE?{executablePath:process.env.OI_BROWSER_EXECUTABLE}:{})});page=await context.newPage();await page.goto(url);
 await page.evaluate(async()=>{window.store=await import('/drafts.mjs');window.identity=await import('/identity.mjs');});
 const recovered=await page.evaluate(ref=>({page:window.store.readPageDraft(ref),source:window.store.readDraft(ref),html:window.store.pageDraftHtml(window.store.readPageDraft(ref))}),location.ref);
 assert.equal(recovered.page.base_revision,revision);assert.equal(recovered.page.island.text,observed.text);assert.match(recovered.source.content,/source typing two$/);checks++;
 await page.evaluate(({html,bridge})=>{const iframe=document.createElement('iframe');iframe.sandbox='allow-scripts allow-forms';iframe.srcdoc=html.replace(/<head[^>]*>/i,head=>head+'<script>'+bridge+'</script>');document.body.append(iframe);},{html:recovered.html,bridge});
 await page.frameLocator('iframe').locator('[aria-label="Title"]').waitFor();
 const readback=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=crypto.randomUUID();const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('Actual restored frame did not answer'));},1500);const receive=event=>{if(event.source!==document.querySelector('iframe').contentWindow||event.data?.type!=='oi:document-host-response'||event.data.request!==request)return;clearTimeout(timer);window.removeEventListener('message',receive);resolve(event.data.result);};window.addEventListener('message',receive);document.querySelector('iframe').contentWindow.postMessage({type:'oi:document-host-request',request,op:'read'},'*');}));
 assert.equal(JSON.parse(readback.text).meta.title,'Actual browser recovery edit');checks++;
 await page.evaluate(({ref,text,location})=>{const source=window.store.readDraft(ref);window.store.clearPageDraft(ref,text,location,null);if(window.store.readPageDraft(ref)!==null||window.store.readDraft(ref).content!==source.content)throw Error('Page clear erased independent source typing');localStorage.setItem('oi-cradle.draft.v1:'+ref,'{corrupt');let refused=false;try{window.store.writeDraft(ref,source);}catch{refused=true;}if(!refused||localStorage.getItem('oi-cradle.draft.v1:'+ref)!=='{corrupt')throw Error('Corrupt recovery bytes were overwritten');},{ref:location.ref,text:observed.text,location});checks+=2;

 // Application close executes these same registered real source + opaque
 // document reads. Six actual edited frames exercise the shared four-slot
 // acquisition limit and joining an overlapping close snapshot.
 await page.evaluate(async()=>{window.recovery=await import('/frame.mjs');window.release=[];window.closeActive=0;window.closeMax=0;window.closeReads=0;window.actualRead=iframe=>new Promise((resolve,reject)=>{const request=crypto.randomUUID();const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('Actual document frame did not answer its final checkpoint'));},1500);const receive=event=>{if(event.source!==iframe.contentWindow||event.data?.type!=='oi:document-host-response'||event.data.request!==request)return;clearTimeout(timer);window.removeEventListener('message',receive);resolve(event.data.result);};window.addEventListener('message',receive);iframe.contentWindow.postMessage({type:'oi:document-host-request',request,op:'read'},'*');});});
 for(let index=0;index<6;index++){
  await page.evaluate(({authored,bridge,index})=>{const iframe=document.createElement('iframe');iframe.id='close-frame-'+index;iframe.sandbox='allow-scripts allow-forms';iframe.srcdoc=authored.replace(/<head[^>]*>/i,head=>head+'<script>'+bridge+'</script>');document.body.append(iframe);},{authored,bridge,index});
  await page.frameLocator('#close-frame-'+index).locator('[aria-label="Title"]').fill('Quit recovery '+index);
  await page.evaluate(({index,copy})=>{
   const iframe=document.getElementById('close-frame-'+index),ref=copy.location.ref+':close:'+index;
   const source=document.createElement('textarea');source.value='Actual unsaved source '+index;document.body.append(source);
   window.release.push(window.recovery.registerDocumentCheckpoint('close-'+index,async()=>{window.store.writeDraft(ref,{content:source.value,base_revision:copy.base_revision,saved_content:copy.saved_content});}));
   window.release.push(window.recovery.registerDocumentCheckpoint('close-'+index,async()=>{
    window.closeActive++;window.closeReads++;window.closeMax=Math.max(window.closeMax,window.closeActive);
    try{const island=await window.actualRead(iframe);const parsed=JSON.parse(island.text);const canonical=copy.saved_content.replace(/(<script type="application\/json" id="ql-doc">)[\s\S]*?(<\/script>)/,(_,head,tail)=>head+JSON.stringify(parsed).replace(/</g,'\\u003c')+tail);window.store.writePageDraft(ref,{...copy,location:{...copy.location,ref},saved_content:canonical,frame_content:canonical,document:window.identity.readDocumentIdentity(canonical),island});}finally{window.closeActive--;}
   }));
  },{index,copy});
 }
 const closeResult=await page.evaluate(async ref=>{await Promise.all([window.recovery.checkpointAllDocuments(),window.recovery.checkpointAllDocuments()]);return{max:window.closeMax,reads:window.closeReads,records:Array.from({length:6},(_,index)=>({source:window.store.readDraft(ref+':close:'+index),page:window.store.readPageDraft(ref+':close:'+index)}))};},copy.location.ref);
 assert.ok(closeResult.max<=4);assert.equal(closeResult.reads,6);assert.equal(closeResult.records.length,6);for(let index=0;index<6;index++){assert.equal(closeResult.records[index].source.content,'Actual unsaved source '+index);assert.equal(JSON.parse(closeResult.records[index].page.island.text).meta.title,'Quit recovery '+index);}checks+=3;
 await page.evaluate(()=>{for(const unregister of window.release)unregister();window.release=[];const iframe=document.createElement('iframe');iframe.sandbox='allow-forms';iframe.srcdoc='<html><body>Scripts unavailable</body></html>';document.body.append(iframe);window.release.push(window.recovery.registerDocumentCheckpoint('unreadable',async()=>{await window.actualRead(iframe);}));});
 await assert.rejects(()=>page.evaluate(()=>window.recovery.checkpointAllDocuments()),/did not answer/);checks++;
 await page.evaluate(()=>{for(const unregister of window.release)unregister();});


 await page.evaluate(({ref,revision,canonical})=>{window.release=[window.recovery.registerDocumentCheckpoint('corrupt-store',async()=>window.store.writeDraft(ref,{content:'Actual final source text',base_revision:revision,saved_content:canonical}))];},{ref:copy.location.ref,revision,canonical});
 await assert.rejects(()=>page.evaluate(()=>window.recovery.checkpointAllDocuments()));
 assert.equal(await page.evaluate(ref=>localStorage.getItem('oi-cradle.draft.v1:'+ref),copy.location.ref),'{corrupt');checks++;
 await page.evaluate(()=>{for(const unregister of window.release)unregister();const frame=document.getElementById('close-frame-0');let unregister;unregister=window.recovery.registerDocumentCheckpoint('removed-frame',async()=>{await window.actualRead(frame);frame.remove();unregister();});window.release=[unregister];});
 await assert.rejects(()=>page.evaluate(()=>window.recovery.checkpointAllDocuments()),/membership changed/);checks++;
 await page.evaluate(()=>{for(const unregister of window.release)unregister();});

 console.log(JSON.stringify({checks,actual_form:'desktop/cradle/documents/ql-flow.html',storage:'Chromium persistent WebStorage, isolated profile',native_owner_acceptance:false},null,2));
}finally{if(context)await context.close();await new Promise(done=>server.close(done));await rm(profile,{recursive:true,force:true});}
