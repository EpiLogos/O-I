import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';

// Source/model verification only. No native opening, acknowledgement,
// Return execution, fixture mutation or rendered acceptance is simulated.
const source=String.raw`
import test from 'node:test';
import assert from 'node:assert/strict';
import {integralFixture,freezeReading} from './integral-fixture.mjs';
import {integralEntryAt,integralEntryContext,integralBookmark,integralBookmarkPosition} from '../src/palace/entryContext.ts';
import {restoreIntegralComposition,integralMove} from '../src/palace/integralState.ts';
import {deriveComposition,addBookmark,palaceTraversal} from '../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts';
import {validateReading} from '../../../desktop/cradle/src/techne/contract.ts';
const fixture=await integralFixture(),reading=freezeReading(fixture.reading),before=JSON.stringify(reading);
const unchanged=()=>assert.equal(JSON.stringify(reading),before);
const copy=value=>structuredClone(value);

test('duplicate Expression positions map to exact authoritative Scene bindings without rewriting refs',()=>{
 assert.equal(validateReading(reading).valid,true);const composition=deriveComposition(reading),positions=composition.placements.expression;
 assert.equal(positions.length,2);assert.equal(positions[0].ref,positions[1].ref);
 positions.forEach((position,index)=>{const actual=integralEntryAt(composition,'expression',position),context=integralEntryContext(reading,'expression',actual.entry.ref,actual.occurrence);
  assert.equal(actual.occurrence,index);assert.equal(context.expressionBinding,reading.expressions[index],'opening receives the exact reading-owned binding object');assert.equal(actual.entry.ref,reading.expressions[index].expression_ref);assert.equal(context.expressionBinding.scene_ref,reading.expressions[index].scene_ref);
 });
 assert.notEqual(reading.expressions[0].scene_ref,reading.expressions[1].scene_ref);unchanged();
});

test('Journey positions carry the same exact native Expression and distinct Scene context',()=>{
 const composition=deriveComposition(reading);
 composition.placements.journey.forEach(position=>{const actual=integralEntryAt(composition,'journey',position),context=integralEntryContext(reading,'journey',actual.entry.ref,actual.occurrence),binding=reading.expressions.find(binding=>binding.scene_ref===position.ref);
  assert.equal(actual.occurrence,0);assert.equal(context.expressionBinding,binding);assert.equal(actual.entry.ref,binding.scene_ref);assert.equal(actual.entry.note,binding.expression_ref);
 });unchanged();
});

test('late, detached and unknown positions refuse before borrowing an occurrence',()=>{
 const composition=deriveComposition(reading),old=composition.placements.expression[0];
 assert.throws(()=>integralEntryAt(composition,'expression',copy(old)),/no longer in this reading/);
 assert.throws(()=>integralEntryAt(composition,'sources',old),/no longer in this reading/);
 composition.placements.expression=composition.placements.expression.slice(1);assert.throws(()=>integralEntryAt(composition,'expression',old),/no longer in this reading/);
 const invented={ref:'expression:unrelated',locus:{room:{row:0,column:0},locus:0}};composition.placements.expression.push(invented);assert.throws(()=>integralEntryAt(composition,'expression',invented),/no longer disclosed/);unchanged();
});

test('unknown and out-of-range opening contexts refuse rather than dropping exact Scene context',()=>{
 const expression=reading.expressions[0].expression_ref,scene=reading.expressions[0].scene_ref;
 for(const [region,ref,occurrence] of [['expression',expression,2],['journey',scene,1],['expression','expression:unrelated',0],['journey','expression:unrelated:scene:main',0]])assert.throws(()=>integralEntryContext(reading,region,ref,occurrence),/occurrence|disclosed|context|binding/i);
 for(const occurrence of [-1,.5,NaN,Infinity])assert.throws(()=>integralEntryContext(reading,'expression',expression,occurrence),/occurrence/);
 assert.deepEqual(integralEntryContext(reading,'ground',reading.whole.whole_ref,0),{},'a non-Expression region must not acquire an invented binding');unchanged();
});

test('recovery retains duplicate occurrence order and geometry with current authoritative contexts',()=>{
 const initial=deriveComposition(reading),retained=copy(initial),positions=retained.placements.expression;
 [positions[0].locus,positions[1].locus]=[positions[1].locus,positions[0].locus];
 const recovered=restoreIntegralComposition(reading,retained);assert.deepEqual(recovered.placements.expression,positions);
 recovered.placements.expression.forEach((position,index)=>{const actual=integralEntryAt(recovered,'expression',position),context=integralEntryContext(reading,'expression',actual.entry.ref,actual.occurrence);assert.equal(context.expressionBinding,reading.expressions[index]);assert.deepEqual(position.locus,positions[index].locus);});
 assert.throws(()=>integralEntryAt(recovered,'expression',initial.placements.expression[0]),/no longer in this reading/);
 assert.deepEqual(recovered.regions,deriveComposition(reading).regions);assert.equal(palaceTraversal(recovered).length,palaceTraversal(initial).length);unchanged();
});

test('valid native bookmark geometry survives recovery without changing its source ref',()=>{
 const initial=deriveComposition(reading),ref=initial.placements.journey[1].ref,marked=addBookmark(initial,'journey',ref),retained=copy(marked);
 const recovered=restoreIntegralComposition(reading,retained);assert.deepEqual(recovered.bookmarks,marked.bookmarks);assert.equal(recovered.bookmarks[0].ref,reading.expressions[1].scene_ref);assert.deepEqual(recovered.bookmarks[0].locus,initial.placements.journey[1].locus);unchanged();
});

test('bookmarking duplicate occurrence one recovers and opens its exact second native Scene context',()=>{
 const original=deriveComposition(reading),first=original.placements.expression[0],second=original.placements.expression[1];
 const marked=integralBookmark(original,'expression',second);
 assert.deepEqual(marked.bookmarks,[{region:'expression',ref:reading.expressions[1].expression_ref,locus:second.locus}]);
 const selected=integralBookmarkPosition(marked,marked.bookmarks[0]);assert.equal(selected.placement,second);assert.equal(selected.occurrence,1);assert.equal(selected.entry.revision,reading.expressions[1].revision);
 const opening=integralEntryContext(reading,'expression',selected.entry.ref,selected.occurrence);assert.equal(opening.expressionBinding,reading.expressions[1]);assert.equal(opening.expressionBinding.scene_ref,reading.expressions[1].scene_ref);
 const recovered=restoreIntegralComposition(reading,copy(marked)),reopened=integralBookmarkPosition(recovered,recovered.bookmarks[0]);
 assert.equal(reopened.occurrence,1);assert.equal(integralEntryContext(reading,'expression',reopened.entry.ref,reopened.occurrence).expressionBinding,reading.expressions[1]);
 assert.deepEqual(integralBookmark(recovered,'expression',reopened.placement).bookmarks,[],'toggling the exact selected source position removes its native bookmark');
 const firstMarked=integralBookmark(original,'expression',first),secondMarked=integralBookmark(firstMarked,'expression',second);
 assert.equal(secondMarked.bookmarks.length,1,'native addBookmark remains idempotent by ref');assert.deepEqual(secondMarked.bookmarks[0].locus,second.locus,'selecting another source occurrence updates the captured position');
 assert.throws(()=>integralBookmark(original,'expression',copy(second)),/no longer in this reading/);unchanged();
});

test('native mark then unique Scene move recovers its captured bookmark and resolves the current exact Scene',()=>{
 const initial=deriveComposition(reading),ref=reading.expressions[1].scene_ref,marked=addBookmark(initial,'journey',ref),captured=copy(marked.bookmarks[0]);
 const moved=integralMove(marked,'journey',ref,2),recovered=restoreIntegralComposition(reading,copy(moved));assert.deepEqual(recovered.bookmarks,[captured]);
 const current=integralBookmarkPosition(recovered,recovered.bookmarks[0]);assert.equal(current.entry.ref,ref);assert.equal(current.placement.locus.locus,2);assert.notDeepEqual(current.placement.locus,captured.locus);
 assert.equal(integralEntryContext(reading,'journey',current.entry.ref,current.occurrence).expressionBinding,reading.expressions[1]);unchanged();
});

test('a duplicate-source bookmark cannot borrow an undisclosed locus or a foreign source ref',()=>{
 const initial=deriveComposition(reading),marked=integralBookmark(initial,'expression',initial.placements.expression[1]),unknown={region:'expression',ref:reading.expressions[1].expression_ref,locus:{room:{row:1,column:2},locus:3}};
 assert.throws(()=>integralBookmarkPosition(initial,unknown),/one disclosed source occurrence/);
 const retained=copy(marked);retained.bookmarks=[unknown];assert.throws(()=>restoreIntegralComposition(reading,retained),/bookmark.*disclosed position/);
 assert.throws(()=>integralBookmarkPosition(initial,{...unknown,ref:'expression:unrelated'}),/one disclosed source occurrence/);unchanged();
});

test('recovery refuses repeated bookmark refs even at distinct valid native occurrence loci',()=>{
 const initial=deriveComposition(reading),marked=integralBookmark(initial,'expression',initial.placements.expression[1]),retained=copy(marked);
 retained.bookmarks.push({region:'expression',ref:reading.expressions[0].expression_ref,locus:copy(initial.placements.expression[0].locus)});
 assert.equal(retained.bookmarks[0].ref,retained.bookmarks[1].ref);assert.notDeepEqual(retained.bookmarks[0].locus,retained.bookmarks[1].locus);
 assert.throws(()=>restoreIntegralComposition(reading,retained),/bookmark/i,'native addBookmark owns one bookmark identity per unchanged source ref');
 assert.deepEqual(marked.bookmarks,[{region:'expression',ref:reading.expressions[1].expression_ref,locus:initial.placements.expression[1].locus}]);unchanged();
});

test('malformed bookmark geometry is refused on otherwise disclosed native refs',()=>{
 const initial=deriveComposition(reading),ref=initial.placements.ground[0].ref,marked=addBookmark(initial,'ground',ref);
 const invalid=[{room:{row:2,column:0},locus:0},{room:{row:0,column:3},locus:0},{room:{row:0,column:0},locus:4},{room:{row:0,column:0},locus:-1},{room:{row:.5,column:0},locus:0},{room:{row:0,column:0},locus:NaN},{room:{row:0,column:0},locus:Infinity},{room:{row:0,column:0},locus:'1'},[],{}];
 for(const locus of invalid){const retained=copy(marked);retained.bookmarks[0].locus=locus;assert.throws(()=>restoreIntegralComposition(reading,retained),/bookmark|locus|geometry/i);}
 const missing=copy(marked);delete missing.bookmarks[0].locus;assert.throws(()=>restoreIntegralComposition(reading,missing),/bookmark|locus|geometry/i);
 for(const bookmarks of [null,{},'foreign']){const retained=copy(marked);retained.bookmarks=bookmarks;assert.throws(()=>restoreIntegralComposition(reading,retained),/bookmark/i);}
 unchanged();
});
`;
const result=await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('.',import.meta.url)),sourcefile:'entry-context-source-tests.mjs',loader:'js'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',define:{'import.meta.url':JSON.stringify(import.meta.url)}});
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text+'\n//# sourceURL='+import.meta.url).toString('base64'));
