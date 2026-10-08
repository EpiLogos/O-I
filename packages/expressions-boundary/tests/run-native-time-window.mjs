/** Compile only this native read-only packet in memory. The source closure
 * is hashed before execution; no application build or generated bundle. */
import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const entry = fileURLToPath(new URL('./time-window-native-acceptance.mjs', import.meta.url));
const result = await build({entryPoints: [entry], bundle: true, write: false, metafile: true,
  platform: 'node', format: 'esm', target: 'es2022', loader: {'.css': 'empty'},
  external: ['@tauri-apps/api/*'], logLevel: 'warning'});
const sources = {};
for (const path of [...Object.keys(result.metafile.inputs).map(path => resolve(path)), fileURLToPath(import.meta.url)])
  sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
try {
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
  await module.runNativeTimeWindowAcceptance(sources);
} catch (error) {
  const clean = value => String(value).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, entry);
  console.error(JSON.stringify({passed: false, name: error.name, error: clean(error.message),
    stack: clean(error.stack).split('\n').slice(0, 8), source_sha256: sources}, null, 2));
  process.exitCode = 1;
}
