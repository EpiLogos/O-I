import assert from 'node:assert/strict';
import test from 'node:test';
import {createKnowledgeEncounter,createKnowledgeTravel,recenterKnowledge,setKnowledgePresentation,toggleKnowledgeFollow,toggleKnowledgePin,travelKnowledge} from './knowledge-encounter.mjs';

const provenance = revision => [{kind:'wiki-relation',ref:`source:${revision}`,source_system:'central',revision}];
const entry = (ref, revision) => ({schema:'oi.explore-entry/v1',ref,kind:'wiki-node',world_ref:'world:a',label:ref,revision,aliases:[],locators:[],provenance:provenance(revision)});
const opened = {
  resource:entry('world:a/wiki:focus','node-r7'),
  relations:{schema:'oi.explore-relation-view/v1',focus:'world:a/wiki:focus',depth:1,budget:24,truncated:false,nodes:[entry('world:a/wiki:focus','node-r7'),entry('world:a/wiki:near','node-r3')],edges:[{from:'world:a/wiki:focus',to:'world:a/wiki:near',relation:'ql.m0/contains',origin:'wiki',direction:'forward',provenance:provenance('relation-r11')}]},
  sources:{ref:'world:a/wiki:focus',revision:'node-r7',provenance:provenance('node-r7')},
  actions:['open','inspect','traverse'],
};

test('one exact relation state supplies every knowledge presentation', () => {
  const encounter=createKnowledgeEncounter(opened);
  assert.equal(encounter.state,'available');
  assert.deepEqual(encounter.presentations,['graph','tree','list','page','expression']);
  assert.equal(encounter.nodes[0].revision,'node-r7');
  assert.equal(encounter.edges[0].provenance[0].revision,'relation-r11');
  assert.equal(encounter.sources.revision,'node-r7');
  opened.relations.edges[0].relation='forged-after-read';
  assert.equal(encounter.edges[0].relation,'ql.m0/contains');
});

test('travel only recenters to owner-returned neighbours and retains exact refs', () => {
  const encounter=createKnowledgeEncounter(opened);
  let travel=createKnowledgeTravel(encounter.focus);
  travel=recenterKnowledge(travel,encounter,'world:a/wiki:near');
  travel=toggleKnowledgePin(travel,'world:a/wiki:near');
  travel=toggleKnowledgeFollow(travel);
  travel=setKnowledgePresentation(travel,'expression');
  assert.deepEqual(travel.visits,['world:a/wiki:focus','world:a/wiki:near']);
  assert.deepEqual(travel.pinned,['world:a/wiki:near']);
  assert.equal(travel.follow,false);
  assert.equal(travel.presentation,'expression');
  assert.equal(travelKnowledge(travel,-1).visits[0],'world:a/wiki:focus');
  assert.throws(()=>recenterKnowledge(travel,encounter,'world:a/wiki:invented'),/outside the bounded/);
});

test('unavailable owner relations degrade to an intelligible source page', () => {
  const encounter=createKnowledgeEncounter({...opened,relations:{error:'relation service unavailable'}});
  assert.equal(encounter.state,'degraded');
  assert.deepEqual(encounter.presentations,['page']);
  assert.equal(encounter.nodes[0].ref,opened.resource.ref);
  assert.match(encounter.detail,/unavailable/);
});

test('an unavailable relation endpoint keeps its exact ref and cannot be recentered', () => {
  const escaped=structuredClone(opened);
  escaped.relations.edges[0].to='world:a/wiki:not-returned';
  const encounter=createKnowledgeEncounter(escaped);
  const unavailable=encounter.nodes.find(node=>node.ref==='world:a/wiki:not-returned');
  assert.equal(unavailable.availability,'unavailable');
  assert.equal(unavailable.provenance[0].revision,'relation-r11');
  assert.equal(encounter.edges[0].to,'world:a/wiki:not-returned');
  assert.throws(()=>recenterKnowledge(createKnowledgeTravel(encounter.focus),encounter,unavailable.ref),/unavailable relation endpoint/);
});
