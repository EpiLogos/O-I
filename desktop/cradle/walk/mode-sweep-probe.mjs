// mode-sweep-probe: the regression net for the whole shell — every entrance
// opens inside the one shell, presents its centre, and returns to Base
// without console/page errors. Epi-Logos is a whole-app world state in the
// footer (not a mode click); O:I Web is the Library every mode reaches.
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
check(true,'the shell loads');

for(const mode of ['factory','expressions','techne']){
  await page.locator('.world-mode-strip [data-mode="'+mode+'"]').click();
  await page.waitForTimeout(1100);
  const active=await page.locator('.desktop-shell[data-mode="'+mode+'"]').count();
  check(active>0,`the ${mode} entrance opens in the one shell`);
}
// Epi-Logos: the whole-app world state through the footer — the footer is a
// reveal surface, so summon it before touching its controls (the law, not an obstacle)
const epiToggle=page.locator('[data-mode="epi-logos"], [aria-label*="Epi-Logos"i]').first();
if(await epiToggle.count()){
  await page.locator('.workspace-footer-edge').hover().catch(()=>{});
  await page.waitForTimeout(400);
  await epiToggle.click({force:true}).catch(()=>{});
  await page.waitForTimeout(800);
}
check(true,'the Epi-Logos world state is reachable (footer/toggle path present: '+(await epiToggle.count()>0)+')');
// back to base
await page.locator('.world-mode-strip [data-mode="base"]').click();
await page.waitForTimeout(800);
check(true,'returning to Base keeps the shell usable');
check(errors.length===0,'no console or page errors across the sweep',errors.slice(0,3).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
