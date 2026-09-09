const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const {
  DEFAULT_RELEASE_TAG,
  NATIVE_VERSION,
  PACKAGE_VERSION,
  SUITE_BUILD_RECORD,
  assetName,
  checksumAssetUrl,
  parseChecksum,
  parseNativeSuiteVersion,
  releaseAssetUrl,
  resolveTarget,
  selectedReleaseTag,
  verifyNativeSuiteVersion,
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

test('every version in the package derives from one source: package.json', () => {
  assert.equal(PACKAGE_VERSION, pkg.version);
  assert.equal(NATIVE_VERSION, pkg.version.split('-')[0]);
  assert.equal(DEFAULT_RELEASE_TAG, `oi-v${pkg.version}`);
  assert.equal(SUITE_BUILD_RECORD, pkg.oi.suite_build_record);
});

test('the six products are declared as not-npm, with the command that installs them', () => {
  const boundary = pkg.oi.products_are_not_npm_packages;
  assert.deepEqual([...boundary.ids].sort(), [
    'actuation',
    'ai-kit',
    'central',
    'quaternal-logic',
    'software-factory',
    'workcell',
  ]);
  assert.equal(boundary.install_command, 'oi install');
  assert.match(boundary.statement, /are not published to npm/);
});

test('the release tag defaults to this package version and stays overridable', () => {
  assert.equal(selectedReleaseTag({}), `oi-v${pkg.version}`);
  assert.equal(
    selectedReleaseTag({ OI_NPM_RELEASE_TAG: 'oi-v0.1.0-prelocal.example' }),
    'oi-v0.1.0-prelocal.example'
  );
  assert.throws(
    () => releaseAssetUrl('', 'aarch64-apple-darwin'),
    /requires an explicit GitHub release tag/
  );
});

test('the installed binary must report the suite build this package declares', () => {
  const good = `oi ${SUITE_BUILD_RECORD} (build 4b7061bed0b256faf12b6d4be83a9e7b401ae607)\nsuite build record ${SUITE_BUILD_RECORD} recorded 2026-08-17 (historical-unratified-prelocal-build-record)\n`;
  const reported = verifyNativeSuiteVersion(good);
  assert.equal(reported.suiteVersion, SUITE_BUILD_RECORD);
  assert.equal(reported.buildRevision, '4b7061bed0b256faf12b6d4be83a9e7b401ae607');

  // A binary from a different suite build is refused by name.
  assert.throws(
    () => verifyNativeSuiteVersion('oi 0.1.0-prelocal.9 (build abc1234)\n'),
    /reports suite build 0\.1\.0-prelocal\.9, but @epi-logos\/oi/
  );

  // The published pre-contract release prints only a crate version. That is a
  // fact about the release, and it fails rather than being assumed compatible.
  assert.equal(parseNativeSuiteVersion('oi 0.1.0\n'), null);
  assert.throws(
    () => verifyNativeSuiteVersion('oi 0.1.0\n'),
    /reports no suite build record/
  );
});

test('release asset URL uses the explicitly selected tag and native archive name', () => {
  const target = 'aarch64-apple-darwin';
  const tag = 'oi-v0.1.0-prelocal.example';
  assert.equal(assetName(target), `oi-${NATIVE_VERSION}-aarch64-apple-darwin.tar.gz`);
  assert.equal(
    releaseAssetUrl(tag, target),
    `https://github.com/EpiLogos/O-I/releases/download/oi-v0.1.0-prelocal.example/oi-${NATIVE_VERSION}-aarch64-apple-darwin.tar.gz`
  );
  assert.equal(checksumAssetUrl(tag, target), `${releaseAssetUrl(tag, target)}.sha256`);
});

test('checksum parser accepts standard sha256 sidecars and rejects malformed values', () => {
  const hash = 'a'.repeat(64);
  assert.equal(parseChecksum(`${hash}  oi-${NATIVE_VERSION}-aarch64-apple-darwin.tar.gz\n`), hash);
  assert.throws(() => parseChecksum('not-a-checksum'), /not a valid SHA-256/);
});
