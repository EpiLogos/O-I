import {docText} from '../editor-doc.mjs';
/** Per-mode workspaces (src/workspace/store.ts, book v2). Base keeps the
 * pane/tab workbench; every other mode DEDICATES its view — its centre
 * surface full screen inside `.mode-stage`, no tab strip, no pane chrome —
 * while the base tree waits unmounted in the store and remounts exactly on
 * return. Settings is its own mode whose centre is the System panel;
 * Epi-Logos is no mode entry at all but the footer's whole-app world state
 * (the workspace world context, `context.world`); unsaved writing rides through; a v1 book upgrades
 * cleanly; idle after a switch schedules no frames. Runs over real
 * owner-backed sources. */
export { setup } from './editor.mjs';
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl); await channel('info');
  const nav=()=>page.getByRole('complementary',{name:'World navigator'});
  await nav().locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  const sources=p.sources.slice(0,2);
  // The focused pane keeps its other tabs' editors mounted-concealed and the
  // other modes' trees wait mounted-hidden (the retention law): the presented
  // editor is the one in the presented tree's unconcealed slot, and only what
  // is PRESENTED counts as chrome or as an editor on screen.
  const EDITOR='.warm-tree-host:not([hidden]) .pane.focused .surface-retained:not([hidden]) .cm-content';
  const presented=selector=>page.locator(selector).evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length>0).length);
  const open=async s=>{await nav().locator(`[data-file-path="Work/Editor/${s.binding.path}"]`).click();await page.waitForFunction(([ref,sel])=>document.querySelector(sel)?.dataset.sourceRef===ref,[s.binding.ref,EDITOR]);};
  for(const s of sources) await open(s);
  await page.locator(EDITOR).fill('Held across modes.\n');
  // The book's writes coalesce (one trailing write 250 ms after a burst,
  // workspace/store.ts): read it once the write has landed.
  const book=async()=>{await page.waitForTimeout(400);return page.evaluate(()=>JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')));};
  const group=page.getByRole('radiogroup',{name:'Workspace mode',exact:true});
  const radio=name=>group.getByRole('radio',{name,exact:true});
  const stage=mode=>page.locator(`.mode-stage[data-mode="${mode}"]`);
  const footerTool=async selector=>{await page.locator('.workspace-footer-edge').hover();await page.waitForTimeout(300);return page.locator(selector);};

  check(await group.getByRole('radio').count()===4,'The strip carries the four work-mode radios only — Base, Factory, Expressions, Technè');
  check(await radio('Epi-Logos').count()===0&&await radio('Settings').count()===0&&await page.getByRole('menuitemradio',{name:'Epi-Logos',includeHidden:true}).count()===0&&await page.getByRole('radio',{name:/web/i}).count()===0,'Epi-Logos, Settings and O:I Web are no strip entries; Epi-Logos is in no mode menu either');

  // --- Factory: the view is dedicated; the base tree waits ---------------------
  await radio('Factory').click(); await stage('factory').waitFor();
  await stage('factory').locator('main.factory-centre').waitFor();
  check(await presented('.tab')===0&&await presented('.tab-strip')===0,'Factory dedicates the view: its surface stands in the stage with no tab strip and none of Base\'s tabs');
  check(await presented('.cm-content')===0&&await page.locator('.warm-tree-host[hidden] .cm-content').count()===2,'Base\'s editors are concealed while Factory is active — the base tree waits, retained, never presented');
  let b=await book();
  check(b.version===2,'The workspace book is written as version 2');
  check(b.workspaces[0].layout.mode==='factory'&&Object.values(b.workspaces[0].modeLayouts.base.surfaces).length===2,'Base\'s tree waits in the store, intact, while Factory is active');
  // Regression (owner report 2026-09-17): a Factory section jump called
  // scrollIntoView, which scrolled the SHELL — the app slid up, the footer row
  // jammed into view and the surface head was covered. The Desk is now
  // Factory's stage body (11-FACTORY §2) and its own scroll owner; this
  // ground's Desk is too small to overflow, so the scroll-ownership half lives
  // in factory-desk (a real board below the fold). Here, at a short window,
  // the same gestures must leave the shell and every structural box unmoved
  // and the head hittable.
  await page.setViewportSize({width:1280,height:300});
  const desk=stage('factory').locator('.fdesk');
  await desk.waitFor();
  await desk.hover(); await page.mouse.wheel(0,600); await page.waitForTimeout(150);
  await desk.evaluate(node=>node.lastElementChild?.scrollIntoView({block:'end'})); await page.waitForTimeout(150);
  const held=await page.evaluate(()=>({scrolled:[document.scrollingElement,document.body,document.getElementById('root'),...document.querySelectorAll('.desktop-shell,.desktop-regions,.desktop-centre')].filter(n=>n&&(n.scrollTop!==0||n.scrollLeft!==0)).map(n=>n.className||n.tagName),shell:document.querySelector('.desktop-shell').getBoundingClientRect().top}));
  check(held.scrolled.length===0&&held.shell===0,'Scrolling the Factory stage — wheel or an in-surface jump — never moves the shell or a structural box',held);
  check(await page.evaluate(()=>{const head=document.querySelector('.mode-stage[data-mode="factory"] .fdesk-head');const box=head.getBoundingClientRect();const hit=document.elementFromPoint(box.left+40,box.top+2);return box.height>=20&&!!hit&&head.contains(hit);}),'The Factory head stands visible and hittable from its top edge — nothing clips it');
  await shot('factory-own-tree');
  await page.setViewportSize({width:1280,height:820});

  // --- Epi-Logos: the whole-app world state, toggled in the footer -------------
  (await footerTool('.footer-epi')).click();
  await page.locator('.footer-epi[aria-pressed="true"]').waitFor();
  check((await book()).workspaces[0].context?.world==='epi-logos','Entering the Epi-Logos lens is the footer toggle: the workspace\'s world context (context.world), aria-pressed');
  check((await book()).workspaces[0].layout.mode==='factory','The world toggle moves nobody off their mode');
  await page.reload(); await channel('info'); await stage('factory').waitFor();
  check(await page.locator('.footer-epi').getAttribute('aria-pressed')==='true','The world state restores with the workspace');
  (await footerTool('.footer-epi')).click();
  await page.locator('.footer-epi[aria-pressed="false"]').waitFor();
  check((await book()).workspaces[0].context?.world!=='epi-logos','Leaving the lens is the same one act');

  // --- Settings: its own mode; the System panel composes in its stage ----------
  const settingsButton=page.locator('.world-system-settings');
  const t0=Date.now();
  await settingsButton.click();
  await stage('settings').waitFor();
  const entered=Date.now()-t0;
  check(entered<2000,'The terminal Settings button enters its mode instantly — no awaited owner call gates the switch',{entered_ms:entered});
  check(await settingsButton.getAttribute('aria-pressed')==='true'&&await settingsButton.getAttribute('aria-label')==='Settings','The terminal button marks itself active (aria-pressed) while Settings stands');
  await stage('settings').locator('[data-settings-page]').waitFor();
  check(await stage('settings').locator('[data-settings-page]').count()===1&&await presented('.tab')===0,'Settings dedicates the view: the System panel inside its stage, no tab chrome');
  check((await book()).workspaces[0].layout.mode==='settings','Settings is recorded as the workspace mode, its own tree in the book');

  // --- back to Base: tree and writing restored --------------------------------
  await radio('Base').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.tab')].filter(node=>node.getClientRects().length>0).length===2);
  await page.locator(EDITOR).waitFor();
  check(await docText(page,EDITOR)==='Held across modes.\n','Unsaved writing is restored when its mode returns');

  // --- idle after a switch: no scheduled frames, one canvas at most ------------
  await page.waitForTimeout(900);
  const frames=await page.evaluate(()=>new Promise(resolve=>{const real=window.requestAnimationFrame;let calls=0;window.requestAnimationFrame=cb=>{calls++;return real(cb);};setTimeout(()=>{window.requestAnimationFrame=real;resolve(calls);},1200);}));
  check(frames===0,'Idle after mode switches: zero scheduled animation frames',{frames});
  check(await page.locator('canvas').count()<=1,'At most the window\'s one field');

  // --- reload: the active mode and every tree restore ---------------------------
  await radio('Factory').click(); await stage('factory').waitFor();
  await page.reload(); await channel('info'); await stage('factory').waitFor();
  b=await book();
  check(b.workspaces[0].layout.mode==='factory'&&!!b.workspaces[0].modeLayouts.base&&!!b.workspaces[0].modeLayouts.settings,'The active mode and every visited mode\'s tree restore after a reload');
  check(await page.locator('.desktop-menu.footer-status').getAttribute('data-attention')!=='true','The restore raises no recovery or error');

  // --- a v1 book upgrades cleanly ------------------------------------------------
  await page.evaluate(()=>{const b=JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1'));const w=b.workspaces[0];const base=w.modeLayouts.base;localStorage.setItem('oi-cradle.workspaces.v1',JSON.stringify({version:1,active:b.active,workspaces:[{id:w.id,name:w.name,writing:'',project:w.project,projectNavigation:w.projectNavigation,layout:base}]}));});
  await page.reload(); await channel('info');
  await page.waitForFunction(()=>[...document.querySelectorAll('.tab')].filter(node=>node.getClientRects().length>0).length===2);
  check(await page.locator('.desktop-menu.footer-status').getAttribute('data-attention')!=='true','A version-1 book (one tree) opens without recovery');
  check(await radio('Base').getAttribute('aria-checked')==='true','Its single tree becomes the tree of the mode it recorded');
  await radio('Factory').click(); await stage('factory').waitFor();
  check((await book()).version===2,'and is written back as version 2 on the first change');
}
