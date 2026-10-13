/** Places routes, hierarchy and provenance — lane-4 T11 (TRAVELLED_TO routes with
 * numbered stops), T12 (LOCATED_IN hierarchy edges on the globe) and T13
 * (provenance on the selected place). Pure proof, no DOM, no maplibre, plus
 * source reads of the map, renderer and panel.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/{placeRoutes,
 * placeProvenance}.ts` and the cradle authorities they read (world, project,
 * filter) through the same esbuild-in-tmp pattern as `places-layers.test.mjs`.
 * Expected stop order and the authority's note come from `routeModel` itself, so
 * the ordering vocabulary is never re-declared here.
 *
 * Covers: a two-plus-stop movement drawn in validity order with open-bound stops
 * last; fewer than two drawable stops drawing nothing; an unlocated or non-point
 * movement never becoming a stop; the authority's note carried verbatim; the
 * stop's own point (never interpolated); hierarchy edges drawn only between two
 * real positions (a region's centroid, its label anchor); an undrawable endpoint
 * listed with its reason; a non-LOCATED_IN relation listed, not drawn; a filtered
 * parent taking its edge out of view; an expired edge dropped by its own validity;
 * identity untouched throughout; provenance matched to the producer's own selector,
 * "no provenance disclosed" for a facet without one; the panel's open route named
 * honestly; the map and renderer wiring as source reads.
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
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-routes-'));
 try{
  const out=join(temporary,'places-routes.mjs');
  const contents=[
   `export * from ${JSON.stringify(resolve(canvasDir,'placeRoutes.ts'))};`,
   `export * from ${JSON.stringify(resolve(canvasDir,'placeProvenance.ts'))};`,
   `export {routeModel,MOVEMENT_RELATION} from ${JSON.stringify(resolve(cradleSrc,'techne/m0m5/place/world.ts'))};`,
   `export {validInWindow} from ${JSON.stringify(resolve(cradleSrc,'techne/m0m5/place/filter.ts'))};`,
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
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const near=(actual,expected,label)=>{
 assert.ok(Math.abs(actual-expected)<1e-9,`${label}: ${actual} != ${expected}`);
};
const nearLonLat=(actual,expected,label)=>{
 near(actual[0],expected[0],`${label} lon`);
 near(actual[1],expected[1],`${label} lat`);
};

const stop=(placeRef,lon,lat,extra={})=>({
 place_ref:placeRef,
 relation:'TRAVELLED_TO',
 precision:'exact',
 geometry:{type:'point',coordinates:[lon,lat]},
 ...extra,
});
const placed=(placeRef,lon,lat,extra={})=>({
 place_ref:placeRef,
 relation:'OCCURRED_AT',
 precision:'exact',
 geometry:{type:'point',coordinates:[lon,lat]},
 ...extra,
});

// ---------------------------------------------------------------------------
// T11 — routes with numbered stops
// ---------------------------------------------------------------------------

test('a two-plus-stop movement draws in the authority order, open-bound stops last', ()=>{
 const facets=[
  stop('p:c',10,50,{valid_from:'1900'}),
  stop('p:a',-3,40,{valid_from:null}),
  stop('p:b',2,45,{valid_from:'1850'}),
 ];
 const route=api.placeRouteForMap(facets,null);
 assert.ok(route,'three drawable stops draw a route');
 assert.deepEqual(route.stops.map(entry=>entry.place_ref),['p:b','p:c','p:a']);
 assert.deepEqual(route.stops.map(entry=>entry.number),[1,2,3]);
 assert.equal(route.stops[2].ordering_bound,null,'the open-bound stop keeps no invented date');
 assert.equal(route.stops[0].ordering_bound,'1850');
 // The stop's own point, verbatim, never interpolated.
 nearLonLat(route.stops[0].lonLat,[2,45],'first stop');
 nearLonLat(route.stops[2].lonLat,[-3,40],'open-bound stop');
 // The path is dense between stops and starts and ends on the outer stops.
 assert.ok(route.path.length>3,'the path follows the stops along great circles');
 nearLonLat(route.path[0],[2,45],'path start');
 nearLonLat(route.path[route.path.length-1],[-3,40],'path end');
});

test('the authority note is carried verbatim, and no route identity is minted', ()=>{
 const facets=[stop('p:a',0.5,0.5,{valid_from:'1900'}),stop('p:b',1.5,1.5,{valid_from:'1901'})];
 const route=api.placeRouteForMap(facets,null);
 const authority=api.routeModel(facets,null);
 assert.equal(route.note,authority.note);
 assert.match(route.note,/no route identity is minted/);
});

test('fewer than two drawable stops draws nothing', ()=>{
 assert.equal(api.placeRouteForMap([],null),null);
 assert.equal(api.placeRouteForMap([stop('p:a',1,1,{valid_from:'1900'})],null),null,'one stop is no route');
 assert.equal(api.placeRouteForMap([placed('p:a',1,1),placed('p:b',2,2)],null),null,'no movement facets is no route');
});

test('an unlocated stop never draws, and a route of one drawable stop is no route', ()=>{
 const facets=[
  stop('p:a',1,1,{valid_from:'1900'}),
  stop('p:b',2,2,{valid_from:'1901',precision:'unlocated'}),
 ];
 assert.equal(api.placeRouteForMap(facets,null),null,'the unlocated stop leaves one drawable stop');
 const three=[...facets,stop('p:c',3,3,{valid_from:'1902'})];
 const route=api.placeRouteForMap(three,null);
 assert.deepEqual(route.stops.map(entry=>entry.place_ref),['p:a','p:c'],'the unlocated stop stays in the register');
 assert.deepEqual(route.stops.map(entry=>entry.number),[1,2],'numbers count only the stops drawn');
});

test('a movement facet with no point geometry is never a stop', ()=>{
 const facets=[
  stop('p:a',1,1,{valid_from:'1900'}),
  {place_ref:'p:region',relation:'TRAVELLED_TO',precision:'region',geometry:{type:'polygon',coordinates:[[0,0],[4,0],[0,4]]},valid_from:'1901'},
 ];
 assert.equal(api.placeRouteForMap(facets,null),null,'a region is not a route stop');
});

test('non-movement relations never enter the route', ()=>{
 const facets=[
  stop('p:a',1,1,{valid_from:'1900'}),
  stop('p:b',2,2,{valid_from:'1901'}),
  placed('p:x',9,9,{valid_from:'1800'}),
 ];
 const route=api.placeRouteForMap(facets,null);
 assert.deepEqual(route.stops.map(entry=>entry.place_ref),['p:a','p:b']);
});

test('drawing a route leaves the reading and its facet objects as they were', ()=>{
 const facets=[stop('p:c',10,50,{valid_from:'1900'}),stop('p:a',-3,40,{valid_from:null}),stop('p:b',2,45,{valid_from:'1850'})];
 const before=JSON.stringify(facets);
 const members=[...facets];
 api.placeRouteForMap(facets,null);
 assert.equal(JSON.stringify(facets),before,'the facets are read, never rewritten');
 assert.deepEqual(facets,members);
 facets.forEach((facet,index)=>assert.equal(facet,members[index],'the same objects'));
});

// ---------------------------------------------------------------------------
// T12 — LOCATED_IN hierarchy edges on the globe
// ---------------------------------------------------------------------------

test('a child placed in its parent draws one LOCATED_IN edge between the two positions', ()=>{
 const parent=placed('p:parent',5,10);
 const child=placed('p:child',6,11,{hierarchy:[{place_ref:'p:parent',relation:'LOCATED_IN'}]});
 const all=[parent,child];
 const hierarchy=api.placeHierarchy(all,new Set(['p:parent','p:child']),null);
 assert.equal(hierarchy.drawn.length,1);
 assert.equal(hierarchy.undrawn.length,0);
 const [edge]=hierarchy.drawn;
 assert.equal(edge.from_ref,'p:parent');
 assert.equal(edge.to_ref,'p:child');
 assert.equal(edge.relation,'LOCATED_IN');
 nearLonLat(edge.from,[5,10],'parent end');
 nearLonLat(edge.to,[6,11],'child end');
 assert.ok(edge.path.length>2,'the edge is a dense great-circle path');
});

test('a region parent draws from its authority centroid, the anchor its label uses', ()=>{
 const region={place_ref:'p:region',relation:'OCCURRED_AT',precision:'region',geometry:{type:'polygon',coordinates:[[0,0],[10,0],[0,10]]}};
 const child=placed('p:child',2,2,{hierarchy:[{place_ref:'p:region',relation:'LOCATED_IN'}]});
 const hierarchy=api.placeHierarchy([region,child],new Set(['p:region','p:child']),null);
 assert.equal(hierarchy.drawn.length,1);
 nearLonLat(hierarchy.drawn[0].from,[10/3,10/3],'region centroid');
});

test('an endpoint without a position is listed with its reason, never drawn', ()=>{
 const unlocatedParent={place_ref:'p:parent',relation:'OCCURRED_AT',precision:'unlocated'};
 const child=placed('p:child',2,2,{hierarchy:[{place_ref:'p:parent',relation:'LOCATED_IN'}]});
 const hierarchy=api.placeHierarchy([unlocatedParent,child],new Set(['p:parent','p:child']),null);
 assert.equal(hierarchy.drawn.length,0,'no edge is drawn to a register slot');
 assert.equal(hierarchy.undrawn.length,1,'the edge is listed, not hidden');
 assert.match(hierarchy.undrawn[0].reason,/no coordinate to draw from/);
 assert.equal(hierarchy.undrawn[0].from_ref,'p:parent');
});

test('a parent the reading does not disclose is listed as not disclosed', ()=>{
 const child=placed('p:child',2,2,{hierarchy:[{place_ref:'p:ghost',relation:'LOCATED_IN'}]});
 const hierarchy=api.placeHierarchy([child],new Set(['p:child']),null);
 assert.equal(hierarchy.drawn.length,0);
 assert.match(hierarchy.undrawn[0].reason,/is not disclosed in this reading/);
});

test('a relation other than LOCATED_IN is listed, not drawn as a hierarchy edge', ()=>{
 const parent=placed('p:parent',5,10);
 const child=placed('p:child',6,11,{hierarchy:[{place_ref:'p:parent',relation:'PART_OF'}]});
 const hierarchy=api.placeHierarchy([parent,child],new Set(['p:parent','p:child']),null);
 assert.equal(hierarchy.drawn.length,0);
 assert.match(hierarchy.undrawn[0].reason,/only LOCATED_IN is/);
});

test('an expired edge drops by its own validity and touches nothing else', ()=>{
 const parent=placed('p:parent',5,10);
 const child=placed('p:child',6,11,{hierarchy:[{place_ref:'p:parent',relation:'LOCATED_IN',valid_from:'1700',valid_to:'1800'}]});
 const all=[parent,child];
 const before=JSON.stringify(all);
 const window={from:'1900',to:null};
 const hierarchy=api.placeHierarchy(all,new Set(['p:parent','p:child']),window);
 assert.equal(hierarchy.drawn.length,0,'the expired edge is dropped');
 assert.equal(hierarchy.undrawn.length,0,'and not listed as undrawable');
 assert.equal(JSON.stringify(all),before,'identity and the reading are untouched');
 assert.equal(all[1],child);
 // The same edge is drawn when the window reaches its validity.
 const within=api.placeHierarchy(all,new Set(['p:parent','p:child']),{from:'1750',to:null});
 assert.equal(within.drawn.length,1);
});

test('a parent the filter hides takes its edge out of view', ()=>{
 const parent=placed('p:parent',5,10);
 const child=placed('p:child',6,11,{hierarchy:[{place_ref:'p:parent',relation:'LOCATED_IN'}]});
 const hierarchy=api.placeHierarchy([parent,child],new Set(['p:child']),null);
 assert.equal(hierarchy.drawn.length,0);
 assert.equal(hierarchy.undrawn.length,0,'a filtered parent is absent, not undrawable');
});

// ---------------------------------------------------------------------------
// T13 — provenance on every pinned place
// ---------------------------------------------------------------------------

const producerRow=(placeRef,sourceRef,extra={})=>({
 source_ref:sourceRef,
 native_owner:'wiki',
 selector:{unit:'other',kind:'techne-spatial-facet',value:placeRef},
 ...extra,
});

test('a facet is matched to the producer selector recorded for its own place', ()=>{
 const facet={place_ref:'p:a',relation:'OCCURRED_AT',precision:'exact',source_ref:'wiki:src-1',geometry:{type:'point',coordinates:[1,1]}};
 const provenance=[
  producerRow('p:other','wiki:src-1',{source_revision:'r9'}),
  producerRow('p:a','wiki:src-1',{source_revision:'r9',standing:'sourced'}),
 ];
 const result=api.facetProvenance(provenance,facet);
 assert.equal(result.rows.length,1,'only the row for this place');
 assert.equal(result.rows[0].source_ref,'wiki:src-1');
 assert.equal(result.rows[0].source_revision,'r9');
 assert.equal(result.rows[0].native_owner,'wiki');
 assert.equal(result.rows[0].selector,'techne-spatial-facet = p:a');
 assert.equal(result.rows[0].standing,'sourced');
 assert.equal(result.source_ref,'wiki:src-1');
});

test('a row from a different source does not match a facet that names its source', ()=>{
 const facet={place_ref:'p:a',relation:'OCCURRED_AT',precision:'exact',source_ref:'wiki:src-1'};
 const result=api.facetProvenance([producerRow('p:a','wiki:src-2')],facet);
 assert.equal(result.rows.length,0);
});

test('a facet without provenance discloses none, and invents no source', ()=>{
 const facet={place_ref:'p:a',relation:'OCCURRED_AT',precision:'exact',geometry:{type:'point',coordinates:[1,1]}};
 const result=api.facetProvenance(undefined,facet);
 assert.deepEqual(result,{rows:[],source_ref:null});
 const unmatched=api.facetProvenance([producerRow('p:b','wiki:src-1')],facet);
 assert.equal(unmatched.rows.length,0);
 assert.equal(unmatched.source_ref,null);
});

test('a row without a revision reads as absent, not as a revision', ()=>{
 const facet={place_ref:'p:a',relation:'OCCURRED_AT',precision:'exact'};
 const [row]=api.facetProvenance([producerRow('p:a','wiki:src-1')],facet).rows;
 assert.equal(row.source_revision,null);
 assert.equal(row.selector,'techne-spatial-facet = p:a');
});

test('selectors read as sentences for each unit and keep their own detail', ()=>{
 assert.equal(api.selectorText(null),null);
 assert.equal(api.selectorText({unit:'text_span',start:4,end:9}),'characters 4–9');
 assert.equal(api.selectorText({unit:'text_span',start:4,end:9,anchor_ref:'wiki:anchor'}),'characters 4–9 at wiki:anchor');
 assert.equal(api.selectorText({unit:'timestamp_range',from:'1900',to:'1901'}),'1900 – 1901');
 assert.equal(api.selectorText({unit:'image_region',x:1,y:2,width:3,height:4}),'image region 1, 2, 3×4');
 assert.equal(api.selectorText({unit:'other',kind:'k',value:'v'}),'k = v');
});

// ---------------------------------------------------------------------------
// Wiring — the map, the renderer and the panel, as source reads
// ---------------------------------------------------------------------------

test('the map draws the route and the hierarchy through the renderer, and redraws both on projection change', async()=>{
 const map=await readFile(resolve(canvasDir,'PsychogeographicMap.tsx'),'utf8');
 assert.match(map,/drawRoutes\?\.\(route\)/);
 assert.match(map,/drawHierarchy\?\.\(hierarchyEdges\)/);
 assert.match(map,/currentRenderer\.drawRoutes\?\.\(latest\.route\)/,'a projection change redraws the route');
 assert.match(map,/currentRenderer\.drawHierarchy\?\.\(latest\.hierarchyEdges\)/,'and the hierarchy');
});

test('a route stop click is the place click: select, detail and fly', async()=>{
 const renderer=await readFile(resolve(canvasDir,'renderer.ts'),'utf8');
 const stopBlock=renderer.slice(renderer.indexOf('async drawRoutes('),renderer.indexOf('async drawHierarchy('));
 assert.match(stopBlock,/placeClickHandler\?\.\(stop\.place_ref\)/);
 assert.match(stopBlock,/aria-label|setAttribute\("aria-label"/,'each stop names itself');
 assert.match(renderer,/clearRouteStops\(\);\s*map\?\.remove\(\)/,'route stops are cleared on destroy');
});

test('the panel names the open route honestly and carries the note verbatim', async()=>{
 const panel=await readFile(resolve(engine,'src/placeFacetsPanel.tsx'),'utf8');
 assert.match(panel,/no provenance disclosed/);
 assert.match(panel,/no open route/);
 assert.match(panel,/Open source/);
 assert.match(panel,/revision not disclosed/);
 assert.match(panel,/\{route\.note\}/,'the presentation-only note stays verbatim');
 assert.match(panel,/markerStyleForPrecision\(stop\.precision\)\.drawn/,'an unlocated stop never sits on the line');
 assert.match(panel,/Hierarchy not drawn on the globe/);
});
