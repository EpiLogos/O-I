/** First open is a static splash, not the live expression field. Entry waits
 * for the mark and the workspace, then moves ground and ink onto the saved
 * theme while opacity eases out across that move. */
import {renderedBounds} from '../knowledge-projection-geometry.mjs';

const READY = '.oi-welcome-enter[aria-label="O:I is ready. Open the app."]';
const stage = page => page.evaluate(async () => (await window.__cradle.walk.read.stage()).data);
const markPixels = async page => renderedBounds(page, {screenshot: () => page.locator('.oi-welcome-logo').screenshot()});
const chooseTheme = (page, theme) => page.evaluate(theme => {
  const key = 'oi-cradle.visuals.v1', current = JSON.parse(localStorage.getItem(key) || '{}');
  localStorage.setItem(key, JSON.stringify({...current, theme}));
  sessionStorage.removeItem('oi-cradle.welcome.v1');
}, theme);
const watchReveal = page => page.evaluate(() => {
  window.welcomeSamples = [];
  const sample = () => {
    const welcome = document.querySelector('.oi-welcome');
    window.welcomeSamples.push({
      phase: welcome?.getAttribute('data-phase') ?? null,
      opacity: welcome ? getComputedStyle(welcome).opacity : null,
      bg: welcome ? getComputedStyle(welcome).backgroundColor : null,
      opening: document.body.getAttribute('data-oi-opening'),
    });
    if (welcome) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});

export default async function run({page, baseUrl, check, shot, metric}) {
  await page.goto(`${baseUrl}?frontstate`);
  const welcome = page.locator('.oi-welcome');
  await welcome.waitFor({timeout: 15000});
  check(await welcome.count() === 1, 'The welcome splash stands on first open');
  check(await page.locator('.oi-boot-overlay').count() === 0, 'Boot uses one continuous splash');
  await page.locator('.oi-welcome-logo').waitFor({timeout: 30000});
  await page.locator(READY).waitFor({timeout: 30000});
  check(await welcome.getAttribute('data-field-ready') === 'true', 'Entry becomes available after the static mark is ready');
  check(await page.locator('.oi-welcome-logo').count() === 1 && await welcome.evaluate(node => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'The opening mark is the opaque static splash');
  await page.getByRole('region', {name: 'Empty workspace', includeHidden: true}).waitFor({state: 'attached', timeout: 30000});
  check(await page.getByRole('region', {name: 'Empty workspace', includeHidden: true}).isVisible(), 'The workspace is composed beneath the opening splash');
  check(await page.locator('.oi-workspace-mount[inert][aria-hidden="true"]').count() === 1, 'The covered workspace is unavailable to pointer and keyboard interaction');

  await page.keyboard.press('Escape');
  await welcome.waitFor({state: 'detached', timeout: 30000});
  check(await page.evaluate(() => sessionStorage.getItem('oi-cradle.welcome.v1') === '1'), 'Escape completes the opening');
  check(await page.evaluate(() => document.activeElement?.id === 'root' || document.activeElement?.classList.contains('cm-content')), 'Keyboard entry restores focus in the working app');

  await page.reload();
  await page.locator('.desktop-shell').waitFor({timeout: 30000});
  check(await page.locator('.oi-welcome').count() === 0, 'The completed opening does not re-trap the same session');

  await page.emulateMedia({reducedMotion: 'reduce'});
  await chooseTheme(page, 'dark');
  await page.reload();
  await page.locator(READY).waitFor({timeout: 30000});
  await shot('welcome-reduced-motion');
  await page.keyboard.press(' ');
  await welcome.waitFor({state: 'detached', timeout: 30000});
  const reduced = await stage(page);
  check(!reduced.playback || reduced.playback.status !== 'active', 'Reduced motion enters without playing the live mark flight');
  check(reduced.live === false && reduced.scheduled === false, 'Reduced motion does not leave an opening simulation running');
  await page.emulateMedia({reducedMotion: 'no-preference'});

  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await page.reload();
    await page.locator(READY).waitFor({timeout: 30000});
    await page.waitForFunction(() => {
      const logo = document.querySelector('.oi-welcome-logo');
      return !!logo && Number(getComputedStyle(logo).opacity) > 0.98;
    });
    const pixels = await markPixels(page), inverseLight = theme === 'dark';
    const ground = inverseLight ? [251, 251, 249] : [18, 18, 17];
    const host = theme === 'dark' ? 'rgb(18, 18, 17)' : 'rgb(251, 251, 249)';
    check(JSON.stringify(pixels.background) === JSON.stringify(ground), `${theme} app starts on the opposite canonical scene ground`, pixels);
    check(pixels[inverseLight ? 'darkInkPixels' : 'lightInkPixels'] > 1000, `${theme} opening has readable static O:I mark ink`, pixels);
    metric(`welcome_${theme}_inverse_ink_pixels`, pixels[inverseLight ? 'darkInkPixels' : 'lightInkPixels']);
    await shot(`welcome-${theme}-rest`);
    await watchReveal(page);
    await page.locator(READY).click();
    await page.locator('.oi-welcome[data-phase="entering"]').waitFor({timeout: 5000});
    check(await page.evaluate(() => sessionStorage.getItem('oi-cradle.welcome.v1') === null), 'Starting the gesture is not a completed opening');
    await shot(`welcome-${theme}-flip`);
    await welcome.waitFor({state: 'detached', timeout: 30000});
    const samples = await page.evaluate(() => window.welcomeSamples);
    const fading = samples.filter(sample => sample.opacity !== null && Number(sample.opacity) < 0.98);
    const late = fading.filter(sample => Number(sample.opacity) < 0.35);
    check(fading.length > 8 && fading.every(sample => sample.phase === 'entering' && sample.opening === null), `${theme} fade is part of the enter gesture and the opening ground is already gone`, fading.slice(0, 3));
    check(late.length > 0 && late.every(sample => sample.bg === host), `${theme} splash is on the saved ground before it is mostly gone`, late.slice(0, 2));
    check(samples.some(sample => sample.phase === 'entering' && Number(sample.opacity) > 0.9), `${theme} colour move begins while the splash still covers the app`);
    check(await page.evaluate(theme => JSON.parse(localStorage.getItem('oi-cradle.visuals.v1')).theme === theme, theme), 'The opening preserves the saved app appearance');
    await shot(`welcome-${theme}-entered`);
  }

  await page.waitForFunction(async () => {
    const state = (await window.__cradle.walk.read.stage()).data;
    return state?.live === false && state.scheduled === false;
  }, null, {timeout: 5000});
  const idle = await page.evaluate(async () => {
    const before = (await window.__cradle.walk.read.stage()).data;
    await new Promise(resolve => setTimeout(resolve, 1000));
    const after = (await window.__cradle.walk.read.stage()).data;
    const canvas = document.querySelector('canvas[data-oi-stage="engine"]');
    return {presentations: after.presentations.length, frames: after.frames - before.frames, scheduled: after.scheduled, live: after.live, dormant: canvas?.dataset.oiStageLive === 'false', canvases: document.querySelectorAll('canvas[data-oi-stage="engine"]').length};
  });
  check(idle.presentations === 0 && idle.live === false, 'No presentation remains live in the settled desktop');
  check(idle.frames === 0 && idle.scheduled === false, 'The completed opening schedules no simulation frames', idle);
  check(idle.dormant && idle.canvases === 1, 'The single production canvas/context stays resident and dormant');
}
