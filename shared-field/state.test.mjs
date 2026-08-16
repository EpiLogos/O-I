import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipant } from './index.mjs';
import { createContribution, createEncounter, createSharedField } from './social.mjs';
import { createSharedFieldState } from './state.mjs';

const provenance = [{ kind: 'source', ref: 'oi:test', source_system: 'oi', revision: 'test-v1' }];

function fixture() {
  const root = createSharedField({
    field_ref: 'field:root',
    kind: 'commons',
    title: 'Root',
    provenance,
  });
  const research = createSharedField({
    field_ref: 'field:research',
    kind: 'research',
    parent_field_ref: root.field_ref,
    provenance,
  });
  const study = createSharedField({
    field_ref: 'field:study',
    kind: 'study',
    parent_field_ref: research.field_ref,
    provenance,
  });

  const self = createParticipant({
    participant_ref: 'participant:self',
    field_ref: research.field_ref,
    identity: { kind: 'human', ref: 'human:self' },
    provenance: { source_system: 'central', source_revision: 'test-v1' },
  });
  const other = createParticipant({
    participant_ref: 'participant:other',
    field_ref: research.field_ref,
    identity: { kind: 'agent', ref: 'agent:other' },
    provenance: { source_system: 'factory', source_revision: 'test-v1' },
  });

  return { root, research, study, self, other };
}

function contribution(input) {
  return createContribution({
    field_ref: 'field:research',
    created_at: input.created_at,
    contributor_participant_ref: input.contributor,
    contribution_ref: input.ref,
    mode: input.mode,
    target: input.target,
    relation: { kind: input.relation },
    representation: { kind: 'application/json', payload: input.payload ?? { ref: input.ref } },
    provenance,
  });
}

test('state traverses recursively nested SharedFields', () => {
  const { root, research, study } = fixture();
  const state = createSharedFieldState({ fields: [root, research, study] });

  assert.deepEqual(state.fieldPath(study.field_ref).map((field) => field.field_ref), [
    root.field_ref,
    research.field_ref,
    study.field_ref,
  ]);
  assert.deepEqual(state.descendantFields(root.field_ref).map((field) => field.field_ref), [
    research.field_ref,
    study.field_ref,
  ]);
});

test('state enforces field-relative Participant membership', () => {
  const { root, research, self } = fixture();
  const state = createSharedFieldState({ fields: [root, research] });
  state.addParticipant(self);

  assert.equal(state.participantsInField(research.field_ref)[0].participant_ref, self.participant_ref);
  assert.throws(
    () =>
      state.addParticipant(
        createParticipant({
          participant_ref: 'participant:orphan',
          field_ref: 'field:missing',
          identity: { kind: 'agent', ref: 'agent:orphan' },
          provenance: { source_system: 'factory', source_revision: 'test-v1' },
        }),
      ),
    /Unknown SharedField/,
  );
});

test('Contribution threads preserve arbitrary Contribution-on-Contribution depth', () => {
  const { root, research, self, other } = fixture();
  const state = createSharedFieldState({ fields: [root, research], participants: [self, other] });

  const finding = contribution({
    ref: 'contribution:finding',
    contributor: other.participant_ref,
    created_at: '2026-08-15T13:00:00Z',
    mode: 'finding',
    target: { kind: 'projection', ref: 'projection:study' },
    relation: 'extends',
  });
  const opinion = contribution({
    ref: 'contribution:opinion',
    contributor: self.participant_ref,
    created_at: '2026-08-15T13:01:00Z',
    mode: 'opinion',
    target: { kind: 'oi.contribution', ref: finding.contribution_ref },
    relation: 'responds_to',
  });
  const metric = contribution({
    ref: 'contribution:metric',
    contributor: other.participant_ref,
    created_at: '2026-08-15T13:02:00Z',
    mode: 'metric',
    target: { kind: 'oi.contribution', ref: opinion.contribution_ref },
    relation: 'measures',
    payload: { measure: 'reproduction_count', value: 3 },
  });
  const challenge = contribution({
    ref: 'contribution:challenge',
    contributor: self.participant_ref,
    created_at: '2026-08-15T13:03:00Z',
    mode: 'challenge',
    target: { kind: 'oi.contribution', ref: metric.contribution_ref },
    relation: 'challenges',
  });

  for (const item of [finding, opinion, metric, challenge]) state.addContribution(item);

  const thread = state.contributionThread(finding.contribution_ref);
  assert.equal(thread.contribution.mode, 'finding');
  assert.equal(thread.contributions[0].contribution.mode, 'opinion');
  assert.equal(thread.contributions[0].contributions[0].contribution.mode, 'metric');
  assert.equal(thread.contributions[0].contributions[0].contributions[0].contribution.mode, 'challenge');
});

test('ranking and metric contributions remain queryable ordinary Contributions', () => {
  const { root, research, self, other } = fixture();
  const state = createSharedFieldState({ fields: [root, research], participants: [self, other] });

  const ranking = contribution({
    ref: 'contribution:ranking',
    contributor: other.participant_ref,
    created_at: '2026-08-15T13:10:00Z',
    mode: 'ranking',
    target: { kind: 'oi.shared-field', ref: research.field_ref },
    relation: 'ranks_within',
    payload: { ordered_refs: ['x', 'y'], basis: 'evidence-use' },
  });
  state.addContribution(ranking);

  const matches = state.contributionsForTarget({ kind: 'oi.shared-field', ref: research.field_ref });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].mode, 'ranking');
  assert.equal(matches[0].representation.payload.basis, 'evidence-use');
});

test('state rejects recursive Contribution cycles, including deferred references', () => {
  const { root, research, self, other } = fixture();
  const state = createSharedFieldState({ fields: [root, research], participants: [self, other] });

  state.addContribution(
    contribution({
      ref: 'contribution:a',
      contributor: self.participant_ref,
      created_at: '2026-08-15T13:20:00Z',
      mode: 'opinion',
      target: { kind: 'oi.contribution', ref: 'contribution:b' },
      relation: 'responds_to',
    }),
  );

  assert.throws(
    () =>
      state.addContribution(
        contribution({
          ref: 'contribution:b',
          contributor: other.participant_ref,
          created_at: '2026-08-15T13:21:00Z',
          mode: 'opinion',
          target: { kind: 'oi.contribution', ref: 'contribution:a' },
          relation: 'responds_to',
        }),
      ),
    /cycle/i,
  );
});

test('Encounter history preserves mediation path without subjective claims', () => {
  const { root, research, self, other } = fixture();
  const state = createSharedFieldState({ fields: [root, research], participants: [self, other] });

  const encountered = createEncounter({
    encounter_ref: 'encounter:self:1',
    field_ref: research.field_ref,
    participant_ref: self.participant_ref,
    occurred_at: '2026-08-15T13:30:00Z',
    mediation: { kind: 'ranked', contribution_ref: 'contribution:ranking' },
    items: [{ kind: 'projection', ref: 'projection:study' }],
    provenance,
  });
  state.addEncounter(encountered);

  const history = state.encountersForParticipant(self.participant_ref);
  assert.equal(history.length, 1);
  assert.equal(history[0].mediation.kind, 'ranked');
  assert.equal('belief' in history[0], false);
  assert.equal('understanding' in history[0], false);
});
