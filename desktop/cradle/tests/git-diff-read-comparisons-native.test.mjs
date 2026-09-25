/** Real Central GitState owner, real Git repository; no transport replacement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readComparisons,diffFileKey,hunkPatch,patchLines,chooseDiffLayout,readDiffLayout} from '../src/git/diffModel.ts';

// Native: runs only when a candidate ctrl, Central root and disposable scratch
// are supplied (as the other *-native tests are gated); never against owner ground.
const nativeReady=!!(process.env.OI_TEST_CTRL_BIN&&process.env.OI_TEST_CENTRAL_ROOT&&process.env.OI_TEST_SCRATCH);
test('Central separates committed and dirty rows and preserves copyable native hunks', {skip:nativeReady?false:'Set OI_TEST_CTRL_BIN, OI_TEST_CENTRAL_ROOT and OI_TEST_SCRATCH to run against a candidate ctrl'}, async()=>{
 const {OI_TEST_CTRL_BIN,OI_TEST_CENTRAL_ROOT,OI_TEST_SCRATCH}=process.env;
 assert.ok(OI_TEST_CTRL_BIN&&OI_TEST_CENTRAL_ROOT&&OI_TEST_SCRATCH,'Set candidate ctrl, Central root and admitted disposable scratch paths');
 const root=mkdtempSync(join(OI_TEST_SCRATCH,'git-diff-'));
 const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'});
 const nativeCalls=[];
 const read=async(from,to)=>{
  nativeCalls.push([from,to]);
  const output=execFileSync(OI_TEST_CTRL_BIN,['--root',OI_TEST_CENTRAL_ROOT,'--json','action','run','central.git.diff',JSON.stringify({repo_root:root,from,to,max_bytes:65536,max_files:200,ignore_whitespace:false})],{encoding:'utf8',timeout:30000});
  const result=JSON.parse(output);assert.equal(result.ok,true,output);return result.data;
 };
 try{
  git('init','-q');git('config','user.name','Diff native proof');git('config','user.email','proof@example.invalid');
  const initial=Array.from({length:40},(_,i)=>`line ${i+1}`);
  writeFileSync(join(root,'shared.txt'),initial.join('\n')+'\n');
  writeFileSync(join(root,'committed.txt'),'before\n');
  writeFileSync(join(root,'dirty.txt'),'before\n');
  git('add','.');git('commit','-qm','basis');const basis=git('rev-parse','HEAD').trim();
  const committed=[...initial];committed[0]='committed first line';
  writeFileSync(join(root,'shared.txt'),committed.join('\n')+'\n');
  writeFileSync(join(root,'committed.txt'),'after\n');git('add','.');git('commit','-qm','committed change');
  const head=git('rev-parse','HEAD').trim();
  const dirty=[...committed];dirty[9]='dirty tenth line';dirty[29]='dirty thirtieth line';
  writeFileSync(join(root,'shared.txt'),dirty.join('\n')+'\n');
  writeFileSync(join(root,'dirty.txt'),'after\n');writeFileSync(join(root,'untracked.txt'),'actual new file\n');
  const groups=await readComparisons({repo_root:root,from:basis,to:'working-tree'},read);
  assert.deepEqual(nativeCalls,[['HEAD','working-tree'],[basis,head]]);
  assert.deepEqual(groups.map(g=>[g.kind,g.reading.files.length]),[['committed',2],['working',3]]);
  assert.equal(groups[0].reading.to,groups[1].reading.from);
  const rows=groups.flatMap(g=>g.reading.files.map(f=>({key:diffFileKey(g.kind,f.new_path),file:f})));
  assert.equal(new Set(rows.map(r=>r.key)).size,5);
  const shared=groups[1].reading.files.find(f=>f.new_path==='shared.txt');
  assert.equal(shared.patch,git('diff','--no-ext-diff','--no-textconv','--no-color','--find-renames',head,'--','shared.txt'));
  assert.deepEqual(patchLines(shared.patch).filter(l=>l.kind==='add').map(l=>[l.next,l.text]),[[10,'dirty tenth line'],[30,'dirty thirtieth line']]);
  assert.equal(patchLines(shared.patch).filter(l=>l.kind==='hunk').length,2);
  for(const index of [0,1]){
   const patch=hunkPatch(shared.patch,index);assert.equal(patchLines(patch).filter(l=>l.kind==='hunk').length,1);
   execFileSync('git',['-C',root,'apply','--reverse','--check','-'],{input:patch,encoding:'utf8'});
  }
  assert.equal(hunkPatch(shared.patch,-1),'');assert.equal(hunkPatch(shared.patch,2),'');
  nativeCalls.length=0;
  assert.deepEqual((await readComparisons({repo_root:root,from:'HEAD',to:'working-tree'},read)).map(g=>g.kind),['working']);
  assert.deepEqual(nativeCalls,[['HEAD','working-tree']]);
  nativeCalls.length=0;
  assert.deepEqual((await readComparisons({repo_root:root,from:basis,to:head},read)).map(g=>g.kind),['committed']);
  assert.deepEqual(nativeCalls,[[basis,head]]);
  chooseDiffLayout('split');assert.equal(readDiffLayout(),'split');chooseDiffLayout('auto');
  console.log(JSON.stringify({nativeCalls:4,committed:2,uncommitted:3,distinctRows:5,independentlyApplicableHunks:2,basis,head}));
 }finally{rmSync(root,{recursive:true,force:true});}
});
