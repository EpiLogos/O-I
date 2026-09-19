// library-horizons-probe — the two navigation horizons inside the REAL
// Expressions Library (owner direction 2026-09-19).
//
// The vendored app (expressions-app/dist) IS the O:I Expressions
// application. This probe enters the cradle shell's Expressions mode,
// opens the Library inside the hosted application and asserts:
//  (1) the two horizons — MY WORLD / PERSONAL and O:I WEB / SHARED — are
//      present and switchable inside the one Library page;
//  (2) the #375 scopes render as collection sections in MY WORLD:
//      current project/world first, project collections, personal
//      collections, kernel-held expressions, curated Epi-Logos corpus;
//  (3) the established Library interaction still works: cards render,
//      search operates over native subjects, opening the current
//      expression closes the Library onto the same expression;
//  (4) O:I WEB shows the exact named unavailable state — projected
//      worlds are not reachable from this application yet, the
//      SharedField provider is the native owner — and never invents
//      shared results;
//  (5) the kernel-held section resolves to an honest state (rows / empty
//      / channel-not-announced / refused) and never stays pending.
//
// Usage: node walk/library-horizons-probe.mjs
//   DESK_URL (default http://localhost:1421/) — the running dev shell.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const url = process.env.DESK_URL ?? 'http://localhost:1421/';
const bridgePort = process.env.HORIZONS_BRIDGE_PORT ?? '4231';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const artifactDir = join(cradleRoot, 'walk', 'artifacts');

const fails = [];
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);
const fail = (step, detail = '') => { console.log(`FAIL ${step}${detail ? ` · ${detail}` : ''}`); fails.push(step); };
const PROJECTED_WORLDS_UNAVAILABLE = 'Projected worlds are not reachable from this application yet — the SharedField provider is the native owner.';

// ---- the walk bridge: the kernel transport the cradle relays through ----
const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {stdio: ['ignore', 'pipe', 'pipe']});
bridge.stderr.on('data', chunk => process.stderr.write(chunk));
const started = Date.now();
while (Date.now() - started < 240_000) {
  try { if ((await fetch(`${bridgeUrl}/state`)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}
if (!(await fetch(`${bridgeUrl}/state`).catch(() => null))?.ok) { console.log('FAIL bridge: did not come up'); bridge.kill(); process.exit(1); }
ok('walk bridge up', `${bridgeUrl} (${Math.round((Date.now() - started) / 1000)}s)`);

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.addInitScript(bridge => { try {
    window.__OI_KERNEL_BRIDGE__ = bridge;
    sessionStorage.setItem('oi-cradle.welcome.v1', 'probe');
    localStorage.setItem('oi-cradle.welcome.v1', 'probe');
  } catch {} }, bridgeUrl);
  await page.goto(url);
  await page.waitForSelector('.desktop-shell', {timeout: 20000});
  await page.waitForTimeout(1200);

  // ---- enter the Expressions mode of the shell -------------------------
  await page.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.waitForSelector('.pcd-host[data-state="ready"]', {timeout: 30000});
  ok('the Expressions centre is ready', 'the cradle hosts the vendored application');
  const appFrame = page.frames().find(f => f !== page.mainFrame());
  if (!appFrame) throw new Error('no hosted application frame stood up');
  await appFrame.waitForFunction(() => window.__FIELD_STUDIES__, {timeout: 20000});
  const beforeDoc = await appFrame.evaluate(() => window.__FIELD_STUDIES__.getDocument());
  ok('the hosted application boots', `current expression "${beforeDoc.name}"`);

  // ---- open the Library inside the hosted app --------------------------
  // At the hosted frame's width the workspace cluster collapses behind the
  // header menu toggle; open it first, then the Expression library item.
  const openLibraryThrough = async () => {
    await appFrame.evaluate(() => {
      const cluster = document.querySelector('.header-cluster.workspace-cluster');
      const button = cluster?.querySelector('.header-menu-toggle');
      if (cluster && button && !cluster.classList.contains('is-open')) button.click();
    });
    await appFrame.locator('[data-action="library"]').click();
    await appFrame.waitForSelector('.oi-lib-horizons', {timeout: 10000});
  };
  await openLibraryThrough();

  // (1) the two horizons, present and switchable
  const horizons = await appFrame.evaluate(() => Array.from(document.querySelectorAll('#library-page .oi-lib-horizon')).map(b => ({
    section: b.dataset.section, name: b.querySelector('.oi-lib-horizon-name')?.textContent,
    active: b.getAttribute('aria-current') === 'page',
  })));
  const world = horizons.find(h => h.section === 'collection');
  const web = horizons.find(h => h.section === 'collection:web');
  if (horizons.length !== 2 || world?.name !== 'MY WORLD' || web?.name !== 'O:I WEB') fail('two horizons present', JSON.stringify(horizons));
  else ok('two horizons are present', 'MY WORLD / PERSONAL and O:I WEB / SHARED');
  if (!world?.active) fail('MY WORLD is the default horizon', JSON.stringify(horizons));
  else ok('MY WORLD / PERSONAL is the default horizon');

  // (2) the #375 scopes render as collection sections in MY WORLD
  const scopes = await appFrame.evaluate(() => Array.from(document.querySelectorAll('#library-page [data-scope]')).map(s => ({
    scope: s.dataset.scope, heading: s.querySelector('h2')?.textContent ?? '',
    cards: s.querySelectorAll('.expression-card').length,
  })));
  const scopeNames = scopes.map(s => s.scope);
  for (const expected of ['current-project', 'project-collections', 'personal-collections', 'kernel-held', 'curated-corpus'])
    if (!scopeNames.includes(expected)) fail(`scope section ${expected}`, `rendered: ${scopeNames.join(', ')}`);
  if (['current-project', 'project-collections', 'personal-collections', 'kernel-held', 'curated-corpus'].every(s => scopeNames.includes(s)))
    ok('the #375 scopes render as collection sections', scopeNames.join(', '));
  if (scopes[0]?.scope !== 'current-project') fail('current project/world renders first', JSON.stringify(scopes.map(s => s.scope)));
  else ok('current project / world renders first', `${scopes[0].cards} cards, heading "${scopes[0].heading}"`);
  const currentName = await appFrame.evaluate(() => document.querySelector('#library-page [data-scope="current-project"] .expression-card strong')?.textContent ?? '');
  if (currentName !== beforeDoc.name) fail('the current expression opens the world section', `"${currentName}" vs "${beforeDoc.name}"`);
  else ok('the current expression leads its world section', currentName);
  if ((scopes.find(s => s.scope === 'curated-corpus')?.cards ?? 0) < 1) fail('curated Epi-Logos corpus cards', JSON.stringify(scopes));
  else ok('the curated Epi-Logos corpus renders its source studies', `${scopes.find(s => s.scope === 'curated-corpus')?.cards} studies`);
  await page.screenshot({path: join(artifactDir, 'library-horizons-my-world.png')});

  // (3) established interactions: cards, search, opening the current work
  const cardCount = await appFrame.evaluate(() => document.querySelectorAll('#library-page .expression-card').length);
  if (cardCount < 4) fail('library cards render', `${cardCount} cards`);
  else ok('the established card grammar renders', `${cardCount} cards across the scopes`);

  await appFrame.fill('#library-search', 'kundalini');
  await appFrame.waitForTimeout(200);
  const searched = await appFrame.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#library-page [data-starting-card]'));
    return {visible: items.filter(i => !i.hidden).length, total: items.length};
  });
  if (searched.visible < 1) fail('library search operates', JSON.stringify(searched));
  else ok('search operates over native subjects', `${searched.visible}/${searched.total} starting cards match "kundalini"`);
  await appFrame.fill('#library-search', 'zzzqqqnothing');
  await appFrame.waitForTimeout(200);
  const emptyShown = await appFrame.evaluate(() => { const el = document.getElementById('library-empty'); return !!el && !el.hidden; });
  if (!emptyShown) fail('search empty note', '#library-empty did not show for a non-matching query');
  else ok('the search empty note shows honestly', 'no invented matches for a non-matching query');
  await appFrame.fill('#library-search', '');
  await appFrame.waitForTimeout(200);

  await appFrame.locator('#library-page .expression-open[data-action="load-saved"]').first().click();
  await appFrame.waitForTimeout(400);
  const afterOpen = await appFrame.evaluate(() => ({open: window.__FIELD_STUDIES__.getState().libraryOpen, doc: window.__FIELD_STUDIES__.getDocument()}));
  if (afterOpen.open) fail('opening the current expression closes the library', 'the library stayed open');
  else if (afterOpen.doc.id !== beforeDoc.id) fail('opening keeps the expression', `"${afterOpen.doc.id}" vs "${beforeDoc.id}"`);
  else ok('opening the current expression works', `the library returned to the field on "${afterOpen.doc.name}"`);

  // back into the library for the shared horizon
  await openLibraryThrough();

  // (1b) switch to O:I WEB / SHARED
  await appFrame.locator('#library-page .oi-lib-horizon[data-section="collection:web"]').click();
  await appFrame.waitForTimeout(300);
  const webState = await appFrame.evaluate(() => ({
    section: window.__FIELD_STUDIES__.getState().librarySection,
    eyebrow: document.querySelector('#library-page .library-title .eyebrow')?.textContent ?? '',
    heading: document.querySelector('#library-page .library-title h1')?.textContent ?? '',
    note: document.querySelector('#library-page [data-scope="projected-worlds"] .oi-lib-note')?.textContent ?? '',
    inventedCards: document.querySelectorAll('#library-page [data-scope="projected-worlds"] .expression-card').length,
    filebarGone: !document.querySelector('#library-page .expression-filebar'),
  }));
  if (webState.section !== 'collection:web') fail('horizon switches', `librarySection is ${webState.section}`);
  else ok('the horizon switches to O:I WEB / SHARED', 'state rides the Library\'s own section machinery');
  if (webState.eyebrow !== 'O:I WEB / SHARED' || webState.heading !== 'The shared field.') fail('shared horizon title', JSON.stringify(webState));
  else ok('the shared horizon carries its own title', `${webState.eyebrow} — ${webState.heading}`);
  if (!webState.note.includes(PROJECTED_WORLDS_UNAVAILABLE)) fail('named unavailable state', webState.note.slice(0, 140));
  else ok('projected worlds show the exact named unavailable state', 'no shared provider on this cut, named as such');
  if (webState.inventedCards !== 0) fail('no invented shared results', `${webState.inventedCards} cards rendered in the projected-worlds scope`);
  else ok('no invented shared results', 'the shared scope renders prose, never fake world cards');
  await page.screenshot({path: join(artifactDir, 'library-horizons-oi-web.png')});

  // (1c) switch back — the world keeps its place
  await appFrame.locator('#library-page .oi-lib-horizon[data-section="collection"]').click();
  await appFrame.waitForTimeout(300);
  const backState = await appFrame.evaluate(() => ({
    section: window.__FIELD_STUDIES__.getState().librarySection,
    name: document.querySelector('#library-page input[data-bind="journey.name"]')?.value ?? '',
    scopes: document.querySelectorAll('#library-page [data-scope]').length,
  }));
  if (backState.section !== 'collection' || backState.name !== beforeDoc.name || backState.scopes < 4)
    fail('switching back restores the world horizon', JSON.stringify(backState));
  else ok('switching back restores MY WORLD with the current expression', `"${backState.name}", ${backState.scopes} scope sections`);

  // (5) the kernel-held section resolves honestly
  const kernel = await appFrame.evaluate(async () => {
    const list = document.querySelector('#library-page [data-kernel-list]');
    for (let waited = 0; waited < 8000; waited += 250) {
      if (list?.getAttribute('data-kernel-state') && list.getAttribute('data-kernel-state') !== 'pending') break;
      await new Promise(r => setTimeout(r, 250));
    }
    return {
      state: list?.getAttribute('data-kernel-state') ?? 'missing',
      text: list?.textContent?.trim().slice(0, 180) ?? '',
      rows: list?.querySelectorAll('.oi-lib-kernel-row').length ?? 0,
      refs: Array.from(list?.querySelectorAll('.oi-lib-kernel-ref') ?? []).slice(0, 4).map(n => n.textContent),
    };
  });
  if (!['absent', 'error', 'empty', 'rows'].includes(kernel.state)) fail('kernel section honest state', JSON.stringify(kernel));
  else if (kernel.state === 'absent') ok('kernel section shows the honest unavailable state', 'the host channel is not announced in this cut');
  else if (kernel.state === 'rows') ok('kernel-held expressions read live', `${kernel.rows} rows · ${kernel.refs?.join(', ')}`);
  else ok(`kernel section resolves honestly (${kernel.state})`, kernel.text.slice(0, 90));
  const receipt = {when: new Date().toISOString(), desk_url: url, bridge: bridgeUrl, horizons, my_world_scopes: scopes, shared: webState, back: backState, kernel, console_errors: errors};
  writeFileSync(join(artifactDir, 'library-horizons.json'), JSON.stringify(receipt, null, 2));
} catch (cause) {
  fail('probe run', cause instanceof Error ? cause.message : String(cause));
  try { await page.screenshot({path: join(artifactDir, 'library-horizons-failure.png')}); } catch {}
}

if (errors.length) fail('host and frame quiet', errors.slice(0, 4).join(' | '));
else ok('host and frame quiet', 'no console or page errors through the whole walk');

await browser.close();
bridge.kill();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
