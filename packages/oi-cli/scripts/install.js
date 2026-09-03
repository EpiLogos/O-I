#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  NATIVE_VERSION,
  archiveBinaryPath,
  checksumAssetUrl,
  downloadText,
  downloadToFile,
  extractArchive,
  parseChecksum,
  releaseAssetUrl,
  resolveTarget,
  selectedReleaseTag,
  sha256File,
} = require('../lib/release');

async function main() {
  if (process.env.OI_NPM_SKIP_DOWNLOAD === '1') {
    console.warn('@epi-logos/oi: skipping native download because OI_NPM_SKIP_DOWNLOAD=1');
    return;
  }

  const target = resolveTarget();
  const tag = selectedReleaseTag();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oi-npm-'));
  const archive = path.join(temp, 'oi.tar.gz');
  const vendor = path.resolve(__dirname, '..', 'vendor');
  const finalBinary = path.join(vendor, 'oi');
  const stagedBinary = path.join(vendor, '.oi.installing');

  try {
    console.log(`@epi-logos/oi: installing native O:I ${NATIVE_VERSION} for ${target} from explicitly selected release ${tag}`);
    const [checksumText] = await Promise.all([
      downloadText(checksumAssetUrl(tag, target)),
      downloadToFile(releaseAssetUrl(tag, target), archive),
    ]);

    const expected = parseChecksum(checksumText);
    const observed = sha256File(archive);
    if (observed !== expected) {
      throw new Error(`release archive checksum mismatch: expected ${expected}, observed ${observed}`);
    }

    extractArchive(archive, temp);
    const sourceBinary = archiveBinaryPath(temp, target);
    if (!fs.existsSync(sourceBinary)) {
      throw new Error(`release archive did not contain expected native binary: ${sourceBinary}`);
    }

    fs.mkdirSync(vendor, { recursive: true });
    fs.copyFileSync(sourceBinary, stagedBinary);
    fs.chmodSync(stagedBinary, 0o755);
    fs.renameSync(stagedBinary, finalBinary);
    console.log(`@epi-logos/oi: native oi installed (${observed.slice(0, 12)}…)`);
  } finally {
    try { fs.rmSync(stagedBinary, { force: true }); } catch {}
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch {}
  }
}

main().catch((error) => {
  console.error(`@epi-logos/oi install failed: ${error.message}`);
  process.exit(1);
});
