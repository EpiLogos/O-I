/** Actual native Central file save/open proof. Supply a controlled bridge and
 * an independently retained native file reading. No mock owner or transport.
 * UI, images, continuation and installed acceptance have separate proofs. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

assert.ok(process.argv[2],'Supply {bridge,retained_reading,output} JSON');
const config=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
const out=resolve(config.output);mkdirSync(out,{recursive:true});
const retain=(name,value)=>writeFileSync(resolve(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
const original=JSON.parse(readFileSync(resolve(config.retained_reading),'utf8'));
assert.ok(original.ok&&original.outcome.result==='file_read');
const legacy=original.outcome.reading;
const basis=config.document_reading?JSON.parse(readFileSync(resolve(config.document_reading),'utf8')):original;
const intended=JSON.parse(basis.outcome.reading.content);
assert.equal(intended.schema,'oi.expression/v1');
const receipt={schema:'oi.expression-file-central-native-proof/v1',passed:false,
 scope:'Actual controlled native owner/Central save/inspection/fenced open; complete Document equality, raw file CAS and no-event refusals. Ordinary UI, Save & next, normal application restart, pixels and installed acceptance are separate.',
 bridge:config.bridge,retained_reading:resolve(config.retained_reading),checks:[],requests:[]};
let sequence=0;
async function op(request,label){
 const name=String(++sequence).padStart(3,'0')+'-'+label;
 retain(name+'-issued',request);
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
 const body=await response.json();retain(name+'-response',body);receipt.requests.push(name);
 return body;
}
async function events(){const body=await (await fetch(config.bridge+'/events?since=0')).json();return body;}
function pass(label){receipt.checks.push(label);console.log('PASS',label);retain('receipt',receipt);}
const expression=request=>({op:'expression',request});
try{
 const read=await op({op:'file_read',location:legacy.location},'actual-raw-file');assert.ok(read.ok);
 const file=read.outcome.reading;
 assert.equal(file.revision,legacy.revision,'Use the exact retained actual file, not a later self-produced expectation');
 assert.deepEqual(file.location,legacy.location);
 const beforeList=await op(expression({operation:'list'}),'before-list'),beforeEvents=await events();
 const inspected=await op(expression({operation:'inspect_file',location:file.location,expected_file_revision:file.revision}),'legacy-inspect-file');
 assert.ok(inspected.ok);assert.equal(inspected.outcome.data.state,'ready');assert.deepEqual(inspected.outcome.data.document,intended);
 assert.deepEqual(inspected.outcome.data.file,{location:file.location,revision:file.revision});
 assert.deepEqual(await events(),beforeEvents);
 assert.deepEqual(await op(expression({operation:'list'}),'after-inspect-list'),beforeList);
 pass('Legacy inspection expands the full actual world without opening or emitting a native event');
 const staleRevision='central.content-fnv1a64/v1:0:0000000000000000';
 for(const operation of ['inspect_file','open_file']){
  const request={operation,location:file.location,expected_file_revision:staleRevision,...(operation==='open_file'?{actor:'agent:file-codec-native-negative'}:{})};
  const refused=await op(expression(request),'stale-'+operation);
  assert.ok(refused.ok);assert.equal(refused.outcome.data.state,'file_revision_conflict');
  assert.deepEqual(await events(),beforeEvents);
  assert.deepEqual(await op(expression({operation:'list'}),'after-stale-'+operation),beforeList);
 }
 pass('Stale inspect and stale open refuse before owner insertion or any native event');
 const opened=await op(expression({operation:'open_file',location:file.location,expected_file_revision:file.revision,actor:'agent:file-codec-native-proof'}),'legacy-open-file');
 assert.ok(opened.ok);assert.equal(opened.outcome.data.state,'ready');assert.deepEqual(opened.outcome.data.document,intended);
 const saved=await op(expression({operation:'save',expression_ref:intended.expression_ref,expected_revision:intended.revision,location:file.location,expected_file_revision:file.revision,actor:'agent:file-codec-native-proof',actor_kind:'agent'}),'encoded-save');
 assert.ok(saved.ok);assert.equal(saved.outcome.data.state,'saved');assert.equal(saved.outcome.data.readback_verified,true);
 const independent=await op({op:'file_read',location:file.location},'encoded-independent-raw-read');assert.ok(independent.ok);
 const encoded=independent.outcome.reading,storage=JSON.parse(encoded.content);
 assert.equal(storage.schema,'oi.expression-storage/v1');assert.equal(storage.images.length,6);
 assert.ok(Buffer.byteLength(encoded.content)<=4*1024*1024);assert.equal(encoded.revision,saved.outcome.data.file.revision);
 const beforeInspect=await op(expression({operation:'inspect',expression_ref:intended.expression_ref}),'before-encoded-inspect'),eventBasis=await events();
 const decoded=await op(expression({operation:'inspect_file',location:encoded.location,expected_file_revision:encoded.revision}),'encoded-inspect-file');
 assert.ok(decoded.ok);assert.deepEqual(decoded.outcome.data.document,intended);
 assert.deepEqual(decoded.outcome.data.file,{location:encoded.location,revision:encoded.revision});
 assert.deepEqual(await events(),eventBasis);
 assert.deepEqual(await op(expression({operation:'inspect',expression_ref:intended.expression_ref}),'after-encoded-inspect'),beforeInspect);
 pass('Actual native Save uses the existing file CAS; independent owner decoding equals every original Document field');
 const oldFileOpen=await op(expression({operation:'open_file',location:encoded.location,expected_file_revision:staleRevision,actor:'agent:file-codec-native-negative'}),'old-file-revision-open');
 assert.ok(oldFileOpen.ok);assert.equal(oldFileOpen.outcome.data.state,'file_revision_conflict');assert.deepEqual(await events(),eventBasis);
 const reopened=await op(expression({operation:'open_file',location:encoded.location,expected_file_revision:encoded.revision,actor:'agent:file-codec-native-proof'}),'encoded-open-file');
 assert.ok(reopened.ok);assert.equal(reopened.outcome.data.state,'ready');assert.deepEqual(reopened.outcome.data.document,intended);
 assert.deepEqual(reopened.outcome.data.file,{location:encoded.location,revision:encoded.revision});assert.equal(reopened.outcome.data.dirty,false);
 pass('Encoded guarded opening retains the exact Expression, scene material, sources and saved file binding');
 if(config.central_root){
  const path=encoded.location.path,slash=path.lastIndexOf('/');assert.ok(slash>0);
  const listed=await op({op:'files_list',path:path.slice(0,slash),fresh:true},'negative-parent-owner-disclosure');
  assert.ok(listed.ok);const parent=listed.outcome.directory.location;assert.equal(parent.root,encoded.location.root);
  const marker=value=>{if(value&&typeof value==='object'){
   if(value.schema==='oi.expression-image-ref/v1')return value;
   for(const child of Object.values(value)){const found=marker(child);if(found)return found;}
  }return null;};
  const negatives=[
   ['missing-image',v=>v.images.splice(0,1),'Missing embedded image reference'],
   ['duplicate-image',v=>v.images.push(structuredClone(v.images[0])),'Duplicate embedded image reference'],
   ['changed-image',v=>{v.images[0].data_url=v.images[0].data_url.slice(0,-4)+'AAAA';},'Invalid embedded image schema or digest'],
   ['cyclic-reference',v=>{marker(v.document).ref=storage.expanded_document_sha256;},'Missing embedded image reference'],
   ['wrong-schema',v=>{v.schema='oi.expression-storage/v999';},'Unsupported Expression file storage schema'],
   ['forged-expanded-digest',v=>{v.expanded_document_sha256='sha256:'+'0'.repeat(64);},'Expanded Expression document digest differs'],
  ];
  const baseline=await op(expression({operation:'inspect',expression_ref:intended.expression_ref}),'before-real-file-negatives');
  for(const [label,change,reason] of negatives){
   const value=structuredClone(storage);change(value);
   const input={parent,name:`epi-file-codec-negative-${crypto.randomUUID()}-${label}.json`,content:JSON.stringify(value),expected_absent:true,
    operation_ref:`operation:file-codec-negative:${crypto.randomUUID()}`,actor:'agent:file-codec-native-proof',actor_kind:'agent'};
   const name=String(++sequence).padStart(3,'0')+'-'+label+'-actual-central-create';retain(name+'-issued',input);
   const env={...process.env};delete env.CENTRAL_NATIVE_TOKEN;
   const child=spawnSync(config.ctrl_bin??'ctrl',['--json','--root',config.central_root,'action','run','central.files.create','-'],{input:JSON.stringify(input),encoding:'utf8',env,maxBuffer:8*1024*1024});
   retain(name+'-response',{status:child.status,stdout:child.stdout,stderr:child.stderr});assert.equal(child.status,0);
   const created=JSON.parse(child.stdout);assert.equal(created.ok,true);assert.equal(created.data.outcome,'created');
   const fault=created.data.location,observed=await op({op:'file_read',location:fault},label+'-actual-reading');assert.ok(observed.ok);
   const eventBasis=await events();
   for(const operation of ['inspect_file','open_file','save']){
    const request=operation==='save'?{operation,expression_ref:intended.expression_ref,expected_revision:intended.revision,location:fault,expected_file_revision:observed.outcome.reading.revision,actor:'agent:file-codec-native-proof',actor_kind:'agent'}:
     {operation,location:fault,expected_file_revision:observed.outcome.reading.revision,...(operation==='open_file'?{actor:'agent:file-codec-native-proof'}:{})};
    const refusal=await op(expression(request),label+'-'+operation);assert.equal(refusal.ok,false);assert.ok(refusal.error.includes(reason),refusal.error);
    assert.deepEqual(await events(),eventBasis);assert.deepEqual(await op(expression({operation:'inspect',expression_ref:intended.expression_ref}),label+'-unchanged-owner'),baseline);
   }
   const unchanged=await op({op:'file_read',location:fault},label+'-unchanged-fault-file');assert.deepEqual(unchanged,observed);
   pass(`${label}: actual native inspection, open and save destination refuse without touching draft, file binding or fault bytes`);
  }
  const originalFile=await op({op:'file_read',location:encoded.location},'original-file-after-negative-files');assert.deepEqual(originalFile,independent);
 }
 Object.assign(receipt,{passed:true,expression_ref:intended.expression_ref,document_revision:intended.revision,
  legacy_file_revision:file.revision,encoded_file_revision:encoded.revision,legacy_bytes:Buffer.byteLength(file.content),encoded_bytes:Buffer.byteLength(encoded.content),
  encoded_sha256:createHash('sha256').update(encoded.content).digest('hex'),full_document_equal:true,image_dictionary_count:storage.images.length});
}catch(error){receipt.error=String(error?.stack??error);console.error(receipt.error);process.exitCode=1;}
finally{retain('receipt',receipt);}
