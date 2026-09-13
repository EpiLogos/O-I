/** The welcome frontstate (Visuals → Expression's first application):
 * the app opens behind the O:I mark rendered as a live point cloud; a
 * click dissolves the mark (relational chaos on, orbits up, disperse) and
 * hands the workspace over. Reduced motion skips the flight entirely.
 * Runs the real first-open path — the runner only suppresses the
 * frontstate for URLs without ?frontstate. */
export default async function run({page,baseUrl,check,shot}) {
  await page.goto(`${baseUrl}?frontstate`);
  const welcome=page.locator('.oi-welcome');
  await welcome.waitFor({timeout:15000});
  check(await welcome.count()===1,'The welcome frontstate stands between the app and the person on first open');
  // The host loads lazily (the heavy dependency is imported on first use);
  // give it its moment rather than demanding it synchronously.
  await page.locator('.oi-point-cloud-overlay').waitFor({timeout:20000});
  check(await page.locator('.oi-point-cloud-overlay').count()===1,'The frontstate field renders through the one window expression canvas');
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
  await shot('welcome-reduced-motion');
  await page.mouse.click(640,400);
  await page.waitForTimeout(300);
  check((await page.locator('.oi-welcome').count())===0,'Reduced motion enters immediately without the dissolve flight');
  await page.emulateMedia({reducedMotion:'no-preference'});

  // The full visual path: click → dissolve → app. Screenshot evidence at
  // rest and mid-flight (native visual acceptance still pending).
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.locator('.oi-welcome').waitFor({timeout:15000});
  await page.waitForTimeout(1200);
  await shot('welcome-frontstate-rest');
  await page.mouse.click(640,400);
  await page.waitForTimeout(450);
  await shot('welcome-frontstate-dissolve');
  await page.locator('.oi-welcome').waitFor({state:'detached',timeout:10000});
  check(await page.getByRole('region',{name:'Empty workspace'}).isVisible(),'After the dissolve the empty workspace is the app');
  await shot('welcome-frontstate-entered');
}
