// lane-2 T9 — nested events with zoom-collapsing structure. The parent extent is
// the min/max of its children, a parent collapses into one span carrying its child
// count at the marker tier or where its children crowd, and collapsing hides only
// its descendants. Pure: the vendored nesting module, bundled with esbuild.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const compiled=await build({stdin:{contents:"export * as nesting from '../../vendor/research-canvas/packages/canvas/src/timeline/nesting.ts';export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {nesting,viewport}=api;

const Y=(year)=>Date.UTC(year,0,1);
const DAY=86_400_000;
// The fixture: a war (1914–1919) holding three battles, each holding three events. Nine events in all.
const WAR={id:'war',fromMs:Y(1914),toMs:Y(1919)};
const BATTLES=[
 {id:'b1',fromMs:Y(1914),toMs:Y(1915)},
 {id:'b2',fromMs:Y(1916),toMs:Y(1917)},
 {id:'b3',fromMs:Y(1918),toMs:Y(1919)},
];
const EVENTS=[
 {id:'e1',fromMs:Y(1914),toMs:Y(1914)+DAY},{id:'e2',fromMs:Y(1914)+182*DAY,toMs:Y(1914)+183*DAY},{id:'e3',fromMs:Y(1915)-DAY,toMs:Y(1915)},
 {id:'e4',fromMs:Y(1916),toMs:Y(1916)+DAY},{id:'e5',fromMs:Y(1916)+182*DAY,toMs:Y(1916)+183*DAY},{id:'e6',fromMs:Y(1917)-DAY,toMs:Y(1917)},
 {id:'e7',fromMs:Y(1918),toMs:Y(1918)+DAY},{id:'e8',fromMs:Y(1918)+182*DAY,toMs:Y(1918)+183*DAY},{id:'e9',fromMs:Y(1919)-DAY,toMs:Y(1919)},
];
const PAIRS=[
 ...BATTLES.map((battle)=>({parent:'war',child:battle.id})),
 {parent:'b1',child:'e1'},{parent:'b1',child:'e2'},{parent:'b1',child:'e3'},
 {parent:'b2',child:'e4'},{parent:'b2',child:'e5'},{parent:'b2',child:'e6'},
 {parent:'b3',child:'e7'},{parent:'b3',child:'e8'},{parent:'b3',child:'e9'},
];
const UNRELATED={id:'unrelated',fromMs:Y(1900),toMs:Y(1901)};
const ITEMS=[WAR,...BATTLES,...EVENTS,UNRELATED];

// A camera centred on 1916 at a given zoom, 1000 px wide.
const camera=(pixelsPerYear)=>viewport.timeCamera({centerYear:1916,pixelsPerYear,widthPx:1000});
const MARKER=0.1;    // the marker tier: every card is a marker
const DETAIL=2400;   // detail band; one year is 2400 px, so every child separates

test('a parent extent is the min start and max end of its children, pure', ()=>{
 const kids=EVENTS.slice(0,3);
 const expected={fromMs:Math.min(...kids.map(k=>k.fromMs)),toMs:Math.max(...kids.map(k=>k.toMs))};
 assert.deepEqual(nesting.parentExtent(kids),expected,'min start and max end of b1 events');
 assert.deepEqual(nesting.parentExtent(BATTLES),{fromMs:Y(1914),toMs:Y(1919)},'the war spans its battles');
 assert.equal(nesting.parentExtent([]),null,'a parent with no children has no extent');
});

test('one open child leaves the parent open at its end, and no end is invented', ()=>{
 const extent=nesting.parentExtent([{fromMs:Y(1914),toMs:Y(1915)},{fromMs:Y(1916),toMs:null}]);
 assert.deepEqual(extent,{fromMs:Y(1914),toMs:null});
});

test('at the marker tier the expanded war collapses into one span carrying its three battles', ()=>{
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(MARKER),'marker');
 assert.deepEqual(state.collapsed.map((span)=>span.parent),['war'],'only the war is a top-level span');
 const [span]=state.collapsed;
 assert.equal(span.childCount,3,'the child count is carried');
 assert.equal(span.fromMs,Y(1914),'the span starts at the earliest battle');
 assert.equal(span.toMs,Y(1919),'and ends at the latest battle');
});

test('a collapsed parent hides only its descendants: the unrelated card is untouched', ()=>{
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(MARKER),'marker');
 const hidden=[...state.hidden].sort();
 assert.deepEqual(hidden,[...BATTLES.map(b=>b.id),...EVENTS.map(e=>e.id)].sort(),'the battles and all nine events are hidden');
 assert.equal(state.hidden.has('war'),false,'the parent card stays');
 assert.equal(state.hidden.has('unrelated'),false,'an unrelated item is never hidden');
});

test('zooming in to where the children separate expands the war: nothing is collapsed', ()=>{
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(DETAIL),'detail');
 assert.deepEqual(state.collapsed,[],'no parent collapses when its children are a card width apart');
 assert.equal(state.hidden.size,0,'nothing is hidden');
});

test('a parent whose children crowd collapses even below the marker tier, and expands once they separate', ()=>{
 // At 8 px per year the battles are 16 px apart and their events crowd: the war collapses at the detail band.
 const crowded=nesting.nestingAt(PAIRS,ITEMS,camera(8),'detail');
 assert.ok(crowded.collapsed.some(span=>span.parent==='war'),'the war collapses where its battles crowd');
 const separated=nesting.nestingAt(PAIRS,ITEMS,camera(DETAIL),'detail');
 assert.equal(separated.collapsed.length,0,'the same war expands when the zoom separates its children');
});

test('a battle collapses inside an expanded war: the war stays, and only the battles events are hidden', ()=>{
 // At 130 px per year the battles sit about 260 px apart (separated), but each battle's events crowd (about 65 px apart).
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(130),'detail');
 assert.deepEqual(state.collapsed.map(span=>span.parent).sort(),['b1','b2','b3'],'each battle collapses, the war does not');
 assert.equal(state.hidden.has('war'),false,'the war is not hidden');
 assert.deepEqual([...state.hidden].sort(),EVENTS.map(e=>e.id).sort(),'exactly the nine events are hidden');
 for(const span of state.collapsed){
  assert.equal(span.childCount,3,`${span.parent} carries its three events`);
 }
});

test('a cycle collapses nothing: no structure is invented from a loop', ()=>{
 const cycle=[{parent:'a',child:'b'},{parent:'b',child:'a'}];
 const items=[{id:'a',fromMs:Y(1900),toMs:Y(1901)},{id:'b',fromMs:Y(1902),toMs:Y(1903)}];
 const state=nesting.nestingAt(cycle,items,camera(MARKER),'marker');
 assert.deepEqual(state.collapsed,[]);
 assert.equal(state.hidden.size,0);
});

test('a self-pair and a pair whose child is not loaded are ignored', ()=>{
 const pairs=[{parent:'war',child:'war'},{parent:'war',child:'not-loaded'}];
 const state=nesting.nestingAt(pairs,ITEMS,camera(MARKER),'marker');
 assert.deepEqual(state.collapsed,[]);
});

test('an open child makes the collapsed span open at its end; a closed child keeps it closed', ()=>{
 const open=[{id:'p',fromMs:Y(1900),toMs:Y(1901)},{id:'c',fromMs:Y(1910),toMs:null}];
 const openState=nesting.nestingAt([{parent:'p',child:'c'}],open,camera(MARKER),'marker');
 assert.equal(openState.collapsed.length,1);
 assert.equal(openState.collapsed[0].fromMs,Y(1910));
 assert.equal(openState.collapsed[0].toMs,null,'no end is invented for an open child');
 const closed=[{id:'p',fromMs:Y(1900),toMs:Y(1901)},{id:'c',fromMs:Y(1910),toMs:Y(1911)}];
 const closedState=nesting.nestingAt([{parent:'p',child:'c'}],closed,camera(MARKER),'marker');
 assert.equal(closedState.collapsed[0].toMs,Y(1911));
});

test('no pairs and no items are the empty state', ()=>{
 assert.deepEqual(nesting.nestingAt([],ITEMS,camera(MARKER),'marker'),{collapsed:[],hidden:new Set()});
 assert.deepEqual(nesting.nestingAt(PAIRS,[],camera(MARKER),'marker'),{collapsed:[],hidden:new Set()});
});
