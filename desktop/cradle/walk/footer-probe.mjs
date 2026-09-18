import {chromium} from 'playwright';
// The probe's former ephemeral server (configFile:false) predates the
// workspace engine deps (`three` from packages/oi-design-system) and can no
// longer resolve them; it reads the standing dev server like the other walks.
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}});
await page.goto('http://localhost:1432/');
await page.waitForTimeout(2500);
// dismiss welcome if standing
const enter=page.locator('.oi-welcome-enter');
if(await enter.count()){await enter.click({force:true});await page.waitForTimeout(3200);}
const edge=page.locator('.workspace-footer-edge');
console.log('edge count',await edge.count());
console.log('edge box before',JSON.stringify(await edge.boundingBox()));
await edge.hover();
await page.waitForTimeout(400);
console.log('edge box after hover',JSON.stringify(await edge.boundingBox()));
const summary=page.locator('summary[aria-label="Workspace actions"]');
console.log('summary count',await summary.count());
const s=summary.first();
console.log('summary box',JSON.stringify(await s.boundingBox()));
console.log('summary visible',await s.isVisible());
const hit=await page.evaluate(()=>{const el=document.elementFromPoint(640,795);return el?el.className||el.tagName:'none';});
console.log('hit at 640,795',hit);
const hit2=await page.evaluate(()=>{const el=document.elementFromPoint(1240,795);return el?el.className||el.tagName:'none';});
console.log('hit at 1240,795',hit2);
await browser.close();
