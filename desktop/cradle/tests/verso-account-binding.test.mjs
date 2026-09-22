// The Technē verso summon binds to the EXACT native work the hosted
// application is standing on (owner Wayfinder §10, PR #420 gap 4): a summon
// may carry the current Expression / revision / Scene / entity-or-relation
// occurrence, and that carried subject takes precedence over the kernel's
// global focus fallback. It is untrusted frame data, so it is sanitised to
// refs only here and validated through the owner where the account is read.
// Language-neutral (node --test, no browser); the cross-iframe wiring above
// it is proven by the current-app browser walk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({ root, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
const { resolveVersoSubject } = await vite.ssrLoadModule('/src/expression/versoAccount.ts');
test.after(() => vite.close());

const focus = { ref: 'expression:global-focus', kind: 'expression', native_owner: 'oi' };
const hostSubject = { ref: 'expression:host-workspace', kind: 'expression', title: 'Host', project: 'Notes' };

test('a carried native work takes precedence over the kernel global focus', () => {
  const carried = {
    ref: 'expression:open-work', kind: 'expression', nativeOwner: 'oi', title: 'The open work',
    revision: 7, sceneRef: 'expression:open-work:scene:2', entityRef: 'expression:open-work:entity:a',
    relationRef: 'relation:knows',
  };
  const subject = resolveVersoSubject(focus, hostSubject, carried);
  // The subject the person is actually looking at — not the global focus.
  assert.equal(subject.ref, 'expression:open-work');
  assert.equal(subject.revision, 7);
  assert.equal(subject.sceneRef, 'expression:open-work:scene:2');
  assert.equal(subject.entityRef, 'expression:open-work:entity:a');
  assert.equal(subject.relationRef, 'relation:knows');
  assert.equal(subject.title, 'The open work');
});

test('an absent carried subject preserves the existing focus-first resolution', () => {
  const none = resolveVersoSubject(focus, hostSubject, undefined);
  assert.equal(none.ref, 'expression:global-focus', 'no carried work -> kernel global focus, unchanged');
  const nullCarried = resolveVersoSubject(focus, hostSubject, null);
  assert.equal(nullCarried.ref, 'expression:global-focus', 'null carried is not a subject');
  // With no focus and no carried work, the host workspace subject stands.
  const host = resolveVersoSubject(undefined, hostSubject, undefined);
  assert.equal(host.ref, 'expression:host-workspace');
  // Nothing at all -> no subject, never minted.
  assert.equal(resolveVersoSubject(undefined, undefined, undefined), null);
});

test('a malformed carried subject is refused, not trusted, and falls through', () => {
  // A refless / non-string-ref pointer is not a subject.
  assert.equal(resolveVersoSubject(focus, hostSubject, {}).ref, 'expression:global-focus');
  assert.equal(resolveVersoSubject(focus, hostSubject, { ref: 42 }).ref, 'expression:global-focus');
  assert.equal(resolveVersoSubject(focus, hostSubject, { ref: '' }).ref, 'expression:global-focus');
});

test('the carried pointer is sanitised to refs only — no forged content survives', () => {
  const dirty = {
    ref: 'expression:open-work',
    revision: 'not-a-number',            // wrong type -> dropped
    sceneRef: { evil: true },            // wrong type -> dropped
    entityRef: null,                     // explicit null is a valid cleared occurrence
    title: 12345,                        // wrong type -> dropped
    document: { forged: 'content' },     // unknown field -> never carried
    content: 'a whole forged body',      // unknown field -> never carried
  };
  const subject = resolveVersoSubject(focus, hostSubject, dirty);
  assert.equal(subject.ref, 'expression:open-work');
  assert.equal(subject.revision, undefined, 'a non-number revision is dropped, never coerced');
  assert.equal(subject.sceneRef, undefined, 'a non-ref sceneRef is dropped');
  assert.equal(subject.entityRef, null, 'an explicit null occurrence is preserved as cleared');
  assert.equal(subject.title, undefined, 'a non-string title is dropped');
  const serialised = JSON.stringify(subject);
  assert.ok(!serialised.includes('forged'), 'unknown fields (forged content) never survive sanitisation');
  assert.ok(!serialised.includes('a whole forged body'), 'no forged body is carried');
});
