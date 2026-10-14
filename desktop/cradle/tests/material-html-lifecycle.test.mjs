// Material HTML lifecycle (workspace-continuity WF3; contract §6, matrix C24/C25).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/material-html-lifecycle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { advanceReadiness, parseMaterialViewPrefs, encodeMaterialViewPrefs, MATERIAL_ZOOM_STEPS, materialViewKey } =
  await import('../src/material/lifecycle.ts');

const materialSource = readFileSync(new URL('../src/material/MaterialSurface.tsx', import.meta.url), 'utf8');
const lifecycleSource = readFileSync(new URL('../src/material/lifecycle.ts', import.meta.url), 'utf8');
const fileSurfaceSource = readFileSync(new URL('../src/files/FileSurface.tsx', import.meta.url), 'utf8');

const freshRecord = (generation = 0) => ({ generation, readiness: 'loading', frameLoaded: -1 });

// ---------------------------------------------------------------------------
// The readiness machine (C25): every event names its generation; a retired
// generation's event never lands; a committed replacement is the only reset.

test('readiness: begin loads, the real observation readies, a failure lands even after ready', () => {
  const live = 0;
  let record = advanceReadiness(live, freshRecord(0), { kind: 'begin', generation: 0 });
  assert.deepEqual(record, { generation: 0, readiness: 'loading', frameLoaded: -1 });
  record = advanceReadiness(live, record, { kind: 'observe', generation: 0, outcome: { kind: 'ready' } });
  assert.equal(record.readiness, 'ready');
  assert.equal(record.error, undefined);
  record = advanceReadiness(live, record, { kind: 'observe', generation: 0, outcome: { kind: 'failed', error: 'boom' } });
  assert.equal(record.readiness, 'failed', 'a same-generation failure still lands after ready');
  assert.equal(record.error, 'boom');
});

test('readiness: a late retired-generation event can neither clear nor claim a newer state', () => {
  const live = 1;
  const committed = advanceReadiness(live, { generation: 0, readiness: 'ready', frameLoaded: 0 }, { kind: 'begin', generation: 1 });
  assert.deepEqual(committed, freshRecord(1), 'a committed replacement resets the record');
  assert.equal(
    advanceReadiness(live, committed, { kind: 'observe', generation: 0, outcome: { kind: 'ready' } }),
    committed,
    'a retired ready never lands',
  );
  assert.equal(
    advanceReadiness(live, committed, { kind: 'observe', generation: 0, outcome: { kind: 'failed', error: 'late boom' } }),
    committed,
    'a retired failure never clears the newer state',
  );
  assert.equal(advanceReadiness(live, committed, { kind: 'frame-loaded', generation: 0 }), committed, 'a retired frame load never lands');
  assert.equal(advanceReadiness(live, committed, { kind: 'begin', generation: 0 }), committed, 'a retired begin never resets');
  // A stale record (the new generation committed, its begin not yet applied)
  // cannot be claimed by an observation either — its own begin will reset it.
  const stale = { generation: 0, readiness: 'ready', frameLoaded: 0 };
  assert.equal(advanceReadiness(1, stale, { kind: 'observe', generation: 1, outcome: { kind: 'ready' } }), stale);
});

test('readiness: ready never clears a failure, a frame load never proves readiness, both are idempotent', () => {
  const live = 3;
  let record = advanceReadiness(live, freshRecord(3), { kind: 'begin', generation: 3 });
  record = advanceReadiness(live, record, { kind: 'observe', generation: 3, outcome: { kind: 'failed', error: 'x' } });
  assert.equal(advanceReadiness(live, record, { kind: 'observe', generation: 3, outcome: { kind: 'ready' } }), record, 'ready never clears a failure of the same generation');

  record = advanceReadiness(live, freshRecord(3), { kind: 'begin', generation: 3 });
  const loaded = advanceReadiness(live, record, { kind: 'frame-loaded', generation: 3 });
  assert.equal(loaded.frameLoaded, 3, 'the live frame load is recorded beside readiness');
  assert.equal(loaded.readiness, 'loading', 'an iframe load event alone never makes the document ready');
  assert.equal(advanceReadiness(live, loaded, { kind: 'frame-loaded', generation: 3 }), loaded, 'a double load is idempotent');
  const readied = advanceReadiness(live, loaded, { kind: 'observe', generation: 3, outcome: { kind: 'ready' } });
  assert.equal(readied.readiness, 'ready');
  assert.equal(readied.frameLoaded, 3, 'readiness never erases the frame observation');
});

// ---------------------------------------------------------------------------
// The persisted view record (§6): restore the person's Rendered|Source
// choice and zoom per binding; an unusable record means "nothing saved", so
// the default-rendered first-mount policy holds.

test('view prefs: the record round-trips through the same localStorage string shape', () => {
  assert.deepEqual(parseMaterialViewPrefs(encodeMaterialViewPrefs({ view: 'source', zoom: 1.5 })), { view: 'source', zoom: 1.5 });
  assert.deepEqual(parseMaterialViewPrefs(encodeMaterialViewPrefs({ view: 'rendered', zoom: 1 })), { view: 'rendered', zoom: 1 });
  assert.equal(materialViewKey('ws:doc'), 'oi-cradle.material-view:ws:doc', 'same idiom and namespace the zoom key always used');
});

test('view prefs: corrupt or foreign records fall back to nothing saved — first mount opens Rendered', () => {
  for (const raw of [null, '', 'not json at all', '{"view":', '42', '"a string"', '[]', JSON.stringify({ view: 'diagonal', zoom: 1 })]) {
    const parsed = parseMaterialViewPrefs(raw);
    assert.equal(parsed.view, undefined, `no view is guessed from ${JSON.stringify(raw)}`);
    assert.equal('view' in parsed, false, 'the caller default (rendered) applies untouched');
  }
});

test('view prefs: each field stands alone — a bad zoom never discards a good view choice', () => {
  assert.deepEqual(parseMaterialViewPrefs(JSON.stringify({ view: 'source', zoom: 3 })), { view: 'source' }, 'an off-scale zoom is dropped');
  assert.deepEqual(parseMaterialViewPrefs(JSON.stringify({ zoom: 0.75 })), { zoom: 0.75 }, 'a zoom-only record survives');
  assert.deepEqual(parseMaterialViewPrefs(JSON.stringify({ view: 'source' })), { view: 'source' });
  assert.ok(MATERIAL_ZOOM_STEPS.includes(1.25) && MATERIAL_ZOOM_STEPS.includes(0.5), 'the documented zoom scale is intact');
});

// ---------------------------------------------------------------------------
// Static destructive-suspension regression guards. These complement the
// proof; the real behaviour proof is the integrator's walk (see the handoff
// list at the bottom of this file).

test('the material surface no longer destroys its document to hide it', () => {
  assert.ok(!materialSource.includes('about:blank'), 'no blank navigation may exist anywhere in the material renderer');
  assert.ok(!/suspended\s*\?/.test(materialSource), 'suspension must never select a source: no conditional src/srcDoc/img-src branches');
  assert.ok(lifecycleSource.includes('about:blank') === false, 'the lifecycle module carries no blank navigation either');

  assert.ok(materialSource.includes('data-suspended='), 'suspension is published as disclosure for the retention tiers and the walks');
  assert.ok(materialSource.includes('useSuspensionDisclosure'), 'the observation machinery lives in the lifecycle module');
  assert.ok(!materialSource.includes('function useSuspend'), 'no local destructive-suspension hook remains');

  // Every rendered source is unconditional: the same URL/string whatever the
  // visibility.
  assert.equal((materialSource.match(/src=\{htmlBasis\.frameUrl\}/g) ?? []).length, 1, 'the HTML frame keeps its material URL mounted');
  assert.equal((materialSource.match(/src=\{baseUrl\}/g) ?? []).length, 1, 'the PDF frame keeps its material URL mounted');
  assert.ok(materialSource.includes('srcDoc={bridgeHtmlDocument}'), 'the bridge HTML frame keeps its srcDoc mounted');
  assert.ok(materialSource.includes('srcDoc={markdownHtmlDocument}'), 'the Markdown frame keeps its srcDoc mounted');
  assert.ok(materialSource.includes('src={imageSrc}'), 'the image keeps its src mounted');

  // key={generation} stays ONLY as the committed-replacement remount.
  assert.ok((materialSource.match(/key=\{generation\}/g) ?? []).length >= 5, 'every frame keeps its generation key as the only remount');
});

test('readiness is generation-honest at the surface: frame loads are recorded, never trusted alone', () => {
  assert.ok(materialSource.includes('useMaterialReadiness'), 'the readiness state machine is the lifecycle module\u2019s');
  assert.ok(materialSource.includes('markFrameLoaded(generation)'), 'the frame\u2019s load feeds the generation-guarded observation');
  assert.ok(!materialSource.includes('htmlFrameLoaded'), 'the unguarded load state is gone');
  assert.ok(materialSource.includes('loadState.frameLoaded!==generation'), 'the host handshake still demands the live generation\u2019s own frame load');
  assert.ok(materialSource.includes('value.generation!==generation'), 'the host handshake still validates the message generation itself');
});

test('acquisition is shared: the renderer consumes the broker, never a second direct read', () => {
  assert.ok(materialSource.includes('acquireFileReading(') && materialSource.includes('acquireFileBytes('), 'the material renderer acquires through the shared broker');
  assert.ok(!/\breadFile\(/.test(materialSource) && !/\breadFileBytes\(/.test(materialSource), 'no direct client reads remain in the material renderer');
  assert.ok(!/from "\.\.\/files\/client"/.test(materialSource), 'the material renderer no longer imports the raw client at all');

  assert.ok(fileSurfaceSource.includes('acquireFileReading('), 'the editor reads through the shared seam');
  assert.ok(fileSurfaceSource.includes('peekFileReading('), 'the editor seeds from the resident reading');
  assert.ok(fileSurfaceSource.includes('invalidateFile('), 'revalidation forces the owner round trip instead of a cache answer');
  assert.ok(!/\breadFile\(/.test(fileSurfaceSource), 'no direct client reads remain in the editor');
  // Everything the editor already guaranteed must survive the seam swap.
  assert.ok(fileSurfaceSource.includes('readDraft') && fileSurfaceSource.includes('writeDraft') && fileSurfaceSource.includes('clearSavedDraft'), 'the durable draft path is untouched');
  assert.ok(fileSurfaceSource.includes('fileOperation'), 'writes, history and CAS still cross the owner operation');
  assert.ok(fileSurfaceSource.includes('expected_revision:submitted.base_revision'), 'the CAS expected-revision guard is intact');
  assert.ok(fileSurfaceSource.includes('restoreView'), 'scroll/caret restoration is applied for seeded opens as for fresh reads');
  // Recovery now belongs to the native owner; retained-files-native.test.mjs
  // exercises deletion, restart and permission checks against that owner.
  assert.ok(fileSurfaceSource.includes('lastFileReading(transport,binding.location!)'), 'the read-only fallback obtains its retained reading from the native owner');
});

/*
 * Behaviour the integrated walk must still prove (unit tests cannot reach
 * the DOM or the owner):
 *
 * - C01/C02 document-instance identity: conceal an HTML surface (tab switch,
 *   mode switch via the retained park, maximize, window hide) and return —
 *   the SAME iframe DOM node with the SAME inner document token (mark the
 *   document from inside with a window-local symbol), zero navigations, zero
 *   file acquisitions attributed to the return.
 * - C07/C06 shared acquisition counts: opening a file from the tree performs
 *   ONE owner text read total (open path + renderer join); resourceStats()
   * shows one acquisition and one join, not two acquisitions.
 * - Warm reload of an unchanged document: the explicit Reload remounts the
 *   frame exactly once (committed replacement) and the broker serves the
 *   unchanged revision from cache — the reload is one navigation, no blank
 *   storm, and the revision is disclosed as unchanged.
 * - C25 live: inject a delayed postMessage/load from a retired frame
 *   generation; the live surface keeps its loading/failed state and never
 *   claims the retired revision ready.
 * - C24 suspension disclosure: data-suspended flips true in the park/hidden
 *   pane while the document keeps running its own clock — disclosure only.
 * - Personal-page host handshake after conceal→reveal: the hosted
 *   PageExpression state survives (no re-post storm, no invalidation).
 * - FileSurface seeded open: with a warm broker entry the editor paints the
 *   resident text on the first commit and typing works before the owner
 *   revalidation lands; an external change landing in that window surfaces
 *   as conflict, not overwrite.
 * - Source/Rendered selection: toggling to Source, unmounting (tab close
 *   and reopen) and remounting restores the chosen view; a first-ever mount
 *   still opens Rendered.
 */

// ---------------------------------------------------------------------------
// The per-open Source request (a passage opens its file in Source for this
// open only). Scripted composition: the real request, take, queue and judge
// primitives, with a model of a mounted MaterialSurface and TextEditor. The
// React wiring of the real component is pinned against source at the end.

const {requestMaterialViewOpen, peekMaterialViewOpen, takeMaterialViewOpen, MATERIAL_VIEW_OPEN_EVENT} =
  await import('../src/material/lifecycle.ts');
const {queueSourcePassageReveal, takeSourcePassageReveal, judgePassageReveal} =
  await import('../src/expressions/sourceHandoff.ts');

const SOURCE_REF = 'central:notes/ledger.md';

// A browser stand-in: an EventTarget window and an in-memory localStorage that records every write.
function browser() {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map();
  const writes = [];
  const win = new EventTarget();
  Object.defineProperty(globalThis, 'window', {value: win, configurable: true, writable: true});
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { writes.push([key, value]); store.set(key, value); },
      removeItem: key => { store.delete(key); },
    },
    configurable: true,
    writable: true,
  });
  const restoreGlobal = (name, descriptor) => (descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  return {win, store, writes, restore() { restoreGlobal('window', priorWindow); restoreGlobal('localStorage', priorStorage); }};
}

// A MaterialSurface as the source wires it: the initializer peeks a queued request, the mount effect takes it, and a
// live arrival of the request applies it. The editor mounts only once the view is Source (after the owner read) and takes
// a queued reveal at mount; a mounted editor takes an arriving reveal at once. Both gate on the revision they hold.
function mountSurface(env, bindingId, {saved = 'rendered'} = {}) {
  const surface = {view: peekMaterialViewOpen(bindingId) ?? saved, editor: null, refusal: undefined};
  const apply = () => { const next = takeMaterialViewOpen(bindingId); if (next) surface.view = next; };
  apply();
  env.win.addEventListener(MATERIAL_VIEW_OPEN_EVENT, event => { if (event.detail?.bindingId === bindingId) apply(); });
  const judge = (passage, editor) => {
    const verdict = judgePassageReveal(passage, {bindingId, sourceRef: SOURCE_REF, revision: editor.revision, docLength: editor.docLength});
    if (verdict.kind === 'reveal') editor.selection = {start: verdict.start, end: verdict.end};
    else if (verdict.kind === 'refuse') surface.refusal = verdict.reason;
  };
  env.win.addEventListener('oi:context-reveal', event => {
    const passage = event.detail;
    if (surface.editor && passage?.kind === 'source-passage' && passage.bindingId === bindingId) { takeSourcePassageReveal(bindingId); judge(passage, surface.editor); }
  });
  surface.mountEditor = (revision, docLength = 100) => {
    if (surface.view === 'rendered' || surface.editor) return;
    surface.editor = {revision, docLength, selection: undefined};
    const queued = takeSourcePassageReveal(bindingId);
    if (queued) judge(queued, surface.editor);
  };
  surface.chooseRendered = () => { surface.view = 'rendered'; };
  return surface;
}

// The Workbench's passage open: the per-open request first, then the reveal is queued (both in one turn).
function openPassage(bindingId, revision = 'rev-7') {
  requestMaterialViewOpen(bindingId, 'source');
  queueSourcePassageReveal({kind: 'source-passage', bindingId, sourceRef: SOURCE_REF, start: 4, end: 9, revision});
}

test('a per-open request is keyed by binding, peeked without consuming, taken once, announced, and never stored', () => {
  const env = browser();
  try {
    const heard = [];
    env.win.addEventListener(MATERIAL_VIEW_OPEN_EVENT, event => heard.push(event.detail));
    requestMaterialViewOpen('req-a', 'source');
    assert.deepEqual(heard, [{bindingId: 'req-a', view: 'source'}], 'a mounted surface is announced with the binding it names');
    assert.equal(peekMaterialViewOpen('req-a'), 'source', 'a peek does not consume: StrictMode runs the state initializer twice');
    assert.equal(takeMaterialViewOpen('req-a'), 'source');
    assert.equal(takeMaterialViewOpen('req-a'), undefined, 'the request is applied once');
    assert.equal(peekMaterialViewOpen('req-b'), undefined, 'another binding never receives it');
    assert.deepEqual(env.writes, [], 'the request writes nothing to storage');
  } finally { env.restore(); }
});

test('held Rendered tab: the Source view is switched now, and the reveal lands at the current revision when the editor mounts', () => {
  const env = browser();
  try {
    const surface = mountSurface(env, 'held-1');
    assert.equal(surface.view, 'rendered');
    openPassage('held-1', 'rev-7');
    assert.equal(surface.view, 'source', 'the switch happens for this open, at the passage, not at a later Source click');
    assert.equal(surface.editor, null, 'the editor has not mounted yet (the owner read is still in flight)');
    surface.mountEditor('rev-7');
    assert.deepEqual(surface.editor.selection, {start: 4, end: 9}, 'the reveal lands at mount, judged against the current revision');
    assert.equal(takeSourcePassageReveal('held-1'), undefined, 'nothing is left queued for a later switch');
    assert.deepEqual(env.writes, [], 'nothing is remembered');
  } finally { env.restore(); }
});

test('held tab whose editor is already mounted: the reveal lands immediately, at the current revision', () => {
  const env = browser();
  try {
    const surface = mountSurface(env, 'held-2');
    surface.view = 'source';
    surface.mountEditor('rev-7');
    surface.chooseRendered();
    openPassage('held-2', 'rev-7');
    assert.equal(surface.view, 'source');
    assert.deepEqual(surface.editor.selection, {start: 4, end: 9}, 'an editor that is already mounted takes the reveal now');
  } finally { env.restore(); }
});

test('held tab with a stale revision: the passage is refused by name, never placed, never queued for later', () => {
  const env = browser();
  try {
    const surface = mountSurface(env, 'held-3');
    openPassage('held-3', 'rev-7');
    surface.mountEditor('rev-8');
    assert.equal(surface.editor.selection, undefined);
    assert.match(surface.refusal, /changed after the passage was disclosed/);
    assert.equal(takeSourcePassageReveal('held-3'), undefined);
  } finally { env.restore(); }
});

test('new tab, surface mounted after the request: the initializer peeks it and the reveal lands at mount', () => {
  const env = browser();
  try {
    openPassage('new-1', 'rev-7');
    const surface = mountSurface(env, 'new-1');
    assert.equal(surface.view, 'source', 'a new tab opens in Source for the passage');
    surface.mountEditor('rev-7');
    assert.deepEqual(surface.editor.selection, {start: 4, end: 9});
    assert.deepEqual(env.writes, []);
  } finally { env.restore(); }
});

test('new tab, surface mounted before the request: the arriving request switches it and the reveal lands', () => {
  const env = browser();
  try {
    const surface = mountSurface(env, 'new-2');
    openPassage('new-2', 'rev-7');
    assert.equal(surface.view, 'source');
    surface.mountEditor('rev-7');
    assert.deepEqual(surface.editor.selection, {start: 4, end: 9});
  } finally { env.restore(); }
});

test('the remembered view is unchanged by a passage open, held or new', () => {
  const env = browser();
  try {
    const key = 'oi-cradle.material-view:remembered-1';
    env.store.set(key, JSON.stringify({view: 'rendered', zoom: 1.25}));
    const held = mountSurface(env, 'remembered-1', {saved: 'rendered'});
    openPassage('remembered-1', 'rev-7');
    held.mountEditor('rev-7');
    assert.equal(env.store.get(key), JSON.stringify({view: 'rendered', zoom: 1.25}), 'the stored record is byte-identical');
    assert.deepEqual(env.writes, [], 'a passage open performs no storage write');

    openPassage('remembered-2', 'rev-7');
    mountSurface(env, 'remembered-2');
    assert.equal(env.store.get('oi-cradle.material-view:remembered-2'), undefined, 'a new tab with a passage leaves no remembered choice behind');
  } finally { env.restore(); }
});

// ---------------------------------------------------------------------------
// The wiring of the real component (source pins). The person's own toggle and zoom are the only writers of the record.

test('MaterialSurface peeks the per-open request in its initializer, takes it in the mount effect, and applies a live arrival', () => {
  assert.match(materialSource, /useState<MaterialView>\(\(\) => peekMaterialViewOpen\(binding\.id\) \?\? savedView\.view \?\? "rendered"\)/);
  assert.match(materialSource, /const next = takeMaterialViewOpen\(binding\.id\); if \(next\) setView\(next\);/);
  assert.match(materialSource, /window\.addEventListener\(MATERIAL_VIEW_OPEN_EVENT, arrived\)/);
  assert.match(materialSource, /window\.removeEventListener\(MATERIAL_VIEW_OPEN_EVENT, arrived\)/);
});

test('MaterialSurface persists only the person\'s own toggle and zoom; the per-open view never reaches the record', () => {
  assert.equal((materialSource.match(/localStorage\.setItem\(/g) ?? []).length, 1, 'one registered write site, inside rememberView');
  assert.match(materialSource, /const rememberView = \(prefs: \{view: MaterialView; zoom: number\}\) => \{ try \{ localStorage\.setItem\(viewKey, encodeMaterialViewPrefs\(prefs\)\)/);
  assert.match(materialSource, /const chooseView = \(next: MaterialView\) => \{ setView\(next\); remembered\.current = next; rememberView\(\{view: next, zoom\}\); \};/, 'the person\'s toggle writes the record');
  assert.match(materialSource, /const chooseZoom = \(next: number\) => \{ setZoom\(next\); rememberView\(\{view: remembered\.current, zoom: next\}\); \};/, 'zoom writes the remembered view, never a per-open one');
  assert.doesNotMatch(materialSource, /\[viewKey,view,zoom\]/, 'the mount-time persist of the live view is gone');
  assert.doesNotMatch(materialSource, /onChange=\{setView\}/, 'no toggle writes the view without persisting it');
  assert.match(materialSource, /onChange=\{e=>chooseZoom\(Number\(e\.target\.value\)\)\}/);
  assert.equal((materialSource.match(/onChange=\{chooseView\}/g) ?? []).length, 2, 'both toggle sites are the person\'s own choice');
});

test('lifecycle carries the request and event as pure functions with no storage write', () => {
  assert.equal(MATERIAL_VIEW_OPEN_EVENT, 'oi:material-view-open');
  assert.doesNotMatch(lifecycleSource, /localStorage\.setItem/);
});

// ---------------------------------------------------------------------------
// A per-open request lives only for its own open: it waits MATERIAL_VIEW_OPEN_WINDOW_MS for its surface to mount, then lapses.

const {dropMaterialViewOpen, peekMaterialViewOpen: peekLapsed, MATERIAL_VIEW_OPEN_WINDOW_MS} = await import('../src/material/lifecycle.ts');

test('a per-open request waits for a late mount, then lapses: a later ordinary open of the same binding never inherits it', async (t) => {
  const env = browser();
  t.mock.timers.enable({apis: ['setTimeout']});
  try {
    requestMaterialViewOpen('late-1', 'source');
    t.mock.timers.tick(MATERIAL_VIEW_OPEN_WINDOW_MS - 100);
    const late = mountSurface(env, 'late-1');
    assert.equal(late.view, 'source', 'a new tab that mounts late within the window still opens in Source');
    requestMaterialViewOpen('lapsed-1', 'source');
    assert.equal(peekLapsed('lapsed-1'), 'source', 'it waits for its surface');
    t.mock.timers.tick(MATERIAL_VIEW_OPEN_WINDOW_MS + 1);
    assert.equal(peekLapsed('lapsed-1'), undefined, 'it lapses once the window has passed');
    const surface = mountSurface(env, 'lapsed-1');
    assert.equal(surface.view, 'rendered', 'a later ordinary open opens the remembered view, not Source');
    assert.deepEqual(env.writes, []);
  } finally { t.mock.timers.reset(); env.restore(); }
});

test('a request taken by its mount is applied once, and a dropped request is gone', async () => {
  const env = browser();
  try {
    requestMaterialViewOpen('taken-1', 'source');
    const surface = mountSurface(env, 'taken-1');
    assert.equal(surface.view, 'source');
    const later = mountSurface(env, 'taken-1');
    assert.equal(later.view, 'rendered', 'the taken request is not replayed to a later mount');
    requestMaterialViewOpen('dropped-1', 'source');
    dropMaterialViewOpen('dropped-1');
    assert.equal(peekLapsed('dropped-1'), undefined, 'a request whose passage reveal was dropped is gone at once');
    assert.equal(takeMaterialViewOpen('dropped-1'), undefined);
  } finally { env.restore(); }
});
