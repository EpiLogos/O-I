import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exploreSeedFromPublication,
  hostedPublicationArgs,
  projectCentralWikiWorld,
  publicationSentinelLeaks,
  reprojectCentralWikiWorld,
  sourceStanding,
} from './central-wiki-projection.mjs';
import { renderWorldEdition, worldEditionManifest } from './world-edition.mjs';
import { createExploreSurfaceModel } from './explore-surface.mjs';
import { structuredProjectionReading } from './projection-reading.mjs';

/*
 * Fixture readings mirror the exact envelope Central's `central.wiki.read` and
 * `projectcentral.wiki.read` Actions return (`central.wiki-reading/v1`), with
 * private sentinel material planted where an owner's real world keeps private
 * things: a human-authored identity node, a private journal node, a private
 * project space, and a private path on a node-source relation.
 */
const ROOT = 'world:central:project:O-I/central:wiki:root';
const CHILD = 'world:central:project:O-I/central:wiki:project:O-I';
const NODE = 'world:central:project:O-I/wiki:node:project-root/o-i';
const PRIVATE = ['PRIVATE_SENTINEL_JOURNAL', 'PRIVATE_SENTINEL_LAB', 'private-lab', 'identity.md', 'wiki:node:identity', 'journal'];

function rootReading() {
  return {
    schema: 'central.wiki-reading/v1',
    register: 'root',
    world_ref: 'control:root',
    profile: 'okf-wiki/v1',
    automatic_agent_or_model_invocation: false,
    counts: { edges: 0, nodes: 3, objects: 4, other_objects: 0, spaces: 1 },
    source: { path: 'Control/agents/wiki/wiki.json', ref: 'central:source:control:root:Control/agents/wiki/wiki.json', revision: 'central.content-fnv1a64/v1:1639:root-rev-1' },
    spaces: [{
      ref: 'central:wiki:root', title: 'Central', revision: 39, anchor_ref: 'wiki:node:identity', parent_space_refs: [],
      child_space_refs: ['central:wiki:project:O-I', 'central:wiki:project:PRIVATE_SENTINEL_LAB'],
      node_refs: ['wiki:node:identity', 'wiki:node:staged/propose-not-write', 'wiki:node:PRIVATE_SENTINEL_JOURNAL'],
    }],
    nodes: [
      { ref: 'wiki:node:identity', title: 'User identity', node_type: 'identity', revision: 1, space_refs: ['central:wiki:root'], source_refs: ['Control/user/identity.md'], provenance_source_refs: ['Control/user/identity.md'] },
      { ref: 'wiki:node:staged/propose-not-write', title: 'You may propose', node_type: 'intent', revision: 1, space_refs: ['central:wiki:root'], source_refs: ['staging/propose-not-write'], provenance_source_refs: ['staging/propose-not-write'], ql: { face: 'direct', position: 3, unit: 'documentation' } },
      { ref: 'wiki:node:PRIVATE_SENTINEL_JOURNAL', title: 'PRIVATE_SENTINEL_JOURNAL', node_type: 'journal', revision: 4, space_refs: ['central:wiki:root'], source_refs: ['Control/user/journal/PRIVATE_SENTINEL_JOURNAL.md'] },
    ],
    relations: [
      { from_ref: 'wiki:node:identity', kind: 'node-source', to_ref: 'Control/user/identity.md' },
      { from_ref: 'wiki:node:PRIVATE_SENTINEL_JOURNAL', kind: 'node-source', to_ref: 'Control/user/journal/PRIVATE_SENTINEL_JOURNAL.md' },
      { from_ref: 'wiki:node:identity', kind: 'node-space', to_ref: 'central:wiki:root' },
      { from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:O-I' },
      { from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:PRIVATE_SENTINEL_LAB' },
      { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:identity' },
      { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:staged/propose-not-write' },
      { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:PRIVATE_SENTINEL_JOURNAL' },
    ],
  };
}

function projectReading(revision = 'central.content-fnv1a64/v1:837:o-i-rev-1') {
  return {
    schema: 'central.wiki-reading/v1',
    register: 'project',
    project: 'O-I',
    world_ref: 'project:O-I',
    profile: 'okf-wiki/v1',
    automatic_agent_or_model_invocation: false,
    counts: { edges: 3, nodes: 2, objects: 3, other_objects: 0, spaces: 1 },
    source: { path: 'ProjectCentral/agents/wiki/wiki.json', ref: 'central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json', revision },
    spaces: [{ ref: 'central:wiki:project:O-I', title: 'O-I', revision: 3, anchor_ref: 'wiki:node:project-root/o-i', parent_space_refs: ['central:wiki:root'], child_space_refs: [], node_refs: ['wiki:node:project-root/o-i', 'wiki:node:project-private-lab'] }],
    nodes: [
      { ref: 'wiki:node:project-root/o-i', title: 'O-I', node_type: 'project-root', revision: 1, space_refs: ['central:wiki:project:O-I'], source_refs: ['ProjectCentral/project.json'], provenance_source_refs: ['ProjectCentral/project.json'] },
      { ref: 'wiki:node:project-private-lab', title: 'private-lab notes', node_type: 'note', revision: 2, space_refs: ['central:wiki:project:O-I'], source_refs: ['ProjectCentral/user/private-lab.md'] },
    ],
    relations: [
      { from_ref: 'wiki:node:project-root/o-i', kind: 'node-source', to_ref: 'ProjectCentral/project.json' },
      { from_ref: 'wiki:node:project-root/o-i', kind: 'node-space', to_ref: 'central:wiki:project:O-I' },
      { from_ref: 'central:wiki:project:O-I', kind: 'space-node', to_ref: 'wiki:node:project-root/o-i' },
      { from_ref: 'central:wiki:project:O-I', kind: 'space-node', to_ref: 'wiki:node:project-private-lab' },
    ],
  };
}

function selection(overrides = {}) {
  return {
    schema: 'oi.central-wiki-selection/v1',
    world_ref: 'world:central:project:O-I',
    subject_world_ref: 'project:O-I',
    field_ref: 'oi:field:central:project:O-I',
    projection_ref: 'projection:central:project:O-I',
    presentation_ref: 'presentation:central:project:O-I',
    title: 'O-I — a ProjectCentral world',
    summary: 'The O-I project WikiSpace as its owner chose to present it.',
    audience: { visibility: 'public' },
    publisher: { participant_ref: 'participant:central:owner', identity_ref: 'human:central:owner', chosen_name: 'Owner' },
    spaces: { 'central:wiki:root': 'address', 'central:wiki:project:O-I': 'nodes' },
    node_refs: ['wiki:node:project-root/o-i'],
    disclose_source_refs: true,
    ...overrides,
  };
}

function publish(overrides = {}, readings = [rootReading(), projectReading()]) {
  return projectCentralWikiWorld({ readings, selection: selection(overrides), published_at: '2026-09-14T20:00:00.000Z' });
}

function outwardPayloads(bundle) {
  const html = renderWorldEdition(bundle.projection);
  return {
    bundle,
    projection: bundle.projection,
    hosted_args: hostedPublicationArgs(bundle),
    explore_seed: exploreSeedFromPublication(bundle),
    edition_html: html,
    edition_manifest: worldEditionManifest(bundle.projection, html),
    structured_reading: structuredProjectionReading(bundle.projection),
  };
}

test('root WikiSpace and a real ProjectCentral child WikiSpace are both addressable through one Projection', () => {
  const bundle = publish();
  const refs = new Set(bundle.entries.map((entry) => entry.ref));
  assert.ok(refs.has(ROOT), 'root WikiSpace is addressable, qualified by the publication world');
  assert.ok(refs.has(CHILD), 'child WikiSpace is addressable');
  assert.ok(refs.has(NODE), 'selected real WikiNode is addressable');
  assert.equal(bundle.entries.find((entry) => entry.ref === ROOT).meta.local_ref, 'central:wiki:root');
  assert.ok(bundle.relations.some((relation) => relation.from === ROOT && relation.to === CHILD && relation.relation === 'wiki.contains' && relation.origin === 'wiki'));
  assert.equal(bundle.projection.subject.ref, 'world:central:project:O-I');
  assert.equal(bundle.projection.source.system, 'central');
  assert.equal(bundle.projection.source.revision, 'central.content-fnv1a64/v1:837:o-i-rev-1');
  assert.equal(bundle.register, 'project');
  assert.deepEqual(bundle.excluded, { spaces: 0, nodes: 4, relations: 10 });
});

test('unselected private material is absent from every outward payload, not only the rendered page', () => {
  const bundle = publish();
  const leaks = publicationSentinelLeaks(outwardPayloads(bundle), PRIVATE);
  assert.deepEqual(leaks, []);
  // The projected root space still names only projected children and nodes.
  const rootBinding = bundle.presentation.regions.find((region) => region.region_ref === 'wiki').bindings.find((binding) => binding.subject_ref === ROOT);
  assert.deepEqual(rootBinding.props.refs, [CHILD]);
  const rootEntry = bundle.entries.find((entry) => entry.ref === ROOT);
  assert.match(rootEntry.summary, /addressable only/);
});

test('a selection cannot smuggle a node out of an address-only space or a node absent from the readings', () => {
  assert.throws(() => publish({ node_refs: ['wiki:node:staged/propose-not-write'] }), /not inside a WikiSpace selected with mode "nodes"/);
  assert.throws(() => publish({ node_refs: ['wiki:node:does-not-exist'] }), /not present in any reading/);
  assert.throws(() => publish({ spaces: { 'central:wiki:project:Nope': 'nodes' } }), /not present in any reading/);
});

test('human-authored and Agent-maintained standings stay distinguishable in provenance and entries', () => {
  const bundle = publish({ spaces: { 'central:wiki:root': 'nodes', 'central:wiki:project:O-I': 'nodes' }, node_refs: ['wiki:node:project-root/o-i', 'wiki:node:identity'] });
  const identity = bundle.entries.find((entry) => entry.meta.local_ref === 'wiki:node:identity');
  const projectRoot = bundle.entries.find((entry) => entry.ref === NODE);
  assert.equal(identity.meta.standing, 'human-authored');
  assert.equal(projectRoot.meta.standing, 'agent-maintained');
  assert.ok(identity.provenance.some((entry) => entry.kind === 'human-authored-source' && entry.ref === 'Control/user/identity.md'));
  assert.ok(projectRoot.provenance.some((entry) => entry.kind === 'agent-maintained-source' && entry.ref === 'ProjectCentral/project.json'));
  assert.ok(identity.provenance.every((entry) => entry.kind !== 'agent-maintained-source'));
  assert.equal(sourceStanding('ProjectCentral/user/x.md'), 'human-authored');
  assert.equal(sourceStanding('ProjectCentral/agents/wiki/wiki.json'), 'agent-maintained');
});

test('source paths are withheld unless the selection discloses them', () => {
  const bundle = publish({ disclose_source_refs: false });
  const leaks = publicationSentinelLeaks(outwardPayloads(bundle), ['ProjectCentral/project.json']);
  assert.deepEqual(leaks, []);
});

test('the published material drives the same renderer-neutral Explore Surface used by browser, desktop and agents', () => {
  const bundle = publish();
  const surface = createExploreSurfaceModel(exploreSeedFromPublication(bundle));
  const worlds = surface.worlds();
  assert.equal(worlds.length, 1);
  assert.equal(worlds[0].ref, 'world:central:project:O-I');
  assert.equal(worlds[0].presentation_projection.projection_ref, 'projection:central:project:O-I');
  assert.ok(surface.search('O-I').some((hit) => hit.ref === CHILD));
  assert.ok(surface.search('central:wiki:project:O-I').some((hit) => hit.ref === CHILD), 'the local wiki ref still finds the qualified entry');
  assert.equal(surface.search('PRIVATE').length, 0);
  assert.equal(surface.search('identity').length, 0);
  const opened = surface.open(ROOT, { depth: 2, budget: 12 });
  const neighbours = new Set(opened.relations.edges.flatMap((edge) => [edge.from, edge.to]));
  assert.ok(neighbours.has(CHILD));
  assert.ok(![...neighbours].some((ref) => ref.includes('PRIVATE_SENTINEL_LAB')));
});

test('hosted reducer arguments carry exactly the bundle and keep semantic refs as the index columns', () => {
  const bundle = publish();
  const args = hostedPublicationArgs(bundle);
  assert.equal(args.putProjection.projectionKey, 'projection:central:project:O-I@1');
  assert.equal(args.putProjection.sourceRevision, bundle.projection.source.revision);
  assert.equal(args.putExploreEntries.length, bundle.entries.length);
  assert.equal(args.putExploreRelations.length, bundle.relations.length);
  for (const entry of args.putExploreEntries) assert.equal(JSON.parse(entry.entryJson).ref, entry.semanticRef);
  for (const relation of args.putExploreRelations) assert.equal(JSON.parse(relation.relationJson).relation_ref, relation.relationRef);
});

test('the standalone edition is rendered only from the Projection and its manifest digest identifies bytes, not authority', () => {
  const bundle = publish();
  const html = renderWorldEdition(bundle.projection, { explore_base: 'https://example.test/explore.html' });
  assert.match(html, /<meta name="oi:projection-ref" content="projection:central:project:O-I">/);
  assert.match(html, /href="https:\/\/example\.test\/explore\.html\?ref=world%3Acentral%3Aproject%3AO-I%2Fcentral%3Awiki%3Aproject%3AO-I"/);
  assert.match(html, /id="oi-projection"/);
  const manifest = worldEditionManifest(bundle.projection, html);
  assert.equal(manifest.digest.identifies, 'bytes');
  assert.deepEqual(manifest.digest.is_not, ['authorship', 'permission', 'confidentiality']);
  assert.equal(manifest.digest.value, worldEditionManifest(bundle.projection, html).digest.value);
  assert.notEqual(manifest.digest.value, worldEditionManifest(bundle.projection, `${html}\n`).digest.value);
});

test('re-projection from a moved source is a source revision; from the same source it is a refinement — identity never drifts', () => {
  const first = publish();
  const moved = reprojectCentralWikiWorld(first, { readings: [rootReading(), projectReading('central.content-fnv1a64/v1:900:o-i-rev-2')], selection: selection({ summary: 'Updated summary.' }), published_at: '2026-09-14T21:00:00.000Z' });
  assert.equal(moved.source_moved, true);
  assert.equal(moved.projection.projection_ref, first.projection.projection_ref);
  assert.equal(moved.projection.projection_revision, 2);
  assert.equal(moved.projection.source.revision, 'central.content-fnv1a64/v1:900:o-i-rev-2');
  assert.deepEqual(moved.projection.supersedes, { projection_ref: first.projection.projection_ref, projection_revision: 1, source_revision: first.projection.source.revision });
  assert.equal(moved.presentation.presentation_ref, first.presentation.presentation_ref);

  const refined = reprojectCentralWikiWorld(first, { readings: [rootReading(), projectReading()], selection: selection({ summary: 'Same source, different words.' }), published_at: '2026-09-14T21:00:00.000Z' });
  assert.equal(refined.source_moved, false);
  assert.equal(refined.projection.projection_revision, 2);
  assert.equal(refined.projection.source.revision, first.projection.source.revision);
  assert.ok(refined.projection.provenance.some((entry) => entry.kind === 'human-refinement'));
  assert.deepEqual(publicationSentinelLeaks(outwardPayloads(refined), PRIVATE), []);
});
