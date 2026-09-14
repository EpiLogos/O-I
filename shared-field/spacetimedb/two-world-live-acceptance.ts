/**
 * Two independently grounded worlds meet in one hosted SharedField.
 *
 * WORLD A authors real source (a Central-shaped wiki reading), selects what
 * enters the field, publishes a Projection plus hosted edition, and owns the
 * SharedField. WORLD B has its own source root, its own Participant contract
 * and its own SpaceTimeDB transport identity (a distinct token). B discovers A
 * through the live Explore application, resolves exact semantic refs, inspects
 * the bounded neighbourhood, reads the actual hosted page, and contributes
 * under B's own Participant identity. The field quarantines that Contribution;
 * A admits it through server-side authority, receives the attributable
 * difference, re-projects a revision-checked P2 without touching its source
 * revision, and B's subscription observes the lawful new revision. Revocation,
 * reconnect, service interruption and withdrawal are then proven without
 * semantic identity or canonical-source loss.
 *
 * Readings for WORLD A come from `OI_WORLD_A_READINGS` (a directory holding the
 * JSON `data` of `central.wiki.read` as root.json and `projectcentral.wiki.read`
 * as project.json) when supplied — the owner's real Central — else from a
 * Central-shaped fixture carrying private sentinel material. WORLD B is always
 * an independent fixture world; it is never derived from A.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DbConnection } from './module_bindings/index';
import { createContribution } from '../social.mjs';
import { createParticipant, withdrawProjection } from '../index.mjs';
import { createExploreEntry } from '../explore.mjs';
import { createExploreTransportLifecycle } from '../transport-lifecycle.mjs';
import { createLiveExploreApplication, createSpacetimeExploreSource, projectionStorageKey, relationStorageRef } from '../spacetimedb.mjs';
import { exploreSurfaceSeedFromHostedSnapshot } from '../spacetimedb-explore-surface.mjs';
import { createExploreSurfaceModel } from '../explore-surface.mjs';
import { hostedPublicationArgs, projectCentralWikiWorld, publicationSentinelLeaks } from '../central-wiki-projection.mjs';
import { refineWorldPresentationProjection, worldPresentationFromProjection } from '../presentation-projection.mjs';
import { renderWorldEdition, worldEditionManifest } from '../world-edition.mjs';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const RUN = Date.now().toString(36);
const TIMEOUT_MS = 15_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SENTINELS = ['PRIVATE_SENTINEL', 'identity.md', 'wiki:node:identity', 'journal'];

type Client = { name: string; conn: DbConnection; identity: any; token: string; lifecycle: any };

async function connect(name: string, token?: string): Promise<Client> {
  const lifecycle = createExploreTransportLifecycle();
  return new Promise((resolve, reject) => {
    let builder = DbConnection.builder().withUri(URI).withDatabaseName(DATABASE);
    if (token) builder = builder.withToken(token);
    builder
      .onConnect((conn, identity, issued) => { lifecycle.connected(identity.toHexString()); resolve({ name, conn, identity, token: issued, lifecycle }); })
      .onConnectError((_ctx, error) => { lifecycle.connectError(error); reject(error); })
      .onDisconnect((_ctx, error) => lifecycle.disconnected(error))
      .build();
  });
}

async function subscribe(client: Client) {
  client.lifecycle.subscribing();
  await new Promise<void>((resolve, reject) => {
    client.conn.subscriptionBuilder()
      .onApplied(() => { client.lifecycle.applied(); resolve(); })
      .onError((_ctx, error) => { client.lifecycle.subscriptionError(error); reject(error); })
      .subscribe(['SELECT * FROM shared_field', 'SELECT * FROM participant', 'SELECT * FROM projection', 'SELECT * FROM contribution', 'SELECT * FROM explore_entry', 'SELECT * FROM explore_relation', 'SELECT * FROM my_field_authority', 'SELECT * FROM my_contribution_receipt']);
  });
}

async function waitUntil<T>(read: () => T | undefined | false | null, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function expectRejected(run: () => Promise<unknown>, description: string): Promise<string> {
  try { await run(); } catch (error: any) { return String(error?.message ?? error); }
  throw new Error(`${description} should have been refused server-side`);
}

const rows = (handle: any) => [...handle.iter()];

/* ---------- WORLD A: real or Central-shaped source ---------- */

function fixtureWorldAReadings() {
  const rootRevision = `central.content-fnv1a64/v1:1639:a-root-${RUN}`;
  const projectRevision = `central.content-fnv1a64/v1:837:a-project-${RUN}`;
  return {
    root: {
      schema: 'central.wiki-reading/v1', register: 'root', world_ref: 'control:root', profile: 'okf-wiki/v1',
      source: { path: 'Control/agents/wiki/wiki.json', ref: 'central:source:control:root:Control/agents/wiki/wiki.json', revision: rootRevision },
      spaces: [{ ref: 'central:wiki:root', title: 'Central', revision: 39, anchor_ref: 'wiki:node:identity', parent_space_refs: [], child_space_refs: ['central:wiki:project:O-I', 'central:wiki:project:PRIVATE_SENTINEL_LAB'], node_refs: ['wiki:node:identity', 'wiki:node:PRIVATE_SENTINEL_JOURNAL'] }],
      nodes: [
        { ref: 'wiki:node:identity', title: 'User identity', node_type: 'identity', revision: 1, space_refs: ['central:wiki:root'], source_refs: ['Control/user/identity.md'] },
        { ref: 'wiki:node:PRIVATE_SENTINEL_JOURNAL', title: 'PRIVATE_SENTINEL_JOURNAL', node_type: 'journal', revision: 2, space_refs: ['central:wiki:root'], source_refs: ['Control/user/journal/PRIVATE_SENTINEL_JOURNAL.md'] },
      ],
      relations: [
        { from_ref: 'wiki:node:identity', kind: 'node-source', to_ref: 'Control/user/identity.md' },
        { from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:O-I' },
        { from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:PRIVATE_SENTINEL_LAB' },
        { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:identity' },
        { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:PRIVATE_SENTINEL_JOURNAL' },
      ],
    },
    project: {
      schema: 'central.wiki-reading/v1', register: 'project', project: 'O-I', world_ref: 'project:O-I', profile: 'okf-wiki/v1',
      source: { path: 'ProjectCentral/agents/wiki/wiki.json', ref: 'central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json', revision: projectRevision },
      spaces: [{ ref: 'central:wiki:project:O-I', title: 'O-I', revision: 3, anchor_ref: 'wiki:node:project-root/o-i', parent_space_refs: ['central:wiki:root'], child_space_refs: [], node_refs: ['wiki:node:project-root/o-i'] }],
      nodes: [{ ref: 'wiki:node:project-root/o-i', title: 'O-I', node_type: 'project-root', revision: 1, space_refs: ['central:wiki:project:O-I'], source_refs: ['ProjectCentral/project.json'] }],
      relations: [
        { from_ref: 'wiki:node:project-root/o-i', kind: 'node-source', to_ref: 'ProjectCentral/project.json' },
        { from_ref: 'central:wiki:project:O-I', kind: 'space-node', to_ref: 'wiki:node:project-root/o-i' },
      ],
    },
  };
}

function worldAReadings() {
  const dir = process.env.OI_WORLD_A_READINGS;
  if (dir && existsSync(join(dir, 'root.json')) && existsSync(join(dir, 'project.json'))) {
    return { real: true, root: JSON.parse(readFileSync(join(dir, 'root.json'), 'utf8')), project: JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8')) };
  }
  return { real: false, ...fixtureWorldAReadings() };
}

const readingsA = worldAReadings();
const projectSpaceA = readingsA.project.spaces[0].ref as string;
const projectNodeA = readingsA.project.nodes[0].ref as string;
const WORLD_A = `world:acceptance:two-world:${RUN}:a`;
const FIELD_A = `oi:field:acceptance:two-world:${RUN}:a`;
const PROJECTION_A = `projection:acceptance:two-world:${RUN}:a`;
const PARTICIPANT_A = `participant:acceptance:two-world:${RUN}:a-owner`;

/* Hosted edition server: the actual page/assets a reader resolves. */
let editionHtml = '';
let editionManifest: any = null;
const editionServer = createServer((request, response) => {
  if (request.url === '/index.html' || request.url === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(editionHtml); return; }
  if (request.url === '/manifest.json') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(editionManifest)); return; }
  response.writeHead(404); response.end();
});
await new Promise<void>((resolve) => editionServer.listen(0, '127.0.0.1', resolve));
const editionBase = `http://127.0.0.1:${(editionServer.address() as any).port}`;

const selectionA = {
  schema: 'oi.central-wiki-selection/v1',
  world_ref: WORLD_A, subject_world_ref: readingsA.project.world_ref, field_ref: FIELD_A,
  projection_ref: PROJECTION_A, presentation_ref: `presentation:acceptance:two-world:${RUN}:a`,
  title: 'World A — a ProjectCentral world', summary: 'World A as its owner selected it for the shared field.',
  audience: { visibility: 'public' },
  publisher: { participant_ref: PARTICIPANT_A, identity_ref: `human:acceptance:two-world:${RUN}:a`, chosen_name: 'World A owner' },
  spaces: { 'central:wiki:root': 'address', [projectSpaceA]: 'nodes' },
  node_refs: [projectNodeA],
  disclose_source_refs: true,
};
const bundleA = projectCentralWikiWorld({ readings: [readingsA.root, readingsA.project], selection: selectionA, published_at: new Date().toISOString() });
const canonicalA = JSON.stringify(bundleA);
editionHtml = renderWorldEdition(bundleA.projection, { explore_base: `${editionBase}/explore.html` });
editionManifest = worldEditionManifest(bundleA.projection, editionHtml);
const argsA = hostedPublicationArgs(bundleA);
// The world entry carries the hosted edition locator so a reader can resolve the page from the field.
const worldEntryArg = argsA.putExploreEntries.find((entry) => entry.semanticRef === WORLD_A)!;
const worldEntry = createExploreEntry({ ...JSON.parse(worldEntryArg.entryJson), locators: [...JSON.parse(worldEntryArg.entryJson).locators, { surface: 'edition', locator: `${editionBase}/index.html` }, { surface: 'edition-manifest', locator: `${editionBase}/manifest.json` }] });
worldEntryArg.entryJson = JSON.stringify(worldEntry);
if (!readingsA.real) assert.deepEqual(publicationSentinelLeaks({ bundle: bundleA, args: argsA, html: editionHtml, manifest: editionManifest }, SENTINELS), []);

/* ---------- WORLD B: independent source root, Participant and transport identity ---------- */

const WORLD_B = `world:acceptance:two-world:${RUN}:b`;
const FIELD_B = `oi:field:acceptance:two-world:${RUN}:b`;
const PARTICIPANT_B_HOME = `participant:acceptance:two-world:${RUN}:b-owner`;
const PARTICIPANT_B_IN_A = `participant:acceptance:two-world:${RUN}:b-in-a`;
const readingsB = {
  root: {
    schema: 'central.wiki-reading/v1', register: 'root', world_ref: 'control:root', profile: 'okf-wiki/v1',
    source: { path: 'Control/agents/wiki/wiki.json', ref: 'central:source:control:root:Control/agents/wiki/wiki.json', revision: `central.content-fnv1a64/v1:2001:b-root-${RUN}` },
    spaces: [{ ref: 'central:wiki:root', title: 'Atelier', revision: 5, anchor_ref: 'wiki:node:identity', parent_space_refs: [], child_space_refs: ['central:wiki:project:Atelier'], node_refs: ['wiki:node:identity'] }],
    nodes: [{ ref: 'wiki:node:identity', title: 'Atelier identity', node_type: 'identity', revision: 1, space_refs: ['central:wiki:root'], source_refs: ['Control/user/identity.md'] }],
    relations: [{ from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:Atelier' }, { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:identity' }],
  },
  project: {
    schema: 'central.wiki-reading/v1', register: 'project', project: 'Atelier', world_ref: 'project:Atelier', profile: 'okf-wiki/v1',
    source: { path: 'ProjectCentral/agents/wiki/wiki.json', ref: 'central:source:project:Atelier:ProjectCentral/agents/wiki/wiki.json', revision: `central.content-fnv1a64/v1:411:b-project-${RUN}` },
    spaces: [{ ref: 'central:wiki:project:Atelier', title: 'Atelier', revision: 2, anchor_ref: 'wiki:node:project-root/atelier', parent_space_refs: ['central:wiki:root'], child_space_refs: [], node_refs: ['wiki:node:project-root/atelier'] }],
    nodes: [{ ref: 'wiki:node:project-root/atelier', title: 'Atelier', node_type: 'project-root', revision: 1, space_refs: ['central:wiki:project:Atelier'], source_refs: ['ProjectCentral/project.json'] }],
    relations: [{ from_ref: 'central:wiki:project:Atelier', kind: 'space-node', to_ref: 'wiki:node:project-root/atelier' }],
  },
};
const bundleB = projectCentralWikiWorld({
  readings: [readingsB.root, readingsB.project],
  selection: { schema: 'oi.central-wiki-selection/v1', world_ref: WORLD_B, subject_world_ref: 'project:Atelier', field_ref: FIELD_B, projection_ref: `projection:acceptance:two-world:${RUN}:b`, presentation_ref: `presentation:acceptance:two-world:${RUN}:b`, title: 'Atelier — World B', audience: { visibility: 'public' }, publisher: { participant_ref: PARTICIPANT_B_HOME, identity_ref: `human:acceptance:two-world:${RUN}:b`, chosen_name: 'Atelier owner' }, spaces: { 'central:wiki:root': 'address', 'central:wiki:project:Atelier': 'nodes' }, node_refs: ['wiki:node:project-root/atelier'], disclose_source_refs: false },
  published_at: new Date().toISOString(),
});
const argsB = hostedPublicationArgs(bundleB);

/* ---------- connect: two distinct transport identities ---------- */

const a = await connect('WORLD_A');
const b = await connect('WORLD_B');
assert.notEqual(a.identity.toHexString(), b.identity.toHexString(), 'worlds must not share a transport identity');
assert.notEqual(a.token, b.token, 'worlds must not share a token');
await subscribe(a);
await subscribe(b);
const liveA = createLiveExploreApplication(createSpacetimeExploreSource(a.conn.db, a.lifecycle));
const liveB = createLiveExploreApplication(createSpacetimeExploreSource(b.conn.db, b.lifecycle));
const ra: any = a.conn.reducers;
const rb: any = b.conn.reducers;

async function publish(client: Client, args: any) {
  const r: any = client.conn.reducers;
  await r.putSharedField(args.putSharedField);
  await r.putParticipant(args.putParticipant);
  await r.grantParticipantAuthority({ fieldRef: args.putSharedField.fieldRef, participantRef: args.putParticipant.participantRef, targetIdentity: client.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
  await r.putProjection(args.putProjection);
  for (const entry of args.putExploreEntries) await r.putExploreEntry(entry);
  for (const relation of args.putExploreRelations) await r.putExploreRelation(relation);
}

/* WORLD A publishes; WORLD B publishes its own world into its own field. */
await publish(a, argsA);
await publish(b, argsB);
const lifecycle: string[] = ['two distinct transport identities and tokens', 'A published P1 + entries + relations + edition', 'B published its own world into its own field'];

/* B cannot write into A's field: not owner, no participant grant. */
await expectRejected(() => rb.putExploreEntry({ ...argsA.putExploreEntries[1], label: 'forged' }), 'B forging an Explore entry in A\'s field');
await expectRejected(() => rb.putProjection({ ...argsA.putProjection, projectionKey: projectionStorageKey(PROJECTION_A, 2), projectionRevision: 2 }), 'B advancing A\'s Projection');
lifecycle.push('B refused as writer in A\'s field before any grant');

/* B discovers A through the live Explore application. */
await waitUntil(() => liveB.snapshot().entries.some((entry: any) => entry.ref === WORLD_A) && liveB.snapshot().relations.length >= argsA.putExploreRelations.length, 'B to observe A\'s published world');
const hitsB = liveB.search('World A', { limit: 8 });
assert.ok(hitsB.some((hit: any) => hit.ref === WORLD_A), 'B finds A by search');
const resolvedNode = liveB.resolve(`${WORLD_A}/${projectNodeA}`);
assert.equal(resolvedNode.world_ref, WORLD_A, 'B resolves A\'s exact node ref');
const openedByB = liveB.open(`${WORLD_A}/central:wiki:root`, { depth: 2, budget: 16 });
const neighbourhood = new Set(openedByB.relations.edges.flatMap((edge: any) => [edge.from, edge.to]));
assert.ok(neighbourhood.has(`${WORLD_A}/${projectSpaceA}`), 'B sees the root → child WikiSpace relation');
assert.ok(![...neighbourhood].some((ref: string) => ref.includes('PRIVATE_SENTINEL')), 'B sees no unprojected space');
const surfaceB = createExploreSurfaceModel(exploreSurfaceSeedFromHostedSnapshot(liveB.snapshot()));
assert.equal(surfaceB.presentationProjection(WORLD_A)?.projection_revision, 1, 'B reads P1 through the renderer-neutral Surface');
assert.equal(surfaceB.presentationProjection(WORLD_A)?.source.revision, bundleA.projection.source.revision);
lifecycle.push('B discovered A: search, exact ref resolution, bounded neighbourhood, P1 through the shared Surface');

/* B reads the actual hosted page and manifest A published. */
const worldEntrySeenByB = liveB.resolve(WORLD_A);
const editionLocator = worldEntrySeenByB.locators.find((locator: any) => locator.surface === 'edition')!.locator;
const pageResponse = await fetch(editionLocator);
assert.equal(pageResponse.status, 200);
const page = await pageResponse.text();
const manifest = await (await fetch(worldEntrySeenByB.locators.find((locator: any) => locator.surface === 'edition-manifest')!.locator)).json();
assert.match(page, new RegExp(`<meta name="oi:projection-ref" content="${PROJECTION_A}">`));
assert.equal(manifest.digest.value, worldEditionManifest(bundleA.projection, page).digest.value, 'served bytes match the manifest digest');
if (!readingsA.real) assert.deepEqual(publicationSentinelLeaks({ page, manifest }, SENTINELS), []);
lifecycle.push('B read the hosted edition and verified its manifest digest');

/* A admits B as a Participant in A's field, binding B's own transport identity — B's contract, A's authority. */
const participantBInA = createParticipant({ participant_ref: PARTICIPANT_B_IN_A, field_ref: FIELD_A, identity: { kind: 'human', ref: bundleB.participant.identity.ref }, presentation: { world_ref: WORLD_B, chosen_name: 'Atelier owner' }, provenance: { source_system: 'central', source_revision: readingsB.project.source.revision, source_ref: readingsB.project.source.ref } });
await ra.putParticipant({ participantRef: participantBInA.participant_ref, fieldRef: FIELD_A, identityKind: 'human', identityRef: participantBInA.identity.ref, sourceSystem: 'central', sourceRevision: readingsB.project.source.revision, contractJson: JSON.stringify(participantBInA) });
await ra.grantParticipantAuthority({ fieldRef: FIELD_A, participantRef: PARTICIPANT_B_IN_A, targetIdentity: b.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
await waitUntil(() => rows(b.conn.db.myFieldAuthority).some((row: any) => row.fieldRef === FIELD_A && row.participantRef === PARTICIPANT_B_IN_A), 'B to see its own authority grant');
lifecycle.push('A registered B\'s Participant (B\'s contract, B\'s identity) and granted contributor authority');

/* B contributes under its own Participant identity, from its own source. */
const CONTRIBUTION_B = `contribution:acceptance:two-world:${RUN}:b-reply`;
const contributionB = createContribution({
  contribution_ref: CONTRIBUTION_B, field_ref: FIELD_A, contributor_participant_ref: PARTICIPANT_B_IN_A, created_at: new Date().toISOString(), mode: 'reply',
  target: { kind: 'oi.projection', ref: PROJECTION_A }, relation: { kind: 'responds-to' },
  representation: { kind: 'oi.sparse-representation/v1', payload: { schema: 'oi.sparse-representation/v1', title: 'A reply from Atelier', description: `Atelier read ${WORLD_A} and answers from its own world.`, groups: [], meta: [{ label: 'from', value: WORLD_B }] } },
  provenance: [{ kind: 'authored', ref: WORLD_B, source_system: 'central', revision: readingsB.project.source.revision }],
  source: { system: 'central', revision: readingsB.project.source.revision },
});
await rb.submitContribution({ fieldRef: FIELD_A, contributorParticipantRef: PARTICIPANT_B_IN_A, transportMessageId: `msg:${RUN}:b-reply-1`, contractJson: JSON.stringify(contributionB) });
const receiptB = await waitUntil(() => rows(b.conn.db.myContributionReceipt).find((row: any) => row.contributionRef === CONTRIBUTION_B), 'B\'s Contribution receipt');
assert.equal(receiptB.state, 'quarantined');
assert.equal(rows(a.conn.db.contribution).filter((row: any) => row.contributionRef === CONTRIBUTION_B).length, 0, 'received ≠ admitted: nothing in the admitted view yet');
assert.equal(liveA.snapshot().entries.filter((entry: any) => entry.ref === CONTRIBUTION_B).length, 0, 'received ≠ indexed');
await expectRejected(() => ra.putExploreEntry({ semanticRef: CONTRIBUTION_B, fieldRef: FIELD_A, worldRef: WORLD_A, kind: 'contribution', label: 'x', revision: '', entryJson: JSON.stringify(createExploreEntry({ ref: CONTRIBUTION_B, kind: 'contribution', world_ref: WORLD_A, label: 'x', provenance: [{ kind: 'test', ref: 'x', source_system: 'oi-test' }] })) }), 'indexing a quarantined Contribution');
lifecycle.push('B contributed; the field quarantined it (received ≠ admitted ≠ indexed)');

/* A admits through real server-side authority; B cannot admit its own material. */
await expectRejected(() => rb.admitContribution({ ingressRef: receiptB.ingressRef, admissionParticipantRef: PARTICIPANT_B_IN_A, visibility: 'public', audienceRefsJson: '[]', reason: 'self-admission', evidenceJson: '{}' }), 'B admitting its own Contribution');
await ra.admitContribution({ ingressRef: receiptB.ingressRef, admissionParticipantRef: '', visibility: 'public', audienceRefsJson: '[]', reason: 'World A owner reviewed the reply from Atelier and admits it to the public field.', evidenceJson: JSON.stringify({ schema: 'oi.admission-evidence/v1', reviewed_by: PARTICIPANT_A, contribution_ref: CONTRIBUTION_B }) });
await ra.setContributionIndexEligibility({ ingressRef: receiptB.ingressRef, admissionParticipantRef: '', eligible: true, reason: 'Admitted public reply may be discovered.', evidenceJson: '{}' });
const admittedSeenByB = await waitUntil(() => rows(b.conn.db.contribution).find((row: any) => row.contributionRef === CONTRIBUTION_B), 'B to observe its admitted Contribution');
assert.equal(admittedSeenByB.contributorParticipantRef, PARTICIPANT_B_IN_A, 'attribution survives admission');
const admittedContract = JSON.parse(admittedSeenByB.contractJson);
assert.equal(admittedContract.source.revision, readingsB.project.source.revision, 'B\'s source revision travels with the Contribution');
const contributionEntry = createExploreEntry({ ref: CONTRIBUTION_B, kind: 'contribution', world_ref: WORLD_A, label: 'A reply from Atelier', summary: 'Admitted reply from World B', provenance: [{ kind: 'admitted-contribution', ref: CONTRIBUTION_B, source_system: 'o-i' }, { kind: 'authored', ref: WORLD_B, source_system: 'central', revision: readingsB.project.source.revision }], meta: { participant_ref: PARTICIPANT_B_IN_A } });
await ra.putExploreEntry({ semanticRef: CONTRIBUTION_B, fieldRef: FIELD_A, worldRef: WORLD_A, kind: 'contribution', label: contributionEntry.label, revision: '', entryJson: JSON.stringify(contributionEntry) });
const replyRelation = { relation_ref: `${CONTRIBUTION_B}#responds-to#${PROJECTION_A}`, from: CONTRIBUTION_B, to: WORLD_A, relation: 'responds-to', origin: 'contribution', provenance: [{ kind: 'admitted-contribution', ref: CONTRIBUTION_B, source_system: 'o-i' }] };
await ra.putExploreRelation({ relationRef: relationStorageRef(replyRelation), fieldRef: FIELD_A, fromRef: CONTRIBUTION_B, toRef: WORLD_A, relation: 'responds-to', origin: 'contribution', relationJson: JSON.stringify(replyRelation) });
lifecycle.push('A admitted and indexed B\'s Contribution under A\'s server-side authority; attribution and B\'s source revision preserved');

/* A receives the attributable difference and re-projects: P2 refines the representation, the source revision stays R1. */
const presentationA1 = worldPresentationFromProjection(bundleA.projection);
const presentationA2 = {
  ...presentationA1,
  regions: [...presentationA1.regions, { region_ref: 'replies', role: 'relation', label: 'Replies from other worlds', bindings: [{ schema: 'oi.presentation-binding/v1', binding_ref: `reply:${RUN}`, component_ref: 'oi.presentation/reference-card/v1', portable_renderer: 'oi.presentation/reference-card/v1', subject_ref: CONTRIBUTION_B, props: { title: 'A reply from Atelier', text: `Admitted Contribution from ${WORLD_B}`, refs: [CONTRIBUTION_B, WORLD_B] }, fallback: { title: 'A reply from Atelier' }, provenance: [{ kind: 'admitted-contribution', ref: CONTRIBUTION_B, source_system: 'o-i', revision: receiptB.ingressRef }] }] }],
};
const projectionA2 = refineWorldPresentationProjection(bundleA.projection, presentationA2, { publisher_participant_ref: PARTICIPANT_A, published_at: new Date().toISOString(), provenance: [{ kind: 'human-refinement', ref: PARTICIPANT_A, source_system: 'central', revision: bundleA.projection.source.revision }] });
assert.equal(projectionA2.projection_revision, 2);
assert.equal(projectionA2.source.revision, bundleA.projection.source.revision, 'the native source revision is untouched by re-projection');
assert.deepEqual(projectionA2.supersedes, { projection_ref: PROJECTION_A, projection_revision: 1, source_revision: bundleA.projection.source.revision });
await expectRejected(() => ra.putProjection({ ...argsA.putProjection, projectionKey: projectionStorageKey(PROJECTION_A, 3), projectionRevision: 3, contractJson: JSON.stringify({ ...projectionA2, projection_revision: 3 }) }), 'skipping a Projection revision');
await ra.putProjection({ projectionKey: projectionStorageKey(PROJECTION_A, 2), fieldRef: FIELD_A, projectionRef: PROJECTION_A, projectionRevision: 2, sourceRevision: projectionA2.source.revision, publisherParticipantRef: PARTICIPANT_A, state: 'published', contractJson: JSON.stringify(projectionA2) });
await waitUntil(() => liveB.snapshot().projections.some((projection: any) => projection.projection_ref === PROJECTION_A && projection.projection_revision === 2), 'B to observe P2 through its subscription');
const surfaceB2 = createExploreSurfaceModel(exploreSurfaceSeedFromHostedSnapshot(liveB.snapshot()));
assert.equal(surfaceB2.presentationProjection(WORLD_A).projection_revision, 2);
assert.equal(surfaceB2.presentationProjection(WORLD_A).source.revision, bundleA.projection.source.revision);
assert.ok(surfaceB2.presentation(WORLD_A).regions.some((region: any) => region.region_ref === 'replies'));
assert.ok(liveB.search('Atelier').some((hit: any) => hit.ref === CONTRIBUTION_B), 'B finds its admitted reply in A\'s index');
assert.equal(JSON.stringify(bundleA), canonicalA, 'A\'s local canonical publication is byte-identical after the hosted return');
lifecycle.push('A re-projected P2 with the returned difference; source R1 preserved; B observed the lawful new revision');

/* Revocation: A revokes B; B can no longer contribute and no longer sees its grant. */
await ra.revokeParticipantAuthority({ fieldRef: FIELD_A, participantRef: PARTICIPANT_B_IN_A });
await waitUntil(() => !rows(b.conn.db.myFieldAuthority).some((row: any) => row.fieldRef === FIELD_A), 'B\'s grant to disappear from its own View');
const revokedMessage = await expectRejected(() => rb.submitContribution({ fieldRef: FIELD_A, contributorParticipantRef: PARTICIPANT_B_IN_A, transportMessageId: `msg:${RUN}:b-reply-2`, contractJson: JSON.stringify({ ...contributionB, contribution_ref: `${CONTRIBUTION_B}-2` }) }), 'B contributing after revocation');
assert.ok(rows(b.conn.db.projection).some((row: any) => row.projectionRef === PROJECTION_A && row.projectionRevision === 2), 'public P2 remains readable to B after revocation');
lifecycle.push(`revocation enforced server-side (${revokedMessage.slice(0, 60)}); public reading unaffected`);

/* Reconnect: B returns with its saved token and is the same transport identity; still reads P2. */
b.conn.disconnect();
const bAgain = await connect('WORLD_B_RECONNECTED', b.token);
assert.equal(bAgain.identity.toHexString(), b.identity.toHexString(), 'saved token reconnects the same transport identity');
await subscribe(bAgain);
const liveBAgain = createLiveExploreApplication(createSpacetimeExploreSource(bAgain.conn.db, bAgain.lifecycle));
await waitUntil(() => liveBAgain.snapshot().projections.some((projection: any) => projection.projection_ref === PROJECTION_A && projection.projection_revision === 2), 'reconnected B to observe P2');
assert.equal(liveBAgain.status().transport.state, 'available');
lifecycle.push('B reconnected with its own token: same identity, P2 observed');

/* Service interruption for A: the canonical local world survives and the last-good reading is retained. */
a.conn.disconnect();
await waitUntil(() => liveA.status().transport.state === 'offline', 'A transport to report offline');
assert.equal(liveA.status().healthy, false);
assert.equal(liveA.status().material.state, 'validated', 'last-good material retained while offline');
assert.ok(liveA.snapshot().entries.some((entry: any) => entry.ref === WORLD_A), 'last-good snapshot retains A\'s world');
assert.equal(JSON.stringify(bundleA), canonicalA, 'service loss does not touch the canonical local publication');
const aAgain = await connect('WORLD_A_RECONNECTED', a.token);
assert.equal(aAgain.identity.toHexString(), a.identity.toHexString());
await subscribe(aAgain);
const raAgain: any = aAgain.conn.reducers;
await raAgain.putSharedField(argsA.putSharedField); // owner authority survives the interruption
lifecycle.push('A lost the service and returned: canonical world unchanged, owner authority intact');

/* Withdrawal: A withdraws P3; B stops seeing A\'s world entries. */
const projectionA3 = withdrawProjection(projectionA2, { published_at: new Date().toISOString(), reason: 'World A owner withdrew the public representation at the end of the acceptance.', provenance: [{ kind: 'human-withdrawal', ref: PARTICIPANT_A, source_system: 'central', revision: bundleA.projection.source.revision }] });
await raAgain.putProjection({ projectionKey: projectionStorageKey(PROJECTION_A, 3), fieldRef: FIELD_A, projectionRef: PROJECTION_A, projectionRevision: 3, sourceRevision: projectionA3.source.revision, publisherParticipantRef: PARTICIPANT_A, state: 'withdrawn', contractJson: JSON.stringify(projectionA3) });
await waitUntil(() => rows(bAgain.conn.db.projection).some((row: any) => row.projectionRef === PROJECTION_A && row.state === 'withdrawn'), 'B to observe the withdrawal');
assert.equal(liveBAgain.snapshot().projections.find((projection: any) => projection.projection_ref === PROJECTION_A).state, 'withdrawn');
assert.ok(liveBAgain.snapshot().entries.some((entry: any) => entry.ref === WORLD_A), 'the world stays addressable; its representation is withdrawn, not erased');
lifecycle.push('A withdrew the Projection; B observed the withdrawal; addressability retained, source history untouched');

const receipt = {
  acceptance: 'oi-two-world-shared-field',
  uri: URI, database: DATABASE, run: RUN,
  world_a: { world_ref: WORLD_A, field_ref: FIELD_A, projection_ref: PROJECTION_A, participant_ref: PARTICIPANT_A, source: bundleA.source, real_readings: readingsA.real, transport_identity: a.identity.toHexString() },
  world_b: { world_ref: WORLD_B, field_ref: FIELD_B, participant_ref_home: PARTICIPANT_B_HOME, participant_ref_in_a: PARTICIPANT_B_IN_A, source: bundleB.source, transport_identity: b.identity.toHexString() },
  contribution_ref: CONTRIBUTION_B, ingress_ref: receiptB.ingressRef,
  projection_revisions: { published: [1, 2], withdrawn: 3, source_revision_constant: bundleA.projection.source.revision },
  edition: { locator: editionLocator, digest: manifest.digest.value },
  lifecycle,
  laws_held: ['discoverable ≠ contactable ≠ writer', 'received ≠ admitted ≠ indexed', 'admitted ≠ canonical (source R1 unchanged)', 'transport identity ≠ Participant identity', 'service loss ≠ canonical loss', 'withdrawal ≠ erasure'],
};
console.log(JSON.stringify(receipt, null, 2));
liveA.dispose(); liveBAgain.dispose(); liveB.dispose();
try { aAgain.conn.disconnect(); } catch {}
try { bAgain.conn.disconnect(); } catch {}
editionServer.close();
