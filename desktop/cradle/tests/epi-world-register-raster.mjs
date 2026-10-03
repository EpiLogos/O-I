#!/usr/bin/env node
/** Controlled authored reference material over the actual native world owner.
 * No fixture clock/graph/member mapping and no claim of installed GPU pixels.
 * node tests/epi-world-register-raster.mjs /absolute/reference-config.json
 * Config: {world_file,output}; world_file is the actual ql.scene-world/v1 JSON.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply the real native world reference config (world_file, output).');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.ok(path.isAbsolute(config.world_file)&&config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
const worldBytes=await readFile(config.world_file),envelope=JSON.parse(worldBytes);
const world=envelope.schema==='ql.scene-world/v1'?envelope:envelope.response?.outcome?.data?.source?.world;
assert.equal(world.schema,'ql.scene-world/v1');
assert.equal(world.registers.source_revision,world.scene.sources.sky_revision);
assert.equal(world.event_ref,world.native_readback.event_ref);
assert.equal(world.subject_ref,world.native_readback.subject_ref);
assert.equal(world.snapshot_ref,world.scene.snapshot_ref);
await mkdir(config.output,{recursive:true});
const module=root+'/expressions-app/field-studies-journeys/src/epiWorldMaterial.ts',bundle=config.output+'/actual-register-raster.js';
await build({entryPoints:[module],outfile:bundle,bundle:true,platform:'browser',format:'iife',globalName:'EpiMaterial',logLevel:'warning'});
const registers={degree:world.registers.degree,governor:world.registers.backbone,decan:world.registers.decan,codon:world.registers.codon,skin:world.registers.skin,aperture:world.registers.aperture};
assert.deepEqual(Object.fromEntries(Object.entries(registers).map(([role,rows])=>[role,rows.length])),{degree:360,governor:24,decan:36,codon:64,skin:72,aperture:18});
// Qualified numerical owner rows become actual image material. The two
// grounds retain their own source-defined position/quantum instead of being
// invented static aperture indexes 16/17.
for(const rows of Object.values(registers))for(const row of rows){
 assert.equal(row.reading.availability,'available');assert.ok(row.reading.ref&&row.reading.revision&&row.source_refs.length);
 for(const source of row.source_refs)assert.ok(source.ref&&source.revision&&source.availability==='available');
 if(['fibonacci','void'].includes(row.role))row.ground={role:row.role,positions:row.positions,quantum_degrees:row.quantum_degrees};
}
assert.deepEqual(registers.aperture.filter(r=>r.ground).map(r=>[r.ground.role,r.ground.positions,r.ground.quantum_degrees]),[['fibonacci',60,6],['void',16,22.5]]);
const browser=await chromium.launch({headless:true}),checks=[];
try{
 const page=await browser.newPage({viewport:{width:1040,height:1040}});
 await page.setContent('<canvas aria-label="Native-source authored register material"></canvas>');await page.addScriptTag({path:bundle});
 for(const [role,rows] of Object.entries(registers)){
   const result=await page.evaluate(async({role,rows})=>{
    const canvas=document.querySelector('canvas'),vector=EpiMaterial.registerVectorMaterial(role,rows);
    const decoded=document.createElement('canvas');decoded.width=decoded.height=1024;const c=decoded.getContext('2d');
    const decode=async dataUrl=>{const image=new Image();image.src=dataUrl;await image.decode();c.clearRect(0,0,1024,1024);c.drawImage(image,0,0);return c.getImageData(0,0,1024,1024).data;};
    const drawEncoded=async material=>{const source=EpiMaterial.rasterizeRegisterMaterial(material,canvas);const expected=await decode(source.image.dataUrl);const encoded=await EpiMaterial.rasterizeRegisterMaterialLosslessly(material,canvas);const actual=await decode(encoded.image.dataUrl);if(!expected.every((value,index)=>value===actual[index]))throw Error('Encoded PNG changed a decoded RGBA pixel.');return encoded;};
    const image=await drawEncoded(vector);
    const present=(x,y)=>Array.from(c.getImageData(Math.round(x)-1,Math.round(y)-1,3,3).data).some((v,i)=>i%4===3&&v>40);
   const groundIndexes=new Set(vector.grounds.map(g=>g.index)),outerMarks=vector.marks.filter(mark=>!groundIndexes.has(mark.index));
   const visible=outerMarks.map(mark=>present((mark.x0+mark.x1)/2,(mark.y0+mark.y1)/2));
   const grounds=vector.grounds.map(ground=>({index:ground.index,member:ground.member,positions:ground.positions,quantum_degrees:ground.quantum_degrees,visible:Array.from({length:ground.positions},(_,i)=>{const a=i*ground.quantum_degrees*Math.PI/180;return present(512+ground.radius*Math.sin(a),512-ground.radius*Math.cos(a));})}));
   const removed=outerMarks[Math.floor(outerMarks.length/3)],broken={...vector,marks:vector.marks.filter(mark=>mark.index!==removed.index)};
    await drawEncoded(broken);const removedStillVisible=present((removed.x0+removed.x1)/2,(removed.y0+removed.y1)/2);
   // Remove a required ground's complete rendered material while retaining
   // every source member/count and every unrelated ring/mark.
    const removedGrounds=[];for(const ground of vector.grounds){
     await drawEncoded({...vector,marks:vector.marks.filter(m=>m.index!==ground.index),grounds:vector.grounds.filter(g=>g.index!==ground.index)});
    const a=(ground.quantum_degrees*3.5)*Math.PI/180;
     removedGrounds.push({member:ground.member.ref,stillVisible:present(512+ground.radius*Math.sin(a),512-ground.radius*Math.cos(a))});
    }
    await drawEncoded(vector);
    return{image,visible,grounds,removedStillVisible,removedGrounds,removed_index:removed.index,mark_refs:vector.marks.map(m=>m.member.ref),placement_standing:[...new Set(vector.marks.map(m=>m.placement_standing))],decoded_rgba_equal:true,encoding:'PNG colour type3/8-bit exact grayscale+alpha tuple palette, CompressionStream deflate'};
  },{role,rows});
  assert.ok(result.visible.every(Boolean),`${role}: every static source member must render a mark.`);
  assert.equal(result.removedStillVisible,false,`${role}: removing a required rendered mark must fail with source/count/control metadata preserved.`);
  for(const ground of result.grounds)assert.ok(ground.visible.every(Boolean),'All actual native ground positions must be rendered.');
  for(const ground of result.removedGrounds)assert.equal(ground.stillVisible,false,'Required ground material removal must be detected separately from its metadata.');
  assert.deepEqual(result.mark_refs,rows.map(r=>r.reading.ref));
  await writeFile(config.output+'/'+role+'.png',Buffer.from(result.image.image.dataUrl.split(',')[1],'base64'));
  await writeFile(config.output+'/'+role+'.members.json',JSON.stringify({standing:'controlled authored reference over actual native owner output; layout standing explicit',source_revision:world.registers.source_revision,rows,placement_standing:result.placement_standing},null,2)+'\n');
   checks.push({role,count:rows.length,rendered_static_marks:result.visible.length,all_static_marks_rendered:true,grounds:result.grounds.map(g=>({member:g.member,positions:g.positions,quantum_degrees:g.quantum_degrees,all_positions_rendered:true})),removed_mark_detected:true,removed_ground_detected:result.removedGrounds.length,placement_standing:result.placement_standing,decoded_rgba_equal:result.decoded_rgba_equal,encoding:result.encoding});
 }
  const receipt={standing:'controlled authored reference over actual native world; decoded lossless PNG raster material proof, not native saved scene or installed GPU expressive/causal proof',environment:{browser:await browser.version(),canvas:'Chromium Canvas2D; actual encoded exact-palette/alpha PNG decoded through browser Image',headless:true,audio:'none'},world_file_sha256:createHash('sha256').update(worldBytes).digest('hex'),producer_sha256:createHash('sha256').update(await readFile(module)).digest('hex'),instance_ref:world.instance_ref,event_ref:world.event_ref,subject_ref:world.subject_ref,snapshot_ref:world.snapshot_ref,source_revision:world.registers.source_revision,numerical_registry_revision:world.scene.sources.registry_revision,checks};
 await writeFile(config.output+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();}
