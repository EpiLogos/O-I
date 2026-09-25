/** The desktop embeds the Expressions application, which keeps its own
 * locked dependency graph (expressions-app/package-lock.json). A cradle-only
 * `npm ci` never installs it, so builds and tests that reach the app failed
 * with missing modules. This installs that graph when it is absent or older
 * than its lockfile and, with --build, builds the app when its dist is absent.
 * Run it from any directory; it never touches the owner's machine state. */
import {execFileSync} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../expressions-app');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const installed = resolve(app, 'node_modules/.package-lock.json');
const lock = resolve(app, 'package-lock.json');

export function ensureExpressionsApp({build = false} = {}) {
  if (!existsSync(installed) || statSync(installed).mtimeMs < statSync(lock).mtimeMs) {
    // An enclosing npm/npx run exports its own npm_config_* (prefix, omit,
    // production …); the embedded app needs its full locked graph, including
    // the type packages its build checks against.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)));
    execFileSync(npm, ['ci', '--include=dev', '--no-audit', '--no-fund'], {cwd: app, stdio: 'inherit', env});
  }
  if (build && !existsSync(resolve(app, 'dist/index.html'))) {
    execFileSync(npm, ['run', 'build'], {cwd: app, stdio: 'inherit', env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)))});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) ensureExpressionsApp({build: process.argv.includes('--build')});
