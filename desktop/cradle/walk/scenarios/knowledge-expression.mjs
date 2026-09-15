import {setup} from './knowledge.mjs';
import {execFileSync} from 'node:child_process';
export {setup};

export default async function run({page,baseUrl,check,metric,shot,channel,provision:p}){
  const native=(...args)=>JSON.parse(execFileSync(process.env.OI_AIKIT_BIN??'/Users/admin/.cargo/bin/aikit',['--json','-C',p.projectRoot,'knowledge',...args],{encoding:'utf8',env:{...process.env,...p.env}})).data;
  await page.goto(baseUrl);await channel('info');
  await page.locator('[data-project-path="Work/Editor"]').click();const files=page.getByRole('button',{name:'Editor: files',exact:true});if(await files.getAttribute('aria-pressed')!=='true')await files.click();
  const source=p.sources[0],editor=page.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`);await editor.click();
  const dirty='EX3 keeps this unsaved owner source while knowledge travels.';const cm=page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`);await cm.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type(dirty);
  await page.keyboard.press('Meta+k');const overlay=page.getByRole('dialog',{name:'Search Central'});await overlay.waitFor();await overlay.getByRole('searchbox').fill('editor-walk');
  await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  const expected=native('search','editor-walk').hits;check(expected.length>0,'Installed AIKit returns real owner search hits');
  const labels=await overlay.locator('li strong').allTextContents();check(JSON.stringify(labels.slice(0,expected.length))===JSON.stringify(expected.map(hit=>hit.label)),'Search preserves native owner order and labels');
  await overlay.locator('li').first().getByRole('button').first().click();await page.getByRole('article',{name:'Selected node content'}).waitFor({timeout:45000});
  const focus=(await channel('read.focus')).data;check(focus.subject.ref===expected[0].resource,'Search opens the exact native ProjectMap/source ref');
  const express=page.getByRole('button',{name:'Express local whole',exact:true});await express.waitFor();await express.click();
  const status=page.locator('.knowledge-expression-controls [role="status"]').first();await status.waitFor({timeout:45000});const text=await status.innerText();const match=text.match(/(\d+) subjects · (\d+) typed relations · Expression r(\d+)/);check(!!match,'Native local whole projects through the Expression application',text);metric('subjects',Number(match?.[1]));metric('relations',Number(match?.[2]));
  check((await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'Expression is visible in the shared stage');await shot('knowledge-expression-local-whole');
  await page.getByRole('button',{name:'Return to knowledge',exact:true}).click();check(!(await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'Return releases Expression back to the same knowledge page');
  check((await channel('read.state')).data.buffers[source.binding.ref].content===dirty,'Search, page and Expression preserve the unsaved source buffer');
}
