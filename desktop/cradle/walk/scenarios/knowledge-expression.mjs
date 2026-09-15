import {setup} from './knowledge.mjs';
import {execFileSync} from 'node:child_process';
export {setup};
import {renderedBounds} from '../knowledge-projection-geometry.mjs';

export default async function run({page,baseUrl,check,metric,shot,channel,provision:p}){
  const native=(...args)=>JSON.parse(execFileSync(process.env.OI_AIKIT_BIN??'/Users/admin/.cargo/bin/aikit',['--json','-C',p.projectRoot,'knowledge',...args],{encoding:'utf8',env:{...process.env,...p.env}})).data;
  await page.goto(baseUrl);await channel('info');check(JSON.stringify(p.knowledgeStatus).includes('semantic-wiki'),'Isolated owner ground reports the native SemanticWiki provider',p.knowledgeStatus);
  await page.locator('[data-project-path="Work/Editor"]').click();const files=page.getByRole('button',{name:'Editor: files',exact:true});if(await files.getAttribute('aria-pressed')!=='true')await files.click();
  const source=p.sources[0],editor=page.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`);await editor.click();
  const dirty='EX3 keeps this unsaved owner source while knowledge travels.';const cm=page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`);await cm.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type(dirty);
  await page.keyboard.press('Meta+k');const overlay=page.getByRole('dialog',{name:'Search Central'});await overlay.waitFor();await overlay.getByRole('searchbox').fill('editor-walk');
  await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  const expected=native('search','editor-walk').hits;check(expected.length>0,'Installed AIKit returns real owner search hits');
  const labels=await overlay.locator('li strong').allTextContents();check(JSON.stringify(labels.slice(0,expected.length))===JSON.stringify(expected.map(hit=>hit.label)),'Search preserves native owner order and labels');
  const pageIndex=expected.findIndex(hit=>hit.address.kind==='project-map'||hit.address.kind==='source');check(pageIndex>=0,'Native owner search includes an addressable source/page result');await overlay.locator('li').nth(pageIndex).getByRole('button').first().click();await page.getByRole('article',{name:'Selected node content'}).waitFor({timeout:45000});
  const focus=(await channel('read.focus')).data;check(focus.subject.ref===expected[pageIndex].resource,'Search opens the exact native ProjectMap/source ref');
  const express=page.getByRole('button',{name:'Express local whole',exact:true});await express.waitFor();await express.click();
  const status=page.locator('.knowledge-expression-controls [role="status"]').first();await status.waitFor({timeout:45000});const text=await status.innerText();const match=text.match(/(\d+) subjects · (\d+) typed relations · Expression r(\d+)/);check(!!match,'Native local whole projects through the Expression application',text);metric('subjects',Number(match?.[1]));metric('relations',Number(match?.[2]));
  check((await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'Expression is visible in the shared stage');await shot('knowledge-expression-local-whole');
  await page.getByRole('button',{name:'Return to knowledge',exact:true}).click();check(!(await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'Return releases Expression back to the same knowledge page');
  check((await channel('read.state')).data.buffers[source.binding.ref].content===dirty,'Search, page and Expression preserve the unsaved source buffer');
  await page.keyboard.press('Meta+k');await overlay.waitFor();await overlay.getByRole('searchbox').fill(p.wiki.title);await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  const wikiResults=native('search',p.wiki.title).hits,wikiIndex=wikiResults.findIndex(hit=>hit.resource===p.wiki.ref);check(wikiIndex>=0,'Native SemanticWiki search returns the exact fixture WikiSpace');await overlay.locator('li').nth(wikiIndex).getByRole('button').first().click();
  const subject=page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`);await subject.waitFor({timeout:45000});await subject.focus();await page.keyboard.press('Enter');
  const details=page.getByRole('dialog',{name:`Details: ${p.wiki.title}`});await details.waitFor();check(await subject.getAttribute('aria-pressed')==='true','Keyboard activation selects and recentres the exact native graph subject');const provenance=details.locator('.knowledge-provenance').first();await provenance.locator('summary').click();const disclosed=await provenance.locator('dd').allTextContents();check(disclosed.includes(p.wiki.ref)&&disclosed.includes(String(p.wiki.revision)),'Properties disclose the exact native ref and revision',disclosed);const popout=details.getByRole('button',{name:/Pop out/});check(await popout.isDisabled(),'Browser acceptance truthfully discloses native-only popout availability');
  const separation=await page.locator('.knowledge-expression-bar').evaluate(el=>{const a=el.getBoundingClientRect(),b=document.querySelector('.knowledge-detail-dialog').getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;});
  check(separation,'Graph selection controls occupy the free region beside the movable inspector');
  await shot('graph-context-light');
  const pin=page.getByRole('button',{name:'Pin subject',exact:true});await pin.waitFor();await pin.click();check(await page.getByRole('button',{name:'Unpin subject',exact:true}).getAttribute('aria-pressed')==='true','Pin retains the exact native graph subject');
  const follow=page.getByRole('button',{name:'Following locus',exact:true});await follow.click();check(await page.getByRole('button',{name:'Follow locus',exact:true}).getAttribute('aria-pressed')==='false','Follow can freeze the current native locus');await page.getByRole('button',{name:'Follow locus',exact:true}).click();
  const graphExpress=page.getByRole('button',{name:'Express local whole',exact:true});await graphExpress.click();await page.locator('.knowledge-expression-controls [role="status"]').first().waitFor({timeout:45000});check((await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('knowledge-expression:')),'Pinned SemanticWiki whole presents through the same Expression stage');const bounds=await renderedBounds(page,page.locator('.knowledge-expression-host'));check(bounds.count>100&&bounds.minX>bounds.width*.03&&bounds.maxX<bounds.width*.97&&bounds.minY>bounds.height*.03&&bounds.maxY<bounds.height*.97,'The real projected glyph renders completely inside its artboard',bounds);const glyphAspect=(bounds.maxY-bounds.minY)/(bounds.maxX-bounds.minX);check(glyphAspect>.85&&glyphAspect<1.15,'The native Wiki circle retains its whole shape at the desktop particle budget',{glyphAspect});await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.waitForFunction(()=>document.body.dataset.theme==='dark');
  check(await page.locator('.knowledge-expression-host').evaluate(el=>getComputedStyle(el).backgroundColor===getComputedStyle(el.closest('.knowledge-surface')).backgroundColor),'The knowledge Expression artboard inherits the host dark ground');
  check(bounds.darkInkPixels>100&&bounds.maxContrast>=3,'The projected circle has visible dark ink against the light artboard',bounds);
  await page.waitForTimeout(400); // Let the existing camera/theme transition settle before visual evidence.
  const darkInk=await renderedBounds(page,page.locator('.knowledge-expression-host'));
  check(darkInk.lightInkPixels>100&&darkInk.maxContrast>=3,'The projected circle changes to visible light ink against the dark artboard',darkInk);
  metric('dark_glyph_contrast',darkInk.maxContrast);metric('dark_glyph_visible_pixels',darkInk.lightInkPixels);
  await shot('graph-expression-dark');
  await page.getByRole('button',{name:'Return to knowledge',exact:true}).click();
  await page.setViewportSize({width:639,height:900});
  await page.waitForTimeout(400);
  await shot('graph-context-narrow');
  await page.setViewportSize({width:1280,height:820});
  const back=page.getByRole('button',{name:'Back to prior constellation'});check(await back.isEnabled(),'Selecting the graph subject creates a reversible recenter visit');await back.click();const forward=page.getByRole('button',{name:'Forward to next constellation'});check(await forward.isEnabled(),'Back enables forward traversal over the same native graph state');await forward.click();
}
