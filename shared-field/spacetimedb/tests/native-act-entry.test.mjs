import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {nativeActEntryUpdateFailure} from '../src/native-act-entry.ts';

// Actual caller-visible publications around the native producer repair.
// These are retained source readings; no producer, reducer or owner is mocked.
const {before,after,basis}=JSON.parse(readFileSync(new URL('./receipts/native-act-publication-revisions.json',import.meta.url),'utf8'));

test('the real native Act publication advances its independent owner revision',()=>{
  assert.equal(basis.kind,'actual-authorised-native-Act-publications');
  assert.equal(before.revision,'16');assert.equal(after.revision,'29');
  assert.equal(nativeActEntryUpdateFailure(before,after),null);
  assert.equal(nativeActEntryUpdateFailure(null,after),null);
  assert.match(nativeActEntryUpdateFailure(after,before),/cannot go backwards/);
});

test('same owner revision is idempotent only for identical material',()=>{
  assert.equal(nativeActEntryUpdateFailure(after,structuredClone(after)),null);
  assert.equal(nativeActEntryUpdateFailure(after,Object.fromEntries(Object.entries(after).reverse())),null);
  const changed=structuredClone(after);changed.summary+=' different';
  assert.match(nativeActEntryUpdateFailure(after,changed),/same owner revision/);
});

test('a known native Act cannot drop or replace its owner identity',()=>{
  for(const key of ['native_owner','native_activity_ref','source_world_ref','source_ref']){
    const changed=structuredClone(after);delete changed.meta[key];
    assert.match(nativeActEntryUpdateFailure(after,changed),/qualified owner identity/);
  }
  const changed=structuredClone(after);changed.kind='curated-artifact';
  assert.match(nativeActEntryUpdateFailure(after,changed),/qualified owner identity/);
});

test('document, publication and native Act revisions cannot be substituted',()=>{
  for(const field of ['owner_revision','source_revision']){
    const changed=structuredClone(after);changed.meta[field]=field==='owner_revision'?16:'16';
    assert.match(nativeActEntryUpdateFailure(after,changed),/independent owner revision/);
  }
  const changed=structuredClone(after);changed.meta.state='held';
  assert.match(nativeActEntryUpdateFailure(after,changed),/owner phase/);
});

test('another native owner continues through its own entry contract',()=>{
  assert.equal(nativeActEntryUpdateFailure(null,{kind:'activity',ref:'world:factory/run:one',revision:'3',meta:{native_owner:'factory',run_ref:'run:one'}}),null);
});
