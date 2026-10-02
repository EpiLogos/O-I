#!/usr/bin/env node
/**
 * Build the self-contained SharedField client an installed desktop carries.
 *
 *   node shared-field/spacetimedb/build-client.mjs [--out DIR]
 *
 * The desktop kernel speaks one protocol to the O:I-owned SharedField client
 * (field.ts, see field.sh) and to the A2A owner floor (a2a-runner.mjs). In a
 * source checkout those run through tsx and the repository's node_modules; an
 * installed application has neither. This bundles the doorways and producer into single
 * ESM files with their dependencies, copies the non-secret hosting.json the
 * client resolves targets from, and writes a POSIX launcher that finds a node
 * runtime. Output (default shared-field/dist-client/):
 *
 *   field-client.mjs     field.ts + field-lib + SDK, one file
 *   a2a-runner.mjs       the A2A owner floor doorway, one file
 *   field-lib.mjs        the caller-visible subscription owner, one file
 *   expression-producer.mjs  native socket/Act reader with reconnect
 *   hosting.json         copy of spacetimedb/hosting.json
 *   field-client.sh      launcher: OI_NODE, PATH, then well-known node homes
 *   CLIENT.json          what was bundled, from which source revision
 *
 * Tauri ships the directory as the app resource `shared-field/`.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outFlag = process.argv.indexOf('--out');
const out = resolve(outFlag > 0 ? process.argv[outFlag + 1] : join(here, '..', 'dist-client'));

// The directory itself stays (it is a declared Tauri resource and carries a
// tracked README); only this builder's own outputs are replaced.
mkdirSync(out, { recursive: true });
const builtFiles=['field-client.mjs','a2a-runner.mjs','field-lib.mjs','expression-producer.mjs','direct-expression-producer.mjs','hosting.json','field-client.sh'];
for (const name of [...builtFiles,'CLIENT.json']) rmSync(join(out, name), { force: true });

// Bundled output keeps `import.meta.url` pointing at the bundle's own
// directory, so field-lib's `here` resolves hosting.json beside it.
const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  splitting: false,
  legalComments: 'none',
  logLevel: 'warning',
  // Some SDK dependencies are CommonJS and call require(); give the ESM
  // bundle a real require for node builtins.
  banner: { js: "import { createRequire as __oiCreateRequire } from 'node:module'; const require = __oiCreateRequire(import.meta.url);" },
};
await build({ ...common, entryPoints: [join(here, 'field.ts')], outfile: join(out, 'field-client.mjs') });
await build({ ...common, entryPoints: [join(here, '..', 'a2a-runner.mjs')], outfile: join(out, 'a2a-runner.mjs') });
await build({ ...common, entryPoints: [join(here, 'field-lib.ts')], outfile: join(out, 'field-lib.mjs') });
await build({ ...common, entryPoints: [join(here, '..', 'scripts', 'expression-activity-producer.mjs')], outfile: join(out, 'expression-producer.mjs') });
await build({ ...common, entryPoints: [join(here, '..', 'scripts', 'direct-expression-activity-producer.mts')], outfile: join(out, 'direct-expression-producer.mjs') });
copyFileSync(join(here, 'hosting.json'), join(out, 'hosting.json'));

const launcher = `#!/bin/sh
# The installed desktop's SharedField client doorway (built by
# shared-field/spacetimedb/build-client.mjs). One JSON request on stdin, one
# envelope on stdout — the same contract as the source checkout's field.sh.
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node="\${OI_NODE:-}"
if [ -z "$node" ]; then
  for candidate in "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node "$HOME/.local/bin/node" "$HOME/.volta/bin/node" "$HOME/.local/share/mise/shims/node" "$HOME/.nix-profile/bin/node"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then node="$candidate"; break; fi
  done
fi
if [ -z "$node" ]; then
  printf '%s\\n' '{"ok":false,"error":{"kind":"unavailable","message":"the SharedField client needs a node runtime (>= 20): none was found on PATH or in the usual homes; set OI_NODE to its path"}}'
  exit 1
fi
exec "$node" "$here/\${OI_SHARED_FIELD_ENTRY:-field-client.mjs}" "$@"
`;
writeFileSync(join(out, 'field-client.sh'), launcher);
chmodSync(join(out, 'field-client.sh'), 0o755);

let sourceRevision = null;
try { sourceRevision = execFileSync('git', ['-C', here, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
let sourceWorkingTreeDirty = null;
try { sourceWorkingTreeDirty = execFileSync('git', ['-C', here, 'status', '--porcelain', '--', '..'], {encoding:'utf8'}).trim().length>0; } catch { /* source standing unavailable */ }
const digest = (name) => `sha256:${createHash('sha256').update(readFileSync(join(out, name))).digest('hex')}`;
writeFileSync(join(out, 'CLIENT.json'), `${JSON.stringify({
  schema: 'oi.shared-field-client-bundle/v1',
  source_revision: sourceRevision,
  source_working_tree_dirty: sourceWorkingTreeDirty,
  entries: { field: 'field-client.mjs', a2a: 'a2a-runner.mjs', library:'field-lib.mjs', expression_producer:'expression-producer.mjs', direct_expression_producer:'direct-expression-producer.mjs' },
  launcher: 'field-client.sh',
  files: Object.fromEntries(builtFiles.map((name) => [name, digest(name)])),
}, null, 2)}\n`);
process.stdout.write(`shared-field client bundled into ${out}\n`);
