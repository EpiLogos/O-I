// A real disposable kernel account read over freshly authored native AIKit
// material, followed by the production account renderer. No fake transport,
// account, response, facet or replacement React context is supplied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {register} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultReadingText} from './default-reading-text.mjs';

register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
const accountSource=process.env.VERSO_ACCOUNT_SOURCE?pathToFileURL(process.env.VERSO_ACCOUNT_SOURCE).href:new URL('../src/expression/versoAccount.ts',import.meta.url).href;
const viewSource=process.env.VERSO_VIEW_SOURCE?pathToFileURL(process.env.VERSO_VIEW_SOURCE).href:new URL('../src/expression/ExpressionVerso.tsx',import.meta.url).href;
const {readVersoAccount}=await import(accountSource);
const {ExpressionVerso}=await import(viewSource);
const {knowledge}=await import('../src/knowledge/client.ts');
const {kernelOp}=await import('../src/kernel/bridge.ts');
const {wikiDocument}=await import('../src/knowledge/wikiDocument.ts');
const {listFiles,readFile}=await import('../src/files/client.ts');
const scratch=process.env.OI_NATIVE_TEST_DIRECTORY??fileURLToPath(new URL('../../../target/native-presentation-tests/',import.meta.url));
await mkdir(scratch,{recursive:true});
const directory=await mkdtemp(join(scratch,'verso-account-'));
await mkdir(join(directory,'Control/user'),{recursive:true});
await mkdir(join(directory,'Work'),{recursive:true});
const source='source:verso-readable-page';
const content='---\ntitle: Shared account guide\n---\n# Shared account guide\n\n**Native meaning** remains attached to its source.\n\n| Action | Result |\n| --- | --- |\n| Open | Full owner page |\n\n```json\n{"subject":"world:keep:authored-code"}\n```\n\n'+Array.from({length:90},(_,index)=>`## Continuation ${index+1}\n\nRetained native paragraph ${index+1} remains complete in the owner source.\n\n`).join('');
assert.ok(content.length>4000,'The native source exceeds the prior account byte truncation');
await writeFile(join(directory,'Control/user/account-guide.md'),content);
await writeFile(join(directory,'source-material.json'),JSON.stringify([{binding:{source,revision:'r1',title:'Shared account guide',tags:[],visibility:'public',owners:[],media_type:'text/markdown',locator:{kind:'path',value:'/world/verso-guide.md'},metadata:{}},body:content}]));
// Preserve the existing user home for the installed suite's executable
// registry; all account/source/state roots remain the explicit isolated world.
const nativeEnv={PATH:process.env.PATH,...(process.env.HOME?{HOME:process.env.HOME}:{}),CENTRAL_ROOT:directory,AIKIT_HOME:join(directory,'aikit-home'),OI_HOME:join(directory,'oi-home')};
const binary=process.env.OI_WALK_BRIDGE??fileURLToPath(new URL('../kernel/target/debug/walk-bridge',import.meta.url));
const bridge=spawn(binary,['127.0.0.1:0'],{cwd:directory,env:nativeEnv,stdio:['ignore','pipe','pipe']});
let logs='';bridge.stderr.on('data',chunk=>{logs+=String(chunk);});
test.after(async()=>{
  if(bridge.exitCode===null){const stopped=once(bridge,'exit');bridge.kill('SIGTERM');await stopped;}
  await rm(directory,{recursive:true,force:true});
});
const endpoint=await new Promise((resolve,reject)=>{
  let output='';const timeout=setTimeout(()=>{bridge.kill('SIGTERM');reject(new Error(`Native walk bridge did not start: ${logs}`));},10000);
  bridge.stdout.on('data',chunk=>{output+=String(chunk);const address=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(address){clearTimeout(timeout);resolve(address);}});
  bridge.once('error',error=>{clearTimeout(timeout);reject(error);});
  bridge.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Native walk bridge exited ${code}: ${logs}`));});
});
const transport={kind:'bridge',url:endpoint};

test('real native source account preserves the complete owner facet and renders its canonical formatted preview',async()=>{
  const owner=await knowledge(transport,undefined,{action:'read',address:{kind:'source',value:source}},{fresh:true});
  assert.equal(owner.resource,source);assert.equal(owner.content,content);assert.ok(owner.document,'The actual AIKit owner supplies a native Markdown facet');
  const account=await readVersoAccount(transport,{ref:source,title:'Shared account guide'});
  assert.ok(account.page,`The production account must use the native source address: ${account.notices.join('; ')}`);
  assert.equal(account.page.resource,owner.resource);assert.equal(account.page.revision,owner.revision);
  assert.equal(account.page.content,owner.content,'The account must retain all original bytes rather than an owner-labelled substring');
  assert.deepEqual(account.page.document,owner.document,'The actual native facet is retained unchanged');
  assert.deepEqual(account.page.evidence,owner.evidence);assert.equal(account.page.provider,owner.provider);assert.equal(account.page.authority,owner.authority);
  assert.ok(wikiDocument(account.page),'The native facet still validates against the exact full owner bytes and revision');
  const html=renderToStaticMarkup(createElement(ExpressionVerso,{account:{state:'ready',account},onOpenPage:()=>{}}));
  const text=defaultReadingText(html);
  assert.ok(/<h1\b[^>]*>[\s\S]*?Shared account guide[\s\S]*?<\/h1>/.test(html),'The native heading renders as a heading');
  assert.ok(/<strong\b[^>]*>[\s\S]*?Native meaning[\s\S]*?<\/strong>/.test(html),'The native emphasis retains its format');
  assert.ok(html.includes('<table>'),'The native table retains its format');assert.ok(/<pre[^>]*><code>/.test(html),'The native code retains its format');assert.match(text,/world:keep:authored-code/,'Authored technical code remains readable');
  assert.match(text,/Formatted page preview/);assert.doesNotMatch(text,/Retained native paragraph 90/,'The display is explicitly bounded, independently of owner content');
  assert.ok(html.includes('Retained native paragraph 90'),'Exact full owner content is retained in closed source inspection');
  assert.match(html,/data-page-ref="source:verso-readable-page"/,'The full-page action retains the original native target');
  assert.doesNotMatch(text,/source:verso-readable-page|Revision r1/,'Ordinary preview and announced names keep provenance in deliberate depth');
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
  console.log('PASS fresh AIKit source -> real kernel -> production readVersoAccount -> complete native bytes/facet -> production formatted account preview and original onward target. Installed interaction remains separate.');
});

test('real native Expression account-only verso keeps its native entity and scene names without changing its source',async()=>{
  const native=async request=>{
    const reply=await kernelOp(transport,{op:'expression',request});
    assert.equal(reply.error,undefined);assert.equal(reply.outcome?.result,'expression');
    assert.equal(reply.outcome.data.state,'ready');return reply.outcome.data.document;
  };
  const ref='expression:verso-readable-native',actor='human:verso-readable-native-check';
  let document=await native({operation:'create',expression_ref:ref,title:'Shared native account',actor});
  const entity=`${ref}:entity:guide`;
  document=await native({operation:'edit',expression_ref:ref,expected_revision:document.revision,actor,changes:[
    {change:'entity_add',scene_ref:document.scenes[0].scene_ref,entity_ref:entity,title:'Shared account guide'},
    {change:'subject_bind',entity_ref:entity,binding:{subject_ref:source,native_owner:'central',presentation_role:'thing',sources:[{ref:source,revision:'r1',availability:'available'}],readings:[],actions:[]}},
  ]});
  const account=await readVersoAccount(transport,{ref,title:document.title,sceneRef:document.selection.scene_ref,revision:document.revision});
  assert.deepEqual(account.document,document,'The actual account reads the native saved composition');
  const html=renderToStaticMarkup(createElement(ExpressionVerso,{account:{state:'ready',account}})),text=defaultReadingText(html);
  assert.match(text,/Shared native account/);assert.match(text,/Shared account guide/);assert.ok(text.includes(document.scenes[0].title));
  for(const identity of [ref,source,entity,document.selection.scene_ref])assert.ok(!text.includes(identity),'Native account identity remains in deliberate depth');
  assert.ok(html.includes(`data-subject-ref="${source}"`),'The bound native source remains structured on its actual subject');
  assert.deepEqual(await native({operation:'inspect',expression_ref:ref}),document,'Reading and rendering the account does not edit its native document');
});

test('real native file account preserves every owner byte and location while disclosing a truthful preview and source action',async()=>{
  const directoryReading=await listFiles(transport,'Control/user',true);
  const entry=directoryReading.entries.find(item=>item.name==='account-guide.md');
  assert.ok(entry,'The actual native directory owner supplies the source location');
  assert.equal(entry.retrieval_allowed,true);
  const owner=await readFile(transport,entry.location);
  assert.equal(owner.content,content);
  const account=await readVersoAccount(transport,{ref:source,title:'Shared account guide',sourceLocation:entry.location});
  assert.ok(account.sourceFile,`The native file read must resolve: ${account.notices.join('; ')}`);
  assert.equal(account.sourceFile.content.length,owner.content.length,'The source account retains all owner characters instead of truncating at 4,000');
  assert.deepEqual(account.sourceFile,owner,'The account preserves the actual complete native file reading, including its exact content, revision and location');
  const html=renderToStaticMarkup(createElement(ExpressionVerso,{account:{state:'ready',account},onOpenSourceRef:()=>{}}));
  const fileRegion=html.match(/<section\b[^>]*data-region="source-file"[\s\S]*?<\/section>/)?.[0];
  assert.ok(fileRegion);const text=defaultReadingText(fileRegion);
  assert.match(text,/Source file preview/,'A display budget is disclosed as a preview');
  assert.doesNotMatch(text,/Retained native paragraph 90/,'The default preview is bounded');
  assert.ok(fileRegion.includes('Retained native paragraph 90'),'All original owner bytes remain available in closed full-source depth');
  assert.ok(fileRegion.includes(`data-source-ref="${owner.location.ref}"`),'The native source action keeps its exact owner target');
  assert.ok(!text.includes(owner.location.ref)&&!text.includes(owner.revision),'Native file identities are available in deliberate depth');
  assert.doesNotMatch(fileRegion,/<details[^>]*\sopen(?:[\s=>])/);
  assert.deepEqual(await readFile(transport,entry.location),owner,'Reading and rendering the account leave native file content and revision unchanged');
  console.log('PASS real Central directory -> exact owner location -> native file read -> complete account bytes/revision/location -> explicit source preview, full source depth and exact original source action. Installed interaction remains separate.');
});
