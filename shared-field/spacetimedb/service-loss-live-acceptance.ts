/**
 * Service loss (O-I #858, TX14): losing the service leaves the world whole, and
 * the field catches up when it returns.
 *
 * Two identities each hold one client (`field.sh --held`, the native host's
 * own) on one running SharedField; B reaches it through a loopback relay this
 * script holds, so the service can be lost to B alone and found again at the
 * same address. While it is lost, B's client says so (`degraded`, in the
 * transport's words) and answers every request `unavailable` at once: nothing
 * B asks then is queued and done later. Meanwhile A changes the field. When
 * the service returns, B's client connects again by itself, as the same
 * identity, at a new cursor (a new connection's epoch, so the window reads
 * the field again); B's world and what it showed stand as they were, and B
 * reads what A did while B was away.
 *
 * Runs only against a SpacetimeDB on this machine's loopback, never a hosted
 * or retained field:
 *   SPACETIMEDB_URI=ws://127.0.0.1:<port> SPACETIMEDB_DATABASE=<local db> \
 *   OI_STATE_HOME=<scratch> npx tsx service-loss-live-acceptance.ts
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer, connect as connectTcp, type Server, type Socket } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from './field-lib';

const uri = process.env.SPACETIMEDB_URI ?? '';
const database = process.env.SPACETIMEDB_DATABASE ?? '';
const service = (() => { try { return new URL(uri); } catch { return null; } })();
const loopback = !!service && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(service.hostname);
if (!loopback || !database) throw new Error('A SpacetimeDB on this machine\'s loopback is required (SPACETIMEDB_URI=ws://127.0.0.1:<port>, SPACETIMEDB_DATABASE); never a hosted field');
if (!process.env.OI_STATE_HOME) throw new Error('OI_STATE_HOME must name a scratch state home: the identities this acceptance makes are kept there');
// each window runs AIKit after each Show (601b): here a stand-in that takes it, never this machine's AIKit; asked what a world shows
// (601c, `disclose --list --world W`), it holds nothing
mkdirSync(join(process.env.OI_STATE_HOME, 'service-loss-aikit'), { recursive: true });
writeFileSync(join(process.env.OI_STATE_HOME, 'service-loss-aikit', 'aikit'), [
  '#!/bin/sh',
  'case " $* " in *" --list "*) w=; while [ $# -gt 0 ]; do [ "$1" = --world ] && w=$2; shift; done',
  `  printf '{"schema":1,"ok":true,"data":{"disclosure":{"world_ref":"%s","parts":[]}}}\\n' "$w" ;;`,
  `*) echo '{"schema":1,"ok":true,"data":{}}' ;; esac`, ''].join('\n'), { mode: 0o755 });
process.env.OI_AIKIT_PROGRAM = join(process.env.OI_STATE_HOME, 'service-loss-aikit', 'aikit');
const servicePort = Number(service!.port || (service!.protocol === 'wss:' ? 443 : 80));

const here = dirname(fileURLToPath(import.meta.url));
const run = crypto.randomUUID().slice(0, 8);

/* ---------- a loopback relay to the service, which this script can cut and mend ---------- */
function relay() {
  const sockets = new Set<Socket>();
  let server: Server | undefined;
  let port = 0;
  const pair = (near: Socket) => {
    const far = connectTcp(servicePort, service!.hostname.replace(/^\[|\]$/g, ''));
    sockets.add(near); sockets.add(far);
    const end = () => { near.destroy(); far.destroy(); sockets.delete(near); sockets.delete(far); };
    for (const socket of [near, far]) { socket.on('error', end); socket.on('close', end); }
    near.pipe(far); far.pipe(near);
  };
  return {
    get port() { return port; },
    up: () => new Promise<void>((resolve, reject) => {
      server = createServer(pair);
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { port = (server!.address() as any).port; resolve(); });
    }),
    /** The service lost: every connection through the relay cut, and nothing answers at its address. */
    down: () => new Promise<void>((resolve) => {
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      if (!server) return resolve();
      server.close(() => resolve());
      server = undefined;
    }),
  };
}

/* ---------- a held client, as the native host speaks to it ---------- */
type Line = Record<string, any>;
function holdAs(label: string, through?: number) {
  const env = { ...process.env, OI_SHARED_FIELD_TOKEN_LABEL: label, ...(through ? { SPACETIMEDB_URI: `ws://127.0.0.1:${through}` } : {}) };
  const child: ChildProcess = spawn(join(here, 'field.sh'), ['--held'], { env, stdio: ['pipe', 'pipe', 'inherit'] });
  const pending = new Map<number, (line: Line) => void>();
  const events: Line[] = [];
  let next = 1;
  let buffer = '';
  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => {
    buffer += chunk;
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const text = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (!text.trim()) continue;
      const line = JSON.parse(text);
      if (typeof line.id === 'number') pending.get(line.id)?.(line);
      else events.push(line);
    }
  });
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  return {
    label, child, events, exited,
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
    statuses: () => events.filter((line) => line.event === 'status'),
    async end() { child.stdin!.end(); return exited; },
  };
}
type Held = ReturnType<typeof holdAs>;
const tick = (cursor: string) => { const [, epoch, count] = /^tx:(\d+):(\d+)$/.exec(cursor) ?? []; assert.ok(epoch, `a cursor names a transaction: ${cursor}`); return { epoch: Number(epoch), count: Number(count) }; };
async function waitFor<T>(read: () => T | false | undefined | null | Promise<T | false | undefined | null>, what: string, ms = 30_000): Promise<T> {
  const began = Date.now();
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() - began > ms) throw new Error(`Timed out waiting for ${what}`);
    await sleep(100);
  }
}
const stateOf = async (one: Held) => (await one.data({ kind: 'status' })).held;

const way = relay();
await way.up();
const held: Held[] = [];
try {
  const heldA = holdAs('service-loss-a'); held.push(heldA);
  const heldB = holdAs('service-loss-b', way.port); held.push(heldB);
  await waitFor(async () => (await stateOf(heldA)).state === 'live' && (await stateOf(heldB)).state === 'live', 'both clients to hold the field');

  /* ---------- before: each world stands in the field, and B has shown a part of its own ---------- */
  const body = (ref: string, seed: number) => ({ body_ref: ref, seed, generator: { id: 'fbm-sphere', version: 2 },
    landmass: { sea_level: 0.5, continents: 1.7, relief: 0.55, coast: 'smooth' }, climate: { warmth: 0.58, moisture: 0.6, ice_caps: 0.3 },
    sky: { atmosphere: 0.6, clouds: 0.35, axial_tilt_deg: 18 } });
  const worldA = `world:service-loss:${run}:a`, worldB = `world:service-loss:${run}:b`;
  const bodyB = body(`body:service-loss:${run}:b`, 4242);
  await heldA.data({ kind: 'world-put', world_ref: worldA, body: body(`body:service-loss:${run}:a`, 1717), linked: true });
  await heldB.data({ kind: 'world-put', world_ref: worldB, body: bodyB, linked: true });
  const shownB = { kind: 'page', label: 'A page B showed before the loss' };
  await heldB.data({ kind: 'clearing-open', world_ref: worldB, part_ref: 'page:before', audience: 'public', shown: shownB });
  const worlds = (one: Held) => one.data({ kind: 'worlds' });
  const has = (reading: any, ref: string) => reading.worlds.some((world: any) => world.world_ref === ref);
  await waitFor(async () => has(await worlds(heldB), worldA), 'B to see A\'s world');
  const before = await stateOf(heldB);
  const identityB = (await heldB.data({ kind: 'identity' })).transport_identity;

  /* ---------- the service is lost to B ---------- */
  const statusesBefore = heldB.statuses().length;
  await way.down();
  const lost = await waitFor(() => heldB.statuses().slice(statusesBefore).find((line) => line.state === 'degraded'), 'B\'s client to say the service is lost');
  assert.ok(typeof lost.detail === 'string' && lost.detail.length > 0, 'the loss is said in words');
  const asked = await heldB.ask({ kind: 'worlds' });
  assert.equal(asked.ok, false, 'a reading while the service is lost is not answered from nowhere');
  assert.equal(asked.error.kind, 'unavailable');
  assert.match(asked.error.message, /not reachable now/);
  const away = await heldB.ask({ kind: 'clearing-open', world_ref: worldB, part_ref: 'page:while-away', audience: 'public', shown: { kind: 'page', label: 'Asked while away' } });
  assert.equal(away.ok, false, 'an act asked while the service is lost is refused at once, not queued');
  assert.equal(away.error.kind, 'unavailable');

  /* ---------- A changes the field while B is away ---------- */
  const star = `star:service-loss:${run}:lantern`;
  await heldA.data({ kind: 'clearing-open', world_ref: worldA, part_ref: 'page:while-b-away', audience: 'public', shown: { kind: 'page', label: 'Shown while B was away' } });
  await heldA.data({ kind: 'star-light', star_ref: star, world_ref: worldA, name: 'The lantern', gathers: 'What was found while one of us was away', comes: 'asked' });

  /* ---------- the service returns: B connects again by itself and catches up ---------- */
  await way.up();
  const back = await waitFor(() => heldB.statuses().slice(statusesBefore).find((line, at, all) => line.state === 'live' && all.slice(0, at).some((earlier) => earlier.state === 'degraded')), 'B\'s client to hold the field again', 40_000);
  assert.ok(tick(back.cursor).epoch > tick(before.cursor).epoch, 'the field found again is a new connection, at a new cursor: the window reads it again');
  assert.equal((await heldB.data({ kind: 'identity' })).transport_identity, identityB, 'B stands as the same identity: nothing was made anew');
  const caught: any = await waitFor(async () => {
    const reading = await worlds(heldB);
    return reading.stars.some((one: any) => one.star_ref === star) && reading.clearings.some((one: any) => one.world_ref === worldA && one.part_ref === 'page:while-b-away') && reading;
  }, 'B to read what A did while B was away');
  const mine = caught.worlds.filter((world: any) => world.world_ref === worldB);
  assert.equal(mine.length, 1, 'B\'s world stands in the field');
  assert.equal(mine[0].mine, true);
  assert.deepEqual(mine[0].body, bodyB, 'whole: its body record as it was put');
  assert.deepEqual(caught.clearings.filter((one: any) => one.world_ref === worldB).map((one: any) => [one.part_ref, one.audience, one.shown]), [['page:before', 'public', shownB]],
    'what B showed before the loss stands, and what it asked while away was never done');
  const seenByA: any = await waitFor(async () => { const reading = await worlds(heldA); return has(reading, worldB) && reading; }, 'A to read B\'s world');
  assert.ok(!seenByA.clearings.some((one: any) => one.part_ref === 'page:while-away'), 'nothing B asked while away reached the field later');

  for (const one of held) assert.equal(await one.end(), 0, `${one.label}'s client ends when its host lets go`);
  held.length = 0;
  console.log(JSON.stringify({ acceptance: 'service-loss-tx14', target: { uri, database }, passed: [
    'a lost service is said in words, and every request is answered unavailable at once, nothing queued',
    'the field changes while one identity is away',
    'the client connects again by itself as the same identity, at a new cursor, so the window reads the field again',
    'the world and what it showed stand whole, and what changed while it was away is read',
  ] }));
} finally {
  for (const one of held) { try { one.child.stdin!.end(); } catch {} }
  await way.down();
}
