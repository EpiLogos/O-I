#!/usr/bin/env node
/**
 * The owner-side activity producer: holds a published activity entry live
 * for exactly as long as it is actually reading its Factory run.
 *
 *   node shared-field/scripts/activity-producer.mjs \
 *     --field <field-ref> --activity-ref <hosted activity entry ref> \
 *     --run <run:...> --state <development-state.json | project root> \
 *     [--interval 10s] [--participant <producer participant ref>] [--token-label owner]
 *
 * Every interval it reads the run through its owner —
 * `factory development run <state> <run> --json` (factory.run-reading/v1) —
 * and upserts `put_activity_liveness` with the run's lifecycle and revision
 * over ONE persistent SpaceTimeDB connection (the hosting target comes from
 * OI_SHARED_FIELD_TARGET / the machine binding, the token from OI_STATE_HOME
 * under `--token-label`, default `owner`). The server stamps the heartbeat.
 *
 * SIGINT / SIGTERM: clear the liveness row, then exit 0. A hard kill or a
 * dropped connection: the module's client-disconnect lifecycle clears the
 * row bound to this connection. A dropped connection also exits (code 3) so
 * a supervisor can restart; the producer never pretends to be live offline.
 * A failed Factory read skips that beat, so the reading goes stale honestly.
 *
 * Read-only on Factory. It invokes no Factory Action, tool or continuation.
 * stdout carries one JSON line per event; no token is ever printed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const moduleDir = join(here, '..', 'spacetimedb');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`unexpected argument ${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${key} needs a value`);
    out[key.slice(2)] = value;
    index += 1;
  }
  return out;
}

function parseInterval(text) {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(String(text).trim());
  if (!match) throw new Error(`--interval must look like 10s, 500ms or 1m: ${text}`);
  const value = Number(match[1]) * ({ ms: 1, s: 1000, m: 60_000 }[match[2] ?? 's']);
  if (value < 200) throw new Error('--interval must be at least 200ms');
  return value;
}

const emit = (event) => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
// The SDK's own chatter goes to stderr so stdout stays one JSON line per event.
for (const level of ['log', 'info', 'warn', 'debug']) console[level] = (...parts) => process.stderr.write(`${parts.map(String).join(' ')}\n`);

const args = parseArgs(process.argv.slice(2));
for (const required of ['field', 'activity-ref', 'run', 'state']) if (!args[required]) throw new Error(`--${required} is required`);
const intervalMs = parseInterval(args.interval ?? '10s');
const factoryBin = process.env.OI_FACTORY_BIN ?? 'factory';

function statePath(input) {
  if (existsSync(input) && statSync(input).isFile()) return input;
  const location = JSON.parse(execFileSync(factoryBin, ['project', 'locate', input, '--json'], { encoding: 'utf8', timeout: 30_000 }));
  if (typeof location.statePath !== 'string') throw new Error(`factory project locate disclosed no state for ${input}`);
  return location.statePath;
}
const state = statePath(args.state);

function readRun() {
  const reading = JSON.parse(execFileSync(factoryBin, ['development', 'run', state, args.run, '--json'], { encoding: 'utf8', timeout: 30_000 }));
  if (reading.contract !== 'factory.run-reading/v1') throw new Error(`unsupported factory run contract ${reading.contract}`);
  if (reading.runRef !== args.run) throw new Error(`factory answered for ${reading.runRef}, not ${args.run}`);
  if (!Number.isSafeInteger(reading.revision) || reading.revision < 1) throw new Error('factory run reading has no integer revision');
  const lifecycle = typeof reading.lifecycle === 'string' ? reading.lifecycle.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') : 'unavailable';
  return { owner_state: lifecycle, owner_revision: reading.revision, factory_state_revision: reading.provenance?.factoryStateRevision ?? null };
}

// field-lib is TypeScript over the generated bindings: load it through tsx's
// in-process loader so this producer is ONE process (a hard kill is a real disconnect).
const requireFromModule = createRequire(join(moduleDir, 'package.json'));
const { tsImport } = await import(pathToFileURL(requireFromModule.resolve('tsx/esm/api')).href);
const lib = await tsImport(pathToFileURL(join(moduleDir, 'field-lib.ts')).href, import.meta.url);
const binding = lib.resolveTarget();
if (!binding.bound) { emit({ event: 'unbound', reason: binding.reason }); process.exit(2); }
const client = await lib.open(binding.target, args['token-label'] ?? 'owner');
const reducers = client.conn.reducers;
const db = client.conn.db;
emit({ event: 'connected', target: binding.target.name, database: binding.target.database, transport_identity: client.identityHex, field_ref: args.field, activity_ref: args['activity-ref'], run_ref: args.run, interval_ms: intervalMs, pid: process.pid });

let stopping = false;
let timer;
client.lifecycle.subscribe((event) => {
  if (stopping || event.transport.state !== 'offline') return;
  emit({ event: 'disconnected', error: event.transport.error ?? null });
  process.exit(3);
});

async function beat() {
  let owner;
  try { owner = readRun(); } catch (error) { emit({ event: 'factory-unreadable', message: String(error?.message ?? error) }); return; }
  try {
    await reducers.putActivityLiveness({ fieldRef: args.field, activityRef: args['activity-ref'], producerParticipantRef: args.participant ?? '', ownerState: owner.owner_state, ownerRevision: BigInt(owner.owner_revision) });
    emit({ event: 'beat', ...owner });
  } catch (error) {
    emit({ event: 'refused', message: String(error?.message ?? error), ...owner });
  }
}

async function stop(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  try {
    await reducers.clearActivityLiveness({ fieldRef: args.field, activityRef: args['activity-ref'] });
    await lib.waitUntil(() => !lib.rows(db.activityLiveness).some((row) => row.fieldRef === args.field && row.activityRef === args['activity-ref']), 'the liveness row to clear', 5_000);
    emit({ event: 'cleared', signal });
  } catch (error) {
    emit({ event: 'clear-failed', signal, message: String(error?.message ?? error) });
  }
  lib.close(client);
  process.exit(0);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

async function loop() {
  await beat();
  if (!stopping) timer = setTimeout(loop, intervalMs);
}
await loop();
