import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
// The authority for the precision ladder and UTC offsets: imported, never copied.
import {instantOffsetMs,parseTimestamp} from '../../../src/techne/m0m5/timeline/scale.ts';

const compiled=await build({stdin:{contents:"export {bundleFromTechneReadings} from '../../vendor/research-canvas/packages/desktop-api/src/techneBundle.ts';export {createTechneTransport} from '../../vendor/research-canvas/packages/desktop-api/src/techneTransport.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));

// One facet per rung of the full ladder. Each instant is a well-formed authority
// timestamp at its own precision; `offset` is the UTC offset the instant declares.
const RUNGS=[
 {precision:'millennium',instant:'1000'},
 {precision:'century',instant:'1800'},
 {precision:'decade',instant:'1850'},
 {precision:'year',instant:'1850'},
 {precision:'month',instant:'1850-03'},
 {precision:'day',instant:'1850-03-04'},
 {precision:'hour',instant:'1850-03-04T10:00+02:00',offset:7_200_000},
 {precision:'minute',instant:'1850-03-04T10:15-05:00',offset:-18_000_000},
 {precision:'second',instant:'1850-03-04T10:15:30+01:00',offset:3_600_000},
 {precision:'subsecond',instant:'1850-03-04T10:15:30.125+01:00',offset:3_600_000},
];

function readingWith(temporal){
 return {reading_ref:'reading:precision',subject:{subject_ref:'subject:precision',native_owner:'oi'},disclosure:{instruments:[]},temporal};
}

test('every rung of the full precision ladder survives the bridge round-trip verbatim',async()=>{
 const temporal=RUNGS.map(rung=>({kind:'occurred',facet_ref:`facet:${rung.precision}`,precision:rung.precision,instant:rung.instant}));
 for(const rung of RUNGS)assert.doesNotThrow(()=>parseTimestamp(rung.instant),`fixture is a valid timestamp: ${rung.instant}`);
 const reading=readingWith(temporal),before=JSON.stringify(reading);
 const bundle=api.bundleFromTechneReadings([reading]);
 const view=await api.createTechneTransport(bundle).loadTimelineView({workspaceId:bundle.workspaceId});
 assert.equal(view.nodes.length,RUNGS.length,'every dated facet reaches the Timeline');
 for(const rung of RUNGS){
  const row=view.nodes.find(entry=>entry.node.graphNodeId===`facet:${rung.precision}`);
  assert.ok(row,`facet at ${rung.precision} is served`);
  assert.equal(row.anchor.precision,rung.precision,`${rung.precision} precision is not coarsened`);
  assert.equal(row.node.temporalPrecision,rung.precision);
  assert.equal(row.anchor.validFrom,rung.instant,`${rung.precision} instant is verbatim`);
  if(rung.offset!==undefined)assert.equal(instantOffsetMs(row.anchor.validFrom),rung.offset,`${rung.precision} keeps its declared UTC offset`);
 }
 assert.equal(JSON.stringify(reading),before,'the bridge never mutates the native reading');
});

test('a second-precision facet keeps its precision and offset through the bridge',async()=>{
 const reading=readingWith([{kind:'occurred',facet_ref:'facet:second',precision:'second',instant:'1850-03-04T10:15:30+01:00'}]);
 const bundle=api.bundleFromTechneReadings([reading]);
 const anchor=bundle.nodes.find(node=>node.graphNodeId==='facet:second');
 assert.equal(anchor.temporalPrecision,'second');
 assert.equal(anchor.validFrom,'1850-03-04T10:15:30+01:00');
 assert.equal(instantOffsetMs(anchor.validFrom),3_600_000);
});

test('a day-precision facet stays day, never a finer or coarser rung',async()=>{
 const reading=readingWith([{kind:'occurred',facet_ref:'facet:day',precision:'day',instant:'1850-03-04'}]);
 const bundle=api.bundleFromTechneReadings([reading]);
 assert.equal(bundle.nodes.find(node=>node.graphNodeId==='facet:day').temporalPrecision,'day');
});

test('an absent precision keeps the documented day fallback (open follow-up, pinned here)',async()=>{
 const reading=readingWith([{kind:'occurred',facet_ref:'facet:bare',instant:'1850-03-04T10:15:30+01:00'}]);
 const bundle=api.bundleFromTechneReadings([reading]);
 assert.equal(bundle.nodes.find(node=>node.graphNodeId==='facet:bare').temporalPrecision,'day');
});
