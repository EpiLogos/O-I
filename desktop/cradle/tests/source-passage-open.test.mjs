// Lane-2 T19b — a Timeline event opens its source at its passage (pure proofs).
//   The resolver carries a disclosed text span only for a file-location target whose revision it
//   proved, and refuses by name everything else; the reveal fires only on a revision match; a
//   queued reveal is taken once, by its own editor binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceAnchorOf} from '../src/techne/m0m5/timeline/navigationIdentity.ts';
import {
  passageForSource,
  passageRevealDecision,
  queueSourcePassageReveal,
  takeSourcePassageReveal,
} from '../src/expressions/sourceHandoff.ts';

const SOURCE = 'central:notes/ledger.md';
const SPAN = {unit: 'text_span', start: 4, end: 9, anchor_ref: null};
const file = (revision = 'rev-7') => ({kind: 'file', ref: SOURCE, revision});
const passage = (overrides = {}) => ({state: 'passage', source_ref: SOURCE, selector: SPAN, ...overrides});

test('a disclosed text span is carried verbatim, with the revision the resolver proved', () => {
  assert.deepEqual(passageForSource(passage(), file('rev-7')), {
    anchor: {source_ref: SOURCE, selector: SPAN, revision: 'rev-7'},
  });
});

test('an event whose reading discloses no passage opens at the top, with the reason it names', () => {
  const carried = {temporal_source_ref: SOURCE};
  const state = evidenceAnchorOf(carried);
  assert.equal(state.state, 'top');
  assert.deepEqual(passageForSource(state, file()), {anchorRefusal: state.reason});
});

test('an event with no disclosed source opens with the reason, never an anchor', () => {
  const state = evidenceAnchorOf({});
  assert.equal(state.state, 'absent');
  assert.deepEqual(passageForSource(state, file()), {anchorRefusal: state.reason});
});

test('a malformed passage is refused by name and never carried', () => {
  const reversed = passageForSource(passage({selector: {unit: 'text_span', start: 9, end: 4}}), file());
  assert.equal('anchor' in reversed, false);
  assert.match(reversed.anchorRefusal, /malformed/);
  const unknownUnit = passageForSource(passage({selector: {unit: 'other', kind: 'x', value: 'y'}}), file());
  assert.equal('anchor' in unknownUnit, false);
  assert.match(unknownUnit.anchorRefusal, /malformed/);
});

test('a passage that names another source is refused, never re-targeted onto the one being opened', () => {
  const other = passageForSource(passage({source_ref: 'central:notes/other.md'}), file());
  assert.equal('anchor' in other, false);
  assert.match(other.anchorRefusal, /another source/);
});

test('a timestamp or image passage has no reader that positions it, so the source opens at its top', () => {
  for (const selector of [
    {unit: 'timestamp_range', from: '00:00:01', to: '00:00:02'},
    {unit: 'image_region', x: 0, y: 0, width: 1, height: 1},
  ]) {
    const result = passageForSource(passage({selector}), file());
    assert.equal('anchor' in result, false, `${selector.unit} carries no anchor`);
    assert.match(result.anchorRefusal, /opens at its top/);
  }
});

test('a knowledge-address target carries no anchor and says so', () => {
  const result = passageForSource(passage(), {kind: 'knowledge'});
  assert.equal('anchor' in result, false);
  assert.match(result.anchorRefusal, /no passage addressing/);
});

test('an event that asked for no passage yields no anchor and no refusal', () => {
  assert.deepEqual(passageForSource(undefined, file()), {});
});

const REVEAL = {kind: 'source-passage', bindingId: 'binding-1', sourceRef: SOURCE, start: 4, end: 9, revision: 'rev-7'};
const EDITOR = {bindingId: 'binding-1', sourceRef: SOURCE, revision: 'rev-7', docLength: 40};

test('the reveal fires only when the editor revision equals the revision the resolver proved', () => {
  assert.deepEqual(passageRevealDecision(REVEAL, EDITOR), {start: 4, end: 9});
  assert.equal(passageRevealDecision(REVEAL, {...EDITOR, revision: 'rev-8'}), null, 'a changed revision never reveals');
  assert.equal(passageRevealDecision(REVEAL, {...EDITOR, workingCopy: true}), null, 'an unsaved working copy never takes the proved revision\'s offsets');
  assert.deepEqual(passageRevealDecision(REVEAL, {...EDITOR, workingCopy: false}), {start: 4, end: 9});
  assert.equal(passageRevealDecision(REVEAL, {...EDITOR, revision: undefined}), null, 'an unknown revision never reveals');
});

test('the reveal never lands on another binding or another source', () => {
  assert.equal(passageRevealDecision(REVEAL, {...EDITOR, bindingId: 'binding-2'}), null);
  assert.equal(passageRevealDecision(REVEAL, {...EDITOR, sourceRef: 'central:notes/other.md'}), null);
});

test('a span outside the document, or empty, is never revealed', () => {
  assert.equal(passageRevealDecision({...REVEAL, end: 41}, EDITOR), null);
  assert.equal(passageRevealDecision({...REVEAL, start: 9, end: 9}, EDITOR), null);
  assert.equal(passageRevealDecision({...REVEAL, start: -1}, EDITOR), null);
  assert.equal(passageRevealDecision(undefined, EDITOR), null);
});

test('a queued reveal is taken once, by its own binding', () => {
  queueSourcePassageReveal(REVEAL);
  assert.equal(takeSourcePassageReveal('binding-2'), undefined);
  assert.deepEqual(takeSourcePassageReveal('binding-1'), REVEAL);
  assert.equal(takeSourcePassageReveal('binding-1'), undefined);
});
