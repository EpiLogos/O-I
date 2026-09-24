import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exploreSeedFromPublication,
  hostedPublicationArgs,
  projectCentralWikiWorld,
  publicationSentinelLeaks,
  reprojectCentralWikiWorld,
  sourceStanding,
  worldProtectedSentinels,
  worldPublicationLeaks,
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

/*
 * The inhabited World through the same bundle. Fixtures mirror the owners'
 * own `--json` output: `ctrl --json action run central.position.list`
 * (`central.position-listing/v1` in ctrl's envelope), `aikit gateway who
 * --json` (`aikit.population-reading/v1` in AIKit's envelope, with the
 * remote-Workcell fields AIKit is adding) and `aikit wiki-construct inspect
 * --json` (`aikit.constellation/v1` in AIKit's `{state: "read", file,
 * reading}` result). Private inhabitation material is planted wherever an
 * owner keeps it.
 */
const ANIMA = 'central:position:project:O-I:anima-4';
const ALETHEIA = 'central:position:project:O-I:aletheia-5';
const OFFICE = 'central:position:project:O-I:private-sentinel-office';
const FRAME = 'wiki:frame:inquiry-o-i';
const HOSTED = (ref) => `world:central:project:O-I/${ref}`;
const INHABITATION_PRIVATE = [
  'PRIVATE_SENTINEL_SESSION', 'PRIVATE_SENTINEL_SPACE', 'PRIVATE_SENTINEL_GATEWAY', 'PRIVATE_SENTINEL_ATTENTION', 'PRIVATE_SENTINEL_OFFICE',
  'PRIVATE_SENTINEL_REMOTE', 'PRIVATE_SENTINEL_NOTE', 'PRIVATE_SENTINEL_QUESTION', 'PRIVATE_SENTINEL_HOME', 'PRIVATE_SENTINEL_BODY',
  'Control/agents/expressions', 'ws://', '100.64.0.7', 'agent-session', 'claude-code:session',
];

function positionRow(slug, label, role, purposeRef, revision = 'r1') {
  const ref = `central:position:project:O-I:${slug}`;
  return {
    record: { schema: 'central.world-position/v1', ref, revision, slug, label, enclosing_world_ref: 'project:O-I', enclosing_co_internality_ref: null, role_ref: role, purpose: `${label} purpose`, purpose_ref: purposeRef, stewards_ref: null, eligible_agent_refs: [], profile_ref: null, continuity_ref: null, handle: `@${slug}` },
    source: { path: `Work/O-I/ProjectCentral/relations/positions/${slug}.json`, ref: `central:source:project:O-I:ProjectCentral/relations/positions/${slug}.json`, revision: `central.content-fnv1a64/v1:700:${slug}-${revision}` },
  };
}

function positionListing() {
  return {
    ok: true, status: 'success', action: 'central.position.list',
    data: {
      schema: 'central.position-listing/v1', world_ref: 'project:O-I',
      positions: [
        positionRow('anima-4', 'Anima 4 (M4 Nara × S4′ Anima)', 'role:anima', 'central:source:project:Actuation:docs/EPI-LOGOS-AGENT-ARCHITECTURE.md'),
        positionRow('aletheia-5', 'Aletheia 5 (M5 Epii × S5′ Aletheia)', 'role:aletheia', 'central:source:project:Actuation:docs/EPI-LOGOS-AGENT-ARCHITECTURE.md'),
        positionRow('private-sentinel-office', 'PRIVATE_SENTINEL_OFFICE', 'role:product-guardian', 'central:source:control:root:Control/agents/expressions/PRIVATE_SENTINEL_OFFICE/OFFICE.md'),
      ],
      inherited: [], invalid: [],
    },
  };
}

function population({ animaGeneration = 2, animaAttention = 'PRIVATE_SENTINEL_ATTENTION composing', animaWork = { outcome: 'one', work_ref: 'wiki:node:project-root/o-i', custody_ref: 'factory:custody:0192-anima', run_ref: 'run:PRIVATE_SENTINEL_RUN', candidates: 1 }, aletheiaGeneration = 1, observed = 'gateway:agency-gateway/omarchy' } = {}) {
  return {
    ok: true, schema: 1, warnings: [], context: { context_id: null, project_root: '/home/PRIVATE_SENTINEL_HOME/Central/Work/O-I', session_id: null },
    data: {
      schema: 'aikit.population-reading/v1', project_world_ref: 'project:O-I', local_world_ref: 'control:root',
      positions: [
        {
          position_ref: ANIMA, handle: '@anima-4', label: 'Anima 4', role_ref: 'role:anima', inherited: false, definition: 'present',
          occupancy: { state: 'occupied', generation_ref: 'actuation:generation:9c56', generation_ordinal: animaGeneration, kind: 'handover', agent_ref: 'agent/anima-4', agency_ref: 'agency:anima-4@project:O-I', agent_session_ref: 'claude-code:session:18a1d321-PRIVATE_SENTINEL_SESSION', session_space_ref: 'session-space:PRIVATE_SENTINEL_SPACE', workcell_ref: 'workcell:omarchy', observed_via: observed, gateway_address: 'ws://100.64.0.7:7337/PRIVATE_SENTINEL_GATEWAY', presence: 'active', attention: animaAttention, since_unix_ms: 1790210889727 },
          current_work: animaWork,
          communiques: { undelivered: 2, latest: { body: 'PRIVATE_SENTINEL_BODY please review the stage' } },
        },
        {
          position_ref: ALETHEIA, handle: '@aletheia-5', label: 'Aletheia 5', role_ref: 'role:aletheia', inherited: false, definition: 'present',
          occupancy: { state: 'occupied', generation_ordinal: aletheiaGeneration, agent_session_ref: 'agent-session/aletheia-5-PRIVATE_SENTINEL_SESSION', workcell_ref: 'workcell:mac', observed_via: 'local', attention: 'PRIVATE_SENTINEL_ATTENTION returning' },
          current_work: { outcome: 'one', work_ref: FRAME, custody_ref: 'factory:custody:0192-aletheia', candidates: 1 },
          communiques: { undelivered: 0 },
        },
        { position_ref: OFFICE, handle: '@private-sentinel-office', label: 'PRIVATE_SENTINEL_OFFICE', occupancy: { state: 'vacant' }, current_work: { outcome: 'none', candidates: 0 }, communiques: { undelivered: 0 } },
      ],
      remotes: [{ workcell_ref: 'workcell:omarchy', gateway_ref: 'agency-gateway/omarchy', status: 'reachable', detail: 'ws://100.64.0.7:7337 answered PRIVATE_SENTINEL_REMOTE' }],
      absences: [],
    },
  };
}

/** AIKit's `wiki-construct inspect --json` result for one constructive WikiFrame. */
function constellation(revision = 1) {
  const participation = (ref, note, sources = []) => ({ participation_ref: ref, role_ref: null, sources, nested: null, note });
  const frame = {
    object: 'frame', profile: 'okf-wiki/v1', ref: FRAME, revision, provenance: [], space_refs: ['central:wiki:project:O-I'], member_refs: ['wiki:anchor:inquiry-o-i', 'wiki:node:project-root/o-i', 'wiki:node:project-private-lab'], external_refs: [],
    constellations: [{
      anchor_ref: 'wiki:anchor:inquiry-o-i', returns: [],
      members: [
        { ref: 'wiki:node:project-root/o-i', conjugate: false, 'aikit.constellation-participation/v1': participation('wiki:participation:root', 'PRIVATE_SENTINEL_NOTE the ground', [{ source_ref: 'central:source:project:O-I:ProjectCentral/user/PRIVATE_SENTINEL_NOTE.md', source_revision: 'r1' }]) },
        { ref: 'wiki:node:project-private-lab', conjugate: false, 'aikit.constellation-participation/v1': participation('wiki:participation:lab', 'the lab') },
      ],
    }],
    'aikit.constellation/v1': { title: 'What grounds O-I?', inquiry: { question: 'PRIVATE_SENTINEL_QUESTION what grounds it', purpose: '' }, authored_by: 'human:cradle-wiki', frame: null, relation_refs: ['wiki:edge:grounds'], alternatives: [], variant_of: null, compositions: [], applied: {} },
  };
  return {
    ok: true, schema: 1, warnings: [], context: { context_id: null, project_root: '/home/PRIVATE_SENTINEL_HOME/Central/Work/O-I', session_id: null },
    data: {
      state: 'read', file: '/home/PRIVATE_SENTINEL_HOME/Central/Work/O-I/ProjectCentral/agents/wiki/wiki.json',
      reading: {
        schema: 'aikit.constellation/v1', frame, construction: frame['aikit.constellation/v1'], native_owner: 'ai-kit', actions: ['aikit.constellation.apply'], semantic_whole_truncated: false,
        relations: [{ object: 'edge', ref: 'wiki:edge:grounds', revision: 1, from_ref: 'wiki:node:project-root/o-i', to_ref: 'wiki:node:project-private-lab', relation: 'grounds', origin: 'authored', origin_ref: FRAME, 'aikit.constellation-relation/v1': { from_participation_ref: 'wiki:participation:root', to_participation_ref: 'wiki:participation:lab', direction: 'directed', standing: 'asserted', evidence: [] } }],
      },
    },
  };
}

function inhabitedReadings(overrides = {}) {
  return [rootReading(), projectReading(overrides.projectRevision), positionListing(), population(overrides.population), constellation(overrides.constellationRevision)];
}

function inhabitedSelection(overrides = {}) {
  return selection({ positions: { [ANIMA]: 'occupancy', [ALETHEIA]: 'address' }, constellations: [FRAME], ...overrides });
}

function publishInhabited(overrides = {}, readings = inhabitedReadings()) {
  return projectCentralWikiWorld({ readings, selection: inhabitedSelection(overrides), published_at: '2026-09-24T09:00:00.000Z' });
}

test('an unselected Position is absent from every outward payload, Explore search and relation', () => {
  const bundle = publishInhabited();
  const refs = new Set(bundle.entries.map((entry) => entry.ref));
  assert.ok(refs.has(HOSTED(ANIMA)) && refs.has(HOSTED(ALETHEIA)));
  assert.ok(![...refs].some((ref) => ref.includes('private-sentinel-office')));
  assert.deepEqual(publicationSentinelLeaks(outwardPayloads(bundle), ['private-sentinel-office', 'PRIVATE_SENTINEL_OFFICE']), []);
  const surface = createExploreSurfaceModel(exploreSeedFromPublication(bundle));
  assert.equal(surface.search('private-sentinel-office').length, 0);
  assert.ok(surface.search('@anima-4').some((hit) => hit.ref === HOSTED(ANIMA)), 'the handle finds the Position');
  assert.equal(bundle.excluded.positions, 1);
  // No selection, no Position: the readings alone disclose nothing.
  const none = projectCentralWikiWorld({ readings: inhabitedReadings(), selection: selection(), published_at: '2026-09-24T09:00:00.000Z' });
  assert.ok(!none.entries.some((entry) => entry.kind === 'world-position' || entry.kind === 'constellation'));
  assert.equal(none.projection.source.revision, 'central.content-fnv1a64/v1:837:o-i-rev-1', 'a wiki-only selection keeps the wiki source revision');
});

test('address mode carries the Position address and nothing of its occupancy; occupancy mode carries only the allow-listed fields', () => {
  const bundle = publishInhabited();
  const aletheia = bundle.entries.find((entry) => entry.ref === HOSTED(ALETHEIA));
  assert.equal(aletheia.kind, 'world-position');
  assert.deepEqual(aletheia.meta, { standing: 'world-position', disclosure: 'address', local_ref: ALETHEIA, role_ref: 'role:aletheia', handle: '@aletheia-5', label: 'Aletheia 5 (M5 Epii × S5′ Aletheia)', enclosing_world_ref: 'project:O-I', inherited: false });
  assert.ok(!JSON.stringify(aletheia).includes('workcell:mac'), 'an address-mode Position says nothing of where it is occupied');
  assert.ok(!bundle.relations.some((relation) => relation.from === HOSTED(ALETHEIA) && relation.relation === 'oi.world/works-on'), 'address mode never discloses current work, even when it names a selected constellation');
  const anima = bundle.entries.find((entry) => entry.ref === HOSTED(ANIMA));
  assert.deepEqual(anima.meta.occupancy, { state: 'occupied', generation_ordinal: 2, workcell_ref: 'workcell:omarchy', observed_via: 'gateway:agency-gateway/omarchy' });
  assert.deepEqual(anima.meta.current_work, { outcome: 'one' });
  assert.deepEqual(anima.meta.communiques, { undelivered: 2 });
  assert.deepEqual(Object.keys(anima.meta).sort(), ['communiques', 'current_work', 'disclosure', 'enclosing_world_ref', 'handle', 'inherited', 'label', 'local_ref', 'occupancy', 'role_ref', 'standing']);
  const card = bundle.presentation.regions.find((region) => region.region_ref === 'positions').bindings.find((binding) => binding.subject_ref === HOSTED(ANIMA));
  assert.equal(card.component_ref, 'oi.presentation/reference-card/v1');
  assert.match(card.props.text, /occupied \(generation #2, workcell:omarchy\)/);
  // A gateway named by address is not a gateway ref; it is withheld, never published.
  const addressed = publishInhabited({}, [rootReading(), projectReading(), positionListing(), population({ observed: 'gateway:ws://100.64.0.7:7337' }), constellation()]);
  assert.deepEqual(addressed.entries.find((entry) => entry.ref === HOSTED(ANIMA)).meta.occupancy, { state: 'occupied', generation_ordinal: 2, workcell_ref: 'workcell:omarchy' });
});

test('private inhabitation material never leaves: sessions, SessionSpaces, gateway addresses, attention, Communique bodies, protected purpose refs', () => {
  const bundle = publishInhabited();
  assert.deepEqual(publicationSentinelLeaks(outwardPayloads(bundle), [...PRIVATE, ...INHABITATION_PRIVATE]), []);
  const defaults = worldProtectedSentinels(inhabitedReadings());
  const keys = new Set(defaults.map((sentinel) => sentinel.key));
  for (const key of ['agent_session_ref', 'session_space_ref', 'gateway_address', 'attention', 'body', 'purpose_ref']) assert.ok(keys.has(key), `default sentinels cover ${key}`);
  assert.ok(defaults.some((sentinel) => sentinel.key === 'purpose_ref' && sentinel.value.includes('Control/agents/expressions')));
  assert.ok(!defaults.some((sentinel) => sentinel.key === 'purpose_ref' && sentinel.value.includes('docs/EPI-LOGOS')), 'an unprotected purpose ref is not a sentinel');
  assert.deepEqual(worldPublicationLeaks(outwardPayloads(bundle), inhabitedReadings()), []);
  // The allow-lists are the guard; the scan is the proof. A Position whose own
  // label carries a gateway address is refused whole rather than published.
  const listing = positionListing();
  listing.data.positions[0].record.label = 'Anima 4 at ws://100.64.0.7:7337';
  assert.throws(() => publishInhabited({}, [rootReading(), projectReading(), listing, population(), constellation()]), /protected inhabitation material \(.*gateway-address/);
  // The refusal names the kind of material, never its value.
  const leaks = worldPublicationLeaks({ page: 'x claude-code:session:18a1d321-PRIVATE_SENTINEL_SESSION y' }, inhabitedReadings());
  assert.ok(leaks.includes('page:agent_session_ref') && leaks.includes('page:agent-session-ref'));
  assert.ok(!leaks.join(' ').includes('PRIVATE_SENTINEL'));
});

test('selection refusals: an unknown Position, occupancy without a population reading, an unknown constellation, an invalid mode', () => {
  assert.throws(() => publishInhabited({ positions: { 'central:position:project:O-I:nobody': 'address' } }), /not present in the position listing/);
  assert.throws(() => publishInhabited({}, [rootReading(), projectReading(), positionListing(), constellation()]), /need an aikit.population-reading\/v1/);
  assert.throws(() => publishInhabited({ positions: { [ALETHEIA]: 'address' } }, [rootReading(), projectReading(), constellation()]), /need a central.position-listing\/v1/);
  assert.throws(() => publishInhabited({ constellations: ['wiki:frame:absent'] }), /not present in any AIKit constellation reading/);
  assert.throws(() => publishInhabited({ positions: { [ANIMA]: 'everything' } }), /must be address or occupancy/);
  const refused = { ok: false, schema: 1, error: { code: 'knowledge.constellation_refused', message: 'the native frame is absent' } };
  assert.throws(() => publishInhabited({}, [rootReading(), projectReading(), positionListing(), population(), refused]), /refusal: knowledge.constellation_refused/);
});

test('occupancy or custody drift is a source revision; a change only in never-published material is a refinement', () => {
  const first = publishInhabited();
  assert.match(first.projection.source.revision, /^oi\.world-sources\/v1:[0-9a-f]{16}$/);
  assert.deepEqual(first.sources.map((source) => source.kind), ['central-wiki-reading', 'central-wiki-reading', 'central-position-listing', 'aikit-population-reading', 'aikit-constellation']);
  const readingsWith = (population_) => [rootReading(), projectReading(), positionListing(), population(population_), constellation()];

  const reoccupied = reprojectCentralWikiWorld(first, { readings: readingsWith({ animaGeneration: 3 }), selection: inhabitedSelection(), published_at: '2026-09-24T10:00:00.000Z' });
  assert.equal(reoccupied.source_moved, true, 'a new occupant generation is a source revision');
  assert.deepEqual(reoccupied.moved_sources.map((source) => source.kind), ['aikit-population-reading']);
  assert.equal(reoccupied.projection.projection_revision, 2);
  assert.deepEqual(reoccupied.projection.supersedes, { projection_ref: first.projection.projection_ref, projection_revision: 1, source_revision: first.projection.source.revision });
  assert.equal(reoccupied.entries.find((entry) => entry.ref === HOSTED(ANIMA)).meta.occupancy.generation_ordinal, 3);

  const handedOff = reprojectCentralWikiWorld(first, { readings: readingsWith({ animaWork: { outcome: 'one', work_ref: 'wiki:node:project-root/o-i', custody_ref: 'factory:custody:0193-anima-next', candidates: 1 } }), selection: inhabitedSelection(), published_at: '2026-09-24T10:00:00.000Z' });
  assert.equal(handedOff.source_moved, true, 'a custody change is a source revision');
  assert.ok(handedOff.relations.some((relation) => relation.relation === 'oi.world/works-on' && relation.provenance[0].ref === 'factory:custody:0193-anima-next'));

  const reframed = reprojectCentralWikiWorld(first, { readings: [rootReading(), projectReading(), positionListing(), population(), constellation(2)], selection: inhabitedSelection(), published_at: '2026-09-24T10:00:00.000Z' });
  assert.equal(reframed.source_moved, true, 'a constellation revision is a source revision');
  assert.deepEqual(reframed.moved_sources.map((source) => source.ref), [FRAME]);

  const quiet = reprojectCentralWikiWorld(first, { readings: readingsWith({ animaAttention: 'PRIVATE_SENTINEL_ATTENTION now elsewhere', aletheiaGeneration: 7 }), selection: inhabitedSelection({ summary: 'Same sources, different words.' }), published_at: '2026-09-24T10:00:00.000Z' });
  assert.equal(quiet.source_moved, false, 'attention never travels and an address-mode occupancy is not a source of this publication');
  assert.deepEqual(quiet.moved_sources, []);
  assert.equal(quiet.projection.source.revision, first.projection.source.revision);
  assert.deepEqual(publicationSentinelLeaks(outwardPayloads(quiet), [...PRIVATE, ...INHABITATION_PRIVATE]), []);
});

test('hosted reducer arguments carry the Positions, the constellation and their World relations', () => {
  const bundle = publishInhabited();
  const args = hostedPublicationArgs(bundle);
  const position = args.putExploreRelations.filter((relation) => relation.relation === 'oi.world/position');
  assert.deepEqual(position.map((relation) => [relation.fromRef, relation.toRef, relation.origin]).sort(), [
    ['world:central:project:O-I', HOSTED(ALETHEIA), 'projection'],
    ['world:central:project:O-I', HOSTED(ANIMA), 'projection'],
  ]);
  const entry = args.putExploreEntries.find((row) => row.semanticRef === HOSTED(ANIMA));
  assert.equal(entry.kind, 'world-position');
  assert.equal(JSON.parse(entry.entryJson).meta.occupancy.state, 'occupied');
  assert.equal(args.putProjection.sourceRevision, bundle.projection.source.revision);
  for (const relation of args.putExploreRelations) {
    assert.ok(args.putExploreEntries.some((row) => row.semanticRef === relation.fromRef), `${relation.relationRef} starts at a published entry`);
    assert.ok(args.putExploreEntries.some((row) => row.semanticRef === relation.toRef), `${relation.relationRef} ends at a published entry`);
  }
});

test('a constellation is one entry, related to the World and to its selected wiki-node participations only', () => {
  const bundle = publishInhabited();
  const entry = bundle.entries.find((candidate) => candidate.ref === HOSTED(FRAME));
  assert.equal(entry.kind, 'constellation');
  assert.equal(entry.label, 'What grounds O-I?');
  assert.equal(entry.revision, '1');
  assert.deepEqual(entry.meta, { standing: 'aikit-constellation', native_owner: 'ai-kit', local_ref: FRAME, participations: 2 });
  assert.ok(bundle.relations.some((relation) => relation.from === 'world:central:project:O-I' && relation.to === HOSTED(FRAME) && relation.relation === 'oi.world/constellation' && relation.origin === 'projection'));
  const participations = bundle.relations.filter((relation) => relation.relation === 'aikit.constellation/participation');
  assert.deepEqual(participations.map((relation) => [relation.from, relation.to, relation.origin]), [[HOSTED(FRAME), NODE, 'aikit-knowledge']]);
  assert.deepEqual(participations[0].participation, { participation_ref: 'wiki:participation:root', role_ref: null, position: null, conjugate: false });
  assert.ok(!JSON.stringify(bundle).includes('project-private-lab'), 'the unselected participant and the participation-to-participation edge stay home');
  const card = bundle.presentation.regions.find((region) => region.region_ref === 'constellations').bindings[0];
  assert.deepEqual(card.props.refs, [NODE]);
  const surface = createExploreSurfaceModel(exploreSeedFromPublication(bundle));
  const opened = surface.open(HOSTED(FRAME), { depth: 1, budget: 12 });
  assert.ok(opened.relations.edges.some((edge) => edge.to === NODE));
});

test('works-on appears only when current work is one attested custody naming a selected node or constellation', () => {
  const bundle = publishInhabited();
  const worksOn = bundle.relations.filter((relation) => relation.relation === 'oi.world/works-on');
  assert.deepEqual(worksOn.map((relation) => [relation.from, relation.to]), [[HOSTED(ANIMA), NODE]]);
  assert.equal(worksOn[0].provenance[0].kind, 'factory-custody');
  assert.equal(worksOn[0].provenance[0].ref, 'factory:custody:0192-anima');
  const withWork = (animaWork) => publishInhabited({}, [rootReading(), projectReading(), positionListing(), population({ animaWork }), constellation()]).relations.filter((relation) => relation.relation === 'oi.world/works-on');
  assert.deepEqual(withWork({ outcome: 'one', work_ref: 'github:EpiLogos/Factory#261', custody_ref: 'factory:custody:1', candidates: 1 }), [], 'work outside the selection');
  assert.deepEqual(withWork({ outcome: 'one', work_ref: 'wiki:node:project-private-lab', custody_ref: 'factory:custody:1', candidates: 1 }), [], 'an unselected node');
  assert.deepEqual(withWork({ outcome: 'ambiguous', work_ref: 'wiki:node:project-root/o-i', custody_ref: 'factory:custody:1', candidates: 2 }), [], 'ambiguous current work');
  assert.deepEqual(withWork({ outcome: 'one', work_ref: 'wiki:node:project-root/o-i', custody_ref: null, candidates: 1 }), [], 'no custody attests it');
  const onConstellation = withWork({ outcome: 'one', work_ref: FRAME, custody_ref: 'factory:custody:2', candidates: 1 });
  assert.deepEqual(onConstellation.map((relation) => relation.to), [HOSTED(FRAME)]);
  // Dropping the node from the selection drops the relation with it.
  const unselected = publishInhabited({ node_refs: [], constellations: [] });
  assert.ok(!unselected.relations.some((relation) => relation.relation === 'oi.world/works-on'));
});
