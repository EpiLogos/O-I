/**
 * Owner-service 8787 census (LEGACY-CRADLE-RETIREMENT.md §3 gate 4, §5 step 5).
 *
 * The seam server is packages/live-shell (axum). Its route table and bind port
 * are read from its source; every caller in a shipping tree is found by route
 * name or by a :8787 literal. Shipping callers must match the register exactly,
 * so a new 8787 caller (or a new call site in a known file) fails here until it
 * is named with its status and replacement in owner-service-census.json.
 *
 * Scan buckets: shipping (counted), test (exact-matched), doc and derived
 * (listed by CENSUS_PRINT only; derived output may be untracked, so it is not
 * asserted). Comment-only lines are references, not callers.
 *
 * Print the full census: CENSUS_PRINT=1 node --test tests/conformance/owner-service-census.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {repo, registry, rustVariants, read} from './source.mjs';

const SERVER = 'packages/live-shell/src/main.rs';
const SCAN_ROOTS = ['desktop/cradle', 'packages', 'cli', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', 'target', '.git', '__pycache__']);
const TEXT = /\.(ts|tsx|js|mjs|cjs|rs|py|sh|html|md|json|toml|yml|yaml)$/;
// The census's own files carry the route strings it searches for.
const SELF = new Set([
  'desktop/cradle/tests/conformance/owner-service-census.test.mjs',
  'desktop/cradle/tests/conformance/owner-service-census.json',
]);
const bucketOf = file => {
  if (/(^|\/)(dist|build|ui-dist)(\/|$)/.test(file)) return 'derived';
  if (file.startsWith('packages/live-shell/src/')) return 'server';
  if (/(^|\/)(docs|evidence|artifacts)(\/|$)|\.md$|RETURN\.html$/.test(file)) return 'doc';
  if (/(^|\/)(tests?|support|fixtures)(\/|$)|\.test\.[cm]?[jt]sx?$|\.browser\.mjs$|(^|\/)walk\//.test(file)) return 'test';
  return 'shipping';
};
const COMMENT = /^\s*(\/\/|\/\*|\*|#|<!--)/;
const escape = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const readRepo = path => readFileSync(join(repo, path), 'utf8');

function files(dir, out = []) {
  for (const entry of readdirSync(join(repo, dir), {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files(rel, out);
    else if (TEXT.test(entry.name) && !SELF.has(rel)) out.push(rel);
  }
  return out;
}

/** The seam server's own routes, parsed from its build_router body. */
export function serverRoutes(text = readRepo(SERVER)) {
  const start = text.indexOf('fn build_router');
  const end = text.indexOf('#[tokio::main]');
  if (start < 0 || end < start) throw Error('build_router not found in the seam server');
  return [...text.slice(start, end).matchAll(/\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|delete)\(/g)]
    .map(m => ({path: m[1], method: m[2].toUpperCase()}));
}

/** The seam's bind port: the LIVE_SHELL_BIND default in the server source. */
export function serverPort(text = readRepo(SERVER)) {
  const m = text.match(/LIVE_SHELL_BIND"\)\.unwrap_or_else\(\|_\| "127\.0\.0\.1:(\d+)"/);
  if (!m) throw Error('LIVE_SHELL_BIND default not found');
  return Number(m[1]);
}

const apiSuffixes = serverRoutes().filter(r => r.path.startsWith('/api/')).map(r => r.path.slice('/api/'.length));
// A URL literal starts after a quote, backtick or template brace, so import paths such as @tauri-apps/api/core never match.
const SEAM_ROUTE = new RegExp(String.raw`(?<=['"\`}])/api/(${[...apiSuffixes].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![A-Za-z0-9_/-])`, 'g');
const SEAM_PORT = new RegExp(`(?:127\\.0\\.0\\.1|localhost|0\\.0\\.0\\.0):${serverPort()}(?!\\d)`, 'g');
const ANY_API = /(?<=['"\`}])\/api\/[A-Za-z][A-Za-z0-9_/-]*/g;
const SEAM_EXACT = new RegExp(`^/api/(${[...apiSuffixes].map(escape).join('|')})$`);

/** Every seam reference in the tree: {file, line, route, comment, bucket}. */
export function scan() {
  const hits = [], adjacent = new Map();
  for (const dir of SCAN_ROOTS) for (const file of files(dir)) {
    if (file === SERVER) continue;
    const bucket = bucketOf(file);
    readRepo(file).split('\n').forEach((line, index) => {
      const comment = COMMENT.test(line);
      for (const m of line.matchAll(SEAM_ROUTE)) hits.push({file, line: index + 1, route: `/api/${m[1]}`, comment, bucket});
      for (const m of line.matchAll(SEAM_PORT)) hits.push({file, line: index + 1, route: `:${serverPort()}`, comment, bucket});
      if (bucket === 'shipping') for (const m of line.matchAll(ANY_API)) {
        const route = m[0].replace(/\/$/, '');
        if (!SEAM_EXACT.test(route)) {
          const row = adjacent.get(route) ?? {route, files: new Set(), bucket};
          row.files.add(file);
          adjacent.set(route, row);
        }
      }
    });
  }
  return {hits, adjacent: [...adjacent.values()].map(r => ({route: r.route, bucket: r.bucket, files: [...r.files].sort()}))};
}

/** Counted callers: non-comment hits in shipping trees, keyed file::route. */
export function callerCounts(hits = scan().hits) {
  const counts = {};
  for (const h of hits) if (h.bucket === 'shipping' && !h.comment) counts[`${h.file}::${h.route}`] = (counts[`${h.file}::${h.route}`] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
export function bucketCounts(hits, bucket) {
  const counts = {};
  for (const h of hits) if (h.bucket === bucket && !h.comment) counts[`${h.file}::${h.route}`] = (counts[`${h.file}::${h.route}`] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

const STATUSES = ['replaced', 'replaceable', 'missing'];
const kernelOps = () => rustVariants(read('kernel/src/lib.rs'), 'KernelOp');

test('census: the seam server and its bind port are read from source, not assumed', () => {
  const routes = serverRoutes();
  assert.equal(serverPort(), 8787);
  assert.ok(apiSuffixes.length >= 6, 'the seam serves its /api routes');
  assert.ok(routes.some(r => r.path === '/api/set' && r.method === 'GET'));
  assert.ok(routes.some(r => r.path === '/api/document/device-param' && r.method === 'POST'));
});

test('census: every shipping 8787 caller is named in the register with status and replacement', () => {
  const register = registry('owner-service-census');
  const computed = callerCounts();
  assert.deepEqual(register.server.routes, serverRoutes().map(r => `${r.method} ${r.path}`).sort(), 'the register must track the server route table');
  assert.equal(register.server.bind_default, `127.0.0.1:${serverPort()}`);
  const named = Object.fromEntries(register.callers.map(c => [`${c.file}::${c.route}`, c.count]));
  const unnamed = Object.keys(computed).filter(k => named[k] === undefined);
  assert.deepEqual(unnamed, [], `new 8787 caller(s) not in owner-service-census.json: ${unnamed.join(', ')}`);
  const drifted = Object.keys(computed).filter(k => named[k] !== computed[k]).map(k => `${k} (register ${named[k]}, found ${computed[k]})`);
  assert.deepEqual(drifted, [], `caller count drifted from the register: ${drifted.join('; ')}`);
  const stale = Object.keys(named).filter(k => computed[k] === undefined);
  assert.deepEqual(stale, [], `register names caller(s) no longer in source: ${stale.join(', ')}`);
});

test('census: each register entry is a valid replacement claim against the kernel op set', () => {
  const register = registry('owner-service-census');
  const ops = new Set(kernelOps());
  for (const c of register.callers) {
    const at = `${c.file}::${c.route}`;
    assert.ok(STATUSES.includes(c.status), `${at}: status must be one of ${STATUSES.join(', ')}`);
    assert.ok(c.operation && c.purpose, `${at}: operation and purpose are required`);
    assert.ok(/^(desktop|packages|cli|scripts)\//.test(c.file) && existsSync(join(repo, c.file)), `${at}: file must be an existing repo-relative path`);
    if (c.status === 'replaced') assert.ok(ops.has(c.kernel_op), `${at}: replaced needs a KernelOp that exists (${c.kernel_op})`);
    if (c.status === 'replaceable') {
      assert.ok(ops.has(c.kernel_op), `${at}: replaceable needs an existing KernelOp (${c.kernel_op})`);
      assert.ok(c.residual_op_needed, `${at}: replaceable must name the residual op the kernel op does not cover`);
    }
    if (c.status === 'missing') {
      assert.equal(c.kernel_op, null, `${at}: missing has no kernel op`);
      assert.ok(c.owner, `${at}: missing must name its owner`);
      assert.ok(c.op_needed, `${at}: missing must name the op needed`);
    }
    assert.ok(c.native_path === null || typeof c.native_path === 'string', `${at}: native_path is a string or null`);
  }
});

test('census: the register summary and the test-bucket callers match the scan', () => {
  const register = registry('owner-service-census');
  const {hits} = scan();
  const counted = register.callers.reduce((sum, c) => sum + c.count, 0);
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, register.callers.filter(c => c.status === s).reduce((n, c) => n + c.count, 0)]));
  assert.deepEqual(register.summary, {callers: counted, ...byStatus}, 'summary must be derived from the callers list');
  assert.deepEqual(register.test_callers, bucketCounts(hits, 'test'), 'test-bucket matches are listed separately and must match');
});

test('census: no build output is tracked in a scanned tree (derived output is rebuilt, never kept)', () => {
  // A tracked copy of a build is a stale caller nobody runs: packages/live-shell/live-shell/ui/ui-dist (a doubled-path build of 11 Oct,
  // kept by the #637 convergence) carried /api routes the census could only set aside. Git, not the disk, says what is kept.
  const tracked = execFileSync('git', ['-C', repo, 'ls-files', '-z', '--', ...SCAN_ROOTS], {encoding: 'utf8', maxBuffer: 1 << 28}).split('\0').filter(Boolean);
  // A tracked file the work tree has already deleted is on its way out of git: only what stands on disk counts.
  const kept = tracked.filter(file => bucketOf(file) === 'derived' && existsSync(join(repo, file)));
  assert.deepEqual(kept, [], `tracked build output in a scanned tree: ${kept.join(', ')} — remove it from git and ignore the path that wrote it`);
});

test('census: the dev transports that forward /api are named', () => {
  const register = registry('owner-service-census');
  for (const t of register.dev_transports) {
    assert.ok(readRepo(t.file).includes(t.pattern), `${t.file}: proxy pattern ${t.pattern} is gone; update the register`);
  }
});

test('census: CENSUS_PRINT writes the full scan for the evidence record', () => {
  if (!process.env.CENSUS_PRINT) return;
  const {hits, adjacent} = scan();
  const out = {
    server: {file: SERVER, port: serverPort(), routes: serverRoutes().map(r => `${r.method} ${r.path}`)},
    shipping: callerCounts(hits),
    shipping_references_in_comments: hits.filter(h => h.bucket === 'shipping' && h.comment).map(h => `${h.file}:${h.line} ${h.route}`),
    test: bucketCounts(hits, 'test'),
    doc: bucketCounts(hits, 'doc'),
    derived: bucketCounts(hits, 'derived'),
    adjacent_relative_api_not_on_seam: adjacent.filter(a => a.bucket === 'shipping'),
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
});
