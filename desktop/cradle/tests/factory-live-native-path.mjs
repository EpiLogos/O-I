/** Production LiveProducer against the real Kernel/ActStore. Controlled native
 * observations supply protocol inputs; this is no Factory worker/Run proof.
 * Network faults cut an actual HTTP connection, never fabricate owner replies. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';

export async function acceptNativeLiveProducer({LiveProducer, world, call, endpoint, initial, report, signal}) {
 const actor='agent:controlled-native-live-recovery';
 const sourceRef='act:controlled-native-live-input';
 await world({operation:'act_open',act_ref:sourceRef,expression_ref:initial.expression_ref,mode:'expressions',actor});
 for(let index=0;index<481;index++) await world({operation:'act_operate',act_ref:sourceRef,actor,
  operation_kind:'controlled-input-observation',native_ref:`native:controlled-input:${index}`,summary:`controlled-input-${index}`});
 const source=async()=> (await world({operation:'act_inspect',act_ref:sourceRef})).act;
 const input=await source();
 assert.equal(input.sequence.length,481);
 const history=async()=> {const act=await source();return {contract:'oi.factory-telemetry-watch/v1',
  cursor:{stateRevision:act.revision},lines:[...new Map(act.sequence.map(p=>[p.native_ref,
   {type:'execution-correlation',runRef:sourceRef,correlationRef:p.native_ref,telemetryRef:p.summary}])).values()]};};
 const proofs=[];
 for(const fault of ['before-commit','after-commit','fresh-body']) {
  const expressionRef=`expression:controlled-native-live-${fault}`;
  const document=JSON.parse(JSON.stringify(initial).split(initial.expression_ref).join(expressionRef));
  await call('expression',{operation:'open',document,actor});
  const config={runRef:sourceRef,actRef:`act:controlled-native-live-${fault}`,expressionRef,actor,context:{}};
  let server,closed,loopEndpoint,cut=true,chunks=0;
  const proxyAbort=new AbortController();
  const transportSignal=()=>AbortSignal.any([signal,proxyAbort.signal,AbortSignal.timeout(20000)]);
  const forwarded=[];
  const start=async()=> {
   server=createServer(async(req,res)=> {
    try {
     const chunksIn=[];let bytes=0;
     for await(const chunk of req){bytes+=chunk.length;assert.ok(bytes<=1024*1024);chunksIn.push(chunk);}
     const body=Buffer.concat(chunksIn),packet=JSON.parse(body);
     const catchUp=packet.request.operation==='act_operate'&&packet.request.operation_kind==='live.catch-up';
     const cutNow=cut&&catchUp&&++chunks===2;
     if(cutNow&&fault!=='after-commit') {cut=false;res.destroy();server.closeAllConnections();server.close();return;}
     const upstream=await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body,signal:transportSignal()});
     const actual=await upstream.text();forwarded.push(packet.request);
     if(cutNow){assert.equal(JSON.parse(actual).outcome.data.state,'act_operated');cut=false;res.destroy();server.closeAllConnections();server.close();return;}
     res.writeHead(upstream.status,{'content-type':'application/json'});res.end(actual);
    }catch(error){if(!res.destroyed){res.writeHead(500);res.end(JSON.stringify({error:String(error)}));}}
   });
   closed=new Promise(resolve=>server.once('close',resolve));
   await new Promise((resolve,reject)=> {const timer=setTimeout(()=>reject(new Error('Native fault transport startup exceeded5s')),5000);
    server.once('error',error=>{clearTimeout(timer);reject(error);});server.listen(0,'127.0.0.1',()=>{clearTimeout(timer);resolve();});});
   loopEndpoint=`http://127.0.0.1:${server.address().port}`;
  };
  const transport=async request=> {
   const response=await fetch(`${loopEndpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({op:'expression_world',request}),signal:transportSignal()});
   const packet=await response.json();if(packet.ok!==true)throw new Error(packet.error??'Actual native request failed');
   return packet.outcome.data;
  };
  const io={world:transport,readAttempts:source,watch:history,readJournal:async()=>{throw new Error('This controlled native input has no agent journal');}};
  let producer;
  try {
   await start();producer=new LiveProducer(io,config);await producer.open();
   const before=structuredClone(producer.state.cursor);
   await assert.rejects(()=>producer.pass());await closed;
   assert.deepEqual(producer.state.cursor,before,'Uncertain catch-up cannot consume any raw source cursor');
   const partial=(await world({operation:'act_inspect',act_ref:config.actRef})).act;
   assert.equal(partial.sequence.length,fault==='after-commit'?2:1,'Actual native skip receipts survive a physically lost response');
   assert.ok(partial.sequence.every(p=>p.operation==='live.catch-up'));
   assert.ok(!forwarded.some(r=>r.operation==='act_text'),'No earlier text becomes live during failed catch-up');
   await start();
   if(fault==='fresh-body'){producer.stop();producer=new LiveProducer(io,config);await producer.open();}
   await producer.pass();
   const recovered=(await world({operation:'act_inspect',act_ref:config.actRef})).act;
   assert.equal(recovered.sequence.filter(p=>p.kind==='text').length,40,'Partial receipts never expand the intended bounded live tail');
   assert.ok(recovered.sequence.filter(p=>p.operation==='live.catch-up').length>=2);
   const retained=JSON.stringify(recovered.sequence);
   await producer.pass();
   assert.equal(JSON.stringify((await world({operation:'act_inspect',act_ref:config.actRef})).act.sequence),retained,'Repeated source readings produce no duplicate passages');
   // End this actual Act and reopen: retained requests must qualify against
   // the earlier chain owner, not a newly empty successor.
   await world({operation:'act_complete',act_ref:config.actRef,actor,expected_act_revision:recovered.revision});
   producer.stop();producer=new LiveProducer(io,config);await producer.open();await producer.pass();
   assert.equal(producer.state.act.act_ref,config.actRef+':2');
   assert.equal(producer.state.act.sequence.length,0);
   const first=recovered.sequence.find(p=>p.kind==='text');
   const revision=producer.state.act.revision,cursor=structuredClone(producer.state.cursor),sent=forwarded.length;
   await world({operation:'act_operate',act_ref:sourceRef,actor,operation_kind:'controlled-input-observation',
    native_ref:first.event_basis.event_ref,summary:'controlled changed native source bytes'});
   await assert.rejects(()=>producer.pass(),/different native request material/);
   assert.deepEqual(producer.state.cursor,cursor,'Changed retained source cannot consume the new source revision');
   assert.equal(producer.state.act.revision,revision);
   assert.ok(forwarded.slice(sent).every(r=>['act_inspect','act_list','material_list'].includes(r.operation)),'Changed retained source is qualified before any new mutation');
   proofs.push({fault,native_partial_passages:partial.sequence.length,retained_texts:40,earlier_chain_qualified:true,changed_source_refused:true});
   // Restore this input through its actual native owner for the next case.
   await world({operation:'act_operate',act_ref:sourceRef,actor,operation_kind:'controlled-input-observation',
    native_ref:first.event_basis.event_ref,summary:input.sequence.find(p=>p.native_ref===first.event_basis.event_ref).summary});
  }finally {
   producer?.stop();proxyAbort.abort(new Error('Owned fault transport is retiring'));
   if(server){server.closeAllConnections();server.close();}
   if(closed){let timer;try{await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned fault transport cleanup exceeded3s')),3000);})]);}finally{clearTimeout(timer);}}
  }
 }
 report.live_producer={standing:'Production state machine and real native Kernel/ActStore over481 actual controlled native observations adapted as protocol input; no Factory telemetry ancestry, model, tool effect, original Run or installed claim',input_act:sourceRef,input_revision:input.revision,proofs};
 report.checks.push('Actual LiveProducer: before/after-commit network loss, native skipped custody, bounded continuation, fresh body, prior chain exact qualification and changed native source refusal');
}
