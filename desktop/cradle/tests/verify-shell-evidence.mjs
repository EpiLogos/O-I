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
  assert.deepEqual(receipt.failures??[],[],'original failures must remain a red gate');
  assert.deepEqual(receipt.errors??[],[],'errors cannot be hidden by an empty failures array');
  if(identity) {
    assert.equal(receipt.sourceClean,true,'production and test sources must be committed, not an unrecorded working copy');
    assert.equal(receipt.sourceRevision,identity.sourceRevision,'receipt must name the tested source');
    assert.equal(receipt.driverSha256,identity.driverSha256,'receipt must name the actual driver');
    assert.equal(receipt.runId,identity.runId,'receipt must belong to this run');
  }
}
/** The evidence-grade taxonomy (DESKTOP-LANGUAGE.md ruling 8): A =
 * live/installed/native, B = real-kernel walk-bridge, C = contract/static,
 * D = controlled/fixture. An aggregate of controlled receipts may NOT claim
 * acceptance: passed/accepted require at least one grade-A receipt among the
 * inputs, and the aggregate's own grade is its weakest input. */
export function aggregateVerdict(receipts) {
  const strength={A:0,B:1,C:2,D:3};
  const grades=receipts.map(receipt=>{
    assert.ok(strength[receipt.grade]!==undefined,`receipt ${receipt.name} must carry a grade`);
    return receipt.grade;
  });
  const grade=grades.reduce((weakest,g)=>strength[g]>strength[weakest]?g:weakest,'A');
  const accepted=grades.includes('A');
  return {grade,accepted};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const results=[];
  for(const [name,count,driver] of [['shell-recovery',12,'shell-recovery.browser.mjs'],['shell-setup',36,'shell-setup.browser.mjs'],['visuals-preferences',42,'visuals-preview-lifecycle.mjs']]) {
    const bytes=readFileSync(new URL(`./artifacts/${name}/receipt.json`,import.meta.url));
    validateReceipt(JSON.parse(bytes),count,receiptIdentity(new URL(driver,import.meta.url)));
    // These three inputs are controlled production component and protocol
    // checks — grade D by the taxonomy, whatever they verify.
    results.push({name,count,grade:'D',sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  const {grade,accepted}=aggregateVerdict(results);
  writeFileSync(new URL('./artifacts/shell-evidence.json',import.meta.url),JSON.stringify({sourceRevision:sha,runId:process.env.GITHUB_RUN_ID??null,spec_ref:'docs/cradle/05-EXECUTION.md §3',classification:'controlled production component and protocol checks; not installed/native/live-provider acceptance',grade,accepted,receipts:results},null,2)+'\n');
  console.log(accepted
    ?'All three browser receipts independently verified for this source and run; accepted (grade-A input present).'
    :'All three browser receipts independently verified for this source and run. Controlled evidence only — grade '+grade+', accepted:false; this aggregate is not acceptance.');
}
