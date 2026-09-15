import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({root, appType:'custom', server:{host:'127.0.0.1',port:0}, logLevel:'error'});
server.middlewares.use('/provider-lifecycle', async (_, res) => {
  res.setHeader('content-type','text/html');
  res.end(await server.transformIndexHtml('/provider-lifecycle','<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/expression-provider-page.tsx"></script>'));
});
await server.listen();
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => {errors.push(error.message);console.error(error.message);});
await context.addInitScript(() => {
  localStorage.setItem('oi-cradle.visuals.v1', JSON.stringify({enabled:false,welcomeEnabled:false}));
  window.clock = {fired:0, pending:new Set()};
  const raf = requestAnimationFrame.bind(window), cancel = cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    const id = raf(time => {window.clock.pending.delete(id);window.clock.fired++;callback(time);});
    window.clock.pending.add(id);return id;
  };
  window.cancelAnimationFrame = id => {window.clock.pending.delete(id);cancel(id);};
});
const url = `http://127.0.0.1:${server.httpServer.address().port}/provider-lifecycle`;
const ready = page => page.waitForFunction(() => window.providerTest?.stage?.inspect().engine);
const observe = page => page.evaluate(async () => {
  const before = clock.fired;
  await new Promise(resolve => setTimeout(resolve,350));
  return {frames:clock.fired-before,pending:clock.pending.size,stage:providerTest.stage.inspect(),
    engines:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,
    canvases:document.querySelectorAll('canvas').length};
});
try {
  await page.goto(url);
  await page.waitForFunction(() => window.providerTest?.stage);
  let state = await observe(page);
  assert.equal(state.engines,0,'StrictMode disabled startup creates no engine canvas');
  assert.equal(state.frames,0,'the shared overlay does no continuous work without a form');
  await page.evaluate(() => providerTest.visuals.setEnabled(true));
  await ready(page);
  state = await observe(page);
  assert.equal(state.engines,1,'StrictMode creates exactly one production stage');
  assert.equal(state.canvases,2,'only the shared 2D overlay and production canvas are present');
  assert.equal(state.frames,0,'enabled without a presentation remains dormant');

  await page.evaluate(() => {
    window.oldPresentation = providerTest.stage.present({id:'same',plane:'ambient',recipe:'oi.mark',paused:true});
    oldPresentation.release();
    window.nextPresentation = providerTest.stage.present({id:'next',plane:'ambient',recipe:'oi.mark'});
  });
  // Software GL compilation and loaded CI workers can delay a drawing
  // frame beyond the quiet observation interval. Require actual progress
  // without interpreting that interval as a frame-rate budget.
  const beforeResume = await page.evaluate(() => providerTest.stage.inspect().frames);
  await page.waitForFunction(before => providerTest.stage.inspect().frames >= before + 2,beforeResume,{polling:100,timeout:15000});
  state = await observe(page);
  assert.equal(state.stage.paused,false,'a new presentation does not inherit the released presentation pause');
  assert.equal(state.stage.live,true);
  await page.evaluate(() => nextPresentation.release());
  await page.waitForFunction(() => !providerTest.stage.inspect().scheduled);

  await page.evaluate(() => {window.oldPresentation=providerTest.stage.present({id:'same',plane:'ambient',recipe:'oi.mark'});providerTest.visuals.setEnabled(false);});
  await page.waitForFunction(() => !document.querySelector('canvas[data-oi-stage="engine"]'));
  await page.evaluate(() => providerTest.visuals.setEnabled(true));
  await ready(page);
  await page.evaluate(() => {window.currentPresentation=providerTest.stage.present({id:'same',plane:'ambient',recipe:'oi.mark'});oldPresentation.release();});
  state = await observe(page);
  assert.equal(state.stage.presentations.length,1,'release from a disposed generation cannot release the replacement with the same id');
  assert.equal(state.stage.live,true);
  const staleRefused = await page.evaluate(() => {try {oldPresentation.update('oi.mark');return false;} catch {return true;}});
  assert.equal(staleRefused,true,'stale handles refuse mutation of a disposed generation');
  await page.evaluate(() => currentPresentation.release());

  for (let cycle=0;cycle<3;cycle++) {
    await page.evaluate(() => providerTest.unmount());
    state = await observe(page);
    assert.equal(state.canvases,0,'unmount removes both owned canvases');
    assert.equal(state.pending,0,'unmount leaves no scheduled callback');
    await page.evaluate(() => providerTest.mount());
    await ready(page);
    state = await observe(page);
    assert.equal(state.engines,1,'remount restores one production stage');
    assert.equal(state.canvases,2,'remount restores one shared overlay');
  }
  const second = await context.newPage();
  await second.goto(url);
  await second.waitForFunction(() => window.providerTest?.stage);
  await second.evaluate(() => providerTest.visuals.setEnabled(true));
  await ready(second);
  assert.equal((await observe(second)).engines,1,'a second browser window owns its own one stage');
  assert.equal((await observe(page)).engines,1,'the first window retains its own one stage');
  await second.close();
  assert.deepEqual(errors,[]);
  console.log('Expression provider: disabled/enabled, StrictMode/remount, pause handover, stale generation, two-window ownership and idle RAF checks passed with the production engine.');
} finally {await browser.close();await server.close();}
