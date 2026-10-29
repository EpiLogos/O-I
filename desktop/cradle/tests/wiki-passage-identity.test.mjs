import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedPassage, passageKey, appendPassage, passageProvenance} from '../src/knowledge/selection.ts';
import {passageRequest} from '../src/knowledge/constellationActs.ts';
import {PARTICIPATION} from '../src/knowledge/construction.ts';

// A constellation you made, at the revision the owner gave it, and the same frame with each gathered passage as the owner keeps it.
const frame=(members=[])=>({ref:'wiki:frame:p',revision:members.length+1,constellations:[{anchor_ref:'wiki:anchor:p',members}],'aikit.constellation/v1':{title:'Passages',inquiry:{question:'Which passages?'}}});
const gathered=(request)=>request.changes.filter(change=>change.change==='member_add').map(({member})=>({ref:member.subject_ref,[PARTICIPATION]:member.participation}));
const register={relations:[]};

const corpus=JSON.parse(readFileSync(new URL('./fixtures/wiki-native.json',import.meta.url)));
const reading=corpus['source:a'];
const anchor={revision:reading.revision,start_byte:0,end_byte:new TextEncoder().encode(reading.content).length};

test('different quotations in one native enclosing span remain distinct passages and contextual participants',()=>{
  const first=selectedPassage(reading,anchor,'Alpha','Alpha');
  const second=selectedPassage(reading,anchor,'🌱','Alpha');
  assert.equal(first.source_text,second.source_text);
  assert.notEqual(passageKey(first),passageKey(second));
  assert.equal(appendPassage([first],second).length,2);
  // Add to constellation, twice: each a member of its own (constellationActs.ts passageRequest, on the frame the owner holds after the first).
  const one=gathered(passageRequest(register,frame(),first)),two=gathered(passageRequest(register,frame(one),second));
  const members=[...one,...two];
  assert.equal(members.length,2);
  assert.equal(members[0].ref,members[1].ref);
  assert.notEqual(members[0][PARTICIPATION].participation_ref,members[1][PARTICIPATION].participation_ref);
  const selectors=members.map(member=>JSON.parse(member[PARTICIPATION].sources[0]['aikit.techne-facet/v1'].selector.value));
  assert.deepEqual(selectors.map(selector=>selector.quote),['Alpha','🌱']);
});
test('an identical repeated selection is idempotent but a different source revision is not conflated',()=>{
  const first=selectedPassage(reading,anchor,'Alpha','Alpha');
  const repeated={...first,title:'Renamed display only'};
  assert.equal(passageKey(first),passageKey(repeated));
  assert.equal(appendPassage([first],repeated).length,1);
  const held=frame(gathered(passageRequest(register,frame(),first)));
  assert.throws(()=>passageRequest(register,held,repeated),/already gathered in Passages/,'the same passage is gathered once');
  assert.notEqual(passageKey(first),passageKey({...first,source_revision:'changed'}));
  assert.equal(JSON.parse(passageProvenance(first)['aikit.techne-facet/v1'].selector.value).quote,'Alpha');
});
