// expressions-overlay-probe: the Studio is a summoned overlay over the
// full-bleed field — never a flex column that shrinks the world. Readbacks:
// field width is identical with the Studio closed and open; the Studio
// overlays it from its edge; the resize handle sits on the Studio's leading
// edge; closing returns the field untouched. No screenshots-as-proof.
import {chromium} from 'playwright';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.addInitScript(()=>{try{
  sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');
  // the Studio dock's remembered geometry is per-viewer state — start from closed
  for(const key of Object.keys(localStorage)) if(key.includes('studio')) localStorage.removeItem(key);
}catch{}});
await page.goto('http://localhost:1432/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1200);
await page.locator('.world-mode-strip [data-mode="expressions"]').click();
await page.waitForTimeout(1200);
const surface=page.locator('.xp-surface');
check(await surface.count()>0,'the Expressions surface renders');
const field=page.locator('.xp-field');
// The dock remembers its geometry per viewer (and defaults open) — normalise
// to closed before measuring, through the surface's own control.
const studioButton=page.locator('.xp-menubar button[aria-label="Studio"]');
if(await surface.getAttribute('data-studio')==='open'){await studioButton.click();await page.waitForTimeout(300);}
check((await surface.getAttribute('data-studio'))==='closed','the Studio starts closed for the measurement');
const fieldClosed=await field.boundingBox();
// Summon the Studio from the toolbelt
await studioButton.click();
await page.waitForSelector('.xp-studio',{timeout:5000});
await page.waitForTimeout(400);
const studio=page.locator('.xp-studio');
check(await studio.count()>0,'the Studio opens');
const studioBox=await studio.boundingBox();
const fieldOpen=await field.boundingBox();
check(Math.abs(fieldClosed.width-fieldOpen.width)<1,'the field keeps its full width under the open Studio',`closed ${Math.round(fieldClosed.width)} open ${Math.round(fieldOpen.width)}`);
check(Math.abs(studioBox.x+studioBox.width-(fieldOpen.x+fieldOpen.width))<2,'the Studio overlays the field from its right edge',`studio right ${Math.round(studioBox.x+studioBox.width)} field right ${Math.round(fieldOpen.x+fieldOpen.width)}`);
const handle=page.locator('.xp-studio-handle');
check(await handle.count()>0,'the resize handle rides the Studio');
const handleBox=await handle.boundingBox();
check(Math.abs(handleBox.x+handleBox.width-studioBox.x)<3,'the handle sits on the Studio’s leading edge',`handle right ${Math.round(handleBox.x+handleBox.width)} studio left ${Math.round(studioBox.x)}`);
// Resize by keyboard: focus the handle, arrow left grows the studio
await handle.focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(200);
const grown=await studio.boundingBox();
check(grown.width>studioBox.width,'arrow-key resize still works through the dock hook',`${Math.round(studioBox.width)} → ${Math.round(grown.width)}`);
// Close: field unchanged
await page.locator('.xp-studio button[aria-label="Close Studio"]').click();
await page.waitForTimeout(300);
const fieldAfter=await field.boundingBox();
check(Math.abs(fieldClosed.width-fieldAfter.width)<1,'closing the Studio leaves the field untouched',`${Math.round(fieldAfter.width)}`);
check(errors.length===0,'no console or page errors',errors.join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
