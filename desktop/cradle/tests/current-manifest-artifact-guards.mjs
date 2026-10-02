/** Execute only after an actual hosted installer/build and expectation exists.
 * Every mutation starts from that real immutable manifest; no fake positive. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashFileReadOnly,qualifiedJson,qualifyPortableNativeSourceExpectation} from './epi-world-portable-custody.mjs';
assert.equal(process.argv.length,4,'Supply the actual before-native expectation JSON and a new output receipt path');
const input=resolve(process.argv[2]),output=resolve(process.argv[3]),e=JSON.parse(readFileSync(input,'utf8'));
const manifest=qualifiedJson(e.current_custody.manifest_ref,'Actual current manifest');
const options={originalWorldFile:e.original_world_ref.path,currentCut:e.owner_cut};
const positive=qualifyPortableNativeSourceExpectation(e,options),checks=['Actual source-built current custody qualifies before the independent mutations'];
const temp=mkdtempSync(resolve(tmpdir(),'epi-current-manifest-negative-'));let count=0;
const mutate=(name,change)=>{const altered=structuredClone(manifest);change(altered);const path=resolve(temp,'manifest-'+count+'.json');writeFileSync(path,JSON.stringify(altered,null,2)+'\n');const test=structuredClone(e);test.current_custody.manifest_ref={path,...hashFileReadOnly(path)};assert.throws(()=>qualifyPortableNativeSourceExpectation(test,options),undefined,name);checks.push(name);count++;};
try{
 mutate('Name rustc with argv true refuses',m=>m.toolchain.find(x=>x.name==='rustc').argv=['true']);
 const truePath=realpathSync('/usr/bin/true');mutate('A real unrelated executable with borrowed rustc output refuses',m=>{const row=m.toolchain.find(x=>x.name==='rustc');row.executable_ref={path:truePath,...hashFileReadOnly(truePath)};row.argv=[truePath,'--version'];});
 mutate('Version argv substitution refuses',m=>m.toolchain.find(x=>x.name==='cargo').argv[1]='--help');
 mutate('Actual tool executable byte count mutation refuses',m=>m.toolchain.find(x=>x.name==='cc').executable_ref.bytes++);
 mutate('A version command outside the recorded operation cwd refuses',m=>m.toolchain.find(x=>x.name==='uv').cwd='/tmp');
 mutate('Rustup selection of a different tool refuses',m=>m.toolchain_resolution.find(x=>x.name==='rustc').argv[2]='cargo');
 mutate('A qualified but unconsumed compiler refuses',m=>m.installer.environment.CXX=m.installer.environment.CC);
 mutate('An output directory outside the actual CARGO_TARGET_DIR refuses',m=>m.installer.output_root='/tmp/independent-preexisting-bins');
 mutate('An independently chosen companion path refuses',m=>m.all_five[0].path='/tmp/independent-preexisting-ql');
 mutate('An asserted preexisting output tree refuses',m=>m.installer.output_directory_was_absent=false);
 const preflight=qualifiedJson(manifest.installer.prebuild_output_ref,'Actual prebuild observation');
 for(const [name,change] of [['Actual target-exists observation refuses',p=>p.target_exists=true],['An already present companion observation refuses',p=>p.outputs[0].exists=true],['A different prebuild source cut refuses',p=>p.source_cut='0'.repeat(40)]]){
  const changed=structuredClone(preflight);change(changed);const path=resolve(temp,'preflight-'+count+'.json');writeFileSync(path,JSON.stringify(changed,null,2)+'\n');mutate(name,m=>m.installer.prebuild_output_ref={path,...hashFileReadOnly(path)});
 }
 assert.deepEqual(hashFileReadOnly(e.current_custody.manifest_ref.path),{bytes:e.current_custody.manifest_ref.bytes,sha256:e.current_custody.manifest_ref.sha256},'Actual immutable current manifest preserved after all mutations');
 writeFileSync(output,JSON.stringify({schema:'epi.portable-current-manifest-artifact-guards/v3',passed:true,checks,negative_count:count,actual_expectation:{path:input,...hashFileReadOnly(input)},actual_current_manifest:e.current_custody.manifest_ref,current_source_cut:positive.current.source_cut,verifier:{path:fileURLToPath(import.meta.url),...hashFileReadOnly(fileURLToPath(import.meta.url))},native_or_browser_execution:false,installed_acceptance:false,H:false},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({passed:true,checks:checks.length,negative_count:count}));
}finally{rmSync(temp,{recursive:true,force:true});}
