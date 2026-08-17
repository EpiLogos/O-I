import test from 'node:test';
import assert from 'node:assert/strict';
import { createContact } from './contact.mjs';
import {
  createSpacetimeContactSource,
  hostedContactFromRow,
} from './spacetimedb-contact.mjs';

const contact = createContact({
  contact_ref: 'contact:ariadne:parasakti:1',
  field_ref: 'oi:field:public',
  initiator_participant_ref: 'participant:public:ariadne',
  recipient_participant_ref: 'participant:public:parasakti',
  purpose: 'Discuss a bounded shared-field topic.',
  requested_scope: { mode: 'conversation' },
  created_micros: '1000000',
  expires_micros: '2000000',
  provenance: { source_system: 'o-i', source_revision: 'contact-fixture@1' },
});

function rowFor(value, rowId = 41n) {
  return {
    rowId,
    contactRef: value.contact_ref,
    fieldRef: value.field_ref,
    initiatorParticipantRef: value.initiator_participant_ref,
    recipientParticipantRef: value.recipient_participant_ref,
    state: value.state,
    contractJson: JSON.stringify(value),
  };
}

test('hosted Contact adapter keeps SpaceTimeDB row identity outside Contact identity', () => {
  const hosted = hostedContactFromRow(rowFor(contact));
  assert.equal(hosted.contact.contact_ref, contact.contact_ref);
  assert.equal(hosted.implementation.row_id, '41');
  assert.equal(hosted.implementation.semantic_ref, contact.contact_ref);
  assert.equal('rowId' in hosted.contact, false);
});

test('Contact source requires the caller-filtered myContact View rather than private table access', () => {
  const handle = { iter: () => [rowFor(contact)].values() };
  const source = createSpacetimeContactSource({ myContact: handle });
  assert.equal(source.snapshot()[0].contact.contact_ref, contact.contact_ref);
  assert.throws(() => createSpacetimeContactSource({ contact: handle }), /myContact caller View/);
});
