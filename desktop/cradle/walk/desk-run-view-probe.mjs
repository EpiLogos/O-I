import {chromium} from 'playwright';
const out='/tmp/desk-shots';
import {mkdirSync} from 'fs';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto('http://localhost:1432/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1500);
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.waitForTimeout(1200);
const scenario=page.locator('main.factory-centre select[aria-label="Dev scenario"]');
if(!await scenario.count()){console.log('NO SCENARIO SELECT'); await browser.close(); process.exit(1); }
await scenario.selectOption('desk');
await page.waitForTimeout(900);
// Open the parallel-work Run (carries a trajectory)
const card=page.locator('.desk-card',{hasText:'Sidebar slice — render lane'});
await card.locator('.desk-card-open').click();
await page.waitForTimeout(1200);
console.log('depths:',await page.locator('.desk-run-depths button').allTextContents());
// Trajectory (default)
await page.screenshot({path:`${out}/rv-1-trajectory.png`});
console.log('trace explorer:',await page.locator('.desk-run-view .fb-build-surface').count());
console.log('session cards:',await page.locator('.desk-run-view .fb-sessions, .desk-run-view [class*="session"]').count());
// Reading
await page.locator('.desk-run-depths button',{hasText:'Reading'}).click();
await page.waitForTimeout(400);
await page.screenshot({path:`${out}/rv-2-reading.png`});
console.log('frontier:',await page.locator('.desk-run-frontier h2').textContent().catch(()=>'none'));
console.log('claims:',await page.locator('.desk-run-claim').count());
// Live
await page.locator('.desk-run-depths button',{hasText:'Live'}).click();
await page.waitForTimeout(400);
await page.screenshot({path:`${out}/rv-3-live.png`});
console.log('live cards:',await page.locator('.desk-run-live-grid article').count());
// Map (live read will be refused — no kernel transport in the probe; honest state)
await page.locator('.desk-run-depths button',{hasText:'Map'}).click();
await page.waitForTimeout(900);
await page.screenshot({path:`${out}/rv-4-map.png`});
console.log('map refused note:',await page.locator('.desk-run-map .oi-note').count());
console.log('errors:',errors.length?errors:'none');
await browser.close();
