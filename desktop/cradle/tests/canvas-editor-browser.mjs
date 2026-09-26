import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=fileURLToPath(new URL('./artifacts/canvas-editor/',import.meta.url));mkdirSync(out,{recursive:true});
const original='---\ncustom: retain exactly\n---\n\n# Source document\n\nFirst same 🙂 passage.\n\nSecond same 🙂 passage.\n\n| A | B |\n| --- | --- |\n| x | y |\n';
let source=original,revision='r1',draft={revision:0,text:''},sent=[],contexts=new Map(),calls=[],failSend=false,dropContextHandler=false,delayedRead;
const template=readFileSync(root+'documents/ql-flow.html','utf8');
const docPattern=/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const flowDoc=JSON.parse(template.match(docPattern)[1]);flowDoc.meta.documentId='controlled-flow';flowDoc.entries=[1,2].map(i=>({id:'entry-'+i,author:'F',at:'2026-09-20',html:'<p>Repeated authored passage.</p>',replyTo:null,touched:false}));
flowDoc.entries[0].html='<p><strong>Repeated authored passage.</strong> echo echo <a href="jav&#x0a;ascript:window.__flowUnsafe=true">Unsafe link</a><img src="https://example.invalid/private-tracker" onerror="window.__flowUnsafe=true"><svg onload="window.__flowUnsafe=true"></svg><script>window.__flowUnsafe=true</script></p>';
flowDoc.entries[1].replyTo={entryId:'entry-1',anchor:'echo'};
flowDoc.notes=[{id:'note-1',entryId:'entry-1',author:'F',anchor:'echo',text:'<em>Preserved note.</em>',replies:[{id:'note-reply',author:'H',text:'<strong>Preserved reply.</strong>'}]}];
flowDoc.journal=[{id:'journal-1',at:'2026-09-20',html:'<p><em>Journal stays separate.</em></p>'}];
flowDoc.media=[{id:'media-1',entry:'entry-1',name:'Retained file',mime:'application/octet-stream',data:'unchanged payload',caption:'<p>Authored caption.</p>'}];
let flowSource=template.replace(docPattern,()=>'<script type="application/json" id="ql-doc">'+JSON.stringify(flowDoc).replace(/<\/script/gi,'<\\/script')+'</script>');
let flowRevision='f1';
const flowReading=()=>({...reading(),content:flowSource,revision:flowRevision});
const reading=()=>({schema:'central.file-reading/v1',location:{root:'central',path:'Work/demo/sample.md',ref:'central:source:sample.md'},content:source,revision,byte_len:Buffer.byteLength(source),content_encoding:'utf-8',project:{name:'demo',path:'Work/demo',project_ref:'project:demo'},source:null,operations:{write:{available:true,reason:null},history:{available:false,reason:null},restore:{available:false,reason:null}},automatic_agent_or_model_invocation:false});
const digest=items=>'blake3:controlled-'+createHash('sha256').update(JSON.stringify(items)).digest('hex');
const scope=(project,session)=>({project:'project:'+project,agent_session:session??null});
function getContext(project,session){const key=JSON.stringify(scope(project,session));if(!contexts.has(key))contexts.set(key,{schema:'aikit.prepared-context/v1',scope:scope(project,session),revision:0,digest:digest([]),items:[]});return contexts.get(key);}
function execute(op){calls.push(op);
 if(op.op==='state')return {result:'state',snapshot:{focus:{},surfaces:{},buffers:{}}};
 if(op.op==='ground')return {result:'ground_reading',reading:{}};
 if(op.op==='file_read')return {result:'file_read',reading:op.location.path.endsWith('flow.html')?flowReading():reading()};
 if(op.op==='file_operation'){if(op.request.action==='write'&&op.location.path.endsWith('flow.html')){assert.equal(op.request.expected_revision,flowRevision);flowSource=op.request.content;flowRevision='f2';return {result:'file_operation',data:{outcome:'written',revision:flowRevision}};}if(op.request.action==='write'){if(op.request.expected_revision!==revision)return {result:'file_operation',data:{outcome:'conflict',current:reading()}};source=op.request.content;revision='r'+(Number(revision.slice(1))+1);return {result:'file_operation',data:{outcome:'written',revision}};}throw Error('Unsupported controlled file operation');}
 if(op.op==='knowledge'){if(op.request.action==='resolve')return {result:'knowledge',data:{hits:[{resource:'central:source:sample.md',label:'sample.md',provider:'controlled-source',authority:'source',kind:'source',address:{kind:'source',value:'central:source:sample.md'}}],rows:[],absences:[]}};if(op.request.action==='explain')return {result:'knowledge',data:{resource:'central:source:sample.md',provider:'controlled-source',authority:'source',evidence:[],why_selected:'Exact source address in the selected Project'}};}
 if(op.op==='encounter_task_read')return {result:'encounter_task_reading',data:null};
 if(op.op!=='encounter')return {result:'unavailable',data:{}};
 const req=op.request;let data;
 if(req.action==='start'||req.action==='health')data={running:true};
 else if(req.action==='providers')data=[];
 else if(req.action==='status')data={state:'Idle',resident:true};
 else if(req.action==='view')data={schema:'aikit.encounter-view/v1',agent_session:req.agent_session,blocks:sent.map((s,index)=>({id:index,kind:'user',text:s.text})),more:false,draft,connection:{state:'Idle'},actions:['draft','prompt','context'].map(name=>({ref:'aikit.encounter.'+name,enabled:true,reason:null}))};
 else if(req.action==='draft'){assert.equal(req.basis,draft.revision);draft={text:req.text,revision:draft.revision+1};data=draft;}
 else if(req.action==='context'){
  if(dropContextHandler)throw Error('Deliberately disconnected native context handler');
  const c=getContext(op.project,req.agent_session),r=req.request;
  if(r.operation==='edit'){assert.equal(r.basis,c.revision);if(r.mutation.operation==='add'){const s=r.mutation.selection;assert.ok(s.source_ref);assert.ok(s.anchor);const id='controlled:'+JSON.stringify([s.source_ref,s.anchor,s.text,s.source_revision]);const item={id,selection:s,expression:{node:'address',expression:{node:'subject',value:s.source_ref}},canonical_expression:r.mutation.expression??'@ '+s.source_ref};c.items=c.items.filter(x=>x.id!==id).concat(item);}if(r.mutation.operation==='remove')c.items=c.items.filter(x=>x.id!==r.mutation.id);if(r.mutation.operation==='clear')c.items=[];c.revision++;c.digest=digest(c.items);}
  if(r.operation==='adopt'){const p=getContext(op.project,null);assert.equal(c.revision,r.basis);assert.equal(p.revision,r.project_basis);c.items.push(...p.items);c.revision++;c.digest=digest(c.items);p.items=[];p.revision++;p.digest=digest([]);}
  data=c;
 }
 else if(req.action==='prompt-context'){const c=getContext(op.project,req.agent_session);assert.equal(req.context.digest,c.digest);assert.equal(req.context.revision,c.revision);assert.deepEqual(req.context.reviewed,c.items.map(x=>x.id));assert.equal(req.draft_revision,draft.revision);if(failSend)throw Error('Controlled provider transport failed');sent.push({text:draft.text,context:structuredClone(c)});c.items=[];c.revision++;c.digest=digest([]);draft={text:'',revision:draft.revision+1};data={accepted:true,draft};}
 else if(req.action==='prompt'){assert.equal(getContext(op.project,req.agent_session).items.length,0,'Legacy prompt must not drop structured context');sent.push({text:draft.text});draft={text:'',revision:draft.revision+1};data={accepted:true,draft};}
 else throw Error('Unknown controlled request '+req.action);
 return {result:'encounter_reading',data};
}
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
server.middlewares.use('/op',(request,response)=>{let body='';request.on('data',chunk=>body+=chunk);request.on('end',()=>{response.setHeader('content-type','application/json');try{const op=JSON.parse(body);if(delayedRead&&op.request?.action==='context'&&op.request.request.operation==='read'){const hold=delayedRead;delayedRead=undefined;hold.response=()=>{const outcome=execute(op);response.end(JSON.stringify({ok:true,outcome:{...outcome,receipts:[]}}));};return;}const outcome=execute(op);response.end(JSON.stringify({ok:true,outcome:{...outcome,receipts:[]}}));}catch(e){response.end(JSON.stringify({ok:false,error:String(e)}));}});});
server.middlewares.use('/events',(_q,res)=>{res.setHeader('content-type','application/json');res.end('{"ok":true,"receipts":[]}');});
server.middlewares.use('/canvas-editor',async(_q,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/canvas-editor','<body class="oi-desktop" style="margin:0"><script>window.__OI_KERNEL_BRIDGE__=location.origin</script><div id="root"></div><script type="module" src="/tests/canvas-editor-page.tsx"></script></body>'));});
await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/canvas-editor`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});
const page=await browser.newPage({viewport:{width:1280,height:820}});const requests=[];page.on('request',request=>requests.push(request.url()));const errors=[];page.on('pageerror',e=>errors.push(e.message));const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
try{
 await page.goto(url);await page.getByRole('tab',{name:'Source',exact:true}).click();await page.getByRole('textbox',{name:'Editing sample.md'}).waitFor();await page.waitForFunction(()=>window.canvasTest);
 const start=original.lastIndexOf('same');await page.evaluate(start=>canvasTest.select(start,start+7),start);
 await page.getByRole('button',{name:'Bold',exact:true}).click();await page.waitForFunction(()=>canvasTest.document().includes('**same 🙂**'));
 check('formatting changes only second passage and preserves frontmatter',(await page.evaluate(()=>canvasTest.document())).startsWith('---\ncustom: retain exactly\n---'));
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(doc=>canvasTest.document()===doc,original);checks.push('undo restores exact source');
 await page.getByRole('tab',{name:'Split',exact:true}).click();await page.locator('.material-preview-pane').getByRole('tab',{name:'Rendered',exact:true}).waitFor();check('split keeps one editor',await page.locator('.cm-editor').count()===1);
 await page.evaluate(start=>canvasTest.select(start,start+7),start);await page.getByRole('button',{name:'Add selected text to context',exact:true}).click();
 await page.locator('.prepared-context-item').waitFor();check('ordinary add has no modal',await page.getByRole('dialog').count()===0);
 await page.locator('.prepared-context-item summary').click();
 const nativeExpression=getContext('demo','agent-session/test').items[0].canonical_expression;
 const beforeResolve=calls.filter(c=>c.op==='knowledge').length;
 await page.getByRole('button',{name:'Resolve expression',exact:true}).click();await page.getByText('1 resolved references · preparation is unchanged').waitFor();
 check('selection expression uses the same native Resolve request unchanged',calls.slice().reverse().find(c=>c.op==='knowledge')?.request.query===nativeExpression&&calls.filter(c=>c.op==='knowledge').length===beforeResolve+1);
 await page.getByRole('button',{name:'Explain',exact:true}).click();await page.getByText('Exact source address in the selected Project').waitFor();checks.push('native Explain is reachable without disclosing additional source bodies');
 await page.locator('.prepared-context-item summary').click();
 let queued=getContext('demo','agent-session/test');check('queued exact second occurrence',queued.items[0].selection.anchor.start===start);check('Unicode range retained',queued.items[0].selection.text==='same 🙂');
 await page.waitForFunction(()=>document.querySelector('.context-prepared-highlight'));checks.push('prepared selection has a retained source cue');
 await page.evaluate(()=>canvasTest.change('Explain the selected passage'));await page.waitForFunction(()=>canvasTest.session()?.draft==='Explain the selected passage'&&!canvasTest.session().busy);
 failSend=true;await page.evaluate(()=>canvasTest.send());check('failed send keeps exact native prepared selection',getContext('demo','agent-session/test').items.length===1);check('failed send retains the instruction',draft.text==='Explain the selected passage');failSend=false;
 // Edit selected bytes after preparation; sending must be blocked BEFORE the native handler.
 await page.evaluate(start=>canvasTest.select(start,start+7),start);await page.getByRole('textbox',{name:'Editing sample.md'}).press('Backspace');const before=calls.filter(c=>c.request?.action==='prompt-context').length;await page.evaluate(()=>canvasTest.send());check('stale selection blocked before native dispatch',calls.filter(c=>c.request?.action==='prompt-context').length===before);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(doc=>canvasTest.document()===doc,original);await page.evaluate(()=>canvasTest.send());
 check('actual shared session send includes structured context',sent.length===1&&sent[0].context.items[0].selection.text==='same 🙂');check('successful submission clears preparation',getContext('demo','agent-session/test').items.length===0);
 await page.waitForFunction(()=>!document.querySelector('.context-prepared-highlight'));checks.push('successful submission clears source cue');
 // Negative wiring test: cutting the owner handler cannot be mistaken for success.
 dropContextHandler=true;await page.evaluate(start=>canvasTest.select(start,start+7),start);await page.getByRole('button',{name:'Add selected text to context',exact:true}).click();await page.getByRole('alert').filter({hasText:'disconnected native context handler'}).waitFor();check('disconnected handler produces no prepared item',getContext('demo','agent-session/test').items.length===0);dropContextHandler=false;
 await page.getByRole('button',{name:'Dismiss context notice'}).click();
 // Rich preview uses real parser and preserves source state across mode changes.
 await page.locator('.material-source-pane').getByRole('tab',{name:'Rendered',exact:true}).click();check('hidden source editor is retained',await page.locator('.cm-editor').count()===1);
 const frame=page.frameLocator('iframe[data-page-context]');await frame.locator('table').waitFor();checks.push('Markdown table is rendered by production preview');
 await page.getByRole('tab',{name:'Source',exact:true}).click();check('presentation switch is lossless',await page.evaluate(()=>canvasTest.document())===original);
 for(const [theme,width]of [['light',1280],['dark',430]]){await page.setViewportSize({width,height:820});await page.evaluate(t=>document.body.dataset.theme=t,theme);await page.screenshot({path:out+`${theme}-${width}.png`});}
 await page.setViewportSize({width:1280,height:820});
 // No-agent preparation uses native Project scope, never starts a model.
 await page.locator('#toggle-agent').click();await page.evaluate(start=>canvasTest.select(start,start+7),start);await page.getByRole('button',{name:'Add selected text to context',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.prepared-context-item').length===1);check('preparation without Agent is native Project-scoped',getContext('demo',null).items.length===1);
 // Real async handler regression: the old owner read completes after the companion changes.
 await page.getByRole('button',{name:'Clear prepared context',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.prepared-context-item').length===0);
 const hold={};delayedRead=hold;
 await page.evaluate(start=>canvasTest.select(start,start+7),start);await page.getByRole('button',{name:'Add selected text to context',exact:true}).click();
 for(let i=0;!hold.response&&i<100;i++)await new Promise(r=>setTimeout(r,20));assert.ok(hold.response,'native read is held');
 const writesBefore=calls.filter(c=>c.request?.action==='context'&&c.request.request.operation==='edit').length;
 await page.locator('#toggle-agent').click();hold.response();
 await page.getByRole('alert').filter({hasText:'destination changed'}).waitFor();
 check('switching companion during native read does not retarget or mutate context',calls.filter(c=>c.request?.action==='context'&&c.request.request.operation==='edit').length===writesBefore);
 check('switched scope does not keep prepared highlights',await page.locator('.context-prepared-highlight').count()===0);
 // Flow uses the supplied HTML carrier and the production native file write path.
 await page.goto(url+'?flow');await page.getByRole('textbox',{name:'New entry',exact:true}).waitFor();
 check('rich authored Flow entries are not flattened to text',await page.locator('[data-flow-entry="entry-1"] .flow-thread-body strong').textContent()==='Repeated authored passage.');
 check('Flow notes and their replies retain their own rich bodies',await page.locator('[data-note-id="note-1"] em').textContent()==='Preserved note.'&&await page.locator('.flow-thread-note-reply strong').textContent()==='Preserved reply.');
 check('duplicate reply/note anchors require review instead of choosing first',await page.locator('[data-note-anchor-state="ambiguous"]').count()===1&&await page.locator('[data-reply-state="ambiguous"]').count()===1);
 await page.getByText('Journal pages (1)',{exact:true}).click();check('Journal remains a distinct rich collection',await page.locator('[data-journal-page="journal-1"] em').textContent()==='Journal stays separate.');
 check('Flow preview cannot activate scripts, handlers, SVG or remote tracking media',!await page.evaluate(()=>window.__flowUnsafe)&&await page.locator('.flow-thread :is(script,svg,[onerror],[onload],[href^="javascript:"])').count()===0&&!requests.some(url=>url.includes('example.invalid/private-tracker')));
 await page.getByRole('textbox',{name:'New entry',exact:true}).fill('An unsaved Flow entry 🙂');
 await page.evaluate(()=>canvasTest.select(3,10));await page.getByRole('button',{name:'Add selected text to context',exact:true}).click();
 await page.locator('.prepared-context-item').waitFor();
 const flowPrepared=getContext('demo','agent-session/test');
 check('Flow new-entry range is a revision-carrying unsaved observation, not raw HTML offsets',flowPrepared.items[0].selection.anchor.kind==='observation'&&flowPrepared.items[0].selection.anchor.document_id==='controlled-flow'&&flowPrepared.items[0].selection.working_copy&&flowPrepared.items[0].selection.source_revision==='f1'&&flowPrepared.items[0].selection.text==='unsaved');
 await page.waitForFunction(()=>document.querySelector('.context-prepared-highlight'));checks.push('Flow draft retains a view-only cue');
 await page.getByRole('button',{name:'Clear prepared context',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.prepared-context-item').length===0);
 await page.locator('[data-flow-entry="entry-2"] .flow-thread-body > p').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const s=window.getSelection();s.removeAllRanges();s.addRange(range);});
 await page.getByRole('button',{name:'Add selected text to context',exact:true}).click();await page.locator('.prepared-context-item').waitFor();
 const rendered=getContext('demo','agent-session/test').items[0].selection;
 check('ordinary rendered Flow selection keeps the second entry identity',rendered.anchor.kind==='observation'&&rendered.anchor.document_id==='controlled-flow'&&rendered.anchor.node_ref==='entry-2'&&rendered.text==='Repeated authored passage.');
 check('rendered Flow selection opens no modal',await page.getByRole('dialog').count()===0);
 await page.getByRole('button',{name:'Save · ⌘S',exact:true}).click();await page.waitForFunction(()=>canvasTest.document()==='');
 const savedDoc=JSON.parse(flowSource.match(docPattern)[1]);
 check('Flow save preserves document identity, existing entries and template bytes',savedDoc.meta.documentId==='controlled-flow'&&JSON.stringify(savedDoc.entries.slice(0,2))===JSON.stringify(flowDoc.entries)&&flowSource.replace(docPattern,'DATA')===template.replace(docPattern,'DATA'));
 check('Flow save retains all notes, media, Journal and unknown payload bytes',JSON.stringify(savedDoc.notes)===JSON.stringify(flowDoc.notes)&&JSON.stringify(savedDoc.media)===JSON.stringify(flowDoc.media)&&JSON.stringify(savedDoc.journal)===JSON.stringify(flowDoc.journal));
 await page.reload();await page.locator('.flow-thread-entry').last().waitFor();check('Flow native save roundtrips the new entry',await page.locator('.flow-thread-entry').count()===3);
 await page.screenshot({path:out+'flow-context.png'});
 check('no page errors',errors.length===0);
 writeFileSync(out+'receipt.json',JSON.stringify({standing:'controlled production-component/handler evidence; native store independently tested in Rust; not installed/provider/human proof',checks,errors,calls:calls.filter(c=>['context','prompt-context'].includes(c.request?.action)).map(c=>({op:c.op,action:c.request.action,project:c.project}))},null,2));
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{if(errors.length)console.error(errors);await page.screenshot({path:out+'last-state.png'}).catch(()=>{});await browser.close();await server.close();}
