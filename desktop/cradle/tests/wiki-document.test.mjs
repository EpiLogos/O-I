import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wikiDocument,sourceSlice,resolveWikiAnchor,safeExternalLink} from '../src/knowledge/wikiDocument.ts';
import {progressiveGraph,emptyGraph,joinGraphInputs} from '../src/knowledge/graphProgress.ts';
import {readLocalWhole,projectProvidedLocalWhole} from '../src/knowledge/expressionProjection.ts';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/wiki-native.json',import.meta.url),'utf8'));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('native parser, reader, graph and backlinks share occurrence identities, not matching labels',()=>{
 const a=wikiDocument(corpus['source:a']),b=wikiDocument(corpus['source:b']);
 assert.equal(a.syntax.tags.includes('research'),true);
 for(const occurrence of a.occurrences.filter(o=>o.state==='resolved')){
  const edge=corpus.graph.edges.find(edge=>edge.reference===occurrence.reference);
  assert.equal(edge.to,occurrence.target.value);
  assert.equal(sourceSlice(corpus['source:a'].content,occurrence.start_byte,occurrence.end_byte),occurrence.evidence.raw_token);
  assert.ok(b.incoming.some(edge=>edge.reference===occurrence.reference));
 }
 assert.equal(a.occurrences.find(o=>o.state==='ambiguous').state,'ambiguous');
 assert.equal(a.occurrences.find(o=>o.state==='unresolved').state,'unresolved');
 assert.equal(JSON.stringify(corpus).includes('PRIVATE_SENTINEL'),false);
});

test('source and revision mismatches cannot be presented as current Markdown',()=>{
 assert.throws(()=>wikiDocument({...corpus['source:a'],resource:'different'}),/does not match/);
 assert.throws(()=>wikiDocument({...corpus['source:a'],revision:'new'}),/does not match/);
 assert.throws(()=>wikiDocument({...corpus['source:a'],content:'replacement'}),/syntax basis/);
 const malformed=structuredClone(corpus['source:a']);malformed.document.syntax.blocks[0].end_byte=99999999;
 assert.throws(()=>wikiDocument(malformed),/spans/);
 assert.equal(wikiDocument({...corpus['source:a'],document:undefined}),undefined);
});

test('native heading/block keys and byte anchors preserve the documented units',()=>{
 const document=wikiDocument(corpus['source:b']);
 assert.ok(resolveWikiAnchor(document,{fragment:'Part'}).id);
 assert.ok(resolveWikiAnchor(document,{fragment:'^claim'}).id);
 assert.match(resolveWikiAnchor(document,{fragment:'missing'}).issue,/not present/);
 assert.match(resolveWikiAnchor(document,{start_byte:1,revision:'old'}).issue,/source changed/);
 assert.equal(sourceSlice('🙂 abc',5,8),'abc');
 assert.throws(()=>sourceSlice('🙂 abc',1,3));
 assert.throws(()=>sourceSlice('text',0,200));
 for(const unsafe of ['javascript:alert(1)','data:text/html,<script>','file:///secret','//outside.example','../document.md'])assert.equal(safeExternalLink(unsafe),undefined);
 assert.equal(safeExternalLink('https://example.test/a'), 'https://example.test/a');
});

test('a local graph is delivered without starting Shared Field; requested hosted work starts after local disclosure',async()=>{
 const central=deferred(),native=deferred(),hosted=deferred(),calls=[],updates=[];
 const run=progressiveGraph(options=>{calls.push(options.input);return {central_wiki:central.promise,aikit_resolution:native.promise,shared_field:hosted.promise}[options.input];},value=>updates.push(value),{shared:true});
 assert.deepEqual(calls,['aikit_resolution','central_wiki']);
 const part=emptyGraph();part.nodes=[{ref:'source:a',kind:'knowledge-source',label:'Alpha',native_owner:'ai-kit',actions:[],provenance:{source:'aikit.knowledge.graph'}}];part.inputs.aikit_resolution={state:'available',owner_operation:'aikit.knowledge.graph'};
 native.resolve(part);await settle();
 assert.equal(updates.at(-1).reading.nodes[0].ref,'source:a');assert.equal(calls.includes('shared_field'),false);
 central.resolve(emptyGraph());await settle();assert.equal(calls.at(-1),'shared_field');
 hosted.reject(new Error('hosted offline'));await run;
 assert.equal(updates.at(-1).reading.nodes.length,1);assert.equal(updates.at(-1).reading.inputs.shared_field.state,'unavailable');
 const localCalls=[];await progressiveGraph(async options=>{localCalls.push(options.input);return emptyGraph();},()=>{});
 assert.equal(localCalls.includes('shared_field'),false);
});

test('cancelled graph generations do not publish or start a deferred remote request',async()=>{
 const stop=new AbortController(),held=deferred(),updates=[],calls=[];
 const run=progressiveGraph(options=>{calls.push(options.input);return held.promise;},value=>updates.push(value),{shared:true,signal:stop.signal});
 const before=updates.length;stop.abort();held.resolve(emptyGraph());await run;
 assert.equal(updates.length,before);assert.equal(calls.includes('shared_field'),false);
});

test('relation observations sharing endpoints remain separate; only identical disclosures collapse',()=>{
 const part=emptyGraph();part.edges=[{from_ref:'a',to_ref:'b',relation:'references',reference:'first',provenance:{source:'native'}},{from_ref:'a',to_ref:'b',relation:'references',reference:'second',provenance:{source:'native'}}];
 const joined=joinGraphInputs({central_wiki:part,aikit_resolution:part},[]);
 assert.equal(joined.edges.length,2);
});

test('whole loading retains more than ten native members and exact relation revisions through four bounded slots',async()=>{
 const original=globalThis.fetch;let active=0,peak=0;
 const members=Array.from({length:18},(_,i)=>({resource:`source:${i}`,label:`Note ${i}`,kind:'knowledge-source'}));
 globalThis.fetch=async(_url,options)=>{const request=JSON.parse(options.body).request;let data;
  if(request.action==='relations')data={nodes:members,edges:[{from:'source:0',to:'source:1',relation:'supports',reference:'edge:real',origin:{revision:'e1'},authored_relation:{source_ref:'source:0',source_revision:'r1'}}],truncated:false,warnings:[]};
  else {active++;peak=Math.max(peak,active);await settle();active--;data={resource:request.address.value,provider:'native',revision:'r1',authority:'observed',content:'Text',evidence:[]};}
  return {json:async()=>({ok:true,outcome:{result:'knowledge',data}})};
 };
 try{const whole=await readLocalWhole({kind:'bridge',url:'http://controlled.invalid'},undefined,{ref:'source:0',kind:'knowledge-source',label:'Zero',native_owner:'native',provenance:{source:'native'},actions:[]});
  assert.equal(whole.members.length,18);assert.ok(peak>1&&peak<=4);assert.equal(whole.ownerRelations[0].relation.ref,'edge:real');assert.equal(whole.relationBindingsUnavailable,0);
 }finally{globalThis.fetch=original;}
});

test('a failed Expression inspection is not interpreted as permission to recreate existing work',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(_url,options)=>{const request=JSON.parse(options.body).request;calls.push(request.operation);return {json:async()=>request.operation==='capabilities'?{ok:true,outcome:{result:'expression',data:{composition_budget:{scene_members:256}}}}:{error:'Native connection lost'}};};
 try{const result=await projectProvidedLocalWhole({kind:'bridge',url:'http://controlled.invalid'},'surface','Subject',{members:[],edges:[],warnings:[],pinned:[],locus:'source:a',truncated:false,grammar:{state:'unavailable',detail:'No QL'},relationBindingsUnavailable:0});
  assert.equal(result.state,'unavailable');assert.deepEqual(calls,['capabilities','inspect']);
 }finally{globalThis.fetch=original;}
});
