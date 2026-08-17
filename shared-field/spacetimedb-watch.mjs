import { validateWatch } from './watch.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireEqual(actual, expected, name) {
  if (actual !== expected) throw new TypeError(`${name} does not match canonical Watch contract: ${actual} !== ${expected}`);
}

function parseContractJson(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('Watch contractJson must be a non-empty string');
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new TypeError(`Watch contractJson must contain valid JSON: ${error.message}`);
  }
  return parsed;
}

export function hostedWatchFromRow(row) {
  if (!row || typeof row !== 'object') throw new TypeError('SpaceTimeDB Watch row is required');
  if (row.rowId === undefined || row.rowId === null) throw new TypeError('SpaceTimeDB Watch row is missing implementation rowId');

  const watch = validateWatch(parseContractJson(row.contractJson));
  requireEqual(row.watchRef, watch.watch_ref, 'Watch watchRef');
  requireEqual(row.fieldRef, watch.field_ref, 'Watch fieldRef');
  requireEqual(row.watcherParticipantRef, watch.watcher_participant_ref, 'Watch watcherParticipantRef');
  requireEqual(row.targetKind, watch.target.kind, 'Watch targetKind');
  requireEqual(row.targetRef, watch.target.ref, 'Watch targetRef');
  requireEqual(row.state, watch.state, 'Watch state');

  return {
    watch: clone(watch),
    implementation: {
      row_id: String(row.rowId),
      semantic_ref: watch.watch_ref,
    },
  };
}

export function hostedWatchesFromSpacetimeDb(db) {
  const handle = db?.myWatch;
  if (!handle || typeof handle.iter !== 'function') throw new TypeError('SpaceTimeDB db.myWatch caller View handle is required');
  return [...handle.iter()].map(hostedWatchFromRow);
}

export function createSpacetimeWatchSource(db) {
  const handle = db?.myWatch;
  if (!handle || typeof handle.iter !== 'function') throw new TypeError('SpaceTimeDB db.myWatch caller View handle is required');

  function snapshot() {
    return hostedWatchesFromSpacetimeDb(db);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('SpaceTimeDB Watch listener must be a function');
    const removers = [];

    if (typeof handle.onInsert === 'function') {
      const callback = (_ctx, row) => listener({
        type: 'insert',
        watch: hostedWatchFromRow(row).watch,
      });
      handle.onInsert(callback);
      if (typeof handle.removeOnInsert === 'function') removers.push(() => handle.removeOnInsert(callback));
    }
    if (typeof handle.onUpdate === 'function') {
      const callback = (_ctx, oldRow, newRow) => listener({
        type: 'update',
        previous: hostedWatchFromRow(oldRow).watch,
        watch: hostedWatchFromRow(newRow).watch,
      });
      handle.onUpdate(callback);
      if (typeof handle.removeOnUpdate === 'function') removers.push(() => handle.removeOnUpdate(callback));
    }
    if (typeof handle.onDelete === 'function') {
      const callback = (_ctx, row) => listener({
        type: 'delete',
        watch: hostedWatchFromRow(row).watch,
      });
      handle.onDelete(callback);
      if (typeof handle.removeOnDelete === 'function') removers.push(() => handle.removeOnDelete(callback));
    }

    return () => {
      for (const remove of removers.reverse()) remove();
    };
  }

  return Object.freeze({ snapshot, subscribe });
}
