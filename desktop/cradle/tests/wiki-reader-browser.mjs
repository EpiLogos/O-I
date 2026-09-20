import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const corpus=JSON.parse(readFileSync(resolve(root,'tests/fixtures/wiki-native.json'),'utf8'));
const out=resolve(root,'tests/artifacts/wiki');mkdirSync(out,{recursive:true});
const receipt={scope:'production KnowledgeSurface and WikiReader, real CLI-produced corpus, controlled kernel transport',native:corpus.receipt,checks:[],browsers:[],passed:false};
const check=(value,label)=>{assert.ok(value,label);receipt.checks.push(label);};
const server=await createServer({root,configFile:false,plugins:[react()],resolve:{alias:{three:resolve(root,'node_modules/three')}},define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:1446,strictPort:true,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});
await server.listen();
function graph(input){
 const native=corpus.graph;
 return {schema:'oi.cradle.graph-reading/v1',nodes:input==='aikit_resolution'?native.nodes.map(node=>({ref:node.resource,...node,native_owner:'ai-kit',actions:[],provenance:{source:'aikit.knowledge.graph',revision:node.revision}})):[],edges:input==='aikit_resolution'?native.edges.map(edge=>({...edge,from_ref:edge.from,to_ref:edge.to,provenance:{source:'aikit.knowledge.graph',revision:edge.origin?.revision}})):[],formations:native.formations,truncated:native.truncated,inputs:Object.fromEntries(['central_wiki','aikit_resolution','shared_field'].map(name=>[name,{state:name===input?'available':'deferred',owner_operation:name,detail:'Controlled native input'}])),counts:{spaces:0,wiki_nodes:0,knowledge_rows:native.nodes.length,nodes:native.nodes.length,edges:native.edges.length}};
}
const engines=process.env.WIKI_WEBKIT==='1'?{chromium,webkit}:{chromium};
try{
 for(const [name,engine] of Object.entries(engines)){
  const browser=await engine.launch({headless:true,...(name==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{})});
  receipt.browsers.push({name,version:browser.version()});
  const page=await browser.newPage({viewport:{width:1150,height:820},reducedMotion:'reduce'});page.setDefaultTimeout(10000);
  const calls=[],errors=[],remote=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/example.invalid/**',async route=>{remote.push(route.request().url());await route.abort();});
  await page.route('**/__wiki_fixture/**',async route=>{
   if(route.request().method()!=='POST')return route.fulfill({json:{ok:true,receipts:[]}});
   const op=route.request().postDataJSON();calls.push(op);
   if(op.op==='knowledge'){
    const data=op.request.action==='read'?corpus[op.request.address.value]:corpus.relations;
    return route.fulfill({json:data?{ok:true,outcome:{result:'knowledge',data}}:{ok:false,error:'Knowledge is unavailable'}});
   }
   if(op.op==='graph')return route.fulfill({json:{ok:true,outcome:{result:'graph_reading',reading:graph(op.options?.input)}}});
   if(op.op==='expression')return route.fulfill({json:{ok:false,error:'No composition commissioned by this reader proof'}});
   return route.fulfill({json:{ok:true,outcome:{result:'state',snapshot:{focus:{},surfaces:{},buffers:{}},receipts:[]}}});
  });
  try{
   await page.goto('http://127.0.0.1:1446/tests/wiki-reader.html');
   await page.locator('.wiki-prose h1').waitFor();
   check(await page.locator('.wiki-prose h1').innerText()==='Alpha',`${name}: native Markdown heading, not raw text`);
   check(await page.locator('.wiki-prose strong').innerText()==='Bold',`${name}: strong text rendered`);
   check(await page.locator('.wiki-table td').count()===2,`${name}: native table body rendered`);
   check(await page.locator('.wiki-prose input[type=checkbox]').count()===2,`${name}: native task items rendered`);
   check(await page.evaluate(()=>window.__injected===undefined),`${name}: raw source HTML does not execute`);
   check(remote.length===0,`${name}: remote image does not disclose a reader visit without an explicit request`);
   check(await page.getByRole('link',{name:'Missing ?'}).count()===1,`${name}: unresolved link stays visible`);
   await page.getByRole('link',{name:'Same ?'}).click();
   await page.getByText('This link has several native candidates; disambiguate the source link.').waitFor();
   await page.screenshot({path:resolve(out,`${name}-reader.png`)});
   await page.getByRole('link',{name:'the next note',exact:true}).click();
   await page.locator('.wiki-prose h1').filter({hasText:'Part'}).waitFor();
   check(await page.locator('.wiki-backlinks button').count()===2,`${name}: two source occurrences yield two exact backlinks`);
   await page.getByRole('button',{name:'Back to prior page'}).click();
   await page.locator('.wiki-prose h1').filter({hasText:'Alpha'}).waitFor();
   await page.getByRole('link',{name:'again',exact:true}).click();
   await page.locator('.wiki-prose h1').filter({hasText:'Part'}).waitFor();
   check(await page.locator('[data-wiki-anchor="wiki-block-claim"]').count()===1,`${name}: block target bound to native selector`);
   await page.locator('.wiki-backlinks button').first().click();
   await page.locator('.wiki-prose h1').filter({hasText:'Alpha'}).waitFor();
   check(await page.getByRole('status').filter({hasText:'no longer present'}).count()===0,`${name}: backlink opens the recorded byte occurrence`);
   // Select rendered text naturally; the Context event carries the exact native
   // revision and a revalidation observation, never fabricated UTF-16 offsets.
   await page.locator('.wiki-prose strong').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
   await page.getByRole('button',{name:'Add to Context',exact:true}).click();
   const candidate=await page.evaluate(()=>window.__WIKI_TEST__.context.at(-1));
   check(candidate.sourceRef==='source:a'&&candidate.revision==='r1'&&candidate.text==='Bold'&&candidate.observationKey&&candidate.documentId,`${name}: selection enters existing Context with source/revision and live observation`);
   const before=calls.filter(op=>op.op==='knowledge'&&op.request.action==='read').length;
   await page.getByRole('button',{name:'Refresh knowledge'}).click();
   await page.waitForFunction(()=>document.querySelector('.wiki-prose h1')?.textContent==='Alpha');
   await page.waitForTimeout(70);
   check(calls.slice().some(op=>op.op==='knowledge'&&op.fresh===true),`${name}: explicit refresh bypasses retained owner reading`);
   check(calls.filter(op=>op.op==='knowledge'&&op.request.action==='read').length>before,`${name}: refresh actually calls the owner`);
   await page.getByRole('button',{name:'Graph corpus',exact:true}).click();
   await page.getByText('Filter graph',{exact:true}).click();
   await page.getByLabel('Filter graph subjects').fill('Opening');
   await page.getByText(/1 matches/).waitFor();
   const graphCalls=calls.filter(op=>op.op==='graph');
   check(graphCalls.length===2&&graphCalls.every(op=>op.options.input!=='shared_field'),`${name}: local graph uses independent native inputs without remote dependency`);
   await page.getByLabel('Saved graph view name').fill('Opening view');
   await page.getByRole('button',{name:'Save view',exact:true}).click();
   await page.getByRole('button',{name:'Clear filters',exact:true}).click();
   await page.getByRole('button',{name:'Opening view',exact:true}).click();
   check(await page.getByLabel('Filter graph subjects').inputValue()==='Opening',`${name}: saved graph view restores filters`);
   check(calls.filter(op=>op.op==='graph').length===graphCalls.length,`${name}: display filtering does not reread native sources`);
   await page.screenshot({path:resolve(out,`${name}-graph.png`)});
   await page.reload();
   await page.getByRole('button',{name:'Graph corpus',exact:true}).click();
   await page.getByText(/Filter graph/).first().click();
   check(await page.getByLabel('Filter graph subjects').inputValue()==='Opening',`${name}: existing workspace travel persists graph preferences`);
   check(errors.length===0,`${name}: no uncaught browser error: ${errors.join('; ')}`);
  }catch(error){receipt.failure={name,message:String(error),errors,lastCalls:calls.slice(-5)};await page.screenshot({path:resolve(out,`${name}-failure.png`)});throw error;}
  finally{await browser.close();}
 }
 receipt.passed=true;console.log(JSON.stringify({passed:true,checks:receipt.checks.length,browsers:receipt.browsers}));
}finally{writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await server.close();}
