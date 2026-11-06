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
 * Aperture: at World, Local and Shared a client reads the clearings and
 * gatherings of its circle alone, so what moves outside it sends nothing;
 * Federated reads the whole field.
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
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'place:rosarium-notes', audience: 'field', shown });
  await heldA2.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'page:reading-of-plate-4', audience: 'public', shown: { kind: 'page', label: 'A reading of the fourth plate' } });
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
  await heldB.data({ kind: 'star-leave', star_ref: star, world_ref: worldB });
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
  const outsideD: any = await waitFor(async () => { const seen = await heldD.data({ kind: 'snapshot' }); return !worldsOf(seen, worldA).length && seen; }, 'D to read A\'s world gone');
  assert.deepEqual([clearingsOf(outsideD, worldA), withdrawalsOf(outsideD, worldA).map(withdrawn)], [[], [{ world_ref: worldA, star_ref: null, reach: 'world' }]],
    'D, outside the field, reads that A\'s world left it too: what it read is never silently gone');
  const ownAfter = await heldA2.data({ kind: 'snapshot' });
  assert.equal(worldsOf(ownAfter, worldA)[0].linked, false, 'and leave everything in it as it was, for its owner');
  assert.equal(clearingsOf(ownAfter, worldA).length, 3);
  assert.ok(withdrawalsOf(ownAfter, worldB).some((row: any) => row.star_ref === star && row.reach === 'star'), 'A reads what B took back at the star when it left (non-vacuous)');
  const closed = await heldA2.data({ kind: 'star-close', star_ref: star });
  assert.equal(closed.state, 'closed');
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

  assert.equal(await heldA2.end(), 0);
  assert.equal(await heldB.end(), 0);
  assert.equal(await heldC.end(), 0);
  assert.equal(await heldD.end(), 0);
  held.length = 0;
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
  ] }));
} finally {
  for (const one of held) { try { one.child.stdin!.end(); } catch {} }
  close(a);
}
