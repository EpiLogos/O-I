// lane-5 T22 relay: the standalone Library's workspace-mode request carries the kernel ref an adopted entry is bound to (ref) and
// the entry it means (id). A request without them relays exactly as before; a malformed value is dropped, never coerced.
// Channel: scripted (the pure reader, run under the cradle's TypeScript loader) plus the wiring of the host and the shell listener.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {relayedWorkspaceMode, workspaceModeDetail, kernelRefOf} = await import('../src/library/workspaceModeRelay.ts');

test('a shell reads the relayed detail: the mode, a kernel ref only for Expressions, and a bounded entry id', () => {
  assert.deepEqual(workspaceModeDetail({mode: 'expressions'}), {mode: 'expressions'});
  assert.deepEqual(workspaceModeDetail({mode: 'expressions', ref: KERNEL, id: 'doc-1'}), {mode: 'expressions', ref: KERNEL, id: 'doc-1'});
  assert.deepEqual(workspaceModeDetail({mode: 'techne', ref: KERNEL}), {mode: 'techne'}, 'a ref is read for Expressions only');
  assert.deepEqual(workspaceModeDetail({mode: 'expressions', ref: 'draft:x', id: ''}), {mode: 'expressions'});
  assert.equal(workspaceModeDetail({mode: 'live'}), null);
  assert.equal(workspaceModeDetail(undefined), null);
  assert.equal(workspaceModeDetail('expressions'), null);
});

const KERNEL = 'expression:abc123';

test('a bare Expressions workspace-mode request relays exactly as before', () => {
  assert.deepEqual(relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions'}), {mode: 'expressions'});
});

test('the kernel ref and the entry id travel on the relay when the request names them', () => {
  assert.deepEqual(
    relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions', ref: KERNEL, id: 'doc-1'}),
    {mode: 'expressions', ref: KERNEL, id: 'doc-1'},
  );
  assert.deepEqual(
    relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions', id: 'doc-2'}),
    {mode: 'expressions', id: 'doc-2'},
    'an id-only request (the browser draft) carries no ref',
  );
});

test('a malformed ref or id is dropped and the request still relays as the bare mode', () => {
  assert.deepEqual(relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions', ref: 'not-a-ref'}), {mode: 'expressions'});
  assert.deepEqual(relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions', ref: 42, id: ''}), {mode: 'expressions'});
  assert.deepEqual(relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions', ref: `expression:${'x'.repeat(600)}`}), {mode: 'expressions'});
  assert.deepEqual(relayedWorkspaceMode({request: 'workspace-mode', mode: 'expressions', id: 'i'.repeat(300)}), {mode: 'expressions'});
});

test('only the Expressions workspace-mode request relays; other host requests do not', () => {
  assert.equal(relayedWorkspaceMode({request: 'workspace-mode', mode: 'techne', ref: KERNEL}), null);
  assert.equal(relayedWorkspaceMode({request: 'close-library'}), null);
  assert.equal(relayedWorkspaceMode({request: 'workspace-mode'}), null);
});

test('kernelRefOf accepts only a kernel Expression ref within the length bound', () => {
  assert.equal(kernelRefOf(KERNEL), KERNEL);
  assert.equal(kernelRefOf('expression:'), 'expression:');
  assert.equal(kernelRefOf('draft:abc'), undefined);
  assert.equal(kernelRefOf(undefined), undefined);
  assert.equal(kernelRefOf(`expression:${'x'.repeat(600)}`), undefined);
});

test('the host relays through the reader, and the candidate shell listens and opens a named ref through its one door', () => {
  const host = fs.readFileSync(new URL('../src/library/LibraryHost.tsx', import.meta.url), 'utf8');
  assert.ok(host.includes('relayedWorkspaceMode(data)'), 'LibraryHost relays through the shared reader');
  assert.ok(host.includes('detail: relayed'), 'the relayed detail is the one the reader built');
  // The candidate shell (product entry: src/main.tsx -> App.tsx). The legacy CradleFrame is not product and is not wired.
  const shell = fs.readFileSync(new URL('../../../packages/live-shell/ui/src/App.tsx', import.meta.url), 'utf8');
  assert.ok(shell.includes("import {workspaceModeDetail} from '../../../../desktop/cradle/src/library/workspaceModeRelay'"), 'App reads the detail through the shared reader');
  assert.ok(shell.includes("window.addEventListener('oi:host-workspace-mode', onHostMode)"), 'App listens for the relayed event');
  assert.ok(shell.includes('chooseModeRef.current(request.mode)'), 'the mode switch is the mode rail\'s own chooseMode');
  assert.ok(shell.includes('requestExpressionRef.current(request.ref)'), 'a named ref goes through the shell\'s one open door (workspace.requestExpression)');
  assert.ok(shell.includes('requestLocalDraftRef.current(request.id)'), 'an id-only request goes through the same door as a browser draft (workspace.requestLocalDraft)');
});
