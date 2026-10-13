// T10 — cause and influence chains along the axis. The chain walk is the authority's
// directedChains over the cause family (projectionForRelation decides membership); each
// hop's time is its own dated extent from the authority; an offset is computed only when
// both hops are dated; an undated hop says "no date disclosed". These tests pin that the
// model reads the authority and states absence honestly. Rendering and the camera are
// the lead's native pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// The authority and the canvas chain model under test: imported, never copied.
const compiled=await build({stdin:{contents:[
 "export * as causeChain from '../../vendor/research-canvas/packages/canvas/src/timeline/causeChain.ts';",
 "export * as projection from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';",
 "export * as authority from '../../../src/techne/m0m5/timeline/relations.ts';",
].join('\n'),resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {causeChain,projection,authority}=api;

const DAY=86_400_000;

// A year-precision chronology item, placed by the authority's projection (the same path the chronology uses).
const anchorItem=(graphNodeId,validFrom,precision='year')=>projection.projectNodes([{
 node:{graphNodeId,title:graphNodeId,isTemporal:true,entityType:'Event',validFrom,validTo:null,evidenceTags:[]},
 anchor:{validFrom,validTo:null,precision},
 layoutOverride:null,
}])[0];

const rel=(id,relType,from,to,properties={})=>({id,relType,sourceGraphNodeId:from,targetGraphNodeId:to,properties});

test('a cause chain walks the owner\'s directions; a dated hop states its precision label; an undated hop says no date disclosed',()=>{
 const items=new Map([anchorItem('facet:h1','1850'),anchorItem('facet:h2','1862')].map(item=>[item.graphNodeId,item]));
 const relationships=[
  rel('r1','CAUSES','A','B',{temporal_facet_ref:'facet:h1'}),
  rel('r2','INFLUENCES','B','C',{temporal_facet_ref:'facet:h2'}),
  rel('r3','DEPENDS_ON','C','D'),
  rel('r4','ECHOES','A','D'),
  rel('r5','ASSOCIATED_WITH','B','E'),
 ];
 const chains=causeChain.causeChains(relationships.map(r=>causeChain.chronologyCauseSource(r,items)));
 assert.equal(chains.length,1,'one cause chain');
 assert.deepEqual(chains[0].hops.map(h=>h.id),['r1','r2','r3'],'the cause family walks A→B→C→D; echo and unrecognised types never join');
 const [h1,h2,h3]=chains[0].hops;
 assert.equal(causeChain.hopLabel(h1),'1850','dated hop states its precision label');
 assert.equal(causeChain.hopLabel(h2),'1862','second dated hop');
 assert.equal(causeChain.hopLabel(h3),causeChain.NO_DATE_DISCLOSED,'the undated hop carries its absence');
 assert.equal(h3.time,null,'no time is invented for the undated hop');
 assert.equal(h1.offset,null,'the chain origin has no offset');
});

test('an offset is the authority-extent difference, computed only when both hops are dated',()=>{
 const items=new Map([anchorItem('facet:h1','1850'),anchorItem('facet:h2','1862')].map(item=>[item.graphNodeId,item]));
 const chains=causeChain.causeChains([
  rel('r1','CAUSES','A','B',{temporal_facet_ref:'facet:h1'}),
  rel('r2','CAUSES','B','C',{temporal_facet_ref:'facet:h2'}),
  rel('r3','CAUSES','C','D'),
 ].map(r=>causeChain.chronologyCauseSource(r,items)));
 const [, second, third] = chains[0].hops;
 assert.deepEqual(second.offset,{state:'dated',ms:items.get('facet:h2').startMs-items.get('facet:h1').startMs,label:'+12 years'},'both dated: the authority difference, stated in years');
 assert.deepEqual(third.offset,{state:'undated',label:'no date disclosed'},'one undated hop: no offset is computed');
});

test('an offset is withheld when the earlier hop is the undated one',()=>{
 const items=new Map([anchorItem('facet:h2','1862')].map(item=>[item.graphNodeId,item]));
 const chains=causeChain.causeChains([
  rel('a1','CAUSES','X','Y'),
  rel('a2','CAUSES','Y','Z',{temporal_facet_ref:'facet:h2'}),
 ].map(r=>causeChain.chronologyCauseSource(r,items)));
 assert.equal(chains[0].hops[1].offset.label,'no date disclosed','an undated predecessor withholds the offset');
});

test('a temporal qualification that is not loaded is an undated hop, with the reason kept',()=>{
 const source=causeChain.chronologyCauseSource(rel('r9','CAUSES','P','Q',{temporal_facet_ref:'facet:not-loaded'}),new Map());
 assert.equal(source.time,null);
 assert.match(source.timeNote,/not loaded in this view/);
});

test('offset labels state the signed span in days under a year and in calendar years beyond it',()=>{
 const t=Date.UTC(1850,0,1);
 assert.equal(causeChain.offsetLabel(t,t),'same start');
 assert.equal(causeChain.offsetLabel(t,t+3*DAY),'+3 days');
 assert.equal(causeChain.offsetLabel(t+3*DAY,t),'−3 days');
 assert.equal(causeChain.offsetLabel(t,t+1000),'+under a day');
 assert.equal(causeChain.offsetLabel(Date.UTC(1850,0,1),Date.UTC(1862,0,1)),'+12 years');
 assert.equal(causeChain.offsetLabel(Date.UTC(1862,0,1),Date.UTC(1850,0,1)),'−12 years');
 assert.equal(causeChain.offsetLabel(Date.UTC(1850,0,1),Date.UTC(1851,0,1)),'+1 year','a 365-day span is a calendar year');
});

test('the chain walk is the authority\'s directedChains over the relation field, cause family only',()=>{
 const reading={
  reading_ref:'reading:fixture',
  subject:{subject_ref:'subject:s',kind:'event'},
  whole:{whole_ref:'whole:w',member_refs:[],focus_refs:[],relations:[
   {relation_ref:'rel:1',relation:'CAUSES',from_ref:'A',to_ref:'B',temporal_facet_ref:'facet:h1',standing:'sourced in the chronicle',source_ref:'src:chronicle-1'},
   {relation_ref:'rel:2',relation:'INFLUENCES',from_ref:'B',to_ref:'C',temporal_facet_ref:'facet:h2'},
   {relation_ref:'rel:3',relation:'CONTESTS',from_ref:'C',to_ref:'D'},
   {relation_ref:'rel:4',relation:'DEPENDS_ON',from_ref:'C',to_ref:'E'},
  ]},
  temporal:[
   {facet_ref:'facet:h1',kind:'occurrence',instant:'1850',precision:'year'},
   {facet_ref:'facet:h2',kind:'occurrence',instant:'1862',precision:'year'},
  ],
 };
 const edges=authority.relationEdges(reading);
 const expected=authority.directedChains(authority.edgesForProjection(edges,'cause')).map(chain=>chain.map(edge=>edge.id));
 const chains=causeChain.causeChains(edges.map(causeChain.relationFieldCauseSource));
 assert.deepEqual(chains.map(chain=>chain.hops.map(hop=>hop.id)),expected,'identical order and identity to the authority');
 assert.ok(!chains.some(chain=>chain.hops.some(hop=>hop.id==='rel:3')),'CONTESTS is opposition, never causal');
 const [first,second]=chains[0].hops;
 assert.equal(first.standing.verbatim,'sourced in the chronicle','standing verbatim rides with the hop');
 assert.equal(first.standing.visual,'sourced','standing class is the authority\'s');
 assert.equal(causeChain.hopLabel(first),'1850','dated relation states its span label');
 assert.equal(second.offset.label,'+12 years','both relations dated: offset from the authority extents');
 assert.equal(chains[0].hops[1].time.label,'1862');
});

test('a hop\'s centre is the middle of its own extent, and chainContaining finds a relation\'s chain or none',()=>{
 assert.equal(causeChain.hopCenterMs({fromMs:0,toMs:100,label:'x'}),50);
 assert.equal(causeChain.hopCenterMs({fromMs:40,toMs:null,label:'x'}),40,'a point is its own centre');
 const chains=causeChain.causeChains([
  rel('r1','CAUSES','A','B'),
  rel('r2','CAUSES','B','C'),
  rel('r4','ECHOES','A','Z'),
 ].map(r=>causeChain.chronologyCauseSource(r,new Map())));
 assert.equal(causeChain.chainContaining(chains,'r2').id,'r1','a later hop is found in its chain');
 assert.equal(causeChain.chainContaining(chains,'r4'),null,'an echo edge belongs to no cause chain');
});
