import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  curatedArtifactFromFlowInstance, curatedArtifactFromCentralDocument, projectCuratedArtifact, reprojectCuratedArtifact,
  hostedArtifactArgs, renderArtifactEdition, artifactEditionManifest, artifactPublicationPayloads, publicationSentinelLeaks,
  sanitiseEntryHtml, htmlToText, DISCLOSABLE_META,
} from './curated-html-projection.mjs';
import { createExploreApplication } from './explore.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, '..', 'desktop', 'cradle', 'documents', 'ql-dialogue-flow.html'), 'utf8');
const QL_DOC = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;

const SENTINELS = ['PRIVATE_SENTINEL_JOURNAL', 'PRIVATE_SENTINEL_PACKET', 'PRIVATE_SENTINEL_NOTE', 'PRIVATE_SENTINEL_MEDIA', 'PRIVATE_SENTINEL_EXPORTED', 'PRIVATE_SENTINEL_CURRENT', 'PRIVATE_SENTINEL_UNSELECTED', 'onclick', '<script>alert'];

function flowInstance() {
  const doc = JSON.parse(template.match(QL_DOC)[1]);
  doc.meta.documentId = '0000-flow-under-test';
  doc.meta.created = '2026-09-14T20:00:00.000Z';
  doc.meta.title = 'A flow under test';
  doc.meta.revision = 3;
  doc.meta.current = 'PRIVATE_SENTINEL_CURRENT';
  doc.meta.exported = 'PRIVATE_SENTINEL_EXPORTED';
  doc.entries = [
    { id: 'e1', author: 'F', at: '2026-09-14T20:00:00.000Z', html: '<p>First <em>selected</em> entry &amp; more.</p>', replyTo: null, touched: false },
    { id: 'e2', author: 'H', at: '2026-09-14T20:01:00.000Z', html: '<p>Second selected entry <a href="https://example.org/x" onclick="steal()">link</a><script>alert(1)</script></p>', replyTo: { entryId: 'e1', anchor: null }, touched: false },
    { id: 'e3', author: 'F', at: '2026-09-14T20:02:00.000Z', html: '<p>PRIVATE_SENTINEL_UNSELECTED — an entry the owner did not select.</p>', replyTo: null, touched: false },
  ];
  doc.journal = [{ id: 'j1', at: '2026-09-14T20:03:00.000Z', html: '<p>PRIVATE_SENTINEL_JOURNAL</p>' }];
  doc.packet = [{ id: 'p1', at: '2026-09-14T20:03:00.000Z', html: '<p>PRIVATE_SENTINEL_PACKET</p>' }];
  doc.notes = [{ id: 'n1', at: '2026-09-14T20:03:00.000Z', html: '<p>PRIVATE_SENTINEL_NOTE</p>' }];
  doc.media = [{ id: 'm1', at: '2026-09-14T20:03:00.000Z', name: 'PRIVATE_SENTINEL_MEDIA.png' }];
  const json = JSON.stringify(doc).replace(/<\/script/gi, '<\\/script');
  return template.replace(QL_DOC, () => `<script type="application/json" id="ql-doc">${json}</script>`);
}

const source = { ref: 'central:path:/home/test/Central:Control/user/flows/flow-test.html', path: 'Control/user/flows/flow-test.html', revision: 'central.content-fnv1a64/v1:1:aaaa' };
const selection = {
  schema: 'oi.curated-artifact-selection/v1',
  artifact_ref: 'artifact:central:flow:0000-flow-under-test',
  world_ref: 'world:central:project:O-I',
  field_ref: 'oi:field:central:project:O-I',
  projection_ref: 'projection:central:artifact:flow-under-test',
  presentation_ref: 'presentation:central:artifact:flow-under-test',
  summary: 'Two entries selected for the shared field.',
  audience: { visibility: 'public' },
  publisher: { participant_ref: 'participant:central:owner', identity_ref: 'human:central:owner', chosen_name: 'Owner' },
  entry_ids: ['e1', 'e2'],
  relate_to_node: { node_ref: 'wiki:node:project-root/o-i' },
  disclose_source_refs: true,
};
const wikiReading = { schema: 'central.wiki-reading/v1', source: { ref: 'central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json', revision: 'central.content-fnv1a64/v1:837:rev' }, nodes: [{ ref: 'wiki:node:project-root/o-i', source_refs: ['ProjectCentral/project.json'] }] };

test('the ql-doc carrier is read into a normalised artifact with its private collections counted, not copied into the reading', () => {
  const artifact = curatedArtifactFromFlowInstance(flowInstance(), source);
  assert.equal(artifact.carrier, 'ql-doc');
  assert.equal(artifact.document_id, '0000-flow-under-test');
  assert.deepEqual(artifact.entries.map((entry) => entry.id), ['e1', 'e2', 'e3']);
  assert.deepEqual({ journal: artifact.withheld.journal, packet: artifact.withheld.packet, notes: artifact.withheld.notes, media: artifact.withheld.media }, { journal: 1, packet: 1, notes: 1, media: 1 });
  assert.ok(artifact.withheld.meta_fields.includes('current') && artifact.withheld.meta_fields.includes('exported'));
  assert.throws(() => curatedArtifactFromFlowInstance('<html></html>', source), /not a Flow instance/);
});

test('the sanitiser keeps authored structure, drops scripts and handlers, and unsafe hrefs', () => {
  assert.equal(sanitiseEntryHtml('<p>a <em>b</em> <a href="https://x.y/z" onclick="steal()">l</a><script>alert(1)</script></p>'), '<p>a <em>b</em> <a href="https://x.y/z" rel="noopener noreferrer">l</a></p>');
  assert.equal(sanitiseEntryHtml('<a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><div style="x">y</div>'), '<a>x</a>y');
  assert.equal(htmlToText('<p>one</p><p>two<br>three</p>'), 'one\n\ntwo\nthree');
});

test('projection carries only the selected entries; every sentinel is absent from every outward payload and from the Explore index', () => {
  const artifact = curatedArtifactFromFlowInstance(flowInstance(), source);
  const bundle = projectCuratedArtifact({ artifact, selection, wiki_reading: wikiReading, published_at: '2026-09-14T21:00:00.000Z', edition_base: 'http://host/projections/flow' });
  assert.equal(bundle.hosted_ref, 'world:central:project:O-I/artifact:central:flow:0000-flow-under-test');
  assert.deepEqual(bundle.selected.entries, ['e1', 'e2']);
  assert.equal(bundle.withheld.entries, 1);
  assert.deepEqual(bundle.selected.meta_fields, ['title', 'created', 'template', 'revision']);
  const entriesRegion = bundle.presentation.regions.find((region) => region.region_ref === 'entries');
  assert.equal(entriesRegion.bindings.length, 2);
  assert.equal(entriesRegion.bindings[1].props.html, '<p>Second selected entry <a href="https://example.org/x" rel="noopener noreferrer">link</a></p>');
  assert.equal(entriesRegion.bindings[1].props.reply_to, `${bundle.hosted_ref}#e1`);
  assert.equal(bundle.projection.subject.kind, 'curated-artifact');
  assert.equal(bundle.projection.source.revision, source.revision);
  // The node relation is declared (the wiki reading does not list the flow as the node's source), never fabricated as attested.
  assert.equal(bundle.node_relation.attested, false);
  assert.equal(bundle.relations.find((relation) => relation.relation === 'node-source').origin, 'projection');
  assert.equal(bundle.entries.length, 1, 'the artifact is one Explore entry; it is not a wiki page');
  assert.equal(bundle.entries[0].kind, 'curated-artifact');
  assert.ok(bundle.entries[0].locators.some((locator) => locator.surface === 'edition'));

  const payloads = artifactPublicationPayloads(bundle, { explore_base: 'http://host/explore.html' });
  assert.deepEqual(publicationSentinelLeaks(payloads, SENTINELS), []);
  // The edition is rebuilt: no ql-doc block, no source bytes, a script-forbidding CSP, the Projection embedded.
  assert.ok(!payloads.html.includes('id="ql-doc"'));
  assert.ok(!payloads.html.includes('ql-template'));
  assert.match(payloads.html, /Content-Security-Policy" content="default-src 'none'/);
  assert.match(payloads.html, /<script type="application\/json" id="oi-projection">/);
  assert.equal((payloads.html.match(/<script/g) ?? []).length, 1, 'the only script element is the embedded JSON');
  assert.ok(payloads.html.includes('First <em>selected</em> entry &amp; more.'));
  assert.equal(payloads.manifest.rebuilt, true);
  assert.equal(payloads.manifest.digest.identifies, 'bytes');
  // Explore index: search finds the artifact; nothing withheld is resolvable.
  const application = createExploreApplication({ entries: bundle.entries, relations: [] });
  assert.ok(application.search('flow under test', { limit: 5 }).some((hit) => hit.ref === bundle.hosted_ref));
  assert.equal(JSON.stringify(application.search('PRIVATE_SENTINEL', { limit: 5 })).includes('PRIVATE_SENTINEL'), false);
});

test('a withheld collection enters only by explicit selection and then leaks its sentinel by design', () => {
  const artifact = curatedArtifactFromFlowInstance(flowInstance(), source);
  const bundle = projectCuratedArtifact({ artifact, selection: { ...selection, include: { journal: true } }, published_at: '2026-09-14T21:00:00.000Z' });
  assert.deepEqual(bundle.selected.included, ['journal']);
  const leaks = publicationSentinelLeaks(artifactPublicationPayloads(bundle), ['PRIVATE_SENTINEL_JOURNAL', 'PRIVATE_SENTINEL_PACKET']);
  assert.ok(leaks.every((leak) => leak.endsWith('PRIVATE_SENTINEL_JOURNAL')) && leaks.length > 0, 'the explicitly included journal is present');
  assert.ok(!leaks.some((leak) => leak.endsWith('PRIVATE_SENTINEL_PACKET')), 'the packet stays withheld');
  assert.throws(() => projectCuratedArtifact({ artifact, selection: { ...selection, meta_fields: ['current'] } }), /may not disclose/);
  assert.throws(() => projectCuratedArtifact({ artifact, selection: { ...selection, entry_ids: ['nope'] } }), /not in the artifact/);
  assert.throws(() => projectCuratedArtifact({ artifact, selection: { ...selection, include: { operations: true } } }), /not a withholdable/);
  assert.deepEqual([...DISCLOSABLE_META], ['document_id', 'title', 'created', 'template', 'revision']);
});

test('the wiki reading attests the node-source relation when the node lists the artifact as its source', () => {
  const artifact = curatedArtifactFromFlowInstance(flowInstance(), source);
  const attesting = { ...wikiReading, nodes: [{ ref: 'wiki:node:project-root/o-i', source_refs: ['ProjectCentral/project.json', source.path] }] };
  const bundle = projectCuratedArtifact({ artifact, selection, wiki_reading: attesting });
  assert.equal(bundle.node_relation.attested, true);
  const relation = bundle.relations.find((candidate) => candidate.relation === 'node-source');
  assert.equal(relation.origin, 'wiki');
  assert.equal(relation.provenance[0].revision, wikiReading.source.revision);
});

test('hosted args mirror the bundle; re-projection keeps lineage and distinguishes source drift from refinement', () => {
  const artifact = curatedArtifactFromFlowInstance(flowInstance(), source);
  const bundle = projectCuratedArtifact({ artifact, selection, published_at: '2026-09-14T21:00:00.000Z' });
  const args = hostedArtifactArgs(bundle);
  assert.equal(args.putProjection.projectionKey, 'projection:central:artifact:flow-under-test@1');
  assert.equal(args.putExploreEntries[0].semanticRef, bundle.hosted_ref);
  assert.equal(args.putExploreRelations.length, 2);
  const refined = reprojectCuratedArtifact(bundle, { artifact, selection: { ...selection, entry_ids: ['e1'] }, published_at: '2026-09-14T21:05:00.000Z' });
  assert.equal(refined.projection.projection_revision, 2);
  assert.equal(refined.source_moved, false);
  assert.equal(refined.projection.source.revision, source.revision);
  const moved = curatedArtifactFromFlowInstance(flowInstance(), { ...source, revision: 'central.content-fnv1a64/v1:2:bbbb' });
  const revised = reprojectCuratedArtifact(refined, { artifact: moved, selection, published_at: '2026-09-14T21:10:00.000Z' });
  assert.equal(revised.projection.projection_revision, 3);
  assert.equal(revised.source_moved, true);
  assert.equal(revised.projection.source.revision, 'central.content-fnv1a64/v1:2:bbbb');
  assert.equal(revised.projection.supersedes.projection_revision, 2);
  const html = renderArtifactEdition(revised.projection);
  assert.equal(artifactEditionManifest(revised.projection, html).projection_revision, 3);
});

test('a Central document is read through the same artifact shape: fields become entries, contributions and operations are withheld', () => {
  const reading = {
    schema: 'central.document-reading/v1', source: { ref: 'central:source:control:root:Control/agents/now/flows/abc.json', path: 'Control/agents/now/flows/abc.json' }, revision: { revision: 'central.content-fnv1a64/v1:9:cccc' }, document_id: 'doc:x',
    document: { document_id: 'doc:x', kind: 'flow', title: 'Native document', fields: [{ id: 'purpose', label: 'Purpose', template_pointer: '/purpose' }], template_payload: { purpose: 'why it exists', PRIVATE_SENTINEL_UNSELECTED: 'not pointed at' }, entries: [{ id: 'entry:1', html: '<p>an entry</p>', actor_kind: 'human', occurred_at_unix_seconds: 42 }], contributions: [{ id: 'c1', html: 'PRIVATE_SENTINEL_JOURNAL' }], operations: [{ op: 'PRIVATE_SENTINEL_PACKET' }] },
  };
  const artifact = curatedArtifactFromCentralDocument(reading);
  assert.equal(artifact.carrier, 'central.document');
  assert.deepEqual(artifact.entries.map((entry) => entry.id), ['field:purpose', 'entry:1']);
  assert.deepEqual({ contributions: artifact.withheld.contributions, operations: artifact.withheld.operations }, { contributions: 1, operations: 1 });
  const bundle = projectCuratedArtifact({ artifact, selection: { ...selection, artifact_ref: 'artifact:central:document:doc:x', entry_ids: ['field:purpose', 'entry:1'] }, published_at: '2026-09-14T21:00:00.000Z' });
  assert.deepEqual(publicationSentinelLeaks(artifactPublicationPayloads(bundle), SENTINELS), []);
  assert.ok(renderArtifactEdition(bundle.projection).includes('why it exists'));
});
