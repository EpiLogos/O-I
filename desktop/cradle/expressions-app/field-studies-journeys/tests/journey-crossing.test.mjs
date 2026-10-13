// lane-5 T10/T11 — the journey's guest writer for the crossing and its return.
//   requests  each write carries exactly the acknowledged session's identity (compare-and-set), never a partial one.
//   reply     a crossed or returned session qualifies for this source; a foreign or drifted reply is refused by name.
//   notice    a return that restored nothing names the lost beat in one status line, never an index.
//   echo      the writer's own writes are tracked, so their echo costs nothing.
// The writer module is a .tsx, so it is bundled here the way the cradle's traversal test bundles its owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cradle = resolve(root, '../..');
let api;
let temporary;
test.before(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'oi-journey-crossing-'));
  const out = join(temporary, 'shared-time-window.mjs');
  await build({
    stdin: {
      contents: [
        `export * from ${JSON.stringify(resolve(root, 'src/sharedTimeWindow.tsx'))};`,
        `export {timeAxis as timeAxisOf} from ${JSON.stringify(resolve(cradle, 'src/techne/m0m5/timeline/timeAxis.ts'))};`,
        `export {provingReading} from ${JSON.stringify(resolve(cradle, 'src/techne/m0m5/journey/proving-reading.ts'))};`,
      ].join('\n'),
      resolveDir: root,
    },
    bundle: true, format: 'esm', platform: 'neutral', jsx: 'automatic', outfile: out, logLevel: 'silent',
    nodePaths: [resolve(root, '../node_modules')], loader: {'.css': 'empty'},
  });
  api = await import(`${out}?t=${Date.now()}`);
  reading = api.provingReading();
  subject = reading.subject.subject_ref;
});
test.after(async () => {
  if (temporary) await rm(temporary, {recursive: true, force: true});
});

const EXPRESSION = 'expression:journey-probe';
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const basis = {expression_ref: EXPRESSION, revision: 7, scene_ref: TWO};
let reading, subject;
const selection = (instrument) => ({
  selection_ref: `ql.techne:selection:${subject}:${subject}`, subject_ref: subject,
  reading_ref: reading.reading_ref, instrument, focus_refs: [TWO], selection_standing: 'current',
});
const session = (instrument, extra = {}) => ({
  contract: 'ql.techne/v1', session_ref: 'techne:disclosure-session:journey-probe', subject_ref: subject,
  selection: selection(instrument), instrument, application_cut: instrument === 'expressions' ? '3:3-conjugate' : '4:2-deep',
  reading_ref: reading.reading_ref, expression_focus_ref: EXPRESSION, scene_focus_ref: TWO, navigation: [], ...extra,
});
const acknowledged = (instrument, extra) => ({
  schema: 'oi.native-time-window/v1', basis, reading_ref: reading.reading_ref, instrument,
  session: session(instrument, extra), axis: api.timeAxisOf(reading, null),
});

test('the cross request is the compare-and-set of the acknowledged session, carried whole', () => {
  const ack = acknowledged('journey');
  const request = api.journeyCrossingRequest(basis, reading, ack, TWO);
  assert.equal(request.operation, 'cross');
  assert.equal(request.instrument, 'journey');
  assert.equal(request.target_scene_ref, TWO);
  assert.equal(request.reading_ref, reading.reading_ref);
  assert.equal(request.expected_session_ref, ack.session.session_ref);
  assert.deepEqual(request.expected_selection, ack.session.selection);
  assert.equal(request.expected_window, null);
  assert.deepEqual({e: request.expression_ref, r: request.revision, s: request.scene_ref}, {e: EXPRESSION, r: 7, s: TWO});
});

test('a cross request built from an earlier Scene or source is refused before it is sent', () => {
  const earlier = acknowledged('journey');
  earlier.basis = {...basis, scene_ref: ONE};
  assert.throws(() => api.journeyCrossingRequest(basis, reading, earlier, TWO), /earlier native source or Scene/);
});

test('the return request is addressed to the expressions reading and carries no target', () => {
  const crossed = acknowledged('expressions');
  const request = api.journeyReturnRequest(basis, reading, crossed);
  assert.equal(request.operation, 'return');
  assert.equal(request.instrument, 'expressions');
  assert.equal(request.expected_session_ref, crossed.session.session_ref);
  assert.equal('target_scene_ref' in request, false);
});

test('the refresh request places the presented Scene as the explicit ground on the journey', () => {
  const request = api.journeyRefreshRequest(basis, reading);
  assert.equal(request.operation, 'refresh');
  assert.equal(request.instrument, 'journey');
  assert.equal(request.reading_ref, reading.reading_ref);
});

test('a crossed reply qualifies for this source; a foreign basis, reading, subject or drifted session is refused', () => {
  const crossed = {...acknowledged('expressions'), instrument: 'journey', crossing: {operation: 'cross', scene_ref: TWO}};
  assert.equal(api.qualifyJourneyReply(crossed, basis, reading).crossing.scene_ref, TWO);
  const refused = /does not address this source and Scene/;
  assert.throws(() => api.qualifyJourneyReply({...crossed, basis: {...basis, revision: 8}}, basis, reading), refused);
  assert.throws(() => api.qualifyJourneyReply({...crossed, reading_ref: 'ql.techne:reading:other'}, basis, reading), refused);
  assert.throws(() => api.qualifyJourneyReply({...crossed, session: {...crossed.session, subject_ref: 'subject:other'}}, basis, reading), refused);
  assert.throws(() => api.qualifyJourneyReply({...crossed, session: {...crossed.session, contract: 'ql.techne/v0'}}, basis, reading), refused);
});

test('a return that restored a beat shows no notice; one that lost its beat names it in one line and never an index', () => {
  const restored = {crossing: {operation: 'return', scene_ref: TWO, lost_ref: null}};
  assert.equal(api.journeyReturnNotice(restored), null);
  const lost = {crossing: {operation: 'return', scene_ref: null, lost_ref: TWO}};
  const notice = api.journeyReturnNotice(lost);
  assert.equal(typeof notice, 'string');
  assert.match(notice, /"two"/, 'the lost beat is named by its title');
  assert.equal(notice.includes('\n'), false, 'one status line');
  assert.equal(/\d/.test(notice), false, 'no position is offered');
});

test('the tracked own write settles to its value, and its refusal propagates unchanged', async () => {
  assert.equal(await api.trackOwnSharedTimeWrite(Promise.resolve(3)), 3);
  await assert.rejects(api.trackOwnSharedTimeWrite(Promise.reject(Error('refused'))), /refused/);
});

test('the journey return restores its beat by ref equality and is wired from the activation path', async () => {
  const instrument = await readFile(resolve(root, 'src/journeyInstrument.tsx'), 'utf8');
  const restore = instrument.slice(instrument.indexOf('returnFromCrossing'), instrument.indexOf('returnFromCrossing') + 2000);
  assert.match(restore, /\.find\(card=>card\.scene_ref===/, 'the beat is found by its ref');
  assert.equal(/cards\[\s*(index|restore|back|lost|target)/.test(restore), false, 'never a positional restore');
  const app = await readFile(resolve(root, 'src/app.ts'), 'utf8');
  const activation = app.slice(app.indexOf('function activateInstrument('), app.indexOf('const masthead='));
  assert.match(activation, /returnFromCrossing/, 'the journey activation returns through the owner');
});
