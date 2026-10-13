/** Placemark authoring — lane-4 T17 (click to create), T18 (saved places carry
 * their source basis; refusals shown verbatim), T19 (drag to refine, precision
 * kept). Pure proof, no DOM, no maplibre, no kernel.
 *
 * Loads `vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring.ts`
 * through the same esbuild-in-tmp pattern as `places-navigation.test.mjs`.
 *
 * The refusal strings are the native owner's own words, copied from
 * `desktop/cradle/kernel/src/construction.rs` (the source-basis and exact-revision
 * refusals) and `desktop/cradle/kernel/src/construction_source.rs` (the stale
 * source). The native regression asserts the same words at
 * `tests/place-set-action-native.test.mjs:28-40`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-authoring-'));
 try{
  const source=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring.ts');
  const out=join(temporary,'places-authoring.mjs');
  await build({
   stdin:{contents:`export * from ${JSON.stringify(source)};`,resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const LONDON={latitude:51.5074,longitude:-0.1278};
const MOVED={latitude:51.5101,longitude:-0.0921};
const BASIS='wiki:source:survey-london';
const NATIVE_BASIS_REFUSAL='Facet source wiki:source:survey requires one unique disclosed source basis';
const NATIVE_REVISION_REFUSAL='A selected source requires its exact owner revision';
const NATIVE_STALE_REFUSAL='source_revision_conflict: wiki:source:survey changed or was redirected; inspect and reconcile';

function proposal(overrides={}){
 return api.moveProposal({graphNodeId:'wiki:place:london',title:'London survey point',precision:'approximate',geometry:'point',from:LONDON,to:MOVED,source_ref:BASIS,...overrides});
}

// ---------------------------------------------------------------------------
// T17 — the context menu
// ---------------------------------------------------------------------------

test('an empty-map menu offers Add place here and no edit item', ()=>{
 const items=api.placeMenuItems({graphNodeId:null,at:LONDON},{canAuthor:true});
 assert.deepEqual(items.map(item=>item.label),['Add place here']);
 assert.equal(items[0].enabled,true);
 assert.equal(items[0].reason,null);
});

test('a marker menu adds Edit place… beside Add place here', ()=>{
 const items=api.placeMenuItems({graphNodeId:'wiki:place:london',at:LONDON},{canAuthor:true});
 assert.deepEqual(items.map(item=>item.label),['Add place here','Edit place…']);
 assert.deepEqual(items.map(item=>item.action),['add','edit']);
 assert.ok(items.every(item=>item.enabled));
});

test('with no authoring route both items are disabled and name the reason', ()=>{
 const items=api.placeMenuItems({graphNodeId:'wiki:place:london',at:LONDON},{canAuthor:false});
 assert.ok(items.every(item=>!item.enabled));
 assert.ok(items.every(item=>/no native Scene entity bound/.test(item.reason??'')));
 const owned=api.placeMenuItems({graphNodeId:null,at:LONDON},{canAuthor:false,unavailableReason:'The owner refused the route.'});
 assert.equal(owned[0].reason,'The owner refused the route.');
});

test('a pointer outside the coordinates cannot add a place', ()=>{
 const items=api.placeMenuItems({graphNodeId:null,at:{latitude:Number.NaN,longitude:0}},{canAuthor:true});
 assert.equal(items[0].enabled,false);
 assert.match(items[0].reason??'',/outside the map/);
});

// ---------------------------------------------------------------------------
// T17 — a click never claims exactness
// ---------------------------------------------------------------------------

test('a click prefills an approximate point, never exact', ()=>{
 for(const at of [LONDON,{latitude:0,longitude:0},{latitude:-89.9,longitude:179.9},{latitude:90,longitude:-180}]){
  const prefill=api.prefillFromClick(at);
  assert.equal(prefill.ok,true);
  assert.equal(prefill.precision,'approximate');
  assert.notEqual(prefill.precision,'exact');
  assert.match(prefill.note,/approximate position, not a surveyed fix/);
 }
});

test('the prefilled coordinate is rounded to five decimals, not a false survey fix', ()=>{
 const prefill=api.prefillFromClick({latitude:51.50741234567,longitude:-0.12780987654});
 assert.equal(prefill.latitude,51.50741);
 assert.equal(prefill.longitude,-0.12781);
});

test('a point outside the coordinate ranges prefills nothing and says why', ()=>{
 for(const at of [{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:Number.NaN,longitude:0},{latitude:'51' ,longitude:0}]){
  const prefill=api.prefillFromClick(at);
  assert.equal(prefill.ok,false);
  assert.match(prefill.reason,/outside the map's coordinates/);
  assert.equal(prefill.latitude,undefined);
 }
});

test('the add notice names the clicked point as approximate and says it is not yet carried in', ()=>{
 const notice=api.addRouteNotice(api.prefillFromClick(LONDON));
 assert.match(notice,/51\.50740, -0\.12780/);
 assert.match(notice,/as an approximate point/);
 assert.match(notice,/opens without this point carried in/);
});

// ---------------------------------------------------------------------------
// T17 — touch long-press
// ---------------------------------------------------------------------------

test('a long press opens the menu at 500 ms and not before, and never after a drag', ()=>{
 assert.equal(api.LONG_PRESS_MS,500);
 assert.equal(api.longPressFires(499,0),false);
 assert.equal(api.longPressFires(500,0),true);
 assert.equal(api.longPressFires(900,10),true);
 assert.equal(api.longPressFires(900,10.5),false,'a touch that travelled past the slop is a drag');
 assert.equal(api.longPressFires(Number.NaN,0),false);
});

// ---------------------------------------------------------------------------
// T19 — which markers drag, and how precision is kept
// ---------------------------------------------------------------------------

test('exact positions never drag, and the reason is named', ()=>{
 const eligible=api.dragEligibility('exact','point');
 assert.equal(eligible.ok,false);
 assert.match(eligible.reason,/Exact positions do not drag/);
});

test('approximate and region points drag, keeping their own precision', ()=>{
 assert.deepEqual(api.dragEligibility('approximate','point'),{ok:true,precision:'approximate'});
 assert.deepEqual(api.dragEligibility('region','point'),{ok:true,precision:'region'});
});

test('an unlocated place, an undisclosed precision and a polygon do not drag', ()=>{
 assert.equal(api.dragEligibility('unlocated','point').ok,false);
 assert.match(api.dragEligibility('unlocated','point').reason,/no position on the map/);
 assert.equal(api.dragEligibility('',"point").ok,false);
 assert.match(api.dragEligibility('approximate','polygon').reason,/drawn as its polygon/);
});

test('a drag proposes a pending move naming the old and the new coordinate and the basis', ()=>{
 const result=proposal();
 assert.equal(result.ok,true);
 assert.equal(result.proposal.status,'pending');
 assert.deepEqual(result.proposal.from,LONDON);
 assert.deepEqual(result.proposal.to,{latitude:51.5101,longitude:-0.0921});
 assert.equal(result.proposal.basis,BASIS);
 const summary=api.proposalSummary(result.proposal);
 assert.match(summary,/London survey point: 51\.50740, -0\.12780 → 51\.51010, -0\.09210/);
 assert.match(summary,/approximate/);
 assert.match(summary,/basis wiki:source:survey-london$/);
});

test('precision never upgrades by dragging: the proposal keeps the reading precision', ()=>{
 for(const precision of ['approximate','region']){
  const result=proposal({precision});
  assert.equal(result.ok,true);
  assert.equal(result.proposal.precision,precision);
  assert.notEqual(result.proposal.precision,'exact');
 }
});

test('an exact marker proposes nothing, however far it is dragged', ()=>{
 const result=proposal({precision:'exact'});
 assert.equal(result.ok,false);
 assert.equal('proposal' in result,false);
 assert.match(result.reason,/Exact positions do not drag/);
});

test('a move without a disclosed source basis is refused before any route is offered (T18)', ()=>{
 for(const source_ref of [undefined,null,'','   ']){
  const result=proposal({source_ref});
  assert.equal(result.ok,false);
  assert.equal('proposal' in result,false);
  assert.match(result.reason,/discloses no source basis/);
 }
});

test('a drop back onto the same point is no move', ()=>{
 const result=proposal({to:{...LONDON}});
 assert.equal(result.ok,false);
 assert.match(result.reason,/did not move/);
});

test('coordinates that are not on the globe cannot become a proposal', ()=>{
 const result=proposal({to:{latitude:120,longitude:0}});
 assert.equal(result.ok,false);
 assert.match(result.reason,/outside the map's coordinates/);
});

// ---------------------------------------------------------------------------
// T18 — refusals are the owner's words, shown verbatim
// ---------------------------------------------------------------------------

test('the native refusals are classified by the words the owner uses', ()=>{
 assert.equal(api.refusalKind(NATIVE_BASIS_REFUSAL),'source-basis');
 assert.equal(api.refusalKind(NATIVE_REVISION_REFUSAL),'nested-evidence');
 assert.equal(api.refusalKind(NATIVE_STALE_REFUSAL),'stale-source');
 assert.equal(api.refusalKind('The native object changed since these inputs were read. Inspect the current revision; your inputs are retained.'),'stale-revision');
 assert.equal(api.refusalKind('Something the owner did not foresee'),'other');
});

test('a refusal is shown with the owner’s message unchanged', ()=>{
 for(const message of [NATIVE_BASIS_REFUSAL,NATIVE_REVISION_REFUSAL,NATIVE_STALE_REFUSAL,'  spaced  refusal. ']){
  const notice=api.refusalNotice(message);
  assert.equal(notice.text,message,'the text is the owner’s, byte for byte');
 }
});

test('the move notice carries the proposal and the honest gap, and does not claim a save', ()=>{
 const notice=api.moveRouteNotice(proposal().proposal);
 assert.match(notice,/Proposed move: London survey point/);
 assert.match(notice,/opens without this proposal carried in/);
 assert.match(notice,/the owner checks the basis when you save/);
 assert.doesNotMatch(notice,/saved|written|persisted/i);
});

test('the coordinate format is fixed to five decimals, latitude first', ()=>{
 assert.equal(api.formatCoordinate({latitude:1,longitude:-2.5}),'1.00000, -2.50000');
});
