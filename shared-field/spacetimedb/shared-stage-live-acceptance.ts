/**
 * Shared Stage live acceptance — two independently admitted identities
 * deliberately co-inhabit one field (SF0/SF2 evidence for the optional
 * revisioned Shared Stage, O:I #18).
 *
 * WORLD A owns the field and presents. WORLD B is independently grounded (its
 * own source root, Participant contract and transport identity) and is
 * admitted by A. WORLD C is admitted as an observer only. The walk:
 *
 *   enter same field → live Presence
 *   → A opens the Shared Stage over admitted material
 *   → B (and C) explicitly follow
 *   → A changes admitted scene/focus → B receives the exact revision
 *   → approved authored presentation edit travels with causal refs
 *   → B unfollows without leaving the field; A keeps advancing
 *   → B re-follows and reconciles to the current stage revision
 *   → B reconnects: current stage restored; A's private Workspace never crosses
 *   → Contribution/Return stays a separate owner path; source untouched
 *   → the stage closes and leaves every view
 *   → the desktop-facing field.sh envelope drives the same stage lifecycle
 *
 * Laws held server-side: following is explicit and per-participant; a stale
 * writer is refused instead of silently winning; edits are immutable
 * attributable history; presence is live and cleared on disconnect; the
 * stage carries admitted shared presentation state only; the stage never
 * becomes source or Contribution authority.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DbConnection } from './module_bindings/index';
import { Identity } from 'spacetimedb';
import { createContribution } from '../social.mjs';
import { createParticipant } from '../index.mjs';
import { createExploreEntry } from '../explore.mjs';
import { createWatch } from '../watch.mjs';
import { createExploreTransportLifecycle } from '../transport-lifecycle.mjs';
import { createLiveExploreApplication, createSpacetimeExploreSource, projectionStorageKey } from '../spacetimedb.mjs';
import { hostedPublicationArgs, projectCentralWikiWorld } from '../central-wiki-projection.mjs';
import { advanceSharedStage, closeSharedStage, createSharedStage, createStageEdit } from '../shared-stage.mjs';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-stage-ci';
const RUN = Date.now().toString(36);
const TIMEOUT_MS = 15_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const SUBSCRIPTION = [
  'SELECT * FROM shared_field', 'SELECT * FROM participant', 'SELECT * FROM projection', 'SELECT * FROM contribution',
  'SELECT * FROM explore_entry', 'SELECT * FROM explore_relation', 'SELECT * FROM my_field_authority',
  'SELECT * FROM my_contribution_receipt', 'SELECT * FROM my_watch', 'SELECT * FROM my_contact',
  'SELECT * FROM shared_stage', 'SELECT * FROM my_stage_follow', 'SELECT * FROM field_presence',
];

async function subscribe(client: Client) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${client.name}: subscription did not apply`)), TIMEOUT_MS);
    client.conn.subscriptionBuilder()
      .onApplied(() => { clearTimeout(timer); resolve(); })
      .onError((_ctx, error) => { clearTimeout(timer); reject(error); })
      .subscribe(SUBSCRIPTION);
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
const stageOf = (client: Client, stageRef: string) => rows(client.conn.db.sharedStage).find((row: any) => row.stageRef === stageRef);
const followOf = (client: Client, stageRef: string, participantRef: string) =>
  rows(client.conn.db.myStageFollow).find((row: any) => row.stageRef === stageRef && row.followerParticipantRef === participantRef);
const presenceOf = (client: Client, fieldRef: string, participantRef: string) =>
  rows(client.conn.db.fieldPresence).find((row: any) => row.fieldRef === fieldRef && row.participantRef === participantRef);

/* ---------- WORLD A: a small authored world with a private sentinel ---------- */

const rootRevision = `central.content-fnv1a64/v1:1639:a-root-${RUN}`;
const projectRevision = `central.content-fnv1a64/v1:837:a-project-${RUN}`;
const readingsA = {
  root: {
    schema: 'central.wiki-reading/v1', register: 'root', world_ref: 'control:root', profile: 'okf-wiki/v1',
    source: { path: 'Control/agents/wiki/wiki.json', ref: 'central:source:control:root:Control/agents/wiki/wiki.json', revision: rootRevision },
    spaces: [{ ref: 'central:wiki:root', title: 'Central', revision: 39, anchor_ref: 'wiki:node:identity', parent_space_refs: [], child_space_refs: ['central:wiki:project:O-I'], node_refs: ['wiki:node:identity', 'wiki:node:PRIVATE_SENTINEL_JOURNAL'] }],
    nodes: [
      { ref: 'wiki:node:identity', title: 'User identity', node_type: 'identity', revision: 1, space_refs: ['central:wiki:root'], source_refs: ['Control/user/identity.md'] },
      { ref: 'wiki:node:PRIVATE_SENTINEL_JOURNAL', title: 'PRIVATE_SENTINEL_JOURNAL', node_type: 'journal', revision: 2, space_refs: ['central:wiki:root'], source_refs: ['Control/user/journal/PRIVATE_SENTINEL_JOURNAL.md'] },
    ],
    relations: [
      { from_ref: 'central:wiki:root', kind: 'space-child-space', to_ref: 'central:wiki:project:O-I' },
      { from_ref: 'central:wiki:root', kind: 'space-node', to_ref: 'wiki:node:identity' },
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
const WORLD_A = `world:acceptance:stage:${RUN}:a`;
const FIELD_A = `oi:field:acceptance:stage:${RUN}:a`;
const PROJECTION_A = `projection:acceptance:stage:${RUN}:a`;
const PARTICIPANT_A = `participant:acceptance:stage:${RUN}:a-owner`;
const PARTICIPANT_B = `participant:acceptance:stage:${RUN}:b`;
const PARTICIPANT_C = `participant:acceptance:stage:${RUN}:c-observer`;
const STAGE_A = `stage:acceptance:stage:${RUN}:a`;
const EXPRESSION_A = `expression:acceptance:stage:${RUN}:specimen`;

const bundleA = projectCentralWikiWorld({
  readings: [readingsA.root, readingsA.project],
  selection: {
    schema: 'oi.central-wiki-selection/v1', world_ref: WORLD_A, subject_world_ref: 'project:O-I', field_ref: FIELD_A,
    projection_ref: PROJECTION_A, presentation_ref: `presentation:acceptance:stage:${RUN}:a`,
    title: 'World A — staged specimen', summary: 'The field A presents on the Shared Stage.',
    audience: { visibility: 'public' },
    publisher: { participant_ref: PARTICIPANT_A, identity_ref: `human:acceptance:stage:${RUN}:a`, chosen_name: 'World A presenter' },
    spaces: { 'central:wiki:root': 'address', 'central:wiki:project:O-I': 'nodes' },
    node_refs: ['wiki:node:project-root/o-i'],
    disclose_source_refs: true,
  },
  published_at: new Date().toISOString(),
});
const canonicalA = JSON.stringify(bundleA);
const argsA = hostedPublicationArgs(bundleA);
const PRESENTATION_A = bundleA.projection.representation.kind === 'oi.world-presentation/v1'
  ? { ref: (bundleA.projection.representation as any).payload.presentation_ref, revision: 1 }
  : { ref: `presentation:acceptance:stage:${RUN}:a`, revision: 1 };

const provenanceA = [{ kind: 'authored', ref: PARTICIPANT_A, source_system: 'central', revision: projectRevision }];

/* ---------- connect: three distinct transport identities ---------- */

const a = await connect('WORLD_A');
const b = await connect('WORLD_B');
const c = await connect('WORLD_C_OBSERVER');
assert.notEqual(a.identity.toHexString(), b.identity.toHexString());
assert.notEqual(b.identity.toHexString(), c.identity.toHexString());
assert.notEqual(a.token, b.token);
await subscribe(a); await subscribe(b); await subscribe(c);
const liveA = createLiveExploreApplication(createSpacetimeExploreSource(a.conn.db, a.lifecycle));
const liveB = createLiveExploreApplication(createSpacetimeExploreSource(b.conn.db, b.lifecycle));
const ra: any = a.conn.reducers;
const rb: any = b.conn.reducers;
const rc: any = c.conn.reducers;

async function publish(client: Client, args: any) {
  const r: any = client.conn.reducers;
  await r.putSharedField(args.putSharedField);
  await r.putParticipant(args.putParticipant);
  await r.grantParticipantAuthority({ fieldRef: args.putSharedField.fieldRef, participantRef: args.putParticipant.participantRef, targetIdentity: client.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
  await r.putProjection(args.putProjection);
  for (const entry of args.putExploreEntries) await r.putExploreEntry(entry);
  for (const relation of args.putExploreRelations) await r.putExploreRelation(relation);
}

/* A publishes the field; B and C are admitted by A with B's and C's own contracts and identities. */
await publish(a, argsA);
const participantB = createParticipant({ participant_ref: PARTICIPANT_B, field_ref: FIELD_A, identity: { kind: 'human', ref: `human:acceptance:stage:${RUN}:b` }, presentation: { world_ref: 'world:acceptance:stage:independent-b', chosen_name: 'World B' }, provenance: { source_system: 'central', source_revision: `central.content-fnv1a64/v1:2001:b-${RUN}`, source_ref: 'central:source:project:Atelier:ProjectCentral/agents/wiki/wiki.json' } });
await ra.putParticipant({ participantRef: PARTICIPANT_B, fieldRef: FIELD_A, identityKind: participantB.identity.kind, identityRef: participantB.identity.ref, sourceSystem: participantB.provenance.source_system, sourceRevision: participantB.provenance.source_revision, contractJson: JSON.stringify(participantB) });
await ra.grantParticipantAuthority({ fieldRef: FIELD_A, participantRef: PARTICIPANT_B, targetIdentity: b.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
await ra.putParticipant({ participantRef: PARTICIPANT_C, fieldRef: FIELD_A, identityKind: 'human', identityRef: `human:acceptance:stage:${RUN}:c`, sourceSystem: 'central', sourceRevision: `central.content-fnv1a64/v1:2002:c-${RUN}`, contractJson: JSON.stringify(createParticipant({ participant_ref: PARTICIPANT_C, field_ref: FIELD_A, identity: { kind: 'human', ref: `human:acceptance:stage:${RUN}:c` }, provenance: { source_system: 'central', source_revision: `central.content-fnv1a64/v1:2002:c-${RUN}`, source_ref: 'central:source:project:Atelier:ProjectCentral/agents/wiki/wiki.json' } })) });
await ra.grantParticipantAuthority({ fieldRef: FIELD_A, participantRef: PARTICIPANT_C, targetIdentity: c.identity, role: 'observer', contactable: false, ttlSeconds: 0 });
await waitUntil(() => rows(b.conn.db.myFieldAuthority).some((row: any) => row.fieldRef === FIELD_A && row.participantRef === PARTICIPANT_B), 'B to see its own authority grant');
const lifecycle: string[] = ['three distinct transport identities; A owns the field; B admitted as contributor, C as observer, each bound to their own identity'];

/* An Expression specimen is admitted to the field so the stage's Expression
 * locus references material the field actually carries. */
await ra.putExploreEntry({ semanticRef: EXPRESSION_A, fieldRef: FIELD_A, worldRef: WORLD_A, kind: 'expression', label: 'Staged Expression specimen', revision: '1', entryJson: JSON.stringify(createExploreEntry({ ref: EXPRESSION_A, kind: 'expression', world_ref: WORLD_A, label: 'Staged Expression specimen', revision: '1', provenance: provenanceA })) });

/* ---------- enter the same field: live Presence ---------- */

await ra.enterField({ fieldRef: FIELD_A, participantRef: PARTICIPANT_A, state: 'entered' });
await rb.enterField({ fieldRef: FIELD_A, participantRef: PARTICIPANT_B, state: 'entered' });
await rc.enterField({ fieldRef: FIELD_A, participantRef: PARTICIPANT_C, state: 'entered' });
await waitUntil(() => presenceOf(a, FIELD_A, PARTICIPANT_B) && presenceOf(a, FIELD_A, PARTICIPANT_C) && presenceOf(b, FIELD_A, PARTICIPANT_A), 'mutual live presence across A, B and C');
await expectRejected(() => rb.enterField({ fieldRef: FIELD_A, participantRef: PARTICIPANT_A, state: 'entered' }), 'B announcing presence as A participant');
lifecycle.push('A, B and C entered the same field; presence is live and mutual; entering as another participant refused');

/* ---------- A opens the Shared Stage over admitted material ---------- */

const stage1 = createSharedStage({
  shared_stage_ref: STAGE_A,
  field_ref: FIELD_A,
  presenter_ref: PARTICIPANT_A,
  subject_ref: 'wiki:node:project-root/o-i',
  presentation: PRESENTATION_A,
  expression: { ref: EXPRESSION_A, revision: 1 },
  scene_ref: 'scene:opening',
  provenance: provenanceA,
});
await expectRejected(() => rc.openSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, presenterParticipantRef: PARTICIPANT_C, subjectRef: stage1.subject_ref, contractJson: JSON.stringify(stage1) }), 'observer opening a stage');
await expectRejected(() => rb.openSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, presenterParticipantRef: PARTICIPANT_B, subjectRef: stage1.subject_ref, contractJson: JSON.stringify({ ...stage1, presenter_ref: PARTICIPANT_A }) }), 'B opening a stage with a forged presenter');
await ra.openSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, presenterParticipantRef: PARTICIPANT_A, subjectRef: stage1.subject_ref, contractJson: JSON.stringify(stage1) });
await waitUntil(() => stageOf(b, STAGE_A), 'B to observe the opened stage');
assert.equal(Number(stageOf(b, STAGE_A).revision), 1);
await expectRejected(() => ra.openSharedStage({ fieldRef: FIELD_A, stageRef: `${STAGE_A}-2`, presenterParticipantRef: PARTICIPANT_A, subjectRef: stage1.subject_ref, contractJson: JSON.stringify(stage1) }), 'a second open stage in one field');
lifecycle.push('A opened the Shared Stage over admitted subject/presentation/expression refs (revision 1); observer and forged-presenter opens refused');

/* ---------- explicit follow ---------- */

await rb.followSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, followerParticipantRef: PARTICIPANT_B });
await rc.followSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, followerParticipantRef: PARTICIPANT_C });
const followB1 = await waitUntil(() => followOf(b, STAGE_A, PARTICIPANT_B), 'B follow row');
assert.equal(Number(followB1.followedAtRevision), 1, 'following binds to the revision read when the follow was made');
await waitUntil(() => followOf(c, STAGE_A, PARTICIPANT_C), 'C follow row');
await expectRejected(() => rb.followSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, followerParticipantRef: PARTICIPANT_A }), 'B following as A participant');
lifecycle.push('B and C explicitly followed the stage at revision 1; following as another participant refused');

/* ---------- presenter changes admitted scene/focus; follower receives the exact revision ---------- */

const stage2 = advanceSharedStage(stage1, { scene_ref: 'scene:harmonic-2', focus_ref: 'thing:m2-resonator', causal: { kind: 'action', ref: `oi:action:stage-focus:${RUN}` } }, { expected_revision: 1, presenter_ref: PARTICIPANT_A });
await ra.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_A, expectedRevision: 1n, contractJson: JSON.stringify(stage2) });
const stageRowB2 = await waitUntil(() => stageOf(b, STAGE_A) && Number(stageOf(b, STAGE_A).revision) === 2 ? stageOf(b, STAGE_A) : null, 'B to receive stage revision 2');
assert.deepEqual(JSON.parse(stageRowB2.contractJson), stage2, 'B received the exact presenter revision');
assert.equal(stageRowB2.presenterRef, PARTICIPANT_A);
await expectRejected(() => ra.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_A, expectedRevision: 1n, contractJson: JSON.stringify(stage1) }), 'stale writer advancing from revision 1');
lifecycle.push('A advanced admitted scene/focus to revision 2; B received the exact contract; a stale revision-1 writer was refused');

/* ---------- approved authored presentation edit, with causal refs ---------- */

const edit3 = createStageEdit({ edit_ref: `stage-edit:${RUN}:3`, participant_ref: PARTICIPANT_A, at_revision: 3, target: { kind: 'expression', ref: EXPRESSION_A, revision: 1 }, change: { resonance: 0.75 }, causal: { kind: 'activity', ref: `activity:central:owner:${RUN}` }, occurred_at: new Date().toISOString() });
const forgedEdit = createStageEdit({ ...edit3, participant_ref: PARTICIPANT_A, at_revision: 3, edit_ref: `stage-edit:${RUN}:forged` });
const stage3Forged = advanceSharedStage(stage2, { edit: forgedEdit }, { expected_revision: 2, presenter_ref: PARTICIPANT_A });
await expectRejected(() => rb.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_B, expectedRevision: 2n, contractJson: JSON.stringify({ ...stage3Forged, presenter_ref: PARTICIPANT_B }) }), 'B advancing with an edit attributed to A');
const stage3 = advanceSharedStage(stage2, { edit: edit3 }, { expected_revision: 2, presenter_ref: PARTICIPANT_A });
await ra.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_A, expectedRevision: 2n, contractJson: JSON.stringify(stage3) });
const stageRowB3 = await waitUntil(() => stageOf(b, STAGE_A) && Number(stageOf(b, STAGE_A).revision) === 3 ? stageOf(b, STAGE_A) : null, 'B to receive stage revision 3');
assert.deepEqual(JSON.parse(stageRowB3.contractJson), stage3);
assert.equal(stage3.edits.length, 1);
await expectRejected(() => {
  const tampered = JSON.parse(JSON.stringify(stage3)) as any;
  tampered.edits[0].change.resonance = 0.1;
  tampered.revision = 4;
  return ra.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_A, expectedRevision: 3n, contractJson: JSON.stringify(tampered) });
}, 'rewriting an edit already on the stage');
lifecycle.push('revision 3 carried an approved authored presentation edit with its causal Activity ref; forged attribution and edit rewriting refused');

/* ---------- unfollow keeps the local view without leaving the field ---------- */

await rb.unfollowSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, followerParticipantRef: PARTICIPANT_B });
await waitUntil(() => !followOf(b, STAGE_A, PARTICIPANT_B), 'B follow row to clear');
assert.ok(presenceOf(b, FIELD_A, PARTICIPANT_B), 'B is still present in the field');
assert.ok(rows(b.conn.db.myFieldAuthority).some((row: any) => row.fieldRef === FIELD_A && !row.revoked), 'B still holds its field authority');
const stage4 = advanceSharedStage(stage3, { focus_ref: 'being:orpheus', causal: { kind: 'action', ref: `oi:action:stage-focus-2:${RUN}` } }, { expected_revision: 3, presenter_ref: PARTICIPANT_A });
await ra.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_A, expectedRevision: 3n, contractJson: JSON.stringify(stage4) });
await waitUntil(() => stageOf(b, STAGE_A) && Number(stageOf(b, STAGE_A).revision) === 4, 'B to observe the field stage move on while unfollowed');
assert.equal(followOf(b, STAGE_A, PARTICIPANT_B), undefined, 'B is not dragged along while unfollowed');
await expectRejected(() => rc.advanceSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_C, expectedRevision: 4n, contractJson: JSON.stringify(advanceSharedStage(stage4, {}, { expected_revision: 4, presenter_ref: PARTICIPANT_C })) }), 'observer advancing the stage');
lifecycle.push('B unfollowed and kept presence, authority and its own local view; the stage moved to revision 4 without dragging B; observer advance refused');

/* ---------- re-follow reconciles to the current stage revision ---------- */

await rb.followSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, followerParticipantRef: PARTICIPANT_B });
const followB2 = await waitUntil(() => followOf(b, STAGE_A, PARTICIPANT_B) && Number(followOf(b, STAGE_A, PARTICIPANT_B).followedAtRevision) === 4 ? followOf(b, STAGE_A, PARTICIPANT_B) : null, 'B re-follow to bind to revision 4');
assert.equal(Number(followB2.followedAtRevision), 4, 're-follow reconciles to the current stage revision');
lifecycle.push('B re-followed and reconciled straight to the current revision 4');

/* ---------- reconnect restores the current stage, never another participant's Workspace ---------- */

const watchA = createWatch({ watch_ref: `watch:acceptance:stage:${RUN}:a`, watcher_participant_ref: PARTICIPANT_A, field_ref: FIELD_A, target: { kind: 'world', ref: WORLD_A }, created_at: new Date().toISOString(), provenance: { source_system: 'central', source_revision: projectRevision } });
await ra.putWatch({ watchRef: watchA.watch_ref, fieldRef: FIELD_A, watcherParticipantRef: PARTICIPANT_A, targetKind: watchA.target.kind, targetRef: watchA.target.ref, state: watchA.state, contractJson: JSON.stringify(watchA) });
await waitUntil(() => rows(a.conn.db.myWatch).some((row: any) => row.watchRef === watchA.watch_ref), 'A private Watch row');

b.conn.disconnect();
await waitUntil(() => !presenceOf(a, FIELD_A, PARTICIPANT_B), 'B presence to clear server-side on disconnect');
assert.ok(stageOf(a, STAGE_A), 'the stage outlives a participant connection');

const b2 = await connect('WORLD_B_RECONNECTED', b.token);
assert.equal(b2.identity.toHexString(), b.identity.toHexString(), 'saved token reconnects the same transport identity');
await subscribe(b2);
const stageRowB2Again = await waitUntil(() => stageOf(b2, STAGE_A) && Number(stageOf(b2, STAGE_A).revision) === 4 ? stageOf(b2, STAGE_A) : null, 'reconnected B to observe the current stage');
assert.deepEqual(JSON.parse(stageRowB2Again.contractJson), stage4);
assert.ok(followOf(b2, STAGE_A, PARTICIPANT_B), 'the explicit follow relation survives the reconnect');
assert.equal(rows(b2.conn.db.myWatch).length, 0, "A's private Watch never crossed into B's view");
assert.equal(rows(b2.conn.db.myContact).length, 0, "no private Contact state crossed into B's view");
assert.deepEqual(rows(b2.conn.db.myStageFollow).map((row: any) => row.followerParticipantRef), [PARTICIPANT_B], "B sees only its own follow relation");
const stageContractJson = JSON.parse(stageRowB2Again.contractJson);
for (const localDefault of ['tabs', 'splits', 'window', 'camera', 'viewport', 'search_history', 'agent_transcript', 'session_space', 'workspace', 'nara', 'gpu', 'audio', 'drafts']) {
  assert.equal(localDefault in stageContractJson, false, `reconnect must not import local ${localDefault} state`);
}
const rb2: any = b2.conn.reducers;
await rb2.enterField({ fieldRef: FIELD_A, participantRef: PARTICIPANT_B, state: 'entered' });
await waitUntil(() => presenceOf(a, FIELD_A, PARTICIPANT_B), 'reconnected B present again');
lifecycle.push('B reconnected: same identity, current stage revision 4 and its own follow restored; A private Watch/Contact state never crossed; no local view state in the stage contract');

/* ---------- Contribution/Return remains a separate owner path ---------- */

const CONTRIBUTION_B = `contribution:acceptance:stage:${RUN}:b-reply`;
const contributionB = createContribution({
  contribution_ref: CONTRIBUTION_B, field_ref: FIELD_A, contributor_participant_ref: PARTICIPANT_B, created_at: new Date().toISOString(), mode: 'reply',
  target: { kind: 'oi.projection', ref: PROJECTION_A }, relation: { kind: 'responds-to' },
  representation: { kind: 'oi.sparse-representation/v1', payload: { schema: 'oi.sparse-representation/v1', title: 'A reply from World B', description: 'Offered from the shared stage, but returned through the Contribution path.', groups: [], meta: [{ label: 'stage_ref', value: STAGE_A }] } },
  provenance: [{ kind: 'authored', ref: PARTICIPANT_B, source_system: 'central', revision: participantB.provenance.source_revision }],
});
await rb2.submitContribution({ fieldRef: FIELD_A, contributorParticipantRef: PARTICIPANT_B, transportMessageId: `msg:${RUN}:stage-reply`, contractJson: JSON.stringify(contributionB) });
const receiptB = await waitUntil(() => rows(b2.conn.db.myContributionReceipt).find((row: any) => row.contributionRef === CONTRIBUTION_B), 'B contribution receipt');
assert.equal(receiptB.state, 'quarantined');
const stageRowBeforeAdmission = JSON.stringify(stageOf(a, STAGE_A));
await ra.admitContribution({ ingressRef: receiptB.ingressRef, admissionParticipantRef: '', visibility: 'public', audienceRefsJson: '[]', reason: 'World A owner admits the reply through the receiving path, not the stage.', evidenceJson: '{}' });
await ra.setContributionIndexEligibility({ ingressRef: receiptB.ingressRef, admissionParticipantRef: '', eligible: true, reason: 'Admitted reply is discoverable.', evidenceJson: '{}' });
assert.equal(JSON.stringify(stageOf(a, STAGE_A)), stageRowBeforeAdmission, 'admission left the stage untouched');
assert.equal(JSON.parse(stageOf(a, STAGE_A).contractJson).edits.length, 1, 'the stage never absorbed the Contribution');
assert.equal(JSON.stringify(bundleA), canonicalA, 'stage and contribution churn never wrote the canonical source');
lifecycle.push('B contributed from the stage context; quarantine → admission stayed on the Contribution path; stage untouched; canonical source unchanged');

/* ---------- close: the stage leaves every view ---------- */

const closed5 = closeSharedStage(stage4, { expected_revision: 4 });
await ra.closeSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, actorParticipantRef: PARTICIPANT_A, expectedRevision: 4n, contractJson: JSON.stringify(closed5) });
await waitUntil(() => !stageOf(a, STAGE_A) && !stageOf(b2, STAGE_A), 'the closed stage to leave every view');
await waitUntil(() => !followOf(b2, STAGE_A, PARTICIPANT_B), 'follow relation to end with the stage');
assert.ok(presenceOf(b2, FIELD_A, PARTICIPANT_B), 'closing the stage does not remove anyone from the field');
await expectRejected(() => rb2.followSharedStage({ fieldRef: FIELD_A, stageRef: STAGE_A, followerParticipantRef: PARTICIPANT_B }), 'following a closed stage');
lifecycle.push('A closed the stage (revision 5, closed); every view dropped it; follows ended; the field relation remained');

/* ---------- the desktop-facing field.sh envelope drives the same lifecycle ---------- */

const stateHome = mkdtempSync(join(tmpdir(), 'oi-stage-cli-'));
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
function fieldClient(request: Record<string, unknown>, label: string): any {
  const stdout = execFileSync(join(repoRoot, 'shared-field', 'spacetimedb', 'field.sh'), [], {
    input: JSON.stringify(request),
    env: { ...process.env, OI_STATE_HOME: stateHome, SPACETIMEDB_URI: URI, SPACETIMEDB_DATABASE: DATABASE, OI_SHARED_FIELD_TOKEN_LABEL: label },
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  const envelope = JSON.parse(stdout.trim().split('\n').pop()!);
  if (!envelope.ok) throw new Error(`field.sh ${request.kind}: ${envelope.error?.message ?? 'refused'}`);
  return envelope.data;
}
const cliIdentity = fieldClient({ kind: 'identity', token_label: 'stage-cli' }, 'stage-cli').transport_identity;
const PARTICIPANT_CLI = `participant:acceptance:stage:${RUN}:cli`;
await ra.putParticipant({ participantRef: PARTICIPANT_CLI, fieldRef: FIELD_A, identityKind: 'human', identityRef: `human:acceptance:stage:${RUN}:cli`, sourceSystem: 'central', sourceRevision: `central.content-fnv1a64/v1:2003:cli-${RUN}`, contractJson: JSON.stringify(createParticipant({ participant_ref: PARTICIPANT_CLI, field_ref: FIELD_A, identity: { kind: 'human', ref: `human:acceptance:stage:${RUN}:cli` }, provenance: { source_system: 'central', source_revision: `central.content-fnv1a64/v1:2003:cli-${RUN}`, source_ref: 'central:source:project:Atelier:ProjectCentral/agents/wiki/wiki.json' } })) });
await ra.grantParticipantAuthority({ fieldRef: FIELD_A, participantRef: PARTICIPANT_CLI, targetIdentity: Identity.fromString(cliIdentity), role: 'contributor', contactable: true, ttlSeconds: 0 });
const entered = fieldClient({ kind: 'enter', field_ref: FIELD_A, participant_ref: PARTICIPANT_CLI }, 'stage-cli');
assert.equal(entered.state, 'entered');
const stageOpen = createSharedStage({ shared_stage_ref: `stage:acceptance:stage:${RUN}:cli`, field_ref: FIELD_A, presenter_ref: PARTICIPANT_CLI, subject_ref: 'wiki:node:project-root/o-i', presentation: PRESENTATION_A, provenance: provenanceA });
const opened = fieldClient({ kind: 'stage-open', stage: stageOpen }, 'stage-cli');
assert.equal(opened.revision, 1);
const followed = fieldClient({ kind: 'stage-follow', field_ref: FIELD_A, stage_ref: stageOpen.shared_stage_ref, follower_participant_ref: PARTICIPANT_CLI }, 'stage-cli');
assert.equal(followed.following, true);
const reading = fieldClient({ kind: 'stage', field_ref: FIELD_A }, 'stage-cli');
assert.equal(reading.stage.stage_ref, stageOpen.shared_stage_ref);
assert.equal(reading.my_follow.follower_participant_ref, PARTICIPANT_CLI);
const unfollowed = fieldClient({ kind: 'stage-unfollow', field_ref: FIELD_A, stage_ref: stageOpen.shared_stage_ref, follower_participant_ref: PARTICIPANT_CLI }, 'stage-cli');
assert.equal(unfollowed.following, false);
const closed = fieldClient({ kind: 'stage-close', stage: closeSharedStage(stageOpen, { expected_revision: 1 }), expected_revision: 1 }, 'stage-cli');
assert.equal(closed.state, 'closed');
lifecycle.push('the field.sh envelope path (kernel/desktop doorway) opened, followed, read, unfollowed and closed a stage under its own identity');

const receipt = {
  acceptance: 'oi-shared-stage-live',
  uri: URI, database: DATABASE, run: RUN,
  field_ref: FIELD_A, stage_ref: STAGE_A, projection_ref: PROJECTION_A,
  participants: { presenter: PARTICIPANT_A, follower: PARTICIPANT_B, observer: PARTICIPANT_C, cli: PARTICIPANT_CLI },
  revisions: { opened: 1, scene_focus: 2, edit: 3, unfollowed_advance: 4, closed: 5 },
  contribution_ref: CONTRIBUTION_B, ingress_state_path: 'quarantined → admitted (separate owner path)',
  source_untouched: JSON.stringify(bundleA) === canonicalA,
  lifecycle,
  laws_held: [
    'following is explicit and per-participant; unfollow keeps presence, authority and local view',
    'a stale writer is refused instead of silently winning (revision-checked advances)',
    'stage edits are immutable attributable history with causal Activity/Action refs',
    'presence is live: cleared on disconnect, never a ghost',
    'the stage carries admitted shared presentation state only',
    'reconnect restores the current stage and nothing of another participant\'s Workspace',
    'Contribution/Return stays a separate owner path; the stage never becomes source',
  ],
};
console.log(JSON.stringify(receipt, null, 2));
liveA.dispose(); liveB.dispose();
for (const client of [a, b, c, b2]) { try { client.conn.disconnect(); } catch {} }
process.exit(0);
