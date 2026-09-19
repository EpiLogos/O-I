/** Techne surface lifecycle — unit tests (node --test) with a manual frame
 * scheduler, mirroring the app.ts tick contract. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceLifecycle } from '../src/techne-surface-lifecycle.mjs';

/** A deterministic frame scheduler: tests drive frames by calling cb(now). */
function manualScheduler() {
  const state = { callback: null, cancelled: 0 };
  return {
    schedule(cb) { state.callback = cb; return 1; },
    cancel() { state.cancelled += 1; state.callback = null; },
    fire(now) { const cb = state.callback; state.callback = null; cb?.(now); },
    pending() { return state.callback !== null; },
  };
}

function fakeDocument({ hidden = false } = {}) {
  const listeners = new Map();
  return {
    hidden,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type) { listeners.get(type)?.(); },
  };
}

const lifecycle = (overrides = {}) => {
  const calls = { acquire: 0, release: 0, frames: [], errors: [] };
  const scheduler = manualScheduler();
  const doc = fakeDocument();
  const instance = createSurfaceLifecycle({
    acquire: () => { calls.acquire += 1; },
    release: () => { calls.release += 1; },
    render: (delta) => { calls.frames.push(delta); },
    onError: (error) => { calls.errors.push(error); },
    requestAnimationFrame: scheduler.schedule,
    cancelAnimationFrame: scheduler.cancel,
    document: doc,
    ...overrides,
  });
  return { instance, calls, scheduler, doc };
};

test('states: released → active → suspended → released, acquire once, release once', () => {
  const { instance, calls } = lifecycle();
  assert.equal(instance.state, 'released');
  instance.start();
  assert.equal(instance.state, 'active');
  assert.equal(calls.acquire, 1);
  instance.suspend();
  assert.equal(instance.state, 'suspended');
  instance.resume();
  assert.equal(instance.state, 'active');
  assert.equal(calls.acquire, 1, 'resume does not re-acquire');
  instance.dispose();
  assert.equal(instance.state, 'released');
  assert.equal(calls.release, 1);
});

test('single-frame dirty flag: one repaint per mark, paused delta is 0', () => {
  const { instance, calls, scheduler } = lifecycle();
  instance.start();
  scheduler.fire(1000); // initial dirty flag draws once
  assert.deepEqual(calls.frames, [0]);
  scheduler.fire(1016);
  assert.equal(calls.frames.length, 1, 'a clean, paused surface draws nothing');
  instance.markFrameNeeded();
  scheduler.fire(1032);
  assert.deepEqual(calls.frames, [0, 0], 'the marked frame repaints at delta 0');
  instance.dispose();
});

test('delta gating: playing advances bounded steps; a stall never jumps', () => {
  const { instance, calls, scheduler } = lifecycle();
  instance.start();
  scheduler.fire(1000); // consume the initial dirty frame while paused (delta 0)
  instance.setPlaying(true);
  scheduler.fire(1016); // one frame later
  scheduler.fire(7000); // a 6-second stall: raw delta clamps to .25, frame delta to .05
  assert.deepEqual(calls.frames, [0, 0.016, 0.05]);
  instance.dispose();
});

test('fps cap spaces renders out', () => {
  const { instance, calls, scheduler } = lifecycle({ fpsCap: 50 }); // 20ms floor
  instance.start();
  scheduler.fire(1000); // initial dirty frame, paused
  instance.setPlaying(true);
  scheduler.fire(1010); // inside the floor: no render, loop stays scheduled
  scheduler.fire(1021); // past the floor: renders
  assert.deepEqual(calls.frames, [0, 0.011]);
  assert.ok(scheduler.pending());
  instance.dispose();
});

test('renderer dirty flag (needsRender) draws without a mark', () => {
  let dirty = true;
  const { instance, calls, scheduler } = lifecycle({ needsFrame: () => dirty });
  instance.start();
  scheduler.fire(1000);
  assert.equal(calls.frames.length, 1);
  dirty = false;
  scheduler.fire(1016);
  assert.equal(calls.frames.length, 1);
  instance.dispose();
});

test('document-hidden auto-suspends; visible resumes with a re-based clock', () => {
  const { instance, calls, scheduler, doc } = lifecycle();
  instance.start();
  scheduler.fire(1000); // initial dirty frame, paused
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.equal(instance.state, 'suspended');
  assert.ok(!scheduler.pending(), 'the loop stops while hidden');
  doc.hidden = false;
  doc.emit('visibilitychange');
  assert.equal(instance.state, 'active');
  scheduler.fire(1100); // gap is absorbed by the re-based clock
  assert.ok(calls.frames.at(-1) <= 0.05, 'no delta spike across the hidden gap');
  instance.dispose();
});

test('manual suspend is not auto-resumed by visibility', () => {
  const { instance, doc } = lifecycle();
  instance.start();
  instance.suspend();
  doc.hidden = false;
  doc.emit('visibilitychange');
  assert.equal(instance.state, 'suspended', 'a host-requested suspension stays');
  instance.dispose();
});

test('a render throw stops the loop and reports once; dispose still releases', () => {
  const boom = new Error('GPU context was lost');
  const { instance, calls, scheduler } = lifecycle({
    render: () => { throw boom; },
  });
  instance.setPlaying(true);
  instance.start();
  scheduler.fire(1000);
  assert.deepEqual(calls.errors, [boom]);
  assert.equal(instance.state, 'suspended', 'the surface suspends after a render failure');
  assert.ok(!scheduler.pending());
  instance.dispose();
  assert.equal(calls.release, 1);
});

test('contract validation and terminal dispose', () => {
  assert.throws(() => createSurfaceLifecycle({ render: 'nope' }), TypeError);
  assert.throws(() => createSurfaceLifecycle({}), TypeError);
  const { instance, calls } = lifecycle();
  instance.start();
  instance.dispose();
  instance.markFrameNeeded(); // no-op after release
  instance.dispose(); // idempotent
  assert.equal(calls.release, 1, 'release runs exactly once');
  assert.equal(instance.state, 'released');
});
