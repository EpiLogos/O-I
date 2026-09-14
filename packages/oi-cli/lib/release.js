const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPOSITORY = 'EpiLogos/O-I';
const NATIVE_VERSION = '0.1.0';
const MAX_REDIRECTS = 8;

function resolveTarget(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-apple-darwin';
  if (platform === 'linux' && arch === 'x64') return 'x86_64-unknown-linux-gnu';
  throw new Error(
    `@epi-logos/oi does not yet provide a prebuilt binary for ${platform}/${arch}. ` +
      'The current prebuilt channel supports Apple Silicon macOS and x64 Linux; use the source install on another platform.'
  );
}

function selectedReleaseTag(env = process.env) {
  const tag = String(env.OI_NPM_RELEASE_TAG || '').trim();
  if (!tag) {
    throw new Error(
      'no O:I GitHub release is selected; set OI_NPM_RELEASE_TAG explicitly when exercising the GitHub Release download channel'
    );
  }
  return tag;
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
  NATIVE_VERSION,
  REPOSITORY,
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
