import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initialParticipantComposerState,
  participantAddressFromComposer,
  participantComposerTransition,
  visibleParticipantCandidates,
} from './participant-composer-model.mjs';

const candidates = [
  { kind: 'human', participant: 'participant:human:satya', address: '@satya' },
  { kind: 'agent', participant: 'agent:developer', address: '@developer' },
  { kind: 'agent-set', participant: 'agent-set:development', address: '@development' },
];

test('query and keyboard selection keep primary composition state local', () => {
  let state = initialParticipantComposerState();
  state = participantComposerTransition(state, { type: 'query', value: 'dev' }, candidates);
  assert.equal(state.open, true);
  assert.deepEqual(visibleParticipantCandidates(state, candidates).map((entry) => entry.address), ['@developer', '@development']);

  state = participantComposerTransition(state, { type: 'arrow-down' }, candidates);
  state = participantComposerTransition(state, { type: 'select-highlighted', channel: 'to' }, candidates);
  assert.deepEqual(state.to.map((entry) => entry.address), ['@development']);
  assert.equal(state.query, '');
  assert.equal(state.open, true);
});

test('Backspace removes the last To chip only when the search field is empty', () => {
  let state = initialParticipantComposerState();
  state = participantComposerTransition(state, { type: 'select', target: candidates[0], channel: 'to' }, candidates);
  state = participantComposerTransition(state, { type: 'select', target: candidates[1], channel: 'to' }, candidates);
  state = participantComposerTransition(state, { type: 'backspace' }, candidates);
  assert.deepEqual(state.to.map((entry) => entry.address), ['@satya']);

  state = participantComposerTransition(state, { type: 'query', value: 'x' }, candidates);
  state = participantComposerTransition(state, { type: 'backspace' }, candidates);
  assert.deepEqual(state.to.map((entry) => entry.address), ['@satya']);
});

test('Escape clears search before closing the attached picker', () => {
  let state = participantComposerTransition(initialParticipantComposerState(), { type: 'query', value: '@dev' }, candidates);
  state = participantComposerTransition(state, { type: 'escape' }, candidates);
  assert.equal(state.query, '');
  assert.equal(state.open, true);
  state = participantComposerTransition(state, { type: 'escape' }, candidates);
  assert.equal(state.open, false);
});

test('committed address carries only typed To/mention meaning', () => {
  let state = initialParticipantComposerState();
  state = participantComposerTransition(state, { type: 'select', target: candidates[1], channel: 'to' }, candidates);
  state = participantComposerTransition(state, { type: 'select', target: candidates[2], channel: 'mention' }, candidates);
  const address = participantAddressFromComposer(state);

  assert.equal(address.version, 'aikit.participant-address/v1');
  assert.equal(address.to[0].kind, 'agent');
  assert.equal(address.mentions[0].kind, 'agent-set');
  assert.equal(Object.hasOwn(address, 'membership'), false);
  assert.equal(Object.hasOwn(address, 'invocation'), false);
  assert.equal(Object.hasOwn(address, 'authority'), false);
  assert.equal(Object.hasOwn(address, 'attention'), false);
});
