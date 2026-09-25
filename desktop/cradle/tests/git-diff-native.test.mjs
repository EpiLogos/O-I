/** Production patch projection exercised with Git's actual output. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchLines,splitLines} from '../src/git/diffModel.ts';
test('actual Git hunks preserve line numbers and aligned replacement rows at scale',()=>{
 const root=mkdtempSync(join(tmpdir(),'oi-diff-'));
 const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'});
 try{
 git('init','-q');git('config','user.name','Diff proof');git('config','user.email','proof@example.invalid');
 writeFileSync(join(root,'code.txt'),'a\nb\nc\n');git('add','code.txt');git('commit','-qm','basis');
 writeFileSync(join(root,'code.txt'),'a\nreplacement\nnew\nc\n');
 const lines=patchLines(git('diff','--no-color'));
 assert.deepEqual(lines.filter(l=>l.kind==='delete').map(l=>[l.old,l.text]),[[2,'b']]);
 assert.deepEqual(lines.filter(l=>l.kind==='add').map(l=>[l.next,l.text]),[[2,'replacement'],[3,'new']]);
 const split=splitLines(lines);assert.ok(split.some(row=>row.left?.text==='b'&&row.right?.text==='replacement'));
 assert.ok(split.some(row=>!row.left&&row.right?.text==='new'));
 writeFileSync(join(root,'code.txt'),Array.from({length:5000},(_,i)=>`actual line ${i}`).join('\n')+'\n');
 const patch=git('diff','--no-color'),start=performance.now();const large=splitLines(patchLines(patch));
 assert.equal(large.filter(row=>row.right?.kind==='add').length,5000);
 assert.ok(performance.now()-start<50,'bounded projection of 5000 lines must not occupy a long UI frame');
 }finally{rmSync(root,{recursive:true,force:true});}
});
