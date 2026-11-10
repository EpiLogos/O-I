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
//   - the frame strikes through its one stage channel: a collision's strike is read as the shell's strike-at is read and run as it runs;
//   - a strike at a point rings its own voices: the voices the owner's `ql.strike-at/v1` receipt says the point excited, each by its own
//     impulse, never every voice the owner tunes (O-I #771 round 880);
//   - the number a walk reads (window.__FIELD_STUDIES__.collisions()): how many collisions struck, landed and failed at the owner and
//     were refused past the bound, and the last one landed with its point, strength and its own voices.
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
const controller = () => bundle(join(src, 'native-field/controller.ts'), 'controller');
const fixture = () => import(pathToFileURL(join(journeys, '../../tests/native-expression-fixture.mjs')).href);

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
      import * as THREE from 'three';
      (window as any).__collide={PointCloudField,toNativeConfig,blankJourney,chakraEntities,THREE};`},
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
        const positions = (await field.inspectState(true)).positions;
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

// ── 3D bodies: the depth velocity change the force pass writes is the one the velocity pass takes ─────────────

test('with 3D bodies each particle in contact gains the depth velocity change the force pass wrote, and never its depth position correction', async () => {
  const {tab} = await opening();
  const r = await tab.evaluate(() => {
    const {PointCloudField, toNativeConfig, blankJourney, chakraEntities, THREE} = window.__collide;
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    document.body.appendChild(canvas);
    const scene = blankJourney().scenes[0];
    scene.entities = chakraEntities();
    scene.field.params.count = 16384;
    scene.engine.pairwiseEnabled = true;
    // True-3D bodies: the pairwise pass makes full 3D contacts (GPGPUSimulator.step's depthGeometry).
    scene.engine.volumeEnabled = true;
    // No speed-squared drag, so what a step adds to a velocity is linear in what it is given (the comparison below).
    const config = toNativeConfig(scene);
    config.fluid.quadraticDrag = 0;
    const field = new PointCloudField(canvas, config, true);
    for (let i = 0; i < 60; i++) field.advance(1 / 60);
    // A burst drives pairs into each other, so they close in depth as well as in the plane.
    field.triggerDisperse(6);
    for (let i = 0; i < 3; i++) field.advance(1 / 60);
    const sim = field.simulator, renderer = field.renderer, u = sim.velMaterial.uniforms;
    const w = sim.texWidth, h = sim.texHeight, n = sim.particleCount;
    const read = (target, index = 0) => { const b = new Float32Array(w * h * 4); renderer.readRenderTargetPixels(target, 0, 0, w, h, b, undefined, index); return b; };
    // What the last step's force pass wrote (buffer 0: plane correction and velocity change; buffer 1: depth correction, depth velocity
    // change, contact) and the velocities its velocity pass made from it.
    const plane = read(sim.pairForceTarget, 0), depth = read(sim.pairForceTarget, 1), stepped = read(sim.currentVelTarget);
    // That velocity pass again, on the inputs it ran on (each still in its target until the next step): as it ran, and with one channel
    // of the force pass's depth buffer taken away.
    const scratch = new THREE.WebGLRenderTarget(w, h, {type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false});
    const without = channel => {
      const bytes = depth.slice();
      for (let i = channel; i < bytes.length; i += 4) bytes[i] = 0;
      const texture = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat, THREE.FloatType);
      texture.minFilter = texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      return texture;
    };
    const again = zTexture => {
      const kept = u.uPairwiseForceZTexture.value;
      if (zTexture) u.uPairwiseForceZTexture.value = zTexture;
      sim.quadMesh.material = sim.velMaterial;
      renderer.setRenderTarget(scratch);
      renderer.render(sim.quadScene, sim.quadCamera);
      renderer.setRenderTarget(null);
      u.uPairwiseForceZTexture.value = kept;
      return read(scratch);
    };
    const asRan = again(null), noDepthDv = again(without(1)), noDepthCorr = again(without(0));
    const axis = u.uCompPlane.value < 0.5 ? 2 : 1;  // depth is z on the picture plane (XY), y on the plate (XZ)
    const maxDelta = u.uPairMaxDelta.value, maxSpeed = Math.max(10, u.uMaxSpeed.value), viscosity = u.uViscosity.value;
    let reproduced = 0, closing = 0, gained = 0, worst = 0, corrected = 0, moved = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      reproduced = Math.max(reproduced, Math.abs(asRan[o] - stepped[o]), Math.abs(asRan[o + 1] - stepped[o + 1]), Math.abs(asRan[o + 2] - stepped[o + 2]));
      if (depth[o] !== 0) corrected++;
      for (let c = 0; c < 3; c++) moved = Math.max(moved, Math.abs(asRan[o + c] - noDepthCorr[o + c]));
      const dvZ = depth[o + 1];
      if (dvZ === 0) continue;
      // Within the per-step bound and the speed clamp, the change is linear: vel = (vel + dv / dt · dt) · viscosity.
      if (Math.hypot(plane[o + 2], dvZ, plane[o + 3]) >= 0.98 * maxDelta || asRan[o + 3] >= 0.98 * maxSpeed || noDepthDv[o + 3] >= 0.98 * maxSpeed) continue;
      closing++;
      const got = asRan[o + axis] - noDepthDv[o + axis], wanted = viscosity * dvZ;
      const off = Math.abs(got - wanted) / (1e-3 + 1e-5 * Math.abs(asRan[o + axis]) + 1e-4 * Math.abs(wanted));
      if (off <= 1) gained++;
      worst = Math.max(worst, off);
    }
    return {threeD: u.uPairwise3D.value, drag: u.uQuadraticDrag.value, reproduced, closing, gained, worst, corrected, moved};
  });
  assert.equal(r.threeD, 1, 'the field runs 3D contacts');
  assert.equal(r.drag, 0, 'no speed-squared drag, so the change is linear');
  assert.equal(r.reproduced, 0, 'the velocity pass run again on its inputs makes exactly the step\'s velocities');
  assert.ok(r.closing >= 16, `pairs close in depth: ${r.closing} particles`);
  assert.equal(r.gained, r.closing, `each gains the depth velocity change the force pass wrote (${r.gained} of ${r.closing}; worst ${r.worst.toFixed(2)} of its tolerance)`);
  assert.ok(r.corrected > 0, `the force pass writes depth position corrections too: ${r.corrected} particles`);
  assert.equal(r.moved, 0, 'the depth position correction moves no velocity (it is the position pass\'s)');
});

// ── a contact strikes the torus at its point ─────────────────────────────────

// O-I #747 round 896 1T item 24 (DLW build ruling 2026-11-09): inspect(true) read the whole field's pixels back synchronously, and under
// heavy load froze the page for 5–6 s, its one thread shared with a person's frame. The read goes into pixel buffers behind fences
// (GPGPUSimulator.ts FencedRead) and is answered to a caller that awaits it; nothing in the readback path reads pixels into the page's
// memory synchronously. Counted on the field's own WebGL context (every readPixels, and whether a pixel buffer takes it) and on its
// renderer (three.js's synchronous render-target read); the answer is checked against the same targets read by the test itself, after.
test('1T item 24: the field\'s particles are read back without blocking the page: behind fences, answered to an awaiting caller, byte for byte', async () => {
  const {tab, errors} = await opening();
  const read = await tab.evaluate(async () => {
    const {field, gl} = window.__field;
    const renderer = field.renderer, sim = field.simulator;
    const once = async never => {
      const calls = [], polled = gl.clientWaitSync, readPixels = gl.readPixels, sync = renderer.readRenderTargetPixels;
      let syncReads = 0;
      gl.readPixels = function (...args) {
        calls.push({buffer: gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) !== null, offset: typeof args[6] === 'number'});
        return readPixels.apply(this, args);
      };
      renderer.readRenderTargetPixels = function (...args) { syncReads++; return sync.apply(this, args); };
      // A GPU that never signals: every fence the page polls reads as unpassed.
      if (never) gl.clientWaitSync = () => gl.TIMEOUT_EXPIRED;
      const started = performance.now();
      let answer, asked, ms;
      try {
        answer = field.inspectState(true);
        asked = performance.now() - started;
        // Answered at all: a read polled for good, on a GPU that never signals, would never be.
        const state = await Promise.race([answer, new Promise((_, refuse) => setTimeout(() => refuse(new Error('no answer in 20 s')), 20000))]);
        ms = performance.now() - started;
        answer = {promise: typeof answer?.then === 'function', positions: state.positions, velocities: state.velocities, particles: state.particleCount};
      } finally { gl.readPixels = readPixels; renderer.readRenderTargetPixels = sync; gl.clientWaitSync = polled; }
      // The same targets, read by the test itself (no step since).
      const n = sim.texWidth * sim.texHeight * 4, p = new Float32Array(n), v = new Float32Array(n);
      sync.call(renderer, sim.currentPosTarget, 0, 0, sim.texWidth, sim.texHeight, p);
      sync.call(renderer, sim.currentVelTarget, 0, 0, sim.texWidth, sim.texHeight, v);
      const same = (a, b) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
      return {promise: answer.promise, calls, syncReads, asked, ms, count: answer.positions.length, particles: answer.particles,
        positions: same(answer.positions, Array.from(p.subarray(0, sim.particleCount * 4))),
        velocities: same(answer.velocities, Array.from(v.subarray(0, sim.particleCount * 4))),
        moving: answer.velocities.some(x => x !== 0)};
    };
    for (let i = 0; i < 30; i++) field.advance(1 / 60);
    return {passing: await once(false), never: await once(true)};
  });
  for (const [gpu, r] of Object.entries(read)) {
    assert.equal(r.promise, true, `${gpu}: the field's particles are answered asynchronously, to a caller that awaits them`);
    assert.equal(r.syncReads, 0, `${gpu}: no synchronous render-target read (${r.syncReads})`);
    assert.ok(r.calls.length === 2 && r.calls.every(call => call.buffer && call.offset),
      `${gpu}: each readPixels in the readback path goes into a pixel buffer, none into the page's memory (${JSON.stringify(r.calls)})`);
    assert.ok(r.count === r.particles * 4 && r.count > 0 && r.positions && r.velocities && r.moving,
      `${gpu}: the answer is the field's own, byte for byte (${r.count} values; positions ${r.positions}, velocities ${r.velocities})`);
  }
  // A GPU that never signals answers at the cap, by one wait (FencedRead: taken once it has stood GPU_WAIT_MAX_MS), never sooner.
  assert.ok(read.never.ms >= 1000, `a GPU that never signals answers at the cap, not before (${Math.round(read.never.ms)} ms)`);
  assert.deepEqual(errors, []);
});

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

// ── its own voices, and the number a walk reads ──────────────────────────────

// The controlled scene owner (desktop/cradle/tests/native-expression-fixture.mjs: protocol numbers, not QL's) answers a strike-at as the
// native owner does (QL host.rs: the reply's `strike_at`, scene_field.rs strike_at_receipt): each voice the act struck at the point with
// the coupling it met there and the impulse it was given. Here voices 2 and 5 stand on a node line at the point: the point gives them
// nothing. `body` answers as a form's body does (strike_at_lowered_receipt): the body's modes, no voices.
const openStrikeOwner = async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import(pathToFileURL(join(journeys, '../../node_modules/three/build/three.module.js')).href);
  const {NativeFieldController} = await controller();
  class StrikeOwner extends ControlledSceneOwner {
    body = false;
    async request(request) {
      const command = request.request?.command;
      if (command?.operation !== 'strike-at') return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      this.bump(1n);
      reply.field = structuredClone(this.frame);
      reply.field.audio = [];
      const coupling = k => (k === 2 || k === 5 ? 0 : (k + 1) / 10);
      reply.strike_at = this.body
        ? {schema: 'ql.strike-at/v1', points: command.points, body: 'controlled:form', samples: [3], modes: [{mode_ref: 'controlled:form/0', amplitude: [0.1, 0]}], law: 'controlled', standing: 'controlled'}
        : {schema: 'ql.strike-at/v1', points: command.points, law: 'controlled', standing: 'controlled',
          voices: this.voices().map((voice, k) => ({mode_ref: voice.mode_ref, tuning: 'logic', coupling: command.points.map(() => coupling(k)),
            amplitude: [command.points.reduce((sum, point) => sum + point.amplitude[0] * coupling(k), 0), 0]}))};
      return reply;
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new StrikeOwner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio);
  await c.compose({sky: 'none'});
  return {owner, c};
};

test('a collision\'s strike rings its own voices: the ones the owner says its point excited, each by its own impulse, never every voice tuned', async () => {
  const {owner, c} = await openStrikeOwner();
  try {
    // What the frame's one stage channel runs for a collision's strike (app.ts runStageCommand 'strike-at'): the controller's playAt.
    await c.playAt([{theta: 0.3, phi: 1.2}], 0.5);
    const struck = c.reading.instrument.struck;
    assert.equal(struck.source, 'point');
    assert.deepEqual(struck.points, [{theta: 0.3, phi: 1.2}]);
    const excited = [0, 1, 3, 4, 6, 7];
    assert.deepEqual(struck.refs, excited.map(k => `scene:logic/${k}`), 'the voices on a node line at the point are not struck');
    assert.deepEqual(struck.impulses.map(m => Number(m.toFixed(9))), excited.map(k => Number((0.5 * (k + 1) / 10).toFixed(9))), 'each by the impulse the owner gave it');
    // A chord of points sums each voice's impulse over its points, as the owner does.
    await c.playAt([{theta: 0.3, phi: 1.2}, {theta: 2, phi: 4}], 0.25);
    assert.deepEqual(c.reading.instrument.struck.impulses.map(m => Number(m.toFixed(9))), excited.map(k => Number((0.5 * (k + 1) / 10).toFixed(9))));
    // On a form's body the owner names the body's modes, not the voices: the plate follows every voice tuned, and no impulse is read as a voice's.
    owner.body = true;
    await c.playAt([{theta: 0.3, phi: 1.2}], 0.5);
    const onBody = c.reading.instrument.struck;
    assert.deepEqual(onBody.refs, c.reading.instrument.influence.voices.map(voice => voice.mode_ref ?? `scene:planet/${voice.planet_ref}`));
    assert.equal('impulses' in onBody, false);
  } finally { await c.dispose(); }
});

test('a walk reads the collisions as the frame strikes them: struck, landed, failed, refused, and the last landed with its own voices', async () => {
  const {CollisionStrikes, COLLISION_LEAST_SHARE, COLLISION_STRIKES_AT_ONCE, torusPoint} = await touch();
  const strikes = new CollisionStrikes();
  const none = {struck: 0, landed: 0, failed: 0, refused: 0, last: null};
  assert.deepEqual(strikes.tally(), none, 'nothing before a collision');
  const contacts = [contactAt(0.3, 1.2, COLLISION_LEAST_SHARE * 3, 0, torusPoint), contactAt(2.9, 5.5, COLLISION_LEAST_SHARE * 2, 0, torusPoint)];
  assert.deepEqual(strikes.take(0, following, contacts, 'off').strikes, []);
  assert.deepEqual(strikes.tally(), none, 'under Off a contact strikes nothing, and nothing is counted');
  const [first, second] = strikes.take(16, following, contacts, 'listening').strikes;
  strikes.landed(first, {at: 1, source: 'point', refs: ['scene:logic/0', 'scene:logic/3'], impulses: [0.02, 0.01], points: [first.point]});
  strikes.failed(second);
  assert.deepEqual(strikes.tally(), {struck: 2, landed: 1, failed: 1, refused: 0,
    last: {point: first.point, amplitude: first.amplitude, refs: ['scene:logic/0', 'scene:logic/3'], impulses: [0.02, 0.01]}});
  // What the instrument last struck is this collision's only where it struck this collision's point: another act's voices are not its.
  const [third] = strikes.take(5000, following, [contacts[1]], 'listening').strikes;
  strikes.landed(third, {at: 2, source: 'point', refs: ['scene:logic/7'], impulses: [0.03], points: [{theta: 0.1, phi: 0.1}]});
  assert.deepEqual(strikes.tally().last, {point: third.point, amplitude: third.amplitude, refs: null, impulses: null});
  // An owner that names no impulse (a form's body): the voices, and no impulse.
  const [fourth] = strikes.take(10000, following, [contacts[0]], 'listening').strikes;
  strikes.landed(fourth, {at: 3, source: 'point', refs: ['scene:logic/1'], points: [fourth.point]});
  assert.deepEqual(strikes.tally().last, {point: fourth.point, amplitude: fourth.amplitude, refs: ['scene:logic/1'], impulses: null});
  // Past the bound: counted refused, as the frame says it.
  const storm = Array.from({length: COLLISION_STRIKES_AT_ONCE + 2}, (_, i) => contactAt(0.1 + i * 0.1, 0.2 + i * 0.1, COLLISION_LEAST_SHARE * 2, 0, torusPoint));
  strikes.take(20000, following, storm, 'listening');
  assert.deepEqual([strikes.tally().struck, strikes.tally().refused, strikes.tally().landed], [4 + COLLISION_STRIKES_AT_ONCE, 2, 3]);
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
  const collide = app.match(/function stageStrike\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
  assert.ok(collide, 'app.ts holds the frame\'s one strike, the collisions\' among them');
  assert.match(collide[1], /readStageRequest\(\{v:1,kind:'host-command',req:[^}]*command:'strike-at'/, 'read as the shell\'s strike-at is read');
  assert.match(collide[1], /runStageCommand\(/, 'run as it runs');
  assert.doesNotMatch(collide[1], /playAt|controller\./, 'never past the channel');
  assert.match(app, /nativeField\??\.collide\(engine\.takeContacts\?\.\(\)\?\?null,stageStrike\)/, 'each frame hands the engine\'s contacts to the native field, with the frame\'s one strike');
  assert.match(production, /listenContacts\(frame\.scene\.composition\.collisionsStrike===true\)/);
});

test('the number a walk reads: the frame tallies each collision\'s landing with the voices the instrument struck, as window.__FIELD_STUDIES__.collisions()', () => {
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const native = strip(readFileSync(join(src, 'nativeField.ts'), 'utf8')), app = strip(readFileSync(join(src, 'app.ts'), 'utf8'));
  const collide = native.match(/const collide=\([^]*?\n \};/);
  assert.ok(collide, 'nativeField.ts holds the collisions\' strike');
  assert.match(collide[0], /strike\(\[struck\.point\],struck\.amplitude\)\.then\(\(\)=>collisions\.landed\(struck,[^)]*instrument\?\.struck/, 'each landing tallied with what the instrument struck');
  assert.match(collide[0], /collisions\.failed\(struck\)/, 'each strike the owner refused tallied as failed');
  assert.match(native, /collisions:\(\)=>collisions\.tally\(\)/, 'the native field answers its tally');
  assert.match(app, /collisions:\(\)=>nativeField\?\.collisions\(\)\?\?null/, 'the frame discloses it to a walk');
});
