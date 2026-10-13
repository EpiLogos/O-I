// lane-2 T25 — capability honesty as the instrument's voice. The chronology, the Relations tab and the
// M2′ status line render from one availability voice (vendor timeline/availabilityVoice.ts), fed by the
// authority's own `projectionAvailability`. Three fixture readings: no temporal facets; temporal facets with
// no relations; relations with no dates. Each absence keeps its honest sentence and gains its positive twin.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-capability-voice-'));
 try{
  const out=join(temporary,'capability-voice-adapters.mjs');
  await build({
   stdin:{
    contents:`export * from '../vendor/research-canvas/packages/canvas/src/timeline/availabilityVoice.ts';export {projectionAvailability} from '../../src/techne/m0m5/timeline/relations';`,
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

// The three fixtures the acceptance names.
const NO_TEMPORAL=reading();
const TEMPORAL_NO_RELATIONS=reading({temporal:[{facet_ref:'facet:1',kind:'occurrence',instant:'2020-01-01T00:00:00Z'}]});
const RELATIONS_NO_DATES=reading({relations:[{relation:'CAUSES',from_ref:'undated-a',to_ref:'undated-b',relation_ref:'rel:1'}]});

function voiceOf(fixture){
 return api.chronologyVoice(api.projectionAvailability(fixture));
}

test('the voice reuses the authority sentences: its reasons equal projectionAvailability reasons, verbatim',()=>{
 for(const fixture of [NO_TEMPORAL,TEMPORAL_NO_RELATIONS,RELATIONS_NO_DATES]){
  const availability=api.projectionAvailability(fixture);
  const voice=api.chronologyVoice(availability);
  const timeline=availability.find(a=>a.mode==='timeline'),relations=availability.find(a=>a.mode==='relations');
  assert.equal(voice.timeline.available,timeline.available);
  assert.equal(voice.relations.available,relations.available);
  if(!timeline.available)assert.equal(voice.timeline.reason,timeline.reason,'the timeline reason is the authority\'s own');
  if(!relations.available)assert.equal(voice.relations.reason,relations.reason,'the relations reason is the authority\'s own');
 }
});

test('no temporal facets: the chronology says so honestly, with the timeline reason; relations stay available only when disclosed',()=>{
 const voice=voiceOf(NO_TEMPORAL);
 assert.equal(voice.chronology,'No dates disclosed by this source');
 assert.equal(voice.timeline.available,false);
 assert.match(voice.timeline.reason,/^no temporal facets and no dated relations are disclosed — nothing is placed on a time axis, and none is invented$/);
 assert.equal(voice.relations.available,false);
 assert.equal(voice.relations.reason,'the reading discloses no typed relations');
 assert.equal(voice.relationField,'Relations · the reading discloses no typed relations');
});

test('temporal facets with no relations: the timeline speaks its positive twin; the relations tab is disabled with its reason',()=>{
 const voice=voiceOf(TEMPORAL_NO_RELATIONS);
 assert.equal(voice.chronology,'Timeline · 1 dated item');
 assert.equal(voice.timeline.available,true);
 assert.equal(voice.timeline.reason,null);
 assert.equal(voice.relations.available,false);
 assert.equal(voice.relations.reason,'the reading discloses no typed relations','every unavailable relations mode carries its reason');
});

test('relations with no dates: the chronology is honest-empty and names the relations it holds; the relation field speaks its count',()=>{
 const voice=voiceOf(RELATIONS_NO_DATES);
 assert.equal(voice.timeline.available,false);
 assert.equal(voice.chronology,'No dates disclosed by this source · 1 typed relation is in Relations');
 assert.equal(voice.relations.available,true);
 assert.equal(voice.relationField,'Relations · 1 typed relation');
});

test('the plural and the count come from the same availability data, never a placeholder',()=>{
 const two=api.chronologyVoice([
  {mode:'timeline',available:true,count:2,reason:null},
  {mode:'relations',available:true,count:3,reason:null},
 ]);
 assert.equal(two.chronology,'Timeline · 2 dated items');
 assert.equal(two.relationField,'Relations · 3 typed relations');
 const absent=api.chronologyVoice([]);
 assert.equal(absent.chronology,api.NO_DATES_SENTENCE,'a missing projection is unavailable, never invented as available');
 assert.equal(absent.timeline.reason,api.NO_TIMELINE_REASON);
 assert.equal(absent.relations.reason,api.NO_RELATIONS_REASON);
});

// The consumers: the chronology toolbar and the M2′ status line are wired to the one voice, and every
// disabled control names its reason in its title.
const instruments=await readFile(resolve(engine,'src/researchInstruments.tsx'),'utf8');

test('the chronology reads the one voice for its status line and its Relations tab',()=>{
 assert.match(instruments,/import \{chronologyVoice,NO_DATES_SENTENCE\} from '\.\.\/\.\.\/vendor\/research-canvas\/packages\/canvas\/src\/timeline\/availabilityVoice'/);
 assert.match(instruments,/const voice=chronologyVoice\(projectionAvailability\(nativeReading,sharedTime\?\.axis\)\);/);
 assert.match(instruments,/const chronologyStatus=state\.m2Projection==='field'\?voice\.relationField:voice\.chronology;/);
 assert.match(instruments,/disabled=\{!voice\.relations\.available\} title=\{voice\.relations\.reason\?\?undefined\}/,'the Relations tab is disabled with its reason');
 assert.doesNotMatch(instruments,/'No dates disclosed by this source'/,'no second copy of the absence sentence in the host');
});

test('a Relations projection with nothing to draw falls back to the chronology, and an empty chronology names its reason',()=>{
 assert.match(instruments,/if\(state\.m2Projection==='field'&&!voice\.relations\.available\)state\.m2Projection='chronology';/);
 assert.match(instruments,/if\(temporal\.length===0\)return .*data-testid="chronology-honest-empty" role="note">\{NO_DATES_SENTENCE\}\{voice\.timeline\.reason\?`: \$\{voice\.timeline\.reason\}`:''\}<\/p>/);
});
