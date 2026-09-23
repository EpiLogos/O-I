import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {renderedBounds} from '../walk/knowledge-projection-geometry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({root, appType: 'custom', server: {host: '127.0.0.1', port: 4386, strictPort: true}, logLevel: 'error'});
server.middlewares.use('/welcome-lifecycle', async (_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(await server.transformIndexHtml('/welcome-lifecycle', '<body class="oi-desktop" style="margin:0"><div id="root" tabindex="-1"></div><script type="module" src="/tests/welcome-page.tsx"></script></body>'));
});
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/welcome-lifecycle`;
const browser = await chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
const results = [], errors = [];
const observeErrors = page => page.on('pageerror', error => errors.push(error.message));
const appReady = page => page.evaluate(() => welcomeTest.setAppReady(true));
const fieldReady = page => page.waitForSelector('.oi-welcome[data-field-ready="true"]', {timeout: 30000});
const entered = async page => {
  try { await page.waitForFunction(() => welcomeTest.entered === 1, null, {timeout: 30000}); }
  catch (error) {
    const current = await page.evaluate(() => ({entered: welcomeTest.entered, phase: document.querySelector('.oi-welcome')?.dataset.phase, error: document.querySelector('.oi-welcome-error')?.textContent, leakedKeys: welcomeTest.leakedKeys}));
    throw new Error(`Welcome did not enter: ${JSON.stringify(current)}`, {cause: error});
  }
};
const watchReveal = page => page.evaluate(() => {
  window.welcomeSamples = [];
  const sample = () => {
    const welcome = document.querySelector('.oi-welcome');
    window.welcomeSamples.push({
      phase: welcome?.getAttribute('data-phase') ?? null,
      opacity: welcome ? getComputedStyle(welcome).opacity : null,
      bg: welcome ? getComputedStyle(welcome).backgroundColor : null,
      opening: document.body.getAttribute('data-oi-opening'),
      body: getComputedStyle(document.body).backgroundColor,
    });
    if (welcome) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});
const HOST = {light: 'rgb(251, 251, 249)', dark: 'rgb(18, 18, 17)'};
const SHELL = {light: 'rgb(233, 233, 229)', dark: 'rgb(11, 11, 10)'};
try {
  // The splash is ready without the expression engine.
  {
    const context = await browser.newContext({viewport: {width: 900, height: 700}});
    const page = await context.newPage();
    observeErrors(page);
    let release = () => {};
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/src/stage/engineSurface.ts', async route => { await held; await route.continue(); });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await fieldReady(page);
    assert.equal(await page.locator('canvas[data-oi-stage="engine"]').count(), 0, 'the static splash does not allocate the expression canvas');
    assert.equal(await page.locator('.oi-welcome-logo').count(), 1);
    assert.equal(await page.evaluate(() => welcomeTest.entered), 0);
    release();
    await context.close();
    results.push({splashWithoutEngine: true});
  }

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport: {width: 900, height: 700}});
    await context.addInitScript(theme => localStorage.setItem('oi-cradle.visuals.v1', JSON.stringify({enabled: true, welcomeEnabled: true, theme})), theme);
    const page = await context.newPage();
    observeErrors(page);
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.welcomeTest?.kernel?.stateSettled);
    assert.equal(await page.locator('.oi-welcome-enter').isDisabled(), true, 'Enter is unavailable before the mark is ready');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => welcomeTest.entered), 0, 'keyboard input cannot skip the splash');
    assert.equal(await page.evaluate(() => welcomeTest.leakedKeys.length), 0, 'opening keys do not reach underlying shortcuts while loading');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('oi-cradle.welcome.v1')), null);
    await fieldReady(page);
    assert.equal(await page.locator('.oi-welcome-enter').isDisabled(), true, 'mark readiness still waits for parent app composition');
    assert.equal(await page.evaluate(() => welcomeTest.fieldReadyEvents.length), 1, 'StrictMode reports the splash once');
    await appReady(page);
    await page.getByRole('button', {name: 'O:I is ready. Open the app.', exact: true}).waitFor();
    const openingIsLight = theme === 'dark';
    const pixels = await renderedBounds(page, {screenshot: () => page.locator('.oi-welcome-logo').screenshot()});
    const ground = openingIsLight ? [251, 251, 249] : [18, 18, 17];
    assert.deepEqual(pixels.background, ground, 'opening uses the opposite canonical ground');
    assert.ok(pixels[openingIsLight ? 'darkInkPixels' : 'lightInkPixels'] > 1000, 'the static O:I mark has readable inverse ink');
    const layers = await page.evaluate(() => {
      const welcome = document.querySelector('.oi-welcome');
      return {background: getComputedStyle(welcome).backgroundColor, opening: document.body.getAttribute('data-oi-opening'), body: getComputedStyle(document.body).backgroundColor};
    });
    assert.equal(layers.background, openingIsLight ? HOST.light : HOST.dark);
    assert.equal(layers.opening, 'true');
    assert.equal(layers.body, openingIsLight ? HOST.light : HOST.dark, 'the body ground matches the opaque splash');
    await page.screenshot({path: `/tmp/welcome-${theme}-rest.png`});
    await watchReveal(page);
    if (theme === 'light') await page.keyboard.press('Enter');
    else await page.getByRole('button', {name: 'O:I is ready. Open the app.', exact: true}).click();
    await page.locator('.oi-welcome[data-phase="entering"]').waitFor();
    await page.waitForFunction(() => {
      const node = document.querySelector('.oi-welcome');
      if (!node) return false;
      const opacity = Number(getComputedStyle(node).opacity);
      return opacity < 0.82 && opacity > 0.4;
    }, null, {timeout: 5000});
    await page.screenshot({path: `/tmp/welcome-${theme}-flip.png`});
    assert.equal(await page.evaluate(() => sessionStorage.getItem('oi-cradle.welcome.v1')), null, 'starting the gesture is not a completed opening');
    await entered(page);
    const samples = await page.evaluate(() => window.welcomeSamples);
    const host = HOST[theme];
    const inverse = HOST[theme === 'dark' ? 'light' : 'dark'];
    const fading = samples.filter(sample => sample.opacity !== null && Number(sample.opacity) < 0.98);
    assert.ok(fading.length >= 24, 'the opacity fade is long enough to read, not a cut');
    assert.ok(Number(fading[0].opacity) > 0.7, 'opacity leaves from nearly opaque instead of dropping');
    assert.ok(Number(fading.at(-1).opacity) < 0.25, 'opacity eases out');
    for (const sample of fading) {
      assert.equal(sample.phase, 'entering', 'colour and fade are one gesture');
      assert.equal(sample.opening, null, 'the inverse body ground is gone before the splash is transparent');
      assert.equal(sample.body, SHELL[theme], 'the revealed document is the saved shell, not the opening ground');
      assert.notEqual(sample.body, inverse);
    }
    const late = fading.filter(sample => Number(sample.opacity) < 0.35);
    assert.ok(late.length > 0 && late.every(sample => sample.bg === host), 'the splash is on the saved ground before it is mostly gone');
    assert.ok(samples.some(sample => sample.phase === 'entering' && Number(sample.opacity) > 0.97), 'the colour move begins while the splash still covers the app');
    await page.screenshot({path: `/tmp/welcome-${theme}-entered.png`});
    const completion = await page.evaluate(() => ({
      marker: sessionStorage.getItem('oi-cradle.welcome.v1'),
      theme: welcomeTest.visuals.get().theme,
      fieldEvents: welcomeTest.fieldReadyEvents.length,
      presentations: welcomeTest.stage.inspect().presentations.length,
      opening: document.body.getAttribute('data-oi-opening'),
      appearance: document.body.dataset.theme ?? 'light',
    }));
    assert.equal(completion.marker, '1');
    assert.equal(completion.theme, theme, 'the opening does not rewrite the saved app appearance');
    assert.equal(completion.fieldEvents, 1);
    assert.equal(completion.presentations, 0, 'the splash never claims the expression stage');
    assert.equal(completion.opening, null);
    assert.equal(completion.appearance, theme);
    assert.equal(await page.evaluate(() => welcomeTest.leakedKeys.length), 0, 'entry keys are owned by the opening');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => welcomeTest.leakedKeys.length), 1, 'the capture handler is removed when the app becomes interactive');
    results.push({theme, inverseMark: pixels, fadeSamples: fading.length, firstFadeOpacity: Number(fading[0].opacity), lastFadeOpacity: Number(fading.at(-1).opacity)});
    await page.reload();
    await entered(page);
    assert.equal(await page.locator('.oi-welcome').count(), 0, 'the completed opening is skipped in the same session');
    assert.equal(await page.evaluate(() => welcomeTest.fieldReadyEvents.length), 1, 'skipping still allows the real app to compose');
    await context.close();
  }

  for (const keepWelcome of [false, true]) {
    const restoredContext = await browser.newContext({viewport: {width: 900, height: 700}});
    const restored = await restoredContext.newPage();
    observeErrors(restored);
    await restored.goto(`${url}?restored${keepWelcome ? '&keep-welcome' : ''}`);
    await fieldReady(restored);
    await restored.waitForFunction(() => welcomeTest.restoredHandle);
    assert.equal(await restored.locator('.oi-welcome').count(), 1, 'the splash still covers the app');
    assert.equal(await restored.locator('canvas[data-oi-stage="engine"]').count(), 1, 'a restored presentation may use the stage under the splash');
    await restored.keyboard.press('x');
    await appReady(restored);
    await restored.getByRole('button', {name: 'O:I is ready. Open the app.', exact: true}).waitFor();
    await restored.keyboard.press('y');
    assert.deepEqual(await restored.evaluate(() => welcomeTest.capturedByUnderlay), [], 'app handlers receive no keys before entry');
    await restored.keyboard.press('Enter');
    await entered(restored);
    assert.equal(await restored.locator('.oi-welcome').count(), 0, 'completed splash stays absent even when its parent keeps the component mounted');
    await restored.keyboard.press('z');
    assert.deepEqual(await restored.evaluate(() => welcomeTest.capturedByUnderlay), ['z'], 'the restored app receives keys after entry');
    await restoredContext.close();
    results.push({keepWelcomeMounted: keepWelcome, restoredPresentation: 'admitted under the splash; keys released after entry'});
  }

  {
    const reduced = await browser.newContext({viewport: {width: 900, height: 700}, reducedMotion: 'reduce'});
    await reduced.addInitScript(() => localStorage.setItem('oi-cradle.visuals.v1', JSON.stringify({enabled: true, welcomeEnabled: true, theme: 'light'})));
    const page = await reduced.newPage();
    observeErrors(page);
    await page.goto(url);
    await fieldReady(page);
    await appReady(page);
    await page.getByRole('button', {name: 'O:I is ready. Open the app.', exact: true}).waitFor();
    await watchReveal(page);
    await page.keyboard.press('Escape');
    await entered(page);
    const samples = await page.evaluate(() => window.welcomeSamples);
    const fading = samples.filter(sample => sample.opacity !== null && Number(sample.opacity) < 0.98);
    assert.ok(fading.every(sample => sample.opening === null && sample.body === SHELL.light), 'reduced motion still reveals the saved shell, not the opening ground');
    results.push({reducedMotion: {samples: samples.length, fading: fading.length}});
    await reduced.close();
  }

  assert.deepEqual(errors, []);
  for (const disabled of [{enabled: false, welcomeEnabled: true}, {enabled: true, welcomeEnabled: false}]) {
    const skipped = await browser.newContext();
    await skipped.addInitScript(preferences => localStorage.setItem('oi-cradle.visuals.v1', JSON.stringify(preferences)), disabled);
    const skippedPage = await skipped.newPage();
    observeErrors(skippedPage);
    await skippedPage.goto(url);
    await entered(skippedPage);
    assert.equal(await skippedPage.locator('.oi-welcome').count(), 0);
    assert.equal(await skippedPage.evaluate(() => welcomeTest.fieldReadyEvents.length), 1, 'disabled opening still releases app composition once');
    assert.equal(await skippedPage.evaluate(() => sessionStorage.getItem('oi-cradle.welcome.v1')), null, 'disabling is not recorded as a human entry');
    if (!disabled.enabled) assert.equal(await skippedPage.locator('canvas[data-oi-stage="engine"]').count(), 0, 'Expression disabled creates no engine canvas');
    await skipped.close();
  }

  const failedBrowser = await chromium.launch({headless: true, args: ['--disable-webgl']});
  try {
    const failed = await failedBrowser.newPage({viewport: {width: 900, height: 700}});
    const pageErrors = [];
    failed.on('pageerror', error => pageErrors.push(error.message));
    await failed.goto(url);
    await fieldReady(failed);
    await appReady(failed);
    await failed.getByRole('button', {name: 'O:I is ready. Open the app.', exact: true}).waitFor();
    assert.equal(await failed.locator('.oi-welcome-logo').count(), 1, 'WebGL loss does not remove the static mark');
    await failed.keyboard.press('Enter');
    await entered(failed);
    assert.equal(await failed.locator('.oi-welcome').count(), 0, 'the splash still enters when WebGL is unavailable');
    results.push({webglUnavailable: {entered: true, pageErrors}});
  } finally { await failedBrowser.close(); }

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({check: 'Welcome static splash lifecycle', results}, null, 2));
} finally {
  await browser.close();
  await server.close();
}
