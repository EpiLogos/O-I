import { createProjection, validateProjection } from './index.mjs';
import { createExploreEntry } from './explore.mjs';
import { validateA2aBinding, validateA2aPresence } from './a2a.mjs';

export const A2A_BINDING_REPRESENTATION_KIND = 'a2a-binding';
export const A2A_PRESENCE_EXPLORE_KIND = 'a2a-presence';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function parseJson(value, name) {
  requireString(value, name);
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new TypeError(`${name} must contain valid JSON: ${error.message}`);
  }
  return parsed;
}

function equal(actual, expected, name) {
  if (actual !== expected) throw new TypeError(`${name} does not match semantic contract: ${actual} !== ${expected}`);
}

function implementation(row, semanticRef, kind) {
  if (row.rowId === undefined || row.rowId === null) throw new TypeError(`SpaceTimeDB ${kind} row is missing implementation rowId`);
  return { row_id: String(row.rowId), semantic_ref: semanticRef };
}

/**
 * Host an explicitly selected A2A binding through the already-secured Projection primitive.
 * The Projection publishes a transport relation about an Agent; it does not become the Agent,
 * Participant or endpoint identity. A withdrawn binding is still published as a withdrawal fact,
 * but carries no live endpoint locator.
 */
export function createA2aBindingProjection(bindingInput, input = {}) {
  const binding = validateA2aBinding(bindingInput);
  const projectionRef = requireString(input.projection_ref ?? binding.projection_ref, 'A2A binding projection_ref');
  const projectionRevision = input.projection_revision ?? binding.binding_revision;
  if (!Number.isInteger(projectionRevision) || projectionRevision < 1) throw new TypeError('A2A binding projection_revision must be a positive integer');

  return createProjection({
    projection_ref: projectionRef,
    projection_revision: projectionRevision,
    state: 'published',
    subject: { ref: binding.agent_ref, kind: 'agent' },
    source: { system: 'O:I/A2A', revision: binding.source_revision },
    publisher_participant_ref: binding.publisher_participant_ref,
    published_at: binding.published_at,
    audience: input.audience ?? { visibility: 'public' },
    representation: { kind: A2A_BINDING_REPRESENTATION_KIND, payload: binding },
    provenance: [
      ...binding.provenance,
      { kind: 'publication-decision', ref: binding.publication_decision_ref, source_system: 'O:I' },
    ],
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  });
}

/**
 * Presence is a separately mutable Explore fact observed in the live SharedField. The wrapper's
 * semantic ref is independent of both the SpaceTimeDB row id and the A2A binding ref.
 */
export function createA2aPresenceExploreEntry(presenceInput, input = {}) {
  const presence = validateA2aPresence(presenceInput);
  const semanticRef = requireString(input.semantic_ref ?? `a2a-presence:${presence.binding_ref}`, 'A2A presence semantic_ref');
  const worldRef = requireString(input.world_ref, 'A2A presence world_ref');
  return createExploreEntry({
    ref: semanticRef,
    kind: A2A_PRESENCE_EXPLORE_KIND,
    world_ref: worldRef,
    label: input.label ?? `A2A ${presence.availability}`,
    summary: input.summary ?? `Observed A2A availability for ${presence.participant_ref}: ${presence.availability}`,
    revision: input.revision ?? `presence@${presence.sequence}`,
    provenance: presence.provenance,
    locators: [],
    meta: { a2a_presence: presence },
  });
}

function bindingFromProjectionRow(row) {
  const projection = validateProjection(parseJson(row.contractJson, 'A2A Projection contractJson'));
  if (projection.representation?.kind !== A2A_BINDING_REPRESENTATION_KIND) return undefined;
  const binding = validateA2aBinding(projection.representation.payload);
  equal(row.projectionRef, projection.projection_ref, 'A2A Projection projectionRef');
  equal(Number(row.projectionRevision), projection.projection_revision, 'A2A Projection projectionRevision');
  equal(row.publisherParticipantRef, projection.publisher_participant_ref, 'A2A Projection publisherParticipantRef');
  equal(row.sourceRevision, projection.source.revision, 'A2A Projection sourceRevision');
  equal(projection.subject.kind, 'agent', 'A2A Projection subject kind');
  equal(projection.subject.ref, binding.agent_ref, 'A2A Projection subject Agent ref');
  equal(projection.publisher_participant_ref, binding.publisher_participant_ref, 'A2A binding publisher');
  if (binding.projection_ref !== undefined) equal(binding.projection_ref, projection.projection_ref, 'A2A binding projection_ref');
  return { binding, projection };
}

function presenceFromExploreRow(row) {
  const entry = parseJson(row.entryJson, 'A2A presence Explore entryJson');
  if (entry.kind !== A2A_PRESENCE_EXPLORE_KIND) return undefined;
  equal(row.semanticRef, entry.ref, 'A2A presence Explore semanticRef');
  equal(row.worldRef, entry.world_ref, 'A2A presence Explore worldRef');
  equal(row.kind, entry.kind, 'A2A presence Explore kind');
  const presence = validateA2aPresence(entry.meta?.a2a_presence);
  return { presence, entry };
}

function latestBy(items, key, revision) {
  const latest = new Map();
  for (const item of items) {
    const id = key(item);
    const current = latest.get(id);
    if (!current || revision(item) > revision(current)) latest.set(id, item);
  }
  return [...latest.values()];
}

function legacySnapshot(rows) {
  const bindings = [];
  const presence = [];
  const implementationRows = { bindings: [], presence: [] };

  for (const row of rows.a2aBindings ?? []) {
    const binding = validateA2aBinding(parseJson(row.contractJson, 'A2A binding contractJson'));
    equal(row.bindingRef, binding.binding_ref, 'A2A bindingRef');
    equal(Number(row.bindingRevision), binding.binding_revision, 'A2A bindingRevision');
    equal(row.fieldRef, binding.field_ref, 'A2A fieldRef');
    equal(row.participantRef, binding.participant_ref, 'A2A participantRef');
    equal(row.agentRef, binding.agent_ref, 'A2A agentRef');
    equal(row.publisherParticipantRef, binding.publisher_participant_ref, 'A2A publisherParticipantRef');
    equal(row.publicationDecisionRef, binding.publication_decision_ref, 'A2A publicationDecisionRef');
    equal(row.sourceRevision, binding.source_revision, 'A2A sourceRevision');
    equal(row.state, binding.state, 'A2A state');
    equal(row.protocolVersion, binding.protocol_version, 'A2A protocolVersion');
    equal(row.protocolBinding, binding.protocol_binding, 'A2A protocolBinding');
    equal(row.endpointUrl, binding.endpoint_url ?? '', 'A2A endpointUrl');
    equal(row.agentCardUrl, binding.agent_card_url ?? '', 'A2A agentCardUrl');
    bindings.push(binding);
    implementationRows.bindings.push(implementation(row, binding.binding_ref, 'A2A binding'));
  }

  for (const row of rows.a2aPresence ?? []) {
    const current = validateA2aPresence(parseJson(row.contractJson, 'A2A presence contractJson'));
    equal(row.bindingRef, current.binding_ref, 'A2A presence bindingRef');
    equal(row.fieldRef, current.field_ref, 'A2A presence fieldRef');
    equal(row.participantRef, current.participant_ref, 'A2A presence participantRef');
    equal(row.availability, current.availability, 'A2A availability');
    equal(Number(row.sequence), current.sequence, 'A2A presence sequence');
    presence.push(current);
    implementationRows.presence.push(implementation(row, current.binding_ref, 'A2A presence'));
  }

  return { bindings, presence, implementation: implementationRows };
}

/**
 * Materialize A2A state from the same public Projection + Explore tables already protected by #31.
 * Legacy synthetic row shapes remain accepted only as a unit-test compatibility seam.
 */
export function a2aSnapshotFromRows(rows = {}) {
  if (rows.a2aBindings || rows.a2aPresence) return legacySnapshot(rows);

  const hostedBindings = [];
  const bindingImplementation = new Map();
  for (const row of rows.projections ?? []) {
    const parsed = bindingFromProjectionRow(row);
    if (!parsed) continue;
    hostedBindings.push(parsed);
    bindingImplementation.set(`${parsed.binding.binding_ref}@${parsed.binding.binding_revision}`,
      implementation(row, parsed.projection.projection_ref, 'A2A Projection'));
  }
  const latestBindings = latestBy(hostedBindings, item => item.binding.binding_ref, item => item.binding.binding_revision);

  const hostedPresence = [];
  const presenceImplementation = new Map();
  for (const row of rows.exploreEntries ?? []) {
    const parsed = presenceFromExploreRow(row);
    if (!parsed) continue;
    hostedPresence.push(parsed);
    presenceImplementation.set(`${parsed.presence.binding_ref}@${parsed.presence.sequence}`,
      implementation(row, parsed.entry.ref, 'A2A presence Explore'));
  }
  const latestPresence = latestBy(hostedPresence, item => item.presence.binding_ref, item => item.presence.sequence);

  return {
    bindings: latestBindings.map(item => item.binding),
    presence: latestPresence.map(item => item.presence),
    implementation: {
      bindings: latestBindings.map(item => ({
        ...bindingImplementation.get(`${item.binding.binding_ref}@${item.binding.binding_revision}`),
        projection_ref: item.projection.projection_ref,
      })),
      presence: latestPresence.map(item => ({
        ...presenceImplementation.get(`${item.presence.binding_ref}@${item.presence.sequence}`),
        binding_ref: item.presence.binding_ref,
      })),
    },
  };
}

export function rowsFromSpacetimeA2a(db) {
  if (!db || typeof db !== 'object') throw new TypeError('SpaceTimeDB db view is required');
  const read = (name) => {
    const handle = db[name];
    if (!handle || typeof handle.iter !== 'function') throw new TypeError(`SpaceTimeDB db.${name} table handle is required`);
    return [...handle.iter()];
  };
  return { projections: read('projection'), exploreEntries: read('exploreEntry') };
}

export function createSpacetimeA2aSource(db) {
  const tables = Object.freeze([
    ['projection', 'projection'],
    ['exploreEntry', 'explore-entry'],
  ]);

  function snapshot() {
    return a2aSnapshotFromRows(rowsFromSpacetimeA2a(db));
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('A2A source listener must be a function');
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
        const callback = (_ctx, oldRow, newRow) => listener({ type: 'update', table, old_row_id: String(oldRow.rowId), row_id: String(newRow.rowId) });
        handle.onUpdate(callback);
        if (typeof handle.removeOnUpdate === 'function') removers.push(() => handle.removeOnUpdate(callback));
      }
      if (typeof handle.onDelete === 'function') {
        const callback = (_ctx, row) => listener({ type: 'delete', table, row_id: String(row.rowId) });
        handle.onDelete(callback);
        if (typeof handle.removeOnDelete === 'function') removers.push(() => handle.removeOnDelete(callback));
      }
    }
    return () => removers.reverse().forEach((remove) => remove());
  }

  return Object.freeze({ snapshot, subscribe });
}
