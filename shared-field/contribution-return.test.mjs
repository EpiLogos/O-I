import assert from 'node:assert/strict';
import test from 'node:test';
import { contributionBody, createAttachedContribution, createContributionBody, inspectContributionBasis, nativeExpressionReturnProposal, nativeReturnSubmission } from './contribution-return.mjs';

const basis = { source_ref: 'central:source:project:p:doc', source_revision: 'central@7', projection_ref: 'projection:doc', projection_revision: 3, world_presentation_ref: 'presentation:doc', world_presentation_revision: 2, expression_ref: 'expression:doc', expression_revision: 5 };
const revisions = { source_ref: basis.source_ref, source_revision: 'central@7', projection_ref: basis.projection_ref, projection_revision: 3, world_presentation_ref: basis.world_presentation_ref, world_presentation_revision: 2, expression_ref: basis.expression_ref, expression_revision: 5 };
const provenance = [{ kind: 'projection-encounter', ref: 'projection:doc', source_system: 'o-i', revision: '3' }];
function contribution(overrides = {}) {
  return createAttachedContribution({ contribution_ref: 'contribution:second-world:1', field_ref: 'oi:field:shared', contributor_participant_ref: 'participant:second-world', created_at: '2026-09-15T09:00:00Z', target: { kind: 'central.document', ref: basis.source_ref, revision: basis.source_revision }, body: { kind: 'prose', basis, content: 'A returned difference.', attachments: [{ kind: 'file', ref: 'artifact:reading', revision: 'sha256:1' }] }, provenance, ...overrides });
}

test('attached prose preserves distinct Contribution, source, Projection, WorldPresentation and Expression identities', () => {
  const value = contribution();
  const body = contributionBody(value);
  assert.equal(value.contribution_ref, 'contribution:second-world:1');
  assert.equal(body.basis.source_revision, 'central@7');
  assert.equal(body.basis.projection_revision, 3);
  assert.equal(body.basis.world_presentation_revision, 2);
  assert.equal(body.basis.expression_revision, 5);
  assert.equal(body.attachments[0].ref, 'artifact:reading');
});

test('Contribution-on-Contribution and typed addressing remain ordinary Contribution relations', () => {
  const nested = contribution({ contribution_ref: 'contribution:second-world:2', target: { kind: 'oi.contribution', ref: 'contribution:second-world:1' }, addressing: { version: 'aikit.participant-address/v1', to: [{ kind: 'human', participant: 'participant:owner', address: '@owner' }], mentions: [] } });
  assert.equal(nested.target.kind, 'oi.contribution');
  assert.equal(nested.relation.kind, 'responds_to');
  assert.equal(nested.addressing.to[0].participant, 'participant:owner');
});

test('Return builds the real native owner proposal on the exact contributed basis', () => {
  const returned = nativeReturnSubmission(contribution(), revisions, { project: 'P', document_id: 'doc:p', occurred_at_unix_seconds: 1 });
  assert.equal(returned.action_ref, 'central.receiving.submit');
  assert.equal(returned.input.expected_source_revision, 'central@7');
  assert.equal(returned.input.proposal.shared_field.contribution_ref, 'contribution:second-world:1');
  assert.equal(returned.input.proposal.shared_field.expression_revision, 5);
  assert.match(returned.input.proposal.html, /A returned difference/);
});

test('mismatched refs or stale source, Projection, Expression or presentation revisions refuse before owner invocation', () => {
  for (const [key, value] of [['source_ref', 'central:source:other'], ['source_revision', 'central@8'], ['projection_ref', 'projection:other'], ['projection_revision', 4], ['expression_ref', 'expression:other'], ['expression_revision', 6], ['world_presentation_ref', 'presentation:other'], ['world_presentation_revision', 3]]) {
    const inspection = inspectContributionBasis(contribution(), { ...revisions, [key]: value });
    assert.equal(inspection.returnable, false);
    assert.equal(inspection.stale[0].kind, key);
    assert.throws(() => nativeReturnSubmission(contribution(), { ...revisions, [key]: value }, { document_id: 'doc:p' }), error => error.code === 'stale_contribution_basis');
  }
});

test('Expression material routes to EX1 propose with its exact ref, basis and Changes', () => {
  const value=contribution({body:{kind:'expression-scene',basis,content:{summary:'Add the returned scene',changes:[{change:'scene_create',scene_ref:'expression:doc:scene:returned',title:'Returned'}]},attachments:[]}});
  assert.throws(()=>nativeReturnSubmission(value,revisions,{document_id:'doc:p'}),/native owner Return/);
  const operation=nativeExpressionReturnProposal(value,revisions,{actor:'participant:owner'});
  assert.equal(operation.request.operation,'propose');
  assert.equal(operation.request.expression_ref,basis.expression_ref);
  assert.equal(operation.request.expected_revision,5);
  assert.match(operation.request.proposal_ref,/^expression:doc:proposal:/);
  assert.equal(operation.request.changes[0].change,'scene_create');
});

test('private sentinels do not appear unless the caller explicitly places them in admitted content', () => {
  const sentinel = 'PRIVATE-SENTINEL-NEVER-PROJECT';
  assert.equal(JSON.stringify(contribution()).includes(sentinel), false);
});

test('every supported material form has an explicit shape rather than accepting arbitrary JSON', () => {
  const valid = {
    prose: 'A response',
    'relation-proposal': { relation: { kind: 'supports', ref: 'relation:supports' }, from: { kind: 'claim', ref: 'claim:a' }, to: { kind: 'claim', ref: 'claim:b', revision: 2 }, summary: 'A supports B' },
    'source-proposal': { operation: 'field.append', field_id: 'notes', contribution_id: 'part:notes', html: '<p>A returned note</p>' },
    thing: { thing: { kind: 'artifact', ref: 'artifact:one', revision: 'sha256:1' }, representation: { media_type: 'application/json' } },
    'expression-revision': { summary: 'Move the glyph', changes: [{ change: 'parameter_set', entity_ref: 'expression:doc:entity:one', parameter: 'x', value: 10 }], method_refs: [], evidence_refs: [] },
    'expression-scene': { summary: 'Add a scene', changes: [{ change: 'scene_create', scene_ref: 'expression:doc:scene:return', title: 'Return' }] },
    file: { kind: 'file', ref: 'file:one', revision: 'sha256:1' },
    reference: { kind: 'url', ref: 'https://example.test/source' },
    method: { kind: 'method', ref: 'method:one', revision: 3 },
  };
  for (const [kind, content] of Object.entries(valid)) assert.equal(createContributionBody({ kind, basis, content }).kind, kind);
  for (const kind of Object.keys(valid).filter(kind => kind !== 'prose')) assert.throws(() => createContributionBody({ kind, basis, content: {} }), TypeError, `${kind} rejected an unshaped object`);
  assert.throws(() => createContributionBody({ kind: 'source-proposal', basis, content: { operation: 'field.set', field_id: 'notes', value: 'replacement' } }), /entry\.add, entry\.append, or field\.append/);
  assert.throws(() => createContributionBody({ kind: 'expression-scene', basis: { ...basis, expression_ref: undefined, expression_revision: undefined }, content: valid['expression-scene'] }), /requires an Expression ref/);
});
