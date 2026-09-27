import {receiptIdentity} from './verify-shell-evidence.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const kernelBridge=process.env.OI_KERNEL_BRIDGE;
if(!kernelBridge)throw new Error('OI_KERNEL_BRIDGE must name a real kernel with a disposable OI_HOME');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.W1_ARTIFACTS??fileURLToPath(new URL('./artifacts/shell-recovery/',import.meta.url));mkdirSync(out,{recursive:true});
const reference=process.env.W1_REFERENCE_CAPTURE==='1';
const server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const url=`http://127.0.0.1:${server.httpServer.address().port}`;
const receipt={...receiptIdentity(import.meta.url),classification:reference?'reference capture of original source (not a passing acceptance test)':'controlled production-shell interaction; no native, provider, microphone or installed-Mac claims',checks:[],failures:[],browsers:[],passed:false};
const group=id=>({type:'group',id,tabs:['doc-'+id],pinned:[],active:'doc-'+id});
const layout={root:{type:'split',id:'horizontal',dir:'h',weights:[1,2],children:[group('left'),{type:'split',id:'vertical',dir:'v',weights:[1,1],children:[group('upper-right'),group('lower-right')]}]},surfaces:Object.fromEntries(['left','upper-right','lower-right'].map(id=>['doc-'+id,{id:'doc-'+id,kind:'draft',title:id+' draft'}])),closedStack:[],focusedGroupId:'left',agencyDepth:'collapsed',rightDepth:'collapsed',leftWidth:240,rightWidth:300};
let currentScenario='boot';
const scenario=async(name,body)=>{currentScenario=name;try{await body();receipt.checks.push(name);}catch(e){receipt.failures.push({name,error:String(e),stack:e.stack});console.error(name,e);}};
const visible='.warm-tree-host:not([hidden])';
const bodyTheme=page=>page.evaluate(()=>document.body.dataset.theme??'light');
async function seed(browser,scheme){
 const selection=await (await fetch(`${kernelBridge}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'theme_apply',appearance:scheme,id:null})})).json();
 assert.equal(selection.ok,true,JSON.stringify(selection));
 const context=await browser.newContext({colorScheme:scheme,reducedMotion:'reduce',viewport:{width:1440,height:900}});
 await context.addInitScript(({layout,scheme,kernelBridge})=>{
  window.__OI_KERNEL_BRIDGE__=kernelBridge;
  if(!sessionStorage.getItem('w1-seeded')){
   localStorage.setItem('oi-cradle.workspaces.v1',JSON.stringify({version:2,active:'w1',workspaces:[{id:'w1',name:'Central',writing:'',layout}]}));
   localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({theme:scheme,enabled:false,welcomeEnabled:false}));sessionStorage.setItem('w1-seeded','yes');
  }
  sessionStorage.setItem('oi-cradle.welcome.v1','w1');
 },{layout,scheme,kernelBridge});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>{(page.w1Errors??=[]).push(String(error));});
 try {await page.goto(url);await page.locator('.desktop-shell').waitFor();
  if(!reference)await page.locator(visible+' [data-group-id="upper-right"]').waitFor();
  return {context,page};
 } catch(error) {
  await page.screenshot({path:`${out}/seed-${scheme}-${Date.now()}.png`});
  receipt.failures.push({seed:await page.evaluate(()=>({book:localStorage.getItem('oi-cradle.workspaces.v1'),groups:[...document.querySelectorAll('[data-group-id]')].map(n=>({id:n.dataset.groupId,rect:n.getBoundingClientRect().toJSON()})),warm:window.__oiWarmTreesLog,body:document.body.innerText}))});
  await context.close();throw error;
 }
}
async function captureExit(page){
 const key=currentScenario.replace(/[^a-zA-Z0-9_-]+/g,'-');
 await page.screenshot({path:`${out}/${key}-exit.png`});
 const state=await page.evaluate(()=>({
  viewport:{width:innerWidth,height:innerHeight},mode:document.querySelector('.desktop-shell')?.getAttribute('data-mode'),
  stored:JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')??'null'),
  stages:[...document.querySelectorAll('.mode-stage')].map(n=>({mode:n.dataset.modeStage,hidden:n.hidden,text:n.innerText.slice(0,500)})),
  groups:[...document.querySelectorAll('.warm-tree-host:not([hidden]) [data-group-id]')].map(n=>({id:n.dataset.groupId,corner:n.dataset.windowCorner,rect:n.getBoundingClientRect().toJSON()})),
  alerts:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent)
 }));
 writeFileSync(`${out}/${key}-exit.json`,JSON.stringify({...state,pageErrors:page.w1Errors??[]},null,2));
}
async function corner(page,expected){
 // A viewport change delivers the media-query notification before React's
 // next commit. Wait for the EXPECTED ownership, not merely any old visible
 // corner (the original test raced the 639→640 transition in Chromium).
 await page.waitForFunction(expected=>{
  const nodes=[...document.querySelectorAll('.warm-tree-host:not([hidden]) [data-window-corner="true"]')].filter(n=>n.getBoundingClientRect().width>0);
  return nodes.length===1&&nodes[0].getAttribute('data-group-id')===expected;
 },expected);

 const snapshot=await page.locator(visible+' [data-pane="group"]').evaluateAll(ns=>ns.map(n=>({id:n.dataset.groupId,corner:n.dataset.windowCorner,rect:n.getBoundingClientRect().toJSON(),display:getComputedStyle(n).display})));
 writeFileSync(`${out}/last-geometry.json`,JSON.stringify({expected,width:page.viewportSize()?.width,groups:snapshot},null,2));
 const actual=await page.locator(visible+' [data-window-corner="true"]').evaluateAll(ns=>ns.filter(n=>n.getBoundingClientRect().width>0).map(n=>n.dataset.groupId));
 assert.deepEqual(actual,[expected]);
 const boxes=await page.locator(visible+' [data-pane="group"]').evaluateAll(ns=>ns.map(n=>({id:n.dataset.groupId,x:n.getBoundingClientRect().left,y:n.getBoundingClientRect().top,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width})).filter(n=>n.width>0));
 const target=boxes.find(n=>n.id===expected);assert.equal(Math.round(target.y),Math.round(Math.min(...boxes.map(n=>n.y))));assert.equal(Math.round(target.right),Math.round(Math.max(...boxes.map(n=>n.right))));
}
try{
 for(const [engineName,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});receipt.browsers.push({name:engineName,version:browser.version()});
  try{for(const scheme of ['light','dark']){
   await scenario(`${engineName}/${scheme}: nested boundary, resize, maximize, close, reload and genuine rest`,async()=>{
    const {context,page}=await seed(browser,scheme);try{
     await page.screenshot({path:`${out}/${engineName}-${scheme}-nested.png`});
     if(reference){receipt.checks.push({originalCorner:await page.locator(visible+' [data-window-corner="true"]').evaluateAll(ns=>ns.map(n=>n.dataset.groupId))});return;}
     await corner(page,'upper-right');
     const sep=page.getByRole('separator',{name:'Resize canvas split'}).first();await sep.focus();const old=await sep.getAttribute('aria-valuenow');await sep.press('ArrowRight');assert.notEqual(await sep.getAttribute('aria-valuenow'),old);await corner(page,'upper-right');
     // The actual app boots under StrictMode. Observe the coalesced write
     // BEFORE pagehide can flush it; otherwise reload masks a dead autosave
     // timer after effect cleanup/replay. Then prove that same split restores.
     const resized=await sep.getAttribute('aria-valuenow');
     await page.waitForFunction(expected=>{
      const book=JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1'));
      const root=book.workspaces.find(w=>w.id===book.active)?.layout.root;
      return root?.id==='horizontal'&&Math.round(100*root.weights[0]/(root.weights[0]+root.weights[1]))===Number(expected);
     },resized);
     await page.reload();await page.locator(visible+' [data-group-id="upper-right"]').waitFor();await corner(page,'upper-right');
     assert.equal(await page.getByRole('separator',{name:'Resize canvas split'}).first().getAttribute('aria-valuenow'),resized,'the durable split restores, not the original seed');
     await page.locator(visible+' [data-group-id="lower-right"] [role="tab"]').click();await page.keyboard.press('Control+Alt+Enter');await corner(page,'lower-right');
     await page.keyboard.press('Escape');await corner(page,'upper-right');
     await page.keyboard.press('Control+Alt+Enter');await page.keyboard.press('Control+w');await page.locator(visible+' [data-group-id="lower-right"]').waitFor({state:'detached'});await corner(page,'upper-right');
     await page.locator(visible+' [data-group-id="upper-right"] [role="tab"]').click();await page.keyboard.press('Control+w');await corner(page,'left');
     await page.locator(visible+' [data-group-id="left"] [role="tab"]').click();await page.keyboard.press('Control+w');await page.getByRole('navigation',{name:'Start working'}).waitFor();assert.equal(await page.locator(visible+' [role="tab"]').count(),0);
     await page.screenshot({path:`${out}/${engineName}-${scheme}-rest.png`});
     for(let i=0;i<3;i++){
      await page.keyboard.press('Control+t');await page.locator(visible+' .fresh-surface').waitFor();assert.equal(await page.locator(visible+' [role="tab"]').count(),1);
      await page.locator(visible).getByRole('button',{name:'Start writing',exact:true}).click();await page.locator(visible+' .draft-surface .cm-content').waitFor();assert.equal(await page.locator(visible+' [role="tab"]').count(),1);assert.equal(await page.locator(visible+' [role="tab"]').innerText(),'Draft');
      await page.locator(visible+' [role="tab"]').click();await page.keyboard.press('Control+w');await page.getByRole('navigation',{name:'Start working'}).waitFor();assert.equal(await page.locator(visible+' [role="tab"]').count(),0);
     }
    }finally{try{await captureExit(page);}finally{await context.close();}}
   });
   await scenario(`${engineName}/${scheme}: full-workspace Settings, narrow preferences, real return and themes`,async()=>{
    const {context,page}=await seed(browser,scheme);try{
     const editor=page.locator(visible+' [data-group-id="left"] .cm-content');if(!reference){await editor.waitFor();await editor.evaluate(el=>{window.retainedEditor=el;});}
     await page.keyboard.press('Control+Alt+5');await page.getByRole('region',{name:'Settings',exact:true}).waitFor();
     if(!reference){await page.waitForFunction(()=>JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')).workspaces[0].layout.mode==='settings');const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')).workspaces[0].layout);assert.equal(s.agencyDepth,'panel','12-SETTINGS §1: the left stays open as the section list');assert.equal(s.rightDepth,'collapsed','the right panel rests collapsed');}
     await page.getByRole('navigation',{name:'Settings sections'}).locator('[data-settings-section="appearance"]').click();await page.locator('.visuals-preferences').waitFor();
     await page.screenshot({path:`${out}/${engineName}-${scheme}-visuals-wide.png`});
     for(const width of [760,430,360]){
      await page.setViewportSize({width,height:900});await page.screenshot({path:`${out}/${engineName}-${scheme}-visuals-${width}.png`});
      if(!reference){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page has no horizontal overflow');assert.ok(await page.locator('[data-settings-page]:visible').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'settings has no clipped horizontal content');}
     }
     if(reference)return;
     const appearance=page.getByRole('radiogroup',{name:'Appearance',exact:true});
     await appearance.getByRole('radio',{name:'Dark',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.theme==='dark');assert.equal(await bodyTheme(page),'dark');
     await appearance.getByRole('radio',{name:'System',exact:true}).click();await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.body.dataset.theme);assert.equal(await bodyTheme(page),'light');
     assert.equal(await page.locator('.visuals-preferences canvas,.visuals-preferences iframe').count(),0,'Visuals has no duplicate Expression host');
     await page.getByRole('button',{name:'Back to work',exact:true}).click();await editor.waitFor();assert.equal(await editor.evaluate(el=>el===window.retainedEditor),true,'the same editor DOM returns, not a remount');await page.screenshot({path:`${out}/${engineName}-${scheme}-return-360.png`});await corner(page,'left');
     for(const width of [639,640,760,1440,360,640,1440]){await page.setViewportSize({width,height:900});await page.waitForFunction(width=>innerWidth===width,width);await corner(page,width<640?'left':'upper-right');}
     await page.screenshot({path:`${out}/${engineName}-${scheme}-return-wide.png`});
     await page.keyboard.press('Control+Alt+5');await page.getByRole('navigation',{name:'Settings sections'}).locator('[data-settings-section="appearance"]').click();await page.locator('.visuals-preferences').waitFor();
     await page.getByRole('button',{name:'Open Expressions',exact:true}).click();
     const stage=page.locator('.mode-stage[data-mode-stage="expressions"]:not([hidden])');
     await stage.locator('.pcd-host').waitFor();
     await page.waitForFunction(()=>JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')).workspaces[0].layout.mode==='expressions');
     assert.equal(await page.locator('.pcd-host').count(),1,'the actual Expressions host mounts once, never a duplicate Settings demo');
     // No native transport exists in this browser driver. The REAL host must
     // disclose that refusal; it must not manufacture a working app/renderer.
     await stage.locator('.pcd-host[data-state="refused"] [role="alert"]').waitFor();
     const host=stage.locator('.pcd-host');await host.evaluate(el=>{window.retainedExpressionHost=el;});
     await page.keyboard.press('Control+Alt+5');await page.getByRole('region',{name:'Settings',exact:true}).waitFor();
     await page.getByRole('button',{name:'Back to work',exact:true}).click();await host.waitFor();
     assert.equal(await host.evaluate(el=>el===window.retainedExpressionHost),true,'the mode-specific host stays mounted on Settings round trips');
     await page.screenshot({path:`${out}/${engineName}-${scheme}-expressions-route.png`});
    }finally{try{await captureExit(page);}finally{await context.close();}}
   });
   await scenario(`${engineName}/${scheme}: Factory icons and non-chat right sections`,async()=>{
    const {context,page}=await seed(browser,scheme);try{
     await page.keyboard.press('Control+Alt+2');await page.getByRole('radiogroup',{name:'Factory view'}).waitFor();
     const views=page.getByRole('radiogroup',{name:'Factory view'});await views.getByRole('radio',{name:'Tasks',exact:true}).click();assert.equal(await views.getByRole('radio',{name:'Tasks',exact:true}).getAttribute('aria-checked'),'true');
     if(!reference)await page.locator('.mode-stage .factory-centre[data-centre-view="tasks"] .factory-chat-full').waitFor({state:'visible'});
     await views.getByRole('radio',{name:'Desk',exact:true}).click();assert.equal(await views.getByRole('radio',{name:'Desk',exact:true}).getAttribute('aria-checked'),'true');
     if(!reference){await page.locator('.mode-stage .factory-centre[data-centre-view="desk"]').waitFor({state:'visible'});assert.equal(await page.locator('.factory-centre:visible').count(),1,'one actual Factory body has one presenter');}
     await page.screenshot({path:`${out}/${engineName}-${scheme}-factory.png`});
     if(reference)return;
     // Row icons carry a colour transition (desktop.css icon-row rule); settle
     // it before sampling, so a still-running transition is not read as a
     // hard-coded colour. A genuinely fixed colour never converges and fails.
     await views.locator('button').first().evaluate(()=>new Promise(r=>setTimeout(r,0)));
     await page.waitForFunction(()=>[...document.querySelectorAll('[role="radiogroup"][aria-label="Factory view"] button')].every(n=>getComputedStyle(n.querySelector('svg')).color===getComputedStyle(n).color),null,{timeout:2000}).catch(()=>{});
     const colours=await views.locator('button').evaluateAll(ns=>ns.map(n=>({selected:n.getAttribute('aria-checked'),color:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor,icon:getComputedStyle(n.querySelector('svg')).color})));
     assert.notEqual(colours[0].color,colours[1].color,'active/inactive semantic emphasis differs');for(const c of colours)assert.equal(c.icon,c.color,'icons inherit state instead of hard-coded black/white');
     const right=page.locator('.desktop-side.right');
     for(const name of ['Run','Agents','Context']){
      const button=right.getByRole('tab',{name,exact:true});if(await button.count()!==1)throw Error('Expected existing '+name+' plane');await button.click();
      await page.screenshot({path:`${out}/${engineName}-${scheme}-sidebar-${name.toLowerCase()}.png`});
      assert.ok(await right.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'right section has no horizontal overflow');
     }
    }finally{try{await captureExit(page);}finally{await context.close();}}
   });
  }}finally{await browser.close();}
 }
 receipt.passed=!reference&&receipt.failures.length===0;
 if(!reference){assert.equal(receipt.checks.length,12,'all planned scenarios must execute');assert.deepEqual(receipt.failures,[],'all production shell interaction cases must pass');}
}finally{writeFileSync(`${out}/receipt.json`,JSON.stringify(receipt,null,2)+'\n');await server.close();}
