import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {applySavedGraphView,isUnresolvedGraphNode,projectUnresolvedGraph,unresolvedGraphAssociations,unresolvedAssociationsAllowed} from '../src/knowledge/graphNavigation.ts';
import {captureSavedGraphView,defaultGraphFilters,filterGraph,restoreGraphFilters,restoreSavedGraphViews} from '../src/knowledge/filters.ts';
import {accommodate,screenPoint} from '../src/knowledge/camera.ts';
import {ForceWorld} from '../src/knowledge/layout.ts';
import {topologyKey} from '../src/knowledge/layoutIdentity.ts';

// This is the shipped, pinned 1.7.7 renderer capture used by the real Rust
// link-parity suite, not a fabricated successful native response. The owner
// GraphReading shape deliberately separates unresolved links from native edges.
const oracle=JSON.parse(await readFile(new URL('../kernel/tests/fixtures/obsidian-links-parity/oracle.json',import.meta.url),'utf8'));
const provenance={source:'obsidian-1.7.7/captured-link-cache'};
const node=ref=>({ref,label:ref,kind:'file',native_owner:'central',provenance,actions:[]});
function capturedReading(){
  const nodes=Object.keys(oracle.resolvedLinks).map(node),refs=new Set(nodes.map(n=>n.ref));
  const edges=Object.entries(oracle.resolvedLinks).flatMap(([source,targets])=>Object.entries(targets)
    .filter(([target])=>refs.has(target)).map(([target,count])=>({from_ref:source,to_ref:target,relation:'wiki-link',provenance,metadata:{occurrences:count}})));
  const unresolved=new Map();
  for(const [source,targets] of Object.entries(oracle.unresolvedLinks))for(const [key,count] of Object.entries(targets)){
    const row=unresolved.get(key)??{key,sources:{},provenance};row.sources[source]=count;unresolved.set(key,row);
  }
  return {schema:'oi.cradle.graph-reading/v1',nodes,edges,inputs:{},counts:{spaces:0,wiki_nodes:0,knowledge_rows:0,nodes:nodes.length,edges:edges.length},unresolved_links:[...unresolved.values()]};
}

test('presentation of the captured A3 cache matches all16 nodes and19 live visual pairs without altering native edges',()=>{
  const reading=capturedReading(),before=JSON.stringify(reading),projected=projectUnresolvedGraph(reading);
  const displayed=filterGraph(projected,defaultGraphFilters());
  assert.equal(displayed.nodes.length,oracle.live_graph.nodes);
  assert.equal(projected.edges,reading.edges,'presentation retains the actual native edge array');
  assert.equal(projected.counts,reading.counts,'native owner counts remain native counts');
  const ghosts=new Map(displayed.nodes.filter(isUnresolvedGraphNode).map(n=>[n.ref,n.unresolved.key]));
  assert.equal(ghosts.size,4);
  const pairs=[...displayed.edges.map(e=>`${e.from_ref} --> ${e.to_ref}`),
    ...unresolvedGraphAssociations(displayed.nodes).map(link=>`${link.source} --> ${ghosts.get(link.ghost)}`)];
  assert.deepEqual(pairs.sort(),[...oracle.live_graph.edges].sort());
  assert.equal(JSON.stringify(reading),before);
  const missing=displayed.nodes.find(n=>isUnresolvedGraphNode(n)&&n.unresolved.key==='Missing');
  assert.deepEqual(missing.unresolved.sources,{'Alpha.md':3});assert.deepEqual(missing.actions,[]);assert.equal(missing.address,undefined);
});

test('ghost identities preserve case and exact owner keys, avoid native collisions, and never fabricate missing endpoints',()=>{
  const reading=capturedReading();
  reading.nodes.push(node('view:unresolved-link:Missing'));
  reading.unresolved_links.push({key:'Missing',sources:{'Alpha.md':3,'outside:unread-source':7},provenance});
  reading.unresolved_links.push({key:'missing',sources:{'Alpha.md':1},provenance});
  reading.unresolved_links.push({key:'opaque#owner-key|as-disclosed.md',sources:{'Alpha.md':2},provenance});
  const projected=projectUnresolvedGraph(reading),ghosts=projected.nodes.filter(isUnresolvedGraphNode);
  assert.equal(new Set(projected.nodes.map(n=>n.ref)).size,projected.nodes.length);
  const missing=ghosts.find(n=>n.label==='Missing');assert.equal(missing.ref,'view:unresolved-link:Missing:view');
  assert.equal(missing.unresolved.sources['Alpha.md'],3,'duplicate disclosure does not multiply occurrences');
  assert.equal(missing.unresolved.sources['outside:unread-source'],7);
  assert.ok(ghosts.some(n=>n.label==='missing'));assert.ok(ghosts.some(n=>n.label==='opaque#owner-key|as-disclosed.md'));
  assert.equal(unresolvedGraphAssociations(projected.nodes).some(link=>link.source==='outside:unread-source'),false);
  assert.equal(projected.edges,reading.edges);
});

test('unresolved toggle and local direction operate on real disclosed associations while retaining native relation records',()=>{
  const reading=projectUnresolvedGraph(capturedReading()),filters=defaultGraphFilters(),before=JSON.stringify(reading),identity=topologyKey(reading);
  const hidden=filterGraph(reading,{...filters,unresolved:false});
  assert.equal(hidden.nodes.some(isUnresolvedGraphNode),false);assert.deepEqual(hidden.edges,reading.edges);
  const ghost=reading.nodes.find(n=>isUnresolvedGraphNode(n)&&n.label==='Missing');
  const local=filterGraph(reading,{...filters,scope:'local',direction:'outgoing'},'Alpha.md');
  assert.ok(local.nodes.some(n=>n.ref===ghost.ref));
  assert.equal(filterGraph(reading,{...filters,scope:'local',direction:'incoming'},'Alpha.md').nodes.some(n=>n.ref===ghost.ref),false);
  assert.deepEqual(filterGraph(reading,{...filters,scope:'local',direction:'incoming'},ghost.ref).nodes.map(n=>n.ref),['Alpha.md',ghost.ref]);
  const supports={...filters,scope:'local',relations:['supports']};
  assert.equal(unresolvedAssociationsAllowed(supports),false);
  assert.deepEqual(filterGraph(reading,supports,'Alpha.md').nodes.map(n=>n.ref),['Alpha.md']);
  assert.equal(topologyKey(reading),identity);assert.equal(JSON.stringify(reading),before);
  const world=new ForceWorld(reading),points=world.advance(30);assert.equal(points.length,reading.nodes.length);
  assert.ok(points.every(point=>[point.x,point.y].every(Number.isFinite)));
  assert.equal(restoreGraphFilters(JSON.parse(JSON.stringify({...filters,unresolved:false}))).unresolved,false);
  assert.equal(restoreGraphFilters({}).unresolved,true,'A3 default shows unresolved markers');
});

test('saved camera and local focus survive serialization and restore the actual rendered viewport at a different live node position',()=>{
  const filters={...defaultGraphFilters(),scope:'local',depth:2,unresolved:false,emphasis:[{id:'group',label:'Owned',color:'#336699',text:'Alpha',kinds:['file'],tags:[],enabled:true}]};
  const camera={zoom:2.2,x:-179,y:63},focus='Alpha.md';
  const saved=captureSavedGraphView('  Working graph  ',filters,camera,focus),before=structuredClone(saved);
  assert.deepEqual(saved.filters.emphasis,filters.emphasis);
  filters.emphasis[0].label='Changed later';camera.x=0;assert.deepEqual(saved,before);
  const restored=restoreSavedGraphViews(JSON.parse(JSON.stringify([saved])))[0];assert.deepEqual(restored,saved);
  const visit={query:'native scope',selected:'another subject',camera:{zoom:.5,x:8,y:9},detail:true,detailReturn:{query:'return',camera:{zoom:1,x:0,y:0}}};
  const point={x:870,y:-120},extent={width:960,height:680};
  const applied=applySavedGraphView(visit,restored,{point,extent});
  assert.equal(applied.selected,focus);assert.equal(applied.detail,false);assert.equal(applied.detailReturn,undefined);assert.equal(applied.query,visit.query);
  const rendered=accommodate(applied.camera,point,{x:0,y:0,...extent},extent);
  assert.deepEqual(rendered,saved.camera);
  assert.deepEqual(screenPoint({x:275,y:390},rendered,extent.width,extent.height),screenPoint({x:275,y:390},saved.camera,extent.width,extent.height));
  assert.deepEqual(applied.filters,saved.filters);assert.equal(visit.selected,'another subject');
  const local=filterGraph(projectUnresolvedGraph(capturedReading()),applied.filters,applied.selected);
  assert.equal(local.localFocusMissing,false);assert.ok(local.nodes.some(n=>n.ref===focus));
});

test('legacy filter-only and corrupt saved cameras keep the existing viewport and exact focus',()=>{
  const visit={query:'native scope',selected:'opaque:actual-subject',camera:{zoom:.6,x:81,y:-19},detail:true};
  const [legacy,corrupt]=restoreSavedGraphViews([{name:'old',filters:{text:'Alpha'}},{name:'corrupt',filters:{text:'Bravo'},camera:{zoom:Infinity,x:3,y:4},focus:'invented'}]);
  for(const saved of [legacy,corrupt]){
    const applied=applySavedGraphView(visit,saved);assert.deepEqual(applied.camera,visit.camera);assert.equal(applied.selected,visit.selected);assert.equal(applied.detail,true);
    assert.equal(saved.camera,undefined);assert.equal(saved.focus,undefined);
  }
  for(const zoom of [.15,4])assert.equal(restoreSavedGraphViews([{name:String(zoom),camera:{zoom,x:0,y:0}}])[0].camera.zoom,zoom);
  assert.throws(()=>captureSavedGraphView('bad',defaultGraphFilters(),{zoom:1,x:NaN,y:0}),/finite camera/);
});

test('owner re-resolution replaces a phantom with the actual source and native relation on the next reading',()=>{
  const prior=capturedReading(),shown=projectUnresolvedGraph(prior);
  assert.ok(shown.nodes.some(n=>isUnresolvedGraphNode(n)&&n.label==='Missing'));
  const later=structuredClone(prior);later.nodes.push(node('Missing.md'));
  later.unresolved_links=later.unresolved_links.filter(link=>link.key!=='Missing');
  const resolved={from_ref:'Alpha.md',to_ref:'Missing.md',relation:'wiki-link',provenance,metadata:{occurrences:3}};later.edges.push(resolved);
  const current=projectUnresolvedGraph(later),result=filterGraph(current,defaultGraphFilters());
  assert.equal(current.nodes.some(n=>isUnresolvedGraphNode(n)&&n.label==='Missing'),false);
  assert.ok(result.nodes.some(n=>n.ref==='Missing.md'&&n.native_owner==='central'));
  assert.equal(result.edges.at(-1),resolved);assert.equal(current.edges,later.edges);
  assert.ok(prior.unresolved_links.some(link=>link.key==='Missing'));
});

test('A3 self-loops remain native assertions but do not prevent an isolated subject from hiding',()=>{
  const reading=capturedReading(),before=JSON.stringify(reading),projected=projectUnresolvedGraph(reading);
  const self=reading.edges.find(edge=>edge.from_ref==='SelfLoop.md'&&edge.to_ref==='SelfLoop.md');
  assert.ok(self,'the pinned owner oracle contains the native self-loop');
  assert.equal(self.metadata.occurrences,2);
  assert.ok(filterGraph(projected,defaultGraphFilters()).edges.includes(self),'default view retains the native assertion');
  const filtered=filterGraph(projected,{...defaultGraphFilters(),isolated:false});
  assert.equal(filtered.nodes.some(node=>node.ref==='SelfLoop.md'),false,'A3 orphan law ignores a subject’s self-loop');
  assert.equal(filtered.nodes.some(node=>node.ref==='Orphan.md'),false);
  assert.ok(filtered.nodes.some(node=>node.ref==='Alpha.md'));
  assert.ok(filtered.nodes.some(node=>isUnresolvedGraphNode(node)&&node.unresolved.key==='Missing'),'a real disclosed source association prevents the unresolved marker from being isolated');
  assert.equal(projected.edges,reading.edges);assert.ok(reading.edges.includes(self));
  assert.equal(JSON.stringify(reading),before);
});

// Render the actual production components. No kernel transport, canvas success,
// or network reply is supplied; installed drawing/interaction stays a live gate.
register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
const {GraphCanvas}=await import('../src/knowledge/GraphCanvas.tsx');
const {GraphFilters}=await import('../src/knowledge/GraphFilters.tsx');
test('production renderer exposes unresolved markers without source-open actions and keeps the saved-view controls',()=>{
  const reading=projectUnresolvedGraph(capturedReading()),filters=defaultGraphFilters(),result=filterGraph(reading,filters),camera={zoom:1.3,x:17,y:23};
  const html=renderToStaticMarkup(createElement(GraphCanvas,{nodes:result.nodes,positions:new ForceWorld(reading).advance(1),model:reading,camera,focused:new Set(),minZoom:.15,maxZoom:4,onCamera(){},onOpen(){throw Error('SSR must not dispatch a source read');},onClear(){}}));
  assert.equal((html.match(/data-unresolved-link=/g)??[]).length,4);
  assert.match(html,/Unresolved link Missing; 1 disclosed sources; no resolved source to open/);
  assert.doesNotMatch(html,/>Open Missing<\/button>/);
  assert.match(html,/>Open Alpha.md<\/button>/);
  const controls=renderToStaticMarkup(createElement(GraphFilters,{reading,filters,result,camera,saved:[captureSavedGraphView('Exact view',filters,camera)],onChange(){},onSave(){},onApply(){}}));
  assert.match(controls,/Show unresolved link markers/);assert.match(controls,/>Exact view<\/button>/);assert.match(controls,/subjects and unresolved markers/);
});
