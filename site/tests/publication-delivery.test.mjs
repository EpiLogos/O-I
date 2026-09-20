import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compilePublications, buildPublications } from '../build-publications.mjs';
import { verifyPublicEdition } from '../verify-public-edition.mjs';
import { producerFixtures } from './publication-fixtures.mjs';
function delivered(inputs=producerFixtures()) {
 const {seed,editions}=compilePublications(inputs), files=new Map([
  ['data/library/published.json',JSON.stringify(seed)],['data/library/edition-manifests.json',JSON.stringify(editions.map(e=>e.manifest))]
 ]);
 for(const e of editions) {
  const p=`data/library/editions/${e.directory}/`;
  files.set(p+'index.html',e.html);files.set(p+'projection.json',JSON.stringify(e.projection));files.set(p+'manifest.json',JSON.stringify(e.manifest));
 }
 return {files,read:async path=>{assert.ok(files.has(path),path);return Buffer.from(files.get(path));}};
}
test('actual byte verification checks the full selected native producer set and all downloads',async()=>{
 const packet=delivered();const receipt=await verifyPublicEdition({...packet,expectedInputs:producerFixtures()});
 assert.equal(receipt.native_publications,2);assert.equal(receipt.producer_set_verified,true);assert.equal(receipt.standing,'verified-public-edition-bytes');
});
test('a successful empty preview is not native corpus acceptance',async()=>{
 const packet=delivered([]);
 await assert.rejects(()=>verifyPublicEdition(packet),/No admitted native corpus/);
 assert.equal((await verifyPublicEdition({...packet,allowEmpty:true})).standing,'unavailable-native-corpus');
});
for(const ending of ['index.html','projection.json','manifest.json'])test(`changed native ${ending} bytes fail real acceptance`,async()=>{
 const packet=delivered(),path=[...packet.files.keys()].find(p=>p.endsWith('/'+ending));
 packet.files.set(path,ending==='index.html'?packet.files.get(path)+'tampered':'{}');
 await assert.rejects(()=>verifyPublicEdition(packet));
});
test('matching counts do not substitute for matching native set and revisions',async()=>{
 const packet=delivered(),expected=producerFixtures();expected[0].projection.projection_revision++;
 await assert.rejects(()=>verifyPublicEdition({...packet,expectedInputs:expected}),/differs from the selected/);
});
test('build admission fails closed and input symlinks cannot bypass the public-directory boundary',async()=>{
 const root=await mkdtemp(join(tmpdir(),'oi-publication-'));
 try {
  const empty={schema:'oi.explore-browser-seed/v1',entries:[],relations:[],presentation_projections:[]};
  await mkdir(join(root,'public/data'),{recursive:true});await writeFile(join(root,'public/data/explore-public.json'),JSON.stringify(empty));
  await writeFile(join(root,'producer.json'),JSON.stringify(producerFixtures()[0]));
  await buildPublications({root,paths:['producer.json']});
  assert.ok(JSON.parse(await readFile(join(root,'public/data/library/published.json'),'utf8')).entries.length);
  for(const output of ['dist','.public-edition']){await mkdir(join(root,output),{recursive:true});await writeFile(join(root,output,'stale-private-data'),'do not deploy');}
  await writeFile(join(root,'public/raw.json'),JSON.stringify(producerFixtures()[0]));await symlink(join(root,'public/raw.json'),join(root,'input-alias.json'));
  await assert.rejects(()=>buildPublications({root,paths:['input-alias.json']}),/public admission/);
  for(const output of ['dist','.public-edition'])await assert.rejects(()=>access(join(root,output)));
 } finally {await rm(root,{recursive:true,force:true});}
});
