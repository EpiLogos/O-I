import test from 'node:test';
import assert from 'node:assert/strict';
import { applyManualOverrides, computeLayout, MEMBER_RING_RADIUS } from '../src/techne/canvas/layout.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();
const representative = readings.find((reading) => reading.subject.subject_ref.startsWith('aikit:wiki:'));
const developmentDay = readings.find((reading) => reading.subject.subject_ref.startsWith('central:now:'));
const absentFacets = readings.find((reading) => reading.subject.subject_ref.startsWith('central:source:'));

test('layout is deterministic: the same fixture computes an identical layout, twice, from fresh copies', () => {
  for (const reading of readings) {
    const before = structuredClone(reading);
    const first = computeLayout(reading);
    const second = computeLayout(structuredClone(reading));
    assert.deepEqual(second, first, `${reading.reading_ref}: same input → same layout`);
    assert.deepEqual(computeLayout(reading), first, 'repeat calls do not drift');
    assert.deepEqual(reading, before, 'the reading is only read, never written');
  }
});

test('the QL constellation layout engages only when a warranted ql facet is present', () => {
  assert.equal(computeLayout(representative).scheme, 'ql-constellation', 'a warranted ql facet engages the QL layout');
  assert.equal(computeLayout(absentFacets).scheme, 'radial', 'no ql facet, no QL layout');
  assert.equal(computeLayout(developmentDay).scheme, 'radial', 'the development day discloses no ql facet');

  // A ql facet without its warrant is not a warrant: the layout stays radial.
  const unwarranted = structuredClone(absentFacets);
  unwarranted.ql = structuredClone(representative.ql);
  delete unwarranted.ql.warrant;
  assert.equal(computeLayout(unwarranted).scheme, 'radial', 'an unwarranted ql facet does not engage the QL layout');
});

test('the sixfold arrangement: members take positions 0..=5 clockwise from the top; the warranted address anchors below', () => {
  const layout = computeLayout(representative);
  assert.equal(layout.whole_ref, representative.whole.whole_ref);
  const whole = layout.nodes[0];
  assert.equal(whole.role, 'whole');
  assert.deepEqual({ x: whole.x, y: whole.y }, { x: 0, y: 0 }, 'the whole sits at the centre');

  const members = layout.nodes.filter((node) => node.role === 'member');
  assert.equal(members.length, representative.whole.member_refs.length);
  const angle = (index) => (-90 + 60 * index) * (Math.PI / 180);
  members.forEach((node, index) => {
    assert.equal(node.position, index, 'member i takes constellation position i');
    assert.equal(node.ring, 0);
    assert.ok(Math.abs(node.x - Math.cos(angle(index)) * MEMBER_RING_RADIUS) < 1e-12, `member ${index} x matches position ${index}`);
    assert.ok(Math.abs(node.y - Math.sin(angle(index)) * MEMBER_RING_RADIUS) < 1e-12, `member ${index} y matches position ${index}`);
    assert.equal(node.ref, representative.whole.member_refs[index], 'member order and refs are verbatim');
  });

  const address = layout.nodes.find((node) => node.role === 'ql-address');
  assert.ok(address, 'the warranted ql address is anchored');
  assert.equal(address.ref, representative.ql.address, 'the address ref is verbatim');
  assert.ok(Math.abs(address.y - MEMBER_RING_RADIUS * (4 / 3)) < 1e-12, 'the address anchors on the bottom axis, outside the ring');
  assert.ok(Math.abs(address.x) < 1e-12);

  // Every disclosed relation is present as an edge with both anchors placed.
  for (const relation of representative.whole.relations) {
    const edge = layout.edges.find((candidate) =>
      candidate.relation === relation.relation && candidate.from_ref === relation.from_ref && candidate.to_ref === relation.to_ref);
    assert.ok(edge, `relation "${relation.relation}" is an edge`);
    assert.ok(layout.nodes.some((node) => node.ref === edge.from_ref), 'from_ref is anchored');
    assert.ok(layout.nodes.some((node) => node.ref === edge.to_ref), 'to_ref is anchored');
  }
});

test('the radial layout is deterministic from member order when no ql facet is warranted', () => {
  const layout = computeLayout(developmentDay);
  const members = layout.nodes.filter((node) => node.role === 'member');
  assert.equal(members.length, developmentDay.whole.member_refs.length);
  const angle = (index) => (-90 + (360 / developmentDay.whole.member_refs.length) * index) * (Math.PI / 180);
  members.forEach((node, index) => {
    assert.equal(node.position, null, 'no sixfold position outside the QL scheme');
    assert.ok(Math.abs(node.x - Math.cos(angle(index)) * MEMBER_RING_RADIUS) < 1e-12);
    assert.ok(Math.abs(node.y - Math.sin(angle(index)) * MEMBER_RING_RADIUS) < 1e-12);
  });
});

test('relation edges carry the provider vocabulary verbatim — the edge label IS the fixture relation string', () => {
  for (const reading of readings) {
    const layout = computeLayout(reading);
    assert.equal(layout.edges.length, reading.whole.relations.length, `${reading.reading_ref}: every relation is an edge`);
    reading.whole.relations.forEach((relation, index) => {
      const edge = layout.edges[index];
      assert.equal(edge.relation, relation.relation, 'the edge label equals the fixture relation string, verbatim');
      assert.equal(edge.from_ref, relation.from_ref, 'from_ref verbatim');
      assert.equal(edge.to_ref, relation.to_ref, 'to_ref verbatim');
      assert.equal(edge.origin, relation.origin ?? null);
      assert.equal(edge.origin_ref, relation.origin_ref ?? null);
    });
  }
});

test('a reading with no whole lays out the subject alone as the bounded whole', () => {
  const { whole, ...subjectOnly } = structuredClone(absentFacets);
  const layout = computeLayout(subjectOnly);
  assert.equal(layout.whole_ref, subjectOnly.subject.subject_ref);
  assert.equal(layout.nodes.length, 1);
  assert.equal(layout.edges.length, 0);
});

test('manual arrangement overrides mutate presentation only — the reading and the base layout stay byte-identical', () => {
  const readingBefore = structuredClone(developmentDay);
  const layout = computeLayout(developmentDay);
  const layoutBefore = structuredClone(layout);

  const [first, second] = developmentDay.whole.member_refs;
  const overridden = applyManualOverrides(layout, {
    [first]: { x: 0.25, y: -0.1 },
    'not:a:node:in:this:reading': { x: 9, y: 9 },
  });

  assert.deepEqual(developmentDay, readingBefore, 'the reading is untouched — manual arrangement never feeds back');
  assert.deepEqual(layout, layoutBefore, 'the base layout is untouched');

  const moved = overridden.nodes.find((node) => node.ref === first);
  assert.deepEqual({ x: moved.x, y: moved.y }, { x: 0.25, y: -0.1 }, 'the dragged member takes its override position');
  const untouched = overridden.nodes.find((node) => node.ref === second);
  const original = layout.nodes.find((node) => node.ref === second);
  assert.deepEqual({ x: untouched.x, y: untouched.y }, { x: original.x, y: original.y }, 'other nodes keep their computed positions');
  assert.equal(overridden.scheme, layout.scheme, 'the scheme is presentation-stable under arrangement');

  // Unknown refs are ignored; the same overrides re-applied are idempotent.
  assert.equal(overridden.nodes.some((node) => node.ref === 'not:a:node:in:this:reading'), false);
  assert.deepEqual(applyManualOverrides(overridden, { [first]: { x: 0.25, y: -0.1 } }), overridden);
});
