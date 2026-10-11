import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const vendor = root + 'desktop/cradle/expressions-app/vendor/research-canvas/';
const dependency = createRequire(import.meta.url);
const {build: bundleWorker} = dependency(root + 'desktop/cradle/node_modules/esbuild/lib/main.js');
const workerImport = 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
const workerModule = '\0oi-instrument-editor-maplibre-worker';
const aliases = ['schema', 'domain', 'desktop-api', 'geography', 'viewers', 'node-document']
  .map(name => ({find: '@research-canvas/' + name, replacement: vendor + 'packages/' + name + '/src/index.ts'}));
aliases.push({find: '@research-canvas/exporter', replacement: vendor + 'browserExporter.ts'});
for (const name of ['d3-force', 'd3-selection', 'd3-zoom']) {
  aliases.push({find: name, replacement: dependency.resolve(name, {
    paths: [root + 'desktop/cradle', root + 'desktop/cradle/expressions-app', root + 'packages/live-shell/ui'],
  })});
}
// Match the main package only: a prefix alias would rewrite the worker import
// before this plugin can bundle its shared dependencies.
aliases.push({find: /^maplibre-gl$/, replacement: root + 'desktop/cradle/expressions-app/node_modules/maplibre-gl'});

function hasAlias(config, name) {
  const entries = Array.isArray(config.resolve?.alias)
    ? config.resolve.alias
    : Object.entries(config.resolve?.alias ?? {}).map(([find, replacement]) => ({find, replacement}));
  return entries.some(({find}) => {
    if (typeof find === 'string') return name === find || name.startsWith(find + '/');
    find.lastIndex = 0;
    return find.test(name);
  });
}

/** Adopt the existing native editors without replacing the receiving host's
 * React runtime. A standalone component build supplies its explicit runtime
 * root; a shell uses its own root or already-declared canonical aliases. */
export function instrumentEditorBundler({reactRoot} = {}) {
  return {
    name: 'oi-instrument-editor-native-reuse',
    enforce: 'pre',
    config(config) {
      const receivingRoot = resolve(reactRoot ?? config.root ?? process.cwd());
      const receivingAliases = [...aliases];
      for (const name of ['react', 'react-dom']) {
        if (!hasAlias(config, name)) {
          receivingAliases.push({find: name, replacement: dirname(dependency.resolve(name + '/package.json', {paths: [receivingRoot]}))});
        }
      }
      if (!hasAlias(config, '@tauri-apps/api')) {
        receivingAliases.push({find: '@tauri-apps/api', replacement: root + 'desktop/cradle/node_modules/@tauri-apps/api'});
      }
      return {
        resolve: {alias: receivingAliases, dedupe: ['react', 'react-dom']},
        optimizeDeps: {exclude: ['maplibre-gl', workerImport]},
      };
    },
    resolveId(id) { return id === workerImport ? workerModule : undefined; },
    async load(id) {
      if (id !== workerModule) return;
      // Same complete offline worker recipe as native Expressions. The URL
      // belongs to the receiver document's lifetime, including its MapLibre views.
      const result = await bundleWorker({
        entryPoints: [root + 'desktop/cradle/expressions-app/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'],
        bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', minify: true,
      });
      return `export default URL.createObjectURL(new Blob([${JSON.stringify(result.outputFiles[0].text)}],{type:'text/javascript'}));`;
    },
  };
}
