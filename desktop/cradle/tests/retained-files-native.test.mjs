/** Real Central and native kernel on disposable source/home. Actual source
 * deletion and exclusion drive recovery; no substituted owner responses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listFiles,readFile,lastFileReading} from '../src/files/client.ts';

test('native retained readings survive restart and missing branches but never bypass fresh retrieval exclusion',{skip:process.env.OI_NATIVE_RETAINED_FILES!=='1',timeout:120000},async()=>{
 for(const name of ['OI_KERNEL_BIN','OI_CENTRAL_CTRL_BIN','OI_BIN'])assert.ok(process.env[name],`${name} is required`);
 const scratch=await mkdtemp(join(tmpdir(),'oi-retained-native-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,transport,stderr='';
 const env={...process.env,OI_HOME:home,OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:''};
 const start=async()=>{child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{text+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});transport={kind:'bridge',url};};
 const stop=async()=>{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}};
 try{
  const init=JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000}));assert.equal(init.ok,true,JSON.stringify(init));
  const parent='Work/RetainedProof';await mkdir(join(root,parent),{recursive:true});await writeFile(join(root,parent,'reading.md'),'Native reading retained across a missing source.\n');
  await start();const listed=await listFiles(transport,parent,true);const location=listed.entries.find(row=>row.name==='reading.md').location;const reading=await readFile(transport,location);assert.equal(reading.content,'Native reading retained across a missing source.\n');
  await stop();await rm(join(root,parent),{recursive:true});await start();await assert.rejects(readFile(transport,location));
  const recovered=await lastFileReading(transport,location);assert.equal(recovered.migration_allowed,true);assert.equal(recovered.retained.reading.content,reading.content);assert.equal(recovered.retained.reading.revision,reading.revision);assert.deepEqual(recovered.retained.reading.location,location);assert.equal(recovered.retained.standing,'last-native-reading');for(const operation of ['write','history','restore'])assert.equal(recovered.retained.reading.operations[operation].available,false);
  await mkdir(join(root,parent),{recursive:true});await writeFile(join(root,parent,'.no-agent-retrieval'),'');
  const denied=await lastFileReading(transport,location);assert.equal(denied.retained,null);assert.equal(denied.migration_allowed,false,'fresh exclusion wins even after a previously allowed recovery');
  await rm(join(root,parent,'.no-agent-retrieval'));await writeFile(join(root,parent,'reading.md'),'Current source resumed.\n');const fresh=await readFile(transport,location);assert.equal(fresh.content,'Current source resumed.\n');assert.notEqual(fresh.revision,reading.revision);
  await assert.rejects(readFile(transport,{...location,root:root+'-different'}));const foreign=await lastFileReading(transport,{...location,root:root+'-different'});assert.equal(foreign.retained,null);assert.equal(foreign.migration_allowed,false);
 }finally{await stop();await rm(scratch,{recursive:true,force:true});}
});
