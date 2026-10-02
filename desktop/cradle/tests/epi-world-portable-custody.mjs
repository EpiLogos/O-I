/** Portable custody only. Semantic, buffer, source tuple and sky gates remain
 * in the unchanged production whole verifier. This module never executes a
 * native binary and never opens the recorded original Darwin binary paths. */
import assert from 'node:assert/strict';
import {openSync,readSync,closeSync,readFileSync,statSync,realpathSync,existsSync} from 'node:fs';
import {resolve,isAbsolute,sep,basename,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const APPROVED_TEMPLATE_SHA256='98d9ed07dbfe9212f9eedff6583c894d074d89f3d96d08d9b07d82e35c89f845';
export const APPROVED_D30_TEMPLATE_SHA256='d16c3ee6f757cff878939c2c5cd768a8412c20ae6e43b59cfe87364b2dad3c60';
const D30_SUCCESSION_REF={path:'source-succession-d30-6a81fc44.json',bytes:18393,sha256:'2c36eb34c388903d7d6dd97c3a36f2b399c164d0974680f09bfe9d0958fabd8f'};
const D30_CONSUMER_PATHS=['crates/ql-mef/src/continuous/scene_field.rs','crates/ql-mef/src/continuous/host.rs','adapters/retained-field/instrument-session.mjs','crates/ql-mef/tests/scene_instrument.rs'];
const D30_SOURCE_CUT='6a81fc441e4dda477f4de3a7ebd59c368cb28f37';
const hex64=/^[0-9a-f]{64}$/,hex40=/^[0-9a-f]{40}$/;
const names=['ql','ql-field-host','ql-field-worker','ql-focused-host','ql-sky'].sort();
const toolNames=['rustc','cargo','cc','cxx','make','uv','python'].sort();
export const COMPLETE_WORLD_KEYS=['basis','binding','current_form','event','event_ref','instance_ref','native_owner_sources','native_readback','registers','scene','schema','sky','sky_admission','snapshot_ref','starting_recipe','subject_ref'];
export const SEMANTIC_WORLD_KEYS=COMPLETE_WORLD_KEYS.filter(x=>!['native_owner_sources','sky_admission'].includes(x));
const derivationPaths=['fixtures/kernel/m-ledger-v1.json','crates/ql-mef/src/m_ledger.rs','crates/ql-mef/src/m2_engine.rs','crates/ql-mef/src/scene.rs','crates/ql-mef/src/continuous/coupled.rs','crates/ql-mef/src/continuous/scene_field.rs'];
const preserved=['original_owner_cut','expected_native_owner_sources','expected_original_native_owner_sources','expected_retained_sky_admission','expected_original_sky_admission','expected_current_source_binding','expected_exact_legacy_source_binding','complete_world_keys','semantic_world_keys','explicit_provenance_fields','exact_saved_occasion','immutable_sky_full_value_guard','legacy_constants','full_source_qualification','required_buffer_guard','signed_zero_policy','required_execution_not_established','expectation_generation_inputs','original_all_five','historical_portable_basis'];
function absolute(path,label){assert.equal(typeof path,'string',label);assert.ok(isAbsolute(path),label+': absolute path');assert.equal(resolve(path),path,label+': canonical lexical path');return path;}
export function hashFileReadOnly(path,cap=256*1024*1024){
 absolute(path,'Physical file');assert.ok(statSync(path).isFile(),'Physical custody requires a regular file');const fd=openSync(path,'r'),hash=createHash('sha256'),chunk=Buffer.allocUnsafe(1024*1024);let bytes=0;
 try{for(;;){const n=readSync(fd,chunk,0,chunk.length,null);if(!n)break;bytes+=n;assert.ok(bytes<=cap,'Physical file exceeds declared receiving cap');hash.update(chunk.subarray(0,n));}}finally{closeSync(fd);}
 return{bytes,sha256:hash.digest('hex')};
}
function refFile(ref,label,cap=64*1024*1024){
 assert.ok(ref&&typeof ref==='object',label+': reference');absolute(ref.path,label);assert.match(ref.sha256,hex64,label+': SHA256');assert.ok(Number.isSafeInteger(ref.bytes)&&ref.bytes>=0&&ref.bytes<=cap,label+': bounded exact byte count');
 assert.deepEqual(hashFileReadOnly(ref.path,cap),{bytes:ref.bytes,sha256:ref.sha256},label+': immutable physical artifact');return ref.path;
}
export function qualifiedJson(ref,label,cap=64*1024*1024){return JSON.parse(readFileSync(refFile(ref,label,cap),'utf8'));}
function pointed(value,pointer,label){
 assert.equal(typeof pointer,'string',label+': exact JSON pointer');assert.ok(pointer===''||pointer.startsWith('/'));if(pointer==='')return value;
 return pointer.slice(1).split('/').reduce((parent,part)=>{const key=part.replace(/~1/g,'/').replace(/~0/g,'~');assert.ok(parent&&Object.hasOwn(parent,key),label+': pointer exists');return parent[key];},value);
}
export function approvedTemplate(ref){
 assert.ok([APPROVED_TEMPLATE_SHA256,APPROVED_D30_TEMPLATE_SHA256].includes(ref.sha256),'One explicitly reviewed immutable template must be named');
 const t=qualifiedJson(ref,'Reviewed template',1024*1024);assert.equal(t.schema,'epi.native-world-source-expectation-template/v3');assert.deepEqual(t.complete_world_keys,COMPLETE_WORLD_KEYS);assert.deepEqual(t.semantic_world_keys,SEMANTIC_WORLD_KEYS);
 if(ref.sha256===APPROVED_D30_TEMPLATE_SHA256)assert.deepEqual(t.source_succession,D30_SUCCESSION_REF,'Exact reviewed D30 source succession');
 else assert.equal(Object.hasOwn(t,'source_succession'),false,'Original template retains its original dependency chain');return t;
}
/** Source-only successor qualification; no reply supplies an expected value. */
export function qualifyTemplateSuccession(e,t=approvedTemplate(e.template_ref)){
 if(e.template_ref.sha256===APPROVED_TEMPLATE_SHA256){
  for(const key of ['source_succession_ref','source_succession_prior_template_ref'])assert.equal(Object.hasOwn(e,key),false,'Original expectation cannot carry an unreviewed successor');return null;
 }
 assert.equal(e.template_ref.sha256,APPROVED_D30_TEMPLATE_SHA256);assert.deepEqual(t.source_succession,D30_SUCCESSION_REF);
 const ref={...D30_SUCCESSION_REF,path:resolve(dirname(e.template_ref.path),D30_SUCCESSION_REF.path)};
 under(dirname(e.template_ref.path),ref.path,'Reviewed source succession');assert.deepEqual(e.source_succession_ref,ref,'Exact adjacent source succession artifact');
 const r=qualifiedJson(ref,'Reviewed source succession',1024*1024);assert.equal(r.schema,'epi.native-source-succession/v1');assert.equal(r.prior_source_cut,'ec33764868b22e98cd6ebff8f6565097f67bdb03');assert.equal(r.current_source_cut,D30_SOURCE_CUT);assert.equal(e.owner_cut,r.current_source_cut);assert.equal(r.current_source_tree,'b8fdc00fc958387901b1f466228d7fd373357a5d');
 assert.deepEqual(r.prior_template,{path:'expectation-template.json',bytes:30779,sha256:APPROVED_TEMPLATE_SHA256});
 const oldRef=e.source_succession_prior_template_ref;assert.equal(oldRef.bytes,r.prior_template.bytes);assert.equal(oldRef.sha256,APPROVED_TEMPLATE_SHA256);
 const old=approvedTemplate(oldRef);const predicted=structuredClone(old),field=D30_CONSUMER_PATHS[0];
 const prior=r.constructor_source_locks.prior,current=r.constructor_source_locks.current;
 assert.deepEqual(prior.map(({path,sha256})=>({path,sha256})),old.source_locks);assert.deepEqual(current.map(({path,sha256})=>({path,sha256})),t.source_locks);
 assert.deepEqual(current.filter((row,i)=>row.sha256!==prior[i].sha256).map(row=>row.path),[field],'Only the source-owned field implementation ReadingRef changes');
 const fieldHash=current.find(row=>row.path===field).sha256;
 predicted.expected_native_owner_sources.field.revision='sha256:'+fieldHash;predicted.source_locks.find(row=>row.path===field).sha256=fieldHash;
 predicted.semantic_metadata_transition.derivation_sources.find(row=>row.path===field).sha256=fieldHash;predicted.source_succession=D30_SUCCESSION_REF;
 assert.deepEqual(t,predicted,'Every historical, semantic, numerical, buffer, sky and ledger prediction remains exact; only three current source metadata leaves and explicit succession reference differ');
 assert.deepEqual(r.consumer_sources.map(row=>row.path),D30_CONSUMER_PATHS,'Exact four D30 native owner/consumer/regression sources');
 assert.equal(r.executed_native_or_browser,false);assert.equal(r.installed_acceptance,false);assert.equal(r.H,false);
 return {record_ref:ref,prior_template_ref:oldRef,record:r};
}
function under(root,path,label){absolute(root,label+' root');absolute(path,label);const actualRoot=realpathSync(root),actual=realpathSync(path);assert.ok(actual===actualRoot||actual.startsWith(actualRoot+sep),label+': physical custody within root');return path;}
export function resolveFixtureRef(ref,fixtureRoot){
 assert.ok(ref&&typeof ref.path==='string'&&!isAbsolute(ref.path),'Template fixture path must be relative');const path=resolve(fixtureRoot,ref.path);under(fixtureRoot,path,'Historical fixture');return{...ref,path};
}
export function assembleExpectation(templateRef,fixtureRoot,manifestRef){
 const template=approvedTemplate(templateRef),manifest=qualifiedJson(manifestRef,'Actual current source-built manifest',4*1024*1024);
 assert.equal(manifest.schema,'epi.source-built-hosted-native-cut/v1');assert.match(manifest.source_cut,hex40);
 const e={schema:'epi.native-world-source-expectation/v3',owner_cut:manifest.source_cut,...Object.fromEntries(preserved.map(k=>[k,template[k]])),template_ref:templateRef,
  current_custody:{kind:'source-built-hosted',manifest_ref:manifestRef},
  historical_custody:{...template.historical_custody},current_all_five:manifest.all_five,
  source_qualification:manifest.source.map(s=>({repository:manifest.source_root,path:s.path,physical_path:s.physical_path,cut:s.cut,sha256:s.sha256,bytes:s.bytes,working_bytes_equal_cut:s.working_bytes_equal_cut}))};
 for(const key of Object.keys(e.historical_custody))if(key.endsWith('_ref'))e.historical_custody[key]=resolveFixtureRef(template.historical_custody[key],fixtureRoot);
 e.historical_custody.supporting_refs=template.historical_custody.supporting_refs.map(row=>({name:row.name,ref:resolveFixtureRef(row.ref,fixtureRoot)}));
 e.original_world_ref=e.historical_custody.original_world_ref;e.original_manifest_ref=e.historical_custody.manifest_ref;
 if(templateRef.sha256===APPROVED_D30_TEMPLATE_SHA256){
  e.source_succession_ref=resolveFixtureRef(template.source_succession,dirname(templateRef.path));
  const succession=qualifiedJson(e.source_succession_ref,'Reviewed source succession',1024*1024);
  e.source_succession_prior_template_ref=resolveFixtureRef(succession.prior_template,fixtureRoot);
  qualifyTemplateSuccession(e,template);
 }
 const ledger=manifest.source.find(s=>s.path==='fixtures/kernel/m-ledger-v1.json');assert.ok(ledger,'Actual current embedded ledger source');
 e.semantic_metadata_transition={...template.semantic_metadata_transition,original_ledger:resolveFixtureRef(template.semantic_metadata_transition.original_ledger,fixtureRoot),current_ledger:{path:ledger.physical_path,bytes:ledger.bytes,sha256:ledger.sha256,cut:manifest.source_cut}};
 return e;
}
function exactHistoricalRefs(e,t){
 const h=e.historical_custody,original=t.historical_custody;assert.equal(h.kind,'historical-independently-verified');assert.equal(h.no_current_original_binary_rehash,true);
 assert.deepEqual(Object.keys(h).sort(),Object.keys(original).sort(),'Exact historical custody fields');
 for(const key of Object.keys(original))if(key.endsWith('_ref')){const a=h[key],b=original[key];for(const field of ['bytes','sha256','historical_recorded_path','pointer'])assert.equal(a[field],b[field],key+': original reference '+field);}
 assert.deepEqual(h.supporting_refs.map(x=>x.name),original.supporting_refs.map(x=>x.name));
 for(let i=0;i<original.supporting_refs.length;i++)for(const key of ['bytes','sha256','historical_recorded_path'])assert.equal(h.supporting_refs[i].ref[key],original.supporting_refs[i].ref[key],'Exact supporting original custody');
}
export function qualifyHistoricalCustody(e,t=approvedTemplate(e.template_ref)){
 for(const key of preserved)assert.deepEqual(e[key],t[key],key+': predictions remain the reviewed original/source-derived values');exactHistoricalRefs(e,t);
 const h=e.historical_custody,cache=new Map(),get=(ref,label)=>{const key=ref.path+'\0'+ref.sha256;if(!cache.has(key))cache.set(key,qualifiedJson(ref,label));return cache.get(key);};
 const original=get(h.manifest_ref,'Historical all-five manifest');assert.equal(original.schema,'ql.same-source-five-companion-cut/v1');assert.equal(original.source_head,e.original_owner_cut);
 assert.deepEqual(original.components.map(x=>x.role).sort(),names);assert.deepEqual(e.original_all_five.map(x=>x.role).sort(),names);
 for(const b of e.original_all_five){assert.equal(Object.hasOwn(b,'read_only_bytes_verified'),false,'No new physical original verification flag');const row=original.components.find(x=>x.role===b.role);for(const key of ['path','bytes','sha256'])assert.equal(b[key],row[key]);absolute(b.path,'Recorded original path');assert.match(b.sha256,hex64);assert.ok(Number.isSafeInteger(b.bytes)&&b.bytes>0);}
 const build=get(h.build_receipt_ref,'Historical actual owner build');assert.equal(build.source_head,e.original_owner_cut);assert.deepEqual(build.command,['sh','scripts/oi-source-install.sh']);assert.equal(build.exit,0);
 const native=get(h.native_qualification_ref,'Historical actual native qualification');assert.equal(native.schema,'ql.joined-cut-native-qualification/v1');assert.equal(native.source_head,e.original_owner_cut);assert.equal(native.cut_receipt,h.manifest_ref.historical_recorded_path);
 assert.deepEqual(native.commands.map(x=>x.name).sort(),['version','capabilities','verify','sky','scene-world','ql-field-host','ql-focused-host'].sort());for(const c of native.commands)assert.equal(c.exit,0,c.name+': historical actual successful operation');
 for(const c of native.commands){if(c.argv){const role=c.name==='sky'?'ql-sky':'ql';assert.equal(c.argv[0],e.original_all_five.find(x=>x.role===role).path);}if(c.worker_path)assert.equal(c.worker_path,e.original_all_five.find(x=>x.role==='ql-field-worker').path);}
 for(const row of h.supporting_refs){refFile(row.ref,'Historical supporting '+row.name);if(row.name==='build_log')assert.equal(row.ref.sha256,build.log_sha256);const parts=row.name.split('/');if(parts.length===2){const command=native.commands.find(x=>x.name===parts[0]);assert.ok(command);assert.equal(row.ref.historical_recorded_path,command[parts[1]]);assert.equal(row.ref.sha256,command[parts[1].replace(/_path$/,'_sha256')]);}}
 const previous=get(h.independent_source_expectation_ref,'Dated independent original/current expectation');assert.equal(previous.schema,'epi.whole04-independent-source-expectation/v1');assert.equal(previous.original_owner_cut,e.original_owner_cut);assert.deepEqual(previous.original_all_five.map(({read_only_bytes_verified,...row})=>row),e.original_all_five);
 const review=get(h.independent_verifier_qualification_ref,'Dated independent verifier challenge');assert.equal(review.schema,'epi.whole04-independent-verifier-qualification/v1');assert.equal(review.passed,true);assert.equal(review.native_acceptance,false);assert.equal(review.installed_acceptance,false);assert.equal(review.H,false);assert.equal(review.expectation.sha256,h.independent_source_expectation_ref.sha256);assert.equal(review.original.sha256,h.original_world_ref.sha256);
 assert.equal(review.verifier.sha256,h.supporting_refs.find(x=>x.name==='independent_verifier_source').ref.sha256);
 const raw=get(h.original_world_ref,'Complete immutable actual original24'),world=raw.response?.outcome?.data?.source?.world;assert.ok(world);assert.deepEqual(Object.keys(world).sort(),COMPLETE_WORLD_KEYS);
 assert.equal(raw.request.op,'native_expression');assert.equal(raw.request.request.operation,'prepare_world');assert.equal(raw.request.request.request.sky,'now');
 for(const key of ['retained_snapshot_ref','sky_receipt_ref','sky_request_ref'])assert.equal(h[key].sha256,h.original_world_ref.sha256,key+': one exact raw artifact');
 assert.deepEqual(pointed(get(h.retained_snapshot_ref,'Original retained snapshot'),h.retained_snapshot_ref.pointer,'Retained snapshot'),world.sky);
 assert.deepEqual(pointed(get(h.sky_receipt_ref,'Original sky receipt'),h.sky_receipt_ref.pointer,'Sky receipt'),world.sky);assert.deepEqual(raw.response.outcome.data.source.sky,world.sky);
 assert.deepEqual(pointed(get(h.sky_request_ref,'Original sky request'),h.sky_request_ref.pointer,'Sky request'),raw.request.request.request);
 assert.deepEqual(world.native_owner_sources,e.expected_original_native_owner_sources);assert.deepEqual(world.sky_admission,e.expected_original_sky_admission);assert.deepEqual(world.sky.source_binding,e.expected_exact_legacy_source_binding);
 for(const key of ['snapshot_ref','epoch_utc','receipt_utc','receipt_clock','epoch_unix_ms','receipt_unix_ms'])assert.equal(world.sky[key],e.exact_saved_occasion[key]);
 const originalBinary=e.original_all_five.find(x=>x.role==='ql');assert.equal(raw.response.outcome.data.source.ql_executable,originalBinary.path);assert.equal(raw.response.outcome.data.source.ql_executable_sha256,originalBinary.sha256);
 return{kind:h.kind,source_cut:e.original_owner_cut,all_five:e.original_all_five,refs:h,original_current_filesystem_binary_reads:0,standing:'Immutable dated artifacts checked now; historical native execution and independent qualification retained, not re-executed'};
}
function git(root,args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:1024*1024,timeout:30000}).trim();}
function executableRef(ref,label){
 refFile(ref,label,256*1024*1024);
 assert.equal(realpathSync(ref.path),ref.path,label+': resolved actual regular executable');
 assert.ok((statSync(ref.path).mode&0o111)!==0,label+': executable mode');
}
function toolchainCustody(m){
 absolute(m.toolchain_cwd,'Actual toolchain operation cwd');
 const prefixes={rustc:/^rustc\s+\d+\.\d+/m,cargo:/^cargo\s+\d+\.\d+/m,cc:/\b(gcc|clang|Free Software Foundation)\b/i,cxx:/\b(g\+\+|gcc|clang|Free Software Foundation)\b/i,make:/^GNU Make\s+\d+/m,uv:/^uv\s+\d+\.\d+/m,python:/^Python\s+\d+\.\d+/m};
 const commandNames={rustc:/^rustc$/,cargo:/^cargo$/,cc:/^(?:[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*-)?(?:cc|gcc|clang)(?:-\d+(?:\.\d+)*)?$/,cxx:/^(?:[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*-)?(?:c\+\+|g\+\+|clang\+\+)(?:-\d+(?:\.\d+)*)?$/,make:/^(?:g)?make$/,uv:/^uv$/,python:/^python(?:3(?:\.\d+)*)?$/};
 assert.deepEqual(m.toolchain.map(x=>x.name).sort(),toolNames,'All actual named toolchain command receipts');
 for(const row of m.toolchain){
  assert.equal(row.cwd,m.toolchain_cwd);assert.equal(row.exit,0);
  executableRef(row.executable_ref,row.name+' actual version-command executable');assert.match(basename(row.executable_ref.path),commandNames[row.name],row.name+': qualified actual command identity');
  assert.deepEqual(row.argv,[row.executable_ref.path,'--version'],row.name+': exact actual version command');
  refFile(row.stdout_ref,row.name+' actual stdout',2*1024*1024);refFile(row.stderr_ref,row.name+' actual stderr',2*1024*1024);
  const output=readFileSync(row.stdout_ref.path,'utf8')+'\n'+readFileSync(row.stderr_ref.path,'utf8');
  assert.match(output,prefixes[row.name],row.name+': actual version output names the qualified tool');
 }
 assert.deepEqual(m.toolchain_resolution.map(x=>x.name).sort(),['cargo','rustc'],'Actual rustup resolution for the installer Rust tools');
 for(const row of m.toolchain_resolution){
  const tool=m.toolchain.find(x=>x.name===row.name);assert.equal(row.cwd,m.toolchain_cwd);assert.equal(row.exit,0);
  executableRef(row.executable_ref,'Actual rustup resolution executable');assert.equal(basename(row.executable_ref.path),'rustup');
  assert.deepEqual(row.argv,[row.executable_ref.path,'which',row.name],'Exact actual rustup tool selection');
  refFile(row.stdout_ref,row.name+' actual rustup stdout',2*1024*1024);refFile(row.stderr_ref,row.name+' actual rustup stderr',2*1024*1024);
  assert.equal(readFileSync(row.stdout_ref.path,'utf8').trim(),tool.executable_ref.path,'Installer tool is the actual rustup-resolved executable');
 }
 assert.equal(m.installer.environment.RUSTC,m.toolchain.find(x=>x.name==='rustc').executable_ref.path);
 assert.equal(m.installer.environment.CC,m.toolchain.find(x=>x.name==='cc').executable_ref.path);
 assert.equal(m.installer.environment.CXX,m.toolchain.find(x=>x.name==='cxx').executable_ref.path);
 // Resolve the recorded installer PATH by reading the actual filesystem;
 // no command or compiler is executed by this custody check.
 const path=m.installer.environment.PATH;assert.equal(typeof path,'string');assert.ok(path.length>0&&path.length<=65536);
 const dirs=path.split(':');assert.ok(dirs.length<=256);for(const dir of dirs)absolute(dir,'Actual installer PATH directory');
 for(const [command,name] of [['cargo','cargo'],['make','make'],['uv','uv'],['python3','python']]){
  const selected=dirs.map(dir=>resolve(dir,command)).find(file=>existsSync(file)&&statSync(file).isFile()&&(statSync(file).mode&0o111)!==0);
  assert.ok(selected,command+': selected actual installer command');assert.equal(realpathSync(selected),m.toolchain.find(x=>x.name===name).executable_ref.path,command+': actual installer consumes the same qualified toolchain image');
 }
}
function installerOutputCustody(m){
 const env=m.installer.environment;assert.ok(env&&typeof env==='object');absolute(env.CARGO_TARGET_DIR,'Actual installer CARGO_TARGET_DIR');
 assert.equal(m.installer.output_root,resolve(env.CARGO_TARGET_DIR,'release'),'Canonical owner installer release output directory');
 assert.equal(m.installer.output_directory_was_absent,true,'Actual prebuild output observation is required');
 const before=qualifiedJson(m.installer.prebuild_output_ref,'Actual pre-install output observation',1024*1024);
 assert.equal(before.schema,'epi.source-installer-output-preflight/v1');assert.equal(before.operation,'pathlib-lstat-before-owner-install');
 assert.equal(before.source_cut,m.source_cut);assert.equal(before.source_tree,m.tree);assert.equal(before.target_root,env.CARGO_TARGET_DIR);assert.equal(before.target_exists,false);
 assert.equal(typeof before.observed_at_utc,'string');assert.ok(Number.isFinite(Date.parse(before.observed_at_utc)),'Actual prebuild observation time');
 assert.deepEqual(before.outputs.map(x=>x.name).sort(),names,'Every actual owner output was observed absent before the build');
 for(const row of m.all_five){
  assert.equal(row.path,resolve(m.installer.output_root,row.name),row.name+': actual canonical installer output, not independently chosen bytes');
  const observed=before.outputs.find(x=>x.name===row.name);assert.equal(observed.path,row.path);assert.equal(observed.exists,false);assert.equal(observed.is_symlink,false);
 }
}
function currentSuccessionCustody(e,t,m){
 const reviewed=qualifyTemplateSuccession(e,t);
 if(!reviewed){assert.equal(Object.hasOwn(m,'source_succession'),false,'Original current-cut manifest cannot carry unreviewed source succession');return null;}
 const r=reviewed.record,carried=m.source_succession;assert.equal(m.source_cut,r.current_source_cut);assert.equal(m.tree,r.current_source_tree);
 assert.ok(carried,'D30 current manifest must qualify its host/client/real-worker test sources independently of the unchanged constructor path list');
 assert.deepEqual(Object.keys(carried).sort(),['consumer_sources','record_ref','schema']);assert.equal(carried.schema,'epi.native-source-succession-build-custody/v1');assert.deepEqual(carried.record_ref,reviewed.record_ref);
 assert.deepEqual(carried.consumer_sources.map(row=>row.path).sort(),D30_CONSUMER_PATHS.slice().sort());
 const sources=carried.consumer_sources.map(row=>{
  const lock=r.consumer_sources.find(source=>source.path===row.path).current;
  assert.equal(row.cut,m.source_cut);assert.equal(row.working_bytes_equal_cut,true);assert.equal(row.sha256,lock.sha256);assert.equal(row.bytes,lock.bytes);
  assert.equal(row.physical_path,resolve(m.source_root,row.path));under(m.source_root,row.physical_path,'Actual D30 consumer source');refFile({path:row.physical_path,bytes:row.bytes,sha256:row.sha256},'Actual D30 consumer source '+row.path);
  assert.equal(git(m.source_root,['rev-parse',m.source_cut+':'+row.path]),lock.git_blob,row.path+': separately reviewed committed D30 blob');
  assert.equal(git(m.source_root,['hash-object','--',row.physical_path]),lock.git_blob,row.path+': actual consumed D30 source bytes');return {...row};
 });
 return {record_ref:reviewed.record_ref,prior_template_ref:reviewed.prior_template_ref,source_cut:m.source_cut,tree:m.tree,sources,physical_consumer_source_reads:sources.length,standing:'Reviewed source succession plus actual build-source custody; native/whole receiving proof remains separate'};
}
function checkCurrent(e,t){
 const ref=e.current_custody?.manifest_ref;assert.equal(e.current_custody?.kind,'source-built-hosted');const m=qualifiedJson(ref,'Actual hosted source-built current manifest',4*1024*1024);
 assert.equal(m.schema,'epi.source-built-hosted-native-cut/v1');assert.equal(m.product,'quaternal-logic');assert.equal(m.custody,'source-built-hosted');assert.equal(m.source_cut,e.owner_cut);assert.match(m.source_cut,hex40);assert.match(m.tree,hex40);assert.equal(m.source_dirty,false);absolute(m.source_root,'Actual build source root');
 assert.equal(git(m.source_root,['rev-parse','HEAD']),m.source_cut,'Actual current source HEAD');assert.equal(git(m.source_root,['rev-parse','HEAD^{tree}']),m.tree,'Actual current source tree');assert.equal(git(m.source_root,['status','--porcelain=v1','--untracked-files=all']),'','Actual current source tree stays clean');
 assert.deepEqual(m.installer.argv,['sh','scripts/oi-source-install.sh']);assert.equal(m.installer.cwd,m.source_root);assert.equal(m.installer.exit,0);assert.equal(m.installer.script_ref.path,resolve(m.source_root,'scripts/oi-source-install.sh'));refFile(m.installer.script_ref,'Actual installer source',1024*1024);refFile(m.installer.log_ref,'Actual installer operation log',16*1024*1024);
 toolchainCustody(m);installerOutputCustody(m);
 assert.deepEqual(m.all_five.map(x=>x.name).sort(),names);assert.deepEqual(e.current_all_five,m.all_five,'Actual offered current five companions');
 const allFive=m.all_five.map(row=>{assert.deepEqual(Object.keys(row).sort(),['bytes','name','path','sha256']);assert.ok(row.bytes>0);refFile(row,'Actual current companion '+row.name,256*1024*1024);assert.ok((statSync(row.path).mode&0o111)!==0,'Actual owner output remains executable');return{...row};});
 assert.deepEqual(m.source.map(s=>s.path).sort(),t.source_locks.map(s=>s.path).sort(),'Exactly the reviewed current source dependency chain');
 const sources=m.source.map(row=>{const lock=t.source_locks.find(s=>s.path===row.path);assert.equal(row.cut,m.source_cut);assert.equal(row.working_bytes_equal_cut,true);assert.equal(row.sha256,lock.sha256,row.path+': source-derived expectation lock');assert.equal(row.physical_path,resolve(m.source_root,row.path));under(m.source_root,row.physical_path,'Actual current source');refFile({path:row.physical_path,bytes:row.bytes,sha256:row.sha256},'Actual current source '+row.path);assert.equal(git(m.source_root,['hash-object','--',row.physical_path]),git(m.source_root,['rev-parse',m.source_cut+':'+row.path]),row.path+': bytes are the committed cut');return{path:row.path,physical_path:row.physical_path,cut:row.cut,bytes:row.bytes,sha256:row.sha256,working_bytes_equal_cut:true};});
 const declared=sources.map(row=>({repository:m.source_root,...row}));assert.deepEqual(e.source_qualification,declared,'Current source qualifications derive only from the actual current manifest');
 const installerSource=sources.find(x=>x.path==='scripts/oi-source-install.sh');assert.equal(m.installer.script_ref.sha256,installerSource.sha256);assert.equal(m.installer.script_ref.bytes,installerSource.bytes);
 const succession=currentSuccessionCustody(e,t,m);
 return{kind:'source-built-hosted',manifest:ref,source_cut:m.source_cut,tree:m.tree,source_root:m.source_root,all_five:allFive,sources,installer:m.installer,toolchain:m.toolchain,toolchain_resolution:m.toolchain_resolution,toolchain_cwd:m.toolchain_cwd,physical_current_companion_reads:5,physical_current_source_reads:sources.length,...(succession?{source_succession:succession}:{})};
}
export function qualifyPortableNativeSourceExpectation(e,{originalWorldFile,currentCut}={}){
 assert.equal(e.schema,'epi.native-world-source-expectation/v3');assert.equal(e.owner_cut,currentCut);assert.match(e.owner_cut,hex40);const t=approvedTemplate(e.template_ref);const historical=qualifyHistoricalCustody(e,t);assert.equal(resolve(originalWorldFile),e.original_world_ref.path);assert.deepEqual(e.original_world_ref,e.historical_custody.original_world_ref);assert.deepEqual(e.original_manifest_ref,e.historical_custody.manifest_ref);
 const delta=e.semantic_metadata_transition;assert.equal(delta.schema,'epi.native-world-m2-ledger-transition/v1');for(const key of ['paths','original_value','current_value','derivation_sources'])assert.deepEqual(delta[key],t.semantic_metadata_transition[key]);assert.deepEqual(delta.paths,['/basis/m2/ledger_revision','/binding/native_basis/m2/ledger_revision']);assert.deepEqual(delta.derivation_sources.map(s=>s.path).sort(),derivationPaths.slice().sort());
 for(const key of ['sha256','bytes','cut','historical_recorded_path'])assert.equal(delta.original_ledger[key],t.semantic_metadata_transition.original_ledger[key]);assert.equal(delta.current_ledger.cut,e.owner_cut);assert.equal(delta.current_ledger.sha256,t.semantic_metadata_transition.current_ledger.sha256);assert.equal(delta.current_ledger.bytes,t.semantic_metadata_transition.current_ledger.bytes);
 const old=qualifiedJson(delta.original_ledger,'Original embedded ledger source'),now=qualifiedJson(delta.current_ledger,'Current embedded ledger source');assert.equal(old.schema,'ql.m-ledger/v1');assert.equal(now.schema,'ql.m-ledger/v1');assert.equal(old.ledger_revision,delta.original_value);assert.equal(now.ledger_revision,delta.current_value);assert.match(delta.original_value,hex64);assert.match(delta.current_value,hex64);assert.notEqual(delta.original_value,delta.current_value);
 const current=checkCurrent(e,t),ledger=current.sources.find(x=>x.path==='fixtures/kernel/m-ledger-v1.json');assert.equal(delta.current_ledger.path,ledger.physical_path);assert.equal(delta.current_ledger.sha256,ledger.sha256);
 return{schema:'epi.portable-world-custody-qualification/v3',all_five:{original:historical.all_five.map(({role,...row})=>({name:role,...row})),current:current.all_five},historical,current,semantic_metadata_transition:delta,predictions_qualified_before_native_requests:true,original_current_filesystem_binary_reads:0};
}
export function qualifyPortableRuntimeExecution(e,originalSource,currentSource){
 assert.equal(e.schema,'epi.native-world-source-expectation/v3');const result={};
 for(const [label,source,row] of [['original',originalSource,e.original_all_five.find(x=>x.role==='ql')],['current',currentSource,e.current_all_five.find(x=>x.name==='ql')]]){assert.ok(source&&row);assert.equal(source.ql_executable,row.path,label+': actual native disclosed executable path');assert.equal(source.ql_executable_sha256,row.sha256,label+': actual native disclosed executable digest');assert.equal(typeof source.ql_selection,'string');assert.ok(source.ql_selection.length>0);assert.ok(source.ql_revision===null||typeof source.ql_revision==='string','Optional native reported revision retained separately from actual build cut');if(label==='current')assert.deepEqual(hashFileReadOnly(row.path),{bytes:row.bytes,sha256:row.sha256},'Actual preparing current executable still agrees');result[label]={path:source.ql_executable,sha256:source.ql_executable_sha256,selection:source.ql_selection,reported_revision:source.ql_revision,custody:label==='original'?'historical-independently-verified':'actual-current-prepare-disclosure-and-physical-readback'};}
 return result;
}
export function requalifyPortableCurrentCustody(e,before){const template=approvedTemplate(e.template_ref),historical=qualifyHistoricalCustody(e,template),after=checkCurrent(e,template);assert.deepEqual(historical,before.historical,'Every transported original artifact remains byte-exact after the encounter; no original executable is read');assert.deepEqual(after,before.current,'All five offered companions, all source files, clean source cut/tree and actual build/toolchain receipts remain unchanged after the encounter');return{...after,phase:'after-original-whole-encounter',current_before_after_equal:true,historical_artifacts_before_after_equal:true,original_current_filesystem_binary_reads:0,loaded_worker_image_proof:'Separate exact owned-process receipt required; offered-pair hashes alone do not prove actual running images'};}
