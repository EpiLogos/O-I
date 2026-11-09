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
// The bound: a key struck waits on the owner for at most the one exchange in flight when it was struck, and for nothing queued. Time is
// counted in owner exchanges, a logical clock: an exchange here is answered only when the test lets it, and one exchange stands for the walk
// stack's own, a mean of 47 to 69 ms at the bridge (walk-857 receipts r52-walk-bridge-lock). So the key reaches the owner within 69 ms of
// the owner's next free moment on the walk stack, well under 100 ms; on main it waited 30 tunings and their fills.
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
