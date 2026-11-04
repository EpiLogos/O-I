// Collision strikes (DLW §20.2 Field: "Collisions strike | On · Off | Off | Under On, a collision in the field strikes the torus at the
// point where it happens (§21.2)"; §21.2 What strikes the Torus: "A collision in the field | The point where it happens, while the Field's
// Collisions strike is On"). What is proved here:
//
//   - the engine's own GPU passes write each contact to a target the engine reads back each frame: the pairwise force pass marks the
//     strongest closing speed of each pair, two reduction passes keep the strongest contact of each block of particles in an 8 × 8
//     target, and the engine reads that target back through a pixel buffer a frame behind. Proved in a real WebGL context (Chromium,
//     headless), never a CPU stand-in: each contact read back stands exactly where a particle the GPU moved stands, and closes at a
//     speed; nothing is reduced or read while Collisions strike is Off, or while the field's particle contacts are off;
//   - what the readback costs a frame, measured in that context and printed (the receipt's number);
//   - each contact strikes the torus at its point: the angles of the torus as it is shown, as a touch reads them, at a strength from
//     how fast the pair closed; a contact slower than a collision strikes nothing;
//   - the rate is bound: at most COLLISION_STRIKES_AT_ONCE in a frame and COLLISION_STRIKES_PER_SECOND in a second, the strongest
//     first, and every one refused beyond that is counted and said in words at most once a second, never silently;
//   - nothing strikes while the live instrument is not playing, and the frame says so once;
//   - the scene carries the setting at composition.collisionsStrike, an On or Off a Scene may carry (absent reads as Off);
//   - the frame strikes through its one stage channel: a collision's strike is read as the shell's strike-at is read and run as it runs.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/collision-strikes.test.mjs
//   COLLISION_ANGLE=metal … runs the WebGL part on the GPU instead of SwiftShader.
//
// The sources are TypeScript, bundled with the app's own esbuild into a temporary directory (as me2-symbol-voice.test.mjs does). The browser
// is Playwright's Chromium (desktop/cradle/node_modules); a browser that cannot start fails the test, it is never skipped.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const {chromium} = await import('playwright');
// The tree under test: this one, unless a run is pointed at another copy (the red run against the sources before collision strikes).
const journeys = process.env.COLLISION_JOURNEYS ?? fileURLToPath(new URL('..', import.meta.url));
const src = join(journeys, 'src');
const engine = join(journeys, '../src/engine');
const out = mkdtempSync(join(tmpdir(), 'collision-strikes-'));
after(() => rmSync(out, {recursive: true, force: true}));
const cache = new Map();
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`);
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
      loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
    return import(pathToFileURL(outfile).href);
  })());
  return cache.get(name);
};
const touch = () => bundle(join(src, 'native-field/surfaceTouch.ts'), 'touch');
const schedule = () => bundle(join(engine, 'pairwiseSchedule.ts'), 'schedule');
const model = () => bundle(join(src, 'model.ts'), 'model');
const torusObject = () => bundle(join(engine, 'torusObject.ts'), 'torus-object');

// ── the readback's geometry ──────────────────────────────────────────────────

test('every particle texture the pairwise pass sorts reduces to the 8 × 8 contact target in two passes within the shader\'s loop', async () => {
  const {contactReduction, PAIRWISE_CONTACT_SIDE, PAIRWISE_CONTACT_BLOCK, PAIRWISE_CONTACT_LOOP, PAIRWISE_MAX_SORT_SIDE} = await schedule();
  assert.equal(PAIRWISE_CONTACT_SIDE, 8);
  for (const side of [8, 9, 64, 100, 448, 707, PAIRWISE_MAX_SORT_SIDE]) {
    const {levelSide, slotBlock} = contactReduction(side);
    assert.equal(levelSide, Math.ceil(side / PAIRWISE_CONTACT_BLOCK), `${side}: the first pass keeps one texel per block of particles`);
    assert.ok(levelSide * PAIRWISE_CONTACT_BLOCK >= side && slotBlock * PAIRWISE_CONTACT_SIDE >= levelSide, `${side}: every particle reaches a slot`);
    assert.ok(PAIRWISE_CONTACT_BLOCK <= PAIRWISE_CONTACT_LOOP && slotBlock <= PAIRWISE_CONTACT_LOOP, `${side}: within the shader's loop`);
  }
});

// ── the engine's GPU readback, in a real WebGL context ─────────────────────────

const ANGLE = process.env.COLLISION_ANGLE ?? 'swiftshader';
// One browser for the file's WebGL tests, closed once they have all run (an `after` inside a test would close it after that test alone).
const browsers = [];
after(() => Promise.all(browsers.map(b => b.close())));
const page = async () => {
  const entry = join(out, 'collision-page.ts');
  const outfile = join(out, 'collision-page.js');
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], bundle: true, format: 'iife', platform: 'browser', outfile, logLevel: 'silent',
    stdin: {resolveDir: src, sourcefile: entry, loader: 'ts', contents: `
      import {PointCloudField} from '../../src/engine/PointCloudField';
      import {toNativeConfig} from './nativeBridge';
      import {blankJourney,chakraEntities} from './model';
      (window as any).__collide={PointCloudField,toNativeConfig,blankJourney,chakraEntities};`},
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  const browser = await chromium.launch({headless: true, args: ['--use-gl=angle', `--use-angle=${ANGLE}`, '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']});
  browsers.push(browser);
  const tab = await browser.newPage({viewport: {width: 640, height: 480}});
  const errors = [];
  tab.on('pageerror', e => errors.push(String(e)));
  await tab.setContent('<!doctype html><canvas id="field" width="640" height="480"></canvas>');
  await tab.addScriptTag({content: readFileSync(outfile, 'utf8')});
  // A scene of the seven centres, its particles in contact: 16 384 particles, the field's own pairwise pass on.
  await tab.evaluate(() => {
    const {PointCloudField, toNativeConfig, blankJourney, chakraEntities} = window.__collide;
    const scene = blankJourney().scenes[0];
    scene.entities = chakraEntities();
    scene.field.params.count = 16384;
    scene.engine.pairwiseEnabled = true;
    const config = toNativeConfig(scene);
    const field = new PointCloudField(document.getElementById('field'), config, true);
    const gl = document.getElementById('field').getContext('webgl2');
    window.__field = {field, config, gl, toNativeConfig, scene};
    for (let i = 0; i < 90; i++) field.advance(1 / 60);
  });
  return {tab, errors};
};
let opened;
const opening = () => (opened ??= page());

test('the engine reads back the contacts its own GPU pass makes, each where a particle stands, only while it listens', async () => {
  const {tab, errors} = await opening();
  const reading = await tab.evaluate(async () => {
    const {field, gl} = window.__field;
    // Each frame's read is taken once it has come back (its fence passed), before the next step: the first waits on its shaders' compile.
    const settle = async () => {
      const got = [];
      let taken = field.takeContacts();
      got.push(...taken.contacts);
      for (let waited = 0; waited < 60000 && taken.counts.back + taken.counts.lost < taken.counts.read; waited += 10) {
        await new Promise(done => setTimeout(done, 10));
        taken = field.takeContacts();
        got.push(...taken.contacts);
      }
      return got;
    };
    // Off: no pass is run and nothing is read.
    for (let i = 0; i < 20; i++) field.advance(1 / 60);
    const off = field.takeContacts();
    // On: a burst drives the particles into each other; each frame is reduced and read, a frame behind.
    field.listenContacts(true);
    field.triggerDisperse(6);
    const contacts = [];
    let matched = 0, checked = 0;
    for (let frame = 0; frame < 24; frame++) {
      field.advance(1 / 60);
      const taken = await settle();
      // The state the contacts were read from is the state now (no step since): each point is a particle the GPU moved.
      if (taken.length && checked < 64) {
        const positions = field.inspectState(true).positions;
        for (const c of taken.slice(0, 64 - checked)) {
          checked++;
          for (let i = 0; i < positions.length; i += 4) {
            if (positions[i] === c.x && positions[i + 1] === c.y && positions[i + 2] === c.z) { matched++; break; }
          }
        }
      }
      contacts.push(...taken);
    }
    const on = field.takeContacts();
    // Particle contacts off: listening, the field makes no collisions, and no pass runs.
    const noPairs = window.__field.toNativeConfig({...window.__field.scene, engine: {...window.__field.scene.engine, pairwiseEnabled: false}});
    field.replaceConfig(noPairs);
    const before = field.takeContacts().counts.read;
    for (let i = 0; i < 10; i++) { field.advance(1 / 60); await settle(); }
    const none = field.takeContacts();
    field.replaceConfig(window.__field.config);
    field.listenContacts(false);
    return {off: {standing: off.standing, read: off.counts.read, contacts: off.contacts.length}, contacts: contacts.map(c => ({...c})), matched, checked,
      on: {standing: on.standing, ...on.counts}, none: {standing: none.standing, read: none.counts.read - before, contacts: none.contacts.length}};
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(reading.off, {standing: 'off', read: 0, contacts: 0}, 'Off reads nothing');
  assert.equal(reading.on.standing, 'listening');
  assert.ok(reading.on.read >= 24 && reading.on.back === reading.on.read && reading.on.lost === 0, `each frame is read and comes back: ${JSON.stringify(reading.on)}`);
  assert.ok(reading.contacts.length > 0, 'a burst of particles makes contacts the GPU reports');
  assert.ok(reading.contacts.length <= 64 * reading.on.read, 'at most the 8 × 8 slots a frame');
  for (const c of reading.contacts) {
    assert.ok([c.x, c.y, c.z, c.speed, c.share].every(Number.isFinite), JSON.stringify(c));
    assert.ok(c.speed > 0 && c.share > 0, `a contact closes: ${JSON.stringify(c)}`);
  }
  assert.ok(reading.checked > 0 && reading.matched === reading.checked, `each contact stands where a particle the GPU moved stands: ${reading.matched} of ${reading.checked}`);
  assert.deepEqual(reading.none, {standing: 'no-contacts', read: 0, contacts: 0}, 'with particle contacts off nothing is reduced or read');
});

test('what the readback costs a frame, in the same WebGL context (the receipt\'s number)', async t => {
  const {tab} = await opening();
  const cost = await tab.evaluate(async () => {
    const {field, gl} = window.__field;
    // Each frame starts on a drained GPU (a one-pixel read waits on everything drawn before it; gl.finish need not), and is timed twice:
    // the page's own time to make it (what the frame's thread spends) and to the end of its GPU work.
    const pixel = new Uint8Array(4), drain = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const frame = async () => {
      drain();
      const at = performance.now();
      field.advance(1 / 60);
      const made = performance.now() - at;
      drain();
      const done = performance.now() - at;
      await new Promise(next => setTimeout(next, 1));
      return {made, done};
    };
    const median = list => { const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const runs = {off: [], on: []};
    // The account of these frames alone: the first test's first read waited on its shaders' compile.
    const before = field.takeContacts().counts;
    for (let round = 0; round < 3; round++) for (const listening of [false, true]) {
      field.listenContacts(listening);
      for (let i = 0; i < 5; i++) await frame();
      for (let i = 0; i < 40; i++) runs[listening ? 'on' : 'off'].push(await frame());
      field.takeContacts();
    }
    field.listenContacts(false);
    const after = field.takeContacts().counts;
    const counts = Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));
    const of = (list, key) => median(list.map(f => f[key]));
    return {made: {off: of(runs.off, 'made'), on: of(runs.on, 'made')}, done: {off: of(runs.off, 'done'), on: of(runs.on, 'done')}, counts, renderer: gl.getParameter(gl.RENDERER)};
  });
  const ms = value => value.toFixed(2);
  const said = `collision readback (${ANGLE}, ${cost.renderer}), a frame of 16 384 particles with the pairwise pass, median of 120 frames each: ` +
    `the page makes it in ${ms(cost.made.off)} ms with Collisions strike Off and ${ms(cost.made.on)} ms On (${ms(cost.made.on - cost.made.off)} ms), ` +
    `and its GPU work ends ${ms(cost.done.off)} ms and ${ms(cost.done.on)} ms after it starts (${ms(cost.done.on - cost.done.off)} ms); ` +
    `each read (the two reductions and the read into the pixel buffer) took ${(cost.counts.ms / Math.max(1, cost.counts.read)).toFixed(3)} ms and each take ` +
    `from the pixel buffer ${(cost.counts.takeMs / Math.max(1, cost.counts.back)).toFixed(3)} ms of the page's own time; ${cost.counts.unread} of ` +
    `${cost.counts.read + cost.counts.unread} frames found the last read still on its way.`;
  t.diagnostic(said);
  console.log(said);
  assert.ok(cost.made.off > 0 && cost.made.on > 0 && cost.done.on > 0);
  assert.equal(cost.counts.lost, 0);
});

// ── a contact strikes the torus at its point ─────────────────────────────────

const UPM = 120;
const following = {status: 'following', instrument: {torus_object: {shape: {shown: {from: 'torus', to: 'torus', progress: 1, since: null}}}}, presentation_units_per_metre: UPM, presented_clock: null};
const contactAt = (theta, phi, share, lift = 0, torusPoint) => {
  const [x, y, z] = torusPoint(theta, phi), rho = Math.hypot(x, y), n = [Math.cos(theta) * x / rho, Math.cos(theta) * y / rho, Math.sin(theta)];
  return {x: (x + n[0] * lift) * UPM, y: (y + n[1] * lift) * UPM, z: (z + n[2] * lift) * UPM, speed: share * 35000, share};
};

test('a contact strikes the torus at its point, as a touch reads the point, at a strength from how fast it closed', async () => {
  const {collisionStrike, torusPoint, COLLISION_LEAST_SHARE} = await touch();
  for (const [theta, phi] of [[0.3, 1.2], [2.9, 5.5], [4.4, 0.01]]) {
    for (const lift of [0, 0.2, -0.3]) {
      const struck = collisionStrike(following, contactAt(theta, phi, COLLISION_LEAST_SHARE * 2, lift, torusPoint));
      assert.ok(struck.point, JSON.stringify(struck));
      assert.ok(Math.abs(struck.point.theta - theta) < 1e-9 && Math.abs(struck.point.phi - phi) < 1e-9, `${theta}, ${phi} lifted ${lift}: ${JSON.stringify(struck.point)}`);
    }
  }
  const strength = share => collisionStrike(following, contactAt(1, 1, share, 0, torusPoint)).amplitude;
  const shares = [COLLISION_LEAST_SHARE, COLLISION_LEAST_SHARE * 2, COLLISION_LEAST_SHARE * 3, 0.2, 0.5, 4];
  const strengths = shares.map(strength);
  for (const value of strengths) assert.ok(value >= 0.15 && value <= 0.9, `${value} is a strike's strength`);
  for (let i = 1; i < strengths.length; i++) assert.ok(strengths[i] >= strengths[i - 1], `harder is not softer: ${strengths}`);
  assert.ok(strengths.at(-1) > strengths[0]);
  const settling = collisionStrike(following, contactAt(1, 1, COLLISION_LEAST_SHARE / 2, 0, torusPoint));
  assert.equal(settling.point, null, 'a pile settling is no collision');
  // On another shape shown (O-I 851), the sample of that shape nearest the contact: the point struck stands where the contact stands.
  const {shapePoint} = await torusObject();
  const eight = {...following, instrument: {torus_object: {shape: {shown: {from: 'figure-eight', to: 'figure-eight', progress: 1, since: null}}}}};
  for (const [phi, theta] of [[0.7, 2.1], [3.3, 4.6], [5.9, 0.4]]) {
    const at = shapePoint('figure-eight', phi, theta);
    const struck = collisionStrike(eight, {x: at[0] * UPM, y: at[1] * UPM, z: at[2] * UPM, speed: 1, share: COLLISION_LEAST_SHARE * 2});
    assert.ok(struck.point, JSON.stringify(struck));
    const there = shapePoint('figure-eight', struck.point.phi, struck.point.theta);
    assert.ok(Math.hypot(there[0] - at[0], there[1] - at[1], there[2] - at[2]) < 0.02, `figure-eight ${phi}, ${theta}: struck ${JSON.stringify(struck.point)}`);
  }
  const axis = collisionStrike(following, {x: 0, y: 0, z: 0.5 * UPM, speed: 35000 * COLLISION_LEAST_SHARE * 2, share: COLLISION_LEAST_SHARE * 2});
  assert.equal(axis.point, null, 'a contact on the axis has no point of the surface');
});

test('a storm of contacts is bound, the strongest first, and every one refused beyond the bound is counted and said, never silently', async () => {
  const {CollisionStrikes, COLLISION_STRIKES_PER_SECOND, COLLISION_STRIKES_AT_ONCE, COLLISION_LEAST_SHARE, torusPoint} = await touch();
  const strikes = new CollisionStrikes();
  const storm = n => Array.from({length: n}, (_, i) => contactAt(0.1 + i * 0.01, 0.2 + i * 0.02, COLLISION_LEAST_SHARE * (1 + i * 0.05), 0, torusPoint));
  const first = strikes.take(0, following, storm(30), 'listening');
  assert.equal(first.strikes.length, COLLISION_STRIKES_AT_ONCE);
  const strongest = storm(30).sort((a, b) => b.share - a.share).slice(0, COLLISION_STRIKES_AT_ONCE).map(c => c.share);
  assert.deepEqual(first.strikes.map(s => s.share), strongest, 'the strongest strike');
  assert.equal(strikes.refused, 30 - COLLISION_STRIKES_AT_ONCE);
  assert.match(first.said ?? '', new RegExp(`${30 - COLLISION_STRIKES_AT_ONCE} collisions .*not struck`), 'counted, in words');
  assert.match(first.said ?? '', new RegExp(`${COLLISION_STRIKES_PER_SECOND} times a second`), 'the bound, in words');
  // Two seconds of a storm at 60 frames a second, ten contacts a frame.
  let struck = first.strikes.length, said = 0, refused = strikes.refused;
  for (let frame = 1; frame <= 120; frame++) {
    const taken = strikes.take(frame * 1000 / 60, following, storm(10), 'listening');
    struck += taken.strikes.length;
    if (taken.said) said++;
  }
  assert.ok(struck <= COLLISION_STRIKES_AT_ONCE + 2 * COLLISION_STRIKES_PER_SECOND + 1, `${struck} struck in two seconds`);
  assert.ok(struck >= 2 * COLLISION_STRIKES_PER_SECOND - 1, `${struck}: the bound is a rate, not a stop`);
  assert.equal(strikes.struck, struck);
  assert.equal(strikes.refused, refused + 1200 - (struck - first.strikes.length), 'every contact is struck or counted refused');
  assert.ok(said >= 1 && said <= 3, `said at most once a second: ${said}`);
  // A quiet second after the storm: the bound is there again in full.
  const quiet = strikes.take(5000, following, storm(3), 'listening');
  assert.equal(quiet.strikes.length, 3);
});

test('nothing strikes while the live instrument is not playing, or while the field makes no collisions, and the frame says why once', async () => {
  const {CollisionStrikes, COLLISION_LEAST_SHARE, torusPoint} = await touch();
  const strikes = new CollisionStrikes();
  const contacts = [contactAt(1, 1, COLLISION_LEAST_SHARE * 2, 0, torusPoint)];
  const closed = strikes.take(0, {status: 'closed'}, contacts, 'listening');
  assert.deepEqual(closed.strikes, []);
  assert.match(closed.said ?? '', /live instrument/);
  assert.equal(strikes.take(16, {status: 'closed'}, contacts, 'listening').said, null, 'once');
  assert.equal(strikes.take(32, following, contacts, 'listening').strikes.length, 1, 'it strikes again once the instrument plays');
  const none = strikes.take(48, following, [], 'no-contacts');
  assert.match(none.said ?? '', /Particle contacts/);
  assert.equal(strikes.take(64, following, [], 'no-contacts').said, null, 'once');
  assert.equal(strikes.take(80, following, [], 'off').said, null, 'Off says nothing');
});

// ── the scene's setting and the one stage channel ──────────────────────────────

test('a Scene may carry Collisions strike, On or Off; anything else is refused; a new scene carries none (Off)', async () => {
  const {blankJourney, validateJourney} = await model();
  const withSetting = value => { const j = JSON.parse(JSON.stringify(blankJourney())); if (value !== undefined) j.scenes[0].composition.collisionsStrike = value; return j; };
  assert.equal('collisionsStrike' in validateJourney(withSetting(undefined)).scenes[0].composition, false);
  for (const value of [true, false]) assert.equal(validateJourney(withSetting(value)).scenes[0].composition.collisionsStrike, value);
  for (const value of ['on', 1, null, {}]) assert.throws(() => validateJourney(withSetting(value)), /composition/, String(value));
});

test('the frame strikes each collision through its one stage channel, and the engine listens only while the scene\'s setting is On', () => {
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const app = strip(readFileSync(join(src, 'app.ts'), 'utf8')), production = strip(readFileSync(join(src, 'production.ts'), 'utf8'));
  const collide = app.match(/function collisionStrike\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
  assert.ok(collide, 'app.ts holds the collision strike');
  assert.match(collide[1], /readStageRequest\(\{v:1,kind:'host-command',req:[^}]*command:'strike-at'/, 'read as the shell\'s strike-at is read');
  assert.match(collide[1], /runStageCommand\(/, 'run as it runs');
  assert.doesNotMatch(collide[1], /playAt|controller\./, 'never past the channel');
  assert.match(app, /nativeField\??\.collide\(/, 'each frame hands the engine\'s contacts to the native field');
  assert.match(production, /listenContacts\(frame\.scene\.composition\.collisionsStrike===true\)/);
});
