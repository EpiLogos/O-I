#!/usr/bin/env node
/** Explicit local acceptance; never installs, configures, launches or kills an
 * owner, rewrites a workspace, uses a fixture, or retries a submitted prompt.
 * A provider turn and native keyboard interaction each require separate consent.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {platform,arch,release,totalmem} from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(binary,args,cwd=root)=>execFileSync(binary,args,{cwd,encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
export function options(args){
 const out={command:args[0]??'facts'};
 assert.ok(['facts','provider','mac'].includes(out.command),'Choose facts, provider or mac');
 const flags=new Set(['consent-test-turn','consent-native-keys']);
 const values=new Set(['out','binary','project','session','provider','app','timeout']);
 for(let i=1;i<args.length;i++){
  const key=args[i].replace(/^--/,'');assert.ok(args[i].startsWith('--')&&(flags.has(key)||values.has(key)),`Unknown option: ${args[i]}`);
  assert.equal(out[key],undefined,`Duplicate option: ${key}`);
  if(flags.has(key))out[key]=true;
  else {assert.ok(args[i+1]&&!args[i+1].startsWith('--'),`Missing ${key}`);out[key]=args[++i];}
 }
 return out;
}
export function checkProviderBasis(status,view,expected){
 assert.ok(expected&&!/fixture|mock|fake|stub/i.test(expected),'Name the actual configured provider, not a controlled fixture');
 assert.equal(status.provider?.id,expected,'The resident owner must name the requested provider');
 assert.equal(status.resident,true,'An already resident, dedicated test session is required');
 assert.ok(status.native_session_id,'The owner must disclose the existing native session ID');
 assert.ok(!status.error,'The native connection must not be in error');
 assert.equal(view.draft?.text,'','Refusing to overwrite somebody’s shared draft');
 assert.ok(Number.isInteger(view.draft.revision),'The native draft needs a CAS revision');
 assert.ok(!view.permissions?.length,'Resolve pending permissions yourself before the test');
 assert.ok(view.actions?.some(a=>a.ref==='aikit.encounter.prompt'&&a.enabled),'The owner must permit a prompt now');
 assert.ok(!view.actions?.some(a=>a.ref==='aikit.encounter.cancel'&&a.enabled),'Do not interrupt an active turn');
}
export async function providerTurn(o,call,record,pause=ms=>new Promise(r=>setTimeout(r,ms))){
 assert.equal(o['consent-test-turn'],true,'Sending one billable test turn requires --consent-test-turn');
 assert.ok(o.session&&o.provider,'Supply --session and --provider for a dedicated, already connected test session');
 const timeout=Number(o.timeout??90);assert.ok(Number.isFinite(timeout)&&timeout>=5&&timeout<=180,'Timeout must be 5–180 seconds');
 const request=(action,fields={})=>call({action,agent_session:o.session,...fields});
 const status=await request('status'),view=await request('view');checkProviderBasis(status,view,o.provider);
 const nonce='OI_SHELL_'+randomBytes(12).toString('hex');
 record.provider={id:o.provider,nativeSession:status.native_session_id,nonce,submitted:false,observed:false};
 const draft=await request('draft',{basis:view.draft.revision,text:`Reply with exactly ${nonce}. Do not use any tools.`});
 assert.ok(Number.isInteger(draft.revision),'Native draft CAS must return its revision');
 // Record intent BEFORE transport: a failure here is uncertain, never a retry.
 record.provider.submitted='uncertain';
 await request('prompt',{draft_revision:draft.revision});record.provider.submitted=true;
 const deadline=Date.now()+timeout*1000;
 while(Date.now()<deadline){
  const current=await request('view');
  assert.ok(!current.permissions?.length,'Test asked for no tools; a permission request is not automatically approved');
  if(current.blocks?.some(b=>b.kind==='assistant'&&b.text.trim()===nonce)){
   const after=await request('status');assert.equal(after.native_session_id,status.native_session_id,'One unchanged resident session');
   assert.equal(after.provider?.id,o.provider);record.provider.observed=true;return;
  }
  await pause(500);
 }
 throw Error('No exact nonce response before the deadline. Turn state is uncertain; inspect the owner. No resend, cancel or replay was attempted.');
}
export async function main(args=process.argv.slice(2)){
 const o=options(args);const out=resolve(o.out??`walk/artifacts/local-shell-${Date.now()}.json`);
 const record={schema:'oi.w1-local-acceptance/v1',at:new Date().toISOString(),command:o.command,passed:false,
  classification:'local owner-executed check; no installed/observed claim until each explicit check succeeds',
  facts:{os:platform(),release:release(),architecture:arch(),memoryBytes:totalmem(),node:process.version,
   source:run('git',['rev-parse','HEAD']),dirty:run('git',['status','--porcelain','--untracked-files=no'])!=='' ,
   packageLock:sha(readFileSync(resolve(root,'package-lock.json'))),tauriConfig:sha(readFileSync(resolve(root,'src-tauri/tauri.conf.json')))}};
 try{
  if(o.command==='provider'){
   assert.ok(o.binary&&o.project,'Supply explicit --binary and --project; nothing is guessed or installed');
   const binary=realpathSync(o.binary),project=realpathSync(o.project);
   record.facts.nativeBinary={path:binary,sha256:sha(readFileSync(binary))};
   await providerTurn(o,async request=>{
    const reply=JSON.parse(run(binary,['-C',project,'encounter','--request-json',JSON.stringify(request)],project));
    assert.equal(reply.ok,true,`Native ${request.action} refused; inspect its own receipt`);return reply.data;
   },record);
  }else if(o.command==='mac'){
   assert.equal(platform(),'darwin','Native Mac interaction requires macOS, not Linux WebKit');
   assert.equal(o['consent-native-keys'],true,'Use --consent-native-keys only with an idle test window');
   assert.ok(o.app,'Supply the already installed candidate’s --app path');
   const app=realpathSync(o.app),plist=resolve(app,'Contents/Info.plist');
   const id=run('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw',plist]);assert.equal(id,'org.epilogos.oi.cradle');
   const executable=run('/usr/bin/plutil',['-extract','CFBundleExecutable','raw',plist]);assert.ok(executable&&!executable.includes('/'));
   record.facts.app={path:app,bundleId:id,binarySha256:sha(readFileSync(resolve(app,'Contents/MacOS',executable)))};
   record.nativeInteraction=run('/usr/bin/osascript',[resolve(here,'native-shell.applescript'),id,app]);
   assert.equal(record.nativeInteraction,'SETTINGS_RETURN_OBSERVED');
  }
  record.passed=true;
 }catch(error){record.error=String(error.message??error);process.exitCode=1;}
 finally{mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(out);}
 return record;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
