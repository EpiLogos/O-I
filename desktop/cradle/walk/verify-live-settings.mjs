// Verifies the LIVE configuration plane in a production-semantics bundle:
// no fixture source; every owner group's settings render with real
// reconciled values through oi config list + config_registry_read +
// oi config show (the owner verbs) — row by row, in the P2 disclosure
// order of docs/cradle/06-SYSTEM-SETTINGS §8.
//
// Invocation (the documented one): serve a plain production bundle
// (`npm run build`, no WALK) on $DESK_URL (default http://localhost:4173)
// — e.g. `node node_modules/.bin/vite preview --port 4173 --strictPort` —
// then `node walk/verify-live-settings.mjs`. The script spawns its own
// walk bridge (the real kernel seam) on port 4197 and reads the live
// listing through the same `oi` executable the bridge drives.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALL_GROUPS, assertOwnerGroupLive, readLiveListing, readRegistryViaBridge} from './live-settings-acceptance.mjs';

const cradleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oiBin = process.env.OI_BIN ?? resolve(cradleRoot, '../../cli/target/debug/oi');
const url = process.env.DESK_URL ?? 'http://localhost:4173/';
const bridgePort = Number(process.env.WALK_BRIDGE_PORT ?? 4197);
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;

if (!existsSync(oiBin)) {
  console.log(`FAIL oi executable: ${oiBin} is not present — build the cli dev tree or set OI_BIN`);
  process.exit(1);
}

const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', cradleRoot + '/kernel/Cargo.toml', '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {env: {...process.env, OI_BIN: oiBin}, stdio: ['ignore', 'ignore', 'ignore']});
const cleanup = () => { try { bridge.kill(); } catch {} };
process.on('exit', cleanup);

const started = Date.now();
while (Date.now() - started < 240_000) { try { if ((await fetch(`${bridgeUrl}/state`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
while (Date.now() - started < 240_000) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }

const fails = [];
const oks = [];
const ok = (step, detail = '') => { console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`); oks.push(step); };
const fail = (step, detail = '') => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const check = (good, step, data) => { if (good) ok(step, data ? JSON.stringify(data) : ''); else fail(step, data ? JSON.stringify(data) : ''); };

// The live owner reads BEFORE the page: what the owners disclose is the
// expectation the rendered surface is held against (the round trip).
const listing = readLiveListing(oiBin);

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
await page.waitForSelector('[data-settings-page]', {timeout: 60000});
await page.waitForSelector('[data-settings-navigator]', {timeout: 60000});

// 12-SETTINGS §5: a production bundle has no fixture world at all.
const fixtureLabel = await page.locator('[data-config-source="fixture"]').count();
if (fixtureLabel) fail('live source', 'the fixture label rendered in a production bundle');
else ok('the production bundle binds the LIVE plane (no fixture world)');

const registry = await readRegistryViaBridge(bridgeUrl);
console.log('product pages listed:', (await page.locator('[data-settings-product]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-settings-product')))).join(', '));

const verdicts = {};
for (const owner of ALL_GROUPS) {
  verdicts[owner] = await assertOwnerGroupLive({page, owner, listing, registry, registryBridgeUrl: bridgeUrl, check});
}
await page.screenshot({path: '/tmp/live-settings.png'});
await browser.close();

console.log('per-group verdicts:');
for (const [owner, verdict] of Object.entries(verdicts)) console.log(`  ${owner}: ${verdict}`);
console.log(fails.length ? `${fails.length} FAILURES` : `all checks passed (${oks.length} ok)`);
process.exit(fails.length ? 1 : 0);
