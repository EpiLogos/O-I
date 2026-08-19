import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectField = readFileSync(new URL('./project-field.tsx', import.meta.url), 'utf8');
const core = readFileSync(new URL('../../core/src/project_field.rs', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../core/src/bridge.rs', import.meta.url), 'utf8');

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
  assert.match(projectField, /project_source_read/);
  assert.match(core, /RetrievalTarget::Human/);
  assert.match(core, /selected != retrieved/);
  assert.match(core, /retrieved != disclosed-into-agent-context/);
});

test('Ground mutation is not proxied through the desktop host', () => {
  assert.match(core, /projectcentral\.ground\.inspect/);
  assert.match(core, /projectcentral\.ground\.plan/);
  assert.doesNotMatch(core, /"projectcentral\.ground\.apply" \|/);
  assert.match(core, /mutation\/authority remains with the native owner/);
});

test('ProjectMap integration is bounded AIKit reflection, not a desktop graph', () => {
  assert.match(core, /project_reflection\(map, &resource, 4, 96\)/);
  assert.match(projectField, /No graph is copied into O:I/);
  assert.match(bridge, /ObserveProjectReflection/);
});
