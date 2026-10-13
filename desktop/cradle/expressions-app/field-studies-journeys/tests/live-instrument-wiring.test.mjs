// The Live instrument's wiring in the frame (ticket T-LIVE-TORUS-INSTRUMENT, follow-ups): an instrument edit is applied whether or not the
// stage is visible and is never queued (a refusal is named by the owner); the Live auto-open is checked on the readback tick and on the
// first animation frame after entering, and leaving Live ends the entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
const nativeField = await readFile(new URL('../src/nativeField.ts', import.meta.url), 'utf8');

/** The source of one `case 'name':` block in the frame's stage runner, up to the next case. */
function caseBlock(source, name) {
  const start = source.indexOf(`case '${name}':`);
  assert.ok(start >= 0, `case ${name} exists`);
  const rest = source.slice(start + 1);
  const next = rest.search(/\n  case '/);
  return source.slice(start, next < 0 ? undefined : next + start + 1);
}

test('the instrument edit is applied whether or not the stage is visible: its case reads no visibility', () => {
  const block = caseBlock(app, 'instrument');
  assert.match(block, /nativeField\.command\(command\.edit\)/);
  assert.doesNotMatch(block, /presented|hidden|visib|concealed/i, 'no presentation gate in the instrument case');
});

test('the owner command never queues: it runs the controller operation now, and an owner refusal is thrown by name', () => {
  const start = nativeField.indexOf('const command=async(edit:InstrumentEdit)');
  assert.ok(start >= 0);
  const body = nativeField.slice(start, nativeField.indexOf('/** Enter the Live cut', start));
  assert.doesNotMatch(body, /setTimeout|queue|push\(|pending/i, 'no silent queue');
  assert.match(body, /throw new Error\('No scene is open/, 'a determinant without a scene is refused by name');
});

test('the Live auto-open is checked on the readback tick and on the first animation frame after entering', () => {
  assert.match(nativeField, /const timer=window\.setInterval\(\(\)=>\{[^}]*liveEntry\.check\(\)/);
  assert.match(nativeField, /const openLive=\(\)=>\{liveEntry\.enter\(\);requestAnimationFrame\(\(\)=>liveEntry\.check\(\)\);\};/);
  assert.match(nativeField, /fieldLive:\(\)=>!!\(engine as any\)\.retainedTopology\?\.\(\)/, 'the retry waits for the retained GPU field');
});

test('the cut change to Live enters, and leaving Live ends, the auto-open entry', () => {
  assert.match(app, /if\(mode==='live'&&nativeField\)\{[^}]*nativeField\.openLive\(\);\}/);
  assert.match(app, /if\(mode!=='live'\)nativeField\?\.leaveLive\(\);/);
});
