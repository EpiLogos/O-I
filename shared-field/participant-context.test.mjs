import assert from 'node:assert/strict';
import test from 'node:test';
import { participantContext, participantContributions } from './participant-context.mjs';

const F = 'oi:field:u';
const snapshot = {
  target: { name: 'hosted' }, transport_identity: 'b0b',
  fields: [{ field_ref: F, title: 'Undertaking' }, { field_ref: 'oi:field:other' }],
  my_authority: [{ field_ref: F, participant_ref: 'participant:b', role: 'contributor', revoked: false }],
  entry_fields: { 'w/artifact:central:corpus:A04': F, 'w/artifact:central:corpus:A04p': F, 'w/node': F, 'x/private': 'oi:field:other' },
  entries: [
    { ref: 'w/artifact:central:corpus:A04', kind: 'curated-artifact', label: 'A04', meta: { projection_ref: 'p:A04' } },
    { ref: 'w/artifact:central:corpus:A04p', kind: 'curated-artifact', label: 'A04′', meta: { projection_ref: 'p:A04p' } },
    { ref: 'w/node', kind: 'wiki-node', label: 'A04 node' },
    { ref: 'x/private', kind: 'wiki-node', label: 'NOT IN THIS FIELD' },
  ],
  projections: ['A04', 'A04p'].map((id) => ({ projection_ref: `p:${id}`, projection_revision: 1, state: 'published', source: { ref: `central:source:corpus:${id}`, revision: `rev-${id}` }, representation: { payload: { regions: [{ bindings: [{ component_ref: 'oi.presentation/prose/v1', subject_ref: `w/artifact:central:corpus:${id}#section:0`, props: { title: '#0', html: `<p>${id} text &amp; more</p>` } }] }] } } })),
  relations: [],
  field_now: [{ field_ref: F, contract: { revision: 1, projected_child_now_refs: [{ now_ref: 'central:now:project:O-I:x', workcell_ref: 'workcell:mac', state: 'active', purpose_summary: 'Explain A04 ↔ A04′', projected_by: 'participant:a' }] } }],
};

test('the context carries only the participant field, its purpose and sources with their revisions', () => {
  const context = participantContext({ snapshot, field_ref: F, participant_ref: 'participant:b', prepared_at: '2026-09-28T00:00:00Z' });
  assert.deepEqual(context.sources.map((s) => [s.source_ref, s.source_revision, s.sections[0].text]), [['central:source:corpus:A04', 'rev-A04', 'A04 text & more'], ['central:source:corpus:A04p', 'rev-A04p', 'A04p text & more']]);
  assert.deepEqual(context.undertaking.map((u) => u.purpose), ['Explain A04 ↔ A04′']);
  assert.ok(!JSON.stringify(context).includes('NOT IN THIS FIELD'));
  assert.throws(() => participantContext({ snapshot, field_ref: F, participant_ref: 'participant:c', prepared_at: 'x' }), /holds no authority/);
});

test('an Agent result becomes two basis-pinned, agent-attributed Contributions', () => {
  const context = participantContext({ snapshot, field_ref: F, participant_ref: 'participant:b', prepared_at: 'x' });
  const result = { explanation_markdown: 'A04′ re-sites A04.', relation_proposal: { relation_kind: 're-sites', from: 'A04p', to: 'A04', summary: 's' }, sections_read: ['w/artifact:central:corpus:A04#section:0'] };
  const [prose, relation] = participantContributions({ context, result, agent_ref: 'agent:b', execution_ref: 'session:1', created_at: '2026-09-28T00:00:00.000Z' });
  assert.equal(prose.representation.payload.kind, 'prose');
  assert.deepEqual(prose.representation.payload.basis, { source_ref: 'central:source:corpus:A04p', source_revision: 'rev-A04p', projection_ref: 'p:A04p', projection_revision: 1 });
  assert.deepEqual(prose.agency, { ref: 'agent:b', execution_ref: 'session:1' });
  assert.equal(relation.representation.payload.content.relation.ref, 're-sites');
  assert.equal(relation.representation.payload.content.to.revision, 'rev-A04');
  assert.throws(() => participantContributions({ context, result: { ...result, relation_proposal: { ...result.relation_proposal, to: 'A99' } }, agent_ref: 'a', created_at: '2026-09-28T00:00:00.000Z' }), /not a source shared/);
});
