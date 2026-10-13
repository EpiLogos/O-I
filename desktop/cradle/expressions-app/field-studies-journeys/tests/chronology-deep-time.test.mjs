// Lane-2 T4 — deep time on the chronology leg. The canvas Timeline places a deep
// anchor on the authority's linear extent, ticks it on the authority's ladder and
// labels it with grouped, era-stated years. The canvas holds no second time
// model: its labels and camera read civil fields from the authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

// The authority and the canvas timeline, bundled from source: imported, never copied.
const compiled=await build({stdin:{contents:"export * as projection from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';export * as ticks from '../../vendor/research-canvas/packages/canvas/src/timeline/ticks.ts';export * as instant from '../../vendor/research-canvas/packages/canvas/src/timeline/instant.ts';export * as scale from '../../vendor/research-canvas/packages/canvas/src/timeline/scale.ts';export * as labels from '../../vendor/research-canvas/packages/canvas/src/timeline/labels.ts';export * as authority from '../../../src/techne/m0m5/timeline/scale.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {projection,viewport,ticks,instant,scale,labels,authority}=api;

const WIDTH=1000;
const OLDEST=-780_000, NEWEST=4_500_000_000;
const record=(id,validFrom,validTo,precision)=>({
 node:{graphNodeId:id,title:id,isTemporal:true,entityType:'Event',validFrom,validTo,evidenceTags:[]},
 anchor:{validFrom,validTo,precision},layoutOverride:null,
});

test('a reading from -780000 to +4.5e9 fits the camera and places both anchors at their extents',()=>{
 const items=projection.projectNodes([record('oldest',String(OLDEST),null,'year'),record('newest',String(NEWEST),null,'year')]);
 // One screen spans the whole reading: the centre is its midpoint, the scale its span in years.
 const span=NEWEST-OLDEST+1;
 const view={centerYear:(OLDEST+NEWEST)/2,pixelsPerYear:WIDTH/span,widthPx:WIDTH};
 assert.equal(viewport.clampPixelsPerYear(view.pixelsPerYear),view.pixelsPerYear,'the zoom floor admits the whole reading');
 const placed=projection.placeItems(items,view);
 const oldest=placed.find((row)=>row.item.graphNodeId==='oldest');
 const newest=placed.find((row)=>row.item.graphNodeId==='newest');
 assert.equal(oldest.item.startMs,authority.yearStartMs(OLDEST),'the oldest anchor is the authority\'s extent');
 assert.equal(newest.item.startMs,authority.yearStartMs(NEWEST),'the newest anchor is the authority\'s extent');
 assert.ok(Math.abs(oldest.startPx-0)<1,`oldest at the left edge, got ${oldest.startPx}`);
 assert.ok(Math.abs(newest.startPx-WIDTH)<1,`newest at the right edge, got ${newest.startPx}`);
 assert.ok(oldest.startPx<newest.startPx,'chronological order holds across the deep span');
});

test('the deep axis is the eon rung, labelled with grouped, era-stated years at round values',()=>{
 const centerYear=(OLDEST+NEWEST)/2;
 const view={centerYear,pixelsPerYear:WIDTH/(NEWEST-OLDEST+1),widthPx:WIDTH};
 const {minor}=ticks.axisRows(viewport.timeCamera(view),0);
 assert.deepEqual([...new Set(minor.map((tick)=>tick.unit))],['eon']);
 assert.deepEqual(minor.map((tick)=>tick.label),['1 BCE','1,000,000,000 CE','2,000,000,000 CE','3,000,000,000 CE','4,000,000,000 CE']);
 // Each mark sits at its own year on the camera, within a pixel.
 const expectedPx=(year)=>WIDTH/2+(year-centerYear)*view.pixelsPerYear;
 const years=[0,1e9,2e9,3e9,4e9];
 minor.forEach((tick,i)=>assert.ok(Math.abs(tick.px-expectedPx(years[i]))<1,`mark ${i} at ${tick.px}`));
});

test('formatYear groups deep digits and states the era; human years are unchanged',()=>{
 assert.equal(labels.formatYear(-780_000),'780,001 BCE');
 assert.equal(labels.formatYear(4_500_000_000),'4,500,000,000 CE');
 assert.equal(labels.formatYear(-500),'501 BCE');
 assert.equal(labels.formatYear(0),'1 BCE');
 assert.equal(labels.formatYear(1850),'1850');
});

test('a deep precision label states its own unit, never a day it does not claim',()=>{
 const [point]=projection.projectNodes([record('year','-780000',null,'year')]);
 assert.equal(labels.precisionLabel(point),'780,001 BCE');
 const [age]=projection.projectNodes([record('age','-780000',null,'age')]);
 assert.equal(labels.precisionLabel(age),'1,000,001 BCE – 2 BCE','the 10^6-year unit that holds -780000');
 const [eon]=projection.projectNodes([record('eon','4500000000',null,'eon')]);
 assert.equal(labels.precisionLabel(eon),'4,000,000,000 CE – 4,999,999,999 CE','the 10^9-year unit that holds +4.5e9');
});

test('deep anchors are read verbatim through the canvas adapters',()=>{
 assert.equal(instant.canonicalInstant('-780000'),'-780000');
 assert.equal(instant.canonicalInstant('780000'),'+780000');
 assert.equal(instant.canonicalInstant('-500'),'-000500');
 const extent=instant.anchorExtent(String(NEWEST),null,'eon');
 assert.equal(extent.fromMs,authority.expandInstant(String(NEWEST),'eon').fromMs);
 assert.equal(instant.calendarYear(extent.fromMs),4_000_000_000);
 assert.ok(Math.abs(instant.msToYear(instant.yearToMs(-779_999.25))+779_999.25)<1e-6,'a fractional deep year round-trips through the camera');
});

test('the zoom floor and the density bands read deep zoom honestly',()=>{
 assert.equal(viewport.clampPixelsPerYear(0),scale.MIN_PIXELS_PER_YEAR);
 assert.equal(scale.densityBandForPixelsPerYear(1e-7),'marker','a deep reading is markers, not labels, at its own zoom');
});

test('the canvas time code reads civil fields from the authority, not from Date',()=>{
 const dir=fileURLToPath(new URL('../../vendor/research-canvas/packages/canvas/src/timeline/',import.meta.url));
 for (const file of ['instant.ts','labels.ts']) {
   const source=readFileSync(dir+file,'utf8');
   assert.doesNotMatch(source,/new Date\(/,`${file} holds no Date arithmetic`);
   assert.doesNotMatch(source,/getUTC/,`${file} reads no Date fields`);
 }
});
