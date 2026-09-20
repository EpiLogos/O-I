import {docText, waitForDoc} from '../editor-doc.mjs';
/** Empty desktop remains usable without an owner transport; no sample world.
 *
 *  Writing is no longer a mode this pane owns, and it no longer waits for an
 *  owner either. The study-era isolated canvas ("Start writing" → a local
 *  textarea, "Back to workspace" → back to this same page) was a parallel to
 *  the real Flow work, not a route into it. The entry now opens the retained
 *  local draft (supersession, 2026-09-13: with no owner transport the writing
 *  still opens and is kept on this device — the early reading that it should
 *  be refused named a door the carrier law has since closed). Nothing reaches
 *  the ground until an explicit Save places it through Central's own flow
 *  operation; that kernel-backed half is asserted in the `flow-canvas`
 *  scenario. */
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
  // Length robustness: every eligible phrase renders in the invisible reserve,
  // so the stage's height is the tallest statement's and a rotation onto a
  // longer (two- or three-line) phrase can never displace the boxes below.
  const stability=await rest.locator('.welcome-prompt').first().evaluate(header=>{
    const roller=header.querySelector('.welcome-prompt-roller');
    const reserve=roller?.querySelector('.welcome-prompt-reserve');
    const nav=header.nextElementSibling;
    if(!roller||!(reserve instanceof Element)||!(nav instanceof HTMLElement))return {ok:false,reason:'roller, reserve or action nav missing'};
    const spans=[...reserve.querySelectorAll(':scope > span')];
    if(spans.length<4)return {ok:false,reason:`reserve carries ${spans.length} phrases, expected the full eligible set`};
    const tallest=Math.max(...spans.map(span=>span.getBoundingClientRect().height));
    const stage=roller.getBoundingClientRect();
    const navTop=nav.getBoundingClientRect().top;
    return {ok:stage.height>=tallest-0.5&&navTop>=stage.bottom-0.5,phrases:spans.length,tallest:Math.round(tallest),stageHeight:Math.round(stage.height)};
  });
  check(stability.ok&&stability.phrases>=4,'The rolling prompt reserves its tallest statement, so rotation never displaces the boxes',stability);
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
  // Supersession named (2026-09-13, ratified flow carrier — O-I #271 on
  // PROPOSAL-FLOW-DAY-LOGICS-2026-09-13-2 / Central #174): unplaced writing
  // has ONE owner-section home. Saving places a dated 0/1 instance in
  // Control/user/flows through Central's own file operation, and the #271
  // brief rules "the register picker is gone (one user-section home)". The
  // earlier check asserted the pre-carrier picker; the law under assertion
  // now is the truthful render: the destination named beside the ordinary
  // Save, in the ordinary saving chrome, and no register choice fabricated
  // where the carrier law removed one.
  const picker=await page.locator('.draft-surface .draft-register select').count();
  check(/Control\/user\/flows/.test(footer)&&/Save/.test(footer)&&picker===0,
    'Unsaved writing names its owner-section destination beside the ordinary Save, and fabricates no register choice',{footer,picker});
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
