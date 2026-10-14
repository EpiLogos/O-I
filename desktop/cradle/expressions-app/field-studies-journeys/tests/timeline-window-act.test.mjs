// Lane-2 T17 — the frame side of the explicit window act. The Timeline's one control is the session's own shared-window
// control: its verb names what it asserts on M2′ ("Read over this window"), it is labelled with the window it will assert,
// and nothing in the Timeline's view-state path (zoom, pan, projection) writes the window. Source-scripted: each check re-reads its file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const engine = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = name => readFile(resolve(engine, name), 'utf8');

test('the window control is labelled with the window it will assert, via the contract naming, not a second formatter', async () => {
  const writer = await read('src/sharedTimeWindow.tsx');
  assert.match(writer, /import \{SHARED_TIME_NUDGE,windowLabel\} from '\.\.\/\.\.\/\.\.\/src\/techne\/session'/);
  assert.match(writer, /const asserted=draft\.captured\?\{from:draft\.from\|\|null,to:draft\.to\|\|null\}:\(declared\?\?null\);/, 'the draft is what Apply asserts while it is open');
  assert.match(writer, /const named=windowLabel\(asserted\);/);
  assert.match(writer, /Time\{named\?` · \$\{named\}`:''\}/, 'the label names the window; absent until one is set');
  assert.doesNotMatch(writer, /Time\{declared\?' · bounded'/, 'the old bounded-only label is gone');
});

test('the M2′ act is named by its verb; Places keeps its plain Apply', async () => {
  const writer = await read('src/sharedTimeWindow.tsx');
  assert.match(writer, /export const TIMELINE_ACT_LABEL='Read over this window';/);
  assert.match(writer, /\{busy\?'Applying…':applyLabel\}/);
  assert.match(writer, /applyLabel='Apply'\}/, 'the default verb is the Places Apply');
  const instruments = await read('src/researchInstruments.tsx');
  assert.match(instruments, /TIMELINE_ACT_LABEL,type SharedTimeDraft\} from '\.\/sharedTimeWindow\.js'/);
  assert.match(instruments, /applyLabel=\{selected==='m2'\?TIMELINE_ACT_LABEL:undefined\}/, 'only the Timeline mount names the act');
});

test('zoom and pan never write the window: the Timeline view-state path is a presentation store only', async () => {
  const instruments = await read('src/researchInstruments.tsx');
  const start = instruments.indexOf('initialState={state.timeline!} onViewStateChange={');
  assert.ok(start >= 0, 'the Timeline mount is found');
  const handler = instruments.slice(start, instruments.indexOf('onOpenCanvasNode=', start));
  assert.match(handler, /onViewStateChange=\{value=>\{const moved=/);
  assert.doesNotMatch(handler, /writeSharedTimeWindow|writeSharedSpatialFocus|writeSharedTraversalHop|setTimeWindow|timeControls/, 'the camera view-state handler writes nothing to the session');
  const writers = [...instruments.matchAll(/writeSharedTimeWindow\(request,nativeReading,'(timeline|place)'/g)].map(match => match[1]);
  assert.ok(writers.length >= 2, 'the window is written only by explicit acts (carry, Places set, plan restore)');
});
