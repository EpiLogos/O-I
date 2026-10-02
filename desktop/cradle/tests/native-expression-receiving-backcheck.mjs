/** Receiver/source regression gate. Immutable public5b2 native receipts prove
 * retained body receiving; controlled suites prove protocol/lifecycle only.
 * No fresh native numerical, browser, GPU, PCM, hardware or installed claim. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,lstat,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,relative,extname,isAbsolute} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {build,version as esbuildVersion} from 'esbuild';
const cradle=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(process.argv.length,4,'Usage: node tests/native-expression-receiving-backcheck.mjs --output ABSOLUTE_DIRECTORY');
assert.equal(process.argv[2],'--output');assert.ok(isAbsolute(process.argv[3]),'explicit absolute output directory required');
const out=resolve(process.argv[3]);await mkdir(out,{recursive:true});assert.equal((await readdir(out)).length,0,'receiver output directory must be empty; preserve previous receipts');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
async function fileHash(path){const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
const retained={
 authority:'immutable retained public controlled native records only; not a fresh numerical admission',
 repository:'EpiLogos/O-I',run_id:36961502372,job_id:110695990503,artifact_id:11208703027,
 archive_sha256:'0a48905e248787a8faae692837c37165c1cef44649459c6389098f3071ec93ba',
 oi_revision:'5b2c5327894edbe904eeed15c52b7da2df25968a',ql_revision:'ec33764868b22e98cd6ebff8f6565097f67bdb03',
 native_input_sha256:'cc398d4b586084000b9e7f3289e69dcbfdf1db75376b78fee21b4c62581242f3',
 fixture:'tests/fixtures/native-expression-retained-5b2-inspect.jsonl.gz',compressed_bytes:1236505,
 compressed_sha256:'abc5bda7d8b70197a8d6789ae28c1024c3d7e3bbdcb069cc21e9ec55aed4477b',
 raw_bytes:5051661,raw_sha256:'22dd19d0695e8017168ebfc9f5a2cfd24f89f9617dfca79fe498845aa6fbe1a0',
 records:{scene:{bytes:2538413,sha256:'189ff8bd4b012c563d8736a4872582f501619ebfa08ad5a7e9f92faa3745eb7f'},generic:{bytes:2513248,sha256:'93cc7397055c8021b28b64945a7a16807a580444deeeca770eca41fd7b76f6dd'}},
};
const report={schema:'oi.native-expression-receiver-backcheck/v1',pass:false,
 standing:'current compiled receiver over exact retained native bodies plus controlled protocol/lifecycle regressions; not fresh native computation/browser/GPU/PCM/installed acceptance',
 retained,runtime:{node:process.version,versions:process.versions,platform:process.platform,arch:process.arch,esbuild:esbuildVersion},checks:[]};
const fail=(ok,reason)=>assert.ok(ok,reason);
const loaded=new Map();let meta;const logLimit=16*1024*1024;
async function runTests(label,files,env={}){
 const logPath=resolve(out,label+'.log');const log=[];let bytes=0,overflow=false;
 const source_files=await Promise.all(files.map(async path=>({path:resolve(cradle,path),sha256:await fileHash(resolve(cradle,path))})));
 const args=['--test',...files],child=spawn(process.execPath,args,{cwd:cradle,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 const receive=chunk=>{bytes+=chunk.length;if(bytes>logLimit){overflow=true;child.kill('SIGTERM');return;}log.push(chunk);process.stdout.write(chunk);};
 child.stdout.on('data',receive);child.stderr.on('data',receive);
 const result=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
 const body=Buffer.concat(log);await writeFile(logPath,body);
 return{label,command:[process.execPath,...args],cwd:cradle,...result,log:{path:logPath,bytes:body.length,sha256:digest(body)},overflow,
 source_files};
}
try{
 const node=await realpath(process.execPath);report.runtime.executable={path:node,sha256:await fileHash(node)};
 const head=(await promisify(execFile)('git',['rev-parse','HEAD'],{cwd:cradle,maxBuffer:4096})).stdout.trim();
 fail(/^[0-9a-f]{40}$/.test(process.env.EXPECTED_OI_HEAD??'')&&head===process.env.EXPECTED_OI_HEAD,'exact hosted source checkout differs from expected OI head');
 report.source={head,standing:'HEAD context with compiler-consumed source bytes individually recorded; no dependency bytes inferred from the Git ref'};
 const self=fileURLToPath(import.meta.url);report.helper={path:self,sha256:await fileHash(self)};
 const fixture=resolve(cradle,retained.fixture),stat=await lstat(fixture);fail(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===retained.compressed_bytes,'bounded regular committed fixture required');
 const compressed=await readFile(fixture);fail(digest(compressed)===retained.compressed_sha256,'retained compressed fixture changed');
 const raw=gunzipSync(compressed,{maxOutputLength:retained.raw_bytes});fail(raw.length===retained.raw_bytes&&digest(raw)===retained.raw_sha256,'retained exact record bytes changed');
 const recordPaths={};let offset=0;
 for(const [name,expect] of Object.entries(retained.records)){
  const bytes=raw.subarray(offset,offset+expect.bytes);offset+=expect.bytes;
  fail(bytes.length===expect.bytes&&digest(bytes)===expect.sha256&&bytes.at(-1)===10&&bytes.indexOf(10)===bytes.length-1,'wrong retained '+name+' record boundary/digest');
  const value=JSON.parse(bytes.toString('utf8'));fail(value.schema==='ql.field-host-receipt/v1'&&value.status==='ok'&&value.available===true,'original '+name+' record unavailable');
  const path=resolve(out,name+'-first-inspect.raw.json');await writeFile(path,bytes);recordPaths[name]=path;
 }
 fail(offset===raw.length,'unexpected additional native record');report.fixture={path:fixture,sha256:digest(compressed),raw_sha256:digest(raw),records:recordPaths};
 const entries={controller:resolve(cradle,'expressions-app/field-studies-journeys/src/native-field/controller.ts'),domain:resolve(cradle,'expressions-app/field-studies-journeys/src/native-field/domain.ts')};
 const moduleOut=resolve(out,'modules');await mkdir(moduleOut,{recursive:true});
 const result=await build({absWorkingDir:cradle,entryPoints:entries,outdir:moduleOut,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',metafile:true,
  plugins:[{name:'same-buffer-source-custody',setup(builder){builder.onLoad({filter:/.*/,namespace:'file'},async args=>{
   const path=await realpath(args.path),stat=await lstat(path);fail(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=32*1024*1024,'compiler input must be a bounded regular file');
   const bytes=await readFile(path),loader={'.ts':'ts','.tsx':'tsx','.js':'js','.mjs':'js','.cjs':'js','.jsx':'jsx','.json':'json'}[extname(path)];fail(loader,'unsupported compiler source format: '+path);
   const record={path,bytes:bytes.length,sha256:digest(bytes)},prior=loaded.get(path);fail(!prior||prior.sha256===record.sha256,'source changed between compiler reads: '+path);loaded.set(path,record);
   return{contents:bytes,loader,resolveDir:dirname(path)};
  });}}]});
 meta=result.metafile;await json(resolve(out,'metafile.json'),meta);
 const inputs=[];
 for(const [name,value] of Object.entries(meta.inputs)){
  const path=await realpath(resolve(cradle,name)),record=loaded.get(path);fail(record&&record.bytes===value.bytes,'metafile input not joined to the compiler-consumed buffer: '+name);
  inputs.push({...record,metafile_key:name,imports:value.imports});
 }
 const outputs=[];
 for(const [name,value] of Object.entries(meta.outputs)){
  const path=resolve(cradle,name),bytes=await readFile(path);fail(bytes.length===value.bytes,'emitted module differs from metafile byte count');
  outputs.push({path,bytes:bytes.length,sha256:digest(bytes),entry_point:value.entryPoint??null,metafile_key:name});
 }
 const modules={controller:resolve(moduleOut,'controller.mjs'),domain:resolve(moduleOut,'domain.mjs')};
 for(const path of Object.values(modules))fail(outputs.some(value=>value.path===path),'missing emitted receiving entry module');
 report.compiler={configuration:{bundle:true,platform:'node',format:'esm',esbuild_version:esbuildVersion},entries,metafile:{path:resolve(out,'metafile.json'),sha256:await fileHash(resolve(out,'metafile.json'))},inputs,loaded_inputs:[...loaded.values()],outputs,modules};
 report.support_sources=await Promise.all(['tests/native-expression-fixture.mjs'].map(async path=>({path:resolve(cradle,path),sha256:await fileHash(resolve(cradle,path))})));
 const protocol=await runTests('transport-instrument',['tests/native-expression.test.mjs','tests/native-expression-instrument.test.mjs']);report.checks.push(protocol);
 const receiving=await runTests('retained-native-receiving',['tests/native-expression-retained-receiving.proof.mjs'],{
  RETAINED_CONTROLLER_MODULE:modules.controller,RETAINED_DOMAIN_MODULE:modules.domain,RETAINED_PROTOCOL_FIXTURE_MODULE:resolve(cradle,'tests/native-expression-fixture.mjs'),
  RETAINED_SCENE_INSPECT:recordPaths.scene,RETAINED_GENERIC_INSPECT:recordPaths.generic});report.checks.push(receiving);
 for(const value of loaded.values())fail(await fileHash(value.path)===value.sha256,'compiler source changed during receiving tests: '+value.path);
 for(const value of outputs)fail(await fileHash(value.path)===value.sha256,'emitted module changed during receiving tests: '+value.path);
 for(const [name,path] of Object.entries(recordPaths))fail(await fileHash(path)===retained.records[name].sha256,'retained native record changed during receiving tests');
 fail(await fileHash(fixture)===retained.compressed_sha256,'committed fixture changed during receiving tests');
 for(const value of report.support_sources)fail(await fileHash(value.path)===value.sha256,'test fixture source changed during receiving tests');
 for(const check of report.checks){fail(!check.overflow&&check.code===0&&check.signal===null,check.label+' failed; see actual captured log');for(const source of check.source_files)fail(await fileHash(source.path)===source.sha256,'test source changed during receiving gate');}
 report.pass=true;
}catch(error){report.failure=String(error?.stack??error);process.exitCode=1;}
finally{await json(resolve(out,'receipt.json'),report);console.log(JSON.stringify({schema:report.schema,pass:report.pass,receipt:resolve(out,'receipt.json'),failure:report.failure??null}));}
