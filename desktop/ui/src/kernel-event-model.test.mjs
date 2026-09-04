import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KERNEL_EVENT_SCHEMA,
  KERNEL_EVENT_TAGS,
  KERNEL_EVENT_TOPIC,
  KERNEL_EVENT_VERSION,
  bindKernelEventSource,
  createFocusConsumer,
  createKernelEventSource,
  emptyFocus,
  focusFromSnapshot,
  normalizeFocus,
  parseKernelEventEnvelope,
  reduceFocus,
  sameFocus,
} from './kernel-event-model.mjs';

const SUBJECT = {
  ref: 'central/file:src/project.rs',
  kind: 'file',
  native_owner: 'central',
  provenance: { source: 'world tree', revision: 'abc123' },
};

const NEXT_SUBJECT = {
  ref: 'agent-session:developer:1',
  kind: 'agent-session',
  native_owner: 'ai-kit',
  provenance: { source: 'AIKit SessionSpace application focus' },
};

function focusEnvelope(focus) {
  return { schema: KERNEL_EVENT_SCHEMA, version: KERNEL_EVENT_VERSION, event: 'focus_changed', focus };
}

test('every architecture §5 event exists in the renderer contract and parses from the wire', () => {
  assert.equal(KERNEL_EVENT_TAGS.length, 13);
  const world = { ref: 'world:personal', kind: 'world', native_owner: 'central', provenance: { source: 'Central world recognition' } };
  const subject = SUBJECT;
  const envelopes = [
    { event: 'focus_changed', focus: { subject: SUBJECT } },
    { event: 'world_changed', world, summary: 'World recognition re-observed.' },
    { event: 'source_changed', source: subject, summary: 'Source saved.' },
    { event: 'activity_updated', activity_ref: 'activity:1', subject, summary: 'Responding.' },
    { event: 'session_changed', session: subject, summary: 'Session opened.' },
    { event: 'knowledge_changed', subject, summary: 'Neighbourhood re-read.' },
    { event: 'attention_raised', attention_ref: 'attention:1', subject, summary: 'Recognition requested.' },
    { event: 'attention_resolved', attention_ref: 'attention:1', summary: 'Recognised.' },
    { event: 'run_changed', run: subject, summary: 'Run advanced.' },
    { event: 'journey_changed', journey: subject, summary: 'Journey revised.' },
    { event: 'material_changed', material: subject, summary: 'Placement changed.' },
    { event: 'composition_changed', condition: 'partial', summary: 'One provider degraded.' },
    { event: 'shared_field_changed', field: subject, summary: 'Contribution admitted.' },
  ];
  assert.equal(envelopes.length, KERNEL_EVENT_TAGS.length);

  for (const envelope of envelopes) {
    const parsed = parseKernelEventEnvelope({
      schema: KERNEL_EVENT_SCHEMA,
      version: KERNEL_EVENT_VERSION,
      ...envelope,
    });
    assert.equal(parsed.event, envelope.event);
    assert.equal(parsed.schema, undefined, 'the transport envelope is stripped from the typed event');
    assert.equal(parsed.version, undefined);
  }
});

test('unknown events wrong schema and wrong version fail closed instead of degrading', () => {
  assert.throws(() => parseKernelEventEnvelope({ schema: KERNEL_EVENT_SCHEMA, version: KERNEL_EVENT_VERSION, event: 'teleport_subject' }), /Unknown kernel event/);
  assert.throws(() => parseKernelEventEnvelope({ schema: 'oi.kernel-event/v2', version: 2, event: 'focus_changed' }), /schema/);
  assert.throws(() => parseKernelEventEnvelope({ schema: KERNEL_EVENT_SCHEMA, version: 0, event: 'focus_changed' }), /version/);
  assert.throws(() => parseKernelEventEnvelope(null), /must be an object/);
});

test('focus consumer derives the one relation from events and replaces rather than accumulates', () => {
  const consumer = createFocusConsumer();
  assert.equal(consumer.current(), null, 'cold start is B0 No focus');
  assert.equal(consumer.subject(), null);

  consumer.apply(focusEnvelope({ subject: SUBJECT, world: { ref: 'world:personal', kind: 'world', native_owner: 'central', provenance: { source: 'Central world recognition' } } }));
  assert.equal(consumer.subject().ref, SUBJECT.ref);
  assert.equal(consumer.current().world.ref, 'world:personal');

  consumer.apply(focusEnvelope({ subject: NEXT_SUBJECT }));
  const focus = consumer.current();
  assert.equal(focus.subject.ref, NEXT_SUBJECT.ref, 'exactly one current focus relation');
  assert.equal(focus.world, null, 'the kernel owns the relation; the renderer never fills it in');
});

test('non focus events never move focus', () => {
  const consumer = createFocusConsumer(focusFromSnapshot({ selection: SUBJECT }));
  const before = consumer.current();
  consumer.apply(parseKernelEventEnvelope({
    schema: KERNEL_EVENT_SCHEMA,
    version: KERNEL_EVENT_VERSION,
    event: 'run_changed',
    run: NEXT_SUBJECT,
    summary: 'Run advanced.',
  }));
  assert.deepEqual(consumer.current(), before);
  assert.equal(reduceFocus(before, null), before);
  assert.equal(consumer.eventDerived(), false, 'non-focus events do not make the stream authoritative');
});

test('kernel focus that arrives after mount is adopted from the snapshot pull', () => {
  // The second-mount trajectory (03 §B detaching and returning): the surface
  // mounts into a kernel that already holds focus, and the pull — not an event
  // — is the first kernel fact to reach it.
  const consumer = createFocusConsumer();
  assert.equal(consumer.current(), null);

  const adopted = consumer.seed(focusFromSnapshot({ selection: SUBJECT }));
  assert.equal(adopted?.subject.ref, SUBJECT.ref, 'the pull is the kernel\'s own focus, so it is adopted');
  assert.equal(consumer.subject().ref, SUBJECT.ref);
  assert.equal(consumer.eventDerived(), false);

  // A repeated pull carrying the same relation keeps identity, so a polling
  // surface re-pulling the unchanged kernel does not re-render the world.
  const again = consumer.seed({ subject: { ...SUBJECT } });
  assert.equal(again, adopted);
  assert.equal(consumer.current(), adopted);

  // A changed relation is still adopted: the pull is the newest kernel fact.
  const moved = consumer.seed(normalizeFocus({ subject: NEXT_SUBJECT }));
  assert.equal(moved?.subject.ref, NEXT_SUBJECT.ref);
});

test('after the first FocusChanged a snapshot seed is refused and cannot clobber event-derived focus', () => {
  const consumer = createFocusConsumer(focusFromSnapshot({ selection: SUBJECT }));
  consumer.apply(focusEnvelope({
    subject: NEXT_SUBJECT,
    world: { ref: 'world:personal', kind: 'world', native_owner: 'central', provenance: { source: 'Central world recognition' } },
  }));
  assert.equal(consumer.eventDerived(), true);
  assert.equal(consumer.subject().ref, NEXT_SUBJECT.ref);

  assert.equal(
    consumer.seed(focusFromSnapshot({ selection: SUBJECT })),
    null,
    'a late pull is older than the event stream',
  );
  assert.equal(consumer.subject().ref, NEXT_SUBJECT.ref, 'event-derived focus survives the seed');
  assert.equal(consumer.current().world.ref, 'world:personal');
});

test('sameFocus compares kernel facts, not object identity', () => {
  const relation = normalizeFocus({ subject: SUBJECT });
  assert.equal(sameFocus(relation, normalizeFocus({ subject: { ...SUBJECT } })), true);
  assert.equal(sameFocus(relation, normalizeFocus({ subject: NEXT_SUBJECT })), false);
  assert.equal(sameFocus(relation, null), false);
  assert.equal(sameFocus(null, null), true);
  assert.equal(sameFocus(emptyFocus(), normalizeFocus({})), true, 'absent slots compare equal to absent slots');
});

test('the source fans one subscription out to many consumers and isolates consumer failure', () => {
  const source = createKernelEventSource();
  const seen = [];
  const unsubscribe = source.subscribe((envelope) => seen.push(envelope.event));
  source.subscribe(() => {
    throw new Error('a broken surface must not break the others');
  });

  const delivered = source.ingest(focusEnvelope({ subject: SUBJECT }));
  assert.equal(delivered.event, 'focus_changed');
  assert.deepEqual(seen, ['focus_changed']);
  assert.equal(source.drainErrors().length, 1, 'the failure is reported, not swallowed');

  unsubscribe();
  source.ingest(focusEnvelope({ subject: NEXT_SUBJECT }));
  assert.equal(seen.length, 1, 'unsubscribe stops delivery');
  assert.equal(source.events().length, 2, 'the event log keeps what the kernel pushed');
});

test('bootstrap reads kernel state from the snapshot pull never from component-local state', () => {
  assert.deepEqual(
    focusFromSnapshot({
      focus: { world: { ref: 'world:personal', kind: 'world', native_owner: 'central', provenance: { source: 'recognition' } }, subject: SUBJECT },
    }),
    normalizeFocus({ world: { ref: 'world:personal', kind: 'world', native_owner: 'central', provenance: { source: 'recognition' } }, subject: SUBJECT }),
  );
  assert.equal(focusFromSnapshot({ selection: SUBJECT }).subject.ref, SUBJECT.ref, 'older snapshots carry the same kernel fact as selection');
  assert.deepEqual(focusFromSnapshot({}), null);
  assert.deepEqual(emptyFocus(), { world: null, project: null, subject: null, journey: null, agency_encounter: null });
});

test('one host binding feeds the whole renderer and a missing transport degrades honestly', async () => {
  const source = createKernelEventSource();
  const seen = [];
  source.subscribe((envelope) => seen.push(envelope));
  let delivered = [];
  const binding = bindKernelEventSource(source, async (topic, handler) => {
    assert.equal(topic, KERNEL_EVENT_TOPIC);
    delivered.push(handler);
    return () => {
      delivered = delivered.filter((candidate) => candidate !== handler);
    };
  });
  await binding.ready;
  assert.equal(source.status(), 'live', 'the renderer subscribes once and reports the seam as live');

  delivered[0]({ payload: focusEnvelope({ subject: SUBJECT }) });
  assert.equal(seen[0].focus.subject.ref, SUBJECT.ref);
  binding.stop();
  assert.equal(delivered.length, 0, 'stopping releases the single host subscription');

  const absent = createKernelEventSource();
  await bindKernelEventSource(absent, async () => {
    throw new Error('no native bridge (browser preview)');
  }).ready;
  assert.equal(absent.status(), 'degraded', 'no transport is an observation, not a fake event stream');
  assert.match(String(absent.drainErrors()[0]), /browser preview/);
});

test('malformed kernel payloads are reported and never delivered as events', () => {
  const source = createKernelEventSource();
  const seen = [];
  source.subscribe((envelope) => seen.push(envelope));
  assert.equal(source.ingest({ schema: KERNEL_EVENT_SCHEMA, version: KERNEL_EVENT_VERSION }), null);
  assert.equal(source.ingest('focus_changed'), null);
  assert.equal(source.ingest(focusEnvelope({ subject: SUBJECT })).focus.subject.ref, SUBJECT.ref);
  assert.equal(seen.length, 1);
  assert.equal(source.drainErrors().length, 2);
});
