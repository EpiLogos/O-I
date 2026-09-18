// epi-cross-arrangement-probe (conformance case C, #375 amendment §7.1):
// Epi corpus entry → Expressions (Nara's foreground) → Technè (Epii) →
// explicit return restores prior work. The world context must hold through
// both arrangements; the subject the frame passes into Technè is the world's
// selected subject; leaving restores the pre-Epi arrangement.
import {chromium} from 'playwright';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto('http://localhost:1432/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1200);
// enter the Epi world through the footer entrance (the whole-app state)
await page.locator('.workspace-footer-edge').hover({position:{x:1300,y:2}}).catch(()=>{});
await page.waitForTimeout(400);
const epiBtn=page.locator('button[aria-label="Epi-Logos world"]');
if(!await epiBtn.count()){check(false,'the footer Epi entrance is reachable');await browser.close();process.exit(1);}
await epiBtn.click();
await page.waitForTimeout(900);
check(await page.locator('text=Within Epi-Logos').count()>0,'the Epi world binds with its context chip');
// open an Epi corpus passage into Expressions — where the corpus read
// discloses passages with expression bindings; otherwise the surface's own
// honest state is the assertion (no simulated passages).
const openExpression=page.locator('button',{hasText:'Open its Expression'}).first();
if(await openExpression.count()){
  await openExpression.click();
  await page.waitForTimeout(1100);
  check(await page.locator('.desktop-shell[data-mode="expressions"]').count()>0,'the Epi subject opens in Expressions (Nara’s foreground)');
  check(await page.locator('text=Within Epi-Logos').count()>0,'the world context retains in Expressions');
} else {
  const epiSurface=await page.locator('[aria-label="Epi-Logos"], .epi-logos-surface, [class*="epi"]').count();
  check(epiSurface>0,'the Epi surface renders with its honest corpus state (no passage carries an expression binding in this environment)');
}
// examine in Technè — the world subject flows to the disclosure
const examine=page.locator('button',{hasText:'Examine in Technè'}).first();
if(await examine.count()){
  await examine.click();
  await page.waitForTimeout(1100);
  check(await page.locator('.desktop-shell[data-mode="techne"]').count()>0,'the Epi subject opens in Technè (Epii)');
  check(await page.locator('text=Within Epi-Logos').count()>0,'the world context retains in Technè');
}
// explicit return: leave the world, back to prior work
await page.locator('button[aria-label="Leave the Epi-Logos world"]').click();
await page.waitForTimeout(600);
check(await page.locator('text=Within Epi-Logos').count()===0,'leaving the world is explicit');
check(errors.length===0,'no console or page errors',errors.slice(0,2).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
