/** T8b: a validity facet's period/era/reign name rides the contract as an
 * optional `label`, verbatim, and reaches the chronology's band as
 * label_verbatim. Scripted: each assertion re-reads the source it names. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTemporalFacet,validateReading} from '../src/techne/contract.ts';
import {timeAxis} from '../src/techne/m0m5/timeline/timeAxis.ts';
import {provingReading} from '../src/techne/m0m5/journey/proving-reading.ts';
import {readWikiTemporal} from '../src/techne/temporalFacets.ts';

const VALID_REF='ql.techne:facet:tb0:valid';
const LABEL='Reign of Ramesses II — co-regency, Ḥ-variant “as attested”';
const RFC='2026-09-16T00:00:00+01:00';

function check(facet){const errors=[];validateTemporalFacet(facet,'facet',errors);return errors;}

test('the contract accepts an optional label that is a string of at most 256 characters or null', ()=>{
 const base={facet_ref:'f:1',kind:'valid',interval:{from:RFC,to:null,from_precision:'day'}};
 assert.deepEqual(check({...base,label:LABEL}),[]);
 assert.deepEqual(check({...base,label:null}),[]);
 assert.deepEqual(check({...base,label:'x'.repeat(256)}),[]);
 assert.deepEqual(check(base),[],'a facet with no label is unchanged');
});

test('the contract refuses a label that is too long, not a string, or an unknown sibling key', ()=>{
 const base={facet_ref:'f:1',kind:'valid',interval:{from:RFC,to:null,from_precision:'day'}};
 assert.ok(check({...base,label:'x'.repeat(257)}).some(e=>/label: must be a string of at most 256 characters or null/.test(e)));
 assert.ok(check({...base,label:7}).some(e=>/label/.test(e)));
 assert.ok(check({...base,label:{name:'Reign'}}).some(e=>/label/.test(e)));
 assert.ok(check({...base,period_name:'Reign'}).some(e=>e.includes('period_name')),'the contract stays closed: only label is added');
});

test('a labelled validity facet inside a reading validates; a label is never an extent', ()=>{
 const reading=provingReading();
 const labelled={...reading,temporal:reading.temporal.map(f=>f.facet_ref===VALID_REF?{...f,label:LABEL}:f)};
 const checked=validateReading(labelled);
 assert.equal(checked.valid,true,checked.errors.join('; '));
 const before=timeAxis(reading).bands.find(b=>b.band_ref===VALID_REF);
 const after=timeAxis(labelled).bands.find(b=>b.band_ref===VALID_REF);
 assert.equal(after.label_verbatim,LABEL,'the source name reaches the band byte-exact');
 assert.equal(after.earliest,before.earliest);
 assert.equal(after.latest,before.latest);
 assert.deepEqual(after.interval,before.interval);
});

test('a validity facet with no source label keeps label_verbatim null; its facet ref is never the label', ()=>{
 const reading=provingReading();
 const band=timeAxis(reading).bands.find(b=>b.band_ref===VALID_REF);
 assert.ok(band,'the proving reading carries one validity facet');
 assert.equal(band.label_verbatim,null);
 assert.notEqual(band.label_verbatim,VALID_REF);
});

test('the native wiki reader passes a declared label through verbatim to the chronology band', ()=>{
 const row={ref:'wiki:node:ramesses',revision:3,object:'node','aikit.techne-facet/v1':{contract:'aikit.techne-facet/v1',temporal:[
  {facet_ref:VALID_REF,kind:'valid',interval:{from:'1213-01-01T00:00:00Z',to:'1279-01-01T00:00:00Z',from_precision:'year',to_precision:'year'},label:LABEL,source_ref:'src:chronicle'}]}};
 const wiki=readWikiTemporal(JSON.stringify([row]));
 assert.equal(wiki.state,'available',wiki.state==='unavailable'?wiki.reason:'');
 const [facet]=wiki.sources[0].facets;
 assert.equal(facet.label,LABEL);
 const reading={...provingReading(),temporal:[facet]};
 const band=timeAxis(reading).bands.find(b=>b.band_ref===VALID_REF);
 assert.equal(band.label_verbatim,LABEL);
 assert.equal(band.earliest,'1213-01-01T00:00:00Z');
});

test('an over-long native label fails the whole declaration loudly rather than being truncated', ()=>{
 const row={ref:'wiki:node:long',revision:1,object:'node','aikit.techne-facet/v1':{contract:'aikit.techne-facet/v1',temporal:[
  {facet_ref:VALID_REF,kind:'valid',interval:{from:'1213-01-01T00:00:00Z',to:null,from_precision:'year'},label:'x'.repeat(257),source_ref:'src:chronicle'}]}};
 const wiki=readWikiTemporal(JSON.stringify([row]));
 assert.equal(wiki.state,'unavailable');
 assert.match(wiki.reason,/label/);
});
