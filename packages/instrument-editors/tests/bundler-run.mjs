import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../../live-shell/ui/node_modules/vite/dist/node/index.js';
import {instrumentEditorBundler} from '../src/receiving/vite.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('../../../desktop/cradle/node_modules/playwright');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/', import.meta.url));
const result = {schema:'oi.instrument-editor.bundler-conformance/v1', receiver_vite:require('../../live-shell/ui/node_modules/vite/package.json').version, checks:[], errors:[], native_claims:false};
const servers = [];
let browser, page;
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
  for (const receiver of [shell,native]) {
    assert.ok(receiver.config.optimizeDeps.exclude.includes('maplibre-gl'));
    const worker = await receiver.pluginContainer.resolveId('maplibre-gl/dist/maplibre-gl-worker.mjs?url');
    assert.equal(worker.id,'\0oi-instrument-editor-maplibre-worker');
  }
  result.checks.push({name:'complete worker route and optimizer protection',receivers:2});
  const moduleId = '\0oi-maplibre-conformance';
  const source = `import * as maplibre from 'maplibre-gl';
import workerURL from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
maplibre.setWorkerUrl(workerURL); maplibre.setWorkerCount(1);
const point = (coordinates,revision) => ({type:'FeatureCollection',features:[{type:'Feature',id:7,properties:{revision},geometry:{type:'Point',coordinates}}]});
const map = new maplibre.Map({container:'map',center:[0,0],zoom:3,attributionControl:false,style:{version:8,sources:{probe:{type:'geojson',data:point([0,0],1)}},layers:[{id:'background',type:'background',paint:{'background-color':'#101c24'}},{id:'point',type:'circle',source:'probe',paint:{'circle-color':'#d9b675','circle-radius':16}}]}});
window.probe = {map,workerURL,point,errors:[]}; map.on('error',event=>window.probe.errors.push(String(event.error)));`;
  const probePlugin = {name:'real-maplibre-conformance', resolveId(id){if(id==='oi-maplibre-conformance')return moduleId;}, load(id){if(id===moduleId)return source;}, configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>MapLibre worker conformance</title><style>body{margin:0;background:#101c24;color:#d9b675;font:14px sans-serif}h1,p{margin:16px}#map{width:720px;height:460px;position:relative}canvas{position:absolute;inset:0}</style></head><body><h1>MapLibre worker conformance</h1><p>Controlled mathematical GeoJSON. No native place or source claim.</p><div id="map"></div><script type="module" src="/@id/__x00__oi-maplibre-conformance"></script></body></html>');});}};
  const server = await receivingServer({root:root+'packages/live-shell/ui',plugins:[instrumentEditorBundler(),probePlugin],optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:4299,strictPort:true,fs:{allow:[root]}}});
  await server.listen();
  const address=server.httpServer.address();
  browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  page = await browser.newPage({viewport:{width:760,height:570}});
  page.on('pageerror',error=>result.errors.push(String(error)));
  result.console=[];page.on('console',message=>{if(message.type()==='error'||message.type()==='warning')result.console.push({type:message.type(),text:message.text()});});
  const external=[];
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol.startsWith('http')&&url.hostname!=='127.0.0.1'){external.push(url.href);return route.abort();}return route.continue();});
  await page.goto('http://127.0.0.1:'+address.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.probe?.map.queryRenderedFeatures({layers:['point']}).some(f=>f.id===7&&f.properties.revision===1),undefined,{timeout:30000});
  assert.ok(await page.evaluate(()=>window.probe.workerURL.startsWith('blob:')));
  await page.evaluate(()=>{const {map,point}=window.probe;map.getSource('probe').setData(point([20,10],2));map.jumpTo({center:[20,10],zoom:4});document.querySelector('#map').style.width='620px';map.resize();});
  await page.waitForFunction(()=>window.probe.map.queryRenderedFeatures({layers:['point']}).some(f=>f.id===7&&f.properties.revision===2),undefined,{timeout:30000});
  result.worker = await page.evaluate(()=>({url_scheme:window.probe.workerURL.split(':')[0],features:window.probe.map.queryRenderedFeatures({layers:['point']}).map(f=>({id:f.id,properties:f.properties,coordinates:f.geometry.coordinates})),errors:window.probe.errors}));
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.worker.errors,[]);assert.deepEqual(external,[]);
  await page.screenshot({path:evidence+'maplibre-worker-conformance.png'});
  await page.evaluate(()=>window.probe.map.remove());
  result.checks.push({name:'actual offline MapLibre worker',rendered_initial:true,set_data_revision:2,resize:true,removed:true,external_requests:external});
  result.passed=true;
} catch(error) {result.passed=false;result.failure=String(error);result.browser=await page?.evaluate(()=>window.probe?{workerURL:window.probe.workerURL,loaded:window.probe.map.loaded(),styleLoaded:window.probe.map.isStyleLoaded(),sourceLoaded:window.probe.map.isSourceLoaded('probe'),bounds:window.probe.map.getBounds().toArray(),rendered:window.probe.map.queryRenderedFeatures({layers:['point']}).map(f=>({id:f.id,properties:f.properties,geometry:f.geometry})),source:window.probe.map.querySourceFeatures('probe').map(f=>({id:f.id,properties:f.properties,geometry:f.geometry})),errors:window.probe.errors,canvas:{width:window.probe.map.getCanvas().width,height:window.probe.map.getCanvas().height}}:null).catch(cause=>({diagnostic_error:String(cause)}));await page?.screenshot({path:evidence+'maplibre-worker-failure.png'}).catch(()=>{});throw error;}
finally {await browser?.close();await Promise.all(servers.map(server=>server.close()));await writeFile(evidence+'bundler-conformance.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
