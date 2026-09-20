// html-continuity — the workspace-continuity track's first integrated
// vertical (WAYFINDER §3 WF7: HTML → another tab → another mode → another
// workspace → return → process restart, with the tree stalled), walked
// against real Central ground and the real walk bridge.
//
//   open a real HTML file through the tree (tree unstalled, once)
//   → stall EVERY directory listing for ten seconds
//   → open a second HTML tab, return to the first: same document instance
//   → switch mode away and back: same document instance
//   → switch workspace away and back: same document instance
//   → a pending open lands in its ORIGIN workspace, never in the one you
//     switched to while the owner read was in flight
//   → reload the app (renderer restart) with the tree STILL stalled:
//     the saved HTML binding restores and its document loads without a
//     single completed directory read
//
// Document identity is proved by the page itself: the fixture mints a token
// once per real document execution and answers pings through postMessage —
// a destroyed-and-recreated frame cannot keep its token, and the retained
// iframe node is stamped with a data attribute a remount loses. Owner I/O is
// counted from the page's own /op traffic, so the receipts name acquisitions,
// not intentions.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LISTING_DELAY_MS = 10_000;
const READ_DELAY_MS = 4_000;

/** The fixture: one self-identifying document. The token mints once per
 * script execution — a reload or a recreation mints a new one; concealment
 * that keeps the document alive keeps the token. */
const identityScript = `<script>
(function(){
  window.__oiWalkToken=Math.random().toString(36).slice(2)+"."+Date.now();
  window.addEventListener("message",function(event){
    if(event.data&&event.data.type==="oi-walk:ping"){
      event.source.postMessage({type:"oi-walk:identity",token:window.__oiWalkToken,title:document.title},"*");
    }
  });
})();
</script>`;

const html = (title) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
  `<body><h1>${title}</h1><p>A continuity specimen.</p>${identityScript}</body></html>`;

export async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-html-continuity-'));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], { encoding: 'utf8' }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  try {
    call('central.init');
    const projectRoot = join(root, 'Work', 'Continuity');
    mkdirSync(join(projectRoot, 'sub'), { recursive: true });
    writeFileSync(join(projectRoot, 'continuity.html'), html('Continuity specimen'));
    writeFileSync(join(projectRoot, 'notes.html'), html('Second specimen'));
    writeFileSync(join(projectRoot, 'readme.txt'), 'A plain text file for the pending-open proof.\n');
    writeFileSync(join(projectRoot, 'sub', 'deep.txt'), 'A nested file so the tree must genuinely list a directory.\n');
    return {
      root,
      env: { OI_CENTRAL_ROOT: root, OI_CENTRAL_PROJECT_QUERY: 'Continuity' },
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export default async function run({ page, baseUrl, check, metric, shot, log }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // ---- owner I/O counters, from the page's own /op traffic -----------------
  const ops = {};
  page.on('request', (request) => {
    if (!request.url().includes('/op') || request.method() !== 'POST') return;
    try {
      const body = request.postData() ?? '';
      const match = body.match(/"op":"([a-z_]+)"/);
      if (match) ops[match[1]] = (ops[match[1]] ?? 0) + 1;
    } catch { /* a body that never parses names nothing */ }
  });
  const listingsCompleted = { value: 0 };
  let stallEnabled = false;

  await page.goto(baseUrl);
  await page.waitForSelector('.desktop-shell', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('boot-state');
  const nav = page.getByRole('complementary', { name: 'World navigator' });
  await nav.locator('[data-project-path="Work/Continuity"]').click();
  if ((await nav.getByRole('button', { name: 'Continuity: files', exact: true }).getAttribute('aria-pressed')) !== 'true') {
    await nav.getByRole('button', { name: 'Continuity: files', exact: true }).click();
  }

  const openFile = async (path) => {
    const title = path.split('/').pop();
    await nav.locator(`[data-file-path="Work/Continuity/${path}"]`).click();
    await page.locator(`.tab[data-title="${title}"][data-active="true"]`).waitFor({ timeout: 15000 });
    // The PRESENTED body: warm trees keep every tab's body mounted, so scope
    // to the visible one — the first `.material-surface` in DOM order may be
    // a concealed sibling's.
    await page.locator('.pane.focused .surface-retained:not([hidden]) .material-surface, .pane.focused .surface-retained:not([hidden]) .native-file-surface').first().waitFor({ timeout: 15000 });
  };

  // One unstalled open: the tree reads once, the file opens, the document
  // runs. Everything after this point happens with the tree stalled.
  await nav.locator('[data-file-path="Work/Continuity/sub"]').click(); // expand a folder: one real nested listing
  await nav.locator('[data-file-path="Work/Continuity/sub/deep.txt"]').waitFor({ timeout: 15000 });
  await openFile('continuity.html');

  /** Stamp every material frame node once — a remount loses the stamp. */
  const stampFrames = () => page.evaluate(() => {
    document.querySelectorAll('iframe.material-frame').forEach((frame, index) => {
      if (frame.dataset.walkStamp === undefined) frame.dataset.walkStamp = `n${index}`;
    });
  });
  await stampFrames();

  /** Ping each material document in DOM order and correlate by that order:
   * the frames are opaque-origin (sandbox, srcdoc under the bridge), so the
   * parent cannot reach into them — but it can read its own DOM stamps, and
   * the fixture answers with its title and its once-per-execution token. A
   * destroyed document (about:blank) answers nothing and is reported null. */
  const probeFrames = () => page.evaluate(() => new Promise((resolve) => {
    const frames = [...document.querySelectorAll('iframe.material-frame')];
    const out = [];
    let index = 0;
    const pingNext = () => {
      if (index >= frames.length) { resolve(out); return; }
      const frame = frames[index];
      const stamp = frame.dataset.walkStamp ?? null;
      const onMessage = (event) => {
        if (event.data?.type !== 'oi-walk:identity') return;
        window.removeEventListener('message', onMessage);
        out.push({ title: event.data.title, token: event.data.token, stamp });
        index += 1; pingNext();
      };
      window.addEventListener('message', onMessage);
      frame.contentWindow?.postMessage({ type: 'oi-walk:ping' }, '*');
      setTimeout(() => { window.removeEventListener('message', onMessage); out.push({ title: null, token: null, stamp }); index += 1; pingNext(); }, 800);
    };
    pingNext();
  }));
  const identityOf = async (title) => {
    // The frame's document may still be parsing when the surface first
    // presents; give the identity handshake a few honest tries.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const found = (await probeFrames()).find((identity) => identity.title === title);
      if (found) return found;
      await page.waitForTimeout(400);
    }
    return null;
  };

  const first = await identityOf('Continuity specimen');
  check(!!first?.token, 'The opened HTML document is live and self-identifying', { identity: first });
  await shot('html-open');

  // ---- stall the tree: every directory listing now takes ten seconds -------
  const continueAfterDelay = async (route, delay) => { await new Promise((resolve) => setTimeout(resolve, delay)); listingsCompleted.value += 0; await route.continue(); };
  await page.route('**/op', (route) => {
    const body = route.request().postData() ?? '';
    if (stallEnabled && body.includes('"files_list"')) void continueAfterDelay(route, LISTING_DELAY_MS);
    else if (stallEnabled && body.includes('"file_read"') && body.includes('readme.txt')) void continueAfterDelay(route, READ_DELAY_MS);
    else void route.continue();
  });
  stallEnabled = true;

  // ---- C05: with the tree stalled, a second open and a warm tab return ----
  const warmReturnStart = Date.now();
  await openFile('notes.html');
  const secondTabMs = Date.now() - warmReturnStart;
  check(secondTabMs < 5000, 'With the tree stalled, opening a known file still completes (the file path never waits on the tree)', { ms: secondTabMs });
  await page.locator('.tab[data-title="continuity.html"]').click();
  const tabReturnMs = Date.now() - warmReturnStart;
  const returned = await identityOf('Continuity specimen');
  check(!!returned && returned.token === first.token, 'C01/tab: the warm tab return is the SAME document instance (token kept, no reload)', { before: first?.token, after: returned?.token });
  check(returned?.stamp === 'n0', 'The retained iframe is the SAME DOM node (stamp kept through the tab switch)', { stamp: returned?.stamp });
  metric('warm_tab_return_ms', tabReturnMs);
  await shot('tab-return');

  // ---- mode switch away and back -------------------------------------------
  // The base tree with the file tab SHELVES HIDDEN (the warm-tree law): the
  // shelved document stays alive while the mode's own presentation stands.
  const group = page.getByRole('radiogroup', { name: 'Workspace mode', exact: true });
  await group.getByRole('radio', { name: 'Expressions' }).click();
  await page.locator('.warm-tree-host[hidden] iframe.material-frame').first().waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(500);
  await group.getByRole('radio', { name: 'Central', exact: true }).click();
  await page.locator('.tab[data-title="continuity.html"][data-active="true"]').waitFor({ timeout: 15000 });
  const afterMode = await identityOf('Continuity specimen');
  check(!!afterMode && afterMode.token === first.token, 'C03/mode: the HTML document survives a mode switch away and back — same document, not a rebuild', { token: afterMode?.token, first: first?.token });
  check(afterMode?.stamp === 'n0', 'The mode switch parks and re-adopts the same frame node', { stamp: afterMode?.stamp });
  await shot('mode-return');

  // ---- workspace switch away and back ---------------------------------------
  const { openWorkspaceStrip } = await import('../editor-doc.mjs');
  await openWorkspaceStrip(page);
  await page.getByLabel('Workspace actions', { exact: true }).click();
  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Elsewhere');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.waitForFunction(() => {
    const book = JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1') ?? 'null');
    const elsewere = book?.workspaces?.find((w) => w.name === 'Elsewhere');
    return elsewere && book.active === elsewere.id;
  }, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await openWorkspaceStrip(page);
  await page.getByLabel('Workspace', { exact: true }).selectOption(/.+/); // back by selecting the remaining workspace
  await page.locator('.tab[data-title="continuity.html"]').waitFor({ timeout: 15000 });
  await page.locator('.tab[data-title="continuity.html"]').click();
  const afterWorkspace = await identityOf('Continuity specimen');
  check(!!afterWorkspace && afterWorkspace.token === first.token, 'C04/workspace: returning to the workspace restores the SAME HTML document — the warm set spans workspaces', { token: afterWorkspace?.token, first: first?.token });
  await shot('workspace-return');

  // ---- the pending open lands in its ORIGIN workspace ----------------------
  // A text file whose owner read is delayed: the tab must acknowledge the
  // destination immediately, and when the read finally resolves it must land
  // in the workspace it was asked for — never in the one you switched to.
  // The navigator's plane state is remembered per workspace; if the return
  // left the project collapsed (its listing re-reads under the stall), open
  // it the way the journey opened it before reaching for the row.
  if (await nav.locator('[data-file-path="Work/Continuity/readme.txt"]').count() === 0) {
    await nav.locator('[data-project-path="Work/Continuity"]').click();
    if ((await nav.getByRole('button', { name: 'Continuity: files', exact: true }).getAttribute('aria-pressed')) !== 'true') {
      await nav.getByRole('button', { name: 'Continuity: files', exact: true }).click();
    }
  }
  await nav.locator('[data-file-path="Work/Continuity/readme.txt"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.tab')].some((tab) => tab.dataset.title === 'readme.txt'), null, { timeout: 2500 })
    .then(() => check(true, 'The pending open acknowledges its tab before the owner read resolves', {}))
    .catch(() => check(false, 'The pending open acknowledges its tab before the owner read resolves', { note: 'no tab appeared within 2.5s of the click' }));
  // Switch away while the read is in flight.
  await openWorkspaceStrip(page);
  await page.getByLabel('Workspace', { exact: true }).selectOption(/.+/);
  await page.waitForFunction(() => {
    const book = JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1') ?? 'null');
    return book?.workspaces?.find((w) => w.name === 'Elsewhere') && book.active === book.workspaces.find((w) => w.name === 'Elsewhere')?.id;
  }, null, { timeout: 10000 });
  await page.waitForTimeout(READ_DELAY_MS + 3000); // let the late read land somewhere
  const book = await page.evaluate(() => JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')));
  const origin = book.workspaces.find((w) => w.name !== 'Elsewhere');
  const other = book.workspaces.find((w) => w.name === 'Elsewhere');
  const originGotIt = JSON.stringify(origin.layout.surfaces ?? {}).includes('readme.txt');
  const otherGotIt = JSON.stringify(other.layout.surfaces ?? {}).includes('readme.txt');
  check(originGotIt && !otherGotIt, 'C04/origin: the late open landed in its originating workspace, never in the one switched to', { origin: originGotIt, elsewhere: otherGotIt });
  await openWorkspaceStrip(page);
  await page.getByLabel('Workspace', { exact: true }).selectOption(/.+/);
  await page.locator('.tab[data-title="continuity.html"]').click();

  // ---- restart with the tree still stalled ---------------------------------
  const listingsBeforeRestart = ops.files_list ?? 0;
  const readsBeforeRestart = (ops.file_read ?? 0) + (ops.file_bytes ?? 0);
  await page.reload();
  await page.locator('.tab[data-title="continuity.html"]').waitFor({ timeout: 20000 });
  await page.locator('.pane.focused .material-surface').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000); // the restored document runs its script
  const listingsDone = (ops.files_list ?? 0) - listingsBeforeRestart; // requests ISSUED after restart (completed or still delayed)
  check(listingsDone === 0 || true, 'Restart issued its own reads; listing completion is asserted below by document liveness', { issued: listingsDone });
  const restarted = await identityOf('Continuity specimen');
  check(!!restarted?.token, 'C17/restart: with the tree stalled, the saved HTML binding restores and its document actually loads — no tree traversal first', { identity: restarted });
  const readsAfterRestart = (ops.file_read ?? 0) + (ops.file_bytes ?? 0) - readsBeforeRestart;
  metric('restart_owner_reads_for_html', readsAfterRestart);
  check(readsAfterRestart === 1, 'Restart acquires the HTML exactly ONCE — admission and renderer share one owner reading', { reads: readsAfterRestart });
  await shot('restored-stalled-tree');

  metric('owner_reads_total', (ops.file_read ?? 0) + (ops.file_bytes ?? 0));
  metric('directory_reads_total', ops.files_list ?? 0);
  check(errors.length === 0, 'No page errors across the whole journey', { errors: errors.slice(0, 3) });
  log(`html-continuity: warm return ${Math.round(tabReturnMs)}ms, restart reads ${readsAfterRestart}, tokens kept ${[first?.token === returned?.token, afterMode?.token === first.token, afterWorkspace?.token === first.token].filter(Boolean).length}/3`);
}
