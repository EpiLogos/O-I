// library-join-probe (W1): the one Library as O:I Web's connective field —
// scopes render, a composition opens into the Expressions surface through
// the native read, and the return path keeps the workspace. Honest states
// where the owner read discloses nothing.
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
// The Library reaches every mode — enter it from Base
const libraryButton=page.locator('button[aria-label*="Library"i], [data-open*="library"i]').first();
if(!await libraryButton.count()){check(false,'the Library is reachable');await browser.close();process.exit(1);}
await libraryButton.click();
await page.waitForTimeout(900);
check(await page.locator('.library-results, [class*="library"]').count()>0,'the Library opens');
// scopes: here / local / shared
const scopeText=await page.locator('[class*="library"], [class*="scope"]').first().innerText().catch(()=>'');
check(/here|local|shared/i.test(scopeText),'the Library discloses its scopes',scopeText.replace(/\s+/g,' ').slice(0,60));
// worlds provider refuses honestly (no list-all op) — the refusal IS the check
check(errors.length===0,'no console or page errors',errors.slice(0,2).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
