import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';
import { FixtureTechneAdapter } from '../src/techne/adapter.ts';
import {
  arrangeAt,
  arrangementOrder,
  composeChange,
  defaultArrangement,
  locusKey,
  palaceAvailability,
  palaceElements,
} from '../src/techne/palace/composition.ts';
import { recallAt, recallFocused, recallNext, recallPrevious, recallWalk } from '../src/techne/palace/recall.ts';

const representative = await loadFixture('representative-subject-v1.json');
const absent = await loadFixture('absent-facets-v1.json');

test('palace elements are the reading’s Expression bindings, verbatim', () => {
  const elements = palaceElements(representative);
  assert.equal(elements.length, 1);
  assert.equal(elements[0].expression_ref, 'oi:expression:l5-techne-constellation');
  assert.equal(elements[0].scene_ref, 'oi:expression:l5-techne-constellation/scene/opening');
  assert.equal(elements[0].revision, '3');
  // Verbatim means verbatim: the element is the binding, not a re-keying.
  assert.deepEqual(elements[0], representative.expressions[0]);
});

test('the default arrangement is deterministic and leaves the reading untouched', () => {
  const before = JSON.parse(JSON.stringify(representative));
  const first = defaultArrangement(palaceElements(representative));
  const second = defaultArrangement(palaceElements(representative));
  assert.deepEqual(first, second);
  assert.equal(first.placements.length, 1);
  assert.equal(first.placements[0].expression_ref, 'oi:expression:l5-techne-constellation');
  assert.deepEqual(representative, before);
});

test('moving an element changes only the arrangement — swap included', () => {
  const elements = palaceElements(representative);
  const extra = [...elements, { expression_ref: 'oi:expression:second', scene_ref: 'oi:expression:second/scene/a', revision: '1' }];
  const arrangement = defaultArrangement(extra);
  const firstLocus = arrangement.placements[0].locus;
  const targetLocus = { room: { column: 2, row: 1 }, locus: 3 };

  const moved = arrangeAt(arrangement, 'oi:expression:l5-techne-constellation', targetLocus);
  assert.equal(
    locusKey(moved.placements.find((p) => p.expression_ref === 'oi:expression:l5-techne-constellation').locus),
    locusKey(targetLocus),
  );
  assert.deepEqual(
    arrangementOrder(moved).at(-1),
    'oi:expression:l5-techne-constellation',
  );
  // The untouched reading is still untouched.
  assert.equal(palaceElements(representative).length, 1);

  // Dropping onto an occupied locus swaps the two elements.
  const onto = arrangeAt(arrangement, 'oi:expression:second', firstLocus);
  assert.equal(
    locusKey(onto.placements.find((p) => p.expression_ref === 'oi:expression:second').locus),
    locusKey(firstLocus),
  );
  assert.equal(
    locusKey(onto.placements.find((p) => p.expression_ref === 'oi:expression:l5-techne-constellation').locus),
    locusKey(arrangement.placements.find((p) => p.expression_ref === 'oi:expression:second').locus),
  );
});

test('composeChange proposes the substrate’s own scene_compose change in arrangement order', () => {
  const elements = palaceElements(representative);
  const arrangement = defaultArrangement(elements);
  const proposal = composeChange(elements, arrangement, representative.actions);

  assert.equal(proposal.action_ref, 'oi.expression.open', 'the disclosed Expression-owner action is used verbatim');
  assert.equal(proposal.input.expression_ref, 'oi:expression:l5-techne-constellation');
  assert.equal(proposal.input.change.kind, 'scene_compose');
  assert.equal(proposal.input.change.scene_ref, 'oi:expression:l5-techne-constellation/scene/opening');
  assert.deepEqual(proposal.input.change.elements, arrangementOrder(arrangement));
});

test('routing the proposal yields the owner receipt and executes nothing', async () => {
  const adapter = new FixtureTechneAdapter([representative, absent]);
  const elements = palaceElements(representative);
  const proposal = composeChange(elements, defaultArrangement(elements), representative.actions);
  const receipt = await adapter.routeAction(
    {
      action_ref: proposal.action_ref,
      subject_ref: representative.subject.subject_ref,
      selection_ref: null,
      input: proposal.input,
    },
    representative,
  );
  assert.equal(receipt.routed, true);
  assert.equal(receipt.native_owner, 'oi/desktop');
  assert.equal(receipt.authority, 'owner-disclosed');
});

test('a reading without Expression bindings is an honest empty palace', () => {
  assert.deepEqual(palaceElements(absent), []);
  const availability = palaceAvailability(absent);
  assert.equal(availability.available, false);
  assert.equal(availability.reason, 'no Expression composition available for this subject');
  assert.equal(composeChange([], defaultArrangement([]), absent.actions), null);
});

test('recall walks the arrangement order, wraps, and focuses nothing when empty', () => {
  const elements = palaceElements(representative);
  const extra = [
    { expression_ref: 'oi:expression:b', scene_ref: null, revision: null },
    { expression_ref: 'oi:expression:a', scene_ref: null, revision: null },
    ...elements,
  ];
  const arrangement = defaultArrangement(extra);
  // defaultArrangement stands the elements at the loci of the bounded space
  // in reading order, so the spatial walk repeats that order.
  assert.deepEqual(recallWalk(arrangement).refs, arrangementOrder(arrangement));

  const walk = recallWalk(arrangement);
  assert.equal(recallFocused(recallPrevious(walk)), arrangementOrder(arrangement).at(-1));
  assert.equal(recallFocused(recallNext(recallPrevious(walk))), arrangementOrder(arrangement)[0]);

  const empty = defaultArrangement([]);
  assert.deepEqual(recallWalk(empty).refs, []);
  assert.equal(recallFocused(recallWalk(empty)), null);
  assert.equal(recallAt(empty, 3).index, 0);
});

test('the palace mints no stochastic identity anywhere in its modules', async () => {
  const here = fileURLToPath(new URL('../src/techne/palace/', import.meta.url));
  const files = ['composition.ts', 'recall.ts', 'register.ts', 'PalaceInstrument.tsx'];
  for (const file of files) {
    const source = await readFile(`${here}${file}`, 'utf8');
    assert.doesNotMatch(source, /crypto\.randomUUID|Math\.random|Date\.now/, `${file} mints identity or time`);
  }
});
