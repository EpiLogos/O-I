/** Build only this bounded read-only acceptance entry, in memory, using the
 * existing Cradle dependency. No application build or generated files. */
import {build} from '../node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const entry = new URL('./techne-time-axis-native-acceptance.mjs', import.meta.url);
const compiled = await build({entryPoints: [fileURLToPath(entry)], bundle: true, write: false,
  platform: 'node', format: 'esm', target: 'es2022', external: ['@tauri-apps/api/*'], logLevel: 'warning'});
const sources = {};
for (const relative of ['../src/techne/m0m5/timeline/timeAxis.ts', '../src/techne/session.ts', './techne-time-axis-native-acceptance.mjs', './run-techne-time-axis-native.mjs']) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
try {
  const acceptance = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
  await acceptance.runNativeTimeAxisAcceptance(sources);
} catch (error) {
  const clean = value => String(value).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, fileURLToPath(entry));
  console.error(JSON.stringify({passed: false, name: error.name, error: clean(error.message),
    stack: clean(error.stack).split('\n').slice(0, 8), source_sha256: sources}, null, 2));
  process.exitCode = 1;
}
