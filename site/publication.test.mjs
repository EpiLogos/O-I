import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compilePublications } from './build-publications.mjs';
import { openPublication, publicationHref, publicationRoute, publicAssetUrl } from './src/library/publication-model.mjs';
import { projectComposition } from './src/library/native-player.mjs';
import { producerFixtures, SUBJECT, COLLECTION } from './tests/publication-fixtures.mjs';
const clone=v=>JSON.parse(JSON.stringify(v));
test('empty native publication remains empty; no fixture fallback',()=>{
 const result=compilePublications([{schema:'oi.explore-browser-seed/v1',entries:[],relations:[],presentation_projections:[]}]);
 assert.equal(result.seed.entries.length,0);assert.equal(result.editions.length,0);
 assert.throws(()=>compilePublications([{schema:'oi.journey',journeys:[]}]),/public admission/);
});
test('native subject identities, source revisions and collection membership survive',()=>{
 const {seed,editions}=compilePublications(producerFixtures());const model=openPublication(seed,editions.map(e=>e.manifest));
 assert.equal(model.search('',COLLECTION).length,1);assert.equal(model.search('',COLLECTION)[0].ref,SUBJECT);
 const subject=model.select(SUBJECT);assert.equal(subject.projection.source.revision,'fixture-r1');assert.equal(subject.projection.projection_revision,3);
 assert.equal(subject.relations[0].relation,'wiki.contains');assert.equal(model.expressions(SUBJECT).length,1);
 const stage=model.stage(model.expressions(SUBJECT)[0]);assert.equal(stage.admission.state,'live');assert.equal(stage.edition.entry.expression_ref,'expression:fixture:subject');assert.equal(stage.edition.entry.revision,2);assert.equal(stage.edition.native_body?.schema,'oi.native-expression-body/v1');
});
test('native body fidelity preserves authored field, geometry, dynamics and text-bearing journey instead of rebuilding the demo shell',()=>{
 const {editions}=compilePublications(producerFixtures());
 const edition=editions.find(e=>e.projection.subject.ref==='expression:fixture:subject');
 assert.ok(edition?.native_body);
 assert.equal(edition.manifest.native_body.digest.value,createHash('sha256').update(edition.native_body.bytes).digest('hex'));
 const journey=JSON.parse(edition.native_body.bytes),sceneRef='expression:fixture:subject:scene:reading';
 const scene=projectComposition(edition.projection.representation.payload.regions.find(r=>r.role==='body').bindings.find(b=>b.binding_ref==='expression').props.composition,sceneRef,journey,edition.manifest.native_body.scene_map);
 assert.equal(scene.field.background,'#102030');assert.equal(scene.field.params.count,12345);assert.equal(scene.field.params.size,4.2);assert.equal(scene.field.params.speed,.37);
 assert.equal(scene.entities[0].shape,'triangle');assert.equal(scene.entities[0].tint,'#abcdef');assert.equal(scene.entities[0].force.kind,'vortex');assert.equal(scene.entities[0].sequence.enabled,true);
 assert.equal(scene.morph.law,'product');assert.equal(scene.text[0].title,'Native authored text');assert.match(scene.text[0].body,/exact native scene/);
});
test('native body admission refuses changed bytes, changed scene maps and protected material',()=>{
 for(const mutate of [
  body=>{body.bytes=body.bytes.replace('Native authored text','Changed body');},
  body=>{body.scene_map={'expression:fixture:subject:scene:reading':'missing-scene'};},
  body=>{const journey=JSON.parse(body.bytes);journey.scenes[0].text[0].body='Control/user/private';body.bytes=JSON.stringify(journey);body.digest.value=createHash('sha256').update(body.bytes).digest('hex');},
 ]){
  const inputs=producerFixtures(),body=inputs[1].native_body;mutate(body);assert.throws(()=>compilePublications(inputs),/public admission/);
 }
});

test('private objects, raw row copy, metadata, fields and wrappers never enter any outward payload',()=>{
 const inputs=producerFixtures();const privateWorld=clone(inputs[0]);privateWorld.projection.audience.visibility='private';privateWorld.entries=privateWorld.entries.map(e=>({...e,ref:e.ref+':PRIVATE_SUBJECT_SENTINEL',label:'PRIVATE_TITLE_SENTINEL'}));privateWorld.field={field_ref:'field:private',visibility:'private',title:'PRIVATE_FIELD_SENTINEL'};privateWorld.relations=[];
 const result=compilePublications([...inputs,privateWorld]);const wire=JSON.stringify(result);
 for(const sentinel of ['UNSELECTED_ROW_SENTINEL','PRIVATE_METADATA_SENTINEL','PRIVATE_FIELD_TITLE_SENTINEL','PRIVATE_WRAPPER_SENTINEL','PRIVATE_SUBJECT_SENTINEL','PRIVATE_TITLE_SENTINEL','PRIVATE_FIELD_SENTINEL'])assert.ok(!wire.includes(sentinel),sentinel);
});
test('a private edge between otherwise public subjects is excluded',()=>{
 const inputs=producerFixtures();inputs[0].relations.push({...inputs[0].relations[0],relation:'PRIVATE_EDGE_SENTINEL',visibility:'private'});
 assert.ok(!JSON.stringify(compilePublications(inputs)).includes('PRIVATE_EDGE_SENTINEL'));
});
test('published binding with private or unsupported material fails before serialization',()=>{
 const inputs=producerFixtures();const p=inputs[0].projection;
 // Obtain the actual envelope location instead of assuming a flattened body.
 const find=value=>{if(!value||typeof value!=='object')return false;if(value.binding_ref==='subject'){value.props.context='PRIVATE_CONTEXT_SENTINEL';return true;}return Object.values(value).some(find);};
 assert.ok(find(p));assert.throws(()=>compilePublications(inputs),/public admission/);
});
test('exact stale publication and Scene addresses never resolve to another edition',()=>{
 const {seed}=compilePublications(producerFixtures());const model=openPublication(seed);
 assert.throws(()=>model.select(SUBJECT,'projection:fixture:source','2'),/exact published revision/);
 assert.throws(()=>model.select('not-published'),/not in the published edition/);
 assert.throws(()=>model.stage(model.expressions(SUBJECT)[0],'expression:fixture:subject:scene:missing'),/exact Scene/);
});
test('native edition manifests identify exactly the emitted source and bytes',()=>{
 const {editions}=compilePublications(producerFixtures());for(const e of editions){assert.equal(e.manifest.schema,'oi.world-edition-manifest/v1');assert.equal(e.manifest.source.revision,e.projection.source.revision);assert.equal(e.manifest.digest.value,createHash('sha256').update(e.html).digest('hex'));assert.match(e.manifest.page,/\.\/data\/library\/editions\/[a-f0-9]{64}\/index.html$/);}
});
test('route carries source, Expression/Projection editions, exact Scene and reading anchor separately',()=>{
 const r={ref:SUBJECT,collection_ref:COLLECTION,projection:'projection:fixture:source',revision:'3',expression:'expression:fixture:subject',expression_revision:'2',expression_projection:'projection:fixture:expression',expression_projection_revision:'4',scene:'expression:fixture:subject:scene:reading',depth:'expression',at:'17',offset:'.25',q:'two words'};
 const actual=publicationRoute(publicationHref(r));for(const [key,value]of Object.entries(r))assert.equal(actual[key],key==='offset'?'0.25':value);
});
test('assets cannot depend on loopback, private addresses, arbitrary schemes or credentials',()=>{
 for(const href of ['http://example.com/a','https://localhost/a','https://machine.local/a','https://127.0.0.1/a','https://10.0.0.8/a','https://[::1]/a','file:///Users/a','javascript:alert(1)','https://user:password@example.com/a','/Users/a'])assert.equal(publicAssetUrl(href),null,href);
 assert.equal(publicAssetUrl('https://example.com/edition/image.png'),'https://example.com/edition/image.png');
});
test('production entrypoints cannot import fixtures',()=>{
 for(const path of ['src/library/PublicLibrary.tsx','src/library/publication-model.mjs','build-publications.mjs'])assert.ok(!/from\s+['"][^'"]*(?:tests\/|fixtures\/)/.test(readFileSync(new URL(path,import.meta.url),'utf8')),path);
});
