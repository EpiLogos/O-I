export { setup } from './editor.mjs';
export default async function run({ page, baseUrl, check, shot, channel, provision:p }) {
  await page.goto(baseUrl); await channel('info');
  const nav = page.getByRole('complementary', {name:'World navigator'});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  await page.locator('.desktop-menu > summary').click();
  await page.getByRole('button',{name:'Rename workspace'}).click();
  await page.locator('.desktop-menu > summary').click();
  await page.getByRole('textbox',{name:'Workspace name'}).fill('Writing desk');
  await page.getByRole('button',{name:'Save name',exact:true}).click();
  const open = async source => { if (!await nav.isVisible()) await page.getByRole('button',{name:'Toggle left region',exact:true}).click(); await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click(); await page.waitForFunction(ref => document.querySelector('.source-textarea')?.getAttribute('data-source-ref')===ref,source.binding.ref); };
  await open(p.sources[0]);
  check(await page.getByLabel('Workspace',{exact:true}).locator('option:checked').innerText()==='Writing desk', 'Canvas arrangement is named for the workspace, independently of the opened project');
  await page.waitForFunction(ref => document.querySelector('[data-region="right"]')?.getAttribute('data-focus-ref') === ref,p.sources[0].binding.ref);
  check(await page.locator('[data-region]').count()===3,'Desktop has three explicit host regions');
  check(await page.locator('[data-region="left"]').getAttribute('data-depth')==='panel','World occupies a real left panel');
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='collapsed','Inspector is absent by default, leaving one sidebar and the canvas');
  check((await page.locator('[data-region="right"]').boundingBox()).width===0,'No second persistent navigation rail occupies the canvas');
  check(await page.getByLabel('Workspace',{exact:true}).evaluate(el=>!!el.closest('.canvas-arrangement')),'One arrangement selector belongs to the canvas command strip');
  await page.getByRole('button',{name:'Toggle right region'}).click();
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='panel','Inspector opens explicitly over the active owner subject');
  check((await channel('read.focus')).data.subject.ref===p.sources[0].binding.ref,'Left selection, canvas and right inspector share one kernel subject');
  await page.locator('.source-textarea').fill('Workspace draft survives restart.\n');
  await open(p.sources[1]);
  await page.keyboard.press('Meta+d');
  await page.waitForFunction(()=>document.querySelectorAll('.pane.group').length===2);
  check(await page.locator('.pane.group').count()===2,'Real sources split into independent canvas panes');
  const split=page.getByRole('separator',{name:'Resize canvas split'});
  await split.focus(); await page.keyboard.press('ArrowRight');
  // The host shell tracks its own box with a ResizeObserver (DesktopShell)
  // to compute left/right region widths; a keypress resolves before that
  // observer's callback (and the resulting re-render) has necessarily
  // landed. Read pane geometry only once two consecutive samples agree, so
  // both the pre-maximize and post-restore readings compare settled paint,
  // not a transient mid-layout frame — the equality check stays exact.
  const stablePaneWidths = async () => {
    let previous = null;
    for (let i = 0; i < 40; i++) {
      const current = await page.locator('.pane.group').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
      await page.waitForTimeout(50);
    }
    return previous;
  };
  const geometry=await stablePaneWidths();
  check(geometry[0]>geometry[1],'Keyboard resizes a canvas split');
  // The workbench bar's split/tile/detach/maximize/more cluster is gone
  // (brief FND-01 A6) — maximize stays on keyboard, the native Window menu,
  // and the pane/tab disclosures.
  await page.keyboard.press('Meta+Alt+Enter');
  check(await page.locator('.pane.group:visible').count()===1,'Maximize presents the active pane alone');
  check(await nav.isVisible(),'Maximized pane retains Central access');
  check(await page.locator('.pane.group').count()===2,'Maximize keeps other source views mounted');
  check((await channel('read.focus')).data.subject.ref===p.sources[1].binding.ref,'Maximize retains canonical semantic focus');
  await page.keyboard.press('Meta+Alt+Enter');
  check(await page.locator('.pane.group:visible').count()===2,'Keyboard restores all panes');
  const restoredGeometry=await stablePaneWidths();
  check(JSON.stringify(geometry)===JSON.stringify(restoredGeometry),'Restore preserves exact prior split widths');
  const left=page.getByRole('separator',{name:'Resize left region'});
  await left.focus(); await page.keyboard.press('ArrowRight');
  check(await left.getAttribute('aria-valuenow')==='256','Keyboard resizes the left region');
  const right=page.getByRole('separator',{name:'Resize right region'});
  await right.focus(); await page.keyboard.press('ArrowLeft');
  check(await right.getAttribute('aria-valuenow')==='336','Keyboard resizes the right region');
  await page.getByRole('button',{name:'Full right region'}).click();
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='full','Right region promotes to full view');
  check((await channel('read.focus')).data.subject.ref===p.sources[1].binding.ref,'Region promotion never changes semantic focus');
  await page.keyboard.press('Escape');
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='panel','Escape restores the right panel');
  const focusBeforeBrowse = (await channel('read.focus')).data;
  await nav.getByRole('button',{name:'Collapse Editor',exact:true}).click();
  check(await nav.locator('[data-navigation-path="Work/Editor"] .project-files').count()===0,'Project disclosure collapses without closing its open sources');
  check(JSON.stringify((await channel('read.focus')).data)===JSON.stringify(focusBeforeBrowse),'Disclosure changes leave semantic focus untouched');
  await page.locator('.desktop-menu > summary').click();
  await page.getByRole('button',{name:'New workspace'}).click();
  await page.locator('.desktop-menu > summary').click();
  await page.getByRole('textbox',{name:'Workspace name'}).fill('Research');
  await page.getByRole('button',{name:'Create workspace',exact:true}).click();
  check(await page.locator('.tab').count()===0,'A freeform workspace has its own surface arrangement');
  await nav.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  await nav.locator('[data-navigation-path="Work/Editor"] .project-files').waitFor();
  check(await nav.getByRole('button',{name:'Collapse Editor',exact:true}).getAttribute('aria-expanded')==='true','A different workspace has independent ProjectRef disclosure state');
  await page.getByRole('button',{name:'Start writing',exact:true}).click();
  await page.locator('.canvas-surface').fill('Research workspace writing.');
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='collapsed','A new workspace also starts with inspection closed');
  await page.getByLabel('Workspace',{exact:true}).selectOption({label:'Writing desk'});
  await page.waitForFunction(()=>document.querySelectorAll('.pane.group').length===2);
  check(await page.locator('.pane.group').count()===2,'Project workspace restores its split constellation');
  await nav.getByRole('button',{name:'Expand Editor',exact:true}).waitFor();
  check(await nav.locator('[data-navigation-path="Work/Editor"] .project-files').count()===0,'Returning to a workspace restores that project disclosure');
  await nav.getByRole('button',{name:'Expand Editor',exact:true}).click();
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='panel','Workspace restores its own region depths');
  check(await page.getByRole('separator',{name:'Resize left region'}).getAttribute('aria-valuenow')==='256','Workspace restores its region width');
  await page.locator('.tab').filter({hasText:p.sources[0].binding.path.split('/').pop()}).click();
  await page.waitForFunction(()=>document.querySelector('.pane.focused .source-textarea')?.value==='Workspace draft survives restart.\n');
  check(true,'Switching workspace preserves unsaved source writing');
  await page.reload(); await channel('info');
  await page.waitForFunction(()=>document.querySelector('.pane.focused .source-textarea')?.value==='Workspace draft survives restart.\n');
  check(true,'Reload restores the unsaved draft through the native source seam');
  check(await page.locator('.pane.group').count()===2,'Reload restores the complete split arrangement');
  await page.getByLabel('Workspace',{exact:true}).selectOption({label:'Research'});
  check(await page.locator('.canvas-surface').inputValue()==='Research workspace writing.','Freeform workspace restores its distinct writing');
  check(await page.locator('[data-region="right"]').getAttribute('data-depth')==='collapsed','Freeform workspace restores its distinct right depth');
  await page.setViewportSize({width:700,height:820});
  check((await page.locator('[data-region="centre"]').boundingBox()).width>=440,'Narrow layout preserves the canvas minimum before side panels');
  check(await nav.isVisible(), 'A collapsed inspector does not evict the Central sidebar on a 700px desktop');
  check((await page.locator('[data-region="left"]').boundingBox()).width >= 200, 'Responsive Central sidebar retains a usable width');
  await page.setViewportSize({width:1280,height:820});
  await page.getByLabel('Workspace',{exact:true}).selectOption({label:'Writing desk'});
  await page.waitForFunction(()=>document.querySelectorAll('.pane.group').length===2);
  await page.setViewportSize({width:1280,height:500});
  const files = nav.locator('[data-navigation-path="Work/Editor"] .project-files');
  // Restoring the workspace re-reads the project's real directory listing
  // (a native round trip); wait for that disclosure to actually mount
  // before hovering it, rather than racing the fetch.
  await files.waitFor();
  const settledProjectListing = async () => {
    for (const source of p.sources) await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-navigation-path="Work/Editor"] .project-files [aria-busy="true"]'));
  };
  // A positive scroll during staged directory loading can be a transient
  // clamp (observed 90 → 78 → 90). Establish the loaded listing before the
  // gesture, then sample settled paint rather than accepting that clamp.
  await settledProjectListing();
  await files.hover(); await page.mouse.wheel(0,90);
  await page.waitForFunction(()=>document.querySelector('[data-navigation-path="Work/Editor"] .project-files')?.scrollTop>0);
  await settledProjectListing();
  const projectScroll = await files.evaluate(async el => {
    let previous = el.scrollTop;
    let stableFrames = 0;
    for (let frame = 0; frame < 60; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const current = el.scrollTop;
      stableFrames = current === previous && !el.querySelector('[aria-busy="true"]') ? stableFrames + 1 : 0;
      if (stableFrames >= 2) return current;
      previous = current;
    }
    throw new Error('Project file-list scroll did not settle after the wheel gesture');
  });
  await nav.locator('[data-project-path="Work/Other"]').click();
  if(await page.getByRole('button',{name:'Other: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Other: files',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-project-path="Work/Other"]')?.getAttribute('aria-current')==='true');
  check(await nav.getByRole('button',{name:'Collapse Editor',exact:true}).getAttribute('aria-expanded')==='true','Expanding another project does not collapse the prior project');
  check(await nav.locator('[data-navigation-path="Work/Editor"] .project-files').isVisible(),'Independent project content stays visible during browsing');
  await nav.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  await files.waitFor();
  // The listing re-reads through the owner in stages (the root, then each
  // expanded folder). While a stage is still landing the box is shorter
  // than the retained position allows and scrollTop is clamped by layout,
  // not moved by intent — the navigator puts the retained position back
  // once the content permits it. Read the retained scroll only once every
  // source row is mounted and no directory is still refreshing: the same
  // settled-paint discipline as stablePaneWidths above.
  const settledProjectScroll = async () => {
    await settledProjectListing();
    await page.waitForFunction(value => document.querySelector('[data-navigation-path="Work/Editor"] .project-files')?.scrollTop === value, projectScroll);
    return files.evaluate(el => el.scrollTop);
  };
  check(await settledProjectScroll()===projectScroll,'Returning to a ProjectRef restores its actual file-list scroll');
  await page.reload(); await channel('info'); await files.waitFor();
  check(await settledProjectScroll()===projectScroll,'Native owner revalidation on reload retains the project file-list scroll');
  await page.setViewportSize({width:1280,height:820});
  await shot('three-region-workspace');
}
