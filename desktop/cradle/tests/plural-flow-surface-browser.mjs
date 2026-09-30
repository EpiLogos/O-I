// The real FlowSurface for plural participation, in a real browser against a
// kernel with real compare-and-swap semantics: explicit upgrade, bringing two
// agents in from the roster, addressing a side inquiry, reading by thread,
// navigating a convergence and surviving a concurrent edit. Controlled
// component evidence only — not the installed app and not a native answer.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=fileURLToPath(new URL('./artifacts/plural-flow-surface/',import.meta.url));mkdirSync(out,{recursive:true});
const template=readFileSync(root+'documents/ql-flow.html','utf8');
const fixtures=JSON.parse(readFileSync(root+'documents/fixtures/plural-flow-cases.json','utf8'));
const island=/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const htmlOf=doc=>template.replace(island,()=>'<script type="application/json" id="ql-doc">'+JSON.stringify(doc).replace(/<\/script/gi,'<\\/script')+'</script>');
const fixtureDoc=name=>JSON.parse(JSON.stringify(fixtures.cases.find(c=>c.name===name).doc));
const readDoc=html=>JSON.parse(html.match(island)[1].replace(/<\\\/script/gi,'</script'));
const files=new Map();let counter=0;
const put=(path,doc)=>files.set(path,{content:htmlOf(doc),revision:'r'+(++counter)});
const legacy=fixtureDoc('upgrade-fh-preserves-everything');
put('Work/demo/legacy.html',legacy);
put('Work/demo/plural.html',(()=>{const d=fixtureDoc('thread-branch-convergence');d.meta.view='dialogue';d.entries.push({id:'e-join',author:'A',authorKey:'p-ann',at:'2026-09-30T09:30:00.000Z',html:'<p>Both answers together.</p>',replyTo:null,touched:false,relations:[{type:'converge',entryId:'e-a1'},{type:'converge',entryId:'e-a2'}],attribution:{basis:'declared'}});return d;})());
put('Work/demo/raced.html',(()=>{const d=fixtureDoc('clean-document-validates');d.meta.participants[0].binding={owner:'document',basis:'unknown'};return d;})());
put('Work/demo/bound.html',fixtureDoc('clean-document-validates'));
const calls=[];let raceOnce=false;
const reading=(path)=>{const f=files.get(path);return {schema:'central.file-reading/v1',location:{root:'central',path,ref:`central:source:${path}`},content:f.content,revision:f.revision,byte_len:Buffer.byteLength(f.content),content_encoding:'utf-8'};};
const roster={schema:'central.agent-profile-roster/v1',scope_ref:'control:root',profiles:[
 {profile:{agent_ref:'agent/ada-lin',ref:'profile/ada-lin',name:'Ada Lin',purpose:'Recovers the argument from its sources',role:'researcher'},accepted:true},
 {profile:{agent_ref:'agent/ash-kay',ref:'profile/ash-kay',name:'Ash Kay',purpose:'Tests a claim on a worked example',role:'analyst'},accepted:true},
 {profile:{agent_ref:'agent/unaccepted',ref:'profile/unaccepted',name:'Not Yet',role:'x'},accepted:false}]};
function execute(op){calls.push(op);
 if(op.op==='state')return {result:'state',snapshot:{focus:{},surfaces:{},buffers:{}}};
 if(op.op==='ground')return {result:'ground_reading',reading:{}};
 if(op.op==='agent_definition')return {result:'agent_definition_reading',data:roster};
 if(op.op==='file_read')return {result:'file_read',reading:reading(op.location.path)};
 if(op.op==='file_operation'&&op.request.action==='write'){
  const path=op.location.path,f=files.get(path);
  if(raceOnce&&path.endsWith('raced.html')){raceOnce=false;const d=readDoc(f.content);d.entries[0].html='<p>Edited elsewhere in the meantime.</p>';files.set(path,{content:htmlOf(d),revision:'r'+(++counter)});}
  const current=files.get(path);
  if(op.request.expected_revision!==current.revision)return {result:'file_operation',data:{outcome:'conflict',current:reading(path)}};
  files.set(path,{content:op.request.content,revision:'r'+(++counter)});
  return {result:'file_operation',data:{outcome:'written',revision:files.get(path).revision}};
 }
 if(op.op==='knowledge')return {result:'knowledge',data:{hits:[],rows:[],absences:[]}};
 if(op.op==='encounter_task_read')return {result:'encounter_task_reading',data:null};
 if(op.op!=='encounter')return {result:'unavailable',data:{}};
 const a=op.request.action;
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
const checks=[];const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const stored=path=>readDoc(files.get(path).content);
const open=async path=>{await page.goto(`${base}?path=${path}`);await page.locator('.flow-thread-entry').first().waitFor();};
try{
 // 1. A legacy flow reads as before, says so, and upgrades only by choice — keeping every entry and collection.
 await open('Work/demo/legacy.html');
 await page.locator('summary',{hasText:'Participants'}).click();
 check('a legacy flow names itself and offers the upgrade',await page.getByRole('button',{name:'Upgrade to the plural form'}).count()===1);
 check('a legacy flow shows no plural composer controls',await page.getByLabel('Reply to').count()===0);
 const before=stored('Work/demo/legacy.html');
 await page.getByRole('button',{name:'Upgrade to the plural form'}).click();
 await page.getByLabel('Reply to').waitFor();
 const upgraded=stored('Work/demo/legacy.html');
 check('upgrade is a revision-checked write that keeps identity, entries and collections',upgraded.meta.format.version===4&&upgraded.meta.documentId===before.meta.documentId&&JSON.stringify(upgraded.entries.map(e=>[e.id,e.html]))===JSON.stringify(before.entries.map(e=>[e.id,e.html]))&&JSON.stringify(upgraded.notes)===JSON.stringify(before.notes)&&JSON.stringify(upgraded.journal)===JSON.stringify(before.journal)&&upgraded['x-unknown-compatible'].keep===true);

 // 2. Bring two agents in from the roster; only accepted agents are offered; joining starts nothing.
 const offered=await page.locator('.flow-bring-in li').allInnerTexts();
 check('only accepted roster agents are offered',offered.length===2&&offered.some(t=>t.includes('Ada Lin'))&&offered.some(t=>t.includes('Ash Kay'))&&!offered.some(t=>t.includes('Not Yet')));
 await page.locator('.flow-bring-in li',{hasText:'Ada Lin'}).getByRole('button',{name:'Bring in'}).click();
 await page.locator('[data-participant-kind="agent"]',{hasText:'Ada Lin'}).waitFor();
 await page.locator('.flow-bring-in li',{hasText:'Ash Kay'}).getByRole('button',{name:'Bring in'}).click();
 await page.locator('[data-participant-kind="agent"]',{hasText:'Ash Kay'}).waitFor();
 const members=stored('Work/demo/legacy.html').meta.participants;
 const ada=members.find(p=>p.name==='Ada Lin'),ash=members.find(p=>p.name==='Ash Kay');
 check('both agents are keyed participants bound to their roster identity as declared, with distinct initials',ada.key&&ash.key&&ada.key!==ash.key&&ada.binding.ref==='agent/ada-lin'&&ash.binding.ref==='agent/ash-kay'&&ada.binding.basis==='declared'&&ada.initial!==ash.initial);
 check('bringing someone in starts no session or model',!calls.some(c=>c.op==='encounter'&&['send','prompt','open'].includes(c.request?.action)));
 check('an agent already present is no longer offered',(await page.locator('.flow-bring-in li').allInnerTexts()).length===0);

 // 3. Write a side inquiry addressed to one agent; the relation, addressee and author are recorded, not inferred.
 const firstId=stored('Work/demo/legacy.html').entries[0].id;
 await page.getByLabel('Reply to').selectOption(firstId);
 await page.getByLabel('Relation').selectOption('branch');
 await page.getByLabel('Address Ada Lin').check();
 await page.getByRole('textbox',{name:'New entry',exact:true}).fill('Does the argument survive a counterexample?');
 await page.getByRole('button',{name:'Save · ⌘S',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.flow-thread-entry').length===4);
 const inquiry=stored('Work/demo/legacy.html').entries.at(-1);
 check('the side inquiry is recorded as a branch from entry 1, addressed to Ada, authored by the person',inquiry.relations[0].type==='branch'&&inquiry.relations[0].entryId===firstId&&JSON.stringify(inquiry.addressees)===JSON.stringify([ada.key])&&inquiry.authorKey===stored('Work/demo/legacy.html').meta.participants.find(p=>p.kind==='person').key&&inquiry.attribution.basis==='declared'&&inquiry.basisRevision>=0);
 check('the composer controls reset after the entry lands',await page.getByLabel('Reply to').inputValue()===''&&!await page.getByLabel('Address Ada Lin').isChecked());
 check('the branch reads as such in order, with its addressee',(await page.locator('[data-flow-entry]').last().innerText()).match(/Branches from\s*entry 1/)&&(await page.locator('[data-flow-entry]').last().innerText()).includes('To Ada Lin'));

 // 4. Threads: the branch sits under its parent; sibling answers stay siblings; a convergence is reachable from every entry it joins.
 await page.getByRole('button',{name:'Threads'}).click();
 await page.locator('.flow-thread-tree').waitFor();
 check('the branch is nested under the entry it branches from',await page.locator('[data-flow-entry] > .flow-thread-children > [data-flow-entry]').count()>=1);

 // 5. Two participants sharing an initial stay distinct by key; a convergence navigates to what it joins.
 await open('Work/demo/plural.html');
 const authors=await page.locator('.flow-thread-who').evaluateAll(els=>els.map(el=>[el.textContent,el.dataset.flowAuthorKey,el.dataset.flowAuthor]));
 check('authors resolve by key, not by the initial they share',JSON.stringify(authors.slice(0,3))===JSON.stringify([['Ann','p-ann','A'],['Ada','p-ada','A'],['Ash','p-ash','S']]));
 await page.getByRole('button',{name:'Threads'}).click();
 await page.locator('[data-flow-entry="e-join"] [data-relation-type="converge"] button').first().click();
 check('a convergence link focuses the entry it draws together',await page.locator('[data-flow-entry="e-a1"][data-focused="true"]').count()===1);
 await page.locator('[data-flow-entry="e-join"] [data-relation-type="converge"] button').nth(1).click();
 check('and the second one too',await page.locator('[data-flow-entry="e-a2"][data-focused="true"]').count()===1&&await page.locator('[data-flow-entry="e-a1"][data-focused="true"]').count()===0);
 check('sibling answers to one question are siblings in the thread',await page.locator('[data-flow-entry="e-q"] > .flow-thread-children > [data-flow-entry]').count()===2);

 // 6. A concurrent edit is a conflict that keeps both sides; the entry is not lost.
 await open('Work/demo/raced.html');
 await page.getByRole('textbox',{name:'New entry',exact:true}).fill('Written while someone else edits');
 raceOnce=true;
 await page.getByRole('button',{name:'Save · ⌘S',exact:true}).click();
 await page.locator('.source-conflict').waitFor();
 check('the conflict keeps the composer text and the current document',(await page.getByRole('textbox',{name:'New entry',exact:true}).textContent())==='Written while someone else edits'&&stored('Work/demo/raced.html').entries[0].html==='<p>Edited elsewhere in the meantime.</p>');

 // The unauthenticated desktop cannot write as a participant the owner bound as verified; it says so and keeps the words.
 await open('Work/demo/bound.html');
 await page.getByRole('textbox',{name:'New entry',exact:true}).fill('I am not authenticated');
 await page.getByRole('button',{name:'Save · ⌘S',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'authentication-required'}).waitFor().catch(()=>page.getByRole('alert').filter({hasText:'only an authenticated caller'}).waitFor());
 check('writing as an owner-bound participant without authentication is refused visibly and keeps the text',(await page.getByRole('textbox',{name:'New entry',exact:true}).textContent())==='I am not authenticated'&&stored('Work/demo/bound.html').entries.length===1);

 // Narrow layout reads without horizontal scroll.
 await page.setViewportSize({width:390,height:844});await open('Work/demo/plural.html');
 check('the plural flow fits a narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
 await page.screenshot({path:out+'plural-narrow.png'});
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Threads'}).click();await page.screenshot({path:out+'plural-threads.png'});
 check('no page errors',errors.length===0);
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{if(errors.length)console.error(errors);await page.screenshot({path:out+'last-state.png'}).catch(()=>{});await browser.close();await server.close();}
