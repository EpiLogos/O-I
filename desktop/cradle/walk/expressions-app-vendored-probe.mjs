// expressions-app-vendored-probe — the vendoring proof (owner direction
// 2026-09-19: the Expressions application is built INSIDE the repo).
//
// Three acts, all against real artefacts — no fixtures:
//  (1) The kernel's files seam and material route serve the VENDORED build
//      (Work/O-I/desktop/cradle/expressions-app/dist) over real Central
//      ground, through the same typed seam the Tauri host fronts.
//  (2) The built application itself: boots without console errors on its
//      relative base; the default opened expression is the O:I mark — one
//      expression, two scenes (Day/Night), the light/dark theme matching
//      the base O:I image; the orbit controller anchors BOTTOM-LEFT; the
//      masthead aligns with the shell cutout geometry posted by a host
//      (oi-shell-cutout); ?expression= deep-links the twelve-masks Epii
//      face.
//  (3) The cradle host: the Expressions centre reaches data-state=ready
//      with its frame on the vendored dist through the walk bridge.
//
// Usage: node walk/expressions-app-vendored-probe.mjs
//   DESK_URL (default http://localhost:1432/) — the running dev bundle.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const appDist = join(cradleRoot, 'expressions-app', 'dist');
const url = process.env.DESK_URL ?? 'http://localhost:1432/';
const bridgePort = process.env.VENDORED_BRIDGE_PORT ?? '4195';
const staticPort = process.env.VENDORED_STATIC_PORT ?? '4196';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;

const fails = [];
const fail = (step, detail) => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);

// ---- (1) the files seam and material route serve the vendored build -----
const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {stdio: ['ignore', 'pipe', 'pipe']});
bridge.stderr.on('data', chunk => process.stderr.write(chunk));
const started = Date.now();
while (Date.now() - started < 240_000) {
  try { if ((await fetch(`${bridgeUrl}/state`)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}
if (!(await fetch(`${bridgeUrl}/state`).catch(() => null))?.ok) { console.log('FAIL bridge: did not come up'); bridge.kill(); process.exit(1); }
ok('walk bridge up', `${bridgeUrl} (${Math.round((Date.now() - started) / 1000)}s)`);

const DIST_PATH = 'Work/O-I/desktop/cradle/expressions-app/dist';
const listReply = await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: 'files_list', path: DIST_PATH})})).json();
const entries = listReply?.outcome?.directory?.entries ?? [];
const entry = entries.find(e => e.name === 'index.html');
if (!entry) fail('files seam lists the vendored dist', `list returned ${entries.length} entries, no index.html: ${JSON.stringify(listReply).slice(0, 160)}`);
else ok('the files seam lists the vendored dist', `${entries.length} entries at ${DIST_PATH}`);

if (entry) {
  const encoded = encodeURIComponent(JSON.stringify(entry.location));
  const html = await (await fetch(`${bridgeUrl}/material/${encoded}/index.html`)).text();
  if (!html.includes('<title>O:I — Expressions</title>')) fail('material serves the app entry', `index.html reads: ${html.slice(0, 120)}`);
  else ok('the material route serves the vendored app entry');
  const asset = /(?:src|href)="\.(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
  if (!asset) fail('relative base', 'the entry does not reference its assets relatively');
  else {
    const assetReply = await fetch(`${bridgeUrl}/material/${encoded}${asset}`);
    if (!assetReply.ok) fail('material serves the app bundle', `${asset} -> ${assetReply.status}`);
    else ok('the material route serves the app bundle on the relative base', `${asset.slice(8, 34)}… (${assetReply.headers.get('content-type')})`);
  }
}

// ---- (2) the built application, standalone on its relative base --------
const staticServer = spawn('python3', ['-m', 'http.server', staticPort, '--bind', '127.0.0.1', '--directory', appDist], {stdio: 'ignore'});
await new Promise(r => setTimeout(r, 800));
const appUrl = `http://127.0.0.1:${staticPort}/`;
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.goto(appUrl);
  await page.waitForFunction(() => window.__FIELD_STUDIES__, {timeout: 20000});
  ok('the application boots', 'window.__FIELD_STUDIES__ stands');

  const doc = await page.evaluate(() => window.__FIELD_STUDIES__.getDocument());
  if (doc.id !== 'oi-mark' || doc.name !== 'O:I — the mark') fail('default expression', `boot opened "${doc.id}" / "${doc.name}"`);
  else if (doc.scenes.map(s => s.name).join(',') !== 'Day,Night') fail('default expression scenes', doc.scenes.map(s => s.name).join(','));
  else if (doc.scenes.some(s => s.entities.map(e => e.text).join('') !== 'OI')) fail('default expression mark', 'the scenes do not carry the O and I');
  else ok('the default opened expression is the O:I mark', 'one expression, two scenes: Day (ink on paper) and Night (light in the dark)');

  const orbit = await page.evaluate(() => {
    const el = document.getElementById('orbit-control');
    if (!el) return null;
    const c = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {position: c.position, left: c.left, bottom: c.bottom, viewportBottomGap: innerHeight - box.bottom};
  });
  if (!orbit) fail('orbit control present', 'no #orbit-control element');
  else if (orbit.position !== 'fixed' || parseFloat(orbit.left) !== 12 || !(parseFloat(orbit.bottom) >= 60) || orbit.viewportBottomGap > 120) fail('orbit bottom-left anchor', JSON.stringify(orbit));
  else ok('the orbit controller anchors BOTTOM-LEFT', `fixed, left ${orbit.left}, bottom ${orbit.bottom}, ${Math.round(orbit.viewportBottomGap)}px from the viewport floor (bottom governs, top reads as its used value)`);

  const masthead = await page.evaluate(() => {
    const el = document.querySelector('.masthead');
    const c = getComputedStyle(el);
    return {height: c.height, paddingLeft: c.paddingLeft};
  });
  if (parseFloat(masthead.height) !== 32 || parseFloat(masthead.paddingLeft) !== 12) fail('masthead default geometry', JSON.stringify(masthead));
  else ok('the masthead holds its 32px row', `height ${masthead.height}, padding-left ${masthead.paddingLeft} (standalone default)`);

  await page.evaluate(() => { window.postMessage({type: 'oi-shell-cutout', width: 116, height: 32}, '*'); });
  await page.waitForTimeout(300);
  const aligned = await page.evaluate(() => {
    const c = getComputedStyle(document.querySelector('.masthead'));
    return {height: c.height, paddingLeft: c.paddingLeft};
  });
  if (parseFloat(aligned.paddingLeft) !== 126) fail('masthead cutout alignment', `after a 116px cutout the masthead padding-left reads ${aligned.paddingLeft}`);
  else ok('the masthead aligns with the posted shell cutout', `padding-left ${aligned.paddingLeft} = cutout 116 + 10 breath, height ${aligned.height}`);

  await page.goto(`${appUrl}?expression=source-twelve-faces`);
  await page.waitForFunction(() => window.__FIELD_STUDIES__, {timeout: 20000});
  const face = await page.evaluate(() => window.__FIELD_STUDIES__.getDocument());
  if (face.id !== 'source-twelve-faces' || face.name !== 'Twelve faces · one mask') fail('expression deep link', `?expression= opened "${face.id}" / "${face.name}"`);
  else ok('?expression= deep-links the Epii face', `${face.scenes.length} masks, one expression`);

  if (errors.length) fail('no console errors', errors.slice(0, 4).join(' | '));
  else ok('no console errors', 'boot, default, orbit, cutout and deep link all quiet');
} catch (cause) {
  fail('standalone app', cause instanceof Error ? cause.message : String(cause));
}

// ---- (3) the cradle host under the walk bridge --------------------------
try {
  const host = await browser.newPage({viewport: {width: 1440, height: 900}});
  const hostErrors = [];
  host.on('pageerror', e => hostErrors.push('pageerror: ' + e.message));
  host.on('console', m => { if (m.type() === 'error') hostErrors.push('console: ' + m.text()); });
  await host.addInitScript(bridge => { try {
    window.__OI_KERNEL_BRIDGE__ = bridge;
    sessionStorage.setItem('oi-cradle.welcome.v1', 'probe');
    localStorage.setItem('oi-cradle.welcome.v1', 'probe');
  } catch {} }, bridgeUrl);
  await host.goto(url);
  await host.waitForSelector('.desktop-shell', {timeout: 20000});
  await host.waitForTimeout(1200);
  await host.locator('.world-mode-strip [data-mode="expressions"]').click();
  await host.waitForSelector('.pcd-host[data-state="ready"]', {timeout: 30000});
  const frameSrc = String(await host.locator('.pcd-host-frame').getAttribute('src'));
  const decoded = decodeURIComponent(frameSrc);
  if (!decoded.includes(DIST_PATH)) fail('the host serves the vendored build', `frame src does not carry the vendored dist: ${frameSrc.slice(0, 140)}`);
  else ok('the Expressions centre serves the vendored build through the seam', `data-state=ready on ${DIST_PATH}/index.html`);
  const appFrame = host.frames().find(f => f !== host.mainFrame());
  if (!appFrame) fail('the hosted application frame', 'no child frame stood up');
  else {
    try {
      await appFrame.waitForFunction(() => window.__FIELD_STUDIES__, {timeout: 20000});
      const hosted = await appFrame.evaluate(() => window.__FIELD_STUDIES__.getDocument());
      if (hosted.id !== 'oi-mark') fail('the hosted application opens the default', `hosted document is "${hosted.id}"`);
      else ok('the hosted application boots inside the cradle', `default expression "${hosted.name}" in the served frame`);
    } catch (cause) {
      fail('the hosted application boots', cause instanceof Error ? cause.message : String(cause));
    }
  }
  if (hostErrors.length) fail('host page quiet', hostErrors.slice(0, 4).join(' | '));
  else ok('the host page is quiet');
  await host.close();
} catch (cause) {
  fail('cradle host', cause instanceof Error ? cause.message : String(cause));
}

await browser.close();
staticServer.kill();
bridge.kill();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
