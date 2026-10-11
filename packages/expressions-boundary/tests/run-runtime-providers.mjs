import assert from 'node:assert/strict';
import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';

const base = new URL('../.artifacts/', import.meta.url), root = new URL('../../../desktop/cradle/node_modules/', import.meta.url);
const options = {bundle: true, platform: 'node', format: 'esm', target: 'es2022', jsx: 'automatic',
  alias: {react: fileURLToPath(new URL('react', root)), 'react-dom': fileURLToPath(new URL('react-dom', root))},
  external: ['@tauri-apps/api/*'], logLevel: 'warning',
  banner: {js: 'import {createRequire} from "node:module"; const require=createRequire(import.meta.url);'}};
const pure = new URL('runtime-port.mjs', base);
const result = await build({...options, entryPoints: [fileURLToPath(new URL('../src/runtime.ts', import.meta.url))],
  outfile: fileURLToPath(pure), metafile: true});
const inputs = Object.keys(result.metafile.inputs);
assert.equal(inputs.some(path => /KernelProvider\.tsx|ExpressionStage\.tsx|ParticleExpression|engineSurface|\.css$/.test(path)), false,
  'Value-only imports cannot pull runtime providers, visual preference effects, engines or CSS');
assert.equal(typeof window, 'undefined'); assert.equal(typeof document, 'undefined');
const imported = await import(pure.href);
assert.equal(typeof imported.KernelApiProvider, 'function');
assert.equal(typeof imported.ExpressionStageApiProvider, 'function');
console.log(JSON.stringify({grade: 'import', passed: 2, faults: 0, claim: 'pure runtime entry imports without window/document or any engine/appearance/provider implementation dependency'}));
const output = new URL('runtime-provider-acceptance.mjs', base);
await build({...options, entryPoints: [fileURLToPath(new URL('./runtime-provider-acceptance.mjs', import.meta.url))],
  outfile: fileURLToPath(output), loader: {'.css': 'empty'}});
await import(output.href);
