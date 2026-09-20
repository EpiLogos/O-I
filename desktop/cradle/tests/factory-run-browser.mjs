// Controlled browser acceptance of the actual React receiver and production
// bridge/client. Test specimens never enter the production bundle.
import assert from 'node:assert/strict';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
import {readings} from './factory-run-fixture.mjs';
const artifacts=resolve('tests/artifacts/factory-run');await mkdir(artifacts,{recursive:true});
const entry=resolve(artifacts,'browser-entry.jsx');
await writeFile(entry,`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {FactoryRunReceiver} from '/src/contributions/factory/FactoryRunReceiver.tsx';
import {RunExpressionBody} from '/src/contributions/factory/RunExpressionBody.tsx';
import {composeRunExpression} from '/src/contributions/factory/run-expression.ts';
import {readings} from '/tests/factory-run-fixture.mjs';
const root=createRoot(document.getElementById('root'));
window.opened=[];window.receipts=[];
window.renderNative=()=>root.render(<FactoryRunReceiver transport={window.transport??=( {kind:'bridge',url:location.origin} )} statePath='/controlled/owner-state.json' runRef='run:repair' expressionRef='expression:browser-factory' actor='actor:controlled-test' project={null} onOpenRef={ref=>window.opened.push(ref)} onPresentNative={doc=>window.presented=doc.expression_ref} admitAction={async()=>({contract:'controlled-input/v1',projectionRef:'test:one'})} onActionReceipt={(runRef,receipt)=>window.receipts.push({runRef,receipt})}/>);
window.renderPortable=()=>{const data=readings();root.render(<RunExpressionBody binding={{binding_ref:'test:portable',component_ref:'oi.presentation/factory-run/v1',props:{...data,document:composeRunExpression(data,'expression:portable'),onNativeAction:()=>window.stolen=true},fallback:{},provenance:[]}} presentationRef='test:portable' hosting='preview'/>)};
window.renderNative();
`);
let mode='normal';let document;const calls=[];
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',plugins:[react(),{name:'controlled-factory-owner',configureServer(server){
  server.middlewares.use('/op',async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);const op=JSON.parse(Buffer.concat(chunks));calls.push(op);
    const input=readings();if(mode==='stale')input.attempt.sourceCurrent=false;
    let data;let result;let error;
    if(op.op==='factory_development_read'){result='factory_development_reading';data=op.read==='run'?input.run:input.units;if(mode==='missing-reader'&&op.read==='run')error='essential Run reader disconnected';}
    else if(op.op==='factory_attempt_read'){result='factory_attempt_reading';data=input.attempt;if(mode==='attempt-less')error='Run has no native attempt field';}
    else if(op.op==='expression'){
      result='expression';if(op.request.operation==='open'){document=op.request.document;if(mode==='missing-open')error='native Expression open handler disconnected';}
      data=op.request.operation==='invoke'?{state:'action_result',action_ref:op.request.action_ref,target_ref:'run:repair',dispatch:{state:'owner_refused',detail:'controlled native denial'}}:{state:'ready',document};
    }else error='unsupported controlled operation';
    res.setHeader('content-type','application/json');res.end(JSON.stringify(error?{ok:false,error}:{ok:true,outcome:{result,data,receipts:[]}}));
  });
  server.middlewares.use('/factory-run-test',async(_req,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/factory-run-test','<!doctype html><html><head><meta charset="utf-8"><title>Factory receiving contract</title></head><body><div id="root"></div><script type="module" src="/tests/artifacts/factory-run/browser-entry.jsx"></script></body></html>'));});
}}],server:{host:'127.0.0.1',port:0,strictPort:false}});
await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/factory-run-test`;
const results=[];
try{
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await engine.launch({headless:true});
    try{
      const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      const load=async(newMode)=>{mode=newMode;document=undefined;calls.length=0;await page.goto(url);};
      await load('normal');await page.locator('[data-node-kind="future_native_kind"]').waitFor();
      assert.equal(await page.locator('[data-return-ref]').count(),2);
      assert.equal(await page.locator('[data-action-ref="action:inspect"]').isDisabled(),true);
      const artifact=page.locator('[data-native-ref="artifact:patch"]').first();await artifact.click();
      assert.equal(await page.locator('[data-selected-native-ref]').textContent(),'artifact:patch');
      assert.equal(await artifact.evaluate(el=>document.activeElement===el),true,'native-reference selection retains keyboard focus');
      await page.getByRole('button',{name:'Open with native owner'}).click();assert.deepEqual(await page.evaluate(()=>window.opened),['artifact:patch']);
      await page.getByRole('button',{name:'Open in native Expression'}).click();await page.locator('[data-native-expression-ready]').waitFor();
      assert.equal(await page.evaluate(()=>window.presented),'expression:browser-factory');
      await page.locator('[data-action-ref="action:inspect"]').click();await page.getByText('Native action result — not proof of completed work',{exact:true}).waitFor();
      assert.equal(await page.locator('[data-action-ref="action:inspect"]').isDisabled(),true);
      assert.equal(calls.filter(c=>c.request?.operation==='invoke').length,1);
      assert.equal(await page.evaluate(()=>window.receipts[0].receipt.receipt.dispatch.state),'owner_refused');
      await page.screenshot({path:resolve(artifacts,`${name}-native-refusal.png`),fullPage:true});
      await load('attempt-less');await page.locator('[data-attempt-availability="missing"]').waitFor();assert.equal(await page.locator('[data-attempt-ref]').count(),0);
      await load('missing-reader');await page.getByRole('alert').filter({hasText:'essential Run reader disconnected'}).waitFor();assert.equal(await page.locator('[data-run-expression="run:repair"]').count(),0);
      await load('missing-open');await page.locator('[data-node-kind="work"]').waitFor();await page.getByRole('button',{name:'Open in native Expression'}).click();await page.getByRole('alert').filter({hasText:'open handler disconnected'}).waitFor();assert.equal(await page.locator('[data-native-expression-ready]').count(),0);
      await load('stale');await page.locator('[data-source-current="false"]').waitFor();await page.getByRole('button',{name:'Open in native Expression'}).click();await page.locator('[data-native-expression-ready]').waitFor();assert.equal(await page.locator('[data-action-ref="action:inspect"]').isDisabled(),true);
      await page.evaluate(()=>window.renderPortable());await page.locator('[data-actions-unavailable]').waitFor();assert.equal(await page.locator('[data-action-ref="action:inspect"]').isDisabled(),true);assert.equal(await page.evaluate(()=>window.stolen===true),false);
      assert.deepEqual(errors,[]);results.push({browser:name,passed:true,standing:'controlled-browser-receiver-only'});
    }finally{await browser.close();}
  }
}finally{await server.close();await unlink(entry).catch(()=>{});await writeFile(resolve(artifacts,'browser.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results));
