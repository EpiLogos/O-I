import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';

const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const registry = await server.ssrLoadModule('/src/techne/registry.tsx');
  const wiring = await server.ssrLoadModule('/src/techne/expressions/register.ts');
  const k9 = await server.ssrLoadModule('/src/instrument/source.ts');

  const representative = await loadFixture('representative-subject-v1.json');
  const absent = await loadFixture('absent-facets-v1.json');
  const SUBJECT = representative.subject.subject_ref;

  const selection = (overrides = {}, subjectRef = SUBJECT, readingRef = representative.reading_ref) => ({
    selection_ref: 'ql.techne:selection:t7-wiring',
    subject_ref: subjectRef,
    reading_ref: readingRef,
    source_ref: 'central:source:control:root:Control/user/civil-time-policy.json',
    source_revision: 'central.content-fnv1a64/v1:741:0ef7b5aaedd35e27',
    instrument: 'canvas',
    selection_standing: 'current',
    ...overrides,
  });

  // A stand-in for the QL owner's registered FocusedInstrumentSource: the
  // alias under test must forward to it and never fabricate its facts.
  const ownerReads = [];
  const owner = {
    ref: 'ql:k9:owner',
    title: 'Focused instrument (owner stand-in)',
    read: async () => {
      ownerReads.push(1);
      return {
        schema: 'ql.focused-instrument/v1',
        available: true,
        event: { event_ref: 'e:1', subject_ref: SUBJECT, profile_generation: 1 },
        live_cursor: { event_ref: 'e:1', subject_ref: SUBJECT, profile_generation: 1, field_generation: 'g', samples_elapsed: '0' },
        presented_cursor: { event_ref: 'e:1', subject_ref: SUBJECT, profile_generation: 1, field_generation: 'g', samples_elapsed: '0' },
        temporal: 'live',
        tracking: 'follow',
        focus: { focus: 'm1', available: true, current: true, source_refs: [], payload: null, standing: 'owner' },
        clock: { presentation: { view: 'assembled' }, owner_clock: null, field_ref: 'f', centre_ref: 'c', standing: 'owner' },
        personal_current: true,
        standing: 'owner',
      };
    },
    readBimba: async () => ({ contract: 'ql.focused-instrument/v1', source_revision: 'r', items: [], standing: 'owner' }),
    command: async (command) => ({ standing: 'applied', operation: command.kind }),
  };

  test('registerExpressionsSurface mounts the Expressions bridge exactly once, per the registry law', () => {
    const stop = wiring.registerExpressionsSurface();
    assert.equal(typeof registry.techneSurface('expressions'), 'function', 'the bridge is the expressions instrument component');
    assert.throws(() => wiring.registerExpressionsSurface(), /already registered/);
    stop();
    assert.equal(registry.techneSurface('expressions'), undefined, 'unregistration returns the registry to rest');
  });

  test('the K9 alias resolves ql.techne:source:<subject_ref> to the owner source, guarded to one subject', async () => {
    const gate = wiring.registerTechneFocusedInstrumentSource({ reading: representative, selection: selection(), owner });
    assert.equal(gate.registered, true);
    const alias = k9.focusedInstrumentSource(`ql.techne:source:${SUBJECT}`);
    assert.ok(alias, 'the descriptor ref is resolvable in the K9 registry');
    assert.equal(alias.title, `Technē · ${SUBJECT}`);
    const snapshot = await alias.read();
    assert.equal(ownerReads.length, 1, 'facts come from the owner, once');
    assert.equal(snapshot.event.subject_ref, SUBJECT);
    assert.equal((await alias.readBimba()).standing, 'owner');
    assert.equal((await alias.command({ kind: 'set-focus', focus: 'm2' })).operation, 'set-focus');
    gate.unregister();
    assert.equal(k9.focusedInstrumentSource(`ql.techne:source:${SUBJECT}`), undefined);
  });

  test('the alias refuses a snapshot on another subject — one subject, one embodiment', async () => {
    const drift = { ...owner, read: async () => ({ ...(await owner.read()), event: { event_ref: 'e:2', subject_ref: 'another:subject', profile_generation: 1 } }) };
    const gate = wiring.registerTechneFocusedInstrumentSource({ reading: representative, selection: selection(), owner: drift });
    assert.equal(gate.registered, true);
    const alias = k9.focusedInstrumentSource(`ql.techne:source:${SUBJECT}`);
    await assert.rejects(() => alias.read(), /one subject, one embodiment/);
    gate.unregister();
  });

  test('a selection that neither warrants ql nor binds an Expression is not registered — the honest reason returns', () => {
    const refused = wiring.registerTechneFocusedInstrumentSource({
      reading: absent,
      selection: selection({}, absent.subject.subject_ref, absent.reading_ref),
      owner,
    });
    assert.deepEqual(refused, { registered: false, reason: 'no Expression is bound to this subject' });
    assert.equal(k9.focusedInstrumentSource(`ql.techne:source:${absent.subject.subject_ref}`), undefined);
  });
} finally {
  await server.close();
}
