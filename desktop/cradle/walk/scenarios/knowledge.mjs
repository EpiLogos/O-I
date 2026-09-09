import {setup as sourceSetup} from './editor.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
export async function setup(args) {
  const p=await sourceSetup(args);
  const wiki=JSON.parse(readFileSync(join(p.projectRoot,'ProjectCentral/agents/wiki/wiki.json'),'utf8')).objects.find(o=>o.object==='space');
  return {...p,wiki,env:{...p.env,AIKIT_HOME:join(p.root,'.aikit-home')}};
}
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const native=(...args)=>{
    const envelope=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN??'aikit',['--json','-C',p.projectRoot,'knowledge',...args],{encoding:'utf8',env:{...process.env,...p.env}}));
    if(!envelope.ok)throw new Error(JSON.stringify(envelope));return envelope.data;
  };
  await page.goto(baseUrl);await channel('info');
  const macOS=await page.evaluate(()=>/Mac|iPhone|iPad/.test(navigator.platform));
  const primary=macOS?'Meta':'Control';
  await page.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  await page.locator(`[data-file-path="Work/Editor/${p.sources[0].binding.path}"]`).click();
  // The editor is CodeMirror (src/editor/TextEditor.tsx); its contenteditable
  // carries the binding ref through EditorView.contentAttributes. Fill is not
  // available on a contenteditable, so the caret is placed and the text typed
  // exactly as a person would.
  const editorText='A real dirty source stays untouched while navigating knowledge.';
  const editor=page.locator(`.cm-content[data-source-ref="${p.sources[0].binding.ref}"]`);
  await editor.waitFor();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(editorText);
  await page.waitForFunction(text=>document.querySelector('.cm-content')?.textContent===text,editorText);
  const beforeFocus=(await channel('read.focus')).data;
  const historyBefore=native('history').length;
  await page.keyboard.press(`${primary}+k`);
  const overlay=page.getByRole('dialog',{name:'Search Central'});
  await overlay.waitFor();
  check(await overlay.isVisible(),'Leader summons one window-wide native search aperture');
  await overlay.getByRole('searchbox',{name:'Search or resolve'}).fill('editor-walk');
  await overlay.locator('li').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
  const expected=native('search','editor-walk').hits;
  check(JSON.stringify(await overlay.locator('li strong').allTextContents())===JSON.stringify(expected.map(h=>h.label)),'Search rows preserve real AIKit order and labels');
  check(native('history').length===historyBefore,'Displaying search results does not record successful use');
  check(JSON.stringify((await channel('read.focus')).data)===JSON.stringify(beforeFocus),'Querying does not move kernel semantic focus');
  await page.keyboard.press('Escape');
  await overlay.waitFor({state:'detached'});
  await page.waitForFunction(()=>!!document.activeElement?.closest('.cm-editor'));
  check(await overlay.count()===0,'Escape dismisses the entire aperture');
  check(await editor.evaluate(el=>el===document.activeElement),'Escape restores the exact original editor caret');
  if (macOS) {
    await page.keyboard.press('Control+k');
    check(await overlay.count()===0,'macOS Control-K remains ordinary editor input rather than summoning search');
  }
  await page.keyboard.press(`${primary}+k`);
  await overlay.getByLabel('Search shortcut').selectOption('true');
  await page.keyboard.press('Escape');
  check((await page.locator('.summon-search kbd').innerText()).includes('⇧'),'Sidebar shortcut label follows the selected leader');
  await page.keyboard.press(`${primary}+k`);
  check(await overlay.count()===0,'Previous shortcut no longer summons the configured aperture');
  await page.keyboard.press(`${primary}+Shift+k`); await overlay.waitFor();
  check(await overlay.isVisible(),'Configured shifted leader summons the same aperture');
  await overlay.getByLabel('Search shortcut').selectOption('false'); await page.keyboard.press('Escape');
  await page.keyboard.press(`${primary}+k`);await overlay.getByRole('searchbox').fill('editor-walk');
  await overlay.locator('li strong').first().waitFor();await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
  await overlay.locator('li').first().getByRole('button').first().click();
  await page.getByRole('region',{name:'Knowledge surface'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.knowledge-surface')?.getAttribute('aria-busy')==='false');
  check((await channel('read.focus')).data.subject.ref===p.wiki.ref,'A real wiki opens as the same canonical subject in a normal tab');
  check((await channel('read.focus')).data.subject.native_owner==='ai-kit','Kernel retains the native knowledge owner');
  check(await page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`).count()===1,'Graph renders the actual native wiki identity');
  check(native('history').length===historyBefore+1,'Successful opening records exactly one AIKit route use');
  const state=(await channel('read.state')).data;
  check(state.buffers[p.sources[0].binding.ref].content===editorText,'Wiki navigation preserves the dirty source buffer');
  await page.getByRole('button',{name:'Refresh knowledge',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.knowledge-surface')?.getAttribute('aria-busy')==='false');
  check(native('history').length===historyBefore+1,'Refresh is not a second successful-use observation');
  await page.keyboard.press('Meta+d');
  check(await page.locator('.pane.group').count()===2,'Wiki and real source share the production pane tree');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const graph=page.locator('.knowledge-canvas');
  await graph.focus();await page.keyboard.press('ArrowRight');
  const readCamera=()=>page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('oi-cradle.knowledge-view.v1:'));return key?JSON.parse(localStorage.getItem(key)):null;});
  await page.waitForFunction(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('oi-cradle.knowledge-view.v1:'));const c=key&&JSON.parse(localStorage.getItem(key));return !!c&&Math.abs(c.zoom-1.2)<1e-6&&c.x===-40;});
  const camera=await readCamera();
  check(!!camera&&Math.abs(camera.zoom-1.2)<1e-6&&camera.x===-40&&camera.y===0,'Graph zoom and keyboard pan update surface view state');
  check((await page.locator('[aria-label="Graph zoom"]').innerText()).trim()==='120%','The zoom readout commits the same camera the surface holds');
  check(await graph.evaluate(el=>{const r=el.getBoundingClientRect();const ratio=Math.min(2,devicePixelRatio||1);return r.width>0&&el.width===Math.max(1,Math.round(r.width*ratio))&&el.height===Math.max(1,Math.round(r.height*ratio));}),'Graph geometry retains readable pixel scale in a split pane');
  await shot('native-wiki-and-source');
  await page.reload();await channel('info');await page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`).waitFor();
  check(await page.locator('.pane.group').count()===2,'Relaunch revalidates the saved wiki and preserves its split');
  check((await page.locator('[aria-label="Graph zoom"]').innerText()).trim()==='120%','Relaunch restores the surface camera without changing the owner graph');
  check(native('history').length===historyBefore+1,'Restoring presentation never trains familiarity');
  await page.locator('[data-project-path="Work/Other"]').click();
  if(await page.getByRole('button',{name:'Other: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Other: files',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-project-path="Work/Other"]')?.getAttribute('aria-current')==='true');
  check(await page.getByRole('region',{name:'Knowledge surface'}).isVisible(),'Browsing another project leaves the current wiki open');
  await page.locator('.tab').filter({hasText:p.sources[0].binding.path.split('/').pop()}).click();
  await page.waitForFunction(()=>document.querySelector('[data-project-path="Work/Editor"]')?.getAttribute('aria-current')==='true');
  check(true,'Focusing a cross-project source reveals its native project');
  await page.locator('[data-project-path="Work/Other"]').click();
  if(await page.getByRole('button',{name:'Other: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Other: files',exact:true}).click();
  await page.locator('.tab').filter({hasText:p.wiki.title}).click();
  await page.waitForFunction(()=>document.querySelector('[data-project-path="Work/Editor"]')?.getAttribute('aria-current')==='true');
  check(true,'Focusing a cross-project wiki reveals its owning project');

}
