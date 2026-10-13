/** Places layers — lane-4 T8 (relation-typed layers with an on-map legend) and
 * T9 (regions drawn as regions). Pure proof, no DOM, no maplibre, plus source
 * reads of the map and renderer.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/placeLayers.ts`
 * and the cradle authorities it reads (world, project, filter, standing, the
 * shared standing drawing) through the same esbuild-in-tmp pattern as
 * `places-navigation.test.mjs`. Expectations read the authorities themselves, so
 * the vocabulary is never re-declared here.
 *
 * Covers: one layer per relation, with the authority's standing class; the
 * standing a layer reads (mythic, sourced only when every facet discloses a
 * source, otherwise unknown) and the shared drawing; a toggle that changes only
 * the presentation filter (the reading and its facet objects stay the same, the
 * window is carried, all-on collapses to open); the panel and the map reading
 * one hidden set; polygon geometry drawn as its region with the authority's ring
 * reader, its label at the centroid, never also as a point; region-precision
 * point geometry staying a point marker; the label resolved in the window.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const canvasDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic');
const cradleSrc=resolve(engine,'../../src');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
let authority;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-layers-'));
 try{
  const out=join(temporary,'places-layers.mjs');
  const contents=[
   `export * from ${JSON.stringify(resolve(canvasDir,'placeLayers.ts'))};`,
   `export {markerStyleForPrecision} from ${JSON.stringify(resolve(canvasDir,'placeNavigation.ts'))};`,
   `export {precisionMarker,projectPlaces} from ${JSON.stringify(resolve(cradleSrc,'techne/m0m5/place/project.ts'))};`,
   `export {placeRelations,relationStandingClass,MYTHIC_RELATION} from ${JSON.stringify(resolve(cradleSrc,'techne/m0m5/place/world.ts'))};`,
   `export {nameInWindow} from ${JSON.stringify(resolve(cradleSrc,'techne/m0m5/place/filter.ts'))};`,
   `export {STANDING_LEGEND} from ${JSON.stringify(resolve(cradleSrc,'techne/m0m5/timeline/standing.ts'))};`,
   `export {STANDING_DRAWING,standingLabel} from ${JSON.stringify(resolve(canvasDir,'../timeline/standingStyle.ts'))};`,
   `export {OPEN_PLACE_FILTER} from ${JSON.stringify(resolve(engine,'src/placeReading.ts'))};`,
  ].join('\n');
  await build({
   stdin:{contents,resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
  authority={
   precisionMarker:api.precisionMarker,
   relationStandingClass:api.relationStandingClass,
   STANDING_LEGEND:api.STANDING_LEGEND,
   markerStyleForPrecision:api.markerStyleForPrecision,
  };
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const UNDISCLOSED='(relation not disclosed)';
const RING=[[10,40],[20,40],[20,50],[10,50]];
const POINT=(lon,lat)=>({type:'point',coordinates:[lon,lat]});

/** A reading's spatial facets covering every layer kind. Fresh objects each call. */
function readingFacets(){
 return [
  {place_ref:'place:rome',relation:'OCCURRED_AT',precision:'exact',geometry:POINT(12.5,41.9),source_ref:'source:livy',identity:{names:[{name:'Roma'}]}},
  {place_ref:'place:capua',relation:'OCCURRED_AT',precision:'approximate',geometry:POINT(14.2,41.1),source_ref:null},
  {place_ref:'place:ithaca',relation:'MYTH_LOCATED_AT',precision:'approximate',geometry:POINT(20.7,38.4)},
  {place_ref:'place:route-a',relation:'TRAVELLED_TO',precision:'exact',geometry:POINT(5,5),valid_from:'0500',valid_to:'0510'},
  {place_ref:'place:undisclosed',relation:null,precision:'unlocated'},
  {place_ref:'place:basin',relation:'LOCATED_IN',precision:'region',geometry:{type:'polygon',coordinates:RING},identity:{names:[{name:'Basin of the test',valid_from:'1000'}]}},
  {place_ref:'place:regional-point',relation:'LOCATED_IN',precision:'region',geometry:POINT(30,30)},
 ];
}

const open=()=>api.OPEN_PLACE_FILTER;
const rel=(value)=>(value===UNDISCLOSED?null:value);

// ---------------------------------------------------------------------------
// T8 — one layer per relation, with the authority's standing class
// ---------------------------------------------------------------------------

test('T8: the layers are the reading\'s relations, in the authority\'s grouping order, with its standing class', ()=>{
  const layers=api.placeLayers(readingFacets());
  assert.deepEqual(
    layers.map((layer)=>[layer.relation,layer.count]),
    [['OCCURRED_AT',2],['MYTH_LOCATED_AT',1],['TRAVELLED_TO',1],[UNDISCLOSED,1],['LOCATED_IN',2]],
  );
  for(const layer of layers){
    assert.equal(layer.standingClass,authority.relationStandingClass(rel(layer.relation)),layer.relation);
  }
  assert.equal(layers.find((layer)=>layer.relation==='MYTH_LOCATED_AT').standingClass,'mythic');
});

test('T8: a layer reads mythic for mythic relations; otherwise sourced only when every facet discloses a source', ()=>{
  const layers=api.placeLayers(readingFacets());
  assert.equal(layers.find((layer)=>layer.relation==='MYTH_LOCATED_AT').visual,'mythic');
  // Rome has a source, Capua does not: the layer is not sourced, and says so.
  assert.equal(layers.find((layer)=>layer.relation==='OCCURRED_AT').visual,'unavailable');
  const sourced=[
   {place_ref:'a',relation:'OCCURRED_AT',precision:'exact',geometry:POINT(1,1),source_ref:'source:x'},
   {place_ref:'b',relation:'OCCURRED_AT',precision:'exact',geometry:POINT(2,2),source_ref:'source:y'},
  ];
  assert.equal(api.placeLayers(sourced)[0].visual,'sourced');
  const blank=[{place_ref:'c',relation:'OCCURRED_AT',precision:'exact',geometry:POINT(3,3),source_ref:'   '}];
  assert.equal(api.placeLayers(blank)[0].visual,'unavailable','a blank source ref is no source');
});

test('T8: standing colours and labels come from the one shared vocabulary the chronology draws with', ()=>{
  for(const layer of api.placeLayers(readingFacets())){
    assert.deepEqual(layer.drawing,api.STANDING_DRAWING[layer.visual],layer.relation);
    assert.ok(authority.STANDING_LEGEND.some((entry)=>entry.visual===layer.visual),`${layer.visual} is a legend class`);
  }
  assert.equal(api.standingLabel('unavailable'),authority.STANDING_LEGEND.find((entry)=>entry.visual==='unavailable').label);
  assert.equal(api.standingLabel('mythic'),'mythic');
});

// ---------------------------------------------------------------------------
// T8 — a toggle changes visibility only, through the one presentation filter
// ---------------------------------------------------------------------------

test('T8: a layer toggle narrows only what is shown; the reading and its facet objects are untouched', ()=>{
  const reading=readingFacets();
  const before=JSON.stringify(reading);
  const layers=api.placeLayers(reading);
  const off=api.toggleLayer(open(),layers,'OCCURRED_AT');
  assert.equal(off.relations.has('OCCURRED_AT'),false);
  assert.equal(off.relations.has('MYTH_LOCATED_AT'),true);
  assert.equal(api.layerVisible(off,layers[0]),false);
  assert.equal(api.layerVisible(off,layers[1]),true);
  const admitted=api.admittedFacets(reading,off);
  assert.ok(admitted.every((facet)=>reading.includes(facet)),'the admitted facets are the reading\'s own objects');
  assert.deepEqual(admitted.map((facet)=>facet.place_ref),reading.filter((facet)=>facet.relation!=='OCCURRED_AT').map((facet)=>facet.place_ref));
  assert.equal(JSON.stringify(reading),before,'toggling never rewrites the reading');
});

test('T8: all layers on again collapses the filter to open, and the toggle keeps the window and the standing set', ()=>{
  const layers=api.placeLayers(readingFacets());
  const off=api.toggleLayer(open(),layers,'OCCURRED_AT');
  assert.equal(api.toggleLayer(off,layers,'OCCURRED_AT').relations,null,'every layer on is the open filter');
  const windowed={...open(),window:{from:'0400',to:'0600'},standing:new Set(['factual'])};
  const toggled=api.toggleLayer(windowed,layers,'LOCATED_IN');
  assert.equal(toggled.window,windowed.window,'the window is carried over');
  assert.equal(toggled.standing,windowed.standing,'the standing set is carried over');
});

test('T8: a layer whose standing the side panel filters off is hidden on the map too', ()=>{
  const layers=api.placeLayers(readingFacets());
  const mythicOff={...open(),standing:new Set(['factual','owner-vocabulary'])};
  assert.equal(api.layerVisible(mythicOff,layers[1]),false,'MYTH_LOCATED_AT is mythic and filtered off');
  assert.equal(api.layerVisible(mythicOff,layers[0]),true);
});

// ---------------------------------------------------------------------------
// T8 — the panel and the map read one hidden set
// ---------------------------------------------------------------------------

test('T8: the places the filter hides are the reading\'s known refs it does not admit, and nothing else', ()=>{
  const reading=readingFacets();
  const layers=api.placeLayers(reading);
  const off=api.toggleLayer(open(),layers,'OCCURRED_AT');
  const hidden=api.placeRefsHidden(reading,off);
  assert.deepEqual([...hidden].sort(),['place:capua','place:rome']);
  assert.equal(api.placeRefsHidden(reading,open()).size,0,'an open filter hides nothing');
  // A ref the reading does not name is never hidden: the filter has nothing to test it against.
  assert.equal(hidden.has('place:not-in-reading'),false);
});

// ---------------------------------------------------------------------------
// T9 — polygon geometry is drawn as its region, never also as a point
// ---------------------------------------------------------------------------

test('T9: a polygon facet is drawn as its polygon, and point facets (even at region precision) are not', ()=>{
  const polygons=api.polygonPlaceRefs(readingFacets());
  assert.deepEqual([...polygons],['place:basin']);
  assert.equal(polygons.has('place:regional-point'),false,'a region with point geometry stays a point marker');
  assert.equal(polygons.has('place:undisclosed'),false,'an unlocated place has no polygon');
});

test('T9: the authority\'s ring reader gives back the polygon\'s own vertices, exact to 1e-9 degrees', ()=>{
  const regions=api.placeRegions(readingFacets());
  assert.equal(regions.length,1, 'only the polygon is a region');
  const basin=regions[0];
  assert.equal(basin.place_ref,'place:basin');
  assert.equal(basin.precision,'region');
  assert.equal(basin.rings.length,1);
  assert.equal(basin.rings[0].length,RING.length);
  RING.forEach(([lon,lat],index)=>{
   assert.ok(Math.abs(basin.rings[0][index][0]-lon)<1e-9,`lon ${index}`);
   assert.ok(Math.abs(basin.rings[0][index][1]-lat)<1e-9,`lat ${index}`);
  });
});

test('T9: a region is labelled at the authority\'s centroid, with its precision note and its layer colour', ()=>{
  const reading=readingFacets();
  const layers=api.placeLayers(reading);
  const basin=api.placeRegions(reading)[0];
  // The vertex mean of this square is (15, 45): the authority's centroid.
  assert.ok(Math.abs(basin.anchor[0]-15)<1e-9 && Math.abs(basin.anchor[1]-45)<1e-9,`anchor ${basin.anchor}`);
  assert.equal(basin.note,authority.precisionMarker('region').note);
  assert.equal(basin.colour,layers.find((layer)=>layer.relation==='LOCATED_IN').drawing.stroke);
  assert.equal(basin.label,'Basin of the test');
});

test('T9: the region keeps the marker grammar\'s outline for point geometry, never a solid fix', ()=>{
  // The authority draws region precision as an outline; the point-geometry facet keeps that rendering.
  assert.equal(authority.markerStyleForPrecision('region').kind,'outline');
  assert.equal(api.placeRegions(readingFacets()).some((region)=>region.place_ref==='place:regional-point'),false);
});

test('T9: a region the filter hides is not drawn; a region the filter keeps is drawn as before', ()=>{
  const reading=readingFacets();
  const layers=api.placeLayers(reading);
  const locatedOff=api.toggleLayer(open(),layers,'LOCATED_IN');
  assert.deepEqual(api.placeRegions(reading,locatedOff),[]);
  assert.equal(api.placeRegions(reading,api.toggleLayer(open(),layers,'OCCURRED_AT')).length,1);
});

test('T9: the region\'s label resolves its identity name in the window, by each name\'s own validity', ()=>{
  const named={place_ref:'place:named',relation:'LOCATED_IN',precision:'region',geometry:{type:'polygon',coordinates:RING},identity:{names:[
   {name:'Early',valid_from:'0500',valid_to:'0900'},
   {name:'Later',valid_from:'1000'},
  ]}};
  assert.equal(api.placeRegions([named],{...open(),window:{from:'1200',to:'1300'}})[0].label,'Later');
  assert.equal(api.placeRegions([named],{...open(),window:{from:'0600',to:'0700'}})[0].label,'Early');
});

// ---------------------------------------------------------------------------
// Source reads: the map draws the layers and regions, and the renderer keeps them apart
// ---------------------------------------------------------------------------

test('T8/T9: the map takes the facets and the one filter, draws the regions, and hides a region\'s point marker', async()=>{
  const owner=await readFile(resolve(canvasDir,'PsychogeographicMap.tsx'),'utf8');
  assert.match(owner,/placeFacets\?: readonly TechnePlaceFacet\[\];/);
  assert.match(owner,/layerFilter\?: PlaceFilterState;/);
  assert.match(owner,/onLayerFilterChange\?: \(next: PlaceFilterState\) => void;/);
  assert.match(owner,/polygonRefs\.has\(node\.graphNodeId\) \|\| hiddenRefs\.has\(node\.graphNodeId\)/,'a region is never also a point marker');
  assert.match(owner,/readyRenderer\.drawRegions\?\.\(regions\)/);
  assert.match(owner,/data-testid="places-layers-panel"/);
  assert.match(owner,/checked=\{layerVisible\(layerState, layer\)\}/);
  assert.match(owner,/onLayerFilterChange\?\.\(toggleLayer\(layerState, layers, layer\.relation\)\)/);
  assert.match(owner,/data-testid="places-legend"/);
});

test('T9: the renderer draws regions as fill and outline with a constant pixel outline, and labels them apart from the points', async()=>{
  const renderer=await readFile(resolve(canvasDir,'renderer.ts'),'utf8');
  assert.match(renderer,/drawRegions\?\(regions: PlaceRegion\[\]\): Promise<void>;/);
  assert.match(renderer,/id: "places-regions-fill",\s*type: "fill"/);
  assert.match(renderer,/id: "places-regions-outline",\s*type: "line"/);
  assert.match(renderer,/"line-width": 2,/,'the outline is a constant pixel width at every zoom');
  // The place points clear their own markers; the region labels are a separate set that a redraw keeps.
  const clear=/function clearHtmlMarkers\(\): void \{[\s\S]*?\n  \}/.exec(renderer);
  assert.ok(clear,'clearHtmlMarkers is declared');
  assert.doesNotMatch(clear[0],/regionLabelMarkers/,'a point redraw does not erase the region labels');
  assert.match(renderer,/clearRegionLabels\(\);\n\s*for \(const region of regions\)/);
});

test('T8: the side panel and the map draw the same layer colours, from one drawing table', async()=>{
  const owner=await readFile(resolve(canvasDir,'PsychogeographicMap.tsx'),'utf8');
  assert.match(owner,/from "\.\.\/timeline\/standingStyle"/);
  assert.doesNotMatch(owner,/stroke:\s*"#/,'no literal standing colour in the map');
  const placeLayers=await readFile(resolve(canvasDir,'placeLayers.ts'),'utf8');
  assert.match(placeLayers,/from "\.\.\/timeline\/standingStyle"/);
  assert.doesNotMatch(placeLayers,/stroke:\s*"#/,'no literal standing colour in the layers');
});
