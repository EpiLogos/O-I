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
  assert.equal(materialSource.split('src={baseUrl}').length - 1, 2, 'the tauri HTML frame and the PDF frame keep their material URL mounted');
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
  assert.ok(fileSurfaceSource.includes('expected_revision:draft.base_revision'), 'the CAS expected-revision guard is intact');
  assert.ok(fileSurfaceSource.includes('restoreView'), 'scroll/caret restoration is applied for seeded opens as for fresh reads');
  assert.ok(fileSurfaceSource.includes('lastReading('), 'the labelled read-only last-reading fallback survives');
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
