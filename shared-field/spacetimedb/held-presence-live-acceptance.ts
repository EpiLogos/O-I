/** Real SDK/module/process acceptance for connection-scoped presence.
 * Controlled transport identities; no human experience or visual claim.
 * Run only against an explicitly supplied disposable acceptance database. */
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createParticipant, createProjection} from '../index.mjs';
import {createExploreEntry} from '../explore.mjs';
import {projectionStorageKey} from '../spacetimedb.mjs';
import {createSharedField} from '../social.mjs';
import {close, fieldSnapshot, open, rows, sleep, waitUntil, type Client, type Target} from './field-lib';

const uri = process.env.SPACETIMEDB_URI;
const database = process.env.SPACETIMEDB_DATABASE;
assert.ok(uri && database, 'Supply the actual disposable acceptance server and database');
const target: Target = {name: 'presence-acceptance', server: 'acceptance', uri, database};
const sqlServer = process.env.SPACETIMEDB_ACCEPTANCE_SQL_SERVER;
assert.ok(sqlServer, 'Supply the module publisher native SQL server for this disposable acceptance database');
assert.match(execFileSync('spacetime', ['--version'], {encoding: 'utf8', timeout: 4000, maxBuffer: 16_384}), /\b2\.8\.1\b/);
const here = fileURLToPath(new URL('.', import.meta.url));
const source = fileURLToPath(import.meta.url);
const sourceRevision = `sha256:${createHash('sha256').update(readFileSync(source)).digest('hex')}`;
const stateHome = mkdtempSync(join(tmpdir(), 'oi-presence-live-'));
const previousStateHome = process.env.OI_STATE_HOME;
process.env.OI_STATE_HOME = stateHome;
const run = randomUUID();
const fieldRef = `oi:field:presence:${run}`;
const neighbourRef = `${fieldRef}:private-neighbour`;
const persistentRef = `participant:presence:${run}:persistent`;
const finiteRef = `participant:presence:${run}:finite`;
const privateRef = `thing:presence:${run}:private-note`;
const privateBody = `PRIVATE_PRESENCE_MATERIAL_${run}`;
const clients: Client[] = [];
const processes = new Set<ProductionCall>();
const proof: string[] = [];
let cancelled = false;
const checkpoint = () => {if (cancelled) throw new Error('Acceptance deadline elapsed; native effects may have completed. Inspect before retrying.');};
const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
// Read-only provider inspection uses the actual ephemeral module publisher.
// It does not add a public View or grant any participant backing-table access.
function sqlColumn(query: string): string[] {
  checkpoint();
  const reply = JSON.parse(execFileSync('spacetime', ['sql', database, query, '--server', sqlServer, '--format', 'json', '--confirmed', 'true', '--no-config', '--yes'],
    {encoding: 'utf8', timeout: 4000, maxBuffer: 65_536}));
  assert.equal(reply.length, 1);
  assert.equal(reply[0].schema.elements.length, 1);
  return reply[0].rows.map((row: unknown) => {assert.ok(Array.isArray(row) && row.length === 1 && typeof row[0] === 'string'); return row[0];});
}
function claims(participantRef: string): string[] {
  const keys = sqlColumn(`SELECT "presenceKey" FROM field_presence_backing WHERE "fieldRef" = ${sqlLiteral(fieldRef)} AND "participantRef" = ${sqlLiteral(participantRef)}`);
  assert.ok(keys.length <= 1, 'One authoritative native participant occupancy');
  return keys.length ? sqlColumn(`SELECT "connectionRef" FROM field_presence_connection_backing WHERE "presenceKey" = ${sqlLiteral(keys[0])}`).sort() : [];
}
function noPrivateMaterial(client: Client) {
  const snapshot = JSON.stringify(fieldSnapshot(client));
  for (const sentinel of [neighbourRef, privateRef, privateBody]) assert.equal(snapshot.includes(sentinel), false, `Private material ${sentinel} stayed outside this authorized snapshot`);
}
async function openOwned(label: string): Promise<Client> {
  checkpoint();
  const client = await open(target, label);
  if (cancelled) {close(client); checkpoint();}
  clients.push(client);
  return client;
}

type Envelope = {ok: boolean; data?: any; error?: {kind: string; completion_observation?: {completed_reducers: number}}};
type ProductionCall = {
  child: ChildProcessWithoutNullStreams;
  first: Promise<Envelope>;
  ended: Promise<{code: number | null; signal: NodeJS.Signals | null}>;
  frames: () => Envelope[];
  unresolved: () => Record<string, unknown> | undefined;
  stop: () => Promise<void>;
};

function launch(request: Record<string, unknown>): ProductionCall {
  checkpoint();
  const child = spawn(process.execPath, ['--import', 'tsx', join(here, 'field.ts')], {
    cwd: here, detached: true,
    env: {...process.env, OI_STATE_HOME: stateHome, OI_SHARED_FIELD_TIMEOUT_MS: '8000'},
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', stdoutBytes = 0, stderrBytes = 0, settled = false;
  let protocolFault: Error | undefined;
  let unresolved: Record<string, unknown> | undefined;
  const frames: Envelope[] = [];
  let resolveFirst!: (value: Envelope) => void;
  let rejectFirst!: (reason: Error) => void;
  const first = new Promise<Envelope>((resolve, reject) => {resolveFirst = resolve; rejectFirst = reject;});
  // A consumer may be waiting for owner readback while this first frame is
  // still pending. Observe rejection immediately without changing its result.
  void first.catch(() => {});
  const fail = (error: Error) => {protocolFault ??= error; if (!settled) {settled = true; rejectFirst(error);}};
  const firstDeadline = setTimeout(() => {fail(new Error('Production client returned no bounded initial envelope')); signal('SIGTERM');}, 12_000);
  const signal = (name: NodeJS.Signals) => {
    // Signal the owned group only while its leader remains unreaped.
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      try {process.kill(-child.pid, name);} catch (error: any) {if (error.code !== 'ESRCH') throw error;}
    }
  };
  let forcedKill: ReturnType<typeof setTimeout> | undefined;
  const lifetimeDeadline = setTimeout(() => {
    fail(new Error('Production acceptance client exceeded its finite process lifetime'));
    signal('SIGTERM');
    forcedKill = setTimeout(() => signal('SIGKILL'), 3000);
  }, request.hold_presence === true ? 45_000 : 15_000);
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.byteLength;
    if (stdoutBytes > 65_536) {fail(new Error('Production initial envelopes exceeded the native 64 KiB bound')); signal('SIGTERM'); return;}
    stdout += chunk.toString('utf8');
    for (;;) {
      const newline = stdout.indexOf('\n');
      if (newline < 0) break;
      const line = stdout.slice(0, newline); stdout = stdout.slice(newline + 1);
      try {
        const envelope = JSON.parse(line) as Envelope;
        if (frames.length) {fail(new Error('Production held client emitted more than one initial envelope')); signal('SIGTERM'); return;}
        frames.push(envelope);
        if (!settled) {settled = true; clearTimeout(firstDeadline); resolveFirst(envelope);}
      } catch (error) {fail(new Error(`Production client emitted invalid JSON: ${String(error)}`)); signal('SIGTERM');}
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.byteLength;
    if (stderrBytes > 65_536) {fail(new Error('Production diagnostics exceeded 64 KiB')); signal('SIGTERM'); return;}
    stderr += chunk.toString('utf8');
  });
  const ended = new Promise<{code: number | null; signal: NodeJS.Signals | null}>((resolve, reject) => {
    child.once('error', error => {clearTimeout(firstDeadline); clearTimeout(lifetimeDeadline); fail(error); reject(error);});
    child.once('close', (code, exitSignal) => {
      clearTimeout(firstDeadline);
      clearTimeout(lifetimeDeadline);
      clearTimeout(forcedKill);
      if (!settled) fail(new Error(`Production client ended before its envelope (${code}, ${exitSignal}): ${stderr}`));
      resolve({code, signal: exitSignal});
    });
  });
  void ended.catch(() => {});
  child.stdin.on('error', error => fail(error));
  child.stdin.end(JSON.stringify(request));
  const call: ProductionCall = {child, first, ended, frames: () => frames, unresolved: () => unresolved, stop: async () => {
    signal('SIGTERM');
    const killDeadline = setTimeout(() => signal('SIGKILL'), 3000);
    let readbackDeadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([ended, new Promise<never>((_resolve, reject) => {
        readbackDeadline = setTimeout(() => {
          unresolved = {child_pid: child.pid, exit_code: child.exitCode, exit_signal: child.signalCode,
            detail: 'Native client cleanup readback did not complete; inherited-pipe or group state is unresolved'};
          // Release this harness's pipe handles. This is not group-reap proof,
          // and it never authorizes a signal against a reaped leader's PID.
          child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
          reject(new Error(JSON.stringify(unresolved)));
        }, 5000);
      })]);
      if (stdout.trim()) fail(new Error('Production client ended with an unterminated trailing frame'));
      if (child.pid) {
        const deadline = Date.now() + 1000;
        for (;;) {
          try {process.kill(-child.pid, 0);} catch (error: any) {if (error.code === 'ESRCH') break; throw error;}
          if (Date.now() >= deadline) {
            unresolved = {child_pid: child.pid, detail: 'An owned process group remains after leader/pipe completion; no post-reap signal is permitted'};
            throw new Error(JSON.stringify(unresolved));
          }
          await sleep(25); // Only read-only cleanup observation, never a claim barrier.
        }
      }
      if (protocolFault) throw protocolFault;
    } finally {
      clearTimeout(killDeadline); clearTimeout(readbackDeadline);
      if (!unresolved) processes.delete(call);
    }
  }};
  processes.add(call);
  return call;
}

const entered = (client: Client, participantRef: string) => rows((client.conn.db as any).fieldPresence)
  .find((row: any) => row.fieldRef === fieldRef && row.participantRef === participantRef);
async function held(tokenLabel: string, participantRef: string) {
  const call = launch({kind: 'enter', token_label: tokenLabel, field_ref: fieldRef, participant_ref: participantRef, hold_presence: true});
  const envelope = await call.first;
  assert.equal(envelope.ok, true, JSON.stringify(envelope));
  assert.equal(call.child.exitCode, null, 'The actual producing connection remains held');
  return {call, data: envelope.data};
}
async function refused(tokenLabel: string, participantRef: string) {
  const call = launch({kind: 'enter', token_label: tokenLabel, field_ref: fieldRef, participant_ref: participantRef});
  try {
    const result = await call.first;
    assert.equal(result.ok, false);
    assert.equal(result.error?.kind, 'refused', 'A real SenderError before completion is a known refusal');
    assert.equal(result.error?.completion_observation?.completed_reducers, 0);
    assert.equal((await call.ended).code, 1);
    assert.equal(call.frames().length, 1);
  } finally {await call.stop();}
}

async function scenario() {
  assert.deepEqual(claims(persistentRef), [], 'Native provider inspection is authorized before any test mutation');
  const owner = await openOwned('owner');
  const persistent = await openOwned('persistent');
  const finite = await openOwned('finite');
  assert.equal(new Set(clients.map(client => client.identityHex)).size, 3, 'Three actual independently issued SDK identities');
  const reducers: any = owner.conn.reducers;
  const mutate = async (operation: string, input: unknown) => {checkpoint(); await reducers[operation](input); checkpoint();};
  for (const [ref, visibility] of [[fieldRef, 'restricted'], [neighbourRef, 'private']] as const) {
    const contract = createSharedField({field_ref: ref, visibility, title: 'Controlled presence acceptance'});
    await mutate('putSharedField', {fieldRef: ref, kind: contract.kind, visibility, contractJson: JSON.stringify(contract)});
  }
  for (const [client, participantRef] of [[persistent, persistentRef], [finite, finiteRef]] as const) {
    const participant = createParticipant({participant_ref: participantRef, field_ref: fieldRef,
      identity: {kind: 'human', ref: `human:controlled-sdk:${client.identityHex}`},
      provenance: {source_system: 'acceptance', source_ref: source, source_revision: sourceRevision}});
    await mutate('putParticipant', {participantRef, fieldRef, identityKind: participant.identity.kind, identityRef: participant.identity.ref,
      sourceSystem: participant.provenance.source_system, sourceRevision, contractJson: JSON.stringify(participant)});
  }
  const privatePublisher = `participant:presence:${run}:private-owner`;
  const privateSource = join(stateHome, 'private-note.txt');
  writeFileSync(privateSource, privateBody, {mode: 0o600});
  const privateRevision = `sha256:${createHash('sha256').update(readFileSync(privateSource)).digest('hex')}`;
  const privateParticipant = createParticipant({participant_ref: privatePublisher, field_ref: neighbourRef,
    identity: {kind: 'human', ref: `human:controlled-sdk:${owner.identityHex}`},
    provenance: {source_system: 'acceptance', source_ref: source, source_revision: sourceRevision}});
  await mutate('putParticipant', {participantRef: privatePublisher, fieldRef: neighbourRef, identityKind: privateParticipant.identity.kind,
    identityRef: privateParticipant.identity.ref, sourceSystem: 'acceptance', sourceRevision, contractJson: JSON.stringify(privateParticipant)});
  await mutate('grantParticipantAuthority', {fieldRef: neighbourRef, participantRef: privatePublisher, targetIdentity: owner.identity, role: 'contributor', contactable: false, ttlSeconds: 0});
  const privateProjection = createProjection({projection_ref: `${privateRef}:projection`, subject: {ref: privateRef, kind: 'artifact'},
    source: {system: 'acceptance', ref: privateSource, revision: privateRevision}, publisher_participant_ref: privatePublisher,
    published_at: new Date().toISOString(), audience: {visibility: 'private', refs: [privatePublisher]},
    representation: {kind: 'text/plain', payload: privateBody}, provenance: [{kind: 'authored', ref: privateSource, source_system: 'acceptance', revision: privateRevision}]});
  await mutate('putProjection', {projectionKey: projectionStorageKey(privateProjection.projection_ref, 1), fieldRef: neighbourRef,
    projectionRef: privateProjection.projection_ref, projectionRevision: 1, sourceRevision: privateRevision,
    publisherParticipantRef: privatePublisher, state: 'published', contractJson: JSON.stringify(privateProjection)});
  const privateEntry = createExploreEntry({ref: privateRef, kind: 'artifact', world_ref: `world:controlled-sdk:${owner.identityHex}`,
    label: 'Private acceptance note', projection_ref: privateProjection.projection_ref, revision: privateRevision,
    provenance: privateProjection.provenance});
  await mutate('putExploreEntry', {semanticRef: privateRef, fieldRef: neighbourRef, worldRef: privateEntry.world_ref,
    kind: privateEntry.kind, label: privateEntry.label, revision: privateRevision, entryJson: JSON.stringify(privateEntry)});
  await waitUntil(() => JSON.stringify(fieldSnapshot(owner)).includes(privateBody), 'owner to receive its actual private note');
  const grant = (client: Client, participantRef: string, ttlSeconds: number) => mutate('grantParticipantAuthority', {fieldRef, participantRef, targetIdentity: client.identity, role: 'contributor', contactable: false, ttlSeconds});
  await grant(persistent, persistentRef, 0);
  await mutate('grantFieldRead', {fieldRef, participantRef: persistentRef});
  await waitUntil(() => rows((persistent.conn.db as any).sharedField).some(row => row.fieldRef === fieldRef), 'persistent actor to receive its actual restricted field');
  noPrivateMaterial(persistent); noPrivateMaterial(finite);
  proof.push('An actual private source, participant, artifact, entry and projection are owner-readable while authorized neighbour snapshots exclude them.');

  const first = await held('persistent', persistentRef);
  const expectedPresence = {schema: 'oi.shared-field.presence-result/v1', field_ref: fieldRef, participant_ref: persistentRef, state: 'entered'};
  assert.deepEqual(first.data, expectedPresence);
  const original = await waitUntil(() => entered(owner, persistentRef), 'owner to see the first live connection');
  const firstClaims = claims(persistentRef); assert.equal(firstClaims.length, 1);
  const second = await held('persistent', persistentRef);
  assert.deepEqual(second.data, expectedPresence);
  const bothClaims = claims(persistentRef); assert.equal(bothClaims.length, 2);
  const secondClaim = bothClaims.find(claim => !firstClaims.includes(claim)); assert.ok(secondClaim);
  await first.call.stop();
  await waitUntil(() => {const remaining = claims(persistentRef); return remaining.length === 1 && remaining[0] === secondClaim;}, 'native disconnected transaction to remove only the first exact claim');
  // A new authorized subscription reads the retained server state, rather
  // than accepting a cached row as evidence that the surviving claim exists.
  const freshOwner = await openOwned('owner');
  assert.ok(entered(freshOwner, persistentRef), 'Closing one connection preserves the other actual connection claim');
  assert.equal(second.call.child.exitCode, null);
  await second.call.stop();
  await waitUntil(() => claims(persistentRef).length === 0, 'native last disconnection to remove every claim');
  await waitUntil(() => !entered(owner, persistentRef) && !entered(freshOwner, persistentRef), 'last disconnection to remove live presence');
  assert.equal(first.call.frames().length, 1); assert.equal(second.call.frames().length, 1);
  proof.push('Two production held connections share one participant; only the final disconnect removes presence.');

  const continued = await held('persistent', persistentRef);
  assert.deepEqual(continued.data, expectedPresence);
  const fresh = await waitUntil(() => entered(owner, persistentRef), 'fresh body to enter');
  assert.ok(fresh.enteredAtMicros > original.enteredAtMicros, 'Fresh continuation is a new native occupancy');
  await refused('finite', persistentRef);
  noPrivateMaterial(persistent); noPrivateMaterial(finite);
  await mutate('revokeParticipantAuthority', {fieldRef, participantRef: persistentRef});
  await waitUntil(() => !entered(owner, persistentRef), 'revocation to remove live presence');
  await refused('persistent', persistentRef);
  await continued.call.stop();
  proof.push('Fresh continuation has a new native occupancy; impersonation and revoked authority are refused.');

  await grant(finite, finiteRef, 30);
  const finiteBody = await held('finite', finiteRef);
  assert.deepEqual(finiteBody.data, {schema: 'oi.shared-field.reducer-completion/v1',
    completion: {state: 'completed', reducer: 'enter_field', basis: 'sdk-reducer-success'},
    target: {field_ref: fieldRef, participant_ref: finiteRef},
    observation: {state: 'unavailable', basis: 'no-matching-authorized-row'}, connection_scoped: true});
  assert.equal(entered(owner, finiteRef), undefined, 'Clockless views withhold finite-authority presence');
  // Reveal the actual earlier reducer effect by changing read eligibility,
  // without sending enter again or inventing a row from its completion.
  await grant(finite, finiteRef, 0);
  await mutate('grantFieldRead', {fieldRef, participantRef: finiteRef});
  assert.ok(await waitUntil(() => entered(owner, finiteRef), 'the earlier actual finite entry to become read-eligible'));
  assert.equal(finiteBody.call.frames().length, 1, 'Grant change does not create a second completion envelope');
  noPrivateMaterial(persistent); noPrivateMaterial(finite);
  await finiteBody.call.stop();
  await waitUntil(() => !entered(owner, finiteRef), 'finite-origin body disconnect to remove presence');
  proof.push('Finite SDK success returns completion without material; a later persistent grant reveals the actual earlier effect without replay.');

  await grant(finite, finiteRef, 2);
  await sleep(2500); // Elapsed after the server's actual grant completion.
  await refused('finite', finiteRef);
  assert.equal(entered(owner, finiteRef), undefined);
  noPrivateMaterial(persistent); noPrivateMaterial(finite);
  proof.push('The native reducer refuses a new entry after real finite-grant expiry.');
  checkpoint();
  console.log(JSON.stringify({result: 'pass', source_revision: sourceRevision, evidence: 'controlled SDK identities; actual ephemeral module and production client processes', proof, installed_visual_acceptance: false, two_human_experience: false}, null, 2));
}
let acceptanceDeadline: ReturnType<typeof setTimeout> | undefined;
try {
  await Promise.race([scenario(), new Promise<never>((_resolve, reject) => {
    acceptanceDeadline = setTimeout(() => {
      cancelled = true;
      for (const client of clients) close(client);
      reject(new Error('Acceptance exceeded 120 seconds; in-flight reducer outcomes are unknown, no effect is retried.'));
    }, 120_000);
  })]);
} finally {
  cancelled = true; clearTimeout(acceptanceDeadline);
  try {
    const cleanup = await Promise.allSettled([...processes].map(call => call.stop()));
    const failures = cleanup.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(item => item.reason), 'Production acceptance cleanup failed');
  }
  finally {
    for (const client of clients) close(client);
    if (previousStateHome === undefined) delete process.env.OI_STATE_HOME; else process.env.OI_STATE_HOME = previousStateHome;
    const unresolved = [...processes].flatMap(call => call.unresolved() ? [call.unresolved()] : []);
    if (unresolved.length) console.error(JSON.stringify({result: 'cleanup-unresolved', state_home_retained: stateHome, unresolved}));
    else rmSync(stateHome, {recursive: true, force: true});
  }
}
