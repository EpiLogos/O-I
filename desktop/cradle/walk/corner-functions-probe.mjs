import {chromium} from 'playwright';
// Acceptance probe — the canvas top-right corner (owner report 2026-09-25):
// the floating functions menu ("…", .canvas-window-functions) must never
// cover the focused pane tab strip's "New tab" button ("+", .strip-open) —
// geometry plus a real hit-test at the button's centre, with the right
// region closed and open (the two states the corner law serves). Every
// check is geometry or hit-test, never presence alone; the probe exits 1
// when any state fails. Reads the standing dev server (PROBE_URL overrides).
const base=process.env.PROBE_URL??'http://localhost:1421/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto(base);
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1200);
// Open the one local surface (the draft — no kernel needed) so a real tab
// strip with its "+" exists.
await page.getByRole('button',{name:'Start writing'}).click();
await page.locator('.cm-content').first().waitFor({timeout:15000});
await page.waitForTimeout(600);

let fails=0;
const measure = async label => {
  const data = await page.evaluate(() => {
    const hud = document.querySelector('.canvas-window-functions > summary, .canvas-window-functions');
    const pane = document.querySelector('.pane.group[data-tab-presentation]');
    const plus = pane?.querySelector('.strip-open');
    const box = el => { if(!el) return null; const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
    const hb = box(hud), pb = box(plus);
    let overlap = null, hit = null;
    if (hb && pb) {
      const ix = Math.max(0, Math.min(hb.right, pb.right) - Math.max(hb.x, pb.x));
      const iy = Math.max(0, Math.min(hb.bottom, pb.bottom) - Math.max(hb.y, pb.y));
      overlap = {w: ix, h: iy};
      hit = document.elementFromPoint(pb.x + pb.w/2, pb.y + pb.h/2)?.closest('button')?.getAttribute('aria-label') ?? null;
    }
    return {hud: hb, plus: pb, overlap, hit};
  });
  // Clear = no real intersection (a shared row makes the height overlap
  // read full even when the width is zero) AND the "+" actually receives
  // the pointer.
  const clear = data.overlap !== null && data.overlap.w <= 0.5 && data.hit === 'New tab';
  console.log(`${clear?'PASS':'FAIL'}  ${label}: menu ${data.hud?`x ${data.hud.x}–${data.hud.right}`:'absent'} · "+" ${data.plus?`x ${data.plus.x}–${data.plus.right}`:'absent'} · overlap ${data.overlap?`${data.overlap.w}x${data.overlap.h}`:'n/a'} · hit-test → ${data.hit}`);
  if (!clear) fails++;
  return clear;
};

await measure('right region closed');
await page.keyboard.press('Meta+Shift+B');
await page.waitForTimeout(900);
await measure('right region open');

await browser.close();
process.exit(fails ? 1 : 0);
