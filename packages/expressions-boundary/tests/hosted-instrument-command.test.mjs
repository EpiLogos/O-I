// The Live instrument's edits travel the hosted stage channel (ticket T-LIVE-TORUS-INSTRUMENT leg 3): a closed, validated
// `instrument` command, answered by the frame's own result, with the owner's refusal named. Out-of-range or unknown edits are
// refused before anything is posted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readStageRequest, stageRequestMessage, readInstrumentEdit, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';

test('every determinant and presentation edit the Studio offers reads as a valid instrument command', () => {
  const edits = [
    {kind: 'lens', lens12: 0}, {kind: 'lens', lens12: 11},
    {kind: 'context-frame', context_frame: 1}, {kind: 'context-frame', context_frame: 7},
    {kind: 'harmonic', source: {selection: 'canonical-basis', index: 0}}, {kind: 'harmonic', source: {selection: 'canonical-basis', index: 7}},
    {kind: 'harmonic', source: {selection: 'selected-source-row'}},
    {kind: 'transcription', rna: true}, {kind: 'transcription', rna: false},
    {kind: 'muted', muted: false}, {kind: 'cadence', rate: 'hold'}, {kind: 'cadence', rate: 1}, {kind: 'cadence', rate: 12},
    {kind: 'level', value: 0}, {kind: 'level', value: 4}, {kind: 'scale', units_per_metre: 120}, {kind: 'follow-scale'},
  ];
  for (const edit of edits) {
    const message = stageRequestMessage(3, {command: 'instrument', edit});
    assert.ok(message, JSON.stringify(edit));
    assert.deepEqual(readStageRequest(message), {req: 3, command: {command: 'instrument', edit}});
  }
});

test('an edit outside the owner law, or with an extra operand, is refused before anything is posted', () => {
  const refused = [
    {kind: 'lens', lens12: 12}, {kind: 'lens', lens12: 1.5}, {kind: 'lens', lens12: '3'}, {kind: 'lens', lens12: 3, extra: true},
    {kind: 'context-frame', context_frame: 0}, {kind: 'context-frame', context_frame: 8},
    {kind: 'harmonic', source: {selection: 'canonical-basis', index: 8}}, {kind: 'harmonic', source: {selection: 'selected-source-row', index: 1}},
    {kind: 'transcription', rna: 'yes'}, {kind: 'muted', muted: 1}, {kind: 'cadence', rate: 3}, {kind: 'cadence', rate: '12'},
    {kind: 'level', value: 5}, {kind: 'level', value: NaN}, {kind: 'scale', units_per_metre: 0}, {kind: 'scale', units_per_metre: 2e6},
    {kind: 'follow-scale', units_per_metre: 120}, {kind: 'strike'}, {}, null,
  ];
  for (const edit of refused) {
    assert.equal(readInstrumentEdit(edit), null, JSON.stringify(edit));
    assert.equal(stageRequestMessage(1, {command: 'instrument', edit}), null, JSON.stringify(edit));
  }
});

test('an effect edit carries closed, typed operands; its range is the owner\'s to refuse in words, not the wire\'s', () => {
  for (const edit of [{kind: 'effect', effect: 'filter', key: 'on', value: true}, {kind: 'effect', effect: 'filter', key: 'type', value: 'notch'},
    {kind: 'effect', effect: 'delay', key: 'division', value: '1/16'}, {kind: 'effect', effect: 'reverb', key: 'decay', value: 99},
    {kind: 'effect-chain', chain: []}, {kind: 'effect-chain', chain: ['reverb', 'filter', 'delay', 'dynamics']}]) {
    assert.deepEqual(readInstrumentEdit(edit), edit, JSON.stringify(edit));
    assert.deepEqual(readStageRequest(stageRequestMessage(4, {command: 'instrument', edit})), {req: 4, command: {command: 'instrument', edit}});
  }
  for (const edit of [{kind: 'effect', effect: 'chorus', key: 'on', value: true}, {kind: 'effect', effect: 'filter', key: 'width', value: 1},
    {kind: 'effect', effect: 'filter', key: 'cutoff', value: '900'}, {kind: 'effect', effect: 'filter', key: 'on', value: 1},
    {kind: 'effect', effect: 'filter', key: 'on', value: true, extra: 1}, {kind: 'effect', effect: 'delay', key: 'time'},
    {kind: 'effect-chain', chain: ['filter', 'filter']}, {kind: 'effect-chain', chain: ['phaser']}, {kind: 'effect-chain', chain: 'filter'}, {kind: 'effect-chain'}])
    assert.equal(readInstrumentEdit(edit), null, JSON.stringify(edit));
});

test('the host posts the instrument command and settles with the frame answer; a named refusal reaches the shell', async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => true});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  const accepted = host.stageCommand({command: 'instrument', edit: {kind: 'lens', lens12: 3}});
  const posted = (await wire.observe()).filter(d => d.command === 'instrument').at(-1);
  assert.deepEqual(posted.edit, {kind: 'lens', lens12: 3});
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'instrument', req: posted.req, ok: true});
  assert.deepEqual(await accepted, {ok: true});
  const refused = host.stageCommand({command: 'instrument', edit: {kind: 'lens', lens12: 3}});
  const second = (await wire.observe()).filter(d => d.command === 'instrument').at(-1);
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'instrument', req: second.req, ok: false,
    error: 'lens is already acting'});
  assert.deepEqual(await refused, {ok: false, error: 'lens is already acting'});
  assert.throws(() => host.stageCommand({command: 'instrument', edit: {kind: 'lens', lens12: 12}}), /Unknown Expressions stage command/);
});

test('the Live instrument edits reach the owner while the frame is concealed; every other stage command keeps the presented gate', async t => {
  let presented = false;
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => presented});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  // Concealed under the Timeline: the instrument command is posted and answered; a view command is refused, as before.
  assert.equal(host.isReady(), true);
  const edit = host.stageCommand({command: 'instrument', edit: {kind: 'muted', muted: false}});
  const posted = (await wire.observe()).filter(d => d.command === 'instrument').at(-1);
  assert.deepEqual(posted.edit, {kind: 'muted', muted: false}, 'posted while concealed');
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'instrument', req: posted.req, ok: true});
  assert.deepEqual(await edit, {ok: true});
  assert.throws(() => host.stageCommand({command: 'view', action: 'guides'}), /concealed/, 'the presented gate still holds for the rest');
  // Presented: nothing changes for any command.
  presented = true;
  assert.doesNotThrow(() => host.stageCommand({command: 'view', action: 'guides'}).catch(() => {}));
});
