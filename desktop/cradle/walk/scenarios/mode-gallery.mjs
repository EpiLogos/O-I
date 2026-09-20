/** A looking aid, not an acceptance: every mode, the Library, Agency and the
 * Factory desk, in light and dark, so the joined UI can actually be seen. Its
 * only checks are the standing laws that must hold in every frame. */
export { setup } from './editor.mjs';
export default async function run({page,baseUrl,check,shot,channel}) {
  const laws=async label=>{
    check(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight&&document.documentElement.scrollWidth<=window.innerWidth),`${label}: the document does not scroll`);
    check(await page.locator('canvas').count()<=1,`${label}: at most one canvas`);
  };
  for(const scheme of ['light','dark']){
    await page.emulateMedia({colorScheme:scheme});
    await page.goto(baseUrl); await channel('info');
    await page.evaluate(s=>{try{const k='oi-cradle.visuals.v1';const v=JSON.parse(localStorage.getItem(k)??'{}');localStorage.setItem(k,JSON.stringify({...v,theme:s,revision:(v.revision??0)+1}));}catch{}},scheme);
    await page.reload(); await channel('info');
    const nav=page.getByRole('complementary',{name:'World navigator'});
    await nav.locator('[data-project-path="Work/Editor"]').click().catch(()=>{});
    for(const [key,name] of [['2','factory'],['3','expressions'],['4','techne'],['5','epi-logos']]){
      await page.keyboard.press(`Meta+Alt+${key}`); await page.waitForTimeout(900);
      await shot(`${name}-${scheme}`); await laws(`${name} ${scheme}`);
      if(name==='expressions'){
        // Regression for the dark-theme defect: the idle window field (no
        // Expression open) must paint the artboard ground from the current
        // theme, not the recipe's own fixed light material. The engine
        // paints its scene's backgroundColor as the canvas element's own
        // CSS background (engineSurface.ts `canvas.style.backgroundColor`);
        // the WebGL drawing buffer itself is not preserved, so read that
        // style rather than sampling rendered pixels.
        const canvas=page.locator('.xp-artboard canvas');
        if(await canvas.count()){
          const rgb=await canvas.first().evaluate(el=>getComputedStyle(el).backgroundColor);
          const [r,g,b]=(rgb.match(/[\d.]+/g)??[]).map(Number);
          const luminance=r*0.299+g*0.587+b*0.114;
          check(scheme==='dark'?luminance<128:luminance>=128,
            `expressions ${scheme}: the idle window field's artboard ground follows the app theme (canvas background ${rgb}, luminance ${luminance.toFixed(1)})`);
        }
        // The panel's own looking pass (owner second pass 2026-09-19): the
        // chat face, ONE icon turned to the Run/Agents/Context side, and
        // back — captured so the panel design stays visible in the gallery.
        await shot(`expressions-panel-chat-${scheme}`);
        const planeRow=page.getByRole('navigation',{name:'Right region planes'});
        await planeRow.getByRole('button',{name:'Agents',exact:true}).click();
        await page.waitForTimeout(300);
        await shot(`expressions-panel-side-${scheme}`);
        await planeRow.getByRole('button',{name:'Context',exact:true}).click();
        await page.waitForTimeout(300);
        await shot(`expressions-panel-context-${scheme}`);
        // The pane host is the real pane: its own New-tab affordance opens a
        // surface INTO the sidebar.
        await page.getByRole('region',{name:'Accompanying agent'}).getByRole('button',{name:'New tab',exact:true}).click();
        await page.waitForTimeout(400);
        await shot(`expressions-panel-context-newtab-${scheme}`);
        await page.getByRole('button',{name:'Close tab',exact:true}).click().catch(()=>{});
        await page.waitForTimeout(200);
        await planeRow.getByRole('button',{name:'Chat',exact:true}).click();
        await page.waitForTimeout(200);
        // A looking pass on the Expressions surface's own chrome: each
        // field-local menu open, the Studio dock populated with a real
        // Expression and entity, and the pane's own responsive collapse —
        // in both colour schemes, since this whole block sits inside the
        // light/dark loop. Skipped where the centre's material host refuses
        // (the plain-browser walk preview) so the rest of the gallery runs.
        const surface=page.locator('.xp-surface');
        if(await surface.count()){
          for(const label of ['Composition','Library','Setup']){
            await surface.getByRole('button',{name:label,exact:true}).click();
            await page.waitForTimeout(150);
            await shot(`expressions-menu-${label.toLowerCase()}-${scheme}`);
            await page.keyboard.press('Escape');
          }
          await surface.getByRole('button',{name:'Composition',exact:true}).click();
          await surface.getByLabel('Expression title',{exact:true}).fill('Look-and-fix pass');
          await surface.getByRole('menuitem',{name:'New Expression',exact:true}).click();
          await page.waitForTimeout(200);
          await surface.getByRole('button',{name:'Add Thing',exact:true}).click().catch(()=>{});
          await page.waitForTimeout(150);
          await shot(`expressions-studio-${scheme}`);
        }
        for(const width of [760,640]){
          await page.setViewportSize({width,height:820});
          await page.waitForTimeout(300);
          await shot(`expressions-${width}-${scheme}`);
        }
        await page.setViewportSize({width:1280,height:820});
        await page.waitForTimeout(200);
      }
    }
    await page.keyboard.press('Meta+Alt+2'); await page.waitForTimeout(500);
    // The Factory fold: Run | Agents | Context are the panel's views.
    for(const plane of ['Run','Agents','Context']){
      const direct=page.getByRole('navigation',{name:'Right region planes'}).getByRole('button',{name:plane,exact:true});
      if(await direct.count())await direct.first().click();
      else{await page.getByRole('button',{name:/More views/}).click();await page.getByRole('group',{name:'More views'}).getByRole('button',{name:plane,exact:true}).click();}
      await page.waitForTimeout(400); if(scheme==='light'||plane==='Run')await shot(`desk-${plane.toLowerCase().replace(/[^a-z]+/g,'-')}-${scheme}`);
    }
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('oi:open-agency',{detail:{project:'Editor'}}))); await page.waitForTimeout(900);
    await shot(`agency-${scheme}`); await laws(`agency ${scheme}`);
    await page.keyboard.press('Meta+Alt+l'); await page.waitForTimeout(700);
    await shot(`library-${scheme}`);
    await page.keyboard.press('Escape');
    if(scheme==='light'){await page.setViewportSize({width:760,height:820});await page.waitForTimeout(400);await shot('factory-760-light');await laws('factory 760');await page.setViewportSize({width:1280,height:820});}
    await page.keyboard.press('Meta+Alt+1');
  }
}
