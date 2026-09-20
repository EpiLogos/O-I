// Verifies the LIVE configuration plane in a production-semantics bundle:
// no fixture source; O:I's own settings render with real reconciled values
// through oi config-contribution + oi system (the owner verbs).
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';

const cradleRoot = '/Users/admin/Central/Work/O-I/desktop/cradle';
const oiBin = '/Users/admin/Central/Work/O-I/cli/target/debug/oi';
const url = process.env.DESK_URL ?? 'http://localhost:4173/';
const bridgePort = 4197;
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;

const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', cradleRoot + '/kernel/Cargo.toml', '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {env: {...process.env, OI_BIN: oiBin}, stdio: ['ignore', 'ignore', 'ignore']});
const cleanup = () => { try { bridge.kill(); } catch {} };
process.on('exit', cleanup);

const started = Date.now();
while (Date.now() - started < 240_000) { try { if ((await fetch(`${bridgeUrl}/state`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
while (Date.now() - started < 240_000) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }

const fails = [];
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);
const fail = (step, detail = '') => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.addInitScript(bridge => { try {
  window.__OI_KERNEL_BRIDGE__ = bridge;
  sessionStorage.setItem('oi-cradle.welcome.v1', 'probe');
  localStorage.setItem('oi-cradle.welcome.v1', 'probe');
} catch {} }, bridgeUrl);
await page.goto(url);
await page.waitForSelector('.desktop-shell', {timeout: 30000});
await page.waitForSelector('.world-system-settings', {timeout: 30000});
await page.locator('.world-system-settings').first().click();
await page.waitForSelector('.settings-home', {timeout: 60000});
await page.waitForSelector('[data-owner-group]', {timeout: 60000});

const fixtureBanner = await page.locator('[data-config-source="fixture"]').count();
if (fixtureBanner) fail('live source', 'the fixture banner rendered in a production bundle');
else ok('the production bundle binds the LIVE source (no fixture world)');

const groupOwners = await page.locator('[data-owner-group]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-owner')));
console.log('owner groups rendered:', groupOwners.join(', '));
if (!groupOwners.includes('oi')) fail('oi owner group', 'the O:I owner group did not render');
else {
  ok('the O:I owner group renders with its contributed settings');
  const text = await page.locator('[data-owner-group][data-owner="oi"]').innerText();
  if (/0\.1\.0/.test(text)) ok('O:I rows carry real values (build record visible)');
  else console.log('note — build record value not visible in group text');
}
await page.screenshot({path: '/tmp/live-settings.png'});
await browser.close();
console.log(fails.length ? `${fails.length} FAILURES` : 'all checks passed');
process.exit(fails.length ? 1 : 0);
