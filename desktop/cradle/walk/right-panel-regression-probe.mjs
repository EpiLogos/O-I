// Diagnostic probe: the right panel across its states (10-SIDEBARS §4/§5.3).
// Boots the real desktop startup in chromium (no kernel — degraded states are
// fine for geometry), screenshots each state, and hit-tests what actually
// sits on top where the owner reported breakage:
//   P1 closed  — the corner companion carries the agent's state
//   P2/P13 open/full — the same one top row: avatar · tabs · ⤢ · functions
//   menus      — a panel menu must never open beneath the centre canvas
//   corner     — the canvas corner cut follows the panel's real placement
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=fileURLToPath(new URL('../walk/artifacts/right-panel-regression/',import.meta.url));
mkdirSync(artifacts,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
const url=`http://127.0.0.1:${server.httpServer.address().port}`;
const report={states:[],findings:[]};
const shot=(page,name)=>page.screenshot({path:`${artifacts}/${name}.png`});
const hit=page=>page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el?`${el.tagName.toLowerCase()}${el.className?'.'+String(el.className).split(' ').join('.'):''}`:'none';},[0,0]);
async function stack(page,selector){const box=await page.locator(selector).first().boundingBox();if(!box)return null;const x=box.x+box.width/2,y=box.y+box.height/2;return {box,top:await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el?`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,3).join('.')}`:'none';},[x,y])};}
try{
 const context=await browser.newContext({viewport:{width:1280,height:820}});
 await context.addInitScript(()=>{
  if(!sessionStorage.getItem('appearance-seeded')){
   localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({theme:'light',enabled:false,welcomeEnabled:false}));
   sessionStorage.setItem('appearance-seeded','true');
  }
  sessionStorage.setItem('oi-cradle.welcome.v1','probe');
 });
 const page=await context.newPage();
 await page.goto(url);
 await page.locator('.desktop-shell').waitFor();
 await page.waitForTimeout(400);

 const geometry=()=>page.evaluate(()=>{const s=getComputedStyle(document.querySelector('.desktop-shell'));return {
  rightWidth:s.getPropertyValue('--desktop-right-width').trim(),
  rightSpace:s.getPropertyValue('--desktop-right-space').trim(),
  floatWidth:s.getPropertyValue('--desktop-right-float-width').trim(),
  cutoutRight:getComputedStyle(document.querySelector('.desktop-centre [data-window-corner="true"]')??document.querySelector('.desktop-centre')).getPropertyValue('--window-cutout-right').trim(),
 };});

 // — A: closed (fresh boot default may vary; force closed) —
 const rightToggle=page.getByRole('button',{name:'Toggle right region',exact:true});
 const expanded=await rightToggle.getAttribute('aria-expanded');
 if(expanded!=='false')await rightToggle.click();
 await page.waitForTimeout(300);
 report.states.push({state:'closed',geometry:await geometry(),
  companionDot:await page.locator('.shell-agent-toggle .shell-agent-presence-dot, .shell-agent-toggle .companion-dot').count(),
  presenceChip:await page.locator('.shell-agent-presence').count()});
 await shot(page,'closed-base');

 // — B: panel open in base —
 await rightToggle.click();
 await page.waitForTimeout(400);
 report.states.push({state:'open-base',geometry:await geometry(),
  panelTop:await stack(page,'.panel-top'),
  tabStrip:await stack(page,'.panel-top .icon-tab-strip'),
  tabs:await page.locator('.panel-top .icon-tab').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')))});
 await shot(page,'open-base');
 // functions menu open: what covers its items?
 await page.locator('[aria-label="Panel window functions"] summary, .panel-top details.desktop-menu summary').first().click();
 await page.waitForTimeout(250);
 await shot(page,'open-base-functions-menu');
 const menuItem=page.locator('.panel-top details.desktop-menu .oi-menu button').first();
 if(await menuItem.count()){
  const box=await menuItem.boundingBox();
  report.findings.push({check:'panel functions menu item hit-test',at:[Math.round(box.x+box.width/2),Math.round(box.y+box.height/2)],top:await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el?`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,3).join('.')}`:'none';},[box.x+box.width/2,box.y+box.height/2])});
 }
 await page.keyboard.press('Escape');

 // — C: full (takeover) —
 await page.getByRole('button',{name:'Expand panel',exact:true}).click();
 await page.waitForTimeout(400);
 report.states.push({state:'full-base',geometry:await geometry(),
  tabs:await page.locator('.panel-top .icon-tab').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label'))),
  tabStrip:await stack(page,'.panel-top .icon-tab-strip')});
 await shot(page,'full-base');
 await page.getByRole('button',{name:'Restore panel',exact:true}).click();
 await page.waitForTimeout(300);

 // — D: factory panel —
 const factoryButton=page.locator('.world-mode-strip [data-mode="factory"]').first();
 if(await factoryButton.count()){await factoryButton.click();await page.waitForTimeout(500);}
 report.states.push({state:'open-factory',geometry:await geometry(),
  tabs:await page.locator('.panel-top .icon-tab').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label'))),
  tabStrip:await stack(page,'.panel-top .icon-tab-strip')});
 await shot(page,'open-factory');
 // factory functions menu z-order
 await page.locator('.panel-top details.desktop-menu summary').first().click();
 await page.waitForTimeout(250);
 await shot(page,'open-factory-functions-menu');
 const fItem=page.locator('.panel-top details.desktop-menu .oi-menu button').first();
 if(await fItem.count()){
  const box=await fItem.boundingBox();
  report.findings.push({check:'factory panel functions menu item hit-test',at:[Math.round(box.x+box.width/2),Math.round(box.y+box.height/2)],top:await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el?`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,3).join('.')}`:'none';},[box.x+box.width/2,box.y+box.height/2])});
 }
 await page.keyboard.press('Escape');

 // — E: expressions (canvas mode) panel —
 const exprButton=page.locator('.world-mode-strip [data-mode="expressions"]').first();
 if(await exprButton.count()){await exprButton.click();await page.waitForTimeout(500);}
 report.states.push({state:'open-expressions',geometry:await geometry(),
  tabs:await page.locator('.panel-top .icon-tab').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label'))),
  tabStrip:await stack(page,'.panel-top .icon-tab-strip')});
 await shot(page,'open-expressions');

 // — F: avatar menu z-order —
 await page.locator('.panel-top .avbtn, .panel-top [class*=avatar] button, .panel-top button').first().click();
 await page.waitForTimeout(250);
 await shot(page,'open-expressions-avatar-menu');
}catch(error){report.error=String(error);}
finally{
 writeFileSync(`${artifacts}/probe-report.json`,JSON.stringify(report,null,1));
 console.log(JSON.stringify(report,null,1));
 await browser.close();
 await server.close();
}
