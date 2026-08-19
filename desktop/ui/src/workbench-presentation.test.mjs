import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = readFileSync(new URL('./workbench.tsx', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('./runtime-observation.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

// Presentation contract only: native/provider acceptance remains in Rust and the
// physical alpha. These assertions prevent the renderer from silently becoming a
// second state owner while the generic workbench evolves.
test('workbench projects the native SessionSpace application rather than inventing desktop state', () => {
  assert.match(workbench, /aikit_session_spaces/);
  assert.match(workbench, /aikit_session_space_read/);
  assert.match(workbench, /aikit_session_space_focus/);
  assert.match(workbench, /AIKit SessionSpace application/);
  assert.equal(workbench.includes('DesktopSessionSpace'), false);
  assert.equal(workbench.includes('OiSessionSpace'), false);
});

test('AgentSession conversation inhabits Encounter and keeps provider identity separate', () => {
  assert.match(workbench, /createPortal/);
  assert.match(workbench, /\.oi-shell__inspector/);
  assert.match(workbench, /agent_surface_open/);
  assert.match(workbench, /agent_surface_send/);
  assert.match(workbench, /agent_surface_cancel/);
  assert.match(workbench, /binding\.agent_session/);
  assert.match(workbench, /binding\.native_session_id/);
  assert.equal(workbench.includes('DesktopChat'), false);
  assert.equal(workbench.includes('OiConversation'), false);
  assert.equal(workbench.includes('model picker'), false);
});

test('Knowledge exposes bounded list tree graph reading and history without an O:I graph ontology', () => {
  for (const mode of ['list', 'tree', 'graph', 'reading', 'history']) {
    assert.match(workbench, new RegExp(`'${mode}'`));
  }
  assert.match(workbench, /knowledge_search/);
  assert.match(workbench, /knowledge_relations/);
  assert.match(workbench, /KnowledgeRelationView/);
  assert.match(workbench, /edge\.origin\.authority/);
  assert.equal(workbench.includes('OiGraphNode'), false);
  assert.equal(workbench.includes('DesktopWiki'), false);
});

test('target-owned runtime observation stays visibly separate from authored application state', () => {
  assert.match(runtime, /aikit_session_space_read/);
  assert.match(runtime, /Target-owned runtime observation/);
  assert.match(runtime, /AgentSessions/);
  assert.match(runtime, /Components/);
  assert.match(runtime, /Surfaces/);
  assert.match(runtime, /Connections/);
  assert.match(runtime, /provider\/native ids are observation|Provider\/native ids are observation/i);
});

test('generic C0 does not absorb corrected-C Epi domain semantics', () => {
  const generic = `${workbench}\n${runtime}\n${shell}`;
  for (const forbidden of [
    'EpiiRuntime',
    'AnuttaraRuntime',
    'epi_personal_depth',
    'M4′ Nara',
    'M5′ Epii',
    'M0′ Anuttara',
  ]) {
    assert.equal(generic.includes(forbidden), false, `generic workbench must not contain ${forbidden}`);
  }
});
