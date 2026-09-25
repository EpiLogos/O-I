// The fresh chat is usable by default (owner commission 2026-09-20): no
// chooser on first Send, the draft passes to the harness verbatim (a leading
// `/model` is the harness's own command surface, never intercepted), and a
// new chat provisions into the face's project — Central when none is bound.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/chat-first-send.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const { chatProvisionTarget } = await import('../src/agent/chat/firstSend.ts');
const { parseContextItems, removeContextItem } = await import('../src/context/contextItems.ts');

test('a fresh chat provisions into the bound project, else Central', () => {
  assert.equal(chatProvisionTarget(undefined), '', 'Central root uses the native empty scope, not a child name');
  assert.equal(chatProvisionTarget(''), '');
  assert.equal(chatProvisionTarget('   '), '', 'a blank selection is Central root');
  assert.equal(chatProvisionTarget('Factory'), 'Factory');
  assert.equal(chatProvisionTarget(' O-I '), 'O-I', 'a real project name is kept, only padded');
});

test('slash-commands ride the draft verbatim: no interception, no palette', () => {
  // The composer reads the message as the draft minus its @context blocks;
  // a leading `/model` is not a context block, so it reaches the owner's
  // draft and prompt untouched. The kernel carrier is pinned verbatim in
  // Rust (`agency::tests::draft_text_reaches_the_owner_verbatim`).
  assert.deepEqual(parseContextItems('/model'), [], 'a slash-command is never read as an attachment');
  assert.deepEqual(parseContextItems('/model opus\n/model'), [], 'not even a multi-line command body');
  const draft = '/model';
  const items = parseContextItems(draft);
  let message = draft;
  for (const item of [...items].reverse()) message = message.slice(0, item.start) + message.slice(item.end);
  assert.equal(message.replace(/^\n+|\n+$/g, ''), '/model');
});

test('an attached context block and a slash-command coexist; the command stays in the message', () => {
  const block = '@context — Report · source/x · revision r1\n> quoted line';
  const draft = `${block}\n\n/model`;
  const items = parseContextItems(draft);
  assert.equal(items.length, 1);
  let message = draft;
  for (const item of [...items].reverse()) message = message.slice(0, item.start) + message.slice(item.end);
  assert.equal(message.replace(/^\n+|\n+$/g, ''), '/model', 'removing the attachment leaves the command exactly as typed');
  assert.equal(removeContextItem(draft, items[0]).trim(), '/model');
});
