// The Expression verso reading (ES2), the bounded live-embedding law (ES2
// anti-recursion), and the SharedField projection governance over a real
// generated-artifact document — all at the language-neutral level
// (node --test, no browser): the verso carries refs only; the embedding
// budget resolves same-expression same-host to a portal; the audience
// projection of an imported artifact document carries governed material
// only, names its omissions exactly, keeps local export private, and always
// carries an explicit fallback for a client without the live renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { versoReading, versoLeaks, versoCarry, EXPRESSION_VERSO_SCHEMA } from '../src/expression/verso.mjs';
import { resolveEmbedding, tryAdmitLive, MAX_LIVE_EMBEDDING_DEPTH, inspectEmbeddings, resetEmbeddings } from '../src/expression/embedding.mjs';
import { projectExpression, hostedExpressionArgs, expressionPublicationLeaks, EXPRESSION_COMPOSITION_SCHEMA, slug } from '../../../shared-field/expression-projection.mjs';

// The artifact importer rides the app's own module pipeline (its engine
// imports are bare package specifiers), loaded once through vite SSR.
const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({ root, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
const { artifactToExpression } = await vite.ssrLoadModule('/src/expression/artifactImport.ts');
const bimba = JSON.parse(readFileSync(new URL('./fixtures/generated-artifacts/bimba-path-proof-fixture.expression.json', import.meta.url), 'utf8'));
test.after(() => vite.close());

const PRIVATE_SENTINELS = [
  'private-journal-entry-7f3a',
  'consent:private-reading',
  'personal:heart-rate-series',
  'agent-session:secret-context',
];
/** Private BODY material — values no reading or ref ever carries. The local
 * verso may name the owner's own source refs (its audience is the owner);
 * bodies are barred everywhere, and the private refs are barred from every
 * outward payload (asserted by the projection governance test). */
const PRIVATE_BODIES = [
  'jotted at 06:12 by lamplight',
  'bpm-series=[71,74,69]',
  'agent-context-window-dump',
];

/** A bimba-artifact document enriched with exactly the private material the
 * not-shared list (wayfinder §13) names — planted so every refusal is
 * observable. */
function privateDocument() {
  const { document } = artifactToExpression('expression:verso-governance', bimba, 'Governance fixture');
  document.provenance.push({ ref: 'personal:heart-rate-series', revision: 'r9', availability: 'available' });
  for (const entity of Object.values(document.entities)) {
    if (!entity.subject) continue;
  }
  const firstRef = Object.keys(document.entities)[0];
  document.entities[firstRef].subject = {
    subject_ref: 'wiki:private-notebook',
    native_owner: 'central',
    presentation_role: 'thing',
    sources: [
      { ref: 'wiki:private-notebook', revision: 'r2', availability: 'available' },
      { ref: 'Control/user/journal/private-journal-entry-7f3a.md', revision: 'r5', availability: 'available' },
      { ref: 'wiki:offline-source', revision: 'r1', availability: 'unavailable' },
    ],
    readings: [{ ref: 'consent:private-reading', revision: 'r1', availability: 'available' }],
    actions: [{ action_ref: 'journal.append', target_ref: 'wiki:private-notebook', authority_requirement: 'owner' }],
  };
  document.relations['relation:binding'] = {
    binding_ref: 'relation:binding',
    relation: { ref: 'wiki:relation:knows', revision: 'r1', availability: 'available' },
    from_entity_ref: firstRef,
    to_entity_ref: Object.keys(document.entities)[1],
    provenance: [{ ref: 'agent-session:secret-context', revision: 'r1', availability: 'available' }],
  };
  document.representations.push({ kind: 'live', representation: { ref: `${document.expression_ref}:live`, revision: '1', availability: 'available' }, provenance: [] });
  return document;
}

test('the verso reading is a refs-only composition over the same identity', () => {
  const document = privateDocument();
  const verso = versoReading(document);
  assert.equal(verso.schema, EXPRESSION_VERSO_SCHEMA);
  assert.equal(verso.expression_ref, document.expression_ref);
  assert.equal(verso.revision, document.revision);
  // Bound subjects appear with sources and disclosed Actions, refs only.
  const subject = verso.subjects.find((row) => row.ref === 'wiki:private-notebook');
  assert.ok(subject, 'the bound subject appears on the verso');
  assert.equal(subject.presentation_role, 'thing');
  assert.deepEqual(subject.sources.map((source) => source.ref).sort(), [
    'Control/user/journal/private-journal-entry-7f3a.md',
    'wiki:offline-source',
    'wiki:private-notebook',
  ]);
  assert.equal(subject.actions[0].action_ref, 'journal.append');
  // Relations and representations name their native refs.
  assert.equal(verso.relations[0].relation.ref, 'wiki:relation:knows');
  assert.deepEqual(verso.representations.map((representation) => representation.kind), ['live']);
  // Refs only — planted private BODIES never appear, and private reading
  // refs (readings are the owner's incoming private material) do not either.
  assert.deepEqual(versoLeaks(verso, PRIVATE_BODIES), [], 'the verso carries no private bodies');
  assert.ok(!JSON.stringify(verso).includes('consent:private-reading'), 'the verso omits the private readings list entirely');
  // The verso is the owner's local reading: their own source ref appears,
  // and that is exactly why the verso is never a projectable object.
  assert.ok(JSON.stringify(verso).includes('private-journal-entry-7f3a'), 'the local verso names the owner’s own source ref (local audience)');
  // A sparse document produces an honest sparse verso.
  const sparse = versoReading({ ...document, entities: {}, scenes: [{ scene_ref: `${document.expression_ref}:scene:1`, revision: 1, title: 'S', entity_refs: [] }], relations: {}, representations: [], provenance: [] });
  assert.deepEqual([sparse.subjects.length, sparse.relations.length, sparse.representations.length, sparse.provenance.length], [0, 0, 0, 0]);
  // The flip carry names exactly the state a return must preserve.
  assert.deepEqual(versoCarry(document), { expression_ref: document.expression_ref, revision: document.revision, selection: document.selection });
});

test('the embedding budget resolves same-expression same-host to a portal', () => {
  resetEmbeddings();
  assert.deepEqual(resolveEmbedding('expression:a'), { mode: 'live' });
  const lease = tryAdmitLive('expression:a');
  assert.equal(lease.admitted, true);
  // Same expression, same host: portal, never a second live body.
  const again = resolveEmbedding('expression:a');
  assert.equal(again.mode, 'portal');
  assert.match(again.reason, /already live on this host/);
  // The depth budget is the host-wide bound: a different expression beyond
  // it also resolves to a portal.
  assert.equal(MAX_LIVE_EMBEDDING_DEPTH, 1);
  const other = resolveEmbedding('expression:b');
  assert.equal(other.mode, 'portal');
  assert.match(other.reason, /depth budget/);
  // Release frees the slot; admission is atomic and idempotent on release.
  lease.release();
  lease.release();
  assert.deepEqual(inspectEmbeddings(), {});
  assert.deepEqual(resolveEmbedding('expression:b'), { mode: 'live' });
  // Non-Expression refs are refused, not coerced.
  assert.throws(() => resolveEmbedding('wiki:a'), /native Expression ref/);
});

test('the audience projection of an artifact document carries governed material only', () => {
  const document = privateDocument();
  const bundle = projectExpression({
    document,
    selection: { disclose_sources: 'available' },
    publisher: { identity_ref: 'human:publisher' },
    audience: { visibility: 'public' },
    projection_ref: 'projection:governance:1',
    presentation_ref: 'presentation:governance:1',
    field_ref: `oi:field:desktop:${slug(document.expression_ref)}`,
  });
  // Exact omissions: private readings, Action disclosures, unavailable and
  // protected sources, renderer-local representations.
  assert.equal(bundle.omissions.readings, 1);
  assert.equal(bundle.omissions.actions, 1);
  const omittedRefs = [
    ...bundle.omissions.sources.protected,
    ...bundle.omissions.sources.unavailable,
    ...bundle.omissions.sources.withheld,
  ].map((source) => source.ref);
  assert.ok(omittedRefs.includes('Control/user/journal/private-journal-entry-7f3a.md'), 'protected ground is named as an omission, never carried');
  assert.ok(omittedRefs.includes('wiki:offline-source'), 'unavailable sources are omitted');
  assert.deepEqual(bundle.omissions.representations.map((representation) => representation.kind), ['live'], 'renderer-local representations never travel');
  assert.ok(bundle.omissions.provenance.some((row) => row.ref === 'agent-session:secret-context'), 'private provenance is omitted');
  assert.ok(bundle.omissions.provenance.some((row) => row.ref === 'personal:heart-rate-series'), 'protected document provenance is omitted');
  // The outward payloads carry none of the planted private material.
  assert.deepEqual(expressionPublicationLeaks(bundle, PRIVATE_SENTINELS), [], 'no planted private sentinel appears in any outward payload');
  // The composition is the governed middle: schema-valid, subject refs and
  // revisions carried, no reading bodies.
  assert.equal(bundle.composition.schema, EXPRESSION_COMPOSITION_SCHEMA);
  const carriedSubject = bundle.composition.entities[firstEntityRef(bundle)].subject;
  assert.equal(carriedSubject.subject_ref, 'wiki:private-notebook');
  assert.deepEqual(carriedSubject.sources.map((source) => source.ref), ['wiki:private-notebook']);
  // Local export is private: the exported document bytes contain the private
  // material and are NOT what any publication payload carries.
  const exportedDocument = JSON.stringify(document);
  for (const sentinel of PRIVATE_SENTINELS) assert.ok(exportedDocument.includes(sentinel), 'the local export remains the private document');
  const outward = JSON.stringify(hostedExpressionArgs(bundle));
  for (const sentinel of PRIVATE_SENTINELS) assert.ok(!outward.includes(sentinel), 'the hosted arguments are the governed projection, not the export');
});

test('a client without the live renderer receives an explicit fallback of the same revision', () => {
  const document = privateDocument();
  const bundle = projectExpression({
    document,
    publisher: { identity_ref: 'human:publisher' },
    audience: { visibility: 'public' },
    projection_ref: 'projection:governance:2',
    presentation_ref: 'presentation:governance:2',
  });
  const frozen = bundle.expression.representations.find((representation) => representation.kind === 'html');
  assert.ok(frozen, 'the publication carries a frozen HTML fallback');
  assert.ok(frozen.html.includes(`data-expression-ref="${document.expression_ref}"`), 'the fallback names the same Expression identity');
  assert.ok(frozen.html.includes(`data-expression-revision="${document.revision}"`), 'the fallback is a reading of the SAME revision');
  assert.ok(bundle.expression.live_renderer_ref, 'live eligibility is disclosed beside the fallback');
  for (const entityRef of Object.keys(bundle.composition.entities)) {
    assert.ok(frozen.html.includes(`data-entity-ref="${entityRef}"`), `the fallback renders entity ${entityRef}`);
  }
});

function firstEntityRef(bundle) {
  return Object.keys(bundle.composition.entities)[0];
}
