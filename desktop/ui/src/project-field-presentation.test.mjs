import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectField = readFileSync(new URL('./project-field.tsx', import.meta.url), 'utf8');
const workbench = readFileSync(new URL('./workbench.tsx', import.meta.url), 'utf8');
const core = readFileSync(new URL('../../core/src/project_field.rs', import.meta.url), 'utf8');
const knowledge = readFileSync(new URL('../../core/src/project_knowledge.rs', import.meta.url), 'utf8');

test('Project field preserves source classes instead of inventing desktop authority', () => {
  assert.match(projectField, /Human-authored Ground/);
  assert.match(projectField, /Agent Wiki \/ Knowledge/);
  assert.match(projectField, /NOW \/ DAY · temporal material/);
  assert.match(projectField, /Location alone is not authorship/);
  assert.doesNotMatch(projectField, /DesktopWiki/);
  assert.doesNotMatch(core, /DesktopWiki/);
});

test('selection, retrieval and Agent Context disclosure remain distinct', () => {
  assert.match(projectField, /selection does not retrieve/);
  assert.match(projectField, /Agent Context unchanged/);
  assert.match(projectField, /knowledge_read/);
  assert.match(core, /RetrievalTarget::Human/);
  assert.match(core, /selected != retrieved/);
  assert.match(core, /retrieved != disclosed-into-agent-context/);
  assert.match(knowledge, /Selection itself never calls/);
});

test('Ground mutation is not proxied through the desktop host', () => {
  assert.match(core, /projectcentral\.ground\.inspect/);
  assert.match(core, /projectcentral\.now\.inspect/);
  assert.doesNotMatch(core, /fn invoke_central_action/);
  assert.match(projectField, /Ground mutation is never proxied/);
});

test('ProjectMap integration is bounded AIKit reflection, not a desktop graph', () => {
  assert.match(core, /project_reflection\(map, &resource, 4, 96\)/);
  assert.match(projectField, /No graph is copied into O:I/);
  assert.match(knowledge, /ProjectRelations::Reflection/);
});

test('P2 composes Navigator and Canvas around the inherited Workbench', () => {
  assert.match(workbench, /createPortal/);
  assert.match(workbench, /<ProjectNavigator/);
  assert.match(workbench, /<ProjectFieldCanvas/);
  assert.match(workbench, /<NativeWorkbenchSurface/);
});
