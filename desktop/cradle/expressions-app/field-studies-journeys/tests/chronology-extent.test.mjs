// T1b (chronology leg): the canvas Timeline places anchors on epoch-ms extents
// expanded by the authority, labels ticks with the authority's ticksForDomain,
// and keeps year-scale placement. The canvas holds no time model of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
// The authority for the expansion and the ticks: imported, never copied.
const compiled=await build({stdin:{contents:"export * as projection from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';export * as ticks from '../../vendor/research-canvas/packages/canvas/src/timeline/ticks.ts';export * as instant from '../../vendor/research-canvas/packages/canvas/src/timeline/instant.ts';export * as scale from '../../vendor/research-canvas/packages/canvas/src/timeline/scale.ts';export * as authority from '../../../src/techne/m0m5/timeline/scale.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {projection,viewport,ticks,instant,scale,authority}=api;

const WIDTH=1000;
const view=(centerYear,pixelsPerYear)=>({centerYear,pixelsPerYear,widthPx:WIDTH});
const record=(id,validFrom,validTo,precision)=>({
 node:{graphNodeId:id,title:id,isTemporal:true,entityType:'Event',validFrom,validTo,evidenceTags:[]},
 anchor:{validFrom,validTo,precision},layoutOverride:null,
});
const DAY=86_400_000;

test('an anchor extent is the authority expansion at the anchor own precision',()=>{
 const from='1850-03-04T10:15:30+01:00';
 assert.equal(instant.anchorExtent(from,null,'second').fromMs,authority.expandInstant(from,'second').fromMs);
 assert.equal(instant.anchorExtent(from,null,'second').toMs,null,'a point-only anchor has no end');
 // Inclusive end: an interval ending in 1855 at year precision runs to 1 January 1856.
 const interval=instant.anchorExtent('1850','1855','year');
 assert.equal(interval.fromMs,authority.parseTimestamp('1850'));
 assert.equal(interval.toMs,authority.parseTimestamp('1856'));
});

test('a second-precision interval keeps its true extent at sub-second zoom',()=>{
 const [item]=projection.projectNodes([record('s','1850-03-04T10:15:30+01:00','1850-03-04T10:15:30+01:00','second')]);
 assert.equal(item.startMs,authority.expandInstant('1850-03-04T10:15:30+01:00','second').fromMs);
 assert.equal(item.endMs,authority.expandInstant('1850-03-04T10:15:30+01:00','second').toMs);
 // One millisecond per pixel: a one-second extent is exactly 1000 px.
 const [oneMsPerPx]=projection.placeItems([item],view(1850.2,scale.MS_PER_YEAR));
 assert.ok(Math.abs((oneMsPerPx.endPx-oneMsPerPx.startPx)-1000)<1e-6,'one second spans 1000 px at 1 px per ms');
 // At the finest zoom the camera allows, the same second spans 1e6 px.
 const [finest]=projection.placeItems([item],view(1850.2,scale.MAX_PIXELS_PER_YEAR));
 assert.ok(Math.abs((finest.endPx-finest.startPx)-1e6)<1e-3,'the zoom ceiling reaches subsecond extents');
});

test('a subsecond facet occupies its true millisecond at the finest zoom',()=>{
 const [item]=projection.projectNodes([record('m','1850-03-04T10:15:30.125+01:00',null,'subsecond')]);
 assert.equal(item.endMs,null);
 const [placed]=projection.placeItems([{...item,endMs:item.startMs+1}],view(1850.2,scale.MAX_PIXELS_PER_YEAR));
 assert.ok(Math.abs((placed.endPx-placed.startPx)-1000)<1e-6,'one millisecond is 1000 px at 1000 px per ms');
});

test('year-scale placement of year-precision anchors does not shift (within calendar drift)',()=>{
 // Pre-port reference: the year-linear camera the canvas used before this leg.
 const legacyPx=(vp,year)=>vp.widthPx/2+(year-vp.centerYear)*vp.pixelsPerYear;
 const years=[1000,1500,1700,1800,1850,1999,2000];
 const items=projection.projectNodes(years.map((year,index)=>record(`y${index}`,String(year),null,'year')));
 for(const pixelsPerYear of [0.5,2,12,120])for(const centerYear of [1700,1850.5]){
  const vp=view(centerYear,pixelsPerYear);
  for(const placed of projection.placeItems(items,vp)){
   // Leap-year drift between calendar and mean year is under one day: under 1 px even at 120 px/yr.
   assert.ok(Math.abs(placed.startPx-legacyPx(vp,placed.item.startYear))<1,`${placed.item.graphNodeId} at ${pixelsPerYear}px/yr`);
  }
 }
});

test('the year boundary is calendar-exact, so a year start lands on the authority year start',()=>{
 assert.equal(instant.yearToMs(1850),authority.parseTimestamp('1850'));
 assert.equal(instant.yearToMs(-500),authority.parseTimestamp('-000500'));
 assert.ok(Math.abs(instant.msToYear(instant.yearToMs(1850.25))-1850.25)<1e-9);
});

test('legacy shorthand years are padded into the authority grammar, unparseable anchors are dropped',()=>{
 assert.equal(instant.canonicalInstant('800'),'0800');
 assert.equal(instant.canonicalInstant('-500'),'-000500');
 assert.equal(instant.canonicalInstant('1850-03-04'),'1850-03-04');
 const items=projection.projectNodes([record('neg','-500',null,'year'),record('bad','not a date',null,'year')]);
 assert.deepEqual(items.map(item=>item.graphNodeId),['neg']);
 assert.equal(items[0].startYear,-500,'labels are integer calendar years');
});

test('axis ticks are the authority ticksForDomain output on the same camera',()=>{
 const vp=view(1850,2);
 const camera=viewport.timeCamera(vp);
 const domain={fromMs:viewport.pixelToMs(camera,0),toMs:viewport.pixelToMs(camera,WIDTH)};
 const want=authority.ticksForDomain(domain,{offsetMs:0,targetTicks:Math.max(2,Math.floor(WIDTH/120))});
 const got=ticks.visibleTicks(vp,0);
 assert.deepEqual(got.map(tick=>tick.ms),want.map(tick=>tick.ms));
 assert.deepEqual(got.map(tick=>tick.label),want.map(tick=>tick.label));
 for(const tick of got)assert.equal(tick.px,viewport.msToPixel(camera,tick.ms));
});

test('a reading civil offset moves day ticks onto local midnight',()=>{
 const offsetMs=3_600_000;
 const vp=view(1850.2,6087);
 const got=ticks.visibleTicks(vp,offsetMs);
 const days=got.filter(tick=>tick.unit==='day');
 assert.ok(days.length>0,'the window reaches day marks');
 for(const tick of days)assert.equal(((tick.ms+offsetMs)%DAY+DAY)%DAY,0);
});

test('the common offset is the one all anchors declare, otherwise zero',()=>{
 assert.equal(ticks.commonOffsetMs([{offsetMs:3_600_000},{offsetMs:3_600_000}]),3_600_000);
 assert.equal(ticks.commonOffsetMs([{offsetMs:3_600_000},{offsetMs:0}]),0);
 assert.equal(ticks.commonOffsetMs([]),0);
});

test('zoom keeps the time under the pointer; the camera clamps to the authority-sized range',()=>{
 const vp=view(1850,12);
 const before=viewport.pixelToYear(vp,300);
 const after=viewport.zoomAt(vp,4,300);
 assert.ok(Math.abs(viewport.pixelToYear(after,300)-before)<1e-9);
 assert.equal(viewport.clampPixelsPerYear(Number.POSITIVE_INFINITY),scale.MAX_PIXELS_PER_YEAR);
 assert.equal(viewport.clampPixelsPerYear(0),scale.MIN_PIXELS_PER_YEAR);
});

test('density bands keep the lens thresholds and no tier ladder remains',()=>{
 assert.equal(scale.densityBandForPixelsPerYear(0.39),'marker');
 assert.equal(scale.densityBandForPixelsPerYear(0.4),'label');
 assert.equal(scale.densityBandForPixelsPerYear(7.99),'label');
 assert.equal(scale.densityBandForPixelsPerYear(8),'detail');
 assert.equal(scale.tierForPixelsPerYear,undefined,'the parallel tier ladder is gone');
 assert.equal(scale.generateTicks,undefined,'the parallel year ladder is gone');
});
