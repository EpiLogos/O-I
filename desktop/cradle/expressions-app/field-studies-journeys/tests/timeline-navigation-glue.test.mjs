/** Lane-2 T21–T22 — the pure parts the chronology mount calls (researchInstruments.tsx `globeControl`,
 * `showOnGlobe`, the places-to-timeline crossing guard and the status line). The rules live in
 * `desktop/cradle/src/techne/m0m5/timeline/navigationIdentity.ts`; this bundles the same module the mount
 * imports, so a mount-facing change that stops bundling or changes these results fails here.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
let temporary;
test.before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'oi-timeline-navigation-glue-'));
 const cradle=resolve(engine,'../../src/techne');
 const out=join(temporary,'timeline-navigation-glue.mjs');
 await build({
  stdin:{
   contents:[
    `export * from ${JSON.stringify(resolve(cradle,'m0m5/timeline/navigationIdentity.ts'))};`,
    `export {timeAxisProjection} from ${JSON.stringify(resolve(cradle,'m0m5/timeline/timeAxis.ts'))};`,
    `export {createDisclosureSessionStore,sessionCrossingIdentity} from ${JSON.stringify(resolve(cradle,'session.ts'))};`,
    `export {groundSelection} from ${JSON.stringify(resolve(cradle,'m0m5/reading.ts'))};`,
    `export {provingReading,PROVING_SUBJECT_REF} from ${JSON.stringify(resolve(cradle,'m0m5/journey/proving-reading.ts'))};`,
   ].join('\n'),
   resolveDir:engine,
  },
  bundle:true,
  format:'esm',
  platform:'neutral',
  outfile:out,
  logLevel:'silent',
 });
 api=await import(`${out}?t=${Date.now()}`);
});
test.after(async()=>{if(temporary)await rm(temporary,{recursive:true,force:true});});

const AUTHORED='ql.techne:facet:tb0:authored';
const GREENWICH='place:fixture:royal-observatory-greenwich';

function located(place=GREENWICH){
 const reading=structuredClone(api.provingReading());
 reading.whole.relations=[...(reading.whole.relations??[]),{relation:'LOCATED_AT',from_ref:api.PROVING_SUBJECT_REF,to_ref:place,origin:'native',origin_ref:null}];
 return reading;
}

test('the globe offer the mount renders carries the located place and the event\'s own validity', ()=>{
 const reading=located();
 const store=api.createDisclosureSessionStore();
 const session=store.setSelection(api.groundSelection(reading,'timeline'));
 const event=api.axisEventOf(api.timeAxisProjection(reading,session),AUTHORED);
 const carry=api.showOnGlobeOf(reading,reading.subject.subject_ref,event);
 assert.equal(carry.state,'offer');
 assert.equal(carry.place_ref,GREENWICH);
 assert.deepEqual(carry.window,{from:'2026-09-16T00:00:00+01:00',to:'2026-09-16T00:00:00+01:00'});
});

test('the disabled globe control carries its reason verbatim', ()=>{
 const reading=api.provingReading();
 const carry=api.showOnGlobeOf(reading,reading.subject.subject_ref,undefined);
 assert.equal(carry.state,'absent');
 assert.equal(carry.reason,"No location is disclosed for this event's subject.");
});

test('the crossing the mount plans refuses by name once the session has moved, and never re-targets', ()=>{
 const reading=api.provingReading();
 const store=api.createDisclosureSessionStore();
 const session=store.setSelection(api.groundSelection(reading,'timeline'));
 const planned=api.sessionCrossingIdentity(session);
 assert.equal(api.handoffRefusal(planned,store.get()),null);
 const moved=store.setTimeWindow({from:'2026-01-01T00:00:00+00:00',to:null});
 assert.match(api.handoffRefusal(planned,moved),/window or actual selection\/instrument changed/);
 const other=api.createDisclosureSessionStore().setSelection(api.groundSelection(reading,'place'));
 assert.match(api.handoffRefusal(planned,other),/was not re-targeted/);
});

test('the status line discloses the session as the mount writes it', ()=>{
 const reading=api.provingReading();
 const store=api.createDisclosureSessionStore();
 const session=store.setSelection(api.groundSelection(reading,'timeline'));
 assert.equal(api.handoffDisclosure(session),`Subject ${api.PROVING_SUBJECT_REF} · reading basis ${reading.reading_ref}, revision not disclosed · window none set`);
});
