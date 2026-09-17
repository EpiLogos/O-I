/** Real native boot and the first-open production field. The field paints
 * before the lazy workspace composes beneath it. Entry awaits both, and its
 * complete inversion / explosion / tail is governed by rendered engine time. */
import {renderedBounds} from '../knowledge-projection-geometry.mjs';

const READY = '.oi-welcome-enter[aria-label="O:I is ready. Open the app."]';
const stage = page => page.evaluate(async () => (await window.__cradle.walk.read.stage()).data);
const fieldPixels = async page => {
  const box=await page.locator('canvas[data-oi-stage="engine"]').boundingBox();
  // Read the actual canvas region above the DOM labels, so readable text
  // cannot stand in for readable native mark ink.
  return renderedBounds(page,{screenshot:()=>page.screenshot({clip:{...box,height:Math.floor(box.height*.7)}})});
};
const chooseTheme = (page,theme) => page.evaluate(theme => {
  const key='oi-cradle.visuals.v1',current=JSON.parse(localStorage.getItem(key)||'{}');
  localStorage.setItem(key,JSON.stringify({...current,theme}));
  sessionStorage.removeItem('oi-cradle.welcome.v1');
},theme);

export default async function run({page,baseUrl,check,shot,metric}) {
  await page.goto(`${baseUrl}?frontstate`);
  const welcome=page.locator('.oi-welcome');
  await welcome.waitFor({timeout:15000});
  check(await welcome.count()===1,'The welcome frontstate stands on first open');
  check(await page.locator('.oi-boot-overlay').count()===0,'Boot uses one continuous frontstate');
  await page.locator('.oi-expression-surface').waitFor({timeout:30000});
  check(await page.locator('canvas[data-oi-stage="engine"]').count()===1,'The opening uses one production Expression canvas');
  await page.locator(READY).waitFor({timeout:30000});
  check(await welcome.getAttribute('data-field-ready')==='true'&&(await stage(page)).frames>0,'Entry becomes available after actual field drawing and native boot');
  // The workspace is requested only after the field's first rendered frame,
  // so its composition beneath the opening arrives asynchronously.
  await page.getByRole('region',{name:'Empty workspace',includeHidden:true}).waitFor({state:'attached',timeout:30000});
  check(await page.getByRole('region',{name:'Empty workspace',includeHidden:true}).isVisible(),'The workspace is composed beneath the opening field');
  check(await page.locator('.oi-workspace-mount[inert][aria-hidden="true"]').count()===1,'The covered workspace is unavailable to pointer and keyboard interaction');

  await page.keyboard.press('Escape');
  await welcome.waitFor({state:'detached',timeout:30000});
  const escaped=await stage(page);
  check(escaped.playback?.status==='completed'&&escaped.playback.elapsed>=escaped.playback.duration,'Escape waits for the full rendered enter sequence');
  check(await page.evaluate(()=>document.activeElement?.id==='root'||document.activeElement?.classList.contains('cm-content')),'Keyboard entry restores focus in the working app');

  await page.reload();
  await page.locator('.desktop-shell').waitFor({timeout:30000});
  check(await page.locator('.oi-welcome').count()===0,'The completed opening does not re-trap the same session');

  await page.emulateMedia({reducedMotion:'reduce'});
  await chooseTheme(page,'dark');
  await page.reload();
  await page.locator(READY).waitFor({timeout:30000});
  await shot('welcome-reduced-motion');
  const beforeReduced=(await stage(page)).frames;
  await page.keyboard.press(' ');
  await welcome.waitFor({state:'detached',timeout:30000});
  const reduced=await stage(page);
  check(reduced.playback?.status==='completed'&&reduced.frames>beforeReduced,'Reduced motion paints the final authored still before keyboard entry');
  check(reduced.live===false&&reduced.scheduled===false,'Reduced motion releases the opening without continuing a simulation');
  await page.emulateMedia({reducedMotion:'no-preference'});

  for(const theme of ['light','dark']) {
    await chooseTheme(page,theme);
    await page.reload();
    await page.locator(READY).waitFor({timeout:30000});
    const pixels=await fieldPixels(page),inverseLight=theme==='dark';
    const ground=inverseLight?[251,251,249]:[18,18,17];
    check(JSON.stringify(pixels.background)===JSON.stringify(ground),`${theme} app starts on the opposite canonical scene ground`,pixels);
    check(pixels[inverseLight?'darkInkPixels':'lightInkPixels']>1000,`${theme} opening has readable native O:I mark ink`,pixels);
    metric(`welcome_${theme}_inverse_ink_pixels`,pixels[inverseLight?'darkInkPixels':'lightInkPixels']);
    const before=await page.evaluate(()=>{
      const canvas=document.querySelector('canvas[data-oi-stage="engine"]');
      window.welcomeCanvas=canvas;window.welcomeContext=canvas.getContext('webgl2');
      const field=getComputedStyle(canvas),control=getComputedStyle(document.querySelector('.oi-welcome'));
      return {background:control.backgroundColor,fieldZ:Number(field.zIndex),controlZ:Number(control.zIndex)};
    });
    check(before.background==='rgba(0, 0, 0, 0)'&&before.controlZ>before.fieldZ,'The field owns its full ground and the labelled control stays above it');
    await shot(`welcome-${theme}-rest`);
    await page.locator(READY).click();
    await page.waitForFunction(async()=>{
      const state=(await window.__cradle.walk.read.stage()).data;
      return state?.playback?.status==='active'&&state.playback.elapsed>=750;
    },null,{timeout:20000});
    check(await welcome.getAttribute('data-phase')==='entering'&&await page.evaluate(()=>sessionStorage.getItem('oi-cradle.welcome.v1')===null),'The frontstate and incomplete session remain through the explosion');
    // The scene's native interpolation settles on its own rendered clock,
    // not on the sequence's elapsed counter, so the palette is waited for,
    // never sampled at a fixed instant.
    const groundDuring=await page.waitForFunction(expected=>getComputedStyle(document.querySelector('canvas[data-oi-stage="engine"]')).backgroundColor===expected,
      theme==='dark'?'rgb(18, 18, 17)':'rgb(251, 251, 249)',{timeout:20000})!==null
      ?await page.evaluate(()=>getComputedStyle(document.querySelector('canvas[data-oi-stage="engine"]')).backgroundColor):null;
    check(groundDuring===(theme==='dark'?'rgb(18, 18, 17)':'rgb(251, 251, 249)'),`${theme} entry reaches the application palette on the same field`);
    await shot(`welcome-${theme}-explosion`);
    await welcome.waitFor({state:'detached',timeout:30000});
    const after=await stage(page);
    check(after.playback?.status==='completed'&&after.playback.elapsed>=after.playback.duration,`${theme} entry releases only after the rendered tail`,after.playback);
    check(await page.evaluate(()=>{
      const canvas=document.querySelector('canvas[data-oi-stage="engine"]');
      return canvas===window.welcomeCanvas&&canvas.getContext('webgl2')===window.welcomeContext;
    }),'Rest, explosion and final release retain one canvas/context');
    check(await page.evaluate(theme=>JSON.parse(localStorage.getItem('oi-cradle.visuals.v1')).theme===theme,theme),'The opening preserves the saved app appearance');
    await shot(`welcome-${theme}-entered`);
  }

  await page.waitForFunction(async()=>{const state=(await window.__cradle.walk.read.stage()).data;return state?.live===false&&state.scheduled===false;},null,{timeout:5000});
  const idle=await page.evaluate(async()=>{
    const before=(await window.__cradle.walk.read.stage()).data;
    await new Promise(resolve=>setTimeout(resolve,1000));
    const after=(await window.__cradle.walk.read.stage()).data;
    const canvas=document.querySelector('canvas[data-oi-stage="engine"]');
    return {presentations:after.presentations.length,frames:after.frames-before.frames,scheduled:after.scheduled,live:after.live,dormant:canvas?.dataset.oiStageLive==='false',canvases:document.querySelectorAll('canvas[data-oi-stage="engine"]').length};
  });
  check(idle.presentations===0&&idle.live===false,'No presentation remains live in the settled desktop');
  check(idle.frames===0&&idle.scheduled===false,'The completed opening schedules no simulation frames',idle);
  check(idle.dormant&&idle.canvases===1,'The single production canvas/context stays resident and dormant');
}
