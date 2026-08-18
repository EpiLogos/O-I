const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const {
  DEFAULT_RELEASE_TAG,
  assetName,
  checksumAssetUrl,
  parseChecksum,
  releaseAssetUrl,
  resolveTarget,
} = require('../lib/release');

test('package exposes the native oi command', () => {
  assert.equal(pkg.name, '@epilogos/oi');
  assert.equal(pkg.bin.oi, 'bin/oi.js');
});

test('supported npm platforms map to real O:I native release targets', () => {
  assert.equal(resolveTarget('darwin', 'arm64'), 'aarch64-apple-darwin');
  assert.equal(resolveTarget('linux', 'x64'), 'x86_64-unknown-linux-gnu');
});

test('unsupported platforms fail rather than pretending a binary exists', () => {
  assert.throws(() => resolveTarget('linux', 'arm64'), /does not yet publish a prebuilt binary/);
  assert.throws(() => resolveTarget('win32', 'x64'), /does not yet publish a prebuilt binary/);
});

test('release asset URL is immutable-tag based and names the native archive', () => {
  const target = 'aarch64-apple-darwin';
  assert.equal(assetName(target), 'oi-0.1.0-aarch64-apple-darwin.tar.gz');
  assert.equal(
    releaseAssetUrl(DEFAULT_RELEASE_TAG, target),
    'https://github.com/EpiLogos/O-I/releases/download/oi-v0.1.0-prelocal.3/oi-0.1.0-aarch64-apple-darwin.tar.gz'
  );
  assert.equal(
    checksumAssetUrl(DEFAULT_RELEASE_TAG, target),
    `${releaseAssetUrl(DEFAULT_RELEASE_TAG, target)}.sha256`
  );
});

test('checksum parser accepts standard sha256 sidecars and rejects malformed values', () => {
  const hash = 'a'.repeat(64);
  assert.equal(parseChecksum(`${hash}  oi-0.1.0-aarch64-apple-darwin.tar.gz\n`), hash);
  assert.throws(() => parseChecksum('not-a-checksum'), /not a valid SHA-256/);
});
