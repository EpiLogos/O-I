// T22 · the Library card note is one wording for the in-app Library and the standalone Library page (libraryCards.ts).
// The standing a card reads, the note text, the decoration, and the adoption path end to end through the real store.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankJourney} from '../build/model.js';
import {saveToLibrary,readLibraryWithOrigins,recordLibraryAdoption} from '../build/store.js';
import {libraryCardStanding,libraryCardNoteText,decorateLibraryCard,localCopyIdFor,kernelCopyRefusalMessage,LIBRARY_CARD_DRAFT_ACTION,LIBRARY_CARD_DRAFT_TEXT} from '../build/libraryCards.js';

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

// A minimal element surface: enough for decorateLibraryCard, which appends a note and, for an adopted entry, a draft action beside its card.
function fakeDocument(){
 const make=(tag)=>{
  const el={tagName:tag,className:'',textContent:'',type:'',dataset:{},children:[],parent:null};
  el.append=(...nodes)=>{for(const node of nodes){node.parent=el;el.children.push(node);}};
  el.closest=(selector)=>{let node=el;while(node){if(node.tagName===selector)return node;node=node.parent;}return null;};
  return el;
 };
 return {createElement:make};
}

test('a kernel-ref origin reads as a kernel copy and names its ref', () => {
  const standing=libraryCardStanding({kind:'kernel-ref',ref:KERNEL});
  assert.deepEqual(standing,{kernelRef:KERNEL,adopted:undefined});
  assert.equal(libraryCardNoteText(standing),`Kernel copy · ${KERNEL}`);
});

test('a local draft with no kernel link reads as browser work', () => {
  const standing=libraryCardStanding({kind:'local-draft'});
  assert.equal(standing.kernelRef,undefined);
  assert.equal(standing.adopted,undefined);
  assert.equal(libraryCardNoteText(standing),'Draft in this browser');
  assert.equal(libraryCardNoteText(libraryCardStanding(undefined)),'Draft in this browser');
});

test('an adopted local draft names the kernel document by its title', () => {
  const standing=libraryCardStanding({kind:'local-draft',adopted_into:KERNEL,adopted_title:'The Nine Gates',adopted_at:'2026-10-14T10:00:00.000Z'});
  assert.deepEqual(standing.adopted,{ref:KERNEL,title:'The Nine Gates'});
  assert.equal(libraryCardNoteText(standing),'Saved to the kernel as “The Nine Gates”');
});

test('an adopted draft with no title names the kernel document by its ref', () => {
  const standing=libraryCardStanding({kind:'local-draft',adopted_into:KERNEL,adopted_title:'',adopted_at:''});
  assert.equal(libraryCardNoteText(standing),`Saved to the kernel as “${KERNEL}”`);
});

test('the open kernel document beside a local entry is named as the kernel copy, as the in-app Library does', () => {
  const standing=libraryCardStanding({kind:'local-draft'},{kind:'kernel-ref',ref:KERNEL});
  assert.equal(standing.kernelRef,KERNEL);
  assert.equal(libraryCardNoteText(standing),`Kernel copy · ${KERNEL}`);
});

test('a kernel-ref card carries one note and no draft action', () => {
  const doc=fakeDocument();
  globalThis.document=doc;
  try{
   const article={tagName:'article',children:[],parent:null,append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}},closest(){return null;}};
   const open=doc.createElement('button');open.tagName='button';open.parent=article;article.children.push(open);
   decorateLibraryCard(open,'doc-1',libraryCardStanding({kind:'kernel-ref',ref:KERNEL}));
   assert.equal(open.children.length,1);
   assert.equal(open.children[0].className,'oi-lib-note');
   assert.equal(open.children[0].textContent,`Kernel copy · ${KERNEL}`);
   assert.equal(article.children.length,1,'no draft action is appended to the card');
  }finally{delete globalThis.document;}
});

test('an adopted card carries its note and an Open browser draft action beside it', () => {
  const doc=fakeDocument();
  globalThis.document=doc;
  try{
   const article={tagName:'article',children:[],parent:null,append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}},closest(){return null;}};
   const open=doc.createElement('button');open.tagName='button';open.parent=article;article.children.push(open);
   decorateLibraryCard(open,'doc-2',libraryCardStanding({kind:'local-draft',adopted_into:KERNEL,adopted_title:'Gate'}));
   assert.equal(open.children[0].textContent,'Saved to the kernel as “Gate”');
   const draft=article.children.find(n=>n!==open);
   assert.ok(draft,'the draft action sits beside the card');
   assert.equal(draft.tagName,'button');
   assert.equal(draft.dataset.action,LIBRARY_CARD_DRAFT_ACTION);
   assert.equal(draft.dataset.id,'doc-2');
   assert.equal(draft.textContent,LIBRARY_CARD_DRAFT_TEXT);
   assert.equal(LIBRARY_CARD_DRAFT_TEXT,'Open browser draft');
  }finally{delete globalThis.document;}
});

test('an adoption recorded by the kernel save reaches the card through the store read', () => {
  storage.map.clear();
  saveToLibrary(documentNamed('local-gate','Local gate'));
  assert.equal(libraryCardNoteText(libraryCardStanding(readLibraryWithOrigins().origins.get('local-gate'))),'Draft in this browser');
  assert.equal(recordLibraryAdoption('local-gate',{ref:KERNEL,title:'Gate',at:'2026-10-14T10:05:00.000Z'}),true);
  const standing=libraryCardStanding(readLibraryWithOrigins().origins.get('local-gate'));
  assert.deepEqual(standing.adopted,{ref:KERNEL,title:'Gate'});
  assert.equal(libraryCardNoteText(standing),'Saved to the kernel as “Gate”');
});

test('the note wording lives once: neither page carries its own copy', () => {
  const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../src/library.ts',import.meta.url),'utf8');
  const shared=fs.readFileSync(new URL('../src/libraryCards.ts',import.meta.url),'utf8');
  for(const wording of ['Draft in this browser','Saved to the kernel as','Kernel copy · ','Open browser draft']){
   assert.ok(shared.includes(wording),`the shared module states "${wording}"`);
   assert.ok(!app.includes(wording),`app.ts does not repeat "${wording}"`);
   assert.ok(!page.includes(wording),`library.ts does not repeat "${wording}"`);
  }
  assert.ok(app.includes("from './libraryCards.js'"),'app.ts imports the shared card helper');
  assert.ok(page.includes("from './libraryCards.js'"),'library.ts imports the shared card helper');
});

test('the browser copy a kernel ref falls back to is the entry that adopted it, else a kernel-ref copy of it', () => {
  const origins = new Map([
    ['kernel-copy', {kind: 'kernel-ref', ref: 'expression:other'}],
    ['draft-a', {kind: 'local-draft'}],
    ['draft-b', {kind: 'local-draft', adopted_into: KERNEL, adopted_title: 'Gate', adopted_at: ''}],
  ]);
  assert.equal(localCopyIdFor(KERNEL, origins), 'draft-b');
  assert.equal(localCopyIdFor('expression:other', origins), 'kernel-copy');
  assert.equal(localCopyIdFor('expression:none', origins), undefined);
  const both = new Map([['kc', {kind: 'kernel-ref', ref: KERNEL}], ['dr', {kind: 'local-draft', adopted_into: KERNEL, adopted_title: '', adopted_at: ''}]]);
  assert.equal(localCopyIdFor(KERNEL, both), 'dr', 'an adopted local draft is preferred over a kernel-ref copy of the same ref');
});

test('the frame opens a browser draft by id on the host command, and a refused host open falls back to the browser copy', () => {
  const app = fs.readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  assert.ok(app.includes("d.command==='open-local-draft'"), 'the host command opens a browser draft by its id');
  assert.ok(app.includes('await openBrowserDraft(el.dataset.id!)'), 'the in-frame Open browser draft uses the same body');
  assert.ok(app.includes('openKernelCopy(ref,localCopyFallbackFor(ref),recovery)'), 'the host open routes through the in-app refusal handling');
  assert.ok(app.includes('openKernelCopy(r.ref,localCopyFallbackFor(r.ref),r.recovery)'), 'the buffered host open routes through it too');
  assert.ok(app.includes('localCopyIdFor(ref,origins)'), 'the fallback is the Library entry that holds the ref');
  assert.ok(app.includes('kernelCopyRefusalMessage(!!fallback)'), 'the refusal toast is the one shared refusal grammar');
  assert.ok(!app.includes('The browser copy opens instead.'), 'the refusal wording lives once, in libraryCards.ts');
});

test('a refused kernel open names the refusal, and says a browser copy opens only when one does', () => {
  assert.equal(kernelCopyRefusalMessage(true),
    'The kernel copy of this Expression could not be opened. The browser copy opens instead.');
  assert.equal(kernelCopyRefusalMessage(false),
    'The kernel copy of this Expression could not be opened. The current document stays open.');
  const app = fs.readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  assert.ok(!app.includes('The browser copy stays open as local scratch'), 'no refusal toast says the browser copy stays open as local scratch');
  assert.ok(app.includes('openKernelCopy(plan.ref,j?()=>{void loadJourney(j)}:undefined)'), 'the in-app open names a browser copy only when it holds one');
});

test('the frame opens a browser draft from the host command through the in-frame body, and the refusal grammar is one', () => {
  const app = fs.readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  assert.equal([...app.matchAll(/openBrowserDraft\(/g)].length, 3, 'the in-frame case, the host command, and the definition share one body');
  assert.ok(app.includes("command==='open-local-draft'&&typeof (d as {id?:unknown}).id==='string')void openBrowserDraft"));
});
