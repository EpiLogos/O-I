/**
 * One field (O-I #858): one held client per identity, worlds first, and no leaks.
 *
 * Two identities each hold one client (`field.sh --held`, the native host's
 * own) on one running SharedField. One plants a private mark in a page it
 * publishes to itself alone; the other identity receives that mark in no
 * payload (observation, snapshot, read, status, FieldNow/FieldDay), in no
 * count, in no Explore graph and in no transaction its client sends out —
 * its cursor does not even move — while a public change after it moves that
 * cursor exactly once. The held connection is the presence: it stands while
 * the client does and goes with it. A request brings into view only what it
 * reads (no field for who it is or the worlds, one field for a request about
 * it); what is out of view sends nothing, and the cursor moves once when a
 * field out of view since it was last in view — or the whole field — comes
 * back into view, so what the window holds of it is read again.
 *
 * Worlds first: each identity puts its world (owner, body record, Link) and
 * opens clearings to the field, the public or one star. What a world has not
 * shown to the other identity — a clearing at a star it was not let in to, a
 * world not linked — reaches no payload, count or transaction of it, and its
 * cursor does not move: the cloud says nothing of what lies under it, or how
 * much. A star is lit with its lighter's world gathered first; an asking
 * world waits at its edge until let in; leaving takes back what was shown
 * there; withdrawing and Link off go back under cloud; closing a star
 * returns every world to its own orbit.
 *
 * Software Factory at a star (SF12, SF13): a third identity gathers too. A
 * piece of work shown there (`factory.shown-work/v1`) is watched by the worlds
 * let in, exactly as shown and nothing beside it, forward only, and as it was
 * kept once its Run closed; a task offered there (`factory.task-offer/v1`)
 * carries its grant, is taken by one world and comes back under that world's
 * name only within the grant, before it lapses and unless it was revoked, to
 * the offerer and taker alone, standing apart until accepted. A work is live
 * while its source answers (manual §17.2): it answers on the connection that
 * showed it, and with that window gone it reads as it was last shown until a
 * window of its world shows it again. A mark planted where B and C are not
 * let in — a work and a task at a star of A's alone — reaches no payload,
 * count, graph or line of theirs.
 *
 * A contribution to what another world shows (SF07): a world in the field
 * contributes to a part another shows, or to a contribution there; it stands
 * on its target under the contributor's name and waits for the owner, read by
 * the two alone until accepted, and then by whoever reads what it stands on.
 * A refusal reaches the contributor alone, in the owner's words. What waits,
 * what is refused and what stands at a star reaches no other identity's
 * payload, line or cursor, nor a field put under the world's name.
 *
 * A world's agent at a star (SF10): another world gathered at a star asks a world's agent there by its name, its role or the
 * exact instance running; the ask and the answer are the two worlds' alone, and the agent answers from what its world shows at that
 * star, only as the agent addressed, pointing to no work its world did not offer there.
 *
 * A star renamed and handed on (SF03): the one who holds a star renames it,
 * and hands it on to a world gathered there; it passes when that world's
 * owner takes it on, and until then the two alone read that it is being
 * handed on and its holder may keep it. Taken on, the star is the other's.
 *
 * The same work in two worlds (SF09): two things with one name in two worlds
 * stay two until someone claims they are one, and the claim is a contribution
 * others can dispute: it sets a part its claimant shows beside the part it is
 * claimed the same as, and names that part of the claimant's only to whoever
 * may read it. A part not shown stands beside nothing, and no one is told it.
 *
 * A world whose owner's machine is off (SF11): a world answers while a window
 * of its owner's stands; that window gone, it reads away since then, its
 * clearings as its owner last left them, and nothing else of it moves. Its
 * agent is away with it (SF10): asked all the same, the ask waits, and
 * nothing answers for it until a window of its owner's answers for it again.
 *
 * Aperture: at World, Local and Shared a client reads the clearings,
 * gatherings, withdrawals and accepted contributions of its circle alone, so
 * what moves outside it sends nothing; Federated reads the whole field.
 *
 * Runs only against a SpacetimeDB on this machine's loopback, never a hosted
 * or retained field:
 *   SPACETIMEDB_URI=ws://127.0.0.1:<port> SPACETIMEDB_DATABASE=<local db> \
 *   OI_STATE_HOME=<scratch> npx tsx one-field-live-acceptance.ts
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createParticipant } from '../index.mjs';
import { createSharedField } from '../social.mjs';
import { createExploreEntry } from '../explore.mjs';
import { createWorldPresentation } from '../presentation.mjs';
import { createWorldPresentationProjection } from '../presentation-projection.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';
import { createExploreSurfaceModelFromHostedSnapshot } from '../spacetimedb-explore-surface.mjs';
import { close, open, rows, SETTLE_WORDS_REFUSED, sleep } from './field-lib';

const uri = process.env.SPACETIMEDB_URI ?? '';
const database = process.env.SPACETIMEDB_DATABASE ?? '';
const loopback = (() => { try { return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(new URL(uri).hostname); } catch { return false; } })();
if (!loopback || !database) throw new Error('A SpacetimeDB on this machine\'s loopback is required (SPACETIMEDB_URI=ws://127.0.0.1:<port>, SPACETIMEDB_DATABASE); never a hosted field');
if (!process.env.OI_STATE_HOME) throw new Error('OI_STATE_HOME must name a scratch state home: the identities this acceptance makes are kept there');
const target = { name: 'env', server: 'env', uri, database };

/* ---------- AIKit, as each window runs it (601b, DLW build ruling 2026-11-09): a fake that keeps every run, never this machine's AIKit ----------
 * Each window is a device of its own with its own AIKit (ONE_FIELD_AIKIT_DEVICE, set per held client), which keeps its own record of what
 * each world shows as ai-kit's disclose does (gateway_world_agent.rs disclose: a part at a star or to the whole field, replaced whole; a
 * withdrawal takes back exactly what it names) and lists it (`disclose --list`, 601c ruling 2). */
const aikitFake = join(process.env.OI_STATE_HOME, 'one-field-aikit');
const aikitRuns = join(aikitFake, 'runs.jsonl');
mkdirSync(aikitFake, { recursive: true });
writeFileSync(join(aikitFake, 'aikit.cjs'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const argv = process.argv.slice(2);
const device = process.env.ONE_FIELD_AIKIT_DEVICE ?? null;
fs.appendFileSync(${JSON.stringify(aikitRuns)}, JSON.stringify({ argv, at: Date.now(), device, position: process.env.OI_POSITION_REF ?? null, generation: process.env.OI_OCCUPANT_GENERATION ?? null }) + '\\n');
const at = (flag) => argv[argv.indexOf(flag) + 1];
// this device's record of what a world shows, changed under its own lock
const recordOf = (world) => path.join(${JSON.stringify(aikitFake)}, 'records', String(device).replace(/[^A-Za-z0-9]/g, '_'), world.replace(/[^A-Za-z0-9]/g, '_') + '.json');
function held(world, change) {
  const file = recordOf(world), lock = file + '.lock';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let n = 0; ; n += 1) {
    try { fs.closeSync(fs.openSync(lock, 'wx')); break; } catch (error) { if (error.code !== 'EEXIST' || n > 4000) throw error; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); }
  }
  try {
    const parts = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    if (!change) return parts;
    const next = change(parts);
    // written whole, then renamed into place: the acceptance reads it without this lock (aikitHolds), and must never read it half written
    fs.writeFileSync(file + '.next', JSON.stringify(next));
    fs.renameSync(file + '.next', file);
    return next;
  } finally { fs.rmSync(lock, { force: true }); }
}
function disclose() {
  const world = at('--world'), part = at('--part'), star = argv.includes('--star') ? at('--star') : undefined;
  if (argv.includes('--list')) return { schema: 'aikit.world-star-disclosure/v1', act: 'listed', changed: false, disclosure: { schema: 'aikit.world-star-disclosure/v1', world_ref: world, parts: held(world) } };
  const withdraw = argv.includes('--withdraw'), everywhere = withdraw && !star && !argv.includes('--field');
  const label = argv.find((one) => one.startsWith('--label='));
  const parts = held(world, (parts) => [...parts.filter((one) => !(one.part_ref === part && (everywhere || one.star_ref === star))),
    ...(withdraw ? [] : [{ part_ref: part, ...(star ? { star_ref: star } : {}), ...(argv.includes('--kind') ? { kind: at('--kind') } : {}), ...(label ? { label: label.slice('--label='.length) } : {}) }])]);
  return { schema: 'aikit.world-star-disclosure/v1', act: withdraw ? 'withdrawn' : 'shown', changed: true, disclosure: { schema: 'aikit.world-star-disclosure/v1', world_ref: world, parts } };
}
const data = {
  disclose,
  send: () => ({ communique: { schema: 'aikit.communique/v1', communique_ref: 'aikit:communique:' + JSON.parse(at('--body')).ask_ref.replace(/[^A-Za-z0-9]/g, '-'), to_position_ref: at('--to'), state: 'pending' } }),
  replies: () => ({ schema: 'aikit.communique-replies/v1', communique_ref: argv[2], to_position_ref: null, reply_line: 'aikit:sender-of:' + argv[2], waiting: "Waiting for the world's agent.", declined: null, replies: [], relayed: false, complete: true, remote_replies: null }),
  who: () => ({ schema: 'aikit.population-reading/v1', project_world_ref: at('--project-world'), positions: [], agents: [], remotes: [], absences: [] }),
}[argv[1]];
console.log(JSON.stringify(data ? { schema: 1, ok: true, context: { context_id: null, session_id: null, project_root: null }, data: data(), warnings: [] } : { schema: 1, ok: false, error: { code: 'fake.verb', message: 'The fake answers no such verb.', details: {} } }));
`, { mode: 0o755 });
process.env.OI_AIKIT_PROGRAM = join(aikitFake, 'aikit.cjs');
// the windows start as an agent's shell may start them, standing at a Position; a window carries none to AIKit
process.env.OI_POSITION_REF = 'central:position:project:OneField:scribe';
process.env.OI_OCCUPANT_GENERATION = 'actuation:generation:one-field-scribe';
/** The AIKit runs of every window, or of one: by verb, where `disclose --list` (601c ruling 2) is a verb of its own. */
const aikitRan = (verb?: string, from?: { device: string }): { argv: string[]; at: number; device: string | null; position: string | null; generation: string | null }[] =>
  (existsSync(aikitRuns) ? readFileSync(aikitRuns, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line)) : [])
    .filter((one) => (!verb || (one.argv[1] === 'disclose' && one.argv.includes('--list') ? 'disclose --list' : one.argv[1]) === verb) && (!from || one.device === from.device));
/** What a window's own AIKit holds of what a world shows, as `part@star` (no star: shown to the whole field). */
const aikitHolds = (from: { device: string }, world: string): string[] => {
  const file = join(aikitFake, 'records', from.device.replace(/[^A-Za-z0-9]/g, '_'), world.replace(/[^A-Za-z0-9]/g, '_') + '.json');
  return (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []).map((part: any) => `${part.part_ref}@${part.star_ref ?? ''}`).sort();
};
/** What the field shows of a world, as its owner's window reads it: what AIKit holds once it is set right (601c rulings 2 and 6). */
const fieldShows = (reading: any, world: string): string[] => (reading.clearings ?? [])
  .filter((c: any) => c.world_ref === world && (c.audience === 'star' ? Boolean(c.star_ref) : (c.audience === 'field' || c.audience === 'public') && !c.star_ref))
  .map((c: any) => `${c.part_ref}@${c.star_ref ?? ''}`).sort();
const sentFor = (askRef: string) => aikitRan('send').filter((one) => JSON.parse(one.argv[one.argv.indexOf('--body') + 1]).ask_ref === askRef);
/** The window's reads of what was relayed under `ref` have stopped: none begins past the one its pace would have begun next. The pace backs
 * off from 2 s, doubling to 60 s (field-lib agentWindow), so the wait is past twice the last gap between reads (4 s after a single read),
 * never a fixed sleep a slowing pace outlasts (#942 follow-ups). */
async function readsStop(ref: string, what: string) {
  const reads = () => aikitRan('replies').filter((one) => one.argv[2] === ref);
  const before = reads();
  const [previous, last] = before.slice(-2).map((one) => one.at);
  const gap = last === undefined ? 2_000 : previous === undefined ? 2_000 : last - previous;
  const due = (last ?? before[0]?.at ?? Date.now()) + Math.min(60_000, 2 * Math.max(2_000, gap)) + 1_500;
  await sleep(Math.max(0, due - Date.now()));
  assert.equal(reads().length, before.length, `${what} (${before.length} reads, the next due by ${new Date(due).toISOString()})`);
}

const here = dirname(fileURLToPath(import.meta.url));
const run = crypto.randomUUID().slice(0, 8);
const MARK = `PRIVATE-MARK-858-${run}`;
const GLANCE_MS = 1500;

/* ---------- a held client, as the native host speaks to it ---------- */
type Line = Record<string, any>;
/** One request on a run of its own, as the CLI speaks to the field: a connection that stands for that one request, never a window. */
async function onceAs(label: string, request: Line): Promise<Line> {
  const child: ChildProcess = spawn(join(here, 'field.sh'), [], { env: { ...process.env, OI_SHARED_FIELD_TOKEN_LABEL: label }, stdio: ['pipe', 'pipe', 'inherit'] });
  let out = '';
  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => { out += chunk; });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin!.end(JSON.stringify(request));
  await exited;
  return JSON.parse(out.trim().split('\n').pop() || '{}');
}
let devices = 0;
function holdAs(label: string) {
  const device = `${label}:${++devices}`;
  const child: ChildProcess = spawn(join(here, 'field.sh'), ['--held'], {
    env: { ...process.env, OI_SHARED_FIELD_TOKEN_LABEL: label, OI_SHARED_FIELD_GLANCE_MS: String(GLANCE_MS), ONE_FIELD_AIKIT_DEVICE: device },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const pending = new Map<number, (line: Line) => void>();
  const events: Line[] = [];
  const raw: string[] = [];
  let next = 1;
  let buffer = '';
  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => {
    buffer += chunk;
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const text = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (!text.trim()) continue;
      raw.push(text);
      const line = JSON.parse(text);
      if (typeof line.id === 'number') pending.get(line.id)?.(line);
      else events.push(line);
    }
  });
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  return {
    label, device, child, events, raw, exited,
    async ask(request: Line): Promise<Line> {
      const id = next++;
      const answered = new Promise<Line>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${label}: ${request.kind} had no answer within 20 s`)); }, 20_000);
        pending.set(id, (line) => { clearTimeout(timer); pending.delete(id); resolve(line); });
      });
      child.stdin!.write(`${JSON.stringify({ id, request })}\n`);
      return answered;
    },
    async data(request: Line): Promise<any> {
      const answer = await this.ask(request);
      if (!answer.ok) throw new Error(`${label} ${request.kind}: ${answer.error?.kind}: ${answer.error?.message}`);
      return answer.data;
    },
    transactions: () => events.filter((line) => line.event === 'transaction'),
    async end() { child.stdin!.end(); return exited; },
  };
}
type Held = ReturnType<typeof holdAs>;
const tick = (cursor: string) => { const [, epoch, count] = /^tx:(\d+):(\d+)$/.exec(cursor) ?? []; assert.ok(epoch, `a cursor names a transaction: ${cursor}`); return { epoch: Number(epoch), count: Number(count) }; };
/** Ask until the answer is yes (a held reading is asked, not polled from a cache here). */
async function waitFor<T>(read: () => T | false | undefined | null | Promise<T | false | undefined | null>, what: string, ms = 20_000): Promise<T> {
  const began = Date.now();
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() - began > ms) throw new Error(`Timed out waiting for ${what}`);
    await sleep(100);
  }
}
const names = (held: Held, ref: string) => held.transactions().some((line) => line.changes.some((change: any) => change.ref === ref));

/* ---------- the field, its owner and its public world ---------- */
const a = await open(target, 'one-field-a');
const held: Held[] = [];
try {
  const fieldRef = `oi:field:one-field:${run}`;
  const worldRef = `world:one-field:${run}:a`;
  const participantRef = `participant:one-field:${run}:a`;
  const field = createSharedField({ field_ref: fieldRef, kind: 'explore', visibility: 'public', title: 'One field, slice 1', provenance: [{ kind: 'controlled-test', ref: 'oi:test:one-field-live-acceptance', source_system: 'o-i', revision: '1' }] });
  await a.conn.reducers.putSharedField({ fieldRef, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) });
  const participant = createParticipant({ participant_ref: participantRef, field_ref: fieldRef, identity: { kind: 'human', ref: `human:one-field:${run}:a` }, presentation: { world_ref: worldRef }, provenance: { source_system: 'o-i', source_revision: 'one-field@1' } });
  await a.conn.reducers.putParticipant({ participantRef, fieldRef, identityKind: participant.identity.kind, identityRef: participant.identity.ref, sourceSystem: participant.provenance.source_system, sourceRevision: participant.provenance.source_revision, contractJson: JSON.stringify(participant) });
  await a.conn.reducers.grantParticipantAuthority({ fieldRef, participantRef, targetIdentity: a.identity, role: 'contributor', contactable: false, ttlSeconds: 0 });

  const publish = async (projectionRef: string, title: string, audience: Line) => {
    const presentation = createWorldPresentation({ presentation_ref: `presentation:${projectionRef}`, world_ref: worldRef, revision: 1, title, summary: title, theme: { tokens: {} }, regions: [], provenance: [{ kind: 'authored', ref: worldRef, source_system: 'o-i', revision: 'one-field@1' }] });
    const projection = createWorldPresentationProjection({ presentation, projection: { projection_ref: projectionRef, projection_revision: 1, state: 'published', subject: { kind: 'human-world', ref: worldRef }, source: { system: 'o-i', revision: 'one-field@1' }, publisher_participant_ref: participantRef, published_at: new Date().toISOString(), audience, provenance: [{ kind: 'human-publication', ref: participantRef, source_system: 'o-i', revision: 'one-field@1' }] } });
    await a.conn.reducers.putProjection({ projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision), fieldRef, projectionRef: projection.projection_ref, projectionRevision: projection.projection_revision, sourceRevision: projection.source.revision, publisherParticipantRef: participantRef, state: projection.state, contractJson: JSON.stringify(projection) });
  };
  const page = async (ref: string, label: string, projectionRef: string) => {
    const entry = { ...createExploreEntry({ ref, kind: 'page', world_ref: worldRef, label, summary: label, aliases: [], revision: 'one-field@1', provenance: [{ kind: 'human-world', ref: worldRef, source_system: 'o-i', revision: 'one-field@1' }], locators: [] }), projection_ref: projectionRef };
    await a.conn.reducers.putExploreEntry({ semanticRef: entry.ref, fieldRef, worldRef, kind: entry.kind, label: entry.label, revision: entry.revision ?? '', entryJson: JSON.stringify(entry) });
  };
  const shownProjection = `projection:one-field:${run}:shown`;
  await publish(shownProjection, 'The shown world', { visibility: 'public' });
  await page(`${worldRef}/page:shown`, 'A shown page', shownProjection);

  /* ---------- each identity holds one client ---------- */
  const heldA = holdAs('one-field-a'); held.push(heldA);
  const heldB = holdAs('one-field-b'); held.push(heldB);
  for (const one of [heldA, heldB]) {
    const view = await one.data({ kind: 'view', lease: 'acceptance:explore', scope: 'whole' });
    assert.equal(view.in_view, 'whole');
    // A view's lease stands at once, even while its client is still connecting: what it asks for is subscribed once the client is live.
    // An observe answers only then, so what is planted after it reaches each client as a transaction, never inside its first reading.
    const settled = await one.data({ kind: 'observe' });
    assert.equal(settled.snapshot.state, 'hosted', `${one.label} is live, its view subscribed`);
  }
  const seenBefore: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'observe' }); return seen.snapshot.entries.some((entry: any) => entry.ref === `${worldRef}/page:shown`) && seen; }, 'B to see the shown page');
  // Counted within this run's world: the local field keeps earlier runs'.
  const ours = (snapshot: any) => ({ entries: snapshot.entries.filter((entry: any) => entry.world_ref === worldRef).length, projections: snapshot.projections.filter((projection: any) => projection.subject?.ref === worldRef).length });
  const { entries: entriesBefore, projections: projectionsBefore } = ours(seenBefore.snapshot);
  assert.deepEqual([entriesBefore, projectionsBefore], [1, 1], 'B counts the shown page and its projection');
  assert.ok(!JSON.stringify(seenBefore).includes(MARK));
  const cursorBefore = tick(seenBefore.cursor);
  const eventsBefore = heldB.transactions().length;

  /* ---------- A plants a private mark in a page it shows no one ---------- */
  const unshownProjection = `projection:one-field:${run}:unshown-${MARK}`;
  const unshown = `${worldRef}/page:unshown-${MARK}`;
  await publish(unshownProjection, `Unshown ${MARK}`, { visibility: 'private', refs: [participantRef] });
  await page(unshown, `Unshown ${MARK}`, unshownProjection);
  await waitFor(() => names(heldA, unshown), 'A\'s own client to take the planted page');
  const seenByA = await heldA.data({ kind: 'observe' });
  assert.ok(JSON.stringify(seenByA).includes(MARK), 'the mark was planted and A reads it (non-vacuous)');

  /* ---------- a public fence after it ---------- */
  const fence = `${worldRef}/page:fence`;
  await page(fence, 'A public fence', shownProjection);
  await waitFor(() => names(heldB, fence), 'B to take the public fence');

  /* ---------- what B received ---------- */
  const since = heldB.transactions().slice(eventsBefore);
  assert.equal(since.length, 1, `B took one transaction since its reading (the fence), not the plant: ${JSON.stringify(since)}`);
  assert.ok(since[0].changes.every((change: any) => change.ref === fence || change.table !== 'explore_entry'), JSON.stringify(since[0]));
  const after = await heldB.data({ kind: 'observe' });
  const cursorAfter = tick(after.cursor);
  assert.equal(cursorAfter.epoch, cursorBefore.epoch, 'B stood on one connection throughout');
  assert.equal(cursorAfter.count, cursorBefore.count + 1, 'B\'s cursor moved once: for the fence, never for the plant');
  assert.deepEqual(ours(after.snapshot), { entries: entriesBefore + 1, projections: projectionsBefore }, 'B counts the fence and nothing private');
  assert.deepEqual(ours(seenByA.snapshot), { entries: entriesBefore + 1, projections: projectionsBefore + 1 }, 'A counts its unshown page and its projection');
  const surface = createExploreSurfaceModelFromHostedSnapshot(after.snapshot);
  // Every node B's Explore can open, with its neighbourhood.
  const graph = after.snapshot.entries.map((entry: any) => surface.open(entry.ref, { depth: 2, budget: 64 }));
  assert.ok(JSON.stringify(graph).includes(fence), 'B\'s Explore graph is drawn from what B sees (non-vacuous)');
  const payloads = [
    after,
    await heldB.data({ kind: 'snapshot' }),
    await heldB.data({ kind: 'read', ref: fence }),
    await heldB.data({ kind: 'field-now', field_ref: fieldRef }).catch((error: Error) => ({ refused: error.message })),
    await heldB.data({ kind: 'field-day', field_ref: fieldRef }).catch((error: Error) => ({ refused: error.message })),
    await heldB.data({ kind: 'status' }),
    await heldB.data({ kind: 'identity' }),
    graph,
  ];
  for (const payload of payloads) assert.ok(!JSON.stringify(payload).includes(MARK), `B received A's private mark: ${JSON.stringify(payload).slice(0, 400)}`);
  assert.ok(!heldB.raw.some((line) => line.includes(MARK)), 'nothing B\'s client sent out names the mark');
  // Asked by its address (which B is told here), the page is absent: the
  // answer carries back only the address asked.
  const byAddress = await heldB.data({ kind: 'read', ref: unshown });
  assert.deepEqual(byAddress, { schema: 'oi.shared-field.reading/v1', ref: unshown, state: 'absent', target: byAddress.target }, 'B cannot read the unshown page by its address');

  /* ---------- the held connection is the presence ---------- */
  const entered = await heldA.data({ kind: 'enter', field_ref: fieldRef, participant_ref: participantRef });
  assert.equal(entered.state, 'entered');
  const present = async () => (await heldB.data({ kind: 'observe' })).snapshot.presence.some((row: any) => row.field_ref === fieldRef && row.participant_ref === participantRef);
  await waitFor(present, 'B to see A present');
  assert.equal(await heldA.end(), 0, 'A\'s client ends when its host lets go');
  held.splice(held.indexOf(heldA), 1);
  await waitFor(async () => !(await present()), 'A\'s presence to go with its connection');

  /* ---------- out of view sends nothing; back in view moves the cursor once ---------- */
  await heldB.data({ kind: 'view', lease: 'acceptance:explore', scope: null });
  await sleep(GLANCE_MS + 1000);
  const narrowed = (await heldB.data({ kind: 'status' })).held;
  assert.deepEqual(narrowed.scope, [], 'with no lease and no glance only B\'s own rows are in view');
  assert.equal(narrowed.leases, 0);
  // A request brings into view only what it reads: one that reads no field (who it is, the worlds) brings none, and one
  // about a field brings that field alone, for its glance.
  await heldB.data({ kind: 'identity' });
  const worldsRead = await heldB.data({ kind: 'worlds' });
  assert.equal(worldsRead.schema, 'oi.shared-field.worlds/v1', 'the worlds are read on their own');
  assert.ok(Array.isArray(worldsRead.worlds) && Array.isArray(worldsRead.stars), 'with the worlds and the stars');
  assert.deepEqual((await heldB.data({ kind: 'status' })).held.scope, [], 'reading who it is and the worlds brings no field into view');
  // The field was in view (whole) and out of it since, so what moved there was not seen: a request about it alone brings it
  // back, and the cursor moves once (a status the window reads again on) so what the window holds of it is read again. A
  // request while it stands in view moves nothing, and nor does letting it go.
  const heldCursor = async () => tick((await heldB.data({ kind: 'status' })).held.cursor).count;
  const toldAt = (cursor: string) => heldB.events.some((line) => line.event === 'status' && line.state === 'live' && line.cursor === cursor);
  const backAgain = async (what: string) => {
    const before = await heldCursor();
    await heldB.data({ kind: 'field-now', field_ref: fieldRef });
    const back = (await heldB.data({ kind: 'status' })).held;
    assert.deepEqual(back.scope, [fieldRef], 'a request about one field brings that field alone into view');
    assert.equal(tick(back.cursor).count, before + 1, `${what}: the field back in view moves the cursor once`);
    assert.ok(toldAt(back.cursor), `${what}: and says so, unasked, at that cursor`);
    await heldB.ask({ kind: 'field-day', field_ref: fieldRef });
    assert.equal(await heldCursor(), before + 1, `${what}: a request about a field in view moves nothing`);
    await waitFor(async () => (await heldB.data({ kind: 'status' })).held.scope.length === 0, 'the field glanced at to leave view again');
    assert.equal(await heldCursor(), before + 1, `${what}: letting a field go is no transaction`);
  };
  await backAgain('after the whole field was let go');
  const unseenThere = `${worldRef}/page:unseen-there`;
  await page(unseenThere, 'A page in a field out of view', shownProjection);
  await sleep(1500);
  assert.ok(!names(heldB, unseenThere), 'a change in a field out of view sends nothing');
  await backAgain('after its glance lapsed, with a change in it unseen');
  const lapsedCursor = await heldCursor();
  const unseen = `${worldRef}/page:unseen`;
  await page(unseen, 'A page out of view', shownProjection);
  await sleep(1500);
  assert.ok(!names(heldB, unseen), 'a change out of view sends nothing');
  const widened = await heldB.data({ kind: 'observe' });
  for (const ref of [unseenThere, unseen]) assert.ok(widened.snapshot.entries.some((entry: any) => entry.ref === ref), `the whole field is read again when it comes back into view: ${ref}`);
  assert.equal(tick(widened.cursor).count, lapsedCursor + 1, 'and the cursor moves once for what moved unseen');
  assert.ok(!JSON.stringify(widened).includes(MARK));

  /* ---------- worlds first (O-I #858 slice 2): a world, its clearings, the stars it gathers at ----------
   * Each identity's world stands in the field with its body record, so every viewer draws the same planet;
   * what its owner shows opens a clearing, and everything else lies under one even cloud that tells the
   * other identity nothing: no mark, no count, not even a moved cursor. */
  const heldA2 = holdAs('one-field-a'); held.push(heldA2);
  // B was told the unshown page's address above (and its answer echoes it); what B is sent from here on is judged alone.
  const rawFrom = heldB.raw.length;
  await heldB.data({ kind: 'view', lease: 'acceptance:worlds', scope: 'whole' });
  const body = (ref: string, seed: number) => ({ body_ref: ref, seed, generator: { id: 'fbm-sphere', version: 2 },
    landmass: { sea_level: 0.5, continents: 1.7, relief: 0.55, coast: 'smooth' }, climate: { warmth: 0.58, moisture: 0.6, ice_caps: 0.3 },
    sky: { atmosphere: 0.6, clouds: 0.35, axial_tilt_deg: 18 } });
  const worldA = `world:one-field:${run}:a-world`, worldB = `world:one-field:${run}:b-world`, hidden = `world:one-field:${run}:a-unlinked`;
  const bodyA = body(`body:one-field:${run}:a`, 1234), bodyB = body(`body:one-field:${run}:b`, 98765);
  await heldA2.data({ kind: 'world-put', world_ref: worldA, body: bodyA, linked: true });
  await heldB.data({ kind: 'world-put', world_ref: worldB, body: bodyB, linked: true });
  const stolen = await heldB.ask({ kind: 'world-put', world_ref: worldA, body: bodyB, linked: true });
  assert.equal(stolen.ok, false, 'a world stays its owner\'s: another identity cannot put it');
  const worldsOf = (snapshot: any, ref: string) => snapshot.worlds.filter((world: any) => world.world_ref === ref);
  const seenWorlds: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return worldsOf(seen, worldA).length === 1 && seen; }, 'B to see A\'s world');
  assert.deepEqual(worldsOf(seenWorlds, worldA)[0].body, bodyA, 'every viewer draws the same planet: B reads A\'s body record whole');
  assert.equal(worldsOf(seenWorlds, worldA)[0].mine, false);
  assert.equal(worldsOf(seenWorlds, worldB)[0].mine, true);

  const star = `star:one-field:${run}:rosarium`;
  const lit = await heldA2.data({ kind: 'star-light', star_ref: star, world_ref: worldA, name: 'The Rosarium plates', gathers: 'Readings of the Rosarium plates', comes: 'asked' });
  assert.equal(lit.star.mine, true, 'the star is in the hands of whoever lit it');
  assert.deepEqual(lit.gathered.map((g: any) => [g.world_ref, g.state]), [[worldA, 'gathered']], 'the lighter\'s world is the first gathered at its star');
  const shown = { kind: 'place', label: 'Rosarium notes', at: { lat: 48.2, lon: 16.37 } };
  const toldField = await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'place:rosarium-notes', audience: 'field', shown });
  const toldPublic = await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'page:reading-of-plate-4', audience: 'public', shown: { kind: 'page', label: 'A reading of the fourth plate' } });
  // A's window tells AIKit what A's world shows once the field has taken each Show: all A's agent answers from (601b ruling 1)
  assert.deepEqual([toldField.aikit, toldPublic.aikit], [{ told: true, parts: 1, words: null }, { told: true, parts: 1, words: null }], 'each Show the field takes is told to AIKit');
  assert.deepEqual(aikitRan('disclose', heldA2).filter((one) => one.argv.includes(worldA)).map((one) => one.argv), [
    ['gateway', 'disclose', '--world', worldA, '--part', 'place:rosarium-notes', '--field', '--kind', 'place', '--label=Rosarium notes', '--json'],
    ['gateway', 'disclose', '--world', worldA, '--part', 'page:reading-of-plate-4', '--field', '--kind', 'page', '--label=A reading of the fourth plate', '--json'],
  ], 'shown to the field and to the public: at every star, in the order the field took them');
  const clearingsOf = (snapshot: any, ref: string) => snapshot.clearings.filter((clearing: any) => clearing.world_ref === ref);
  // What a world withdrew (SF14), as the reader is told it: whose world, from what reach (and which star), of what kind and when —
  // never which part, nor what it showed (the row carries no more than these).
  const withdrawalsOf = (snapshot: any, ref: string) => {
    assert.equal(snapshot.world_withdrawal?.state, 'held', `the field keeps what a world withdrew: ${JSON.stringify(snapshot.world_withdrawal)}`);
    return snapshot.world_withdrawals.filter((row: any) => row.world_ref === ref);
  };
  const withdrawn = (row: any) => {
    assert.deepEqual(Object.keys(row).filter((key) => !['world_ref', 'star_ref', 'reach', 'kind', 'withdrawn_at_micros'].includes(key)), [], `a withdrawal names no more: ${JSON.stringify(row)}`);
    assert.ok(/^\d+$/.test(row.withdrawn_at_micros), 'and says when');
    return { world_ref: row.world_ref, star_ref: row.star_ref, reach: row.reach, ...(row.kind ? { kind: row.kind } : {}) };
  };
  const seenA: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return clearingsOf(seen, worldA).length === 2 && seen.stars.some((s: any) => s.star_ref === star) && seen; }, 'B to see A\'s two clearings and its star');
  assert.deepEqual(seenA.gatherings.filter((g: any) => g.star_ref === star).map((g: any) => [g.world_ref, g.state]), [[worldA, 'gathered']], 'B sees who has gathered at the star');
  const cloudOf = (snapshot: any) => JSON.stringify({ worlds: worldsOf(snapshot, worldA), clearings: clearingsOf(snapshot, worldA), hidden: worldsOf(snapshot, hidden).concat(clearingsOf(snapshot, hidden)) });
  const before = cloudOf(seenA);
  // B's client may still be telling of what it just read: let its news settle first.
  for (let last = -1; last !== heldB.transactions().length;) { last = heldB.transactions().length; await sleep(600); }
  const statusBefore = (await heldB.data({ kind: 'status' })).held;
  const quietFrom = heldB.transactions().length;

  /* ---------- A shows things B may not see: at its star (B not let in) and on a world it has not linked ---------- */
  const STAR_MARK = `STAR-MARK-858-${run}`;
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'page:for-the-circle', audience: 'star', star_ref: star, shown: { kind: 'page', label: `For the circle ${STAR_MARK}` } });
  await heldA2.data({ kind: 'world-put', world_ref: hidden, body: body(`body:one-field:${run}:hidden-${MARK}`, 7), linked: false });
  for (let n = 0; n < 3; n += 1) await heldA2.data({ kind: 'clearing-open', world_ref: hidden, part_ref: `page:unlinked-${n}-${MARK}`, audience: 'public', shown: { kind: 'page', label: `Unlinked ${MARK}` } });
  const ownView = await heldA2.data({ kind: 'snapshot' });
  assert.ok(JSON.stringify(ownView).includes(MARK) && JSON.stringify(ownView).includes(STAR_MARK), 'A reads what it showed at its star and on its unlinked world (non-vacuous)');
  assert.equal(clearingsOf(ownView, hidden).length, 3);
  await sleep(1500);
  assert.equal(heldB.transactions().length, quietFrom, `the cloud tells B nothing: no transaction reached B for what it cannot see: ${JSON.stringify(heldB.transactions().slice(quietFrom))}`);
  const statusQuiet = (await heldB.data({ kind: 'status' })).held;
  assert.equal(statusQuiet.cursor, statusBefore.cursor, 'B\'s cursor did not move for anything under the cloud');
  const quiet = await heldB.data({ kind: 'snapshot' });
  assert.equal(cloudOf(quiet), before, 'A\'s world reads to B exactly as before: the cloud says nothing of what lies under it, or how much');
  // A public fence after it moves B's cursor exactly once.
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'page:clearing-fence', audience: 'public', shown: { kind: 'page', label: 'A public fence' } });
  await waitFor(() => heldB.transactions().length > quietFrom, 'B to take the clearing fence');
  await sleep(300);
  const fenceTx = heldB.transactions().slice(quietFrom);
  assert.equal(fenceTx.length, 1, `B took one transaction, the fence: ${JSON.stringify(fenceTx)}`);
  assert.deepEqual(fenceTx[0].changes.map((change: any) => change.table), ['world_clearing']);
  assert.equal(tick((await heldB.data({ kind: 'status' })).held.cursor).count, tick(statusBefore.cursor).count + 1);
  const leakChecks = [quiet, await heldB.data({ kind: 'snapshot' }), await heldB.data({ kind: 'observe' }), await heldB.data({ kind: 'read', ref: worldA }), await heldB.data({ kind: 'read', ref: hidden })];
  for (const payload of leakChecks) {
    const text = JSON.stringify(payload);
    assert.ok(!text.includes(MARK) && !text.includes(STAR_MARK), `B received what lies under A's cloud: ${text.slice(0, 400)}`);
  }
  assert.ok(!heldB.raw.slice(rawFrom).some((line) => line.includes(MARK) || line.includes(STAR_MARK)), 'nothing B\'s client sent out names what lies under the cloud');
  assert.equal(quiet.counts.clearings, (await heldB.data({ kind: 'snapshot' })).counts.clearings - 1, 'B counts the fence and nothing under the cloud');

  /* ---------- gathering: B asks, waits at the edge, is let in, shows there, leaves ---------- */
  const asked = await heldB.data({ kind: 'star-gather', star_ref: star, world_ref: worldB });
  assert.equal(asked.state, 'asked', 'a star whose lighter lets worlds in keeps an asking world at its edge');
  // The star keeps its own day (SF04): who came, who was let in, who showed something there and who left, never what was shown.
  const dayOf = (snapshot: any) => (snapshot.star_days ?? []).filter((entry: any) => entry.star_ref === star).map((entry: any) => [entry.world_ref, entry.what]);
  const dayB0 = await waitFor(async () => { const day = dayOf(await heldB.data({ kind: 'snapshot' })); return day.length > 0 && day; }, 'B to read its own request in the star\'s day');
  assert.deepEqual(dayB0, [[worldB, 'asked']], 'waiting at the edge, B reads only its own request in the star\'s day');
  await waitFor(async () => (await heldA2.data({ kind: 'snapshot' })).gatherings.some((g: any) => g.star_ref === star && g.world_ref === worldB && g.state === 'asked'), 'A to see B\'s request');
  assert.ok(!JSON.stringify(await heldB.data({ kind: 'snapshot' })).includes(STAR_MARK), 'waiting at the edge shows B nothing shown at the star');
  const refusedAdmit = await heldB.ask({ kind: 'star-admit', star_ref: star, world_ref: worldB });
  assert.equal(refusedAdmit.ok, false, 'only the star\'s lighter lets a world in');
  // What is said at a star (SF06) is read where its day is read: A says something there, and B, waiting at the edge, is told none of it
  // and says nothing there itself.
  const SAY_MARK = `SAY-MARK-858-${run}`;
  const sayingsOf = (snapshot: any) => (snapshot.star_sayings ?? []).filter((saying: any) => saying.star_ref === star);
  const said0 = await heldA2.data({ kind: 'star-say', saying_ref: `saying:one-field:${run}:a0`, star_ref: star, world_ref: worldA, to: { world_ref: worldA, part_ref: 'page:for-the-circle' }, what: 'finding', words: `The circle opens at the fourth plate ${SAY_MARK}` });
  assert.equal(said0.saying.world_ref, worldA, 'a saying stands under its sayer\'s world');
  const refusedSay = await heldB.ask({ kind: 'star-say', saying_ref: `saying:one-field:${run}:b-waiting`, star_ref: star, world_ref: worldB, to: { saying_ref: `saying:one-field:${run}:a0` }, what: 'question', words: 'May I ask?' });
  assert.equal(refusedSay.ok, false, 'a world waiting at the edge says nothing at the star');
  assert.match(refusedSay.error.message, /only while it is gathered there/, `refused in words: ${refusedSay.error.message}`);
  assert.ok(!JSON.stringify(await heldB.data({ kind: 'snapshot' })).includes(SAY_MARK), 'waiting at the edge, B reads nothing said at the star');
  assert.ok(!heldB.raw.slice(rawFrom).some((line) => line.includes(SAY_MARK)), 'and nothing B\'s client sent out names it');
  await heldA2.data({ kind: 'star-admit', star_ref: star, world_ref: worldB });
  const inside: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return JSON.stringify(seen).includes(STAR_MARK) && seen; }, 'B, let in, to see what A shows at the star');
  assert.ok(!JSON.stringify(inside).includes(MARK), 'letting B in gives it no reach into A\'s world beyond what A shows at the star');
  assert.equal(clearingsOf(inside, hidden).length, 0);
  assert.equal(worldsOf(inside, hidden).length, 0);
  assert.ok(await waitFor(async () => JSON.stringify(sayingsOf(await heldB.data({ kind: 'snapshot' }))).includes(SAY_MARK), 'B, let in, to read what A said at the star'));
  const DAY_LET_IN = [[worldA, 'lit'], [worldA, 'showed'], [worldB, 'asked'], [worldA, 'said'], [worldB, 'let-in']];
  assert.deepEqual(await waitFor(async () => { const day = dayOf(await heldA2.data({ kind: 'snapshot' })); return day.length === DAY_LET_IN.length && day; }, 'A to read the star\'s day'), DAY_LET_IN,
    'the lighter reads the star\'s day: it was lit, A showed something there, B asked, A said something and B was let in');
  assert.deepEqual(await waitFor(async () => { const day = dayOf(await heldB.data({ kind: 'snapshot' })); return day.length === DAY_LET_IN.length && day; }, 'B, let in, to read the star\'s day'), DAY_LET_IN,
    'let in, B reads the same day');
  await heldB.data({ kind: 'clearing-open', world_ref: worldB, part_ref: 'page:my-reading', audience: 'star', star_ref: star, shown: { kind: 'page', label: 'My reading of the fourth plate' } });
  await waitFor(async () => clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldB).some((c: any) => c.part_ref === 'page:my-reading'), 'A to see what B shows at the star');
  /* ---------- what was said to what (SF06): B asks about what A shows, A answers the question and corrects what B shows ---------- */
  const Q = `saying:one-field:${run}:b-question`, F = `saying:one-field:${run}:a-finding`, C = `saying:one-field:${run}:a-correction`;
  const question = await heldB.data({ kind: 'star-say', saying_ref: Q, star_ref: star, world_ref: worldB, to: { world_ref: worldA, part_ref: 'page:for-the-circle' }, what: 'question', words: 'Where does the circle open?' });
  assert.deepEqual([question.saying.to_world_ref, question.saying.to_part_ref, question.saying.what], [worldA, 'page:for-the-circle', 'question'], 'B\'s question stands on what A shows at the star');
  const seenQ = await waitFor(async () => sayingsOf(await heldA2.data({ kind: 'snapshot' })).find((saying: any) => saying.saying_ref === Q), 'A to read B\'s question');
  assert.deepEqual([seenQ.world_ref, seenQ.to_part_ref, seenQ.words], [worldB, 'page:for-the-circle', 'Where does the circle open?'], 'A reads who said what to what');
  assert.ok(Number(seenQ.said_at_micros) > 0, 'and when');
  await heldA2.data({ kind: 'star-say', saying_ref: F, star_ref: star, world_ref: worldA, to: { saying_ref: Q }, what: 'finding', words: 'At the fourth plate.' });
  await heldA2.data({ kind: 'star-say', saying_ref: C, star_ref: star, world_ref: worldA, to: { world_ref: worldB, part_ref: 'page:my-reading' }, what: 'correction', words: 'The second plate is the white rose.' });
  const seenF = await waitFor(async () => sayingsOf(await heldB.data({ kind: 'snapshot' })).find((saying: any) => saying.saying_ref === F), 'B to read A\'s answer to its question');
  assert.equal(seenF.to_saying_ref, Q, 'a saying answers a saying: it threads under it');
  const unsayOthers = await heldB.ask({ kind: 'star-unsay', saying_ref: F });
  assert.equal(unsayOthers.ok, false, 'only the one who said it unsays it');
  const notHere = await heldB.ask({ kind: 'star-say', saying_ref: `saying:one-field:${run}:b-elsewhere`, star_ref: star, world_ref: worldB, to: { world_ref: worldA, part_ref: 'place:rosarium-notes' }, what: 'question', words: 'And this?' });
  assert.equal(notHere.ok, false, 'a saying at a star is said to something shown at that star');
  const ranBeforeLeave = aikitRan('disclose', heldB).length;
  const leftB = await heldB.data({ kind: 'star-leave', star_ref: star, world_ref: worldB });
  // Leaving answers once the field has acted; AIKit is told after it, in take order (#942 follow-up 1).
  assert.deepEqual(leftB.aikit, { told: null, parts: 1, words: 'The field has acted; AIKit is told what it took back of your worlds after it, in order' }, 'leaving answers once the field has acted, and says AIKit is told after it (601b ruling 3, #942 follow-up 1)');
  const withdrawB = ['gateway', 'disclose', '--world', worldB, '--part', 'page:my-reading', '--star', star, '--withdraw', '--json'].join(' ');
  await waitFor(() => aikitRan('disclose', heldB).length > ranBeforeLeave, 'what B\'s leaving took back to be told to AIKit');
  assert.deepEqual(aikitRan('disclose', heldB).slice(ranBeforeLeave).map((one) => one.argv.join(' ')), [withdrawB], 'B\'s window takes back at that star exactly what B showed there');
  assert.ok(!aikitHolds(heldB, worldB).includes(`page:my-reading@${star}`), 'and B\'s AIKit holds it no more');
  await waitFor(async () => !clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldB).length, 'leaving to take back what B showed at the star');
  assert.ok(!JSON.stringify(await heldB.data({ kind: 'snapshot' })).includes(STAR_MARK), 'and B no longer sees what A shows there');
  // what A's correction was said to went back under cloud with B's leaving: the saying stands, and names nothing it was said to
  const seenC = await waitFor(async () => { const saying = sayingsOf(await heldA2.data({ kind: 'snapshot' })).find((s: any) => s.saying_ref === C); return saying && saying.to_part_ref === null && saying; }, 'what A\'s correction was said to to go under cloud');
  assert.equal(seenC.to_world_ref, worldB, 'it still says whose it was');
  assert.ok(sayingsOf(await heldA2.data({ kind: 'snapshot' })).some((saying: any) => saying.saying_ref === Q), 'B\'s question stays under B\'s name when B leaves');
  await heldB.data({ kind: 'star-unsay', saying_ref: Q });
  const afterUnsay = await waitFor(async () => { const said = sayingsOf(await heldA2.data({ kind: 'snapshot' })); return !said.some((s: any) => s.saying_ref === Q) && said; }, 'B\'s unsaying to reach A');
  assert.equal(afterUnsay.find((saying: any) => saying.saying_ref === F)?.to_saying_ref, Q, 'A\'s answer stands, under what is now unsaid');
  const DAY_LEFT = [...DAY_LET_IN, [worldB, 'showed'], [worldB, 'said'], [worldA, 'said'], [worldA, 'said'], [worldB, 'left'], [worldB, 'unsaid']];
  const daySnapshotA = await waitFor(async () => { const seen = await heldA2.data({ kind: 'snapshot' }); return dayOf(seen).length === DAY_LEFT.length && seen; }, 'A to read B\'s leaving in the star\'s day');
  assert.deepEqual(dayOf(daySnapshotA), DAY_LEFT, 'the star\'s day records that B showed something there and left');
  const dayText = JSON.stringify((daySnapshotA.star_days ?? []).filter((entry: any) => entry.star_ref === star));
  assert.ok(!dayText.includes(STAR_MARK) && !dayText.includes('My reading'), `the star\'s day records that something was shown, never what: ${dayText}`);
  assert.ok(!dayText.includes(SAY_MARK) && !dayText.includes('circle open'), `and that something was said, never what: ${dayText}`);
  assert.ok((daySnapshotA.star_days ?? []).filter((entry: any) => entry.star_ref === star).every((entry: any) => Number(entry.at_micros) > 0), 'each entry of the day says when');
  assert.deepEqual(dayOf(await heldB.data({ kind: 'snapshot' })), [[worldB, 'asked'], [worldB, 'let-in'], [worldB, 'showed'], [worldB, 'said'], [worldB, 'left'], [worldB, 'unsaid']],
    'gone from the star, B reads only its own part of the star\'s day');

  /* ---------- a piece of work shown at the star (SF12), a task offered there (SF13) ----------
   * The documents are Software Factory's, shaped as `factory development show` and `offer-make`/`offer-return` answer them;
   * the field carries them between the worlds gathered at the star and keeps what came back to an offer to its offerer and taker. */
  const heldC = holdAs('one-field-c'); held.push(heldC);
  const worldC = `world:one-field:${run}:c-world`;
  await heldC.data({ kind: 'world-put', world_ref: worldC, body: body(`body:one-field:${run}:c`, 4242), linked: true });
  for (const [one, world] of [[heldB, worldB], [heldC, worldC]] as const) {
    assert.equal((await one.data({ kind: 'star-gather', star_ref: star, world_ref: world })).state, 'asked');
    await waitFor(async () => (await heldA2.data({ kind: 'snapshot' })).gatherings.some((g: any) => g.star_ref === star && g.world_ref === world && g.state === 'asked'), `A to see ${world} ask`);
  }
  await heldA2.data({ kind: 'star-admit', star_ref: star, world_ref: worldB });
  /* ---------- Aperture (manual §17.2): the narrower apertures read B's circle alone ----------
   * At World, Local and Shared B reads the clearings and gatherings of its circle — its own world, A's star where it is gathered and
   * A's world gathered there — so what C, waiting at the edge, opens to the public sends B nothing; the worlds themselves are read
   * whole, so what lies past the edge is counted; Federated reads the whole field. */
  const atShared = await heldB.data({ kind: 'worlds', aperture: 'shared' });
  assert.equal(atShared.world_scope, 'circle', 'Shared reads B\'s circle');
  assert.ok(atShared.worlds.some((w: any) => w.world_ref === worldC), 'the worlds are read whole, so what lies past the edge is counted');
  assert.ok(atShared.gatherings.some((g: any) => g.star_ref === star && g.world_ref === worldA), 'B reads who is gathered at its star');
  for (let last = -1; last !== heldB.transactions().length;) { last = heldB.transactions().length; await sleep(600); }
  const farFrom = heldB.transactions().length;
  await heldC.data({ kind: 'clearing-open', world_ref: worldC, part_ref: 'page:far-away', audience: 'public', shown: { kind: 'page', label: 'Far away' } });
  await waitFor(async () => clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldC).some((c: any) => c.part_ref === 'page:far-away'), 'A, reading the whole field, to see C\'s public clearing');
  await sleep(1500);
  assert.equal(heldB.transactions().length, farFrom, `at Shared, what moves outside B's circle sends B nothing: ${JSON.stringify(heldB.transactions().slice(farFrom))}`);
  assert.deepEqual(clearingsOf(await heldB.data({ kind: 'worlds', aperture: 'shared' }), worldC), [], 'nor is it read there');
  const atFederated = await heldB.data({ kind: 'worlds', aperture: 'federated' });
  assert.equal(atFederated.world_scope, 'whole', 'Federated reads the whole field');
  assert.ok(clearingsOf(atFederated, worldC).some((c: any) => c.part_ref === 'page:far-away'), 'and C\'s public clearing with it');
  // What C withdraws past B's edge (SF14) sends B nothing at Shared either; read whole again, B reads it withdrawn, in words.
  await heldB.data({ kind: 'worlds', aperture: 'shared' });
  for (let last = -1; last !== heldB.transactions().length;) { last = heldB.transactions().length; await sleep(600); }
  const farGone = heldB.transactions().length;
  await heldC.data({ kind: 'clearing-withdraw', world_ref: worldC, part_ref: 'page:far-away' });
  await waitFor(async () => !clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldC).length, 'A, reading the whole field, to see C\'s clearing withdrawn');
  await sleep(1500);
  assert.equal(heldB.transactions().length, farGone, `at Shared, what is withdrawn outside B's circle sends B nothing: ${JSON.stringify(heldB.transactions().slice(farGone))}`);
  assert.deepEqual(withdrawalsOf(await heldB.data({ kind: 'worlds', aperture: 'shared' }), worldC), [], 'nor is it read there');
  const farWithdrawn = await heldB.data({ kind: 'worlds', aperture: 'federated' });
  assert.deepEqual(clearingsOf(farWithdrawn, worldC), [], 'at Federated what C withdrew is gone from what is shown');
  assert.deepEqual(withdrawalsOf(farWithdrawn, worldC).map(withdrawn), [{ world_ref: worldC, star_ref: null, reach: 'public', kind: 'page' }], 'and read as withdrawn from the public');
  const WORK_MARK = `WORK-MARK-858-${run}`, RETURN_MARK = `RETURN-MARK-858-${run}`;
  const workRef = 'run:01ARZ3NDEKTSV4RRFFQ69G5FAA';
  const shownWork = (revision: number, at: string, lifecycle = 'running') => ({
    schema: 'factory.shown-work/v1', owner: 'factory', work_ref: workRef, revision, name: `Charting the river ${WORK_MARK}`,
    standing: ['finished', 'aborted', 'archived'].includes(lifecycle) ? 'kept' : 'live', lifecycle,
    agents: [{ agent: 'Cartographer', at }], made: [{ label: 'The delta chart', standing: 'candidate' }], tasks: { [at]: 1 }, withheld: 1 });
  const worksOf = (snapshot: any) => (snapshot.star_works ?? []).filter((work: any) => work.star_ref === star);
  const offersOf = (snapshot: any) => (snapshot.star_offers ?? []).filter((offer: any) => offer.star_ref === star);
  // What the field refuses to carry: a key outside Factory's document, a local path in a label, a work its world is not gathered to show.
  const prompted = await heldA2.ask({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: { ...shownWork(3, 'runs'), prompt: `Chart it ${WORK_MARK}` } });
  assert.equal(prompted.ok, false, 'a shown work carries nothing beside what Factory chose to show');
  assert.match(prompted.error.message, /prompt is not part of the contract/, `refused in words: ${prompted.error.message}`);
  const pathed = await heldA2.ask({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: { ...shownWork(3, 'runs'), made: [{ label: '/Users/someone/river/chart.svg', standing: 'candidate' }] } });
  assert.equal(pathed.ok, false, 'a shown work names no file');
  assert.match(pathed.error.message, /local-only material/, `refused in words: ${pathed.error.message}`);
  const notGathered = await heldC.ask({ kind: 'work-show', star_ref: star, world_ref: worldC, shown: { ...shownWork(1, 'runs'), name: 'C\'s own work' } });
  assert.equal(notGathered.ok, false, 'a world waiting at the edge shows no work there');
  const showed = await heldA2.data({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(3, 'runs') });
  assert.deepEqual([showed.work.standing, showed.work.revision], ['live', 3], 'a work of an open Run is shown live, at the revision it was read at');
  const seenWork = await waitFor(async () => worksOf(await heldB.data({ kind: 'snapshot' }))[0], 'B, gathered, to watch A\'s work');
  assert.deepEqual(seenWork.shown, shownWork(3, 'runs'), 'B watches exactly what A showed: its agents at work, what they made and where it stands');
  await sleep(600);
  assert.deepEqual(worksOf(await heldC.data({ kind: 'snapshot' })), [], 'C, waiting at the edge, watches nothing');
  assert.ok(!heldC.raw.some((line) => line.includes(WORK_MARK)), 'and nothing C\'s client sent out names it');
  // Watching changes nothing: B reads it again and again; the row stands as A last showed it.
  for (let n = 0; n < 3; n += 1) await heldB.data({ kind: 'snapshot' });
  assert.equal(worksOf(await heldA2.data({ kind: 'snapshot' }))[0].updated_at_micros, showed.work.updated_at_micros, 'watching changes nothing in what is shown');
  // Live while its source answers (manual §17.2): a work answers on the connection that showed it. That window gone, B reads it as it
  // was last shown, the work itself untouched; shown again from a window of A's (the same reading), it answers again.
  assert.equal(seenWork.answering, true, 'B reads the work answering while the window that showed it stands');
  const heldA3 = holdAs('one-field-a'); held.push(heldA3);
  await heldA3.data({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(3, 'runs') });
  // A window started after A showed what it shows, on a device of its own: its AIKit is told all of it as the window goes live, never by
  // an act of its own (601c rulings 2 and 6: shown from another device, shown before the window started)
  const shownByA = await heldA2.data({ kind: 'worlds' });
  assert.ok(fieldShows(shownByA, worldA).length >= 3 && fieldShows(shownByA, hidden).length === 3, 'A shows parts of both its worlds (non-vacuous)');
  await waitFor(() => [worldA, hidden].every((world) => JSON.stringify(aikitHolds(heldA3, world)) === JSON.stringify(fieldShows(shownByA, world))), 'the new window\'s AIKit to be set right against what the field shows of A\'s worlds');
  assert.ok(aikitRan('disclose --list', heldA3).length >= 2, 'it listed what its AIKit held of each of A\'s worlds');
  // [601d ruling 1] at the shell's own aperture (World, which reads A's circle), a part A shows from another window sets this window's
  // AIKit right as well, by a list of what it holds, and withdrawn it is taken back (DLW build ruling 2026-11-09). Shown of A's unlinked
  // world, so nothing B reads of A moves.
  const atCircle = await heldA3.data({ kind: 'worlds', aperture: 'world' });
  assert.equal(atCircle.world_scope, 'circle', 'the shell\'s own aperture reads the circle');
  assert.equal(fieldShows(atCircle, hidden).length, 3, 'and A\'s own worlds are in it (non-vacuous)');
  await sleep(2 * GLANCE_MS);
  const circlePart = `page:at-the-circle-${run}`, listedBefore = aikitRan('disclose --list', heldA3).length;
  await heldA2.data({ kind: 'clearing-open', world_ref: hidden, part_ref: circlePart, audience: 'public', shown: { kind: 'page', label: 'Shown at the circle' } });
  await waitFor(() => aikitHolds(heldA3, hidden).includes(`${circlePart}@`), 'the window reading at the shell\'s aperture to have its AIKit set right as A shows a part from another window');
  assert.ok(aikitRan('disclose --list', heldA3).length > listedBefore, 'by a list of what its AIKit holds');
  await heldA2.data({ kind: 'clearing-withdraw', world_ref: hidden, part_ref: circlePart });
  await waitFor(() => !aikitHolds(heldA3, hidden).includes(`${circlePart}@`), 'and its AIKit to hold it no more once A withdraws it from another window');
  assert.equal(await heldA3.end(), 0);
  held.splice(held.indexOf(heldA3), 1);
  const away = await waitFor(async () => { const work = worksOf(await heldB.data({ kind: 'snapshot' }))[0]; return work?.answering === false && work; }, 'B to read the work away once the window that showed it is gone');
  assert.deepEqual([away.standing, away.revision, away.updated_at_micros, away.shown], ['live', 3, showed.work.updated_at_micros, shownWork(3, 'runs')], 'it reads as it was last shown');
  await heldA2.data({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(3, 'runs') });
  await waitFor(async () => worksOf(await heldB.data({ kind: 'snapshot' }))[0]?.answering === true, 'B to read the work answering again once A shows it again');
  assert.equal(worksOf(await heldA2.data({ kind: 'snapshot' }))[0].updated_at_micros, showed.work.updated_at_micros, 'answering again changes nothing in what is shown');
  assert.ok(!heldC.raw.some((line) => line.includes(workRef)), 'C, waiting at the edge, is told nothing of whether it answers');
  // Shown again as it moves, forward only; once its Run closes it stands as it was kept.
  await heldA2.data({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(4, 'returned') });
  await waitFor(async () => worksOf(await heldB.data({ kind: 'snapshot' }))[0]?.revision === 4, 'B to watch the work move');
  const backwards = await heldA2.ask({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(3, 'runs') });
  assert.equal(backwards.ok, false, 'an older reading never replaces a newer one');
  await heldA2.data({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(5, 'stopped', 'aborted') });
  const kept = await waitFor(async () => { const work = worksOf(await heldB.data({ kind: 'snapshot' }))[0]; return work?.standing === 'kept' && work; }, 'B to read the work as it was kept');
  assert.deepEqual(kept.shown, shownWork(5, 'stopped', 'aborted'));
  const afterKept = await heldA2.ask({ kind: 'work-show', star_ref: star, world_ref: worldA, shown: shownWork(6, 'runs') });
  assert.equal(afterKept.ok, false, 'a kept work stands as it was');
  assert.match(afterKept.error.message, /stands as it was/);

  await heldA2.data({ kind: 'star-admit', star_ref: star, world_ref: worldC });
  const offeredAt = Date.now();
  const offer = (ref: string, lapsesAt: number, at = offeredAt) => ({
    schema: 'factory.task-offer/v1', offer_ref: `offer:one-field-${run}-${ref}`, star_ref: star,
    programme: { run_ref: workRef, workflow_unit_ref: 'workflow-unit:01ARZ3NDEKTSV4RRFFQ69G5FAY' },
    task: { key: 'inspect-source', asks: 'Chart the delta\'s channels from the survey notes.', returns: 'factory.inspect-source/v1' },
    grant: { reads: ['project:river/docs'], touches: ['project:river/maps'], lapses_at: lapsesAt }, offered_at: at, automatic_agent_or_model_invocation: false });
  const back = (ofOffer: any, by: string, refs: string[]) => ({
    schema: 'factory.task-offer-return/v1', offer_ref: ofOffer.offer_ref, star_ref: star, by: { world_ref: by, name: 'B' },
    made: { label: 'The delta chart', summary: `Charted the delta's channels ${RETURN_MARK}`, refs }, returned_at: Date.now(), automatic_agent_or_model_invocation: false });
  const HOUR = 3_600_000;
  const tooLong = await heldA2.ask({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: offer('too-long', offeredAt + 31 * 24 * HOUR) });
  assert.equal(tooLong.ok, false, 'a grant lapses within thirty days');
  const runsItself = await heldA2.ask({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: { ...offer('runs-itself', offeredAt + HOUR), automatic_agent_or_model_invocation: true } });
  assert.equal(runsItself.ok, false, 'an offer runs nothing by itself');
  const YEAR = 365 * 24 * HOUR;
  const datedAhead = await heldA2.ask({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: offer('dated-ahead', offeredAt + 3 * YEAR + 29 * 24 * HOUR, offeredAt + 3 * YEAR) });
  assert.equal(datedAhead.ok, false, 'an offer dated years ahead of the field\'s clock is refused: its grant, capped from that date, would stand for years');
  assert.match(datedAhead.error.message, /ahead of the field's clock/);
  const o1 = offer('chart', offeredAt + HOUR);
  const put = await heldA2.data({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: o1 });
  assert.equal(put.state, 'open');
  for (const one of [heldB, heldC]) {
    const seen = await waitFor(async () => offersOf(await one.data({ kind: 'snapshot' })).find((o: any) => o.offer_ref === o1.offer_ref), `${one.label} to see the offer`);
    assert.deepEqual(seen.offer.grant, o1.grant, 'the worlds gathered at the star read the task and its grant: what it may read and touch, and when it lapses');
  }
  const notTheirs = await heldC.ask({ kind: 'offer-revoke', offer_ref: o1.offer_ref });
  assert.equal(notTheirs.ok, false, 'only the one who offered a task revokes it');
  const took = await heldB.data({ kind: 'offer-take', offer_ref: o1.offer_ref, world_ref: worldB });
  assert.deepEqual([took.state, took.offer.taker_world_ref], ['taken', worldB], 'one world takes the task up');
  await waitFor(async () => !offersOf(await heldC.data({ kind: 'snapshot' })).some((o: any) => o.offer_ref === o1.offer_ref), 'the taken offer to leave C\'s view');
  assert.equal((await heldC.ask({ kind: 'offer-take', offer_ref: o1.offer_ref, world_ref: worldC })).ok, false, 'and nobody else takes it');
  const outside = await heldB.ask({ kind: 'offer-return', offer_ref: o1.offer_ref, return: back(o1, worldB, ['project:river/docs/notes']) });
  assert.equal(outside.ok, false, 'nothing comes back that touched past the grant');
  assert.match(outside.error.message, /grant does not let the task touch/, `refused in words: ${outside.error.message}`);
  const otherName = await heldB.ask({ kind: 'offer-return', offer_ref: o1.offer_ref, return: back(o1, worldC, ['project:river/maps/delta']) });
  assert.equal(otherName.ok, false, 'what comes back comes under the taker\'s name');
  const returned = await heldB.data({ kind: 'offer-return', offer_ref: o1.offer_ref, return: back(o1, worldB, ['project:river/maps/delta']) });
  assert.equal(returned.state, 'returned');
  const cameBack = await waitFor(async () => { const o = offersOf(await heldA2.data({ kind: 'snapshot' })).find((o: any) => o.offer_ref === o1.offer_ref); return o?.state === 'returned' && o; }, 'A to read what came back');
  assert.deepEqual([cameBack.returned.by.world_ref, cameBack.returned.made.refs], [worldB, ['project:river/maps/delta']], 'what it made comes back under B\'s name, within the grant');
  assert.equal(cameBack.state, 'returned', 'and stands apart until A accepts it');
  assert.equal((await heldB.ask({ kind: 'offer-accept', offer_ref: o1.offer_ref })).ok, false, 'only the offerer accepts');
  assert.equal((await heldA2.data({ kind: 'offer-accept', offer_ref: o1.offer_ref })).state, 'accepted');
  await waitFor(async () => offersOf(await heldB.data({ kind: 'snapshot' })).find((o: any) => o.offer_ref === o1.offer_ref)?.state === 'accepted', 'B to read that what it made was accepted');
  for (const payload of [await heldC.data({ kind: 'snapshot' }), await heldC.data({ kind: 'observe' })]) assert.ok(!JSON.stringify(payload).includes(RETURN_MARK), 'C reads nothing that came back to an offer it did not make or take');
  assert.ok(!heldC.raw.some((line) => line.includes(RETURN_MARK)), 'and nothing C\'s client sent out names it');
  // Revoked at any moment: nothing goes back.
  const o2 = offer('survey', offeredAt + HOUR);
  await heldA2.data({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: o2 });
  await waitFor(async () => offersOf(await heldB.data({ kind: 'snapshot' })).some((o: any) => o.offer_ref === o2.offer_ref), 'B to see the second offer');
  await heldB.data({ kind: 'offer-take', offer_ref: o2.offer_ref, world_ref: worldB });
  await waitFor(async () => offersOf(await heldA2.data({ kind: 'snapshot' })).find((o: any) => o.offer_ref === o2.offer_ref)?.state === 'taken', 'A to see the second offer taken');
  assert.equal((await heldA2.data({ kind: 'offer-revoke', offer_ref: o2.offer_ref })).state, 'revoked');
  await waitFor(async () => offersOf(await heldB.data({ kind: 'snapshot' })).find((o: any) => o.offer_ref === o2.offer_ref)?.state === 'revoked', 'B to be told the grant was revoked');
  const afterRevoke = await heldB.ask({ kind: 'offer-return', offer_ref: o2.offer_ref, return: back(o2, worldB, ['project:river/maps/survey']) });
  assert.equal(afterRevoke.ok, false, 'a revoked grant brings nothing back');
  assert.match(afterRevoke.error.message, /revoked/);
  // A grant lapses when it said it would.
  const lapsingAt = Date.now();
  const o3 = offer('soon', lapsingAt + 2000, lapsingAt);
  await heldA2.data({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: o3 });
  await waitFor(async () => offersOf(await heldB.data({ kind: 'snapshot' })).some((o: any) => o.offer_ref === o3.offer_ref), 'B to see the lapsing offer');
  await sleep(Math.max(0, lapsingAt + 2600 - Date.now()));
  const lapsedTake = await heldB.ask({ kind: 'offer-take', offer_ref: o3.offer_ref, world_ref: worldB });
  assert.equal(lapsedTake.ok, false, 'a lapsed grant is taken by nobody');
  assert.match(lapsedTake.error.message, /lapsed/);
  // No leaks, with work and tasks at stars: A lights a star B and C are not let in to, and shows a work and offers a task there under
  // the private mark of its unshown page. Neither receives it in any payload, count, Explore graph or line its client sent out, while
  // each reads the work and tasks at the star it is gathered at (non-vacuous).
  const alone = `star:one-field:${run}:alone`;
  await heldA2.data({ kind: 'star-light', star_ref: alone, world_ref: worldA, name: 'Alone', gathers: 'Nothing for anyone yet', comes: 'asked' });
  await heldA2.data({ kind: 'work-show', star_ref: alone, world_ref: worldA, shown: { ...shownWork(1, 'runs'), work_ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5FCC', name: `Alone ${MARK}` } });
  const oAlone = { ...offer('alone', Date.now() + HOUR), star_ref: alone, task: { key: 'inspect-source', asks: `Alone ${MARK}`, returns: 'factory.inspect-source/v1' } };
  await heldA2.data({ kind: 'offer-put', star_ref: alone, world_ref: worldA, offer: oAlone });
  const ownAlone = await heldA2.data({ kind: 'snapshot' });
  assert.ok(JSON.stringify(ownAlone.star_works.filter((w: any) => w.star_ref === alone)).includes(MARK) && ownAlone.star_offers.some((o: any) => o.offer_ref === oAlone.offer_ref),
    'A reads the work and task it put at its lone star (non-vacuous)');
  await sleep(1500);
  for (const [one, from] of [[heldB, rawFrom], [heldC, 0]] as const) {
    const observed = await one.data({ kind: 'observe' });
    // each aperture's reading; Federated last, as the rest of this walk reads the whole field
    const sweep = [observed, await one.data({ kind: 'snapshot' }), await one.data({ kind: 'worlds', aperture: 'shared' }), await one.data({ kind: 'worlds', aperture: 'federated' }),
      await one.data({ kind: 'read', ref: alone }), await one.data({ kind: 'status' }),
      observed.snapshot.entries.map((entry: any) => createExploreSurfaceModelFromHostedSnapshot(observed.snapshot).open(entry.ref, { depth: 2, budget: 64 }))];
    assert.ok((sweep[1].star_offers ?? []).some((o: any) => o.star_ref === star), `${one.label} reads the tasks at the star it is gathered at (non-vacuous)`);
    for (const payload of sweep) assert.ok(!JSON.stringify(payload).includes(MARK), `${one.label} received the private mark: ${JSON.stringify(payload).slice(0, 400)}`);
    assert.equal((sweep[1].star_works ?? []).filter((w: any) => w.star_ref === alone).length + (sweep[1].star_offers ?? []).filter((o: any) => o.star_ref === alone).length, 0,
      `${one.label} counts no work or task at a star it is not at`);
    assert.ok(!one.raw.slice(from).some((line) => line.includes(MARK)), `nothing ${one.label}'s client sent out names the mark`);
  }
  await heldA2.data({ kind: 'star-close', star_ref: alone });

  // What B showed and offered at the star goes when B leaves it.
  const bWork = { ...shownWork(1, 'runs'), work_ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5FBB', name: 'Reading the fourth plate' };
  await heldB.data({ kind: 'work-show', star_ref: star, world_ref: worldB, shown: bWork });
  const oB = { ...offer('b-reads', offeredAt + HOUR), programme: { run_ref: bWork.work_ref, workflow_unit_ref: 'workflow-unit:01ARZ3NDEKTSV4RRFFQ69G5FBC' } };
  await heldB.data({ kind: 'offer-put', star_ref: star, world_ref: worldB, offer: oB });
  await waitFor(async () => { const seen = await heldA2.data({ kind: 'snapshot' }); return worksOf(seen).some((w: any) => w.world_ref === worldB) && offersOf(seen).some((o: any) => o.offer_ref === oB.offer_ref); }, 'A to see what B shows and offers');
  await heldB.data({ kind: 'star-leave', star_ref: star, world_ref: worldB });
  await waitFor(async () => { const seen = await heldA2.data({ kind: 'snapshot' }); return !worksOf(seen).some((w: any) => w.world_ref === worldB) && !offersOf(seen).some((o: any) => o.offer_ref === oB.offer_ref); }, 'B\'s leaving to take back its work and its offer');
  assert.equal(offersOf(await heldB.data({ kind: 'snapshot' })).find((o: any) => o.offer_ref === oB.offer_ref)?.state, 'revoked', 'an offer whose world left the star is revoked');
  const DAY_WORK = [...DAY_LEFT, [worldB, 'asked'], [worldC, 'asked'], [worldB, 'let-in'], [worldA, 'showed'], [worldC, 'let-in'],
    [worldA, 'offered'], [worldB, 'took'], [worldB, 'brought-back'], [worldA, 'offered'], [worldB, 'took'], [worldA, 'revoked'], [worldA, 'offered'],
    [worldB, 'showed'], [worldB, 'offered'], [worldB, 'left']];
  const dayWork = await waitFor(async () => { const seen = await heldA2.data({ kind: 'snapshot' }); return dayOf(seen).length === DAY_WORK.length && seen; }, 'A to read the work and offers in the star\'s day');
  assert.deepEqual(dayOf(dayWork), DAY_WORK, 'the star\'s day records that work was shown, tasks offered, taken, brought back and revoked');
  const workDayText = JSON.stringify((dayWork.star_days ?? []).filter((entry: any) => entry.star_ref === star));
  assert.ok(![WORK_MARK, RETURN_MARK, 'delta', 'river'].some((mark) => workDayText.includes(mark)), `never what: ${workDayText}`);

  /* ---------- a contribution to what another world shows (SF07) ----------
   * B, in the field, asks a question on a page A shows to the public. It stands on the page under B's name, as a question, and waits
   * for A: read by A and B alone until A accepts it in A's world, and then by whoever reads the page. C threads a finding under it; A
   * refuses the finding in words that reach C alone. C's correction to what A shows at the star, accepted, is read at the star alone: B,
   * gone from the star, never reads it. B takes its question back. A field C puts under A's world's name reads nothing contributed to
   * that world, and what waits, what is refused and what stands at a star reaches no payload, count, line or cursor of anyone else. */
  const contributionsOf = (snapshot: any) => {
    assert.equal(snapshot.world_contribution?.state, 'held', `the field keeps contributions to a world: ${JSON.stringify(snapshot.world_contribution)}`);
    return snapshot.world_contributions as any[];
  };
  const contributionIn = (snapshot: any, ref: string) => contributionsOf(snapshot).find((row: any) => row.contribution_ref === ref);
  const ASK_MARK = `ASKED-MARK-858-${run}`, FIND_MARK = `WAITING-MARK-858-${run}`, REFUSAL_MARK = `REFUSAL-MARK-858-${run}`, AT_STAR_MARK = `MENDED-MARK-858-${run}`;
  const ask = `contribution:one-field:${run}:b-asks`, find = `contribution:one-field:${run}:c-finds`, mend = `contribution:one-field:${run}:c-mends`;
  const plate = { world_ref: worldA, part_ref: 'page:reading-of-plate-4' };
  const squat = await open(target, 'one-field-c');
  try {
    // C puts a field under A's world's name: the SharedField's own pending and admitted views of it must read nothing contributed to A's world
    const squatted = createSharedField({ field_ref: worldA, kind: 'explore', visibility: 'private', title: 'A field under another world\'s name', provenance: [{ kind: 'controlled-test', ref: 'oi:test:one-field-live-acceptance', source_system: 'o-i', revision: '1' }] });
    await squat.conn.reducers.putSharedField({ fieldRef: worldA, kind: squatted.kind, visibility: squatted.visibility, contractJson: JSON.stringify(squatted) });
    const squatText = () => JSON.stringify([rows(squat.conn.db.ownerPendingContribution), rows(squat.conn.db.contribution), rows(squat.conn.db.myContributionReceipt)], (_key, value) => (typeof value === 'bigint' ? String(value) : value));
    const ownOnes = await heldA2.ask({ kind: 'world-contribute', contribution_ref: `contribution:one-field:${run}:a-own`, world_ref: worldA, to: plate, what: 'finding', words: 'My own page' });
    assert.equal(ownOnes.ok, false, 'a world contributes nothing to itself');
    assert.match(ownOnes.error.message, /your own world/, `refused in words: ${ownOnes.error.message}`);
    const asked = await heldB.data({ kind: 'world-contribute', contribution_ref: ask, world_ref: worldB, to: plate, what: 'question', words: `Which rose is the fourth? ${ASK_MARK}` });
    assert.deepEqual([asked.state, asked.contribution.from_world_ref, asked.contribution.world_ref, asked.contribution.to, asked.contribution.what], ['waiting', worldB, worldA, { ...plate, star_ref: null }, 'question'],
      'B\'s question stands on A\'s page under B\'s name, as a question, and waits for A');
    const waiting = await waitFor(async () => { const seen = contributionIn(await heldA2.data({ kind: 'snapshot' }), ask); return seen?.state === 'waiting' && seen; }, 'A to read B\'s question waiting');
    assert.equal(waiting.words, `Which rose is the fourth? ${ASK_MARK}`, 'A reads it as B said it');
    // who sent it is named by its world; the field never hands A the identity B sent it under
    const waitingRows = await waitFor(() => { const seen = rows((a.conn.db as any).worldContributionWaiting); return seen.length > 0 && seen; }, 'A\'s own client to hold what waits for its world');
    assert.ok(waitingRows.every((row: any) => row.submitterIdentity.toHexString() === a.identityHex), 'what waits for A names no identity but A\'s own');
    const refusedAccept = await heldC.ask({ kind: 'world-contribution-accept', contribution_ref: ask });
    assert.equal(refusedAccept.ok, false, 'only the owner of the world it waits in accepts it');
    const refusedTakeBack = await heldC.ask({ kind: 'world-contribution-take-back', contribution_ref: ask });
    assert.equal(refusedTakeBack.ok, false, 'and only its contributor takes it back');
    await sleep(1500);
    assert.equal(contributionIn(await heldC.data({ kind: 'snapshot' }), ask), undefined, 'waiting, B\'s question is read by no one but A and B');
    assert.ok(!heldC.raw.some((line) => line.includes(ASK_MARK)), 'nothing C\'s client sent out names it');
    assert.ok(!squatText().includes(ASK_MARK), `a field under A's world's name reads nothing waiting there: ${squatText().slice(0, 400)}`);
    const accepted = await heldA2.data({ kind: 'world-contribution-accept', contribution_ref: ask, words: 'Thank you' });
    assert.equal(accepted.state, 'accepted', 'A accepts it in A\'s world');
    const seenByC = await waitFor(async () => { const seen = contributionIn(await heldC.data({ kind: 'snapshot' }), ask); return seen?.state === 'accepted' && seen; }, 'C to read B\'s question on A\'s page');
    assert.deepEqual([seenByC.from_world_ref, seenByC.what, seenByC.to, seenByC.words], [worldB, 'question', { ...plate, star_ref: null }, `Which rose is the fourth? ${ASK_MARK}`],
      'accepted, it stands on the page under B\'s name for whoever reads the page');
    assert.equal(seenByC.answer, undefined, 'and A\'s words to B are B\'s alone');
    assert.equal((await waitFor(async () => { const seen = contributionIn(await heldB.data({ kind: 'snapshot' }), ask); return seen?.state === 'accepted' && seen; }, 'B to read its question accepted')).answer?.words, 'Thank you',
      'B reads it accepted, with A\'s words');
    await sleep(600);
    assert.ok(!squatText().includes(ASK_MARK), 'nor anything accepted there');

    /* C threads a finding under B's question; A refuses it in words. B reads none of it: no payload, line or cursor. */
    for (let last = -1; last !== heldB.transactions().length;) { last = heldB.transactions().length; await sleep(600); }
    const quietB = heldB.transactions().length, cursorB = (await heldB.data({ kind: 'status' })).held.cursor, fromB = heldB.raw.length;
    const found = await heldC.data({ kind: 'world-contribute', contribution_ref: find, world_ref: worldC, to: { contribution_ref: ask }, what: 'finding', words: `The fourth is the white rose ${FIND_MARK}` });
    assert.deepEqual([found.state, found.contribution.world_ref, found.contribution.to], ['waiting', worldA, { contribution_ref: ask }], 'a contribution to a contribution threads under it and waits in the world the thread stands in');
    await waitFor(async () => contributionIn(await heldA2.data({ kind: 'snapshot' }), find)?.state === 'waiting', 'A to read C\'s finding waiting');
    const wordless = await heldA2.ask({ kind: 'world-contribution-refuse', contribution_ref: find, words: ' ' });
    assert.equal(wordless.ok, false, 'a refusal is given in words');
    const refused = await heldA2.data({ kind: 'world-contribution-refuse', contribution_ref: find, words: `Not under a question ${REFUSAL_MARK}` });
    assert.equal(refused.state, 'refused');
    const refusalC = await waitFor(async () => { const seen = contributionIn(await heldC.data({ kind: 'snapshot' }), find); return seen?.state === 'refused' && seen; }, 'the refusal to reach C');
    assert.equal(refusalC.answer?.words, `Not under a question ${REFUSAL_MARK}`, 'A\'s refusal reaches C with A\'s words');
    assert.equal(contributionIn(await heldA2.data({ kind: 'snapshot' }), find), undefined, 'refused, it waits for A no more');
    await sleep(1500);
    assert.equal(heldB.transactions().length, quietB, `no transaction reached B for a contribution it may not read: ${JSON.stringify(heldB.transactions().slice(quietB))}`);
    assert.equal((await heldB.data({ kind: 'status' })).held.cursor, cursorB, 'B\'s cursor did not move');
    for (const payload of [await heldB.data({ kind: 'snapshot' }), await heldB.data({ kind: 'worlds', aperture: 'federated' }), await heldB.data({ kind: 'read', ref: worldA })]) {
      const text = JSON.stringify(payload);
      assert.ok(!text.includes(FIND_MARK) && !text.includes(REFUSAL_MARK), `B read what waited, or its refusal: ${text.slice(0, 400)}`);
    }
    assert.ok(!heldB.raw.slice(fromB).some((line) => line.includes(FIND_MARK) || line.includes(REFUSAL_MARK)), 'nothing B\'s client sent out names them');

    /* C's correction to what A shows at the star, accepted: read at the star, never by B, who left it */
    const atStar = { world_ref: worldA, part_ref: 'page:for-the-circle', star_ref: star };
    await heldC.data({ kind: 'world-contribute', contribution_ref: mend, world_ref: worldC, to: atStar, what: 'correction', words: `The circle opens at the second plate ${AT_STAR_MARK}` });
    await waitFor(async () => contributionIn(await heldA2.data({ kind: 'snapshot' }), mend)?.state === 'waiting', 'A to read C\'s correction waiting');
    await heldA2.data({ kind: 'world-contribution-accept', contribution_ref: mend });
    const mended = await waitFor(async () => { const seen = contributionIn(await heldC.data({ kind: 'snapshot' }), mend); return seen?.state === 'accepted' && seen; }, 'C to read its correction accepted');
    assert.deepEqual(mended.to, atStar, 'it stands on what A shows at the star');
    await sleep(1500);
    // each aperture's reading; Federated last, as the rest of this walk reads the whole field
    for (const payload of [await heldB.data({ kind: 'snapshot' }), await heldB.data({ kind: 'worlds', aperture: 'shared' }), await heldB.data({ kind: 'worlds', aperture: 'federated' })]) {
      assert.ok(!JSON.stringify(payload).includes(AT_STAR_MARK), 'B, gone from the star, reads nothing that stands there');
    }
    assert.ok(!heldB.raw.slice(fromB).some((line) => line.includes(AT_STAR_MARK)), 'nothing B\'s client sent out names it');
    assert.ok(![ASK_MARK, FIND_MARK, REFUSAL_MARK, AT_STAR_MARK].some((mark) => squatText().includes(mark)), 'a field under A\'s world\'s name read none of it');

    /* Contributions follow the Aperture (DLW build ruling 2026-11-06): at World, Local and Shared B reads those that stand in its circle
     * alone. A's world is outside it since B left A's star, so C's reproduction on A's public page, accepted there, sends B nothing at
     * Shared — no payload, line or cursor — while B's own question in A's world is still read there; at Federated B reads it on the page. */
    const FAR_MARK = `FAR-MARK-858-${run}`, repeat = `contribution:one-field:${run}:c-repeats`;
    assert.equal((await heldB.data({ kind: 'worlds', aperture: 'shared' })).world_scope, 'circle');
    for (let last = -1; last !== heldB.transactions().length;) { last = heldB.transactions().length; await sleep(600); }
    const quietFar = heldB.transactions().length, cursorFar = (await heldB.data({ kind: 'status' })).held.cursor, fromFar = heldB.raw.length;
    await heldC.data({ kind: 'world-contribute', contribution_ref: repeat, world_ref: worldC, to: plate, what: 'reproduction', words: `I read the same rose there ${FAR_MARK}` });
    await waitFor(async () => contributionIn(await heldA2.data({ kind: 'snapshot' }), repeat)?.state === 'waiting', 'A to read C\'s reproduction waiting');
    await heldA2.data({ kind: 'world-contribution-accept', contribution_ref: repeat });
    await waitFor(async () => contributionIn(await heldC.data({ kind: 'snapshot' }), repeat)?.state === 'accepted', 'C to read its reproduction accepted');
    await sleep(1500);
    assert.equal(heldB.transactions().length, quietFar, `at Shared, a contribution accepted outside B's circle sends B nothing: ${JSON.stringify(heldB.transactions().slice(quietFar))}`);
    assert.equal((await heldB.data({ kind: 'status' })).held.cursor, cursorFar, 'B\'s cursor did not move');
    const farShared = await heldB.data({ kind: 'worlds', aperture: 'shared' });
    assert.ok(!JSON.stringify(farShared).includes(FAR_MARK), `nor is it read there: ${JSON.stringify(farShared.world_contributions)}`);
    assert.equal(contributionIn(farShared, ask)?.state, 'accepted', 'B\'s own contribution in A\'s world is read at every aperture');
    assert.ok(!heldB.raw.slice(fromFar).some((line) => line.includes(FAR_MARK)), 'nothing B\'s client sent out names it');
    // Federated last, as the rest of this walk reads the whole field
    const farWhole = await waitFor(async () => { const seen = await heldB.data({ kind: 'worlds', aperture: 'federated' }); return contributionIn(seen, repeat) && seen; }, 'B, at Federated, to read C\'s reproduction');
    assert.deepEqual([contributionIn(farWhole, repeat).from_world_ref, contributionIn(farWhole, repeat).to], [worldC, { ...plate, star_ref: null }], 'at Federated B reads it on A\'s page, under C\'s name');

    /* B takes its question back: it stands nowhere, for anyone */
    await heldB.data({ kind: 'world-contribution-take-back', contribution_ref: ask });
    await waitFor(async () => !contributionIn(await heldC.data({ kind: 'snapshot' }), ask) && !contributionIn(await heldA2.data({ kind: 'snapshot' }), ask), 'B\'s question to be taken back');
    assert.equal(contributionIn(await heldB.data({ kind: 'snapshot' }), ask), undefined, 'taken back, it stands nowhere');
    const fromC = heldC.raw.length;
    await sleep(1500);
    for (const payload of [await heldC.data({ kind: 'snapshot' }), await heldC.data({ kind: 'worlds', aperture: 'federated' }), await heldC.data({ kind: 'read', ref: worldA })]) {
      assert.ok(!JSON.stringify(payload).includes(ASK_MARK), `C reads nothing of a question taken back: ${JSON.stringify(payload).slice(0, 400)}`);
    }
    assert.ok(!heldC.raw.slice(fromC).some((line) => line.includes(ASK_MARK)), 'nor does anything C\'s client sends out after');
  } finally { close(squat); }

  /* ---------- the same work in two worlds (SF09; manual §17.2 "Contribute", §8 "readings that disagree laid side by side") ----------
   * B shows to the field a page by the name A's public page bears, and claims they are one: the claim is a contribution on A's page,
   * of the kind `same`, that sets B's page beside it. It waits for A like any other, read by A and B alone, and A reads which part of
   * B's it sets beside A's own only while A may read that part: B withdraws it and the claim names B's world alone; shown again, the
   * part is named again. Accepted, C reads it on A's page with B's part beside it, and disputes it by contributing under it. Withdrawn
   * once more, B's part is named to no one but B. A part B does not show stands beside nothing: the claim is refused, and the part is
   * named in no payload or line of anyone else's. Taken back, the claim stands nowhere. */
  const SAME_MARK = `SAME-MARK-858-${run}`, UNSHOWN_MARK = `UNSHOWN-COPY-858-${run}`, COPY = `page:b-plate-4-${run}`;
  const same = `contribution:one-field:${run}:b-same`, doubt = `contribution:one-field:${run}:c-doubts`;
  const copyLabel = 'A reading of the fourth plate';
  const sameOf = (snapshot: any) => contributionIn(snapshot, same);
  await heldB.data({ kind: 'clearing-open', world_ref: worldB, part_ref: COPY, audience: 'field', shown: { kind: 'page', label: copyLabel } });
  const unshownClaim = await heldB.ask({ kind: 'world-claim-same', contribution_ref: `contribution:one-field:${run}:b-unshown`, world_ref: worldB, to: plate,
    beside: { part_ref: `page:${UNSHOWN_MARK}` }, words: 'Mine is the same' });
  assert.equal(unshownClaim.ok, false, 'a part B does not show stands beside nothing');
  assert.match(unshownClaim.error.message, /Show it first/, `refused in words: ${unshownClaim.error.message}`);
  const ownSame = await heldA2.ask({ kind: 'world-claim-same', contribution_ref: `contribution:one-field:${run}:a-same`, world_ref: worldA, to: plate,
    beside: { part_ref: 'page:reading-of-plate-4' }, words: 'Mine' });
  assert.equal(ownSame.ok, false, 'a world claims nothing of its own world');
  const asC = await heldB.ask({ kind: 'world-claim-same', contribution_ref: `contribution:one-field:${run}:b-as-c`, world_ref: worldC, to: plate,
    beside: { part_ref: `page:${UNSHOWN_MARK}` }, words: 'Theirs' });
  assert.equal(asC.ok, false, 'B claims for no world but its own');
  assert.match(asC.error.message, /not yours/, `refused as not B's before anything of C's is looked at, so asking tells B nothing of what C shows: ${asC.error.message}`);
  const asKind = await heldB.ask({ kind: 'world-contribute', contribution_ref: `contribution:one-field:${run}:b-as-kind`, world_ref: worldB, to: plate, what: 'same', words: 'The same' });
  assert.equal(asKind.ok, false, 'a claim of the same work sets a part beside it: it is never a plain contribution');
  const claimed = await heldB.data({ kind: 'world-claim-same', contribution_ref: same, world_ref: worldB, to: plate, beside: { part_ref: COPY }, words: `They are one reading ${SAME_MARK}` });
  assert.deepEqual([claimed.state, claimed.contribution.what, claimed.contribution.from_world_ref, claimed.contribution.world_ref, claimed.contribution.to, claimed.contribution.beside],
    ['waiting', 'same', worldB, worldA, { ...plate, star_ref: null }, { world_ref: worldB, part_ref: COPY, star_ref: null }],
    'B\'s claim stands on A\'s page under B\'s name, sets B\'s page beside it, and waits for A');
  const sameAtA = await waitFor(async () => { const seen = sameOf(await heldA2.data({ kind: 'snapshot' })); return seen?.state === 'waiting' && seen; }, 'A to read B\'s claim waiting');
  assert.deepEqual(sameAtA.beside, { world_ref: worldB, part_ref: COPY, star_ref: null }, 'A reads which part of B\'s it sets beside A\'s, as A reads that part');
  await sleep(1200);
  assert.equal(sameOf(await heldC.data({ kind: 'snapshot' })), undefined, 'waiting, the claim is read by A and B alone');
  assert.ok(!heldC.raw.some((line) => line.includes(SAME_MARK)), 'nothing C\'s client sent out names it');
  // withdrawn, B's part is named to no one but B: the claim names B's world alone; shown again, the part is named again
  await heldB.data({ kind: 'clearing-withdraw', world_ref: worldB, part_ref: COPY });
  const blind = await waitFor(async () => { const seen = sameOf(await heldA2.data({ kind: 'snapshot' })); return seen && seen.beside?.part_ref === null && seen; }, 'A to read the claim with B\'s part withdrawn');
  assert.deepEqual(blind.beside, { world_ref: worldB, part_ref: null, star_ref: null }, 'the claim names B\'s world alone while A may not read B\'s part');
  assert.equal(sameOf(await heldB.data({ kind: 'snapshot' })).beside.part_ref, COPY, 'B reads its own part named');
  await heldB.data({ kind: 'clearing-open', world_ref: worldB, part_ref: COPY, audience: 'field', shown: { kind: 'page', label: copyLabel } });
  await waitFor(async () => sameOf(await heldA2.data({ kind: 'snapshot' }))?.beside?.part_ref === COPY, 'A to read B\'s part named again, shown again');
  // accepted, whoever reads A's page reads it there, B's part beside it as each may read that part; C disputes it under it
  await heldA2.data({ kind: 'world-contribution-accept', contribution_ref: same });
  const sameAtC = await waitFor(async () => { const seen = sameOf(await heldC.data({ kind: 'snapshot' })); return seen?.state === 'accepted' && seen; }, 'C to read B\'s claim on A\'s page');
  assert.deepEqual([sameAtC.what, sameAtC.from_world_ref, sameAtC.to, sameAtC.beside], ['same', worldB, { ...plate, star_ref: null }, { world_ref: worldB, part_ref: COPY, star_ref: null }],
    'C reads the claim on A\'s page, with B\'s part beside it');
  const doubted = await heldC.data({ kind: 'world-contribute', contribution_ref: doubt, world_ref: worldC, to: { contribution_ref: same }, what: 'question', words: 'Is the second reading the same plate?' });
  assert.deepEqual([doubted.state, doubted.contribution.to], ['waiting', { contribution_ref: same }], 'the claim is disputed under it, as any contribution is');
  await heldB.data({ kind: 'clearing-withdraw', world_ref: worldB, part_ref: COPY });
  await waitFor(async () => sameOf(await heldC.data({ kind: 'snapshot' }))?.beside?.part_ref === null, 'C to read the claim with B\'s part withdrawn');
  for (const payload of [await heldC.data({ kind: 'snapshot' }), await heldC.data({ kind: 'worlds', aperture: 'federated' }), await heldA2.data({ kind: 'snapshot' })]) {
    assert.ok(!JSON.stringify(sameOf(payload) ?? {}).includes(COPY), `withdrawn, B's part is named in no claim another reads: ${JSON.stringify(sameOf(payload))}`);
  }
  for (const [label, one] of [['A', heldA2], ['C', heldC]] as const) {
    for (const payload of [await one.data({ kind: 'snapshot' }), await one.data({ kind: 'worlds', aperture: 'federated' })]) {
      assert.ok(!JSON.stringify(payload).includes(UNSHOWN_MARK), `${label} reads nothing of a part B never showed: ${JSON.stringify(payload).slice(0, 300)}`);
    }
    assert.ok(!one.raw.some((line) => line.includes(UNSHOWN_MARK)), `nothing ${label}'s client sent out names it`);
  }
  await heldC.data({ kind: 'world-contribution-take-back', contribution_ref: doubt });
  await heldB.data({ kind: 'world-contribution-take-back', contribution_ref: same });
  await waitFor(async () => !sameOf(await heldC.data({ kind: 'snapshot' })) && !sameOf(await heldA2.data({ kind: 'snapshot' })), 'B\'s claim to be taken back');

  /* ---------- a world's agent answers at a star (SF10; manual §2 and §17.2: the agent that keeps a world is there to talk to) ----------
   * B, gathered at a star A lit, asks A's agent there by its role. The ask waits for A's agent and is read by A and B alone: C, gathered
   * there too, reads nothing of it, and the star's day does not record it. A's agent answers for A from what A shows at that star and
   * nothing else: an answer that cites a part A has not shown there is refused, as is one from an agent the ask was not addressed to, one
   * for a world it was not keeperAsked of, and one that points to work A did not offer there. Withdrawn, the part an answer cited is named to
   * no one but A. B takes the ask back. */
  const AGENT_MARK = `AGENT-MARK-858-${run}`, AGENT_ASK_MARK = `AGENT-ASK-MARK-858-${run}`;
  const agents = `star:one-field:${run}:agents`, keeperPart = 'page:what-the-keeper-says';
  await heldA2.data({ kind: 'star-light', star_ref: agents, world_ref: worldA, name: 'Ask the keepers', gathers: 'Questions for the worlds\' agents', comes: 'anyone' });
  for (const [one, world] of [[heldB, worldB], [heldC, worldC]] as const) assert.equal((await one.data({ kind: 'star-gather', star_ref: agents, world_ref: world })).state, 'gathered');
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: keeperPart, audience: 'star', star_ref: agents, shown: { kind: 'page', label: 'What the keeper says' } });
  const keeperAsk = `ask:one-field:${run}:b-keeper`;
  const asksOf = (snapshot: any): any[] => {
    assert.equal(snapshot.agent_ask?.state, 'held', `the field keeps what is asked of a world's agent: ${JSON.stringify(snapshot.agent_ask)}`);
    return snapshot.agent_asks;
  };
  const keeperAskOf = (snapshot: any) => asksOf(snapshot).find((row) => row.ask_ref === keeperAsk);
  const askB = (more: any) => heldB.ask({ kind: 'world-agent-ask', ask_ref: `ask:one-field:${run}:b-refused`, star_ref: agents, world_ref: worldB, to_world_ref: worldA, by: 'role', address: 'librarian', words: 'Is it?', ...more });
  const ownAgent = await askB({ to_world_ref: worldB });
  assert.equal(ownAgent.ok, false, 'a world asks another world\'s agent at a star, never its own');
  const noWay = await askB({ by: 'mood' });
  assert.equal(noWay.ok, false, 'an agent is addressed by its name, its role or the exact instance running');
  assert.match(noWay.error.message, /its name, its role or the exact instance/, `refused in words: ${noWay.error.message}`);
  const asAnother = await askB({ world_ref: worldC });
  assert.match(asAnother.ok ? '' : asAnother.error.message, /not yours/, 'B asks for no world but its own');
  const keeperAsked = await heldB.data({ kind: 'world-agent-ask', ask_ref: keeperAsk, star_ref: agents, world_ref: worldB, to_world_ref: worldA, by: 'role', address: 'librarian',
    words: `What does the fourth plate show? ${AGENT_ASK_MARK}` });
  assert.deepEqual([keeperAsked.state, keeperAsked.ask.world_ref, keeperAsked.ask.to_world_ref, keeperAsked.ask.star_ref, keeperAsked.ask.by, keeperAsked.ask.address, keeperAsked.ask.answer],
    ['waiting', worldB, worldA, agents, 'role', 'librarian', null], 'B\'s ask of A\'s agent stands at the star, addressed by its role, and waits');
  const atA = await waitFor(async () => keeperAskOf(await heldA2.data({ kind: 'snapshot' })), 'A to read B\'s ask of its agent');
  assert.equal(atA.words, `What does the fourth plate show? ${AGENT_ASK_MARK}`, 'A reads it as B asked it');
  // A's window relays it to A's agent through AIKit, as it was addressed, and reads its replies by the ref AIKit gave (601b ruling 1)
  const relayedAsk = await waitFor(() => sentFor(keeperAsk).length && sentFor(keeperAsk), 'A\'s window to relay B\'s ask to A\'s agent');
  assert.deepEqual(relayedAsk[0].argv.slice(0, 4), ['gateway', 'send', '--to', `central:position:${worldA}:librarian`], 'by its role: A\'s world\'s Position');
  const relayedRef = 'aikit:communique:' + keeperAsk.replace(/[^A-Za-z0-9]/g, '-');
  await waitFor(() => aikitRan('replies').some((one) => one.argv[2] === relayedRef), 'A\'s window to read its agent\'s replies');
  await sleep(1200);
  assert.equal(keeperAskOf(await heldC.data({ kind: 'snapshot' })), undefined, 'C, gathered at the star too, reads nothing of it');
  assert.ok(!heldC.raw.some((line) => line.includes(AGENT_ASK_MARK)), 'nothing C\'s client sent out names it');
  // A's agent answers for A; the guard: nothing A has not shown there, only as the agent addressed, no work A did not offer there
  const keeper = { name: 'Thoth', role: 'librarian', instance: `actuation:generation:${run}` };
  const answerA = (more: any) => heldA2.ask({ kind: 'world-agent-answer', ask_ref: keeperAsk, world_ref: worldA, agent: keeper, words: 'From my notes.', cites: [], ...more });
  const unshownCite = await answerA({ cites: [{ part_ref: `page:${AGENT_MARK}` }] });
  assert.equal(unshownCite.ok, false, 'A\'s agent cites nothing A has not shown');
  assert.match(unshownCite.error.message, /shows nothing your world has not shown there/, `refused in words: ${unshownCite.error.message}`);
  const notThere = await answerA({ cites: [{ part_ref: 'page:for-the-circle', star_ref: star }] });
  assert.equal(notThere.ok, false, 'nor what A shows at another star: it answers from what A shows there');
  const notAddressed = await answerA({ agent: { ...keeper, role: 'scribe' } });
  assert.equal(notAddressed.ok, false, 'only the agent the ask was addressed to answers it');
  assert.match(notAddressed.error.message, /addressed/, `refused in words: ${notAddressed.error.message}`);
  const notAsked = await heldB.ask({ kind: 'world-agent-answer', ask_ref: keeperAsk, world_ref: worldB, agent: keeper, words: 'Me', cites: [] });
  assert.equal(notAsked.ok, false, 'no other world\'s agent answers for A');
  const othersWork = await answerA({ offer_ref: `offer:one-field-${run}-nowhere` });
  assert.equal(othersWork.ok, false, 'A\'s agent takes up no work: it points to none A did not offer at that star');
  assert.match(othersWork.error.message, /takes up no work/, `refused in words: ${othersWork.error.message}`);
  // the work it may point to is a task its own world offers at that star: not one the asking world offered there, nor one offered elsewhere
  const offerAt = (ref: string, at: string) => ({ ...offer(ref, Date.now() + HOUR), star_ref: at });
  const keeperOffer = offerAt('keeper-chart', agents), askersOffer = offerAt('askers-chart', agents), elsewhereOffer = offerAt('keeper-elsewhere', star);
  await heldA2.data({ kind: 'offer-put', star_ref: agents, world_ref: worldA, offer: keeperOffer });
  await heldB.data({ kind: 'offer-put', star_ref: agents, world_ref: worldB, offer: askersOffer });
  await heldA2.data({ kind: 'offer-put', star_ref: star, world_ref: worldA, offer: elsewhereOffer });
  for (const [label, other] of [['the asking world\'s', askersOffer], ['its own at another star', elsewhereOffer]] as const) {
    const pointed = await answerA({ offer_ref: other.offer_ref });
    assert.match(pointed.ok ? '' : pointed.error.message, /takes up no work/, `A's agent points to no task but its world's offer at that star, not ${label}`);
  }
  const answered = await heldA2.data({ kind: 'world-agent-answer', ask_ref: keeperAsk, world_ref: worldA, agent: keeper, words: 'The circle opens at the fourth plate.',
    cites: [{ part_ref: keeperPart, star_ref: agents }], offer_ref: keeperOffer.offer_ref });
  assert.equal(answered.state, 'answered');
  const settleAnswered = await heldA2.ask({ kind: 'world-agent-settle', ask_ref: keeperAsk, words: 'Its answer cannot reach you.' });
  assert.match(settleAnswered.ok ? '' : settleAnswered.error.message, /answered already/, 'an answered ask is not settled (601c ruling 1)');
  const atB = await waitFor(async () => { const seen = keeperAskOf(await heldB.data({ kind: 'snapshot' })); return seen?.answer && seen; }, 'B to read the answer of A\'s agent');
  assert.deepEqual([atB.answer.agent, atB.answer.words, atB.answer.cites, atB.answer.offer_ref], [keeper, 'The circle opens at the fourth plate.', [{ part_ref: keeperPart, star_ref: agents }], keeperOffer.offer_ref],
    'B reads what A\'s agent answered, by which agent, the part of A\'s it answered from and the task A offers there it points to');
  const twice = await answerA({ words: 'Something else.' });
  assert.equal(twice.ok, false, 'an ask is answered once');
  await sleep(1200);
  assert.equal(keeperAskOf(await heldC.data({ kind: 'snapshot' })), undefined, 'answered, it is still the two worlds\' alone');
  // withdrawn, the part an answer cited is named to no one but A
  await heldA2.data({ kind: 'clearing-withdraw', world_ref: worldA, part_ref: keeperPart, star_ref: agents });
  await waitFor(async () => keeperAskOf(await heldB.data({ kind: 'snapshot' }))?.answer?.cites?.[0]?.part_ref === null, 'B to read the part cited withdrawn');
  assert.equal(keeperAskOf(await heldA2.data({ kind: 'snapshot' })).answer.cites[0].part_ref, keeperPart, 'A reads its own part named');
  for (const [label, one] of [['B', heldB], ['C', heldC]] as const) {
    assert.ok(!one.raw.some((line) => line.includes(AGENT_MARK)), `nothing ${label}'s client sent out names the part A never showed`);
  }
  await heldA2.data({ kind: 'offer-revoke', offer_ref: elsewhereOffer.offer_ref });
  const notTheAsker = await heldA2.ask({ kind: 'world-agent-unask', ask_ref: keeperAsk });
  assert.match(notTheAsker.ok ? '' : notTheAsker.error.message, /Only the world that asked/, 'the world asked does not take the ask back: the world that asked does');
  await heldB.data({ kind: 'world-agent-unask', ask_ref: keeperAsk });
  await waitFor(async () => !keeperAskOf(await heldA2.data({ kind: 'snapshot' })), 'A to read the ask taken back');
  assert.equal(sentFor(keeperAsk).length, 1, 'the ask was relayed once');
  await readsStop(relayedRef, 'answered and taken back, its replies are read no more');

  /* An ask its agent's answer cannot reach is settled by the asked world's window, in words, never as the agent (601c, DLW build ruling
   * 2026-11-09): only a window of the world asked settles it, as the field's record of that world's owner says; the world that asked reads
   * it closed, with the words, and C reads nothing of it; nothing answers it after; settled again exactly it changes nothing, and in other
   * words it is refused; A's window reads its replies no more; taken back, it goes with its settling. */
  const lostAsk = `ask:one-field:${run}:b-lost`;
  await heldB.data({ kind: 'world-agent-ask', ask_ref: lostAsk, star_ref: agents, world_ref: worldB, to_world_ref: worldA, by: 'role', address: 'librarian', words: 'Which plate is lost?' });
  const lostRef = 'aikit:communique:' + lostAsk.replace(/[^A-Za-z0-9]/g, '-');
  await waitFor(() => aikitRan('replies').some((one) => one.argv[2] === lostRef), 'A\'s window to read the replies to B\'s second ask');
  const lostOf = (snapshot: any) => asksOf(snapshot).find((row) => row.ask_ref === lostAsk);
  const LOST_WORDS = 'It may have reached the world\'s agent, but its answer cannot be read: AIKit did not answer within 30 s, and was stopped';
  const settleAs = (one: Held, words: string) => one.ask({ kind: 'world-agent-settle', ask_ref: lostAsk, words });
  const byAsker = await settleAs(heldB, LOST_WORDS);
  assert.match(byAsker.ok ? '' : byAsker.error.message, /Only the window of the world asked settles an ask/, 'the world that asked does not settle it');
  const byThird = await settleAs(heldC, LOST_WORDS);
  assert.match(byThird.ok ? '' : byThird.error.message, /no such ask/, 'nor a world that may not read it');
  // [601d; review of #947 finding 6] nor A's owner on a call that stands for one request: that is no window answering for the world asked
  const byOneShot = await onceAs('one-field-a', { kind: 'world-agent-settle', ask_ref: lostAsk, words: LOST_WORDS });
  assert.match(byOneShot.ok ? '' : byOneShot.error?.message ?? '', /from a window of yours that answers for the world asked/, `nor A's owner on a one-shot call: ${JSON.stringify(byOneShot)}`);
  // [601d ruling 2] words the field will not carry are refused for what they carry, in the words the window reads that by, so it settles
  // in its own words alone after (field-lib SETTLE_WORDS_REFUSED)
  for (const words of [`${LOST_WORDS}: /Users/someone/.aikit/runs/send.log`, 'x'.repeat(1001)]) {
    const refused = await settleAs(heldA2, words);
    assert.ok(!refused.ok && SETTLE_WORDS_REFUSED.test(refused.error.message), `refused for its words, as the window reads it: ${JSON.stringify(refused)}`);
  }
  const lostWordless = await settleAs(heldA2, '   ');
  assert.match(lostWordless.ok ? '' : lostWordless.error.message, /settled in words/, 'an ask is settled in words');
  const unknown = await heldA2.ask({ kind: 'world-agent-settle', ask_ref: `ask:one-field:${run}:never`, words: LOST_WORDS });
  assert.match(unknown.ok ? '' : unknown.error.message, /no such ask/, 'nothing is settled that was not asked');
  const lostSettled = await heldA2.data({ kind: 'world-agent-settle', ask_ref: lostAsk, words: LOST_WORDS });
  assert.deepEqual([lostSettled.state, lostSettled.ask.settled?.words, lostSettled.ask.answer], ['settled', LOST_WORDS, null]);
  const lostAtB = await waitFor(async () => lostOf(await heldB.data({ kind: 'snapshot' }))?.settled, 'B to read its ask settled');
  assert.deepEqual([lostAtB.words, lostAtB.complete], [LOST_WORDS, true], 'the world that asked reads it closed, complete, in the words of why its answer cannot reach it (601c ruling 1)');
  await sleep(1200);
  assert.equal(lostOf(await heldC.data({ kind: 'snapshot' })), undefined, 'C reads nothing of it');
  assert.equal((await settleAs(heldA2, LOST_WORDS)).ok, true, 'settled again exactly, it changes nothing');
  const otherWords = await settleAs(heldA2, 'Something else.');
  assert.match(otherWords.ok ? '' : otherWords.error.message, /settled already/, 'settled, it is not settled in other words');
  const lateAnswer = await heldA2.ask({ kind: 'world-agent-answer', ask_ref: lostAsk, world_ref: worldA, agent: keeper, words: 'Too late.', cites: [] });
  assert.match(lateAnswer.ok ? '' : lateAnswer.error.message, /settled: nothing answers it now/, 'nothing answers a settled ask');
  await readsStop(lostRef, 'settled, its replies are read no more');
  await heldB.data({ kind: 'world-agent-unask', ask_ref: lostAsk });
  await waitFor(async () => !lostOf(await heldA2.data({ kind: 'snapshot' })), 'A to read the settled ask taken back');
  const takenBack = await settleAs(heldA2, LOST_WORDS);
  assert.match(takenBack.ok ? '' : takenBack.error.message, /no such ask: it was taken back/, 'an ask taken back is settled no more');
  const askedAgain = await heldB.data({ kind: 'world-agent-ask', ask_ref: lostAsk, star_ref: agents, world_ref: worldB, to_world_ref: worldA, by: 'role', address: 'librarian', words: 'Which plate is lost now?' });
  assert.equal(askedAgain.ask.settled, null, 'taken back, it went with its settling: asked again under its name, it waits');
  await heldB.data({ kind: 'world-agent-unask', ask_ref: lostAsk });
  // A world the star's holder turns away takes back what it showed there: its own window, which did nothing, sets its AIKit right (601c
  // rulings 2 and 6). The holder's window tells nothing of another's world.
  const turnedPart = `page:c-at-${agents.replace(/[^A-Za-z0-9]/g, '-')}`;
  await heldC.data({ kind: 'clearing-open', world_ref: worldC, part_ref: turnedPart, audience: 'star', star_ref: agents, shown: { kind: 'page', label: 'What C shows to the agents' } });
  await waitFor(() => aikitHolds(heldC, worldC).includes(`${turnedPart}@${agents}`), 'C\'s AIKit to hold what C shows at the star');
  const ranBeforeTurn = { c: aikitRan('disclose', heldC).length, a: aikitRan('disclose', heldA2).length };
  const turned = await heldA2.data({ kind: 'star-leave', star_ref: agents, world_ref: worldC });
  assert.deepEqual(turned.aikit, { told: true, parts: 0, words: null }, 'turning another\'s world away tells the holder\'s AIKit nothing');
  await waitFor(() => !aikitHolds(heldC, worldC).includes(`${turnedPart}@${agents}`), 'C\'s AIKit to hold no more what C showed where it was turned away');
  assert.deepEqual(aikitRan('disclose', heldC).slice(ranBeforeTurn.c).map((one) => one.argv.join(' ')),
    [['gateway', 'disclose', '--world', worldC, '--part', turnedPart, '--star', agents, '--withdraw', '--json'].join(' ')], 'C\'s window takes back exactly that');
  assert.ok(!aikitRan('disclose', heldA2).slice(ranBeforeTurn.a).some((one) => one.argv.includes(worldC)), 'and the holder\'s window nothing of C\'s');
  await heldA2.data({ kind: 'star-close', star_ref: agents });

  /* ---------- a star renamed and handed on (SF03: "The star is mine to rename, close or hand on") ----------
   * A renames its star, and B and C read the new name. A hands it on to B: A and B alone read that it is being handed on; C cannot take
   * it on, and no world not gathered there is handed it. Handed on to C instead, B is handed it no longer, and C leaving drops it. A
   * keeps it, and B's take-on is refused; A hands it on again and B takes it on.
   * The star is B's: B renames it and closes it, while A no longer renames, hands on or closes it. The star's day says B took it on.
   * Closed while B hands it on to C, it is handed on no longer. */
  const HAND_MARK = `HAND-MARK-858-${run}`;
  const handed = `star:one-field:${run}:handed`;
  const heldStar = (snapshot: any) => (snapshot.stars ?? []).find((row: any) => row.star_ref === handed);
  const handOnOf = (snapshot: any) => {
    assert.equal(snapshot.star_hand_on?.state, 'held', `the field keeps a star being handed on: ${JSON.stringify(snapshot.star_hand_on)}`);
    return snapshot.star_hand_ons.find((row: any) => row.star_ref === handed);
  };
  await heldA2.data({ kind: 'star-light', star_ref: handed, world_ref: worldA, name: 'Plates, first light', gathers: 'The first plates', comes: 'anyone' });
  for (const [one, world] of [[heldB, worldB], [heldC, worldC]] as const) assert.equal((await one.data({ kind: 'star-gather', star_ref: handed, world_ref: world })).state, 'gathered');
  const renamed = await heldA2.data({ kind: 'star-light', star_ref: handed, world_ref: worldA, name: `The first plates ${HAND_MARK}`, gathers: 'Readings of the first plates', comes: 'anyone' });
  assert.deepEqual([renamed.star.name, renamed.star.gathers, renamed.star.lit_by], [`The first plates ${HAND_MARK}`, 'Readings of the first plates', worldA], 'A renames its star, lit again by it');
  await waitFor(async () => heldStar(await heldB.data({ kind: 'snapshot' }))?.name === `The first plates ${HAND_MARK}`, 'B to read the star renamed');
  const notHeld = await heldB.ask({ kind: 'star-hand-on', star_ref: handed, to_world_ref: worldC });
  assert.match(notHeld.ok ? '' : notHeld.error.message, /Only the one who holds a star/, 'B, gathered there, does not hand A\'s star on');
  const handNotThere = await heldA2.ask({ kind: 'star-hand-on', star_ref: handed, to_world_ref: hidden });
  assert.match(handNotThere.ok ? '' : handNotThere.error.message, /gathered at it/, 'a star is handed on only to a world gathered at it');
  const toB = await heldA2.data({ kind: 'star-hand-on', star_ref: handed, to_world_ref: worldB });
  assert.deepEqual([toB.state, toB.hand_on.from_world_ref, toB.hand_on.to_world_ref], ['handed-on', worldA, worldB], 'A hands its star on to B, and it waits for B');
  await waitFor(async () => handOnOf(await heldB.data({ kind: 'snapshot' }))?.from_world_ref === worldA, 'B to read the star handed on to it');
  await sleep(1200);
  assert.equal(handOnOf(await heldC.data({ kind: 'snapshot' })), undefined, 'C, gathered there too, reads nothing of it');
  assert.equal(heldStar(await heldC.data({ kind: 'snapshot' })).lit_by, worldA, 'and the star is still A\'s');
  const cTakes = await heldC.ask({ kind: 'star-take-on', star_ref: handed, world_ref: worldC });
  assert.match(cTakes.ok ? '' : cTakes.error.message, /not handed on to your world/, 'C does not take it on');
  // handed on again to another world, the first is handed it no longer; and a world that leaves the star is handed it no longer
  await heldA2.data({ kind: 'star-hand-on', star_ref: handed, to_world_ref: worldC });
  await waitFor(async () => handOnOf(await heldC.data({ kind: 'snapshot' }))?.to_world_ref === worldC, 'C to read the star handed on to it instead');
  await waitFor(async () => !handOnOf(await heldB.data({ kind: 'snapshot' })), 'B to read the star handed on to it no longer');
  await heldC.data({ kind: 'star-leave', star_ref: handed, world_ref: worldC });
  await waitFor(async () => !handOnOf(await heldA2.data({ kind: 'snapshot' })), 'A to read the star handed on no longer once C left it');
  assert.equal((await heldC.data({ kind: 'star-gather', star_ref: handed, world_ref: worldC })).state, 'gathered');
  await heldA2.data({ kind: 'star-hand-on', star_ref: handed, to_world_ref: worldB });
  await waitFor(async () => handOnOf(await heldB.data({ kind: 'snapshot' })), 'B to read the star handed on to it again');
  assert.equal((await heldA2.data({ kind: 'star-keep', star_ref: handed })).state, 'kept');
  await waitFor(async () => !handOnOf(await heldB.data({ kind: 'snapshot' })), 'B to read the star kept');
  const handKept = await heldB.ask({ kind: 'star-take-on', star_ref: handed, world_ref: worldB });
  assert.match(handKept.ok ? '' : handKept.error.message, /not handed on to your world/, 'kept, it is not B\'s to take on');
  await heldA2.data({ kind: 'star-hand-on', star_ref: handed, to_world_ref: worldB });
  await waitFor(async () => handOnOf(await heldB.data({ kind: 'snapshot' })), 'B to read the star handed on again');
  const handTook = await heldB.data({ kind: 'star-take-on', star_ref: handed, world_ref: worldB });
  assert.deepEqual([handTook.state, handTook.star.lit_by, handTook.star.mine, handTook.star.name], ['taken-on', worldB, true, `The first plates ${HAND_MARK}`], 'B takes it on: the star is B\'s, as it stood');
  await waitFor(async () => { const seen = heldStar(await heldA2.data({ kind: 'snapshot' })); return seen?.lit_by === worldB && seen.mine === false; }, 'A to read the star B\'s');
  assert.equal(handOnOf(await heldA2.data({ kind: 'snapshot' })), undefined, 'taken on, it is handed on no longer');
  for (const [label, request] of [['rename', { kind: 'star-light', star_ref: handed, world_ref: worldA, name: 'Mine again', gathers: 'x', comes: 'anyone' }],
    ['hand on', { kind: 'star-hand-on', star_ref: handed, to_world_ref: worldC }], ['close', { kind: 'star-close', star_ref: handed }]] as const) {
    const refused = await heldA2.ask(request);
    assert.equal(refused.ok, false, `A no longer may ${label} the star it handed on`);
  }
  await waitFor(async () => (await heldC.data({ kind: 'snapshot' })).star_days?.some((entry: any) => entry.star_ref === handed && entry.world_ref === worldB && entry.what === 'took-on'),
    'C to read in the star\'s day that B took it on');
  assert.equal((await heldB.data({ kind: 'star-light', star_ref: handed, world_ref: worldB, name: 'The first plates, read', gathers: 'Readings of the first plates', comes: 'asked' })).star.comes, 'asked',
    'B renames it and changes who may come');
  // The star's day after a hand-on (SF06; DLW build ruling 2026-11-06: the holder is meant). Asks are answered by whoever lets worlds in:
  // C, leaving and asking to come back, is read at the edge by B, who holds the star now, and by C; A, who lit the star and handed it on
  // and is gathered there still, reads the day as any gathered world does, everything but the asks.
  await heldC.data({ kind: 'star-leave', star_ref: handed, world_ref: worldC });
  assert.equal((await heldC.data({ kind: 'star-gather', star_ref: handed, world_ref: worldC })).state, 'asked', 'with B letting worlds in, C asks to come back');
  const asksAt = (snapshot: any) => (snapshot.star_days ?? []).filter((entry: any) => entry.star_ref === handed && entry.what === 'asked').map((entry: any) => entry.world_ref);
  assert.deepEqual(await waitFor(async () => { const asks = asksAt(await heldB.data({ kind: 'snapshot' })); return asks.length > 0 && asks; }, 'B, who took the star on, to read C\'s ask'),
    [worldC], 'the one who holds the star now reads the asks at its edge');
  assert.deepEqual(asksAt(await heldC.data({ kind: 'snapshot' })), [worldC], 'C reads its own ask');
  const dayOfA = await waitFor(async () => { const seen = await heldA2.data({ kind: 'snapshot' }); return (seen.star_days ?? []).some((entry: any) => entry.star_ref === handed && entry.world_ref === worldC && entry.what === 'left') && seen; },
    'A, gathered at the star it handed on, to read that C left');
  assert.deepEqual(asksAt(dayOfA), [], 'A, who lit the star and handed it on, reads no asks');
  assert.ok((dayOfA.star_days ?? []).some((entry: any) => entry.star_ref === handed && entry.world_ref === worldB && entry.what === 'took-on'), 'and reads the rest of the day');
  assert.equal((await heldB.data({ kind: 'star-admit', star_ref: handed, world_ref: worldC })).state, 'gathered', 'B lets C in');
  const handOnsIn = (value: any): any[] => (Array.isArray(value) ? value.flatMap(handOnsIn) : value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, inner]) => (key === 'star_hand_ons' && Array.isArray(inner) ? inner : handOnsIn(inner))) : []);
  const sentToC = heldC.raw.flatMap((line) => { try { return handOnsIn(JSON.parse(line)); } catch { return []; } });
  assert.ok(sentToC.length > 0 && sentToC.every((row: any) => row.to_world_ref === worldC), 'nothing C\'s client sent out names a star handed on to another world');
  // a star closed is handed on no longer
  await heldB.data({ kind: 'star-hand-on', star_ref: handed, to_world_ref: worldC });
  await waitFor(async () => handOnOf(await heldC.data({ kind: 'snapshot' }))?.from_world_ref === worldB, 'C to read the star B hands on to it');
  await heldB.data({ kind: 'star-close', star_ref: handed });
  await waitFor(async () => !handOnOf(await heldC.data({ kind: 'snapshot' })), 'C to read the closed star handed on no longer');

  /* ---------- a watch (DLW build ruling 2026-11-06; manual §2 "from someone you watch", §17.2 "watch") ----------
   * B's worlds watch others: B's alone. A, the world watched, is told nothing — no transaction, its cursor still — nor is C, and nothing
   * anywhere counts who watches whom. A watch shows nothing of B's and raises no reach, and Unwatch undoes it. B also watches from a
   * world it has not linked, named under a mark: the mark reaches no one. */
  const WATCH_MARK = `WATCH-MARK-858-${run}`;
  const quietB = `world:one-field:${run}:b-quiet-${WATCH_MARK}`;
  const watchesOf = (snapshot: any) => {
    assert.equal(snapshot.world_watch?.state, 'held', `the field keeps the worlds a world watches: ${JSON.stringify(snapshot.world_watch)}`);
    return (snapshot.world_watches as any[]).map((row) => [row.world_ref, row.watched_world_ref]);
  };
  await heldB.data({ kind: 'world-put', world_ref: quietB, body: body(`body:one-field:${run}:b-quiet`, 31), linked: false });
  const bAsRead = async (one: Held) => { const seen = await one.data({ kind: 'snapshot' }); return JSON.stringify([worldsOf(seen, worldB), clearingsOf(seen, worldB), withdrawalsOf(seen, worldB)]); };
  const bAsReadBefore = [await bAsRead(heldA2), await bAsRead(heldC)];
  const settle = async (one: Held) => {
    for (let last = -1; last !== one.transactions().length;) { last = one.transactions().length; await sleep(600); }
    return { from: one.transactions().length, cursor: (await one.data({ kind: 'status' })).held.cursor, raw: one.raw.length };
  };
  const quietA = await settle(heldA2), quietC = await settle(heldC);
  // Refused in words: a world of B's own; a world B does not read (A's unlinked one), in the words of one that does not exist; a watch
  // from a world not the caller's.
  const ownWatch = await heldB.ask({ kind: 'world-watch', world_ref: worldB, watched_world_ref: quietB });
  assert.equal(ownWatch.ok, false, 'a world of B\'s watches no world of B\'s');
  assert.match(ownWatch.error.message, /yours already/, `refused in words: ${ownWatch.error.message}`);
  const unread = await heldB.ask({ kind: 'world-watch', world_ref: worldB, watched_world_ref: hidden });
  const nowhere = await heldB.ask({ kind: 'world-watch', world_ref: worldB, watched_world_ref: `world:one-field:${run}:nowhere` });
  assert.equal(unread.ok, false, 'B watches no world it does not read');
  assert.equal(unread.error.message, nowhere.error.message, 'refused as a world that does not exist is');
  const notB = await heldC.ask({ kind: 'world-watch', world_ref: worldB, watched_world_ref: worldA });
  assert.equal(notB.ok, false, 'C watches nothing from B\'s world');
  const watched = await heldB.data({ kind: 'world-watch', world_ref: worldB, watched_world_ref: worldA });
  assert.equal(watched.state, 'watching');
  assert.deepEqual(Object.keys(watched.watch).sort(), ['watched_at_micros', 'watched_world_ref', 'world_ref'], 'a watch names the two worlds and when, no more');
  assert.deepEqual([watched.watch.world_ref, watched.watch.watched_world_ref], [worldB, worldA]);
  assert.match(watched.watch.watched_at_micros, /^\d+$/);
  const again = await heldB.data({ kind: 'world-watch', world_ref: worldB, watched_world_ref: worldA });
  assert.equal(again.watch.watched_at_micros, watched.watch.watched_at_micros, 'watched again, nothing changes');
  await heldB.data({ kind: 'world-watch', world_ref: quietB, watched_world_ref: worldA });
  await heldB.data({ kind: 'world-watch', world_ref: quietB, watched_world_ref: worldC });
  const allThree = [[quietB, worldA], [quietB, worldC], [worldB, worldA]].map(String).sort();
  assert.deepEqual(watchesOf(await heldB.data({ kind: 'snapshot' })).map(String).sort(), allThree, 'B reads the watches its own worlds hold');
  assert.deepEqual(watchesOf(await heldB.data({ kind: 'worlds', aperture: 'shared' })).map(String).sort(), allThree, 'at every aperture: they are B\'s own');
  await heldB.data({ kind: 'worlds', aperture: 'federated' });
  await sleep(1500);
  for (const [one, quiet] of [[heldA2, quietA], [heldC, quietC]] as const) {
    assert.equal(one.transactions().length, quiet.from, `${one.label} is told nothing of who watches it: ${JSON.stringify(one.transactions().slice(quiet.from))}`);
    assert.equal((await one.data({ kind: 'status' })).held.cursor, quiet.cursor, `${one.label}'s cursor does not move for a watch`);
    const sweep = [await one.data({ kind: 'snapshot' }), await one.data({ kind: 'observe' }), await one.data({ kind: 'read', ref: worldB })];
    assert.deepEqual(watchesOf(sweep[0]), [], `${one.label} reads no watch but its own`);
    for (const payload of sweep) assert.ok(!JSON.stringify(payload).includes(WATCH_MARK), `${one.label} reads the world B watches from: ${JSON.stringify(payload).slice(0, 400)}`);
    const counted = JSON.stringify([Object.keys(sweep[0].counts ?? {}), sweep[0].worlds.flatMap((world: any) => Object.keys(world)), sweep[0].clearings.flatMap((row: any) => Object.keys(row))]);
    assert.ok(!/watch/i.test(counted), `nothing counts who watches whom: ${counted}`);
    assert.ok(!one.raw.slice(quiet.raw).some((line) => line.includes(WATCH_MARK)), `nothing ${one.label}'s client sent out names it`);
    // asked by its address, the world B watches from is absent: the answer carries back only the address asked
    assert.equal((await one.data({ kind: 'read', ref: quietB })).state, 'absent');
  }
  assert.deepEqual([await bAsRead(heldA2), await bAsRead(heldC)], bAsReadBefore, 'a watch shows nothing of B\'s and raises no reach');
  // The watches themselves are served to no one: each caller reads its own, through its view.
  const peek = await open(target, 'one-field-c');
  try {
    const backing = await new Promise<string>((resolve) => { peek.conn.subscriptionBuilder().onApplied(() => resolve('applied')).onError(() => resolve('refused')).subscribe(['SELECT * FROM world_watch_backing']); });
    assert.equal(backing, 'refused', 'no client reads the watches whole');
    assert.equal(peek.watches.state, 'held');
    assert.deepEqual(rows(peek.conn.db.myWorldWatch), [], 'C, holding its own watch view, reads none of B\'s');
  } finally { close(peek); }
  // Unwatch undoes it, and tells A nothing either; one not held changes nothing.
  assert.equal((await heldB.data({ kind: 'world-unwatch', world_ref: worldB, watched_world_ref: worldA })).state, 'unwatched');
  assert.equal((await heldB.data({ kind: 'world-unwatch', world_ref: worldB, watched_world_ref: worldA })).state, 'unwatched');
  assert.deepEqual(watchesOf(await heldB.data({ kind: 'snapshot' })).map(String).sort(), [[quietB, worldA], [quietB, worldC]].map(String).sort(), 'Unwatch undoes that watch alone');
  await sleep(1500);
  assert.equal(heldA2.transactions().length, quietA.from, 'A is told nothing of an unwatch either');

  /* ---------- link and show, withdraw, link off, close (SF01, SF02, SF14) ----------
   * A part A shows is read at the reach A chose: to the field by B (a world in the field), to the public by D too (no world of its own,
   * outside the field). Narrowed or withdrawn, whoever read it reads it as withdrawn there, in words — whose world, from what reach, of
   * what kind and when — never silently gone, and never which part nor what it showed: the label's mark reaches nobody after. */
  const heldD = holdAs('one-field-d'); held.push(heldD);
  await heldD.data({ kind: 'view', lease: 'acceptance:worlds', scope: 'whole' });
  const GONE_MARK = `WITHDRAWN-MARK-858-${run}`;
  const gone = { kind: 'place', label: `The study ${GONE_MARK}`, at: { lat: 22, lon: 10 } };
  const shownTo = (snapshot: any) => clearingsOf(snapshot, worldA).filter((c: any) => c.part_ref === 'place:the-study').map((c: any) => c.audience);
  assert.deepEqual(withdrawalsOf(await heldB.data({ kind: 'snapshot' }), worldA), [], 'A has withdrawn nothing B can read yet');
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'place:the-study', audience: 'field', shown: gone });
  const toField: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return shownTo(seen).length && seen; }, 'B, in the field, to read what A shows to the field');
  assert.deepEqual(clearingsOf(toField, worldA).find((c: any) => c.part_ref === 'place:the-study').shown, gone, 'B reads it as A showed it');
  assert.deepEqual(shownTo(await heldD.data({ kind: 'snapshot' })), [], 'D, outside the field, does not');
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'place:the-study', audience: 'public', shown: gone });
  await waitFor(async () => shownTo(await heldD.data({ kind: 'snapshot' }))[0] === 'public', 'D to read what A shows to the public');
  // narrowed back to the field: D reads it withdrawn from the public; B, in the field, still reads it
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'place:the-study', audience: 'field', shown: gone });
  const narrowedD: any = await waitFor(async () => { const seen = await heldD.data({ kind: 'snapshot' }); return !shownTo(seen).length && withdrawalsOf(seen, worldA).length && seen; }, 'D to read A\'s part withdrawn from the public');
  assert.deepEqual(withdrawalsOf(narrowedD, worldA).map(withdrawn), [{ world_ref: worldA, star_ref: null, reach: 'public', kind: 'place' }]);
  const fromD = heldD.raw.length;
  assert.deepEqual(await waitFor(async () => { const seen = shownTo(await heldB.data({ kind: 'snapshot' })); return seen[0] === 'field' && seen; }, 'B to read it at the field still'), ['field']);
  // withdrawn: B reads it withdrawn from the field
  await heldA2.data({ kind: 'clearing-withdraw', world_ref: worldA, part_ref: 'place:the-study' });
  const withdrawnB: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return !shownTo(seen).length && withdrawalsOf(seen, worldA).length === 2 && seen; }, 'B to read A\'s part withdrawn');
  assert.deepEqual(withdrawalsOf(withdrawnB, worldA).map(withdrawn), [{ world_ref: worldA, star_ref: null, reach: 'public', kind: 'place' }, { world_ref: worldA, star_ref: null, reach: 'field', kind: 'place' }],
    'B reads both, in the order they happened');
  const fromB = heldB.raw.length;
  await heldA2.data({ kind: 'clearing-withdraw', world_ref: worldA, part_ref: 'place:rosarium-notes' });
  await waitFor(async () => !clearingsOf(await heldB.data({ kind: 'snapshot' }), worldA).some((c: any) => c.part_ref === 'place:rosarium-notes'), 'a withdrawn clearing to go back under cloud for B');
  // Nothing either reads once it is withdrawn names what was withdrawn, nor the private mark: every payload, count, graph and line since.
  await sleep(1500);
  for (const [one, from] of [[heldB, fromB], [heldD, fromD]] as const) {
    const observed = await one.data({ kind: 'observe' });
    const sweep = [observed, await one.data({ kind: 'snapshot' }), await one.data({ kind: 'worlds', aperture: 'shared' }), await one.data({ kind: 'worlds', aperture: 'federated' }),
      await one.data({ kind: 'read', ref: worldA }), await one.data({ kind: 'status' }),
      observed.snapshot.entries.map((entry: any) => createExploreSurfaceModelFromHostedSnapshot(observed.snapshot).open(entry.ref, { depth: 2, budget: 64 }))];
    assert.ok(withdrawalsOf(sweep[1], worldA).length, `${one.label} reads A's withdrawals (non-vacuous)`);
    for (const payload of sweep) {
      const text = JSON.stringify(payload);
      assert.ok(!text.includes(GONE_MARK) && !text.includes('place:the-study') && !text.includes(MARK), `${one.label} reads what was withdrawn, or the private mark: ${text.slice(0, 400)}`);
    }
    assert.ok(!one.raw.slice(from).some((line) => line.includes(GONE_MARK) || line.includes(MARK)), `nothing ${one.label}'s client sent out since names them`);
  }
  assert.deepEqual(withdrawalsOf(await heldD.data({ kind: 'snapshot' }), worldA).map(withdrawn), [{ world_ref: worldA, star_ref: null, reach: 'public', kind: 'place' }],
    'D, outside the field, reads nothing withdrawn from the field: it never read it');
  // Link off: B and D, who read A's world while it was in the field, read that it left, and nothing A withdrew before, nor anything in it.
  await heldA2.data({ kind: 'world-put', world_ref: worldA, body: bodyA, linked: false });
  const left: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return !worldsOf(seen, worldA).length && !clearingsOf(seen, worldA).length && seen; }, 'Link off to take A\'s world out of the field');
  assert.deepEqual(withdrawalsOf(left, worldA).map(withdrawn), [{ world_ref: worldA, star_ref: null, reach: 'world' }], 'B reads that A\'s world left the field');
  // A watch is re-read for its watcher: a watched world B no longer reads is not served to B, while one it reads still is.
  assert.deepEqual(await waitFor(async () => { const seen = watchesOf(await heldB.data({ kind: 'snapshot' })); return seen.length === 1 && seen; }, 'B\'s watch of A\'s world to go with it'),
    [[quietB, worldC]], 'B reads its watch of C alone');
  const outsideD: any = await waitFor(async () => { const seen = await heldD.data({ kind: 'snapshot' }); return !worldsOf(seen, worldA).length && seen; }, 'D to read A\'s world gone');
  assert.deepEqual([clearingsOf(outsideD, worldA), withdrawalsOf(outsideD, worldA).map(withdrawn)], [[], [{ world_ref: worldA, star_ref: null, reach: 'world' }]],
    'D, outside the field, reads that A\'s world left it too: what it read is never silently gone');
  const ownAfter = await heldA2.data({ kind: 'snapshot' });
  assert.equal(worldsOf(ownAfter, worldA)[0].linked, false, 'and leave everything in it as it was, for its owner');
  assert.equal(clearingsOf(ownAfter, worldA).length, 3);
  assert.ok(withdrawalsOf(ownAfter, worldB).some((row: any) => row.star_ref === star && row.reach === 'star'), 'A reads what B took back at the star when it left (non-vacuous)');
  // C shows a part at the star A closes: closing takes it back in the field, and C's own window sets C's AIKit right (601c rulings 2 and
  // 6); A's window tells AIKit of A's parts alone (#942 M5)
  await heldC.data({ kind: 'clearing-open', world_ref: worldC, part_ref: 'page:c-at-the-rosarium', audience: 'star', star_ref: star, shown: { kind: 'page', label: 'C at the Rosarium' } });
  await waitFor(() => aikitHolds(heldC, worldC).includes(`page:c-at-the-rosarium@${star}`), 'C\'s AIKit to hold what C shows at the star');
  const ranBeforeClose = aikitRan('disclose', heldA2).length;
  const closed = await heldA2.data({ kind: 'star-close', star_ref: star });
  assert.equal(closed.state, 'closed');
  assert.deepEqual([closed.aikit.told, closed.aikit.words], [null, 'The field has acted; AIKit is told what it took back of your worlds after it, in order'], 'closing answers once the field has acted; what it takes back of A\'s worlds is told to AIKit after it (601b ruling 3, #942 follow-up 1)');
  assert.ok(closed.aikit.parts >= 1, 'closing takes back what A showed there (non-vacuous)');
  const withdrawA = ['gateway', 'disclose', '--world', worldA, '--part', 'page:for-the-circle', '--star', star, '--withdraw', '--json'].join(' ');
  const toldClose = await waitFor(() => { const told = aikitRan('disclose', heldA2).slice(ranBeforeClose); return told.length >= closed.aikit.parts && told; }, 'what closing took back of A\'s worlds to be told to AIKit');
  assert.ok(toldClose.some((one) => one.argv.join(' ') === withdrawA), 'among them what A showed at that star alone');
  assert.ok(!toldClose.some((one) => one.argv.includes(worldC)), 'and nothing of C\'s');
  await waitFor(() => !aikitHolds(heldC, worldC).includes(`page:c-at-the-rosarium@${star}`), 'C\'s AIKit to hold no more what C showed at the closed star');
  assert.ok(aikitRan('disclose', heldC).some((one) => one.argv.join(' ') === ['gateway', 'disclose', '--world', worldC, '--part', 'page:c-at-the-rosarium', '--star', star, '--withdraw', '--json'].join(' ')),
    'C\'s window took it back, though C did nothing');
  await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return !seen.stars.some((s: any) => s.star_ref === star) && !seen.gatherings.some((g: any) => g.star_ref === star); }, 'a closed star to return every world to its own orbit');
  assert.equal(clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldA).filter((c: any) => c.star_ref === star).length, 0, 'what was shown at a closed star goes with it');
  assert.deepEqual(dayOf(await heldA2.data({ kind: 'snapshot' })), [], 'and so does its day');
  assert.deepEqual(sayingsOf(await heldA2.data({ kind: 'snapshot' })), [], 'and what was said there');
  assert.deepEqual(worksOf(await heldA2.data({ kind: 'snapshot' })), [], 'and the work shown there, kept or live');
  assert.deepEqual(offersOf(await heldA2.data({ kind: 'snapshot' })), [], 'and the tasks offered there');
  assert.deepEqual((await heldA2.data({ kind: 'snapshot' })).world_withdrawals.filter((row: any) => row.star_ref === star), [], 'and what was taken back there');
  assert.deepEqual(dayOf(await heldB.data({ kind: 'snapshot' })), []);
  // Today's rows stand beside the worlds: the slice-1 page is still read.
  assert.ok((await heldB.data({ kind: 'observe' })).snapshot.entries.some((entry: any) => entry.ref === fence), 'the field\'s other rows read as they did');

  /* ---------- a world whose owner's machine is off (SF11; manual §2) ----------
   * E's window links E's world and shows a page to the public, and E's world answers while that window stands. E's machine off (its
   * window gone), D, reading the whole field, reads E's world away from then and its page as E last left it: nothing else of the world
   * moves, and nothing stands in for it. B, at Shared, E outside its circle, is sent nothing for it. A world of E's not linked, named
   * with the private mark, answers and goes away for E alone. E back, its world answers again. */
  const heldE = holdAs('one-field-e'); held.push(heldE);
  const worldE = `world:one-field:${run}:e-world`, hiddenE = `world:one-field:${run}:e-unlinked-${MARK}`;
  const answerOf = (snapshot: any, ref: string) => {
    assert.equal(snapshot.world_answer?.state, 'held', `the field keeps whether a world answers: ${JSON.stringify(snapshot.world_answer)}`);
    return worldsOf(snapshot, ref)[0]?.answer;
  };
  await heldE.data({ kind: 'world-put', world_ref: worldE, body: body(`body:one-field:${run}:e`, 2468), linked: true });
  await heldE.data({ kind: 'clearing-open', world_ref: worldE, part_ref: 'page:lighthouse-log', audience: 'public', shown: { kind: 'page', label: 'The lighthouse log' } });
  await heldE.data({ kind: 'world-put', world_ref: hiddenE, body: body(`body:one-field:${run}:e-unlinked`, 1357), linked: false });
  await waitFor(async () => { const seen = await heldE.data({ kind: 'snapshot' }); return answerOf(seen, worldE)?.answering && answerOf(seen, hiddenE)?.answering; }, 'E to read both its worlds answering while its window stands');
  const hereE: any = await waitFor(async () => { const seen = await heldD.data({ kind: 'snapshot' }); return answerOf(seen, worldE)?.answering && clearingsOf(seen, worldE).length && seen; }, 'D to read E\'s world answering, with its page');
  assert.equal((await heldB.data({ kind: 'worlds', aperture: 'shared' })).world_scope, 'circle', 'B reads its circle, E outside it');
  for (const one of [heldB, heldD]) for (let last = -1; last !== one.transactions().length;) { last = one.transactions().length; await sleep(600); }
  const quietBE = heldB.transactions().length, cursorBE = (await heldB.data({ kind: 'status' })).held.cursor, fromBE = heldB.raw.length;
  const quietDE = heldD.transactions().length, fromDE = heldD.raw.length;
  assert.equal(await heldE.end(), 0, 'E\'s window closes: its machine is off');
  held.splice(held.indexOf(heldE), 1);
  const awayD: any = await waitFor(async () => { const seen = await heldD.data({ kind: 'snapshot' }); return answerOf(seen, worldE)?.answering === false && seen; }, 'D to read E\'s world away once its window is gone');
  assert.ok(BigInt(answerOf(awayD, worldE).since_micros) >= BigInt(answerOf(hereE, worldE).since_micros), 'away since its window went, after it last answered');
  assert.deepEqual(clearingsOf(awayD, worldE), clearingsOf(hereE, worldE), 'its page reads as E last left it');
  assert.deepEqual(worldsOf(awayD, worldE).map(({ answer, ...world }: any) => world), worldsOf(hereE, worldE).map(({ answer, ...world }: any) => world), 'and nothing else of its world moved');
  await sleep(1500);
  const sinceDE = heldD.transactions().slice(quietDE);
  assert.equal(sinceDE.length, 1, `D took one transaction for E going away: ${JSON.stringify(sinceDE)}`);
  assert.deepEqual(sinceDE[0].changes.map((change: any) => [change.table, change.ref]), [['world_answer', worldE]], 'naming E\'s world away, and nothing of the world E did not link');
  assert.equal(heldB.transactions().length, quietBE, `at Shared, E outside B's circle going away sends B nothing: ${JSON.stringify(heldB.transactions().slice(quietBE))}`);
  assert.equal((await heldB.data({ kind: 'status' })).held.cursor, cursorBE, 'B\'s cursor did not move');
  assert.equal(answerOf(await heldB.data({ kind: 'worlds', aperture: 'federated' }), worldE)?.answering, false, 'at Federated B reads E\'s world away');
  for (const [one, from] of [[heldB, fromBE], [heldD, fromDE]] as const) {
    for (const payload of [await one.data({ kind: 'snapshot' }), await one.data({ kind: 'worlds', aperture: 'federated' }), await one.data({ kind: 'observe' }), await one.data({ kind: 'status' })]) {
      assert.ok(!JSON.stringify(payload).includes(MARK), `${one.label} read E's world not linked: ${JSON.stringify(payload).slice(0, 400)}`);
    }
    assert.ok(!one.raw.slice(from).some((line) => line.includes(MARK)), `nothing ${one.label}'s client sent out names it`);
  }
  const heldE2 = holdAs('one-field-e'); held.push(heldE2);
  await waitFor(async () => answerOf(await heldD.data({ kind: 'snapshot' }), worldE)?.answering === true, 'D to read E\'s world answering again once E\'s window is back');
  await waitFor(async () => answerOf(await heldE2.data({ kind: 'snapshot' }), hiddenE)?.answering === true, 'E to read its world not linked answering again, for E alone');

  /* An away world's agent (SF10 with SF11): E's world gathered at a star, E's machine off, B asks E's agent there all the same and the
   * ask waits. Nothing answers for it until E is back: an answer from no window of E's that answers for its world is refused, E's world
   * away or not, and from E's window back it answers. */
  const harbour = `star:one-field:${run}:harbour`, harbourAsk = `ask:one-field:${run}:b-harbour`;
  await heldE2.data({ kind: 'star-light', star_ref: harbour, world_ref: worldE, name: 'The harbour', gathers: 'Lights along the coast', comes: 'anyone' });
  assert.equal((await heldB.data({ kind: 'star-gather', star_ref: harbour, world_ref: worldB })).state, 'gathered');
  assert.equal(await heldE2.end(), 0, 'E\'s window closes again: its machine is off');
  held.splice(held.indexOf(heldE2), 1);
  await waitFor(async () => answerOf(await heldD.data({ kind: 'snapshot' }), worldE)?.answering === false, 'D to read E\'s world away again');
  const awayAsked = await heldB.data({ kind: 'world-agent-ask', ask_ref: harbourAsk, star_ref: harbour, world_ref: worldB, to_world_ref: worldE, by: 'name', address: 'Pharos',
    words: 'Is the light lit tonight?' });
  assert.deepEqual([awayAsked.state, awayAsked.ask.answer], ['waiting', null], 'B asks the agent of E\'s world while E is away all the same, and the ask waits');
  const answerE = { kind: 'world-agent-answer', ask_ref: harbourAsk, world_ref: worldE, agent: { name: 'Pharos' }, words: 'It is.', cites: [] };
  const whileAway = await onceAs('one-field-e', answerE);
  assert.equal(whileAway.ok, false, 'nothing answers for E\'s agent while E\'s world is away');
  assert.match(whileAway.error.message, /is away/, `refused in words: ${whileAway.error.message}`);
  const heldE3 = holdAs('one-field-e'); held.push(heldE3);
  await waitFor(async () => answerOf(await heldD.data({ kind: 'snapshot' }), worldE)?.answering === true, 'D to read E\'s world answering once E is back');
  const notTheWindow = await onceAs('one-field-e', answerE);
  assert.equal(notTheWindow.ok, false, 'E back, its agent answers from a window that answers for E\'s world, not from any call of E\'s');
  assert.match(notTheWindow.error.message, /window/, `refused in words: ${notTheWindow.error.message}`);
  assert.equal((await heldE3.data(answerE)).state, 'answered', 'from E\'s window, back, E\'s agent answers');
  await waitFor(async () => (await heldB.data({ kind: 'snapshot' })).agent_asks.find((row: any) => row.ask_ref === harbourAsk)?.answer?.words === 'It is.', 'B to read the answer once E is back');
  await heldB.data({ kind: 'world-agent-unask', ask_ref: harbourAsk });
  await heldE3.data({ kind: 'star-close', star_ref: harbour });
  assert.equal(await heldE3.end(), 0);
  held.splice(held.indexOf(heldE3), 1);

  assert.equal(await heldA2.end(), 0);
  assert.equal(await heldB.end(), 0);
  assert.equal(await heldC.end(), 0);
  assert.equal(await heldD.end(), 0);
  held.length = 0;
  assert.ok(aikitRan().length > 0 && aikitRan().every((one) => one.position === null && one.generation === null), 'every window runs AIKit standing at no Position');
  console.log(JSON.stringify({ acceptance: 'one-field-slices-1-2', target: { uri, database }, field_ref: fieldRef, passed: [
    'one held client per identity answers every request by id',
    'a private mark in an unshown page reaches no payload, count, graph or event of another identity',
    'the other identity\'s cursor moves for the public fence only',
    'presence stands on the held connection and goes with it',
    'a request brings into view only what it reads: no field for who it is or the worlds, one field for a request about it',
    'out of view sends nothing; the cursor moves once when a field, or the whole field, is back in view',
    'a world carries its owner and its body record; another identity reads the same body and cannot put it',
    'what a world has not shown reaches no payload, count or transaction of another identity, and moves no cursor',
    'a star is lit by its owner with its world gathered first; an asking world waits at its edge until let in',
    'the star keeps its day of who came, was let in, showed something and left, read by its lighter and the worlds gathered there, never what was shown',
    'what was said at a star stands under its sayer\'s name on what it was said to, threads under what it answers, goes under cloud with what it was said to, and is unsaid by its sayer alone',
    'a piece of work shown at a star is watched by the worlds gathered there exactly as Factory showed it (no prompt, file or machine rides along), moves forward only, stands as it was kept, and watching changes nothing (SF12)',
    'a task offered at a star carries its grant; one gathered world takes it, brings back under its own name only what the grant let it touch, before it lapses and unless it was revoked; what came back reaches the offerer and taker alone and stands apart until accepted (SF13)',
    'leaving takes back what was shown at a star; withdrawing and Link off go back under cloud; closing returns every world',
    'a work shown at a star answers on the connection that showed it: with that window gone it reads as it was last shown, and shown again it answers again (manual §17.2)',
    'at World, Local and Shared a client reads its circle alone and what moves outside it sends nothing; Federated reads the whole field (Aperture)',
    'a private mark shown and offered at a star the others are not let in to reaches none of their payloads, counts, graphs or lines, beside the work and tasks they do read',
    'a world linked into the field shows a part of it at the reach chosen: a world in the field reads what is shown to the field, one outside it what is public alone (SF01, SF02)',
    'what is withdrawn or narrowed reads as withdrawn to whoever read it, naming whose world, what kind, from what reach and when, never which part nor what it showed; a world taken out reads as having left the field to those in it (SF14)',
    'at Shared what is withdrawn outside the circle sends nothing; closing a star takes what was taken back there with it (SF14)',
    'a contribution to what another world shows stands on it under its contributor\'s name, as what it is, and waits for that world\'s owner, read by the two alone; accepted, it is read by whoever reads what it stands on, a contribution under it threads under it, a refusal reaches its contributor alone in the owner\'s words, and its contributor takes it back; nothing waiting, refused or standing at a star reaches another identity\'s payload, line or cursor, nor a field put under the world\'s name (SF07)',
    'at Shared a contribution accepted outside the circle sends nothing and moves no cursor, while the caller\'s own is read there; Federated reads it (Aperture; DLW build ruling 2026-11-06)',
    'the one who holds a star renames it and hands it on to a world gathered there: being handed on is read by the two worlds alone, kept until it is taken on, and taken on the star is the other\'s, to rename and close, and no longer the first\'s (SF03)',
    'asks are the holder\'s: after a hand-on the one who holds the star reads the asks at its edge with the world that asked, and the world that lit it and handed it on reads the rest of its day and no asks (SF06; DLW build ruling 2026-11-06)',
    'two things with one name in two worlds stay two until someone claims they are one: the claim is a contribution of the kind same, waiting, accepted, disputed under it and taken back as any other, and it names the part its claimant sets beside the other only to whoever may read that part; a part not shown stands beside nothing and is named to no one (SF09)',
    'a world\'s agent answers at a star for its world, asked by its name, its role or the exact instance running: the ask and its answer are the two worlds\' alone, it answers from what its world shows there and nothing else, only as the agent addressed, and points to no work its world did not offer there (SF10); an ask its answer cannot reach is settled by a window of the world asked alone, in words, and the world that asked reads it closed (601c ruling 1)',
    'each window tells AIKit what its world shows once the field takes each Show and Withdraw, and what leaving and closing take back of its worlds there; it relays each ask of its world\'s agent once, reads its replies until it is answered or taken back, and runs AIKit standing at no Position (601b); each window sets what its own AIKit holds of its worlds right against the field as it goes live and as what they show changes: told what was shown before it started or elsewhere, and taking back what a star\'s holder closed or turned away (601c rulings 2 and 6)',
    'a world answers while a window of its owner\'s stands; with its owner\'s machine off it reads away since then, its clearings as its owner last left them and nothing else of it moved, outside the circle it sends nothing, and a world not linked answers to its owner alone (SF11)',
    'an away world\'s agent is asked all the same and the ask waits: nothing answers for it until its owner is back, and an answer from no window that answers for its world is refused (SF10, SF11)',
    'a watch is its watcher\'s alone: the world watched and every other identity are told nothing of it (no payload, transaction, cursor, line or count), it shows nothing of the watcher\'s and raises no reach, Unwatch undoes it, and a watched world the watcher no longer reads is not served to it (DLW build ruling 2026-11-06)',
  ] }));
} finally {
  for (const one of held) { try { one.child.stdin!.end(); } catch {} }
  close(a);
}
