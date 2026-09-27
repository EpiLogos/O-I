#!/usr/bin/env node
// The landing gate runner — one instrument for "is this tip landable".
//
//   node gates/run.mjs landing              run the landing tier at this tip
//   node gates/run.mjs walks                run the walks tier
//   node gates/run.mjs status               convergence pressure of every worktree
//   flags: --only a,b   --skip a,b   --keep-going   --json
//
// Gates come from gates/manifest.json (provenance: the GitHub workflow each
// gate was derived from). A green receipt is machine-checked by the pre-push
// guard, so a landing means exactly what CI would have confirmed on the
// covered surface — discovered here, in minutes, not in round-trips.
// ci-only gates are never executed locally; every receipt names them as
// deferred so green never overclaims.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const RECEIPTS = join(ROOT, 'gates', 'receipts');
const LOGS = join(RECEIPTS, 'logs');
const manifest = JSON.parse(readFileSync(join(ROOT, 'gates', 'manifest.json'), 'utf8'));

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (flag) => process.argv.includes(flag);
const tier = process.argv[2];
const bash = ['/bin/bash', '/bin/sh'].find((s) => existsSync(s));

const git = (args, opts = {}) => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
  return { ...r, out: (r.stdout || '').trim() };
};
const head = () => git(['rev-parse', 'HEAD']).out;

function runGate(gate) {
  const cwd = join(ROOT, gate.cwd || '.');
  const t0 = Date.now();
  const r = spawnSync(bash, ['-c', gate.command], { cwd, encoding: 'utf8', timeout: 15 * 60_000 });
  const duration_ms = Date.now() - t0;
  return { exit: r.status, duration_ms, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function bootstrap(area) {
  for (const b of manifest.bootstrap || []) {
    if (!b.run_if_selected.includes(area)) continue;
    for (const cmd of b.commands) {
      const r = spawnSync(bash, ['-c', cmd], { cwd: ROOT, encoding: 'utf8' });
      if (r.status !== 0) {
        console.error(`bootstrap failed (${cmd}):\n${r.stderr || r.stdout}`);
        process.exit(2);
      }
    }
  }
}

function cmdRun(selectedTier) {
  const only = arg('--only')?.split(',').filter(Boolean);
  const skip = arg('--skip')?.split(',').filter(Boolean);
  const keepGoing = has('--keep-going');
  const gates = manifest.gates.filter((g) => {
    if (g.tier === 'ci-only') return false;
    if (only) return only.includes(g.name);
    return g.tier === selectedTier && !(skip || []).includes(g.name);
  });
  if (!gates.length) { console.error(`no gates selected for tier ${selectedTier}`); process.exit(2); }

  const partial = Boolean(only || skip);
  const started = new Date().toISOString();
  const sha = head();
  const dirty = git(['status', '--porcelain']).out.length > 0;
  console.log(`gates: ${selectedTier} tier @ ${sha.slice(0, 12)}${dirty ? ' (dirty tree — receipt records it)' : ''}`);
  const results = [];
  let failed = 0;
  for (const gate of gates) {
    bootstrap(gate.area);
    process.stdout.write(`▶ ${gate.name} … `);
    const retries = gate.retry ?? 0;
    let attempts = [];
    let r, flaked = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      r = runGate(gate);
      attempts.push({ exit: r.exit, duration_ms: r.duration_ms });
      if (r.exit === 0) break;
      if (attempt < retries) { flaked = true; process.stdout.write(`attempt ${attempt + 1} failed, retrying (load-sensitive) … `); }
    }
    const duration_ms = attempts.reduce((a, x) => a + x.duration_ms, 0);
    const log = r.stdout + (r.stderr ? `\n--- stderr ---\n${r.stderr}` : '');
    const entry = { name: gate.name, exit: r.exit, duration_ms, attempts, flaked, provenance: gate.provenance };
    results.push({ ...entry, ok: r.exit === 0 });
    console.log(r.exit === 0 ? `ok (${(duration_ms / 1000).toFixed(1)}s${flaked ? ', after retry' : ''})` : `FAIL (${(duration_ms / 1000).toFixed(1)}s)`);
    if (r.exit !== 0) {
      failed++;
      const logDir = join(LOGS, started.slice(0, 19).replaceAll(':', ''));
      mkdirSync(logDir, { recursive: true });
      writeFileSync(join(logDir, `${gate.name}.log`), `cwd: ${gate.cwd}\ncommand: ${gate.command}\n\n${log}`);
      console.error(`  log: gates/receipts/logs/${started.slice(0, 19).replaceAll(':', '')}/${gate.name}.log`);
      if (!keepGoing) break;
    }
  }
  const deferred = manifest.gates.filter((g) => g.tier === 'ci-only').map((g) => ({ name: g.name, why: g.why || 'requires GitHub runner infrastructure' }));
  const receipt = {
    schema: 'oi.gate-run/v1',
    head: sha,
    dirty,
    tier: selectedTier,
    scope: partial ? 'partial' : 'full',
    selected: gates.map((g) => g.name),
    started, finished: new Date().toISOString(),
    pass: failed === 0,
    failed_count: failed,
    flaked_count: results.filter((r) => r.flaked).length,
    gates: results,
    deferred_to_ci: deferred,
  };
  mkdirSync(RECEIPTS, { recursive: true });
  const stamp = started.slice(0, 19).replaceAll(/[:T-]/g, '');
  writeFileSync(join(RECEIPTS, `${stamp}-${selectedTier}.json`), JSON.stringify(receipt, null, 1));
  writeFileSync(join(RECEIPTS, `latest-${selectedTier}.json`), JSON.stringify(receipt, null, 1));
  if (has('--json')) console.log(JSON.stringify(receipt, null, 1));
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.filter((r) => r.ok).length}/${results.length} gates; receipt: gates/receipts/latest-${selectedTier}.json`);
  console.log('deferred to CI: ' + deferred.map((d) => d.name).join(', '));
  process.exit(failed === 0 ? 0 : 1);
}

function cmdStatus() {
  spawnSync('git', ['fetch', 'origin', '--quiet'], { cwd: ROOT });
  const wt = git(['worktree', 'list', '--porcelain']).out.split('\n\n');
  const rows = [];
  for (const block of wt) {
    const lines = block.split('\n');
    const path = lines[0].replace(/^worktree /, '');
    const refLine = lines.find((l) => l.startsWith('branch '));
    const headLine = lines.find((l) => l.startsWith('HEAD '));
    const sha = headLine?.replace('HEAD ', '') || '';
    if (!sha) continue;
    const dirty = git(['-C', path, 'status', '--porcelain']).out.split('\n').filter(Boolean).length;
    let branch = refLine?.replace('branch refs/heads/', '') || `(detached ${sha.slice(0, 10)})`;
    let ahead = '-', behind = '-', conflicts = [];
    if (refLine) {
      ahead = git(['rev-list', '--count', `origin/main..${sha}`]).out || '?';
      behind = git(['rev-list', '--count', `${sha}..origin/main`]).out || '?';
      if (Number(ahead) > 0) {
        const mt = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', 'origin/main', sha], { cwd: ROOT, encoding: 'utf8' });
        if (mt.status === 1) {
          const files = (mt.stdout || '').split('\n').filter(Boolean);
          conflicts = files.slice(1); // first line is the conflicted tree oid
        }
      }
    }
    rows.push({ path: path.replace(ROOT, '~'), branch: branch, dirty, ahead, behind, conflicts });
  }
  let lastLanding = null;
  const latest = join(RECEIPTS, 'latest-landing.json');
  if (existsSync(latest)) {
    const r = JSON.parse(readFileSync(latest, 'utf8'));
    lastLanding = { head: r.head.slice(0, 12), pass: r.pass, finished: r.finished, covers_current_head: r.head === head() };
  }
  const out = { schema: 'oi.convergence-status/v1', main: head(), worktrees: rows, last_landing_receipt: lastLanding };
  for (const r of rows) {
    const flag = r.conflicts.length ? `CONFLICTS-WITH-MAIN (${r.conflicts.length} files)` : r.ahead !== '-' && Number(r.ahead) > 0 ? 'contained-or-clean' : '';
    console.log(`${r.path}  ${r.branch}  dirty=${r.dirty}  ahead=${r.ahead} behind=${r.behind} ${flag}`);
    for (const c of r.conflicts.slice(0, 6)) console.log(`    ! ${c}`);
    if (r.conflicts.length > 6) console.log(`    ! … ${r.conflicts.length - 6} more`);
  }
  console.log(`last landing receipt: ${lastLanding ? `${lastLanding.head} pass=${lastLanding.pass} covers-current-head=${lastLanding.covers_current_head} (${lastLanding.finished})` : 'none'}`);
  if (has('--json')) console.log(JSON.stringify(out, null, 1));
}

switch (tier) {
  case 'landing':
  case 'walks':
    cmdRun(tier);
    break;
  case 'status':
    cmdStatus();
    break;
  default:
    console.error('usage: node gates/run.mjs landing|walks|status [--only a,b] [--skip a,b] [--keep-going] [--json]');
    process.exit(2);
}
