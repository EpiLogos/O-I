// lane-2 T9 — nested events with zoom-collapsing structure. The parent extent is
// the min/max of its children, a parent collapses into one span carrying its child
// count at the marker tier or where its children crowd, and collapsing hides only
// its descendants. Pure: the vendored nesting module, bundled with esbuild.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const compiled=await build({stdin:{contents:"export * as nesting from '../../vendor/research-canvas/packages/canvas/src/timeline/nesting.ts';export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';export * as relations from '../../../src/techne/m0m5/timeline/relations.ts';export * as clusters from '../../vendor/research-canvas/packages/canvas/src/timeline/clusters.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {nesting,viewport,relations,clusters}=api;

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

// lane-2 T9b — the host's containment. The chronology host passes
// containmentPairs(relationEdges(reading)): the authority reads the reading's part
// family (explicit verbs, owner's direction) and the lens nests only those pairs.
const reading=(relationList)=>({
 reading_ref:'reading:war',
 subject:{subject_ref:'subject:war',native_owner:'owner:test'},
 whole:{whole_ref:'whole:war',relations:relationList},
 disclosure:{instruments:[]},
});

test('the host containment: part_of relations from the reading reproduce the fixture pairs, and the war nests at the marker tier', ()=>{
 const relationList=PAIRS.map(({parent,child})=>({relation:'part_of',from_ref:child,to_ref:parent}));
 const pairs=relations.containmentPairs(relations.relationEdges(reading(relationList)));
 assert.deepEqual(pairs,PAIRS,'the reading states the same containment the fixture does');
 const state=nesting.nestingAt(pairs,ITEMS,camera(MARKER),'marker');
 assert.deepEqual(state.collapsed.map((span)=>span.parent),['war']);
 assert.equal(state.collapsed[0].childCount,3);
});

test('the same containment stated parent-first (contains) gives the same pairs and the same nesting', ()=>{
 const relationList=PAIRS.map(({parent,child})=>({relation:'CONTAINS',from_ref:parent,to_ref:child}));
 const pairs=relations.containmentPairs(relations.relationEdges(reading(relationList)));
 assert.deepEqual(pairs,PAIRS);
 assert.deepEqual(nesting.nestingAt(pairs,ITEMS,camera(MARKER),'marker').collapsed.map((span)=>span.parent),['war']);
});

test('a reading that states no containment hands the lens no pairs, so nothing nests', ()=>{
 const relationList=[{relation:'CAUSES',from_ref:'e1',to_ref:'e4'},{relation:'mystery_link',from_ref:'b1',to_ref:'b2'}];
 const pairs=relations.containmentPairs(relations.relationEdges(reading(relationList)));
 assert.deepEqual(pairs,[]);
 assert.deepEqual(nesting.nestingAt(pairs,ITEMS,camera(MARKER),'marker'),{collapsed:[],hidden:new Set()});
});

// Review-5 #8: children that share a start stack; they do not hold their parent collapsed at every zoom.
test('same-start children do not keep their parent collapsed once the view is past the marker tier', ()=>{
 const parent={id:'day',fromMs:Y(1916),toMs:Y(1916)+DAY};
 const kids=[{id:'k1',fromMs:Y(1916),toMs:Y(1916)+DAY},{id:'k2',fromMs:Y(1916),toMs:Y(1916)+DAY}];
 const pairs=kids.map((kid)=>({parent:'day',child:kid.id}));
 const state=nesting.nestingAt(pairs,[parent,...kids],camera(DETAIL),'detail');
 assert.deepEqual(state.collapsed,[],'two children at the same instant do not hold their parent closed');
 assert.equal(nesting.nestingAt(pairs,[parent,...kids],camera(MARKER),'marker').collapsed.length,1,'the marker tier still collapses');
});

// lane-2 T9, bounded loading. The view loads only the window it shows, so a dated child can be missing from the loaded items.
// A parent with such a child is incomplete: its extent would be measured from part of its children, so it stays expanded.
test('a parent with a dated child the view has not loaded stays expanded; its loaded children still collapse', ()=>{
 const loaded=ITEMS.filter(item=>item.id!=='b3');
 const dated=PAIRS.map(pair=>({...pair,dated:true}));
 const state=nesting.nestingAt(dated,loaded,camera(MARKER),'marker');
 assert.equal(state.collapsed.some(span=>span.parent==='war'),false,'the war stays expanded: its battle b3 is dated and not loaded');
 assert.equal(state.hidden.has('e7')||state.hidden.has('e8')||state.hidden.has('e9'),true,'b3 is loaded-complete, so its own events still collapse under it');
 assert.deepEqual(state.collapsed.map(span=>span.parent).sort(),['b1','b2','b3'],'each battle with all its children loaded collapses');
});

test('an undated child that is never placed on the axis does not hold its parent open', ()=>{
 const loaded=ITEMS.filter(item=>item.id!=='b3');
 const state=nesting.nestingAt(PAIRS,loaded,camera(MARKER),'marker');
 assert.deepEqual(state.collapsed.filter(span=>span.parent==='war').map(span=>span.childCount),[2],'the war collapses over the two battles it has on the axis');
});

test('once the missing dated child is loaded the parent collapses over all of its children again', ()=>{
 const dated=PAIRS.map(pair=>({...pair,dated:true}));
 const state=nesting.nestingAt(dated,ITEMS,camera(MARKER),'marker');
 const war=state.collapsed.find(span=>span.parent==='war');
 assert.ok(war,'the war collapses');
 assert.equal(war.childCount,3);
 assert.equal(war.fromMs,Y(1914));
 assert.equal(war.toMs,Y(1919),'its extent runs to the latest battle, which is loaded');
});

// lane-2 T9 with T12: a hidden child is never a cluster member, and every loaded item is counted once.
test('clustering the visible items never counts a child hidden under a collapsed parent, and nothing is counted twice', ()=>{
 const crowd=Array.from({length:40},(_,index)=>({id:`crowd${index}`,fromMs:Y(1916)+index*DAY,toMs:Y(1916)+index*DAY+DAY}));
 const all=[...ITEMS,...crowd];
 const state=nesting.nestingAt(PAIRS,all,camera(MARKER),'marker');
 const visible=all.filter(item=>!state.hidden.has(item.id));
 assert.equal(visible.length+state.hidden.size,all.length,'every loaded item is either visible or hidden under a collapsed parent, never both');
 const window={fromMs:Y(1900),toMs:Y(1930)};
 const broad=clusters.clusterBroadItems(visible.map(item=>({fromMs:item.fromMs,toMs:item.toMs,category:'historical-event'})),window);
 const members=broad.flatMap(cluster=>cluster.memberIndexes.map(index=>visible[index].id));
 assert.equal(new Set(members).size,members.length,'no item is a member of two clusters');
 for(const id of members) assert.equal(state.hidden.has(id),false,`${id} is hidden, so it cannot be a cluster member`);
 assert.ok(broad.some(cluster=>cluster.count>=2),'the crowd forms an honest count cluster');
 assert.equal(broad.reduce((sum,cluster)=>sum+cluster.count,0),members.length,'each cluster count is its members, nothing added');
});

// lane-2 T9, the category chips. A collapsed parent's count is the children the chips SHOW. A chip-hidden child neither counts
// nor holds its parent expanded; a chip-hidden parent never collapses, since its span would hide children the chips show.
test('a chip hiding one of three children makes the collapsed label read 2', ()=>{
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(MARKER),'marker',new Set(['b2']));
 const war=state.collapsed.find(span=>span.parent==='war');
 assert.ok(war,'the war still collapses');
 assert.equal(war.childCount,2,'the count is the two battles the chips show');
 assert.equal(nesting.collapsedSpanLabel('War',war.childCount),'War · 2 items','the label reads 2');
 assert.equal(war.fromMs,Y(1914),'the extent is the shown battles: b1 starts it');
 assert.equal(war.toMs,Y(1919),'and b3 ends it');
});

test('a chip-hidden battle is not hidden by the collapse and its own events stay on the axis', ()=>{
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(MARKER),'marker',new Set(['b2']));
 assert.equal(state.hidden.has('b2'),false,'the chip-hidden battle is not reached by the collapse');
 for(const id of ['e4','e5','e6']) assert.equal(state.hidden.has(id),false,`${id} belongs to a chip-hidden battle, so it is never collapsed away`);
});

test('a chip-hidden dated child does not hold its parent expanded (the chips decide, not the reading)', ()=>{
 const dated=PAIRS.map(pair=>({...pair,dated:true}));
 const state=nesting.nestingAt(dated,ITEMS,camera(MARKER),'marker',new Set(['b2']));
 assert.equal(state.collapsed.find(span=>span.parent==='war')?.childCount,2,'the war collapses over the two shown battles');
});

test('the partial-load rule still holds with a chip hiding another child: an unloaded shown dated child keeps the parent open', ()=>{
 const loaded=ITEMS.filter(item=>item.id!=='b3');
 const dated=PAIRS.map(pair=>({...pair,dated:true}));
 const state=nesting.nestingAt(dated,loaded,camera(MARKER),'marker',new Set(['b2']));
 assert.equal(state.collapsed.some(span=>span.parent==='war'),false,'b3 is shown by the chips and dated, and not loaded: the war stays expanded');
});

test('a chip-hidden parent never collapses, so it hides no child the chips show', ()=>{
 const state=nesting.nestingAt(PAIRS,ITEMS,camera(MARKER),'marker',new Set(['war']));
 assert.equal(state.collapsed.some(span=>span.parent==='war'),false,'the hidden war has no span');
 assert.equal(state.hidden.has('b1')||state.hidden.has('b2')||state.hidden.has('b3'),false,'and does not hide its battles');
 assert.deepEqual(state.collapsed.map(span=>span.parent).sort(),['b1','b2','b3'],'each shown battle collapses over its own events');
});

test('the collapsed label reads the count of the children: one item in the singular, many in the plural', ()=>{
 assert.equal(nesting.collapsedSpanLabel('War',3),'War · 3 items');
 assert.equal(nesting.collapsedSpanLabel('Battle',1),'Battle · 1 item');
});
