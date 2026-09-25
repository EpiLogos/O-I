import test from 'node:test';
import assert from 'node:assert/strict';
import {liveValue,updateToolbeltValues} from '../build/liveValues.js';
import {fieldStudies} from '../build/model.js';

// Minimal duck-typed stand-ins for the handful of DOM members updateToolbeltValues
// touches. No jsdom needed: the function only calls host.querySelectorAll, and per
// input dataset/type/value/style.setProperty plus document.activeElement.
function fakeInput({bind,type,value}) {
  return {
    dataset: {bind, originalValue: value},
    type,
    value,
    style: {setProperty(){}},
  };
}
function fakeRow(entityId,input) {
  return {
    contains: () => false,          // not the focused element
    matches: () => false,
    closest: () => ({dataset: {entityId}}),
    querySelectorAll: () => [input],
  };
}
function fakeHost(row) {
  return {querySelectorAll: () => [row]};
}

test('a live-telemetry display refresh keeps dataset.originalValue in lockstep with the value it writes', () => {
  globalThis.document = {activeElement: null};
  const scene = fieldStudies().scenes[0];
  const entity = scene.entities[0];
  // The just-committed value (4.5) has not reached telemetry yet: it still reports the
  // pre-edit reading (0). This is exactly the window in which the real bug fired a
  // spurious second commit, because the input's .value was overwritten without updating
  // dataset.originalValue, so a later focusout saw value !== originalValue and re-applied
  // the stale telemetry reading as if it were a fresh user edit.
  const input = fakeInput({bind: 'entity.force.strength', type: 'number', value: '4.5'});
  const row = fakeRow(entity.id, input);
  const host = fakeHost(row);
  // A stale native config snapshot: the just-committed 4.5 has not reached the engine
  // yet, so it still reports the pre-edit reading (0) at entities.<index>.forces.strength.
  const config = {entities: [{forces: {strength: 0}}]};
  updateToolbeltValues(host, scene, {}, config);
  // updateToolbeltValues did overwrite .value with the stale telemetry reading (0) — that
  // part is by design (it's a display refresh). The regression is that it used to leave
  // dataset.originalValue at '4.5', so the next real focusout ('0' !== '4.5') treated the
  // stale display refresh as a brand-new user edit and re-committed the stale 0, clobbering
  // the real 4.5 already written to the document.
  assert.equal(input.value, '0');
  assert.equal(input.dataset.originalValue, input.value, 'dataset.originalValue must always mirror the last value updateToolbeltValues wrote');
  delete globalThis.document;
});

test('liveValue reads a per-entity target out of the native config snapshot, in stored units', () => {
  const scene = fieldStudies().scenes[0];
  const entity = scene.entities[0];
  // With no matching binding in an empty scene/config, liveValue must return undefined
  // rather than a numeric default that could masquerade as a real telemetry reading.
  assert.equal(liveValue(scene, 'entity.force.strength', entity.id, {}, {}), undefined);
  assert.equal(liveValue(scene, 'entity.force.strength', undefined, {}, {}), undefined);
});
