// Asking agents from the real FlowSurface, against a fake owner that follows the
// conversation contract: an agent's session is started only when a person asks
// it, each recipient's standing is its own plain-words line, and closing the
// view before the answers arrive loses nothing — reopening finds each reply
// once, without asking again. Controlled component evidence: the fake owner is
// the contract, not AIKit, and no model speaks.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=fileURLToPath(new URL('./artifacts/plural-flow-conversation/',import.meta.url));mkdirSync(out,{recursive:true});
const template=readFileSync(root+'documents/ql-flow.html','utf8');
const fixtures=JSON.parse(readFileSync(root+'documents/fixtures/plural-flow-cases.json','utf8'));
const island=/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const htmlOf=doc=>template.replace(island,()=>'<script type="application/json" id="ql-doc">'+JSON.stringify(doc).replace(/<\/script/gi,'<\\/script')+'</script>');
const readDoc=html=>JSON.parse(html.match(island)[1].replace(/<\\\/script/gi,'</script'));
const PATH='Work/demo/ask.html';
const flowRef=`central:source:${PATH}`;
const files=new Map();let counter=0;
const put=doc=>files.set(PATH,{content:htmlOf(doc),revision:'r'+(++counter)});
const seed=JSON.parse(JSON.stringify(fixtures.cases.find(c=>c.name==='thread-branch-convergence').doc));
seed.meta.participants.find(p=>p.key==='p-ada').binding={owner:'central',ref:'agent/ada-lin',basis:'declared'};
seed.meta.participants.find(p=>p.key==='p-ash').binding={owner:'central',ref:'agent/ash-kay',basis:'declared'};
seed.meta.participants[0].binding={owner:'document',basis:'unknown'};
put(seed);
const calls=[];const provisioned=[];const sends=[];const reconciles=[];const conversations=new Map();
let plural;
const reading=path=>{const f=files.get(path);return {schema:'central.file-reading/v1',location:{root:'central',path,ref:`central:source:${path}`},content:f.content,revision:f.revision,byte_len:Buffer.byteLength(f.content),content_encoding:'utf-8'};};
const docNow=()=>readDoc(files.get(PATH).content);
const writeDoc=doc=>files.set(PATH,{content:htmlOf(doc),revision:'r'+(++counter)});
const recipient=(key,session)=>({participant_key:key,agent_session:session,agent_ref:null,delivery_ref:'delivery/'+key,state:'delivered',dispatch:{standing:'sent',detail:null},delivery:{phase:'submitted',first_cursor:1},reply:null,inclusion:{standing:'pending',attempts:0}});
const reading_=c=>({schema:'aikit.conversation-request/v1',request_ref:c.ref,flow:{location:{ref:flowRef}},entry:c.entry,author_key:c.author,recipients:c.recipients,task_completion:'not-inferred'});
function conversationOp(request){
 if(request.action==='conversation-send'){
  const body=request.request;sends.push(body);
  // The owner commits the authored entry through the native append, as a person.
  const committed=plural.appendContribution(docNow(),{operationRef:'conv-entry:'+body.request_ref,authorKey:body.entry.author_key,html:body.entry.html,at:body.entry.at,addressees:body.entry.addressees,relations:body.entry.relations,intent:'response',basisRevision:body.entry.basis_revision},{kind:'human',ref:body.actor});
  writeDoc(committed.doc);
  const c={ref:body.request_ref,author:body.entry.author_key,entry:{entry_id:committed.entry.id,revision:files.get(PATH).revision,document_revision:committed.doc.meta.revision},recipients:body.recipients.map(r=>recipient(r.participant_key,r.agent_session))};
  conversations.set(c.ref,c);return {fresh:true,request:reading_(c)};
 }
 if(request.action==='conversation-list')return {schema:'aikit.conversation-request/v1',requests:[...conversations.values()].map(reading_)};
 if(request.action==='conversation-read')return reading_(conversations.get(request.request_ref));
 if(request.action==='conversation-reconcile'){reconciles.push(request.request_ref);const c=conversations.get(request.request_ref);for(const r of c.recipients)if(r.state==='failed'){r.state='delivered';r.dispatch={standing:'sent',detail:null};}return reading_(c);}
 throw Error('unknown conversation action '+request.action);
}
const current=()=>[...conversations.values()].at(-1);
const recipientOf=(key)=>current().recipients.find(r=>r.participant_key===key);
function include(key,text){
 const c=current(),r=recipientOf(key);
 const replied=plural.appendContribution(docNow(),{operationRef:`conv-reply:${c.ref}:${key}`,authorKey:key,html:'<p>'+text+'</p>',at:new Date().toISOString(),relations:[{type:'reply',entryId:c.entry.entry_id,revision:c.entry.document_revision}],addressees:[c.author],intent:'contribution',basisRevision:c.entry.document_revision},{kind:'agent',ref:r.agent_session,session:r.agent_session,agent:'agent/x'});
 writeDoc(replied.doc);
 r.state='included';r.reply=null;r.delivery={phase:'returned',first_cursor:1,terminal_cursor:9};r.inclusion={standing:'included',entry_id:replied.entry.id,revision:files.get(PATH).revision,attempts:1};
}
const roster={schema:'central.agent-profile-roster/v1',scope_ref:'control:root',profiles:[{profile:{agent_ref:'agent/ada-lin',ref:'profile/ada-lin',name:'Ada',role:'researcher'},accepted:true},{profile:{agent_ref:'agent/ash-kay',ref:'profile/ash-kay',name:'Ash',role:'analyst'},accepted:true}]};
function execute(op){calls.push(op);
 if(op.op==='state')return {result:'state',snapshot:{focus:{},surfaces:{},buffers:{}}};
 if(op.op==='ground')return {result:'ground_reading',reading:{}};
 if(op.op==='agent_definition')return {result:'agent_definition_reading',data:roster};
 if(op.op==='file_read')return {result:'file_read',reading:reading(op.location.path)};
 if(op.op==='file_operation'&&op.request.action==='write'){
  const f=files.get(op.location.path);
  if(op.request.expected_revision!==f.revision)return {result:'file_operation',data:{outcome:'conflict',current:reading(op.location.path)}};
  files.set(op.location.path,{content:op.request.content,revision:'r'+(++counter)});
  return {result:'file_operation',data:{outcome:'written',revision:files.get(op.location.path).revision}};
 }
 if(op.op==='flow_participant_provision'){provisioned.push(op);return {result:'encounter_provisioned',data:{project:'demo',space:'session-space/'+provisioned.length,agent_session:'agent-session/'+op.agent_ref.split('/').pop(),provider:'fixture',agent_ref:op.agent_ref,admission:{admitted:true,unchanged:false}}};}
 if(op.op==='knowledge')return {result:'knowledge',data:{hits:[],rows:[],absences:[]}};
 if(op.op==='encounter_task_read')return {result:'encounter_task_reading',data:null};
 if(op.op!=='encounter')return {result:'unavailable',data:{}};
 const a=op.request.action;
 if(a.startsWith('conversation-'))return {result:'encounter_reading',data:conversationOp(op.request)};
 return {result:'encounter_reading',data:a==='start'||a==='health'?{running:true}:a==='status'?{state:'Idle',resident:true}:[]};
}
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
server.middlewares.use('/op',(request,response)=>{let body='';request.on('data',c=>body+=c);request.on('end',()=>{response.setHeader('content-type','application/json');try{const outcome=execute(JSON.parse(body));response.end(JSON.stringify({ok:true,outcome:{...outcome,receipts:[]}}));}catch(e){response.end(JSON.stringify({ok:false,error:String(e)}));}});});
server.middlewares.use('/events',(_q,res)=>{res.setHeader('content-type','application/json');res.end('{"ok":true,"receipts":[]}');});
server.middlewares.use('/plural',async(_q,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/plural','<body class="oi-desktop" style="margin:0"><script>window.__OI_KERNEL_BRIDGE__=location.origin</script><div id="root"></div><script type="module" src="/tests/plural-flow-surface-page.tsx"></script></body>'));});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}/plural`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
plural=await server.ssrLoadModule('/src/flow/plural.ts');
const checks=[];const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const open=async()=>{await page.goto(`${base}?path=${PATH}`);await page.locator('.flow-thread-entry').first().waitFor();};
const box=()=>page.getByRole('textbox',{name:'New entry',exact:true});
try{
 await open();
 check('asking is offered in a plural flow and needs an addressee',await page.getByRole('button',{name:'Ask for a response'}).isDisabled());
 await box().fill('Does the argument survive the second example?');
 await page.getByLabel('Address Ada').check();
 await page.getByLabel('Address Ash').check();
 check('with text and addressees the ask is available',await page.getByRole('button',{name:'Ask for a response'}).isEnabled());
 check('addressing starts nobody: no session is provisioned before the ask',provisioned.length===0);
 await page.getByRole('button',{name:'Ask for a response'}).click();
 await page.locator('[data-recipient="p-ada"]').waitFor();
 check('each addressed agent is started as exactly its own registered agent, for this flow and this sender',provisioned.length===2&&provisioned.map(p=>p.agent_ref).sort().join()==='agent/ada-lin,agent/ash-kay'&&provisioned.every(p=>p.flow_ref===flowRef&&/^human:p-ann$/.test(p.sender)));
 const request=sends[0];
 check('one conversation request names both sessions and carries the authored entry and its basis',sends.length===1&&request.recipients.length===2&&request.recipients.every(r=>/^agent-session\//.test(r.agent_session))&&request.entry.author_key==='p-ann'&&request.entry.html.includes('second example')&&JSON.stringify([...request.entry.addressees].sort())===JSON.stringify(['p-ada','p-ash'])&&typeof request.entry.basis_revision==='number');
 const afterAsk=docNow();
 check('the agents remember the body they answer from, and the person is not sent their own words twice',afterAsk.meta.participants.filter(p=>p.kind==='agent'&&p.ref).length===2&&afterAsk.entries.filter(e=>e.html.includes('second example')).length===1);
 check('the composer is cleared once the owner has the entry',(await box().textContent())==='');
 check('each recipient reads as its own line: delivered, no answer yet',(await page.locator('[data-recipient="p-ada"]').innerText()).includes('Delivered to Ada; no answer yet')&&(await page.locator('[data-recipient="p-ash"]').innerText()).includes('Delivered to Ash; no answer yet'));

 // An answer arriving shows as arriving, not as done; a refused sibling is named.
 const ada=recipientOf('p-ada');ada.state='answering';ada.reply={text:'Ada considers: the second example holds because',complete:false,bytes:47,truncated:false};
 const ash=recipientOf('p-ash');ash.state='refused';ash.dispatch={standing:'refused',detail:'encounter.disclosure_denied: this session does not admit that sender'};
 await page.locator('[data-recipient="p-ada"][data-recipient-state="answering"]').waitFor({timeout:8000});
 check('an answer still arriving is shown as so, with the words so far',(await page.locator('[data-recipient="p-ada"]').innerText()).includes('Ada is answering')&&(await page.locator('[data-recipient="p-ada"] details').innerText()).includes('Answer so far')&&(await page.locator('[data-recipient="p-ada"]').innerText()).includes('the second example holds because'));
 await page.locator('[data-recipient="p-ash"][data-recipient-state="refused"]').waitFor({timeout:8000});
 check('a refused recipient is named with the owner\'s own code and offers no retry',(await page.locator('[data-recipient="p-ash"]').innerText()).includes('encounter.disclosure_denied')&&await page.locator('[data-recipient="p-ash"] button:has-text("Check again")').count()===0);
 check('a sibling\'s refusal does not read as this one\'s',!(await page.locator('[data-recipient="p-ada"]').innerText()).includes('not asked'));

 // Close every view BEFORE the answer arrives; the owner carries it into the flow.
 await page.goto('about:blank');
 include('p-ada','The second example holds because the step is monotone.');
 await open();
 await page.locator('[data-recipient="p-ada"][data-recipient-state="included"]').waitFor({timeout:8000});
 const replies=docNow().entries.filter(e=>e.authorKey==='p-ada'&&e.html.includes('monotone'));
 check('the answer that arrived while nothing was open is in the flow exactly once, answering the asked entry',replies.length===1&&replies[0].replyTo.entryId===current().entry.entry_id);
 check('reopening finds the reply and its line says so, without asking again',(await page.locator('[data-recipient="p-ada"]').innerText()).includes('the reply is in the flow')&&sends.length===1&&provisioned.length===2);
 check('the reply is shown in the thread under Ada\'s name',(await page.locator(`[data-flow-entry="${replies[0].id}"] .flow-thread-who`).innerText()).startsWith('Ada'));

 // A failed turn can be checked again; the owner, not the view, decides what happens.
 ash.state='failed';ash.dispatch={standing:'sent',detail:null};ash.inclusion={standing:'failed',detail:'Central unavailable',attempts:2};
 await page.locator('[data-recipient="p-ash"][data-recipient-state="failed"]').waitFor({timeout:15000});
 await page.locator('[data-recipient="p-ash"] button:has-text("Check again")').click();
 await page.locator('[data-recipient="p-ash"][data-recipient-state="delivered"]').waitFor({timeout:15000});
 check('checking again asks the owner to reconcile, once, and never re-sends',reconciles.length===1&&sends.length===1);
 await page.screenshot({path:out+'conversation.png'});
 check('no page errors',errors.length===0);
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{if(errors.length)console.error(errors);await page.screenshot({path:out+'last-state.png'}).catch(()=>{});await browser.close();await server.close();}
