import assert from 'node:assert/strict';
import test from 'node:test';
import {createKnowledgeEncounter} from './knowledge-encounter.mjs';

const provenance = revision => [{kind:'wiki-relation',ref:`source:${revision}`,source_system:'central',revision}];
const entry = (ref, revision) => ({schema:'oi.explore-entry/v1',ref,kind:'wiki-node',world_ref:'world:a',label:ref,revision,aliases:[],locators:[],provenance:provenance(revision)});
const reading = () => ({
  resource:entry('world:a/wiki:focus','node-r7'),
  relations:{schema:'oi.explore-relation-view/v1',focus:'world:a/wiki:focus',depth:1,budget:24,truncated:false,nodes:[entry('world:a/wiki:focus','node-r7'),entry('world:a/wiki:near','node-r3')],edges:[{from:'world:a/wiki:focus',to:'world:a/wiki:near',relation:'ql.m0/contains',origin:'wiki',direction:'forward',provenance:provenance('relation-r11')}]},
  sources:{ref:'world:a/wiki:focus',revision:'node-r7',provenance:provenance('node-r7')},
  actions:['open','inspect','traverse'],
});

test('one exact relation state supplies every knowledge presentation', () => {
  const opened=reading();
  const encounter=createKnowledgeEncounter(opened);
  assert.equal(encounter.state,'available');
  assert.deepEqual(encounter.presentations,['graph','tree','list','page','expression']);
  assert.equal(encounter.nodes[0].revision,'node-r7');
  assert.equal(encounter.edges[0].provenance[0].revision,'relation-r11');
  assert.equal(encounter.sources.revision,'node-r7');
  opened.relations.edges[0].relation='forged-after-read';
  assert.equal(encounter.edges[0].relation,'ql.m0/contains');
});

test('unavailable owner relations degrade to an intelligible source page', () => {
  const opened=reading();
  const encounter=createKnowledgeEncounter({...opened,relations:{error:'relation service unavailable'}});
  assert.equal(encounter.state,'degraded');
  assert.deepEqual(encounter.presentations,['page']);
  assert.equal(encounter.nodes[0].ref,opened.resource.ref);
  assert.match(encounter.detail,/unavailable/);
});

test('an unavailable relation endpoint keeps its exact ref and cannot be recentered', () => {
  const escaped=reading();
  escaped.relations.edges[0].to='world:a/wiki:not-returned';
  const encounter=createKnowledgeEncounter(escaped);
  const unavailable=encounter.nodes.find(node=>node.ref==='world:a/wiki:not-returned');
  assert.equal(unavailable.availability,'unavailable');
  assert.equal(unavailable.provenance[0].revision,'relation-r11');
  assert.equal(encounter.edges[0].to,'world:a/wiki:not-returned');
  assert.equal(encounter.nodes.filter(node=>node.ref===unavailable.ref).length,1);
});

test('malformed, mismatched and stale owner relations keep the source page usable', () => {
  for(const mutate of [r=>r.relations.schema='future/v9', r=>r.relations.focus='wrong', r=>r.relations.nodes[0].revision='r8', r=>r.relations.edges[0].provenance=[{ref:'x'}]]) {
    const input=reading();mutate(input);const result=createKnowledgeEncounter(input);
    assert.equal(result.state,'degraded');assert.deepEqual(result.presentations,['page']);assert.equal(result.focus,input.resource.ref);
  }
  assert.equal(createKnowledgeEncounter(reading()).state,'available');
});

test('an oversized owner reply stays bounded without inventing or rewriting a relation', () => {
  const input=reading();
  input.relations.nodes.push(...Array.from({length:100},(_,i)=>entry(`wiki:extra:${i}`,`r${i}`)));
  const result=createKnowledgeEncounter(input);
  assert.equal(result.truncated,true);assert.equal(result.nodes.length,24);
  assert.deepEqual(result.edges,input.relations.edges);
});
