import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryHTML,collectionBinsOf,collectionsWith} from '../build/expressions.js';
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
