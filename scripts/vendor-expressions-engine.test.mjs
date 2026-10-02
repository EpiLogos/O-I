import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = process.env.OI_TEST_ARTIFACTS
  ? path.resolve(process.env.OI_TEST_ARTIFACTS)
  : path.join(root, 'desktop/cradle/tests/artifacts');
const testDirectory = prefix => {
  fs.mkdirSync(artifacts, {recursive: true});
  return fs.mkdtempSync(path.join(artifacts, prefix));
};
const treeHash = (directory, excluded = new Set()) => {
  const hash = createHash('sha256');
  const visit = (dir, relative = '') => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name);
      if (excluded.has(name)) continue;
      if (entry.isDirectory()) visit(path.join(dir, entry.name), name);
      else {
        assert.ok(entry.isFile(), 'the retained source snapshot contains ordinary files');
        hash.update(name).update('\0').update(fs.readFileSync(path.join(dir, entry.name))).update('\0');
      }
    }
  };
  visit(directory);
  return hash.digest('hex');
};

test('the actual full refresh entrypoint refuses before replacing retained native computation or provenance', () => {
  const directory = testDirectory('oi-retained-refresh-');
  try {
    const scripts = path.join(directory, 'scripts');
    fs.mkdirSync(scripts);
    fs.copyFileSync(path.join(root, 'scripts/vendor-expressions-engine.mjs'), path.join(scripts, 'vendor-expressions-engine.mjs'));
    const retained = path.join(directory, 'packages/oi-design-system/expressions-engine');
    fs.cpSync(path.join(root, 'packages/oi-design-system/expressions-engine'), retained, {recursive: true});
    // The real compiler uses the existing installed esbuild. No substitute
    // source, module output or compiler implementation is supplied here.
    const cradle = path.join(directory, 'desktop/cradle');
    fs.mkdirSync(cradle, {recursive: true});
    fs.symlinkSync(path.join(root, 'desktop/cradle/node_modules'), path.join(cradle, 'node_modules'), 'dir');
    const before = treeHash(retained);
    const result = spawnSync(process.execPath, [path.join(scripts, 'vendor-expressions-engine.mjs'), '--source', path.join(root, 'desktop/cradle/expressions-app')], {encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024});
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Full refresh would replace retained native/);
    assert.match(result.stderr, /--refresh-module/);
    assert.equal(treeHash(retained), before, 'all native modules and provenance must survive byte-identically');
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

test('a named native module still compiles and samples the actual image geometry', async () => {
  const directory = testDirectory('oi-native-module-refresh-');
  try {
    const scripts = path.join(directory, 'scripts');
    fs.mkdirSync(scripts);
    fs.copyFileSync(path.join(root, 'scripts/vendor-expressions-engine.mjs'), path.join(scripts, 'vendor-expressions-engine.mjs'));
    const retained = path.join(directory, 'packages/oi-design-system/expressions-engine');
    fs.cpSync(path.join(root, 'packages/oi-design-system/expressions-engine'), retained, {recursive: true});
    const cradle = path.join(directory, 'desktop/cradle');
    fs.mkdirSync(cradle, {recursive: true});
    fs.symlinkSync(path.join(root, 'desktop/cradle/node_modules'), path.join(cradle, 'node_modules'), 'dir');
    const changed = new Set(['engine/sourceSampling.mjs', 'PROVENANCE.json']);
    const beforeModules = treeHash(retained, changed);
    const beforeProvenance = JSON.parse(fs.readFileSync(path.join(retained, 'PROVENANCE.json'), 'utf8'));
    const result = spawnSync(process.execPath, [path.join(scripts, 'vendor-expressions-engine.mjs'), '--source', path.join(root, 'desktop/cradle/expressions-app'), '--refresh-module', 'src/engine/sourceSampling.ts', '--retain-dependencies'], {encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024});
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout.trim());
    assert.deepEqual(report.refreshed, ['engine/sourceSampling.mjs'], 'a named refresh retains the existing dependency outputs');
    assert.equal(treeHash(retained, changed), beforeModules, 'unrelated native modules and O:I overlays must survive byte-identically');
    const {sampleImageSource} = await import(pathToFileURL(path.join(retained, 'engine/sourceSampling.mjs')).href);
    const pixels = new Uint8Array(5 * 5 * 4).fill(255);
    for (let y = 1; y <= 3; y++) {
      const offset = (y * 5 + 2) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
    const sampled = sampleImageSource(pixels, 5, 5, {mode: 'luminance'});
    assert.equal(sampled.analysis.fallback, false);
    assert.equal(sampled.candidates.length, 3);
    assert.deepEqual(sampled.analysis.contentPx, {w: 1, h: 3});
    assert.ok(sampled.candidates.every(point => point.x === 0));
    assert.ok(sampled.candidates[0].y > sampled.candidates[2].y);
    const provenance = JSON.parse(fs.readFileSync(path.join(retained, 'PROVENANCE.json'), 'utf8'));
    const unrelatedProvenance = value => ({
      ...value,
      files: Object.fromEntries(Object.entries(value.files).filter(([output]) => !changed.has(output))),
      module_refreshes: Object.fromEntries(Object.entries(value.module_refreshes ?? {}).filter(([output]) => !changed.has(output))),
    });
    assert.deepEqual(unrelatedProvenance(provenance), unrelatedProvenance(beforeProvenance), 'unrelated owner provenance and compiler receipts must be retained');
    const reading = provenance.module_refreshes['engine/sourceSampling.mjs'];
    assert.equal(reading.source_sha256, createHash('sha256').update(fs.readFileSync(path.join(root, 'desktop/cradle/expressions-app/src/engine/sourceSampling.ts'))).digest('hex'));
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
