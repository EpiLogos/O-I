import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultGraphFilters,filterGraph,restoreGraphFilters,restoreSavedGraphViews} from '../src/knowledge/filters.ts';
import {topologyKey,pointsForReading} from '../src/knowledge/layoutIdentity.ts';
import {constellation} from '../src/knowledge/layout.ts';

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
  const original=new Map(source.nodes.map((n,i)=>[n.ref,constellation(source,0,0)[i]]));
  const rearranged=constellation(later,0,0);
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
  const points=constellation(source,0,0),byRef=new Map(source.nodes.map((n,i)=>[n.ref,points[i]]));
  assert.equal(byRef.get('a1').x-byRef.get('a0').x,190);
  assert.equal(byRef.get('a1').y,byRef.get('a0').y);
  assert.equal(byRef.get('a1').z,19);
  const previous=topologyKey(source);
  source.formations[0].members[0].address.layout.x=-2;
  assert.notEqual(topologyKey(source),previous,'native role layout change invalidates layout, not source label edits');
});

test('source occurrences and authored QL relations remain separately filterable layers',()=>{
  const source=graph([node('a'),node('b')],[{...edge('a','b','references'),family:'source-occurrence'},{...edge('a','b','qualifies'),family:'ql-authored'}]);
  const result=filterGraph(source,{...defaultGraphFilters(),families:['ql-authored']});
  assert.deepEqual(result.edges.map(e=>e.relation),['qualifies']);
  assert.equal(source.edges.length,2);
});
