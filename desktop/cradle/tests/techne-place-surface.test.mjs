import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { validateSession } from '../src/techne/contract.ts';
import { createDisclosureSessionStore } from '../src/techne/session.ts';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';

const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const techneRegistry = await server.ssrLoadModule('/src/techne/registry.tsx');
  const place = await server.ssrLoadModule('/src/techne/place/register.ts');

  test('registerPlaceSurface mounts the Place instrument; duplicates are refused; unregister restores', () => {
    const stop = place.registerPlaceSurface();
    const mounted = techneRegistry.techneSurface('place');
    assert.equal(typeof mounted, 'function', 'the place instrument is a mountable component');
    assert.throws(() => place.registerPlaceSurface(), /already registered/, 'a duplicate registration is a composition bug');
    stop();
    assert.equal(techneRegistry.techneSurface('place'), undefined);
  });

  test('clicking a place sets the selection with focus_refs [place_ref]; subject and reading basis unchanged', () => {
    const store = createDisclosureSessionStore();
    const session = store.setSelection({
      selection_ref: 'ql.techne:selection:place-origin',
      subject_ref: 'aikit:wiki:central:wiki:project:quaternal-logic#l5-techne-instrument-constellation',
      reading_ref: 'ql.techne:reading:fixture:representative-subject@1',
      source_ref: 'aikit:source:fixture:place-gazetteer',
      source_revision: '7',
      instrument: 'timeline',
      agent_session_ref: 'agent-session/lesson',
      focus_refs: ['ql:fixture:some-other-focus'],
    });
    const clicked = place.selectionForPlace(session, 'place:fixture:royal-observatory-greenwich');
    assert.equal(clicked.selection_ref, session.selection.selection_ref, 'the selection ref is carried verbatim');
    assert.equal(clicked.subject_ref, session.subject_ref);
    assert.equal(clicked.reading_ref, session.reading_ref);
    assert.equal(clicked.source_ref, session.selection.source_ref);
    assert.equal(clicked.source_revision, session.selection.source_revision);
    assert.equal(clicked.agent_session_ref, session.selection.agent_session_ref);
    assert.equal(clicked.instrument, 'place');
    assert.deepEqual(clicked.focus_refs, ['place:fixture:royal-observatory-greenwich']);
    const moved = store.setSelection(clicked);
    assert.equal(validateSession(moved).valid, true, 'the placed selection is a contract-valid session');
    assert.equal(moved.session_ref, session.session_ref, 'same basis: the session persists, only the selection moves');
    assert.deepEqual(moved.navigation, [], 'focus within one instrument records no hop');
  });

  test('selectionForPlace refuses an empty place ref', () => {
    const store = createDisclosureSessionStore();
    const session = store.setSelection({
      selection_ref: 'ql.techne:selection:place-guard',
      subject_ref: 'aikit:wiki:central:wiki:project:quaternal-logic#l5-techne-instrument-constellation',
      reading_ref: 'ql.techne:reading:fixture:representative-subject@1',
      instrument: 'place',
    });
    assert.throws(() => place.selectionForPlace(session, '  '), /verbatim/);
  });

  test('cross-open targets come from the reading’s disclosure only — never hard-coded', async () => {
    const representative = await loadFixture('representative-subject-v1.json');
    const targets = place.crossOpenTargets(representative);
    assert.deepEqual(
      targets.map((entry) => entry.instrument),
      ['project', 'canvas', 'timeline', 'journey', 'palace', 'expressions'],
      'every available instrument except the current place aperture is offered',
    );
    const absent = await loadFixture('absent-facets-v1.json');
    assert.deepEqual(
      place.crossOpenTargets(absent).map((entry) => entry.instrument),
      ['project', 'canvas', 'timeline'],
      'unavailable instruments carry their reason, they are not offered; the M0′ ground is available',
    );
    assert.deepEqual(place.crossOpenTargets(null), []);
  });
} finally {
  await server.close();
}
