/** Bundle only this read-only native acceptance entry using the existing app
 * dependency. No broad application build and no generated files are written. */
import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const entry = new URL('./scenes-native-acceptance.mjs', import.meta.url);
const result = await build({entryPoints: [fileURLToPath(entry)], bundle: true, write: false,
  platform: 'node', format: 'esm', target: 'es2022', external: ['@tauri-apps/api/*'], logLevel: 'warning'});
const sources = {};
for (const relative of ['../src/scenes.ts', '../src/scenesValidation.ts', './scenes-native-acceptance.mjs', './run-native-scenes.mjs',
  '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneTransport.ts',
  '../../../desktop/cradle/expressions-app/field-studies-journeys/src/app.ts']) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
try {
  const acceptance = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
  await acceptance.runNativeSceneAcceptance(sources);
} catch (error) {
  // Node includes the full data URL in a stack frame. Preserve the failure
  // location without dumping the bundled source into an acceptance result.
  const clean = value => String(value).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, fileURLToPath(entry));
  console.error(JSON.stringify({passed: false, name: error.name, error: clean(error.message),
    stack: clean(error.stack).split('\n').slice(0, 8), source_sha256: sources}, null, 2));
  process.exitCode = 1;
}
