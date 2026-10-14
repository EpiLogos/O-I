// lane-5 T4 — one scene identity, no shadow store. A standing check over the journey surface's own sources, with comments removed so
// each rule speaks of what runs. The surface stores nothing itself, mints no ids, and writes only through the owner channels the
// instrument is handed (scene focus, the kernel edit, the crossing and its return, the source portal). Its one persisted store is
// the presence owner's. Run without a build: it reads the sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src = new URL('../src/', import.meta.url);
const SURFACE = [
  'journeyInstrument.tsx',
  'journeyInstrumentModel.ts',
  'journeyBeats.ts',
  'journeyPath.ts',
  'journeyLoadSchedule.ts',
  'journeyPresence.ts',
  'journeyTimelineLayout.ts',
];
const OWNER_CHANNELS = new Set(['nativeView', 'sceneId', 'portal', 'playback', 'seek', 'read', 'focusScene', 'editExpression', 'crossing', 'returning', 'entered']);

/** The code of a source with its block and line comments removed. */
function codeOf(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}
async function surfaceCode(file) {
  return codeOf(await readFile(new URL(file, src), 'utf8'));
}

test('T4: no surface file touches a browser store or the journey library directly', async () => {
  for (const file of SURFACE) {
    assert.doesNotMatch(await surfaceCode(file), /\b(localStorage|sessionStorage|indexedDB|saveToLibrary|setItem|getItem)\b/, file);
  }
});

test('T4: no surface file mints an id, or builds a scene ref from a template', async () => {
  for (const file of SURFACE) {
    assert.doesNotMatch(await surfaceCode(file), /randomUUID|Math\.random|\buid\(|\$\{[^}]*\}:scene:/, file);
  }
});

test('T4: the presence key lives only in the presence owner, never in the surface', async () => {
  for (const file of SURFACE) {
    assert.doesNotMatch(await surfaceCode(file), /oi-cradle\.techne-journey\.presence/, file);
  }
  const owner = codeOf(await readFile(new URL('../../../src/techne/m0m5/journey/presence.ts', import.meta.url), 'utf8'));
  assert.match(owner, /oi-cradle\.techne-journey\.presence\.v1/);
});

test('T4: the instrument reaches the native Expression only through the channels the host hands it', async () => {
  const called = new Set([...(await surfaceCode('journeyInstrument.tsx')).matchAll(/\bhost\.([A-Za-z]+)/g)].map(match => match[1]));
  assert.ok(called.size > 0);
  for (const name of called) assert.ok(OWNER_CHANNELS.has(name), `host.${name} is not an owner channel`);
});
