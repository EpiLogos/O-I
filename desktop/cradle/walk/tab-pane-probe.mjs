import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto('http://localhost:1421/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1500);
// open the one local surface (the draft — no kernel needed), then split
await page.getByRole('button',{name:'Start writing'}).click();await page.waitForTimeout(800);
await page.keyboard.press('Meta+d');await page.waitForTimeout(400);
const panes=page.locator('.pane.group');
console.log('panes:',await panes.count());
const first=panes.nth(0),second=panes.nth(1);
console.log('pres first/second:',await first.getAttribute('data-tab-presentation'),'/',await second.getAttribute('data-tab-presentation'));
// orientation is per pane: flip only the first
await first.locator('.pane-tool-orient').click();await page.waitForTimeout(300);
console.log('after orient first/second:',await first.getAttribute('data-tab-presentation'),'/',await second.getAttribute('data-tab-presentation'));
console.log('first orientation attr:',await first.getAttribute('data-tab-orientation'));
// pin the first, move pointer away: its strip hides with ZERO remainder
await first.locator('.pane-tool-pin').click();await page.waitForTimeout(400);
// the pin keeps focus (focus-within holds the reveal open) — a person's next
// click lands in the surface; only then does the drawer fold away
await first.locator('.cm-content').click();await page.waitForTimeout(300);
await page.mouse.move(900,400);await page.waitForTimeout(500);
const stripBox=await first.locator('.tab-strip').boundingBox();
const paneBox=await first.boundingBox();
console.log('folded strip w/h:',stripBox?.width,stripBox?.height,'pane x:',paneBox?.x,'strip x:',stripBox?.x);
const bodyBox=await first.locator('.surface-body').boundingBox();
console.log('body starts at pane edge:',Math.abs((bodyBox?.x??0)-(paneBox?.x??0))<1.5);
// back to horizontal, pinned again, then folded: the horizontal drawer also hides with zero remainder.
// The strip is currently FOLDED (unpinned, zero width) — approach the pane's
// reveal edge first: the hiding law summons the strip before its tools are clickable.
await first.hover({position:{x:8,y:30}});await page.waitForTimeout(400);
await first.locator('.pane-tool-orient').click();await page.waitForTimeout(300);
console.log('re-pinned horizontal:',await first.getAttribute('data-tab-presentation'));
await first.locator('.pane-tool-pin').click();await page.waitForTimeout(300);
await first.locator('.cm-content').click();await page.waitForTimeout(300);
await page.mouse.move(900,400);await page.waitForTimeout(500);
const hStrip=await first.locator('.tab-strip').boundingBox();
console.log('horizontal folded h:',hStrip?.height);
// the second pane never moved
console.log('second still:',await second.getAttribute('data-tab-presentation'));
await browser.close();
