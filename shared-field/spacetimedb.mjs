import { validateParticipant, validateProjection } from './index.mjs';
import { validateSharedField } from './social.mjs';
import { createExploreApplication, createExploreEntry } from './explore.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function parseContractJson(value, name) {
  requireString(value, name);
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new TypeError(`${name} must contain valid JSON: ${error.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${name} must contain a JSON object`);
  }
  return parsed;
}

function requireEqual(actual, expected, name) {
  if (actual !== expected) throw new TypeError(`${name} does not match canonical contract: ${actual} !== ${expected}`);
}

function implementationRow(row, semanticRef) {
  if (row.rowId === undefined || row.rowId === null) throw new TypeError('SpaceTimeDB row is missing implementation rowId');
  return { row_id: String(row.rowId), semantic_ref: semanticRef };
}

export function projectionStorageKey(projectionRef, projectionRevision) {
  requireString(projectionRef, 'projection ref');
  if (!Number.isInteger(projectionRevision) || projectionRevision < 1) {
    throw new TypeError('projection revision must be a positive integer');
  }
  return `${projectionRef}@${projectionRevision}`;
}

export function relationStorageRef(relation) {
  if (relation === null || typeof relation !== 'object' || Array.isArray(relation)) {
    throw new TypeError('relation must be an object');
  }
  const explicit = relation.relation_ref ?? relation.semantic_ref;
  if (explicit !== undefined) return requireString(explicit, 'relation semantic ref');
  const provenanceRef = relation.provenance?.[0]?.ref;
  if (provenanceRef) return requireString(provenanceRef, 'relation provenance ref');
  throw new TypeError('hosted Explore relation requires an explicit or provenance semantic ref');
}

/**
 * Convert subscribed SpaceTimeDB rows back into the portable O:I contracts.
 *
 * Auto-increment row IDs are retained only under `implementation`. Every semantic
 * contract is revalidated and checked against its indexed semantic-ref columns before
 * it may enter the Explore read model.
 */
export function hostedSnapshotFromRows(rows = {}) {
  const fields = [];
  const participants = [];
  const projections = [];
  const entries = [];
  const relations = [];
  const implementation = {
    fields: [],
    participants: [],
    projections: [],
    entries: [],
    relations: [],
  };

  for (const row of rows.sharedFields ?? []) {
    const field = validateSharedField(parseContractJson(row.contractJson, 'SharedField contractJson'));
    requireEqual(row.fieldRef, field.field_ref, 'SharedField fieldRef');
    fields.push(field);
    implementation.fields.push(implementationRow(row, field.field_ref));
  }

  for (const row of rows.participants ?? []) {
    const participant = validateParticipant(parseContractJson(row.contractJson, 'Participant contractJson'));
    requireEqual(row.participantRef, participant.participant_ref, 'Participant participantRef');
    requireEqual(row.fieldRef, participant.field_ref, 'Participant fieldRef');
    requireEqual(row.identityKind, participant.identity.kind, 'Participant identityKind');
    requireEqual(row.identityRef, participant.identity.ref, 'Participant identityRef');
    requireEqual(row.sourceSystem, participant.provenance.source_system, 'Participant sourceSystem');
    requireEqual(row.sourceRevision, participant.provenance.source_revision, 'Participant sourceRevision');
    participants.push(participant);
    implementation.participants.push(implementationRow(row, participant.participant_ref));
  }

  for (const row of rows.projections ?? []) {
    const projection = validateProjection(parseContractJson(row.contractJson, 'Projection contractJson'));
    requireEqual(row.projectionRef, projection.projection_ref, 'Projection projectionRef');
    requireEqual(row.projectionRevision, projection.projection_revision, 'Projection projectionRevision');
    requireEqual(row.projectionKey, projectionStorageKey(projection.projection_ref, projection.projection_revision), 'Projection projectionKey');
    requireEqual(row.sourceRevision, projection.source.revision, 'Projection sourceRevision');
    requireEqual(row.publisherParticipantRef, projection.publisher_participant_ref, 'Projection publisherParticipantRef');
    projections.push(projection);
    implementation.projections.push(implementationRow(row, row.projectionKey));
  }

  for (const row of rows.exploreEntries ?? []) {
    const entry = createExploreEntry(parseContractJson(row.entryJson, 'Explore entryJson'));
    requireEqual(row.semanticRef, entry.ref, 'Explore semanticRef');
    requireEqual(row.worldRef, entry.world_ref, 'Explore worldRef');
    requireEqual(row.kind, entry.kind, 'Explore kind');
    requireEqual(row.label, entry.label, 'Explore label');
    requireEqual(row.revision ?? '', entry.revision ?? '', 'Explore revision');
    entries.push(entry);
    implementation.entries.push(implementationRow(row, entry.ref));
  }

  for (const row of rows.exploreRelations ?? []) {
    const relation = parseContractJson(row.relationJson, 'Explore relationJson');
    requireEqual(row.relationRef, relationStorageRef(relation), 'Explore relationRef');
    requireEqual(row.fromRef, relation.from, 'Explore relation fromRef');
    requireEqual(row.toRef, relation.to, 'Explore relation toRef');
    requireEqual(row.relation, relation.relation, 'Explore relation type');
    requireEqual(row.origin, relation.origin, 'Explore relation origin');
    relations.push(relation);
    implementation.relations.push(implementationRow(row, row.relationRef));
  }

  createExploreApplication({ entries, relations });

  return {
    fields: fields.map(clone),
    participants: participants.map(clone),
    projections: projections.map(clone),
    entries: entries.map(clone),
    relations: relations.map(clone),
    implementation: clone(implementation),
  };
}

export function rowsFromSpacetimeDb(db) {
  if (!db || typeof db !== 'object') throw new TypeError('SpaceTimeDB db view is required');
  const read = (name) => {
    const handle = db[name];
    if (!handle || typeof handle.iter !== 'function') throw new TypeError(`SpaceTimeDB db.${name} table handle is required`);
    return [...handle.iter()];
  };
  return {
    sharedFields: read('sharedField'),
    participants: read('participant'),
    projections: read('projection'),
    exploreEntries: read('exploreEntry'),
    exploreRelations: read('exploreRelation'),
  };
}

export function createSpacetimeExploreSource(db) {
  const tables = Object.freeze([
    ['sharedField', 'shared-field'],
    ['participant', 'participant'],
    ['projection', 'projection'],
    ['exploreEntry', 'explore-entry'],
    ['exploreRelation', 'explore-relation'],
  ]);

  function snapshot() {
    return hostedSnapshotFromRows(rowsFromSpacetimeDb(db));
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('SpaceTimeDB source listener must be a function');
    const removers = [];

    for (const [property, table] of tables) {
      const handle = db[property];
      if (!handle) throw new TypeError(`SpaceTimeDB db.${property} table handle is required`);

      if (typeof handle.onInsert === 'function') {
        const callback = (_ctx, row) => listener({ type: 'insert', table, row_id: String(row.rowId) });
        handle.onInsert(callback);
        if (typeof handle.removeOnInsert === 'function') removers.push(() => handle.removeOnInsert(callback));
      }
      if (typeof handle.onUpdate === 'function') {
        const callback = (_ctx, oldRow, newRow) => listener({
          type: 'update',
          table,
          old_row_id: String(oldRow.rowId),
          row_id: String(newRow.rowId),
        });
        handle.onUpdate(callback);
        if (typeof handle.removeOnUpdate === 'function') removers.push(() => handle.removeOnUpdate(callback));
      }
      if (typeof handle.onDelete === 'function') {
        const callback = (_ctx, row) => listener({ type: 'delete', table, row_id: String(row.rowId) });
        handle.onDelete(callback);
        if (typeof handle.removeOnDelete === 'function') removers.push(() => handle.removeOnDelete(callback));
      }
    }

    return () => {
      for (const remove of removers.reverse()) remove();
    };
  }

  return Object.freeze({ snapshot, subscribe });
}

/**
 * A live Explore facade over a subscribed hosted-state source.
 *
 * The index is fully rebuildable. Provider changes trigger a complete validated rebuild,
 * while readers continue to see the last good application if a malformed hosted update
 * is observed.
 */
export function createLiveExploreApplication(source) {
  if (!source || typeof source.snapshot !== 'function' || typeof source.subscribe !== 'function') {
    throw new TypeError('live Explore source requires snapshot() and subscribe()');
  }

  let application;
  let hostedSnapshot;
  let revision = 0;
  let lastError;
  const listeners = new Set();

  function rebuild(cause = { type: 'initial' }) {
    try {
      const nextSnapshot = source.snapshot();
      const nextApplication = createExploreApplication({
        entries: nextSnapshot.entries,
        relations: nextSnapshot.relations,
      });
      hostedSnapshot = nextSnapshot;
      application = nextApplication;
      revision += 1;
      lastError = undefined;
      const event = { type: 'rebuild', revision, cause: clone(cause) };
      for (const listener of listeners) listener(clone(event));
      return true;
    } catch (error) {
      lastError = error;
      const event = { type: 'rebuild-error', revision, cause: clone(cause), error: error.message };
      for (const listener of listeners) listener(clone(event));
      if (!application) throw error;
      return false;
    }
  }

  rebuild();
  const unsubscribeSource = source.subscribe((event) => rebuild(event));

  const call = (name) => (...args) => application[name](...args);

  function status() {
    return {
      revision,
      healthy: lastError === undefined,
      ...(lastError ? { error: lastError.message } : {}),
    };
  }

  function snapshot() {
    return clone(hostedSnapshot);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('live Explore listener must be a function');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispose() {
    unsubscribeSource?.();
    listeners.clear();
  }

  return Object.freeze({
    resolve: call('resolve'),
    resolveLocator: call('resolveLocator'),
    search: call('search'),
    read: call('read'),
    relations: call('relations'),
    relationsFor: call('relationsFor'),
    localWhole: call('localWhole'),
    sources: call('sources'),
    explain: call('explain'),
    open: call('open'),
    surface: call('surface'),
    status,
    snapshot,
    rebuild,
    subscribe,
    dispose,
  });
}
