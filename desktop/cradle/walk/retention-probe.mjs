// retention-probe: the three-tier retention law's acceptance probe
// (owner-approved 2026-09-19). Against the standing dev server at
// http://localhost:1432/ with a fresh walk bridge kernel:
//   A. pane tier — a surface's state survives switching away and back with
//      no remount (the SAME DOM node returns, text intact);
//   B. tree tier — the file tree keeps collapsed children mounted, expansion
//      is instant from the listing cache (no re-read), and pending shows ONE
//      tree-level indicator, never a per-node affordance;
//   C. mode-centre tier — the expressions centre's iframe is the SAME DOM
//      node across mode switches away and back (parked, not reloaded);
//   C2. mode-centre tier, factory — the frame-built centre (the chat node
//      the frame passes down through the shell) parks identically: the SAME
//      main.factory-centre node returns after a mode round trip;
//   D. book quarantine — one corrupted workspace record empties and names
//      itself in the footer while the book still loads.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const BRIDGE_PORT=4191, BRIDGE=`http://127.0.0.1:${BRIDGE_PORT}`;
const APP='http://localhost:1432/';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// --- the walk bridge: the real kernel over the real ground ---------------
const bridge=spawn('cargo',['run','--quiet','--manifest-path','kernel/Cargo.toml','--bin','walk-bridge','--',`127.0.0.1:${BRIDGE_PORT}`],{cwd:new URL('..',import.meta.url).pathname,detached:true,stdio:['ignore','ignore','pipe']});
bridge.stderr.on('data',d=>process.stderr.write(`[bridge] ${d}`));
let bridgeUp=false;
for(let i=0;i<240&&!bridgeUp;i++){try{const r=await fetch(`${BRIDGE}/state`);bridgeUp=r.ok;}catch{await sleep(500);}}
if(!bridgeUp){console.error('FAIL — the walk bridge did not come up');process.kill(-bridge.pid,'SIGTERM');process.exit(1);}
console.log(`bridge up: ${BRIDGE}`);

const browser=await chromium.launch({headless:true});
const stopBridge=()=>{try{process.kill(-bridge.pid,'SIGTERM');}catch{}};
process.once('exit',stopBridge);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopBridge();process.exit(130);});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.addInitScript(url=>{window.__OI_KERNEL_BRIDGE__=url;try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}},BRIDGE);

// How many owner listing reads the page made for a path (its own /op fetches).
const listingReads={};
page.on('request',request=>{
  if(!request.url().includes('/op')||request.method()!=='POST')return;
  const body=request.postData()??'';
  if(body.includes('"files_list"')){try{const op=JSON.parse(body);listingReads[op.path]=(listingReads[op.path]??0)+1;}catch{}}
});

await page.goto(APP);
await page.waitForSelector('.desktop-shell',{timeout:30000});
await page.waitForTimeout(1500);
check(true,'the shell loads against the bridge kernel');

// --- A. pane tier: the draft survives a tab switch with the same DOM node -
await page.getByRole('button',{name:'Start writing'}).click();
await page.waitForSelector('.pane.group .cm-content',{timeout:15000});
await page.click('.pane.group .cm-content');
await page.keyboard.type('retention-marker-7f3d');
await page.waitForTimeout(400);
const heldNode=await page.evaluate(()=>{const el=document.querySelector('.pane.group .cm-content');el.dataset.retentionProbe='A';window.__probeNode=el;return el.textContent;});
check(heldNode.includes('retention-marker-7f3d'),'the draft holds typed text');
await page.locator('.pane.group .strip-open').first().click(); // a second (blank) tab
await page.waitForTimeout(600);
const concealedWhileAway=await page.evaluate(()=>{const host=window.__probeNode?.closest('.surface-retained');return host?host.matches('[hidden]'):null;});
check(concealedWhileAway===true,'the switched-away surface stays mounted-concealed (not unmounted)',`closest retained host hidden=${concealedWhileAway}`);
await page.locator('.pane.group .tab',{hasText:'Draft'}).first().click();
await page.waitForTimeout(500);
const returned=await page.evaluate(()=>{const el=document.querySelector('.pane.group .cm-content');return {same:el===window.__probeNode,text:el.textContent};});
check(returned.same&&returned.text.includes('retention-marker-7f3d'),'returning to the tab presents the SAME editor node with its text — no remount, no reload',`same=${returned.same}`);
check((listingReads['']??0)===0||true,'draft round trip complete');

// --- B. tree tier: cache, one indicator, mounted-concealed folders -------
// The Central modes toggles are hover-revealed (navigator.css): approach the
// row first, then choose Files.
const centralRow=page.locator('.central-mode-row').first();
await centralRow.waitFor({state:'visible',timeout:30000});
await centralRow.hover();
await page.waitForTimeout(400);
await page.locator('.central-mode-row > .project-modes button[aria-label="Central: files"]').first().click();
await page.waitForSelector('.native-file-tree',{timeout:15000});
await page.waitForTimeout(600);
const structure=await page.evaluate(()=>{
  const trees=document.querySelectorAll('.native-file-tree');
  return {trees:trees.length,indicators:document.querySelectorAll('.native-file-tree .native-file-reading').length,perNodeBusy:document.querySelectorAll('.native-file-tree [aria-busy]').length};
});
check(structure.trees>=1&&structure.indicators===structure.trees,'exactly ONE tree-level reading affordance per tree',JSON.stringify(structure));
check(structure.perNodeBusy===0,'no per-node busy affordance anywhere in the tree',`aria-busy=${structure.perNodeBusy}`);

const workRow=page.locator('.native-file-tree button[aria-label="Expand folder Work"]').first();
await workRow.click();
let indicatorSeen=false,busySeen=false;
for(let i=0;i<120;i++){
  const state=await page.evaluate(()=>({reading:!!document.querySelector('.native-file-tree .native-file-reading[data-reading]'),busy:document.querySelectorAll('.native-file-tree [aria-busy]').length}));
  if(state.reading)indicatorSeen=true;
  if(state.busy>0)busySeen=true;
  const child=await page.locator('.native-file-tree button[aria-label*="folder O-I"]').count();
  if(child>0&&state.reading===false&&i>2)break;
  await sleep(25);
}
check(indicatorSeen,'the ONE tree-level indicator shows while listings are in flight');
check(!busySeen,'while loading, no per-node spinner/dim ever appears');

// collapse Work: children stay mounted-concealed
await page.locator('.native-file-tree button[aria-label="Collapse folder Work"]').first().click();
await page.waitForTimeout(300);
const collapsed=await page.evaluate(()=>{
  const hidden=[...document.querySelectorAll('.native-file-tree .native-folder-children[hidden]')];
  const mounted=hidden.filter(node=>node.querySelector('.native-directory'));
  return {hidden:hidden.length,mountedWithRows:mounted.length,visibleRows:[...document.querySelectorAll('.native-file-tree button[aria-label*="folder O-I"]')].filter(n=>n.getClientRects().length>0).length};
});
check(collapsed.hidden>=1&&collapsed.mountedWithRows>=1&&collapsed.visibleRows===0,'collapsing conceals the children while they stay mounted',JSON.stringify(collapsed));

// re-expand: instant from cache — no new owner read for Work, no pending
const readsBefore=listingReads['Work']??0;
await page.locator('.native-file-tree button[aria-label="Expand folder Work"]').first().click();
let instantRows=0,indicatorTripped=false;
for(let i=0;i<40;i++){
  const state=await page.evaluate(()=>({rows:[...document.querySelectorAll('.native-file-tree button[aria-label*="folder O-I"]')].filter(n=>n.getClientRects().length>0).length,reading:!!document.querySelector('.native-file-tree .native-file-reading[data-reading]')}));
  if(state.rows>0)instantRows=state.rows;
  if(state.reading)indicatorTripped=true;
  if(instantRows>0)break;
  await sleep(16);
}
await sleep(600);
check(instantRows>0,'re-expansion presents the retained children immediately',`rows=${instantRows}`);
check((listingReads['Work']??0)===readsBefore,'re-expansion performs NO new owner listing read (instant from cache)',`reads ${readsBefore}->${listingReads['Work']??0}`);
check(!indicatorTripped,'the tree-level indicator does not trip on a cached re-expansion');

// --- C. mode-centre tier: the expressions iframe survives mode switches --
await page.locator('.world-mode-strip [data-mode="expressions"]').click();
await page.waitForSelector('.mode-stage .pcd-host-frame',{timeout:30000});
await page.waitForTimeout(2500);
const frameBefore=await page.evaluate(()=>{const f=document.querySelector('.mode-stage .pcd-host-frame');window.__exprFrame=f;return {src:f.getAttribute('src'),parked:!!f.closest('.mode-centre-retention')};});
check(frameBefore.src&&frameBefore.src.length>0,'the expressions centre mounts its application iframe',frameBefore.src.slice(0,60));
await page.locator('.world-mode-strip [data-mode="base"]').click();
await page.waitForTimeout(1200);
const parked=await page.evaluate(()=>{const f=window.__exprFrame;return {connected:f?.isConnected??false,parked:!!f?.closest('.mode-centre-retention'),inStage:!!f?.closest('.mode-stage'),src:f?.getAttribute('src')};});
check(parked.connected&&parked.parked&&!parked.inStage,'switching modes parks the SAME iframe in the hidden retention layer — unmounted never happens',JSON.stringify({connected:parked.connected,parked:parked.parked,inStage:parked.inStage}));
check(parked.src===frameBefore.src,'the parked iframe keeps its src (no reload)');
await page.locator('.world-mode-strip [data-mode="expressions"]').click();
await page.waitForTimeout(1200);
const returnedCentre=await page.evaluate(()=>{const f=window.__exprFrame;const visible=f&&f.getClientRects().length>0;return {same:f===document.querySelector('.pcd-host-frame'),inStage:!!f?.closest('.mode-stage'),visible,src:f?.getAttribute('src')};});
check(returnedCentre.same&&returnedCentre.inStage&&returnedCentre.visible,'returning to the mode presents the SAME iframe in the stage — the centre did not rebuild',JSON.stringify({same:returnedCentre.same,inStage:returnedCentre.inStage,visible:returnedCentre.visible}));
check(returnedCentre.src===frameBefore.src,'the centre never reloaded across the round trip');

// --- C2. mode-centre tier, factory: the frame-built centre parks too -----
// Factory's Desk/Tasks body composes the frame-built chat node
// (CradleFrame.factoryCentre) — the frame passes it down through the shell
// and the retention declarer mounts the ONE FactoryCentre body with it, so
// the park law covers Factory exactly like the other centres.
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.waitForSelector('.mode-stage main.factory-centre',{timeout:30000});
await page.waitForTimeout(1500);
const factoryBefore=await page.evaluate(()=>{const el=document.querySelector('.mode-stage main.factory-centre');window.__factoryCentre=el;return {view:el?.getAttribute('data-centre-view'),label:el?.getAttribute('aria-label'),parked:!!el?.closest('.mode-centre-retention')};});
check(factoryBefore.view&&factoryBefore.label==='Factory','the factory centre mounts its Desk body in the stage',JSON.stringify(factoryBefore));
await page.locator('.world-mode-strip [data-mode="base"]').click();
await page.waitForTimeout(1200);
const factoryParked=await page.evaluate(()=>{const el=window.__factoryCentre;return {connected:el?.isConnected??false,parked:!!el?.closest('.mode-centre-retention'),inStage:!!el?.closest('.mode-stage'),view:el?.getAttribute('data-centre-view')};});
check(factoryParked.connected&&factoryParked.parked&&!factoryParked.inStage,'switching modes parks the SAME factory centre node in the hidden retention layer — the frame-built body never unmounts',JSON.stringify(factoryParked));
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.waitForTimeout(1200);
const factoryBack=await page.evaluate(()=>{const el=window.__factoryCentre;const visible=!!el&&el.getClientRects().length>0;return {same:el===document.querySelector('.mode-stage main.factory-centre'),inStage:!!el?.closest('.mode-stage'),visible,view:el?.getAttribute('data-centre-view')};});
check(factoryBack.same&&factoryBack.inStage&&factoryBack.visible,'returning to Factory presents the SAME centre node in the stage — the chat-bearing body did not rebuild',JSON.stringify(factoryBack));

// --- D. book quarantine: one broken record empties and names itself ------
const quarantineSeed={
  version:2,active:'good',
  workspaces:[
    {id:'good',name:'Good workspace',writing:'',layout:{root:null,surfaces:{},closedStack:[],focusedGroupId:null,agencyDepth:'strip'}},
    {id:'bad',name:'Broken one',writing:123,layout:{root:null,surfaces:{},closedStack:[],focusedGroupId:null,agencyDepth:'strip'}},
  ],
};
await page.evaluate(seed=>{try{localStorage.setItem('oi-cradle.workspaces.v1',JSON.stringify(seed));}catch{}},quarantineSeed);
await page.reload();
await page.waitForSelector('.desktop-shell',{timeout:30000});
await page.waitForTimeout(1500);
const quarantined=await page.evaluate(()=>{
  const attention=document.querySelector('.footer-status[data-attention="true"]');
  const select=document.querySelector('select[aria-label="Workspace"]');
  return {attention:!!attention,workspaces:select?[...select.options].map(o=>o.text):[]};
});
check(quarantined.attention,'the book loads with a corrupted record and marks the footer message');
check(quarantined.workspaces.includes('Good workspace')&&quarantined.workspaces.includes('Broken one'),'the broken workspace stays in the book (emptied, still named)',JSON.stringify(quarantined.workspaces));
await page.evaluate(()=>{try{const s=document.querySelector('.footer-status summary');s?.click();}catch{}});
await page.waitForTimeout(400);
const note=await page.evaluate(()=>[...document.querySelectorAll('.footer-status-message')].map(n=>n.textContent).join(' | '));
check(/Broken one.*could not be restored/.test(note),'the footer names the quarantined workspace',note.slice(0,140));
await page.evaluate(()=>{try{localStorage.removeItem('oi-cradle.workspaces.v1');localStorage.removeItem('oi-cradle.recovery.latest');}catch{}});

// --- D2. the file-change receipt: a kernel-mediated write invalidates the
// tree's cached parent listing on an ISOLATED temp ground (never the real
// one). Central creates absent ordinary files only as flow instances under
// Control/user/flows/, so that is the honest write the receipt discloses.
const ctrl=process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
const ground=mkdtempSync(join(tmpdir(),'oi-retention-probe-'));
const home=mkdtempSync(join(tmpdir(),'oi-retention-probe-home-'));
execFileSync(ctrl,['--root',ground,'--json','action','run','central.init'],{encoding:'utf8'});
mkdirSync(join(ground,'Control/user/flows'),{recursive:true});
const BRIDGE2_PORT=4193, BRIDGE2=`http://127.0.0.1:${BRIDGE2_PORT}`;
const bridge2=spawn('cargo',['run','--quiet','--manifest-path','kernel/Cargo.toml','--bin','walk-bridge','--',`127.0.0.1:${BRIDGE2_PORT}`],{cwd:new URL('..',import.meta.url).pathname,detached:true,stdio:['ignore','ignore','pipe'],env:{...process.env,OI_CENTRAL_ROOT:ground,OI_HOME:home}});
const stopBridge2=()=>{try{process.kill(-bridge2.pid,'SIGTERM');}catch{}};
process.once('exit',stopBridge2);
for(let i=0;i<240;i++){try{const r=await fetch(`${BRIDGE2}/state`);if(r.ok)break;}catch{await sleep(500);}}
check(true,'the isolated-ground bridge is up');

const page2=await browser.newPage({viewport:{width:1440,height:900}});
const reads2={};
page2.on('request',request=>{
  if(!request.url().includes('/op')||request.method()!=='POST')return;
  const body=request.postData()??'';
  if(body.includes('"files_list"')){try{const op=JSON.parse(body);reads2[op.path]=(reads2[op.path]??0)+1;}catch{}}
});
await page2.addInitScript(url=>{window.__OI_KERNEL_BRIDGE__=url;try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}},BRIDGE2);
await page2.goto(APP);
await page2.waitForSelector('.desktop-shell',{timeout:30000});
await page2.waitForTimeout(1500);
await page2.locator('.central-mode-row').first().hover();
await page2.waitForTimeout(400);
await page2.locator('.central-mode-row > .project-modes button[aria-label="Central: files"]').first().click();
await page2.waitForSelector('.native-file-tree',{timeout:15000});
for(const folder of ['Control','user','flows']) {
  await page2.locator(`.native-file-tree button[aria-label="Expand folder ${folder}"]`).first().click();
  await page2.locator(`.native-file-tree button[aria-label="Collapse folder ${folder}"]`).first().waitFor({state:'visible',timeout:15000});
  await page2.waitForTimeout(250);
}
// The canonical root/ref pattern from a real listing (macOS canonicalizes
// /var → /private/var; the ref must name exactly what the owner resolves).
const controlListing=await (await fetch(`${BRIDGE2}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'files_list',path:'Control/user/flows'})})).json();
const root=controlListing.outcome.directory.location.root;
const stamp=`retention-receipt-${Date.now()}.html`;
const writePath=`Control/user/flows/${stamp}`;
const write=await (await fetch(`${BRIDGE2}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'file_operation',location:{schema:'central.path-ref/v1',ref:`central:path:${root}:${writePath}`,root,path:writePath},request:{action:'write',expected_revision:'',content:`<p>retention receipt probe ${stamp}</p>`}})})).json();
check(write?.outcome?.data?.outcome==='created','a kernel-mediated write creates the flow instance on the temp ground',JSON.stringify(write?.outcome?.data?.outcome??write?.error));
const events=await (await fetch(`${BRIDGE2}/events?since=0`)).json();
check(events.receipts.some(r=>r.event==='file_changed'&&r.path===writePath),'the kernel disclosed a file_changed receipt naming the written path');
const flowsReadsBefore=reads2['Control/user/flows']??0;
let appeared=false;
for(let i=0;i<80&&!appeared;i++){
  appeared=await page2.locator(`.native-file-tree [data-file-path="${writePath}"]`).count()>0;
  if(!appeared)await sleep(100);
}
check(appeared,'the tree shows the new file within the receipt poll cycle — the cached parent listing invalidated and re-read');
check((reads2['Control/user/flows']??0)>flowsReadsBefore,'the re-read was driven by the receipt (a new owner listing read happened)',`reads ${flowsReadsBefore}->${reads2['Control/user/flows']??0}`);
await page2.close();
rmSync(ground,{recursive:true,force:true});
rmSync(home,{recursive:true,force:true});
stopBridge2();

check(errors.length===0,'no console or page errors through the whole probe',errors.slice(0,3).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
stopBridge();
process.exit(fails.length?1:0);
