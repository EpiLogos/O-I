/** Places ladder — lane-4 T28. The reference-frame ladder (solar → Earth occasion → geography → places/routes → Nara)
 * as one-line rung summaries for the layers panel. Pure proof of the summary mapping (availability and reasons verbatim,
 * never "present" for a rung the reading does not disclose), of the ladder of an empty reading, and of the wiring in the
 * map, the panel home and the host.
 *
 * Loads `desktop/cradle/src/techne/m0m5/place/world.ts` through the esbuild-in-tmp pattern of `places-basemap.test.mjs`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const canvasDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-ladder-'));
 try{
  const out=join(temporary,'places-ladder.mjs');
  await build({
   stdin:{contents:`export * from ${JSON.stringify(resolve(engine,'../../src/techne/m0m5/place/world.ts'))};`,resolveDir:engine},
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
const ORDER=['solar-planetary','earth-occasion','geography','places-routes','nara-situated'];

test('T28: the ladder of no reading names five rungs in order, and none is shown as present', ()=>{
 const summaries=api.ladderRungSummaries(api.referenceFrameLadder(null));
 assert.deepEqual(summaries.map(rung=>rung.rung),ORDER);
 for(const rung of summaries){
  assert.notEqual(rung.status,'present',`${rung.rung} is not present without a reading`);
  assert.ok(rung.reason&&rung.reason.length>0,`${rung.rung} names its reason`);
 }
});

test('T28: an unavailable rung carries the depth chain reason verbatim, not a reason of the panel',()=>{
 const summaries=api.ladderRungSummaries(api.referenceFrameLadder(null));
 const solar=summaries.find(rung=>rung.rung==='solar-planetary');
 const nara=summaries.find(rung=>rung.rung==='nara-situated');
 assert.equal(solar.status,'unavailable');
 assert.equal(solar.reason,api.PRODUCER_UNAVAILABLE_REASONS['m2-planetary']);
 assert.equal(nara.status,'unavailable');
 assert.equal(nara.reason,api.PRODUCER_UNAVAILABLE_REASONS['m4-nara-earthbody']);
 assert.equal(solar.line,'solar / planetary system: unavailable');
});

test('T28: an absent rung says absent and keeps its reason; no facets, no occasion refs, no harmonic reading', ()=>{
 const summaries=api.ladderRungSummaries(api.referenceFrameLadder(null));
 const occasion=summaries.find(rung=>rung.rung==='earth-occasion');
 assert.equal(occasion.status,'absent');
 assert.equal(occasion.reason,'the reading carries no DAY/NOW occasion refs');
 const geography=summaries.find(rung=>rung.rung==='geography');
 assert.equal(geography.status,'absent');
 assert.equal(geography.reason,'no place facets are disclosed for this subject');
});

test('T28: a present rung shows what the reading discloses, and has no reason to open', ()=>{
 const reading={
  reading_ref:'r',
  subject:{subject_ref:'s'},
  spatial:[{place_ref:'place:a',relation:'LOCATED_IN',precision:'exact',geometry:{type:'point',latitude:1,longitude:2}}],
  temporal:[{day_ref:'DAY-2026-10-13',now_ref:'NOW-1'}],
  ql:{harmonic_reading:'harmonic 3'},
  agency:[],
  disclosure:{instruments:[],application_cuts:null},
  actions:[],
 };
 const summaries=api.ladderRungSummaries(api.referenceFrameLadder(reading));
 const occasion=summaries.find(rung=>rung.rung==='earth-occasion');
 assert.equal(occasion.status,'present');
 assert.equal(occasion.reason,null);
 assert.match(occasion.line,/DAY-2026-10-13/);
 const geography=summaries.find(rung=>rung.rung==='geography');
 assert.equal(geography.status,'present');
 assert.match(geography.line,/1 place facet disclosed/);
 // A harmonic reading alone does not make the solar rung present: its availability is the planetary producer's, and that is unavailable.
 const solar=summaries.find(rung=>rung.rung==='solar-planetary');
 assert.equal(solar.status,'unavailable');
 assert.equal(solar.reason,api.PRODUCER_UNAVAILABLE_REASONS['m2-planetary']);
});

test('T28: the summary never turns an unavailable or absent rung into a present one, whatever the labels say', ()=>{
 const summaries=api.ladderRungSummaries([
  {rung:'geography',label:'historical / current geography',availability:'absent-facet',disclosed:['x'],reason:'none here'},
  {rung:'nara-situated',label:'Nara / current situated body',availability:'producer-unavailable',disclosed:[],reason:null},
  {rung:'earth-occasion',label:'Earth / shared world occasion',availability:'disclosed',disclosed:[],reason:null},
 ]);
 assert.equal(summaries[0].status,'absent');
 assert.equal(summaries[0].reason,'none here');
 assert.equal(summaries[1].status,'unavailable');
 assert.equal(summaries[1].reason,'no reason disclosed','a missing reason is named, never invented');
 assert.equal(summaries[2].status,'present');
 assert.equal(summaries[2].line,'Earth / shared world occasion: present');
});

test('T28: the summary is one line per rung and keeps the rung order of the ladder', ()=>{
 const summaries=api.ladderRungSummaries(api.referenceFrameLadder(null));
 for(const rung of summaries){
  assert.ok(!rung.line.includes('\n'),'one line');
  assert.ok(rung.line.startsWith(rung.label),'the line begins with the rung label');
 }
});

test('T28: the panel home stays the depth chain: the facets panel reads depthChain and the map gets the summaries from the host', ()=>{
 const facets=read(resolve(engine,'src/placeFacetsPanel.tsx'));
 assert.match(facets,/depthChain\(reading\)/,'the facets panel still reads the depth chain');
 const world=read(resolve(engine,'../../src/techne/m0m5/place/world.ts'));
 assert.match(world,/export function ladderRungSummaries\(ladder: LadderRung\[\]\): LadderRungSummary\[\]/);
 const host=read(resolve(engine,'src/researchInstruments.tsx'));
 assert.match(host,/ladder=\{ladderRungSummaries\(referenceFrameLadder\(nativeReading\)\)\}/);
 const map=read(resolve(canvasDir,'PsychogeographicMap.tsx'));
 assert.match(map,/data-testid="places-ladder"/);
 assert.match(map,/role="note" data-testid=\{`places-ladder-reason-\$\{rung\.rung\}`\}/,'an unavailable rung shows its reason on click');
 assert.match(map,/status === "present"/,'the map branches on the present status');
});
