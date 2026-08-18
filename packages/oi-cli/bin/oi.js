#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const binary = path.resolve(__dirname, '..', 'vendor', 'oi');
if (!fs.existsSync(binary)) {
  console.error(
    '@epilogos/oi: native oi binary is missing. Reinstall the package with install scripts enabled, or use the documented source install.'
  );
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(`@epilogos/oi: failed to execute native oi: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`@epilogos/oi: native oi terminated by ${result.signal}`);
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
