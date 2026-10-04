import test from 'node:test';
import assert from 'node:assert/strict';
import {readNativePersonalSkyInput} from '../src/nara/nativeSkyInput.ts';

test('personal sky input retains the exact admitted snapshot rather than creating another request', () => {
  const snapshot = {schema:'ql.sky-snapshot/v1',snapshot_ref:'sha256:same-occasion',receipt_unix_ms:17,
    request:{schema:'ql.sky-request/v1',epoch:'2026-09-30T12:00:00Z'},bodies:[{body:'Sun',longitude_degrees:7}]};
  assert.deepEqual(readNativePersonalSkyInput({sky_snapshot:snapshot}),{sky_snapshot:snapshot});
  assert.equal(readNativePersonalSkyInput({sky_snapshot:snapshot}).sky_snapshot,snapshot);
});

test('ambiguous, absent or personal-result inputs cannot masquerade as sky', () => {
  const request = {schema:'ql.sky-request/v1',epoch:'2026-09-30T12:00:00Z'};
  const snapshot = {schema:'ql.sky-snapshot/v1',snapshot_ref:'sha256:same-occasion'};
  for (const value of [{},{sky_request:request,sky_snapshot:snapshot},{sky_snapshot:null},
    {sky_snapshot:{schema:'ql.nara-personal-current/v1',snapshot_ref:'sha256:forged'}},
    {sky_snapshot:{schema:'ql.sky-snapshot/v1'}},{sky_request:[]},{sky_request:null}]) {
    assert.throws(()=>readNativePersonalSkyInput(value));
  }
  assert.deepEqual(readNativePersonalSkyInput({sky_request:request}),{sky_request:request});
});
