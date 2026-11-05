import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultGraphFilters,filterGraph,restoreGraphFilters,restoreSavedGraphViews} from '../src/knowledge/filters.ts';
import {topologyKey,pointsForReading} from '../src/knowledge/layoutIdentity.ts';
import {ForceWorld} from '../src/knowledge/layout.ts';

const node=(ref,label=ref,extra={})=>({ref,label,kind:'wiki-node',native_owner:'native',provenance:{source:'authored'},actions:[],...extra});
const edge=(from_ref,to_ref,relation='references')=>({from_ref,to_ref,relation,provenance:{source:'authored'}});
const graph=(nodes,edges,extra={})=>({schema:'oi.cradle.graph-reading/v1',nodes,edges,inputs:{},counts:{nodes:nodes.length,edges:edges.length,spaces:0,wiki_nodes:nodes.length,knowledge_rows:0},...extra});

test('ordinary non-QL graph filters actual labels, aliases and tags without creating relations',()=>{
  const source=graph([node('a','Alpha',{aliases:['First'],tags:['reading','science']}),node('b','Beta',{tags:['science']}),node('c','Unconnected')],[edge('a','b')]);
  const before=JSON.stringify(source);
  let result=filterGraph(source,{...defaultGraphFilters(),text:'first'});
  assert.deepEqual(result.nodes.map(n=>n.ref),['a']);
  result=filterGraph(source,{...defaultGraphFilters(),tags:['science'],isolated:false});
  assert.deepEqual(result.nodes.map(n=>n.ref),['a','b']);
  assert.equal(result.edges.length,1);
  assert.equal(JSON.stringify(source),before);
});

test('direction and depth traverse native edges; cycles and missing endpoints terminate',()=>{
  const source=graph(['a','b','c','d'].map(x=>node(x)),[edge('a','b'),edge('b','c'),edge('c','a'),edge('d','a'),edge('a','outside')]);
  const filters={...defaultGraphFilters(),scope:'local',direction:'outgoing'};
  assert.deepEqual(filterGraph(source,filters,'a').nodes.map(n=>n.ref),['a','b']);
  assert.deepEqual(filterGraph(source,{...filters,direction:'incoming'},'a').nodes.map(n=>n.ref),['a','c','d']);
  assert.equal(filterGraph(source,{...filters,depth:8},'a').nodes.length,3);
  assert.equal(filterGraph(source,{...filters,depth:0},'a').nodes.length,1);
  assert.equal(filterGraph(source,filters).localFocusMissing,true);
  assert.equal(filterGraph(source,filters).nodes.length,0,'missing focus must not widen to the global field');
});

test('hidden neighbours do not become source orphans and selected relation type controls traversal',()=>{
  const source=graph(['a','b','c'].map(x=>node(x)),[edge('a','b','supports'),edge('b','outside','references')]);
  const result=filterGraph(source,{...defaultGraphFilters(),relations:['references'],isolated:false});
  assert.deepEqual(result.nodes.map(n=>n.ref),['a','b']);
  assert.equal(result.edges.length,0,'a source outside this bounded reading is not fabricated');
  assert.deepEqual(filterGraph(source,{...defaultGraphFilters(),scope:'local',relations:['supports']},'b').nodes.map(n=>n.ref),['a','b']);
});

test('partial filtering retains the admitted whole without fetching or inventing private context',()=>{
  const source=graph(['whole','a','b','c'].map(x=>node(x)),[edge('a','b')],{formations:[{ref:'whole',shape_ref:'ql:sixfold',members:[{ref:'a',role:'0'},{ref:'b',role:'1'},{ref:'c',role:'2'}]}]});
  const before=JSON.stringify(source);
  let result=filterGraph(source,{...defaultGraphFilters(),text:'a'});
  assert.deepEqual(result.counts,{matched:1,context:3,displayed:4,admitted:4,hidden:0});
  assert.deepEqual([...result.contextual],['whole','b','c']);
  assert.deepEqual(result.partialFormations,[]);
  result=filterGraph(source,{...defaultGraphFilters(),text:'a',context:'matches'});
  assert.deepEqual(result.nodes.map(n=>n.ref),['a']);
  assert.deepEqual(result.partialFormations,['whole']);
  assert.equal(JSON.stringify(source),before,'view operations leave semantic membership intact');
  const admitted=graph([node('whole'),node('a')],[],{formations:[{ref:'whole',members:[{ref:'a'}]}]});
  assert.deepEqual(filterGraph(admitted,{...defaultGraphFilters(),text:'a'}).nodes.map(n=>n.ref),['whole','a']);
});

test('saved-view decoding bounds corrupt or future state without touching sources',()=>{
  const filters=restoreGraphFilters({depth:999,kinds:['wiki-node','wiki-node',1],text:'x'.repeat(2000),scope:'future',arrows:'yes'});
  assert.equal(filters.depth,8);assert.equal(filters.text.length,1024);assert.deepEqual(filters.kinds,['wiki-node']);assert.equal(filters.scope,'field');assert.equal(filters.arrows,false);
  const views=restoreSavedGraphViews([{name:'  Reading  ',filters},{name:'Reading'},{name:''},null]);
  assert.equal(views.length,1);assert.equal(views[0].name,'Reading');
  assert.deepEqual(restoreGraphFilters(null),defaultGraphFilters());
});

test('filter/label/provider state never changes layout identity; reordered owner rows keep positions',()=>{
  const source=graph([node('space','Space',{kind:'wiki-space'}),node('b'),node('a')],[edge('space','a','space-node'),edge('a','b')]);
  const later={...source,nodes:[...source.nodes].reverse().map(n=>({...n,label:n.label+' renamed'})),edges:[...source.edges].reverse(),inputs:{provider:{state:'unavailable'}}};
  assert.equal(topologyKey(source),topologyKey(later));
  const original=new Map(source.nodes.map((n,i)=>[n.ref,new ForceWorld(source).advance(300)[i]]));
  const rearranged=new ForceWorld(later).advance(300);
  later.nodes.forEach((n,i)=>assert.deepEqual(rearranged[i],original.get(n.ref)));
  assert.deepEqual(pointsForReading(later,original),later.nodes.map(n=>original.get(n.ref)));
  assert.notEqual(topologyKey(source),topologyKey({...source,edges:[]}));
});

test('ten-thousand-subject filtering is bounded, complete and leaves the index unchanged',()=>{
  const nodes=Array.from({length:10000},(_,i)=>node(`source:${i}`,`Note ${i}`,{tags:[i%2?'odd':'even']}));
  const edges=nodes.slice(1).map((n,i)=>edge(nodes[i].ref,n.ref));
  const source=graph(nodes,edges);
  const samples=[];
  for(let i=0;i<8;i++){const start=performance.now();const result=filterGraph(source,{...defaultGraphFilters(),tags:['even']});samples.push(performance.now()-start);assert.equal(result.nodes.length,5000);}
  samples.sort((a,b)=>a-b);
  console.info('wiki graph display filter benchmark',JSON.stringify({subjects:nodes.length,edges:edges.length,p95Ms:samples.at(-1),evidence:'controlled Node process, not installed-app or human proof'}));
  assert.equal(source.nodes.length,10000);
  assert.equal(filterGraph(source,{...defaultGraphFilters(),scope:'local',depth:2},'source:5000').nodes.length,5);
});

test('native role geometry survives source layout, filters and repeated-source occurrences',()=>{
  const source=graph(['frame','a0','a1','source'].map(x=>node(x)),[edge('frame','a0'),edge('frame','a1')],{formations:[{ref:'frame',shape_ref:'native:pair',members:[
    {ref:'a0',subject_ref:'source',role:'0',address:{layout:{x:-1,y:0,z:.2}}},
    {ref:'a1',subject_ref:'source',role:'1',address:{layout:{x:1,y:0,z:.2}}}]}]});
  const points=new ForceWorld(source).advance(300),byRef=new Map(source.nodes.map((n,i)=>[n.ref,points[i]]));
  assert.equal(byRef.get('a1').x-byRef.get('a0').x,190);
  assert.equal(byRef.get('a1').y,byRef.get('a0').y);
  assert.equal(byRef.get('a1').z,19);
  const previous=topologyKey(source);
  source.formations[0].members[0].address.layout.x=-2;
  assert.notEqual(topologyKey(source),previous,'native role layout change invalidates layout, not source label edits');
});

test('the live world drags a subject exactly, releases it, and edits retain the settled arrangement',()=>{
  const source=graph([node('space','Space',{kind:'wiki-space'}),node('a'),node('b')],[edge('space','a','space-node'),edge('a','b')]);
  const world=new ForceWorld(source);
  const settledRetained=world.advance(400)&&world.retain();
  world.drag('a',-1000,500);
  const dragged=world.advance(3),byRef=new Map(source.nodes.map((n,i)=>[n.ref,dragged[i]]));
  assert.equal(byRef.get('a').x,-1000,'a dragged subject holds its exact pointer position');
  assert.equal(byRef.get('a').y,500);
  world.release('a');
  const released=world.advance(400),releasedRetained=world.retain();
  assert.ok(Math.hypot(releasedRetained.get('a').x+1000,releasedRetained.get('a').y-500)>1,'a released subject rejoins the simulation');
  const edited=graph([node('space','Space',{kind:'wiki-space'}),node('a'),node('b'),node('c')],[edge('space','a','space-node'),edge('a','b'),edge('b','c')]);
  const next=new ForceWorld(edited,settledRetained).advance(300);
  const after=new Map(edited.nodes.map((n,i)=>[n.ref,next[i]]));
  assert.ok(Math.hypot(after.get('space').x-settledRetained.get('space').x,after.get('space').y-settledRetained.get('space').y)<40,'an edited topology starts from the settled arrangement instead of resettling');
  assert.equal(after.get('c').z,0,'free subjects carry no generated depth');
});

test('source occurrences and authored QL relations remain separately filterable layers',()=>{
  const source=graph([node('a'),node('b')],[{...edge('a','b','references'),family:'source-occurrence'},{...edge('a','b','qualifies'),family:'ql-authored'}]);
  const result=filterGraph(source,{...defaultGraphFilters(),families:['ql-authored']});
  assert.deepEqual(result.edges.map(e=>e.relation),['qualifies']);
  assert.equal(source.edges.length,2);
});

// O-I #742, the done-whens PROJECTION-SCALE-2026-10-28 (#773) added: the Knowledge graph's Budget as the manual has it (DLW §17.3 Parameters,
// "8–4096 nodes · 64 · Sets the most nodes that show. The graph says when it hides more."), bounding the drawn and the simulated set by hops
// from the selected note first, then by degree; and the layout's positions published in batches above a thousand nodes.
test('the Budget is the view\'s own: 8 to 4096 nodes, 64 until you set it, a corrupt one read as the default', async () => {
  const {GRAPH_BUDGET} = await import('../src/knowledge/filters.ts');
  assert.deepEqual({...GRAPH_BUDGET}, {min: 8, max: 4096, initial: 64});
  assert.equal(defaultGraphFilters().budget, 64);
  assert.equal(restoreGraphFilters({}).budget, 64, 'a view kept before the Budget shows 64');
  assert.equal(restoreGraphFilters({budget: 2}).budget, 8);
  assert.equal(restoreGraphFilters({budget: 100000}).budget, 4096);
  assert.equal(restoreGraphFilters({budget: 12.5}).budget, 64);
  assert.equal(restoreGraphFilters({budget: '512'}).budget, 64);
  assert.equal(restoreGraphFilters({budget: 512}).budget, 512);
  assert.equal(restoreSavedGraphViews([{name: 'Wide', filters: {budget: 1024}}])[0].filters.budget, 1024, 'a saved view keeps its Budget');
});

test('the Budget keeps the nodes nearest the selected note, then the most connected, and says how many it hides', async () => {
  const {budgetGraph} = await import('../src/knowledge/filters.ts');
  // A chain a–b–c–d–e, and a hub h with four leaves of its own; z alone.
  const refs = ['a', 'b', 'c', 'd', 'e', 'h', 'l1', 'l2', 'l3', 'l4', 'z'];
  const source = graph(refs.map(ref => node(ref)), [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'e'),
    edge('h', 'l1'), edge('h', 'l2'), edge('h', 'l3'), edge('h', 'l4'), edge('e', 'outside'), edge('z', 'elsewhere')]);
  const within = budgetGraph(source, 64, 'a');
  assert.equal(within.reading, source, 'within the Budget: the reading as it is');
  assert.deepEqual([within.shown, within.total, within.beyond], [11, 11, 0]);
  const near = budgetGraph(source, 8, 'a');
  assert.deepEqual(near.reading.nodes.map(n => n.ref), ['a', 'b', 'c', 'd', 'e', 'h', 'l1', 'l2'], 'the chain from a by hops, then the hub by its degree, then by reference');
  assert.deepEqual([near.shown, near.total, near.beyond], [8, 11, 3]);
  assert.ok(near.reading.edges.some(e => e.from_ref === 'e' && e.to_ref === 'outside'), 'a kept note keeps its relation past the reading');
  assert.ok(near.reading.edges.some(e => e.to_ref === 'l3'), 'a relation with one end kept stays');
  assert.ok(!near.reading.edges.some(e => e.from_ref === 'z'), 'a relation with neither end kept goes');
  const none = budgetGraph(source, 8);
  assert.deepEqual(none.reading.nodes.map(n => n.ref), ['a', 'b', 'c', 'd', 'e', 'h', 'l1', 'l2'], 'nothing selected: the most connected (h, then b, c, d), then by reference; z, with no relation, goes');
  assert.equal(none.beyond, 3);
  assert.deepEqual(budgetGraph(source, 8, 'a').reading.nodes, near.reading.nodes, 'the same reading and selection keep the same set');
  assert.equal(JSON.stringify(source.nodes.length), '11', 'the reading itself is untouched');
  // The view's filters then act on what the Budget keeps: its hidden count is the scope's and the filters', the Budget's is its own.
  const kept = filterGraph(near.reading, {...defaultGraphFilters(), isolated: false}, 'a');
  assert.ok(kept.nodes.some(n => n.ref === 'e'), 'e keeps its relation past the reading, so it is no orphan');
});

test('above a thousand nodes the layout publishes at most every 100 ms of worker time, and once at the end', async () => {
  const {layoutPublisher, BATCHED_ABOVE, BATCH_MS} = await import('../src/knowledge/layout.ts');
  assert.deepEqual([BATCHED_ABOVE, BATCH_MS], [1000, 100]);
  let now = 0;
  const posts = [];
  const small = layoutPublisher(974, () => posts.push(['small', now]), () => now);
  for (let i = 0; i < 5; i++) { now += 3; small.tick(); }
  small.end();
  assert.equal(posts.filter(p => p[0] === 'small').length, 6, 'a thousand or fewer: every tick, and the end');
  now = 0;
  const large = layoutPublisher(3896, () => posts.push(['large', now]), () => now);
  for (let i = 0; i < 300; i++) { now += 16.3; large.tick(); }
  const ticks = posts.filter(p => p[0] === 'large');
  assert.ok(ticks.length >= 40 && ticks.length <= 50, `one post in each seven ticks of 16.3 ms, about 4.9 s in all: ${ticks.length}`);
  for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i][1] - ticks[i - 1][1] >= 100, 'never two posts within 100 ms')
  large.end();
  assert.equal(posts.at(-1)[0], 'large', 'the settled arrangement is always published');
  assert.equal(posts.filter(p => p[0] === 'large').length, ticks.length + 1);
});

test('code reading: the pane bounds its drawn and simulated set by the Budget and says when it hides more', async () => {
  const {readFile} = await import('node:fs/promises');
  const read = path => readFile(new URL(`../src/knowledge/${path}`, import.meta.url), 'utf8');
  const surface = await read('KnowledgeSurface.tsx');
  assert.match(surface, /const bounded=useMemo\(\(\)=>visibleModel\?budgetGraph\(visibleModel,filters\.budget,visit\.selected\):undefined,\[visibleModel,filters\.budget,visit\.selected\]\)/);
  assert.match(surface, /filterGraph\(bounded\.reading,filters,visit\.selected\)/, 'the filters act on what the Budget keeps');
  assert.match(surface, /const layout=useLayout\(bounded\?\.reading\)/, 'only what the Budget keeps is simulated');
  assert.match(surface, /counts:filtered&&bounded\?\{\.\.\.filtered\.counts,beyond:bounded\.beyond,total:bounded\.total\}:null/, 'the handle says what the Budget hides');
  assert.doesNotMatch(surface, /positions\[nodes\.findIndex/, 'positions are read by reference from the simulated set, never by the whole reading\'s order');
  const panel = await read('GraphFilters.tsx');
  assert.match(panel, /aria-label="Graph budget" type="number" min=\{GRAPH_BUDGET\.min\} max=\{GRAPH_BUDGET\.max\}/);
  assert.match(panel, /The Budget shows \{bounded\.shown\} of \{bounded\.total\} subjects: \{bounded\.beyond\} more/);
  assert.match(await read('layout.ts'), /const publisher=layoutPublisher\(this\.out\.length,\(\)=>publish\(this\.positions\(\)\),clock\);\n\s*this\.sim\.on\("tick",publisher\.tick\)\.on\("end",publisher\.end\)/);
});
