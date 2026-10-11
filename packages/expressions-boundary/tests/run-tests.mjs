/** Load production TypeScript with its existing compiler and give each test
 * process its own real WebStorage file. No browser/store implementation is
 * replaced, and parallel files cannot erase another test's storage. */
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const directory=fileURLToPath(new URL('.',import.meta.url));
const owned=mkdtempSync(join(tmpdir(),'oi-expressions-boundary-tests-'));
let failures=0;
for(const file of readdirSync(directory).filter(file=>file.endsWith('.test.mjs')).sort()) {
  const result=spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${join(owned,file+'.storage')}`,
    '--import',fileURLToPath(new URL('./register-production-sources.mjs',import.meta.url)),
    '--test',join(directory,file)],{stdio:'inherit',timeout:60000});
  if(result.error){console.error(`${file}: ${result.error.message}`);failures++}
  else if(result.status!==0)failures++;
}
if(failures){console.error(`${failures} test files failed; owned temporary storage retained at ${owned}`);process.exitCode=1}
else rmSync(owned,{recursive:true,force:true});
