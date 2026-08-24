import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const flow = readFileSync(new URL('./flow-workbench.tsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('./native-document-editor.tsx', import.meta.url), 'utf8');
const project = readFileSync(new URL('./project-field.tsx', import.meta.url), 'utf8');

test('Flow uses the shared native document Surface and owner commands', () => {
  assert.match(flow, /NativeDocumentEditor/);
  assert.doesNotMatch(flow, /<textarea/);
  assert.match(editor, /Source identity[\s\S]*current revision[\s\S]*write authority/);
  assert.match(flow, /invoke<FlowDocument>\('flow_create'/);
  assert.match(flow, /invoke<FlowDocument>\('flow_save'/);
  assert.match(flow, /expectedRevision: document\.flow\.current_revision/);
  assert.match(flow, /human buffer preserved|buffer is intentionally untouched/);
});

test('Flow is composed into the existing Project Navigator and Canvas', () => {
  assert.match(project, /ProjectBaseNavigator/);
  assert.match(project, /FlowNavigator/);
  assert.match(project, /ProjectFieldBaseCanvas/);
  assert.match(project, /FlowWorkbench/);
  assert.match(project, /LivingWikiWorkbench/);
});

test('document events do not invoke contemplation implicitly', () => {
  const effects = [...flow.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[[^\]]*\]\);/g)].map((match) => match[1]).join('\n');
  assert.doesNotMatch(effects, /flow_contemplate/);
  assert.doesNotMatch(effects, /flow_contemplate_preflight/);
  assert.match(flow, />Preview Contemplate</);
  assert.match(flow, />Contemplate Flow</);
  // The JSX click handler contains `=>`, so a `[^>]*` source-text regex stops
  // before the button label even when the dirty guard is present. Keep this
  // source-level conformance check targeted to the complete Bind button line.
  assert.match(flow, /disabled=\{busy !== '' \|\| dirty\}.*>Bind current AgentSession/);
});

test('returned authorities remain separately presented', () => {
  for (const authority of ['flow', 'wiki-reading', 'claim', 'ground', 'run', 'agent-session']) {
    assert.ok(flow.includes(`'${authority}'`), `missing ${authority} authority presentation`);
  }
  assert.match(flow, /Flow owner/);
  assert.match(flow, /Agent Wiki \/ WikiReading/);
  assert.match(flow, /Human Ground/);
});
