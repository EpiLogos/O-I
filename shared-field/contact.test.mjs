import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTACT_SCHEMA, createContact, validateContact } from './contact.mjs';

const base = {
  contact_ref: 'contact:ariadne:parasakti:1',
  field_ref: 'oi:field:public',
  initiator_participant_ref: 'participant:public:ariadne',
  recipient_participant_ref: 'participant:public:parasakti',
  purpose: 'Discuss the projected knowledge-navigation work.',
  requested_scope: { mode: 'conversation', topic_ref: 'wiki:o-i:explore:knowledge-navigation' },
  created_micros: '1000000',
  expires_micros: '2000000',
  provenance: { source_system: 'o-i', source_revision: 'contact-fixture@1' },
};

test('Contact keeps discoverability separate from communication, trust and publication', () => {
  const contact = createContact(base);
  assert.equal(contact.schema, CONTACT_SCHEMA);
  assert.equal(contact.state, 'pending');
  assert.equal(contact.initiator_participant_ref, 'participant:public:ariadne');
  assert.equal(contact.recipient_participant_ref, 'participant:public:parasakti');
  assert.equal('trusted' in contact, false);
  assert.equal('a2a_session' in contact, false);
  assert.equal('contribution_ref' in contact, false);
  assert.deepEqual(validateContact(contact), contact);
});

test('Contact rejects self-contact, oversized purpose and invalid expiry', () => {
  assert.throws(() => createContact({ ...base, recipient_participant_ref: base.initiator_participant_ref }), /distinct Participants/);
  assert.throws(() => createContact({ ...base, purpose: 'x'.repeat(501) }), /at most 500/);
  assert.throws(() => createContact({ ...base, expires_micros: base.created_micros }), /expiry must be after creation/);
});

test('portable Contact JSON Schema is pinned to the executable contract', async () => {
  const schema = JSON.parse(await readFile(new URL('./contact-schema-v1.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.schema.const, CONTACT_SCHEMA);
  assert.equal(schema.properties.purpose.maxLength, 500);
  assert.deepEqual(schema.properties.state.enum, ['pending', 'accepted', 'declined', 'redirected', 'narrowed', 'expired']);
  for (const field of ['contact_ref', 'field_ref', 'initiator_participant_ref', 'recipient_participant_ref', 'purpose', 'requested_scope', 'timing', 'provenance']) {
    assert.ok(schema.required.includes(field), `Contact schema should require ${field}`);
  }
});
