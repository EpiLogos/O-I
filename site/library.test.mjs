import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileLibrary,PRODUCT_IDS} from './build-library.mjs';
import {parseRoute,routeHref,sceneCapacity,filterEntries,readIndex,readEdition,exactScene,safeUrl,readPosition,writePosition} from './src/library/model.mjs';
const source=await readFile(new URL('./content/public-site.md',import.meta.url),'utf8');
const built=compileLibrary(source,'d6d92503a1d25e38c93aa0f5e11a306be2adb093');
const first=built.editions[0];

test('the Library is a deterministic address view over real native publications',()=>{
 assert.deepEqual(built,compileLibrary(source,'d6d92503a1d25e38c93aa0f5e11a306be2adb093'));
 assert.deepEqual(built.index.entries.slice(0,6).map(e=>e.id),PRODUCT_IDS);
 for(const e of built.editions){assert.equal(e.publication.schema,'oi.expression-publication/v1');assert.equal(e.publication.composition.schema,'oi.expression-composition/v1');assert.equal(e.publication.projection.audience.visibility,'public');assert.equal(e.publication.presentation.schema,'oi.world-presentation/v1');assert.equal(e.publication.expression.live_renderer_ref,'renderer:oi:expression-stage');assert.ok(!('omissions' in e.publication));readEdition(e,e.entry);}
});
test('every gallery and column entry resolves the same exact Scenes',()=>{
 for(const e of built.editions)for(const s of e.entry.scenes){const actual=exactScene(e,s.ref);assert.equal(actual.title,s.title);for(const ref of actual.entity_refs){const entity=e.publication.composition.entities[ref];assert.ok(entity);assert.ok(e.readings[entity.subject.subject_ref]);}}
});
test('titles and invented Scene refs are not accepted as exact addresses',()=>{
 assert.throws(()=>exactScene(first,'Overview'),/exact Scene/);assert.throws(()=>exactScene(first,first.entry.expression_ref+':scene:not-published'),/exact Scene/);
});
test('a changed source produces a changed native edition and source revision',()=>{
 const changed=compileLibrary(source.replace('What a life carries forward.','What a life can carry forward.'));
 assert.notEqual(changed.index.source_revision,built.index.source_revision);assert.notEqual(changed.editions[0].entry.revision,first.entry.revision);assert.equal(changed.editions[0].entry.expression_ref,first.entry.expression_ref);
});
test('source text is carried from the actual selected heading, not a metadata placeholder',()=>{
 const r=first.readings['source:oi:public-site:products/central/what'];assert.ok(r.body.length>600);assert.ok(source.includes(r.body));assert.match(r.body,/meaningful continuity/);assert.match(r.body,/authored source/);assert.match(r.body,/observed state/);assert.match(r.body,/generated material/);
});
test('§5 means / World distinction and wider paradigm field reach the actual source',()=>{
 assert.match(source,/constituted means through which a Life encounters and acts within a World/);assert.match(source,/Subjective Immediacy names the knower/);assert.match(source,/developed paradigm within this wider field/);assert.doesNotMatch(source,/Objective Internality is the structured field of objects, events and relations that constitutes/);
});
test('a Scene chip and face/verso link round-trip native addresses and scope',()=>{
 const r={id:first.entry.id,scene:first.entry.scenes[2].ref,edition:String(first.entry.revision),subject:first.entry.scenes[2].subject_ref,face:'verso',q:'meaning & continuity',collection:'central',view:'rows'};assert.deepEqual(parseRoute(routeHref(r)),r);
});
test('legacy product and research destinations route into Library subjects',()=>{
 for(const name of ['oi','research','shared-field','build'])assert.equal(parseRoute('#/'+name).id,name);
 assert.equal(parseRoute('#/products').id,'');assert.equal(parseRoute('#/library').view,'gallery');assert.equal(parseRoute('#/library/%ZZ').id,'unavailable');
});
test('bounded scene row never exceeds measured width, including tiny containers',()=>{
 for(let width=0;width<2000;width+=7)for(let count=1;count<65;count++){const n=sceneCapacity(width,count);assert.ok(n>=0&&n<=count);if(n>0)assert.ok(n*142+64<=width);}
});
test('gallery and account search use one collection field',()=>{
 assert.equal(filterEntries(built.index.entries,'continuity','central')[0].id,'central');assert.equal(filterEntries(built.index.entries,'impossible-absent-phrase','all').length,0);assert.ok(filterEntries(built.index.entries,'','whole').every(e=>e.collection==='whole'));
});
test('unavailable storage does not prevent reading or replace other browser data',()=>{
 const storage={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};assert.equal(readPosition(storage,'oi.site.reader.v1'),null);assert.equal(writePosition(storage,'oi.site.reader.v1',{}),false);
});
test('unsafe and malformed links cannot execute as source links',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,<script>x</script>','file:///etc/passwd'])assert.equal(safeUrl(url),null);
 assert.equal(safeUrl('./index.html#/library','https://example.org/O-I/'),'https://example.org/O-I/index.html#/library');
});
for(const [name,change] of [
 ['private publication',e=>e.publication.projection.audience.visibility='private'],
 ['withdrawn publication',e=>e.publication.projection.state='withdrawn'],
 ['different expression',e=>e.publication.expression_ref='expression:other'],
 ['stale source',e=>e.source_basis.revision='old'],
 ['stale scene list',e=>e.publication.composition.scenes[0].scene_ref+='-changed'],
 ['undisclosed body',e=>e.readings['personal:hidden']={subject_ref:'personal:hidden',source_ref:'personal:hidden',source_revision:'secret',body:'DO NOT DISCLOSE'}],
 ['changed body subject',e=>e.readings[e.entry.source_ref].subject_ref='other'],
 ['source revision mismatch',e=>e.readings[e.entry.source_ref].source_revision='old'],
 ])test(`publication admission rejects ${name}`,()=>{const bad=structuredClone(first);change(bad);assert.throws(()=>readEdition(bad,first.entry));});
test('index rejects duplicate addresses and unadmitted payload locations',()=>{
 const duplicate=structuredClone(built.index);duplicate.entries.push(duplicate.entries[0]);assert.throws(()=>readIndex(duplicate));const external=structuredClone(built.index);external.entries[0].url='https://elsewhere/private.json';assert.throws(()=>readIndex(external));
});
test('membership links name source structure; geometry creates no new semantic edges',()=>{
 for(const e of built.editions)for(const r of Object.values(e.publication.composition.relations)){assert.match(r.relation.ref,/heading-contains/);assert.equal(r.provenance[0].revision,e.entry.source_revision);assert.ok(e.readings[r.provenance[0].ref]);}
});
test('published source never acquires authoring actions or mutable private state',()=>{
 for(const e of built.editions){assert.ok(!('refinements' in e.publication.composition));for(const entity of Object.values(e.publication.composition.entities)){assert.ok(!('actions' in entity.subject));assert.ok(!('readings' in entity.subject));}}
});
