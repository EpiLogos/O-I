/** CLI intent boundaries only; never a real speech/provider acceptance claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const flags=['--experimental-strip-types','--import','./tests/ts-register.mjs','tests/nara-local-acceptance.mjs'];
function rejected(args,message){
 const root=mkdtempSync(join(tmpdir(),'nara-episode-'));
 try{
  const out=join(root,'private');
  const run=spawnSync(process.execPath,[...flags,'--bridge','http://127.0.0.1:1','--source','test-source:never-read','--out',out,...args],{cwd,encoding:'utf8',timeout:10000});
  assert.equal(run.error,undefined);
  assert.notEqual(run.status,0);
  assert.match(run.stderr,message);
  assert.equal(existsSync(out),false,'invalid intent must be refused before source/network/output effects');
 }finally{rmSync(root,{recursive:true,force:true});}
}
for(const extra of [['--allow-provider'],['--audio-file','absent.wav'],['--play-output'],['--reconnect']]){
 test(`read-only recovery refuses ${extra[0]} before effects`,()=>rejected(['--recover','delivery:original',...extra],/Recovery is read-only/));
}
test('saved audio requires explicit new-provider-turn consent',()=>rejected(['--audio-file','absent.wav'],/Audio input requires explicit/));
test('playback requires explicit selected audio and provider consent',()=>rejected(['--play-output'],/Playback requires an explicitly permitted new audio turn/));
test('reconnect is a separate explicit episode, never implicitly followed by inference',()=>rejected(['--reconnect','--allow-provider'],/Run reconnect separately/));
test('help names boundaries without loading a native attachment',()=>{
 const run=spawnSync(process.execPath,[...flags,'--help'],{cwd,encoding:'utf8',timeout:10000});
 assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/no fixtures/);assert.match(run.stdout,/Recovery and reconnect are separate/);
});
