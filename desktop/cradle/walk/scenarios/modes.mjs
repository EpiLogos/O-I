import {docText} from '../editor-doc.mjs';
/** Workspace modes: one shell; the sidebar's bottom strip carries the FOUR
 * work-mode radios (Base, Factory, Expressions, Technè, ⌘⌥1-4) with Settings
 * the separate terminal button beside it, and Epi-Logos no mode entry at all
 * but the footer's whole-app world state. Base keeps the pane/tab workbench;
 * every other mode DEDICATES its view — its centre surface full screen inside
 * `.mode-stage`, no tab strip, no pane chrome — while the base tree waits
 * unmounted in the store and remounts exactly on return. Switching never
 * closes work, loses writing, adds a renderer or puts anything above the
 * shell; each mode returns to the side regions it was left with; tab
 * presentation is the pin model — pinned as a strip, pinned as a vertical
 * list of persisted width, or unpinned behind a reveal edge that opens in
 * flow; all of it survives a reload. Runs over real owner-backed sources. */
export { setup } from './editor.mjs';
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl); await channel('info');
  const nav=page.getByRole('complementary',{name:'World navigator'});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  const sources=p.sources.slice(0,3);
  const title=s=>s.binding.path.split('/').pop();
  const open=async s=>{await nav.locator(`[data-file-path="Work/Editor/${s.binding.path}"]`).click();await page.waitForFunction(ref=>document.querySelector('.pane.focused .cm-content')?.dataset.sourceRef===ref,s.binding.ref);};
  for(const s of sources) await open(s);
  await page.locator('.pane.focused .cm-content').fill('Writing that must ride through every mode.\n');
  const layout=async()=> (await channel('read.layout')).data.layout;
  const stage=mode=>page.locator(`.mode-stage[data-mode="${mode}"]`);

  // --- the strip (the World navigator's bottom row) --------------------------
  const group=page.getByRole('radiogroup',{name:'Workspace mode',exact:true});
  const radio=name=>group.getByRole('radio',{name,exact:true});
  check(await group.getByRole('radio').count()===4,'The sidebar\'s bottom strip carries one mode radiogroup: the four work modes — Base, Factory, Expressions, Technè (⌘⌥1-4)');
  check(await radio('Settings').count()===0&&await radio('Epi-Logos').count()===0,'Settings and Epi-Logos are not in the strip');
  const systemButton=page.locator('.world-system-settings');
  check(await systemButton.getAttribute('aria-label')==='Settings'&&await systemButton.getAttribute('aria-pressed')==='false','Settings is the separate terminal button beside the strip, aria-pressed when active');
  check(await page.locator('.footer-epi').getAttribute('aria-pressed')==='false','Epi-Logos is the footer\'s whole-app world state, not a mode: aria-pressed on the footer button');
  check(await radio('Base').getAttribute('aria-checked')==='true','A workspace with no recorded mode is in Base');
  check((await layout()).mode===undefined,'Base is the absent mode — an arrangement saved before modes existed is unchanged');
  const switchBox=await group.boundingBox();
  check(switchBox.height<=30&&switchBox.width<=(await page.locator('[data-region="left"]').boundingBox()).width,'The strip is one compact glyph row inside the sidebar');
  await shot('base-1280');

  // --- Factory ----------------------------------------------------------------
  await radio('Factory').click();
  await stage('factory').waitFor();
  await stage('factory').locator('main.factory-development').waitFor();
  check(await radio('Factory').getAttribute('aria-checked')==='true'&&(await layout()).mode==='factory','Factory mode is recorded on the workspace layout');
  check(await stage('factory').locator('main.factory-development').count()===1&&await page.locator('.tab').count()===0&&await page.locator('.tab-strip').count()===0,'Factory dedicates its view: the mode\'s own surface stands in its stage, no tab strip, no pane chrome');
  check(await page.locator('.cm-content').count()===0,'Base\'s editors are unmounted while Factory stands; the base tree waits in the store');
  check(await page.locator('[data-region="left"]').evaluate(el=>(el.textContent??'').trim().length>10),'Factory keeps a project/files left body (its desk shape belongs to the Factory lane to evolve)');
  await shot('factory-1280');

  // --- Expressions ------------------------------------------------------------
  await radio('Expressions').click();
  await stage('expressions').waitFor();
  await stage('expressions').locator('section.xp-surface').waitFor();
  check(await stage('expressions').locator('section.xp-surface').count()===1&&await page.locator('.tab').count()===0&&await page.locator('.tab-strip').count()===0,'Expressions dedicates its view: its own surface full screen in the stage, no tab chrome');
  check(await page.getByRole('complementary',{name:'World navigator'}).count()===0,'Expressions replaces the World navigator with its own left body');
  check(await page.locator('canvas').count()<=1,'Expressions adds no second canvas: at most the window\'s one field');
  await shot('expressions-1280');
  // collapse the companion here; Expressions must remember that
  await page.keyboard.press('Meta+Shift+b');
  await page.waitForFunction(()=>document.querySelector('[data-region="right"]')?.getAttribute('data-depth')!=='panel');

  // --- Technè -------------------------------------------------------------------
  await page.keyboard.press('Meta+Alt+4');
  await stage('techne').waitFor();
  await stage('techne').locator('section.tn-surface').waitFor();
  // The strip lives in the World navigator, which Technè's own left body
  // replaces; the footer's workspace-actions menu carries the same entries.
  check(await page.getByRole('menuitemradio',{name:'Technè',includeHidden:true}).getAttribute('aria-checked')==='true','⌘⌥4 enters Technè from the keyboard');
  check(await stage('techne').locator('section.tn-surface').count()===1&&await page.locator('.tab-strip').count()===0,'Technè dedicates its view: the material surface in its stage, no pane chrome');
  check(await page.locator('aside[data-region="right"]').getAttribute('data-depth')==='panel','Technè opens with its own regions, not the ones Expressions was left with');
  await shot('techne-1280');

  // --- back: remembered regions, retained work ----------------------------------
  // From a mode whose left body replaces the World navigator, the footer's
  // workspace-actions menu is the mode fallback (same entries, same handler).
  // The duplicate mode radios left the footer (10-SIDEBARS §3.1): the left
  // foot's strip is the one mode switch, fixed in every mode.
  const menuMode=async name=>{await page.locator('[data-left-foot] .world-mode-strip').getByRole('radio',{name,exact:true}).click();};
  await menuMode('Expressions');
  await stage('expressions').waitFor();
  check(await page.locator('aside[data-region="right"]').getAttribute('data-depth')!=='panel','Returning to Expressions returns to the regions it was left with');
  // Back where the navigator shows, the strip's radiogroup keeps its keyboard
  // behaviour: arrows move and select (Factory → Base, roving tabIndex).
  await menuMode('Factory');
  await radio('Factory').focus(); await page.keyboard.press('ArrowLeft');
  check(await radio('Base').getAttribute('aria-checked')==='true','Arrow keys move and select within the radiogroup');
  check((await layout()).mode===undefined,'Base clears the recorded mode');
  await page.waitForFunction(()=>document.querySelectorAll('.tab').length===3);
  check(await page.locator('.tab').count()===3,'Base\'s own three tabs are exactly as they were left — the workbench remounted');
  await page.locator('.tab').filter({hasText:title(sources[2])}).click();
  check(await docText(page,'.pane.focused .cm-content')==='Writing that must ride through every mode.\n','Unsaved writing rode through every mode switch');

  // --- Settings: the terminal button beside the strip enters its mode ----------
  const settingsButton=page.locator('.world-system-settings');
  const t0=Date.now();
  await settingsButton.click();
  await stage('settings').waitFor();
  const entered=Date.now()-t0;
  check(entered<2000,'The terminal Settings button enters its mode instantly — the shell switches now, no awaited roundtrip gates it',{entered_ms:entered});
  check(await settingsButton.getAttribute('aria-pressed')==='true','The Settings button marks itself active (aria-pressed) while its mode stands');
  check((await layout()).mode==='settings','Settings is recorded as the workspace mode');
  await stage('settings').locator('.system-panel').waitFor();
  check(await stage('settings').locator('.system-panel').count()===1&&await page.locator('.tab').count()===0&&await page.locator('.tab-strip').count()===0,'Settings\' centre is the System panel inside its stage, with no tab chrome');
  check(await page.getByRole('complementary',{name:'World navigator'}).count()===1&&await group.getByRole('radio').count()===4,'Settings keeps the World navigator, whose strip still carries only the four work modes');
  check(await page.evaluate(()=>{const shell=document.querySelector('.desktop-shell');return !!shell&&shell.getBoundingClientRect().top===0;}),'Nothing renders above the shell in Settings mode');
  await shot('settings-1280');
  await radio('Base').click();
  await page.waitForFunction(()=>document.querySelectorAll('.tab').length===3);
  check(await page.evaluate(()=>{const shell=document.querySelector('.desktop-shell');return !!shell&&shell.getBoundingClientRect().top===0&&![...document.body.children].some(node=>node!==shell.closest('#root')&&node.getBoundingClientRect().height>0&&node.getBoundingClientRect().bottom<=shell.getBoundingClientRect().top+1&&getComputedStyle(node).position!=='fixed');}),'Nothing renders above the shell in any mode');
  check(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight&&document.body.scrollHeight<=window.innerHeight),'The document still does not scroll');

  // --- tab presentation: the pin model ---------------------------------------------
  const pane=page.locator('.pane.group.focused');
  const pin=()=>pane.locator('.pane-tool-pin');
  const stripBox=()=>pane.locator('.tab-strip').boundingBox();
  const bodyBox=()=>pane.locator('.surface-body').boundingBox();
  check(await pane.getAttribute('data-tab-presentation')==='pinned-horizontal','Tabs start pinned horizontally');
  check(await pane.getAttribute('data-tab-presentation')==='pinned-horizontal','Pinned horizontal is the absent presentation (per pane)');
  check(await pin().getAttribute('aria-label')==='Unpin tabs'&&await pin().getAttribute('data-pin-target')==='unpinned','The pin only pins or unpins — from the strip it offers unpinning');
  const orient=pane.locator('.pane-tool-orient');
  check(await orient.getAttribute('aria-label')==='Show tabs vertically','The orientation control offers the vertical list from the strip');
  await orient.click();
  check(await pane.getAttribute('data-tab-presentation')==='pinned-vertical','The orientation control pins tabs vertically');
  let strip=await stripBox(), body=await bodyBox(), paneBox=await pane.boundingBox();
  check(strip.height>strip.width*0.9&&strip.x+strip.width<=body.x+1,'The vertical list stands beside the surface body');
  check(await pane.getByRole('tablist').getAttribute('aria-orientation')==='vertical','The list tells assistive technology it is vertical');
  check(await pin().getAttribute('aria-label')==='Unpin tabs'&&await pin().getAttribute('data-pin-target')==='unpinned','The pin control offers unpinning while pinned vertical');
  await pane.locator('.tab[data-active="true"]').focus(); await page.keyboard.press('ArrowUp');
  check(await pane.locator('.tab[data-active="true"]').getAttribute('data-title')!==title(sources[2]),'↑/↓ walk the vertical list as ←/→ walk the strip');
  check(await pane.locator('.tab-list-resizer').getAttribute('role')==='separator','The list carries a width separator on its inner edge');
  const resizer=pane.locator('.tab-list-resizer');
  await resizer.focus(); await page.keyboard.press('End');
  check((await layout()).tabListWidth===320,'The separator writes the list width to the layout, bounds honoured');
  await page.keyboard.press('ArrowLeft');
  check((await layout()).tabListWidth===304,'Arrow keys adjust the persisted list width');
  check(Math.abs((await stripBox()).width-304)<3,'The separator moves the column it names');
  await shot('tabs-list-1280');

  // unpinned: tabs fold to a slim edge, keeping the geometry they were pinned in
  await pin().click();
  check(await pane.getAttribute('data-tab-presentation')==='unpinned','The pin control unpins the tabs');
  check(await pane.getAttribute('data-tab-orientation')==='vertical','Unpinning from the list keeps the vertical geometry for the reveal');
  await pane.locator('.cm-content').click(); await page.mouse.move(640,500);
  await page.waitForTimeout(600);
  await page.waitForFunction(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().width<12);
  const foldedBody=await bodyBox();
  check(foldedBody.x-paneBox.x<12,'Unpinned tabs fold to a slim edge and give the pane their band in flow');
  const zone=await pane.locator('.tab-reveal-zone').boundingBox();
  check(zone.height>=28&&Math.abs(zone.y+zone.height-(paneBox.y+paneBox.height))<4,'The vertical reveal zone covers the bottom of the strip region');
  await page.mouse.move(zone.x+zone.width/2,zone.y+zone.height/2);
  await page.waitForFunction(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().width>120);
  const openedBody=await bodyBox();
  check(openedBody.x>foldedBody.x+100&&openedBody.width<foldedBody.width,'The list opens in flow — the surface gives room, nothing overlays');
  check(await pane.locator('.tab').count()===3,'Unpinned still presents the same tabs');
  await shot('tabs-unpinned-1280');

  // ⌘⌥\ toggles the pin: unpinned pins back into the retained geometry.
  await page.keyboard.press('Meta+Alt+Backslash');
  check(await pane.getAttribute('data-tab-presentation')==='pinned-vertical','⌘⌥\\ pins the tabs back into the retained vertical geometry');
  // The footer actions move between geometries; unpinning from the horizontal
  // strip keeps the horizontal geometry for the reveal.
  await page.locator('.workspace-footer-edge').hover();await page.waitForTimeout(300);
  await page.getByLabel('Tab presentation',{exact:true}).click();
  await page.getByRole('menuitemradio',{name:'Pin tabs horizontally'}).click();
  await page.keyboard.press('Escape');
  check(await pane.getAttribute('data-tab-presentation')==='pinned-horizontal','The footer actions pin horizontally');
  await page.locator('.workspace-footer-edge').hover();await page.waitForTimeout(300);
  await page.getByLabel('Tab presentation',{exact:true}).click();
  await page.getByRole('menuitemradio',{name:'Unpin tabs'}).click();
  await page.keyboard.press('Escape');
  check(await pane.getAttribute('data-tab-presentation')==='unpinned'&&await pane.getAttribute('data-tab-orientation')==='horizontal','Unpinning from the strip keeps the horizontal geometry for the reveal');
  await pane.locator('.cm-content').click(); await page.mouse.move(640,500);
  await page.waitForFunction(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().height<8);
  const hiddenBody=await bodyBox();
  check(hiddenBody.y-paneBox.y<8,'Unpinned tabs give their band to the surface in flow');
  const edge=await pane.locator('.tab-reveal-zone').boundingBox();
  check(edge.width>=paneBox.width-2,'The horizontal reveal zone spans the full top edge');
  check(await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.pane.group.focused > .tab-reveal-zone'),'::after').height)>=28),'The zone is deepest over the pane-tool icons at the right');
  await page.mouse.move(edge.x+edge.width-40,edge.y+10);
  await page.waitForFunction(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().height>=30);
  const after=await bodyBox();
  check(after.y>hiddenBody.y+20&&after.height<hiddenBody.height,'Hovering the edge opens the bar in flow, pushing the surface down');
  await shot('tabs-unpinned-horizontal-1280');
  await pane.locator('.cm-content').click(); await page.mouse.move(640,500);
  await page.waitForFunction(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().height<8);
  await pane.locator('.tab[data-active="true"]').focus();
  await page.waitForFunction(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().height>=30);
  check(await page.evaluate(()=>document.querySelector('.pane.group.focused > .tab-strip').getBoundingClientRect().height>=30),'Focusing into the folded strip reveals it — a keyboard user never loses their place');
  await page.keyboard.press('Meta+1');
  check(await pane.locator('.tab').first().getAttribute('data-active')==='true','The keyboard tab map still works while tabs are unpinned');

  // --- reload: all of it is remembered -----------------------------------------------
  // Tab-pin state belongs to the mode's tree that set it, so the reload is
  // read in Base, where it was set.
  await page.reload(); await channel('info');
  await page.waitForFunction(()=>document.querySelectorAll('.tab').length===3);
  const restored=await layout();
  check(restored.mode===undefined&&await pane.getAttribute('data-tab-presentation')==='unpinned','Mode and tab presentation restore with the workspace');
  check(restored.tabListWidth===304,'The tab list width restores with the workspace');
  check(await page.locator('.desktop-menu.footer-status').getAttribute('data-attention')!=='true','Restoring a workspace with every mode surface open raises no recovery or error');
  const waiting=await page.evaluate(()=>JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')).workspaces[0].modeLayouts);
  const kindIn=(mode,kind)=>Object.values(waiting?.[mode]?.surfaces??{}).some(b=>b.kind===kind);
  check(kindIn('factory','factory')&&kindIn('expressions','expressions')&&kindIn('techne','techne')&&kindIn('settings','system'),'Factory, Expressions, Technè and Settings bindings all restore (a Factory tab used to send the book to recovery)');
  // The restored pane re-pins into the retained (horizontal) geometry — one
  // press, because the pin only ever toggles pinned/unpinned in place.
  await page.keyboard.press('Meta+Alt+Backslash');
  check(await pane.getAttribute('data-tab-presentation')==='pinned-horizontal','The pin restores the retained horizontal pin');
  // The orientation control returns the vertical list, at its persisted width.
  await pane.locator('.pane-tool-orient').click();
  check(await pane.getAttribute('data-tab-presentation')==='pinned-vertical','The orientation control returns the vertical list');
  check(Math.abs((await pane.locator('.tab-strip').boundingBox()).width-304)<3,'The list opens at its persisted width after a reload');

  // --- widths ---------------------------------------------------------------------------
  await page.keyboard.press('Meta+Alt+1'); await page.keyboard.press('Meta+Alt+Backslash');
  for(const width of [1000,760,640]){
    await page.setViewportSize({width,height:820});
    await page.waitForTimeout(260);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`No horizontal page scroll at ${width}px`);
    await shot(`base-${width}`);
  }
}
