// Hidden retention for the projection pane kinds (WORLD-SHELL-DESIGN §3.1, §10.1; the hidden-inhabitant law).
// Two laws, both pinned here without a DOM:
// 1. The one retention register (warmTrees RETAINED_PANE_KINDS) names every projection kind, so a hidden tree that holds
//    a projection keeps its React subtree across a mode swap and a workspace swap.
// 2. A concealed projection pane is CONCEALED, not torn down: the pane session tells its module setVisible(false) and
//    setVisible(true) through the concealment observer, and unmounts the module only on dispose. A tab switch is the
//    same notice (the pane tier hides every non-active tab's wrapper).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/surface/engine.ts';
import {freshLayout, PROJECTION_PANE_KINDS} from '../src/surface/types.ts';
import {switchWorkspaceMode} from '../src/workspace/store.ts';
import {RETAINED_PANE_KINDS, isRetainedPaneKind, warmWorkspaceTrees} from '../src/surface/warmTrees.ts';
import {ProjectionPaneSession, observeConcealment} from '../src/surface/projectionPaneSession.ts';

const projectionBinding = (id, kind) => ({id, kind, title: id, projection: {kind}});
const earthLayout = () => engine.openBinding(freshLayout(), projectionBinding('earth', 'projection.earth'));

test('every projection pane kind is named by the one retention register', () => {
  for (const kind of PROJECTION_PANE_KINDS) {
    assert.ok(RETAINED_PANE_KINDS.has(kind), `${kind} is in RETAINED_PANE_KINDS`);
    assert.equal(isRetainedPaneKind(kind), true);
  }
});

test('a hidden tree holding a projection keeps its tree through a mode swap and through a workspace swap', () => {
  const base = earthLayout();
  const settings = switchWorkspaceMode({id: 'w', name: 'Central', writing: '', layout: base}, 'settings');
  const byMode = warmWorkspaceTrees([settings], 'w', 'settings').find(tree => tree.key === 'w:base');
  assert.ok(byMode, 'the projection-only base tree stays in the warm set while Settings stands');
  assert.equal(byMode.presented, false);
  assert.equal(byMode.layout.surfaces.earth, base.surfaces.earth, 'the same binding, not a re-minted one');

  const away = {id: 'o', name: 'Other', writing: '', layout: freshLayout(), lastVisitedAt: 1};
  const home = {id: 'w', name: 'Central', writing: '', layout: base, lastVisitedAt: 1};
  const byWorkspace = warmWorkspaceTrees([home, away], 'o', 'base').find(tree => tree.key === 'w:base');
  assert.ok(byWorkspace, 'the projection tree of a recently left workspace stays warm');
  assert.equal(byWorkspace.presented, false);
});

// A stand-in for the browser's IntersectionObserver: the test delivers the entries the pane tier would.
function installObserverDouble() {
  const previous = globalThis.IntersectionObserver;
  const observers = [];
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  return {
    observers,
    deliver(intersecting) { observers.at(-1).callback([{isIntersecting: intersecting}]); },
    restore() { globalThis.IntersectionObserver = previous; },
  };
}

// The module's own state is a closure the test can read. Its handle records every lifecycle call in order.
function projectionModuleDouble(log) {
  const memory = {cameraSteps: 0, selection: 'subject-a'};
  const registration = {
    id: 'test-earth', kind: 'projection.earth',
    create() {
      log.push('create');
      return {
        setVisible(visible) { log.push(visible ? 'show' : 'hide'); memory.cameraSteps += 1; },
        unmount() { log.push('unmount'); },
      };
    },
  };
  return {registration, memory};
}

const context = {kind: 'projection.earth', binding: {id: 'earth', title: 'Earth'}, element: {}, encounter: {}};

test('a hidden projection pane keeps its module mounted and its state across hide and show, with setVisible rather than remount', async () => {
  const observer = installObserverDouble();
  try {
    const log = [];
    const {registration, memory} = projectionModuleDouble(log);
    const session = new ProjectionPaneSession(registration, context, message => log.push(`fault:${message}`));
    await session.ready;
    const stop = observeConcealment({}, visible => session.setVisible(visible));
    observer.deliver(false); // the pane tier hides the wrapper (tab switch away, or Settings stands)
    observer.deliver(true);  // the pane is presented again
    observer.deliver(false);
    observer.deliver(true);
    assert.deepEqual(log, ['create', 'hide', 'show', 'hide', 'show'], 'create once, then only setVisible calls');
    assert.equal(memory.cameraSteps, 4, 'the module kept the same state across every hide and show');
    assert.equal(memory.selection, 'subject-a');
    stop();
    assert.equal(observer.observers.at(-1).disconnected, true);
    session.dispose();
    assert.deepEqual(log.slice(-1), ['unmount'], 'only teardown unmounts');
    assert.equal(log.filter(entry => entry === 'create').length, 1);
  } finally {
    observer.restore();
  }
});

test('a pane concealed before its module stands is told once, at mount, and never remounted', async () => {
  const log = [];
  const {registration} = projectionModuleDouble(log);
  const session = new ProjectionPaneSession(registration, context, () => log.push('fault'));
  session.setVisible(false);
  await session.ready;
  session.setVisible(true);
  assert.deepEqual(log, ['create', 'hide', 'show']);
  session.dispose();
});

const slowEarth = log => ({
  id: 'slow-earth', kind: 'projection.earth',
  create() {
    log.push('create');
    return new Promise(resolve => setTimeout(() => resolve({setVisible() { log.push('visible'); }, unmount() { log.push('unmount'); }}), 5));
  },
});

test('a session disposed before its module began to mount never mounts it, and no fault is raised', async () => {
  // React's development double-invoke disposes the first session in the task that made it; mounting its module anyway built the
  // Earth's whole globe only to lose its WebGL context as soon as it stood (ticket D, measured headless on software GL: 15–40 s on the main thread).
  const log = [];
  const session = new ProjectionPaneSession(slowEarth(log), context, message => log.push(`fault:${message}`));
  session.dispose();
  await session.ready;
  session.setVisible(false);
  assert.deepEqual(log, []);
});

test('a session disposed while its module is still mounting unmounts the late module once, and no fault is raised', async () => {
  const log = [];
  const session = new ProjectionPaneSession(slowEarth(log), context, message => log.push(`fault:${message}`));
  await Promise.resolve(); // the module has begun to mount
  session.dispose();
  await session.ready;
  session.dispose();
  session.setVisible(false);
  assert.deepEqual(log, ['create', 'unmount']);
});

test('a module that refuses to mount reports the reason and leaves no handle behind', async () => {
  const faults = [];
  const session = new ProjectionPaneSession({id: 'broken', kind: 'projection.earth', create() { throw new Error('no WebGL'); }}, context, message => faults.push(message));
  await session.ready;
  session.setVisible(false);
  session.dispose();
  assert.deepEqual(faults, ['no WebGL']);
});

test('concealment is observed only where the host has an IntersectionObserver', () => {
  const previous = globalThis.IntersectionObserver;
  delete globalThis.IntersectionObserver;
  try {
    assert.equal(observeConcealment({}, () => {}), null);
  } finally {
    globalThis.IntersectionObserver = previous;
  }
});
