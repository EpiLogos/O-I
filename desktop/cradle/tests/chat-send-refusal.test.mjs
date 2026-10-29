// O-I #741 round two (lane G): a send to a session that waits on you is refused by AIKit, the owner of the send path, in its own three
// parts (ai-kit encounter_service.rs needs_input_guard, `encounter.target_needs_input`), and the composer shows them as AIKit wrote
// them: what stands, that nothing was sent, and the next lawful step — with no Retry, which would meet the same refusal until the
// request is answered. Channels: SCRIPTED — the refusal is AIKit's message as the kernel carries it (kernel/src/agency.rs
// `{message} [{code}]`), rendered on the server. Not a screen pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const here = dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(join(here, '.chat-send-refusal-'));
test.after(() => rm(temp, {recursive: true, force: true}));
await build({
  entryPoints: {composer: join(here, '../src/agent/chat/ChatComposer.tsx'), session: join(here, '../src/encounter/session.ts')},
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', define: {__CRADLE_WALK__: 'false'},
  loader: {'.css': 'empty'}, external: ['react', 'react-dom', 'react/jsx-runtime'],
  outdir: temp, outExtension: {'.js': '.mjs'}, logLevel: 'error',
});
const {ChatComposer} = await import(pathToFileURL(join(temp, 'composer.mjs')));
const {sendRefusalOf} = await import(pathToFileURL(join(temp, 'session.mjs')));

// AIKit's refusal as the session sees it: String(error) of the kernel's "message [code]".
const AIKIT = 'Error: agent-session/a waits on you: 1 permission request pending (Write fixtures/handoff.json).\nNothing was sent; the words stay in the draft.\n' +
  'Answer the request in the session\'s thread (Allow or Deny), or stop the turn. [encounter.target_needs_input]';

test('the owner\'s three-part refusal is read line by line, verbatim, and a resend is not offered', () => {
  assert.deepEqual(sendRefusalOf(AIKIT), {code: 'encounter.target_needs_input',
    fact: 'agent-session/a waits on you: 1 permission request pending (Write fixtures/handoff.json).',
    consequence: 'Nothing was sent; the words stay in the draft.',
    action: 'Answer the request in the session\'s thread (Allow or Deny), or stop the turn.', retry: false});
  assert.equal(sendRefusalOf('Error: Encounter is not attached [encounter.not_attached]'), null, 'a one-line refusal is not made three');
  assert.equal(sendRefusalOf('a\nb\nc'), null, 'no owner code, no owner refusal');
  assert.equal(sendRefusalOf('a\nb\nc [encounter.other]').retry, true, 'another three-part refusal may be retried');
});

test('the composer shows the refusal in AIKit\'s words with the next lawful step, and no Retry', () => {
  // A session AIKit reports with a turn in flight, waiting on its permission request.
  const connection = {status: {resident: true, native_session_id: 'native-1', state: 'TurnInFlight', error: null}, providers: []};
  const props = {draft: 'And the tests?', pending: false, busy: false, editable: true, promptAllowed: true, cancelAllowed: true,
    onDraft() {}, onSend() {}, onCancel() {}, onRetry() {}, connection, tools: {pickFiles: async () => {}}, draftFailed: false,
    onRecover() {}, paged: false, onLatest() {}, sendState: {phase: 'failed', error: AIKIT, refusal: sendRefusalOf(AIKIT)}};
  const out = renderToStaticMarkup(createElement(ChatComposer, props));
  assert.match(out, /data-code="encounter.target_needs_input"/);
  assert.match(out, /waits on you: 1 permission request pending \(Write fixtures\/handoff.json\)/);
  assert.match(out, /Nothing was sent; the words stay in the draft\./);
  assert.match(out, /<strong>Next:<\/strong> Answer the request in the session(&#x27;|')s thread \(Allow or Deny\), or stop the turn\./);
  assert.doesNotMatch(out, />Retry</, 'a resend meets the same refusal until the request is answered');
  // Any other failure keeps its plain line and its Retry.
  const plain = renderToStaticMarkup(createElement(ChatComposer, {...props, sendState: {phase: 'failed', error: 'boom'}}));
  assert.match(plain, /Message not sent\./);
  assert.match(plain, />Retry</);
});
