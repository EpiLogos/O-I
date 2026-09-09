import {docText, waitForDoc} from '../editor-doc.mjs';
/** Empty desktop remains usable without an owner transport; no sample world.
 *
 *  Writing is no longer a mode this pane owns. The study-era isolated canvas
 *  ("Start writing" → a local textarea, "Back to workspace" → back to this
 *  same page) was a parallel to the real Flow work, not a route into it:
 *  it wrote into workspace-local state instead of a Flow in a NOW register,
 *  and its "back to workspace" named a destination it did not go to. The
 *  entry now opens a real Flow through Central's own operation, so with no
 *  owner transport the honest answer is the owner's absence — never a buffer
 *  that goes nowhere. The kernel-backed half of this contract is asserted in
 *  the `flow` scenario. */
export default async function run({page,baseUrl,check,metric,shot,channel}) {
  await page.goto(baseUrl);
  const timing=(await channel('capture.timing')).data;
  metric('cold_start_fcp_ms',timing.fcp_ms);
  check(timing.fcp_ms!==null && timing.fcp_ms<3000,'Desktop cold start is below 3 seconds');
  check((await channel('info')).data.transport.kind==='unavailable','Missing native transport is reported as unavailable');
  check(await page.locator('.desktop-shell').count()===1,'One spatial desktop hosts the empty workspace');
  check(await page.locator('[data-region="left"]').count()===1,'Exactly one contextual left region');
  check(await page.locator('[data-project-path]').count()===0,'Unavailable owner produces no fabricated projects');
  check(await page.locator('.world-navigator input[type="search"]').count()===0,'No persistent sidebar search input');
  const rest=page.getByRole('region',{name:'Empty workspace'});
  check(await rest.isVisible(),'An empty workspace opens as the one fresh-surface composition');
  check(await page.getByRole('textbox',{name:'Writing surface'}).count()===0,'No automatic textarea or address simulation at desktop start');

  // One composition, three real entries — never a fabricated fourth.
  const entries=await rest.getByRole('navigation',{name:'Start working'}).getByRole('button').allTextContents();
  check(entries.length<=3&&entries.some(t=>/Start writing/.test(t))&&entries.some(t=>/Search/.test(t)),
    'The fresh page offers only its real entries',{entries});
  check(await rest.locator('.welcome-prompt h2').count()===1,'The rolling welcome prompt is the page heading');
  check(await page.getByRole('button',{name:'Back to workspace'}).count()===0,
    'No "back to workspace" control that only returns to this same page');

  // Writing never waits for a register. With no owner transport at all the
  // writing still opens and keeps itself on this device, rather than being
  // refused or dropped into a buffer that goes nowhere.
  await page.getByRole('button',{name:'Start writing',exact:true}).click();
  const draft=page.locator('.draft-surface .cm-content');
  await draft.waitFor({timeout:15000});
  check(await page.locator('.draft-surface').count()===1,'Writing opens with no register reachable at all');
  const draftText='Writing that began before it had a register.';
  await draft.click(); await page.keyboard.type(draftText);
  await waitForDoc(page,draftText,'.draft-surface .cm-content');
  const footer=await page.locator('.draft-surface .editor-footer').textContent()??'';
  check(/Choose where to save/.test(footer)&&/Save/.test(footer),
    'Unsaved writing carries a register picker beside the ordinary Save, in the ordinary saving chrome',{footer});
  check(/Unsaved/.test(footer),'The surface says the writing is unsaved rather than claiming owner ground');
  await page.reload(); await channel('info');
  await page.locator('.draft-surface .cm-content').waitFor();
  check(await docText(page,'.draft-surface .cm-content')===draftText,
    'Unsaved writing survives a relaunch');

  await page.keyboard.press('Meta+k');
  check(await page.getByRole('dialog').isVisible(),'The search aperture opens from the fresh page');
  await page.keyboard.press('Escape');
  await shot('desktop-rest');
}
