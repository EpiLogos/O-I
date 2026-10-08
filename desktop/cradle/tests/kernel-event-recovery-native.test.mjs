/** Focused real transport recovery: production replay client, native owner,
 * actual process suspension and the unchanged ten-second request deadline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {kernelOp, eventReplay, subscribeTopic} from '../src/kernel/bridge.ts';

test('real suspended native bridge recovers one qualified generation without initial or repeated healthy notifications', {
  skip: process.env.OI_NATIVE_EVENT_RECOVERY !== '1', timeout: 90000,
}, async () => {
  assert.ok(process.env.OI_KERNEL_BIN, 'OI_KERNEL_BIN must name the exact current native walk-bridge');
  assert.ok(process.env.OI_EVENT_RECOVERY_RECEIPT, 'Retain a source-bound native evidence receipt');
  const binary = resolve(process.env.OI_KERNEL_BIN);
  const home = await mkdtemp(join(tmpdir(), 'oi-event-recovery-native-'));
  const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
  const receipt = {schema: 'oi.kernel-event-recovery-native-proof/v1', passed: false,
    scope: 'Real HTTP/native process and production subscribeTopic; provider and Foundation fault preservation independently source-reviewed, no React/UI claim',
    executable: {path: binary, sha256: await digest(binary)}, source: {}, checks: [], pages: {}};
  for (const path of ['desktop/cradle/src/kernel/bridge.ts', 'desktop/cradle/src/kernel/KernelProvider.tsx', 'packages/live-shell/ui/src/native/Foundation.tsx']) {
    receipt.source[path] = await digest(new URL(`../../../${path}`, import.meta.url));
  }
  let child, subscription, suspended = false, stdout = '', stderr = '';
  const lifetime = new AbortController();
  const timer = setTimeout(() => {lifetime.abort(Error('Focused native recovery lifetime expired')); subscription?.unsubscribe();}, 60000);
  const delay = ms => new Promise(accept => setTimeout(accept, ms));
  const waitFor = async (predicate, bound, description) => {
    const end = Date.now() + bound;
    while (!predicate()) {
      lifetime.signal.throwIfAborted();
      assert.ok(Date.now() < end, `${description} exceeded ${bound}ms`);
      await delay(20);
    }
  };
  const stop = async () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    if (suspended) {assert.ok(child.kill('SIGCONT')); suspended = false;}
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const kill = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {await exited;} finally {clearTimeout(kill);}
  };
  const start = async () => {
    child = spawn(binary, ['127.0.0.1:0'], {env: {...process.env, OI_HOME: home}, stdio: ['ignore', 'pipe', 'pipe']});
    receipt.pid = child.pid;
    child.stderr.on('data', bytes => {stderr = (stderr + String(bytes)).slice(-65536);});
    return new Promise((accept, reject) => {
      let settled = false;
      const finish = (error, transport) => {
        if (settled) return; settled = true; clearTimeout(startup);
        child.off('error', onError); child.off('exit', onExit);
        error ? reject(error) : accept(transport);
      };
      const onError = error => finish(error);
      const onExit = code => finish(Error(`Test-owned native bridge exited ${code}: ${stderr}`));
      const startup = setTimeout(() => finish(Error(`Native startup exceeded15000ms: ${stderr}`)), 15000);
      child.once('error', onError); child.once('exit', onExit);
      child.stdout.on('data', bytes => {
        stdout = (stdout + String(bytes)).slice(-65536);
        const match = /listening on (http:\/\/[^\s]+)/.exec(stdout);
        if (match) finish(null, {kind: 'bridge', url: match[1]});
      });
    });
  };
  try {
    const transport = await start();
    receipt.transport = transport;
    const op = value => kernelOp(transport, value, AbortSignal.any([lifetime.signal, AbortSignal.timeout(5000)]));
    const open = async title => {
      const call = await op({op: 'surface_open', surface_id: 'native-focused-recovery', kind: 'blank', title});
      assert.equal(call.outcome?.result, 'surface_opened', call.error);
      assert.equal(call.outcome.receipts.length, 1);
      assert.equal(call.outcome.receipts[0].event, 'surface_changed');
      return call.outcome.receipts[0];
    };
    const initial = await eventReplay(transport, 1, undefined, 128, lifetime.signal);
    assert.equal(initial.resync_required, false); assert.equal(initial.latest_seq, 0);
    receipt.pages.initial = initial;
    const generation = initial.generation, observed = [], errors = [], resyncs = [], healthy = [];
    subscription = await subscribeTopic(transport, entry => observed.push(entry), page => {
      resyncs.push(page); throw Error('A same-process retained three-event window must not require resync');
    }, error => errors.push({at: Date.now(), error}), () => healthy.push({at: Date.now(), delivered_seq: observed.at(-1)?.seq ?? 0}));
    assert.ok(subscription);
    const first = await open('Before actual suspension');
    await waitFor(() => observed.length === 1, 10000, 'Initial qualified receipt');
    assert.deepEqual(observed, [first]); assert.deepEqual(errors, []); assert.deepEqual(healthy, []);
    assert.equal(first.seq, 1);
    receipt.checks.push({name: 'Successful initial native replay has no fabricated recovery', passed: true, first});

    const stoppedAt = Date.now();
    assert.ok(child.kill('SIGSTOP')); suspended = true;
    await waitFor(() => errors.length > 0, 20000, 'Actual ten-second replay deadline');
    const elapsed = errors[0].at - stoppedAt;
    assert.ok(elapsed >= 9500, `Observed failure ${elapsed}ms did not reach the production ten-second deadline`);
    assert.match(errors[0].error, /timeout|timed out/i);
    assert.equal(healthy.length, 0); assert.deepEqual(observed, [first]); assert.deepEqual(resyncs, []);
    receipt.checks.push({name: 'SIGSTOP reaches actual production deadline and retains the last qualified cursor', passed: true, elapsed_ms: elapsed, errors: [...errors]});
    const resumedAt = Date.now(); assert.ok(child.kill('SIGCONT')); suspended = false;
    await waitFor(() => healthy.length === 1, 10000, 'Qualified healthy recovery');
    assert.ok(healthy[0].at >= resumedAt);
    const recovered = await eventReplay(transport, first.seq + 1, generation, 128, lifetime.signal);
    assert.equal(recovered.generation, generation); assert.equal(recovered.resync_required, false);
    assert.equal(recovered.next_seq, 2); assert.deepEqual(recovered.receipts, []);
    receipt.pages.recovered = recovered;

    const second = await open('After qualified transport recovery');
    const third = await open('Later ordinary successful replay');
    await waitFor(() => observed.length === 3, 10000, 'Post-recovery native receipts');
    assert.deepEqual(observed, [first, second, third]); assert.deepEqual(observed.map(x => x.seq), [1, 2, 3]);
    await delay(750);
    assert.equal(healthy.length, 1); assert.equal(errors.length, 1); assert.deepEqual(resyncs, []);
    const final = await eventReplay(transport, 1, generation, 128, lifetime.signal);
    assert.equal(final.generation, generation); assert.equal(final.resync_required, false);
    assert.deepEqual(final.receipts, observed); receipt.pages.final = final;
    const state = await op({op: 'state'});
    assert.equal(state.outcome?.snapshot.surfaces['native-focused-recovery'].title, 'Later ordinary successful replay');
    receipt.checks.push({name: 'One qualified healthy notification; unchanged owner generation and exact continuous native sequence', passed: true, healthy, generation, sequences: observed.map(x => x.seq)});
    assert.equal(await digest(binary), receipt.executable.sha256, 'Candidate executable changed during isolated evidence run');
    receipt.passed = true;
  } catch (error) {receipt.error = String(error?.stack ?? error); throw error;}
  finally {
    clearTimeout(timer); lifetime.abort(); subscription?.unsubscribe();
    try {await stop(); receipt.cleanup = {test_owned_pid: child?.pid, exit_code: child?.exitCode, signal: child?.signalCode, stopped: !child || child.exitCode !== null || child.signalCode !== null};}
    finally {
      await rm(home, {recursive: true, force: true});
      const path = resolve(process.env.OI_EVENT_RECOVERY_RECEIPT);
      await mkdir(dirname(path), {recursive: true});
      await writeFile(path, JSON.stringify({...receipt, native_stderr_tail: stderr}, null, 2) + '\n');
    }
  }
});
