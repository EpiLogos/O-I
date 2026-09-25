/** M2′ Relation Field — pure layout/filter proof (no DOM, no native fixture).
 * Loads `../src/relationFieldView.tsx` and its m0m5 model dependencies
 * (`src/techne/m0m5/timeline/{relations,lanes,standing}.ts`) through the same
 * esbuild-in-tmp pattern `research-instruments-native.test.mjs` uses to cross
 * the field-studies-journeys ↔ desktop/cradle/src boundary, bundled as plain
 * ESM so `node --test` can run it directly (no native artifact required —
 * every reading here is a synthetic `TechneReading` literal).
 *
 * Covers: projection selection, the Undated lane, that no date is ever
 * invented, that owner-supplied standing rides through unaltered, that two
 * native relations sharing endpoints stay distinct entries, and that a dense
 * (≥60-member) field lays out with bounded, finite lanes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-relation-field-'));
 try{
  const out=join(temporary,'relation-field-adapters.mjs');
  await build({
   stdin:{
    contents:`export * from './src/relationFieldView.tsx';export {relationField,edgesForProjection,projectionAvailability,arcLayout} from '../../src/techne/m0m5/timeline/relations';`,
    resolveDir:engine,
   },
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
   loader:{'.css':'empty'},
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTRACT='ql.techne/v1';

function reading({relations=[],temporal=[]}={}){
 return {
  contract:CONTRACT,
  reading_ref:'reading:test',
  subject:{subject_ref:'subject:test',native_owner:'oi'},
  whole:{whole_ref:'whole:test',relations},
  temporal,
  disclosure:{instruments:[]},
 };
}

// ---------------------------------------------------------------------------
// Projection selection
// ---------------------------------------------------------------------------

test('projection selection: each family shows exactly its own relation types, never silently reclassified',async()=>{
 const r=reading({relations:[
  {relation:'CAUSES',from_ref:'a',to_ref:'b',relation_ref:'rel:causes'},
  {relation:'ECHOES',from_ref:'b',to_ref:'c',relation_ref:'rel:echoes'},
  {relation:'OPPOSES',from_ref:'c',to_ref:'d',relation_ref:'rel:opposes'},
  {relation:'MENTIONS',from_ref:'d',to_ref:'e',relation_ref:'rel:mentions'}, // unrecognised — field only
 ]});
 const field=api.relationField(r);
 assert.equal(field.edges.length,4);
 assert.deepEqual(field.unclassified_relations,['MENTIONS']);

 const cause=api.arcLayoutForMode(field,'cause',600);
 assert.deepEqual(cause.edges.map(e=>e.relation),['CAUSES']);
 const echo=api.arcLayoutForMode(field,'echo',600);
 assert.deepEqual(echo.edges.map(e=>e.relation),['ECHOES']);
 const opposition=api.arcLayoutForMode(field,'opposition',600);
 assert.deepEqual(opposition.edges.map(e=>e.relation),['OPPOSES']);
 const all=api.arcLayoutForMode(field,'relations',600);
 assert.equal(all.edges.length,4);
 // MENTIONS never silently joins a family projection.
 for(const layout of [cause,echo,opposition])assert.ok(!layout.edges.some(e=>e.relation==='MENTIONS'));
});

// ---------------------------------------------------------------------------
// Undated lane
// ---------------------------------------------------------------------------

test('undated members land in the Undated lane rather than disappearing, and no date is invented for them',async()=>{
 const r=reading({
  relations:[
   {relation:'CAUSES',from_ref:'dated-a',to_ref:'dated-b',relation_ref:'rel:1',temporal_facet_ref:'facet:1'},
   {relation:'CAUSES',from_ref:'undated-a',to_ref:'undated-b',relation_ref:'rel:2'}, // no temporal_facet_ref at all
  ],
  temporal:[{facet_ref:'facet:1',kind:'occurrence',instant:'2020-01-01T00:00:00Z'}],
 });
 const field=api.relationField(r);
 const dated=api.datedParticipants(field);
 assert.deepEqual([...dated].sort(),['dated-a','dated-b']);

 const layout=api.arcLayoutForMode(field,'relations',600);
 assert.equal(layout.nodes.length,4,'every participant is present — none dropped for lacking a date');
 const laneOf=(ref)=>layout.nodes.find(n=>n.ref===ref).lane;
 assert.equal(laneOf('dated-a'),'dated');
 assert.equal(laneOf('dated-b'),'dated');
 assert.equal(laneOf('undated-a'),'undated');
 assert.equal(laneOf('undated-b'),'undated');

 // The undated edge's own temporal reading stays honestly trans-temporal —
 // never given a fromMs/toMs it was not disclosed.
 const undatedEdge=layout.edges.find(e=>e.relation==='CAUSES'&&e.from_ref==='undated-a');
 assert.equal(undatedEdge.temporal.state,'trans-temporal');
 assert.equal(undatedEdge.temporal.fromMs,null);
 assert.equal(undatedEdge.temporal.toMs,null);
});

test('an unresolved temporal_facet_ref is reported, never silently dated and never silently dropped',async()=>{
 const r=reading({relations:[{relation:'CAUSES',from_ref:'x',to_ref:'y',relation_ref:'rel:1',temporal_facet_ref:'facet:missing'}]});
 const field=api.relationField(r);
 const edge=field.edges[0];
 assert.equal(edge.temporal.state,'unresolved');
 assert.ok(edge.temporal.problem);
 assert.deepEqual(api.datedParticipants(field),new Set()); // unresolved is not dated
 const layout=api.arcLayoutForMode(field,'relations',600);
 assert.equal(layout.edges.length,1,'the edge is still shown, not dropped for an unresolved date');
 assert.equal(layout.nodes.find(n=>n.ref==='x').lane,'undated');
});

// ---------------------------------------------------------------------------
// Standing preserved
// ---------------------------------------------------------------------------

test('owner-supplied standing rides through the projection and the presentation-only filter unaltered',async()=>{
 const r=reading({relations:[
  {relation:'CAUSES',from_ref:'a',to_ref:'b',relation_ref:'rel:sourced',source_ref:'central:note',standing:'reported by the primary account'},
  {relation:'CAUSES',from_ref:'c',to_ref:'d',relation_ref:'rel:disputed',standing:'disputed by a later source'},
  {relation:'CAUSES',from_ref:'e',to_ref:'f',relation_ref:'rel:bare'}, // nothing disclosed
 ]});
 const field=api.relationField(r);
 const sourced=field.edges.find(e=>e.id==='rel:sourced');
 assert.equal(sourced.standing_visual,'sourced');
 assert.equal(sourced.standing_verbatim,'reported by the primary account');
 const disputed=field.edges.find(e=>e.id==='rel:disputed');
 assert.equal(disputed.standing_visual,'disputed');
 const bare=field.edges.find(e=>e.id==='rel:bare');
 assert.equal(bare.standing_visual,'unavailable');
 assert.equal(bare.standing_verbatim,null);

 // Filtering by standing hides edges outside the set; it never rewrites the
 // standing of the edges it keeps.
 const onlySourced=api.filterEdgesByStanding(field.edges,new Set(['sourced']));
 assert.deepEqual(onlySourced.map(e=>e.id),['rel:sourced']);
 assert.equal(onlySourced[0].standing_verbatim,'reported by the primary account');
 // An empty filter set means "no filter" — nothing is hidden by default.
 assert.equal(api.filterEdgesByStanding(field.edges,new Set()).length,3);
});

// ---------------------------------------------------------------------------
// Same-endpoint distinct relations stay distinct
// ---------------------------------------------------------------------------

test('two native relations sharing endpoints stay two distinct entries, never deduplicated',async()=>{
 const r=reading({relations:[
  {relation:'CAUSES',from_ref:'a',to_ref:'b',relation_ref:'rel:first'},
  {relation:'INFLUENCES',from_ref:'a',to_ref:'b',relation_ref:'rel:second'}, // same endpoints, different type
 ]});
 const field=api.relationField(r);
 assert.equal(field.edges.length,2);
 assert.notEqual(field.edges[0].id,field.edges[1].id);
 const layout=api.arcLayoutForMode(field,'cause',600);
 assert.equal(layout.edges.length,2,'both CAUSES-family relations are drawn, not collapsed into one arc');
 assert.equal(layout.arcs.length,2);
 assert.deepEqual(new Set(layout.edges.map(e=>e.id)),new Set(['rel:first','rel:second']));
 // Exactly one participant pair, but two distinct relation identities.
 assert.deepEqual(layout.nodes.map(n=>n.ref).sort(),['a','b']);
});

// ---------------------------------------------------------------------------
// Dense corpus — bounded lanes
// ---------------------------------------------------------------------------

test('a dense corpus (≥60 members, mixed dated/undated, overlapping ranges) lays out with bounded lanes',async()=>{
 const memberCount=64;
 const members=Array.from({length:memberCount},(_,i)=>`m${i}`);
 const relations=[];
 const temporal=[];
 // Disjoint pairs (m0-m1, m2-m3, …) so "dated" and "undated" segregate
 // cleanly instead of bleeding across a shared chain node.
 for(let i=0;i<memberCount/2;i++){
  const dated=i%2===0;
  const facetRef=dated?`facet:${i}`:undefined;
  relations.push({relation:i%3===0?'CAUSES':i%3===1?'ECHOES':'OPPOSES',from_ref:members[i*2],to_ref:members[i*2+1],relation_ref:`rel:${i}`,temporal_facet_ref:facetRef});
  if(dated){
   // Overlapping ranges: every dated facet spans the same broad interval.
   temporal.push({facet_ref:facetRef,kind:'occurrence',interval:{from:'2020-01-01T00:00:00Z',to:'2020-06-01T00:00:00Z'},precision:'day'});
  }
 }
 const r=reading({relations,temporal});
 const field=api.relationField(r);
 assert.equal(field.edges.length,memberCount/2);

 for(const mode of ['relations','cause','echo','opposition']){
  const layout=api.arcLayoutForMode(field,mode,900);
  // Bounded: every node's x sits within the layout width, every lane is one
  // of exactly two values, and the arc count matches the drawn edge count —
  // this does not grow unbounded or leave a member unpositioned.
  for(const node of layout.nodes){
   assert.ok(node.x>=0&&node.x<=900,`node ${node.ref} x=${node.x} is within the layout width`);
   assert.ok(node.lane==='dated'||node.lane==='undated');
  }
  assert.equal(layout.arcs.length,layout.edges.length);
  assert.equal(new Set(layout.nodes.map(n=>n.ref)).size,layout.nodes.length,'no participant duplicated in the layout');
 }

 const dated=api.datedParticipants(field);
 assert.ok(dated.size>0&&dated.size<memberCount,'the corpus is honestly mixed, not all-dated or all-undated');

 // The phase/cycle and activity projections stay honest and bounded over the
 // same dense field even though this corpus discloses no validity facets.
 const phase=api.phaseLayout(r,field);
 assert.deepEqual(phase.bands,[],'no kind:"valid" facets were disclosed — no phase band is fabricated');
 assert.ok(Array.isArray(phase.cycles));
});
