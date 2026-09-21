import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedPassage, passageKey, appendPassage, passageProvenance} from '../src/knowledge/selection.ts';
import {emptyDraft, withPassage} from '../src/knowledge/constructionDraft.ts';

const corpus=JSON.parse(readFileSync(new URL('./fixtures/wiki-native.json',import.meta.url)));
const reading=corpus['source:a'];
const anchor={revision:reading.revision,start_byte:0,end_byte:new TextEncoder().encode(reading.content).length};

test('different quotations in one native enclosing span remain distinct passages and contextual participants',()=>{
  const first=selectedPassage(reading,anchor,'Alpha','Alpha');
  const second=selectedPassage(reading,anchor,'🌱','Alpha');
  assert.equal(first.source_text,second.source_text);
  assert.notEqual(passageKey(first),passageKey(second));
  assert.equal(appendPassage([first],second).length,2);
  const draft=withPassage(withPassage(emptyDraft('wiki:space'),first),second);
  assert.equal(draft.members.length,2);
  assert.equal(draft.members[0].subject_ref,draft.members[1].subject_ref);
  assert.notEqual(draft.members[0].participation_ref,draft.members[1].participation_ref);
  const selectors=draft.members.map(member=>JSON.parse(member.sources[0]['aikit.techne-facet/v1'].selector.value));
  assert.deepEqual(selectors.map(selector=>selector.quote),['Alpha','🌱']);
});
test('an identical repeated selection is idempotent but a different source revision is not conflated',()=>{
  const first=selectedPassage(reading,anchor,'Alpha','Alpha');
  const repeated={...first,title:'Renamed display only'};
  assert.equal(passageKey(first),passageKey(repeated));
  assert.equal(appendPassage([first],repeated).length,1);
  const draft=withPassage(emptyDraft('wiki:space'),first);
  assert.equal(withPassage(draft,repeated),draft);
  assert.notEqual(passageKey(first),passageKey({...first,source_revision:'changed'}));
  assert.equal(JSON.parse(passageProvenance(first)['aikit.techne-facet/v1'].selector.value).quote,'Alpha');
});
