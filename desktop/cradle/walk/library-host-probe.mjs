import {chromium} from 'playwright';
// Acceptance probe — the Library as a canvas tab (owner direction
// 2026-09-25): the navigator's Library destination opens the Expressions
// application's real gallery in an ordinary tab (LibraryHost — no overlay,
// no field engine), and the hosted page follows the shell's light/dark
// theme. Reads the standing dev server (PROBE_URL) and walk bridge
// (OI_BRIDGE, default 127.0.0.1:4179). Exits 1 when any check fails.
const base=process.env.PROBE_URL??'http://localhost:1421/';
const bridge=process.env.OI_BRIDGE??'http://127.0.0.1:4179';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
await page.addInitScript(url=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');window.__OI_KERNEL_BRIDGE__=url;}catch{}},bridge);
await page.goto(base);
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(3000);
const toggle=page.getByRole('button',{name:'Toggle left region'});
if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
await page.waitForTimeout(800);

// Click the Library destination row
await page.getByRole('button',{name:'Library',exact:true}).click();
// The hosted page resolves through the material seam: wait for a settled
// state (the dev bridge's first directory read can be slow), not a guess.
await page.waitForFunction(()=>{
  const host=document.querySelector('.library-host');
  return host && (host.dataset.state==='ready'||host.dataset.state==='refused');
},{timeout:20000});
const tabCount=await page.locator('.tab', {hasText:'Library'}).count();
const hostState=await page.locator('.library-host').getAttribute('data-state').catch(()=>null);
const iframeCardCount=await page.frameLocator('.library-host-frame').locator('.expression-card').count().catch(()=>0);
const refusalReason=await page.locator('.library-host .pcd-host-refusal').textContent().catch(()=>null);
const ok = tabCount===1 && hostState==='ready' && iframeCardCount>0;
console.log(`${ok?'PASS':'FAIL'}  Library tab opens the hosted gallery (tab ${tabCount}, host ${hostState}, ${iframeCardCount} cards)${refusalReason?` · refusal: ${refusalReason.trim().replace(/\s+/g,' ').slice(0,160)}`:''}`);
if(!ok)process.exitCode=1;
await page.screenshot({path:'walk/artifacts/library-host-light.png', clip:{x:0,y:0,width:1280,height:500}});

// Flip the shell theme → the hosted page must follow
await page.evaluate(()=>{document.body.dataset.theme='dark';});
await page.waitForTimeout(1200);
const night=await page.frameLocator('.library-host-frame').locator('body.night').count().catch(()=>0);
const darkOk = night===1;
console.log(`${darkOk?'PASS':'FAIL'}  the hosted Library follows the shell's dark theme`);
if(!darkOk)process.exitCode=1;
await page.screenshot({path:'walk/artifacts/library-host-dark.png', clip:{x:0,y:0,width:1280,height:500}});
await browser.close();
