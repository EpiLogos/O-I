/** Real filesystem-backed Web Storage in a disposable test-owned directory. */
import {mkdtemp, rm} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const tests = path.dirname(fileURLToPath(import.meta.url))
const temporary = await mkdtemp(path.join(tests,'continuity-storage-'))
try {
  const run = spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${path.join(temporary,'storage.sqlite')}`,
    '--experimental-strip-types','--import',path.resolve(tests,'../../../../desktop/cradle/tests/ts-register.mjs'),
    '--test',path.join(tests,'continuity-storage.test.mjs')],{stdio:'inherit'})
  process.exitCode = run.status ?? 1
  if (run.status === 0) {
    const restart = spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${path.join(temporary,'storage.sqlite')}`,
      '--experimental-strip-types','--import',path.resolve(tests,'../../../../desktop/cradle/tests/ts-register.mjs'),
      path.join(tests,'continuity-restart.mjs')],{stdio:'inherit'})
    process.exitCode = restart.status ?? 1
  }
} finally {await rm(temporary,{recursive:true,force:true})}
