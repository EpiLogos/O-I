import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatch } from './watch.mjs';
import {
  createSpacetimeWatchSource,
  hostedWatchFromRow,
} from './spacetimedb-watch.mjs';

function rowFor(watch, rowId = 17n) {
  return {
    rowId,
    watchRef: watch.watch_ref,
    fieldRef: watch.field_ref,
    watcherParticipantRef: watch.watcher_participant_ref,
    targetKind: watch.target.kind,
    targetRef: watch.target.ref,
    state: watch.state,
    contractJson: JSON.stringify(watch),
  };
}

function fakeWatchHandle(initialRows) {
  let rows = initialRows.map(row => ({ ...row }));
  const updates = new Set();
  return {
    iter: () => rows.values(),
    onUpdate: callback => updates.add(callback),
    removeOnUpdate: callback => updates.delete(callback),
    replace(next) {
      const previous = rows[0];
      rows[0] = { ...next };
      for (const callback of updates) callback({}, previous, rows[0]);
    },
  };
}

const baseWatch = createWatch({
  watch_ref: 'watch:participant:ariadne:parasakti',
  watcher_participant_ref: 'participant:public:ariadne',
  field_ref: 'oi:field:public',
  target: { kind: 'agent', ref: 'agent:parasakti' },
  created_at: '2026-08-16T19:00:00.000Z',
  provenance: { source_system: 'o-i', source_revision: 'watch-action@1' },
});

test('hosted Watch adapter keeps implementation row IDs outside semantic contract', () => {
  const hosted = hostedWatchFromRow(rowFor(baseWatch));
  assert.equal(hosted.watch.watch_ref, 'watch:participant:ariadne:parasakti');
  assert.equal(hosted.watch.target.ref, 'agent:parasakti');
  assert.equal(hosted.implementation.row_id, '17');
  assert.equal(hosted.implementation.semantic_ref, baseWatch.watch_ref);
  assert.equal('rowId' in hosted.watch, false);

  assert.throws(
    () => hostedWatchFromRow({ ...rowFor(baseWatch), targetRef: 'row:17' }),
    /targetRef does not match canonical Watch contract/
  );
});

test('SpaceTimeDB Watch source emits neutral Watch updates with stable semantic identity', () => {
  const handle = fakeWatchHandle([rowFor(baseWatch)]);
  const source = createSpacetimeWatchSource({ watch: handle });
  const events = [];
  const unsubscribe = source.subscribe(event => events.push(event));

  const paused = { ...baseWatch, state: 'paused' };
  handle.replace(rowFor(paused));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'update');
  assert.equal(events[0].previous.watch_ref, baseWatch.watch_ref);
  assert.equal(events[0].watch.watch_ref, baseWatch.watch_ref);
  assert.equal(events[0].watch.state, 'paused');
  assert.equal(source.snapshot()[0].implementation.row_id, '17');

  unsubscribe();
});
