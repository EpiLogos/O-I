// The presets' owner path (ticket T-LIVE-TORUS-INSTRUMENT leg 6): the frame's `performance` operation is exact, reaches the kernel-expression owner
// only for the presented Scene, and the owner's pure logic summarises, refuses and recalls without ever sealing or hashing a basis.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readFramePerformanceRequest, summarizePerformanceBases, refusePerformanceSave, recallPerformanceBasis,
  readPresetName, FRAME_EXPRESSION_OPERATIONS, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const DIGEST = 'sha256:' + 'a'.repeat(64);
const BASIS_SCHEMA = 'oi.expression-performance-basis/v1';
const refs = {expression_ref: 'expression:kept', scene_ref: 'scene:one'};

// ── 1 — the request is exact ─────────────────────────────────────────────

test("the performance operation is admitted by the frame gate, and each action reads only its own keys", () => {
  assert.equal(FRAME_EXPRESSION_OPERATIONS.has('performance'), true);
  assert.deepEqual(readFramePerformanceRequest({operation: 'performance', action: 'list', ...refs}), {operation: 'performance', action: 'list', ...refs});
  assert.deepEqual(readFramePerformanceRequest({operation: 'performance', action: 'save', name: 'Warm lens', ...refs}),
    {operation: 'performance', action: 'save', name: 'Warm lens', ...refs});
  assert.deepEqual(readFramePerformanceRequest({operation: 'performance', action: 'recall', basis_ref: DIGEST, ...refs}),
    {operation: 'performance', action: 'recall', basis_ref: DIGEST, ...refs});
  assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'list', ...refs, name: 'extra'}), null, 'list names no operand');
  assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'recall', basis_ref: DIGEST, name: 'x', ...refs}), null);
  assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'delete', ...refs}), null, 'an unknown action is refused');
  assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'list'}), null, 'the presented Scene is required');
  assert.equal(readFramePerformanceRequest({operation: 'edit', action: 'list', ...refs}), null);
});

test('a preset name is one trimmed line of 1–64 characters, with no control characters', () => {
  assert.equal(readPresetName('Warm lens'), 'Warm lens');
  for (const bad of ['', ' padded ', 'tab\there', 'line\nbreak', 'x'.repeat(65), 7, null]) assert.equal(readPresetName(bad), null, JSON.stringify(bad));
  assert.equal(readPresetName('x'.repeat(64)), 'x'.repeat(64));
});

test('a recall names one basis by the kernel digest form only', () => {
  for (const bad of ['sha256:' + 'A'.repeat(64), 'sha256:' + 'a'.repeat(63), 'md5:' + 'a'.repeat(64), DIGEST + ' ', 'basis']) {
    assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'recall', basis_ref: bad, ...refs}), null, bad);
  }
});

// ── 2 — the frame's request reaches the owner only as the exact presented request ──

test('a frame performance request for the presented Scene reaches the kernel-expression owner exactly; any other is refused before the owner', async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const calls = [];
  const owners = {channels: {'kernel-expression': async request => { calls.push(request); return {state: 'listed', bases: []}; }}};
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => true});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  await deliver({v: CHANNEL_VERSION, kind: 'kernel-expression', req: 1, request: {operation: 'performance', action: 'list', ...refs}});
  assert.deepEqual(calls, [{operation: 'performance', action: 'list', ...refs}], 'the owner receives the exact request');
  await deliver({v: CHANNEL_VERSION, kind: 'kernel-expression', req: 2, request: {operation: 'performance', action: 'list', expression_ref: 'expression:kept', scene_ref: 'scene:other'}});
  await deliver({v: CHANNEL_VERSION, kind: 'kernel-expression', req: 3, request: {operation: 'performance', action: 'save', name: '  ', ...refs}});
  assert.equal(calls.length, 1, 'a foreign Scene and a malformed save never reach the owner');
  const replies = (await wire.observe()).filter(d => d.kind === 'kernel-expression-result');
  assert.equal(replies.find(d => d.req === 2).ok, false);
  assert.equal(replies.find(d => d.req === 3).ok, false);
});

test("the host's performance action is built from the presented Scene only; with no Scene it refuses and posts nothing", async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const calls = [];
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {'kernel-expression': async request => { calls.push(request); return {state: 'listed', bases: []}; }}},
    messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => true});
  t.after(() => {host.dispose(); wire.dispose();});
  assert.throws(() => host.performance({action: 'list'}), /not reported its state|No native Scene/);
  await host.handleMessage({source: frame.contentWindow, origin, data: {v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}}});
  assert.deepEqual(await host.performance({action: 'save', name: 'Warm lens'}), {state: 'listed', bases: []});
  assert.deepEqual(calls, [{operation: 'performance', action: 'save', name: 'Warm lens', ...refs}], 'the refs come from the frame reading');
  assert.throws(() => host.performance({action: 'save', name: ' '}), /Malformed performance request/);
  assert.equal(calls.length, 1, 'a malformed action never reaches the owner');
});

// ── 3 — the owner's logic: summarise the kernel's bases, refuse a save by name, recall the edits a basis states ──

const basis = (over = {}) => ({schema: BASIS_SCHEMA, content_digest: DIGEST, m1_coordinate: '#1-5-1',
  identity: {event_ref: 'event:kept', m1_revision: '4'}, m1: {config: {lens12: 3, context_frame: 2}}, ...over});

test("the listing carries the digests the kernel holds, unchanged; a malformed record is not listed", () => {
  const listed = summarizePerformanceBases([basis(), basis({content_digest: 'not-a-digest'}), basis({schema: 'other'}), {...basis(), identity: null}]);
  assert.deepEqual(listed, [{basis_ref: DIGEST, event_ref: 'event:kept', m1_coordinate: '#1-5-1'}]);
  assert.equal(listed[0].basis_ref, basis().content_digest, 'the digest is the kernel\'s own, never recomputed');
  assert.deepEqual(summarizePerformanceBases(undefined), []);
});

test('a save is refused by name: the native readings the frame lacks, the Scene performance, and the basis name field', () => {
  const reply = refusePerformanceSave({performance: undefined}, 'Warm lens');
  assert.equal(reply.state, 'refused');
  for (const key of ['m2_plan', 'audio_determination', 'm3_score', 'm3_replay', 'prepared_body', 'tuning', 'force_state', 'form_state']) {
    assert.ok(reply.missing.includes(`native reading ${key}`), key);
  }
  assert.ok(reply.missing.some(row => /retained performance/.test(row)));
  assert.ok(reply.missing.some(row => /name field/.test(row)));
  assert.match(reply.reason, /Nothing was saved/);
  const withReadings = refusePerformanceSave({performance: {bases: []}}, 'Warm lens',
    Object.fromEntries(['m2_plan', 'audio_determination', 'm3_score', 'm3_replay', 'prepared_body', 'tuning', 'force_state', 'form_state'].map(k => [k, {}])));
  assert.deepEqual(withReadings.missing, [`a name field on ${BASIS_SCHEMA} (the record cannot keep "Warm lens")`], 'only the name remains when every reading is supplied');
});

test('a recall states the edits the basis expresses, validated, and names what it cannot apply', () => {
  const reply = recallPerformanceBasis([basis({m3_score: {}, tuning: {}})], DIGEST);
  assert.equal(reply.state, 'recalled');
  assert.deepEqual(reply.edits, [{kind: 'lens', lens12: 3}, {kind: 'context-frame', context_frame: 2}]);
  assert.ok(reply.not_applied.some(row => row.field === 'harmonic basis'));
  assert.ok(reply.not_applied.some(row => row.field === 'transcription'));
  assert.ok(reply.not_applied.some(row => row.field === 'm3_score' && /cannot apply/.test(row.reason)));
  assert.ok(reply.not_applied.some(row => row.field === 'tuning'));
});

test('a recall edit that the instrument command would refuse is never stated; an unknown basis is refused by name', () => {
  const reply = recallPerformanceBasis([basis({m1: {config: {lens12: 12, context_frame: 0}}})], DIGEST);
  assert.deepEqual(reply.edits, []);
  assert.ok(reply.not_applied.some(row => row.field === 'lens'));
  assert.ok(reply.not_applied.some(row => row.field === 'context frame'));
  const missing = recallPerformanceBasis([basis()], 'sha256:' + 'b'.repeat(64));
  assert.equal(missing.state, 'refused');
  assert.match(missing.reason, /No saved basis/);
});

test('the presets module computes no digest and seals nothing: the kernel alone seals a basis', async () => {
  const source = await readFile(new URL('../src/performanceBasis.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /createHash|sha256\(|crypto|digest\(|\.seal\(|content_digest\s*=(?!=)/i);
});

// ── 4 — what the Scene keeps on the Torus (O-I #852, manual §21.2 Sounds and instruments): its sounds, its instruments with their sounds,
// its racks, each listed as the kernel holds it (kernel expression_performance/kept.rs). The listing reads; it seals and hashes nothing.

const KEPT_DIGEST = n => 'sha256:' + String(n).repeat(64);
const prepared = ref => ({schema: 'ql.physical-body-preparation/v1', contract: 'ql.physical-body/v1', request: {preparation_ref: ref}});
const sound = (n, name, body = {kind: 'torus'}) => ({schema: 'oi.torus-sound/v1', sound_ref: KEPT_DIGEST(n), name, sample_rate: 48000,
  checkpoint: {schema: 'ql.torus-checkpoint/v1'}, checkpoint_sha256: KEPT_DIGEST(9), body, sources: [], law: 'kept', seal: 'hmac-sha256:00'});
const keptOnScene = () => ({
  sounds: [sound(1, 'Warm Logic'), sound(2, 'Paper bell', {kind: 'form', prepared: prepared('ql:form-body:fold')}), sound(3, 'Paper hum', {kind: 'form', prepared: prepared('ql:form-body:fold')}),
    {...sound(4, 'Forged'), schema: 'other'}],
  instruments: [{schema: 'oi.torus-instrument/v1', instrument_ref: 'instrument:fold', name: 'Folded sheet', body: prepared('ql:form-body:fold'),
    sounds: [KEPT_DIGEST(2), KEPT_DIGEST(3), KEPT_DIGEST(7)]}],
  racks: [{schema: 'oi.torus-rack/v1', rack_ref: 'rack:warm', name: 'Warm rack', sound: KEPT_DIGEST(1),
    chain: [{device_ref: 'arpeggiator', role: 'note', state: {}}, {device_ref: 'reverb', role: 'effect', state: {}}],
    macros: [{name: 'Bloom', value: 0.5, targets: []}], variations: [{name: 'Open', values: [1]}, {name: 'Closed', values: [0]}]}],
});

test('the listing carries what the Scene keeps on the Torus: sounds on the torus, instruments with the sounds made on them, racks', async () => {
  const {listPerformance} = await import('../src/performanceBasis.ts');
  const listed = listPerformance({bases: [basis()], torus_kept: keptOnScene()});
  assert.deepEqual(listed.bases, [{basis_ref: DIGEST, event_ref: 'event:kept', m1_coordinate: '#1-5-1'}], 'the presets list as they did');
  assert.deepEqual(listed.kept.sounds, [{sound_ref: KEPT_DIGEST(1), name: 'Warm Logic', body: 'torus', body_ref: null, sample_rate: 48000}],
    'a sound made on an instrument stands under it, not again under the Torus; a record that is not a sound is not listed');
  assert.deepEqual(listed.kept.instruments, [{instrument_ref: 'instrument:fold', name: 'Folded sheet', body_ref: 'ql:form-body:fold', sounds: [
    {sound_ref: KEPT_DIGEST(2), name: 'Paper bell', body: 'form', body_ref: 'ql:form-body:fold', sample_rate: 48000},
    {sound_ref: KEPT_DIGEST(3), name: 'Paper hum', body: 'form', body_ref: 'ql:form-body:fold', sample_rate: 48000}]}],
    'its sounds in its own order; one the Scene does not keep is not listed');
  assert.deepEqual(listed.kept.racks, [{rack_ref: 'rack:warm', name: 'Warm rack', sound: KEPT_DIGEST(1), devices: 2, macros: ['Bloom'], variations: ['Open', 'Closed']}]);
  assert.deepEqual(listPerformance({bases: []}), {state: 'listed', bases: []}, 'a Scene that keeps nothing lists as it did');
  assert.deepEqual(listPerformance(undefined), {state: 'listed', bases: []});
});

test("the owner's listing is the Scene performance's, read by the kernel's own inspect", async () => {
  const source = await readFile(new URL('../src/cradle.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(request\.action === 'list'\) return listPerformance\(scene\.performance\);/);
});

// ── 5 — a sound saved and opened (O-I #852, DLW §21.2 "Save the instrument as you tuned it"; "Drag it onto a part to play it"): the
// Scene keeps the sound the kernel sealed, by one edit of its performance; a kept sound is read back whole by its ref, to open.

test('a kept sound is asked for by its ref and kept whole; each action reads only its own keys', () => {
  const kept = sound(1, 'Warm Logic');
  assert.deepEqual(readFramePerformanceRequest({operation: 'performance', action: 'sound', sound_ref: KEPT_DIGEST(1), ...refs}),
    {operation: 'performance', action: 'sound', sound_ref: KEPT_DIGEST(1), ...refs});
  assert.deepEqual(readFramePerformanceRequest({operation: 'performance', action: 'keep-sound', sound: kept, ...refs}),
    {operation: 'performance', action: 'keep-sound', sound: kept, ...refs});
  for (const bad of [{sound_ref: 'sound'}, {sound_ref: KEPT_DIGEST(1), name: 'x'}, {}])
    assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'sound', ...bad, ...refs}), null, JSON.stringify(bad));
  for (const bad of [undefined, {...kept, schema: 'oi.torus-take/v1'}, {...kept, sound_ref: 'x'}, {...kept, name: ''}, {...kept, name: 'x'.repeat(121)},
    {...kept, checkpoint: 'x'.repeat(2 * 1024 * 1024 + 1)}])
    assert.equal(readFramePerformanceRequest({operation: 'performance', action: 'keep-sound', sound: bad, ...refs}), null, JSON.stringify(bad)?.slice(0, 60));
  assert.notEqual(readFramePerformanceRequest({operation: 'performance', action: 'keep-sound', sound: {...kept, name: 'x'.repeat(120)}, ...refs}), null,
    'a name as long as the kernel keeps one');
});

test('the Scene keeps a sound by one edit of its performance, and answers what it keeps then; a kept sound is read back whole', async () => {
  const {keepSoundChange, keptSoundReply, keptSoundRecord, listPerformance} = await import('../src/performanceBasis.ts');
  const kept = sound(1, 'Warm Logic');
  assert.deepEqual(keepSoundChange('scene:one', kept), {change: 'scene_performance_edit', scene_ref: 'scene:one', operations: [{operation: 'keep_torus_sound', sound: kept}]},
    'the kernel opens the Scene\'s performance with it, or keeps it in the one it has; the seal is the kernel\'s to judge');
  const performance = {bases: [], torus_kept: {sounds: [kept], instruments: [], racks: []}};
  assert.deepEqual(keptSoundReply(performance, kept, false), {state: 'kept', sound_ref: KEPT_DIGEST(1), name: 'Warm Logic', unsaved: false,
    kept: listPerformance(performance).kept});
  assert.equal(keptSoundReply(performance, kept, true).unsaved, true, 'kept in the Scene, the Expression not yet written');
  assert.deepEqual(keptSoundReply({bases: []}, kept, true), {state: 'refused', reason: 'The Scene did not keep "Warm Logic".', missing: []});
  assert.deepEqual(keptSoundRecord(performance, KEPT_DIGEST(1)), {state: 'sound', sound: kept}, 'the record as the Scene keeps it');
  assert.deepEqual(keptSoundRecord(performance, KEPT_DIGEST(2)), {state: 'refused', reason: 'The Scene keeps no sound ' + KEPT_DIGEST(2) + '.', missing: []});
  assert.deepEqual(keptSoundRecord({bases: [], torus_kept: {sounds: [{...kept, schema: 'other'}]}}, KEPT_DIGEST(1)).state, 'refused', 'a record that is not a sound opens nothing');
});

test("the owner keeps a sound by the kernel's own edit of the inspected revision, and reads a kept one back by the kernel's own inspect", async () => {
  const source = await readFile(new URL('../src/cradle.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(request\.action === 'sound'\) return keptSoundRecord\(scene\.performance, request\.sound_ref\);/);
  assert.match(source, /operation: 'edit', expression_ref: request\.expression_ref, expected_revision: document\.revision, actor: PERFORMANCE_ACTOR,\s+changes: \[keepSoundChange\(request\.scene_ref, request\.sound\)\]/);
  assert.match(source, /return keptSoundReply\(kept\?\.performance, request\.sound, edited\.dirty === true\);/);
});
