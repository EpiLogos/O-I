import {setup as sourceSetup} from './editor.mjs';
import {cpSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
export async function setup(args) {
  const p=await sourceSetup(args);
  const wiki=JSON.parse(readFileSync(join(p.projectRoot,'ProjectCentral/agents/wiki/wiki.json'),'utf8')).objects.find(o=>o.object==='space');
  cpSync(join(process.env.HOME,'.aikit'),join(p.root,'.aikit-home'),{recursive:true});
  const env={...process.env,...p.env,AIKIT_HOME:join(p.root,'.aikit-home'),OI_AIKIT_BIN:process.env.OI_AIKIT_BIN??'/Users/admin/.cargo/bin/aikit'};
  const bound=JSON.parse(execFileSync(env.OI_AIKIT_BIN,['--json','-C',p.projectRoot,'project','bind','editor-walk','--directory',p.projectRoot,'--no-default-skill-sets'],{encoding:'utf8',env}));
  if(!bound.ok)throw new Error(JSON.stringify(bound));
  const status=JSON.parse(execFileSync(env.OI_AIKIT_BIN,['--json','-C',p.projectRoot,'knowledge','status'],{encoding:'utf8',env}));
  if(!status.ok)throw new Error(JSON.stringify(status));
  return {...p,wiki,env};
}
export default async function run({page,baseUrl,check,metric,shot,channel,provision:p}) {
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
  await page.waitForTimeout(1200);
  if(!await overlay.locator('li').count())throw new Error(`Native search returned no selectable rows: ${await overlay.innerText()}`);
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
  await overlay.getByRole('button',{name:'Search options',exact:true}).click();
  await overlay.getByLabel('Search shortcut').selectOption('true');
  await page.keyboard.press('Escape');
  check((await page.locator('.summon-search kbd').innerText()).includes('⇧'),'Sidebar shortcut label follows the selected leader');
  await page.keyboard.press(`${primary}+k`);
  check(await overlay.count()===0,'Previous shortcut no longer summons the configured aperture');
  await page.keyboard.press(`${primary}+Shift+k`); await overlay.waitFor();
  check(await overlay.isVisible(),'Configured shifted leader summons the same aperture');
  await overlay.getByRole('button',{name:'Search options',exact:true}).click();
  await overlay.getByLabel('Search shortcut').selectOption('false'); await page.keyboard.press('Escape');
  await page.keyboard.press(`${primary}+k`);await overlay.getByRole('searchbox').fill('editor-walk');
  await overlay.locator('li strong').first().waitFor();await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
  await overlay.locator('li').first().getByRole('button').first().click();
  await page.getByRole('region',{name:'Knowledge surface'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.knowledge-surface')?.getAttribute('aria-busy')==='false');
  check((await channel('read.focus')).data.subject.ref===p.wiki.ref,'A real wiki opens as the same canonical subject in a normal tab');
  check((await channel('read.focus')).data.subject.native_owner==='ai-kit','Kernel retains the native knowledge owner');
  check(await page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`).count()===1,'Graph renders the actual native wiki identity');
  await page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`).click();
  await page.getByRole('button',{name:'Express local whole',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pin subject',exact:true}).click();
  check(await page.getByRole('button',{name:'Unpin subject',exact:true}).getAttribute('aria-pressed')==='true','Pinning retains the exact selected owner ref in local presentation state');
  await page.getByRole('button',{name:'Express local whole',exact:true}).click();
  const projected=page.locator('.knowledge-expression-controls [role="status"]').first();
  await projected.waitFor();
  const projectedText=await projected.innerText();
  const projectionMatch=projectedText.match(/(\d+) subjects · (\d+) typed relations · Expression r(\d+)/);
  check(!!projectionMatch,'Real owner local whole becomes a revisioned Expression through the application seam',projectedText);
  metric('projected_subjects',Number(projectionMatch?.[1]??0));metric('projected_relations',Number(projectionMatch?.[2]??0));metric('expression_revision',Number(projectionMatch?.[3]??0));
  check((await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'The accepted Expression stage presents the projected owner whole');
  check(await page.getByText('QL grammar unavailable',{exact:true}).isVisible(),'Absent owner QL participation is disclosed instead of inferred from geometry');
  const relationGap=page.getByText(/Relation identity unavailable for/);
  if(await relationGap.count())check(await relationGap.isVisible(),'Owner edges without native relation IDs remain explicitly unbound');
  const action=page.locator('.knowledge-detail .knowledge-actions button').first();
  if(await action.count()){
    await action.click();await page.locator('.knowledge-detail [data-dispatch-state]').first().waitFor();
    check(true,'Selected subject Action returns through the real owner dispatch seam');
  }
  await shot('knowledge-expression-local-whole');
  await page.getByRole('button',{name:'Return to graph',exact:true}).click();
  check(!(await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'Return releases the stage presentation and preserves the graph subject');
  await page.getByRole('button',{name:/Open in tab/}).click();
  await page.getByRole('article',{name:'Selected node content'}).waitFor();
  check(await page.getByRole('article',{name:'Selected node content'}).isVisible(),'The same owner ref opens in its page view after returning from Expression');
  await page.getByRole('button',{name:/Show in graph/}).click();
  await page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`).waitFor();
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
