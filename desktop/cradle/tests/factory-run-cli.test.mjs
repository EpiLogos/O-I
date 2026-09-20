// Controlled executable, never the native Factory binary or a production fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readings} from './factory-run-fixture.mjs';
async function run(t,mode){const directory=await mkdtemp(join(tmpdir(),'factory-cli-'));t.after(()=>rm(directory,{recursive:true,force:true}));const bin=join(directory,'controlled-owner');const data=readings();data.attempt.attempts[0].readableReturn.summary='A multiline\nReturn';await writeFile(bin,`#!${process.execPath}\nconst input=${JSON.stringify(data)};const mode=${JSON.stringify(mode)};const args=process.argv.slice(2);if(args[0]==='attempt'&&mode!=='normal'){console.error(mode==='absent'?'Run has no native attempt field':'native authority denied');process.exit(2);}console.log(JSON.stringify(args[0]==='attempt'?input.attempt:args[1]==='run'?input.run:input.units));\n`,{mode:0o700});return spawnSync(process.execPath,['walk/factory-run-expression.mjs',bin,'/controlled/owner-state.json','run:repair'],{encoding:'utf8',timeout:10000});}
test('CLI acceptance uses the real production module and all of its imports',async t=>{const result=await run(t,'normal');assert.equal(result.status,0,result.stderr);const receipt=JSON.parse(result.stdout);assert.ok(receipt.checks.every(check=>check.ok));assert.equal(receipt.standing,'native-cli-projection-only');});
test('CLI acceptance permits only explicit native attempt absence',async t=>{const result=await run(t,'absent');assert.equal(result.status,0,result.stderr);assert.match(JSON.parse(result.stdout).attemptsSkipped,/no native attempt field/);});
test('denied native CLI attempt is not accepted as an empty topology',async t=>{const result=await run(t,'denied');assert.notEqual(result.status,0);assert.match(result.stderr,/native authority denied/);});
