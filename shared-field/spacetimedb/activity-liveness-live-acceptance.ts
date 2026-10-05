/**
 * Activity liveness live acceptance (ACTIVITY-LIVE; EpiLogos/O-I #65/#220/#335/#154).
 *
 *   OI_SHARED_FIELD_TARGET=frank-acceptance node_modules/.bin/tsx activity-liveness-live-acceptance.ts
 *
 * The live Expression agrees with owner state; disconnecting or freezing the
 * owner producer degrades liveness rather than letting a renderer synthesise
 * it. Walked against the deployed module with three transport identities:
 *
 *   A owns a restricted field and publishes an activity entry for a REAL
 *     Factory run (read through `factory development run … --json`);
 *   the owner-side producer (scripts/activity-producer.mjs, A's identity)
 *     runs → B (a contributor, a different identity) reads `live` with the
 *     native whole-work state and owner revision (legacy lifecycle when absent);
 *   a second, one-shot connection under A's identity comes and goes → the
 *     producer's row survives (liveness is connection-scoped);
 *   producer SIGTERM → cleared → B reads `disconnected`;
 *   producer restarted, then kill -9 → the client-disconnect lifecycle clears
 *     → B reads `disconnected`;
 *   C (no participant) cannot put; B cannot speak for a participant it is not
 *     bound to; a revision regression and a same-revision state change are
 *     refused; a put for a non-activity entry is refused;
 *   a frozen edition of the same run replays as render steps only.
 *
 * Refuses the production targets outright.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createParticipant } from '../index.mjs';
import { createSharedField } from '../social.mjs';
import { createExploreEntry } from '../explore.mjs';
import { activityEdition, activityReading, replayActivity } from '../activity-liveness.mjs';

const TARGET_NAME = process.env.OI_SHARED_FIELD_TARGET ?? 'frank-acceptance';
if (['hosted', 'frank'].includes(TARGET_NAME)) throw new Error(`refusing to run acceptance against the retained field target "${TARGET_NAME}"`);
process.env.OI_SHARED_FIELD_TARGET = TARGET_NAME;
const STATE_HOME = mkdtempSync(join(tmpdir(), 'oi-activity-liveness-acceptance-'));
process.env.OI_STATE_HOME = STATE_HOME;

const { close, fieldSnapshot, open, resolveTarget, rows, waitUntil, here, sleep } = await import('./field-lib');
const binding = resolveTarget();
if (!binding.bound) throw new Error(binding.reason);
const target = binding.target;
if (target.database === 'epilogos-oi-shared-field' || target.database === 'oi-shared-field') throw new Error(`refusing retained database ${target.database}`);

/* ---------- the real Factory run ---------- */

const PROJECT_ROOT = process.env.OI_ACTIVITY_PROJECT_ROOT ?? join(here, '..', '..', '..', '..', '..', 'Work', 'O-I');
const factory = process.env.OI_FACTORY_BIN ?? 'factory';
const location = JSON.parse(execFileSync(factory, ['project', 'locate', PROJECT_ROOT, '--json'], { encoding: 'utf8' }));
assert.equal(typeof location.statePath, 'string', 'Factory discloses the project development state');
const RUN_REF = process.env.OI_ACTIVITY_RUN ?? 'run:01M3JJG94Q2RW4J32PYEM27QR7';
const readRun = () => JSON.parse(execFileSync(factory, ['development', 'run', location.statePath, RUN_REF, '--json'], { encoding: 'utf8' }));
const run = readRun();
assert.equal(run.contract, 'factory.run-reading/v1');

const RUN = Date.now().toString(36);
const FIELD = `oi:field:acceptance:activity-live:${RUN}`;
const WORLD = `world:acceptance:activity-live:${RUN}`;
const ACTIVITY = `${WORLD}/${RUN_REF}`;
const NOT_ACTIVITY = `${WORLD}/node:plain`;
const PA = `participant:acceptance:activity-live:${RUN}:a-owner`;
const PB = `participant:acceptance:activity-live:${RUN}:b`;

const a = await open(target, 'activity-a');
const b = await open(target, 'activity-b');
const c = await open(target, 'activity-c');
assert.equal(new Set([a.identityHex, b.identityHex, c.identityHex]).size, 3, 'three distinct transport identities');
const ra: any = a.conn.reducers;
const rb: any = b.conn.reducers;
const rc: any = c.conn.reducers;
const out: Record<string, unknown> = { target: { name: target.name, database: target.database }, field_ref: FIELD, activity_ref: ACTIVITY, run_ref: RUN_REF, factory_run: { lifecycle: run.lifecycle, revision: run.revision, factory_state_revision: run.provenance?.factoryStateRevision } };
const steps: string[] = [];

async function refused(runIt: () => Promise<unknown>, description: string, pattern?: RegExp): Promise<string> {
  try { await runIt(); } catch (error: any) {
    const message = String(error?.message ?? error);
    if (pattern) assert.match(message, pattern, `${description}: ${message}`);
    return message;
  }
  throw new Error(`${description} should have been refused server-side`);
}

const participant = (ref: string, name: string) => createParticipant({
  participant_ref: ref, field_ref: FIELD, identity: { kind: 'human', ref: `human:acceptance:activity-live:${RUN}:${name}` },
  presentation: { chosen_name: `World ${name.toUpperCase()}` },
  provenance: { source_system: 'central', source_revision: `central.content-fnv1a64/v1:1:${name}-${RUN}` },
});
const participantArgs = (p: any) => ({ participantRef: p.participant_ref, fieldRef: p.field_ref, identityKind: p.identity.kind, identityRef: p.identity.ref, sourceSystem: p.provenance.source_system, sourceRevision: p.provenance.source_revision, contractJson: JSON.stringify(p) });
const entryArgs = (entry: any) => ({ semanticRef: entry.ref, fieldRef: FIELD, worldRef: entry.world_ref, kind: entry.kind, label: entry.label, revision: entry.revision ?? '', entryJson: JSON.stringify(entry) });

/* ---------- A: field, participants, the published activity entry ---------- */

const field = createSharedField({ field_ref: FIELD, kind: 'general', visibility: 'restricted', title: 'Activity liveness acceptance', provenance: [{ kind: 'acceptance', ref: FIELD, source_system: 'o-i' }] });
await ra.putSharedField({ fieldRef: FIELD, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) });
await ra.putParticipant(participantArgs(participant(PA, 'a')));
await ra.putParticipant(participantArgs(participant(PB, 'b')));
await ra.grantParticipantAuthority({ fieldRef: FIELD, participantRef: PA, targetIdentity: a.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
await ra.grantParticipantAuthority({ fieldRef: FIELD, participantRef: PB, targetIdentity: b.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
const provenance = [{ kind: 'factory-run', ref: RUN_REF, source_system: 'factory', revision: String(run.revision) }];
// The publication CLAIMS live — exactly what world-constituents emits for a `live` selection.
const activityEntry = createExploreEntry({ ref: ACTIVITY, kind: 'activity', world_ref: WORLD, label: `Factory run ${RUN_REF.slice(4, 14)}`, summary: `activity · ${run.lifecycle} · live at publication · 0 participants`, revision: String(run.revision), provenance, meta: { standing: 'activity', local_ref: RUN_REF, state: run.lifecycle, run_ref: RUN_REF, participants: [], liveness: 'live', liveness_basis: 'publication' } });
await ra.putExploreEntry(entryArgs(activityEntry));
await ra.putExploreEntry(entryArgs(createExploreEntry({ ref: NOT_ACTIVITY, kind: 'wiki-node', world_ref: WORLD, label: 'A plain node', provenance: [{ kind: 'acceptance', ref: NOT_ACTIVITY, source_system: 'o-i' }] })));
await waitUntil(() => rows(b.conn.db.exploreEntry).some((row: any) => row.semanticRef === ACTIVITY), 'B to see the published activity entry');
steps.push('A created a restricted field, admitted A and B as contributors, and published an activity entry claiming `live` for a real Factory run; C is no participant');

/** B's honest reading of the activity, straight from B's subscription. */
function readingForB(nowMs = Date.now()) {
  const snapshot: any = fieldSnapshot(b);
  const entry = snapshot.entries.find((candidate: any) => candidate.ref === ACTIVITY);
  return activityReading({ entry, liveness_rows: snapshot.activity_liveness, now_ms: nowMs, field_ref: FIELD });
}
const before = readingForB();
assert.equal(before.liveness, 'disconnected', 'a publication claim of live with no producer never reads live');
out.before_producer = before;
steps.push(`before any producer B reads ${before.liveness} (basis ${before.basis}) although the publication claimed live`);

/* ---------- the owner-side producer ---------- */

const PRODUCER = join(here, '..', 'scripts', 'activity-producer.mjs');
type Producer = { child: ChildProcess; events: any[]; exit: Promise<{ code: number | null; signal: string | null }> };
function startProducer(): Producer {
  const child = spawn(process.execPath, [PRODUCER, '--field', FIELD, '--activity-ref', ACTIVITY, '--run', RUN_REF, '--state', location.statePath, '--interval', '1s', '--token-label', 'activity-a'], { env: { ...process.env, OI_STATE_HOME: STATE_HOME, OI_SHARED_FIELD_TARGET: TARGET_NAME }, stdio: ['ignore', 'pipe', 'pipe'] });
  const events: any[] = [];
  let buffer = '';
  child.stdout!.on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); try { events.push(JSON.parse(line)); } catch { events.push({ event: 'unparsed', line }); } }
  });
  child.stderr!.on('data', () => {});
  const exit = new Promise<{ code: number | null; signal: string | null }>((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  return { child, events, exit };
}
const liveRowForB = () => rows(b.conn.db.activityLiveness).find((row: any) => row.fieldRef === FIELD && row.activityRef === ACTIVITY);

let producer = startProducer();
await waitUntil(() => producer.events.some((event) => event.event === 'beat'), 'the producer to beat', 30_000);
assert.equal(producer.events.find((event) => event.event === 'connected')?.transport_identity, a.identityHex, 'the producer speaks as the field owner');
await waitUntil(() => liveRowForB(), 'B to see the producer row', 15_000);
const firstBeat = Number(liveRowForB().heartbeatAtMicros);
await waitUntil(() => Number(liveRowForB()?.heartbeatAtMicros ?? 0) > firstBeat, 'a second heartbeat', 15_000);
const live = readingForB();
const ownerNow = readRun();
const ownerState = ownerNow.nativeAttempts?.wholeRunState ?? ownerNow.lifecycle;
const ownerRevision = ownerNow.nativeAttempts?.revision ?? ownerNow.revision;
assert.equal(live.liveness, 'live');
assert.equal(live.basis, 'hosted-producer');
assert.equal(live.owner_state, ownerState, 'the live Expression agrees with the native owner state');
assert.equal(live.owner_revision, ownerRevision, 'the live Expression agrees with the owner revision');
out.live = live;
steps.push(`producer running (A identity, 1s interval) → B reads ${live.liveness}: owner_state=${live.owner_state} owner_revision=${live.owner_revision}, matching a direct Factory read`);

// Stale is a reading, not a server claim: the same row read far enough later degrades.
const stale = readingForB(Date.now() + 120_000);
assert.equal(stale.liveness, 'stale');
steps.push('the same producer row read 120 s later (no newer heartbeat) degrades to stale');

// A second connection under A's identity comes and goes: the producer's row is connection-bound and survives.
const aSecond = await open(target, 'activity-a');
assert.equal(aSecond.identityHex, a.identityHex);
close(aSecond);
await sleep(2_500);
assert.ok(liveRowForB(), 'an unrelated connection of the same identity leaving does not clear the producer');
assert.equal(readingForB().liveness, 'live');
steps.push('a one-shot connection under the same owner identity connected and left → the producer row survived (liveness is connection-scoped)');

/* ---------- authority and revision refusals (while the producer holds the row) ---------- */

const refusals: Record<string, string> = {};
refusals.non_participant = await refused(() => rc.putActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY, producerParticipantRef: '', ownerState: 'running', ownerRevision: BigInt(ownerRevision + 1) }), 'C (not owner, no participant) put', /not owner/);
refusals.unbound_participant = await refused(() => rc.putActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY, producerParticipantRef: PB, ownerState: 'running', ownerRevision: BigInt(ownerRevision + 1) }), 'C speaking for B', /not bound/);
refusals.state_without_revision = await refused(() => ra.putActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY, producerParticipantRef: '', ownerState: 'fabricated', ownerRevision: BigInt(ownerRevision) }), 'a changed state at the same revision', /without an owner revision advance/);
// B is a live contributor, but the row is the owner producer's: B can neither
// forge its state, push its revision to the ceiling, nor take the producer seat.
refusals.contributor_overwrites_owner_row = await refused(() => rb.putActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY, producerParticipantRef: PB, ownerState: 'fabricated', ownerRevision: 18446744073709551615n }), 'B overwriting the owner producer row', /held by another producer/);
assert.equal(liveRowForB()?.producerIdentity.toHexString(), a.identityHex, 'the owner producer still holds the row');
refusals.not_an_activity = await refused(() => ra.putActivityLiveness({ fieldRef: FIELD, activityRef: NOT_ACTIVITY, producerParticipantRef: '', ownerState: 'running', ownerRevision: 1n }), 'liveness for a non-activity entry', /No activity entry/);
refusals.clear_by_outsider = await refused(() => rc.clearActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY }), 'C clearing the owner producer', /Only the producing identity or the field owner/);
assert.equal(readingForB().owner_state, ownerState, 'no refused put changed the served owner state');
out.refusals = refusals;
steps.push('refused server-side: non-participant put; put for a participant the caller is not bound to; state change without revision advance; a contributor taking over the owner producer row (forged state, u64-max revision); liveness for a non-activity entry; clear by a non-producer');

/* ---------- graceful stop ---------- */

producer.child.kill('SIGTERM');
const termExit = await producer.exit;
assert.equal(termExit.code, 0, 'SIGTERM exits cleanly');
assert.ok(producer.events.some((event) => event.event === 'cleared' && event.signal === 'SIGTERM'), 'the producer cleared before exit');
await waitUntil(() => !liveRowForB(), 'B to see the producer row cleared', 15_000);
const afterTerm = readingForB();
assert.equal(afterTerm.liveness, 'disconnected');
out.after_sigterm = afterTerm;
steps.push(`producer SIGTERM → it cleared its row and exited 0 → B reads ${afterTerm.liveness} (basis ${afterTerm.basis})`);

/* ---------- hard kill ---------- */

producer = startProducer();
await waitUntil(() => producer.events.some((event) => event.event === 'beat'), 'the restarted producer to beat', 30_000);
await waitUntil(() => liveRowForB(), 'B to see the restarted producer row', 15_000);
assert.equal(readingForB().liveness, 'live');
producer.child.kill('SIGKILL');
const killExit = await producer.exit;
assert.equal(killExit.signal, 'SIGKILL');
assert.ok(!producer.events.some((event) => event.event === 'cleared'), 'a hard-killed producer cleared nothing itself');
const killedAt = Date.now();
await waitUntil(() => !liveRowForB(), 'the disconnect lifecycle to clear the killed producer row', 30_000);
const afterKill = readingForB();
assert.equal(afterKill.liveness, 'disconnected');
out.after_sigkill = { ...afterKill, cleared_within_ms: Date.now() - killedAt };
steps.push(`producer restarted → live; kill -9 → no self-clear; the client-disconnect lifecycle cleared the row within ${Date.now() - killedAt} ms → B reads ${afterKill.liveness}`);

/* ---------- revision never goes backwards ---------- */

await ra.putActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY, producerParticipantRef: '', ownerState: ownerState, ownerRevision: BigInt(ownerRevision + 2) });
await waitUntil(() => Number(liveRowForB()?.ownerRevision ?? 0) === ownerRevision + 2, 'B to see the advanced revision');
const regression = await refused(() => ra.putActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY, producerParticipantRef: '', ownerState: ownerState, ownerRevision: BigInt(ownerRevision + 1) }), 'revision regression', /must not go backwards/);
(out.refusals as any).revision_regression = regression;
await ra.clearActivityLiveness({ fieldRef: FIELD, activityRef: ACTIVITY });
await waitUntil(() => !liveRowForB(), 'the owner clear');
steps.push(`owner put revision ${ownerRevision + 2}, then ${ownerRevision + 1} → refused (revision must not go backwards); owner cleared`);

/* ---------- frozen edition + replay of the same run ---------- */

const edition = activityEdition({ entry: activityEntry, liveness_row: null, run_reading: readRun(), recorded_at: new Date().toISOString() });
let effectCalls = 0;
const replay = replayActivity(edition, { effects: () => { effectCalls += 1; } });
assert.equal(effectCalls, 0);
out.edition = { schema: edition.schema, owner_state: edition.owner_state, owner_revision: edition.owner_revision, lifecycle: edition.lifecycle, run_revision: edition.run_revision, native_attempts: edition.native_attempts, basis: edition.basis, events: edition.events, events_note: edition.events_note, scene_nodes: edition.scene.nodes.length, executions: edition.executions.length };
out.replay = { mode: replay.mode, live: replay.live, ordering: replay.ordering, steps: replay.steps.map((step: any) => step.kind), effect_calls: effectCalls };
steps.push(`frozen edition of ${RUN_REF}@${edition.owner_revision} replayed as ${replay.steps.length} render steps; effect runner calls: ${effectCalls}`);

/* ---------- a private publication narrows its entries (and their liveness) ---------- */

// D is read-granted (observer) and named in the private audience; B is a
// read-granted contributor left out of it. Entries name the publication's
// Projection exactly as the World publication path emits them.
const PD = `participant:acceptance:activity-live:${RUN}:d`;
const PRIVATE_WORLD = `${WORLD}:private`;
const PRIVATE_PROJECTION = `projection:acceptance:activity-live:${RUN}:private`;
const HIDDEN_ACTIVITY = `${PRIVATE_WORLD}/${RUN_REF}`;
const HIDDEN_PRACTICE = `${PRIVATE_WORLD}/skill/acceptance/offered`;
const NONEXISTENT = `${PRIVATE_WORLD}/run:does-not-exist`;
const OFFER_TEXT = `# Offered capsule ${RUN}\n`;
const d = await open(target, 'activity-d');
const rd: any = d.conn.reducers;
await ra.putParticipant(participantArgs(participant(PD, 'd')));
await ra.grantParticipantAuthority({ fieldRef: FIELD, participantRef: PD, targetIdentity: d.identity, role: 'observer', contactable: false, ttlSeconds: 0 });
const privateProjection = (revision: number, refs: string[]) => ({
  schema: 'oi.projection/v1', projection_ref: PRIVATE_PROJECTION, projection_revision: revision, state: 'published',
  subject: { kind: 'central-world', ref: PRIVATE_WORLD }, source: { system: 'central', ref: `central:source:${RUN}`, revision: `r${revision}` },
  publisher_participant_ref: PA, published_at: new Date().toISOString(), audience: { visibility: 'private', refs },
  provenance: [{ kind: 'human-publication', ref: PA, source_system: 'central', revision: `r${revision}` }],
});
const projectionArgs = (value: any) => ({ projectionKey: `${value.projection_ref}@${value.projection_revision}`, fieldRef: FIELD, projectionRef: value.projection_ref, projectionRevision: value.projection_revision, sourceRevision: value.source.revision, publisherParticipantRef: value.publisher_participant_ref, state: value.state, contractJson: JSON.stringify(value) });
await ra.putProjection(projectionArgs(privateProjection(1, [PD])));
await ra.putExploreEntry(entryArgs(createExploreEntry({ ref: HIDDEN_ACTIVITY, kind: 'activity', world_ref: PRIVATE_WORLD, label: 'Private run', projection_ref: PRIVATE_PROJECTION, provenance, meta: { standing: 'activity', local_ref: RUN_REF, state: run.lifecycle, run_ref: RUN_REF, participants: [], liveness: 'live', liveness_basis: 'publication' } })));
await ra.putExploreEntry(entryArgs(createExploreEntry({ ref: HIDDEN_PRACTICE, kind: 'practice', world_ref: PRIVATE_WORLD, label: 'Offered practice', projection_ref: PRIVATE_PROJECTION, provenance: [{ kind: 'aikit-practice', ref: 'skill/acceptance/offered', source_system: 'ai-kit', revision: '1' }], meta: { standing: 'practice', availability: 'offered', offer: { media_type: 'text/markdown', text: OFFER_TEXT } } })));
const seesEntry = (session: any, ref: string) => rows(session.conn.db.exploreEntry).find((row: any) => row.semanticRef === ref);
await waitUntil(() => seesEntry(d, HIDDEN_PRACTICE) && seesEntry(d, HIDDEN_ACTIVITY), 'D (in the audience) to see the private publication');
assert.equal(JSON.parse(seesEntry(d, HIDDEN_PRACTICE).entryJson).meta.offer.text, OFFER_TEXT, 'D reads the offered capsule');
await sleep(1_500);
assert.equal(seesEntry(b, HIDDEN_PRACTICE), undefined, 'B (read-granted, not in audience.refs) never receives the offered practice');
assert.equal(seesEntry(b, HIDDEN_ACTIVITY), undefined, 'B never receives the private activity');
assert.ok(seesEntry(b, ACTIVITY), 'B still sees the unscoped activity');
const privateOut: Record<string, unknown> = { audience_refs: [PD] };

// B probes the invisible entry: the refusal is exactly the nonexistent one.
const probeHidden = await refused(() => rb.putActivityLiveness({ fieldRef: FIELD, activityRef: HIDDEN_ACTIVITY, producerParticipantRef: PB, ownerState: 'running', ownerRevision: 1n }), 'B probing a private activity', /No activity entry/);
const probeMissing = await refused(() => rb.putActivityLiveness({ fieldRef: FIELD, activityRef: NONEXISTENT, producerParticipantRef: PB, ownerState: 'running', ownerRevision: 1n }), 'B probing a nonexistent activity', /No activity entry/);
assert.equal(probeHidden.replace(HIDDEN_ACTIVITY, '<ref>'), probeMissing.replace(NONEXISTENT, '<ref>'), 'invisible and nonexistent refuse identically');
privateOut.probe = { hidden: probeHidden.replace(HIDDEN_ACTIVITY, '<ref>'), missing: probeMissing.replace(NONEXISTENT, '<ref>') };

// The owner may speak for it; D reads the liveness row, B does not.
await ra.putActivityLiveness({ fieldRef: FIELD, activityRef: HIDDEN_ACTIVITY, producerParticipantRef: '', ownerState: run.lifecycle, ownerRevision: BigInt(run.revision) });
await waitUntil(() => rows(d.conn.db.activityLiveness).some((row: any) => row.activityRef === HIDDEN_ACTIVITY), 'D to see the private liveness row');
await sleep(1_000);
assert.ok(!rows(b.conn.db.activityLiveness).some((row: any) => row.activityRef === HIDDEN_ACTIVITY), 'B never sees the private liveness row');

// A narrowing re-projection (audience → B only) narrows the same entries at once.
await ra.putProjection(projectionArgs(privateProjection(2, [PB])));
await waitUntil(() => seesEntry(b, HIDDEN_PRACTICE) && !seesEntry(d, HIDDEN_PRACTICE), 'the re-projection to move the audience from D to B');
assert.equal(seesEntry(d, HIDDEN_ACTIVITY), undefined, 'D loses the activity with the narrowed audience');
await ra.clearActivityLiveness({ fieldRef: FIELD, activityRef: HIDDEN_ACTIVITY });
out.private_publication = privateOut;
steps.push('a private publication (audience D) → D reads the practice, its offered capsule and the activity liveness; read-granted B receives none of them; B probing the private activity gets the nonexistent-entry refusal verbatim; re-projecting to audience B moves every entry with it');
close(d);

close(a); close(b); close(c);
console.log(JSON.stringify({ schema: 'oi.activity-liveness-acceptance/v1', ok: true, ...out, steps }, null, 2));
process.exit(0);
