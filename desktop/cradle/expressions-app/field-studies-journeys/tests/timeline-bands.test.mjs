// lane-2 T8 — periodisation bands (reigns, dynasties, wars, eras).
// A band is the source's label over the authority's expansion of its disclosed
// earliest and latest. The label is verbatim; the range only draws. Unlabelled,
// unplaced or unended bands are listed, never drawn. Rendering is checked by a
// server render of the real components; the on-screen craft is the lead's native pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// The authority for expansion and standing, and the canvas modules under test: imported, never copied.
const compiled=await build({stdin:{contents:[
 "export * as bands from '../../vendor/research-canvas/packages/canvas/src/timeline/bands.ts';",
 "export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';",
 "export * as instant from '../../vendor/research-canvas/packages/canvas/src/timeline/instant.ts';",
 "export {TimelineBandLanes} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineBands.tsx';",
 "export {TimelineAxis} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineAxis.tsx';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
 "export * as authority from '../../../src/techne/m0m5/timeline/scale.ts';",
 "export {bundleFromTechneReadings} from '../../vendor/research-canvas/packages/desktop-api/src/techneBundle.ts';",
 "export {createTechneTransport} from '../../vendor/research-canvas/packages/desktop-api/src/techneTransport.ts';",
].join('\n'),resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 // react-dom/server is CommonJS and requires Node built-ins; give the ESM bundle a require.
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {bands,viewport,instant,TimelineBandLanes,TimelineAxis,createElement,renderToStaticMarkup,authority,bundleFromTechneReadings,createTechneTransport}=api;

const SOURCED='src:chronicle-1';
// Records as the reading discloses them: label verbatim, earliest/latest with their own precisions.
const FIXTURE=[
 {band_ref:'band:era',label_verbatim:'The Second Millennium',earliest:'1000',latest:'1000',earliest_precision:'millennium',latest_precision:'millennium',uncertainty:null,source_ref:'src:chronicle-2'},
 {band_ref:'band:reign',label_verbatim:'Reign of Ramesses II',earliest:'1213',latest:'1279',earliest_precision:'year',latest_precision:'year',uncertainty:null,source_ref:SOURCED},
 {band_ref:'band:war',label_verbatim:'Battle of Kadesh',earliest:'1274-05',latest:'1274-06',earliest_precision:'month',latest_precision:'month',uncertainty:'disputed by a later editor',source_ref:'src:letter-4'},
 {band_ref:'band:legend',label_verbatim:'The Age of Heroes',earliest:'900',latest:'950',earliest_precision:'year',latest_precision:'year',uncertainty:null,source_ref:null},
 {band_ref:'band:unplaced',label_verbatim:'Undated Dynasty',earliest:null,latest:null,earliest_precision:null,latest_precision:null,uncertainty:null,source_ref:SOURCED},
 {band_ref:'band:unlabelled',label_verbatim:null,earliest:'1400',latest:'1401',earliest_precision:'year',latest_precision:'year',uncertainty:null,source_ref:SOURCED},
];
const DRAWN_LABELS=['The Second Millennium','Reign of Ramesses II','Battle of Kadesh','The Age of Heroes'];

test('three sourced bands and one unsourced band are drawn with their verbatim labels; unplaced and unlabelled ones are listed, not drawn',()=>{
 const reading=bands.bandsFromReading(FIXTURE);
 assert.deepEqual(reading.bands.map(b=>b.label).sort(),[...DRAWN_LABELS].sort(),'drawn labels are the source labels, verbatim');
 const byId=Object.fromEntries(reading.bands.map(b=>[b.id,b]));
 assert.equal(byId['band:reign'].standing.visual,'sourced','a sourced band keeps the sourced class');
 assert.equal(byId['band:era'].standing.visual,'sourced','a second sourced band keeps the sourced class');
 assert.equal(byId['band:war'].standing.visual,'disputed','a disputed standing is never upgraded');
 assert.equal(byId['band:legend'].standing.visual,'authored','an unsourced labelled band is the authored class');
 assert.equal(byId['band:legend'].standing.verbatim,null);
 assert.deepEqual(reading.absent.map(a=>a.id),['band:unplaced','band:unlabelled'],'the honest-absence list names the two bands not drawn');
 assert.match(reading.absent[0].reason,/no position/);
 assert.match(reading.absent[1].reason,/no label/);
 assert.equal(reading.absent[1].label,null);
 assert.ok(!reading.bands.some(b=>b.id==='band:unplaced'||b.id==='band:unlabelled'),'an absent band is never drawn');
});

test('band geometry is the authority expansion of the disclosed earliest and latest at their own precisions',()=>{
 const reading=bands.bandsFromReading(FIXTURE);
 for(const record of FIXTURE.filter(r=>reading.bands.some(b=>b.id===r.band_ref))){
  const band=reading.bands.find(b=>b.id===record.band_ref);
  // The legacy shorthand year ("900") is padded by the canvas's own adapter before the authority parses it.
  assert.equal(band.fromMs,authority.expandInstant(instant.canonicalInstant(record.earliest),record.earliest_precision).fromMs,`${record.band_ref}: from is expandInstant(earliest)`);
  assert.equal(band.toMs,authority.expandInstant(instant.canonicalInstant(record.latest),record.latest_precision).toMs,`${record.band_ref}: to is expandInstant(latest)`);
  const facet=authority.facetRange({kind:'valid',interval:{from:instant.canonicalInstant(record.earliest),to:instant.canonicalInstant(record.latest),from_precision:record.earliest_precision,to_precision:record.latest_precision}});
  assert.deepEqual({fromMs:band.fromMs,toMs:band.toMs},{fromMs:facet.fromMs,toMs:facet.toMs},`${record.band_ref}: equal to the authority's facet extent`);
 }
 const reign=reading.bands.find(b=>b.id==='band:reign');
 assert.equal(reign.fromMs,Date.UTC(1213,0,1),'a year-precision earliest opens at its year');
 assert.equal(reign.toMs,Date.UTC(1280,0,1),'a year-precision latest closes at the end of its year (inclusive end)');
 const war=reading.bands.find(b=>b.id==='band:war');
 assert.equal(war.fromMs,Date.UTC(1274,4,1));
 assert.equal(war.toMs,Date.UTC(1274,6,1));
 assert.equal(reading.bands.find(b=>b.id==='band:era').toMs,Date.UTC(2000,0,1),'a millennium-precision band runs its whole millennium');
});

test('a band inside another is nested under it; the tightest container is the parent',()=>{
 const reading=bands.bandsFromReading(FIXTURE);
 const byId=Object.fromEntries(reading.bands.map(b=>[b.id,b]));
 assert.equal(byId['band:era'].parentId,null);
 assert.equal(byId['band:era'].depth,0);
 assert.equal(byId['band:reign'].parentId,'band:era','the reign sits inside the era');
 assert.equal(byId['band:reign'].depth,1);
 assert.equal(byId['band:war'].parentId,'band:reign','the war sits inside the reign, which is tighter than the era');
 assert.equal(byId['band:war'].depth,2);
 assert.equal(byId['band:legend'].parentId,null,'a band that contains nothing and sits in no other is top level');
});

test('on a camera, each band is a left edge and a width from the same ms camera the cards use',()=>{
 const reading=bands.bandsFromReading(FIXTURE);
 const camera=viewport.timeCamera({centerYear:1250,pixelsPerYear:20,widthPx:1000});
 const marks=bands.bandMarks(reading.bands,camera);
 const reign=marks.find(m=>m.id==='band:reign');
 const band=reading.bands.find(b=>b.id==='band:reign');
 assert.ok(reign.leftPx<500,'a band opening before the centre year starts left of centre');
 assert.ok(Math.abs(reign.widthPx-(band.toMs-band.fromMs)*20/(365.2425*86_400_000))<1e-9,'the width is the extent at 20 px per year');
 assert.ok(Math.abs(reign.leftPx+reign.widthPx-viewport.msToPixel(camera,band.toMs))<1e-6,'the right edge lands on the authority extent end');
});

test('a band is drawn as a quiet lane and one labelled stripe on the axis; the label is written once; nothing is animated',()=>{
 const reading=bands.bandsFromReading(FIXTURE);
 const marks=bands.bandMarks(reading.bands,viewport.timeCamera({centerYear:1250,pixelsPerYear:20,widthPx:1000}));
 const axis=renderToStaticMarkup(createElement(TimelineAxis,{major:[],minor:[],height:48,bands:marks}));
 for(const label of DRAWN_LABELS){
  const occurrences=axis.split(`>${label}<`).length-1;
  assert.equal(occurrences,1,`${label}: written once on the axis edge`);
 }
 assert.match(axis,/data-standing="disputed"/,'the war carries its standing class');
 assert.match(axis,/data-standing="authored"/,'the unsourced band carries the authored class');
 assert.doesNotMatch(axis,/Undated Dynasty|Heroes:/,'an absent band is never drawn');
 const lanes=renderToStaticMarkup(createElement(TimelineBandLanes,{marks}));
 assert.match(lanes,/data-testid="timeline-band-lane-band:reign"/,'the reign has a lane');
 assert.match(lanes,/--band-tone:#/,'the lane takes its tone from the standing table');
 for(const label of DRAWN_LABELS) assert.doesNotMatch(lanes,new RegExp(label),'the lanes carry no text, so the label is never repeated behind the cards');
 assert.doesNotMatch(lanes+axis,/transition|animation/,'bands are static');
 assert.equal(renderToStaticMarkup(createElement(TimelineBandLanes,{marks:[]})),'','no bands, no lanes');
});

test('a reading\'s validity facets reach the bands through the bridge; a facet with no position is listed as absent',async()=>{
 const reading={
  reading_ref:'reading:t8',
  subject:{subject_ref:'subject:t8',native_owner:'oi'},
  disclosure:{instruments:[]},
  temporal:[
   {kind:'valid',facet_ref:'facet:reign',interval:{from:'1213',to:'1279',from_precision:'year',to_precision:'year'},label:'Reign of Ramesses II',source_ref:SOURCED},
   {kind:'valid',facet_ref:'facet:unplaced',day_ref:'day:2026-10-13',label:'Undated Dynasty'},
   {kind:'valid',facet_ref:'facet:unlabelled',instant:'1400',precision:'year'},
   {kind:'occurred',facet_ref:'facet:event',instant:'1250',precision:'year',label:'not a band'},
  ],
 };
 const before=JSON.stringify(reading);
 const bundle=bundleFromTechneReadings([reading]);
 const view=await createTechneTransport(bundle).loadTimelineView({workspaceId:bundle.workspaceId});
 assert.equal(view.bands.length,3,'one record per validity facet, and no band for an occurrence');
 const result=bands.bandsFromReading(view.bands);
 assert.deepEqual(result.bands.map(b=>b.label),['Reign of Ramesses II'],'the labelled, placed validity facet is drawn with its label');
 assert.equal(result.bands[0].fromMs,Date.UTC(1213,0,1));
 assert.equal(result.bands[0].toMs,Date.UTC(1280,0,1));
 assert.equal(result.bands[0].standing.visual,'sourced');
 assert.deepEqual(result.absent.map(a=>a.id),['facet:unplaced','facet:unlabelled']);
 assert.match(result.absent[0].reason,/no position/);
 assert.match(result.absent[1].reason,/no label/);
 assert.equal(JSON.stringify(reading),before,'the bridge never mutates the native reading');
});

test('the scoped stylesheet copy carries the band rules and the current timeline.css header sha; no band rule animates',async()=>{
 const source=await readFile(new URL('../../vendor/research-canvas/apps/desktop/src/layout/timeline.css',import.meta.url),'utf8');
 const copy=await readFile(new URL('../src/researchInstrumentStyles.css',import.meta.url),'utf8');
 const sha=createHash('sha256').update(source).digest('hex');
 assert.match(copy,new RegExp(`apps/desktop/src/layout/timeline\\.css sha256 ${sha}`),'the copy names the current timeline.css sha');
 // Comments are documentation, not rules: only the rules themselves are checked for motion.
 const rulesOnly=(css)=>css.replace(/\/\*[\s\S]*?\*\//g,'');
 const sourceRules=rulesOnly(source.slice(source.indexOf('/* lane-2 T8')));
 const copyRules=rulesOnly(copy.slice(copy.indexOf('/* lane-2 T8')));
 assert.doesNotMatch(sourceRules,/transition|animation/,'source band rules are static');
 assert.doesNotMatch(copyRules,/transition|animation/,'scoped band rules are static');
 const selectorLines=copyRules.split('\n').filter(line=>/\.timeline-band/.test(line)&&line.trim().endsWith('{')||/^\s*\.timeline-band.*,\s*$/.test(line));
 assert.ok(selectorLines.length>=6,'the band selectors are present');
 for(const line of selectorLines){
  assert.match(line.trim(),/^:where\(\.research-instrument\) \.timeline-band/,`scoped selector: ${line.trim()}`);
 }
});
