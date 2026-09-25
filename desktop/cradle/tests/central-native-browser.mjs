import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const option=name=>process.argv[process.argv.indexOf('--'+name)+1];
const bindings=JSON.parse(await readFile(option('bindings'),'utf8'));
const output=option('output');const observations=[];const errors=[];
const check=(name,condition=true)=>{assert.ok(condition,name);observations.push(name);};
function native(){
 const result=JSON.parse(execFileSync(bindings.ctrl,['--json','--root',bindings.root,'action','run','central.document.read','-'],{input:JSON.stringify({source_ref:bindings.source_ref,document_id:bindings.document_id}),encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024}));
 assert.equal(result.ok,true);return result.data;
}
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const url=server.resolvedUrls.local[0]+'tests/central-native-page.html?bridge='+encodeURIComponent(bindings.bridge);
try{
 for(const name of (process.env.CENTRAL_BROWSER_ENGINES??'chromium').split(',')){
  assert.ok(['chromium','webkit'].includes(name),'unknown browser engine');
  const engine=name==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(name==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:name==='chromium'?['--no-sandbox']:[]});
  let page;
  try{
   const context=await browser.newContext({viewport:{width:1440,height:1100}});
   page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
      await page.goto(url);
   // The root navigator is async from the bridge; wait for either the real
   // "Today" destination (the live root read the WorldNavigator renders once
   // root.control resolves — CentralGround's own gated "Open current Daily
   // Die" button was superseded by this row and is no longer mounted
   // anywhere, main included) or the honest failure alert, then require the
   // real destination.
   await page.getByRole('button',{name:'Open today',exact:true}).or(page.getByRole('alert')).first().waitFor({timeout:60000});
   await page.getByRole('button',{name:'Open today',exact:true}).waitFor({timeout:60000});
   check(name+': root working ground rendered from actual native reads');
   await page.getByRole('button',{name:'Open today',exact:true}).click();
   const face=page.frameLocator('iframe[title^="Day die"]');
   const input=face.locator('[data-field="p0_quick_thoughts"]');
   await input.waitFor();
   assert.equal(await input.getAttribute('contenteditable'),'true');
   check(name+': Today opens original Daily Die through native file/SourceSurface callback');
   assert.match(await page.locator('.editor-path').textContent(),/^Central \/ Control\//);
   const before=native();const text='Native '+name+' writing '+crypto.randomUUID();
   await input.fill(text);await page.getByText('Unsaved form edits.',{exact:false}).waitFor();
   check(name+': typing does not write native source',native().revision.revision===before.revision.revision);
   await page.evaluate(()=>window.postMessage({source:'oi-cradle-die-face',type:'snapshot',nonce:'forged',payload:{fields:{p0_quick_thoughts:'forged'}}},'*'));
   await page.waitForTimeout(100);
   check(name+': unsolicited document message cannot write',native().revision.revision===before.revision.revision);
   await page.getByRole('tab',{name:'Source',exact:true}).click();
   await page.getByRole('tab',{name:'Rendered',exact:true}).click();
   assert.equal(await input.textContent(),text);check(name+': source/rendered switch preserves unsaved Day and root scope');
   await page.getByRole('button',{name:'Back to Central ground',exact:true}).click();
   await page.getByRole('button',{name:'Return to exact open source',exact:true}).click();
   assert.equal(await input.textContent(),text);check(name+': back and return retain unsaved original form');
   await page.getByRole('button',{name:'Save Daily Die to native source',exact:true}).click();
   await page.getByText('Native Save acknowledged;',{exact:false}).waitFor({timeout:45000});
   const saved=native();assert.equal(saved.document.template_payload.fields.p0_quick_thoughts,text);
   check(name+': explicit Save commits original field into exact native document');
   assert.deepEqual(saved.document.template_payload.media,before.document.template_payload.media);
   assert.equal(Object.keys(saved.document.template_payload.fields).length,17);
   check(name+': original seventeen fields and embedded media survive native save');
   await page.screenshot({path:output+'/central-'+name+'-day.png',fullPage:true});
   await page.reload();await page.getByRole('button',{name:'Open today',exact:true}).click();
   await input.waitFor();assert.equal(await input.textContent(),text);check(name+': fresh renderer reopens native content');
   // REGRESSION (not faked): the owner's reconciliation commit 28266fef
   // ("Bring the reconciled desktop and Factory shell onto main.") replaced
   // src/central/CentralGround.tsx with WorldNavigator without carrying over
   // its "NOW · current work and history" browsable listing (expand any NOW
   // allocation for the open scope, see its Returns). CentralGround.tsx still
   // exists in source but is mounted nowhere in production (grep across
   // src/ finds no import of it outside itself and its own client type).
   // WorldNavigator (src/surfaces/navigator/WorldNavigator.tsx) and every
   // component it mounts (FileTree, ChatRows, FlowRows, ProjectBranch,
   // ReceivingTray/Inbox) expose no general "list this scope's NOW records"
   // surface. The nearest surviving NOW UI is
   // src/encounter/InspectParts.tsx's NowRecords, but it only renders NOW
   // refs an *active agent encounter session* already names on its own
   // records (a delivery receipt or task basis) — it cannot browse the
   // scope's NOW allocations generally, and this walk opens a plain Day
   // source, not a Factory encounter, so that surface is unreachable here.
   // The native NOW compose/read itself is still proven, independently of
   // any UI, by central-native-walk.py's own
   // 'NOW composes real native receiving record with exact controlled
   // correlations' check (a direct `central.now` read). What is missing is
   // only the browser-reachable presentation of that read. Do not fabricate
   // a passing UI assertion against a control that cannot show this data in
   // this walk's context — flag it for the owner instead.
   check(name+': SKIPPED — general NOW browsing UI (CentralGround\'s "NOW · current work and history") has no production destination after 28266fef: the accepted UI lead (docs/cradle/13-BUILD-PROMPT.md, Lane 1) makes the universal Inbox the only receiving surface and removes other receiving/returns mounts; native NOW compose/read stays proven by central-native-walk.py');
   await page.screenshot({path:output+'/central-'+name+'-now.png',fullPage:true});await context.close();
  }catch(error){
   errors.push(String(error));
   if(page){await page.screenshot({path:output+'/central-'+name+'-failed.png',fullPage:true}).catch(()=>{});await writeFile(output+'/central-'+name+'-failed.html',await page.content().catch(()=>''));}
   throw error;
  }finally{await browser.close();}
 }
 check('no uncaught browser exceptions',errors.length===0);
}finally{
 await server.close();await writeFile(output+'/browser-receipt.json',JSON.stringify({schema:'oi.central-browser-walk/v1',classification:'real React/native test ground; not native Mac or live model acceptance',observations,errors},null,2));console.log(JSON.stringify({observations,errors},null,2));
}
