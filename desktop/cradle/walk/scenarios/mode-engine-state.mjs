// mode-engine-state — the mode-centre engine persistence vertical.
//
// The owner's report: every mode round trip reboots the Expressions vendored
// application and Technè, losing their in-memory state. The cause under the
// park-and-adopt presentation: presenting a centre MOVES its container
// between the hidden park and the presenting outlet, and moving a DOM
// subtree that contains an iframe detaches it — the iframe re-navigates and
// the hosted application boots from scratch.
//
// First pass (the stage law): enter the Expressions mode (the real vendored
// application) → mark in-app state through the app's OWN UI (open its
// Library) → stamp the frame node (parent-side data attribute) and the frame
// document (an in-page token a fresh execution cannot have) → switch to
// Technè, mark its centre the same way → return to Expressions: the SAME
// iframe node, the SAME document token, and the Library still open → return
// to Technè: the same three assertions, mirrored → with both centres
// visited, exactly ONE hosted application instance per mode in the whole DOM
// (no double mount).
//
// Second pass (spec §7/§8):
//   PANE-TAB legs — a centre opened as an ordinary pane tab in a FOREIGN
//   tree (here: the Expressions centre into the Technè tree, through the
//   shell's own left-navigator path) mounts IN PLACE in the pane's own
//   wrapper — no park, no outlet, no adopt — and its node, document and
//   in-app state survive mode switches away and back because its tree now
//   SHELVES (the widened warm-tree criterion: a foreign-tree centre is a
//   shelving reason). The stage-owned instances stay distinct: one hosted
//   instance per BINDING, never a second copy of one binding.
//   RESTART leg — with a DIFFERENT expression opened through the app's own
//   Library, the shell CHECKPOINTS the current expression ref onto the
//   binding (debounced, from the app's own oi-app-state announcements); a
//   renderer restart (page.reload) remounts the stage slot and the app is
//   deep-linked `?expression=<ref>` through its own boot grammar — the SAME
//   expression comes back on screen.
import { mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const cradleRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_DIST_SOURCE = join(cradleRoot, 'expressions-app', 'dist');
const APP_DIST_CENTRAL_PATH = 'Work/O-I/desktop/cradle/expressions-app/dist';

export async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'oi-mode-engine-state-'));
  const home = mkdtempSync(join(tmpdir(), 'oi-mode-engine-state-home-'));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  try {
    const result = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', 'central.init', '{}'], { encoding: 'utf8' }));
    if (!result.ok) throw new Error(JSON.stringify(result));
    // The hosted application is served through the owner's files seam from
    // the Central root: place this checkout's built vendored app at the
    // path the host reads, so the walk is self-contained.
    const distTarget = join(root, APP_DIST_CENTRAL_PATH);
    mkdirSync(dirname(distTarget), { recursive: true });
    cpSync(APP_DIST_SOURCE, distTarget, { recursive: true });
    return {
      root,
      env: { OI_CENTRAL_ROOT: root, OI_HOME: home },
      cleanup: () => { rmSync(root, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); },
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    throw error;
  }
}

const MODE_STRIP = (mode) => `.world-mode-strip [data-mode="${mode}"]`;
const PRESENTED_FRAME = '.mode-stage:not([hidden]) iframe.pcd-host-frame';
const LIBRARY_BUTTON = {
  expressions: 'button[aria-label="Expression library"]',
  techne: '#tool-rail button[aria-label="Library — the map of the field"]',
};

export default async function run({ page, baseUrl, check, metric, shot, log }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const enterMode = async (mode) => {
    await page.locator(MODE_STRIP(mode)).click();
    await page.locator(`.desktop-shell[data-mode="${mode}"], .mode-stage:not([hidden])`).first().waitFor({ timeout: 15000 });
  };

  /** The presented centre's hosted application frame, booted: the host
   * resolved the vendored app and the frame element carries its document.
   * The in-frame waits are ATTACHED, never visible: the app's own Library
   * may legitimately still be open (that is the state the walk marks),
   * and it hides the working chrome while it stands. */
  const presentedAppFrame = async (mode) => {
    await page.locator(`.mode-stage:not([hidden]) .pcd-host[data-state="ready"]`).waitFor({ timeout: 30000 });
    const handle = await page.locator(PRESENTED_FRAME).first().elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (!frame) throw new Error(`the ${mode} centre's application frame did not present`);
    await frame.waitForSelector('#tool-rail button', { timeout: 30000, state: 'attached' });
    await frame.waitForFunction(() => !!window.__FIELD_STUDIES__, null, { timeout: 30000 });
    return { handle, frame };
  };

  /** Stamp the frame NODE (parent side — a remount loses the stamp) and the
   * frame DOCUMENT (an in-page token — a re-navigation mints a document
   * that cannot have it). */
  const stampCentre = async (mode, label) => {
    const { handle, frame } = await presentedAppFrame(mode);
    await handle.evaluate((el, stamp) => { if (el.dataset.walkStamp === undefined) el.dataset.walkStamp = stamp; }, label);
    const token = await frame.evaluate(() => (window.__oiWalkEngineToken ??= Math.random().toString(36).slice(2) + '.' + Date.now()));
    return { handle, frame, token };
  };

  /** The whole recorded identity of one mode's centre, read from wherever
   * the frame currently lives (presented, parked or shelved): the node
   * stamp, the document token, and the in-app state the app's own UI
   * holds (its Library open). The frame is cross-origin (the material
   * bridge serves it), so the reads run through the driver's frame
   * authority — the page itself could not reach in. */
  const identityOf = async (label) => {
    const handle = await page.locator(`iframe.pcd-host-frame[data-walk-stamp="${label}"]`).first().elementHandle().catch(() => null);
    if (!handle) return { present: false, token: null, libraryOpen: null, hostMode: null };
    const frame = await handle.contentFrame();
    if (!frame) return { present: true, token: null, libraryOpen: null, hostMode: null };
    try {
      const state = await Promise.race([
        frame.evaluate(() => ({
          token: window.__oiWalkEngineToken ?? null,
          libraryOpen: document.body.classList.contains('library-open'),
          hostMode: window.__FIELD_STUDIES__?.getState?.().hostMode ?? null,
        })),
        new Promise((resolve) => setTimeout(() => resolve({ token: null, libraryOpen: null, hostMode: null }), 1500)),
      ]);
      return { present: true, ...state };
    } catch {
      // A document mid-relation (navigating, about:blank) answers nothing —
      // recorded as absent, never guessed.
      return { present: true, token: null, libraryOpen: null, hostMode: null };
    }
  };

  /** Mark in-app state through the application's OWN controls: open its
   * Library. libraryOpen is live UI state (not in the app's boot recovery
   * record), so a rebooted application closes it. In the compact header
   * the lived cut's library control joins the workspace menu behind its
   * own toggle — the same route a person uses at this width. */
  const openAppLibrary = async (mode, frame) => {
    if (mode === 'expressions') {
      const compact = await frame.evaluate(() => {
        const cluster = document.querySelector('.header-cluster[data-compact-at]');
        const toggle = cluster?.querySelector('.header-menu-toggle');
        return !!(toggle && matchMedia(`(max-width: ${cluster.dataset.compactAt}px)`).matches && getComputedStyle(toggle).display !== 'none');
      });
      if (compact) await frame.click('.header-cluster[data-compact-at] .header-menu-toggle', { timeout: 15000 });
    }
    await frame.click(LIBRARY_BUTTON[mode], { timeout: 15000 });
    await frame.waitForFunction(() => document.body.classList.contains('library-open'), null, { timeout: 15000 });
  };

  // ---- boot, enter Expressions, mark everything ---------------------------
  await page.goto(baseUrl);
  await page.waitForSelector('.desktop-shell', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await enterMode('expressions');
  const t0 = Date.now();
  const expressions = await stampCentre('expressions', 'expressions');
  await openAppLibrary('expressions', expressions.frame);
  const expressionsOpen = await identityOf('expressions');
  check(expressionsOpen.token === expressions.token && expressionsOpen.libraryOpen === true,
    'The Expressions application is live, stamped, and holds in-app state (its Library open)', expressionsOpen);
  await shot('expressions-marked');
  log(`expressions boot+stamp ${Date.now() - t0}ms, token ${String(expressions.token).slice(0, 8)}`);

  // ---- switch to Technè, mark its centre ----------------------------------
  await enterMode('techne');
  const techne = await stampCentre('techne', 'techne');
  check(techne.frame !== expressions.frame, 'Technè presents its own application instance (a second centre, not a shared frame)', {});
  await openAppLibrary('techne', techne.frame);
  const techneOpen = await identityOf('techne');
  check(techneOpen.hostMode === 'techne' && techneOpen.libraryOpen === true,
    'Technè presents the deep cut of the application and holds its own in-app state', techneOpen);

  // While Technè stands: what happened to the Expressions centre?
  const duringExpressions = await identityOf('expressions');
  await shot('techne-marked');

  // ---- return to Expressions ----------------------------------------------
  await enterMode('expressions');
  await presentedAppFrame('expressions');
  await page.waitForTimeout(400);
  const expressionsBack = await identityOf('expressions');
  check(expressionsBack.present && expressionsBack.token === expressions.token,
    'RETURN/Expressions: the SAME application document came back (token kept — the frame never re-navigated)', { before: expressionsOpen.token, after: expressionsBack.token });
  check(expressionsBack.libraryOpen === true,
    'RETURN/Expressions: the in-app state survived — the Library the person opened is still open', { during: duringExpressions.libraryOpen, after: expressionsBack.libraryOpen });
  await shot('expressions-returned');

  // ---- return to Technè (mirror) -------------------------------------------
  await enterMode('techne');
  await presentedAppFrame('techne');
  await page.waitForTimeout(400);
  const techneBack = await identityOf('techne');
  check(techneBack.present && techneBack.token === techne.token,
    'RETURN/Technè: the SAME application document came back (token kept)', { before: techneOpen.token, after: techneBack.token });
  check(techneBack.libraryOpen === true,
    'RETURN/Technè: the in-app state survived — the Library is still open', techneBack);
  await shot('techne-returned');

  // ---- no double mount (stage-owned centres so far) ------------------------
  const counts = await page.evaluate(() => ({
    frames: document.querySelectorAll('iframe.pcd-host-frame').length,
    hosts: document.querySelectorAll('.pcd-host').length,
    stamped: [...document.querySelectorAll('iframe.pcd-host-frame[data-walk-stamp]')].map((el) => el.dataset.walkStamp),
    parks: document.querySelectorAll('.mode-centre-retention').length,
  }));
  check(counts.frames === 2 && counts.hosts === 2,
    'With both centres visited, exactly ONE hosted application instance per mode — no double mount', counts);
  check(counts.stamped.includes('expressions') && counts.stamped.includes('techne'),
    'Both centre frames are the stamped instances (the same nodes marked at first presentation)', counts.stamped);
  check(counts.parks === 0, 'The park layer is gone from the shell entirely (spec §7.1)', counts);

  // ==========================================================================
  // SECOND PASS — pane-tab centre legs (spec §7.1/§8)
  // ==========================================================================

  // ---- open the Expressions centre as a pane tab in the TECHNÈ tree -------
  // The shell's own path: the Technè mode's left navigator. With no
  // expressions in the kernel it offers New Expression; creating one opens
  // the Expressions centre as an ordinary tab in the CURRENT tree (the
  // frame's openModeSurface grammar) — a FOREIGN-tree centre.
  if (!(await page.locator('.xg-navigator').isVisible().catch(() => false))) {
    await page.locator('button[aria-label="Toggle left region"]').click();
  }
  await page.locator('.xg-navigator').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.xg-navigator button[aria-label="New Expression"]').first().click();
  // The new tab presents inside the Technè tree's own pane wrapper — the
  // tree stands hidden behind the stage, so the frame is ATTACHED, not
  // visible; wait for its host to resolve the vendored app.
  await page.locator('.warm-tree-host .surface-retained .pcd-host[data-state="ready"]').waitFor({ timeout: 30000, state: 'attached' });
  const paneHandle = await page.locator('.warm-tree-host iframe.pcd-host-frame').first().elementHandle();
  const paneFrame = paneHandle ? await paneHandle.contentFrame() : null;
  if (!paneFrame) throw new Error('the pane-tab centre frame did not present');
  await paneFrame.waitForSelector('#tool-rail button', { timeout: 30000, state: 'attached' });
  await paneFrame.waitForFunction(() => !!window.__FIELD_STUDIES__, null, { timeout: 30000 });
  await paneHandle.evaluate((el) => { if (el.dataset.walkStamp === undefined) el.dataset.walkStamp = 'pane-expressions'; });
  const paneToken = await paneFrame.evaluate(() => (window.__oiWalkEngineToken ??= Math.random().toString(36).slice(2) + '.' + Date.now()));
  const panePlacement = await paneHandle.evaluate((el) => ({
    inStage: !!el.closest('[data-mode-stage]'),
    inPark: !!el.closest('.mode-centre-retention'),
    inWarmTree: !!el.closest('.warm-tree-host'),
    outletWrapped: !!el.closest('.retained-centre-outlet'),
    wrapperHidden: el.closest('.surface-retained')?.hasAttribute('hidden') ?? null,
  }));
  check(!panePlacement.inStage && !panePlacement.inPark && !panePlacement.outletWrapped && panePlacement.inWarmTree,
    'The pane-tab centre mounts IN PLACE in the warm tree\'s own pane wrapper — no stage slot, no park, no outlet', panePlacement);
  check(panePlacement.wrapperHidden === false,
    'The pane-tab centre is its pane\'s presented tab (mounted-concealed only when its tab is switched away)', panePlacement);

  // Mark in-app state through the app's OWN UI, in-frame: the tab stands
  // behind the stage, so the clicks are dispatched to the app's own
  // controls inside its document (the same handlers a visible click runs).
  const openPaneLibrary = async () => {
    await paneFrame.evaluate((sel) => {
      const cluster = document.querySelector('.header-cluster[data-compact-at]');
      const toggle = cluster?.querySelector('.header-menu-toggle');
      if (toggle && matchMedia(`(max-width: ${cluster.dataset.compactAt}px)`).matches && getComputedStyle(toggle).display !== 'none') toggle.click();
      document.querySelector(sel)?.click();
    }, LIBRARY_BUTTON.expressions);
    await paneFrame.waitForFunction(() => document.body.classList.contains('library-open'), null, { timeout: 15000 });
  };
  await openPaneLibrary();
  const paneBefore = await identityOf('pane-expressions');
  check(paneBefore.token === paneToken && paneBefore.libraryOpen === true,
    'The pane-tab Expressions centre is live, stamped, and holds in-app state of its own (its Library open)', paneBefore);
  await shot('pane-tab-marked');

  // ---- mode round trip: the pane-tab centre rides its SHELVED tree --------
  await enterMode('expressions');
  const paneDuringExpressions = await identityOf('pane-expressions');
  const expressionsStageNow = await page.evaluate(() => document.querySelector('.mode-stage[data-mode-stage="expressions"]:not([hidden]) iframe.pcd-host-frame')?.dataset.walkStamp ?? null);
  check(expressionsStageNow === 'expressions',
    'The expressions mode\'s stage slot presents the STAGE-OWNED instance — never the foreign pane-tab binding', { stageStamp: expressionsStageNow });
  await enterMode('techne');
  await page.waitForTimeout(400);
  const paneBack = await identityOf('pane-expressions');
  check(paneBack.present && paneBack.token === paneToken,
    'PANE-TAB RETURN: the SAME document came back (token kept — the shelved tree was never unmounted or moved)', { before: paneToken, after: paneBack.token, during: paneDuringExpressions.token });
  check(paneBack.libraryOpen === true,
    'PANE-TAB RETURN: the in-app state survived — the pane-tab centre\'s Library is still open', paneBack);
  await shot('pane-tab-returned');

  // ---- single-mount law over three bindings -------------------------------
  const countsAfterPane = await page.evaluate(() => ({
    frames: document.querySelectorAll('iframe.pcd-host-frame').length,
    hosts: document.querySelectorAll('.pcd-host').length,
    stamped: [...document.querySelectorAll('iframe.pcd-host-frame[data-walk-stamp]')].map((el) => el.dataset.walkStamp),
    parks: document.querySelectorAll('.mode-centre-retention').length,
    outlets: document.querySelectorAll('.retained-centre-outlet, .retained-centre-host').length,
  }));
  check(countsAfterPane.frames === 3 && countsAfterPane.hosts === 3,
    'Three bindings, exactly three hosted instances — one mount per binding, no park copies', countsAfterPane);
  check(countsAfterPane.stamped.filter((s) => s === 'pane-expressions').length === 1 && countsAfterPane.parks === 0 && countsAfterPane.outlets === 0,
    'The pane-tab centre exists exactly once, outside every retired park/outlet wrapper', countsAfterPane);

  // ==========================================================================
  // SECOND PASS — the restart leg (spec §7.2/§8)
  // ==========================================================================

  // ---- open a DIFFERENT expression through the app's own Library ----------
  await enterMode('expressions');
  const stage = await presentedAppFrame('expressions');
  const docBefore = await stage.frame.evaluate(() => window.__FIELD_STUDIES__.getDocument().id);
  // The stage app's Library has been open since the first leg — enter it
  // only if the app closed it.
  const libraryAlreadyOpen = await stage.frame.evaluate(() => document.body.classList.contains('library-open'));
  if (!libraryAlreadyOpen) {
    await stage.frame.click(LIBRARY_BUTTON.expressions, { timeout: 15000 });
    await stage.frame.waitForFunction(() => document.body.classList.contains('library-open'), null, { timeout: 15000 });
  }
  await stage.frame.click('button.expression-open[data-action="open-featured"]', { timeout: 15000 });
  await stage.frame.waitForFunction(() => !document.body.classList.contains('library-open'), null, { timeout: 15000 });
  const docAfter = await stage.frame.evaluate(() => window.__FIELD_STUDIES__.getDocument().id);
  check(docAfter && docAfter !== docBefore,
    'A different expression was opened through the application\'s own Library (the person\'s work moved)', { before: docBefore, after: docAfter });

  // The stage slot checkpoints the app's own announcements (debounced).
  // The stage frame's src was minted at boot — BEFORE any checkpoint
  // existed — so it must carry no deep link, and must NOT change when the
  // checkpoint lands (reassigning an iframe src re-navigates it).
  const srcBefore = await stage.handle.evaluate((el) => el.getAttribute('src'));
  check(!srcBefore.includes('expression='), 'The live frame\'s src carries no deep link (it booted before any checkpoint existed)', { src: srcBefore.slice(-40) });
  await page.waitForTimeout(1500); // announcement → 400ms debounce → store persist
  const book = await page.evaluate(() => JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1') ?? 'null'));
  const activeWs = book?.workspaces?.find((w) => w.id === book.active);
  const expressionsBinding = activeWs && Object.values(activeWs.layout.surfaces).find((b) => b.kind === 'expressions');
  check(expressionsBinding?.engine?.expressionRef === docAfter,
    'The stage slot CHECKPOINTED the current expression ref onto the binding (a ref, not app content)', { checkpoint: expressionsBinding?.engine ?? null, expected: docAfter });
  check(await stage.handle.evaluate((el) => el.getAttribute('src')) === srcBefore,
    'The checkpoint write never re-navigated the live frame (src unchanged after the checkpoint landed)', {});
  // The deep link resolves through the application's OWN boot grammar —
  // its browser library. Wait until the app has durably recorded the fork
  // itself (its library record and its last-work pointer), so the restart
  // exercises the real hand-off: shell checkpoint → app boot grammar.
  await stage.frame.waitForFunction((id) => {
    try {
      const last = localStorage.getItem('oi.field-studies.last');
      const library = JSON.parse(localStorage.getItem('oi.field-studies.journey-library.v1') ?? '[]');
      return last === id && Array.isArray(library) && library.some((entry) => entry && entry.id === id);
    } catch { return false; }
  }, docAfter, { timeout: 15000 });
  await shot('checkpointed');

  // ---- restart the renderer ------------------------------------------------
  await page.reload();
  await page.waitForSelector('.desktop-shell', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await enterMode('expressions');
  const restored = await presentedAppFrame('expressions');
  const restoredStamp = await restored.handle.evaluate((el) => { el.dataset.walkStamp = 'restarted'; return el.getAttribute('src'); });
  check(/expression=/.test(restoredStamp) && restoredStamp.includes(encodeURIComponent(docAfter)),
    'RESTART: the restored stage slot deep-links the application to the CHECKPOINTED expression (?expression=<ref>)', { src: restoredStamp.slice(-60), expected: docAfter });
  await restored.frame.waitForFunction(() => !!window.__FIELD_STUDIES__ && !!window.__FIELD_STUDIES__.getDocument().id, null, { timeout: 30000 });
  const docRestored = await restored.frame.evaluate(() => window.__FIELD_STUDIES__.getDocument().id);
  check(docRestored === docAfter,
    'RESTART: the SAME expression is back on screen — the app\'s own boot applied the checkpointed ref', { restored: docRestored, checkpointed: docAfter });
  // The deep link is a boot-time hint only: the mounted frame's src must
  // stay put while the (new) session checkpoints its own announcements.
  await page.waitForTimeout(1200);
  const afterSettle = await restored.handle.evaluate((el) => ({ src: el.getAttribute('src'), connected: el.isConnected, stamp: el.dataset.walkStamp }));
  check(afterSettle.connected && afterSettle.stamp === 'restarted' && afterSettle.src === restoredStamp,
    'The restored frame holds still — one node, one src, no re-navigation while the new session runs', afterSettle);
  await shot('restored-after-restart');

  metric('mode_round_trip_survivals', [expressionsBack.token === expressions.token, expressionsBack.libraryOpen === true, techneBack.token === techne.token, techneBack.libraryOpen === true].filter(Boolean).length);
  metric('pane_tab_survivals', [paneBack.token === paneToken, paneBack.libraryOpen === true].filter(Boolean).length);
  metric('restart_expression_restored', docRestored === docAfter ? 1 : 0);
  check(errors.length === 0, 'No page errors across the whole journey', errors.slice(0, 3));
}
