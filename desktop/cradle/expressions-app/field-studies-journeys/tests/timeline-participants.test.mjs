// lane-2 T14 — participant spans behind the event cards. The authority reads a
// participant's validity (the subject's validity facets and a place's valid_from /
// valid_to) honestly; the vendored geometry places each span on the lens camera,
// writes the participant's label once, keeps an open side open, and stacks overlaps.
// Fixture: a person 1874–1951 with three dated events, and an undated death (open).
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const compiled=await build({stdin:{contents:"export * as relations from '../../../src/techne/m0m5/timeline/relations.ts';export * as scale from '../../../src/techne/m0m5/timeline/scale.ts';export * as participantSpans from '../../vendor/research-canvas/packages/canvas/src/timeline/participantSpans.ts';export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {relations,scale,participantSpans,viewport}=api;

// A person's life: one validity interval, 1874 to 1951, each end at its own year precision.
const personReading=(validity)=>({
 reading_ref:'reading:person',
 subject:{subject_ref:'person:ada',native_owner:'owner:test'},
 temporal:[
  ...validity,
  {kind:'occurrence',facet_ref:'event:1880',instant:'1880',precision:'year'},
  {kind:'occurrence',facet_ref:'event:1900',instant:'1900',precision:'year'},
  {kind:'occurrence',facet_ref:'event:1940',instant:'1940',precision:'year'},
 ],
});
const DATED={kind:'valid',facet_ref:'life:ada',interval:{from:'1874',to:'1951',from_precision:'year',to_precision:'year'}};
const UNDATED_DEATH={kind:'valid',facet_ref:'life:ada',interval:{from:'1874',from_precision:'year'}};
const SPAN_FROM=scale.expandInstant('1874','year').fromMs;
const SPAN_TO=scale.expandInstant('1951','year').toMs;

test('the subject validity 1874 to 1951 is the authority extent: each end at its own precision', ()=>{
 const {spans,absent}=relations.participantSpansFromReading(personReading([DATED]));
 assert.deepEqual(absent,[]);
 assert.equal(spans.length,1);
 assert.equal(spans[0].participant_ref,'person:ada');
 assert.equal(spans[0].participant_kind,'subject');
 assert.equal(spans[0].fromMs,SPAN_FROM,'starts at the start of 1874');
 assert.equal(spans[0].toMs,SPAN_TO,'ends at the end of 1951, inclusive');
});

test('the three dated events fall inside the person span; the span is the participant, not the events', ()=>{
 const {spans}=relations.participantSpansFromReading(personReading([DATED]));
 for(const year of [1880,1900,1940]){
  const at=scale.expandInstant(String(year),'year').fromMs;
  assert.ok(at>=spans[0].fromMs && at<spans[0].toMs,`${year} lies within the span`);
 }
});

test('an undated death leaves the span open at its end: no end is invented', ()=>{
 const {spans,absent}=relations.participantSpansFromReading(personReading([UNDATED_DEATH]));
 assert.deepEqual(absent,[]);
 assert.equal(spans[0].fromMs,SPAN_FROM);
 assert.equal(spans[0].toMs,null,'toMs is null: open, never a fabricated 1951');
});

test('validity with no dated side is named as absent, never drawn', ()=>{
 const refOnly={kind:'valid',facet_ref:'life:undated',day_ref:'day:2026-10-13'};
 const {spans,absent}=relations.participantSpansFromReading(personReading([refOnly]));
 assert.deepEqual(spans,[]);
 assert.equal(absent.length,1);
 assert.equal(absent[0].participant_ref,'person:ada');
 assert.match(absent[0].reason,/no dated extent/);
});

test('a place carries its valid_from and valid_to as its own participant span', ()=>{
 const reading={
  reading_ref:'reading:place',
  subject:{subject_ref:'person:ada',native_owner:'owner:test'},
  temporal:[],
  spatial:[
   {place_ref:'place:mill',precision:'exact',valid_from:'1850',valid_to:'1900',uncertainty:'the mill closed by 1900'},
   {place_ref:'place:open',precision:'exact',valid_from:'1860',valid_to:null},
   {place_ref:'place:nothing',precision:'region'},
  ],
 };
 const {spans,absent}=relations.participantSpansFromReading(reading);
 assert.deepEqual(absent,[]);
 const mill=spans.find(span=>span.participant_ref==='place:mill');
 assert.equal(mill.participant_kind,'place');
 assert.equal(mill.fromMs,scale.parseTimestamp('1850'));
 assert.equal(mill.toMs,scale.parseTimestamp('1900'));
 assert.equal(mill.uncertainty,'the mill closed by 1900');
 const open=spans.find(span=>span.participant_ref==='place:open');
 assert.equal(open.toMs,null,'a place with no valid_to stays open');
 assert.equal(spans.some(span=>span.participant_ref==='place:nothing'),false,'a place with no validity is not a span');
});

test('the span geometry on the lens camera: left and width from the same ms camera the cards use', ()=>{
 const {spans}=relations.participantSpansFromReading(personReading([DATED]));
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const [mark]=participantSpans.participantMarks(spans,camera);
 assert.equal(mark.leftPx,viewport.msToPixel(camera,SPAN_FROM));
 assert.equal(mark.widthPx,viewport.msToPixel(camera,SPAN_TO)-viewport.msToPixel(camera,SPAN_FROM));
 assert.equal(mark.openStart,false);
 assert.equal(mark.openEnd,false);
 assert.equal(mark.label,'person:ada','the label is the participant ref, verbatim');
});

test('an open end runs to the view edge, marked open, and an open start runs from the left edge', ()=>{
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const [mark]=participantSpans.participantMarks(
  relations.participantSpansFromReading(personReading([UNDATED_DEATH])).spans,
  camera,
 );
 assert.equal(mark.openEnd,true);
 assert.equal(mark.leftPx+mark.widthPx,1000,'the span runs exactly to the right edge of the view');
 const fromStart=participantSpans.participantMarks([{participant_ref:'x',participant_kind:'subject',fromMs:null,toMs:viewport.pixelToMs(camera,400),uncertainty:null,source_ref:null}],camera)[0];
 assert.equal(fromStart.openStart,true);
 assert.equal(fromStart.leftPx,0,'an open start runs from the left edge');
});

test('the label is written once per participant, at its first visible span', ()=>{
 const spans=[
  {participant_ref:'person:ada',participant_kind:'subject',fromMs:scale.expandInstant('1874','year').fromMs,toMs:scale.expandInstant('1880','year').fromMs,uncertainty:null,source_ref:null},
  {participant_ref:'person:ada',participant_kind:'subject',fromMs:scale.expandInstant('1900','year').fromMs,toMs:scale.expandInstant('1951','year').toMs,uncertainty:null,source_ref:null},
 ];
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const marks=participantSpans.participantMarks(spans,camera);
 assert.equal(marks.length,2);
 assert.equal(marks[0].label,'person:ada');
 assert.equal(marks[1].label,null,'the second span carries no label');
});

test('a span wholly outside the view is culled; an overlapping span takes a second row', ()=>{
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const span=(ref,fromYear,toYear)=>({participant_ref:ref,participant_kind:'subject',fromMs:scale.expandInstant(fromYear,'year').fromMs,toMs:scale.expandInstant(toYear,'year').toMs,uncertainty:null,source_ref:null});
 const marks=participantSpans.participantMarks([
  span('a','1874','1951'),
  span('b','1880','1930'),
  span('far','1200','1210'),
 ],camera);
 assert.deepEqual(marks.map(mark=>mark.participant_ref),['a','b'],'the 1200s span is outside the view');
 const rows=Object.fromEntries(marks.map(mark=>[mark.participant_ref,mark.row]));
 assert.equal(rows.a,0);
 assert.equal(rows.b,1,'the overlapping span stacks into its own row');
});

test('the hover title states the validity and carries the uncertainty verbatim', ()=>{
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const [mark]=participantSpans.participantMarks([{participant_ref:'person:ada',participant_kind:'subject',fromMs:SPAN_FROM,toMs:null,uncertainty:'death disputed',source_ref:'source:letter'}],camera);
 assert.match(mark.title,/^person:ada · from 1874, no end disclosed · death disputed · source:letter$/);
});
