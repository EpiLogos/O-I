// lane-5 T22 — the browser Library records where each entry's document came from.
//   kernel-ref   the browser copy of a kernel Expression, recorded with its kernel ref;
//   local-draft  browser-local work the kernel has not recorded (also what an entry without an origin reads as).
// The origin lives beside the document, never in it: a document read from the Library carries no origin field.
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney,validateJourney} from '../build/model.js';
import {readLibraryWithOrigins,readLibrary,saveToLibrary,libraryOriginFrom,recordLibraryAdoption,adoptedLocalOrigin,libraryOpenPlan,linkLibraryCopy} from '../build/store.js';

class MemoryStorage{
 constructor(){this.map=new Map();}
 get length(){return this.map.size;}
 key(index){return [...this.map.keys()][index]??null;}
 getItem(key){return this.map.has(key)?this.map.get(key):null;}
 setItem(key,value){this.map.set(key,String(value));}
 removeItem(key){this.map.delete(key);}
}
const storage=new MemoryStorage();
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true,writable:true});

const KERNEL='expression:abc123';
const documentNamed=(id,name)=>({...blankJourney(),id,name,updatedAt:'2026-10-14T10:00:00.000Z'});
const originOf=(id)=>readLibraryWithOrigins().origins.get(id)??{kind:'local-draft'};

test('a document saved without an origin is local-draft, and so is an entry that records none', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('local-one','Local one'));
  assert.deepEqual(originOf('local-one'), {kind:'local-draft'});
  assert.equal(readLibraryWithOrigins().origins.get('local-one')?.kind ?? 'local-draft', 'local-draft');
});

test('a save that names its kernel ref records a kernel-ref origin with that ref', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('kernel-one','Kernel one'), {kind:'kernel-ref',ref:KERNEL});
  assert.deepEqual(originOf('kernel-one'), {kind:'kernel-ref',ref:KERNEL});
});

test('a save that names no origin keeps the origin the entry already records', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('kernel-two','Kernel two'), {kind:'kernel-ref',ref:KERNEL});
  saveToLibrary(documentNamed('kernel-two','Kernel two, edited'));
  assert.deepEqual(originOf('kernel-two'), {kind:'kernel-ref',ref:KERNEL}, 'an unnamed backup does not flip a kernel entry');
  assert.equal(readLibrary().find(j=>j.id==='kernel-two').name,'Kernel two, edited', 'the content is the newer save');
});

test('a local entry flips to kernel-ref at its first kernel save, under the same id', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('fresh-one','Fresh one'));
  assert.equal(originOf('fresh-one').kind,'local-draft');
  saveToLibrary(documentNamed('fresh-one','Fresh one'),{kind:'kernel-ref',ref:KERNEL});
  assert.deepEqual(originOf('fresh-one'), {kind:'kernel-ref',ref:KERNEL});
  assert.equal(readLibrary().filter(j=>j.id==='fresh-one').length,1, 'the flip replaces the one entry; nothing is duplicated');
});

test('the origin never rides in the document: read-back equals the authored document', () => {
  storage.map.clear();
  const authored=documentNamed('clean-one','Clean one');
  saveToLibrary(authored,{kind:'kernel-ref',ref:KERNEL});
  const [read]=readLibrary();
  assert.equal(Object.prototype.hasOwnProperty.call(read,'origin'), false);
  assert.deepEqual(read, validateJourney(authored));
});

test('an origin the store cannot read as a kernel ref is local-draft, never kernel-bound', () => {
  assert.deepEqual(libraryOriginFrom(undefined), {kind:'local-draft'});
  assert.deepEqual(libraryOriginFrom({kind:'kernel-ref',ref:'not-an-expression-ref'}), {kind:'local-draft'});
  assert.deepEqual(libraryOriginFrom({kind:'kernel-ref',ref:42}), {kind:'local-draft'});
  assert.deepEqual(libraryOriginFrom({kind:'remote',ref:KERNEL}), {kind:'local-draft'});
  assert.deepEqual(libraryOriginFrom({kind:'kernel-ref',ref:KERNEL}), {kind:'kernel-ref',ref:KERNEL});
});

test('origins are per document: one entry flipping leaves the others as they stood', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('a-doc','A'));
  saveToLibrary(documentNamed('b-doc','B'),{kind:'kernel-ref',ref:KERNEL});
  saveToLibrary(documentNamed('a-doc','A'),{kind:'kernel-ref',ref:'expression:other'});
  assert.deepEqual(originOf('a-doc'), {kind:'kernel-ref',ref:'expression:other'});
  assert.deepEqual(originOf('b-doc'), {kind:'kernel-ref',ref:KERNEL});
  assert.equal(readLibrary().length,2, 'no entry is dropped');
});

// OPEN 1 (adoption): the first kernel save of a browser-local document links its Library entry to the kernel document it created.
// The kernel's own id is untouched, the local copy is kept, and the link is metadata beside the local origin.
const ADOPTED='expression:adopted-one';
const adoption=(ref,title,at='2026-10-14T11:00:00.000Z')=>({ref,title,at});

test('a fresh local entry saved to the kernel is linked to the kernel document, and nothing is removed', () => {
  storage.map.clear();
  const local=documentNamed('fresh-two','Fresh two');
  saveToLibrary(local);
  const before=readLibrary().length;
  assert.equal(recordLibraryAdoption('fresh-two',adoption(ADOPTED,'The kernel document')),true);
  assert.deepEqual(originOf('fresh-two'), {kind:'local-draft',adopted_into:ADOPTED,adopted_title:'The kernel document',adopted_at:'2026-10-14T11:00:00.000Z'});
  assert.equal(readLibrary().length,before,'no entry is removed by the link');
  const [read]=readLibrary().filter(j=>j.id==='fresh-two');
  assert.deepEqual(read, validateJourney(local), 'the local copy is kept with its content');
});

test('reopening a linked local entry offers the kernel copy first, when the kernel is reachable', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('linked-one','Linked one'));
  recordLibraryAdoption('linked-one',adoption(ADOPTED,'Kernel title'));
  const origin=originOf('linked-one');
  assert.deepEqual(libraryOpenPlan(origin,true), {kind:'kernel-first',ref:ADOPTED,title:'Kernel title'});
  assert.deepEqual(libraryOpenPlan(origin,false), {kind:'local'}, 'with no kernel reachable the browser draft opens as before');
});

test('a second adoption of the same local entry records the latest ref; the link is kept through later backups', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('twice-one','Twice one'));
  recordLibraryAdoption('twice-one',adoption('expression:first-ref','First'));
  recordLibraryAdoption('twice-one',adoption('expression:second-ref','Second'));
  assert.equal(originOf('twice-one').adopted_into,'expression:second-ref');
  saveToLibrary(documentNamed('twice-one','Twice one, edited'));
  assert.equal(originOf('twice-one').adopted_into,'expression:second-ref','an unnamed backup keeps the adoption link');
  assert.equal(readLibrary().find(j=>j.id==='twice-one').name,'Twice one, edited');
});

test('adoption records nothing where it does not apply: an absent entry, a kernel-ref entry, a malformed ref', () => {
  storage.map.clear();
  assert.equal(recordLibraryAdoption('never-saved',adoption(ADOPTED,'X')),false);
  assert.equal(readLibrary().length,0,'nothing is created for an entry that was never saved');
  saveToLibrary(documentNamed('bound-one','Bound one'),{kind:'kernel-ref',ref:KERNEL});
  assert.equal(recordLibraryAdoption('bound-one',adoption(ADOPTED,'X')),false);
  assert.deepEqual(originOf('bound-one'), {kind:'kernel-ref',ref:KERNEL});
  assert.deepEqual(adoptedLocalOrigin(adoption('not-a-ref','X')), {kind:'local-draft'}, 'a malformed adopted ref is local-draft only');
});

test('an adoption link on a local entry is read back with a clean origin', () => {
  assert.deepEqual(libraryOriginFrom({kind:'local-draft',adopted_into:ADOPTED,adopted_title:'T'.repeat(300),adopted_at:'2026-10-14'}),
    {kind:'local-draft',adopted_into:ADOPTED,adopted_title:'T'.repeat(160),adopted_at:'2026-10-14'});
  assert.deepEqual(libraryOpenPlan(undefined,true), {kind:'local'});
  assert.deepEqual(libraryOpenPlan({kind:'kernel-ref',ref:KERNEL},true), {kind:'local'}, 'a kernel-ref entry opens as it always has');
});

// O-I #763: a local draft left for another work is kept as a work in its world's folder (nativeWorkspace.ts keepDraftAsWork). Its Library
// copy records that work, so reopening the copy opens the work, never a second copy of it. The copy is linked whether the Library held it
// already or not (the frame saves the departing draft to the Library only as the other work opens, after the keep).
test('O-I #763: a draft kept as a work links its Library copy to the work, held already or not; reopening it opens the work', () => {
  storage.map.clear();
  const KEPT='expression:authored-5e60aa00-0000-4000-8000-000000000000';
  const kept=adoption(KEPT,'Morning sketch','2026-10-28T23:00:00.000Z');
  const absent=documentNamed('sketch-absent','Morning sketch');
  linkLibraryCopy(absent,kept);
  assert.deepEqual(readLibrary().find(j=>j.id==='sketch-absent'),validateJourney(absent),'an absent copy is saved whole');
  assert.deepEqual(libraryOpenPlan(originOf('sketch-absent'),true),{kind:'kernel-first',ref:KEPT,title:'Morning sketch'});
  const held=documentNamed('sketch-held','Held sketch');
  saveToLibrary(held);
  linkLibraryCopy(held,kept);
  assert.deepEqual(libraryOpenPlan(originOf('sketch-held'),true),{kind:'kernel-first',ref:KEPT,title:'Morning sketch'});
  // The departing draft's own Library save, which names no origin, keeps the link (app.ts applyJourney).
  saveToLibrary(absent);
  assert.equal(originOf('sketch-absent').adopted_into,KEPT);
  assert.equal(readLibrary().filter(j=>j.id==='sketch-absent').length,1,'one copy, never a second');
  // A copy bound to its own kernel ref is not a local draft: the link does not apply to it, and it is left as it is.
  saveToLibrary(documentNamed('sketch-bound','Bound sketch'),{kind:'kernel-ref',ref:KERNEL});
  linkLibraryCopy(documentNamed('sketch-bound','Bound sketch, edited'),kept);
  assert.deepEqual(originOf('sketch-bound'),{kind:'kernel-ref',ref:KERNEL});
  assert.equal(readLibrary().find(j=>j.id==='sketch-bound').name,'Bound sketch');
});
