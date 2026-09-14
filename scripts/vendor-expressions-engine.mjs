#!/usr/bin/env node
/**
 * vendor-expressions-engine.mjs
 *
 * Vendors the merged Expressions engine from EpiLogos/Point-Cloud-Demo into the
 * O-I design-system package as plain ES modules (.mjs).
 *
 * Usage:
 *   node scripts/vendor-expressions-engine.mjs [--source <dir>]
 *   node scripts/vendor-expressions-engine.mjs --verify
 *
 * Source layout -> output layout (flattened under the output root):
 *   src/engine/**                     -> engine/**
 *   field-studies-journeys/src/**     -> shell/**
 *
 * Idempotent: same source tree => byte-identical output (PROVENANCE timestamp excepted).
 */

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const worktreeRoot = path.resolve(path.dirname(scriptPath), '..');
const DEFAULT_SOURCE = '/Users/admin/Central/Work/Point-Cloud-Demo';
const OUT_ROOT = path.join(worktreeRoot, 'packages/oi-design-system/expressions-engine');

const ENGINE_PREFIX = 'src/engine/';
const SHELL_PREFIX = 'field-studies-journeys/src/';

const ENTRIES = [
  'field-studies-journeys/src/production.ts',
  'field-studies-journeys/src/model.ts',
  'field-studies-journeys/src/nativeBridge.ts',
  'field-studies-journeys/src/nativeParameters.ts',
  'field-studies-journeys/src/camera.ts',
  'field-studies-journeys/src/engine.ts',
  'field-studies-journeys/src/nativeDelta.ts',
  'src/engine/types.ts',
];

/**
 * Matches import/export statements and captures the module specifier.
 *  - alt 1: `import ...` / `export ...` clauses ending in `from '<spec>'`
 *           (handles `import type`, multi-line clauses, `export * from`)
 *  - alt 2: bare side-effect `import '<spec>'`
 * The `[^;'"]` guard keeps the clause from bleeding across statements or into
 * strings/comments; inline type positions like `import('./x').T` never match
 * (no `from` reachable before a quote) and are erased by esbuild anyway.
 */
const SPEC_RE = /(?:import|export)\b[^;'"]*?from\s*(['"])([^'"]*)\1|\bimport\s*(['"])([^'"]*)\3/g;

function extractSpecifiers(code) {
  const specs = [];
  for (const m of code.matchAll(SPEC_RE)) {
    const spec = m[2] ?? m[4];
    if (typeof spec === 'string') specs.push(spec);
  }
  return specs;
}

/** Resolve a source-relative specifier to a source .ts path, or classify it. */
function resolveSpecifier(fromSrcRel, spec) {
  if (!spec.startsWith('.')) return {kind: 'external', spec};
  let p = path.posix.normalize(path.posix.join(path.posix.dirname(fromSrcRel), spec));
  if (p.endsWith('.js')) p = p.slice(0, -3) + '.ts';
  else if (p.endsWith('.ts')) { /* already a .ts specifier */ }
  else if (!path.posix.extname(p)) p += '.ts';
  else return {kind: 'unresolved', spec, target: p};
  return {kind: 'local', spec, target: path.posix.normalize(p)};
}

/** Flattened output path (posix, relative to output root) for a source path. */
function outputFor(srcRel) {
  if (srcRel.startsWith(ENGINE_PREFIX)) {
    return 'engine/' + srcRel.slice(ENGINE_PREFIX.length).replace(/\.ts$/, '.mjs');
  }
  if (srcRel.startsWith(SHELL_PREFIX)) {
    return 'shell/' + srcRel.slice(SHELL_PREFIX.length).replace(/\.ts$/, '.mjs');
  }
  throw new Error(`no output mapping for source file: ${srcRel}`);
}

function relativeImport(fromOutRel, toOutRel) {
  let rel = path.posix.relative(path.posix.dirname(fromOutRel), toOutRel);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

/* ---------------- esbuild resolution (no new npm installs) ---------------- */

function findEsbuildDirs(root, maxDepth = 8) {
  const hits = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'node_modules') {
        const flat = path.join(dir, 'node_modules', 'esbuild');
        if (fs.existsSync(path.join(flat, 'package.json'))) hits.push(flat);
        const nested = path.join(dir, 'node_modules', 'vite', 'node_modules', 'esbuild');
        if (fs.existsSync(path.join(nested, 'package.json'))) hits.push(nested);
        continue; // do not descend wholesale into installed trees
      }
      if (e.name === '.git' || e.name === '.aikit' || e.name === '.worktrees') continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return hits;
}

function loadEsbuild() {
  const req = createRequire(import.meta.url);
  // 1) cradle install in this worktree; 2) vite's nested copy.
  const primaryPaths = [
    path.join(worktreeRoot, 'desktop/cradle/node_modules'),
    path.join(worktreeRoot, 'desktop/cradle/node_modules/vite/node_modules'),
  ];
  for (const p of primaryPaths) {
    try {
      return {esbuild: req(require.resolve('esbuild', {paths: [p]})), where: p};
    } catch { /* fall through */ }
  }
  // 3) any node_modules/esbuild under the worktree; 4) under the main checkout
  //    that owns this worktree (read-only reuse of an existing install).
  const candidates = [...findEsbuildDirs(worktreeRoot)];
  let mainRoot = null;
  try {
    const commonDir = execFileSync('git', ['-C', worktreeRoot, 'rev-parse',
      '--path-format=absolute', '--git-common-dir'], {encoding: 'utf8'}).trim();
    mainRoot = path.dirname(commonDir);
    if (mainRoot && mainRoot !== worktreeRoot) candidates.push(...findEsbuildDirs(mainRoot));
  } catch { /* not a linked worktree we can derive */ }
  for (const dir of candidates) {
    try { return {esbuild: req(dir), where: dir}; } catch { /* try next */ }
  }
  throw new Error(`could not load esbuild (searched: ${[...primaryPaths, ...candidates].join(', ')})`);
}

/* ------------------------------- vendoring -------------------------------- */

function parseArgs(argv) {
  const args = {verify: false, source: DEFAULT_SOURCE};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--verify') args.verify = true;
    else if (argv[i] === '--source') args.source = path.resolve(argv[++i]);
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function gitHead(sourceDir) {
  return execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
}

function readSourceFile(sourceDir, srcRel) {
  return fs.readFileSync(path.join(sourceDir, srcRel), 'utf8');
}

function trace(sourceDir, entries) {
  const seen = new Set();
  const queue = [...entries];
  const unresolved = [];
  while (queue.length) {
    const srcRel = queue.pop();
    if (seen.has(srcRel)) continue;
    const abs = path.join(sourceDir, srcRel);
    if (!fs.existsSync(abs)) {
      unresolved.push({from: '<entry>', spec: srcRel, target: srcRel});
      continue;
    }
    seen.add(srcRel);
    for (const spec of extractSpecifiers(readSourceFile(sourceDir, srcRel))) {
      const r = resolveSpecifier(srcRel, spec);
      if (r.kind === 'local') {
        if (!seen.has(r.target)) queue.push(r.target);
      } else if (r.kind === 'unresolved') {
        unresolved.push({from: srcRel, spec, target: r.target});
      }
    }
  }
  return {reachable: seen, unresolved};
}

function engineSuperset(sourceDir, reachable) {
  const all = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(sourceDir, rel), {withFileTypes: true})) {
      const child = path.posix.join(rel, e.name);
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith('.ts')) all.push(child);
    }
  };
  walk(ENGINE_PREFIX.slice(0, -1));
  return all.filter((f) => !reachable.has(f)).sort();
}

function rewriteRelativeSpecifiers(code, fromOutRel, sourceToOutput, unresolved, fromSrcRel) {
  return code.replace(SPEC_RE, (m, q1, s1, q2, s2) => {
    const q = q1 ?? q2;
    const spec = s1 ?? s2;
    if (typeof spec !== 'string' || !spec.startsWith('.')) return m;
    const r = resolveSpecifier(fromSrcRel, spec);
    if (r.kind !== 'local' || !sourceToOutput.has(r.target)) {
      unresolved.push({from: fromSrcRel, spec, target: r.target ?? r.spec});
      return m;
    }
    const next = relativeImport(fromOutRel, sourceToOutput.get(r.target));
    if (next === spec) return m;
    // The match always ends with: quote + specifier + quote.
    return m.slice(0, m.length - spec.length - 2) + q + next + q;
  });
}

async function vendor(args) {
  const sourceDir = args.source;
  if (!fs.existsSync(path.join(sourceDir, 'src/engine/types.ts'))) {
    throw new Error(`source does not look like Point-Cloud-Demo: ${sourceDir}`);
  }
  const sha = gitHead(sourceDir);
  const {esbuild, where: esbuildWhere} = loadEsbuild();
  console.log(`vendoring expressions engine`);
  console.log(`  source : ${sourceDir}`);
  console.log(`  head   : ${sha}`);
  console.log(`  esbuild: ${esbuildWhere}`);

  const {reachable, unresolved} = trace(sourceDir, ENTRIES);
  const superset = engineSuperset(sourceDir, reachable);
  const allFiles = [...reachable, ...superset].sort();

  // Map every source file to its flattened output path up front.
  const sourceToOutput = new Map();
  for (const srcRel of allFiles) sourceToOutput.set(srcRel, outputFor(srcRel));

  const filesMap = {}; // output-relative .mjs -> source-relative .ts
  const outputs = new Map(); // output-relative -> transformed code
  for (const srcRel of allFiles) {
    const outRel = sourceToOutput.get(srcRel);
    const raw = readSourceFile(sourceDir, srcRel);
    const transformed = await esbuild.transform(raw, {loader: 'ts', format: 'esm', target: 'esnext'});
    const rewritten = rewriteRelativeSpecifiers(transformed.code, outRel, sourceToOutput, unresolved, srcRel);
    outputs.set(outRel, rewritten);
    filesMap[outRel] = srcRel;
  }

  if (unresolved.length) {
    console.error('\nUNRESOLVED local import specifiers (fix the tracer, do not ship):');
    for (const u of unresolved) console.error(`  ${u.from}: '${u.spec}' -> ${u.target}`);
    process.exit(1);
  }

  // Rewrite the engine/ and shell/ subtrees wholesale so re-runs cannot leave
  // stale files behind (timestamp in PROVENANCE.json is the only allowed drift).
  for (const sub of ['engine', 'shell']) {
    fs.rmSync(path.join(OUT_ROOT, sub), {recursive: true, force: true});
  }
  for (const [outRel, code] of [...outputs].sort()) {
    const abs = path.join(OUT_ROOT, outRel);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, code);
  }

  const provenance = {
    source: 'EpiLogos/Point-Cloud-Demo',
    sha,
    vendored_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    entries: ENTRIES.map((srcRel) => ({source: srcRel, output: outputFor(srcRel)})),
    files: Object.fromEntries(Object.entries(filesMap).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  fs.writeFileSync(path.join(OUT_ROOT, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');

  console.log(`\nfiles written: ${outputs.size} modules + PROVENANCE.json`);
  console.log('entry outputs:');
  for (const e of provenance.entries) console.log(`  ${e.source} -> ${e.output}`);
  if (superset.length) {
    console.log(`engine files included via src/engine superset (unreachable from entries): ${superset.length}`);
    for (const f of superset) console.log(`  ${f}`);
  } else {
    console.log('engine files included via src/engine superset: 0');
  }
  console.log('unresolved specifiers: 0');
}

/* --------------------------------- verify --------------------------------- */

async function verify() {
  const {esbuild, where: esbuildWhere} = loadEsbuild();
  const provPath = path.join(OUT_ROOT, 'PROVENANCE.json');
  const provenance = JSON.parse(fs.readFileSync(provPath, 'utf8'));
  const known = new Set(Object.keys(provenance.files));
  const errors = [];
  let checked = 0;

  for (const outRel of [...known].sort()) {
    const abs = path.join(OUT_ROOT, outRel);
    if (!fs.existsSync(abs)) { errors.push(`${outRel}: listed in PROVENANCE but missing on disk`); continue; }
    const code = fs.readFileSync(abs, 'utf8');
    // Parse-check: re-transforming valid ESM must succeed.
    try {
      await esbuild.transform(code, {loader: 'js', format: 'esm', target: 'esnext'});
    } catch (err) {
      errors.push(`${outRel}: parse error: ${String(err && err.errors ? JSON.stringify(err.errors) : err)}`);
      continue;
    }
    for (const spec of extractSpecifiers(code)) {
      if (!spec.startsWith('.')) continue; // bare (e.g. three) or absolute — out of scope
      if (!spec.endsWith('.mjs')) { errors.push(`${outRel}: relative specifier does not end in .mjs: '${spec}'`); continue; }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(outRel), spec));
      if (!known.has(target)) errors.push(`${outRel}: '${spec}' -> ${target}: not in output tree`);
    }
    checked++;
  }
  // Output tree must not contain module files outside the provenance manifest.
  const walkOut = (rel) => {
    for (const e of fs.readdirSync(path.join(OUT_ROOT, rel), {withFileTypes: true})) {
      const child = path.posix.join(rel, e.name);
      if (e.isDirectory()) walkOut(child);
      else if (e.name.endsWith('.mjs') && !known.has(child)) errors.push(`${child}: on disk but not in PROVENANCE.json`);
    }
  };
  if (fs.existsSync(path.join(OUT_ROOT, 'engine'))) walkOut('engine');
  if (fs.existsSync(path.join(OUT_ROOT, 'shell'))) walkOut('shell');

  console.log(`verify: esbuild ${esbuildWhere}`);
  console.log(`verify: ${checked}/${known.size} modules parse-checked, all relative .mjs specifiers resolved`);
  if (errors.length) {
    console.error('\nVERIFY FAILURES:');
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('verify: OK (0 errors)');
}

/* ---------------------------------- main ---------------------------------- */

const args = parseArgs(process.argv.slice(2));
if (args.verify) await verify();
else await vendor(args);
