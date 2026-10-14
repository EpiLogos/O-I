/** Lane-4 T22 — the Places lens's in-lens search. Pure proof (no DOM) of the
 * row model, the search's one write, and the store boundary. Loads
 * `src/placeSearch.ts` and the navigation helpers it imports through the same
 * esbuild-in-tmp pattern as place-reading.test.mjs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-search-'));
 try{
  const out=join(temporary,'places-search-adapters.mjs');
  await build({
   stdin:{contents:"export * from './src/placeSearch.ts';\nexport {openingPlaceSelection} from '../../src/techne/m0m5/place/navigation.ts';\nexport {placeFocusFromSession} from '../../src/techne/m0m5/place/register.ts';",resolveDir:engine},
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

const SOURCE='wiki:source:field-notes';
const twoPlaces={
 subject:{subject_ref:'subject:expedition',native_owner:'wiki'},
 spatial:[
  {place_ref:'place:harbour',precision:'exact',identity:{names:[{name:'Harbour quarter'}]},source_ref:SOURCE,valid_from:'1850-03-04',valid_to:'1852-06-30'},
  {place_ref:'place:summit',precision:'approximate',identity:{names:[{name:'Summit camp'}]},source_ref:SOURCE},
 ],
};
const noPlace={subject:{subject_ref:'subject:pilgrim',native_owner:'wiki'},spatial:[]};

test('T22: a reading with two disclosed places offers both, one row each, in reading order', () => {
 const rows=api.placeSearchRows(twoPlaces,'');
 assert.deepEqual(rows.map(row=>row.kind),['place','place']);
 assert.deepEqual(rows.map(row=>row.key),['place:harbour','place:summit']);
 assert.deepEqual(rows.map(row=>row.label),['Fly here · Harbour quarter','Fly here · Summit camp']);
});

test('T22: the query narrows the places by name or ref; a query that matches none is named', () => {
 assert.deepEqual(api.placeSearchRows(twoPlaces,'  SUMMIT ').map(row=>row.key),['place:summit']);
 assert.deepEqual(api.placeSearchRows(twoPlaces,'harbour').map(row=>row.key),['place:harbour']);
 const none=api.placeSearchRows(twoPlaces,'zzz');
 assert.deepEqual(none,[{kind:'none',key:'no-match',label:'No disclosed place matches "zzz"'}]);
});

test('T22: a subject with no disclosed place is a named row, never dropped', () => {
 assert.deepEqual(api.placeSearchRows(noPlace,''),[{kind:'none',key:'no-place',label:'No place disclosed for subject:pilgrim'}]);
 assert.deepEqual(api.placeSearchRows(noPlace,'anything'),[{kind:'none',key:'no-place',label:'No place disclosed for subject:pilgrim'}]);
 const absentSpatial={subject:{subject_ref:'subject:pilgrim',native_owner:'wiki'}};
 assert.deepEqual(api.placeSearchRows(absentSpatial,''),[{kind:'none',key:'no-place',label:'No place disclosed for subject:pilgrim'}]);
 assert.deepEqual(api.placeSearchRows(null,''),[{kind:'none',key:'no-place',label:'No place disclosed'}]);
});

test('T22: choosing a place writes the native spatial focus for that place, and the globe selects it', () => {
 const chosen=api.placeSearchRows(twoPlaces,'')[1].offer;
 const write=api.searchChoiceWrite(chosen);
 assert.deepEqual(write,{instrument:'place',spatial_focus_ref:'place:summit'});
 // The native session after the owner's spatial write carries that focus; the Places mount's opening selection reads it back.
 const afterWrite={selection:{focus_refs:[],instrument:'place'},spatial_focus_ref:write.spatial_focus_ref};
 assert.equal(api.openingPlaceSelection(afterWrite,twoPlaces.spatial,null),'place:summit');
 assert.equal(api.placeFocusFromSession(afterWrite,twoPlaces.spatial),'place:summit');
 // A ref the reading does not disclose selects nothing and names no error.
 assert.equal(api.placeFocusFromSession({selection:{focus_refs:[]},spatial_focus_ref:'place:vanished'},twoPlaces.spatial),null);
});

test('T22: a search offer with no usable ref is refused, never written', () => {
 assert.throws(()=>api.searchChoiceWrite({place_ref:'   '}),/verbatim/);
});

test('T22: the search never touches the cradle DisclosureSession store', async () => {
 const files=['src/placeSearch.ts','src/placeSearchPanel.tsx','src/placeReading.ts','src/placeFacetsPanel.tsx','src/researchInstruments.tsx'];
 for (const file of files) {
  const text=await readFile(join(engine,file),'utf8');
  assert.equal(text.includes('disclosureSession'),false,`${file} must not reference disclosureSession`);
  assert.equal(text.includes('DisclosureSession'),false,`${file} must not reference the cradle DisclosureSession store`);
 }
 // The mount's search handler writes through the one compare-and-set spatial write and re-opens the globe over it.
 const mount=await readFile(join(engine,'src/researchInstruments.tsx'),'utf8');
 assert.match(mount,/const flyToSearchedPlace=async\(offer:PlaceOffer\)=>\{\s*const plan=searchChoiceWrite\(offer\);[\s\S]*?writeSharedSpatialFocus\(request,nativeReading,plan\.instrument,sharedTime,plan\.spatial_focus_ref\);/);
});

test('T22: a carried ref opens the globe on that place as before (carried outranks the session)', () => {
 const session={selection:{focus_refs:[]},spatial_focus_ref:'place:summit'};
 const focus=api.placeMountFocus({carried:'place:harbour',session,facets:twoPlaces.spatial,remembered:null});
 assert.deepEqual(focus,{selected:'place:harbour',focus:'place:harbour'});
});

test('T22: once a search choice is made (carried cleared), the native spatial focus decides the globe, and a second choice wins', () => {
 // Opened with carried A; the mount then clears the carried ref and the native session names B.
 const afterB={selection:{focus_refs:[]},spatial_focus_ref:'place:summit'};
 assert.deepEqual(api.placeMountFocus({carried:undefined,session:afterB,facets:twoPlaces.spatial,remembered:'place:harbour'}),{selected:'place:summit',focus:'place:summit'});
 const afterA={selection:{focus_refs:[]},spatial_focus_ref:'place:harbour'};
 assert.deepEqual(api.placeMountFocus({carried:undefined,session:afterA,facets:twoPlaces.spatial,remembered:'place:summit'}),{selected:'place:harbour',focus:'place:harbour'});
});

test('T22: choosing a second place re-renders the mounted map with the new focus; load is not called on that path', async () => {
 const mount=await readFile(join(engine,'src/researchInstruments.tsx'),'utf8');
 const start=mount.indexOf('const flyToSearchedPlace=');
 const end=mount.indexOf('const facets=<>',start);
 assert.ok(start>0&&end>start,'the search handler is in the Places section');
 const block=mount.slice(start,end);
 // The mounted path: write the native spatial focus, then render the same mount again. load('m4') is only the fallback for an unmounted map.
 assert.match(block,/const mapPresented=root!==null;/);
 assert.match(block,/sharedTime=await writeSharedSpatialFocus\(request,nativeReading,plan\.instrument,sharedTime,plan\.spatial_focus_ref\);\s*if\(!mapPresented\)\{await load\('m4'\);return;\}/);
 assert.match(block,/carriedPlace=undefined;\s*render\(renderPlaces\(\)\);/);
 assert.equal(block.match(/load\('m4'\)/g).length,1,'load is called once, only on the fallback');
 // The map's focus props come from the one per-render resolution the mount already uses.
 assert.match(mount,/initialSelectedGraphNodeId=\{mapFocus\.selected\} initialFocusGraphNodeId=\{mapFocus\.focus\}/);
});

test('T22: the vendor map latches each distinct focus once, so A, B, A each fly (source-asserted rule, run as a sequence)', async () => {
 const map=await readFile(join(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic/PsychogeographicMap.tsx'),'utf8');
 assert.match(map,/const focusHonoured = useRef<string \| null>\(null\);/);
 assert.match(map,/focusHonoured\.current === initialFocusGraphNodeId\) return;/);
 assert.match(map,/focusHonoured\.current = initialFocusGraphNodeId;\s*selectPlace\(initialFocusGraphNodeId\);/);
 // The rule as the source states it: a ref flies when it differs from the last honoured ref. Run as a sequence.
 const flights=(refs)=>{let latch=null;const out=[];for(const ref of refs){if(!ref||ref===latch)continue;latch=ref;out.push(ref);}return out;};
 assert.deepEqual(flights(['place:harbour','place:summit','place:harbour']),['place:harbour','place:summit','place:harbour']);
 assert.deepEqual(flights(['place:harbour','place:harbour']),['place:harbour'],'a repeated ref does not re-fly');
});
