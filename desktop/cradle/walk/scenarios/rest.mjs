/** Empty desktop remains usable without an owner transport; no sample world. */
export default async function run({page,baseUrl,check,metric,shot,channel}) {
  await page.goto(baseUrl);
  const timing=(await channel('capture.timing')).data;
  metric('cold_start_fcp_ms',timing.fcp_ms);
  check(timing.fcp_ms!==null && timing.fcp_ms<3000,'Desktop cold start is below 3 seconds');
  check((await channel('info')).data.transport.kind==='unavailable','Missing native transport is reported as unavailable');
  check(await page.locator('.desktop-shell').count()===1,'One spatial desktop hosts the writing mode');
  check(await page.locator('[data-region="left"]').count()===1,'Exactly one contextual left region');
  check(await page.locator('[data-project-path]').count()===0,'Unavailable owner produces no fabricated projects');
  check(await page.locator('.world-navigator input[type="search"]').count()===0,'No persistent sidebar search input');
  check(await page.getByRole('region',{name:'Empty workspace'}).isVisible(),'An empty workspace opens as a desktop, with writing as an explicit mode');
  check(await page.getByRole('textbox',{name:'Writing surface'}).count()===0,'No automatic textarea or address simulation at desktop start');
  await page.getByRole('button',{name:'Start writing',exact:true}).click();
  const writing=page.getByRole('textbox',{name:'Writing surface'});
  await writing.fill('Ordinary writing with spaces stays ordinary.');
  check(await writing.inputValue()==='Ordinary writing with spaces stays ordinary.','Ordinary writing keystrokes remain available');
  await page.getByRole('button',{name:'Back to workspace'}).click();
  check(await page.getByRole('region',{name:'Empty workspace'}).isVisible(),'Writing can return to the desktop without closing a source');
  await page.getByRole('button',{name:'Resume writing'}).click();
  check(await writing.inputValue()==='Ordinary writing with spaces stays ordinary.','Returning to writing retains the complete draft');
  await writing.focus(); await page.keyboard.press('Meta+k');
  check(await page.getByRole('dialog').isVisible(),'The search aperture opens over focused writing');
  await page.keyboard.press('Escape');
  check(await writing.evaluate(e=>e===document.activeElement),'Escape from search restores the prior writing caret');
  await page.reload(); await channel('info');
  check(await writing.inputValue()==='Ordinary writing with spaces stays ordinary.','Relaunch restores unsent workspace writing');
  await shot('desktop-writing');
}
