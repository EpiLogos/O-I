/**
 * FieldNow / FieldDay live acceptance — the collective temporal projection
 * (WORKCELL-NOW-TEMPORAL-FIELD §9; O:I #13/#18, EpiLogos #65).
 *
 *   OI_SHARED_FIELD_TARGET=frank-acceptance node_modules/.bin/tsx field-now-live-acceptance.ts
 *
 * WORLD A (owner, workcell:mac) projects the Mac's real Workcell root NOW and
 * one real child NOW, read live from `ctrl central.now.list`. WORLD B (a
 * different transport identity, admitted as contributor) projects its own
 * child NOW situated on workcell:omarchy under Omarchy's real root NOW (read
 * over the tailnet when reachable). WORLD C is a third identity.
 *
 * Laws walked, server-side: compare-and-swap revisions (stale refused); root
 * NOW refs are owner-only; a contributor projects and withdraws only its own
 * attributed entries; a non-participant projects nothing and reads nothing
 * of a restricted field; every reader sees the same revision; nothing
 * local-only is accepted or served; FieldDay keeps its own interval while
 * source Day refs stay intact; revocation withdraws a participant's projected
 * entries in a server-authored next revision; a PRIVATE field's entries,
 * relations and counts appear for a third identity only while an explicit
 * read grant stands (grant-read / revoke-read through field.sh).
 *
 * Refuses the production targets outright.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createParticipant } from '../index.mjs';
import { createSharedField } from '../social.mjs';
import { advanceFieldDay, advanceFieldNow, fieldTimeLeaks } from '../field-now.mjs';

const TARGET_NAME = process.env.OI_SHARED_FIELD_TARGET ?? 'frank-acceptance';
if (['hosted', 'frank'].includes(TARGET_NAME)) throw new Error(`refusing to run acceptance against the retained field target "${TARGET_NAME}"`);
process.env.OI_SHARED_FIELD_TARGET = TARGET_NAME;
// Run-scoped transport tokens: nothing touches the operator's persisted owner token.
const STATE_HOME = mkdtempSync(join(tmpdir(), 'oi-field-now-acceptance-'));
process.env.OI_STATE_HOME = STATE_HOME;

const { close, fieldSnapshot, open, resolveTarget, rows, waitUntil, here } = await import('./field-lib');
const binding = resolveTarget();
if (!binding.bound) throw new Error(binding.reason);
const target = binding.target;
if (target.database === 'epilogos-oi-shared-field' || target.database === 'oi-shared-field') throw new Error(`refusing retained database ${target.database}`);

const RUN = Date.now().toString(36);
const FIELD = `oi:field:acceptance:field-now:${RUN}`;
const PRIVATE_FIELD = `oi:field:acceptance:field-now:${RUN}:private`;
const PA = `participant:acceptance:field-now:${RUN}:a-owner`;
const PB = `participant:acceptance:field-now:${RUN}:b`;
const PA_PRIVATE = `participant:acceptance:field-now:${RUN}:a-owner-private`;
const PC_PRIVATE = `participant:acceptance:field-now:${RUN}:c-private`;

/* ---------- real local NOW/DAY refs (refs + native revisions only) ---------- */

function centralRoot(): string {
  // worktrees/env-2/o-i/shared-field/spacetimedb → ~/Central
  return join(here, '..', '..', '..', '..', '..');
}
const localRoot = process.env.OI_ACCEPTANCE_CENTRAL_ROOT ?? centralRoot();
function localRead(action: string): any {
  const reply = JSON.parse(execFileSync('ctrl', ['--json', '--root', localRoot, 'action', 'run', action, '{}'], { cwd: localRoot, encoding: 'utf8', timeout: 30_000 }));
  assert.equal(reply.ok, true, `native local ${action}: ${JSON.stringify(reply.error)}`);
  return reply.data;
}
const nowRecords: any[] = localRead('central.now.list').records;
const macRoot = nowRecords.find((r) => r.workcell_ref === 'workcell:mac' && (process.env.OI_ACCEPTANCE_MAC_ROOT_NOW ? r.now_ref === process.env.OI_ACCEPTANCE_MAC_ROOT_NOW : r.horizon === 'workcell-root') && !r.parent_now_ref && r.lifecycle === 'active');
assert.ok(macRoot, 'the Mac Workcell root NOW is readable from Central');
const macChild = nowRecords.find((r) => r.parent_now_ref === macRoot.now_ref && r.lifecycle === 'active');
assert.ok(macChild, 'an active child NOW of the Mac root is readable from Central');
const dayReading = localRead('central.day.read');

// Acceptance requires the actual remote owner. A missing host/source is an
// unavailable branch, never a synthetic root or child that can turn green.
const shellQuote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
const remoteRoot = process.env.OI_ACCEPTANCE_OMARCHY_CENTRAL_ROOT ?? '/home/frank/Central';
const omarchyRead = (action: string) => {
  const reply = JSON.parse(execFileSync('ssh', ['-o', 'ConnectTimeout=6', '-o', 'BatchMode=yes', 'oi-omarchy', `PATH=/home/frank/.local/bin:$PATH oi central --json --root ${shellQuote(remoteRoot)} action run ${shellQuote(action)} '{}'`], { encoding: 'utf8', timeout: 30_000 }));
  assert.equal(reply.ok, true, `native remote ${action}: ${JSON.stringify(reply.error)}`);
  return reply.data;
};
const remoteRecords: any[] = omarchyRead('central.now.list').records;
const omarchyRoot = remoteRecords.find((r) => r.workcell_ref === 'workcell:omarchy' && (process.env.OI_ACCEPTANCE_OMARCHY_ROOT_NOW ? r.now_ref === process.env.OI_ACCEPTANCE_OMARCHY_ROOT_NOW : r.horizon === 'workcell-root') && !r.parent_now_ref && r.lifecycle === 'active');
assert.ok(omarchyRoot, 'the remote native Workcell root NOW is available');
const omarchyChild = remoteRecords.find((r) => r.parent_now_ref === omarchyRoot.now_ref && r.lifecycle === 'active');
assert.ok(omarchyChild, 'an actual remote native child NOW is available');
const remoteDayReading = omarchyRead('central.day.read');
const omarchyRootRef = omarchyRoot.now_ref;
const omarchySource = 'registered native oi central over the tailnet';
const OMARCHY_CHILD = omarchyChild.now_ref;

/* ---------- identities ---------- */

const a = await open(target, 'field-now-a');
const b = await open(target, 'field-now-b');
const c = await open(target, 'field-now-c');
assert.equal(new Set([a.identityHex, b.identityHex, c.identityHex]).size, 3, 'three distinct transport identities');
const ra: any = a.conn.reducers;
const rb: any = b.conn.reducers;
const rc: any = c.conn.reducers;

async function refused(run: () => Promise<unknown>, description: string, pattern?: RegExp): Promise<string> {
  try { await run(); } catch (error: any) {
    const message = String(error?.message ?? error);
    if (pattern) assert.match(message, pattern, `${description}: ${message}`);
    return message;
  }
  throw new Error(`${description} should have been refused server-side`);
}

const participant = (ref: string, fieldRef: string, name: string) => createParticipant({
  participant_ref: ref, field_ref: fieldRef, identity: { kind: 'human', ref: `human:acceptance:field-now:${RUN}:${name}` },
  presentation: { chosen_name: `World ${name.toUpperCase()}` },
  provenance: { source_system: 'central', source_revision: `central.content-fnv1a64/v1:1:${name}-${RUN}` },
});
const participantArgs = (p: any) => ({ participantRef: p.participant_ref, fieldRef: p.field_ref, identityKind: p.identity.kind, identityRef: p.identity.ref, sourceSystem: p.provenance.source_system, sourceRevision: p.provenance.source_revision, contractJson: JSON.stringify(p) });
const fieldArgs = (f: any) => ({ fieldRef: f.field_ref, kind: f.kind, visibility: f.visibility, contractJson: JSON.stringify(f) });

/* ---------- a restricted regional field, A owner, B contributor ---------- */

const field = createSharedField({ field_ref: FIELD, kind: 'general', visibility: 'restricted', title: 'FieldNow acceptance region', provenance: [{ kind: 'acceptance', ref: FIELD, source_system: 'o-i' }] });
await ra.putSharedField(fieldArgs(field));
await ra.putParticipant(participantArgs(participant(PA, FIELD, 'a')));
await ra.putParticipant(participantArgs(participant(PB, FIELD, 'b')));
await ra.grantParticipantAuthority({ fieldRef: FIELD, participantRef: PA, targetIdentity: a.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
await ra.grantParticipantAuthority({ fieldRef: FIELD, participantRef: PB, targetIdentity: b.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
await waitUntil(() => rows(b.conn.db.myFieldAuthority).some((row: any) => row.fieldRef === FIELD && row.participantRef === PB), 'B to hold its contributor grant');
const steps: string[] = ['A created a restricted field; A and B admitted as contributors under distinct identities; C is not a participant'];

const nowOf = (client: any) => rows(client.conn.db.fieldNow).find((row: any) => row.fieldRef === FIELD);
const provenance = [{ kind: 'projection', ref: 'central:action:central.now.list', source_system: 'central' }];

/* r1: A projects the Mac root + one real child NOW. */
const r1 = advanceFieldNow(null, {
  expected_revision: 0, projected_by: PA, field_ref: FIELD, audience: { visibility: 'restricted' }, provenance,
  upsert_root_now_refs: [{ now_ref: macRoot.now_ref, workcell_ref: 'workcell:mac', world_ref: macRoot.scope_ref, revision: macRoot.revision.revision }],
  upsert_child_now_refs: [{ now_ref: macChild.now_ref, parent_now_ref: macRoot.now_ref, workcell_ref: 'workcell:mac', purpose_summary: 'FieldNow/FieldDay packet (web65)', state: 'active' }],
});
await ra.putFieldNow({ fieldRef: FIELD, actorParticipantRef: '', expectedRevision: 0n, contractJson: JSON.stringify(r1) });
await waitUntil(() => Number(nowOf(b)?.revision) === 1, 'B to read FieldNow r1');
steps.push('A projected FieldNow r1: Mac Workcell root NOW + one real child NOW');

/* r2: B projects its own child NOW on workcell:omarchy with expected_revision=1. */
const readByB = JSON.parse(nowOf(b).contractJson);
const r2 = advanceFieldNow(readByB, {
  expected_revision: 1, projected_by: PB,
  upsert_child_now_refs: [{ now_ref: OMARCHY_CHILD, parent_now_ref: omarchyRootRef, workcell_ref: 'workcell:omarchy', purpose_summary: 'B undertaking on Omarchy', state: 'active' }],
});
await rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 1n, contractJson: JSON.stringify(r2) });
await waitUntil(() => Number(nowOf(a)?.revision) === 2 && Number(nowOf(b)?.revision) === 2, 'A and B to read FieldNow r2');
steps.push('B projected its own Omarchy child NOW with expected_revision=1 → r2');

/* Refusals. */
const refusals: Record<string, string> = {};
refusals.stale = await refused(() => rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 1n, contractJson: JSON.stringify({ ...r2, revision: 2 }) }), 'stale expected_revision', /moved on: field is at revision 2, writer expected 1/);
const rootByB = advanceFieldNow(r2, { expected_revision: 2, projected_by: PB, upsert_root_now_refs: [{ now_ref: omarchyRootRef, workcell_ref: 'workcell:omarchy', world_ref: 'control:root', revision: omarchyRoot.revision.revision }] });
refusals.contributor_root = await refused(() => rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(rootByB) }), 'contributor projecting a root NOW', /Only the field owner may project or withdraw root NOW refs/);
const hijack = advanceFieldNow(r2, { expected_revision: 2, projected_by: PB, withdraw_child_now_refs: [macChild.now_ref] });
refusals.foreign_entry = await refused(() => rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(hijack) }), 'contributor withdrawing another participant\'s child NOW', /may only project or withdraw its own entries/);
const byC = advanceFieldNow(r2, { expected_revision: 2, projected_by: PB, upsert_child_now_refs: [{ now_ref: OMARCHY_CHILD, parent_now_ref: omarchyRootRef, workcell_ref: 'workcell:omarchy', state: 'waiting' }] });
refusals.non_participant_as_b = await refused(() => rc.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(byC) }), 'non-participant impersonating B', /Caller is not bound to Participant/);
refusals.non_participant_as_owner = await refused(() => rc.putFieldNow({ fieldRef: FIELD, actorParticipantRef: '', expectedRevision: 2n, contractJson: JSON.stringify(byC) }), 'non-participant as owner', /Caller is not owner/);
// Bypass the client validator: the server itself refuses local-only material.
const leaking = JSON.parse(JSON.stringify(r2));
leaking.revision = 3;
leaking.projected_child_now_refs.find((entry: any) => entry.projected_by === PB).purpose_summary = 'resume from /Users/admin/Central/Control/agents/now/x.json';
refusals.server_leak_path = await refused(() => rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(leaking) }), 'a local path smuggled into FieldNow', /refuses local-only material/);
leaking.projected_child_now_refs.find((entry: any) => entry.projected_by === PB).purpose_summary = 'attach to ws://100.92.62.101:7788 claude-code:session:18a1d321';
refusals.server_leak_gateway = await refused(() => rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(leaking) }), 'a gateway/session smuggled into FieldNow', /refuses local-only material/);
leaking.projected_child_now_refs.find((entry: any) => entry.projected_by === PB).purpose_summary = 'B undertaking on Omarchy';
leaking.projected_child_now_refs.find((entry: any) => entry.projected_by === PB).session_space_ref = 'opaque';
refusals.server_extra_key = await refused(() => rb.putFieldNow({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(leaking) }), 'an undeclared key in FieldNow', /session_space_ref is not part of the contract/);
assert.equal(Number(nowOf(a).revision), 2, 'no refused write moved the revision');
steps.push('refused: stale revision, contributor root, foreign entry withdrawal, non-participant (as B and as owner), server-side leak (path, gateway/session, undeclared key)');

/* Same revision for every reader; C reads nothing of the restricted field. */
assert.equal(nowOf(a).contractJson, nowOf(b).contractJson, 'A and B read the identical FieldNow');
assert.equal(nowOf(c), undefined, 'C (non-participant) reads no FieldNow of a restricted field');
const snapshotB = fieldSnapshot(b);
const fieldNowB = snapshotB.field_now.find((reading: any) => reading.field_ref === FIELD);
assert.equal(fieldNowB.revision, 2);
assert.deepEqual(fieldTimeLeaks(fieldNowB.contract), [], 'nothing local-only is served');
const servedJson = JSON.stringify(snapshotB.field_now);
for (const needle of ['/Users/', '/home/', 'ws://', 'wss://', ':session:', STATE_HOME]) assert.ok(!servedJson.includes(needle), `served FieldNow contains no ${needle}`);
steps.push('A and B read the identical r2; C reads nothing; served FieldNow carries refs only');

/* ---------- FieldDay ---------- */

const dayOf = (client: any) => rows(client.conn.db.fieldDay).find((row: any) => row.fieldRef === FIELD);
const civil = String(dayReading.temporal?.civil_date ?? new Date().toISOString().slice(0, 10));
const interval = { start: `${civil}T00:00:00.000Z`, end: new Date(Date.parse(`${civil}T00:00:00.000Z`) + 86_400_000).toISOString(), policy: 'utc-day' };
const d1 = advanceFieldDay(null, {
  expected_revision: 0, projected_by: PA, field_ref: FIELD, interval, audience: { visibility: 'restricted' },
  temporal_policy_provenance: { source_system: 'oi', ref: 'oi:field-time-policy:utc-day', revision: '1' },
  upsert_source_day_refs: [{ day_ref: dayReading.day_ref, world_ref: `world:acceptance:${RUN}:a`, workcell_ref: 'workcell:mac' }],
  upsert_now_refs: [{ now_ref: macChild.now_ref }],
});
await ra.putFieldDay({ fieldRef: FIELD, actorParticipantRef: '', expectedRevision: 0n, contractJson: JSON.stringify(d1) });
await waitUntil(() => Number(dayOf(b)?.revision) === 1, 'B to read FieldDay r1');
const d2 = advanceFieldDay(JSON.parse(dayOf(b).contractJson), { expected_revision: 1, projected_by: PB, upsert_source_day_refs: [{ day_ref: remoteDayReading.day_ref, world_ref: `world:acceptance:${RUN}:b`, workcell_ref: 'workcell:omarchy' }], upsert_now_refs: [{ now_ref: OMARCHY_CHILD }] });
await rb.putFieldDay({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 1n, contractJson: JSON.stringify(d2) });
await waitUntil(() => Number(dayOf(a)?.revision) === 2, 'A to read FieldDay r2');
const policyByB = advanceFieldDay(d2, { expected_revision: 2, projected_by: PB, temporal_policy_provenance: { source_system: 'oi', ref: 'oi:field-time-policy:b-local', revision: '1' } });
refusals.day_policy_by_contributor = await refused(() => rb.putFieldDay({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(policyByB) }), 'contributor changing FieldDay policy', /Only the field owner may change/);
refusals.day_stale = await refused(() => rb.putFieldDay({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 1n, contractJson: JSON.stringify(d2) }), 'stale FieldDay', /FieldDay moved on/);
const foreignDay = JSON.parse(JSON.stringify(d2));
foreignDay.revision = 3;
foreignDay.projected_source_day_refs[0].projected_by = PB;
refusals.day_foreign_tuple = await refused(() => rb.putFieldDay({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(foreignDay) }), 'changing another world’s personal Day attribution', /may only project or withdraw its own entries/);
const duplicateDay = JSON.parse(JSON.stringify(d2));
duplicateDay.revision = 3;
duplicateDay.projected_source_day_refs.push({ ...duplicateDay.projected_source_day_refs[1] });
refusals.day_duplicate_tuple = await refused(() => rb.putFieldDay({ fieldRef: FIELD, actorParticipantRef: PB, expectedRevision: 2n, contractJson: JSON.stringify(duplicateDay) }), 'duplicate qualified personal Day', /more than once/);
const servedDay = JSON.parse(dayOf(a).contractJson);
assert.equal(servedDay.projected_source_day_refs.length, 2, 'both native personal Days survive even when their bare references match');
assert.equal(new Set(servedDay.projected_source_day_refs.map((entry: any) => entry.world_ref)).size, 2, 'personal Days retain their distinct worlds');
assert.deepEqual(servedDay.interval, interval, 'FieldDay keeps its own aggregation interval');
assert.equal(servedDay.projected_source_day_refs[0].day_ref, dayReading.day_ref, 'the local source Day ref stays intact');
steps.push('FieldDay r1 (A: interval + actual qualified local Day) → r2 (B adds actual qualified remote Day and NOW); foreign tuple, duplicate tuple, policy change and stale write refused');

/* ---------- the desktop doorway (field.sh) reads the same revision ---------- */

const fieldSh = join(here, 'field.sh');
function envelope(request: Record<string, unknown>, label: string): any {
  const out = execFileSync(fieldSh, [], { input: JSON.stringify(request), env: { ...process.env, OI_STATE_HOME: STATE_HOME, OI_SHARED_FIELD_TARGET: TARGET_NAME, OI_SHARED_FIELD_TOKEN_LABEL: label }, encoding: 'utf8', timeout: 60_000 });
  const parsed = JSON.parse(out.trim().split('\n').pop()!);
  if (!parsed.ok) throw new Error(`field.sh ${request.kind}: ${parsed.error?.message}`);
  return parsed.data;
}
const cliNow = envelope({ kind: 'field-now', field_ref: FIELD }, 'field-now-b');
assert.equal(cliNow.revision, 2);
const cliDay = envelope({ kind: 'field-day', field_ref: FIELD }, 'field-now-b');
assert.equal(cliDay.days[0].revision, 2);
const cliSnapshot = envelope({ kind: 'snapshot' }, 'field-now-b');
assert.ok(cliSnapshot.counts.field_now >= 1 && cliSnapshot.counts.field_day >= 1);
const cliCNow = envelope({ kind: 'field-now', field_ref: FIELD }, 'field-now-c');
assert.equal(cliCNow.contract, null, 'C via field.sh reads no FieldNow');
const r3cli = advanceFieldNow(cliNow.contract, { expected_revision: 2, projected_by: PB, upsert_child_now_refs: [{ now_ref: OMARCHY_CHILD, parent_now_ref: omarchyRootRef, workcell_ref: 'workcell:omarchy', purpose_summary: 'B undertaking on Omarchy', state: 'waiting' }] });
const putCli = envelope({ kind: 'field-now-put', field_now: r3cli, expected_revision: 2, actor_participant_ref: PB }, 'field-now-b');
assert.equal(putCli.revision, 3);
steps.push('field.sh (desktop doorway): field-now/field-day/snapshot read r2; C reads null; B advanced its own child state via field-now-put → r3');

/* ---------- revocation withdraws B's projected entries server-side ---------- */

await ra.revokeParticipantAuthority({ fieldRef: FIELD, participantRef: PB });
await waitUntil(() => Number(nowOf(a)?.revision) === 4, 'A to read the server-authored r4');
const afterRevoke = JSON.parse(nowOf(a).contractJson);
assert.ok(!afterRevoke.projected_child_now_refs.some((entry: any) => entry.projected_by === PB), 'B entries withdrawn');
assert.ok(afterRevoke.projected_child_now_refs.some((entry: any) => entry.now_ref === macChild.now_ref), 'A entries retained');
const dayAfterRevoke = JSON.parse(dayOf(a).contractJson);
assert.ok(!dayAfterRevoke.projected_now_refs.some((entry: any) => entry.projected_by === PB));
await waitUntil(() => !nowOf(b), 'revoked B to lose the restricted FieldNow');
steps.push('A revoked B: server-authored FieldNow r4 / FieldDay r3 withdrew B entries; B no longer reads the field');

/* ---------- PRIVATE field: entries/relations/counts appear only under a read grant ---------- */

const privateField = createSharedField({ field_ref: PRIVATE_FIELD, kind: 'general', visibility: 'private', title: 'Essay undertaking (private)', provenance: [{ kind: 'acceptance', ref: PRIVATE_FIELD, source_system: 'o-i' }] });
await ra.putSharedField(fieldArgs(privateField));
await ra.putParticipant(participantArgs(participant(PA_PRIVATE, PRIVATE_FIELD, 'a-private')));
await ra.putParticipant(participantArgs(participant(PC_PRIVATE, PRIVATE_FIELD, 'c-private')));
await ra.grantParticipantAuthority({ fieldRef: PRIVATE_FIELD, participantRef: PA_PRIVATE, targetIdentity: a.identity, role: 'contributor', contactable: false, ttlSeconds: 0 });
await ra.grantParticipantAuthority({ fieldRef: PRIVATE_FIELD, participantRef: PC_PRIVATE, targetIdentity: c.identity, role: 'observer', contactable: false, ttlSeconds: 0 });
const ENTRY_1 = `wiki:node:acceptance:field-now:${RUN}:essay`;
const ENTRY_2 = `wiki:node:acceptance:field-now:${RUN}:source`;
const entry = (ref: string, label: string) => ({ schema: 'oi.explore-entry/v1', ref, kind: 'wiki-node', world_ref: `world:acceptance:field-now:${RUN}`, label, summary: `${label} (acceptance)`, provenance: [{ kind: 'acceptance', ref, source_system: 'o-i', revision: `${ref}@1` }] });
for (const value of [entry(ENTRY_1, 'Essay'), entry(ENTRY_2, 'Source')]) {
  await ra.putExploreEntry({ semanticRef: value.ref, fieldRef: PRIVATE_FIELD, worldRef: value.world_ref, kind: value.kind, label: value.label, revision: '', entryJson: JSON.stringify(value) });
}
const relation = { relation_ref: `relation:acceptance:field-now:${RUN}:cites`, from: ENTRY_1, to: ENTRY_2, relation: 'oi.references', origin: 'acceptance', provenance: [{ kind: 'acceptance', ref: `relation:${RUN}`, source_system: 'o-i', revision: '1' }] };
await ra.putExploreRelation({ relationRef: relation.relation_ref, fieldRef: PRIVATE_FIELD, fromRef: relation.from, toRef: relation.to, relation: relation.relation, origin: relation.origin, relationJson: JSON.stringify(relation) });
await waitUntil(() => rows(a.conn.db.exploreRelation).some((row: any) => row.fieldRef === PRIVATE_FIELD), 'A to see its private relation');

const privateCounts = (client: any) => {
  const snapshot = fieldSnapshot(client);
  const entries = snapshot.entries.filter((value: any) => snapshot.entry_fields[value.ref] === PRIVATE_FIELD).length;
  const relations = snapshot.relations.filter((value: any) => snapshot.relation_fields[value.relation_ref] === PRIVATE_FIELD).length;
  return { field: snapshot.fields.some((value: any) => value.field_ref === PRIVATE_FIELD), entries, relations, counts: snapshot.counts };
};
await waitUntil(() => rows(c.conn.db.myFieldAuthority).some((row: any) => row.fieldRef === PRIVATE_FIELD), 'C to hold its observer grant');
const beforeGrant = privateCounts(c);
assert.deepEqual([beforeGrant.field, beforeGrant.entries, beforeGrant.relations], [false, 0, 0], 'membership alone does not read a private field');
const granted = envelope({ kind: 'grant-read', field_ref: PRIVATE_FIELD, participant_ref: PC_PRIVATE }, 'field-now-a');
assert.equal(granted.state, 'granted');
await waitUntil(() => privateCounts(c).relations === 1, 'C to read the private entries and relation after grant-read');
const afterGrant = privateCounts(c);
assert.deepEqual([afterGrant.field, afterGrant.entries, afterGrant.relations], [true, 2, 1]);
const revoked = envelope({ kind: 'revoke-read', field_ref: PRIVATE_FIELD, participant_ref: PC_PRIVATE }, 'field-now-a');
assert.equal(revoked.state, 'revoked');
await waitUntil(() => !privateCounts(c).field, 'C to lose the private field after revoke-read');
const afterRevokeRead = privateCounts(c);
assert.deepEqual([afterRevokeRead.field, afterRevokeRead.entries, afterRevokeRead.relations], [false, 0, 0]);
refusals.grant_read_by_non_owner = await refused(() => rc.grantFieldRead({ fieldRef: PRIVATE_FIELD, participantRef: PC_PRIVATE }), 'non-owner grant-read', /not owner/);
steps.push('private field: C (observer member) read 0 entries/0 relations → grant-read → 2/1 → revoke-read → 0/0; non-owner grant-read refused');

const receipt = {
  acceptance: 'oi-field-now-live',
  target: { name: target.name, uri: target.uri, database: target.database },
  run: RUN,
  field_ref: FIELD,
  private_field_ref: PRIVATE_FIELD,
  identities_distinct: 3,
  local_refs: {
    mac_root_now_ref: macRoot.now_ref,
    mac_root_revision: macRoot.revision.revision,
    mac_child_now_ref: macChild.now_ref,
    omarchy_root_now_ref: omarchyRootRef,
    omarchy_root_source: omarchySource,
    omarchy_child_now_ref: OMARCHY_CHILD,
    source_day_ref: dayReading.day_ref,
    remote_source_day_ref: remoteDayReading.day_ref,
    roots_explicit: { local: localRoot, remote: remoteRoot },
  },
  field_now_revisions: { owner_r1: 1, contributor_r2: 2, contributor_cli_r3: 3, revocation_r4: Number(nowOf(a).revision) },
  field_day_revisions: { owner_r1: 1, contributor_r2: 2, revocation: Number(dayOf(a).revision) },
  private_field_reads_by_c: { before_grant: beforeGrant, after_grant: afterGrant, after_revoke: afterRevokeRead },
  refusals,
  steps,
};
console.log(JSON.stringify(receipt, (key, value) => (key === 'counts' ? undefined : value), 2));
for (const client of [a, b, c]) close(client);
process.exit(0);
