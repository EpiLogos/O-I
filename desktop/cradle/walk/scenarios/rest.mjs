import {docText, waitForDoc} from '../editor-doc.mjs';
/** Empty desktop remains usable without an owner transport; no sample world.
 *
 *  With an owner ground reachable, "Start writing" opens a real flow file —
 *  a dated 0/1 instance minted in Control/user/flows through Central's own
 *  file operation (owner direction, 2026-09-22). This scenario runs with no
 *  transport at all, so it asserts the honest fallback: the retained local
 *  draft (2026-09-13) that placeDraft still carries to that same home on
 *  explicit Save. The kernel-backed halves are asserted in the `flow-canvas`
 *  and `document-entry` scenarios. */
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

  // One composition, real entries only — Day (the owner's canonical day
  // record), Graph (the graph aperture's mode), Search, the library, and
  // Start writing (owner set, 2026-09-22; ruling 4 adds Card and Graph).
  const entries=await rest.getByRole('navigation',{name:'Start working'}).getByRole('button').allTextContents();
  check(entries.length<=5&&entries.some(t=>/Start writing/.test(t))&&entries.some(t=>/Search/.test(t))&&entries.some(t=>/^Day/.test(t))&&entries.some(t=>/^Graph/.test(t)),
    'The fresh page offers only its real entries',{entries});
  check(await rest.locator('.welcome-prompt h2').count()===1,'The rolling welcome prompt is the page heading');
  // Length robustness, two-sided and exercised. Every eligible phrase renders
  // in the invisible reserve, so the stage's height IS the tallest statement's
  // — asserted within half a pixel in BOTH directions, so a stacked reserve
  // (each phrase contributing its own row) can no longer read as a pass the
  // way the old one-sided bound allowed. And the triggering transition is
  // exercised, not assumed: the check waits through the roller's real
  // timer-driven rotations until the longest phrase is the active heading,
  // then measures the landed pose.
  const roller=rest.locator('.welcome-prompt').first();
  const longest=await roller.evaluate(header=>{
    const reserve=header.querySelector('.welcome-prompt-roller')?.querySelector('.welcome-prompt-reserve');
    const spans=reserve?[...reserve.querySelectorAll(':scope > span')]:[];
    const heights=spans.map(span=>span.getBoundingClientRect().height);
    const tallestIndex=heights.indexOf(Math.max(...heights));
    return {phrases:spans.length,tallestText:spans[tallestIndex]?.textContent};
  });
  const drive={rotated:false};
  if(longest.tallestText) {
    try {
      if(await page.evaluate(()=>document.querySelector('.welcome-prompt h2')?.textContent)===longest.tallestText) {
        // Already posing the longest statement: prove a real rotation happens
        // at all, then wait for the cycle to land back on that statement.
        await page.waitForFunction(expected=>document.querySelector('.welcome-prompt h2')?.textContent!==expected,longest.tallestText,{timeout:12000});
      }
      await page.waitForFunction(expected=>document.querySelector('.welcome-prompt h2')?.textContent===expected,longest.tallestText,{timeout:longest.phrases*8000+8000});
      // Measure after the heading's entry animation has finished landing.
      await page.waitForFunction(()=>[...(document.querySelector('.welcome-prompt h2')?.getAnimations()??[])].every(animation=>animation.playState==='finished'),null,{timeout:5000});
      drive.rotated=true;
    } catch {drive.reason='the roller never landed on its longest phrase through real rotations';}
  } else drive.reason='the reserve was unreadable, so no rotation could be driven';
  const stability=await roller.evaluate((header,expected)=>{
    const roller=header.querySelector('.welcome-prompt-roller');
    const reserve=roller?.querySelector('.welcome-prompt-reserve');
    const nav=header.nextElementSibling;
    if(!roller||!(reserve instanceof Element)||!(nav instanceof HTMLElement))return {ok:false,reason:'roller, reserve or action nav missing'};
    const spans=[...reserve.querySelectorAll(':scope > span')];
    if(spans.length<4)return {ok:false,reason:`reserve carries ${spans.length} phrases, expected the full eligible set`};
    const tallest=Math.max(...spans.map(span=>span.getBoundingClientRect().height));
    const stage=roller.getBoundingClientRect();
    const navTop=nav.getBoundingClientRect().top;
    // Two-sided ±0.5px: the stage stands exactly the tallest statement tall —
    // taller means the phrases stack, shorter means the reserve is missing.
    const landedOn=header.querySelector('.welcome-prompt h2')?.textContent;
    return {ok:tallest-0.5<=stage.height&&stage.height<=tallest+0.5&&navTop>=stage.bottom-0.5,
      phrases:spans.length,tallest:Math.round(tallest),stageHeight:Math.round(stage.height),
      landedOnLongest:landedOn===expected,landedOn:(landedOn??'').slice(0,60)};
  },longest.tallestText);
  check(stability.ok&&stability.phrases>=4&&drive.rotated&&stability.landedOnLongest,
    'A real rotation onto the longest statement leaves the stage exactly the tallest phrase tall (±0.5px) and nothing below displaced',
    {...stability,drive});
  check(await page.getByRole('button',{name:'Back to workspace'}).count()===0,
    'No "back to workspace" control that only returns to this same page');

  // The Day button speaks the owner's Day route (day_source_open). With no
  // transport at all it refuses honestly instead of simulating a day.
  await page.getByRole('button',{name:'Day',exact:true}).click();
  await page.locator('.rest-refusal').waitFor({timeout:10000});
  const refusal=(await page.locator('.rest-refusal').textContent())??'';
  check(refusal.trim().length>0,
    'Day without a register refuses honestly and names the failure');

  // Graph enters the real graph aperture's mode — the one summon the shell's
  // own mode entries use (owner ruling 4, 2026-09-22). It is never a second
  // navigator or a stub: Technè's left body IS the aperture over the
  // wiki/expressions projection, and with no transport that navigator names
  // its requirement instead of drawing an invented graph.
  await page.getByRole('button',{name:'Graph',exact:true}).click();
  await page.locator('.desktop-shell[data-mode="techne"]').waitFor({timeout:30000});
  check(true,'Graph enters the mode whose left body is the graph aperture');
  const graphNavigator=page.locator('.xg-navigator');
  await graphNavigator.waitFor({timeout:30000});
  const graphText=(await graphNavigator.textContent())??'';
  check(/Expressions are unavailable/.test(graphText),
    'The real graph aperture stands and names its requirement with no ground',{graph:graphText.slice(0,140)});
  await shot('desktop-rest-graph');
  await page.locator('.world-mode-strip [data-mode="base"]').click();
  await page.locator('.desktop-shell[data-mode="base"]').waitFor({timeout:15000});
  check(await rest.isVisible(),'Returning to Base restores the rest page');

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
