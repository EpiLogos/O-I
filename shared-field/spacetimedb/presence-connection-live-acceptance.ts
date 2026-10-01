/** Real server regression: a reader cannot withdraw an independently entered
 * connection with the same credential. Run only against an acceptance target. */
import assert from 'node:assert/strict';
import {createSharedField} from '../social.mjs';
import {createParticipant} from '../index.mjs';
import {close, connect, open, rows, sleep, subscribe, waitUntil} from './field-lib';

const target = {name: 'acceptance', server: 'acceptance', uri: process.env.SPACETIMEDB_URI!, database: process.env.SPACETIMEDB_DATABASE!};
if (!target.uri || !/acceptance|(?:^|-)ci(?:-|$)/.test(target.database)) throw new Error('An explicit acceptance database is required; never run against the retained field');
const owner = await open(target, 'presence-owner');
const observer = await open(target, 'presence-observer');
const fieldRef = `oi:field:presence-connection:${crypto.randomUUID()}`;
const participantRef = `${fieldRef}:participant`;
const field = createSharedField({field_ref: fieldRef, kind: 'collaboration', visibility: 'public', title: 'Connection-scoped presence regression', provenance: [{kind: 'controlled-test', ref: 'oi:test:presence-connection-live-acceptance', source_system: 'o-i', revision: '1'}]});
const participant = createParticipant({participant_ref: participantRef, field_ref: fieldRef, identity: {kind: 'human', ref: 'human:controlled:presence-regression'}, provenance: {source_system: 'o-i', source_revision: 'presence-connection-acceptance/v1'}});
const present = () => rows(observer.conn.db.fieldPresence).some((row) => row.fieldRef === fieldRef && row.participantRef === participantRef);
const secondary: any[] = [];
try {
  await owner.conn.reducers.putSharedField({fieldRef, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field)});
  await owner.conn.reducers.putParticipant({participantRef, fieldRef, identityKind: participant.identity.kind, identityRef: participant.identity.ref, sourceSystem: participant.provenance.source_system, sourceRevision: participant.provenance.source_revision, contractJson: JSON.stringify(participant)});
  await owner.conn.reducers.grantParticipantAuthority({fieldRef, participantRef, targetIdentity: owner.identity, role: 'contributor', contactable: false, ttlSeconds: 0});
  await owner.conn.reducers.enterField({fieldRef, participantRef, state: 'entered'});
  await waitUntil(present, 'entered connection presence');
  const reader = await connect(target, owner.token); secondary.push(reader);
  await subscribe(reader.conn, reader.lifecycle);
  reader.conn.disconnect();
  await sleep(750);
  assert.equal(present(), true, 'a one-shot same-identity read must not withdraw the entered body');
  const otherBody = await connect(target, owner.token); secondary.push(otherBody);
  await subscribe(otherBody.conn, otherBody.lifecycle);
  await otherBody.conn.reducers.enterField({fieldRef, participantRef, state: 'entered'});
  owner.conn.disconnect();
  await sleep(750);
  assert.equal(present(), true, 'one entered body disconnects while another entered body remains');
  otherBody.conn.disconnect();
  await waitUntil(() => !present(), 'last entered connection withdrawal');
  console.log(JSON.stringify({acceptance: 'controlled-user-protocol', field_ref: fieldRef, passed: ['same-identity reader cannot withdraw presence', 'multiple entered connections retain presence', 'last entered connection disconnect clears presence']}));
} finally {
  for (const body of secondary) body.conn.disconnect();
  close(owner); close(observer);
}
