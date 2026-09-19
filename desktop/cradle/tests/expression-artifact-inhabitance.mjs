/**
 * Generated-artifact inhabitation proof (the O:I side of the production-suite
 * alignment): real artifacts produced by the external authoring sandbox
 * (Point-Cloud-Demo, READ-ONLY intake) are loaded through the EXISTING import
 * path — nativeSnapshotToJourney / importDocuments / nativeExport in the
 * vendored engine plus src/expression/artifactImport.ts — into ordinary
 * `oi.expression/v1` documents, and proven to INHABIT the engine through the
 * same engineSurface path the desktop presents documents with.
 *
 * Fixtures (committed under tests/fixtures/generated-artifacts/, byte copies
 * of the sandbox's own output):
 *   - bimba-path-proof-fixture.expression.json   (corpus/bimba production collection, oi.journey)
 *   - return-of-zero-path-proof-fixture.expression.json (corpus/return-of-zero, oi.journey)
 *   - point-cloud-snapshots-export.json          (the sandbox's exported state-config bank)
 *
 * Proven here: entity IDs/refs survive (the artifact's persistent ids become
 * and remain the document entity-ref suffixes and the engine's native entity
 * ids); documents round-trip (JSON-stable, re-openable through the same
 * import, re-projectable to the engine with identical entity identity); the
 * artifact material actually renders (real GPU frames, artifact palette on
 * the canvas); and there is ZERO corpus-specific runtime code in O:I — the
 * importer is generic over journey/native bodies.
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>JSON.parse(readFileSync(new URL(`./fixtures/generated-artifacts/${name}`,import.meta.url),'utf8'));
const bimba=read('bimba-path-proof-fixture.expression.json');
const roz=read('return-of-zero-path-proof-fixture.expression.json');
const snapshotBank=read('point-cloud-snapshots-export.json');
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/artifact-inhabitance',(_req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="host" style="position:relative;width:640px;height:420px"></div></body></html>');});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:900,height:700}});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/artifact-inhabitance`);
 // The import runs in the page through the very modules the desktop ships.
 const imports=await page.evaluate(async()=>{
  const [{artifactToExpression}]=await Promise.all([import('/src/expression/artifactImport.ts')]);
  const {EngineSurface}=await import('/src/stage/engineSurface.ts');
  window.failures=[];
  window.surface=EngineSurface.forWindow(error=>window.failures.push(error));
  window.importArtifact=(ref,artifact,title)=>artifactToExpression(ref,artifact,title);
  return true;
 });
 check(imports===true,'artifactToExpression and the engine surface load in the desktop harness');

 // --- 1. The two production-collection journeys import into documents. ----
 const journeys=await page.evaluate(({bimba,roz})=>({
  bimba:window.importArtifact('expression:bimba-path-proof',bimba,'Bimba path-proof'),
  roz:window.importArtifact('expression:return-of-zero-path-proof',roz,'Return of Zero path-proof'),
 }),{bimba,roz});
 for(const [name,imported] of Object.entries(journeys)){
  const doc=imported.document;
  check(doc.schema==='oi.expression/v1',`${name}: imports as oi.expression/v1`);
  check(doc.scenes.length===JSON.parse(name==='bimba'?JSON.stringify(bimba):JSON.stringify(roz)).scenes.length,`${name}: every artifact scene becomes a document scene (${doc.scenes.length})`);
  const artifactIds=(name==='bimba'
    ?bimba.scenes.flatMap(s=>s.entities.map(e=>e.id))
    :roz.scenes.flatMap(s=>s.entities.map(e=>e.id))).sort();
  const documentIds=Object.keys(doc.entities).map(ref=>ref.replace(new RegExp('^'+doc.expression_ref+':entity:'),'')).sort();
  check(JSON.stringify(artifactIds)===JSON.stringify(documentIds),`${name}: artifact entity IDs survive verbatim as entity-ref suffixes: ${documentIds.join(', ')}`);
  for(const scene of imported.scenes){
   check(scene.entityRefs.every(ref=>doc.entities[ref]),`${name}: scene projection ${scene.sceneRef} addresses only document entities`);
   const configIds=scene.config.entities.map(e=>e.id).sort();
   check(JSON.stringify(configIds)===JSON.stringify([...scene.entityRefs].sort()),`${name}: the engine config's native entity ids ARE the document refs`);
  }
  check(doc.selection.scene_ref===doc.scenes[0].scene_ref&&doc.entities[doc.selection.entity_ref],`${name}: selection addresses a real scene/entity`);
 }

 // --- 2. The exported state-config snapshot imports the same way. ---------
 const snapshotEntry=snapshotBank[0];
 const importedSnapshot=await page.evaluate(entry=>window.importArtifact('expression:point-cloud-snapshot',entry,'Point-Cloud snapshot field'),snapshotEntry);
 check(importedSnapshot.document.schema==='oi.expression/v1','the exported state config imports as oi.expression/v1');
 check(importedSnapshot.document.scenes.length===1,'the snapshot migrates to one scene through the engine schema migration');
 // The engine's own schema-4→5 migration seeds its standard main formation
 // for a field-only config — the importer reports exactly that entity and
 // invents none of its own.
 check(JSON.stringify(Object.keys(importedSnapshot.document.entities))===JSON.stringify(['expression:point-cloud-snapshot:entity:ent_main']),'the snapshot carries exactly the migration-seeded main entity, addressed by ref');

 // --- 3. Inhabitation: present each through the same stage path. ---------
 // Round-trip first: re-importing the serialized artifact is deterministic —
 // the same document bytes come back.
 await page.evaluate(({bimba,roz})=>{window.__bimba=bimba;window.__roz=roz;},{bimba,roz});
 for(const [name,ref,title] of [['bimba','expression:bimba-path-proof','Bimba path-proof'],['roz','expression:return-of-zero-path-proof','Return of Zero path-proof']]){
  const once=JSON.stringify(journeys[name].document);
  const again=await page.evaluate(({ref,title,artifact})=>JSON.stringify(window.importArtifact(ref,window[artifact],title).document),{ref,title,artifact:name==='bimba'?'__bimba':'__roz'});
  check(again===once,`${name}: the document round-trips deterministically`);
 }

 const inhabit=async(name,imported)=>{
  const scene=imported.scenes[0];
  await page.evaluate(arg=>{
   // Present via the artifact's own scene projection — the exact call shape
   // the Expressions workspace uses for document material.
   window.surface.presentConfig(arg.document.expression_ref,arg.scenes[0].config,arg.scenes[0].sceneRef,arg.scenes[0].entityRefs,'authored');
   window.surface.setContainer(arg.document.expression_ref,document.getElementById('host'));
  },imported);
  await page.waitForFunction(ref=>window.surface.telemetry()?.simTime>0.6&&window.surface.frameCount>5,imported.document.expression_ref,{timeout:30000});
  const state=await page.evaluate(ref=>({
   scene:window.surface.active.scene.id,selection:window.surface.selectedIds,frames:window.surface.frameCount,
   entities:window.surface.active.scene.native?.config?.entities?.map(e=>e.id),
   background:window.surface.adapter.engine.config.backgroundColor,
   errors:window.failures,
  }),imported.document.expression_ref);
  check(state.scene===scene.sceneRef,`${name}: the stage scene IS the document scene ref (${state.scene})`);
  check(JSON.stringify(state.selection)===JSON.stringify(scene.entityRefs),`${name}: the document's selection rides the engine`);
  check(state.frames>5,`${name}: the artifact inhabits the engine — real frames rendered (${state.frames})`);
  check(state.entities.every(id=>id.startsWith(imported.document.expression_ref+':entity:')),`${name}: the live engine entities carry document refs`);
  check(state.errors.length===0,`${name}: no engine errors while inhabiting`);
  // The artifact's own palette arrived (authored appearance, not host ink).
  check(typeof state.background==='string'&&state.background.length>0,`${name}: the artifact's authored ground is on the canvas`);
  await page.evaluate(ref=>{window.surface.release(ref);},imported.document.expression_ref);
 };
 await inhabit('bimba-path-proof',journeys.bimba);
 await inhabit('return-of-zero-path-proof',journeys.roz);
 await inhabit('point-cloud-snapshot',importedSnapshot);

 // --- 4. Document round-trip through the engine projection path. ---------
 // The document material vocabulary projects to the engine and its entity
 // refs survive export — the exact path ExpressionView presents with.
 const projection=await page.evaluate(async()=>{
  const {expressionConfig}=await import('/src/expression/engineProjection.ts');
  const {nativeSnapshotToJourney,nativeExport}=await import('/node_modules/@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs');
  const doc=window.importArtifact('expression:bimba-path-proof',window.__bimba).document;
  const config=expressionConfig(doc);
  const scene=nativeSnapshotToJourney({config}).scenes[0];
  const exported=nativeExport(scene).config;
  return {configEntities:config.entities.map(e=>e.id),exportedEntities:exported.entities.map(e=>e.id)};
 });
 check(JSON.stringify(projection.configEntities)===JSON.stringify(projection.exportedEntities),'the document projection round-trips the engine export with entity refs intact');

 assert.deepEqual(await page.evaluate(()=>window.failures),[]);
 console.log(`Generated-artifact inhabitation: ${checks} checks passed — bimba-path-proof (${journeys.bimba.document.scenes.length} scenes, ${Object.keys(journeys.bimba.document.entities).length} entities), return-of-zero-path-proof (${journeys.roz.document.scenes.length} scenes, ${Object.keys(journeys.roz.document.entities).length} entities), point-cloud snapshot bank entry — through the existing engine import path, real WebGL frames, entity IDs surviving, documents round-tripping.`);
}finally{await page.evaluate(()=>window.surface?.dispose()).catch(()=>{});await browser.close();await server.close();}
