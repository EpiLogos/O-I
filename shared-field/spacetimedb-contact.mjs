import { validateContact } from './contact.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireEqual(actual, expected, name) {
  if (actual !== expected) throw new TypeError(`${name} does not match canonical Contact contract: ${actual} !== ${expected}`);
}

function parseContractJson(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('Contact contractJson must be a non-empty string');
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new TypeError(`Contact contractJson must contain valid JSON: ${error.message}`);
  }
  return parsed;
}

export function hostedContactFromRow(row) {
  if (!row || typeof row !== 'object') throw new TypeError('SpaceTimeDB Contact row is required');
  if (row.rowId === undefined || row.rowId === null) throw new TypeError('SpaceTimeDB Contact row is missing implementation rowId');

  const contact = validateContact(parseContractJson(row.contractJson));
  requireEqual(row.contactRef, contact.contact_ref, 'Contact contactRef');
  requireEqual(row.fieldRef, contact.field_ref, 'Contact fieldRef');
  requireEqual(row.initiatorParticipantRef, contact.initiator_participant_ref, 'Contact initiatorParticipantRef');
  requireEqual(row.recipientParticipantRef, contact.recipient_participant_ref, 'Contact recipientParticipantRef');
  requireEqual(row.state, contact.state, 'Contact state');

  return {
    contact: clone(contact),
    implementation: {
      row_id: String(row.rowId),
      semantic_ref: contact.contact_ref,
    },
  };
}

export function hostedContactsFromSpacetimeDb(db) {
  const handle = db?.myContact;
  if (!handle || typeof handle.iter !== 'function') throw new TypeError('SpaceTimeDB db.myContact caller View handle is required');
  return [...handle.iter()].map(hostedContactFromRow);
}

export function createSpacetimeContactSource(db) {
  const handle = db?.myContact;
  if (!handle || typeof handle.iter !== 'function') throw new TypeError('SpaceTimeDB db.myContact caller View handle is required');

  function snapshot() {
    return hostedContactsFromSpacetimeDb(db);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('SpaceTimeDB Contact listener must be a function');
    const removers = [];

    if (typeof handle.onInsert === 'function') {
      const callback = (_ctx, row) => listener({
        type: 'insert',
        contact: hostedContactFromRow(row).contact,
      });
      handle.onInsert(callback);
      if (typeof handle.removeOnInsert === 'function') removers.push(() => handle.removeOnInsert(callback));
    }
    if (typeof handle.onUpdate === 'function') {
      const callback = (_ctx, oldRow, newRow) => listener({
        type: 'update',
        previous: hostedContactFromRow(oldRow).contact,
        contact: hostedContactFromRow(newRow).contact,
      });
      handle.onUpdate(callback);
      if (typeof handle.removeOnUpdate === 'function') removers.push(() => handle.removeOnUpdate(callback));
    }
    if (typeof handle.onDelete === 'function') {
      const callback = (_ctx, row) => listener({
        type: 'delete',
        contact: hostedContactFromRow(row).contact,
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
