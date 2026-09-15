import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({root, appType:'custom', server:{host:'127.0.0.1',port:0}, logLevel:'error'});
server.middlewares.use('/visuals-preview', async (_, res) => {
  res.setHeader('content-type','text/html');
  res.end(await server.transformIndexHtml('/visuals-preview','<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/visuals-preview-page.tsx"></script>'));
});
await server.listen();
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context = await browser.newContext({acceptDownloads:true,reducedMotion:'no-preference'});
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
  window.gpuCanvases = new Set();
  // Keep the real contexts reachable: removing a canvas alone must not make
  // terminal resource disposal appear to pass through garbage collection.
  window.gpuContexts = new Map();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type,...args) {
    const result = getContext.call(this,type,...args);
    if(result && (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl')) {
      gpuCanvases.add(this);
      gpuContexts.set(this,result);
    }
    return result;
  };
});
const url = `http://127.0.0.1:${server.httpServer.address().port}/visuals-preview`;
const observe = () => page.evaluate(async () => {
  const before = clock.fired;
  await new Promise(resolve => setTimeout(resolve,350));
  return {frames:clock.fired-before,pending:clock.pending.size,stage:previewTest.stage.inspect(),
    engines:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,
    canvases:document.querySelectorAll('canvas').length,
    gpuCanvases:[...gpuCanvases].filter(canvas => canvas.isConnected).length,
    unlostContexts:[...gpuContexts.values()].filter(context => !context.isContextLost()).length};
});
const idle = () => page.waitForFunction(() => previewTest.stage.inspect().live === false && !previewTest.stage.inspect().scheduled);
const preview = () => page.waitForFunction(() => document.querySelector('.visuals-preview-stage canvas'));
const advances = async () => {
  const before = await page.evaluate(() => previewTest.stage.inspect().frames);
  await page.waitForFunction(before => previewTest.stage.inspect().frames > before,before,{polling:100});
};
const assertPreview = async () => {
  await preview();
  // The provider places a canvas before the native engine's first render
  // allocates its context; wait for actual materialisation, not a time budget.
  await page.waitForFunction(() => [...gpuContexts].some(([canvas,context]) => canvas.isConnected && !context.isContextLost()),null,{polling:100});
  const state = await observe();
  assert.equal(state.canvases,2,'Visuals reuses the one production canvas beside the shared 2D overlay');
  assert.equal(state.gpuCanvases,1,'Visuals allocates no component-level WebGL renderer');
  assert.equal(state.unlostContexts,1,'only the current production context remains available across remounts');
  assert.equal(state.engines,1);
  assert.equal(state.stage.presentations.length,1,'the preview is a registered stage presentation');
  return state;
};
try {
  await page.goto(url);
  await page.getByRole('button',{name:'Expression: Off',exact:true}).waitFor();
  let state = await observe();
  assert.equal(state.gpuCanvases,0,'disabled settings allocate no engine context');
  assert.equal(state.engines,0);
  assert.equal(state.frames,0);
  await page.getByRole('button',{name:'Expression: Off',exact:true}).click();
  await assertPreview();
  await advances();

  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
  state = await observe();
  assert.equal(state.stage.paused,true);
  assert.equal(state.frames,0,'the actual Pause control sleeps the shared engine');
  await page.getByLabel('Glyph A',{exact:true}).fill('Ω');
  await page.waitForFunction(() => previewTest.visuals.get().config.glyph[0] === 'Ω');
  assert.equal((await observe()).frames,0,'accepted config changes preserve a paused preview');
  await page.getByRole('button',{name:'Resume simulation',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('.visuals-diagnostics pre')?.textContent.includes('Ω'),null,{polling:100});
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button',{name:'Capture image',exact:true}).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(),'expression-capture.png');
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','capture returns a real engine PNG');
  assert.ok(png.readUInt32BE(16)>0 && png.readUInt32BE(20)>0);
  await assertPreview();
  await page.getByRole('button',{name:'Resume simulation',exact:true}).click();
  await page.getByRole('button',{name:'Disperse',exact:true}).click();
  await page.getByRole('button',{name:'Reset field',exact:true}).click();
  await advances();

  await page.getByRole('button',{name:'Themes',exact:true}).click();
  await idle();
  state = await observe();
  assert.equal(state.stage.presentations.length,0,'leaving Expression releases its presentation');
  assert.equal(state.frames,0,'released settings leave no continuing simulation RAF');
  assert.equal(state.pending,0);
  assert.equal(state.gpuCanvases,1,'the dormant shared engine remains owned by the window');
  assert.equal(state.unlostContexts,1,'ordinary presentation release keeps the retained production context usable');
  assert.equal(await page.evaluate(() => document.querySelector('canvas[data-oi-stage="engine"]').parentElement === document.body),true,'release restores the canvas to its window home');

  // Another real presentation keeps ownership; the settings preview refuses
  // honestly and can acquire the same stage when the current owner releases.
  await page.evaluate(() => {window.otherPresentation=previewTest.stage.present({id:'other',plane:'ambient',recipe:'oi.mark'});});
  await page.getByRole('button',{name:'Expression',exact:true}).click();
  await page.getByRole('button',{name:'Retry preview',exact:true}).waitFor();
  state = await observe();
  assert.equal(state.gpuCanvases,1);
  assert.equal(state.stage.presentations[0].id,'other');
  assert.equal(await page.getByRole('button',{name:'Capture image',exact:true}).isDisabled(),true,'unavailable preview does not claim a working capture');
  await page.evaluate(() => otherPresentation.release());
  await page.getByRole('button',{name:'Retry preview',exact:true}).click();
  await assertPreview();
  const staleRefusals = await page.evaluate(() => {
    const calls = [() => otherPresentation.command({type:'reset-field'}),
      () => otherPresentation.setPaused(true), () => otherPresentation.setForceMotion(true),
      () => otherPresentation.capture(), () => otherPresentation.telemetry()];
    return calls.map(call => {try {call();return false;}catch {return true;}});
  });
  assert.deepEqual(staleRefusals,[true,true,true,true,true],'released handles cannot affect a replacement presentation');

  await page.getByRole('button',{name:'Expression: On',exact:true}).click();
  await page.waitForFunction(() => !previewTest.stage.inspect().engine);
  state = await observe();
  assert.equal(state.gpuCanvases,0,'the real Off control removes every connected engine context');
  assert.equal(state.unlostContexts,0,'Off explicitly releases the actual WebGL context even when instrumentation retains it');
  assert.equal(state.engines,0);
  assert.equal(state.frames,0);
  await page.getByRole('button',{name:'Expression: Off',exact:true}).click();
  await assertPreview();

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => !previewTest.stage.inspect().scheduled);
  assert.equal((await observe()).frames,0,'reduced motion holds a static preview');
  await page.getByLabel('Animate the preview even with reduced motion on (deliberate override)',{exact:true}).check();
  await advances();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await idle();
  assert.equal((await observe()).frames,0,'closing the forced-motion preview clears its override and clock');
  await page.evaluate(() => {window.nextPresentation=previewTest.stage.present({id:'next',plane:'ambient',recipe:'oi.mark'});});
  await page.waitForFunction(() => !previewTest.stage.inspect().scheduled);
  assert.equal((await observe()).frames,0,'the next presentation respects reduced motion without inheriting the override');
  await page.evaluate(() => nextPresentation.release());

  for (let cycle=0;cycle<2;cycle++) {
    await page.getByRole('button',{name:'Open settings',exact:true}).click();
    await assertPreview();
    assert.equal((await observe()).frames,0,'remounted settings remain static under reduced motion');
    await page.getByRole('button',{name:'Close settings',exact:true}).click();
    await idle();
    assert.equal((await observe()).frames,0);
  }
  await page.evaluate(() => previewTest.unmount());
  state = await observe();
  assert.equal(state.canvases,0,'StrictMode root unmount releases both window canvases');
  assert.equal(state.unlostContexts,0,'root unmount releases the actual WebGL context');
  assert.equal(state.pending,0);
  await page.evaluate(() => previewTest.mount());
  await assertPreview();
  assert.deepEqual(errors,[]);
  console.log('Visuals preview: real controls, PNG capture, config, pause/resume, one-context ownership, busy refusal/retry, disabled/enabled, navigation, StrictMode/remount, reduced motion and override handover passed.');
} finally {await browser.close();await server.close();}
