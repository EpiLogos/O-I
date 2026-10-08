/** Focused in-memory bundle only; no application build or generated source. */
import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const entry = new URL('./scene-edits-native-acceptance.mjs', import.meta.url);
const compiled = await build({entryPoints: [fileURLToPath(entry)], bundle: true, write: false,
  platform: 'node', format: 'esm', target: 'es2022', external: ['@tauri-apps/api/*'], logLevel: 'warning', metafile: true});
const sources = {};
for (const path of new Set([...Object.keys(compiled.metafile.inputs).map(path => fileURLToPath(new URL(path, `file://${process.cwd()}/`))),
  fileURLToPath(import.meta.url)])) {
  sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
try {
  const acceptance = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
  await acceptance.runNativeSceneEditAcceptance(sources);
} catch (error) {
  const clean = value => String(value).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, fileURLToPath(entry));
  console.error(JSON.stringify({passed: false, error: clean(error.message),
    stack: clean(error.stack).split('\n').slice(0, 9), source_sha256: sources}, null, 2));
  process.exitCode = 1;
}
