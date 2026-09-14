const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const {
  assetName,
  checksumAssetUrl,
  parseChecksum,
  releaseAssetUrl,
  resolveTarget,
  selectedReleaseTag,
} = require('../lib/release');

test('package exposes the native oi command', () => {
  assert.equal(pkg.name, '@epi-logos/oi');
  assert.equal(pkg.bin.oi, 'bin/oi.js');
});

test('supported npm platforms map to real O:I native distribution targets', () => {
  assert.equal(resolveTarget('darwin', 'arm64'), 'aarch64-apple-darwin');
  assert.equal(resolveTarget('linux', 'x64'), 'x86_64-unknown-linux-gnu');
});

test('unsupported platforms fail rather than pretending a binary exists', () => {
  assert.throws(() => resolveTarget('linux', 'arm64'), /does not yet provide a prebuilt binary/);
  assert.throws(() => resolveTarget('win32', 'x64'), /does not yet provide a prebuilt binary/);
});

test('GitHub release download requires an explicitly selected release tag', () => {
  assert.throws(() => selectedReleaseTag({}), /no O:I GitHub release is selected/);
  assert.equal(
    selectedReleaseTag({ OI_NPM_RELEASE_TAG: 'oi-v0.1.0-prelocal.example' }),
    'oi-v0.1.0-prelocal.example'
  );
  assert.throws(
    () => releaseAssetUrl('', 'aarch64-apple-darwin'),
    /requires an explicit GitHub release tag/
  );
});

test('release asset URL uses the explicitly selected tag and native archive name', () => {
  const target = 'aarch64-apple-darwin';
  const tag = 'oi-v0.1.0-prelocal.example';
  assert.equal(assetName(target), 'oi-0.1.0-aarch64-apple-darwin.tar.gz');
  assert.equal(
    releaseAssetUrl(tag, target),
    'https://github.com/EpiLogos/O-I/releases/download/oi-v0.1.0-prelocal.example/oi-0.1.0-aarch64-apple-darwin.tar.gz'
  );
  assert.equal(checksumAssetUrl(tag, target), `${releaseAssetUrl(tag, target)}.sha256`);
});

test('checksum parser accepts standard sha256 sidecars and rejects malformed values', () => {
  const hash = 'a'.repeat(64);
  assert.equal(parseChecksum(`${hash}  oi-0.1.0-aarch64-apple-darwin.tar.gz\n`), hash);
  assert.throws(() => parseChecksum('not-a-checksum'), /not a valid SHA-256/);
});
