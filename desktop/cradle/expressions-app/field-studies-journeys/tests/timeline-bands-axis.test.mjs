// T2 (precision-honest bands and labels) and T7 (two-row calendar axis, BCE/CE).
// The canvas draws every band and tick from the authority (expandInstant,
// ticksForDomain); these tests pin that the bands equal the authority's output,
// that labels state the precision verbatim, and that the axis rows adapt to zoom.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
// The authority for the expansion and the ticks: imported, never copied.
const compiled=await build({stdin:{contents:"export * as projection from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';export * as ticks from '../../vendor/research-canvas/packages/canvas/src/timeline/ticks.ts';export * as instant from '../../vendor/research-canvas/packages/canvas/src/timeline/instant.ts';export * as labels from '../../vendor/research-canvas/packages/canvas/src/timeline/labels.ts';export * as authority from '../../../src/techne/m0m5/timeline/scale.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {projection,viewport,ticks,instant,labels,authority}=api;

const WIDTH=1000;
const record=(id,validFrom,validTo,precision)=>({
 node:{graphNodeId:id,title:id,isTemporal:true,entityType:'Event',validFrom,validTo,evidenceTags:[]},
 anchor:{validFrom,validTo,precision},layoutOverride:null,
});
const one=(validFrom,validTo,precision)=>projection.projectNodes([record('x',validFrom,validTo,precision)])[0];
const DAY=86_400_000;

// One well-formed authority instant per rung, at its own precision.
const SAMPLE={
 millennium:'1000',century:'1800',decade:'1850',year:'1850',month:'1850-03',day:'1850-03-04',
 hour:'1850-03-04T10:00+02:00',minute:'1850-03-04T10:15-05:00',second:'1850-03-04T10:15:30+01:00',
 subsecond:'1850-03-04T10:15:30.125+01:00',
};

test('a band is the authority expansion at its precision, for a point and for an interval',()=>{
 for(const [precision,instantText] of Object.entries(SAMPLE)){
  const item=one(instantText,null,precision);
  assert.deepEqual(projection.bandExtent(item),authority.expandInstant(instantText,precision),`${precision} point band`);
 }
 const interval=one('1850','1855','year');
 assert.deepEqual(projection.bandExtent(interval),{fromMs:authority.parseTimestamp('1850'),toMs:authority.parseTimestamp('1856')},'inclusive end is the next year start');
});

test('a millennium, a year and a day fact draw three bands of different widths, each labelled at its precision',()=>{
 const items=projection.projectNodes([
  record('mill','1000',null,'millennium'),
  record('year','1850',null,'year'),
  record('day','1850-03-04',null,'day'),
 ]);
 const vp={centerYear:1850,pixelsPerYear:400,widthPx:1200};
 const placed=Object.fromEntries(projection.placeItems(items,vp).map(p=>[p.item.graphNodeId,p]));
 const widths={mill:placed.mill.endPx-placed.mill.startPx,year:placed.year.endPx-placed.year.startPx,day:placed.day.endPx-placed.day.startPx};
 assert.ok(widths.mill>widths.year&&widths.year>widths.day&&widths.day>0,'millennium > year > day > 0');
 assert.ok(Math.abs(widths.year-400)<1,`a year band is one year at 400 px/yr (got ${widths.year})`);
 assert.ok(Math.abs(widths.mill-400000)<400,`a millennium band is a thousand years (got ${widths.mill})`);
 assert.ok(widths.day>0&&widths.day<2,'a day band is a fraction of a year');
 // Each band's end is the authority's expansion, placed on the same camera as the card.
 const camera=viewport.timeCamera(vp);
 for(const item of items){
  assert.equal(placed[item.graphNodeId].endPx,viewport.msToPixel(camera,authority.expandInstant(item.node.validFrom,item.precision).toMs),`${item.graphNodeId} band end`);
 }
 assert.deepEqual(items.map(item=>labels.precisionLabel(item)),['2nd millennium','1850','4 Mar 1850']);
});

test('precision labels state the precision verbatim, with an inclusive end and BCE years',()=>{
 const label=(from,to,precision)=>labels.precisionLabel(one(from,to,precision));
 assert.equal(label('1150',null,'century'),'12th c.');
 assert.equal(label('1960',null,'decade'),'1960s');
 assert.equal(label('1850',null,'year'),'1850');
 assert.equal(label('1850-03',null,'month'),'Mar 1850');
 assert.equal(label('1850-03-04',null,'day'),'4 Mar 1850');
 assert.equal(label('1850-03-04T10:00+02:00',null,'hour'),'4 Mar 1850 10:00');
 assert.equal(label('1850','2016','year'),'1850 – 2016','an interval states both ends, the end inclusive');
 assert.equal(label('-500',null,'year'),'501 BCE','astronomical -500 reads 501 BCE');
 assert.equal(label('-500','-400','year'),'501 BCE – 401 BCE');
 assert.equal(label('-000500',null,'century'),'501 BCE – 402 BCE','a BCE century states its years');
 // Review fix: the unit that begins at year 0 is the first CE unit, never "1 BCE – 99".
 assert.equal(label('0050',null,'century'),'1st c.');
 assert.equal(label('0500',null,'millennium'),'1st millennium');
 assert.equal(label('0005',null,'decade'),'1 BCE – 9','the decade from year 0 states its years');
 assert.equal(label('0015',null,'decade'),'10s');
});

test('the display year is astronomical: year 0 is 1 BCE, positive years read plain',()=>{
 assert.equal(labels.formatYear(-500),'501 BCE');
 assert.equal(labels.formatYear(0),'1 BCE');
 assert.equal(labels.formatYear(-1),'2 BCE');
 assert.equal(labels.formatYear(1),'1');
 assert.equal(labels.formatYear(1850),'1850');
 assert.equal(labels.ordinal(11),'11th');
 assert.equal(labels.ordinal(21),'21st');
 assert.equal(labels.ordinal(112),'112th');
});

test('year zoom: the minor row reads months and the major row reads years',()=>{
 const vp={centerYear:1850,pixelsPerYear:WIDTH/1.5,widthPx:WIDTH};
 const rows=ticks.axisRows(viewport.timeCamera(vp),0);
 assert.ok(rows.minor.length>0&&rows.major.length>0,'both rows have marks');
 assert.ok(rows.minor.every(tick=>tick.unit==='month'),'minor unit is month');
 assert.ok(rows.major.every(tick=>tick.unit==='year'),'major unit is the adjacent coarser unit, year');
 assert.ok(rows.minor.every(tick=>/^[A-Z][a-z]{2}$/.test(tick.label)),`minor labels are month names: ${rows.minor.map(t=>t.label)}`);
 assert.ok(rows.major.every(tick=>/^\d+$/.test(tick.label)),`major labels are years: ${rows.major.map(t=>t.label)}`);
 // The minor marks are the authority's ticks on the same window, unchanged.
 const camera=viewport.timeCamera(vp);
 const want=authority.ticksForDomain({fromMs:viewport.pixelToMs(camera,0),toMs:viewport.pixelToMs(camera,WIDTH)},{offsetMs:0,targetTicks:Math.max(2,Math.floor(WIDTH/120))});
 assert.deepEqual(rows.minor.map(tick=>tick.ms),want.map(tick=>tick.ms));
});

test('day zoom: the minor row reads hours and the major row reads days',()=>{
 const vp={centerYear:1850.25,pixelsPerYear:WIDTH/(1.5/365.2425),widthPx:WIDTH};
 const rows=ticks.axisRows(viewport.timeCamera(vp),0);
 assert.ok(rows.minor.length>0&&rows.major.length>0,'both rows have marks');
 assert.ok(rows.minor.every(tick=>tick.unit==='hour'),'minor unit is hour');
 assert.ok(rows.major.every(tick=>tick.unit==='day'),'major unit is day');
 assert.ok(rows.minor.every(tick=>/^\d\d:\d\d$/.test(tick.label)),`minor labels are clock times: ${rows.minor.map(t=>t.label)}`);
 assert.ok(rows.major.every(tick=>/^\d+ [A-Z][a-z]{2} \d+$/.test(tick.label)),`major labels are days: ${rows.major.map(t=>t.label)}`);
});

test('BCE: the axis reads 501 BCE at astronomical -500 and never a raw negative year',()=>{
 const vp={centerYear:-500,pixelsPerYear:WIDTH/25,widthPx:WIDTH};
 const rows=ticks.axisRows(viewport.timeCamera(vp),0);
 const at500=rows.minor.find(tick=>tick.ms===authority.parseTimestamp('-000500'));
 assert.ok(at500,'a decade mark sits on -500');
 assert.equal(at500.label,'501 BCE');
 const all=[...rows.major,...rows.minor].map(tick=>tick.label);
 assert.ok(all.every(label=>!/^-/.test(label)),`no raw negative years: ${all}`);
 assert.ok(all.every(label=>/BCE$/.test(label)),`every mark is BCE here: ${all}`);
});

test('labels depend on the mark and its unit, never on the window, so they do not move between frames',()=>{
 const at=(centerYear)=>ticks.axisRows(viewport.timeCamera({centerYear,pixelsPerYear:WIDTH/(1.5/365.2425),widthPx:WIDTH}),0);
 const before=at(1850.25);
 const after=at(1850.2502);
 const byMs=new Map(before.minor.map(tick=>[tick.ms,tick.label]));
 const shared=after.minor.filter(tick=>byMs.has(tick.ms));
 assert.ok(shared.length>0,'the two frames share marks');
 for(const tick of shared)assert.equal(tick.label,byMs.get(tick.ms),`${tick.ms} keeps its label`);
});

test('a reading civil offset moves the day marks onto local midnight in the two-row axis',()=>{
 const offsetMs=3_600_000;
 const vp={centerYear:1850.25,pixelsPerYear:WIDTH/(1.5/365.2425),widthPx:WIDTH};
 const rows=ticks.axisRows(viewport.timeCamera(vp),offsetMs);
 const days=rows.major.filter(tick=>tick.unit==='day');
 assert.ok(days.length>0,'the window reaches a day mark');
 for(const tick of days)assert.equal(((tick.ms+offsetMs)%DAY+DAY)%DAY,0);
});

test('a point with a precision is a band of its unit, never a bare point',()=>{
 const band=projection.bandExtent(one('1850-03-04',null,'day'));
 assert.equal(band.toMs-band.fromMs,DAY,'a day-precision point is a 24-hour band');
});
