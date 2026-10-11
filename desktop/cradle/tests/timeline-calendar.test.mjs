import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTimestamp,expandInstant,ticksForDomain} from '../src/techne/m0m5/timeline/scale.ts';
import {timeAxisEventScope} from '../src/techne/m0m5/timeline/timeAxis.ts';
import {phasesFromFacets} from '../src/techne/m0m5/timeline/relations.ts';
import {buildLanes} from '../src/techne/m0m5/timeline/lanes.ts';
const iso=ms=>new Date(ms).toISOString();

test('reduced historical ISO dates retain the declared calendar year',()=>{
 for(const [source,expected]of [['0001','0001-01-01T00:00:00.000Z'],['0099-02','0099-02-01T00:00:00.000Z'],['0000-02-29','0000-02-29T00:00:00.000Z'],['-000001','-000001-01-01T00:00:00.000Z']])assert.equal(iso(parseTimestamp(source)),expected);
});
test('precision boundaries and ticks never remap years zero to ninety-nine into the twentieth century',()=>{
 const year=expandInstant('0001-06-05T12:30:00+01:00','year');
 assert.equal(iso(year.fromMs),'0000-12-31T23:00:00.000Z');assert.equal(iso(year.toMs),'0001-12-31T23:00:00.000Z');
 const century=expandInstant('0099-12-31T23:00:00Z','century');
 assert.equal(iso(century.fromMs),'0000-01-01T00:00:00.000Z');assert.equal(iso(century.toMs),'0100-01-01T00:00:00.000Z');
 const ticks=ticksForDomain({fromMs:parseTimestamp('0000'),toMs:parseTimestamp('0100')});
 assert.ok(ticks.length>=2);assert.ok(ticks.every(tick=>new Date(tick.ms).getUTCFullYear()<101));
});
test('impossible or ambiguous input remains unresolved instead of becoming a different date',()=>{
 for(const source of ['2025-02-29','0001-13','2026-04-31T12:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:00:00+24:00','01'])assert.throws(()=>parseTimestamp(source),/not a timestamp/);
 assert.equal(timeAxisEventScope({kind:'occurred',instant:'2025-02-29'},null).state,'unresolved');
});
test('shared scope uses the corrected extent and preserves partial date carriers',()=>{
 const facet={kind:'occurred',instant:'0001',precision:'year'},before=JSON.stringify(facet);
 assert.equal(timeAxisEventScope(facet,{from:'1900',to:'2000'}).state,'out-of-scope');
 assert.equal(timeAxisEventScope(facet,{from:'0000',to:'0002'}).state,'in-scope');
 assert.equal(JSON.stringify(facet),before);
});

test('unresolved dates survive native phase and continuity projections with their exact carrier',()=>{
 const invalid={kind:'valid',facet_ref:'facet:invalid-calendar',instant:'2025-02-29'},before=JSON.stringify(invalid);
 const bands=phasesFromFacets([invalid]);assert.equal(bands.length,1);assert.match(bands[0].temporal_problem,/not a timestamp/);assert.equal(bands[0].fromMs,null);
 const lanes=buildLanes([invalid]);assert.equal(lanes.length,1);assert.equal(lanes[0].items.length,1);assert.equal(lanes[0].items[0].instant,invalid.instant);assert.match(lanes[0].items[0].temporal_problem,/not a timestamp/);
 assert.equal(JSON.stringify(invalid),before);
});

test('reversed source intervals remain reported as unresolved under any session window',()=>{
 const facet={kind:'valid',interval:{from:'2000',to:'1900'}},before=JSON.stringify(facet);
 for(const window of [null,{from:'0001',to:'9999'}])assert.equal(timeAxisEventScope(facet,window).state,'unresolved');
 assert.equal(JSON.stringify(facet),before);
});
