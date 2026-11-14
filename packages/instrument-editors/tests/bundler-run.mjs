import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../../live-shell/ui/node_modules/vite/dist/node/index.js';
import {instrumentEditorBundler} from '../src/receiving/vite.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/', import.meta.url));
const result = {schema:'oi.instrument-editor.bundler-conformance/v1', receiver_vite:require('../../live-shell/ui/node_modules/vite/package.json').version, checks:[], errors:[], native_claims:false};
const servers = [];
async function receivingServer(config) {
  const server = await createServer({configFile:false, logLevel:'error', ...config, server:{hmr:false,watch:null,...config.server}});
  servers.push(server);
  return server;
}
try {
  // Resolve through the actual receiving shell's Vite, including imports made
  // by adopted components outside its root. Both apertures need one React.
  const shell = await receivingServer({root:root+'packages/live-shell/ui', plugins:[instrumentEditorBundler()], optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true}});
  for (const name of ['react', 'react/jsx-runtime', 'react-dom/client']) {
    const host = await shell.pluginContainer.resolveId(name, root+'packages/live-shell/ui/src/App.tsx');
    const adopted = await shell.pluginContainer.resolveId(name, root+'desktop/cradle/src/editing/DocumentStore.ts');
    assert.equal(adopted.id, host.id);
    assert.ok(host.id.startsWith(root+'packages/live-shell/ui/node_modules/'));
    result.checks.push({name:'shell singleton '+name, resolved:host.id.slice(root.length)});
  }
  const nativeRoot = root+'desktop/cradle/expressions-app';
  const native = await receivingServer({root:nativeRoot, plugins:[instrumentEditorBundler()], resolve:{alias:{react:nativeRoot+'/node_modules/react','react-dom':nativeRoot+'/node_modules/react-dom'}}, optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true}});
  for (const name of ['react', 'react/jsx-runtime', 'react-dom/client']) {
    const resolved = await native.pluginContainer.resolveId(name, root+'packages/instrument-editors/src/frame/InstrumentFrame.tsx');
    assert.ok(resolved.id.startsWith(nativeRoot+'/node_modules/'));
    result.checks.push({name:'preserved native alias '+name, resolved:resolved.id.slice(root.length)});
  }
  assert.equal(require(nativeRoot+'/node_modules/react/package.json').version.startsWith('19.'), true);
  // This checks alias preservation only; full editor acceptance on React19 is
  // separate from the package's currently supported React18 peer contract.
  // Each research alias the adapter declares names a source that stands, and
  // both receivers resolve it there: the frame's own Canvas and Timeline
  // closure (field-studies-journeys/scripts/build.mjs). The geography package
  // and the MapLibre worker route went with the hosted map (O-I #1009, one
  // earth viewer: Places is the shell's Earth atlas).
  const declared = instrumentEditorBundler().config({root:root+'packages/live-shell/ui'}).resolve.alias
    .filter(({find}) => typeof find === 'string' && find.startsWith('@research-canvas/'));
  assert.ok(declared.length > 0, 'the adapter declares the research aliases');
  for (const {find, replacement} of declared) assert.ok(existsSync(replacement), `${find} names a source on disk (${replacement})`);
  for (const receiver of [shell, native]) {
    for (const {find} of declared) {
      const resolved = await receiver.pluginContainer.resolveId(find, root+'packages/instrument-editors/src/research/ResearchEditor.tsx');
      assert.ok(resolved && existsSync(resolved.id), `${find} resolves to a source on disk (${resolved?.id})`);
    }
  }
  result.checks.push({name:'every research alias names a source that stands, and both receivers resolve it there', receivers:2, aliases:declared.map(({find}) => find)});
  result.passed=true;
} catch(error) {result.passed=false;result.failure=String(error);throw error;}
finally {await Promise.all(servers.map(server=>server.close()));await writeFile(evidence+'bundler-conformance.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
