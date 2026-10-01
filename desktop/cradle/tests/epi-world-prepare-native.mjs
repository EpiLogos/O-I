#!/usr/bin/env node
/** Controlled native I/O preparation for the real material proof. This uses
 * actual saved native identities, coordinate/full-source owner responses and
 * admitted CLI world artifacts. Production entry/loading is proved separately.
 * Config: {bridge, world_files:[a,b], profile_files:[a,b], output,
 *          select_native_encoding:true}. No substitute quaternion or graph.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply real controlled bridge/world/profile/output config.');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(config.world_files.length,2);assert.equal(config.profile_files.length,2);
assert.ok(config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
await mkdir(config.output,{recursive:true});
const modulePath=root+'/expressions-app/field-studies-journeys/src/epiWorldSource.ts',bundle=config.output+'/actual-native-material-preparer.js';
await build({entryPoints:[modulePath],bundle:true,platform:'browser',format:'iife',globalName:'NativeEpiMaterial',outfile:bundle,logLevel:'warning'});
const browser=await chromium.launch({headless:true}),operations=[],prepared=[];
let callIndex=0;
async function native(op,request){
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,request}),signal:AbortSignal.timeout(300000)});
 const reply=await response.json(),number=callIndex++,file=`native-${String(number).padStart(3,'0')}-${op}-${request.operation??'coordinate'}.json`;
 await writeFile(config.output+'/'+file,JSON.stringify({request:{op,request},response:reply},null,2)+'\n');
 operations.push({op,operation:request.operation??'coordinate',evidence:file,ok:reply.ok!==false&&!reply.error});
 if(reply.ok===false||reply.error||!reply.outcome?.data)throw Error(reply.error??JSON.stringify(reply));return reply.outcome.data;
}
try{
 const page=await browser.newPage();await page.setContent('<!doctype html>');await page.addScriptTag({path:bundle});
 let sharedCoordinates=null,sharedInventory=null;
 if(config.reuse_source_cache){
  sharedCoordinates=JSON.parse(await readFile(config.output+'/actual-native-coordinate-content.json','utf8'));
  sharedInventory=JSON.parse(await readFile(config.output+'/actual-complete-native-inventory-pages.json','utf8'));
  const current=await native('nara_coordinate',{coordinate_ref:'bimba-source:M',face:'bimba',source_only:true,inventory:{offset:0,limit:1}});
  assert.equal(current.source_revision,sharedInventory[0].source_revision);assert.equal(current.registry_revision,sharedInventory[0].registry_revision);assert.equal(current.total,sharedInventory[0].total);
 }
 for(let index=0;index<2;index++){
  const label=['a','b'][index],worldBytes=await readFile(config.world_files[index]),world=JSON.parse(worldBytes),profile=JSON.parse(await readFile(config.profile_files[index],'utf8'));
  assert.match(world.instance_ref,/^expression:controlled-/);assert.equal(profile.person_ref,world.subject_ref);
  assert.match(profile.name,/^Controlled /,'Only explicitly controlled authored identities enter this proof.');
  console.log(`Reading actual native identity ${label}…`);
  if(config.select_native_encoding){
   const inspected=await native('nara_identity',{operation:'inspect',profile});
   assert.equal(inspected.reading.person_ref,world.subject_ref);assert.ok(inspected.reading.birthdate_encoding?.policy);
   profile.encoding_policy=structuredClone(inspected.reading.birthdate_encoding.policy);
   profile.encoding_policy.policy_ref='controlled:encoding-policy:epi-world-native-proof-v1';
   assert.equal(profile.composition_policy,'draft-core-birthdate-decanic-40-60-v1');
  }
  const existing=await native('nara_identity',{operation:'list'}),match=existing.profiles?.find(p=>p.person_ref===world.subject_ref);
  const saved=match?await native('nara_identity',{operation:'open',source_ref:match.source_ref}):await native('nara_identity',{operation:'save',profile,source_ref:null,expected_revision:null});
  assert.ok(saved.source?.source_ref&&saved.source.revision);
  const reopened=await native('nara_identity',{operation:'open',source_ref:saved.source.source_ref});
  assert.deepEqual(reopened.source,saved.source);assert.deepEqual(reopened.reading.profile,profile);assert.equal(reopened.reading.person_ref,world.subject_ref);
  const identity={source:reopened.source,reading:reopened.reading};
  const identityFile=config.output+`/identity-${label}.json`;await writeFile(identityFile,JSON.stringify(identity,null,2)+'\n');
  // App-channel selection reopens this exact native source and records the
  // acknowledged input revision in the frame. This leaf proves that owner
  // acknowledgement only; ordinary app selection remains installed evidence.
  assert.equal(identity.reading.input_revision,reopened.reading.input_revision);
  const catalogue=await native('expression',{operation:'list'}),present=catalogue.expressions?.some(e=>e.expression_ref===world.instance_ref);
  const created=await native('expression',present?{operation:'inspect',expression_ref:world.instance_ref}:{operation:'create',expression_ref:world.instance_ref,title:`${profile.name} · Epi world`,actor:'agent:controlled-epi-world-proof'});
  assert.equal(created.document?.expression_ref,world.instance_ref);
  const reading={ref:config.world_files[index],revision:'sha256:'+createHash('sha256').update(worldBytes).digest('hex'),availability:'available'};
  if(!sharedCoordinates){
   const refs=await page.evaluate(world=>NativeEpiMaterial.requiredEpiWorldCoordinates(world),world);
   console.log(`Resolving ${refs.length} exact native coordinate subjects with complete properties…`);
   const source=await native('nara_coordinate',{coordinate_ref:refs[0],face:'bimba',include_content:true,related_coordinates:refs.slice(1),inventory:{offset:0,limit:256}});
   const rows=[source,...(source.related_readings??[])];assert.equal(rows.length,refs.length);
   sharedCoordinates=await page.evaluate(rows=>Object.fromEntries(rows.map(row=>[row.binding.coordinate_ref,NativeEpiMaterial.coordinateSourceFromNative(row,row.source_content)])),rows);
   assert.ok(source.source_inventory);sharedInventory=[source.source_inventory];
   while(sharedInventory.at(-1).next_offset!==null){
    const offset=sharedInventory.at(-1).next_offset;
    const next=await native('nara_coordinate',{coordinate_ref:'bimba-source:M',face:'bimba',source_only:true,inventory:{offset,limit:256}});
    assert.equal(next.schema,'ql.bimba-inventory/v1');sharedInventory.push(next);console.log(`Read ${Math.min(offset+256,next.total)} / ${next.total} actual source identities.`);
   }
   await writeFile(config.output+'/actual-native-coordinate-content.json',JSON.stringify(sharedCoordinates,null,2)+'\n');
   await writeFile(config.output+'/actual-complete-native-inventory-pages.json',JSON.stringify(sharedInventory,null,2)+'\n');
  }
  const personal={person:{ref:identity.reading.person_ref,revision:identity.reading.input_revision,availability:'available'},identity:{ref:identity.source.source_ref,revision:identity.source.revision,availability:'available'},instance_ref:world.instance_ref,nara_ref:identity.reading.nara_ref,event_ref:world.event_ref,snapshot_ref:world.snapshot_ref};
  const sky_subject={subject_ref:world.snapshot_ref,native_owner:'ql-mef',presentation_role:'thing',sources:[{ref:world.snapshot_ref,revision:world.snapshot_ref,availability:'available'}],readings:[reading],actions:[]};
  const input=await page.evaluate(data=>NativeEpiMaterial.prepareEpiMaterialInputFromNative({...data,qualifySource:ref=>{throw Error('Native source lacks its own qualification: '+ref);},canvas:()=>document.createElement('canvas')}),{document:created.document,actor:'agent:controlled-epi-world-proof',authored_revision:'epi-world-20260930-v1',world,world_reading:reading,coordinates:sharedCoordinates,inventory_pages:sharedInventory,sky_subject,personal});
  const inputFile=config.output+`/input-${label}.json`;await writeFile(inputFile,JSON.stringify(input,null,2)+'\n');
  let currentStanding='actual saved identity; scoped protected-current pin and receiving effect remain separate';
  try{
   const current=await native('nara_identity',{operation:'personal_current',source_ref:identity.source.source_ref,expected_revision:identity.source.revision,sky_snapshot:world.sky});
   assert.equal(current.personal_current?.snapshot_ref,world.snapshot_ref);assert.equal(current.personal_current?.person_ref,world.subject_ref);
   await writeFile(config.output+`/personal-current-owner-${label}.json`,JSON.stringify(current,null,2)+'\n');
  }catch(error){
   if(!String(error).includes('snapshot digest mismatch'))throw error;
   currentStanding='actual native current refused transported sky: snapshot digest mismatch; source-owner repair pending; no current or receiving effect claimed';
   console.log(`Preserved actual ${label} sky/current transport refusal; continuing independent material/source proof.`);
  }
  prepared.push({label,input_file:inputFile,identity_file:identityFile,world_file:config.world_files[index],world_sha256:reading.revision,expression_ref:world.instance_ref,person_ref:world.subject_ref,identity_source:identity.source,inventory_count:input.inventory.length,source_revision:input.source_revision,personal_standing:currentStanding});
 }
 const receipt={standing:'real native identity/source/input preparation with controlled authored profile inputs and actual admitted CLI-world artifacts; source-only/material proof, ordinary installed production launch and protected body context/effect remain separate',environment:{browser:await browser.version(),canvas:'actual Chromium Canvas2D source register images',audio:'none'},module_sha256:createHash('sha256').update(await readFile(modulePath)).digest('hex'),prepared,operations};
 await writeFile(config.output+'/prepare-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();}
