#!/usr/bin/env node
/**
 * Upgrade in place (O-I #858): the module this tree builds publishes over a
 * database the base revision's module already holds, and every row the base's
 * own client read before reads back, with every value it had, through this
 * tree's client after — for the field's owner and for a second world.
 *
 *   node shared-field/scripts/upgrade-in-place-acceptance.mjs \
 *     --base <the base revision's shared-field> --next shared-field \
 *     --server local --uri ws://127.0.0.1:3000 --database oi-shared-field-upgrade-ci --state <dir> [--spacetime <cli>]
 *
 * The base writes through its own doorways only: its publish-world (a
 * Central-shaped world), and its field.sh (a guest Participant, a quarantined
 * and an admitted Contribution, FieldNow, FieldDay, and the worlds, clearings,
 * stars and gatherings where the base has those acts). Its snapshot per
 * identity, taken before the upgrade, is the manifest. This tree's module is
 * then published over the database with --delete-data=never, so a schema
 * change SpaceTimeDB cannot migrate refuses here, and this tree's field.sh
 * reads each identity's snapshot back. New tables and new keys may appear;
 * nothing the base read may be lost or altered.
 *
 * Loopback only: it refuses a server or URI off this machine and any database
 * a hosting.json target names off this machine, and it clears its database
 * before the base publishes.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : fallback; };
const required = (name) => { const value = flag(name); if (!value) throw new Error(`${name} is required`); return value; };
const base = resolve(required('--base'));
const next = resolve(required('--next'));
const server = required('--server');
const uri = required('--uri');
const database = required('--database');
const state = resolve(required('--state'));
const spacetime = flag('--spacetime', 'spacetime');

/* ---------- loopback only ---------- */
const LOOPBACK = /^(?:wss?|https?):\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\/?$/;
if (!LOOPBACK.test(uri)) throw new Error(`refusing ${uri}: the upgrade proof runs against a SpaceTimeDB on this machine only`);
if (server !== 'local' && !LOOPBACK.test(server)) throw new Error(`refusing server ${server}: the upgrade proof publishes to this machine only`);
const hosting = JSON.parse(readFileSync(join(next, 'spacetimedb', 'hosting.json'), 'utf8'));
const retained = Object.values(hosting.targets ?? {}).filter((target) => target.server !== 'local' || !LOOPBACK.test(target.uri)).map((target) => target.database);
if (retained.includes(database)) throw new Error(`refusing ${database}: hosting.json names it off this machine`);
for (const tree of [base, next]) {
  if (!existsSync(join(tree, 'spacetimedb', 'node_modules', '.bin', 'tsx'))) throw new Error(`${tree}/spacetimedb has no installed client (npm install --prefix ${tree}/spacetimedb)`);
}

rmSync(state, { recursive: true, force: true });
mkdirSync(state, { recursive: true, mode: 0o700 });
const work = join(state, 'work');
mkdirSync(work, { recursive: true });

function run(command, args, { cwd, env, what } = {}) {
  const done = spawnSync(command, args, { cwd, env: env ?? process.env, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 300_000 });
  if (done.status !== 0) throw new Error(`${what ?? `${command} ${args.join(' ')}`} failed (exit ${done.status ?? done.signal}):\n${`${done.stdout}\n${done.stderr}`.trim().split('\n').slice(-25).join('\n')}`);
  return done.stdout;
}

/** The client environment: this database, this state home, one identity by label; nothing else of the caller's. */
function clientEnv(label) {
  const env = { ...process.env, SPACETIMEDB_URI: uri, SPACETIMEDB_DATABASE: database, OI_STATE_HOME: state };
  for (const key of ['OI_SHARED_FIELD_TARGET', 'OI_SHARED_FIELD_TOKEN_LABEL', 'CENTRAL_NATIVE_TOKEN']) delete env[key];
  if (label) env.OI_SHARED_FIELD_TOKEN_LABEL = label;
  return env;
}

/** One request through a tree's own doorway (field.sh, one-shot), as one identity. */
function ask(tree, label, request) {
  const done = spawnSync('bash', [join(tree, 'spacetimedb', 'field.sh')], { input: JSON.stringify(request), env: clientEnv(label), encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120_000 });
  const line = done.stdout.trim().split('\n').pop() ?? '';
  try { return JSON.parse(line); } catch { throw new Error(`${request.kind} through ${tree} answered no envelope (exit ${done.status ?? done.signal}):\n${done.stderr.trim().split('\n').slice(-12).join('\n')}`); }
}
function data(tree, label, request) {
  const envelope = ask(tree, label, request);
  if (!envelope.ok) throw new Error(`${request.kind} as ${label ?? 'owner'} through ${tree === base ? 'the base' : 'this tree'} was refused: ${envelope.error.message}`);
  return envelope.data;
}

function publish(tree, clear) {
  run(spacetime, ['publish', database, '--server', server, '--module-path', join(tree, 'spacetimedb'), `--delete-data=${clear ? 'always' : 'never'}`, '--yes=all'],
    { what: clear ? 'publishing the base module onto an empty database' : 'publishing this tree\'s module over the base module\'s rows' });
  run(spacetime, ['generate', '--lang', 'typescript', '--out-dir', join(tree, 'spacetimedb', 'module_bindings'), '--module-path', join(tree, 'spacetimedb')], { what: `generating ${tree} client bindings` });
}

/* ---------- 1. the base module, written through the base's own doorways ---------- */
publish(base, true);

const fixture = (name) => join(base, 'fixtures', `central-world-ci.${name}.json`);
const world = join(work, 'world');
run(process.execPath, [join(base, 'scripts', 'publish-world.mjs'), '--selection', fixture('selection'),
  ...['root-reading', 'project-reading', 'positions', 'population', 'constellation'].flatMap((name) => ['--reading', fixture(name)]), '--out', world], { what: 'the base projecting a Central-shaped world' });
run(join(base, 'spacetimedb', 'node_modules', '.bin', 'tsx'), [join(base, 'spacetimedb', 'publish-world.ts'), '--bundle', join(world, 'bundle.json'), '--receipt', join(world, 'receipt.json')],
  { cwd: join(base, 'spacetimedb'), env: clientEnv(), what: 'the base publishing that world' });
const receipt = JSON.parse(readFileSync(join(world, 'receipt.json'), 'utf8'));
const FIELD = receipt.field_ref;
const RUN = Date.now().toString(36);
const written = [`a Central-shaped world: ${receipt.entries.length} entries, ${receipt.relations.length} relations`];

const ownerIdentity = data(base, null, { kind: 'identity' }).transport_identity;
const guestIdentity = data(base, 'guest', { kind: 'identity' }).transport_identity;
assert.notEqual(ownerIdentity, guestIdentity, 'two identities');
const field = data(base, null, { kind: 'snapshot' }).fields.find((candidate) => candidate.field_ref === FIELD);
assert.ok(field, `the base reads its own field ${FIELD}`);
const OWNER_PARTICIPANT = data(base, null, { kind: 'snapshot' }).my_authority.find((grant) => grant.field_ref === FIELD && !grant.revoked)?.participant_ref;
assert.ok(OWNER_PARTICIPANT, 'the owner holds a Participant in its field');

const { createParticipant } = await import(pathToFileURL(join(base, 'index.mjs')).href);
const { createContribution } = await import(pathToFileURL(join(base, 'social.mjs')).href);
const { advanceFieldNow, advanceFieldDay } = await import(pathToFileURL(join(base, 'field-now.mjs')).href);

const GUEST_PARTICIPANT = `participant:upgrade:${RUN}:guest`;
data(base, null, { kind: 'participant', target_identity: guestIdentity, role: 'contributor', participant: createParticipant({
  participant_ref: GUEST_PARTICIPANT, field_ref: FIELD, identity: { kind: 'human', ref: `human:upgrade:${RUN}:guest` }, presentation: { chosen_name: 'A guest world' },
  provenance: { source_system: 'central', source_revision: `central.content-fnv1a64/v1:1:upgrade-${RUN}` } }) });
const contribution = (name) => createContribution({
  contribution_ref: `contribution:upgrade:${RUN}:${name}`, field_ref: FIELD, contributor_participant_ref: GUEST_PARTICIPANT, created_at: new Date().toISOString(), mode: 'reply',
  target: { kind: 'oi.projection', ref: receipt.projection_ref }, relation: { kind: 'responds-to' },
  representation: { kind: 'oi.sparse-representation/v1', payload: { schema: 'oi.sparse-representation/v1', title: `A ${name} reply`, description: 'Written before the upgrade.', groups: [], meta: [] } },
  provenance: [{ kind: 'authored', ref: `world:upgrade:${RUN}:guest`, source_system: 'central' }], source: { system: 'central' } });
const admitted = data(base, 'guest', { kind: 'contribute', contribution: contribution('admitted'), transport_message_id: `msg:upgrade:${RUN}:admitted` });
data(base, 'guest', { kind: 'contribute', contribution: contribution('waiting'), transport_message_id: `msg:upgrade:${RUN}:waiting` });
data(base, null, { kind: 'admit', ingress_ref: admitted.ingress_ref, contribution_ref: admitted.contribution_ref, field_ref: FIELD, reason: 'Admitted before the upgrade.', evidence: { schema: 'oi.admission-evidence/v1', reviewed_by: OWNER_PARTICIPANT }, visibility: field.visibility, index: true });
written.push('a guest Participant, one admitted and one quarantined Contribution');

const audience = { visibility: field.visibility };
data(base, null, { kind: 'field-now-put', expected_revision: 0, field_now: advanceFieldNow(null, {
  expected_revision: 0, projected_by: OWNER_PARTICIPANT, field_ref: FIELD, audience, provenance: [{ kind: 'projection', ref: 'central:action:central.now.list', source_system: 'central' }],
  upsert_root_now_refs: [{ now_ref: 'central:now:control:root:06cca2f04e1a408f451f36263de0d3c1dda2aa8547a27d3ed163c222bc711dea', workcell_ref: 'workcell:mac', world_ref: 'control:root', revision: 'central.content-fnv1a64/v1:863:cc1887a08302dcb5' }],
  upsert_child_now_refs: [{ now_ref: 'central:now:control:root:0a0a2fc9023a2a38203d9f7a27d2f0fc0edcdee60d9dd17f3e43690218fa649d', parent_now_ref: 'central:now:control:root:06cca2f04e1a408f451f36263de0d3c1dda2aa8547a27d3ed163c222bc711dea', workcell_ref: 'workcell:mac', purpose_summary: 'Written before the upgrade', state: 'active' }] }) });
data(base, null, { kind: 'field-day-put', expected_revision: 0, field_day: advanceFieldDay(null, {
  expected_revision: 0, projected_by: OWNER_PARTICIPANT, field_ref: FIELD, audience, interval: { start: '2026-09-28T00:00:00.000Z', end: '2026-09-29T00:00:00.000Z', policy: 'utc-day' },
  temporal_policy_provenance: { source_system: 'oi', ref: 'oi:field-time-policy:utc-day', revision: '1' }, upsert_source_day_refs: [{ day_ref: 'central:day:control:root:2026-09-28', workcell_ref: 'workcell:mac' }] }) });
written.push('FieldNow and FieldDay at revision 1');

const body = (ref, seed) => ({ body_ref: ref, seed, generator: { id: 'fbm-sphere', version: 2 }, landmass: { sea_level: 0.5, continents: 1.7, relief: 0.55, coast: 'smooth' },
  climate: { warmth: 0.58, moisture: 0.6, ice_caps: 0.3 }, sky: { atmosphere: 0.6, clouds: 0.35, axial_tilt_deg: 18 } });
const OWNER_WORLD = `world:upgrade:${RUN}:owner`, GUEST_WORLD = `world:upgrade:${RUN}:guest`;
const firstWorld = ask(base, null, { kind: 'world-put', world_ref: OWNER_WORLD, body: body(`body:upgrade:${RUN}:owner`, 1234), linked: true });
const skipped = [];
if (!firstWorld.ok && /unknown request kind: world-put/.test(firstWorld.error.message)) {
  skipped.push('worlds, clearings, stars and gatherings (the base module has no world acts)');
} else {
  assert.ok(firstWorld.ok, `world-put through the base: ${firstWorld.error?.message}`);
  const OPEN = `star:upgrade-${RUN}-open`, ASKED = `star:upgrade-${RUN}-asked`, WAITING = `star:upgrade-${RUN}-waiting`;
  data(base, 'guest', { kind: 'world-put', world_ref: GUEST_WORLD, body: body(`body:upgrade:${RUN}:guest`, 98765), linked: true });
  data(base, null, { kind: 'clearing-open', world_ref: OWNER_WORLD, part_ref: 'page:upgrade-public', audience: 'public', shown: { kind: 'page', label: 'Shown to the public before the upgrade' } });
  data(base, null, { kind: 'clearing-open', world_ref: OWNER_WORLD, part_ref: 'place:upgrade-field', audience: 'field', shown: { kind: 'place', label: 'Shown to the field', at: { lat: 48.2, lon: 16.37 } } });
  data(base, null, { kind: 'star-light', star_ref: OPEN, world_ref: OWNER_WORLD, name: 'An open star', gathers: 'Anything said before the upgrade', comes: 'anyone' });
  data(base, null, { kind: 'star-light', star_ref: ASKED, world_ref: OWNER_WORLD, name: 'An asked star', gathers: 'Readings let in by the lighter', comes: 'asked' });
  data(base, null, { kind: 'star-light', star_ref: WAITING, world_ref: OWNER_WORLD, name: 'A star with a world at its edge', gathers: 'Readings still waiting', comes: 'asked' });
  data(base, 'guest', { kind: 'star-gather', star_ref: OPEN, world_ref: GUEST_WORLD });
  data(base, 'guest', { kind: 'star-gather', star_ref: ASKED, world_ref: GUEST_WORLD });
  data(base, null, { kind: 'star-admit', star_ref: ASKED, world_ref: GUEST_WORLD });
  data(base, 'guest', { kind: 'star-gather', star_ref: WAITING, world_ref: GUEST_WORLD });
  data(base, 'guest', { kind: 'clearing-open', world_ref: GUEST_WORLD, part_ref: 'page:upgrade-at-star', audience: 'star', star_ref: OPEN, shown: { kind: 'page', label: 'Shown at the open star' } });
  written.push('two worlds, three clearings, three stars, gathered, let-in and waiting gatherings');
  const QUESTION = `saying:upgrade-${RUN}-question`;
  const asked = ask(base, null, { kind: 'star-say', saying_ref: QUESTION, star_ref: OPEN, world_ref: OWNER_WORLD, to: { world_ref: GUEST_WORLD, part_ref: 'page:upgrade-at-star' }, what: 'question', words: 'Asked before the upgrade' });
  if (!asked.ok && /unknown request kind: star-say/.test(asked.error.message)) {
    skipped.push('what was said at a star (the base module keeps none)');
  } else {
    assert.ok(asked.ok, `star-say through the base: ${asked.error?.message}`);
    data(base, 'guest', { kind: 'star-say', saying_ref: `saying:upgrade-${RUN}-finding`, star_ref: OPEN, world_ref: GUEST_WORLD, to: { saying_ref: QUESTION }, what: 'finding', words: 'Answered before the upgrade' });
    written.push('a question said at a star and the finding that answers it');
  }
}

/* ---------- 2. what each identity read before the upgrade is the manifest ---------- */
const UNCOMPARED = new Set(['schema', 'target', 'status', 'transport_identity', 'relation_errors']);
const before = { owner: data(base, null, { kind: 'snapshot' }), guest: data(base, 'guest', { kind: 'snapshot' }) };
for (const key of ['fields', 'participants', 'projections', 'entries', 'relations', 'contributions', 'my_authority', 'owner_pending_contributions', 'field_now', 'field_day']) {
  assert.ok(Array.isArray(before.owner[key]) && before.owner[key].length > 0, `the base wrote and its owner reads ${key} before the upgrade`);
}
assert.ok(before.guest.my_contribution_receipts?.length === 2, 'the guest reads both its Contribution receipts before the upgrade');
if (firstWorld.ok) for (const key of ['worlds', 'clearings', 'stars', 'gatherings']) {
  assert.ok(before.owner[key]?.length > 0 && before.guest[key]?.length > 0, `both identities read ${key} before the upgrade`);
}
if (written.includes('a question said at a star and the finding that answers it')) for (const who of ['owner', 'guest']) {
  assert.equal(before[who].star_sayings?.length, 2, `${who} reads both sayings before the upgrade`);
}
writeFileSync(join(work, 'before.json'), `${JSON.stringify(before, null, 2)}\n`);

/* ---------- 3. this tree's module over those rows, read back by this tree's client ---------- */
publish(next, false);
const after = { owner: data(next, null, { kind: 'snapshot' }), guest: data(next, 'guest', { kind: 'snapshot' }) };
writeFileSync(join(work, 'after.json'), `${JSON.stringify(after, null, 2)}\n`);

/** `later` still says everything `earlier` said: same values, nothing missing; it may say more. */
function keeps(later, earlier) {
  if (Array.isArray(earlier)) return Array.isArray(later) && later.length === earlier.length && earlier.every((value, index) => keeps(later[index], value));
  if (earlier && typeof earlier === 'object') return Boolean(later) && typeof later === 'object' && !Array.isArray(later) && Object.entries(earlier).every(([key, value]) => keeps(later[key], value));
  return Object.is(later, earlier);
}
const lost = [];
let kept = 0;
for (const who of ['owner', 'guest']) {
  assert.equal(after[who].transport_identity, before[who].transport_identity, `${who} stands as the same identity after the upgrade`);
  for (const [key, rows] of Object.entries(before[who])) {
    if (UNCOMPARED.has(key) || !Array.isArray(rows)) continue;
    if (!Array.isArray(after[who][key])) { lost.push(`${who}: ${key} is no longer read at all (${rows.length} rows before)`); continue; }
    const unmatched = [...after[who][key]];
    for (const row of rows) {
      const at = unmatched.findIndex((candidate) => keeps(candidate, row));
      if (at < 0) lost.push(`${who}: ${key} lost or altered ${JSON.stringify(row).slice(0, 240)}`);
      else { unmatched.splice(at, 1); kept += 1; }
    }
  }
}
if (lost.length) throw new Error(`the upgrade lost or altered ${lost.length} row(s) the base read:\n${lost.slice(0, 20).join('\n')}`);
console.log(`upgrade-in-place: the base module's rows (${written.join('; ')}) all read back after this tree's module published over them: ${kept} rows for two identities.`);
if (skipped.length) console.log(`upgrade-in-place: not written, because the base cannot: ${skipped.join('; ')}.`);
