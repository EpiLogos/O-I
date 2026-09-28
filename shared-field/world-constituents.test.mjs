import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exploreSeedFromPublication,
  hostedPublicationArgs,
  projectCentralWikiWorld,
  reprojectCentralWikiWorld,
  worldPublicationLeaks,
} from './central-wiki-projection.mjs';
import { renderWorldEdition, worldEditionManifest } from './world-edition.mjs';
import { structuredProjectionReading } from './projection-reading.mjs';
import { createHash } from 'node:crypto';
import { aikitCapsuleRevision, base64Bytes, blake3Hex, practiceOfferBody, practiceOfferFromReading, sha256Digest, validatePracticeOfferBody } from './world-constituents.mjs';

/*
 * Workcells, Agent repertoire (practices) and activity, published through the
 * same selection → bundle → Projection lineage. Fixture readings mirror the
 * exact owner outputs: `ctrl machine.declaration`, `workcell --json discover`,
 * `oi agent participation --json`, `factory development run --json`, and
 * AIKit's `gateway who` population. Private adjacent material is planted
 * beside every selected thing.
 */
const WORLD = 'world:central:project:O-I';
const HOSTED = (ref) => `${WORLD}/${ref}`;
const ALETHEIA = 'central:position:project:O-I:aletheia-5';
const ANIMA = 'central:position:project:O-I:anima-4';
const NODE = 'wiki:node:project-root/o-i';
const RUN = 'run:01TESTRUN0000000000000000';
const OFFER_PUBLIC = 'offer:provider:collapsed-local-workspace:directory';
const OFFER_PRIVATE = 'offer:provider:collapsed-local-target-services:external-service:PRIVATE_SENTINEL_OFFER';
const PRIVATE = [
  'PRIVATE_SENTINEL_PRACTICE', 'PRIVATE_SENTINEL_OFFER', 'PRIVATE_SENTINEL_USER', 'PRIVATE_SENTINEL_INTENT', 'PRIVATE_SENTINEL_DESTINATION',
  'PRIVATE_SENTINEL_NODE_LABEL', 'PRIVATE_SENTINEL_REASON', 'PRIVATE_SENTINEL_SESSION', 'redis://', '127.0.0.1', '100.64.0.9', 'Control/agents/profiles',
];

function rootReading() {
  return {
    schema: 'central.wiki-reading/v1', register: 'root', world_ref: 'control:root',
    source: { ref: 'central:source:control:root:Control/agents/wiki/wiki.json', revision: 'central.content-fnv1a64/v1:1:root' },
    spaces: [{ ref: 'central:wiki:root', title: 'Central', revision: 1, child_space_refs: ['central:wiki:project:O-I'], node_refs: [] }],
    nodes: [], relations: [{ from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:O-I' }],
  };
}

function projectReading() {
  return {
    schema: 'central.wiki-reading/v1', register: 'project', world_ref: 'project:O-I',
    source: { ref: 'central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json', revision: 'central.content-fnv1a64/v1:1:o-i' },
    spaces: [{ ref: 'central:wiki:project:O-I', title: 'O-I', revision: 1, parent_space_refs: ['central:wiki:root'], child_space_refs: [], node_refs: [NODE] }],
    nodes: [{ ref: NODE, title: 'O-I', node_type: 'project-root', revision: 1, space_refs: ['central:wiki:project:O-I'], source_refs: ['ProjectCentral/project.json'] }],
    relations: [{ from_ref: 'central:wiki:project:O-I', kind: 'space-node', to_ref: NODE }],
  };
}

function positionRow(slug, label, role) {
  const ref = `central:position:project:O-I:${slug}`;
  return {
    record: { schema: 'central.world-position/v1', ref, revision: 'r1', slug, label, enclosing_world_ref: 'project:O-I', role_ref: role, purpose: `${label} purpose`, handle: `@${slug}` },
    source: { ref: `central:source:project:O-I:ProjectCentral/relations/positions/${slug}.json`, revision: `central.content-fnv1a64/v1:700:${slug}` },
  };
}

function positionListing() {
  return { ok: true, data: { schema: 'central.position-listing/v1', world_ref: 'project:O-I', positions: [positionRow('aletheia-5', 'Aletheia 5', 'role:aletheia'), positionRow('anima-4', 'Anima 4', 'role:anima')], inherited: [] } };
}

function population({ aletheiaWork = { outcome: 'one', work_ref: NODE, custody_ref: 'factory:custody:0001-aletheia', run_ref: RUN, candidates: 1 }, animaWorkcell = 'workcell:mac' } = {}) {
  return {
    ok: true, schema: 1, warnings: [], context: { project_root: '/Users/PRIVATE_SENTINEL_USER/Central/Work/O-I' },
    data: {
      schema: 'aikit.population-reading/v1', project_world_ref: 'project:O-I', local_world_ref: 'control:root', local_workcell_ref: 'workcell:mac',
      positions: [
        { position_ref: ALETHEIA, occupancy: { state: 'occupied', generation_ordinal: 2, agent_ref: 'agent/aletheia', agency_ref: 'agency:aletheia@project:O-I', agent_session_ref: 'claude-code:session:1234abcd-PRIVATE_SENTINEL_SESSION', workcell_ref: 'workcell:mac', observed_via: 'local' }, current_work: aletheiaWork, communiques: { undelivered: 0 } },
        { position_ref: ANIMA, occupancy: { state: 'occupied', generation_ordinal: 1, agent_ref: 'agent/anima', agency_ref: 'agency:anima@project:O-I', workcell_ref: animaWorkcell, observed_via: 'local' }, current_work: { outcome: 'none' }, communiques: { undelivered: 0 } },
      ],
      remotes: [{ workcell_ref: 'workcell:omarchy', gateway_ref: 'agency-gateway/omarchy', status: 'reachable', detail: 'answered from its Workcell at 100.64.0.9:7788' }],
      absences: [],
    },
  };
}

function machineDeclaration() {
  return { ok: true, status: 'success', action: 'machine.declaration', data: { declaration: { bindings: [{ kind: 'workcell', reference: 'workcell:mac' }], capabilities: [], role: 'current', schema: 'central.machine', version: 1 }, source: { path: 'Control/machines/current.json', source_class: 'authored' } } };
}

function workcellDiscovery({ publicAffordances = ['workspace:read-only', 'persistence:ephemeral'], privateEndpoint = 'redis://127.0.0.1:6381' } = {}) {
  return {
    ok: true, health: 'healthy', capacity: {}, workcell_ref: 'workcell:mac',
    offers: [
      { offer_ref: OFFER_PUBLIC, port: 'workspace', availability: 'available', health: 'healthy', affordances: publicAffordances, connections: [], exposures: [], isolation_trust: [], metadata: { implementation: 'directory', root: '/Users/PRIVATE_SENTINEL_USER/.workcell/workspaces' }, provider_ref: 'provider:collapsed-local-workspace' },
      { offer_ref: OFFER_PRIVATE, port: 'service', availability: 'available', health: 'healthy', affordances: [], connections: ['service:redis-now/personal-workcell'], exposures: [], isolation_trust: [], metadata: { endpoint: privateEndpoint, manifest: '/Users/PRIVATE_SENTINEL_USER/.workcell/m.json', status_command: '/opt/homebrew/bin/redis-cli' }, provider_ref: 'provider:collapsed-local-target-services' },
    ],
  };
}

const DARSHANA_BODY = '---\nname: darshana\ndescription: The structural gaze.\n---\n\n# Darshana\n\nScout a long Markdown source before reading it whole.\n';
/** One capsule as AIKit's active snapshot holds it (manifest + payload files). */
function darshanaCapsule(body = DARSHANA_BODY) {
  const bytes = (value) => new TextEncoder().encode(value);
  return {
    manifest: { bytes: bytes('schema = 1\nid = "skill/ql/darshana"\nkind = "skill"\nname = "darshana"\n\n[skill]\nroot = "payload"\n'), mode: 0o644 },
    files: [
      { path: 'payload/scripts/darshana.py', mode: 0o755, bytes: bytes('print("gaze")\n') },
      { path: 'payload/SKILL.md', mode: 0o644, bytes: bytes(body) },
    ],
  };
}
const DARSHANA_REVISION = aikitCapsuleRevision(darshanaCapsule());
function darshanaBody(body = DARSHANA_BODY) {
  const capsule = darshanaCapsule(body);
  return practiceOfferBody({ practice_ref: 'skill/ql/darshana', source_revision: aikitCapsuleRevision(capsule), source_id: 'ql', snapshot: 'f'.repeat(64), capsule });
}

function participation({ darshanaRevision = DARSHANA_REVISION, privateRevision = 'aaaa0000', gateRevision = 'd89f52812b61b498' } = {}) {
  const praxis = (id, form, revision, available = true) => ({ available, carried: true, form, id, name: id.split('/').at(-1), revision, via: ['direct'], withheld_reason: available ? null : 'not-in-scope' });
  return {
    schema: 'oi.agent-world-participation/v1', agent_ref: 'agent/aletheia', world_ref: 'project:O-I',
    participation_ref: 'oi:participation:agent/aletheia@project:O-I#profile/aletheia@r3',
    profile: { name: 'Aletheia', ref: 'profile/aletheia', revision: 'r3', source_path: 'Control/agents/profiles/profile-PRIVATE.json' },
    expression: { intent_expression: '# Aletheia PRIVATE_SENTINEL_INTENT unconcealment' },
    roles: {
      eligible: [{ position_ref: ALETHEIA, revision: 'r2', role_ref: 'role:aletheia' }],
      occupied: [{ position_ref: ALETHEIA, reason: 'Aletheia takes up PRIVATE_SENTINEL_REASON with custody factory:custody:0001' }],
    },
    residence: { occupied_position_refs: [ALETHEIA] },
    repertoire: {
      praxis: [
        praxis('skill/ql/darshana', 'skill', darshanaRevision),
        praxis('skill/ql/aletheia-m-gate', 'method', gateRevision),
        praxis('skill/ql/PRIVATE_SENTINEL_PRACTICE', 'method', privateRevision),
        praxis('skill/ql/withheld', 'skill', 'bbbb0000', false),
      ],
    },
    public_capabilities: [],
  };
}

function runReading({ revision = 6, lifecycle = 'seeded', agencies = [] } = {}) {
  return {
    contract: 'factory.run-reading/v1', provenance: { owner: 'factory', factoryStateRevision: 40, subjectRevision: revision },
    runRef: RUN, revision, projectRef: 'project:0000TEST', lifecycle, destination: 'PRIVATE_SENTINEL_DESTINATION/acceptance',
    runMap: { nodes: { work: { id: 'work', kind: 'work', label: 'PRIVATE_SENTINEL_NODE_LABEL review', state: 'returned' } }, edges: [] },
    agencies, executions: [], evidence: [], candidates: [], humanRequests: [], actions: [],
  };
}

function readings(overrides = {}) {
  const body = overrides.body === null ? [] : [overrides.body ?? darshanaBody()];
  return [rootReading(), projectReading(), positionListing(), population(overrides.population), machineDeclaration(), workcellDiscovery(overrides.workcell), participation(overrides.participation), runReading(overrides.run), ...body];
}

function selection(overrides = {}) {
  return {
    schema: 'oi.central-wiki-selection/v1', project: 'O-I', world_ref: WORLD, subject_world_ref: 'project:O-I',
    field_ref: 'oi:field:central:project:O-I', projection_ref: 'projection:central:project:O-I', presentation_ref: 'presentation:central:project:O-I',
    title: 'O-I', audience: { visibility: 'public' }, publisher: { participant_ref: 'participant:central:owner', identity_ref: 'human:central:owner' },
    spaces: { 'central:wiki:root': 'address', 'central:wiki:project:O-I': 'nodes' }, node_refs: [NODE],
    positions: { [ALETHEIA]: 'occupancy', [ANIMA]: 'address' },
    ...overrides,
  };
}

const FULL = {
  workcells: { 'workcell:mac': 'offer' },
  practices: { [ALETHEIA]: ['skill/ql/darshana', 'skill/ql/aletheia-m-gate'] },
  offers: { 'workcell:mac': [OFFER_PUBLIC], [ALETHEIA]: ['skill/ql/darshana'] },
  activity: { [RUN]: 'live' },
};

function publish(overrides = {}, readingOverrides = {}) {
  return projectCentralWikiWorld({ readings: readings(readingOverrides), selection: selection(overrides), published_at: '2026-09-28T09:00:00.000Z' });
}

function outward(bundle) {
  const html = renderWorldEdition(bundle.projection);
  return { bundle, hosted_args: hostedPublicationArgs(bundle), explore_seed: exploreSeedFromPublication(bundle), edition_html: html, edition_manifest: worldEditionManifest(bundle.projection, html), structured_reading: structuredProjectionReading(bundle.projection) };
}

const kinds = (bundle) => bundle.entries.map((entry) => entry.kind);
const entry = (bundle, ref) => bundle.entries.find((candidate) => candidate.ref === HOSTED(ref));
const relationsOf = (bundle, name) => bundle.relations.filter((relation) => relation.relation === name);

test('each constituent appears only when the selection names it', () => {
  const none = publish();
  for (const kind of ['workcell', 'practice', 'activity']) assert.ok(!kinds(none).includes(kind), `${kind} absent without selection`);
  assert.equal(relationsOf(none, 'oi.world/practises').length, 0);

  const workcellOnly = publish({ workcells: { 'workcell:mac': 'address' } });
  assert.deepEqual(kinds(workcellOnly).filter((kind) => ['workcell', 'practice', 'activity'].includes(kind)), ['workcell']);
  assert.equal(relationsOf(workcellOnly, 'oi.world/workcell').length, 1);
  assert.deepEqual(relationsOf(workcellOnly, 'oi.world/carried-by').map((relation) => relation.from), [HOSTED(ALETHEIA)], 'only the occupancy-mode Position is carried-by; the address-mode one never discloses its Workcell');

  const practiceOnly = publish({ practices: { [ALETHEIA]: ['skill/ql/darshana'] } });
  assert.deepEqual(kinds(practiceOnly).filter((kind) => ['workcell', 'practice', 'activity'].includes(kind)), ['practice']);
  assert.equal(entry(practiceOnly, 'skill/ql/darshana').meta.source_ref, 'skill/ql/darshana');
  assert.equal(entry(practiceOnly, ALETHEIA).meta.agent_ref, 'agent/aletheia');

  const activityOnly = publish({ activity: { [RUN]: 'static' } });
  assert.deepEqual(kinds(activityOnly).filter((kind) => ['workcell', 'practice', 'activity'].includes(kind)), ['activity']);
  const activity = entry(activityOnly, RUN);
  assert.deepEqual(activity.meta, { standing: 'activity', local_ref: RUN, state: 'seeded', run_ref: RUN, participants: [HOSTED(ALETHEIA)], liveness: 'static', liveness_basis: 'publication' });
  assert.deepEqual(relationsOf(activityOnly, 'oi.activity/participant').map((relation) => relation.to), [HOSTED(ALETHEIA)]);
  assert.deepEqual(relationsOf(activityOnly, 'oi.activity/works-on').map((relation) => relation.to), [HOSTED(NODE)]);
});

test('a Skill page refers to the practice and its source revision; only an offer carries its body, and nothing is granted', () => {
  const bundle = publish(FULL);
  const practice = entry(bundle, 'skill/ql/darshana');
  assert.equal(practice.kind, 'practice');
  const { offer, ...meta } = practice.meta;
  assert.deepEqual(meta, { standing: 'practice', presentation: 'thing', native_owner: 'ai-kit', local_ref: 'skill/ql/darshana', practice_kind: 'skill', source_ref: 'skill/ql/darshana', source_revision: DARSHANA_REVISION, availability: 'offered', grant: 'none' });
  assert.deepEqual(offer, {
    body_digest: sha256Digest(DARSHANA_BODY), media_type: 'text/markdown', body_bytes: new TextEncoder().encode(DARSHANA_BODY).length,
    revision_basis: 'aikit-capsule-revision-v2', payload_files_not_carried: ['payload/scripts/darshana.py'], text: DARSHANA_BODY,
  });
  const inspectable = entry(bundle, 'skill/ql/aletheia-m-gate');
  assert.equal(inspectable.meta.practice_kind, 'method');
  assert.equal(inspectable.meta.offer, undefined, 'an inspectable practice never carries a body');
  // The body travels in the same publication: the hosted entry row carries it.
  const hostedRow = hostedPublicationArgs(bundle).putExploreEntries.find((row) => row.semanticRef === HOSTED('skill/ql/darshana'));
  assert.equal(JSON.parse(hostedRow.entryJson).meta.offer.text, DARSHANA_BODY);
  // Selected but not offered: the body reading is ignored, not published.
  const notOffered = publish({ ...FULL, offers: { 'workcell:mac': [OFFER_PUBLIC] } });
  assert.equal(entry(notOffered, 'skill/ql/darshana').meta.availability, 'inspectable');
  assert.equal(entry(notOffered, 'skill/ql/darshana').meta.offer, undefined);
  assert.ok(!JSON.stringify(outward(notOffered)).includes('Scout a long Markdown source'), 'an inspectable practice body never travels');
});

test('an offered body is proved against the disclosed AIKit revision and refused otherwise', () => {
  assert.equal(blake3Hex(''), 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262');
  assert.equal(blake3Hex('abc'), '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85');
  assert.equal(blake3Hex(Uint8Array.from({ length: 1025 }, (_, index) => index % 251)), 'd00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444');
  const modeMoved = darshanaCapsule();
  modeMoved.files[0].mode = 0o644;
  assert.notEqual(aikitCapsuleRevision(modeMoved), DARSHANA_REVISION, 'file permissions are part of the AIKit revision');

  // The active snapshot holds another revision than the Agent discloses.
  assert.throws(() => practiceOfferBody({ practice_ref: 'skill/ql/darshana', source_revision: DARSHANA_REVISION, capsule: darshanaCapsule('# changed on disk\n') }), /refusing to publish its body/);
  // A body read at another revision than the participation discloses.
  assert.throws(() => publish(FULL, { body: darshanaBody('# the next revision\n') }), /its body was read at/);
  // Offered with no body at all.
  assert.throws(() => publish(FULL, { body: null }), /no oi.practice-offer-body\/v1 reading carries its body/);
  // A tampered body reading (text no longer matches its digest).
  assert.throws(() => publish(FULL, { body: { ...darshanaBody(), text: `${DARSHANA_BODY}extra` } }), /body_digest does not match/);
  // Script-capable content is not curated text data.
  assert.throws(() => darshanaBody('# gaze\n<script>alert(1)</script>\n'), /not curated text data \(script-element\)/);
  assert.throws(() => darshanaBody('# gaze\n<a href="javascript:void(0)">x</a>\n'), /script-url/);
  // Local paths and tokens inside the body refuse the publication, naming the practice.
  const leaky = darshanaBody('# gaze\nSee /Users/someone/notes/private.md\n');
  assert.throws(() => publish(FULL, { body: leaky, participation: { darshanaRevision: leaky.source_revision } }), /offered practice skill\/ql\/darshana body would carry protected material \(local-home-path\)/);
});

test('offered is not inspectable: an offer travels only when the selection lists it', () => {
  const bundle = publish(FULL);
  assert.equal(entry(bundle, 'skill/ql/darshana').meta.availability, 'offered');
  assert.equal(entry(bundle, 'skill/ql/aletheia-m-gate').meta.availability, 'inspectable');
  const practises = Object.fromEntries(relationsOf(bundle, 'oi.world/practises').map((relation) => [relation.to, relation.availability]));
  assert.deepEqual(practises, { [HOSTED('skill/ql/darshana')]: 'offered', [HOSTED('skill/ql/aletheia-m-gate')]: 'inspectable' });

  const workcell = entry(bundle, 'workcell:mac');
  assert.deepEqual(workcell.meta.offers, [{ offer_ref: OFFER_PUBLIC, port: 'workspace', affordances: ['workspace:read-only', 'persistence:ephemeral'] }]);
  const addressOnly = entry(publish({ ...FULL, workcells: { 'workcell:mac': 'address' }, offers: { [ALETHEIA]: ['skill/ql/darshana'] } }), 'workcell:mac');
  assert.equal(addressOnly.meta.offers, undefined, 'an address-mode Workcell carries no offers at all');
  assert.equal(addressOnly.meta.material_role, 'machine:current');

  assert.throws(() => publish({ ...FULL, workcells: { 'workcell:mac': 'address' } }), /needs the Workcell selected in "offer" mode/);
  assert.throws(() => publish({ ...FULL, offers: { [ALETHEIA]: ['skill/ql/PRIVATE_SENTINEL_PRACTICE'] } }), /not a selected practice/);
  assert.throws(() => publish({ ...FULL, practices: { [ALETHEIA]: ['skill/ql/withheld'] }, offers: { [ALETHEIA]: ['skill/ql/withheld'] } }), /does not have it available/);
});

test('private adjacent material never appears in entries, meta, relations, counts or any outward payload', () => {
  const bundle = publish(FULL);
  const payloads = outward(bundle);
  for (const [name, payload] of Object.entries(payloads)) {
    const serialised = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const sentinel of PRIVATE) assert.ok(!serialised.includes(sentinel), `${name} carries ${sentinel}`);
    assert.ok(!serialised.includes('skill/ql/withheld'), `${name} carries an unselected practice`);
  }
  assert.deepEqual(worldPublicationLeaks(payloads, readings()), []);
  // Counts: nothing about the unselected repertoire, the unlisted offer or the
  // Workcell's other material is counted anywhere.
  assert.deepEqual(Object.keys(bundle.excluded).sort(), ['nodes', 'positions', 'relations', 'spaces']);
  assert.equal(entry(bundle, 'central:wiki:project:O-I').summary, 'WikiSpace at the project register · 1 node selected', 'a space never counts its unselected nodes');
  assert.equal(entry(bundle, ALETHEIA).meta.practices, 2);
  assert.match(entry(bundle, 'workcell:mac').summary, /1 offered$/);
  // Adding or removing unselected practices and offers changes nothing outward.
  const trimmed = readings();
  trimmed[6].repertoire.praxis = trimmed[6].repertoire.praxis.filter((praxis) => !praxis.id.includes('PRIVATE') && praxis.id !== 'skill/ql/withheld');
  trimmed[5].offers = trimmed[5].offers.filter((offer) => offer.offer_ref === OFFER_PUBLIC);
  const lean = projectCentralWikiWorld({ readings: trimmed, selection: selection(FULL), published_at: '2026-09-28T09:00:00.000Z' });
  assert.deepEqual(lean.entries, bundle.entries);
  assert.deepEqual(lean.relations, bundle.relations);
  assert.deepEqual(lean.excluded, bundle.excluded);
  assert.equal(lean.source.revision, bundle.source.revision);
});

test('the leak scan stays authoritative: an endpoint smuggled through an authored label refuses the whole bundle', () => {
  assert.throws(() => publish({ ...FULL, workcells: { 'workcell:mac': { mode: 'offer', label: 'mac at redis://127.0.0.1:6381' } } }), /protected inhabitation material .*workcell-endpoint/);
  assert.throws(() => publish({ ...FULL, activity: { [RUN]: { liveness: 'live', purpose_summary: 'see /Users/someone/notes' } } }), /local-home-path/);
});

test('composite source revision moves with a selected Workcell, practice or activity, and not otherwise', () => {
  const base = publish(FULL);
  const moved = (readingOverrides) => reprojectCentralWikiWorld(base, { readings: readings(readingOverrides), selection: selection(FULL), published_at: '2026-09-28T10:00:00.000Z' });

  const next = darshanaBody('# Darshana, revised\n');
  const practice = moved({ participation: { darshanaRevision: next.source_revision }, body: next });
  assert.equal(practice.source_moved, true);
  assert.deepEqual(practice.moved_sources.map((source) => source.kind), ['aikit-agent-repertoire']);

  const workcell = moved({ workcell: { publicAffordances: ['workspace:read-only'] } });
  assert.equal(workcell.source_moved, true);
  assert.deepEqual(workcell.moved_sources.map((source) => source.kind), ['workcell']);

  const run = moved({ run: { revision: 7 } });
  assert.equal(run.source_moved, true);
  assert.deepEqual(run.moved_sources.map((source) => source.kind), ['factory-run']);

  for (const quiet of [{ participation: { privateRevision: 'changed' } }, { workcell: { privateEndpoint: 'redis://127.0.0.1:9999' } }, { population: { animaWorkcell: 'workcell:omarchy' } }]) {
    const next = moved(quiet);
    assert.equal(next.source_moved, false, JSON.stringify(quiet));
    assert.deepEqual(next.moved_sources, []);
    assert.equal(next.projection.source.revision, base.projection.source.revision);
  }
});

test('activity participants are attested by the population or the run; an address-mode Position never participates', () => {
  const byAgency = publish({ positions: { [ALETHEIA]: 'occupancy', [ANIMA]: 'occupancy' }, activity: { [RUN]: 'live' } }, { run: { agencies: [{ agencyRef: 'agency:anima@project:O-I', agentRef: 'agent/anima' }] } });
  assert.deepEqual(entry(byAgency, RUN).meta.participants, [HOSTED(ALETHEIA), HOSTED(ANIMA)].sort());
  assert.deepEqual(relationsOf(byAgency, 'oi.activity/works-on').map((relation) => relation.to), [HOSTED(NODE)], 'works-on comes only from attested current work');

  const addressed = publish({ positions: { [ALETHEIA]: 'address', [ANIMA]: 'address' }, activity: { [RUN]: 'live' } });
  assert.deepEqual(entry(addressed, RUN).meta.participants, []);
  assert.equal(relationsOf(addressed, 'oi.activity/participant').length, 0);

  const custody = publish({ activity: { 'factory:custody:0001-aletheia': { liveness: 'live', purpose_summary: 'Disclose and return the Technē act' } } });
  const held = entry(custody, 'factory:custody:0001-aletheia');
  assert.equal(held.meta.run_ref, RUN);
  assert.equal(held.meta.purpose_summary, 'Disclose and return the Technē act');
  assert.equal(held.label, 'Disclose and return the Technē act');
});

test('refusals: unattested Workcell, offer without discovery, practice outside the repertoire, activity without its run, repertoire of an unselected Position', () => {
  assert.throws(() => publish({ workcells: { 'workcell:elsewhere': 'address' } }), /attested by no machine declaration/);
  assert.doesNotThrow(() => publish({ workcells: { 'workcell:omarchy': 'address' } }), 'a remote named by the population is attested for address');
  assert.throws(() => projectCentralWikiWorld({ readings: readings().filter((reading) => !Array.isArray(reading.offers)), selection: selection(FULL), published_at: 'x' }), /no Workcell discovery reading/);
  assert.throws(() => publish({ practices: { [ALETHEIA]: ['skill/ql/not-carried'] } }), /not in agent\/aletheia's repertoire/);
  assert.throws(() => publish({ practices: { [ANIMA]: ['skill/ql/darshana'] } }), /"occupancy" or "repertoire" mode/);
  assert.throws(() => publish({ positions: { [ANIMA]: 'repertoire' }, practices: { [ANIMA]: ['skill/ql/darshana'] } }), /no agent participation reading/);
  assert.throws(() => publish({ activity: { 'run:absent': 'live' } }), /needs a factory.run-reading\/v1/);
  assert.throws(() => publish({ activity: { [RUN]: 'forever' } }), /must be live or static/);
});

test('repertoire mode publishes practices without any occupancy', () => {
  const bundle = publish({ positions: { [ALETHEIA]: 'repertoire' }, practices: { [ALETHEIA]: ['skill/ql/darshana'] } });
  const position = entry(bundle, ALETHEIA);
  assert.equal(position.meta.disclosure, 'repertoire');
  assert.equal(position.meta.occupancy, undefined);
  assert.equal(position.meta.agent_ref, 'agent/aletheia');
  assert.equal(relationsOf(bundle, 'oi.world/practises').length, 1);
  assert.ok(bundle.presentation.regions.some((region) => region.region_ref === 'practices'));
});

test('the renderer-safe sha256 agrees with node:crypto', async () => {
  const { createHash } = await import('node:crypto');
  const { sha256Digest } = await import('./world-constituents.mjs');
  for (const text of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'darshana — ∞/dx · #5→0\n'.repeat(300)]) {
    assert.equal(sha256Digest(text), `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`);
  }
});

// ── The capsule path: AIKit (≥ #455) proves the practice and the whole capsule travels ──
const nodeSha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
/** `aikit praxis read skill/ql/darshana --json` data, as AIKit #455 prints it. */
function darshanaReading({ body = DARSHANA_BODY, script = 'print("gaze")\n', scriptMode = 0o755, extra = [] } = {}) {
  const capsule = darshanaCapsule(body);
  capsule.files[0].bytes = new TextEncoder().encode(script);
  capsule.files[0].mode = scriptMode;
  const row = (path, mode, bytes) => ({ path, mode, bytes: bytes.length, sha256: nodeSha(bytes), text: new TextDecoder().decode(bytes) });
  return {
    schema: 'aikit.practice-reading/v1', id: 'skill/ql/darshana', name: 'darshana', form: 'skill',
    revision: aikitCapsuleRevision(capsule), revision_basis: 'aikit-capsule-revision-v2', source_id: 'ql', snapshot: 'e'.repeat(64),
    files: [row('manifest.toml', 0o644, capsule.manifest.bytes), ...capsule.files.map((file) => row(file.path, file.mode, file.bytes)).sort((a, b) => (a.path < b.path ? -1 : 1)), ...extra],
  };
}
const capsuleBody = (options) => { const reading = darshanaReading(options); return practiceOfferFromReading({ practice_ref: 'skill/ql/darshana', source_revision: reading.revision, reading }); };

test('capsule path: the offer carries AIKit\'s proven capsule — every file, its mode and the payload script — under the original id', () => {
  const body = capsuleBody();
  assert.equal(body.read_via, 'aikit-praxis-read');
  assert.equal(body.source_revision, DARSHANA_REVISION, 'the revision is AIKit\'s own, the same one the BLAKE3 fallback recomputes');
  const bundle = publish(FULL, { body });
  const { offer } = entry(bundle, 'skill/ql/darshana').meta;
  assert.equal(offer.text, DARSHANA_BODY, 'SKILL.md still travels as the body for continuity');
  assert.equal(offer.body_digest, sha256Digest(DARSHANA_BODY));
  assert.deepEqual(offer.payload_files_not_carried, []);
  assert.equal(offer.capsule.schema, 'aikit.practice-capsule/v1');
  assert.equal(offer.capsule.id, 'skill/ql/darshana', 'the capsule keeps its original id');
  assert.equal(offer.capsule.revision, DARSHANA_REVISION);
  assert.deepEqual(offer.capsule.exported_from, { source_id: 'ql', snapshot: 'e'.repeat(64) });
  const script = offer.capsule.files.find((file) => file.path === 'payload/scripts/darshana.py');
  assert.deepEqual(script, { path: 'payload/scripts/darshana.py', mode: 0o755, bytes: 14, sha256: nodeSha(new TextEncoder().encode('print("gaze")\n')), text: 'print("gaze")\n' });
  assert.deepEqual(offer.capsule.files.map((file) => file.path), ['manifest.toml', 'payload/SKILL.md', 'payload/scripts/darshana.py']);
  // The hosted row carries the capsule; a hosted reading re-validates it.
  const hostedRow = hostedPublicationArgs(bundle).putExploreEntries.find((row) => row.semanticRef === HOSTED('skill/ql/darshana'));
  assert.deepEqual(JSON.parse(hostedRow.entryJson).meta.offer.capsule, offer.capsule);
  assert.doesNotThrow(() => validatePracticeOfferBody(body));
});

test('capsule path refusals: another revision, modes and paths AIKit refuses, oversized binaries, tampered files', () => {
  const reading = darshanaReading();
  assert.throws(() => practiceOfferFromReading({ practice_ref: 'skill/ql/darshana', source_revision: 'f'.repeat(64), reading }), /refusing to publish its body/);
  assert.throws(() => practiceOfferFromReading({ practice_ref: 'skill/ql/other', source_revision: reading.revision, reading }), /AIKit read skill\/ql\/darshana instead/);
  assert.throws(() => capsuleBody({ scriptMode: 0o4755 }), /beyond rwx; AIKit refuses it/);
  const row = (path, text) => ({ path, mode: 0o644, bytes: new TextEncoder().encode(text).length, sha256: nodeSha(new TextEncoder().encode(text)), text });
  assert.throws(() => capsuleBody({ extra: [row('payload/../escape.md', 'x')] }), /unsafe capsule path/);
  assert.throws(() => capsuleBody({ extra: [row('payload/./dot.md', 'x')] }), /unsafe capsule path/);
  assert.throws(() => capsuleBody({ extra: [row('payload/skill.md', 'x')] }), /duplicate capsule path/);
  const big = new Uint8Array(256 * 1024 + 1);
  const b64 = Buffer.from(big).toString('base64');
  assert.throws(() => capsuleBody({ extra: [{ path: 'payload/assets/big.bin', mode: 0o644, bytes: big.length, sha256: nodeSha(big), base64: b64 }] }), /over the 262144-byte cap/);
  const small = Uint8Array.from([0, 255, 1, 254, 7]);
  assert.deepEqual([...base64Bytes(Buffer.from(small).toString('base64'))], [...small], 'the renderer-safe base64 decoder agrees with Buffer');
  assert.doesNotThrow(() => capsuleBody({ extra: [{ path: 'payload/assets/icon.bin', mode: 0o644, bytes: small.length, sha256: nodeSha(small), base64: Buffer.from(small).toString('base64') }] }));
  const tampered = capsuleBody();
  tampered.capsule.files[2].text = 'print("other")\n';
  assert.throws(() => validatePracticeOfferBody(tampered), /does not match its declared length and sha256/);
  assert.throws(() => capsuleBody({ body: '# gaze\n<script>alert(1)</script>\n' }), /not curated text data \(script-element\)/);
});

test('capsule path: a protected value inside a payload file refuses the whole publication', () => {
  const leaky = capsuleBody({ script: 'NOTES = "/Users/someone/notes/private.md"\n' });
  assert.throws(() => publish(FULL, { body: leaky, participation: { darshanaRevision: leaky.source_revision } }), /protected inhabitation material .*local-home-path/);
  const endpoint = capsuleBody({ script: 'URL = "redis://127.0.0.1:6381"\n' });
  assert.throws(() => publish(FULL, { body: endpoint, participation: { darshanaRevision: endpoint.source_revision } }), /protected inhabitation material/);
});

test('fallback path: an older AIKit\'s snapshot read carries SKILL.md only and says so', () => {
  const body = darshanaBody();
  assert.equal(body.read_via, 'aikit-snapshot-blake3');
  assert.equal(body.capsule, undefined);
  assert.deepEqual(body.payload_files_not_carried, ['payload/scripts/darshana.py']);
  assert.equal(entry(publish(FULL, { body }), 'skill/ql/darshana').meta.offer.capsule, undefined);
});
