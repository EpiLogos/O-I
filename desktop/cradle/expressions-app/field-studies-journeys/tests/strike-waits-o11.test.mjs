// O11 of the walk of O-I #857 (round 53; DLW build ruling 2026-11-09): a key reaches the owner within an exchange of being struck.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/strike-waits-o11.test.mjs
//
// On the walk stack, keys struck in the Torus's window while the Cymatic Plate swept its stations reached QL 38 to 53 s late. Each hop was
// timed (walk-857 receipts r53-O11-b-01-hops): the frame took the key within about 100 ms, the shell's relay and the bridge took a few hundred,
// and the rest was the frame's one serial owner, where 24 to 34 of the pulse's tunings to the plate's drive stood ahead of each key. The
// plate's drive moves on every frame while a station sweeps; each move past half a percent asked a Torus setting of that owner, and each
// waited behind the last.
//
// The bound is a count: a key struck waits on the owner for at most the one exchange in flight when it was struck, and for nothing queued.
// Time is counted in owner exchanges, a logical clock: an exchange here is answered only when the test lets it. What one exchange costs in
// milliseconds is not this bound's: on the walk stack it is the receipt's size (walk-857 r53-O11-b-05-hops: answers of 0.5 to 3.6 MB, one
// request to the next 0.5 to 0.95 s), which O-I #821 makes smaller. On main the key waited 30 tunings and their fills.
//
// Round 54 item 0 (the review of #951, DLW build ruling 2026-11-09) adds the reviewer's four probes, P1 to P4, each red on round 53's O11:
// the person's Rate and Carrier survive a give-back a newer drive replaces (P1) and a tuning asked before their own setting (P4); while
// the person plays, the frame's reads wait at most READ_WAIT_MS after they are due and then go before the next queued key (P2); and a key
// is never refused because the frame's own read is slow: it waits, and is answered late (P3).
//
// The sources are TypeScript: the controller is bundled once with the app's own esbuild into a temporary directory (as
// janko-keys-853.test.mjs does). The owner is the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs, taught
// torus-play and torus-release as that test teaches them, and held at each exchange until the test lets it answer.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'strike-waits-o11-'));
after(() => rmSync(out, {recursive: true, force: true}));
let built = null;
const controller = () => built ??= (async () => {
  const outfile = join(out, 'controller.mjs');
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [join(journeys, 'src/native-field/controller.ts')],
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
})();
const fixture = () => import(new URL('../../../tests/native-expression-fixture.mjs', import.meta.url));
/** One owner exchange on the walk stack, in ms: the larger of the bridge's two measured means (r52-walk-bridge-lock: 46.9 and 68.5). */
const EXCHANGE_MS = 69;
const frame = () => new Promise(resolve => setTimeout(resolve, 16));
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setTimeout(resolve, 5)); };

const open = async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class HeldOwner extends ControlledSceneOwner {
    /** Each exchange's command, in the order the owner was asked. */
    sent = [];
    /** Exchanges asked and not yet let answer. */
    held = [];
    holding = false;
    hold() { this.holding = true; }
    async answerOne() {
      for (let i = 0; i < 200 && !this.held.length; i++) await new Promise(resolve => setTimeout(resolve, 2));
      assert.ok(this.held.length, 'an exchange waits to be answered');
      this.held.shift()();
      await settle();
    }
    async drain() { this.holding = false; while (this.held.length) this.held.shift()(); await settle(); }
    async request(request) {
      const command = request.request?.command;
      if (command) {
        this.sent.push(command.operation === 'torus-set' ? `torus-set ${command.edit?.rate?.steps_per_second?.toFixed?.(1) ?? JSON.stringify(command.edit)}` : command.operation);
        if (this.holding) await new Promise(release => this.held.push(release));
      }
      if (!['torus-play', 'torus-release'].includes(command?.operation)) return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      if (command.operation === 'torus-release') return reply;
      this.bump(1n);
      reply.field = structuredClone(this.frame);
      reply.field.audio = [];
      reply.torus_play = {schema: 'ql.torus-play/v1', made_way: [], polyphony: 16,
        notes: command.keys.map((key, id) => ({id, key, place: {arc: key.column % 12}, point: {theta: 0.25, phi: 0.5, arc: key.column % 12}}))};
      return reply;
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new HeldOwner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio);
  await c.compose({sky: 'none'});
  await c.torusState();
  return {owner, c};
};

test('a key struck while the plate sweeps the pulse reaches the owner after the one exchange in flight, never behind the tunings', async () => {
  const {owner, c} = await open();
  try {
    owner.hold();
    // The station sweep: the plate's drive moves 1 % a frame, and the frame tunes the pulse to it on every one (nativeField.ts).
    let hz = 100;
    const tuned = [c.tunePulse(hz).catch(error => error)];
    for (let i = 0; i < 200 && !owner.held.length; i++) await new Promise(resolve => setTimeout(resolve, 2));
    assert.equal(owner.held.length, 1, 'the first tuning is the exchange in flight');
    for (let i = 0; i < 30; i++) { hz *= 1.01; tuned.push(c.tunePulse(hz).catch(error => error)); await frame(); }
    const struckAt = owner.sent.length;
    const struck = c.torusPlay([{row: 2, column: 30}], 0.35);
    for (let i = 0; i < 400 && !owner.sent.slice(struckAt).includes('torus-play'); i++) await owner.answerOne();
    const ahead = owner.sent.slice(struckAt, owner.sent.indexOf('torus-play', struckAt));
    // The exchanges the key waited on: the one in flight when it was struck, and every one sent after it and before its own.
    const waitedMs = (1 + ahead.length) * EXCHANGE_MS;
    assert.deepEqual(ahead, [], `the key waited on nothing queued: ${ahead.length} exchanges went ahead of it (${waitedMs} ms at the walk stack's exchange)`);
    assert.ok(waitedMs <= EXCHANGE_MS, `the key reached the owner within one exchange of being struck (${waitedMs} ms ≤ ${EXCHANGE_MS} ms)`);
    await owner.drain();
    assert.deepEqual(await struck, [], 'the key was played, and nothing made way');
    await Promise.all(tuned);
    // The pulse follows the drive: the latest drive asked is the one the owner holds, and a drive passed by before it was sent is not sent.
    const settings = owner.sent.filter(op => op.startsWith('torus-set'));
    assert.equal(owner.torusSettings.rate.steps_per_second.toFixed(1), hz.toFixed(1), 'the owner holds the latest drive');
    assert.ok(settings.length <= 2, `the tunings passed by were never sent: ${settings.length} sent for 31 drives (${settings.join(', ')})`);
    assert.equal(owner.torusSettings.carrier > 0, true, 'a Carrier of 0 is raised while the pulse is tuned, as before');
    // Given back: the torus's own rate and Carrier, once the plate no longer drives it.
    await c.tunePulse(null);
    await settle();
    assert.deepEqual(owner.torusSettings.rate, {mode: 'free', steps_per_second: 2.5}, 'the torus\'s own rate is given back');
    assert.equal(owner.torusSettings.carrier, 0, 'and its Carrier');
  } finally { await c.dispose(); }
});

test('a tuning waits for the acts already asked of the owner, and a newer drive replaces it before it is sent', async () => {
  const {owner, c} = await open();
  try {
    owner.hold();
    const from = owner.sent.length;
    const struck = c.torusPlay([{row: 1, column: 12}], 0.35);
    for (let i = 0; i < 200 && !owner.held.length; i++) await new Promise(resolve => setTimeout(resolve, 2));
    const released = c.torusRelease([{row: 1, column: 12}]);
    const tuned = [c.tunePulse(220).catch(error => error), c.tunePulse(240).catch(error => error)];
    await owner.drain();
    await struck; await released; await Promise.all(tuned);
    // The Torus's acts (the pump's own advances keep the lookahead meanwhile, and are not acts).
    const acts = owner.sent.slice(from).filter(op => op.startsWith('torus-'));
    assert.deepEqual(acts, ['torus-play', 'torus-release', 'torus-set 240.0'], 'the key and its release first, then the latest drive alone');
  } finally { await c.dispose(); }
});

// The walk again (r53-O11-b-02-hops): the third key waited 2 s, behind a Torus read on the human cadence and one tuning. Both had begun
// to wait for the exchange in flight before the key reached the serial owner, and each went when it ended. Neither is an act the person
// asked: each now gives way to an act asked while it waited.
const inFlight = async (owner, c) => {
  // An exchange in flight outside the serial owner, as the pump's own and the cadence's reads are.
  const stray = c.session.torusState();
  for (let i = 0; i < 200 && !owner.held.length; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(owner.held.length, 1, 'one exchange is in flight');
  return {stray}; // wrapped: an async function returning the promise would wait for it
};

test('a tuning that waits for the exchange in flight gives way to a key struck while it waits', async () => {
  const {owner, c} = await open();
  try {
    owner.hold();
    const {stray} = await inFlight(owner, c);
    const from = owner.sent.length;
    const tuned = c.tunePulse(180).catch(error => error);
    await frame();
    const struck = c.torusPlay([{row: 1, column: 20}], 0.35);
    await frame();
    await owner.drain();
    await stray; await struck; await tuned;
    const acts = owner.sent.slice(from).filter(op => op.startsWith('torus-'));
    assert.deepEqual(acts, ['torus-play', 'torus-set 180.0'], 'the key first, then the tuning');
  } finally { await c.dispose(); }
});

test('the Torus read on the human cadence never goes ahead of a key struck while it waited', async () => {
  const {owner, c} = await open();
  try {
    owner.hold();
    const {stray} = await inFlight(owner, c);
    const from = owner.sent.length;
    c.torusAt = -Infinity; // the once-a-second read is due
    const refreshed = c.refreshSources();
    await new Promise(resolve => setTimeout(resolve, 2));
    const struck = c.torusPlay([{row: 1, column: 20}], 0.35);
    await owner.drain();
    await stray; await struck; await refreshed;
    const acts = owner.sent.slice(from).filter(op => op.startsWith('torus-'));
    assert.equal(acts[0], 'torus-play', `the key first: ${acts.join(', ')}`);
  } finally { await c.dispose(); }
});

// The walk once more (r53-O11-b-03-hops): the third key came while the frame's own complete source read was in flight. The read had begun
// before the key reached the frame, 0.6 s after the second key's release was answered, and it took 2.5 s on the loaded stack, so the key
// waited the 2 s a played act waits and was refused. Nothing goes ahead of an exchange in flight, so while the person plays the frame starts
// none of its own reads; they are taken once the playing rests.
const READS = ['torus-state', 'influence', 'inspect', 'stage-state'];
test('while keys are played the frame starts none of its own reads, so a key struck in the phrase finds the owner free', async () => {
  const {owner, c} = await open();
  try {
    await c.torusPlay([{row: 1, column: 20}], 0.35);
    await c.torusRelease([{row: 1, column: 20}]);
    // Every read on the human cadence is due: the Torus's, the influence and the sources (as after a determinant).
    c.torusAt = -Infinity; c.influenceStale = true; c.sourcesStale = true; c.lastInspect = -Infinity;
    const from = owner.sent.length;
    await c.refreshSources();
    assert.deepEqual(owner.sent.slice(from).filter(op => READS.includes(op)), [], 'no read of the frame\'s own while the person plays');
    owner.hold();
    const struck = c.torusPlay([{row: 1, column: 24}], 0.35);
    for (let i = 0; i < 200 && !owner.held.length; i++) await new Promise(resolve => setTimeout(resolve, 2));
    assert.deepEqual(owner.sent.slice(from), ['torus-play'], 'the next key is the next exchange the owner is asked');
    await owner.drain(); await struck;
    // The playing rests (a logical clock: the last played act is put far behind): every read is taken again.
    c.playedAt = -Infinity;
    const rested = owner.sent.length;
    await c.refreshSources();
    const read = owner.sent.slice(rested).filter(op => READS.includes(op));
    for (const op of ['torus-state', 'influence', 'inspect']) assert.ok(read.includes(op), `${op} is read once the playing rests: ${read.join(', ')}`);
  } finally { await c.dispose(); }
});

// Round 54 item 0: the reviewer's probes (review of O-I #951). The rests and the waits are a logical clock: the controller reads
// performance.now(), and a test moves it on by the time a rest or a wait stands for instead of waiting it out.
const realNow = performance.now.bind(performance);
let skipped = 0;
performance.now = () => realNow() + skipped;
const pass = ms => { skipped += ms; };
const inHand = async owner => {
  for (let i = 0; i < 200 && !owner.held.length; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(owner.held.length, 1, 'one exchange is in flight');
};

test('P1: a give-back replaced by a newer drive before it lands keeps the person\'s Rate and Carrier (F3)', async () => {
  const {owner, c} = await open();
  try {
    // The person's Torus: Rate 2.5 free and Carrier 0. The plate drives the pulse at 100, and the Carrier is raised while it does.
    await c.tunePulse(100); await settle();
    assert.equal(owner.torusSettings.rate.steps_per_second, 100);
    assert.ok(owner.torusSettings.carrier > 0);
    owner.hold();
    const struck = c.torusPlay([{row: 1, column: 20}], 0.35);
    await inHand(owner);
    // The plate stops driving (the give-back is wanted behind the key) and drives again at 150 before the give-back is sent.
    const back = c.tunePulse(null).catch(error => error);
    await frame();
    const tuned = c.tunePulse(150).catch(error => error);
    await frame();
    await owner.drain(); await struck; await back; await tuned;
    assert.equal(owner.torusSettings.rate.steps_per_second, 150, 'the pulse follows the newer drive');
    assert.ok(owner.torusSettings.carrier > 0, 'and rings the plate');
    await c.tunePulse(null); await settle();
    assert.deepEqual(owner.torusSettings.rate, {mode: 'free', steps_per_second: 2.5}, 'the person\'s own Rate is given back');
    assert.equal(owner.torusSettings.carrier, 0, 'and their own Carrier');
  } finally { await c.dispose(); }
});

test('P4: a tuning asked before the person sets the Carrier never lands over it (F4)', async () => {
  const {owner, c} = await open();
  try {
    owner.hold();
    const struck = c.torusPlay([{row: 1, column: 20}], 0.35);
    await inHand(owner);
    // The plate drives at 150 (the tuning raises the person's Carrier of 0) and the person sets the Carrier to 0.3, both behind the key.
    const tuned = c.tunePulse(150).catch(error => error);
    await frame();
    const set = c.torusSet({carrier: 0.3});
    await frame();
    await owner.drain(); await struck; await tuned; await set;
    assert.equal(owner.torusSettings.carrier, 0.3, 'the person\'s Carrier stands');
    assert.equal(owner.torusSettings.rate.steps_per_second, 150, 'and the pulse is tuned to the drive');
    await c.tunePulse(200); await settle();
    assert.equal(owner.torusSettings.carrier, 0.3, 'a later drive leaves the Carrier theirs');
    await c.tunePulse(null); await settle();
    assert.deepEqual(owner.torusSettings.rate, {mode: 'free', steps_per_second: 2.5}, 'the Rate is given back');
    assert.equal(owner.torusSettings.carrier, 0.3, 'and the Carrier is the one the person set');
  } finally { await c.dispose(); }
});

test('P2: while keys are played a second apart, the frame\'s reads wait at most READ_WAIT_MS after they are due', async () => {
  const {owner, c} = await open();
  try {
    // After a determinant every read is due: the Torus's, the influence and the sources.
    c.torusAt = -Infinity; c.influenceStale = true; c.sourcesStale = true; c.lastInspect = -Infinity;
    const from = owner.sent.length, started = skipped, taken = [];
    for (let second = 0; second < 8; second++) {
      await c.torusPlay([{row: 1, column: 20 + second % 4}], 0.35);
      // The frame's own timer calls refreshSources every 250 ms (nativeField.ts); here each call is a quarter second on the logical clock.
      for (let tick = 0; tick < 4; tick++) {
        pass(250);
        const before = owner.sent.length;
        await c.refreshSources();
        for (const op of owner.sent.slice(before)) if (READS.includes(op)) taken.push({op, at: skipped - started});
      }
    }
    const reads = owner.sent.slice(from).filter(op => READS.includes(op));
    assert.ok(reads.includes('influence') && reads.includes('inspect'), `the influence and the sources are read in the phrase: ${reads.join(', ')}`);
    const torus = taken.filter(read => read.op === 'torus-state').map(read => read.at);
    assert.ok(torus.length >= 3, `the Torus is read in eight seconds of play: ${torus.join(', ')} ms`);
    // Due at the phrase's start, each read waits at most READ_WAIT_MS (1 s) from the first pass that found it due, and a pass more.
    for (const op of ['torus-state', 'influence', 'inspect']) {
      const first = taken.find(read => read.op === op);
      assert.ok(first.at <= 250 + 1000 + 250, `${op} is read ${first.at} ms into the phrase`);
    }
    // And again: the Torus, due a second after it was read, is read within READ_WAIT_MS and a pass of that.
    for (let i = 1; i < torus.length; i++) assert.ok(torus[i] - torus[i - 1] <= 1000 + 1000 + 250, `Torus reads ${torus[i - 1]} and ${torus[i]} ms`);
  } finally { await c.dispose(); }
});

test('P2: a read the playing held past READ_WAIT_MS goes after the key in flight, before a key queued behind it', async () => {
  const {owner, c} = await open();
  try {
    await c.torusPlay([{row: 1, column: 20}], 0.35);
    c.torusAt = -Infinity;
    await c.refreshSources(); // the read is due, and waits while the person plays
    pass(1100);
    owner.hold();
    const from = owner.sent.length;
    const first = c.torusPlay([{row: 1, column: 21}], 0.35);
    await inHand(owner);
    const refreshed = c.refreshSources(); // the read has waited past READ_WAIT_MS
    await frame();
    const second = c.torusPlay([{row: 1, column: 22}], 0.35);
    await frame();
    await owner.drain(); await first; await second; await refreshed;
    const order = owner.sent.slice(from).filter(op => op === 'torus-play' || op === 'torus-state');
    assert.deepEqual(order, ['torus-play', 'torus-state', 'torus-play'], 'the read waits behind one key\'s exchange, never more');
  } finally { await c.dispose(); }
});

test('P3: a key struck after a rest just over PLAYING_MS, while a read longer than 2 s is in flight, is answered late, never refused', async () => {
  const {owner, c} = await open();
  try {
    await c.torusPlay([{row: 1, column: 20}], 0.35);
    pass(2050); // the rest: the playing has rested, so the frame's reads go again
    c.torusAt = -Infinity; c.influenceStale = false; c.sourcesStale = false;
    owner.hold();
    const refreshed = c.refreshSources();
    await inHand(owner); // the frame's own read is in flight
    const struck = c.torusPlayed([{row: 1, column: 21}], 0.35).catch(error => error);
    await frame();
    pass(2300); // the read takes 2.3 s
    await frame(); await frame();
    await owner.answerOne(); // the read is answered
    await owner.drain();
    const played = await struck;
    await refreshed;
    assert.ok(!(played instanceof Error), `the key is not refused: ${played}`);
    assert.ok(played.late_ms >= 2000, `the key is answered, and named late by the time it waited for the frame's read: ${JSON.stringify(played)}`);
  } finally { await c.dispose(); }
});

// Round 54 item 1 (DLW build ruling 2026-11-09, O-I #821): every receipt carried the whole field, 0.49 to 0.64 MB an exchange on the walk
// stack (r53-O11-b-05), which is most of what a key waited for. The kernel relays the frame's exchange as what changed since the field it
// relayed the frame last (kernel native_expression.rs `field_delta`, pinned by its own tests); the frame makes it whole on that field
// (channel.ts `applyFieldDelta`) before the session reads it, and never draws from a change of a field it does not hold: it asks the
// owner's whole field (observe). The owner here is the controlled one, relaying its answers as the kernel does.
let channelBuilt = null;
const channel = () => channelBuilt ??= (async () => {
  const outfile = join(out, 'channel.mjs');
  await esbuild.build({absWorkingDir: journeys, entryPoints: [join(journeys, 'src/native-field/channel.ts')], bundle: true, format: 'esm',
    platform: 'node', outfile, logLevel: 'silent'});
  return import(pathToFileURL(outfile).href);
})();
const f32 = value => typeof value === 'number' && Math.fround(value) === value;
/** The change of `field` since `base`, as the kernel relays it (oi.native-field-delta/v1). */
const changeOf = (base, field, baseRequestId) => {
  const delta = {schema: 'oi.native-field-delta/v1', base_request_id: baseRequestId, base_generation: base.generation,
    base_samples_elapsed: base.samples_elapsed, generation: field.generation, samples_elapsed: field.samples_elapsed, changed: {},
    removed: Object.keys(base).filter(key => !(key in field)), items: {}};
  for (const [key, value] of Object.entries(field)) {
    const was = base[key];
    if (key in base && JSON.stringify(was) === JSON.stringify(value)) continue;
    if (key === 'targets' && Array.isArray(was) && was.length === value.length && value.every((target, i) =>
      Object.keys(target).length === 3 && target.identity === was[i].identity && target.constituent === was[i].constituent
      && target.position.length === 3 && target.position.every(f32))) {
      const view = new DataView(new ArrayBuffer(value.length * 12));
      value.forEach((target, i) => target.position.forEach((c, j) => view.setFloat32((3 * i + j) * 4, c, true)));
      delta.positions = Buffer.from(view.buffer).toString('base64');
      continue;
    }
    if (Array.isArray(was) && Array.isArray(value) && was.length === value.length && value.length && value.every(entry => entry && typeof entry === 'object')) {
      delta.items[key] = value.flatMap((entry, i) => JSON.stringify(entry) === JSON.stringify(was[i]) ? [] : [[i, entry]]);
      continue;
    }
    delta.changed[key] = value;
  }
  return delta;
};
const openRelayingChanges = async ({breakOne = false} = {}) => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class RelayingOwner extends ControlledSceneOwner {
    /** Each exchange's whole field, by the request that acknowledged it; the fields the session read; what the frame asked. */
    whole = new Map(); asked = []; relayed = null; broken = breakOne;
    bump(step) { super.bump(step); for (const target of this.frame.targets) target.position = target.position.map(Math.fround); }
    /** The owner's answer, whole: torus-play and torus-release taught as the other tests here teach them. */
    async answer(request) {
      const command = request.request?.command;
      if (!['torus-play', 'torus-release'].includes(command?.operation)) return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      if (command.operation === 'torus-release') return reply;
      this.bump(1n);
      reply.field = structuredClone(this.frame);
      reply.field.audio = [];
      reply.torus_play = {schema: 'ql.torus-play/v1', made_way: [], polyphony: 16,
        notes: command.keys.map((key, id) => ({id, key, place: {arc: key.column % 12}, point: {theta: 0.25, phi: 0.5, arc: key.column % 12}}))};
      return reply;
    }
    async request(request) {
      this.asked.push(request.operation === 'exchange' ? `exchange${request.delta === true ? ' delta' : ''}` : request.operation);
      if (request.operation === 'observe') {
        assert.equal(request.expected_request_id, String(this.sequence), 'the whole field is asked at the request the change answered');
        this.relayed = {request_id: String(this.sequence), field: structuredClone(this.frame)};
        return {schema: 'oi.native-expression-observation/v1', retained: {acknowledgement: {field: structuredClone(this.frame)}}};
      }
      const {delta, ...plain} = request;
      if (request.operation === 'compose') {
        const opened = await super.request(plain);
        for (const target of this.frame.targets) target.position = target.position.map(Math.fround);
        opened.receipt.field = structuredClone(this.frame);
        this.relayed = {request_id: '0', field: structuredClone(this.frame)};
        return opened;
      }
      const reply = await this.answer(plain);
      if (plain.operation !== 'exchange' || !reply?.field) return reply;
      this.whole.set(reply.last_request_id, structuredClone(reply.field));
      if (delta !== true) return reply;
      const base = this.relayed;
      this.relayed = {request_id: reply.last_request_id, field: structuredClone(reply.field)};
      const {field, ...answer} = reply;
      const change = changeOf(base.field, field, base.request_id);
      // One change relayed from a field the frame does not hold: a frame that missed one.
      if (this.broken && plain.request.command.operation === 'torus-set') { this.broken = false; change.base_request_id = 'missed'; }
      return {...answer, field_delta: change};
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new RelayingOwner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio);
  const read = [];
  await c.compose({sky: 'none'});
  const projection = c.projection, validate = projection.validate.bind(projection);
  projection.validate = frame => { read.push(structuredClone(frame)); return validate(frame); };
  return {owner, c, read};
};

test('821: a field relayed as its change is made whole on the field the frame was relayed last, exactly', async () => {
  const {applyFieldDelta} = await channel();
  const base = {generation: '4', samples_elapsed: '960', audio: [0.5], kept: {deep: [1, 2]}, gone: true,
    bank: [{slot: 0, held: false}, {slot: 1, held: false}, {slot: 2, held: false}],
    targets: [{identity: 0, constituent: '#1-5-0', position: [Math.fround(2.75), 0, 0]}, {identity: 1, constituent: '#1-5-1', position: [0, Math.fround(0.3), 0]}]};
  const field = {generation: '5', samples_elapsed: '960', audio: [], kept: {deep: [1, 2]},
    bank: [{slot: 0, held: false}, {slot: 1, held: true}, {slot: 2, held: false}],
    targets: [{identity: 0, constituent: '#1-5-0', position: [Math.fround(2.7501), Math.fround(1e-4), 0]}, {identity: 1, constituent: '#1-5-1', position: [Math.fround(-1.5), Math.fround(0.30001), Math.fround(2e-4)]}]};
  const delta = changeOf(base, field, '7');
  assert.deepEqual(Object.keys(delta.changed).sort(), ['audio', 'generation']);
  assert.deepEqual(delta.items, {bank: [[1, {slot: 1, held: true}]]});
  assert.deepEqual(delta.removed, ['gone']);
  assert.equal(typeof delta.positions, 'string');
  const relayed = {request_id: '7', field: base};
  assert.deepEqual(applyFieldDelta(relayed, delta), field, 'made whole, it is the field, every coordinate exact');
  assert.equal(applyFieldDelta(relayed, {...delta, base_request_id: '6'}), null, 'a change from another request\'s field is not drawn from');
  assert.equal(applyFieldDelta(relayed, {...delta, base_generation: '3'}), null, 'nor from a field at another cursor');
  assert.equal(applyFieldDelta(relayed, {...delta, generation: '6'}), null, 'nor one that does not arrive where it says');
  assert.equal(applyFieldDelta(relayed, {...delta, positions: Buffer.alloc(12).toString('base64')}), null, 'nor positions for other targets');
  assert.equal(applyFieldDelta(relayed, {...delta, items: {bank: [[3, {}]]}}), null, 'nor an entry past the list');
  assert.equal(applyFieldDelta(null, delta), null, 'nor anything before a field was relayed');
  assert.deepEqual(base.bank[1], {slot: 1, held: false}, 'the field held is not changed');
});

test('821: the frame asks every exchange as its change, and the session reads each field whole, as the owner acknowledged it', async () => {
  const {owner, c, read} = await openRelayingChanges();
  try {
    const opening = owner.asked.filter(asked => asked.startsWith('exchange'));
    assert.ok(opening.length && opening.every(asked => asked === 'exchange delta'), `the opening's reads are asked as their change: ${opening}`);
    const from = owner.asked.length;
    await c.torusState();
    await c.torusPlay([{row: 1, column: 20}], 0.35);
    await c.torusSet({carrier: 0.5});
    await c.torusRelease([{row: 1, column: 20}]);
    const exchanges = owner.asked.slice(from).filter(asked => asked.startsWith('exchange'));
    assert.ok(exchanges.length >= 4, `the frame exchanged: ${owner.asked.slice(from).join(', ')}`);
    assert.deepEqual(exchanges.filter(asked => asked !== 'exchange delta'), [], 'every exchange is asked as its change');
    assert.equal(read.length, exchanges.length, 'the session read a field for each');
    for (const field of read) {
      const whole = [...owner.whole.values()].find(candidate => candidate.generation === field.generation && candidate.samples_elapsed === field.samples_elapsed
        && JSON.stringify(candidate) === JSON.stringify(field));
      assert.ok(whole, `each field the session read is one the owner acknowledged, whole: ${JSON.stringify(field).slice(0, 200)}`);
    }
    assert.ok(!owner.asked.includes('observe'), 'nothing was missed, so the whole field was never asked');
  } finally { await c.dispose(); }
});

test('821: a change from a field the frame does not hold is never drawn from: the frame asks the owner\'s whole field', async () => {
  const {owner, c, read} = await openRelayingChanges({breakOne: true});
  try {
    await c.torusPlay([{row: 1, column: 20}], 0.35);
    const before = read.length;
    await c.torusSet({carrier: 0.5});
    assert.ok(owner.asked.includes('observe'), `the frame asked the whole field: ${owner.asked.join(', ')}`);
    const last = owner.whole.get(String(owner.sequence));
    assert.ok(read.length > before && JSON.stringify(read.at(-1)) === JSON.stringify(last), 'the session read the owner\'s whole field');
    await c.torusRelease([{row: 1, column: 20}]);
    assert.equal(JSON.stringify(read.at(-1)), JSON.stringify(owner.whole.get(String(owner.sequence))), 'and the next change is made whole on it');
  } finally { await c.dispose(); }
});
