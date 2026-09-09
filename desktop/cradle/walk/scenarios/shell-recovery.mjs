import {docText, waitForDoc} from '../editor-doc.mjs';
export {setup} from './editor.mjs';
export default async function run({page,baseUrl,channel,check,shot,provision:p}) {
  await page.goto(baseUrl); await channel('info');
  await page.locator('[data-project-path="Work/Editor"]').click();
  await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  await page.locator(`[data-file-path="Work/Editor/${p.sources[0].binding.path}"]`).click();
  await page.locator('.cm-content').waitFor();
  await page.locator('.cm-content').focus();
  await page.keyboard.press('Meta+d');
  await page.getByRole('button',{name:'Close empty pane',exact:true}).waitFor();
  check(await page.locator('.pane.group').count()===2,'One-tab Split creates a usable empty sibling');
  await page.reload();await channel('info');
  await page.getByRole('button',{name:'Close empty pane',exact:true}).waitFor();
  check(await page.locator('.pane.group').count()===2,'Empty split survives relaunch of the renderer');
  await page.locator(`[data-file-path="Work/Editor/${p.sources[1].binding.path}"]`).click();
  await page.waitForFunction(()=>document.querySelectorAll('.cm-content').length===2);
  check(await page.getByRole('button',{name:'Close empty pane',exact:true}).count()===0,'Opening another source fills the focused empty pane');
  const before = (await channel('read.layout')).data.layout;
  for (const width of [1280,900,760,639,390]) {
    await page.setViewportSize({width,height:width===900?760:720});
    await page.waitForTimeout(250);
    check(await page.locator('footer[aria-label="Workspace status"]').isVisible(),`Workspace footer visible at ${width}`);
    check(await page.locator('header.shell-topbar').isVisible(),`Global top strip visible at ${width}`);
    check(await page.locator('header.shell-topbar [aria-label="Toggle left region"]').isVisible() && await page.locator('header.shell-topbar [aria-label="Toggle right region"]').isVisible(),`Both region toggles remain at the top at ${width}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No page overflow at ${width}`);
    if(width<640) {
      check(await page.locator('.pane.group:visible').count()===1,`Narrow canvas exposes one usable focused pane at ${width}`);
      const selector=page.getByRole('combobox',{name:'Focused pane',exact:true});
      const options=await selector.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value));
      const previous=await docText(page,'.cm-content');
      await selector.selectOption(options.find(id=>id!==previous));
      check(await docText(page,'.cm-content')!==previous,`Top strip switches the focused pane at ${width}`);
      await selector.selectOption(previous);

      await page.getByRole('button',{name:'Toggle left region',exact:true}).click();
      // Wait for the overlay's real geometry after the width transition;
      // isVisible alone samples synchronously before the first paint.
      await page.locator('[data-region="left"][data-overlay="true"]').waitFor({state:'visible'});
      check(await page.locator('[data-region="left"][data-overlay="true"]').isVisible(),`Central is summonable at ${width}`);
      await page.keyboard.press('Escape');
      check(await page.getByRole('button',{name:'Toggle left region',exact:true}).evaluate(el=>el===document.activeElement),`Overlay returns focus at ${width}`);
      await page.keyboard.press('Meta+b');
      await page.locator('[data-region="left"][data-overlay="true"]').waitFor({state:'visible'});
      check(await page.locator('[data-region="left"][data-overlay="true"]').isVisible(),`Keyboard summons Central at ${width}`);
      await page.keyboard.press('Escape');
    }
    await shot(`${width}`);
  }
  await page.setViewportSize({width:1280,height:720});
  await page.waitForTimeout(250);
  check(JSON.stringify((await channel('read.layout')).data.layout.root)===JSON.stringify(before.root),'Responsive transitions preserve the pane tree');
  check((await channel('read.layout')).data.layout.agencyDepth===before.agencyDepth,'Overlay preserves intended sidebar depth');
  await page.getByRole('button',{name:'System',exact:true}).click();
  await page.getByRole('region',{name:'System composition'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.system-panel')?.getAttribute('aria-busy')==='false');
  await shot('system-1280');
  await page.setViewportSize({width:900,height:760});await shot('system-900');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('tab').first().click();
  check(await page.locator('.spatial-feedback').count()===0,'Point-cloud proposals are not mounted in production');
}
