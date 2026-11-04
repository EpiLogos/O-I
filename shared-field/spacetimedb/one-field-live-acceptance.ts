/**
 * One field, slice 1 (O-I #858): one held client per identity, and no leaks.
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

  assert.equal(await heldB.end(), 0);
  held.length = 0;
  console.log(JSON.stringify({ acceptance: 'one-field-slice-1', target: { uri, database }, field_ref: fieldRef, passed: [
    'one held client per identity answers every request by id',
    'a private mark in an unshown page reaches no payload, count, graph or event of another identity',
    'the other identity\'s cursor moves for the public fence only',
    'presence stands on the held connection and goes with it',
    'out of view sends nothing; the cursor moves once when the whole field is back in view',
  ] }));
} finally {
  for (const one of held) { try { one.child.stdin!.end(); } catch {} }
  close(a);
}
