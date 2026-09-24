/** Reads the admitted 192-node stress Wiki without modifying its source or
 * app state. Only the test's private Expression owner receives a projection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {readRegister} from '../src/knowledge/construction.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {readWikiSceneTechne} from '../src/techne/wikiReadingProvider.ts';
import {wikiSceneNodeReadings} from '../src/techne/wikiSceneNodeReadings.ts';
import {resolveHostedSource} from '../src/expressions/sourceHandoff.ts';
import {kernelOp} from '../src/kernel/bridge.ts';
const artifact=process.env.OI_NATIVE_TIMELINE_STRESS_PROOF;
test('actual native Scene relations reach dated-source focus and filter rendered native endpoints',{skip:!artifact,timeout:120000},async()=>{
 const actual=JSON.parse(await readFile(artifact,'utf8')),before=await readFile(actual.source_path);
 assert.equal(actual.counts.native_subjects,192);
 const scratch=await mkdtemp(join(tmpdir(),'oi-native-tags-'));
 const env={...process.env,...actual.environment,OI_HOME:join(scratch,'oi-home')};
 const child=spawn(process.env.OI_KERNEL_BIN||actual.binaries.OI_KERNEL_BIN.path,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 try{
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/\S+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url},current=await readRegister(transport),frame=current.frames.find(row=>row.ref===actual.frame_ref);assert.ok(frame);
  const opened=await kernelOp(transport,{op:'expression',request:{operation:'open',document:actual.document,actor:'human:native-relation-reading-test'}});assert.equal(opened.error,undefined,JSON.stringify(opened));
  const document=opened.outcome.data.document,scene=document.scenes.find(row=>row.scene_ref===actual.scene_ref);assert.ok(scene);
  publishWikiNativeRegisters([]);
  const request={expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref,facet:'node-metadata'};
  const packet=await readWikiSceneTechne(transport,request);
  assert.equal(packet.node_readings.length,192);assert.equal(packet.register.source_ref,current.source_ref);assert.equal(packet.register.revision,current.file.revision);
  const parsed=JSON.parse(current.file.content),objects=Array.isArray(parsed)?parsed:parsed.objects;
  for(const row of packet.node_readings){const source=objects.find(node=>node.ref===row.subject_ref);assert.ok(source);assert.equal(row.subject_revision,String(source.revision));assert.deepEqual(row.tags,[...new Set(source.tags)].sort());}
  const source=fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url));
  const compiled=await build({stdin:{contents:"export {readingInstruments,nativeInstrumentTitles,nativeInstrumentNodeTags,nativeInstrumentSourceRelations} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';export {TimelineRelationField} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineRelationField.tsx';export {TimelineWalk} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineWalk.tsx';export {TimelineWorkingSet} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineWorkingSet.tsx';export {createTimelineStore} from '../../vendor/research-canvas/packages/canvas/src/timeline/timelineStore.ts';export {assembleTimelineWalk} from '../../vendor/research-canvas/packages/canvas/src/timeline/walk.ts';export {createElement,Children} from 'react';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:source},tsconfig:join(source,'../tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'});
  const bundleFile=join(scratch,'instrument.cjs');await writeFile(bundleFile,compiled.outputFiles[0].text);
  const api=createRequire(import.meta.url)(bundleFile),view=api.kernelDocumentToJourney(document),sceneId=view.startSceneId;
  const tags=api.nativeInstrumentNodeTags(packet,view,sceneId);assert.equal(tags.size,192);
  // The ql packet is the retained native proof from this exact unchanged
  // register; its contract is neither extended nor rewritten to carry tags.
  const relationPacket=await readWikiSceneTechne(transport,{...request,facet:'scene-relations'});
  const relations=api.nativeInstrumentSourceRelations(relationPacket,view,sceneId);assert.equal(relations.length,128);
  const data=await api.readingInstruments(actual.reading,api.nativeInstrumentTitles(view,sceneId),new Map(),tags,relations);
  const located=await data.places.getLocatedNodes(data.reading.subject.subject_ref);assert.equal(located.length,32);
  const place=located.find(node=>node.sourceCoordinates.length===1&&relations.some(row=>row.from_subject_ref===node.sourceCoordinates[0]||row.to_subject_ref===node.sourceCoordinates[0]));assert.ok(place,'actual native Place has source-bound relations');
  const placeSource=place.sourceCoordinates[0],placeEdges=relations.filter(row=>row.from_subject_ref===placeSource||row.to_subject_ref===placeSource),expectedNeighbours=[...new Set(placeEdges.flatMap(row=>[row.from_subject_ref,row.to_subject_ref]))].filter(ref=>ref!==placeSource).sort();assert.ok(expectedNeighbours.length);
  const placeRelated=await data.places.getRelatedNodesForPlace(data.reading.subject.subject_ref,place.graphNodeId);assert.deepEqual(placeRelated.map(node=>node.graphNodeId).sort(),expectedNeighbours);
  const sourceDetail={ref:place.graphNodeId,subject:{ref:document.expression_ref,revision:document.revision,sceneRef:scene.scene_ref},context:{node:place}};
  const placeTarget=await resolveHostedSource(transport,sourceDetail);assert.equal(placeTarget.address.value,placeSource);assert.equal(placeTarget.returnTo.place.ref,document.expression_ref);assert.equal(placeTarget.returnTo.passageId,scene.scene_ref);
  await assert.rejects(resolveHostedSource(transport,{...sourceDetail,subject:{...sourceDetail.subject,revision:document.revision+1}}),/revision changed/);
  await assert.rejects(resolveHostedSource(transport,{...sourceDetail,context:{node:{...place,sourceCoordinates:['wiki:foreign:unbound']}}}),/no single source/);
  const subject=relations[0].from_subject_ref,anchor=data.bundle.nodes.find(node=>node.isTemporal&&node.sourceCoordinates.includes(subject));assert.ok(anchor);
  const field=await data.dataSource.relationFieldForEvent(anchor.graphNodeId),expected=relations.filter(row=>row.from_subject_ref===subject||row.to_subject_ref===subject);
  assert.equal(field.subjectGraphNodeId,subject);assert.deepEqual(field.relationships.map(row=>row.id).sort(),expected.map(row=>row.binding_ref).sort());assert.ok(field.relationships.length>1);
  assert.ok(field.contextualNodes.every(node=>!node.isTemporal&&node.validFrom===null),'contextual source endpoints are not assigned invented dates');
  for(const edge of field.relationships){const native=relations.find(row=>row.binding_ref===edge.id);assert.equal(edge.properties.native_relation_ref,native.relation_ref);assert.equal(edge.properties.native_relation_revision,native.relation_revision);assert.equal(edge.relType,native.relation);}
  const render=(value,types)=>api.renderToStaticMarkup(api.createElement(api.TimelineRelationField,{field:value,relationTypes:types,resonances:[],showRelations:true,showArchetypalContext:true,onClose:()=>{throw Error('render must not dismiss');},onOpenNode:()=>{throw Error('render must not navigate');}}));
  const type=field.relationships[0].relType,filtered=render(field,[type]),none=render(field,[]);assert.ok(filtered.includes('aria-label="Close focused relations"'));
  assert.equal((filtered.match(/<li[^>]*data-testid="timeline-relation-/g)||[]).length,field.relationships.filter(row=>row.relType===type).length,'actual component applies relation type filter');assert.equal((none.match(/<li[^>]*data-testid="timeline-relation-/g)||[]).length,0);
  const datedEdge=relations[0],edgeAnchor=data.bundle.nodes.find(node=>node.isTemporal&&node.sourceCoordinates.includes(datedEdge.relation_ref));assert.ok(edgeAnchor);
  const edgeField=await data.dataSource.relationFieldForEvent(edgeAnchor.graphNodeId);assert.equal(edgeField.subjectRelationRef,datedEdge.relation_ref);assert.deepEqual(edgeField.relationships.map(row=>row.id),[datedEdge.binding_ref]);
  assert.deepEqual(edgeField.contextualNodes.map(node=>node.graphNodeId).sort(),[datedEdge.from_subject_ref,datedEdge.to_subject_ref].sort());
  assert.equal((render(edgeField,null).match(/<li[^>]*data-testid="timeline-relation-/g)||[]).length,2,'dated native edge shows both actual endpoints without fabricating intermediary edges');
  const missingRelation=structuredClone(relationPacket);missingRelation.relation_readings.pop();assert.throws(()=>api.nativeInstrumentSourceRelations(missingRelation,view,sceneId),/incomplete/);
  const redirected=structuredClone(relationPacket);redirected.relation_readings[0].to_subject_ref=subject;assert.throws(()=>api.nativeInstrumentSourceRelations(redirected,view,sceneId),/identity, revision or endpoints/);
  const all=await data.dataSource.loadTimelineView();assert.equal(all.nodes.length,320);
  // Exercise real component exit handlers against the actual native view and
  // real Timeline store. Hiding must not call Clear/Unload or lose source rows.
  const timelineStore=api.createTimelineStore();timelineStore.getState().hydrate(all);timelineStore.getState().expandNode(await data.dataSource.expandNode(anchor.graphNodeId));
  const retainedState=JSON.stringify(timelineStore.getState()),nativeWalk=api.assembleTimelineWalk(all.nodes,all.relationships);assert.ok(nativeWalk.stops.length);
  const buttons=element=>{const result=[];const visit=item=>{if(!item||typeof item!=='object')return;if(item.type==='button')result.push(item);api.Children.forEach(item.props?.children,visit);};visit(element);return result;};
  for(const [name,Component,props,label]of [['walk',api.TimelineWalk,{walk:nativeWalk,onSelectStop:ref=>timelineStore.getState().setSelected(ref)},'Close temporal walk'],['working',api.TimelineWorkingSet,{workingSet:timelineStore.getState().workingSet,onClear:()=>timelineStore.getState().clearWorkingSet(),onUnload:ref=>timelineStore.getState().collapseNode(ref),onOpenNode:()=>{}},'Close working set']]){
   let visible=true,closed=0;const onClose=()=>{visible=false;closed++;};
   const tree=Component({...props,onClose});const close=buttons(tree).find(button=>button.props['aria-label']===label);assert.ok(close,label);close.props.onClick();assert.equal(visible,false);assert.equal(closed,1);assert.equal(JSON.stringify(timelineStore.getState()),retainedState,name+' close retains real native state');
   visible=true;let prevented=false,stopped=false;tree.props.onKeyDown({key:'Escape',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});assert.equal(visible,false);assert.equal(closed,2);assert.ok(prevented&&stopped);assert.equal(JSON.stringify(timelineStore.getState()),retainedState,name+' Escape retains real native state');
   const reopened=api.renderToStaticMarkup(api.createElement(Component,{...props,onClose}));assert.ok(reopened.includes(label));assert.ok(reopened.includes(name==='walk'?nativeWalk.stops[0].title:props.workingSet[0].node.title));
  }
  const categories=['test-observation','test-process','test-operator','test-artifact','test-location','test-receipt'];
  for(const category of categories){
   const filtered=await data.dataSource.loadTimelineView(undefined,{tags:{include:[category]}});assert.equal(filtered.nodes.length,32,category);
   for(const {node}of filtered.nodes){assert.ok(node.evidenceTags.includes(category));assert.equal(node.sourceCoordinates.length,1);assert.ok(tags.get(node.sourceCoordinates[0]).includes(category),'temporal alias maps to its exact native owner');}
  }
  assert.equal((await data.dataSource.loadTimelineView(undefined,{tags:{include:['synthetic-test']}})).nodes.length,192);
  assert.equal((await data.dataSource.loadTimelineView(undefined,{tags:{exclude:['synthetic-test']}})).nodes.length,128,'relation dates do not inherit endpoint node tags');
  assert.equal((await data.dataSource.loadTimelineView(undefined,{tags:{include:[]}})).nodes.length,0);
  const stale=structuredClone(packet);stale.revision++;assert.throws(()=>api.nativeInstrumentNodeTags(stale,view,sceneId),/current native Scene/);
  const partial=structuredClone(packet);partial.node_readings.pop();assert.throws(()=>api.nativeInstrumentNodeTags(partial,view,sceneId),/incomplete/);
  const unbound=structuredClone(document);unbound.entities[scene.entity_refs[0]].subject.readings=unbound.entities[scene.entity_refs[0]].subject.readings.filter(row=>row.ref!==packet.register.reading_ref);assert.throws(()=>wikiSceneNodeReadings({document:unbound,scene,current}),/register binding/);
  const changed=structuredClone(current),changedRows=JSON.parse(changed.file.content),changedObjects=Array.isArray(changedRows)?changedRows:changedRows.objects;changedObjects.find(row=>row.ref===packet.node_readings[0].subject_ref).revision++;changed.file.content=JSON.stringify(changedRows);assert.throws(()=>wikiSceneNodeReadings({document,scene,current:changed}),/node revision changed/);
  await assert.rejects(readWikiSceneTechne(transport,{...request,revision:document.revision+1}),/revision changed/);
  const after=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:document.expression_ref}});assert.deepEqual(after.outcome.data.document,document);
  assert.deepEqual(await readFile(actual.source_path),before,'tag reads never rewrite the real stress Wiki');
  console.log(JSON.stringify({artifact,source_ref:current.source_ref,register_revision:current.file.revision,native_relations:relations.length,native_places:located.length,place_related_nodes:placeRelated.length,place_source_return_verified:true,panel_close_and_escape_preserve_state:true,focused_incident_relations:field.relationships.length,dated_edge_endpoints:edgeField.contextualNodes.length,native_nodes:packet.node_readings.length,categories:6,nodes_per_category:32,timeline_cards:all.nodes.length,unaltered_relation_cards:128,source_unchanged:true}));
 }finally{const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;await rm(scratch,{recursive:true,force:true});}
});
