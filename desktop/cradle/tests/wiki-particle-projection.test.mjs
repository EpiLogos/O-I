/** Real owner-captured Wiki -> active production TS material/particle targets.
 * No fake owner. GPU integration still requires the native app walk. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {ConnectionRuntime} from '../../../packages/oi-design-system/expressions-engine/oi/connectionRuntime.mjs';
import {wikiDisplayName} from '../../../packages/oi-design-system/expressions-engine/oi/wikiPresentation.mjs';
const source=process.env.OI_NATIVE_WIKI_ARTIFACT;
test('actual Wiki preserves native identity while projecting human labels and linked particle targets',{skip:!source},async()=>{
 const evidence=JSON.parse(await readFile(source,'utf8'));assert.match(evidence.source,/Actual Central Wiki/);
 const dir=await mkdtemp(join(tmpdir(),'oi-wiki-particles-'));
 try{
  const output=join(dir,'actual.mjs');
  await build({stdin:{contents:`export {projectWikiExpression} from './src/techne/wikiExpression.ts';
 export {kernelDocumentToJourney,nativeSceneMaterial} from './expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
 export {nativeConnections} from './expressions-app/field-studies-journeys/src/nativeCorrespondence.ts';
 export {toNativeConfig} from './expressions-app/field-studies-journeys/src/nativeBridge.ts';
 export {EntityRuntime} from './expressions-app/src/engine/entityRuntime.ts';`,resolveDir:resolve(import.meta.dirname,'..'),loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm',nodePaths:[resolve(import.meta.dirname,'../node_modules')],logLevel:'silent'});
  const api=await import(pathToFileURL(output)),doc=api.projectWikiExpression(evidence.reading).document;
  assert.equal(doc.expression_ref,evidence.document.expression_ref);assert.deepEqual(doc.scenes.map(s=>s.scene_ref),evidence.document.scenes.map(s=>s.scene_ref));
  assert.ok(Object.keys(doc.relations).length>0);
  for(const e of Object.values(doc.entities)){assert.equal(e.parameters.shape.value,'disc');assert.equal(e.parameters.glyph.value,'●');assert.deepEqual(e.subject,evidence.document.entities[e.entity_ref].subject);assert.ok(!e.title.startsWith('wiki:'),e.title);}
  const view=api.kernelDocumentToJourney(doc),all=api.nativeConnections(view),scene=view.journey.scenes.find(s=>all[s.id].length);assert.ok(scene);
  const cfg=api.toNativeConfig(scene),before=structuredClone(doc);assert.ok(cfg.entities.every(e=>e.shape.kind==='primitive'));
  // Primitive sampling has no font/canvas dependency. No glyph sampler is
  // substituted: this real runtime must never call one for primitive nodes.
  const runtime=new api.EntityRuntime(null);runtime.allocate(8192,128,64);runtime.connections.configure(all[scene.id],[],8192);runtime.layout(cfg.entities);runtime.update(cfg.entities,cfg.composition,0,0,0,0);
  const parts=runtime.getPartitions(),first=runtime.connections.inspect();assert.equal(parts.length,10,'connections never evict the ten actual visible Wiki node formations');assert.equal(parts.length,cfg.entities.filter(e=>e.kind==='formation'&&e.enabled).length);assert.equal(parts.at(-1).end,6144);assert.equal(first.totalParticles,8192);assert.equal(first.reservedParticles,2048);assert.ok(first.occurrences.length>0);
  const relation=first.occurrences[0],slot=runtime.connections.slots.get(relation.binding_ref);assert.ok(doc.relations[relation.binding_ref]);assert.equal(relation.scene_ref,view.bindings[scene.id].scene_ref);
  assert.equal(first.occurrences.reduce((sum,row)=>sum+row.end-row.start,0),first.reservedParticles,'real native visible relations use the complete reserved pool');
  assert.ok(runtime.noiseData.filter((_,index)=>index>=first.nodeParticles*4&&index%4===2).every(value=>value===1),'the real engine marks all assigned relation particles visible');
  const texture=runtime.textureA.image.data,offset=relation.start*4,old=texture.slice(offset,offset+3),oldParts=structuredClone(parts),oldBakes=runtime.bakeGeneration;
  cfg.entities.find(e=>e.id===relation.from_entity_ref).x+=75;runtime.update(cfg.entities,cfg.composition,1,0,0,0);
  assert.equal(runtime.connections.slots.get(relation.binding_ref),slot);assert.deepEqual(runtime.getPartitions(),oldParts);assert.equal(runtime.bakeGeneration,oldBakes);assert.equal(texture[offset],old[0]+75);assert.equal(texture[offset+2],old[2]);assert.deepEqual(doc,before);
  const oldDoc=structuredClone(evidence.document),bytes=JSON.stringify(oldDoc),oldView=api.kernelDocumentToJourney(oldDoc);assert.equal(JSON.stringify(oldDoc),bytes);assert.deepEqual(oldView.document,oldDoc);
  const candidate=oldDoc.scenes.find(s=>!s.presentation&&s.entity_refs.some(ref=>oldDoc.entities[ref].parameters.glyph?.value===oldDoc.entities[ref].title.slice(0,120)));assert.ok(candidate,'historical native artifact must include generated fallback');
  const material=api.nativeSceneMaterial(oldDoc,candidate);assert.ok(material.entities.some(e=>e.shape==='disc'));
  candidate.presentation={schema:'oi.journey-scene/v1',scene:structuredClone(material),saved:null};candidate.presentation.scene.entities[0].name='My deliberately authored title';candidate.presentation.scene.entities[0].shape='ring';assert.deepEqual(api.nativeSceneMaterial(oldDoc,candidate),candidate.presentation.scene);
  runtime.dispose();console.log(JSON.stringify({source,actualNodes:Object.keys(doc.entities).length,actualRelations:Object.keys(doc.relations).length,renderedRelations:first.occurrences.length,totalParticles:first.totalParticles,nodeParticles:first.nodeParticles,relationParticles:first.reservedParticles}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('nine live native binding slots share the existing pool and preserve moving targets without touching node particles',()=>{
 const count=62000,r=new ConnectionRuntime();
 const rows=Array.from({length:9},(_,i)=>({binding_ref:`relation:${i}`,from_entity_ref:'centre',to_entity_ref:`node:${i}`}));
 const poses=[{entityId:'centre',x:0,y:0,z:0},...rows.map((_,i)=>({entityId:`node:${i}`,x:900+i*25,y:100+i*40,z:i*10}))];
 const a=new Float32Array(count*4).fill(7),b=new Float32Array(count*4).fill(8),metadata=new Float32Array(count*4).fill(9);
 const update=()=>r.update(poses,a,b,metadata);
 const checkCoverage=()=>{
  const ranges=r.inspect().occurrences.toSorted((a,b)=>a.start-b.start);
  assert.equal(ranges[0].start,46500);assert.equal(ranges.at(-1).end,count);
  for(let i=1;i<ranges.length;i++)assert.equal(ranges[i-1].end,ranges[i].start,'no gap or overlapping particle assignment');
  assert.equal(ranges.reduce((sum,row)=>sum+row.end-row.start,0),15500);
  assert.ok(a.subarray(0,r.start*4).every(value=>value===7));assert.ok(b.subarray(0,r.start*4).every(value=>value===8));assert.ok(metadata.subarray(0,r.start*4).every(value=>value===9));
  for(const row of ranges){
   const from=poses.find(p=>p.entityId===row.from_entity_ref),to=poses.find(p=>p.entityId===row.to_entity_ref);
   assert.deepEqual([...a.subarray(row.start*4,row.start*4+3)],[from.x,from.y,from.z]);
   assert.deepEqual([...a.subarray((row.end-1)*4,(row.end-1)*4+3)],[to.x,to.y,to.z]);
   for(let index=row.start;index<row.end;index++){assert.equal(metadata[index*4+2],1);assert.equal(metadata[index*4+3],row.binding_ref==='relation:4'?1:0);assert.ok(Number.isFinite(a[index*4]));assert.equal(a[index*4],b[index*4]);}
  }
  return ranges;
 };
 r.configure(rows,['relation:4'],count);update();const initial=checkCoverage(),slots=new Map(r.slots);
 assert.equal(r.capacity,256);assert.ok(initial.every(row=>row.end-row.start>=1722));
 poses[0].x=75;poses[0].z=-30;r.configure([...rows].reverse(),['relation:4'],count);update();const moved=checkCoverage();
 assert.deepEqual(r.slots,slots);assert.deepEqual(moved.map(({binding_ref,start,end})=>({binding_ref,start,end})),initial.map(({binding_ref,start,end})=>({binding_ref,start,end})));
 poses.pop();update();assert.equal(checkCoverage().length,8);assert.deepEqual(r.unavailable,['relation:8']);assert.deepEqual(r.slots,slots);
 const settled=a.slice();r.configure([],[],count);update();assert.equal(r.paths.length,0);assert.equal(r.ranges.size,0);assert.ok(metadata.subarray(r.start*4).every(value=>value===0));assert.deepEqual(a,settled,'hiding paths changes metadata, never reseeds their position targets');
 r.configure(rows.slice(0,8),['relation:4'],count);update();assert.equal(checkCoverage().length,8);assert.equal(r.particleCount,count);assert.equal(r.start,46500);
});
test('stable native binding slots disclose capacity overflow and absent endpoints',()=>{
 const r=new ConnectionRuntime(),rows=Array.from({length:18},(_,i)=>({binding_ref:'native-relation-'+i,from_entity_ref:'a',to_entity_ref:'b',scene_ref:'native-scene'}));r.configure(rows,[],1024);assert.equal(r.capacity,16);assert.deepEqual(r.overflow,rows.slice(16).map(b=>b.binding_ref));
 const a=new Float32Array(4096),b=new Float32Array(4096),meta=new Float32Array(4096);r.update([{entityId:'a',x:0,y:0,z:0},{entityId:'b',x:100,y:50,z:60}],a,b,meta);assert.equal(r.paths.length,16);assert.equal(r.inspect().occurrences[0].end-r.inspect().occurrences[0].start,16);
 const slot=r.slots.get(rows[4].binding_ref);r.configure(rows.slice(1),[rows[4].binding_ref],1024);assert.equal(r.slots.get(rows[4].binding_ref),slot);r.update([{entityId:'a',x:0,y:0,z:0}],a,b,meta);assert.equal(r.paths.length,0);assert.ok(meta.slice(r.start*4).every(x=>x===0));assert.equal(r.inspect().unavailable.length,17);
 r.configure([],[],1024);assert.equal(r.start,768,'emptying relations does not reallocate node pool');assert.equal(wikiDisplayName('My authored — long title','wiki:node:a'),'My authored — long title');assert.equal(wikiDisplayName(undefined,'central:source:control:root:Control/agents/wiki/topic-name.md'),'topic name');
});
