export {setup} from '../../../scenarios/editor.mjs';
export default async function({page,baseUrl,channel,check,shot,provision:p}) {
 await page.goto(baseUrl);await channel('info');
 check(await page.locator('.central-heading strong').innerText()==='My O:I','Sidebar names the personal field My O:I');
 check(await page.locator('.world-navigator h1').textContent()==='Work','Project index uses Work label');
 check(await page.locator('.central-actions button').count()===1,'Search row has no duplicate agent or wiki controls');
 for(const name of ['User','Agent']){
  await page.getByRole('button',{name:`Expand Central ${name} space`,exact:true}).click();
  await page.locator('.central-root-space').filter({has:page.getByRole('button',{name:`Collapse Central ${name} space`,exact:true})}).locator('.native-directory').waitFor();
  check(true,`${name} space returns a real native Central directory`);
  await page.getByRole('button',{name:`Collapse Central ${name} space`,exact:true}).click();
 }
 await page.locator('[data-project-path="Work/Editor"]').click();await page.getByRole('button',{name:'Editor: files',exact:true}).click();
 for(const source of p.sources){await page.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();await page.waitForFunction(ref=>document.querySelector('.source-textarea')?.getAttribute('data-source-ref')===ref,source.binding.ref);}
 check(await page.locator('.tab').count()===10,'Ten real source tabs are open');
 const lane=page.locator('.tab-scroll'); const tools=page.locator('.pane-tools');
 check(await lane.evaluate(el=>el.scrollWidth>el.clientWidth),'Tab lane overflows independently');
 const before=await tools.boundingBox();await lane.evaluate(el=>el.scrollLeft=0);await page.waitForTimeout(80);const after=await tools.boundingBox();
 check(before.x===after.x && before.width===after.width,'Pane controls remain fixed while tab lane scrolls');
 check(await page.locator('.shell-pane-actions').count()===0 && await page.locator('.shell-focus').innerText()==='','Global strip has no duplicate pane actions or document title');
 check((await page.locator('.shell-topbar').boundingBox()).height===30,'Window strip is30px high');
 check((await page.locator('[data-region="left"]').boundingBox()).x===0,'Sidebar is flush with window left edge');
 check(await page.locator('.pane.focused .source-editor-foot').isVisible(),'Active signal occupies nested pane footer');
 await page.getByRole('button',{name:'Window menu',exact:true}).click();await page.getByRole('menu').waitFor();await page.locator('.shell-topbar').click({position:{x:400,y:10}});
 check(await page.getByRole('menu').count()===0,'Pane ellipsis dismisses outside');
 await page.getByRole('button',{name:'Window menu',exact:true}).click();await page.keyboard.press('Escape');check(await page.getByRole('menu').count()===0,'Pane ellipsis dismisses Escape');
 const summary=page.locator('.desktop-menu > summary');await summary.click();await page.locator('.shell-topbar').click({position:{x:400,y:10}});check(await page.locator('.desktop-menu[open]').count()===0,'Workspace menu dismisses outside');
 await summary.click();await page.keyboard.press('Escape');check(await page.locator('.desktop-menu[open]').count()===0,'Workspace menu dismisses Escape');
 await shot('cleanup-wide');
 await page.locator('.source-textarea').focus();await page.keyboard.press('Meta+d');await page.waitForFunction(()=>document.querySelectorAll('.pane.group').length===2);
 await page.setViewportSize({width:390,height:720});await page.getByRole('combobox',{name:'Focused pane'}).waitFor();check(await page.locator('.pane.group:visible').count()===1,'Narrow pane selector retains one usable pane');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Narrow cleanup has no page overflow');await shot('cleanup-narrow');
}
