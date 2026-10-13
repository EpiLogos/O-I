/** Lane-2 T20 — the traversal glue. The pure trail (navigationIdentity.ts) is bundled as the mount imports it; the vendored
 * cause-chain panel is rendered as the Timeline now renders it; the mount and the vendored surface are read for the wiring the
 * ticket requires. Subject and selection refs are asserted byte-equal at every hop. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');
const cradle=resolve(engine,'../../src/techne');
const timeline=resolve(engine,'../vendor/research-canvas/packages/canvas/src/timeline');

let api;
let view;
let temporary;
test.before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'oi-timeline-traversal-glue-'));
 const pure=join(temporary,'traversal-pure.mjs');
 await build({
  stdin:{
   contents:[
    `export * from ${JSON.stringify(resolve(cradle,'m0m5/timeline/navigationIdentity.ts'))};`,
    `export {createDisclosureSessionStore} from ${JSON.stringify(resolve(cradle,'session.ts'))};`,
    `export {groundSelection} from ${JSON.stringify(resolve(cradle,'m0m5/reading.ts'))};`,
    `export {provingReading,PROVING_SUBJECT_REF} from ${JSON.stringify(resolve(cradle,'m0m5/journey/proving-reading.ts'))};`,
   ].join('\n'),
   resolveDir:engine,
  },
  bundle:true,format:'esm',platform:'neutral',outfile:pure,logLevel:'silent',
 });
 api=await import(`${pure}?t=${Date.now()}`);
 const rendered=join(temporary,'timeline-chain-view.cjs');
 await build({
  stdin:{
   contents:[
    `export {CauseChainPanel} from ${JSON.stringify(resolve(timeline,'TimelineRelationshipLayer.tsx'))};`,
    `export {createElement} from 'react';`,
    `export {renderToStaticMarkup} from 'react-dom/server';`,
   ].join('\n'),
   resolveDir:engine,
   loader:'ts',
  },
  bundle:true,format:'cjs',platform:'node',outfile:rendered,logLevel:'silent',
  loader:{'.tsx':'tsx','.ts':'ts'},
  jsx:'automatic',nodePaths:[resolve(engine,'../node_modules')],
 });
 view=createRequire(import.meta.url)(rendered);
});
test.after(async()=>{if(temporary)await rm(temporary,{recursive:true,force:true});});

const EVENT='ql.techne:facet:tb0:authored';
const PLACE='place:fixture:royal-observatory-greenwich';
const NATIVE='rel:native:causes:1';

/** A session on the proving reading, as the mount holds it: one subject, one selection, one reading basis. */
function session(){
 const reading=api.provingReading();
 const store=api.createDisclosureSessionStore();
 return store.setSelection(api.groundSelection(reading,'timeline'));
}

test('the trail states where it stands: event, then relation, then endpoint', ()=>{
 const s=session();
 const origin=api.trailFromEvent(EVENT,s.subject_ref,s.selection.selection_ref);
 assert.equal(api.trailStanding(origin),'event');
 const onRelation=api.openRelation(origin,{relation_ref:NATIVE,from_ref:EVENT,to_ref:PLACE});
 assert.equal(onRelation.ok,true);
 assert.equal(api.trailStanding(onRelation.trail),'event → relation');
 const onEndpoint=api.openEndpoint(onRelation.trail,'to');
 assert.equal(onEndpoint.ok,true);
 assert.equal(api.trailStanding(onEndpoint.trail),'event → relation → endpoint');
});

test('a relation carries its native ref only when the bridge disclosed one', ()=>{
 assert.equal(api.relationRefOf({native_relation_ref:NATIVE}),NATIVE);
 assert.equal(api.relationRefOf({}),null);
 assert.equal(api.relationRefOf({native_relation_ref:''}),null);
 assert.equal(api.relationRefOf({native_relation_ref:null}),null);
});

test('subject_ref and selection_ref stay byte-equal at every hop, and back returns along the trail', ()=>{
 const s=session();
 const origin=api.trailFromEvent(EVENT,s.subject_ref,s.selection.selection_ref);
 const onRelation=api.openRelation(origin,{relation_ref:NATIVE,from_ref:EVENT,to_ref:PLACE});
 const onEndpoint=api.openEndpoint(onRelation.trail,'to');
 for(const hop of onEndpoint.trail.hops){
  assert.equal(hop.subject_ref,s.subject_ref);
  assert.equal(hop.selection_ref,s.selection.selection_ref);
 }
 const backOnce=api.backTrail(onEndpoint.trail);
 assert.equal(api.currentHop(backOnce).kind,'relation');
 const backTwice=api.backTrail(backOnce);
 assert.equal(api.currentHop(backTwice).kind,'event');
 assert.deepEqual(api.originEvent(backTwice),{ref:EVENT,subject_ref:s.subject_ref,selection_ref:s.selection.selection_ref});
 assert.deepEqual(api.backTrail(backTwice),backTwice);
});

test('a derived relation is refused by name, in the model\'s own words', ()=>{
 const s=session();
 const origin=api.trailFromEvent(EVENT,s.subject_ref,s.selection.selection_ref);
 const refused=api.openRelation(origin,{relation_ref:null,from_ref:EVENT,to_ref:PLACE});
 assert.deepEqual(refused,{ok:false,reason:'derived (no native relation_ref disclosed)'});
});

test('a relation that does not touch the event is refused, and an endpoint never opens from the event', ()=>{
 const s=session();
 const origin=api.trailFromEvent(EVENT,s.subject_ref,s.selection.selection_ref);
 assert.deepEqual(api.openRelation(origin,{relation_ref:NATIVE,from_ref:'x:a',to_ref:'x:b'}),{ok:false,reason:'This relation does not touch the event it was opened from.'});
 assert.deepEqual(api.openEndpoint(origin,'from'),{ok:false,reason:'An endpoint opens from its relation.'});
});

test('the cause chain renders each endpoint and relation as a selectable hop only when the mount declares the callbacks', ()=>{
 const chain={id:NATIVE,hops:[{id:NATIVE,relation:'CAUSES',from_ref:EVENT,to_ref:PLACE,standing:{visual:'asserted',verbatim:null},time:null,timeNote:null,offset:null}]};
 const common={chain,titleOf:ref=>ref,onFollow:()=>{},onClear:()=>{}};
 const bare=view.renderToStaticMarkup(view.createElement(view.CauseChainPanel,common));
 assert.doesNotMatch(bare,/data-testid="timeline-chain-endpoint-1-from"/);
 assert.doesNotMatch(bare,/data-testid="timeline-chain-relation-1"/);
 const selectable=view.renderToStaticMarkup(view.createElement(view.CauseChainPanel,{
  ...common,
  onOpenRelation:()=>{},
  onOpenEndpoint:()=>{},
 }));
 assert.match(selectable,/data-testid="timeline-chain-relation-1"[^>]*role="button"/);
 assert.match(selectable,/data-testid="timeline-chain-endpoint-1-from"/);
 assert.match(selectable,/data-testid="timeline-chain-endpoint-1-to"/);
});

test('the vendored Timeline forwards relation and endpoint selection to its host without a second selection store', async()=>{
 const surface=await readFile(join(timeline,'TimelineSurface.tsx'),'utf8');
 const lens=await readFile(join(timeline,'TimelineLens.tsx'),'utf8');
 const layer=await readFile(join(timeline,'TimelineRelationshipLayer.tsx'),'utf8');
 assert.match(surface,/onOpenRelation\?:\s*\(relationship: GraphRelationship\) => void/);
 assert.match(surface,/onOpenEndpoint\?:\s*\(relationship: GraphRelationship, side: "from" \| "to"\) => boolean \| void/);
 assert.match(surface,/onOpenRelation=\{onOpenRelation\}/);
 assert.match(surface,/onOpenEndpoint=\{onOpenEndpoint\}/);
 assert.match(lens,/onOpenRelation=\{/);
 assert.match(lens,/onOpenEndpoint=\{/);
 assert.match(layer,/onOpenRelation\?\.\(relationship\)/);
 assert.doesNotMatch(lens,/useState<[^>]*Relationship[^>]*>\(/,'the lens must not keep a second relation selection store');
});

test('the mount drives the trail through the model and states it on the status line, with a Back to event control', async()=>{
 const mount=await readFile(resolve(engine,'src/researchInstruments.tsx'),'utf8');
 for(const name of ['openRelation','openEndpoint','relationRefOf','trailFromEvent','trailOfNavigation','traversalHopOf']){
  assert.match(mount,new RegExp(`\\b${name}\\b`),`the mount imports ${name} from the model`);
 }
 assert.match(mount,/aria-label="Back to event"/);
 assert.match(mount,/Back to event/);
 assert.match(mount,/step\.reason/,'a refused step is stated on the status line in the model\'s own reason');
 assert.match(mount,/foldStanding\(/,'the status line names where the trail stands');
});

test('the traversal hop the model builds is the session\'s own subject and selection, byte-equal, through the recorder', ()=>{
 const reading=api.provingReading();
 const store=api.createDisclosureSessionStore();
 const session=store.setSelection(api.groundSelection(reading,'timeline'));
 const hop=api.traversalHopOf(session,'relation',NATIVE);
 assert.deepEqual(hop,{kind:'traversal',instrument:'timeline',step:'relation',ref:NATIVE,subject_ref:session.subject_ref,selection_ref:session.selection.selection_ref});
 store.recordTraversal(api.traversalHopOf(session,'event',EVENT));
 const recorded=store.recordTraversal(hop);
 assert.equal(recorded.navigation.length,2);
 assert.equal(api.trailOfNavigation(recorded.navigation).steps[0].ref,NATIVE);
});

test('the trail is read from the session navigation: the mount holds no trail of its own', async()=>{
 const mount=await readFile(resolve(engine,'src/researchInstruments.tsx'),'utf8');
 assert.match(mount,/\bwriteSharedTraversalHop\b/,'the mount writes its hops through the shared writer');
 assert.match(mount,/writeSharedTraversalHop\(request,/,'every hop is written through the shared traversal writer');
 assert.ok((mount.match(/runSteps\(/g)??[]).length>=3,'open relation, open endpoint and back each write their hops through the one route');
 assert.match(mount,/trailOfNavigation\(/,'the mount reads the trail from the session\'s navigation');
 assert.doesNotMatch(mount,/state\.traversal=\{hops|hops:\[\.\.\./,'the mount does not build a trail of its own');
 const writer=await readFile(resolve(engine,'src/sharedTimeWindow.tsx'),'utf8');
 assert.match(writer,/export async function writeSharedTraversalHop\(/);
 assert.match(writer,/operation:'traversal'/);
 const boundary=await readFile(resolve(engine,'../../../../packages/expressions-boundary/src/timeWindow.ts'),'utf8');
 assert.match(boundary,/operation:\s*'traversal'/,'the owner\'s compare-and-set accepts the traversal operation');
 assert.match(boundary,/store\.recordTraversal\(/);
});
