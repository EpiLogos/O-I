import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryHTML,collectionBinsOf,collectionsWith,collectionView,parseCollectionFilter,collectionFilterValue} from '../build/expressions.js';
import {documentToChanges} from '../build/kernelExpressions.js';
import {fieldStudies} from '../build/model.js';

// E26 — collections as bins. The kernel's own `index` reading (its `collections` map) is the one source; the
// save path is the existing collections_set change. Owners write; the Library reads and groups.
const index={schema:'oi.expression-index/v1',
 expressions:[
  {expression_ref:'expression:a',revision:2,title:'Alpha',collections:['library','lessons']},
  {expression_ref:'expression:b',revision:1,title:'Beta',collections:['library']},
  {expression_ref:'expression:c',revision:1,title:'Gamma',collections:[]},
 ],
 collections:{library:['expression:a','expression:b'],lessons:['expression:a']}};
const base={saved:[],featured:[],starters:[],section:'collection',errors:[],legacy:false,cover:()=>undefined};

test('E26: the kernel index becomes bins; each expression sits in its collections; the current one is marked', ()=>{
 const bins=collectionBinsOf(index,'expression:a');
 assert.deepEqual(bins.bins.map(b=>b.name),['lessons','library']);
 assert.deepEqual(bins.bins[0].members.map(m=>[m.title,m.current]),[['Alpha',true]]);
 assert.deepEqual(bins.bins[1].members.map(m=>m.title),['Alpha','Beta']);
 assert.deepEqual(bins.current,{ref:'expression:a',collections:['library','lessons']});
});

test('E26: an expression in no collection reads as Uncollected, never hidden', ()=>{
 const bins=collectionBinsOf(index);
 assert.deepEqual(bins.uncollected.map(m=>m.title),['Gamma']);
 const empty=collectionBinsOf({schema:'oi.expression-index/v1',expressions:[{expression_ref:'expression:z',title:'Zed',collections:[]}],collections:{}});
 assert.deepEqual(empty.bins,[]);
 assert.deepEqual(empty.uncollected.map(m=>m.title),['Zed']);
});

test('E26: a member the index names without a listed title keeps its ref, never an invented title; malformed index is an honest null', ()=>{
 const bins=collectionBinsOf({expressions:[],collections:{shelf:['expression:ghost']}});
 assert.deepEqual(bins.bins[0].members.map(m=>m.title),['expression:ghost']);
 assert.equal(collectionBinsOf(null),null);
 assert.equal(collectionBinsOf({expressions:'nope',collections:{}}),null);
});

test('E26: collection names are trimmed, collapsed, de-duplicated and sorted before they are written', ()=>{
 assert.deepEqual(collectionsWith(['library','lessons'],'  Shelf   two  '),['lessons','library','Shelf two']);
 assert.deepEqual(collectionsWith(['library','library'],'library'),['library']);
 assert.deepEqual(collectionsWith(['', ' '],'   '),[]);
});

test('E26: the picker on the open Expression assigns through the one save path (collections_set), and the rail groups by bin', ()=>{
 const html=libraryHTML({...base,standalone:false,current:{...fieldStudies(),id:'expression:a',name:'Alpha'},bins:collectionBinsOf(index,'expression:a')});
 assert.match(html,/data-scope="collection-bins"/);
 assert.match(html,/data-scope="collection-picker" data-expression="expression:a"/);
 assert.match(html,/<input type="checkbox" name="collection" value="library" checked>/);
 assert.match(html,/<input type="checkbox" name="collection" value="lessons" checked>/);
 assert.match(html,/data-action="set-collections"/);
 assert.match(html,/data-starting-card data-search="alpha/,'members join the existing Library search, not a second index');
});

test('E26: the standalone page reads bins but offers no assignment it cannot write', ()=>{
 const html=libraryHTML({...base,standalone:true,bins:collectionBinsOf(index)});
 assert.match(html,/data-scope="collection-bins"/);
 assert.doesNotMatch(html,/data-scope="collection-picker"/);
});

test('E26: a collections change on an Expression emits exactly one collections_set in the kernel diff', ()=>{
 const before={schema:'oi.expression/v1',expression_ref:'expression:a',revision:2,title:'Alpha',entities:{},scenes:[],collections:['library']};
 const after={...before,collections:collectionsWith(['library'],'Shelf')};
 const diff=documentToChanges(before,after);
 assert.ok(!diff.error,'the diff is expressible');
 assert.deepEqual(diff.changes.filter(c=>c.change==='collections_set'),[{change:'collections_set',collections:['library','Shelf']}]);
});

test('E26: a filter choice round-trips through its chip value, and a bin named "uncollected" stays a bin', ()=>{
 assert.deepEqual(parseCollectionFilter('uncollected'),{kind:'uncollected'});
 assert.deepEqual(parseCollectionFilter('bin:uncollected'),{kind:'bin',name:'uncollected'});
 assert.deepEqual(parseCollectionFilter('bin:'),{kind:'all'});
 assert.deepEqual(parseCollectionFilter('nonsense'),{kind:'all'});
 for(const f of [{kind:'all'},{kind:'uncollected'},{kind:'bin',name:'library'}])assert.deepEqual(parseCollectionFilter(collectionFilterValue(f)),f);
});

test('E26: a bin filter shows only its bin; Uncollected shows only unassigned Expressions; a stale choice falls back to every bin', ()=>{
 const b=collectionBinsOf(index);
 const lessons=collectionView(b,{kind:'bin',name:'lessons'});
 assert.deepEqual(lessons.bins.map(x=>x.name),['lessons']);
 assert.equal(lessons.uncollected,false);
 const un=collectionView(b,{kind:'uncollected'});
 assert.deepEqual(un.bins,[]);
 assert.equal(un.uncollected,true);
 const gone=collectionView(b,{kind:'bin',name:'deleted'});
 assert.deepEqual(gone.bins.map(x=>x.name),['lessons','library']);
 assert.equal(gone.uncollected,true);
 assert.deepEqual(gone.filter,{kind:'all'});
 const none=collectionBinsOf({expressions:[{expression_ref:'expression:a',title:'A',collections:['x']}],collections:{x:['expression:a']}});
 assert.equal(collectionView(none,{kind:'uncollected'}).filter.kind,'all');
});

test('E26: the Library shows the chosen bin alone, marks the pressed chip, and keeps Uncollected reachable by its own chip', ()=>{
 const html=libraryHTML({...base,standalone:false,current:{...fieldStudies(),id:'expression:a',name:'Alpha'},bins:collectionBinsOf(index,'expression:a'),collectionFilter:{kind:'bin',name:'lessons'}});
 assert.match(html,/data-filter="bin:lessons" aria-pressed="true"/);
 assert.match(html,/data-filter="all" aria-pressed="false"/);
 assert.match(html,/data-filter="uncollected" aria-pressed="false"/);
 assert.match(html,/<strong>lessons<\/strong>/);
 assert.doesNotMatch(html,/<strong>library<\/strong>/);
 assert.doesNotMatch(html,/is-uncollected/);
});

test('E26: a reading that failed is stated on the page, never a silent gap; a reading not yet taken states nothing', ()=>{
 const failed=libraryHTML({...base,standalone:true,bins:null});
 assert.match(failed,/data-scope="collection-bins"/);
 assert.match(failed,/could not be read from this instance/);
 assert.doesNotMatch(failed,/data-action="collection-filter"/);
 const pending=libraryHTML({...base,standalone:true});
 assert.doesNotMatch(pending,/data-scope="collection-bins"/);
});

test('E26: a collection the open Expression carries is offered as a checked option even when no bin lists it, so a save never drops it', ()=>{
 const stale={expressions:[{expression_ref:'expression:a',title:'Alpha',collections:['orphan']}],collections:{}};
 const html=libraryHTML({...base,standalone:false,current:{...fieldStudies(),id:'expression:a',name:'Alpha'},bins:collectionBinsOf(stale,'expression:a')});
 assert.match(html,/data-scope="collection-picker" data-expression="expression:a"/);
 assert.match(html,/<input type="checkbox" name="collection" value="orphan" checked>/);
});
