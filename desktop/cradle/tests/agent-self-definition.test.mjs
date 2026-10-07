// O:I owner slice (I3): the authored self definition. A draft carries two
// exact Central source pins (particular self + shared Relational Logos);
// propose maps them to the snake_case wire object and checks the echo;
// review shows the exact operative text Central resolved (or the named
// reason a source did not resolve) and acceptance is withheld while
// unresolved; set-self changes a bound self through Central's CAS save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NativeAgentController, setAgentSelf, selfDefinitionWire, selfPinsCarried, selfSourcesBlocked, readSelfSourceReading} from '../src/agency/nativeAgent.ts';

const scope='control:root';
const SELF_REF='central:source:control:root:Control/self/agents/kite/self.md';
const LOGOS_REF='central:source:control:root:Control/self/agents/relational-logos.md';
const SELF_DIGEST='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const LOGOS_DIGEST='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const DRAFT={source:{reference:SELF_REF,contentDigest:SELF_DIGEST},relationalLogos:{reference:LOGOS_REF,contentDigest:LOGOS_DIGEST}};
const WIRE={source:{reference:SELF_REF,content_digest:SELF_DIGEST},relational_logos:{reference:LOGOS_REF,content_digest:LOGOS_DIGEST}};
const profile={ref:'agent-profile:test',revision:'r1',agent_ref:'agent:test',name:'Source reader',purpose:'Read only the selected sources.',intent_provenance:{intent_expression:'Read only the selected sources.'}};
export function review(accepted=false, extra={}){return {schema:'central.agent-profile-review/v1',profile:{...profile},scope_ref:scope,content_digest:'sha256:controlled',accepted,execution_authority_granted:false,acceptance:null,...extra};}
function rig(options={}){
 const calls=[];let value=review(false),stored=false;
 const owner=async request=>{
  calls.push(structuredClone(request));
  if(options.intercept){const answer=await options.intercept(request);if(answer!==undefined)return answer;}
  switch(request.action){
   case 'roster':return {schema:'central.agent-profile-roster/v1',scope_ref:scope,profiles:stored?[value]:[],execution_authority_granted:false};
   case 'propose':stored=true;return value;
   case 'review':return value;
   case 'accept':value=review(true);return value;
   default:throw Error('unexpected');
  }
 };
 return {calls,controller:new NativeAgentController(owner,()=> 'controlled-12345678'),owner};
}
async function propose(r){await r.controller.refresh();r.controller.edit({name:profile.name,purpose:profile.purpose,scopeConfirmed:true});await r.controller.propose();}

// --- draft → propose: the pins travel as the exact snake_case wire object --

test('a draft self definition travels on the proposal and must come back pin-for-pin',async()=>{
 const echo=rig({intercept:q=>q.action==='propose'?{...review(),profile:{...profile,self_definition:q.self_definition}}:undefined});
 await echo.controller.refresh();
 echo.controller.edit({name:profile.name,purpose:profile.purpose,scopeConfirmed:true,selfDefinition:DRAFT});
 await echo.controller.propose();
 const sent=echo.calls.find(c=>c.action==='propose');
 assert.deepEqual(sent.self_definition,WIRE,'the exact snake_case wire object is sent');
 assert.equal(echo.controller.snapshot().unknown,undefined);
 assert.deepEqual(echo.controller.snapshot().review.profile.self_definition,WIRE,'the reviewed source carries the pins');
 // A source that silently dropped a pin, or swapped a digest, is not the submitted Agent.
 for(const mutated of [
  {...review(),profile:{...profile,self_definition:{source:WIRE.source}}},
  {...review(),profile:{...profile,self_definition:{...WIRE,relational_logos:{...WIRE.relational_logos,content_digest:'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'}}}},
  {...review(),profile:{...profile}},
 ]){
  const dropped=rig({intercept:q=>q.action==='propose'?mutated:undefined});
  await dropped.controller.refresh();
  dropped.controller.edit({name:profile.name,purpose:profile.purpose,scopeConfirmed:true,selfDefinition:DRAFT});
  await dropped.controller.propose();
  assert.equal(dropped.controller.snapshot().unknown,'propose','a pin mismatch is an unconfirmed proposal');
  assert.match(dropped.controller.snapshot().error,/self pins/);
 }
 // No self: nothing is sent, and none is required back (byte-identical no-self flow).
 const bare=rig();await propose(bare);
 assert.equal('self_definition' in bare.calls.find(c=>c.action==='propose'),false);
 assert.equal(bare.controller.snapshot().unknown,undefined);
});

test('the draft maps to the wire object honestly, and pin equality is exact',()=>{
 assert.deepEqual(selfDefinitionWire(DRAFT),WIRE);
 assert.deepEqual(selfDefinitionWire({source:{reference:SELF_REF,contentDigest:SELF_DIGEST}}),{source:{reference:SELF_REF,content_digest:SELF_DIGEST}},'an absent logos pin stays absent');
 assert.equal(selfDefinitionWire({source:{reference:SELF_REF}}),undefined,'an unpinned reference is nothing to send');
 assert.equal(selfDefinitionWire(),undefined);
 assert.equal(selfPinsCarried(WIRE,WIRE),true);
 assert.equal(selfPinsCarried({source:WIRE.source},{source:WIRE.source}),true,'only the requested pins are checked');
 assert.equal(selfPinsCarried(undefined,null),true,'nothing bound carries a clear request');
 assert.equal(selfPinsCarried(undefined,WIRE),false,'nothing bound does not carry pins');
 assert.equal(selfPinsCarried(WIRE,null),false,'a bound self is not a cleared one');
 assert.equal(selfPinsCarried({source:{reference:SELF_REF,content_digest:'sha256:wrong'}},WIRE),false,'a different digest is not the same pin');
 assert.equal(selfPinsCarried('garbage',WIRE),false,'malformed readings are not pins, not crashes');
});

// --- review: the exact operative text, the named reason, and the gate ------

const RESOLVED={source:{reference:SELF_REF,content_digest:SELF_DIGEST,resolved:true,text:'I am Kite, an authored self.\n'},relational_logos:{reference:LOGOS_REF,content_digest:LOGOS_DIGEST,resolved:true,text:'You act from within a relation.\n'}};

test('review renders the exact operative text of each bound pin',async()=>{
 const mod=await ui();
 const html=renderToStaticMarkup(createElement(mod.SelfReviewBlock,{review:review(false,{self_definition:RESOLVED,self_sources_resolved:true})}));
 assert.ok(html.includes('aria-label="Review operative text"'));
 assert.ok(html.includes(SELF_REF));
 assert.ok(html.includes('<pre'));
 assert.ok(html.includes('I am Kite, an authored self.'),'the exact bytes are what the author reviews');
 assert.ok(html.includes('You act from within a relation.'));
 // No bound self: the block renders nothing — the no-self flow is unchanged.
 assert.equal(renderToStaticMarkup(createElement(mod.SelfReviewBlock,{review:review()})),'');
});

test('an unresolved pin shows its named reason and acceptance is withheld',async()=>{
 const mod=await ui();
 const unresolved={...RESOLVED,source:{...RESOLVED.source,resolved:false,text:undefined,reason:'digest-mismatch'}};
 const r=review(false,{self_definition:unresolved,self_sources_resolved:false});
 const html=renderToStaticMarkup(createElement(mod.SelfReviewBlock,{review:r}));
 assert.ok(html.includes('digest-mismatch'),'the named reason is shown');
 assert.ok(!html.includes('I am Kite'),'unresolved text is not fabricated');
 assert.match(String(selfSourcesBlocked(r)),/digest-mismatch/,'acceptance is withheld with the reason');
 // The gate is silent exactly when the field is absent or not false.
 assert.equal(selfSourcesBlocked(review(false,{self_definition:RESOLVED,self_sources_resolved:true})),undefined);
 assert.equal(selfSourcesBlocked(review()),undefined,'a no-self review is never blocked');
});

// --- set-self: the CAS change on an existing Agent -------------------------

test('an existing Agent changes its self definition through the CAS set-self request',async()=>{
 const next=review(false);
 const r=rig({intercept:q=>{
  if(q.action!=='set-self')return undefined;
  next.profile={...profile,revision:'r2',self_definition:q.self_definition};
  return {...next,self_change:{state:'saved',previous_revision:'r1',revision:'r2',re_acceptance_required:false}};
 }});
 await propose(r);
 const change=await r.controller.setSelf(DRAFT);
 const sent=r.calls.find(c=>c.action==='set-self');
 assert.deepEqual(sent,{action:'set-self',profile_ref:profile.ref,expected_revision:'r1',self_definition:WIRE});
 assert.equal(change.revision,'r2');
 assert.deepEqual(r.controller.snapshot().review.profile.self_definition,WIRE);
 assert.equal(r.calls.at(-1).action,'roster','the roster is re-read after the change');
 // Clearing sends null.
 const cleared=[];
 await r.controller.bind(async q=>{cleared.push(q);if(q.action==='roster')return {schema:'central.agent-profile-roster/v1',scope_ref:scope,profiles:[],execution_authority_granted:false};return review(false);});
 await r.controller.setSelf(null);
 assert.equal(cleared.find(c=>c.action==='set-self').self_definition,null);
 // A source that does not carry the requested pins is not a confirmed change.
 const wrong=async q=>q.action==='set-self'?{...review(false),profile:{...profile,revision:'r2',self_definition:{source:WIRE.source}}}:review(false);
 await assert.rejects(()=>setAgentSelf(wrong,scope,{profileRef:profile.ref,expectedRevision:'r1',selfDefinition:DRAFT}),/requested self definition/);
 // An accepted Agent's change reports re-acceptance.
 const accepted=rig({intercept:q=>q.action==='set-self'?{...review(false),profile:{...profile,revision:'r3',self_definition:q.self_definition},self_change:{state:'saved',previous_revision:'r2',revision:'r3',re_acceptance_required:true}}:undefined});
 await propose(accepted);
 const change2=await accepted.controller.setSelf(DRAFT);
 assert.equal(change2.re_acceptance_required,true);
});

// --- self-source-read: the pin comes from the resolved bytes ---------------

test('readSelfSource resolves exact bytes and refuses malformed readings',async()=>{
 const reading={reference:SELF_REF,content_digest:SELF_DIGEST,size_bytes:32,text:'I am Kite.\n',truncated:false};
 const r=rig({intercept:q=>q.action==='self-source-read'?reading:undefined});
 const resolved=await r.controller.readSelfSource(` ${SELF_REF} `);
 assert.deepEqual(resolved,reading,'the reference is resolved, never hand-typed');
 const sent=r.calls.find(c=>c.action==='self-source-read');
 assert.equal(sent.reference,SELF_REF.trim());
 assert.equal(r.controller.snapshot().busy,false);
 const bad=rig({intercept:q=>q.action==='self-source-read'?{reference:SELF_REF,content_digest:'not-a-digest',size_bytes:1,text:''}:undefined});
 assert.equal(await bad.controller.readSelfSource(SELF_REF),undefined,'a malformed native reading is refused, not pinned');
 assert.match(bad.controller.snapshot().error,/malformed/);
 assert.throws(()=>readSelfSourceReading({reference:'',content_digest:'x',size_bytes:1,text:''}),/malformed/);
});

// --- build the UI module once for the render tests -------------------------
let cached;
async function ui(){
 if(cached) return cached;
 const here=dirname(fileURLToPath(import.meta.url));
 const temp=await mkdtemp(join(here,'.agent-self-definition-'));
 await build({
  entryPoints:{self:join(here,'../src/agency/SelfDefinitionSection.tsx')},
  bundle:true,platform:'node',format:'esm',jsx:'automatic',
  external:['react','react-dom','react/jsx-runtime'],
  outdir:temp,outExtension:{'.js':'.mjs'},logLevel:'error',
 });
 const mod=await import(pathToFileURL(join(temp,'self.mjs')));
 test.after(()=>rm(temp,{recursive:true,force:true}));
 cached=mod;
 return mod;
}

test('the draft section renders both pins, the paste path and the summary',async()=>{
 const mod=await ui();
 const noop=async()=>undefined;
 const html=renderToStaticMarkup(createElement(mod.SelfDefinitionSection,{value:DRAFT,onRead:noop,onCreate:noop}));
 assert.ok(html.includes('aria-label="Self definition"'));
 assert.ok(html.includes('Read &amp; pin'));
 assert.ok(html.includes('or write it here'));
 assert.ok(html.includes('Save source and pin'));
 assert.ok(html.includes(SELF_REF)&&html.includes(LOGOS_REF),'both source references are held');
 assert.ok(html.includes(SELF_DIGEST.slice(0,15)),'the pinned digest is shown from its resolution');
});
