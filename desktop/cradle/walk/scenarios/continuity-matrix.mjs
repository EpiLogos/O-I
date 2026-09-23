// continuity-matrix — the workspace-continuity track's missing verification
// matrix rows (WAYFINDER §4), walked in ONE journey against a fresh real
// Central ground and the real walk bridge: C02 (structural moves), C08
// (source-backed vs ordinary HTML), C09 (cached expansion), C13 (rename
// while hidden, path reused), C16 (force-release), C26 (sidebar remount),
// C28 (focus after newer intent), C29 (reduced motion + keyboard-only),
// C30 (idle resource sampling).
//
// Document identity is proved the way html-continuity proves it: each HTML
// fixture mints a token once per real document execution and answers pings
// through postMessage — a destroyed-and-recreated frame cannot keep its
// token, and the retained iframe node is stamped with a data attribute a
// remount loses. Owner I/O is counted from the page's own /op traffic.
// Timers, observers and iframes are counted from a document-start wrapper
// (window.__oiWalkTimers), so C30's idle sample names real resources.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The fixture: one self-identifying document (same law as html-continuity). */
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
  `<body><h1>${title}</h1><p>A continuity matrix specimen.</p>${identityScript}</body></html>`;

export async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-continuity-matrix-'));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], { encoding: 'utf8' }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  try {
    call('central.init');
    const projectRoot = join(root, 'Work', 'Coverage');
    mkdirSync(join(projectRoot, 'deep'), { recursive: true });
    mkdirSync(join(projectRoot, 'ProjectCentral', 'user'), { recursive: true });
    // The ProjectCentral manifest makes ProjectCentral/user a real
    // project-human-source aperture: journal.md reads back SOURCE-BOUND
    // (source.ref disclosed), which is what sends its open down the owner's
    // source route instead of the file-material route (the C08 contrast).
    writeFileSync(join(projectRoot, 'ProjectCentral', 'project.json'), JSON.stringify({
      schema: 'central.project/v1',
      project_id: 'coverage-walk',
      human_source: 'ProjectCentral/user',
      wiki: { profile: 'okf-wiki/v1', source: 'ProjectCentral/agents/wiki/wiki.json', adopted_sources: [] },
    }, null, 2) + '\n');
    writeFileSync(join(projectRoot, 'ProjectCentral', 'user', 'journal.md'), '# Coverage Journal\n\nThe source-backed ProjectCentral markdown.\n');
    writeFileSync(join(projectRoot, 'alpha.html'), html('Alpha specimen'));
    writeFileSync(join(projectRoot, 'beta.html'), html('Beta specimen'));
    writeFileSync(join(projectRoot, 'notes.html'), html('Plain specimen'));
    writeFileSync(join(projectRoot, 'shifter.html'), html('Shifter specimen'));
    writeFileSync(join(projectRoot, 'draft.txt'), 'The focus leg keeps this sentence as its draft basis.\n');
    writeFileSync(join(projectRoot, 'draft-2.txt'), 'Opened keyboard-only in the accessibility leg.\n');
    for (const name of ['c1.txt', 'c2.txt', 'c3.txt', 'c4.txt', 'c5.txt']) {
      writeFileSync(join(projectRoot, 'deep', name), `Deep child ${name}.\n`);
    }
    return {
      root,
      projectRoot,
      env: { OI_CENTRAL_ROOT: root, OI_CENTRAL_PROJECT_QUERY: 'Coverage' },
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

/** Document-start instrumentation: active interval/timeout identifiers and
 * live IntersectionObserver constructions, so the idle sample (C30) counts
 * real resources rather than guessing. Applies to the top document; the
 * sandboxed material frames have their own worlds and are not sampled. */
const TIMERS_INIT = `(() => {
  const state = { intervals: new Set(), timeouts: new Set(), observersBuilt: 0, observersLive: 0 };
  const origSetInterval = window.setInterval.bind(window);
  const origClearInterval = window.clearInterval.bind(window);
  const origSetTimeout = window.setTimeout.bind(window);
  const origClearTimeout = window.clearTimeout.bind(window);
  window.setInterval = function(fn, ...rest) {
    const id = origSetInterval(fn, ...rest);
    state.intervals.add(id);
    return id;
  };
  window.clearInterval = function(id) { state.intervals.delete(id); return origClearInterval(id); };
  window.setTimeout = function(fn, ...rest) {
    let id;
    if (typeof fn === 'function') {
      const wrapped = function(...args) { state.timeouts.delete(id); return fn.apply(this, args); };
      id = origSetTimeout(wrapped, ...rest);
    } else {
      id = origSetTimeout(fn, ...rest);
    }
    state.timeouts.add(id);
    return id;
  };
  window.clearTimeout = function(id) { state.timeouts.delete(id); return origClearTimeout(id); };
  const OrigObserver = window.IntersectionObserver;
  window.IntersectionObserver = class extends OrigObserver {
    constructor(callback, options) { super(callback, options); state.observersBuilt += 1; state.observersLive += 1; }
    disconnect() { state.observersLive -= 1; return super.disconnect(); }
  };
  window.__oiWalkTimers = state;
})();`;

/** The editor's document the way CodeMirror actually holds it (editor-doc.mjs
 * DOC_TEXT_FN, inlined for the two scoped reads below). */
const docTextOf = (page, sel) => page.evaluate((selector) => {
  const el = document.querySelector(selector);
  const host = el?.closest('.text-editor')?.querySelector('.text-editor-host');
  return host && typeof host.__oiDocument === 'function' ? host.__oiDocument() : el?.textContent;
}, sel);

export default async function run({ page, baseUrl, bridgeUrl, check, metric, shot, log, provision }) {
  const projectRoot = provision.projectRoot;
  await page.addInitScript(TIMERS_INIT);
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
  const fileReads = () => (ops.file_read ?? 0) + (ops.file_bytes ?? 0);

  await page.goto(baseUrl);
  await page.waitForSelector('.desktop-shell', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const nav = page.getByRole('complementary', { name: 'World navigator' });
  await nav.locator('[data-project-path="Work/Coverage"]').click();
  if ((await nav.getByRole('button', { name: 'Coverage: files', exact: true }).getAttribute('aria-pressed')) !== 'true') {
    await nav.getByRole('button', { name: 'Coverage: files', exact: true }).click();
  }

  /** Expand every folder on `path` (the tree lists lazily), then click the
   * row and wait for the real active tab and its presented body. */
  const openFile = async (path) => {
    const segments = path.split('/');
    for (let i = 0; i < segments.length - 1; i += 1) {
      const prefix = ['Work', 'Coverage', ...segments.slice(0, i + 1)].join('/');
      const folder = nav.locator(`[data-file-path="${prefix}"]`);
      if ((await folder.getAttribute('aria-expanded')) !== 'true') await folder.click();
      await nav.locator(`[data-file-path="${prefix}/${segments[i + 1]}"]`).waitFor({ timeout: 15000 });
    }
    const title = segments[segments.length - 1];
    await nav.locator(`[data-file-path="Work/Coverage/${path}"]`).click();
    await page.locator(`.tab[data-title="${title}"][data-active="true"]`).waitFor({ timeout: 15000 });
    // The pane keeps every tab's body mounted-concealed: scope to the VISIBLE
    // one — the first match in DOM order may be a concealed sibling's.
    await page.locator('.pane.focused .surface-retained:not([hidden]) .material-surface, .pane.focused .surface-retained:not([hidden]) .native-file-surface, .pane.focused .surface-retained:not([hidden]) .source-editor').first().waitFor({ timeout: 15000 });
  };

  /** Stamp every material frame node once — a remount loses the stamp. */
  const stampFrames = () => page.evaluate(() => {
    document.querySelectorAll('iframe.material-frame').forEach((frame, index) => {
      if (frame.dataset.walkStamp === undefined) frame.dataset.walkStamp = `n${index}`;
    });
  });

  /** Ping each material document in DOM order and correlate by that order
   * (the frames are opaque-origin; the fixture answers with its title and
   * its once-per-execution token; a destroyed document answers null). */
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
        out.push({ title: event.data.title, token: event.data.token, stamp, revision: frame.dataset.fileRevision ?? null });
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
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const found = (await probeFrames()).find((identity) => identity.title === title);
      if (found) return found;
      await page.waitForTimeout(400);
    }
    return null;
  };
  const revisionOf = (identity) => page.evaluate((stamp) => {
    const frame = [...document.querySelectorAll('iframe.material-frame')].find((node) => node.dataset.walkStamp === stamp);
    return frame?.getAttribute('data-file-revision') ?? null;
  }, identity?.stamp ?? '');
  const book = () => page.evaluate(() => JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1') ?? 'null'));
  const kernelSurfaces = async () => {
    const response = await fetch(`${bridgeUrl}/state`);
    const body = await response.json();
    return body?.snapshot?.surfaces ?? {};
  };
  const timerSample = () => page.evaluate(() => {
    const state = window.__oiWalkTimers ?? {};
    return {
      intervals: state.intervals ? state.intervals.size : -1,
      timeouts: state.timeouts ? state.timeouts.size : -1,
      observersBuilt: state.observersBuilt ?? -1,
      observersLive: state.observersLive ?? -1,
      iframes: document.querySelectorAll('iframe').length,
    };
  });
  /** The tab ids of one workspace's pane tree. */
  const tabsOf = (workspace) => {
    const ids = [];
    const walk = (pane) => {
      if (!pane) return;
      if (pane.type === 'group') { ids.push(...pane.tabs); return; }
      (pane.children ?? []).forEach(walk);
    };
    walk(workspace.layout.root);
    return ids;
  };
  /** The visible surface body of the focused pane. */
  const visibleSurface = '.pane.focused .surface-retained:not([hidden])';

  // ---- open the journey's fixtures ------------------------------------------
  await openFile('alpha.html');
  await openFile('beta.html');
  await stampFrames();
  const alpha = await identityOf('Alpha specimen');
  const beta = await identityOf('Beta specimen');
  check(!!alpha?.token && !!beta?.token, 'The coverage ground opens: both HTML specimens are live and self-identifying', { alpha: !!alpha?.token, beta: !!beta?.token });
  await shot('fixtures-open');

  // The focus leg's editor basis, typed once now and carried by the draft
  // store through every later structural change.
  await openFile('draft.txt');
  await page.locator(`${visibleSurface} .cm-content`).click();
  await page.keyboard.press('Meta+ArrowUp');
  await page.keyboard.type('editor basis');

  // ---- C08: source-backed ProjectCentral markdown vs ordinary HTML ---------
  await openFile('ProjectCentral/user/journal.md');
  // The source-bound reading converts the pending file tab into a source
  // surface, admitted through surface_open + source_open (the owner's buffer
  // route) — never a material frame.
  await page.locator(`${visibleSurface} .source-editor .cm-content`).waitFor({ timeout: 20000 });
  const journalIsSource = await page.locator(`${visibleSurface} .source-editor`).count();
  const journalFrameless = await page.locator(`${visibleSurface} iframe.material-frame`).count();
  const sourceOpens = ops.source_open ?? 0;
  check(journalIsSource === 1 && journalFrameless === 0 && sourceOpens >= 1, 'C08/source: the ProjectCentral markdown opens as a SOURCE surface through the owner buffer route (source_open), never a material frame', { sourceEditor: journalIsSource, frames: journalFrameless, sourceOpens });
  const journalBefore = await docTextOf(page, `${visibleSurface} .cm-content`);
  await openFile('notes.html');
  const plain = await identityOf('Plain specimen');
  const plainFrameRoute = await page.locator(`${visibleSurface} iframe.material-frame`).count();
  check(!!plain?.token && plainFrameRoute === 1, 'C08/plain: the ordinary HTML renders through the material frame route', { token: !!plain?.token, frames: plainFrameRoute });
  // Conceal each in turn: the HTML keeps its document token, the source
  // editor keeps its buffer — one surface's lifecycle never touches the other.
  await page.locator('.tab[data-title="journal.md"]').click();
  await page.locator('.tab[data-title="notes.html"]').click();
  const plainAfterConceal = await identityOf('Plain specimen');
  await page.locator('.tab[data-title="journal.md"]').click();
  await page.locator(`${visibleSurface} .source-editor .cm-content`).waitFor({ timeout: 10000 });
  const journalAfter = await docTextOf(page, `${visibleSurface} .cm-content`);
  check(plainAfterConceal?.token === plain.token && journalAfter === journalBefore, 'C08/independent: concealing each in turn — the HTML keeps its document token and the source editor keeps its buffer, byte-identical', { tokenKept: plainAfterConceal?.token === plain.token, journalUnchanged: journalAfter === journalBefore });
  await shot('c08-routes');

  // ---- C02: tab moves, split, maximize, merge -------------------------------
  const readsBeforeC02 = fileReads();
  await page.locator('.tab[data-title="alpha.html"]').click();
  await stampFrames();
  const alphaBefore = await identityOf('Alpha specimen');
  await page.locator('.tab[data-title="beta.html"]').click();
  await page.locator('.tab[data-title="alpha.html"]').click();
  const alphaAfterTabs = await identityOf('Alpha specimen');
  check(!!alphaAfterTabs && alphaAfterTabs.token === alphaBefore.token && alphaAfterTabs.stamp === alphaBefore.stamp, 'C02/tab: switching away and back keeps the SAME document instance and the SAME iframe node', { tokenKept: alphaAfterTabs?.token === alphaBefore?.token, stampKept: alphaAfterTabs?.stamp === alphaBefore?.stamp });
  const bookBeforeSplit = await book();
  const originId = bookBeforeSplit.active;
  const originBefore = bookBeforeSplit.workspaces.find((w) => w.id === originId);
  const alphaId = Object.entries(originBefore.layout.surfaces).find(([, b]) => (b.location?.path ?? '').endsWith('alpha.html'))?.[0] ?? null;
  const revisionBeforeSplit = await revisionOf(alphaBefore);
  await page.keyboard.press('Meta+d'); // split right: the ACTIVE tab (alpha) moves to a new pane
  // The frame keeps the rest pane and every warm tree mounted-hidden beside
  // the presented tree, so a pane count must scope to the PRESENTED tree.
  await page.waitForFunction(() => document.querySelectorAll('.warm-tree-host:not([hidden]) .pane.group').length === 2, null, { timeout: 10000 });
  await page.locator('.tab[data-title="alpha.html"][data-active="true"]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800); // the moved surface re-presents and re-acquires from the broker
  await stampFrames();
  const alphaAfterSplit = await identityOf('Alpha specimen');
  const revisionAfterSplit = await revisionOf(alphaAfterSplit);
  const bookAfterSplit = await book();
  const originAfter = bookAfterSplit.workspaces.find((w) => w.id === originId);
  const alphaIdAfter = Object.entries(originAfter.layout.surfaces).find(([, b]) => (b.location?.path ?? '').endsWith('alpha.html'))?.[0] ?? null;
  const splitRebuilt = !!alphaAfterSplit && alphaAfterSplit.token !== alphaBefore.token;
  metric('split_rebuilt_document', splitRebuilt ? 1 : 0);
  check(alphaIdAfter === alphaId && revisionAfterSplit === revisionBeforeSplit && !!alphaAfterSplit, 'C02/split: splitting right moves the active tab — its surface identity and subject revision survive and the document re-binds live', { surfaceIdKept: alphaIdAfter === alphaId && !!alphaId, revisionKept: revisionAfterSplit === revisionBeforeSplit, live: !!alphaAfterSplit, rebuilt: splitRebuilt });
  // Maximize the moved pane and restore: pure visibility, never destruction.
  await stampFrames();
  const alphaParked = await identityOf('Alpha specimen');
  await page.keyboard.press('Meta+Alt+Enter');
  await page.locator('.pane.group[data-maximized="true"]').waitFor({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.pane.group[data-maximized="true"]'), null, { timeout: 10000 });
  const alphaAfterMaximize = await identityOf('Alpha specimen');
  check(!!alphaAfterMaximize && alphaAfterMaximize.token === alphaParked.token && alphaAfterMaximize.stamp === alphaParked.stamp, 'C02/maximize: maximize and restore never reload the retained document — same token, same node', { tokenKept: alphaAfterMaximize?.token === alphaParked?.token, stampKept: alphaAfterMaximize?.stamp === alphaParked?.stamp });
  // Merge: move the tab back; the emptied split prunes.
  await page.keyboard.press('Meta+Alt+ArrowLeft');
  await page.waitForFunction(() => document.querySelectorAll('.warm-tree-host:not([hidden]) .pane.group').length === 1, null, { timeout: 10000 });
  const mergedBook = await book();
  const mergedOrigin = mergedBook.workspaces.find((w) => w.id === originId);
  const mergedTabs = tabsOf(mergedOrigin);
  const betaId = Object.entries(mergedOrigin.layout.surfaces).find(([, b]) => (b.location?.path ?? '').endsWith('beta.html'))?.[0] ?? null;
  check(mergedTabs.includes(alphaId) && !!betaId && mergedTabs.includes(betaId), 'C02/merge: moving the tab back merges the split — one pane, both tabs bound in the book', { tabs: mergedTabs.length, alphaBound: mergedTabs.includes(alphaId), betaBound: mergedTabs.includes(betaId) });
  check(fileReads() === readsBeforeC02, 'C02/cache: tab switches, maximize/restore, split and merge re-acquired ZERO owner readings — the broker served every rebuild', { ownerReadsDuringStructuralMoves: fileReads() - readsBeforeC02 });
  await shot('c02-structural');

  // ---- C09: cached collapse / re-expand --------------------------------------
  const deepRow = nav.locator('[data-file-path="Work/Coverage/deep"]');
  const listingsBeforeExpand = ops.files_list ?? 0;
  await deepRow.click();
  await nav.locator('[data-file-path="Work/Coverage/deep/c1.txt"]').waitFor({ timeout: 15000 });
  const firstExpansionListings = (ops.files_list ?? 0) - listingsBeforeExpand;
  const rowsExpanded = await nav.locator('[data-file-path^="Work/Coverage/deep/"]').count();
  check(firstExpansionListings === 1 && rowsExpanded === 5, 'C09/expand: the first expansion lists the folder with exactly one owner directory read', { listings: firstExpansionListings, rows: rowsExpanded });
  await deepRow.click(); // collapse
  await page.waitForFunction(() => !!document.querySelector('.native-folder-children[hidden]'), null, { timeout: 5000 });
  const rowsCollapsed = await nav.locator('[data-file-path^="Work/Coverage/deep/"]').count();
  const reexpandStart = Date.now();
  await deepRow.click(); // re-expand from cache
  await nav.locator('[data-file-path="Work/Coverage/deep/c1.txt"]').waitFor({ timeout: 5000 });
  const reexpandMs = Date.now() - reexpandStart;
  const listingsAfterReexpand = (ops.files_list ?? 0) - listingsBeforeExpand;
  const rowsReexpanded = await nav.locator('[data-file-path^="Work/Coverage/deep/"]').count();
  metric('cached_expansion_ms', reexpandMs);
  check(listingsAfterReexpand === firstExpansionListings, 'C09/cache: collapse and re-expand issued ZERO new directory listings — the cached reading answered', { listings: listingsAfterReexpand });
  check(rowsExpanded === rowsCollapsed && rowsCollapsed === rowsReexpanded, 'C09/bounded: the folder renders exactly one row per entry through expand/collapse/re-expand — no accumulating hidden rows', { expanded: rowsExpanded, collapsed: rowsCollapsed, reexpanded: rowsReexpanded });
  await shot('c09-cached-tree');

  // ---- C13: rename while hidden; the path is later reused --------------------
  await openFile('shifter.html');
  await stampFrames();
  const shifter = await identityOf('Shifter specimen');
  const shifterRevision = await revisionOf(shifter);
  const shifterBookBefore = await book();
  const shifterOrigin = shifterBookBefore.workspaces.find((w) => w.id === shifterBookBefore.active);
  const shifterEntry = Object.entries(shifterOrigin.layout.surfaces).find(([, b]) => (b.location?.path ?? '').endsWith('shifter.html'));
  const shifterId = shifterEntry?.[0];
  const shifterRef = shifterEntry?.[1]?.ref;
  await openFile('alpha.html'); // the shifter view is now hidden behind the active tab
  renameSync(join(projectRoot, 'shifter.html'), join(projectRoot, 'shifter-moved.html'));
  await page.locator('.tab[data-title="shifter.html"]').click();
  await page.waitForTimeout(400);
  const shifterAfterRename = await identityOf('Shifter specimen');
  check(!!shifterAfterRename && shifterAfterRename.token === shifter.token, 'C13/hidden: the renamed file\'s view returns with its EXACT retained document — same token, no redirect to whatever sits at the path now', { tokenKept: shifterAfterRename?.token === shifter.token });
  // Reload from the file owner: the broker entry must be dropped, the owner
  // asked for real — and the owner answers that the location is gone.
  await page.locator(`${visibleSurface} [aria-label="Reload preview"]`).click();
  await page.locator(`${visibleSurface} .material-rendered-content .source-note[role="alert"]`).waitFor({ timeout: 15000 });
  const shifterFrameGone = await page.locator(`${visibleSurface} iframe.material-frame`).count();
  check(shifterFrameGone === 0, 'C13/reload: after the rename, Reload really reaches the owner and the unavailable source is disclosed honestly — no silent stale rebuild', { frames: shifterFrameGone });
  // The path is reused by a DIFFERENT file. Central's references are
  // path-derived (central:path:<root>:<path>), so the owner's own identity
  // model says the replacement IS the same subject: re-opening the row
  // re-activates the SAME binding — and the law to hold is that the shell
  // never swaps the content silently (the failure stays disclosed until the
  // person explicitly reloads through the owner).
  writeFileSync(join(projectRoot, 'shifter.html'), html('Replacement specimen'));
  await nav.getByRole('button', { name: 'Refresh Central', exact: true }).click();
  await page.waitForTimeout(1500); // the fresh listing round trip
  await nav.locator('[data-file-path="Work/Coverage/shifter.html"]').click();
  await page.locator('.tab[data-title="shifter.html"][data-active="true"]').waitFor({ timeout: 15000 });
  const stillFailed = await page.locator(`${visibleSurface} .material-rendered-content .source-note[role="alert"]`).count();
  const shifterBookAfter = await book();
  const shifterOriginAfter = shifterBookAfter.workspaces.find((w) => w.id === shifterBookAfter.active);
  const shifterBindings = Object.entries(shifterOriginAfter.layout.surfaces).filter(([, b]) => (b.location?.path ?? '').endsWith('shifter.html'));
  check(stillFailed === 1 && shifterBindings.length === 1 && shifterBindings[0][0] === shifterId, 'C13/reuse: the reused path re-activates the SAME binding (the owner\'s path-ref identity) and the replacement never swaps in silently — the failure stays disclosed', { stillFailed, bindings: shifterBindings.length, sameBinding: shifterBindings[0]?.[0] === shifterId });
  // Recovery is the person's explicit act: reload reaches the owner and comes
  // back with the replacement — a new document execution at a new revision.
  await page.locator(`${visibleSurface} [aria-label="Reload preview"]`).click();
  const replacement = await identityOf('Replacement specimen');
  const replacementRevision = replacement?.revision ?? null;
  check(!!replacement?.token && !!replacementRevision && replacementRevision !== shifterRevision, 'C13/recover: the explicit reload reads the replacement through the owner — new live document, new revision, still one binding', { replacementLive: !!replacement?.token, revisionChanged: replacementRevision !== shifterRevision });
  await shot('c13-rename-reuse');

  // ---- C16: force-release every disposable view ------------------------------
  const centralBook = await book();
  const centralTabIds = tabsOf(centralBook.workspaces.find((w) => w.id === centralBook.active));
  const readsBeforeRelease = fileReads();
  const helpers = await import('../editor-doc.mjs');
  const newWorkspace = async (name) => {
    await helpers.newWorkspace(page, name);
    await page.waitForFunction((want) => {
      const parsed = JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1') ?? 'null');
      const target = parsed?.workspaces?.find((w) => w.name === want);
      return target && parsed.active === target.id;
    }, name, { timeout: 10000 });
    await page.waitForTimeout(400);
  };
  await newWorkspace('Sideways');
  await newWorkspace('Midway');
  await newWorkspace('Faraway');
  // Creating a workspace never stamps lastVisitedAt — only a real visit does
  // (workspace/store.ts activate). Visit each in order so the warm set (the
  // two most recent) holds Sideways and Midway and Central's tree is forced
  // out of it entirely.
  const visit = async (name) => {
    await helpers.switchWorkspace(page, { label: name });
    await page.waitForFunction((want) => {
      const parsed = JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1') ?? 'null');
      const target = parsed?.workspaces?.find((w) => w.name === want);
      return target && parsed.active === target.id;
    }, name, { timeout: 10000 });
    await page.waitForTimeout(400);
  };
  await visit('Sideways');
  await visit('Midway');
  await visit('Faraway');
  const framesWhileAway = await page.evaluate(() => document.querySelectorAll('iframe.material-frame').length);
  check(framesWhileAway === 0, 'C16/release: with the origin workspace outside the warm set, its views are really RELEASED — not one frame stays mounted (no keep-mounted-only success)', { frames: framesWhileAway });
  const state = await kernelSurfaces();
  const admitted = centralTabIds.filter((id) => !!state[id]);
  check(admitted.length === centralTabIds.length, 'C16/membership: the kernel keeps every open binding admitted across the release — logical membership survived in both the book and the owner', { bookTabs: centralTabIds.length, kernelAdmitted: admitted.length });
  await visit('Central');
  // The active tab on return is whatever was presented when we left; present
  // the alpha specimen explicitly — a concealed tab defers its document, so
  // the recovery claim needs the presented view.
  await page.locator('.warm-tree-host:not([hidden]) .tab[data-title="alpha.html"]').waitFor({ timeout: 20000 });
  await page.locator('.warm-tree-host:not([hidden]) .tab[data-title="alpha.html"]').click();
  await page.locator(`${visibleSurface} iframe.material-frame`).waitFor({ timeout: 20000 });
  await page.waitForTimeout(800); // the presented view re-presents and re-acquires
  const alphaRecovered = await identityOf('Alpha specimen');
  const readsAfterRecovery = fileReads() - readsBeforeRelease;
  metric('release_recovery_owner_reads', readsAfterRecovery);
  check(!!alphaRecovered?.token && readsAfterRecovery === 0, 'C16/recover: returning, the presented tab recovers a live document with ZERO new owner reads — the broker-backed reconstruction, not a re-read', { live: !!alphaRecovered?.token, ownerReads: readsAfterRecovery });
  await shot('c16-recovered');

  // ---- C26: sidebar remount / region toggles ---------------------------------
  // The right region starts collapsed in base mode; open it, park a draft in
  // the composer, then take the region down and back.
  await page.getByRole('button', { name: 'Toggle right region' }).click();
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.waitFor({ timeout: 10000 });
  await composer.click();
  await composer.fill('sidebar survives');
  await page.getByRole('button', { name: 'Toggle right region' }).click();
  await page.waitForFunction(() => document.querySelector('.desktop-side.right')?.dataset.depth === 'collapsed', null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Toggle right region' }).click();
  await composer.waitFor({ timeout: 10000 });
  const composerAfter = await composer.inputValue();
  const agentLayers = await page.locator('.agent-layer').count();
  const composers = await page.getByRole('textbox', { name: 'Message', exact: true }).count();
  check(composerAfter === 'sidebar survives' && agentLayers === 1 && composers === 1, 'C26/right: the agent panel survives collapse/expand — the composer draft is intact and there is exactly one panel and one composer (no duplicate layer)', { draftKept: composerAfter === 'sidebar survives', layers: agentLayers, composers });
  // The left region: the navigator's expansion state survives the toggle.
  await page.getByRole('button', { name: 'Toggle left region' }).click();
  await page.waitForFunction(() => document.querySelector('.desktop-side.left')?.dataset.depth === 'strip', null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Toggle left region' }).click();
  await nav.locator('[data-file-path="Work/Coverage/deep/c1.txt"]').waitFor({ timeout: 10000 });
  const deepStillExpanded = await nav.locator('[data-file-path^="Work/Coverage/deep/"]').count();
  check(deepStillExpanded === 5, 'C26/left: the navigator survives collapse/expand — the expanded folder and its pinned rows come back exactly as they were', { rows: deepStillExpanded });
  await shot('c26-regions');

  // ---- C28: restoration must not steal focus from newer intent ----------------
  await page.locator('.tab[data-title="draft.txt"]').click(); // restore the editor tab
  const composerNow = page.getByRole('textbox', { name: 'Message', exact: true });
  await composerNow.click(); // the newer intent lands in a DIFFERENT surface, immediately
  await composerNow.press('Meta+ArrowUp');
  await composerNow.type('newer intent');
  await page.waitForTimeout(1500); // let the editor's deferred seed/revalidation settle
  const composerValue = await composerNow.inputValue();
  const focusInComposer = await page.evaluate(() => !!document.activeElement?.closest?.('.agent-layer'));
  const editorAfter = await docTextOf(page, `${visibleSurface} .cm-content`);
  const activeTabStill = await page.locator('.tab[data-title="draft.txt"][data-active="true"]').count();
  check(composerValue.includes('newer intent') && focusInComposer, 'C28/restore: the newer intent keeps its surface — the composer holds the typed text and keeps focus over the restored tab', { composerValue, focusInComposer });
  check(!!editorAfter && editorAfter.startsWith('editor basis') && activeTabStill === 1, 'C28/draft: the restored editor kept its draft through the settling restoration — nothing clobbered, caret not stolen', { editorHead: editorAfter?.slice(0, 32), activeTabStill });
  await shot('c28-focus');

  // ---- C29: reduced motion + keyboard-only operation ---------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  check(reduced, 'C29/motion: reduced motion is in force (prefers-reduced-motion: reduce observed in the page)');
  // Keyboard only from here to the end of the leg: F6 into the left region,
  // Tab to a tree row, Enter opens it. Focus is sampled after every press —
  // it must never rest inside a hidden (concealed or shelved) view.
  await page.evaluate(() => document.activeElement?.blur?.());
  const focusViolations = [];
  const sampleFocus = async () => {
    const inside = await page.evaluate(() => !!document.activeElement?.closest?.('.surface-retained[hidden], .warm-tree-host[hidden]'));
    if (inside) focusViolations.push(await page.evaluate(() => document.activeElement?.tagName ?? 'unknown'));
  };
  await page.keyboard.press('F6');
  await sampleFocus();
  let reached = false;
  for (let stops = 0; stops < 140 && !reached; stops += 1) {
    await page.keyboard.press('Tab');
    await sampleFocus();
    reached = await page.evaluate(() => document.activeElement?.dataset?.filePath === 'Work/Coverage/draft-2.txt');
  }
  await page.keyboard.press('Enter');
  await page.locator('.tab[data-title="draft-2.txt"][data-active="true"]').waitFor({ timeout: 15000 });
  await page.locator(`${visibleSurface} .cm-content`).waitFor({ timeout: 10000 });
  check(reached, 'C29/open: keyboard-only — F6 and Tab reached the tree row and Enter opened the file (no pointer events)', { reached });
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await sampleFocus();
  const movedTo = await page.evaluate(() => document.querySelector('.pane.focused .tab[data-active="true"]')?.dataset.title ?? null);
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await sampleFocus();
  const movedBack = await page.evaluate(() => document.querySelector('.pane.focused .tab[data-active="true"]')?.dataset.title ?? null);
  check(movedTo !== null && movedTo !== 'draft-2.txt' && movedBack === 'draft-2.txt' && focusViolations.length === 0, 'C29/tabs: keyboard-only tab cycling works and focus never rested inside a hidden view', { movedTo, movedBack, focusViolations: focusViolations.slice(0, 3) });
  await shot('c29-keyboard');

  // ---- C30: idle sampling — no cumulative growth from the journey -------------
  await page.waitForTimeout(2000); // let transient timers fire before the baseline
  const baseline = await timerSample();
  await page.waitForTimeout(5000); // the idle window itself
  const final = await timerSample();
  metric('idle_intervals', final.intervals);
  metric('idle_timeouts', final.timeouts);
  metric('idle_observers_live', final.observersLive);
  metric('idle_iframes', final.iframes);
  check(
    final.intervals === baseline.intervals &&
    final.observersLive <= baseline.observersLive &&
    final.iframes === baseline.iframes &&
    final.timeouts <= 20,
    'C30/idle: after five idle seconds — no interval, observer or iframe growth from the whole journey; timeouts bounded',
    { baseline, final },
  );

  // The walk harness's own storage touch throws inside the sandboxed material
  // frames (run.mjs's addInitScript runs in every attached frame); that noise
  // says nothing about the app and is counted separately, as material.mjs does.
  const harnessFrameError = "Failed to read the 'sessionStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.";
  const appErrors = errors.filter((message) => message !== harnessFrameError);
  check(appErrors.length === 0, 'No uncaught app page errors during the whole matrix walk', { appErrors: appErrors.slice(0, 3), harnessNoise: errors.length - appErrors.length });
  log(`continuity-matrix complete: owner reads ${fileReads()}, directory listings ${ops.files_list ?? 0}, source opens ${ops.source_open ?? 0}`);
}
