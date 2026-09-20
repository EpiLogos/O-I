// Local operator acceptance only. Never run against a person's machine from
// this implementation session. No native source writes, install or dispatch.
// Node 22: --experimental-strip-types --import ./tests/ts-register.mjs
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
import {composeRunExpression,validateRunExpressionInputs} from '../src/contributions/factory/run-expression.ts';
import {existingExpressionSocket} from './factory-run-socket.mjs';
const {values}=parseArgs({options:Object.fromEntries(['factory-bin','state','run','expression','actor','socket','desktop-executable','oi-root','out'].map(key=>[key,{type:'string'}]))});
for(const key of ['factory-bin','state','run','expression','actor','socket','desktop-executable','oi-root','out'])if(!values[key])throw new Error(`Missing --${key}`);
const out=resolve(values.out);await mkdir(out,{recursive:false,mode:0o700});
const packet={schema:'oi.factory-local-receiving/v1',startedAt:new Date().toISOString(),standing:'local-receiving-not-self-inhabitation',machine:{platform:os.platform(),release:os.release(),arch:os.arch(),node:process.version},runRef:values.run,checks:[],receipts:[],failures:[]};
const command=(file,args)=>{
  const result=spawnSync(file,args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  if(result.error)throw result.error;
  return {command:file,args,exit:result.status,stdout:result.stdout,stderr:result.stderr};
};
const success=(result)=>{if(result.exit!==0)throw Object.assign(new Error(result.stderr||result.stdout||`Command failed: ${result.exit}`),{receipt:result});return result.stdout;};
const read=(args)=>{const result=command(values['factory-bin'],args);packet.receipts.push(result);return JSON.parse(success(result));};
const check=(name,condition,detail)=>{packet.checks.push({name,passed:!!condition,detail});if(!condition)throw new Error(`Acceptance failed: ${name}`);};
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
try{
  check('native Mac operator occasion',process.platform==='darwin',process.platform);
  packet.source={head:success(command('git',['-C',values['oi-root'],'rev-parse','HEAD'])).trim(),worktree:success(command('git',['-C',values['oi-root'],'status','--porcelain=v1']))};
  packet.executables={factory:{path:await realpath(values['factory-bin']),sha256:await hash(values['factory-bin'])},desktop:{path:await realpath(values['desktop-executable']),sha256:await hash(values['desktop-executable'])}};
  // Bind this socket to the actual running executable, not a claimed app name
  // or a browser global. No process is killed or relaunched by this packet.
  const pidText=success(command('lsof',['-t','-a','-U',values.socket])).trim();
  const pids=[...new Set(pidText.split(/\s+/).filter(Boolean))];check('one existing socket owner',pids.length===1,pids);
  const executable=success(command('ps',['-p',pids[0],'-o','comm='])).trim();
  packet.socketOwner={pid:pids[0],executable};
  check('socket owner is the specified desktop executable',await realpath(executable)===packet.executables.desktop.path,executable);
  const run=read(['development','run',values.state,values.run,'--json']);
  const units=read(['development','workflow-units',values.state,values.run,'--json']);
  let attempt;const attemptCommand=command(values['factory-bin'],['attempt','read',values.state,values.run,'--json']);packet.receipts.push(attemptCommand);
  if(attemptCommand.exit===0)attempt=JSON.parse(attemptCommand.stdout);
  else if(!(attemptCommand.stderr||attemptCommand.stdout).includes('no native attempt field'))success(attemptCommand);
  const after=read(['development','run',values.state,values.run,'--json']);assert.deepEqual(run,after,'Run changed during local read');
  const inputs={run,units,attempt,statePath:values.state};validateRunExpressionInputs(inputs,values.run);
  const document=composeRunExpression(inputs,values.expression);
  await writeFile(resolve(out,'native-readings.json'),JSON.stringify(inputs,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(resolve(out,'expression.json'),JSON.stringify(document,null,2)+'\n',{flag:'wx',mode:0o600});
  const opened=await existingExpressionSocket(values.socket,{operation:'open',document,actor:values.actor});packet.receipts.push({operation:'open',result:opened});
  check('native open accepted this document',opened.ok===true&&opened.outcome?.result==='expression'&&opened.outcome.data?.state==='ready',opened);
  const inspected=await existingExpressionSocket(values.socket,{operation:'inspect',expression_ref:values.expression});packet.receipts.push({operation:'inspect',result:inspected});
  check('native inspect returns the same document',inspected.ok===true&&inspected.outcome?.data?.state==='ready',inspected);
  assert.deepEqual(inspected.outcome.data.document,opened.outcome.data.document);
  const root=inspected.outcome.data.document.entities[`${values.expression}:entity:run`];
  check('same native Run and owner',root?.subject?.subject_ref===values.run&&root.subject.native_owner==='software-factory',root?.subject);
  // Retain genuine owner correlations; these are NOT an independent provider
  // replay and do not turn a queued attempt into execution or self-repair.
  packet.attempts=(attempt?.attempts??[]).map(item=>({attemptRef:item.attemptRef,executionRef:item.executionRef,participant:item.disposition?.participant,body:item.disposition?.body,placement:item.disposition?.placement,tracking:item.tracking,dispatch:item.dispatch,observations:item.observations,verifications:item.verifications,readableReturn:item.readableReturn}));
  packet.outcome='receiving-pass';packet.independentProviderReplay='not-performed';packet.selfInhabitation=false;
}catch(error){packet.outcome='failed';packet.failures.push({message:error instanceof Error?error.message:String(error),receipt:error?.receipt});process.exitCode=1;}
finally{packet.finishedAt=new Date().toISOString();await writeFile(resolve(out,'receipt.json'),JSON.stringify(packet,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({outcome:packet.outcome,receipt:resolve(out,'receipt.json'),standing:packet.standing}));}
