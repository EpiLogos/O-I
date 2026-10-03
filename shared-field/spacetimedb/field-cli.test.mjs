import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtempSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Exercise the actual CLI over a pipe, including the loader and its process
// exit. A large real unknown-target response reproduces the snapshot failure
// without requiring a network service or manufacturing owner replies.
for(const kind of ['status','snapshot'])test(`field CLI drains a large ${kind} envelope before exit`,()=>{
  const target='unconfigured-'+('x'.repeat(100000));
  const env={...process.env,OI_SHARED_FIELD_TARGET:target};
  delete env.SPACETIMEDB_URI;delete env.SPACETIMEDB_DATABASE;
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),[],{env,input:JSON.stringify({kind}),encoding:'utf8',maxBuffer:1024*1024,timeout:15000});
  assert.ifError(result.error);
  assert.equal(result.status,kind==='status'?0:1,result.stderr);
  assert.ok(Buffer.byteLength(result.stdout)>65536);
  const envelope=JSON.parse(result.stdout);
  assert.equal(envelope.ok,kind==='status');
  assert.ok((envelope.data?.reason??envelope.error.message).includes(target));
});

const requestBudget = 16 * 1024 * 1024;
function requestBytes(kind, bytes) {
  const prefix = `{"kind":"${kind}","target":"hosted","padding":"`;
  const suffix = '"}';
  return prefix + 'x'.repeat(bytes - Buffer.byteLength(prefix + suffix)) + suffix;
}

for (const [bytes, accepted] of [[requestBudget, true], [requestBudget + 1, false]]) {
  test(`actual CLI ${accepted ? 'accepts the exact' : 'rejects over the'} native input budget before binding effects`, () => {
    const stateHome = mkdtempSync(join(tmpdir(), 'oi-field-input-'));
    try {
      const env = {...process.env, OI_STATE_HOME: stateHome, OI_SHARED_FIELD_TARGET: 'unconfigured-input-acceptance'};
      delete env.SPACETIMEDB_URI; delete env.SPACETIMEDB_DATABASE;
      // The oversized operation would write an actual binding if dispatched.
      // The boundary case uses a real read and never opens a network client.
      const result = spawnSync(fileURLToPath(new URL('./field.sh', import.meta.url)), [], {
        env, input: requestBytes(accepted ? 'status' : 'bind', bytes), encoding: 'utf8',
        maxBuffer: 1024 * 1024, timeout: 15000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, accepted ? 0 : 1, result.stderr);
      const envelope = JSON.parse(result.stdout);
      assert.equal(envelope.ok, accepted);
      if (!accepted) {
        assert.equal(envelope.error.kind, 'malformed');
        assert.match(envelope.error.message, /16 MiB native request budget/);
      }
      assert.deepEqual(readdirSync(stateHome), [], 'No binding or credential effect preceded input admission');
    } finally {rmSync(stateHome, {recursive: true, force: true});}
  });
}
