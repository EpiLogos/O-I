/** Build only from frozen authored/source predictions and actual build custody.
 * Native response fields cannot enter this interface. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {assembleExpectation,hashFileReadOnly,qualifyPortableNativeSourceExpectation} from './epi-world-portable-custody.mjs';
const keys=['--template','--fixture-root','--current-manifest','--output'],args=process.argv.slice(2),seen=new Set(),options={};
assert.equal(args.length,8,'Exactly four explicit source inputs/output arguments');
for(let i=0;i<args.length;i+=2){assert.ok(keys.includes(args[i])&&!seen.has(args[i]),'Unknown or duplicate builder argument');assert.ok(args[i+1]&&!args[i+1].startsWith('--'));seen.add(args[i]);options[args[i]]=resolve(args[i+1]);}
assert.equal(seen.size,4);assert.equal(existsSync(options['--output']),false,'An expectation is immutable; never overwrite an earlier qualification');
const ref=path=>({path,...hashFileReadOnly(path)}),expectation=assembleExpectation(ref(options['--template']),options['--fixture-root'],ref(options['--current-manifest']));
const qualification=qualifyPortableNativeSourceExpectation(expectation,{originalWorldFile:expectation.original_world_ref.path,currentCut:expectation.owner_cut});
writeFileSync(options['--output'],JSON.stringify(expectation,null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(dirname(options['--output']),'expectation-before-native-custody.json'),JSON.stringify(qualification,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({schema:'epi.portable-expectation-builder-result/v3',expectation:ref(options['--output']),source_cut:expectation.owner_cut,current_and_historical_custody_qualified_before_any_native_request:true,native_or_browser_execution:false}));
