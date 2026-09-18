// epi-retention-probe: the Epi-Logos world context persists while using the
// other arrangements (#375 amendment: "Entering Epi-Logos binds its corpus,
// profile and starting place; opening that subject in Expressions, Technè, a
// source editor or a product/Factory view retains the Epi context and return
// position"). The world state lives in the workspace context, not the mode.
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
// Enter the Epi-Logos world through the footer toggle (the whole-app state)
await page.locator('.workspace-footer-edge').hover().catch(()=>{});
await page.waitForTimeout(300);
const epiButton=page.locator('button[aria-label="Epi-Logos world"]');
if(!await epiButton.count()){check(false,'the Epi-Logos world toggle is reachable in the footer');await browser.close();process.exit(1);}
await epiButton.click();
await page.waitForTimeout(800);
const within=()=>page.locator('.world-context-world', {hasText:'Within Epi-Logos'}).count();
check(await within()>0,'entering Epi-Logos shows the world context');
// Switch arrangements — the world context must ride through
for(const mode of ['factory','expressions','techne','base']){
  await page.locator('.world-mode-strip [data-mode="'+mode+'"]').click();
  await page.waitForTimeout(700);
  const held=await page.locator('.world-context-world, has-text="Within Epi-Logos"'.split(',')[0]).count().catch(()=>0);
  const chip=await page.locator('text=Within Epi-Logos').count();
  check(chip>0,`the Epi context retains through ${mode}`,chip===0?'world context lost':'');
}
// Leave the world explicitly — the chip goes, the shell stays
await page.locator('button[aria-label="Leave the Epi-Logos world"]').click();
await page.waitForTimeout(500);
check(await page.locator('text=Within Epi-Logos').count()===0,'leaving the world is explicit and clears the context');
check(errors.length===0,'no console or page errors',errors.slice(0,2).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
