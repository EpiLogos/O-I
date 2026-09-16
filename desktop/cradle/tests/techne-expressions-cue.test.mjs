import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';
import { buildExpressionCue, expressionDocumentFromCue } from '../src/techne/expressions/cue.ts';
import { embody } from '../src/techne/expressions/embody.ts';

const representative = await loadFixture('representative-subject-v1.json');
const absent = await loadFixture('absent-facets-v1.json');

const SUBJECT = representative.subject.subject_ref;
const ABSENT_SUBJECT = absent.subject.subject_ref;
const SOURCE_REF = 'central:source:control:root:Control/user/civil-time-policy.json';
const SOURCE_REVISION = 'central.content-fnv1a64/v1:741:0ef7b5aaedd35e27';

const selection = (overrides = {}, subjectRef = SUBJECT, readingRef = representative.reading_ref) => ({
  selection_ref: 'ql.techne:selection:t7',
  subject_ref: subjectRef,
  reading_ref: readingRef,
  source_ref: SOURCE_REF,
  source_revision: SOURCE_REVISION,
  coordinate_ref: null,
  agent_session_ref: 'agent-session/lesson',
  selection_standing: 'current',
  instrument: 'canvas',
  ...overrides,
});

test('representative fixture → the cue builds with subject binding refs byte-verbatim', () => {
  const cue = buildExpressionCue(representative, selection());
  assert.equal(cue.schema, 'ql.techne-expression-cue/v1');
  assert.equal(cue.reading_ref, 'ql.techne:reading:fixture:representative-subject@1');
  assert.equal(cue.subject.subject_ref, 'aikit:wiki:central:wiki:project:quaternal-logic#l5-techne-instrument-constellation');
  assert.equal(cue.subject.native_owner, 'aikit/semantic-wiki');
  // Provenance source_ref and revision carried byte-verbatim, ReadingRef-shaped.
  assert.deepEqual(cue.subject.sources, [
    { ref: SOURCE_REF, revision: SOURCE_REVISION, availability: 'available' },
  ]);
  // Scene focus: the bound Expression's scene, verbatim.
  assert.deepEqual(cue.scene_focus, {
    expression_ref: 'oi:expression:l5-techne-constellation',
    scene_ref: 'oi:expression:l5-techne-constellation/scene/opening',
    revision: '3',
  });
  // The agent-session ref rides the selection verbatim, never minted.
  assert.equal(cue.selection.agent_session_ref, 'agent-session/lesson');
  assert.equal(cue.selection.selection_ref, 'ql.techne:selection:t7');
});

test('representative fixture → QL cues present, carrying lens mef:lens:L5@1 and the warrant provenance verbatim', () => {
  const cue = buildExpressionCue(representative, selection());
  assert.ok(cue.ql, 'a warranted ql facet produces QL cues');
  assert.equal(cue.ql.lens_ref, 'mef:lens:L5@1');
  assert.equal(cue.ql.address, 'ql:structural:2.0.0:field:A:1:D3');
  assert.equal(cue.ql.shape_ref, 'ql:shape:1.0.0:6x6:direct-conjugate');
  assert.deepEqual(cue.ql.warrant, {
    result_class: 'deterministic',
    evidence_refs: ['ql:fixture:techne-representative-evidence'],
    provenance_ref: 'ql-mef:provider:registry-disclosure',
  });
});

test('absent-facets fixture → the cue builds WITHOUT QL cues', () => {
  const cue = buildExpressionCue(absent, selection({}, ABSENT_SUBJECT, absent.reading_ref));
  assert.equal(cue.ql, null, 'no warranted ql facet — no QL cues, absence is data');
  assert.equal(cue.scene_focus, null, 'no Expression is bound — no scene focus');
  assert.deepEqual(cue.subject.sources, [
    {
      ref: 'central:source:control:root:Control/user/placement.json',
      revision: 'central.content-fnv1a64/v1:905:741650d181e84aac',
      availability: 'available',
    },
  ]);
});

test('absent-facets fixture → embody() refuses with the conjugate Expression disclosure reason, word for word', () => {
  const gate = embody(absent, selection({}, ABSENT_SUBJECT, absent.reading_ref));
  assert.equal(gate.embodyable, false);
  const disclosed = absent.disclosure.instruments.find((entry) => entry.instrument === 'expressions');
  assert.equal(disclosed.reason, 'no Expression is bound to this subject');
  assert.equal(gate.reason, disclosed.reason, 'capability honesty mirrors the disclosure reason exactly');
});

test('a mutated reading (ql present, warrant stripped) is refused with an explicit error — never a best-effort cue', () => {
  const mutated = structuredClone(representative);
  delete mutated.ql.warrant;
  assert.throws(() => buildExpressionCue(mutated, selection()), /ql\.warrant.*only when warranted/);
});

test('a selection on another subject is refused by cue and embodiment alike — one subject', () => {
  const stray = selection({}, 'another:subject');
  assert.throws(() => buildExpressionCue(representative, stray), /one subject/);
  assert.throws(() => embody(representative, stray), /one subject/);
});

test('selection standing maps through the descriptor unchanged', () => {
  for (const standing of ['current', 'field-advanced', 'stale']) {
    const gate = embody(representative, selection({ selection_standing: standing }));
    assert.equal(gate.embodyable, true);
    assert.equal(gate.descriptor.selection_standing, standing);
  }
  const unstated = embody(representative, selection({ selection_standing: null }));
  assert.equal(unstated.descriptor.selection_standing, null, 'an unstated standing stays unstated');
});

test('the representative subject is embodyable; the descriptor carries subject/source/coordinate refs verbatim', () => {
  const gate = embody(representative, selection({ coordinate_ref: 'ql:coordinate:fixture:1' }));
  assert.equal(gate.embodyable, true);
  assert.deepEqual(gate.descriptor, {
    ref: `ql.techne:source:${SUBJECT}`,
    title: `Technē · ${SUBJECT}`,
    selection_standing: 'current',
    snapshot: {
      subject_ref: SUBJECT,
      source_ref: SOURCE_REF,
      source_revision: SOURCE_REVISION,
      coordinate_ref: 'ql:coordinate:fixture:1',
      reading_ref: 'ql.techne:reading:fixture:representative-subject@1',
      snapshot_revision: null,
      selection_ref: 'ql.techne:selection:t7',
      expression_focus_ref: 'oi:expression:l5-techne-constellation/scene/opening',
    },
  });
});

test('the embodiment gate also admits a scene embodiment (binding, no ql)', () => {
  const boundNoQl = structuredClone(absent);
  boundNoQl.expressions = [{ expression_ref: 'expression:placed', scene_ref: 'expression:placed:scene:main', revision: '1' }];
  const gate = embody(boundNoQl, selection({}, ABSENT_SUBJECT, absent.reading_ref));
  assert.equal(gate.embodyable, true, 'an Expression binding is a scene embodiment even without QL depth');
  assert.equal(gate.descriptor.ref, `ql.techne:source:${ABSENT_SUBJECT}`);
});

test('the composed Expression document binds the subject by ref — never a cloned identity', () => {
  const reading = structuredClone(representative);
  reading.expressions = [{ expression_ref: 'expression:l5-constellation', scene_ref: 'expression:l5-constellation:scene:opening', revision: '1' }];
  const cue = buildExpressionCue(reading, selection());
  const document = expressionDocumentFromCue(cue);
  assert.equal(document.schema, 'oi.expression/v1');
  assert.equal(document.expression_ref, 'expression:l5-constellation');
  const [entity] = Object.values(document.entities);
  assert.equal(document.provenance, cue.subject.sources, 'the document provenance is the cue\'s own source list');
  assert.equal(entity.subject.subject_ref, SUBJECT, 'the real subject ref, verbatim');
  assert.equal(entity.subject.native_owner, 'aikit/semantic-wiki');
  assert.deepEqual(entity.subject.sources, cue.subject.sources);
  assert.ok(!document.expression_ref.startsWith(entity.subject.subject_ref) && entity.subject.ref === undefined, 'no shadow identity fields');
});

test('the composer refuses an unbound subject and a foreign-grammar identity without re-keying it', () => {
  const unbound = buildExpressionCue(absent, selection({}, ABSENT_SUBJECT, absent.reading_ref));
  assert.throws(() => expressionDocumentFromCue(unbound), /No Expression is bound/);
  const foreign = buildExpressionCue(representative, selection());
  assert.throws(() => expressionDocumentFromCue(foreign), /owner's grammar/, 'the fixture identity is never translated into the desktop grammar');
});

test('the bridge never mints ids: no uuid or random source anywhere under src/techne/expressions', () => {
  const dir = fileURLToPath(new URL('../src/techne/expressions/', import.meta.url));
  const files = [];
  const walk = (entry) => {
    for (const name of readdirSync(entry, { withFileTypes: true })) {
      const path = `${entry}${name.name}`;
      if (name.isDirectory()) walk(`${path}/`);
      else files.push(path);
    }
  };
  walk(dir);
  assert.ok(files.length >= 4, `the lane's files are present (${files.length})`);
  for (const path of files) {
    const body = readFileSync(path, 'utf8');
    assert.doesNotMatch(body, /uuid/i, `${path} mints no uuid`);
    assert.doesNotMatch(body, /random/i, `${path} draws no randomness`);
  }
});
