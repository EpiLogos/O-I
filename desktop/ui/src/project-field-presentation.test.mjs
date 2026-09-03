import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectField = readFileSync(new URL('./project-field.tsx', import.meta.url), 'utf8');
const projectFieldBase = readFileSync(new URL('./project-field-base.tsx', import.meta.url), 'utf8');
const projectFieldComposition = `${projectFieldBase}\n${projectField}`;
const livingWiki = readFileSync(new URL('./living-wiki.tsx', import.meta.url), 'utf8');
const workbench = readFileSync(new URL('./workbench.tsx', import.meta.url), 'utf8');
const currentWorld = readFileSync(new URL('./current-world.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../core/src/shell.rs', import.meta.url), 'utf8');
const core = readFileSync(new URL('../../core/src/project_field.rs', import.meta.url), 'utf8');
const knowledge = readFileSync(new URL('../../core/src/project_knowledge.rs', import.meta.url), 'utf8');

test('Project field preserves source classes instead of inventing desktop authority', () => {
  assert.match(projectFieldComposition, /Human-authored Ground/);
  assert.match(projectFieldComposition, /Agent Wiki \/ Knowledge/);
  assert.match(projectFieldComposition, /NOW \/ DAY · temporal material/);
  assert.match(projectFieldComposition, /Location alone is not authorship/);
  assert.doesNotMatch(projectFieldComposition, /DesktopWiki/);
  assert.doesNotMatch(core, /DesktopWiki/);
});

test('selection, retrieval and Agent Context disclosure remain distinct', () => {
  assert.match(projectFieldComposition, /selection does not retrieve/);
  assert.match(projectFieldComposition, /Agent Context unchanged/);
  assert.match(projectFieldComposition, /knowledge_read/);
  assert.match(core, /RetrievalTarget::Human/);
  assert.match(core, /selected != retrieved/);
  assert.match(core, /retrieved != disclosed-into-agent-context/);
  assert.match(knowledge, /Selection itself never calls/);
});

test('P2 projects the one P1 canonical selection instead of owning a second selection state', () => {
  assert.match(main, /selection=\{snapshot\.selection\}/);
  assert.match(main, /<WorkbenchSurface selection=\{selection\} currentWorld=\{currentWorld\} worldRecognition=\{worldRecognition\} onSelect=\{onSelect\} onReobserveWorld=\{onReobserveWorld\} \/>/);
  assert.match(workbench, /selection\?: WorkbenchSemanticRef/);
  assert.doesNotMatch(workbench, /useState<WorkbenchSemanticRef/);
  assert.match(workbench, /<ProjectNavigator selection=\{selection\}/);
  assert.match(workbench, /<ProjectFieldCanvas selection=\{selection\}/);
  assert.match(projectField, /<ProjectFieldBaseCanvas \{\.\.\.props\} \/>/);
  assert.match(projectField, /<LivingWikiWorkbench selection=\{props\.selection\} \/>/);
  assert.doesNotMatch(livingWiki, /useState<WorkbenchSemanticRef/);
});

test('Navigator consumes the one ShellSnapshot CurrentWorld without refetching or a machine model', () => {
  assert.match(shell, /pub current_world: CurrentWorldReading/);
  assert.match(main, /current_world\?: CurrentWorldReading/);
  assert.match(main, /currentWorld=\{snapshot\.current_world\}/);
  assert.match(workbench, /<CurrentWorldNavigator currentWorld=\{currentWorld\} \/>/);
  assert.doesNotMatch(currentWorld, /invoke\(/);
  assert.doesNotMatch(currentWorld, /useState/);
  assert.match(currentWorld, /currentWorld\?\.current_machine/);
  assert.match(currentWorld, /machine\.role/);
  assert.match(currentWorld, /machine\.central_source/);
  assert.match(currentWorld, /machine\.workcell_ref/);
  assert.doesNotMatch(currentWorld, /type MachineModel/);
});

test('Reconciled World is projected from the one ShellSnapshot without a desktop World model', () => {
  assert.match(shell, /pub world_recognition: Option<WorldRecognitionAccount>/);
  assert.match(main, /world_recognition\?: WorldRecognitionAccount/);
  assert.match(main, /worldRecognition=\{snapshot\.world_recognition\}/);
  assert.match(workbench, /<WorldRecognitionNavigator account=\{worldRecognition\} onReobserve=\{onReobserveWorld\} \/>/);
  const worldRecognitionModel = readFileSync(new URL('./world-recognition-model.mjs', import.meta.url), 'utf8');
  assert.match(worldRecognitionModel, /oi\.world-recognition-account\/v1/);
  assert.match(worldRecognitionModel, /owner_bindings/);
  assert.doesNotMatch(worldRecognitionModel, /invoke\(/);
  assert.doesNotMatch(worldRecognitionModel, /fetch\(/);
});

test('Navigator only labels CF5 from the CurrentWorld context-frame result', () => {
  assert.match(currentWorld, /frame\?\.maximal && frame\.reading === 'cf5'/);
  assert.match(currentWorld, /frame\?\.present_positions/);
  assert.doesNotMatch(currentWorld, /positions\.length === 6/);
});

test('Ground mutation is not proxied through the desktop host', () => {
  assert.match(core, /projectcentral\.ground\.inspect/);
  assert.match(core, /projectcentral\.now\.inspect/);
  assert.doesNotMatch(core, /fn invoke_central_action/);
  assert.match(projectFieldComposition, /Ground mutation is never proxied/);
});

test('ProjectMap integration is bounded AIKit reflection, not a desktop graph', () => {
  assert.match(core, /project_reflection\(map, &resource, 4, 96\)/);
  assert.match(projectFieldComposition, /No graph is copied into O:I/);
  assert.match(knowledge, /ProjectReflectionReadModel/);
  assert.match(knowledge, /ProjectRelations::Source/);
});

test('Living Knowledge composes around the accepted ProjectField rather than replacing it', () => {
  assert.match(projectField, /project-field-base/);
  assert.match(projectField, /LivingWikiWorkbench/);
  assert.match(livingWiki, /living_knowledge_status/);
  assert.match(livingWiki, /living_contemplate_preflight/);
  assert.match(livingWiki, /living_contemplate/);
  assert.doesNotMatch(livingWiki, /DesktopWiki/);
  assert.doesNotMatch(livingWiki, /filesystem.*watch/i);
});

test('P2 composes CurrentWorld, Navigator and Canvas around the inherited Workbench', () => {
  assert.match(workbench, /createPortal/);
  assert.match(workbench, /<CurrentWorldNavigator/);
  assert.match(workbench, /<ProjectNavigator/);
  assert.match(workbench, /<ProjectFieldCanvas/);
  assert.match(workbench, /<NativeWorkbenchSurface/);
});


test('authored relation workbench is mounted in the existing Project field and reuses canonical selection', () => {
  assert.match(projectField, /AuthoredRelationsWorkbench/);
  assert.match(projectField, /selection=\{props\.selection\}/);
  assert.match(projectField, /onSelect=\{props\.onSelect\}/);
});
