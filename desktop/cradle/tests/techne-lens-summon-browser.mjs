/** The Lens Studio summon, END TO END in the real hosted application (owner
 * direction 2026-09-23: press the button IN the app and the instruments open).
 *
 * Acts, all against real artefacts — the built vendored application, the real
 * walk bridge serving Central's disclosed ground, the real TechneCentre, the
 * real instrument HUD and its registered M0′–M5′ lenses, the live wiki
 * reading provider:
 *   (1) The application boots in the Technē cut inside the hosted frame with
 *       its Lens Studio chooser standing; the HUD is collapsed over the live
 *       field, the field running.
 *   (2) Pressing the application's own M1′ chooser button summons the deep
 *       instruments: the HUD opens on the Canvas instrument over the SAME
 *       field, the field suspends (display:none), and the pane carries the
 *       real Canvas/Constellation aperture with the live register's nodes.
 *   (3) The live ground is disclosed honestly: M4′ Places reads unavailable on
 *       Central's register (it carries no place ground) and seats the honest
 *       state — and no fixture content (a Londinium) appears anywhere.
 *   (4) Collapsing returns to the resumed field; pressing the same chooser
 *       button again re-opens the instrument (the summon re-delivers).
 *   (5) The keyboard path (arrow roving in the application's chooser)
 *       summons exactly like a pointer press.
 *
 * Run: node tests/techne-lens-summon-browser.mjs   (Chromium via Playwright,
 * swiftshader; the walk bridge binary must exist or cargo must build it)
 *
 * GROUND-BOUND proof: the hosted frame is served through the walk bridge, whose
 * file routes resolve against the real Central ground (the `oi` owner seam) —
 * this walk therefore runs where the ground lives, on the owner's machine, the
 * same class as walk/expressions-app-vendored-probe.mjs. It is deliberately
 * NOT in CI: a CI runner carries no personal ground, and a fabricated one
 * would make this a fixture proving itself (the exact failure this walk
 * exists to replace).
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {createServer as createProbeServer} from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** One free loopback port, claimed and released before the bridge binds it. */
const freePort = () => new Promise((done, fail) => {
  const probe = createProbeServer();
  probe.listen(0, '127.0.0.1', () => {
    const {port} = probe.address();
    probe.close(() => done(port));
  });
  probe.on('error', fail);
});

// ---- the real bridge over real Central ground --------------------------------
const bridgeBinary = resolve(root, 'kernel/target/debug/walk-bridge');
const spawnBridge = (addr) => existsSync(bridgeBinary)
  ? spawn(bridgeBinary, [addr], {stdio: ['ignore', 'pipe', 'pipe']})
  : spawn('cargo', ['run', '--quiet', '--manifest-path', resolve(root, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', addr], {stdio: ['ignore', 'pipe', 'pipe']});
const bridgePort = await freePort();
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const bridge = spawnBridge(`127.0.0.1:${bridgePort}`);
bridge.stderr.on('data', chunk => process.stderr.write(chunk));
const bridgeUp = await new Promise((done) => {
  const started = Date.now();
  const probe = async () => {
    try { if ((await fetch(`${bridgeUrl}/state`)).ok) return done(true); } catch { /* not up yet */ }
    if (Date.now() - started > 240_000) return done(false);
    setTimeout(probe, 500);
  };
  probe();
});
if (!bridgeUp) { console.log('FAIL: the walk bridge did not come up'); bridge.kill(); process.exit(1); }

// The built application must exist — the one build law (expressions-app/README).
if (!existsSync(resolve(root, 'expressions-app/dist/index.html'))) {
  console.log('FAIL: the Expressions application is not built — cd expressions-app && npm run build');
  bridge.kill();
  process.exit(1);
}

// ---- the cradle dev server carrying the probe page ---------------------------
const server = await createServer({root, appType: 'custom', server: {host: '127.0.0.1', port: 0, strictPort: false}, logLevel: 'error'});
server.middlewares.use('/techne-lens-summon', async (_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(await server.transformIndexHtml('/techne-lens-summon', '<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/techne-lens-summon-page.tsx"></script></body>'));
});
await server.listen();
const port = server.httpServer.address().port;

const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
const page = await browser.newPage({viewport: {width: 1280, height: 860}});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const LENSES = ['project', 'canvas', 'timeline', 'journey', 'place', 'palace'];
const fieldDisplay = () => page.$eval('.techne-centre-field', (el) => el.style.display || '');
const receipt = {
  schema: 'oi.techne-lens-summon/v1',
  standing: 'the application chooser summons the real deep instruments over the live field, in the real hosted application',
  passed: false,
};

try {
  await page.addInitScript((url) => { window.__OI_KERNEL_BRIDGE__ = url; }, bridgeUrl);
  await page.goto(`http://127.0.0.1:${port}/techne-lens-summon`);

  // (1) The real centre hosts the real application; the HUD starts collapsed
  // over the running field.
  await page.waitForSelector('.pcd-host[data-state="ready"]', {timeout: 45_000});
  await page.waitForSelector('.techne-hud--collapsed', {timeout: 20_000});
  assert.notEqual(await fieldDisplay(), 'none', 'the field runs while the HUD is collapsed');
  const frame = page.frameLocator('.pcd-host-frame');
  await frame.locator('#lens-chooser:not([hidden])').waitFor({timeout: 45_000});
  const choices = await frame.locator('#lens-chooser .lens-choice').evaluateAll((nodes) => nodes.map((n) => n.dataset.lens));
  assert.deepEqual(choices, LENSES, 'the application chooser carries M0′–M5′ in order');

  // (2) Press the application's own M1′ button: the summon opens the HUD on
  // the real Canvas instrument over the same, now suspended, field.
  await frame.locator('#lens-chooser .lens-choice[data-lens="canvas"]').click();
  await page.waitForSelector('.techne-hud:not(.techne-hud--collapsed)', {timeout: 20_000});
  assert.equal(await fieldDisplay(), 'none', 'opening the HUD suspends the field (display:none)');
  const current = await page.$$eval('.techne-hud-lens', (els) => els.find((e) => e.getAttribute('data-current') === 'true')?.textContent ?? '');
  assert.match(current, /Canvas/, 'the HUD stands on the summoned Canvas instrument');
  await page.waitForSelector('.techne-hud-pane .techne-canvas', {timeout: 20_000});
  const nodes = await page.locator('.techne-hud-pane .techne-canvas-node-circle').count();
  assert.ok(nodes >= 1, `the real Canvas aperture renders the live register's nodes (${nodes} drawn)`);
  receipt.canvasNodes = nodes;

  // (3) The live ground is disclosed honestly — Central's register carries no
  // place ground, and no fixture content exists anywhere in the instrument.
  const availability = await page.$$eval('.techne-hud-lens', (els) => Object.fromEntries(els.map((e) => [(e.querySelector('.techne-hud-lens-label')?.textContent || '').replace(/ .*/, ''), e.getAttribute('data-available')])));
  assert.equal(availability['World'], 'false', 'M4′ Places is honestly unavailable on the live register');
  await page.$$eval('.techne-hud-lens', (els) => { const b = els.find((e) => /World|Places/.test(e.textContent || '')); if (b) b.click(); });
  await page.waitForSelector('.techne-hud-pane .tn-m0m5-state', {timeout: 20_000});
  const paneText = await page.$eval('.techne-hud-pane', (e) => e.textContent || '');
  assert.ok(/unavailable/i.test(paneText), 'the place instrument seats its honest unavailable state');
  assert.ok(!/Londinium|Avalon/.test(paneText), 'no fixture place is fabricated on the live ground');
  await page.screenshot({path: resolve(root, 'walk/artifacts/techne-lens-summon-hud.png')});

  // (4) Collapse returns to the resumed field; the same button re-opens.
  await page.click('.techne-hud-collapse');
  await page.waitForSelector('.techne-hud--collapsed', {timeout: 20_000});
  assert.notEqual(await fieldDisplay(), 'none', 'collapsing resumes the field');
  await frame.locator('#lens-chooser .lens-choice[data-lens="canvas"]').click();
  await page.waitForSelector('.techne-hud:not(.techne-hud--collapsed)', {timeout: 20_000});
  assert.equal(await fieldDisplay(), 'none', 'pressing the same chooser button re-opens the instrument');

  // (5) The keyboard path summons exactly like a press: with the field standing
  // again, focus the application's chooser (M1′ is still the active lens from
  // the re-press) and arrow-rove — the roving routes through the same select
  // path, so the HUD opens on the next instrument, M2′ Relation · Timeline.
  await page.click('.techne-hud-collapse');
  await page.waitForSelector('.techne-hud--collapsed', {timeout: 20_000});
  assert.notEqual(await fieldDisplay(), 'none', 'the field stands again before the keyboard pass');
  await frame.locator('#lens-chooser .lens-choice[data-lens="canvas"]').evaluate((el) => el.focus());
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.techne-hud:not(.techne-hud--collapsed)', {timeout: 20_000});
  const keyboardCurrent = await page.$$eval('.techne-hud-lens', (els) => els.find((e) => e.getAttribute('data-current') === 'true')?.textContent ?? '');
  assert.match(keyboardCurrent, /Timeline/, 'the keyboard roving path summoned the next instrument');
  await page.click('.techne-hud-collapse');
  await page.waitForSelector('.techne-hud--collapsed', {timeout: 20_000});
  assert.notEqual(await fieldDisplay(), 'none', 'the field stands again after the walk');

  assert.deepEqual(errors, [], `no uncaught errors (${errors.join('; ')})`);
  receipt.passed = true;
  if (process.env.TECHNE_EVIDENCE_DIR) {
    const dir = process.env.TECHNE_EVIDENCE_DIR;
    mkdirSync(dir, {recursive: true});
    writeFileSync(resolve(dir, 'lens-summon-receipt.json'), JSON.stringify(receipt, null, 2));
  }
  console.log(`Technē lens summon: the application's own chooser opens the real deep instruments over the live field — Canvas aperture rendered ${receipt.canvasNodes} live register nodes, M4′ honestly unavailable, collapse/re-press and the keyboard path verified.`);
} finally {
  await browser.close();
  await server.close();
  bridge.kill();
}
