import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReferentPreference,
  createReferentExploreApplication,
  createSimilarityCandidate,
  representationDigestEvidence,
} from './referent.mjs';

const prov = ref => [{ kind: 'fixture', ref, source_system: 'fixture', revision: `${ref}@1` }];

function projection({ ref, publisher, bytes, kind = 'application/pdf', subject = `${ref}:source`, revision = 1, sourceRevision = `r${revision}`, audience = { visibility: 'public', refs: [] } }) {
  return {
    schema: 'oi.projection/v1',
    projection_ref: ref,
    projection_revision: revision,
    state: 'published',
    subject: { ref: subject, kind: 'artifact' },
    source: { system: publisher, revision: sourceRevision },
    publisher_participant_ref: publisher,
    published_at: `2026-08-17T10:0${Math.min(revision, 9)}:00.000Z`,
    audience,
    representation: { kind, payload: { bytes_base64: Buffer.from(bytes).toString('base64') } },
    provenance: prov(ref),
  };
}

function entry({ ref, label = ref, world = `world:${ref}`, kind = 'projection', meta = undefined }) {
  return {
    schema: 'oi.explore-entry/v1',
    ref,
    kind,
    world_ref: world,
    label,
    aliases: [],
    provenance: prov(ref),
    locators: [],
    ...(kind === 'projection' ? { projection_ref: ref } : {}),
    ...(meta ? { meta } : {}),
  };
}

function contribution({ ref, contributor = 'participant:mediator', target, relation, mode = 'statement' }) {
  return {
    schema: 'oi.contribution/v1',
    contribution_ref: ref,
    field_ref: 'field:test',
    contributor_participant_ref: contributor,
    created_at: '2026-08-17T11:00:00.000Z',
    mode,
    target,
    relation,
    representation: { kind: 'json', payload: { note: ref } },
    provenance: prov(ref),
  };
}

function indexedContribution(c) {
  return entry({ ref: c.contribution_ref, label: c.contribution_ref, kind: 'contribution', world: 'world:claims' });
}

test('byte-identical independent projections become one referent without ownership collapse', () => {
  const bytes = Buffer.from('%PDF exact fixture');
  const a = projection({ ref: 'projection:A', publisher: 'participant:A', bytes });
  const b = projection({ ref: 'projection:B', publisher: 'participant:B', bytes });
  const app = createReferentExploreApplication({ entries: [entry({ ref: a.projection_ref }), entry({ ref: b.projection_ref })], projections: [a, b] });
  const refA = app.referentFor('projection:A');
  assert.ok(refA.startsWith('oi:referent:exact:'));
  assert.equal(refA, app.referentFor('projection:B'));
  const reading = app.open(refA);
  assert.equal(reading.counts.visible_projected_holdings, 2);
  assert.deepEqual(new Set(reading.projections.map(p => p.publisher_participant_ref)), new Set(['participant:A', 'participant:B']));
  assert.deepEqual(new Set(reading.projections.map(p => p.source.system)), new Set(['participant:A', 'participant:B']));
  assert.equal(reading.bindings.every(binding => binding.relation_kind === 'same-representation'), true);
});

test('same HTML/PDF resource requires attributable accepted reconciliation and keeps both forms', () => {
  const pdf = projection({ ref: 'projection:pdf', publisher: 'participant:A', bytes: Buffer.from('pdf'), kind: 'application/pdf' });
  const html = projection({ ref: 'projection:html', publisher: 'participant:B', bytes: Buffer.from('<h1>same work</h1>'), kind: 'text/html' });
  const claim = contribution({
    ref: 'contribution:claim-html-pdf',
    target: { ref: pdf.projection_ref, kind: 'projection' },
    relation: { kind: 'claims-same-referent', with: { ref: html.projection_ref, kind: 'projection' }, relation_kind: 'same-resource' },
  });
  const decision = contribution({
    ref: 'contribution:accept-html-pdf',
    contributor: 'participant:steward',
    mode: 'decision',
    target: { ref: claim.contribution_ref, kind: 'oi.contribution' },
    relation: { kind: 'accepts-same-referent' },
  });
  const entries = [entry({ ref: pdf.projection_ref, label: 'Resource PDF' }), entry({ ref: html.projection_ref, label: 'Resource HTML' }), indexedContribution(claim), indexedContribution(decision)];
  const app = createReferentExploreApplication({ entries, projections: [pdf, html], contributions: [claim, decision], mediation_participant_refs: ['participant:steward'] });
  assert.equal(app.referentFor(pdf.projection_ref), app.referentFor(html.projection_ref));
  const reading = app.open(app.referentFor(pdf.projection_ref));
  assert.equal(reading.counts.visible_representation_forms, 2);
  assert.equal(reading.bindings.some(binding => binding.relation_kind === 'same-resource'), true);
  assert.equal(reading.contributions.length, 2);
});

test('version, variant, translation and derived relations remain explicit and inspectable', () => {
  const base = projection({ ref: 'projection:base', publisher: 'participant:A', bytes: Buffer.from('edition-one') });
  const forms = [
    ['projection:v2', 'version-of', 'edition-two'],
    ['projection:variant', 'variant-form-of', 'variant'],
    ['projection:translation', 'translation-of', 'translation'],
    ['projection:derived', 'derived-from', 'derived'],
  ].map(([ref, relationKind, content]) => ({ value: projection({ ref, publisher: 'participant:B', bytes: Buffer.from(content) }), relationKind }));
  const entries = [entry({ ref: base.projection_ref, label: 'Base' }), ...forms.map(({ value }) => entry({ ref: value.projection_ref, label: value.projection_ref }))];
  const contributions = [];
  for (const [index, { value, relationKind }] of forms.entries()) {
    const claim = contribution({
      ref: `contribution:claim:${index}`,
      target: { ref: value.projection_ref, kind: 'projection' },
      relation: { kind: 'claims-same-referent', with: { ref: base.projection_ref, kind: 'projection' }, relation_kind: relationKind },
    });
    const decision = contribution({
      ref: `contribution:accept:${index}`,
      mode: 'decision',
      target: { ref: claim.contribution_ref, kind: 'oi.contribution' },
      relation: { kind: 'accepts-same-referent', referent_ref: 'oi:referent:work:stable' },
    });
    contributions.push(claim, decision);
    entries.push(indexedContribution(claim), indexedContribution(decision));
  }
  const app = createReferentExploreApplication({ entries, projections: [base, ...forms.map(f => f.value)], contributions, mediation_participant_refs: ['participant:mediator'] });
  const reading = app.open('oi:referent:work:stable');
  assert.equal(reading.projections.length, 5);
  assert.deepEqual(new Set(reading.versions.map(v => v.relation)), new Set(['version-of', 'variant-form-of', 'translation-of', 'derived-from']));
});

test('highly similar but distinct material does not auto-merge; weak similarity is proposal-only', () => {
  const a = projection({ ref: 'projection:similar-a', publisher: 'participant:A', bytes: Buffer.from('A paper about quaternal systems version 1') });
  const b = projection({ ref: 'projection:similar-b', publisher: 'participant:B', bytes: Buffer.from('A paper about quaternal systems version 2') });
  const candidate = createSimilarityCandidate({
    left: { ref: a.projection_ref, kind: 'projection' },
    right: { ref: b.projection_ref, kind: 'projection' },
    evidence: [{ kind: 'semantic-similarity', provider: 'fixture-embedding', observation: '0.999 cosine' }],
  });
  const app = createReferentExploreApplication({ entries: [entry({ ref: a.projection_ref }), entry({ ref: b.projection_ref })], projections: [a, b], candidates: [candidate] });
  assert.notEqual(app.referentFor(a.projection_ref), app.referentFor(b.projection_ref));
  assert.equal(app.candidates()[0].automatic_binding_eligible, false);
  assert.equal(app.candidates()[0].state, 'proposed');
});

test('an indexed attacker-authored acceptance is not receiving-side reconciliation authority', () => {
  const a = projection({ ref: 'projection:authority-a', publisher: 'participant:A', bytes: Buffer.from('authority A') });
  const b = projection({ ref: 'projection:authority-b', publisher: 'participant:B', bytes: Buffer.from('authority B') });
  const claim = contribution({
    ref: 'contribution:authority-claim', contributor: 'participant:attacker',
    target: { ref: a.projection_ref, kind: 'projection' },
    relation: { kind: 'claims-same-referent', with: { ref: b.projection_ref, kind: 'projection' }, relation_kind: 'same-resource' },
  });
  const attackerDecision = contribution({
    ref: 'contribution:authority-decision', contributor: 'participant:attacker', mode: 'decision',
    target: { ref: claim.contribution_ref, kind: 'oi.contribution' }, relation: { kind: 'accepts-same-referent' },
  });
  const app = createReferentExploreApplication({
    entries: [entry({ ref: a.projection_ref }), entry({ ref: b.projection_ref }), indexedContribution(claim), indexedContribution(attackerDecision)],
    projections: [a, b], contributions: [claim, attackerDecision], mediation_participant_refs: ['participant:steward'],
  });
  assert.notEqual(app.referentFor(a.projection_ref), app.referentFor(b.projection_ref));
  const candidate = app.candidates().find(value => value.claim_ref === claim.contribution_ref);
  assert.equal(candidate.state, 'proposed');
  assert.deepEqual(candidate.unauthorised_decision_refs, [attackerDecision.contribution_ref]);
});

test('malicious same-referent assertion is not authority and a dispute prevents accepted binding', () => {
  const a = projection({ ref: 'projection:false-a', publisher: 'participant:A', bytes: Buffer.from('actually A') });
  const b = projection({ ref: 'projection:false-b', publisher: 'participant:B', bytes: Buffer.from('actually B') });
  const claim = contribution({
    ref: 'contribution:false-claim', contributor: 'participant:attacker',
    target: { ref: a.projection_ref, kind: 'projection' },
    relation: { kind: 'claims-same-referent', with: { ref: b.projection_ref, kind: 'projection' }, relation_kind: 'same-resource' },
  });
  const accept = contribution({
    ref: 'contribution:false-accept', contributor: 'participant:mediator', mode: 'decision',
    target: { ref: claim.contribution_ref, kind: 'oi.contribution' }, relation: { kind: 'accepts-same-referent' },
  });
  const dispute = contribution({
    ref: 'contribution:false-dispute', contributor: 'participant:reviewer', mode: 'challenge',
    target: { ref: claim.contribution_ref, kind: 'oi.contribution' }, relation: { kind: 'disputes-same-referent' },
  });
  const attackerDecision = contribution({
    ref: 'contribution:false-attacker-decision', contributor: 'participant:attacker', mode: 'decision',
    target: { ref: claim.contribution_ref, kind: 'oi.contribution' }, relation: { kind: 'accepts-same-referent' },
  });
  const entries = [entry({ ref: a.projection_ref }), entry({ ref: b.projection_ref }), indexedContribution(claim), indexedContribution(accept), indexedContribution(dispute), indexedContribution(attackerDecision)];
  const app = createReferentExploreApplication({ entries, projections: [a, b], contributions: [claim, accept, dispute, attackerDecision], mediation_participant_refs: ['participant:mediator'] });
  assert.notEqual(app.referentFor(a.projection_ref), app.referentFor(b.projection_ref));
  assert.equal(app.candidates().find(c => c.claim_ref === claim.contribution_ref).state, 'disputed');
});

test('Phase-2 gate excludes visible-but-unindexed projections and admitted-but-unindexed reconciliation claims', () => {
  const bytes = Buffer.from('same');
  const indexed = projection({ ref: 'projection:indexed', publisher: 'participant:A', bytes });
  const notIndexed = projection({ ref: 'projection:not-indexed', publisher: 'participant:B', bytes });
  const claim = contribution({
    ref: 'contribution:unindexed-claim',
    target: { ref: indexed.projection_ref, kind: 'projection' },
    relation: { kind: 'claims-same-referent', with: { ref: 'object:other', kind: 'object' }, relation_kind: 'same-resource' },
  });
  const app = createReferentExploreApplication({
    entries: [entry({ ref: indexed.projection_ref }), entry({ ref: 'object:other', kind: 'object' })],
    projections: [indexed, notIndexed],
    contributions: [claim],
  });
  assert.ok(app.referentFor(indexed.projection_ref));
  assert.equal(app.referentFor(notIndexed.projection_ref), undefined);
  assert.equal(app.candidates().length, 0);
});

test('privacy oracle: caller-specific horizons never expose hidden exact duplicates or hidden counts', () => {
  const bytes = Buffer.from('private exact representation');
  const pub = projection({ ref: 'projection:public', publisher: 'participant:public', bytes });
  const privB = projection({ ref: 'projection:private-b', publisher: 'participant:B', bytes, audience: { visibility: 'private', refs: ['participant:B'] } });
  const privC = projection({ ref: 'projection:private-c', publisher: 'participant:C', bytes, audience: { visibility: 'private', refs: ['participant:C'] } });

  const publicCaller = createReferentExploreApplication({ entries: [entry({ ref: pub.projection_ref })], projections: [pub] });
  const bCaller = createReferentExploreApplication({ entries: [entry({ ref: pub.projection_ref }), entry({ ref: privB.projection_ref })], projections: [pub, privB] });
  const cCaller = createReferentExploreApplication({ entries: [entry({ ref: pub.projection_ref }), entry({ ref: privC.projection_ref })], projections: [pub, privC] });

  const publicRef = publicCaller.referentFor(pub.projection_ref);
  assert.equal(publicRef, bCaller.referentFor(pub.projection_ref));
  assert.equal(publicRef, cCaller.referentFor(pub.projection_ref));
  assert.equal(publicCaller.open(publicRef).counts.visible_projected_holdings, 1);
  assert.equal(bCaller.open(publicRef).counts.visible_projected_holdings, 2);
  assert.equal(cCaller.open(publicRef).counts.visible_projected_holdings, 2);
  assert.equal(JSON.stringify(publicCaller.open(publicRef)).includes('private-b'), false);
  assert.equal(JSON.stringify(publicCaller.open(publicRef)).includes('private-c'), false);
  assert.equal(publicCaller.open(publicRef).privacy.hidden_member_count, 'not-computed');

  const bOnly = createReferentExploreApplication({ entries: [entry({ ref: privB.projection_ref })], projections: [privB] });
  const cOnly = createReferentExploreApplication({ entries: [entry({ ref: privC.projection_ref })], projections: [privC] });
  const stranger = createReferentExploreApplication({ entries: [], projections: [] });
  const hiddenRef = bOnly.referentFor(privB.projection_ref);
  assert.equal(hiddenRef, cOnly.referentFor(privC.projection_ref));
  assert.equal(bOnly.open(hiddenRef).counts.visible_projected_holdings, 1);
  assert.equal(cOnly.open(hiddenRef).counts.visible_projected_holdings, 1);
  assert.equal(stranger.open(hiddenRef), undefined);
  assert.deepEqual(stranger.search('private'), []);
});

test('withdrawal removes one visible form while remaining form and referent survive', () => {
  const bytes = Buffer.from('withdrawal fixture');
  const a = projection({ ref: 'projection:withdraw-a', publisher: 'participant:A', bytes });
  const b = projection({ ref: 'projection:withdraw-b', publisher: 'participant:B', bytes });
  const before = createReferentExploreApplication({ entries: [entry({ ref: a.projection_ref }), entry({ ref: b.projection_ref })], projections: [a, b] });
  const referentRef = before.referentFor(a.projection_ref);
  const withdrawn = { ...a, projection_revision: 2, state: 'withdrawn', published_at: '2026-08-17T12:00:00.000Z', representation: { kind: 'oi.withdrawal/v1', payload: { text: 'withdrawn' } } };
  const after = createReferentExploreApplication({ entries: [entry({ ref: b.projection_ref })], projections: [withdrawn, b] });
  assert.equal(after.referentFor(b.projection_ref), referentRef);
  assert.equal(after.open(referentRef).counts.visible_projected_holdings, 1);
  assert.equal(JSON.stringify(after.open(referentRef)).includes(a.projection_ref), false);
});

test('ten exact duplicate holdings produce one search result and no authority/ranking boost', () => {
  const bytes = Buffer.from('spam duplicate');
  const projections = Array.from({ length: 10 }, (_, index) => projection({ ref: `projection:spam:${index}`, publisher: `participant:${index}`, bytes }));
  const entries = projections.map((value, index) => entry({ ref: value.projection_ref, label: index === 0 ? 'Spam Copy' : `Spam Copy ${index}`, world: `world:${index % 3}` }));
  const app = createReferentExploreApplication({ entries, projections });
  const results = app.search('Spam Copy', { limit: 20 });
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, 'common-referent');
  assert.equal(results[0].counts.visible_projected_holdings, 10);
  assert.equal(results[0].counts.visible_worlds, 3);
  assert.equal(results[0].ranking.duplicate_count_boost, false);
  assert.equal(results[0].ranking.holder_count_authority, false);
});

test('rebuild is stable because referent and binding identity derive from authoritative visible evidence', () => {
  const p = projection({ ref: 'projection:rebuild', publisher: 'participant:A', bytes: Buffer.from('rebuild me') });
  const seed = { entries: [entry({ ref: p.projection_ref })], projections: [p] };
  const first = createReferentExploreApplication(seed);
  const second = createReferentExploreApplication(JSON.parse(JSON.stringify(seed)));
  assert.equal(first.referentFor(p.projection_ref), second.referentFor(p.projection_ref));
  assert.deepEqual(first.bindings(), second.bindings());
});

test('personal preference changes only presentation order and exact-form selection, never common identity or trust', () => {
  const bytes = Buffer.from('preference fixture');
  const a = projection({ ref: 'projection:pref-a', publisher: 'participant:A', bytes, kind: 'application/pdf' });
  const b = projection({ ref: 'projection:pref-b', publisher: 'participant:B', bytes, kind: 'application/pdf' });
  const app = createReferentExploreApplication({
    entries: [entry({ ref: a.projection_ref, meta: { holding: 'local' } }), entry({ ref: b.projection_ref })],
    projections: [a, b],
  });
  const ref = app.referentFor(a.projection_ref);
  const original = app.open(ref);
  const preferred = applyReferentPreference(original, { publisher_participant_ref: 'participant:B' });
  assert.equal(preferred.common.referent_ref, original.common.referent_ref);
  assert.equal(preferred.projections[0].publisher_participant_ref, 'participant:B');
  assert.deepEqual(preferred.curation.non_implications, ['trust', 'authority', 'semantic-truth', 'ownership-transfer']);
});

test('AIKit-style one-referent resolution selects one concrete form rather than loading all duplicates', () => {
  const bytes = Buffer.from('context pack');
  const a = projection({ ref: 'projection:context-a', publisher: 'participant:A', bytes });
  const b = projection({ ref: 'projection:context-b', publisher: 'participant:B', bytes });
  const app = createReferentExploreApplication({ entries: [entry({ ref: a.projection_ref }), entry({ ref: b.projection_ref })], projections: [a, b] });
  const resolved = app.resolveConcreteSource({ referent_ref: app.referentFor(a.projection_ref), constraints: { publisher_participant_ref: 'participant:B' }, load: true });
  assert.equal(resolved.selected.projection_ref, b.projection_ref);
  assert.equal(resolved.alternatives.length, 1);
  assert.equal(resolved.load, 'selected-only');
  assert.deepEqual(resolved.non_identity, ['WikiNode', 'Source', 'KnowledgeRoute', 'Projection']);
});

test('representation digest ignores caller-supplied digest fields and arbitrary JSON canonicalisation', () => {
  assert.equal(representationDigestEvidence({ kind: 'json', digest: 'attacker', payload: { title: 'not bytes' } }), undefined);
  const evidence = representationDigestEvidence({ kind: 'text/plain', digest: 'attacker', payload: { text: 'actual', encoding: 'utf-8' } });
  assert.equal(evidence.value, 'e5c6fde86910ded72db5cc7afc32f850440d4ef7caa5dbb69f5bdc0d3e39cb3b');
});
