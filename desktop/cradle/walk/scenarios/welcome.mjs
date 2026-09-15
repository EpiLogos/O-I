/** The welcome frontstate — the Global Expression Stage's first
 * application: the app opens behind the O:I mark presented on the
 * frontstate plane; the kernel's opening is stated truthfully on the same
 * continuous field (no second loader), and once `app.ready` lands, a
 * click plays the authored enter sequence and hands the workspace over.
 * Reduced motion skips the flight entirely.
 * Runs the real first-open path — the runner only suppresses the
 * frontstate for URLs without ?frontstate. */
const READY = '.oi-welcome-enter[aria-label="O:I is ready. Open the app."]';
export default async function run({page,baseUrl,check,shot}) {
  await page.goto(`${baseUrl}?frontstate`);
  const welcome=page.locator('.oi-welcome');
  await welcome.waitFor({timeout:15000});
  check(await welcome.count()===1,'The welcome frontstate stands between the app and the person on first open');
  check((await page.locator('.oi-boot-overlay').count())===0,'Boot is one continuous frontstate — no second loader stands over it');
  // The host loads lazily (the heavy dependency is imported on first use);
  // give it its moment rather than demanding it synchronously.
  await page.locator('.oi-point-cloud-overlay').waitFor({timeout:20000});
  check(await page.locator('.oi-point-cloud-overlay').count()===1,'The frontstate field renders through the one window expression canvas');
  // The enter control opens only once the kernel state has settled (`app.ready`).
  await page.locator(READY).waitFor({timeout:15000});
  const enter=page.locator('.oi-welcome-enter');
  check(await enter.getAttribute('aria-label')==='O:I is ready. Open the app.','The enter control is a real labelled control, not a bare scrim');
  check(await page.getByRole('region',{name:'Empty workspace'}).isVisible(),'The workspace is already composed behind the frontstate');

  // Escape is a keyboard path into the app.
  await page.keyboard.press('Escape');
  await welcome.waitFor({state:'detached',timeout:10000});
  check((await page.locator('.oi-welcome').count())===0,'Escape dissolves the frontstate and hands the app over');

  // A second open in the same session does not re-trap the app.
  await page.reload();
  await page.locator('.desktop-shell').waitFor({timeout:15000});
  check((await page.locator('.oi-welcome').count())===0,'A continuing session in the same window opens straight into the app');

  // Reduced motion: the frontstate still appears, but the click enters at
  // once — the preference is respected, never silently animated through.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.locator('.oi-welcome').waitFor({timeout:15000});
  await page.locator(READY).waitFor({timeout:15000});
  await shot('welcome-reduced-motion');
  await page.mouse.click(640,400);
  await page.waitForTimeout(300);
  check((await page.locator('.oi-welcome').count())===0,'Reduced motion enters immediately without the dissolve flight');
  await page.emulateMedia({reducedMotion:'no-preference'});

  // The full visual path: click → authored dissolve → app. Screenshot
  // evidence at rest and mid-flight (native visual acceptance still pending).
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.locator('.oi-welcome').waitFor({timeout:15000});
  await page.locator(READY).waitFor({timeout:15000});
  await page.waitForTimeout(1200);
  await shot('welcome-frontstate-rest');
  await page.mouse.click(640,400);
  await page.waitForTimeout(450);
  await shot('welcome-frontstate-dissolve');
  await page.locator('.oi-welcome').waitFor({state:'detached',timeout:10000});
  check(await page.getByRole('region',{name:'Empty workspace'}).isVisible(),'After the dissolve the empty workspace is the app');
  await shot('welcome-frontstate-entered');

  // The clock law in the real app (StrictMode, the stage provider, the
  // welcome release): once the frontstate has gone and no presentation is
  // live, the production field schedules nothing and its frame count
  // stops moving — measured over a quiet second, after the bounded settle.
  await page.waitForFunction(async()=>{const r=await window.__cradle.walk.read.stage();return r.data&&r.data.live===false&&r.data.scheduled===false;},null,{timeout:5000});
  const idle=await page.evaluate(async()=>{
    const before=await window.__cradle.walk.read.stage();
    let raf=0;const original=window.requestAnimationFrame;window.requestAnimationFrame=(cb)=>original((t)=>{raf++;cb(t);});
    await new Promise((resolve)=>setTimeout(resolve,1000));
    window.requestAnimationFrame=original;
    const after=await window.__cradle.walk.read.stage();
    const canvas=document.querySelector('canvas[data-oi-stage="engine"]');
    return {presentations:after.data.presentations.length,frames:after.data.frames-before.data.frames,scheduled:after.data.scheduled,live:after.data.live,raf,dormant:canvas?canvas.dataset.oiStageLive==='false':null,canvases:document.querySelectorAll('canvas[data-oi-stage="engine"]').length};
  });
  check(idle.presentations===0&&idle.live===false,'No presentation is live in the settled ordinary desktop');
  check(idle.frames===0&&idle.scheduled===false,`The released production field renders no frames and schedules none (${JSON.stringify(idle)})`);
  check(idle.dormant===true&&idle.canvases===1,'The one engine canvas stays (context and resident field kept) and is marked dormant');
}
