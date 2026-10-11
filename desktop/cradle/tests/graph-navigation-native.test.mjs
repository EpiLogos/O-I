import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ForceWorld} from '../src/knowledge/layout.ts';
import {screenPoint} from '../src/knowledge/camera.ts';
import {captureGraphContext,resolveGraphContext} from '../src/knowledge/graphContext.ts';
import {graphScreenEdges,hitGraphScreenEdge,emphasizedGraphRelations,admitGraphLabel} from '../src/knowledge/graphRelationPresentation.ts';
import {projectNavigationMinimap,navigationMinimapPoint,navigationViewport,navigationCameraAt} from '../src/shared/navigationMinimapGeometry.ts';
const source=process.env.OI_NATIVE_GRAPH_RECEIPT??'/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/graph-episode-2026-10-08T01-18-39-810Z/graph-central.json';
const receipt=JSON.parse(await readFile(source,'utf8'));
assert.equal(receipt.request.op,'graph');assert.equal(receipt.response.outcome.result,'graph_reading');
const reading=receipt.response.outcome.reading;
assert.equal(reading.schema,'oi.cradle.graph-reading/v1');assert.ok(reading.nodes.length>0);assert.ok(reading.edges.length>0);
const original=JSON.stringify(reading),world=new ForceWorld(reading),positions=world.advance(100);world.stop();
const actual=reading.nodes.map((node,index)=>({id:node.ref,...positions[index]}));
const camera={x:120,y:-60,zoom:.8},extent={width:1000,height:650},origin={x:400,y:260},screenOrigin={x:500,y:325};
test('actual archived Graph sources feed one minimap and retain exact inverse camera geometry',()=>{
 const projection=projectNavigationMinimap(actual,{width:160,height:104});assert.ok(projection);
 for(const node of actual){
  const point=navigationMinimapPoint(node,projection),jump=navigationCameraAt(point,projection,camera,extent,origin,screenOrigin);
  const visible=screenPoint(node,jump,extent.width,extent.height);
  assert.ok(Math.abs(visible.x-extent.width/2)<1e-8);assert.ok(Math.abs(visible.y-extent.height/2)<1e-8);assert.equal(jump.zoom,camera.zoom);
 }
 const viewport=navigationViewport(camera,extent,origin,screenOrigin);
 assert.deepEqual(screenPoint({x:viewport.left,y:viewport.top},camera,extent.width,extent.height),{x:0,y:0});
 assert.equal(JSON.stringify(reading),original);
});
test('the same minimap model admits Canvas origin and rejects an absent or malformed viewport',()=>{
 const projection=projectNavigationMinimap(actual,{width:160,height:104}),target=actual[0],point=navigationMinimapPoint(target,projection);
 const jump=navigationCameraAt(point,projection,camera,extent,{x:0,y:0},{x:0,y:0});
 assert.ok(Math.abs(target.x*jump.zoom+jump.x-extent.width/2)<1e-8);assert.ok(Math.abs(target.y*jump.zoom+jump.y-extent.height/2)<1e-8);
 assert.equal(projectNavigationMinimap([],{width:160,height:104}),null);
 assert.throws(()=>navigationViewport({...camera,zoom:0},extent,origin,screenOrigin),/finite/);
 assert.throws(()=>navigationCameraAt({x:NaN,y:0},projection,camera,extent,origin,screenOrigin),/finite/);
});
test('native relations retain vocabulary and only disclosed finite endpoints gain captions or hits',()=>{
 const lookup=new Map(actual.map(node=>[node.id,screenPoint(node,camera,extent.width,extent.height)])),edges=graphScreenEdges(reading.edges,lookup);
 assert.ok(edges.length>0);assert.ok(edges.length<reading.edges.length,'undisclosed source endpoints must remain absent');
 for(const edge of edges){assert.equal(edge.edge,reading.edges[edge.index]);assert.ok(lookup.has(edge.edge.from_ref));assert.ok(lookup.has(edge.edge.to_ref));}
 assert.deepEqual(emphasizedGraphRelations(edges,{focused:new Set()}),[]);
 const candidate=edges.find(edge=>Math.hypot(edge.from.x-edge.to.x,edge.from.y-edge.to.y)>1);
 assert.ok(candidate);const point={x:(candidate.from.x+candidate.to.x)/2,y:(candidate.from.y+candidate.to.y)/2};
 assert.ok(hitGraphScreenEdge(edges,point,2));
 assert.deepEqual(emphasizedGraphRelations(edges,{hoveredEdge:candidate.index,focused:new Set()}),[candidate]);
 const focused=new Set([candidate.edge.from_ref,candidate.edge.to_ref]);
 assert.ok(emphasizedGraphRelations(edges,{selected:candidate.edge.from_ref,focused}).includes(candidate));
 assert.deepEqual(graphScreenEdges(reading.edges,new Map()),[]);
 assert.equal(hitGraphScreenEdge(edges,{x:NaN,y:0},5),undefined);
 assert.equal(admitGraphLabel({x:0,y:0,w:30,h:10},[{x:5,y:5,w:30,h:10}]),false);
 assert.equal(admitGraphLabel({x:0,y:0,w:30,h:10},[{x:40,y:5,w:30,h:10}]),true);
 assert.equal(JSON.stringify(reading),original);
});
test('context acts resolve actual native source again and refuse revision, owner, address, or ambiguity changes',()=>{
 const node=reading.nodes[0],basis=captureGraphContext(node);
 assert.equal(resolveGraphContext(basis,reading.nodes),node);
 for(const changed of [{...node,native_owner:'foreign'},{...node,provenance:{...node.provenance,revision:'changed'}},{...node,address:{kind:'source',value:'foreign'}},{...node,actions:[...node.actions,'foreign']}]){
  assert.equal(resolveGraphContext(basis,[changed,...reading.nodes.slice(1)]),undefined);
 }
 assert.equal(resolveGraphContext(basis,[]),undefined);assert.equal(resolveGraphContext(basis,[...reading.nodes,node]),undefined);
 assert.equal(JSON.stringify(reading),original);
});
