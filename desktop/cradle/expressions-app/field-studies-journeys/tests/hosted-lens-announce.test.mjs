// The frame announces the Technē lens it stands in (the masthead chooser) in its hosted state, so the shell's lens bar can read it.
// Source pin on announceHostState: the lens is read inside the guard, so a call before the chooser exists omits it instead of
// throwing out of the whole announcement.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
const body = app.slice(app.indexOf('function announceHostState(){'), app.indexOf('const masthead=document.querySelector'));

test('announceHostState carries the active lens, read inside a guard, and omits it when none is read', () => {
  assert.ok(body.length > 200, 'announceHostState is found');
  assert.match(body, /let lens:LensId\|undefined;try\{lens=lensStudio\.active\(\);\}catch\{lens=undefined;\}/);
  assert.match(body, /const state=\{\.\.\.\(lens\?\{lens\}:\{\}\),\.\.\.\(instrument\?\{instrument\}:\{\}\),\.\.\.\(address\?\{address\}:\{\}\),nativeScene:/, 'the lens, then the native instrument (T-LIVE-TORUS-INSTRUMENT), then the address (E22, ticket P), each omitted when absent');
  assert.match(body, /const address=hostAddress\(\);/, 'the address is the frame\'s own (hostAddress, guarded there), read once per announcement');
  assert.match(body, /window\.parent\.postMessage\(\{v:1,kind:'oi-app-state',state\},'\*'\)/, 'the state is still posted as before');
});
