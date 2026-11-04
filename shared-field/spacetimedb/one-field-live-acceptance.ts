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
 * the client does and goes with it. What is out of view sends nothing, and
 * the cursor moves once when the whole field comes back into view.
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
 * Runs only against a SpacetimeDB on this machine's loopback, never a hosted
 * or retained field:
 *   SPACETIMEDB_URI=ws://127.0.0.1:<port> SPACETIMEDB_DATABASE=<local db> \
 *   OI_STATE_HOME=<scratch> npx tsx one-field-live-acceptance.ts
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createParticipant } from '../index.mjs';
import { createSharedField } from '../social.mjs';
import { createExploreEntry } from '../explore.mjs';
import { createWorldPresentation } from '../presentation.mjs';
import { createWorldPresentationProjection } from '../presentation-projection.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';
import { createExploreSurfaceModelFromHostedSnapshot } from '../spacetimedb-explore-surface.mjs';
import { close, open, sleep } from './field-lib';

const uri = process.env.SPACETIMEDB_URI ?? '';
const database = process.env.SPACETIMEDB_DATABASE ?? '';
const loopback = (() => { try { return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(new URL(uri).hostname); } catch { return false; } })();
if (!loopback || !database) throw new Error('A SpacetimeDB on this machine\'s loopback is required (SPACETIMEDB_URI=ws://127.0.0.1:<port>, SPACETIMEDB_DATABASE); never a hosted field');
if (!process.env.OI_STATE_HOME) throw new Error('OI_STATE_HOME must name a scratch state home: the identities this acceptance makes are kept there');
const target = { name: 'env', server: 'env', uri, database };

const here = dirname(fileURLToPath(import.meta.url));
const run = crypto.randomUUID().slice(0, 8);
const MARK = `PRIVATE-MARK-858-${run}`;
const GLANCE_MS = 1500;

/* ---------- a held client, as the native host speaks to it ---------- */
type Line = Record<string, any>;
function holdAs(label: string) {
  const child: ChildProcess = spawn(join(here, 'field.sh'), ['--held'], {
    env: { ...process.env, OI_SHARED_FIELD_TOKEN_LABEL: label, OI_SHARED_FIELD_GLANCE_MS: String(GLANCE_MS) },
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
    label, child, events, raw, exited,
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
  const narrowedCursor = tick(narrowed.cursor);
  const unseen = `${worldRef}/page:unseen`;
  await page(unseen, 'A page out of view', shownProjection);
  await sleep(1500);
  assert.ok(!names(heldB, unseen), 'a change out of view sends nothing');
  const widened = await heldB.data({ kind: 'observe' });
  assert.ok(widened.snapshot.entries.some((entry: any) => entry.ref === unseen), 'the whole field is read again when it comes back into view');
  assert.equal(tick(widened.cursor).count, narrowedCursor.count + 1, 'and the cursor moves once for what moved unseen');
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
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'place:rosarium-notes', audience: 'field', shown });
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'page:reading-of-plate-4', audience: 'public', shown: { kind: 'page', label: 'A reading of the fourth plate' } });
  const clearingsOf = (snapshot: any, ref: string) => snapshot.clearings.filter((clearing: any) => clearing.world_ref === ref);
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
  await waitFor(async () => (await heldA2.data({ kind: 'snapshot' })).gatherings.some((g: any) => g.star_ref === star && g.world_ref === worldB && g.state === 'asked'), 'A to see B\'s request');
  assert.ok(!JSON.stringify(await heldB.data({ kind: 'snapshot' })).includes(STAR_MARK), 'waiting at the edge shows B nothing shown at the star');
  const refusedAdmit = await heldB.ask({ kind: 'star-admit', star_ref: star, world_ref: worldB });
  assert.equal(refusedAdmit.ok, false, 'only the star\'s lighter lets a world in');
  await heldA2.data({ kind: 'star-admit', star_ref: star, world_ref: worldB });
  const inside: any = await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return JSON.stringify(seen).includes(STAR_MARK) && seen; }, 'B, let in, to see what A shows at the star');
  assert.ok(!JSON.stringify(inside).includes(MARK), 'letting B in gives it no reach into A\'s world beyond what A shows at the star');
  assert.equal(clearingsOf(inside, hidden).length, 0);
  assert.equal(worldsOf(inside, hidden).length, 0);
  await heldB.data({ kind: 'clearing-open', world_ref: worldB, part_ref: 'page:my-reading', audience: 'star', star_ref: star, shown: { kind: 'page', label: 'My reading of the fourth plate' } });
  await waitFor(async () => clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldB).some((c: any) => c.part_ref === 'page:my-reading'), 'A to see what B shows at the star');
  await heldB.data({ kind: 'star-leave', star_ref: star, world_ref: worldB });
  await waitFor(async () => !clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldB).length, 'leaving to take back what B showed at the star');
  assert.ok(!JSON.stringify(await heldB.data({ kind: 'snapshot' })).includes(STAR_MARK), 'and B no longer sees what A shows there');

  /* ---------- withdraw, link off, close ---------- */
  await heldA2.data({ kind: 'clearing-withdraw', world_ref: worldA, part_ref: 'place:rosarium-notes' });
  await waitFor(async () => !clearingsOf(await heldB.data({ kind: 'snapshot' }), worldA).some((c: any) => c.part_ref === 'place:rosarium-notes'), 'a withdrawn clearing to go back under cloud for B');
  await heldA2.data({ kind: 'world-put', world_ref: worldA, body: bodyA, linked: false });
  await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return !worldsOf(seen, worldA).length && !clearingsOf(seen, worldA).length; }, 'Link off to take A\'s world out of the field');
  const ownAfter = await heldA2.data({ kind: 'snapshot' });
  assert.equal(worldsOf(ownAfter, worldA)[0].linked, false, 'and leave everything in it as it was, for its owner');
  assert.equal(clearingsOf(ownAfter, worldA).length, 3);
  const closed = await heldA2.data({ kind: 'star-close', star_ref: star });
  assert.equal(closed.state, 'closed');
  await waitFor(async () => { const seen = await heldB.data({ kind: 'snapshot' }); return !seen.stars.some((s: any) => s.star_ref === star) && !seen.gatherings.some((g: any) => g.star_ref === star); }, 'a closed star to return every world to its own orbit');
  assert.equal(clearingsOf(await heldA2.data({ kind: 'snapshot' }), worldA).filter((c: any) => c.star_ref === star).length, 0, 'what was shown at a closed star goes with it');
  // Today's rows stand beside the worlds: the slice-1 page is still read.
  assert.ok((await heldB.data({ kind: 'observe' })).snapshot.entries.some((entry: any) => entry.ref === fence), 'the field\'s other rows read as they did');

  assert.equal(await heldA2.end(), 0);
  assert.equal(await heldB.end(), 0);
  held.length = 0;
  console.log(JSON.stringify({ acceptance: 'one-field-slices-1-2', target: { uri, database }, field_ref: fieldRef, passed: [
    'one held client per identity answers every request by id',
    'a private mark in an unshown page reaches no payload, count, graph or event of another identity',
    'the other identity\'s cursor moves for the public fence only',
    'presence stands on the held connection and goes with it',
    'out of view sends nothing; the cursor moves once when the whole field is back in view',
    'a world carries its owner and its body record; another identity reads the same body and cannot put it',
    'what a world has not shown reaches no payload, count or transaction of another identity, and moves no cursor',
    'a star is lit by its owner with its world gathered first; an asking world waits at its edge until let in',
    'leaving takes back what was shown at a star; withdrawing and Link off go back under cloud; closing returns every world',
  ] }));
} finally {
  for (const one of held) { try { one.child.stdin!.end(); } catch {} }
  close(a);
}
