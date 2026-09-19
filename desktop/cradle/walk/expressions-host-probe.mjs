// expressions-host-probe: the Expressions centre is the O:I Expressions
// application itself — the Point-Cloud-Demo workspace hosted full-screen
// through the owner's material seam (owner direction 2026-09-19). In a plain
// browser (no owner transport) the host states its honest absence; under
// Tauri or the walk bridge the frame hosts the application's own UI. The
// shell's frame (navigator, panel with its sides, footer) stays present.
import {chromium} from 'playwright';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto('http://localhost:1432/',{timeout:40000});
await page.waitForSelector('.desktop-shell',{timeout:40000});
await page.waitForTimeout(1500);
await page.locator('.world-mode-strip [data-mode="expressions"]').click();
await page.waitForTimeout(1800);
const host=page.locator('.pcd-host');
check(await host.count()===1,'the Expressions centre is the application host');
const state=await host.getAttribute('data-state');
check(state==='refused'||state==='ready','the host states its standing honestly',`state=${state}`);
if(state==='refused'){
  const note=await host.locator('.pcd-host-refusal').innerText();
  check(/unavailable|browser/i.test(note),'the honest absence names the browser limitation',note.replace(/\s+/g,' ').slice(0,80));
}
check(await page.locator('.world-mode-strip').count()===1,'the shell frame stays present (mode strip)');
const sides=await page.locator('.agent-layer[data-face="chat"] button').allTextContents().catch(()=>[]);
check(sides.some(t=>/Ta-Onta/.test(t))&&sides.some(t=>/Anima/.test(t)),'the panel sides (Ta-Onta, Anima) are reachable from the chat face',sides.join(',').slice(0,60));
check(errors.length===0,'no console or page errors',errors.slice(0,2).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
