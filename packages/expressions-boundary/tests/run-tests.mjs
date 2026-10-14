/** Load production TypeScript with its existing compiler and give each test
 * process its own real WebStorage file. No browser/store implementation is
 * replaced, and parallel files cannot erase another test's storage. */
import {existsSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const directory=fileURLToPath(new URL('.',import.meta.url));
const owned=mkdtempSync(join(tmpdir(),'oi-expressions-boundary-tests-'));
let failures=0;
// Suites that replay archived readings of the owner's actual World (recovery
// reads, kernel acknowledgements). That material is the owner's and stays off
// this public repository: the suite runs where it is present and is skipped,
// by name and reason, everywhere else (CI included).
const OWNER_EVIDENCE='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/';
const OWNER_EVIDENCE_SUITES={
  'native-adoption-history.test.mjs':['glyph-ui-timing-ack-20261008.json'],
  'native-recovery-basis.test.mjs':['native-recovery-checkpoint-read-20261008.json','native-recovery-draft-read-20261008.json'],
  'native-recovery-scene-integration.test.mjs':['native-recovery-checkpoint-read-20261008.json','native-recovery-draft-read-20261008.json'],
  'recovery-library-retention.test.mjs':['native-recovery-conflict-reading-2026-10-08.json'],
};
for(const file of readdirSync(directory).filter(file=>file.endsWith('.test.mjs')).sort()) {
  const absent=(OWNER_EVIDENCE_SUITES[file]??[]).filter(name=>!existsSync(OWNER_EVIDENCE+name));
  if(absent.length){console.log(`skip ${file} — owner World evidence absent on this machine (${absent.join(', ')})`);continue}
  const result=spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${join(owned,file+'.storage')}`,
    '--import',fileURLToPath(new URL('./register-production-sources.mjs',import.meta.url)),
    '--test',join(directory,file)],{stdio:'inherit',timeout:60000});
  if(result.error){console.error(`${file}: ${result.error.message}`);failures++}
  else if(result.status!==0)failures++;
}
if(failures){console.error(`${failures} test files failed; owned temporary storage retained at ${owned}`);process.exitCode=1}
else rmSync(owned,{recursive:true,force:true});
