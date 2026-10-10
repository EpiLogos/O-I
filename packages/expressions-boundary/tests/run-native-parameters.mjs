/** Use the application's existing esbuild dependency for its .js→.ts source
 * resolution. This bundles only the real native parameter acceptance entry. */
import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
const entry = new URL('./parameters-native-acceptance.mjs', import.meta.url);
const output = new URL('../.artifacts/parameters-native.mjs', import.meta.url);
await build({entryPoints: [fileURLToPath(entry)], outfile: fileURLToPath(output),
  bundle: true, platform: 'node', format: 'esm', target: 'es2022',
  external: ['@tauri-apps/api/*'], logLevel: 'warning'});
await import(output.href);
