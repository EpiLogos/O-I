#!/usr/bin/env node
/** Decode and re-encode the six actual register images in a retained native
 * ACK. This proves lossless image storage and compact serialization size;
 * it does not substitute for native save/reopen through Central's receiver.
 * Config: {document_response_file, output}; no native endpoint is used.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply a retained actual native document-response config.');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.ok(path.isAbsolute(config.document_response_file)&&config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=await readFile(config.document_response_file),envelope=JSON.parse(raw),document=envelope.response?.outcome?.data?.document;
assert.equal(envelope.response?.ok,true);assert.equal(document?.schema,'oi.expression/v1');
const retained=document.scenes[0]?.presentation?.scene?.epiWorld;
assert.equal(retained?.inventory?.length,2141);assert.equal(retained?.profile_definitions?.length,61);
const sceneCounts=document.scenes.map(scene=>({working:scene.presentation.scene.entities.length,saved:scene.presentation.saved.entities.length}));
assert.deepEqual(sceneCounts,[{working:32,saved:32},{working:9,saved:9},{working:7,saved:7}]);
const expected={degree:360,governor:24,decan:36,codon:64,skin:72,aperture:18};
const occurrences=new Map();
function visit(value,pointer=''){
 if(Array.isArray(value))value.forEach((v,i)=>visit(v,pointer+'/'+i));
 else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))visit(v,pointer+'/'+key.replaceAll('~','~0').replaceAll('/','~1'));
 else if(typeof value==='string'&&value.startsWith('data:image/png;base64,')){
  const paths=occurrences.get(value)??[];paths.push(pointer);occurrences.set(value,paths);
 }
}
visit(document);assert.equal(occurrences.size,6,'This repair must change exactly six actual register image payloads.');
const images=new Map();
for(const scene of document.scenes)for(const entity of scene.presentation?.scene?.entities??[]){
 const image=entity.source?.image;if(!image)continue;
 const match=image.name?.match(/^(degree|governor|decan|codon|skin|aperture) · (\d+) source members$/);
 if(!match)continue;
 const role=match[1];assert.equal(Number(match[2]),expected[role]);assert.equal(image.mode,'luminance');
 assert.ok(!images.has(role));assert.ok(occurrences.has(image.dataUrl));images.set(role,{role,image,entity_id:entity.id});
}
assert.deepEqual([...images.keys()],Object.keys(expected));
await mkdir(config.output,{recursive:true});
const module=root+'/expressions-app/field-studies-journeys/src/epiWorldMaterial.ts';
const bundle=config.output+'/actual-register-encoding.js';
await build({entryPoints:[module],outfile:bundle,bundle:true,platform:'browser',format:'iife',globalName:'EpiMaterial',logLevel:'warning'});
const browser=await chromium.launch({headless:true}),checks=[],replacements=new Map();
try{
 const page=await browser.newPage();await page.setContent('<canvas width="1024" height="1024"></canvas>');await page.addScriptTag({path:bundle});
 for(const {role,image,entity_id} of images.values()){
  const result=await page.evaluate(async image=>{
   const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
   const decode=async dataUrl=>{const img=new Image();img.src=dataUrl;await img.decode();if(img.naturalWidth!==1024||img.naturalHeight!==1024)throw Error('Actual register image resolution changed.');c.clearRect(0,0,1024,1024);c.drawImage(img,0,0);return c.getImageData(0,0,1024,1024).data;};
   const original=await decode(image.dataUrl),encoded=await EpiMaterial.encodeRegisterMaskPNG(canvas),decoded=await decode(encoded);
   let nonzeroAlpha=0,partialAlpha=0;
   for(let i=0;i<original.length;i++){
    if(original[i]!==decoded[i])throw Error(`Decoded register sample changed at RGBA byte ${i}.`);
    if(i%4===3){if(original[i]>0)nonzeroAlpha++;if(original[i]>0&&original[i]<255)partialAlpha++;}
   }
   if(!partialAlpha)throw Error('The actual source must exercise antialiased alpha preservation.');
   return{dataUrl:encoded,compared_rgba_bytes:original.length,nonzero_alpha_pixels:nonzeroAlpha,partial_alpha_pixels:partialAlpha};
  },image);
  const paths=occurrences.get(image.dataUrl);assert.equal(paths.length,5,'All actual working, sequence, reset and reusable profile copies must remain.');
  for(const pointer of paths)assert.match(pointer,/^\/scenes\/\d+\/presentation\/(?:saved\/entities\/\d+\/(?:sequence\/steps\/0\/)?source\/image\/dataUrl|scene\/(?:entities\/\d+\/(?:sequence\/steps\/0\/)?source\/image\/dataUrl|epiWorld\/profile_definitions\/\d+\/profile\/material_defaults\/material\/value\/source\/image\/dataUrl))$/);
  const encoded=Buffer.from(result.dataUrl.split(',')[1],'base64');assert.equal(encoded.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(encoded.readUInt32BE(16),1024);assert.equal(encoded.readUInt32BE(20),1024);assert.equal(encoded[24],8);assert.equal(encoded[25],3);
  const idats=[];for(let offset=8;offset<encoded.length;){const length=encoded.readUInt32BE(offset),type=encoded.toString('ascii',offset+4,offset+8);if(type==='IDAT')idats.push(encoded.subarray(offset+8,offset+8+length));offset+=length+12;}
  const scanlines=inflateSync(Buffer.concat(idats));assert.equal(scanlines.length,1024*(1+1024));
  const filters=new Set();for(let y=0;y<1024;y++){const filter=scanlines[y*(1+1024)];assert.ok(filter<=4);filters.add(filter);}
  assert.ok(result.dataUrl.length<image.dataUrl.length,'The lossless encoding must actually reduce this retained source image.');
  replacements.set(image.dataUrl,result.dataUrl);await writeFile(config.output+'/'+role+'.png',encoded);
  checks.push({role,count:expected[role],entity_id,paths,original_url_utf8_bytes:Buffer.byteLength(image.dataUrl),encoded_url_utf8_bytes:Buffer.byteLength(result.dataUrl),encoded_png_sha256:sha(encoded),png_row_filters:[...filters].sort(),decoded_rgba_equal:true,compared_rgba_bytes:result.compared_rgba_bytes,nonzero_alpha_pixels:result.nonzero_alpha_pixels,partial_alpha_pixels:result.partial_alpha_pixels});
 }
 const fallback=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d'),samples=c.createImageData(1024,1024);
  for(let x=0;x<256;x++){const p=x*4;samples.data[p]=samples.data[p+1]=samples.data[p+2]=x;samples.data[p+3]=255;const q=(1024+x)*4;samples.data[q]=samples.data[q+1]=samples.data[q+2]=255;samples.data[q+3]=x;}
  c.putImageData(samples,0,0);const expected=c.getImageData(0,0,1024,1024).data;
  const tuples=new Set();for(let p=0;p<expected.length;p+=4)tuples.add((expected[p]<<8)|expected[p+3]);if(tuples.size<=256)throw Error('Direct grayscale-alpha encoding must be exercised with more than256 actual canvas tuples.');
  const dataUrl=await EpiMaterial.encodeRegisterMaskPNG(canvas),image=new Image();image.src=dataUrl;await image.decode();c.clearRect(0,0,1024,1024);c.drawImage(image,0,0);const actual=c.getImageData(0,0,1024,1024).data;
  if(!expected.every((v,i)=>v===actual[i]))throw Error('Direct grayscale-alpha fallback changed a decoded sample.');
  return{dataUrl,tuple_count:tuples.size,decoded_rgba_equal:true};
 });assert.equal(Buffer.from(fallback.dataUrl.split(',')[1],'base64')[25],4);
 const refusals=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#ff0000';c.fillRect(0,0,1,1);
  let colour=false,resolution=false;try{await EpiMaterial.encodeRegisterMaskPNG(canvas);}catch(e){colour=String(e).includes('refuses coloured pixels');}
  canvas.width=512;try{await EpiMaterial.encodeRegisterMaskPNG(canvas);}catch(e){resolution=String(e).includes('1024px canvas');}
  return{colour,resolution};
 });assert.deepEqual(refusals,{colour:true,resolution:true});
 function replace(value,mapping){
  if(Array.isArray(value))return value.map(v=>replace(v,mapping));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replace(v,mapping)]));
  return typeof value==='string'&&mapping.has(value)?mapping.get(value):value;
 }
 const transformed=replace(document,replacements),reverse=new Map([...replacements].map(([a,b])=>[b,a]));
 assert.deepEqual(replace(transformed,reverse),document,'Only the six exact PNG payload strings may change; full source, profiles, scenes, reset, identity and inventory remain.');
 const oldCompact=JSON.stringify(document),newCompact=JSON.stringify(transformed),oldBytes=Buffer.byteLength(oldCompact),newBytes=Buffer.byteLength(newCompact);
 const expectedSaving=checks.reduce((n,c)=>n+(c.original_url_utf8_bytes-c.encoded_url_utf8_bytes)*c.paths.length,0);
 assert.equal(oldBytes-newBytes,expectedSaving);assert.ok(newBytes<=4*1024*1024,'The actual compact candidate document must fit the unchanged Central UTF8 limit.');
 await writeFile(config.output+'/lossless-compact-document.json',newCompact);
 const receipt={standing:'actual retained native ACK document; decoded lossless PNG and parsed-document/compact-size proof only; native store/save/reopen and installed receiving not executed by this test',document_response_file:config.document_response_file,document_response_sha256:sha(raw),expression_ref:document.expression_ref,revision:document.revision,producer_sha256:sha(await readFile(module)),environment:{browser:await browser.version(),headless:true,canvas:'actual Chromium Canvas2D PNG decode/encode/decode',native_bridge:'not used',audio:'none'},encoding:'PNG colour type3/8-bit exact grayscale+alpha tuple palette (PLTE/tRNS); native CompressionStream deflate',checks,direct_grayscale_alpha_fallback:{input_standing:'controlled real Canvas2D samples exercising exact >256-tuple format; not Bimba numerical/source material',tuple_count:fallback.tuple_count,decoded_rgba_equal:fallback.decoded_rgba_equal,png_colour_type:4},refusals,retained_complete_inventory:2141,retained_profile_definitions:61,retained_scene_material_counts:sceneCounts,all_other_parsed_document_fields_equal:true,expected_central_utf8_limit:4*1024*1024,original_compact_utf8_bytes:oldBytes,lossless_compact_utf8_bytes:newBytes,exact_raster_utf8_saving:expectedSaving,candidate_compact_sha256:sha(newCompact),actual_native_save:'pending owner replay; no claim from size arithmetic'};
 await writeFile(config.output+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();}
