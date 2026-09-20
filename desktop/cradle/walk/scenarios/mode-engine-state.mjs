// mode-engine-state — the mode-centre engine persistence vertical.
//
// The owner's report: every mode round trip reboots the Expressions vendored
// application and Technè, losing their in-memory state. The cause under the
// park-and-adopt presentation: presenting a centre MOVES its container
// between the hidden park and the presenting outlet, and moving a DOM
// subtree that contains an iframe detaches it — the iframe re-navigates and
// the hosted application boots from scratch.
//
//   enter the Expressions mode (the real vendored application)
//   → mark in-app state through the app's OWN UI (open its Library)
//   → stamp the frame node (parent-side data attribute) and the frame
//     document (an in-page token a fresh execution cannot have)
//   → switch to Technè, mark its centre the same way
//   → return to Expressions: the SAME iframe node, the SAME document
//     token, and the Library still open
//   → return to Technè: the same three assertions, mirrored
//   → with both centres visited, exactly ONE hosted application instance
//     per mode in the whole DOM (no double mount)
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

  // ---- no double mount ------------------------------------------------------
  const counts = await page.evaluate(() => ({
    frames: document.querySelectorAll('iframe.pcd-host-frame').length,
    hosts: document.querySelectorAll('.pcd-host').length,
    stamped: [...document.querySelectorAll('iframe.pcd-host-frame[data-walk-stamp]')].map((el) => el.dataset.walkStamp),
  }));
  check(counts.frames === 2 && counts.hosts === 2,
    'With both centres visited, exactly ONE hosted application instance per mode — no double mount', counts);
  check(counts.stamped.includes('expressions') && counts.stamped.includes('techne'),
    'Both centre frames are the stamped instances (the same nodes marked at first presentation)', counts.stamped);

  metric('mode_round_trip_survivals', [expressionsBack.token === expressions.token, expressionsBack.libraryOpen === true, techneBack.token === techne.token, techneBack.libraryOpen === true].filter(Boolean).length);
  check(errors.length === 0, 'No page errors across the whole journey', errors.slice(0, 3));
}
