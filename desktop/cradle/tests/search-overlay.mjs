/** Controlled browser contracts for the production component/client/bridge.
 * Never label these fixtures as native AIKit, installed-suite or human proof. */
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium, webkit} from 'playwright';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'tests/artifacts/search');
mkdirSync(out, {recursive:true});
const cases = JSON.parse(readFileSync(resolve(root,'tests/search-queries.json'),'utf8'));
const receipt = {grade:'D', scope:'production search component + client + HTTP bridge; controlled responses, not native owner/installed/human evidence', checks:[], browsers:[], passed:false};
const check = (value, name) => { assert.ok(value,name); receipt.checks.push(name); };
const server = await createServer({root, configFile:false, plugins:[react()], resolve:{alias:{three:resolve(root,'node_modules/three')}}, define:{__CRADLE_WALK__:'false'}, server:{host:'127.0.0.1',port:1437,strictPort:true,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});
await server.listen();
try {
  for (const [name, engine] of Object.entries({chromium,webkit})) {
    const browser = await engine.launch({headless:true});
    receipt.browsers.push({name,version:browser.version()});
    const page = await browser.newPage({viewport:{width:1280,height:820}});
    page.setDefaultTimeout(10000);
    const calls = [];
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('**/__search_fixture/**', async route => {
      if (route.request().method() !== 'POST') return route.fulfill({json:{ok:true,receipts:[]}});
      const op = route.request().postDataJSON();
      if (op.op !== 'knowledge') return route.fulfill({json:{ok:true,outcome:{result:'state',snapshot:{focus:{},surfaces:{},buffers:{}},receipts:[]}}});
      calls.push(op);
      const {action,query} = op.request;
      if(query==='progressive' && action==='resolve') await new Promise(resolve=>setTimeout(resolve,1500));
      if(query==='slow') await new Promise(resolve=>setTimeout(resolve,1200));
      if(query==='refused') return route.fulfill({json:{ok:false,error:'resolve.unclosed_quote: quoted Resolve subject is not closed'}});
      const length = query==='many' ? 50 : query==='empty' ? 0 : 2;
      const hits = Array.from({length},(_,i)=>({resource:`wiki/fixture-${i}`,label:`Result ${i} · ${query}`,kind:'wiki',snippet:'Controlled source material',address:{kind:'wiki',value:`wiki/fixture-${i}`}}));
      const rows = query==='empty' ? [] : [{reference:'wiki/owner-row',kind:'wiki-object',label:'Owner resource',owner:'ai-kit',provenance:['Controlled native-shaped row'],actions:[]}];
      const data = action==='search' ? {hits,absences:query==='absent'?['Source provider unavailable']:[]} : action==='resolve' ? {rows,absences:[]} : {ownerEvidence:action};
      return route.fulfill({json:{ok:true,outcome:{result:'knowledge',data,receipts:[]}}});
    });
    const overlay = page.getByRole('dialog',{name:'Search Central'});
    const input = overlay.getByRole('searchbox',{name:'Search or resolve'});
    const settled = () => page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
    const open = async () => {await page.keyboard.press('Control+k');await overlay.waitFor();await settled();};
    const fill = async query => {await input.fill(query);await settled();};
    try {
      for (const project of [undefined,'Work/My Project']) {
        await page.goto(`http://127.0.0.1:1437/tests/search-fixture.html${project?'?project='+encodeURIComponent(project):''}`);
        await page.getByRole('textbox',{name:'Writing before search'}).focus();
        await open();
        check(!(await page.getByLabel('Search shortcut').isVisible()),`${name}: options start discreet`);
        for (const item of cases) {
          const from = calls.length;
          await fill(item.query);
          const actual = calls.slice(from).filter(op=>['search','resolve'].includes(op.request.action));
          assert.deepEqual(actual.map(op=>op.request.action).sort(),['resolve','search'],`${name}: ${item.name} both operations`);
          check(actual.every(op=>op.request.query===item.query && op.project===project),`${name}: ${project??'root'}: literal ${item.name}`);
          assert.deepEqual(await overlay.locator('li strong').allTextContents(),[0,1].map(i=>`Result ${i} · ${item.query}`));
        }
        check(calls.every(op=>['search','resolve'].includes(op.request.action)),`${name}: typing invokes no Action/history/use`);
        await page.keyboard.press('Escape');
        await overlay.waitFor({state:'detached'});
      }
      const writing = page.getByRole('textbox',{name:'Writing before search'});
      await writing.evaluate(el=>{el.focus();el.setSelectionRange(4,14,'forward');});
      await open();
      await fill('@# (@0 "authored meaning")');
      // Result readiness no longer carries a fixed 180 ms delay. Wait for the
      // panel's own animation, not an arbitrary network/debounce delay, before
      // asserting its resting material. The compositor assertion stays intact.
      await overlay.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({path:resolve(out,`${name}-glass.png`)});
      const material = await overlay.evaluate(el=>{const css=getComputedStyle(el);return {filter:css.backdropFilter||css.webkitBackdropFilter,background:css.backgroundColor,opacity:css.opacity,backdrop:getComputedStyle(el,'::backdrop').backdropFilter};});
      check(material.filter.includes('28px') && material.background.startsWith('rgba(') && material.opacity==='1' && (!material.backdrop || material.backdrop==='none'),`${name}: blur belongs to the translucent panel, not the workspace or text`);
      await overlay.getByRole('button',{name:'Search options',exact:true}).click();
      await page.getByLabel('Search shortcut').selectOption('true');
      check(await page.getByLabel('Search shortcut').inputValue()==='true',`${name}: shortcut remains editable under Options`);
      check((await overlay.locator('.search-syntax').innerText()).includes('@# - + x / ='),`${name}: help preserves native ASCII operators`);
      await page.screenshot({path:resolve(out,`${name}-options.png`)});
      await overlay.getByRole('button',{name:'Search options',exact:true}).click();
      await page.keyboard.press('Escape');
      await overlay.waitFor({state:'detached'});
      check(await writing.evaluate(el=>document.activeElement===el && el.selectionStart===4 && el.selectionEnd===14),`${name}: Escape restores exact writing focus/selection`);
      await open();
      await fill('keyboard');
      await input.press('ArrowDown');
      check(await input.getAttribute('aria-activedescendant')==='knowledge-search-1',`${name}: arrows select the native-order row`);
      await input.press('Enter');
      await overlay.waitFor({state:'detached'});
      const opened = await page.evaluate(()=>window.__SEARCH_TEST__.opened);
      check(opened.length===1 && opened[0].address.value==='wiki/fixture-1' && opened[0].project==='Work/My Project',`${name}: Enter opens once with the original ref and project`);
      await open();
      await input.fill('progressive');
      await overlay.getByText('Result 0 · progressive', {exact:true}).waitFor();
      check(await overlay.locator('ul').getAttribute('aria-busy')==='true', `${name}: fast results arrive before supplementary resolution`);
      check(await overlay.locator('#knowledge-search-0').isEnabled(), `${name}: arrived result stays actionable while another provider is loading`);
      await input.press('Enter');
      await overlay.waitFor({state:'detached'});
      check((await page.evaluate(()=>window.__SEARCH_TEST__.opened)).length===2, `${name}: Enter can open the first response without the slow provider`);
      await open();
      await input.fill('slow');
      await page.waitForTimeout(240);
      await fill('fast');
      await page.waitForTimeout(1300);
      check((await overlay.locator('li strong').first().innerText())==='Result 0 · fast',`${name}: late owner response cannot replace a newer query`);
      await input.dispatchEvent('compositionstart');
      const beforeIME = calls.length;
      await input.fill('語');
      await page.waitForTimeout(250);
      await input.dispatchEvent('keydown',{key:'Enter',isComposing:true,bubbles:true});
      await page.keyboard.press('Escape');
      check(calls.length===beforeIME && await overlay.isVisible(),`${name}: IME intermediate input neither queries nor opens/dismisses`);
      check(await input.inputValue()==='語',`${name}: composition Escape preserves the input instead of native search clearing it`);
      await input.dispatchEvent('compositionend',{data:'語'});
      await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false' && document.querySelector('.search-aperture li strong')?.textContent==='Result 0 · 語');
      check(calls.slice(beforeIME).filter(op=>op.request.query==='語').length===2,`${name}: committed IME text reaches both operations`);
      await fill('refused');
      check((await overlay.getByRole('alert').innerText())==='resolve.unclosed_quote: quoted Resolve subject is not closed',`${name}: owner refusal remains verbatim`);
      await fill('absent');
      await overlay.getByText('Unavailable sources (1)',{exact:true}).click();
      check(await overlay.getByText('Source provider unavailable',{exact:true}).isVisible(),`${name}: unavailable provider remains inspectable`);
      await fill('empty');
      check(await overlay.getByText('No results in the available native sources.',{exact:true}).isVisible(),`${name}: real empty response is distinguished`);
      await overlay.getByRole('button',{name:'History',exact:true}).click();
      await overlay.locator('.search-evidence pre').waitFor();
      check((await overlay.locator('.search-evidence pre').innerText()).includes('history'),`${name}: History is an explicit owner read`);
      await fill('many');
      await page.setViewportSize({width:420,height:420});
      check(await input.getAttribute('aria-activedescendant')==='knowledge-search-0',`${name}: resizing does not invent a selection`);
      await input.press('ArrowUp');
      check(await input.getAttribute('aria-activedescendant')==='knowledge-search-50',`${name}: keyboard reaches resolution rows after all native search rows`);
      const bounds = await overlay.evaluate(el=>{const b=el.getBoundingClientRect();const s=el.querySelector('.search-scroll');return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,scroll:s.scrollHeight>s.clientHeight};});
      check(bounds.x>=0 && bounds.y>=0 && bounds.right<=420 && bounds.bottom<=420 && bounds.scroll,`${name}: long results scroll inside a bounded narrow panel`);
      await page.screenshot({path:resolve(out,`${name}-narrow.png`)});
      await page.emulateMedia({reducedMotion:'reduce'});
      check(await overlay.evaluate(el=>getComputedStyle(el).animationName)==='none',`${name}: reduced motion removes entry animation`);
      if(name==='chromium') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
        check(await overlay.evaluate(el=>getComputedStyle(el).backdropFilter)==='none',`${name}: reduced transparency uses opaque material`);
        await cdp.send('Emulation.setEmulatedMedia',{features:[]});
        await cdp.detach();
        await page.emulateMedia({forcedColors:'active'});
        check(await overlay.evaluate(el=>getComputedStyle(el).backdropFilter)==='none',`${name}: forced-colour material has no blur`);
        await page.screenshot({path:resolve(out,`${name}-forced-colors.png`)});
      }
      check(errors.length===0,`${name}: no uncaught browser errors (${errors.join('; ')})`);
    } catch(error) {
      console.error(error);
      receipt.failure={browser:name,error:String(error),lastCalls:calls.slice(-6),browserErrors:errors,input:await input.inputValue().catch(()=>null),active:await input.getAttribute('aria-activedescendant').catch(()=>null),status:await overlay.locator('.search-context').innerText().catch(()=>null)};
      console.error(JSON.stringify(receipt.failure));
      await page.screenshot({path:resolve(out,`${name}-failure.png`)}).catch(()=>{});
      throw error;
    } finally { await browser.close(); }
  }
  receipt.passed=true;
  console.log(JSON.stringify({passed:true,checks:receipt.checks.length,browsers:receipt.browsers,grade:'D'}));
} finally {
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await server.close();
}
