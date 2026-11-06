import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
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

// Held (`--held`, O-I #858): the native host's one client answers each line by
// id and, when its host lets go (end of input), drains every answer before it
// exits — however large — and answers what was asked before it ends.
test('held field CLI answers every line by id and drains large answers before exit',()=>{
  const target='unconfigured-'+('x'.repeat(100000));
  const env={...process.env,OI_SHARED_FIELD_TARGET:target};
  delete env.SPACETIMEDB_URI;delete env.SPACETIMEDB_DATABASE;
  const input=[{id:1,request:{kind:'status'}},{id:2,request:{kind:'snapshot'}},{id:3,request:{kind:'observe'}}].map((line)=>JSON.stringify(line)).join('\n')+'\n';
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),['--held'],{env,input,encoding:'utf8',maxBuffer:4*1024*1024,timeout:15000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const lines=result.stdout.trim().split('\n').map((line)=>JSON.parse(line));
  const answers=new Map(lines.filter((line)=>typeof line.id==='number').map((line)=>[line.id,line]));
  assert.deepEqual([...answers.keys()].sort(),[1,2,3],'every request answered once, by its id');
  assert.equal(answers.get(1).ok,true);
  assert.ok(answers.get(1).data.reason.includes(target));
  for(const id of [2,3]){
    assert.equal(answers.get(id).ok,false);
    assert.equal(answers.get(id).error.kind,'unbound','an unbound target is absence, by id');
    assert.ok(answers.get(id).error.message.includes(target));
  }
  assert.ok(lines.some((line)=>line.event==='status'&&line.state==='unbound'),'the held client says where it stands');
  assert.ok(Buffer.byteLength(result.stdout)>3*65536);
});

// Observation is the held client's (O-I #858): its cursor is the transaction, and a one-shot run takes none, so it never
// waits on the field for one, nor names a cursor by hashing a whole snapshot. A one-shot run says so, before the network.
test('a one-shot observe is refused as the held client\'s, without the network',()=>{
  const env={...process.env,OI_SHARED_FIELD_TARGET:'unconfigured-observe'};
  delete env.SPACETIMEDB_URI;delete env.SPACETIMEDB_DATABASE;
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),[],{env,input:JSON.stringify({kind:'observe',cursor:'sha256:00'}),encoding:'utf8',timeout:15000});
  assert.ifError(result.error);
  assert.equal(result.status,1,result.stderr);
  const envelope=JSON.parse(result.stdout);
  assert.equal(envelope.ok,false);
  assert.equal(envelope.error.kind,'refused','refused as the held client\'s, not answered as an unbound target');
  assert.match(envelope.error.message,/--held/);
});

// A field back in view (O-I #858): the held client's cursor moves once when a field that was in view on its connection comes
// back into view after it was out of it — what moved there meanwhile sent nothing, so what the window holds of it is read
// again — and never for a field first brought into view, one still in view, or one let go. The rule the held client keeps
// (field-lib `backInView`), asked through the client's own toolchain, without the network.
test('a field back in view after it was out of it moves the cursor once, and nothing else does',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const cases=[
    // [what was in view on this connection, what is in view now (null: nothing yet), what comes into view, moves]
    [['f'],[],['f'],true,'a field back in view after its glance lapsed'],
    ['whole',[],['f'],true,'a field back in view after the whole field was let go'],
    ['whole',['g'],'whole',true,'the whole field back in view after a narrower view'],
    [['f','g'],['g'],'whole',true,'the whole field back, with a field that was out of view'],
    [[],[],['f'],false,'a field first brought into view'],
    [[],null,['f'],false,'the first view on a connection'],
    [['f'],['f'],['f','g'],false,'a field still in view, beside one first brought in'],
    [['f','g'],['f','g'],['f'],false,'a field let go'],
    ['whole','whole',['f'],false,'narrowing from the whole field'],
    [['f'],['f'],'whole',false,'the whole field first brought into view, nothing seen out of it'],
  ];
  const script=`import {backInView} from './field-lib.ts';const cases=${JSON.stringify(cases)};`+
    `console.log(JSON.stringify(cases.map(([seen,prior,want])=>backInView(seen,prior??undefined,want))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const moved=JSON.parse(result.stdout.trim().split('\n').at(-1));
  cases.forEach(([,, ,moves,what],index)=>assert.equal(moved[index],moves,what));
});

// Contributions to a world (O-I #858, SF07) read none of a field's scoped rows: they are held beside the worlds, so a glance for one of
// their acts brings no field into view and moves no cursor of a field the window does not read. Asked through the client's own toolchain.
test('acts on contributions to a world bring no field into view',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const kinds=['world-contribute','world-contribution-accept','world-contribution-refuse','world-contribution-take-back'];
  const script=`import {requestScope} from './field-lib.ts';console.log(JSON.stringify(${JSON.stringify(kinds)}.map((kind)=>requestScope({kind}))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const scopes=JSON.parse(result.stdout.trim().split('\n').at(-1));
  kinds.forEach((kind,index)=>assert.deepEqual(scopes[index],[],kind));
});
