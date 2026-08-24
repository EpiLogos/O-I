import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'agency-sidecar-entry.tsx'), 'utf8');
const css = fs.readFileSync(path.join(here, 'agency-sidecar.css'), 'utf8');
const composedWorkbench = fs.readFileSync(path.join(here, 'workbench.tsx'), 'utf8');
const inherited = fs.readFileSync(path.join(here, 'workbench-native.tsx'), 'utf8');
const index = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');

test('P3 reuses the inherited canonical AgentSession conversation Surface', () => {
  assert.match(source, /import \{ AgentEncounterSurface,/);
  assert.match(source, /<AgentEncounterSurface agentSessionRef=\{activeAgentSession\}/);
  assert.match(inherited, /invoke<AgentSurfaceReading>\('agent_surface_open'/);
  assert.match(inherited, /invoke<ConnectionSignal\[]>\('agent_surface_send'/);
  assert.match(composedWorkbench, /WorkbenchSurface as NativeWorkbenchSurface/);
  assert.match(composedWorkbench, /<NativeWorkbenchSurface onSelect=\{select\}/);
  assert.doesNotMatch(source, /DesktopChat/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('P3 consumes AIKit native Context, SessionSpace focus and stable semantic selection', () => {
  assert.match(source, /invoke<ContextResolution \| null>\('aikit_context_resolution'/);
  assert.match(source, /invoke<SessionSpaceState\[]>\('aikit_session_spaces'/);
  assert.match(source, /invoke<SessionSpaceReading>\('aikit_session_space_read'/);
  assert.match(source, /invoke\('aikit_session_space_focus'/);
  assert.match(source, /invoke\('select_semantic_ref'/);
  assert.match(source, /UI selection ≠ Context disclosure/);
});

test('P3 keeps action discovery distinct from authority and does not create a sidecar dispatcher', () => {
  assert.match(source, /Action visible ≠ Action authorised/);
  assert.match(source, /capability_granted/);
  assert.match(source, /action_authorised/);
  assert.doesNotMatch(source, /dispatch_contextual_factory_action|dispatch_factory_action/);
  assert.doesNotMatch(source, /invoke\([^\n]*action[^\n]*dispatch/i);
});

test('P3 exposes Actuation only to the depth of the currently registered owner reading', () => {
  assert.match(source, /native_owner === 'actuation'/);
  assert.match(source, /actuation\.agency\/v1/);
  assert.match(source, /actuation\.realised\/v1/);
  assert.match(source, /remain undisclosed here rather than being inferred/);
  assert.match(source, /Actuation WHAT ≠ AIKit HOW/);
});

test('P3 does not advertise concurrent interrupt until the current host bridge can actually perform it', () => {
  assert.match(css, /button:nth-child\(2\)/);
  assert.match(css, /display: none/);
  assert.match(source, /Live renderer streaming and concurrent interrupt are not claimed/);
});

test('P3 mounts as a presentation contribution inside the P1 Agency slot', () => {
  assert.match(index, /agency-sidecar-entry\.tsx/);
  assert.match(source, /\.oi-p1-agent-slot/);
  assert.match(source, /MutationObserver/);
});
