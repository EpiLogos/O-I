/** Reads the admitted 192-node stress Wiki without modifying its source or
 * app state. Only the test's private Expression owner receives a projection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {readRegister} from '../src/knowledge/construction.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {readWikiSceneTechne} from '../src/techne/wikiReadingProvider.ts';
import {wikiSceneNodeReadings} from '../src/techne/wikiSceneNodeReadings.ts';
import {kernelOp} from '../src/kernel/bridge.ts';
const artifact=process.env.OI_NATIVE_TIMELINE_STRESS_PROOF;
test('actual native Scene tags reach temporal aliases and category filters at exact source revision',{skip:!artifact,timeout:120000},async()=>{
 const actual=JSON.parse(await readFile(artifact,'utf8')),before=await readFile(actual.source_path);
 assert.equal(actual.counts.native_subjects,192);
 const scratch=await mkdtemp(join(tmpdir(),'oi-native-tags-'));
 const env={...process.env,...actual.environment,OI_HOME:join(scratch,'oi-home')};
 const child=spawn(process.env.OI_KERNEL_BIN||actual.binaries.OI_KERNEL_BIN.path,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 try{
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/\S+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url},current=await readRegister(transport),frame=current.frames.find(row=>row.ref===actual.frame_ref);assert.ok(frame);
  const opened=await projectConstruction(transport,undefined,frame,current.relations,current);assert.equal(opened.state,'ready',JSON.stringify(opened));
  const document=opened.document,scene=document.scenes.find(row=>row.scene_ref===actual.scene_ref);assert.ok(scene);
  publishWikiNativeRegisters([]);
  const request={expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref,facet:'node-metadata'};
  const packet=await readWikiSceneTechne(transport,request);
  assert.equal(packet.node_readings.length,192);assert.equal(packet.register.source_ref,current.source_ref);assert.equal(packet.register.revision,current.file.revision);
  const parsed=JSON.parse(current.file.content),objects=Array.isArray(parsed)?parsed:parsed.objects;
  for(const row of packet.node_readings){const source=objects.find(node=>node.ref===row.subject_ref);assert.ok(source);assert.equal(row.subject_revision,String(source.revision));assert.deepEqual(row.tags,[...new Set(source.tags)].sort());}
  const source=fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url));
  const compiled=await build({stdin:{contents:"export {readingInstruments,nativeInstrumentTitles,nativeInstrumentNodeTags} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';",resolveDir:source},tsconfig:join(source,'../tsconfig.json'),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')),view=api.kernelDocumentToJourney(document),sceneId=view.startSceneId;
  const tags=api.nativeInstrumentNodeTags(packet,view,sceneId);assert.equal(tags.size,192);
  // The ql packet is the retained native proof from this exact unchanged
  // register; its contract is neither extended nor rewritten to carry tags.
  const data=await api.readingInstruments(actual.reading,api.nativeInstrumentTitles(view,sceneId),new Map(),tags);
  const all=await data.dataSource.loadTimelineView();assert.equal(all.nodes.length,320);
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
  console.log(JSON.stringify({artifact,source_ref:current.source_ref,register_revision:current.file.revision,native_nodes:packet.node_readings.length,categories:6,nodes_per_category:32,timeline_cards:all.nodes.length,unaltered_relation_cards:128,source_unchanged:true}));
 }finally{const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;await rm(scratch,{recursive:true,force:true});}
});
