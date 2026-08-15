import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './api.mjs';

test('unified shared-field API exposes projection and shared-agency floors', () => {
  for (const name of [
    'createParticipant',
    'createProjection',
    'receiveProjection',
    'selectCentralParticipantRoot',
    'createSharedField',
    'validateSharedFieldNesting',
    'createContribution',
    'createEncounter',
    'selfOtherReadModel',
  ]) {
    assert.equal(typeof api[name], 'function', `${name} should be exported`);
  }

  assert.equal(api.PARTICIPANT_SCHEMA, 'oi.participant/v1');
  assert.equal(api.PROJECTION_SCHEMA, 'oi.projection/v1');
  assert.equal(api.SHARED_FIELD_SCHEMA, 'oi.shared-field/v1');
  assert.equal(api.CONTRIBUTION_SCHEMA, 'oi.contribution/v1');
  assert.equal(api.ENCOUNTER_SCHEMA, 'oi.encounter/v1');
});
