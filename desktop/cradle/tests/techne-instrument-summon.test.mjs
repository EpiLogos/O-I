// The legacy cradle host answers an instrument summon from its hosted frame. The application asked with
// {request:'summon', detail:{kind:'instrument', lens, ref?}} (the Palace's Open on a region — the frame's Palace lens retired with
// T-PALACES-ONTO-ATLAS, its builder `palaceInstrumentOpenRequest` with it; the wire it sent is written out below, unchanged);
// the presented Technē centre answers in that same frame with the `lens` host-command carrying the ref — the answer the new
// shell's ExpressionsHost.selectInstrument gives. 28266fefb dropped the cradle's branch, so the summon landed nowhere; this
// pins the wire (instrumentLensCommand), its parity with the new shell, and the PointCloudHost branch (source-level: it is a
// React component).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {instrumentLensCommand} from '../src/expressions/hostedApp.ts';
/** The summon the frame's Palace sent (the retired palaceWhole.ts palaceInstrumentOpenRequest, at fdc302870, verbatim): the instrument
 * alone when no ref travels, so no `ref` key is invented. */
function palaceInstrumentOpenRequest(lens, ref) {
  return {request: 'summon', detail: {kind: 'instrument', lens, ...(ref !== undefined ? {ref} : {})}};
}
// The boundary's own production-source loader (TypeScript transpile, type-only imports elided), as frame-time-push uses it.
import {register} from 'node:module';
register('../../../packages/expressions-boundary/tests/editor-source-loader.mjs', import.meta.url);
const {ExpressionsHost} = await import('../../../packages/expressions-boundary/src/host.ts');
const {CHANNEL_VERSION} = await import('../../../packages/expressions-boundary/src/protocol.ts');

const LENSES = ['project', 'canvas', 'timeline', 'journey', 'place', 'palace'];
const REF = 'expression:palace-walk#region:canvas';

test('a Palace region Open becomes the lens host-command for the same lens, carrying its ref', () => {
  for (const lens of LENSES) {
    const {request, detail} = palaceInstrumentOpenRequest(lens, REF);
    assert.equal(request, 'summon');
    assert.deepEqual(instrumentLensCommand(detail), {v: 1, kind: 'host-command', command: 'lens', lens, ref: REF});
  }
  // A summon with no object (the Palace's Return to ground) opens the lens alone: no ref key is invented.
  const bare = instrumentLensCommand(palaceInstrumentOpenRequest('project').detail);
  assert.deepEqual(bare, {v: 1, kind: 'host-command', command: 'lens', lens: 'project'});
  assert.equal(Object.hasOwn(bare, 'ref'), false);
});

test('what the channel does not answer is refused, never guessed', () => {
  assert.equal(instrumentLensCommand({kind: 'instrument', lens: 'expressions'}), null, 'the 3:3 reading is not a deep instrument');
  assert.equal(instrumentLensCommand({kind: 'instrument', lens: 'studio'}), null);
  assert.equal(instrumentLensCommand({kind: 'instrument'}), null);
  assert.equal(instrumentLensCommand({kind: 'source', lens: 'canvas', ref: REF}), null, 'a source summon is not an instrument summon');
  assert.equal(instrumentLensCommand(null), null);
  assert.equal(instrumentLensCommand('canvas'), null);
  for (const ref of ['', '   ', 'a'.repeat(513), 'line\nbreak', 42, {ref: REF}, null]) {
    assert.equal(instrumentLensCommand({kind: 'instrument', lens: 'canvas', ref}), null, `ref ${JSON.stringify(ref)}`);
  }
  assert.equal(instrumentLensCommand({kind: 'instrument', lens: 'canvas', ref: 'a'.repeat(512)})?.ref.length, 512);
});

test('the cradle answers exactly as the new shell host answers the same summon', async t => {
  const ORIGIN = 'http://127.0.0.1:8788';
  const frame = new EventTarget();
  frame.src = `${ORIGIN}/__application/expressions/index.html`;
  const sent = [];
  frame.contentWindow = {postMessage(data) { sent.push(structuredClone(data)); }};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin: ORIGIN, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'techne', sceneIndex: 0, sceneCount: 1, document: {id: 'expression:palace-walk', name: 'Palace'}, selection: []}});
  for (const ref of [REF, undefined]) {
    const request = palaceInstrumentOpenRequest('timeline', ref);
    sent.length = 0;
    await deliver({v: CHANNEL_VERSION, kind: 'host-request', ...request});
    const lens = sent.filter(message => message.kind === 'host-command' && message.command === 'lens');
    assert.deepEqual(lens, [instrumentLensCommand(request.detail)]);
  }
});

test('PointCloudHost answers the instrument summon in its own frame, only in the Technē cut', async () => {
  const source = await readFile(fileURLToPath(new URL('../src/expressions/PointCloudHost.tsx', import.meta.url)), 'utf8');
  const start = source.indexOf('data.request === "summon" && data.detail?.kind === "instrument"');
  assert.ok(start > 0, 'the instrument summon branch stands in the host-request handler');
  // Ahead of the generic summon broadcast, which would otherwise swallow it as an unknown "oi:techne-summon" kind.
  assert.ok(start < source.indexOf('data.request === "summon" && data.detail?.kind) {'));
  const branch = source.slice(start, source.indexOf('return;', start));
  assert.match(branch, /instrumentLensCommand\(data\.detail\)/);
  assert.match(branch, /mode === "techne"/);
  assert.match(branch, /postMessageToFrame\(node, command\)/);
  assert.match(source, /event\.source !== frame\.current\?\.contentWindow/, 'only this host\'s own frame is answered');
  assert.match(source, /\}, \[kernel\.transport, mode\]\);/, 'the handler re-binds when the cut changes');
});
