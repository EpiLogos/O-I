import test from 'node:test';
import assert from 'node:assert/strict';
import {appendGraphVisit,graphDragPosition,openGraphVisit,returnGraphVisit,restoreGraphReturn,selectGraphVisit} from '../src/knowledge/graphNavigation.ts';
import {accommodate,unaccommodate,screenPoint} from '../src/knowledge/camera.ts';
import {neighbourhood} from '../src/knowledge/focus.ts';
import {defaultGraphFilters} from '../src/knowledge/filters.ts';

const source='central:source:project:研究:notes/one#exact';
const peer='central:source:project:研究:notes/two#exact';
const visit=()=>({query:'source scope',selected:source,camera:{zoom:1.6,x:-83,y:51},overviewCamera:{zoom:.8,x:20,y:-10},filters:{...defaultGraphFilters(),scope:'local',depth:2,text:'research',relations:['supports'],tags:['exact']},pageAddress:{kind:'source',value:source},pageTitle:'Original source',pageAnchor:{heading:'prior-anchor'},scroll:47});

test('selection retains exact native refs and real neighbourhood without changing owner disclosures',()=>{
  const original=visit(),before=structuredClone(original),selected=selectGraphVisit(original,peer);
  assert.equal(selected.selected,peer);assert.deepEqual(selected.camera,original.camera);assert.deepEqual(selected.filters,original.filters);
  const reading={nodes:[{ref:source},{ref:peer}],edges:[{from_ref:peer,to_ref:source,relation:'supports'}]};
  const snapshot=structuredClone(reading);assert.deepEqual([...neighbourhood(reading,selected.selected)],[peer,source]);assert.deepEqual(reading,snapshot);
  selected.filters.tags.push('view-only');assert.deepEqual(original,before,'selection owns its presentation snapshot, not a mutable source reading');
});

test('opening a source and following another source returns exact graph selection, camera and filters after serialization',()=>{
  const original=visit(),before=structuredClone(original),opened=openGraphVisit(original,source);
  assert.equal(opened.selected,source);assert.equal(opened.detail,true);assert.equal(opened.pageAnchor,undefined,'another subject never inherits an old source anchor');
  assert.deepEqual(opened.camera,{zoom:1.6,x:0,y:0});
  opened.pageAddress={kind:'source',value:source};opened.pageAnchor={heading:'new-anchor'};
  const followed=openGraphVisit(opened,peer);followed.pageAddress={kind:'source',value:peer};followed.pageTitle='Peer';followed.pageAnchor={heading:'peer-anchor'};
  followed.camera={zoom:2,x:33,y:44};followed.filters.depth=5;
  const reloaded=JSON.parse(JSON.stringify(followed));reloaded.detailReturn=restoreGraphReturn(reloaded.detailReturn);
  assert.deepEqual(returnGraphVisit(reloaded),original);assert.deepEqual(original,before);
  assert.equal('detailReturn' in followed.detailReturn,false,'source navigation keeps one graph return, never nested source snapshots');
});

test('back and forward travel carry addressed source detail and branch after a return',()=>{
  const graph=visit(),selected=selectGraphVisit(graph,peer);
  let travel={visits:[graph],index:0,saved:[{name:'Retained view'}]};
  travel=appendGraphVisit(travel,selected);travel=appendGraphVisit(travel,openGraphVisit(selected,peer));
  assert.equal(travel.visits[2].detail,true);assert.equal(travel.visits[2].selected,peer);assert.equal(travel.visits[1].detail,undefined);
  const back={...travel,index:1};assert.deepEqual(back.visits[back.index],selected);
  const forward={...back,index:2};assert.equal(forward.visits[forward.index].selected,peer);
  travel=appendGraphVisit(back,selectGraphVisit(selected,source));assert.equal(travel.visits.length,3);assert.equal(travel.visits[2].selected,source);assert.equal(travel.visits[2].detail,undefined);
  for(let i=0;i<40;i++)travel=appendGraphVisit(travel,selectGraphVisit(graph,`opaque:subject:${i}`));
  assert.equal(travel.visits.length,32);assert.equal(travel.index,31);assert.deepEqual(travel.saved,[{name:'Retained view'}]);
});

test('picking a subject preserves the rendered camera for its second click and source return',()=>{
  const graph=visit(),point={x:590,y:330},extent={width:900,height:600},region={x:0,y:0,...extent};
  const prior=accommodate(graph.camera,{x:420,y:250},region,extent);
  const selected=selectGraphVisit(graph,peer);selected.camera=unaccommodate(prior,point,region,extent);
  const picked=accommodate(selected.camera,point,region,extent);
  assert.deepEqual(screenPoint(point,picked,extent.width,extent.height),screenPoint(point,prior,extent.width,extent.height));
  const returned=returnGraphVisit(openGraphVisit(selected,peer));assert.deepEqual(returned,selected);
  assert.deepEqual(accommodate(returned.camera,point,region,extent),picked);
});

test('graph dragging uses the captured origin and zoom for every real pointer displacement',()=>{
  const origin={x:100,y:200},capturedZoom=2;
  const moved=graphDragPosition(origin,{x:30,y:-20},capturedZoom);
  assert.deepEqual(moved,{x:115,y:190});
  for(let i=0;i<10;i++)assert.deepEqual(graphDragPosition(origin,{x:30,y:-20},capturedZoom),moved);
  assert.deepEqual(graphDragPosition(origin,{x:60,y:-40},capturedZoom),{x:130,y:180});
  assert.deepEqual(origin,{x:100,y:200});assert.throws(()=>graphDragPosition(origin,{x:1,y:2},0),/captured camera/);
});

test('legacy graph release remains available and malformed persisted return cannot change the camera',()=>{
  const legacy=visit(),released=returnGraphVisit(legacy);
  assert.equal(released.selected,undefined);assert.deepEqual(released.camera,legacy.overviewCamera);
  assert.equal(restoreGraphReturn({...legacy,camera:{zoom:NaN,x:0,y:0}}),undefined);
  assert.equal(restoreGraphReturn({...legacy,camera:{zoom:100,x:0,y:0}}),undefined);
  const malformed={...legacy,detail:true,detailReturn:{detailReturn:{camera:{zoom:NaN,x:0,y:0}}},pageAddress:{kind:'unsupported',value:'invented'}};
  const restored=restoreGraphReturn(malformed);assert.equal(restored.pageAddress,undefined);assert.equal('detailReturn' in restored,false);
});
