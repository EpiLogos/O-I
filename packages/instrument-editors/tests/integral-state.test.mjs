// Independent SOURCE/MODEL proof. No kernel requests, owner acknowledgements,
// Return execution, rendered-UI acceptance, or changes to native fixture refs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {integralFixture,freezeReading,INTEGRAL_FIXTURE_SOURCE} from './integral-fixture.mjs';
import {restoreIntegralComposition,integralMove} from '../src/palace/integralState.ts';
import {deriveComposition,placeAt,palaceBasis,palaceTraversal,addBookmark,removeBookmark} from '../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts';
import {palaceRegions,PALACE_REGION_ORDER} from '../../../desktop/cradle/src/techne/m0m5/palace/regions.ts';
import {palaceReturnInput,palaceReturnRoute,returnCrossing} from '../../../desktop/cradle/src/techne/m0m5/palace/return.ts';
import {resolveActionRoute} from '../../../desktop/cradle/src/techne/m0m5/adapter.ts';
import {validateReading} from '../../../desktop/cradle/src/techne/contract.ts';
import {provingReading} from '../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts';

const fixture=await integralFixture(),reading=freezeReading(fixture.reading),sourceBytes=JSON.stringify(reading);
const copy=value=>structuredClone(value);
const at=(composition,region,ref)=>composition.placements[region].find(item=>item.ref===ref).locus;
const nativeOnly=composition=>{
 for(const region of composition.regions){const refs=new Set(region.entries.map(entry=>entry.ref));assert.ok(composition.placements[region.key].every(item=>refs.has(item.ref)));}
};
const unchanged=()=>assert.equal(JSON.stringify(reading),sourceBytes,'the actual owner fixture must remain byte-equivalent');

test('canonical owner fixture validates and integral derivation discloses only its real refs',()=>{
 assert.equal(fixture.source,INTEGRAL_FIXTURE_SOURCE);assert.match(fixture.literalSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(validateReading(reading),{valid:true,errors:[]});
 const actual=restoreIntegralComposition(reading,undefined),native=deriveComposition(reading);
 assert.deepEqual(actual,native);assert.equal(actual.basis,palaceBasis(reading));nativeOnly(actual);
 assert.deepEqual(actual.regions,palaceRegions(reading));
 assert.deepEqual(actual.regions.find(region=>region.key==='journey').entries.map(entry=>entry.ref),reading.expressions.map(binding=>binding.scene_ref));
 assert.deepEqual(actual.regions.find(region=>region.key==='expression').entries.map(entry=>entry.ref),reading.expressions.map(binding=>binding.expression_ref));
 unchanged();
});

test('a self-produced checkpoint round-trips the exact valid multi-Scene Expression fixture',()=>{
 const original=deriveComposition(reading),checkpoint=copy(original),restored=restoreIntegralComposition(reading,checkpoint);
 assert.deepEqual(restored,original);assert.deepEqual(checkpoint,original);nativeOnly(restored);unchanged();
});

test('duplicate-source restoration preserves complete ordered geometry and refuses excess or missing multiplicity',()=>{
 const original=deriveComposition(reading),ref=reading.expressions[0].expression_ref;
 assert.equal(original.regions.find(region=>region.key==='expression').entries.filter(entry=>entry.ref===ref).length,2);
 const retained=copy(original),positions=retained.placements.expression;
 [positions[0].locus,positions[1].locus]=[positions[1].locus,positions[0].locus];
 const restored=restoreIntegralComposition(reading,retained);
 assert.deepEqual(restored.placements.expression,positions,'source occurrence order and geometry must survive without a rewritten ref');
 assert.deepEqual(restored.regions,original.regions);nativeOnly(restored);
 const excess=copy(original);excess.placements.expression.push(copy(excess.placements.expression[0]));assert.throws(()=>restoreIntegralComposition(reading,excess),/native source multiplicity/);
 const missing=copy(original);missing.placements.expression.pop();assert.throws(()=>restoreIntegralComposition(reading,missing),/complete disclosed position set/);
 assert.deepEqual(original,deriveComposition(reading));unchanged();
});

test('moving an ambiguous Expression ref refuses instead of implicitly choosing a Scene',()=>{
 const original=deriveComposition(reading),before=JSON.stringify(original),ref=reading.expressions[0].expression_ref;
 assert.throws(()=>integralMove(original,'expression',ref,1),/does not distinguish the source occurrences/);
 assert.throws(()=>integralMove(original,'ground','expression:undisclosed',1),/does not distinguish the source occurrences/);
 assert.equal(JSON.stringify(original),before);unchanged();
});

test('integral locus move adopts native swap and preserves every other entry and canonical traversal',()=>{
 const original=deriveComposition(reading),[first,second,third]=original.placements.ground;
 const moved=integralMove(original,'ground',first.ref,1),expected=placeAt(original,'ground',first.ref,second.locus);
 assert.deepEqual(moved,expected);assert.deepEqual(at(moved,'ground',first.ref),second.locus);assert.deepEqual(at(moved,'ground',second.ref),first.locus);assert.deepEqual(at(moved,'ground',third.ref),third.locus);
 for(const key of PALACE_REGION_ORDER.filter(key=>key!=='ground'))assert.deepEqual(moved.placements[key],original.placements[key]);
 const walk=palaceTraversal(moved);assert.deepEqual(walk.slice(0,3).map(step=>step.ref),[second.ref,first.ref,third.ref]);
 assert.deepEqual([...new Set(walk.map(step=>step.region))],PALACE_REGION_ORDER.filter(key=>moved.regions.some(region=>region.key===key)));
 assert.deepEqual(original,deriveComposition(reading));nativeOnly(moved);unchanged();
});

test('all 24 integral loci use the actual bounded native room grammar and invalid slots refuse',()=>{
 const original=deriveComposition(reading),ref=original.placements.ground[0].ref;
 for(let slot=0;slot<24;slot++){const locus=at(integralMove(original,'ground',ref,slot),'ground',ref);assert.equal((locus.room.row*3+locus.room.column)*4+locus.locus,slot);}
 for(const slot of [-1,24,.5,NaN,Infinity])assert.throws(()=>integralMove(original,'ground',ref,slot),/24 loci/);
 assert.deepEqual(original,deriveComposition(reading));unchanged();
});

test('restoration refuses foreign subject/reading bases, foreign refs, cross-region refs and malformed loci',()=>{
 const checkpoint=deriveComposition(reading);
 for(const foreign of [{...reading,reading_ref:reading.reading_ref+'-later'},{...reading,subject:{...reading.subject,subject_ref:'wiki:node:another'}}]){assert.equal(validateReading(foreign).valid,true);assert.throws(()=>restoreIntegralComposition(foreign,checkpoint),/another source reading/);}
 for(const ref of ['expression:unrelated',reading.spatial[0].place_ref]){const value=copy(checkpoint);value.placements.ground[0].ref=ref;assert.throws(()=>restoreIntegralComposition(reading,value),/disclosed native material/);}
 for(const bad of [{room:{row:2,column:0},locus:0},{room:{row:0,column:3},locus:0},{room:{row:0,column:0},locus:4},{room:{row:.5,column:0},locus:0},null]){const value=copy(checkpoint);value.placements.ground[0].locus=bad;assert.throws(()=>restoreIntegralComposition(reading,value),/disclosed native material/);}
 const duplicate=copy(checkpoint);duplicate.placements.ground.push(copy(duplicate.placements.ground[0]));assert.throws(()=>restoreIntegralComposition(reading,duplicate),/native source multiplicity/);
 assert.deepEqual(checkpoint,deriveComposition(reading));unchanged();
});

test('restoration re-derives current source metadata and cannot restore an invented region or stale binding',()=>{
 const checkpoint=deriveComposition(reading);checkpoint.regions=[{key:'ground',entries:[{ref:'expression:injected',revision:'forged'}]}];checkpoint.expressions.placements=[{expression_ref:'expression:injected',locus:{room:{column:0,row:0},locus:0}}];
 const current=freezeReading({...copy(reading),snapshot:{...reading.snapshot,revision:'rev-2'},expressions:reading.expressions.map(binding=>({...binding,revision:'8'}))});
 assert.equal(validateReading(current).valid,true);const currentBytes=JSON.stringify(current);
 const restored=restoreIntegralComposition(current,checkpoint),native=deriveComposition(current);
 assert.deepEqual(restored.regions,native.regions);assert.deepEqual(restored.expressions,native.expressions);assert.ok(restored.regions.find(region=>region.key==='expression').entries.every(entry=>entry.revision==='8'));
 assert.ok(!palaceTraversal(restored).some(step=>step.ref==='expression:injected'));assert.equal(JSON.stringify(current),currentBytes);unchanged();
});

test('native bookmarks capture exact positions, remain idempotent and restoration drops foreign bookmarks',()=>{
 const original=deriveComposition(reading),ref=original.placements.ground[0].ref,moved=integralMove(original,'ground',ref,1),marked=addBookmark(moved,'ground',ref);
 assert.deepEqual(marked.bookmarks,[{region:'ground',ref,locus:at(moved,'ground',ref)}]);assert.equal(addBookmark(marked,'ground',ref),marked);assert.deepEqual(removeBookmark(marked,ref).bookmarks,[]);
 const retained=copy(marked);retained.bookmarks.push({region:'ground',ref:'expression:unrelated',locus:null},{region:'sources',ref,locus:null});
 const restored=restoreIntegralComposition(reading,retained);assert.deepEqual(restored.bookmarks,marked.bookmarks);assert.deepEqual(at(restored,'ground',ref),at(moved,'ground',ref));unchanged();
});

test('anonymous temporal/source absences never create addressable Palace positions or Return material',()=>{
 assert.ok(reading.temporal[0].facet_ref);const original=deriveComposition(reading);
 assert.ok(!original.regions.some(region=>region.key==='relation'));assert.ok(!palaceTraversal(original).some(step=>step.ref===reading.temporal[0].facet_ref));
 const absent=copy(reading);delete absent.whole;delete absent.expressions;delete absent.spatial;delete absent.provenance;
 assert.equal(validateReading(absent).valid,true);const empty={...deriveComposition(absent),bound:true};assert.deepEqual(empty.regions,[]);assert.deepEqual(palaceTraversal(empty),[]);assert.equal(palaceReturnInput(absent,empty),null);assert.equal(palaceReturnRoute(absent,empty),null);
 const anonymous=copy(reading);anonymous.provenance[0].source_ref='';assert.equal(validateReading(anonymous).valid,false);unchanged();
});

test('Return routing preserves real source refs and distinguishes routing from native execution',()=>{
 const original={...deriveComposition(reading),bound:true};assert.equal(palaceReturnRoute(reading,original),null,'the canonical fixture does not disclose a governed-write Return');
 const input=palaceReturnInput(reading,original);assert.equal(input.basis_ref,reading.reading_ref);assert.equal(input.subject_ref,reading.subject.subject_ref);assert.equal(input.expression_ref,reading.expressions[0].expression_ref);assert.ok(!input.composed_refs.includes(reading.temporal[0].facet_ref));
 // This is the production in-tree proving-reading source, with its own
 // pinned TB0 provenance and disclosed aikit.wiki.stage governed-write route.
 const proving=freezeReading(provingReading());assert.equal(validateReading(proving).valid,true);const before=JSON.stringify(proving),composition={...deriveComposition(proving),bound:true},compositionBytes=JSON.stringify(composition);
 const route=palaceReturnRoute(proving,composition),action=proving.actions.find(action=>action.authority==='governed-write');assert.ok(route);assert.equal(route.action_ref,action.action_ref);assert.equal(route.subject_ref,proving.subject.subject_ref);assert.equal(route.input.basis_ref,proving.reading_ref);
 assert.deepEqual(route.input.regions.map(region=>region.member.expression_ref),proving.expressions.map(binding=>binding.expression_ref));assert.deepEqual(route.input.regions.map(region=>region.member.revision),proving.expressions.map(binding=>binding.revision));
 const receipt=resolveActionRoute(proving,route);assert.equal(receipt.routed,true);assert.equal(receipt.native_owner,action.native_owner);assert.equal(receipt.authority,action.authority);assert.deepEqual(receipt.expected_effects,action.expected_effects);assert.equal(receipt.accepted,undefined,'routing supplies no native execution acknowledgement');
 const foreign=resolveActionRoute(proving,{...route,subject_ref:reading.subject.subject_ref});assert.equal(foreign.routed,false);
 const withdrawn=resolveActionRoute({...proving,actions:proving.actions.filter(candidate=>candidate.action_ref!==route.action_ref)},route);assert.equal(withdrawn.routed,false);
 assert.deepEqual(returnCrossing(proving),{instrument:'project'});assert.equal(JSON.stringify(proving),before);assert.equal(JSON.stringify(composition),compositionBytes);unchanged();
});
