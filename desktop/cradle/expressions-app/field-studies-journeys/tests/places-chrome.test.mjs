/** Places chrome — lane-4 T3 (return-to-north and globe home), T6 (the globe's
 * atmosphere and limb), T7 (provider disclosure on the surface), T29 (stillness).
 * Pure proof, no DOM, no maplibre, plus source reads of the map's own files.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/{placeNavigation,
 * mapStyle,disclosure}.ts` through the same esbuild-in-tmp pattern as
 * `places-navigation.test.mjs`. The verbatim checks read the owner's own
 * statements (the map's `offlineOnly` doc, the policy's header) from source, so
 * the reasons cannot drift from them unnoticed. The token checks read the
 * design-system's tokens.css through the seat's package link.
 *
 * Covers: the default view and its eased returns; the stillness predicate and
 * the one pulsing marker; the globe-only limb with the flat sky unchanged and
 * colours from the tokens; the attribution line, the imagery readout and each
 * unavailable source's reason verbatim; no frame loop or keyframed animation in
 * the psychogeographic tree.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const cradle=resolve(engine,'../..');
const canvasDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-chrome-'));
 try{
  const out=join(temporary,'places-chrome.mjs');
  const modules=['placeNavigation','mapStyle','disclosure'].map(name=>`export * from ${JSON.stringify(resolve(canvasDir,name+'.ts'))};`).join('\n');
  await build({
   stdin:{contents:modules,resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const read=(file)=>readFileSync(file,'utf8');
const psychogeographicSources=()=>readdirSync(canvasDir)
 .filter(name=>/\.(ts|tsx|css)$/.test(name))
 .map(name=>({name,text:read(resolve(canvasDir,name))}));

// ---------------------------------------------------------------------------
// T3 — return-to-north and globe home
// ---------------------------------------------------------------------------

test('T3: the default view is the globe centred on 20 N, zoom 1, untilted — one source of that state', ()=>{
  const home=api.defaultPlaceView();
  assert.deepEqual(home,{latitude:20,longitude:0,zoom:1,pitch:0,bearing:0});
  // The boot state the surface and the renderer read is this same object's values.
  assert.deepEqual(api.withCameraDefaults({latitude:20,longitude:0,zoom:1}),home);
  const renderer=read(resolve(canvasDir,'renderer.ts'));
  assert.match(renderer,/const home = defaultPlaceView\(\);/);
  assert.doesNotMatch(renderer,/center: \[0, 20\]/);
});

test('T3: globe home restores the exact default state, and that state saves in the legacy untilted shape', ()=>{
  // globe home flies to defaultPlaceView(): a view away from home, reset to home, equals home exactly.
  const home=api.defaultPlaceView();
  const away={latitude:-33.9,longitude:151.2,zoom:7,pitch:55,bearing:120};
  assert.equal(api.defaultPlaceView().latitude,home.latitude);
  assert.deepEqual(api.defaultPlaceView(),home);
  assert.notDeepEqual(api.withCameraDefaults(away),home);
  assert.deepEqual(api.placeRecordFromViewState(home),{x:0,y:20,zoom:1});
});

test('T3: the compass return zeroes bearing and pitch and keeps the place and zoom the reader chose', ()=>{
  const tilted={latitude:48.8566,longitude:2.3522,zoom:9,pitch:60,bearing:-35};
  assert.deepEqual(api.northResetView(tilted),{latitude:48.8566,longitude:2.3522,zoom:9,pitch:0,bearing:0});
  // Idempotent: a north-up, flat view returns itself.
  const once=api.northResetView(tilted);
  assert.deepEqual(api.northResetView(once),once);
  // From the default view the compass return is the default view itself.
  assert.deepEqual(api.northResetView(api.defaultPlaceView()),api.defaultPlaceView());
});

test('T3: both returns are eased and finish on a fixed clock', ()=>{
  assert.ok(Number.isFinite(api.RESET_DURATION_MS) && api.RESET_DURATION_MS > 0);
  assert.equal(api.flightEase(0),0);
  assert.equal(api.flightEase(1),1);
  let last=-Infinity;
  for(let i=0;i<=20;i+=1){const v=api.flightEase(i/20);assert.ok(v>=last-1e-12,'eased curve never runs backwards');last=v;}
});

// ---------------------------------------------------------------------------
// T29 — stillness
// ---------------------------------------------------------------------------

test('T29: an idle globe is still: no flight and no eased motion means no motion', ()=>{
  assert.equal(api.isIdle(api.STILL),true);
  assert.equal(api.isIdle({flight:null,easing:false}),true);
  assert.equal(api.pulseTarget(api.STILL),null);
});

test('T29: a flight or an eased return keeps the surface moving until it ends', ()=>{
  assert.equal(api.isIdle({flight:{graphNodeId:'place-a'},easing:true}),false);
  assert.equal(api.isIdle({flight:null,easing:true}),false,'a compass return is motion');
  assert.equal(api.isIdle({flight:{graphNodeId:null},easing:true}),false,'a lane flight is motion');
});

test('T29: only a place flight pulses, and only its own marker', ()=>{
  assert.equal(api.pulseTarget({flight:{graphNodeId:'place-a'},easing:true}),'place-a');
  assert.equal(api.pulseTarget({flight:null,easing:true}),null,'a compass return pulses nothing');
  assert.equal(api.pulseTarget({flight:{graphNodeId:null},easing:true}),null,'a lane flight pulses nothing');
});

test('T29: the psychogeographic tree has no frame loop, timer loop or keyframed animation of its own', ()=>{
  for(const {name,text} of psychogeographicSources()){
    assert.doesNotMatch(text,/requestAnimationFrame/,`${name} requests animation frames`);
    assert.doesNotMatch(text,/setInterval\(/,`${name} runs an interval`);
    assert.doesNotMatch(text,/@keyframes/,`${name} declares keyframes`);
    assert.doesNotMatch(text,/\banimation\s*:/,`${name} declares a CSS animation`);
  }
});

test('T29: the renderer pulses through a finite Web Animation and cancels it when the flight ends', ()=>{
  const renderer=read(resolve(canvasDir,'renderer.ts'));
  assert.match(renderer,/iterations: Infinity/);
  assert.match(renderer,/pulseAnimation\?\.cancel\(\)/);
  assert.match(renderer,/if \(token === motionToken\) endMotion\(\);/);
  assert.match(renderer,/setTimeout\(\(\) => \{[\s\S]*?\}, durationMs \+ 250\);/,'every motion carries its own clock');
});

// ---------------------------------------------------------------------------
// T6 — the globe's atmosphere and the flat sky
// ---------------------------------------------------------------------------

test('T6: the globe carries a limb atmosphere; its colours come from the design-system tokens', ()=>{
  const sky=api.skyForProjection('globe');
  assert.equal(sky['sky-color'],'#05070f');
  assert.equal(sky['horizon-color'],api.GLOBE_ATMOSPHERE.limb);
  assert.ok(sky['atmosphere-blend']>0 && sky['atmosphere-blend']<=1);
  const tokens=read(resolve(cradle,'node_modules/@epilogos/oi-design-system/tokens.css'));
  const match=/--oi-mark-blue:\s*rgba\((\d+),\s*(\d+),\s*(\d+),/.exec(tokens);
  assert.ok(match,'--oi-mark-blue is declared in the design-system tokens');
  const hex='#'+[match[1],match[2],match[3]].map(n=>Number(n).toString(16).padStart(2,'0')).join('');
  assert.equal(api.GLOBE_ATMOSPHERE.limb,hex,'the limb hue is the token it derives from');
});

test('T6: flat mode keeps the sky it had before the limb: same ground, same horizon blend, no limb', ()=>{
  const flat=api.skyForProjection('flat');
  assert.deepEqual(flat,{'sky-color':'#05070f','sky-horizon-blend':0.4,'atmosphere-blend':0});
  assert.equal('horizon-color' in flat,false);
});

test('T6: the renderer applies the sky per projection, and the globe-only limb is set on the globe', ()=>{
  const renderer=read(resolve(canvasDir,'renderer.ts'));
  assert.match(renderer,/map\.setSky\(skyForProjection\("globe"\) as never\);/);
  assert.match(renderer,/map\.setSky\(skyForProjection\(next\) as never\);/);
  assert.doesNotMatch(renderer,/"sky-color": GLOBE\.space/,'no second copy of the sky literal');
});

// ---------------------------------------------------------------------------
// T7 — provider disclosure on the surface
// ---------------------------------------------------------------------------

test('T7: a hosted surface names its unavailable live tiles with the owner verbatim reason', ()=>{
  const d=api.liveTileDisclosure({offlineOnly:true,hasPolicy:true,optedIn:false,liveSource:null,failure:null});
  assert.equal(d.availability,'producer-unavailable');
  assert.equal(d.reason,api.HOSTED_NETWORK_REASON);
  const owner=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
  assert.ok(owner.includes(api.HOSTED_NETWORK_REASON.replace(/\.$/,'')),'the reason is the map owner\'s own sentence');
});

test('T7: an un-consented live source names the policy statement verbatim; no policy names the absence', ()=>{
  const d=api.liveTileDisclosure({offlineOnly:false,hasPolicy:true,optedIn:false,liveSource:null,failure:null});
  assert.equal(d.reason,api.OPT_IN_REASON);
  // The header wraps the sentence across comment lines; join them before comparing words.
  const policy=read(resolve(engine,'../vendor/research-canvas/packages/geography/src/policy.ts')).replace(/\n\s*\*\s?/g,' ');
  assert.ok(policy.includes(api.OPT_IN_REASON.slice(0,-1)),'the reason is the policy\'s own statement');
  const none=api.liveTileDisclosure({offlineOnly:false,hasPolicy:false,optedIn:false,liveSource:null,failure:null});
  assert.equal(none.reason,api.NO_POLICY_REASON);
});

test('T7: a failed live source shows the failure message verbatim, in the reason slot', ()=>{
  const message='style source rejected by the renderer';
  const d=api.liveTileDisclosure({offlineOnly:false,hasPolicy:true,optedIn:true,liveSource:null,failure:message});
  assert.equal(d.availability,'producer-unavailable');
  assert.equal(d.reason,message);
});

test('T7: a consented, fetched live source names its host and attribution, with no reason', ()=>{
  const live={kind:'raster',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap contributors'};
  const d=api.liveTileDisclosure({offlineOnly:false,hasPolicy:true,optedIn:true,liveSource:live,failure:null});
  assert.equal(d.availability,'disclosed');
  assert.equal(d.reason,null);
  assert.deepEqual(d.disclosed,['fetching from tile.openstreetmap.org','© OpenStreetMap contributors']);
  assert.equal(api.imageryReadout({kind:'geojson',url:'data:application/json,x',attribution:'a'},live),'imagery: live tiles from tile.openstreetmap.org');
});

test('T7: the imagery readout names the bundled offline basemap while no live source is on screen', ()=>{
  const bundled={kind:'geojson',url:'data:application/json,x',attribution:'Pleiades · Wikidata · GeoNames'};
  assert.equal(api.imageryReadout(bundled,null),'imagery: bundled offline basemap (geojson)');
});

test('T7: the attribution line names every provider once, and says so when there is none', ()=>{
  assert.equal(
    api.attributionReadout(['Pleiades (CC BY)',' Pleiades (CC BY) ',undefined,'© OpenStreetMap contributors']),
    'Attribution: Pleiades (CC BY) · © OpenStreetMap contributors',
  );
  assert.equal(api.attributionReadout([null,'  ']),'Attribution: none disclosed for this surface');
});

test('T7: the surface wires the disclosure and the eased returns, with the attribution on screen', ()=>{
  const owner=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
  assert.match(owner,/from "\.\/disclosure"/);
  assert.match(owner,/data-testid="places-attribution"/);
  assert.match(owner,/data-testid="places-imagery-readout"/);
  assert.match(owner,/data-testid="places-live-unavailable"/);
  assert.match(owner,/data-testid="places-compass-reset"/);
  assert.match(owner,/data-testid="places-globe-home"/);
  assert.match(owner,/pulseGraphNodeId: graphNodeId/);
});
