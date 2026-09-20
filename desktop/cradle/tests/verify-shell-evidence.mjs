/** Evidence is an input to the gate, not decoration. Reject incomplete, stale
 * or contradictory receipts even when the surrounding process returned zero. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function receiptIdentity(driver) {
  const root=fileURLToPath(new URL('../',driver));
  let sourceClean=true;
  try {execFileSync('git',['diff','--quiet','HEAD','--','src','tests','../../packages/oi-design-system'],{cwd:root});}
  catch {sourceClean=false;}
  return {sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    driverSha256:createHash('sha256').update(readFileSync(fileURLToPath(driver))).digest('hex'),
    runId:process.env.GITHUB_RUN_ID??null,sourceClean};
}
export function validateReceipt(receipt, expectedCount, identity) {
  assert.equal(receipt.passed,true,'receipt itself must pass');
  assert.equal(receipt.checks?.length,expectedCount,'every declared case must execute');
  assert.deepEqual(receipt.failures??receipt.errors??[],[],'original failures must remain a red gate');
  if(identity) {
    assert.equal(receipt.sourceClean,true,'production and test sources must be committed, not an unrecorded working copy');
    assert.equal(receipt.sourceRevision,identity.sourceRevision,'receipt must name the tested source');
    assert.equal(receipt.driverSha256,identity.driverSha256,'receipt must name the actual driver');
    assert.equal(receipt.runId,identity.runId,'receipt must belong to this run');
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const results=[];
  for(const [name,count,driver] of [['shell-recovery',12,'shell-recovery.browser.mjs'],['shell-setup',36,'shell-setup.browser.mjs'],['visuals-preferences',22,'visuals-preview-lifecycle.mjs']]) {
    const bytes=readFileSync(new URL(`./artifacts/${name}/receipt.json`,import.meta.url));
    validateReceipt(JSON.parse(bytes),count,receiptIdentity(new URL(driver,import.meta.url)));
    results.push({name,count,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  writeFileSync(new URL('./artifacts/shell-evidence.json',import.meta.url),JSON.stringify({sourceRevision:sha,runId:process.env.GITHUB_RUN_ID??null,classification:'controlled production component and protocol checks; not installed/native/live-provider acceptance',passed:true,receipts:results},null,2)+'\n');
  console.log('All three browser receipts independently verified for this source and run.');
}
