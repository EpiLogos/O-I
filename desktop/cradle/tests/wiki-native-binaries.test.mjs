import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const helper=resolve(dirname(fileURLToPath(import.meta.url)),'wiki-native-binaries.py');
function fixture(mode){
 const root=mkdtempSync(join(tmpdir(),'wiki-binary-contract-'));
 const bin=join(root,'bin'),target=join(root,'non-default-target');mkdirSync(bin);mkdirSync(target);
 for(const name of ['oi','aikit','ctrl','walk-bridge']){writeFileSync(join(target,name),'#!/bin/sh\nexit 0\n');chmodSync(join(target,name),0o700);}
 const cargo=join(bin,'cargo');
 writeFileSync(cargo,`#!/usr/bin/env python3
import json,os,sys
name=sys.argv[sys.argv.index('--bin')+1]
path=os.path.join(os.environ['TEST_TARGET'],name)
mode=os.environ['TEST_MODE']
if mode=='missing': path+='-absent'
record={'reason':'compiler-artifact','target':{'name':name},'profile':{'test':False},'executable':path}
print(json.dumps(record))
if mode=='ambiguous':
 record['executable']+='-other';print(json.dumps(record))
`);chmodSync(cargo,0o700);
 const output=join(root,'environment');writeFileSync(output,'');
 const result=spawnSync('python3',[helper],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,TEST_TARGET:target,TEST_MODE:mode,GITHUB_ENV:output}});
 return {root,target,result,output};
}

test('native walk uses exact compiler artifact paths even with a different target directory',()=>{
 const run=fixture('valid');
 try{
  assert.equal(run.result.status,0,run.result.stderr);
  const output=readFileSync(run.output,'utf8');
  assert.ok(output.includes(`WIKI_KERNEL_BIN=${join(run.target,'walk-bridge')}`));
  assert.ok(output.includes(`OI_BIN=${join(run.target,'oi')}`));
  assert.equal(output.trim().split('\n').length,4);
 }finally{rmSync(run.root,{recursive:true,force:true});}
});

test('missing native executable aborts before exporting a misleading runtime',()=>{
 const run=fixture('missing');
 try{assert.notEqual(run.result.status,0);assert.match(run.result.stderr,/not callable/);assert.equal(readFileSync(run.output,'utf8'),'');}
 finally{rmSync(run.root,{recursive:true,force:true});}
});

test('ambiguous compiler artifacts cannot silently select a different binary',()=>{
 const run=fixture('ambiguous');
 try{assert.notEqual(run.result.status,0);assert.match(run.result.stderr,/Expected one built executable/);assert.equal(readFileSync(run.output,'utf8'),'');}
 finally{rmSync(run.root,{recursive:true,force:true});}
});
