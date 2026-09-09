const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const pkg = require('../package.json');

const REPOSITORY = 'EpiLogos/O-I';
const MAX_REDIRECTS = 8;

// One source of truth: this package's own version. The release tag and the
// native archive version are derived from it, so they cannot drift apart the
// way a hand-typed second copy did.
const PACKAGE_VERSION = pkg.version;
const NATIVE_VERSION = PACKAGE_VERSION.split('-')[0];
const DEFAULT_RELEASE_TAG = (pkg.oi && pkg.oi.release_tag_pattern
  ? pkg.oi.release_tag_pattern
  : 'oi-v{version}'
).replace('{version}', PACKAGE_VERSION);

// The suite build set the native binary carries. Declared here and checked
// against the installed binary, so "the npm version" and "the suite version it
// installs" are a stated, verified relation rather than two loose numbers.
const SUITE_BUILD_RECORD = (pkg.oi && pkg.oi.suite_build_record) || null;

function resolveTarget(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-apple-darwin';
  if (platform === 'linux' && arch === 'x64') return 'x86_64-unknown-linux-gnu';
  throw new Error(
    `@epi-logos/oi does not yet provide a prebuilt binary for ${platform}/${arch}. ` +
      'The current prebuilt channel supports Apple Silicon macOS and x64 Linux; use the source install on another platform.'
  );
}

function selectedReleaseTag(env = process.env) {
  const override = String(env.OI_NPM_RELEASE_TAG || '').trim();
  if (override) return override;
  if (!DEFAULT_RELEASE_TAG) {
    throw new Error(
      'no O:I GitHub release is selected; set OI_NPM_RELEASE_TAG explicitly when exercising the GitHub Release download channel'
    );
  }
  return DEFAULT_RELEASE_TAG;
}

/// The suite build record an installed `oi` reports. Returns null when the
/// binary predates the version contract and reports no suite build record at
/// all, which is a fact about the release, not something to guess around.
function parseNativeSuiteVersion(versionOutput) {
  const match = String(versionOutput).match(/^\s*oi\s+(\S+)\s+\(build\s+(\S+)\)/m);
  if (!match) return null;
  return { suiteVersion: match[1], buildRevision: match[2] };
}

/// Fail loudly when the binary that was installed is not the one this package
/// says it installs. A mismatch here is exactly the class of drift that let a
/// stale build answer for a fresh one.
function verifyNativeSuiteVersion(versionOutput, expected = SUITE_BUILD_RECORD) {
  const reported = parseNativeSuiteVersion(versionOutput);
  if (!reported) {
    throw new Error(
      `the installed oi binary reports no suite build record (it printed ${JSON.stringify(
        String(versionOutput).trim()
      )}). That release predates the O:I packaging contract; cut ${DEFAULT_RELEASE_TAG} from a source tree that carries it, or select a release that does with OI_NPM_RELEASE_TAG.`
    );
  }
  if (expected && reported.suiteVersion !== expected) {
    throw new Error(
      `installed oi reports suite build ${reported.suiteVersion}, but @epi-logos/oi ${PACKAGE_VERSION} declares ${expected}`
    );
  }
  return reported;
}

function assetName(target, nativeVersion = NATIVE_VERSION) {
  return `oi-${nativeVersion}-${target}.tar.gz`;
}

function releaseAssetUrl(tag, target, nativeVersion = NATIVE_VERSION) {
  const selected = String(tag || '').trim();
  if (!selected) throw new Error('release asset lookup requires an explicit GitHub release tag');
  return `https://github.com/${REPOSITORY}/releases/download/${selected}/${assetName(target, nativeVersion)}`;
}

function checksumAssetUrl(tag, target, nativeVersion = NATIVE_VERSION) {
  return `${releaseAssetUrl(tag, target, nativeVersion)}.sha256`;
}

function parseChecksum(text) {
  const match = String(text).trim().match(/^([a-fA-F0-9]{64})(?:\s+|$)/);
  if (!match) throw new Error('release checksum sidecar is not a valid SHA-256 record');
  return match[1].toLowerCase();
}

function sha256File(file) {
  const hash = createHash('sha256');
  const bytes = fs.readFileSync(file);
  hash.update(bytes);
  return hash.digest('hex');
}

function downloadToFile(url, destination, redirects = 0) {
  if (redirects > MAX_REDIRECTS) {
    return Promise.reject(new Error(`too many redirects while downloading ${url}`));
  }

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { 'User-Agent': '@epi-logos/oi npm installer' } },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          const next = new URL(response.headers.location, url).toString();
          downloadToFile(next, destination, redirects + 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`download failed with HTTP ${status}: ${url}`));
          return;
        }

        const file = fs.createWriteStream(destination, { mode: 0o600 });
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }
    );
    request.on('error', reject);
  });
}

function downloadText(url, redirects = 0) {
  if (redirects > MAX_REDIRECTS) {
    return Promise.reject(new Error(`too many redirects while downloading ${url}`));
  }

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { 'User-Agent': '@epi-logos/oi npm installer' } },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          const next = new URL(response.headers.location, url).toString();
          downloadText(next, redirects + 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`download failed with HTTP ${status}: ${url}`));
          return;
        }
        response.setEncoding('utf8');
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve(body));
        response.on('error', reject);
      }
    );
    request.on('error', reject);
  });
}

function extractArchive(archive, destination) {
  const result = spawnSync('tar', ['-xzf', archive, '-C', destination], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar exited with status ${result.status}`);
}

function archiveBinaryPath(root, target, nativeVersion = NATIVE_VERSION) {
  return path.join(root, `oi-${nativeVersion}-${target}`, 'oi');
}

module.exports = {
  DEFAULT_RELEASE_TAG,
  NATIVE_VERSION,
  PACKAGE_VERSION,
  REPOSITORY,
  SUITE_BUILD_RECORD,
  parseNativeSuiteVersion,
  verifyNativeSuiteVersion,
  archiveBinaryPath,
  assetName,
  checksumAssetUrl,
  downloadText,
  downloadToFile,
  extractArchive,
  parseChecksum,
  releaseAssetUrl,
  resolveTarget,
  selectedReleaseTag,
  sha256File,
};
