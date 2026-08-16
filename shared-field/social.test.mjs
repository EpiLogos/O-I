import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRIBUTION_SCHEMA,
  ENCOUNTER_SCHEMA,
  SHARED_FIELD_SCHEMA,
  createContribution,
  createEncounter,
  createSharedField,
  isNestedContribution,
  selfOtherReadModel,
  validateSharedFieldNesting,
} from './social.mjs';

const provenance = [{ kind: 'source', ref: 'oi:local', source_system: 'oi', revision: 'abc123' }];

const root = createSharedField({
  field_ref: 'field:commons',
  kind: 'commons',
  title: 'O:I commons',
  provenance,
});

const child = createSharedField({
  field_ref: 'field:commons/research',
  kind: 'research',
  parent_field_ref: root.field_ref,
  anchor: { kind: 'wiki.space', ref: 'wiki:oi-research' },
  provenance,
});

const grandchild = createSharedField({
  field_ref: 'field:commons/research/polylogos',
  kind: 'study',
  parent_field_ref: child.field_ref,
  provenance,
});

test('SharedFields are recursively nestable without identity collapse', () => {
  assert.equal(root.schema, SHARED_FIELD_SCHEMA);
  assert.deepEqual(validateSharedFieldNesting([root, child, grandchild]).map((field) => field.field_ref), [
    'field:commons',
    'field:commons/research',
    'field:commons/research/polylogos',
  ]);
  assert.equal(grandchild.parent_field_ref, child.field_ref);
});

test('SharedField containment rejects direct and indirect cycles', () => {
  assert.throws(() => createSharedField({ field_ref: 'field:x', parent_field_ref: 'field:x', provenance }));
  const a = createSharedField({ field_ref: 'field:a', parent_field_ref: 'field:b', provenance });
  const b = createSharedField({ field_ref: 'field:b', parent_field_ref: 'field:a', provenance });
  assert.throws(() => validateSharedFieldNesting([a, b]), /cycle/i);
});

const finding = createContribution({
  contribution_ref: 'contribution:finding-1',
  field_ref: child.field_ref,
  contributor_participant_ref: 'participant:agent-a',
  created_at: '2026-08-15T13:00:00Z',
  mode: 'finding',
  target: { kind: 'projection', ref: 'projection:polylogos-study' },
  relation: { kind: 'extends' },
  representation: { kind: 'text/plain', payload: 'Polyadic dialogue produced a durable shared lexicon.' },
  provenance,
  agency: { ref: 'agent:a', execution_ref: 'execution:42' },
});

const opinion = createContribution({
  contribution_ref: 'contribution:opinion-1',
  field_ref: child.field_ref,
  contributor_participant_ref: 'participant:human-b',
  created_at: '2026-08-15T13:01:00Z',
  mode: 'opinion',
  target: { kind: 'oi.contribution', ref: finding.contribution_ref },
  relation: { kind: 'responds_to' },
  representation: { kind: 'text/plain', payload: 'Treat this as evidence for dialogical co-formation.' },
  provenance,
});

const metric = createContribution({
  contribution_ref: 'contribution:metric-1',
  field_ref: child.field_ref,
  contributor_participant_ref: 'participant:agent-c',
  created_at: '2026-08-15T13:02:00Z',
  mode: 'metric',
  target: { kind: 'oi.contribution', ref: finding.contribution_ref },
  relation: { kind: 'measures' },
  representation: { kind: 'application/json', payload: { measure: 'reproduction_count', value: 3 } },
  provenance,
});

const ranking = createContribution({
  contribution_ref: 'contribution:ranking-1',
  field_ref: child.field_ref,
  contributor_participant_ref: 'participant:agent-c',
  created_at: '2026-08-15T13:03:00Z',
  mode: 'ranking',
  target: { kind: 'oi.shared-field', ref: child.field_ref },
  relation: { kind: 'ranks_within' },
  representation: {
    kind: 'application/json',
    payload: { ordered_refs: [finding.contribution_ref, opinion.contribution_ref], basis: 'evidence-use' },
  },
  provenance,
});

test('Contributions recursively target Contributions', () => {
  assert.equal(finding.schema, CONTRIBUTION_SCHEMA);
  assert.equal(isNestedContribution(opinion), true);
  assert.equal(opinion.target.ref, finding.contribution_ref);
});

test('metrics and rankings are ordinary attributable Contributions', () => {
  assert.equal(metric.mode, 'metric');
  assert.equal(metric.relation.kind, 'measures');
  assert.equal(metric.target.kind, 'oi.contribution');
  assert.equal(ranking.mode, 'ranking');
  assert.equal(ranking.target.kind, 'oi.shared-field');
});

test('Encounter records mediated availability without claiming subjective state', () => {
  const encounter = createEncounter({
    encounter_ref: 'encounter:human-b:1',
    field_ref: child.field_ref,
    participant_ref: 'participant:human-b',
    occurred_at: '2026-08-15T13:05:00Z',
    mediation: { kind: 'direct-address', policy_ref: 'policy:chronological-v1' },
    items: [
      { kind: 'oi.contribution', ref: finding.contribution_ref },
      { kind: 'oi.contribution', ref: metric.contribution_ref },
    ],
    provenance,
  });
  assert.equal(encounter.schema, ENCOUNTER_SCHEMA);
  assert.equal(encounter.items.length, 2);
  assert.equal('belief' in encounter, false);
  assert.equal('subjective_state' in encounter, false);
});

test('Self/Other read model keeps field-relative participant roles explicit', () => {
  const self = { schema: 'oi.participant/v1', participant_ref: 'participant:self', field_ref: child.field_ref, identity: { kind: 'human', ref: 'human:self' } };
  const other = { schema: 'oi.participant/v1', participant_ref: 'participant:other', field_ref: child.field_ref, identity: { kind: 'agent', ref: 'agent:other' } };
  const view = selfOtherReadModel({ self, others: [other], field: child });
  assert.equal(view.self.identity.ref, 'human:self');
  assert.equal(view.others[0].identity.ref, 'agent:other');
  assert.equal(view.field.ref, child.field_ref);
});
